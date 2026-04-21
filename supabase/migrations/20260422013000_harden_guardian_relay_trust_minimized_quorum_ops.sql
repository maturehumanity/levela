ALTER TABLE public.governance_guardian_relay_policies
  ADD COLUMN IF NOT EXISTS require_trust_minimized_quorum boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS require_relay_ops_readiness boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_open_critical_relay_alerts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS relay_attestation_sla_minutes integer NOT NULL DEFAULT 120;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'governance_guardian_relay_policies_max_open_critical_relay_alerts_check'
  ) THEN
    ALTER TABLE public.governance_guardian_relay_policies
      ADD CONSTRAINT governance_guardian_relay_policies_max_open_critical_relay_alerts_check
      CHECK (max_open_critical_relay_alerts >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'governance_guardian_relay_policies_relay_attestation_sla_minutes_check'
  ) THEN
    ALTER TABLE public.governance_guardian_relay_policies
      ADD CONSTRAINT governance_guardian_relay_policies_relay_attestation_sla_minutes_check
      CHECK (relay_attestation_sla_minutes >= 1);
  END IF;
END $$;

UPDATE public.governance_guardian_relay_policies
SET
  require_trust_minimized_quorum = coalesce(require_trust_minimized_quorum, false),
  require_relay_ops_readiness = coalesce(require_relay_ops_readiness, false),
  max_open_critical_relay_alerts = greatest(0, coalesce(max_open_critical_relay_alerts, 0)),
  relay_attestation_sla_minutes = greatest(1, coalesce(relay_attestation_sla_minutes, 120));

CREATE TABLE IF NOT EXISTS public.governance_guardian_relay_worker_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.governance_proposals(id) ON DELETE CASCADE,
  run_scope text NOT NULL,
  run_status text NOT NULL,
  processed_signer_count integer NOT NULL DEFAULT 0,
  stale_signer_count integer NOT NULL DEFAULT 0,
  open_alert_count integer NOT NULL DEFAULT 0,
  error_message text,
  run_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_guardian_relay_worker_runs_scope_check CHECK (
    run_scope IN ('attestation_sweep', 'diversity_audit', 'manifest_capture', 'manual')
  ),
  CONSTRAINT governance_guardian_relay_worker_runs_status_check CHECK (
    run_status IN ('ok', 'degraded', 'failed')
  ),
  CONSTRAINT governance_guardian_relay_worker_runs_processed_signer_count_check CHECK (processed_signer_count >= 0),
  CONSTRAINT governance_guardian_relay_worker_runs_stale_signer_count_check CHECK (stale_signer_count >= 0),
  CONSTRAINT governance_guardian_relay_worker_runs_open_alert_count_check CHECK (open_alert_count >= 0),
  CONSTRAINT governance_guardian_relay_worker_runs_error_message_not_empty_check CHECK (
    error_message IS NULL OR length(trim(error_message)) > 0
  ),
  CONSTRAINT governance_guardian_relay_worker_runs_payload_object_check CHECK (jsonb_typeof(run_payload) = 'object')
);

CREATE TABLE IF NOT EXISTS public.governance_guardian_relay_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.governance_proposals(id) ON DELETE CASCADE,
  alert_key text NOT NULL,
  severity text NOT NULL,
  alert_scope text NOT NULL,
  alert_status text NOT NULL DEFAULT 'open',
  alert_message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  opened_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_guardian_relay_alerts_alert_key_not_empty_check CHECK (length(trim(alert_key)) > 0),
  CONSTRAINT governance_guardian_relay_alerts_severity_check CHECK (
    severity IN ('info', 'warning', 'critical')
  ),
  CONSTRAINT governance_guardian_relay_alerts_scope_not_empty_check CHECK (length(trim(alert_scope)) > 0),
  CONSTRAINT governance_guardian_relay_alerts_status_check CHECK (
    alert_status IN ('open', 'acknowledged', 'resolved')
  ),
  CONSTRAINT governance_guardian_relay_alerts_message_not_empty_check CHECK (length(trim(alert_message)) > 0),
  CONSTRAINT governance_guardian_relay_alerts_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT governance_guardian_relay_alerts_unique_key UNIQUE (proposal_id, alert_key)
);

