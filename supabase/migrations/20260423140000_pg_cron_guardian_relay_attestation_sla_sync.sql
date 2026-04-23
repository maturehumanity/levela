-- Phase C.14: hourly superuser tick syncs relay attestation SLA guardian alerts and
-- re-evaluates critical guardian relay external execution escalation for recent approved proposals.

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
      session_user IN ('postgres', 'supabase_admin')
      AND normalized_page_key = 'activation_demographic_feed_worker_escalation'
    )
    OR (
      session_user IN ('postgres', 'supabase_admin')
      AND normalized_page_key = 'verifier_federation_distribution_escalation'
    )
    OR (
      normalized_page_key = 'guardian_relay_critical_escalation'
      AND public.current_profile_can_manage_guardian_relays()
    )
    OR (
      normalized_page_key = 'guardian_relay_proof_distribution_escalation'
      AND public.current_profile_can_manage_guardian_relays()
    )
    OR (
      session_user IN ('postgres', 'supabase_admin')
      AND normalized_page_key = 'guardian_relay_proof_distribution_escalation'
    )
    OR (
      session_user IN ('postgres', 'supabase_admin')
      AND normalized_page_key = 'guardian_relay_critical_escalation'
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
      session_user IN ('postgres', 'supabase_admin')
      AND lower(btrim(page_record.page_key)) = 'activation_demographic_feed_worker_escalation'
    )
    OR (
      session_user IN ('postgres', 'supabase_admin')
      AND lower(btrim(page_record.page_key)) = 'verifier_federation_distribution_escalation'
    )
    OR (
      lower(btrim(page_record.page_key)) = 'guardian_relay_critical_escalation'
      AND public.current_profile_can_manage_guardian_relays()
    )
    OR (
      lower(btrim(page_record.page_key)) = 'guardian_relay_proof_distribution_escalation'
      AND public.current_profile_can_manage_guardian_relays()
    )
    OR (
      session_user IN ('postgres', 'supabase_admin')
      AND lower(btrim(page_record.page_key)) = 'guardian_relay_proof_distribution_escalation'
    )
    OR (
      session_user IN ('postgres', 'supabase_admin')
      AND lower(btrim(page_record.page_key)) = 'guardian_relay_critical_escalation'
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
  IF NOT (
    public.current_profile_can_manage_guardian_relays()
    OR (
      session_user IN ('postgres', 'supabase_admin')
      AND lower(btrim(coalesce(alert_key, ''))) = 'relay_attestation_sla'
    )
  ) THEN
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
  SELECT *
  INTO alert_record
  FROM public.governance_guardian_relay_alerts AS alert
  WHERE alert.id = target_alert_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Guardian relay alert not found';
  END IF;

  IF NOT (
    public.current_profile_can_manage_guardian_relays()
    OR (
      session_user IN ('postgres', 'supabase_admin')
      AND lower(btrim(coalesce(alert_record.alert_key, ''))) = 'relay_attestation_sla'
    )
  ) THEN
    RAISE EXCEPTION 'Current profile is not authorized to resolve guardian relay alerts';
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
  IF NOT (
    public.current_profile_can_manage_guardian_relays()
    OR session_user IN ('postgres', 'supabase_admin')
  ) THEN
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
    session_user IN ('postgres', 'supabase_admin')
    OR public.current_profile_can_manage_guardian_relays()
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

CREATE OR REPLACE FUNCTION public.gpav_gr_attestation_sla_sync_tick()
RETURNS void AS $$
DECLARE
  proposal_rec record;
  open_critical_count integer;
BEGIN
  IF session_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Guardian relay attestation SLA sync tick is restricted to database superuser sessions';
  END IF;

  FOR proposal_rec IN
    SELECT proposal.id
    FROM public.governance_proposals AS proposal
    WHERE proposal.status = 'approved'::public.governance_proposal_status
    ORDER BY proposal.updated_at DESC, proposal.created_at DESC
    LIMIT 40
  LOOP
    BEGIN
      PERFORM public.sync_guardian_relay_attestation_sla_alerts(
        proposal_rec.id,
        'guardian_relay_default',
        NULL
      );

      SELECT count(*)::integer
      INTO open_critical_count
      FROM public.governance_guardian_relay_alerts AS alert_row
      WHERE alert_row.proposal_id = proposal_rec.id
        AND alert_row.alert_status = 'open'
        AND alert_row.severity = 'critical';

      IF coalesce(open_critical_count, 0) > 0 THEN
        PERFORM public.maybe_escalate_guardian_relay_critical_public_execution_page(
          proposal_rec.id,
          open_critical_count,
          NULL,
          jsonb_build_object('source', 'gpav_gr_attestation_sla_sync_tick')
        );
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'gpav_gr_attestation_sla_sync_tick skipped proposal %: %', proposal_rec.id, SQLERRM;
    END;
  END LOOP;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'gpav_gr_attestation_sla_sync_tick non-fatal: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.gpav_gr_attestation_sla_sync_tick() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gpav_gr_attestation_sla_sync_tick() FROM authenticated;
REVOKE ALL ON FUNCTION public.gpav_gr_attestation_sla_sync_tick() FROM service_role;

GRANT EXECUTE ON FUNCTION public.gpav_gr_attestation_sla_sync_tick() TO postgres;
GRANT EXECUTE ON FUNCTION public.gpav_gr_attestation_sla_sync_tick() TO supabase_admin;

DO $$
BEGIN
  IF to_regnamespace('cron') IS NULL THEN
    RAISE NOTICE
      'pg_cron schema missing; skipping guardian relay attestation SLA sync cron registration.';
    RETURN;
  END IF;

  BEGIN
    EXECUTE $cron$
      SELECT cron.unschedule(job.jobid)
      FROM cron.job
      WHERE job.jobname = 'guardian_relay_attestation_sla_sync_tick'
    $cron$;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Could not unschedule guardian relay attestation SLA sync cron job: %', SQLERRM;
  END;

  BEGIN
    EXECUTE $cron$
      SELECT cron.schedule(
        'guardian_relay_attestation_sla_sync_tick',
        '5 * * * *',
        $job$SELECT public.gpav_gr_attestation_sla_sync_tick();$job$
      )
    $cron$;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Could not schedule guardian relay attestation SLA sync cron job: %', SQLERRM;
  END;
END $$;
