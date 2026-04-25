-- Roadmap §14 federation exchange hardening: add auditable automation run history
-- plus a steward-triggerable automation check for receipt backlog escalation.

CREATE TABLE IF NOT EXISTS public.gpav_fed_exchange_receipt_automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  trigger_source text NOT NULL CHECK (trigger_source IN ('cron', 'steward_manual', 'system')),
  requested_lookback_hours integer NULL CHECK (requested_lookback_hours IS NULL OR requested_lookback_hours >= 1),
  run_started_at timestamptz NOT NULL DEFAULT now(),
  run_finished_at timestamptz NULL,
  run_status text NOT NULL CHECK (run_status IN ('running', 'succeeded', 'failed')),
  run_message text NULL,
  receipt_pending_count integer NOT NULL DEFAULT 0 CHECK (receipt_pending_count >= 0),
  stale_receipt_count integer NOT NULL DEFAULT 0 CHECK (stale_receipt_count >= 0),
  critical_backlog boolean NOT NULL DEFAULT false,
  open_or_ack_page_count integer NOT NULL DEFAULT 0 CHECK (open_or_ack_page_count >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gpav_fed_exchange_receipt_automation_runs_started
  ON public.gpav_fed_exchange_receipt_automation_runs (run_started_at DESC, id DESC);

CREATE OR REPLACE FUNCTION public.run_gpav_fed_exchange_receipt_automation_check(
  requested_lookback_hours integer DEFAULT NULL,
  trigger_source text DEFAULT 'steward_manual',
  run_message text DEFAULT NULL,
  metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  run_id uuid,
  run_status text,
  lookback_hours integer,
  pending_receipt_count integer,
  stale_receipt_count integer,
  critical_backlog boolean,
  open_or_ack_page_count integer,
  escalation_evaluated_at timestamptz
) AS $$
DECLARE
  actor_profile_id uuid := public.current_profile_id();
  normalized_trigger_source text := lower(trim(coalesce(trigger_source, 'steward_manual')));
  effective_lookback_hours integer;
  summary_record record;
  age_record record;
  run_row_id uuid;
  current_page_count integer := 0;
BEGIN
  IF normalized_trigger_source NOT IN ('cron', 'steward_manual', 'system') THEN
    RAISE EXCEPTION 'Unsupported trigger source for federation exchange receipt automation run';
  END IF;

  IF normalized_trigger_source = 'steward_manual' AND NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current caller is not authorized to run federation exchange receipt automation checks';
  END IF;

  IF normalized_trigger_source = 'cron' AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Only postgres/supabase_admin may run cron-scoped federation exchange receipt automation checks';
  END IF;

  IF requested_lookback_hours IS NULL THEN
    SELECT policy.lookback_hours
    INTO effective_lookback_hours
    FROM public.gpav_fed_exchange_receipt_policy_summary('default') AS policy;
  ELSE
    effective_lookback_hours := greatest(requested_lookback_hours, 1);
  END IF;
  effective_lookback_hours := coalesce(effective_lookback_hours, 336);

  INSERT INTO public.gpav_fed_exchange_receipt_automation_runs (
    triggered_by,
    trigger_source,
    requested_lookback_hours,
    run_status,
    run_message,
    metadata
  )
  VALUES (
    actor_profile_id,
    normalized_trigger_source,
    effective_lookback_hours,
    'running',
    nullif(btrim(coalesce(run_message, '')), ''),
    coalesce(metadata, '{}'::jsonb)
  )
  RETURNING id INTO run_row_id;

  SELECT *
  INTO summary_record
  FROM public.governance_public_audit_verifier_federation_exchange_summary(
    target_batch_id := NULL,
    requested_lookback_hours := effective_lookback_hours
  );

  SELECT *
  INTO age_record
  FROM public.gpav_fed_exchange_receipt_backlog_age_summary(
    target_batch_id := NULL,
    requested_lookback_hours := effective_lookback_hours,
    requested_bucket_hours := 24
  );

  PERFORM public.maybe_escalate_verifier_fed_exchange_receipt_page(effective_lookback_hours);

  SELECT count(*)::integer
  INTO current_page_count
  FROM public.governance_public_audit_external_execution_pages AS page
  WHERE page.page_key = 'verifier_federation_exchange_receipt_escalation'
    AND page.page_status IN ('open', 'acknowledged');

  UPDATE public.gpav_fed_exchange_receipt_automation_runs AS run
  SET
    run_finished_at = now(),
    run_status = 'succeeded',
    receipt_pending_count = coalesce(summary_record.receipt_pending_verification_count, 0),
    stale_receipt_count = coalesce(age_record.over_24h_count, 0),
    critical_backlog = coalesce(age_record.has_critical_backlog, false),
    open_or_ack_page_count = coalesce(current_page_count, 0),
    metadata = coalesce(run.metadata, '{}'::jsonb) || jsonb_build_object('source_function', 'run_gpav_fed_exchange_receipt_automation_check')
  WHERE run.id = run_row_id;

  run_id := run_row_id;
  run_status := 'succeeded';
  lookback_hours := effective_lookback_hours;
  pending_receipt_count := coalesce(summary_record.receipt_pending_verification_count, 0);
  stale_receipt_count := coalesce(age_record.over_24h_count, 0);
  critical_backlog := coalesce(age_record.has_critical_backlog, false);
  open_or_ack_page_count := coalesce(current_page_count, 0);
  escalation_evaluated_at := now();
  RETURN NEXT;
EXCEPTION
  WHEN OTHERS THEN
    IF run_row_id IS NOT NULL THEN
      UPDATE public.gpav_fed_exchange_receipt_automation_runs AS run
      SET
        run_finished_at = now(),
        run_status = 'failed',
        run_message = coalesce(nullif(run_message, ''), SQLERRM)
      WHERE run.id = run_row_id;
    END IF;
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.gpav_fed_exchange_receipt_automation_run_history(
  p_requested_lookback_hours integer DEFAULT 336,
  p_max_runs integer DEFAULT 40
)
RETURNS TABLE (
  run_id uuid,
  triggered_by uuid,
  triggered_by_name text,
  trigger_source text,
  requested_lookback_hours integer,
  run_started_at timestamptz,
  run_finished_at timestamptz,
  run_status text,
  run_message text,
  receipt_pending_count integer,
  stale_receipt_count integer,
  critical_backlog boolean,
  open_or_ack_page_count integer
) AS $$
DECLARE
  lookback_hours integer := greatest(coalesce(p_requested_lookback_hours, 336), 1);
  limit_rows integer := least(greatest(coalesce(p_max_runs, 40), 1), 200);
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current caller is not authorized to read federation exchange receipt automation run history';
  END IF;

  RETURN QUERY
  SELECT
    run.id,
    run.triggered_by,
    profile.display_name,
    run.trigger_source,
    run.requested_lookback_hours,
    run.run_started_at,
    run.run_finished_at,
    run.run_status,
    run.run_message,
    run.receipt_pending_count,
    run.stale_receipt_count,
    run.critical_backlog,
    run.open_or_ack_page_count
  FROM public.gpav_fed_exchange_receipt_automation_runs AS run
  LEFT JOIN public.profiles AS profile
    ON profile.id = run.triggered_by
  WHERE run.run_started_at >= now() - make_interval(hours => lookback_hours)
  ORDER BY run.run_started_at DESC, run.id DESC
  LIMIT limit_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.gpav_fed_exchange_receipt_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.run_gpav_fed_exchange_receipt_automation_check(
    requested_lookback_hours := NULL,
    trigger_source := 'cron',
    run_message := 'pg_cron tick',
    metadata := jsonb_build_object('source', 'gpav_fed_exchange_receipt_tick')
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'gpav_fed_exchange_receipt_tick non-fatal: %', SQLERRM;
END;
$$;

DROP FUNCTION IF EXISTS public.gpav_fed_exchange_receipt_automation_status();

CREATE OR REPLACE FUNCTION public.gpav_fed_exchange_receipt_automation_status()
RETURNS TABLE (
  cron_schema_available boolean,
  cron_job_registered boolean,
  cron_job_active boolean,
  cron_job_schedule text,
  cron_job_command text,
  latest_cron_run_started_at timestamptz,
  latest_cron_run_finished_at timestamptz,
  latest_cron_run_status text,
  latest_cron_run_details text,
  latest_pending_receipt_attested_at timestamptz,
  latest_verified_receipt_at timestamptz,
  latest_escalation_page_opened_at timestamptz,
  latest_escalation_page_status text,
  latest_automation_run_started_at timestamptz,
  latest_automation_run_finished_at timestamptz,
  latest_automation_run_status text,
  latest_automation_run_message text,
  latest_automation_run_trigger_source text
) AS $$
DECLARE
  cron_record record;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current caller is not authorized to read federation exchange receipt automation status';
  END IF;

  cron_schema_available := to_regnamespace('cron') IS NOT NULL;
  cron_job_registered := false;
  cron_job_active := false;
  cron_job_schedule := NULL;
  cron_job_command := NULL;
  latest_cron_run_started_at := NULL;
  latest_cron_run_finished_at := NULL;
  latest_cron_run_status := NULL;
  latest_cron_run_details := NULL;
  latest_pending_receipt_attested_at := NULL;
  latest_verified_receipt_at := NULL;
  latest_escalation_page_opened_at := NULL;
  latest_escalation_page_status := NULL;
  latest_automation_run_started_at := NULL;
  latest_automation_run_finished_at := NULL;
  latest_automation_run_status := NULL;
  latest_automation_run_message := NULL;
  latest_automation_run_trigger_source := NULL;

  IF cron_schema_available THEN
    BEGIN
      SELECT
        job.jobid,
        coalesce(job.active, false) AS active,
        job.schedule,
        job.command
      INTO cron_record
      FROM cron.job AS job
      WHERE job.jobname = 'verifier_federation_exchange_receipt_tick'
      ORDER BY job.jobid DESC
      LIMIT 1;
    EXCEPTION
      WHEN OTHERS THEN
        cron_record := NULL;
    END;

    IF cron_record IS NOT NULL THEN
      cron_job_registered := true;
      cron_job_active := coalesce(cron_record.active, false);
      cron_job_schedule := cron_record.schedule;
      cron_job_command := cron_record.command;

      BEGIN
        SELECT
          details.start_time,
          details.end_time,
          nullif(btrim(coalesce(details.status, '')), ''),
          nullif(btrim(coalesce(details.return_message, '')), '')
        INTO
          latest_cron_run_started_at,
          latest_cron_run_finished_at,
          latest_cron_run_status,
          latest_cron_run_details
        FROM cron.job_run_details AS details
        WHERE details.jobid = cron_record.jobid
        ORDER BY coalesce(details.end_time, details.start_time) DESC NULLS LAST, details.runid DESC
        LIMIT 1;
      EXCEPTION
        WHEN OTHERS THEN
          NULL;
      END;
    END IF;
  END IF;

  SELECT max(attestation.attested_at)
  INTO latest_pending_receipt_attested_at
  FROM public.governance_public_audit_verifier_federation_exchange_attestations AS attestation
  WHERE attestation.receipt_signature IS NOT NULL
    AND attestation.receipt_signer_key IS NOT NULL
    AND coalesce(attestation.receipt_verified, false) = false;

  SELECT max(attestation.receipt_verified_at)
  INTO latest_verified_receipt_at
  FROM public.governance_public_audit_verifier_federation_exchange_attestations AS attestation
  WHERE coalesce(attestation.receipt_verified, false) = true;

  SELECT page.opened_at, page.page_status
  INTO latest_escalation_page_opened_at, latest_escalation_page_status
  FROM public.governance_public_audit_external_execution_pages AS page
  WHERE page.page_key = 'verifier_federation_exchange_receipt_escalation'
  ORDER BY page.opened_at DESC, page.id DESC
  LIMIT 1;

  SELECT
    run.run_started_at,
    run.run_finished_at,
    run.run_status,
    run.run_message,
    run.trigger_source
  INTO
    latest_automation_run_started_at,
    latest_automation_run_finished_at,
    latest_automation_run_status,
    latest_automation_run_message,
    latest_automation_run_trigger_source
  FROM public.gpav_fed_exchange_receipt_automation_runs AS run
  ORDER BY run.run_started_at DESC, run.id DESC
  LIMIT 1;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON TABLE public.gpav_fed_exchange_receipt_automation_runs FROM PUBLIC;
REVOKE ALL ON TABLE public.gpav_fed_exchange_receipt_automation_runs FROM service_role;
GRANT SELECT ON TABLE public.gpav_fed_exchange_receipt_automation_runs TO authenticated;

REVOKE ALL ON FUNCTION public.run_gpav_fed_exchange_receipt_automation_check(integer, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_gpav_fed_exchange_receipt_automation_check(integer, text, text, jsonb) FROM service_role;
GRANT EXECUTE ON FUNCTION public.run_gpav_fed_exchange_receipt_automation_check(integer, text, text, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.gpav_fed_exchange_receipt_automation_run_history(integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gpav_fed_exchange_receipt_automation_run_history(integer, integer) FROM service_role;
GRANT EXECUTE ON FUNCTION public.gpav_fed_exchange_receipt_automation_run_history(integer, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.gpav_fed_exchange_receipt_automation_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gpav_fed_exchange_receipt_automation_status() FROM service_role;
GRANT EXECUTE ON FUNCTION public.gpav_fed_exchange_receipt_automation_status() TO authenticated;
