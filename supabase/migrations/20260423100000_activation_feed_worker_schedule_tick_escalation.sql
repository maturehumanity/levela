-- Roadmap §14.1: after each feed-worker schedule enqueue pass (steward UI or pg_cron),
-- re-evaluate activation demographic feed worker SLA / alert summary and open or refresh
-- the public-audit external execution escalation page when issues remain.

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
      normalized_page_key = 'guardian_relay_critical_escalation'
      AND public.current_profile_can_manage_guardian_relays()
    )
    OR (
      normalized_page_key = 'guardian_relay_proof_distribution_escalation'
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
      session_user IN ('postgres', 'supabase_admin')
      AND lower(btrim(page_record.page_key)) = 'activation_demographic_feed_worker_escalation'
    )
    OR (
      lower(btrim(page_record.page_key)) = 'guardian_relay_critical_escalation'
      AND public.current_profile_can_manage_guardian_relays()
    )
    OR (
      lower(btrim(page_record.page_key)) = 'guardian_relay_proof_distribution_escalation'
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

CREATE OR REPLACE FUNCTION public.maybe_escalate_activation_feed_worker_exec_page(
  target_batch_id uuid DEFAULT NULL,
  requested_freshness_hours integer DEFAULT 24,
  escalation_context jsonb DEFAULT '{}'::jsonb
)
RETURNS void AS $$
DECLARE
  resolved_batch_id uuid;
  normalized_hours integer;
  adapter_issue_count integer;
BEGIN
  IF NOT (
    session_user IN ('postgres', 'supabase_admin')
    OR public.current_profile_can_manage_activation_demographic_feed_workers()
    OR public.current_profile_can_manage_public_audit_verifiers()
  ) THEN
    RAISE EXCEPTION 'Current caller is not authorized to evaluate activation demographic feed worker escalation';
  END IF;

  normalized_hours := greatest(1, coalesce(requested_freshness_hours, 24));

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

  SELECT count(*)::integer
  INTO adapter_issue_count
  FROM public.activation_demographic_feed_worker_alert_summary(normalized_hours) AS summary
  WHERE summary.freshness_alert
    OR coalesce(summary.signature_failure_count, 0) > 0
    OR coalesce(summary.connectivity_failure_count, 0) > 0
    OR coalesce(summary.payload_failure_count, 0) > 0;

  IF coalesce(adapter_issue_count, 0) <= 0 THEN
    RETURN;
  END IF;

  PERFORM public.open_governance_public_audit_external_execution_page(
    resolved_batch_id,
    'activation_demographic_feed_worker_escalation',
    'critical',
    format(
      '%s active activation demographic feed adapter(s) need attention (freshness SLA and/or unresolved worker alerts).',
      adapter_issue_count
    ),
    jsonb_build_object(
      'source', 'maybe_escalate_activation_feed_worker_exec_page',
      'adapter_issue_count', adapter_issue_count,
      'requested_freshness_hours', normalized_hours
    ) || coalesce(escalation_context, '{}'::jsonb)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.schedule_activation_demographic_feed_worker_jobs_impl(
  force_reschedule boolean DEFAULT false
)
RETURNS integer AS $$
DECLARE
  policy_record public.activation_demographic_feed_worker_schedule_policies%ROWTYPE;
  inserted_count integer := 0;
  adapter_record record;
  effective_interval integer;
  last_sweep_at timestamptz;
  has_pending boolean;
BEGIN
  PERFORM public.release_stale_activation_demographic_feed_worker_claims();

  SELECT sched.*
  INTO policy_record
  FROM public.activation_demographic_feed_worker_schedule_policies AS sched
  WHERE sched.policy_key = 'default'
  LIMIT 1;

  IF policy_record.policy_key IS NULL THEN
    RAISE EXCEPTION 'Activation demographic feed worker schedule policy is missing';
  END IF;

  IF force_reschedule THEN
    UPDATE public.activation_demographic_feed_worker_outbox AS ob
    SET
      status = 'cancelled',
      completed_at = coalesce(ob.completed_at, now()),
      error_message = coalesce(ob.error_message, 'Cancelled by force_reschedule'),
      metadata = coalesce(ob.metadata, '{}'::jsonb) || jsonb_build_object('cancelled_at', now())
    WHERE ob.status IN ('pending', 'claimed');
  END IF;

  FOR adapter_record IN
    SELECT adapter.id, adapter.worker_sweep_interval_minutes, adapter.endpoint_url
    FROM public.activation_demographic_feed_adapters AS adapter
    WHERE adapter.is_active = true
      AND length(trim(coalesce(adapter.endpoint_url, ''))) > 0
    ORDER BY adapter.updated_at DESC, adapter.created_at DESC
  LOOP
    BEGIN
      effective_interval := coalesce(
        adapter_record.worker_sweep_interval_minutes,
        policy_record.default_interval_minutes
      );

      SELECT max(run.observed_at)
      INTO last_sweep_at
      FROM public.activation_demographic_feed_worker_runs AS run
      WHERE run.adapter_id = adapter_record.id
        AND coalesce(run.metadata ->> 'source', '') = 'activation_feed_worker_sweep';

      IF last_sweep_at IS NOT NULL
         AND last_sweep_at > (now() - make_interval(mins => greatest(5, effective_interval))) THEN
        CONTINUE;
      END IF;

      SELECT EXISTS (
        SELECT 1
        FROM public.activation_demographic_feed_worker_outbox AS ob
        WHERE ob.adapter_id = adapter_record.id
          AND ob.status IN ('pending', 'claimed')
      )
      INTO has_pending;

      IF has_pending THEN
        CONTINUE;
      END IF;

      INSERT INTO public.activation_demographic_feed_worker_outbox (
        adapter_id,
        status,
        metadata,
        created_by
      )
      VALUES (
        adapter_record.id,
        'pending',
        jsonb_build_object(
          'source', 'schedule_activation_demographic_feed_worker_jobs',
          'effective_interval_minutes', effective_interval
        ),
        public.current_profile_id()
      );

      inserted_count := inserted_count + 1;
    EXCEPTION
      WHEN unique_violation THEN
        NULL;
    END;
  END LOOP;

  BEGIN
    PERFORM public.maybe_escalate_activation_feed_worker_exec_page(
      NULL,
      24,
      jsonb_build_object('source', 'schedule_activation_demographic_feed_worker_jobs_impl')
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'maybe_escalate_activation_feed_worker_exec_page after feed worker schedule skipped (non-fatal): %', SQLERRM;
  END;

  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