CREATE INDEX IF NOT EXISTS idx_governance_guardian_relay_worker_runs_proposal_observed
  ON public.governance_guardian_relay_worker_runs (proposal_id, observed_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_guardian_relay_alerts_proposal_status_severity
  ON public.governance_guardian_relay_alerts (proposal_id, alert_status, severity, opened_at DESC, created_at DESC);

DO $$
BEGIN
  CREATE TRIGGER update_governance_guardian_relay_worker_runs_updated_at
    BEFORE UPDATE ON public.governance_guardian_relay_worker_runs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_governance_guardian_relay_alerts_updated_at
    BEFORE UPDATE ON public.governance_guardian_relay_alerts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

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

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.open_governance_guardian_relay_alert(
  target_proposal_id uuid,
  alert_key text,
  severity text,
  alert_scope text,
  alert_message text,
  metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  inserted_id uuid;
  normalized_severity text;
BEGIN
  IF NOT public.current_profile_can_manage_guardian_relays() THEN
    RAISE EXCEPTION 'Current profile is not authorized to open guardian relay alerts';
  END IF;

  IF target_proposal_id IS NULL THEN
    RAISE EXCEPTION 'Target proposal id is required';
  END IF;

  normalized_severity := lower(coalesce(nullif(btrim(coalesce(severity, '')), ''), 'warning'));
  IF normalized_severity NOT IN ('info', 'warning', 'critical') THEN
    RAISE EXCEPTION 'Alert severity must be info, warning, or critical';
  END IF;

  INSERT INTO public.governance_guardian_relay_alerts (
    proposal_id,
    alert_key,
    severity,
    alert_scope,
    alert_status,
    alert_message,
    metadata,
    opened_at,
    created_by
  )
  VALUES (
    target_proposal_id,
    btrim(coalesce(alert_key, '')),
    normalized_severity,
    lower(coalesce(nullif(btrim(coalesce(alert_scope, '')), ''), 'manual')),
    'open',
    btrim(coalesce(alert_message, '')),
    coalesce(metadata, '{}'::jsonb),
    now(),
    public.current_profile_id()
  )
  ON CONFLICT (proposal_id, alert_key) DO UPDATE
    SET severity = excluded.severity,
        alert_scope = excluded.alert_scope,
        alert_status = 'open',
        alert_message = excluded.alert_message,
        metadata = coalesce(public.governance_guardian_relay_alerts.metadata, '{}'::jsonb)
          || coalesce(excluded.metadata, '{}'::jsonb),
        opened_at = now(),
        acknowledged_at = NULL,
        resolved_at = NULL,
        resolved_by = NULL
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.resolve_governance_guardian_relay_alert(
  target_alert_id uuid,
  resolution_notes text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  alert_record public.governance_guardian_relay_alerts%ROWTYPE;
BEGIN
  IF NOT public.current_profile_can_manage_guardian_relays() THEN
    RAISE EXCEPTION 'Current profile is not authorized to resolve guardian relay alerts';
  END IF;

  SELECT *
  INTO alert_record
  FROM public.governance_guardian_relay_alerts AS alert
  WHERE alert.id = target_alert_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Guardian relay alert not found';
  END IF;

  UPDATE public.governance_guardian_relay_alerts
  SET
    alert_status = 'resolved',
    metadata = coalesce(alert_record.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'resolution_notes', nullif(btrim(coalesce(resolution_notes, '')), ''),
        'resolved_at', now()
      ),
    resolved_at = now(),
    resolved_by = public.current_profile_id()
  WHERE id = alert_record.id;

  RETURN alert_record.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.set_governance_guardian_relay_ops_requirement(
  requested_policy_key text DEFAULT 'guardian_relay_default',
  requested_require_trust_minimized_quorum boolean DEFAULT false,
  requested_require_relay_ops_readiness boolean DEFAULT false,
  requested_max_open_critical_relay_alerts integer DEFAULT 0,
  requested_relay_attestation_sla_minutes integer DEFAULT 120
)
RETURNS uuid AS $$
DECLARE
  resolved_id uuid;
BEGIN
  IF NOT public.current_profile_can_manage_guardian_relays() THEN
    RAISE EXCEPTION 'Current profile is not authorized to manage guardian relay operations requirements';
  END IF;

  UPDATE public.governance_guardian_relay_policies
  SET
    require_trust_minimized_quorum = coalesce(requested_require_trust_minimized_quorum, false),
    require_relay_ops_readiness = coalesce(requested_require_relay_ops_readiness, false),
    max_open_critical_relay_alerts = greatest(0, coalesce(requested_max_open_critical_relay_alerts, 0)),
    relay_attestation_sla_minutes = greatest(1, coalesce(requested_relay_attestation_sla_minutes, 120)),
    updated_by = public.current_profile_id(),
    updated_at = now()
  WHERE policy_key = lower(coalesce(nullif(btrim(coalesce(requested_policy_key, '')), ''), 'guardian_relay_default'))
  RETURNING id INTO resolved_id;

  IF resolved_id IS NULL THEN
    INSERT INTO public.governance_guardian_relay_policies (
      policy_key,
      policy_name,
      is_enabled,
      required_relay_attestations,
      require_chain_proof_match,
      min_distinct_relay_regions,
      min_distinct_relay_providers,
      min_distinct_relay_operators,
      min_distinct_relay_jurisdictions,
      min_distinct_relay_trust_domains,
      max_dominant_relay_region_share_percent,
      max_dominant_relay_provider_share_percent,
      max_dominant_relay_operator_share_percent,
      max_dominant_relay_jurisdiction_share_percent,
      max_dominant_relay_trust_domain_share_percent,
      require_trust_minimized_quorum,
      require_relay_ops_readiness,
      max_open_critical_relay_alerts,
      relay_attestation_sla_minutes,
      notes,
      metadata,
      updated_by
    )
    VALUES (
      lower(coalesce(nullif(btrim(coalesce(requested_policy_key, '')), ''), 'guardian_relay_default')),
      'Guardian relay default policy',
      true,
      2,
      true,
      2,
      2,
      2,
      1,
      1,
      80,
      80,
      80,
      80,
      80,
      coalesce(requested_require_trust_minimized_quorum, false),
      coalesce(requested_require_relay_ops_readiness, false),
      greatest(0, coalesce(requested_max_open_critical_relay_alerts, 0)),
      greatest(1, coalesce(requested_relay_attestation_sla_minutes, 120)),
      null,
      jsonb_build_object('source', 'set_governance_guardian_relay_ops_requirement'),
      public.current_profile_id()
    )
    RETURNING id INTO resolved_id;
  END IF;

  RETURN resolved_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_proposal_guardian_relay_worker_run_board(
  target_proposal_id uuid,
  max_entries integer DEFAULT 60
)
RETURNS TABLE (
  run_id uuid,
  run_scope text,
  run_status text,
  processed_signer_count integer,
  stale_signer_count integer,
  open_alert_count integer,
  error_message text,
  observed_at timestamptz
) AS $$
SELECT
  run.id AS run_id,
  run.run_scope,
  run.run_status,
  run.processed_signer_count,
  run.stale_signer_count,
  run.open_alert_count,
  run.error_message,
  run.observed_at
FROM public.governance_guardian_relay_worker_runs AS run
WHERE run.proposal_id = target_proposal_id
ORDER BY run.observed_at DESC, run.created_at DESC, run.id DESC
LIMIT greatest(1, coalesce(max_entries, 60));
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_proposal_guardian_relay_alert_board(
  target_proposal_id uuid,
  status_filter text DEFAULT NULL,
  max_entries integer DEFAULT 60
)
RETURNS TABLE (
  alert_id uuid,
  alert_key text,
  severity text,
  alert_scope text,
  alert_status text,
  alert_message text,
  opened_at timestamptz,
  resolved_at timestamptz
) AS $$
SELECT
  alert.id AS alert_id,
  alert.alert_key,
  alert.severity,
  alert.alert_scope,
  alert.alert_status,
  alert.alert_message,
  alert.opened_at,
  alert.resolved_at
FROM public.governance_guardian_relay_alerts AS alert
WHERE alert.proposal_id = target_proposal_id
  AND (
    status_filter IS NULL
    OR alert.alert_status = lower(btrim(status_filter))
  )
ORDER BY
  CASE
    WHEN alert.alert_status = 'open' THEN 0
    WHEN alert.alert_status = 'acknowledged' THEN 1
    ELSE 2
  END,
  CASE
    WHEN alert.severity = 'critical' THEN 0
    WHEN alert.severity = 'warning' THEN 1
    ELSE 2
  END,
  alert.opened_at DESC,
  alert.created_at DESC
LIMIT greatest(1, coalesce(max_entries, 60));
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_proposal_guardian_relay_operations_summary(
  target_proposal_id uuid,
  requested_policy_key text DEFAULT 'guardian_relay_default',
  requested_attestation_sla_minutes integer DEFAULT NULL
)
RETURNS TABLE (
  policy_key text,
  require_trust_minimized_quorum boolean,
  require_relay_ops_readiness boolean,
  max_open_critical_relay_alerts integer,
  relay_attestation_sla_minutes integer,
  external_approval_count integer,
  stale_signer_count integer,
  open_warning_alert_count integer,
  open_critical_alert_count integer,
  last_worker_run_at timestamptz,
  last_worker_run_status text,
  trust_minimized_quorum_met boolean,
  relay_ops_ready boolean
) AS $$
WITH policy AS (
  SELECT
    relay_policy.policy_key,
    coalesce(relay_policy.require_trust_minimized_quorum, false) AS require_trust_minimized_quorum,
    coalesce(relay_policy.require_relay_ops_readiness, false) AS require_relay_ops_readiness,
    greatest(0, coalesce(relay_policy.max_open_critical_relay_alerts, 0))::integer AS max_open_critical_relay_alerts,
    greatest(1, coalesce(relay_policy.relay_attestation_sla_minutes, 120))::integer AS relay_attestation_sla_minutes
  FROM public.governance_guardian_relay_policies AS relay_policy
  WHERE relay_policy.policy_key = lower(coalesce(nullif(btrim(coalesce(requested_policy_key, '')), ''), 'guardian_relay_default'))
  ORDER BY relay_policy.updated_at DESC, relay_policy.created_at DESC, relay_policy.id DESC
  LIMIT 1
),
fallback_policy AS (
  SELECT
    lower(coalesce(nullif(btrim(coalesce(requested_policy_key, '')), ''), 'guardian_relay_default')) AS policy_key,
    false AS require_trust_minimized_quorum,
    false AS require_relay_ops_readiness,
    0::integer AS max_open_critical_relay_alerts,
    120::integer AS relay_attestation_sla_minutes
  WHERE NOT EXISTS (SELECT 1 FROM policy)
),
effective_policy AS (
  SELECT * FROM policy
  UNION ALL
  SELECT * FROM fallback_policy
),
attestation_sla AS (
  SELECT
    greatest(
      1,
      coalesce(
        requested_attestation_sla_minutes,
        (SELECT relay_attestation_sla_minutes FROM effective_policy LIMIT 1),
        120
      )
    )::integer AS relay_attestation_sla_minutes
),
external_approvals AS (
  SELECT signature.external_signer_id
  FROM public.governance_proposal_guardian_external_signatures AS signature
  JOIN public.governance_guardian_external_signers AS signer
    ON signer.id = signature.external_signer_id
  WHERE signature.proposal_id = target_proposal_id
    AND signature.decision = 'approve'::public.governance_guardian_decision
    AND signature.verified_at IS NOT NULL
    AND signer.is_active = true
),
latest_signer_attestations AS (
  SELECT
    approval.external_signer_id,
    max(attestation.verified_at) AS latest_attested_at
  FROM external_approvals AS approval
  LEFT JOIN public.governance_proposal_guardian_relay_attestations AS attestation
    ON attestation.proposal_id = target_proposal_id
    AND attestation.external_signer_id = approval.external_signer_id
    AND EXISTS (
      SELECT 1
      FROM public.governance_guardian_relay_nodes AS relay
      WHERE relay.id = attestation.relay_id
        AND relay.is_active = true
    )
  GROUP BY approval.external_signer_id
),
stale_signer_tally AS (
  SELECT
    coalesce(count(*) FILTER (
      WHERE signer_attestation.latest_attested_at IS NULL
         OR signer_attestation.latest_attested_at < (now() - make_interval(mins => attestation_sla.relay_attestation_sla_minutes))
    ), 0)::integer AS stale_signer_count
  FROM latest_signer_attestations AS signer_attestation
  CROSS JOIN attestation_sla
),
external_approval_tally AS (
  SELECT coalesce(count(*), 0)::integer AS external_approval_count
  FROM external_approvals
),
alert_tally AS (
  SELECT
    coalesce(count(*) FILTER (
      WHERE alert.alert_status = 'open'
        AND alert.severity = 'warning'
    ), 0)::integer AS open_warning_alert_count,
    coalesce(count(*) FILTER (
      WHERE alert.alert_status = 'open'
        AND alert.severity = 'critical'
    ), 0)::integer AS open_critical_alert_count
  FROM public.governance_guardian_relay_alerts AS alert
  WHERE alert.proposal_id = target_proposal_id
),
last_worker_run AS (
  SELECT
    run.observed_at AS last_worker_run_at,
    run.run_status AS last_worker_run_status
  FROM public.governance_guardian_relay_worker_runs AS run
  WHERE run.proposal_id = target_proposal_id
  ORDER BY run.observed_at DESC, run.created_at DESC, run.id DESC
  LIMIT 1
),
trust_summary AS (
  SELECT *
  FROM public.governance_proposal_guardian_relay_trust_minimized_summary(target_proposal_id)
)
SELECT
  effective_policy.policy_key,
  effective_policy.require_trust_minimized_quorum,
  effective_policy.require_relay_ops_readiness,
  effective_policy.max_open_critical_relay_alerts,
  attestation_sla.relay_attestation_sla_minutes,
  external_approval_tally.external_approval_count,
  stale_signer_tally.stale_signer_count,
  alert_tally.open_warning_alert_count,
  alert_tally.open_critical_alert_count,
  last_worker_run.last_worker_run_at,
  coalesce(last_worker_run.last_worker_run_status, 'unknown') AS last_worker_run_status,
  coalesce(trust_summary.trust_minimized_quorum_met, false) AS trust_minimized_quorum_met,
  (
    effective_policy.require_relay_ops_readiness = false
    OR (
      (
        external_approval_tally.external_approval_count = 0
        OR stale_signer_tally.stale_signer_count = 0
      )
      AND alert_tally.open_critical_alert_count <= effective_policy.max_open_critical_relay_alerts
      AND (
        effective_policy.require_trust_minimized_quorum = false
        OR coalesce(trust_summary.trust_minimized_quorum_met, false)
      )
    )
  ) AS relay_ops_ready
FROM effective_policy
CROSS JOIN attestation_sla
CROSS JOIN external_approval_tally
CROSS JOIN stale_signer_tally
CROSS JOIN alert_tally
LEFT JOIN last_worker_run ON true
LEFT JOIN trust_summary ON true;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_proposal_guardian_relay_client_proof_manifest(
  target_proposal_id uuid
)
RETURNS TABLE (
  manifest_version text,
  manifest_hash text,
  manifest_payload jsonb,
  trust_minimized_quorum_met boolean
) AS $$
WITH relay_summary AS (
  SELECT *
  FROM public.governance_proposal_guardian_relay_summary(target_proposal_id)
),
trust_summary AS (
  SELECT *
  FROM public.governance_proposal_guardian_relay_trust_minimized_summary(target_proposal_id)
),
relay_operations AS (
  SELECT *
  FROM public.governance_proposal_guardian_relay_operations_summary(target_proposal_id, 'guardian_relay_default', NULL)
),
latest_relay_audit AS (
  SELECT *
  FROM public.governance_proposal_guardian_relay_recent_audits(target_proposal_id, 1)
),
manifest_payload_cte AS (
  SELECT jsonb_build_object(
    'manifest_version', 'guardian_relay_client_proof_v1',
    'generated_at', now(),
    'proposal_id', target_proposal_id,
    'relay_summary', coalesce((SELECT to_jsonb(row_data) FROM relay_summary AS row_data), '{}'::jsonb),
    'trust_summary', coalesce((SELECT to_jsonb(row_data) FROM trust_summary AS row_data), '{}'::jsonb),
    'relay_operations', coalesce((SELECT to_jsonb(row_data) FROM relay_operations AS row_data), '{}'::jsonb),
    'latest_relay_audit', coalesce((SELECT to_jsonb(row_data) FROM latest_relay_audit AS row_data), '{}'::jsonb),
    'external_approvals', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'external_signer_id', signature.external_signer_id,
          'signer_key', signer.signer_key,
          'decision', signature.decision,
          'payload_hash', signature.payload_hash,
          'signature_reference', signature.signature_reference,
          'verification_method', signature.verification_method,
          'verified_at', signature.verified_at,
          'signed_at', signature.signed_at
        )
        ORDER BY signature.verified_at DESC NULLS LAST, signature.created_at DESC
      )
      FROM public.governance_proposal_guardian_external_signatures AS signature
      JOIN public.governance_guardian_external_signers AS signer
        ON signer.id = signature.external_signer_id
      WHERE signature.proposal_id = target_proposal_id
        AND signer.is_active = true
        AND signature.verified_at IS NOT NULL
    ), '[]'::jsonb),
    'relay_attestations', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'external_signer_id', attestation.external_signer_id,
          'relay_id', attestation.relay_id,
          'relay_key', relay.relay_key,
          'relay_region_code', relay.relay_region_code,
          'relay_infrastructure_provider', relay.relay_infrastructure_provider,
          'relay_operator_label', relay.relay_operator_label,
          'relay_jurisdiction_country_code', relay.relay_jurisdiction_country_code,
          'relay_trust_domain', relay.relay_trust_domain,
          'status', attestation.status,
          'payload_hash', attestation.payload_hash,
          'attestation_reference', attestation.attestation_reference,
          'chain_network', attestation.chain_network,
          'chain_reference', attestation.chain_reference,
          'verified_at', attestation.verified_at
        )
        ORDER BY attestation.verified_at DESC NULLS LAST, attestation.created_at DESC
      )
      FROM public.governance_proposal_guardian_relay_attestations AS attestation
      JOIN public.governance_guardian_relay_nodes AS relay
        ON relay.id = attestation.relay_id
      WHERE attestation.proposal_id = target_proposal_id
    ), '[]'::jsonb)
  ) AS manifest_payload
)
SELECT
  'guardian_relay_client_proof_v1'::text AS manifest_version,
  encode(
    digest(
      (manifest_payload_cte.manifest_payload::text)::bytea,
      'sha256'
    ),
    'hex'
  ) AS manifest_hash,
  manifest_payload_cte.manifest_payload,
  coalesce((manifest_payload_cte.manifest_payload #>> '{trust_summary,trust_minimized_quorum_met}')::boolean, false) AS trust_minimized_quorum_met
FROM manifest_payload_cte;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_proposal_guardian_signoff_summary(
  target_proposal_id uuid
)
RETURNS TABLE (
  requires_guardian_signoff boolean,
  approval_class public.governance_threshold_approval_class,
  required_approvals integer,
  approval_count integer,
  rejection_count integer,
  decisive_count integer,
  requires_window_close boolean,
  meets_signoff boolean
) AS $$
WITH target_proposal AS (
  SELECT
    proposal.id,
    proposal.decision_class,
    proposal.closes_at,
    proposal.metadata,
    coalesce(nullif(proposal.metadata ->> 'execution_action_type', ''), 'manual_follow_through') AS execution_action_type
  FROM public.governance_proposals AS proposal
  WHERE proposal.id = target_proposal_id
  LIMIT 1
),
threshold_rule AS (
  SELECT
    rule.approval_class,
    rule.min_approval_votes,
    rule.requires_window_close
  FROM target_proposal
  CROSS JOIN LATERAL public.resolve_governance_execution_threshold_rule(
    target_proposal.execution_action_type,
    target_proposal.decision_class
  ) AS rule
),
internal_tally AS (
  SELECT
    coalesce(count(*) FILTER (WHERE approval.decision = 'approve'::public.governance_guardian_decision), 0)::integer AS approvals,
    coalesce(count(*) FILTER (WHERE approval.decision = 'reject'::public.governance_guardian_decision), 0)::integer AS rejections
  FROM public.governance_proposal_guardian_approvals AS approval
  JOIN target_proposal ON target_proposal.id = approval.proposal_id
  WHERE public.profile_is_guardian_signer(approval.signer_profile_id)
),
multisig_summary AS (
  SELECT *
  FROM public.governance_proposal_external_multisig_summary(target_proposal_id)
),
relay_summary AS (
  SELECT *
  FROM public.governance_proposal_guardian_relay_summary(target_proposal_id)
),
trust_summary AS (
  SELECT *
  FROM public.governance_proposal_guardian_relay_trust_minimized_summary(target_proposal_id)
),
relay_ops_summary AS (
  SELECT *
  FROM public.governance_proposal_guardian_relay_operations_summary(target_proposal_id, 'guardian_relay_default', NULL)
)
SELECT
  (coalesce(threshold_rule.approval_class, 'ordinary_majority'::public.governance_threshold_approval_class)
    = 'guardian_threshold'::public.governance_threshold_approval_class) AS requires_guardian_signoff,
  coalesce(threshold_rule.approval_class, 'ordinary_majority'::public.governance_threshold_approval_class) AS approval_class,
  CASE
    WHEN coalesce(threshold_rule.approval_class, 'ordinary_majority'::public.governance_threshold_approval_class)
      = 'guardian_threshold'::public.governance_threshold_approval_class
    THEN greatest(2, coalesce(threshold_rule.min_approval_votes, 2))
    ELSE 0
  END AS required_approvals,
  (
    coalesce(internal_tally.approvals, 0)
    + CASE WHEN coalesce(multisig_summary.external_multisig_required, false) THEN coalesce(multisig_summary.external_approval_count, 0) ELSE 0 END
  ) AS approval_count,
  (
    coalesce(internal_tally.rejections, 0)
    + CASE WHEN coalesce(multisig_summary.external_multisig_required, false) THEN coalesce(multisig_summary.external_rejection_count, 0) ELSE 0 END
  ) AS rejection_count,
  (
    coalesce(internal_tally.approvals, 0)
    + coalesce(internal_tally.rejections, 0)
    + CASE WHEN coalesce(multisig_summary.external_multisig_required, false) THEN coalesce(multisig_summary.external_decisive_count, 0) ELSE 0 END
  ) AS decisive_count,
  coalesce(threshold_rule.requires_window_close, false) AS requires_window_close,
  CASE
    WHEN coalesce(threshold_rule.approval_class, 'ordinary_majority'::public.governance_threshold_approval_class)
      <> 'guardian_threshold'::public.governance_threshold_approval_class
    THEN true
    WHEN coalesce(threshold_rule.requires_window_close, false)
      AND now() < target_proposal.closes_at
    THEN false
    ELSE (
      (
        coalesce(internal_tally.approvals, 0)
        + CASE WHEN coalesce(multisig_summary.external_multisig_required, false) THEN coalesce(multisig_summary.external_approval_count, 0) ELSE 0 END
      ) >= greatest(2, coalesce(threshold_rule.min_approval_votes, 2))
      AND (
        coalesce(internal_tally.approvals, 0)
        + CASE WHEN coalesce(multisig_summary.external_multisig_required, false) THEN coalesce(multisig_summary.external_approval_count, 0) ELSE 0 END
      ) > (
        coalesce(internal_tally.rejections, 0)
        + CASE WHEN coalesce(multisig_summary.external_multisig_required, false) THEN coalesce(multisig_summary.external_rejection_count, 0) ELSE 0 END
      )
      AND (
        NOT coalesce(multisig_summary.external_multisig_required, false)
        OR coalesce(multisig_summary.external_approval_count, 0) >= coalesce(multisig_summary.required_external_approvals, 1)
      )
      AND (
        NOT coalesce(multisig_summary.external_multisig_required, false)
        OR NOT coalesce(relay_summary.policy_enabled, false)
        OR (
          coalesce(relay_summary.signers_with_relay_quorum_count, 0) >= coalesce(multisig_summary.external_approval_count, 0)
          AND (
            NOT coalesce(relay_summary.require_chain_proof_match, true)
            OR coalesce(relay_summary.chain_proof_match_met, false)
          )
        )
      )
      AND (
        NOT coalesce(multisig_summary.external_multisig_required, false)
        OR NOT coalesce(relay_ops_summary.require_trust_minimized_quorum, false)
        OR coalesce(trust_summary.trust_minimized_quorum_met, false)
      )
      AND (
        NOT coalesce(multisig_summary.external_multisig_required, false)
        OR NOT coalesce(relay_ops_summary.require_relay_ops_readiness, false)
        OR coalesce(relay_ops_summary.relay_ops_ready, false)
      )
    )
  END AS meets_signoff
FROM target_proposal
LEFT JOIN threshold_rule ON true
LEFT JOIN internal_tally ON true
LEFT JOIN multisig_summary ON true
LEFT JOIN relay_summary ON true
LEFT JOIN trust_summary ON true
LEFT JOIN relay_ops_summary ON true;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

GRANT SELECT, INSERT, UPDATE ON public.governance_guardian_relay_worker_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.governance_guardian_relay_alerts TO authenticated;

GRANT EXECUTE ON FUNCTION public.record_governance_guardian_relay_worker_run(uuid, text, text, integer, integer, integer, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_governance_guardian_relay_alert(uuid, text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_governance_guardian_relay_alert(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_governance_guardian_relay_ops_requirement(text, boolean, boolean, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_proposal_guardian_relay_worker_run_board(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_proposal_guardian_relay_alert_board(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_proposal_guardian_relay_operations_summary(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_proposal_guardian_relay_client_proof_manifest(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_proposal_guardian_signoff_summary(uuid) TO authenticated;

ALTER TABLE public.governance_guardian_relay_worker_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_guardian_relay_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Guardian relay worker runs are readable by authenticated users"
ON public.governance_guardian_relay_worker_runs;
CREATE POLICY "Guardian relay worker runs are readable by authenticated users"
ON public.governance_guardian_relay_worker_runs
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Guardian relay worker runs are manageable by relay stewards"
ON public.governance_guardian_relay_worker_runs;
CREATE POLICY "Guardian relay worker runs are manageable by relay stewards"
ON public.governance_guardian_relay_worker_runs
  FOR ALL USING (public.current_profile_can_manage_guardian_relays())
  WITH CHECK (public.current_profile_can_manage_guardian_relays());

DROP POLICY IF EXISTS "Guardian relay alerts are readable by authenticated users"
ON public.governance_guardian_relay_alerts;
CREATE POLICY "Guardian relay alerts are readable by authenticated users"
ON public.governance_guardian_relay_alerts
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Guardian relay alerts are manageable by relay stewards"
ON public.governance_guardian_relay_alerts;
CREATE POLICY "Guardian relay alerts are manageable by relay stewards"
ON public.governance_guardian_relay_alerts
  FOR ALL USING (public.current_profile_can_manage_guardian_relays())
  WITH CHECK (public.current_profile_can_manage_guardian_relays());
