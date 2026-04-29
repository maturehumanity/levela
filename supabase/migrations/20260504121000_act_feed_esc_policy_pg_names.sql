-- Repair: Postgres truncates identifiers > 63 bytes; replace mangled names with short symbols.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'append_activation_demographic_feed_worker_escalation_policy_eve',
        'activation_demographic_feed_worker_escalation_policy_event_hist',
        'append_activation_demographic_feed_worker_escalation_policy_event',
        'activation_demographic_feed_worker_escalation_policy_event_history'
      )
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig;
  END LOOP;
END $$;

-- Bodies match 20260504120000 after short-name identifiers (append + history + set + maybe + schedule).

CREATE OR REPLACE FUNCTION public.act_feed_worker_esc_pol_append(
  target_policy_key text,
  target_event_type text,
  target_event_message text,
  target_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  inserted_id uuid;
  normalized_policy_key text := lower(coalesce(nullif(btrim(coalesce(target_policy_key, '')), ''), 'default'));
  normalized_event_type text := lower(coalesce(nullif(btrim(coalesce(target_event_type, '')), ''), 'updated'));
  normalized_event_message text := coalesce(nullif(btrim(coalesce(target_event_message, '')), ''), 'Policy event recorded');
BEGIN
  INSERT INTO public.activation_demographic_feed_worker_escalation_policy_events (
    policy_key,
    event_type,
    actor_profile_id,
    event_message,
    metadata
  )
  VALUES (
    normalized_policy_key,
    normalized_event_type,
    public.current_profile_id(),
    normalized_event_message,
    coalesce(target_metadata, '{}'::jsonb)
  )
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.act_feed_worker_esc_pol_evt_hist(
  requested_policy_key text DEFAULT 'default',
  requested_lookback_hours integer DEFAULT 336,
  max_events integer DEFAULT 120
)
RETURNS TABLE (
  event_id uuid,
  policy_key text,
  event_type text,
  actor_profile_id uuid,
  actor_name text,
  event_message text,
  metadata jsonb,
  created_at timestamptz
) AS $$
DECLARE
  normalized_policy_key text := lower(coalesce(nullif(btrim(coalesce(requested_policy_key, '')), ''), 'default'));
  lookback_hours integer := greatest(1, coalesce(requested_lookback_hours, 336));
BEGIN
  IF NOT public.current_profile_can_manage_activation_demographic_feed_workers() THEN
    RAISE EXCEPTION 'Current caller is not authorized to read activation demographic feed worker escalation policy history';
  END IF;

  RETURN QUERY
  SELECT
    event.id AS event_id,
    event.policy_key,
    event.event_type,
    event.actor_profile_id,
    coalesce(actor.full_name, actor.username, actor.id::text) AS actor_name,
    event.event_message,
    event.metadata,
    event.created_at
  FROM public.activation_demographic_feed_worker_escalation_policy_events AS event
  LEFT JOIN public.profiles AS actor
    ON actor.id = event.actor_profile_id
  WHERE event.policy_key = normalized_policy_key
    AND event.created_at >= now() - make_interval(hours => lookback_hours)
  ORDER BY event.created_at DESC, event.id DESC
  LIMIT greatest(1, coalesce(max_events, 120));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.set_activation_demographic_feed_worker_escalation_policy(
  requested_policy_key text DEFAULT 'default',
  requested_policy_name text DEFAULT 'Default activation feed worker escalation policy',
  requested_escalation_enabled boolean DEFAULT true,
  requested_freshness_hours integer DEFAULT 24,
  requested_minimum_adapter_issues_for_escalation integer DEFAULT 1,
  requested_escalation_severity text DEFAULT 'critical',
  metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS text AS $$
DECLARE
  normalized_policy_key text := lower(coalesce(nullif(btrim(coalesce(requested_policy_key, '')), ''), 'default'));
  normalized_policy_name text := coalesce(
    nullif(btrim(coalesce(requested_policy_name, '')), ''),
    'Default activation feed worker escalation policy'
  );
  safe_freshness integer := greatest(1, coalesce(requested_freshness_hours, 24));
  safe_min_issues integer := greatest(1, coalesce(requested_minimum_adapter_issues_for_escalation, 1));
  normalized_severity text := lower(btrim(coalesce(requested_escalation_severity, 'critical')));
  actor_profile_id uuid := public.current_profile_id();
  effective_metadata jsonb := coalesce(metadata, '{}'::jsonb) || jsonb_build_object('policy_schema_version', 1);
  prior_snapshot jsonb;
  is_insert boolean := false;
BEGIN
  IF NOT public.current_profile_can_manage_activation_demographic_feed_workers() THEN
    RAISE EXCEPTION 'Current caller is not authorized to update activation demographic feed worker escalation policy';
  END IF;

  IF normalized_severity NOT IN ('warning', 'critical') THEN
    RAISE EXCEPTION 'Escalation severity must be warning or critical';
  END IF;

  SELECT to_jsonb(policy.*)
  INTO prior_snapshot
  FROM public.activation_demographic_feed_worker_escalation_policies AS policy
  WHERE policy.policy_key = normalized_policy_key
  LIMIT 1;

  IF prior_snapshot IS NULL THEN
    is_insert := true;
  END IF;

  INSERT INTO public.activation_demographic_feed_worker_escalation_policies (
    policy_key,
    policy_name,
    escalation_enabled,
    freshness_hours,
    minimum_adapter_issues_for_escalation,
    escalation_severity,
    policy_schema_version,
    metadata,
    updated_by,
    updated_at
  )
  VALUES (
    normalized_policy_key,
    normalized_policy_name,
    coalesce(requested_escalation_enabled, true),
    safe_freshness,
    safe_min_issues,
    normalized_severity,
    1,
    effective_metadata,
    actor_profile_id,
    now()
  )
  ON CONFLICT (policy_key) DO UPDATE
    SET
      policy_name = excluded.policy_name,
      escalation_enabled = excluded.escalation_enabled,
      freshness_hours = excluded.freshness_hours,
      minimum_adapter_issues_for_escalation = excluded.minimum_adapter_issues_for_escalation,
      escalation_severity = excluded.escalation_severity,
      policy_schema_version = excluded.policy_schema_version,
      metadata = excluded.metadata,
      updated_by = excluded.updated_by,
      updated_at = now();

  PERFORM public.act_feed_worker_esc_pol_append(
    normalized_policy_key,
    CASE WHEN is_insert THEN 'created' ELSE 'updated' END,
    CASE
      WHEN is_insert THEN 'Activation feed worker escalation policy created'
      ELSE 'Activation feed worker escalation policy updated'
    END,
    jsonb_build_object(
      'prior_snapshot', coalesce(prior_snapshot, '{}'::jsonb),
      'next_snapshot', (
        SELECT to_jsonb(policy.*)
        FROM public.activation_demographic_feed_worker_escalation_policies AS policy
        WHERE policy.policy_key = normalized_policy_key
        LIMIT 1
      )
    )
  );

  RETURN normalized_policy_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.maybe_escalate_activation_feed_worker_exec_page(
  target_batch_id uuid DEFAULT NULL,
  requested_freshness_hours integer DEFAULT NULL,
  escalation_context jsonb DEFAULT '{}'::jsonb
)
RETURNS void AS $$
DECLARE
  resolved_batch_id uuid;
  normalized_hours integer;
  adapter_issue_count integer;
  page_to_resolve_id uuid;
  esc_freshness_hours integer := 24;
  esc_escalation_enabled boolean := true;
  esc_min_issues integer := 1;
  esc_severity text := 'critical';
  use_policy_freshness boolean := coalesce((escalation_context->>'use_policy_freshness')::boolean, false);
  force_manual boolean := coalesce((escalation_context->>'force_manual_escalation')::boolean, false);
  severity_text text;
BEGIN
  IF NOT (
    session_user IN ('postgres', 'supabase_admin')
    OR public.current_profile_can_manage_activation_demographic_feed_workers()
    OR public.current_profile_can_manage_public_audit_verifiers()
  ) THEN
    RAISE EXCEPTION 'Current caller is not authorized to evaluate activation demographic feed worker escalation';
  END IF;

  SELECT
    policy.freshness_hours,
    policy.escalation_enabled,
    policy.minimum_adapter_issues_for_escalation,
    lower(btrim(policy.escalation_severity))
  INTO esc_freshness_hours, esc_escalation_enabled, esc_min_issues, esc_severity
  FROM public.activation_demographic_feed_worker_escalation_policies AS policy
  WHERE policy.policy_key = 'default'
  LIMIT 1;

  IF NOT FOUND THEN
    esc_freshness_hours := 24;
    esc_escalation_enabled := true;
    esc_min_issues := 1;
    esc_severity := 'critical';
  END IF;

  IF use_policy_freshness THEN
    normalized_hours := greatest(1, coalesce(esc_freshness_hours, 24));
  ELSE
    normalized_hours := greatest(1, coalesce(requested_freshness_hours, esc_freshness_hours, 24));
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

  SELECT count(*)::integer
  INTO adapter_issue_count
  FROM public.activation_demographic_feed_worker_alert_summary(normalized_hours) AS summary
  WHERE summary.freshness_alert
    OR coalesce(summary.signature_failure_count, 0) > 0
    OR coalesce(summary.connectivity_failure_count, 0) > 0
    OR coalesce(summary.payload_failure_count, 0) > 0;

  IF coalesce(adapter_issue_count, 0) <= 0 THEN
    SELECT page.id
    INTO page_to_resolve_id
    FROM public.governance_public_audit_external_execution_pages AS page
    WHERE page.batch_id = resolved_batch_id
      AND lower(btrim(page.page_key)) = 'activation_demographic_feed_worker_escalation'
      AND page.page_status IN ('open', 'acknowledged')
    ORDER BY page.opened_at DESC NULLS LAST, page.id DESC
    LIMIT 1;

    IF page_to_resolve_id IS NOT NULL THEN
      BEGIN
        PERFORM public.resolve_governance_public_audit_external_execution_page(
          page_to_resolve_id,
          format(
            'Automatically resolved: activation feed worker alert summary has no open issues (freshness window %s hours).',
            normalized_hours
          )
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'maybe_escalate_activation_feed_worker_exec_page auto-resolve skipped (non-fatal): %', SQLERRM;
      END;
    END IF;

    RETURN;
  END IF;

  IF NOT esc_escalation_enabled AND NOT force_manual THEN
    RETURN;
  END IF;

  IF coalesce(adapter_issue_count, 0) < greatest(1, esc_min_issues)
     AND NOT force_manual THEN
    RETURN;
  END IF;

  severity_text := lower(btrim(esc_severity));
  IF severity_text NOT IN ('warning', 'critical') THEN
    severity_text := 'critical';
  END IF;

  PERFORM public.open_governance_public_audit_external_execution_page(
    resolved_batch_id,
    'activation_demographic_feed_worker_escalation',
    severity_text,
    format(
      '%s active activation demographic feed adapter(s) need attention (freshness SLA and/or unresolved worker alerts).',
      adapter_issue_count
    ),
    jsonb_build_object(
      'source', 'maybe_escalate_activation_feed_worker_exec_page',
      'adapter_issue_count', adapter_issue_count,
      'requested_freshness_hours', normalized_hours,
      'policy_freshness_hours', esc_freshness_hours,
      'policy_minimum_adapter_issues', esc_min_issues,
      'policy_escalation_enabled', esc_escalation_enabled,
      'force_manual_escalation', force_manual
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
      NULL,
      jsonb_build_object(
        'source', 'schedule_activation_demographic_feed_worker_jobs_impl',
        'use_policy_freshness', true
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'maybe_escalate_activation_feed_worker_exec_page after feed worker schedule skipped (non-fatal): %', SQLERRM;
  END;

  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.act_feed_worker_esc_pol_append(text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.act_feed_worker_esc_pol_append(text, text, text, jsonb) FROM service_role;
REVOKE ALL ON FUNCTION public.act_feed_worker_esc_pol_append(text, text, text, jsonb) FROM authenticated;

REVOKE ALL ON FUNCTION public.act_feed_worker_esc_pol_evt_hist(text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.act_feed_worker_esc_pol_evt_hist(text, integer, integer) FROM service_role;
GRANT EXECUTE ON FUNCTION public.act_feed_worker_esc_pol_evt_hist(text, integer, integer) TO authenticated;
