-- Section 14.2 / roadmap: when guardian relay worker runs complete with open critical alerts,
-- surface the same public-audit external execution paging channel used for other verifier ops.

CREATE OR REPLACE FUNCTION public.open_governance_public_audit_external_execution_page(
  target_batch_id uuid,
  page_key text,
  severity text,
  page_message text,
  page_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  policy_record public.governance_public_audit_external_execution_policies%ROWTYPE;
  inserted_id uuid;
  normalized_page_key text;
  normalized_severity text;
  normalized_message text;
  caller_authorized boolean;
BEGIN
  normalized_page_key := lower(coalesce(nullif(btrim(coalesce(page_key, '')), ''), 'external_execution_ops'));
  normalized_severity := lower(coalesce(nullif(btrim(coalesce(severity, '')), ''), 'warning'));
  normalized_message := coalesce(nullif(btrim(coalesce(page_message, '')), ''), 'Public audit external execution policy threshold breached');

  caller_authorized := public.current_profile_can_manage_public_audit_verifiers()
    OR (
      normalized_page_key = 'activation_demographic_feed_worker_escalation'
      AND public.current_profile_can_manage_activation_demographic_feed_workers()
    )
    OR (
      normalized_page_key = 'guardian_relay_critical_escalation'
      AND public.current_profile_can_manage_guardian_relays()
    );

  IF NOT caller_authorized THEN
    RAISE EXCEPTION 'Current profile is not authorized to open public audit external execution pages';
  END IF;

  IF target_batch_id IS NULL THEN
    RAISE EXCEPTION 'Target batch id is required';
  END IF;

  IF normalized_severity NOT IN ('info', 'warning', 'critical') THEN
    RAISE EXCEPTION 'Page severity must be info, warning, or critical';
  END IF;

  SELECT policy.*
  INTO policy_record
  FROM public.governance_public_audit_external_execution_policies AS policy
  WHERE policy.policy_key = 'default'
  LIMIT 1;

  INSERT INTO public.governance_public_audit_external_execution_pages (
    batch_id,
    page_key,
    severity,
    page_status,
    page_message,
    oncall_channel,
    page_payload,
    opened_at,
    created_by
  )
  VALUES (
    target_batch_id,
    normalized_page_key,
    normalized_severity,
    'open',
    normalized_message,
    coalesce(policy_record.oncall_channel, 'public_audit_ops'),
    coalesce(page_payload, '{}'::jsonb),
    now(),
    public.current_profile_id()
  )
  ON CONFLICT (batch_id, page_key) DO UPDATE
    SET severity = excluded.severity,
        page_status = 'open',
        page_message = excluded.page_message,
        oncall_channel = excluded.oncall_channel,
        page_payload = coalesce(public.governance_public_audit_external_execution_pages.page_payload, '{}'::jsonb)
          || coalesce(excluded.page_payload, '{}'::jsonb),
        opened_at = now(),
        acknowledged_at = NULL,
        resolved_at = NULL,
        resolved_by = NULL
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.resolve_governance_public_audit_external_execution_page(
  target_page_id uuid,
  resolution_notes text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  page_record public.governance_public_audit_external_execution_pages%ROWTYPE;
  caller_authorized boolean;
BEGIN
  SELECT *
  INTO page_record
  FROM public.governance_public_audit_external_execution_pages AS page
  WHERE page.id = target_page_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Public audit external execution page not found';
  END IF;

  caller_authorized := public.current_profile_can_manage_public_audit_verifiers()
    OR (
      lower(btrim(page_record.page_key)) = 'activation_demographic_feed_worker_escalation'
      AND public.current_profile_can_manage_activation_demographic_feed_workers()
    )
    OR (
      lower(btrim(page_record.page_key)) = 'guardian_relay_critical_escalation'
      AND public.current_profile_can_manage_guardian_relays()
    );

  IF NOT caller_authorized THEN
    RAISE EXCEPTION 'Current profile is not authorized to resolve public audit external execution pages';
  END IF;

  UPDATE public.governance_public_audit_external_execution_pages
  SET page_status = 'resolved',
      page_payload = coalesce(page_record.page_payload, '{}'::jsonb)
        || jsonb_build_object(
          'resolution_notes', nullif(btrim(coalesce(resolution_notes, '')), ''),
          'resolved_at', now()
        ),
      resolved_at = now(),
      resolved_by = public.current_profile_id()
  WHERE id = page_record.id;

  RETURN page_record.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.maybe_escalate_guardian_relay_critical_public_execution_page(
  target_proposal_id uuid,
  open_critical_alert_count integer,
  target_batch_id uuid DEFAULT NULL,
  escalation_context jsonb DEFAULT '{}'::jsonb
)
RETURNS void AS $$
DECLARE
  resolved_batch_id uuid;
BEGIN
  IF NOT (
    public.current_profile_can_manage_guardian_relays()
    OR public.current_profile_can_manage_public_audit_verifiers()
  ) THEN
    RAISE EXCEPTION 'Current caller is not authorized to escalate guardian relay critical alerts to external execution paging';
  END IF;

  IF target_proposal_id IS NULL OR coalesce(open_critical_alert_count, 0) <= 0 THEN
    RETURN;
  END IF;

  SELECT coalesce(
    target_batch_id,
    (
      SELECT batch.id
      FROM public.governance_public_audit_batches AS batch
      ORDER BY batch.batch_index DESC
      LIMIT 1
    )
  )
  INTO resolved_batch_id;

  IF resolved_batch_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM public.open_governance_public_audit_external_execution_page(
    resolved_batch_id,
    'guardian_relay_critical_escalation',
    'critical',
    format(
      '%s open critical guardian relay alert(s) for proposal %s; resolve relay alerts or complete remediation before sign-off.',
      open_critical_alert_count,
      target_proposal_id
    ),
    jsonb_build_object(
      'source', 'maybe_escalate_guardian_relay_critical_public_execution_page',
      'proposal_id', target_proposal_id,
      'open_critical_alert_count', open_critical_alert_count
    ) || coalesce(escalation_context, '{}'::jsonb)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.maybe_escalate_guardian_relay_critical_public_execution_page(uuid, integer, uuid, jsonb) TO authenticated;

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

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
