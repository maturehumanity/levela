-- Section 14 step 2: quorum-health SLA alerting — keep a stable warning alert in sync
-- with live stale-signer counts from relay operations summary.

CREATE OR REPLACE FUNCTION public.sync_guardian_relay_attestation_sla_alerts(
  target_proposal_id uuid,
  requested_policy_key text DEFAULT 'guardian_relay_default',
  requested_attestation_sla_minutes integer DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  stale_count integer;
  sla_minutes integer;
  alert_row record;
BEGIN
  IF NOT public.current_profile_can_manage_guardian_relays() THEN
    RAISE EXCEPTION 'Current profile is not authorized to sync guardian relay attestation SLA alerts';
  END IF;

  IF target_proposal_id IS NULL THEN
    RAISE EXCEPTION 'Target proposal id is required';
  END IF;

  SELECT
    ops.stale_signer_count,
    ops.relay_attestation_sla_minutes
  INTO stale_count, sla_minutes
  FROM public.governance_proposal_guardian_relay_operations_summary(
    target_proposal_id,
    requested_policy_key,
    requested_attestation_sla_minutes
  ) AS ops;

  IF coalesce(stale_count, 0) > 0 THEN
    PERFORM public.open_governance_guardian_relay_alert(
      target_proposal_id,
      'relay_attestation_sla',
      'warning',
      'sla_health',
      format(
        '%s external signer(s) have relay attestations older than the %s minute SLA (or missing).',
        stale_count,
        greatest(1, coalesce(sla_minutes, 120))
      ),
      jsonb_build_object(
        'source', 'sync_guardian_relay_attestation_sla_alerts',
        'stale_signer_count', stale_count,
        'relay_attestation_sla_minutes', greatest(1, coalesce(sla_minutes, 120))
      )
    );
  ELSE
    FOR alert_row IN
      SELECT alert.id
      FROM public.governance_guardian_relay_alerts AS alert
      WHERE alert.proposal_id = target_proposal_id
        AND alert.alert_key = 'relay_attestation_sla'
        AND alert.alert_status IN ('open', 'acknowledged')
    LOOP
      PERFORM public.resolve_governance_guardian_relay_alert(
        alert_row.id,
        'Cleared automatically: relay attestations are within the SLA window.'
      );
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.sync_guardian_relay_attestation_sla_alerts(uuid, text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_governance_guardian_relay_worker_run(
  target_proposal_id uuid,
  run_scope text,
  run_status text,
  processed_signer_count integer DEFAULT 0,
  stale_signer_count integer DEFAULT 0,
  open_alert_count integer DEFAULT 0,
  error_message text DEFAULT NULL,
  run_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  inserted_id uuid;
  normalized_scope text;
  normalized_status text;
  open_critical_count integer;
BEGIN
  IF NOT public.current_profile_can_manage_guardian_relays() THEN
    RAISE EXCEPTION 'Current profile is not authorized to record guardian relay worker runs';
  END IF;

  IF target_proposal_id IS NULL THEN
    RAISE EXCEPTION 'Target proposal id is required';
  END IF;

  normalized_scope := lower(coalesce(nullif(btrim(coalesce(run_scope, '')), ''), 'manual'));
  IF normalized_scope NOT IN ('attestation_sweep', 'diversity_audit', 'manifest_capture', 'manual') THEN
    RAISE EXCEPTION 'Worker run scope must be attestation_sweep, diversity_audit, manifest_capture, or manual';
  END IF;

  normalized_status := lower(coalesce(nullif(btrim(coalesce(run_status, '')), ''), 'ok'));
  IF normalized_status NOT IN ('ok', 'degraded', 'failed') THEN
    RAISE EXCEPTION 'Worker run status must be ok, degraded, or failed';
  END IF;

  INSERT INTO public.governance_guardian_relay_worker_runs (
    proposal_id,
    run_scope,
    run_status,
    processed_signer_count,
    stale_signer_count,
    open_alert_count,
    error_message,
    run_payload,
    observed_at,
    created_by
  )
  VALUES (
    target_proposal_id,
    normalized_scope,
    normalized_status,
    greatest(0, coalesce(processed_signer_count, 0)),
    greatest(0, coalesce(stale_signer_count, 0)),
    greatest(0, coalesce(open_alert_count, 0)),
    nullif(btrim(coalesce(error_message, '')), ''),
    coalesce(run_payload, '{}'::jsonb),
    now(),
    public.current_profile_id()
  )
  RETURNING id INTO inserted_id;

  SELECT count(*)::integer
  INTO open_critical_count
  FROM public.governance_guardian_relay_alerts AS alert_row
  WHERE alert_row.proposal_id = target_proposal_id
    AND alert_row.alert_status = 'open'
    AND alert_row.severity = 'critical';

  IF coalesce(open_critical_count, 0) > 0 THEN
    PERFORM public.maybe_escalate_guardian_relay_critical_public_execution_page(
      target_proposal_id,
      open_critical_count,
      NULL,
      jsonb_build_object(
        'trigger', 'record_governance_guardian_relay_worker_run',
        'worker_run_id', inserted_id,
        'run_scope', normalized_scope,
        'run_status', normalized_status
      )
    );
  END IF;

  PERFORM public.sync_guardian_relay_attestation_sla_alerts(target_proposal_id, 'guardian_relay_default', NULL);

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.record_governance_guardian_relay_attestation(
  target_proposal_id uuid,
  target_external_signer_id uuid,
  target_relay_id uuid,
  attestation_decision public.governance_guardian_decision,
  attestation_status public.governance_guardian_relay_attestation_status DEFAULT 'verified',
  attestation_payload_hash text DEFAULT NULL,
  attestation_reference text DEFAULT NULL,
  attestation_chain_network text DEFAULT NULL,
  attestation_chain_reference text DEFAULT NULL,
  attestation_metadata jsonb DEFAULT '{}'::jsonb,
  verified_at timestamptz DEFAULT now()
)
RETURNS uuid AS $$
DECLARE
  proposal_status public.governance_proposal_status;
  inserted_id uuid;
BEGIN
  IF NOT public.current_profile_can_manage_guardian_relays() THEN
    RAISE EXCEPTION 'Current profile is not authorized to record guardian relay attestations';
  END IF;

  IF target_proposal_id IS NULL OR target_external_signer_id IS NULL OR target_relay_id IS NULL THEN
    RAISE EXCEPTION 'Proposal, external signer, and relay ids are required';
  END IF;

  SELECT proposal.status
  INTO proposal_status
  FROM public.governance_proposals AS proposal
  WHERE proposal.id = target_proposal_id
  LIMIT 1;

  IF proposal_status IS NULL THEN
    RAISE EXCEPTION 'Guardian relay attestation proposal does not exist';
  END IF;

  IF proposal_status <> 'open'::public.governance_proposal_status THEN
    RAISE EXCEPTION 'Guardian relay attestations can only be recorded while proposal is open';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.governance_guardian_external_signers AS signer
    WHERE signer.id = target_external_signer_id
      AND signer.is_active = true
  ) THEN
    RAISE EXCEPTION 'Guardian relay attestation external signer is not active';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.governance_guardian_relay_nodes AS relay
    WHERE relay.id = target_relay_id
      AND relay.is_active = true
  ) THEN
    RAISE EXCEPTION 'Guardian relay node is not active';
  END IF;

  INSERT INTO public.governance_proposal_guardian_relay_attestations (
    proposal_id,
    external_signer_id,
    relay_id,
    decision,
    status,
    payload_hash,
    relay_reference,
    chain_network,
    chain_reference,
    attestation_metadata,
    verified_by,
    verified_at
  )
  VALUES (
    target_proposal_id,
    target_external_signer_id,
    target_relay_id,
    attestation_decision,
    coalesce(attestation_status, 'verified'::public.governance_guardian_relay_attestation_status),
    nullif(btrim(coalesce(attestation_payload_hash, '')), ''),
    nullif(btrim(coalesce(attestation_reference, '')), ''),
    nullif(btrim(coalesce(attestation_chain_network, '')), ''),
    nullif(btrim(coalesce(attestation_chain_reference, '')), ''),
    coalesce(attestation_metadata, '{}'::jsonb),
    public.current_profile_id(),
    coalesce(verified_at, now())
  )
  ON CONFLICT (proposal_id, external_signer_id, relay_id) DO UPDATE
    SET decision = excluded.decision,
        status = excluded.status,
        payload_hash = excluded.payload_hash,
        relay_reference = excluded.relay_reference,
        chain_network = excluded.chain_network,
        chain_reference = excluded.chain_reference,
        attestation_metadata = excluded.attestation_metadata,
        verified_by = excluded.verified_by,
        verified_at = excluded.verified_at
  RETURNING id INTO inserted_id;

  PERFORM public.sync_guardian_relay_attestation_sla_alerts(target_proposal_id, 'guardian_relay_default', NULL);

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
