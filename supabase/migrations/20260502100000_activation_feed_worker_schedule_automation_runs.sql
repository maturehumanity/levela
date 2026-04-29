-- Roadmap §14.1: append-only scheduler automation run ledger, steward-triggerable check,
-- run history RPC, and unified path for pg_cron + manual schedule enqueue (parity with
-- federation exchange receipt automation runs).

CREATE TABLE IF NOT EXISTS public.activation_demographic_feed_worker_schedule_automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  trigger_source text NOT NULL CHECK (trigger_source IN ('cron', 'steward_manual', 'system')),
  force_reschedule_applied boolean NOT NULL DEFAULT false,
  run_started_at timestamptz NOT NULL DEFAULT now(),
  run_finished_at timestamptz NULL,
  run_status text NOT NULL CHECK (run_status IN ('running', 'succeeded', 'failed')),
  run_message text NULL,
  jobs_enqueued_count integer NOT NULL DEFAULT 0 CHECK (jobs_enqueued_count >= 0),
  adapter_issue_count integer NOT NULL DEFAULT 0 CHECK (adapter_issue_count >= 0),
  open_or_ack_page_count integer NOT NULL DEFAULT 0 CHECK (open_or_ack_page_count >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activation_feed_worker_schedule_automation_runs_started
  ON public.activation_demographic_feed_worker_schedule_automation_runs (run_started_at DESC, id DESC);

CREATE OR REPLACE FUNCTION public.run_activation_feed_worker_schedule_automation_check(
  force_reschedule boolean DEFAULT false,
  trigger_source text DEFAULT 'steward_manual',
  run_message text DEFAULT NULL,
  metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  run_id uuid,
  run_status text,
  jobs_enqueued_count integer,
  adapter_issue_count integer,
  open_or_ack_page_count integer,
  evaluated_at timestamptz
) AS $$
DECLARE
  actor_profile_id uuid := public.current_profile_id();
  normalized_trigger_source text := lower(trim(coalesce(trigger_source, 'steward_manual')));
  run_row_id uuid;
  jobs_result integer := 0;
  issue_count integer := 0;
  current_page_count integer := 0;
BEGIN
  IF normalized_trigger_source NOT IN ('cron', 'steward_manual', 'system') THEN
    RAISE EXCEPTION 'Unsupported trigger source for activation feed worker schedule automation run';
  END IF;

  IF normalized_trigger_source = 'steward_manual'
     AND NOT public.current_profile_can_manage_activation_demographic_feed_workers() THEN
    RAISE EXCEPTION 'Current caller is not authorized to run activation feed worker schedule automation checks';
  END IF;

  IF normalized_trigger_source = 'cron' AND session_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Only postgres/supabase_admin may run cron-scoped activation feed worker schedule automation checks';
  END IF;

  IF normalized_trigger_source = 'system' AND session_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Only postgres/supabase_admin may run system-scoped activation feed worker schedule automation checks';
  END IF;

  INSERT INTO public.activation_demographic_feed_worker_schedule_automation_runs (
    triggered_by,
    trigger_source,
    force_reschedule_applied,
    run_status,
    run_message,
    metadata
  )
  VALUES (
    actor_profile_id,
    normalized_trigger_source,
    coalesce(force_reschedule, false),
    'running',
    nullif(btrim(coalesce(run_message, '')), ''),
    coalesce(metadata, '{}'::jsonb)
  )
  RETURNING id INTO run_row_id;

  jobs_result := public.schedule_activation_demographic_feed_worker_jobs_impl(coalesce(force_reschedule, false));

  SELECT count(*)::integer
  INTO issue_count
  FROM public.activation_demographic_feed_worker_alert_summary(24) AS summary
  WHERE summary.freshness_alert
    OR coalesce(summary.signature_failure_count, 0) > 0
    OR coalesce(summary.connectivity_failure_count, 0) > 0
    OR coalesce(summary.payload_failure_count, 0) > 0;

  SELECT count(*)::integer
  INTO current_page_count
  FROM public.governance_public_audit_external_execution_pages AS page
  WHERE page.page_key = 'activation_demographic_feed_worker_escalation'
    AND page.page_status IN ('open', 'acknowledged');

  UPDATE public.activation_demographic_feed_worker_schedule_automation_runs AS run
  SET
    run_finished_at = now(),
    run_status = 'succeeded',
    jobs_enqueued_count = coalesce(jobs_result, 0),
    adapter_issue_count = coalesce(issue_count, 0),
    open_or_ack_page_count = coalesce(current_page_count, 0),
    metadata = coalesce(run.metadata, '{}'::jsonb)
      || jsonb_build_object('source_function', 'run_activation_feed_worker_schedule_automation_check')
  WHERE run.id = run_row_id;

  run_id := run_row_id;
  run_status := 'succeeded';
  jobs_enqueued_count := coalesce(jobs_result, 0);
  adapter_issue_count := coalesce(issue_count, 0);
  open_or_ack_page_count := coalesce(current_page_count, 0);
  evaluated_at := now();
  RETURN NEXT;
EXCEPTION
  WHEN OTHERS THEN
    IF run_row_id IS NOT NULL THEN
      UPDATE public.activation_demographic_feed_worker_schedule_automation_runs AS run
      SET
        run_finished_at = now(),
        run_status = 'failed',
        run_message = coalesce(nullif(btrim(coalesce(run_message, '')), ''), SQLERRM)
      WHERE run.id = run_row_id;
    END IF;
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.activation_feed_worker_schedule_automation_run_history(
  p_requested_lookback_hours integer DEFAULT 336,
  p_max_runs integer DEFAULT 40
)
RETURNS TABLE (
  run_id uuid,
  triggered_by uuid,
  triggered_by_name text,
  trigger_source text,
  force_reschedule_applied boolean,
  run_started_at timestamptz,
  run_finished_at timestamptz,
  run_status text,
  run_message text,
  jobs_enqueued_count integer,
  adapter_issue_count integer,
  open_or_ack_page_count integer
) AS $$
DECLARE
  lookback_hours integer := greatest(coalesce(p_requested_lookback_hours, 336), 1);
  limit_rows integer := least(greatest(coalesce(p_max_runs, 40), 1), 200);
BEGIN
  IF NOT public.current_profile_can_manage_activation_demographic_feed_workers() THEN
    RAISE EXCEPTION 'Current caller is not authorized to read activation feed worker schedule automation run history';
  END IF;

  RETURN QUERY
  SELECT
    run.id,
    run.triggered_by,
    profile.display_name,
    run.trigger_source,
    run.force_reschedule_applied,
    run.run_started_at,
    run.run_finished_at,
    run.run_status,
    run.run_message,
    run.jobs_enqueued_count,
    run.adapter_issue_count,
    run.open_or_ack_page_count
  FROM public.activation_demographic_feed_worker_schedule_automation_runs AS run
  LEFT JOIN public.profiles AS profile
    ON profile.id = run.triggered_by
  WHERE run.run_started_at >= now() - make_interval(hours => lookback_hours)
  ORDER BY run.run_started_at DESC, run.id DESC
  LIMIT limit_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.schedule_activation_demographic_feed_worker_jobs(
  force_reschedule boolean DEFAULT false
)
RETURNS integer AS $$
DECLARE
  result integer := 0;
  check_row record;
BEGIN
  IF NOT public.current_profile_can_manage_activation_demographic_feed_workers() THEN
    RAISE EXCEPTION 'Current caller is not authorized to schedule activation demographic feed worker jobs';
  END IF;

  FOR check_row IN
    SELECT *
    FROM public.run_activation_feed_worker_schedule_automation_check(
      force_reschedule,
      'steward_manual',
      NULL,
      jsonb_build_object('source', 'schedule_activation_demographic_feed_worker_jobs')
    )
  LOOP
    result := coalesce(check_row.jobs_enqueued_count, 0);
    EXIT;
  END LOOP;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.run_activation_demographic_feed_worker_schedule_automation(
  force_reschedule boolean DEFAULT false
)
RETURNS integer AS $$
DECLARE
  result integer := 0;
  check_row record;
BEGIN
  IF session_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Automation entrypoint is restricted to database superuser sessions';
  END IF;

  FOR check_row IN
    SELECT *
    FROM public.run_activation_feed_worker_schedule_automation_check(
      force_reschedule,
      'cron',
      'pg_cron activation_demographic_feed_worker_schedule_tick',
      jsonb_build_object('source', 'run_activation_demographic_feed_worker_schedule_automation')
    )
  LOOP
    result := coalesce(check_row.jobs_enqueued_count, 0);
    EXIT;
  END LOOP;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.run_activation_feed_worker_schedule_automation_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM 1
  FROM public.run_activation_feed_worker_schedule_automation_check(
    false,
    'cron',
    'pg_cron tick wrapper',
    jsonb_build_object('source', 'run_activation_feed_worker_schedule_automation_tick')
  ) AS _;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'run_activation_feed_worker_schedule_automation_tick non-fatal: %', SQLERRM;
END;
$$;

DROP FUNCTION IF EXISTS public.activation_demographic_feed_worker_schedule_automation_status();

CREATE OR REPLACE FUNCTION public.activation_demographic_feed_worker_schedule_automation_status()
RETURNS TABLE (
  cron_schema_available boolean,
  cron_job_registered boolean,
  cron_job_active boolean,
  cron_job_schedule text,
  cron_job_command text,
  latest_scheduled_enqueue_at timestamptz,
  latest_scheduled_enqueue_job_id uuid,
  latest_cron_run_started_at timestamptz,
  latest_cron_run_finished_at timestamptz,
  latest_cron_run_status text,
  latest_cron_run_details text,
  latest_automation_run_started_at timestamptz,
  latest_automation_run_finished_at timestamptz,
  latest_automation_run_status text,
  latest_automation_run_message text,
  latest_automation_run_trigger_source text
) AS $$
DECLARE
  cron_record record;
BEGIN
  IF NOT public.current_profile_can_manage_activation_demographic_feed_workers() THEN
    RAISE EXCEPTION 'Current caller is not authorized to read activation demographic feed worker scheduler status';
  END IF;

  cron_schema_available := to_regnamespace('cron') IS NOT NULL;
  cron_job_registered := false;
  cron_job_active := false;
  cron_job_schedule := NULL;
  cron_job_command := NULL;
  latest_scheduled_enqueue_at := NULL;
  latest_scheduled_enqueue_job_id := NULL;
  latest_cron_run_started_at := NULL;
  latest_cron_run_finished_at := NULL;
  latest_cron_run_status := NULL;
  latest_cron_run_details := NULL;
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
      WHERE job.jobname = 'activation_demographic_feed_worker_schedule_tick'
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

  SELECT ob.requested_at, ob.id
  INTO latest_scheduled_enqueue_at, latest_scheduled_enqueue_job_id
  FROM public.activation_demographic_feed_worker_outbox AS ob
  WHERE coalesce(ob.metadata ->> 'source', '') = 'schedule_activation_demographic_feed_worker_jobs'
  ORDER BY ob.requested_at DESC, ob.created_at DESC
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
  FROM public.activation_demographic_feed_worker_schedule_automation_runs AS run
  ORDER BY run.run_started_at DESC, run.id DESC
  LIMIT 1;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $$
BEGIN
  IF to_regnamespace('cron') IS NULL THEN
    RETURN;
  END IF;

  BEGIN
    EXECUTE $cron$
      SELECT cron.unschedule(job.jobid)
      FROM cron.job
      WHERE job.jobname = 'activation_demographic_feed_worker_schedule_tick'
    $cron$;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Could not unschedule activation demographic feed worker cron job: %', SQLERRM;
  END;

  BEGIN
    EXECUTE $cron$
      SELECT cron.schedule(
        'activation_demographic_feed_worker_schedule_tick',
        '15 * * * *',
        $job$SELECT public.run_activation_feed_worker_schedule_automation_tick();$job$
      )
    $cron$;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Could not schedule activation demographic feed worker cron job: %', SQLERRM;
  END;
END $$;

REVOKE ALL ON TABLE public.activation_demographic_feed_worker_schedule_automation_runs FROM PUBLIC;
REVOKE ALL ON TABLE public.activation_demographic_feed_worker_schedule_automation_runs FROM service_role;
GRANT SELECT ON TABLE public.activation_demographic_feed_worker_schedule_automation_runs TO authenticated;

REVOKE ALL ON FUNCTION public.run_activation_feed_worker_schedule_automation_check(boolean, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_activation_feed_worker_schedule_automation_check(boolean, text, text, jsonb) FROM service_role;
GRANT EXECUTE ON FUNCTION public.run_activation_feed_worker_schedule_automation_check(boolean, text, text, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.activation_feed_worker_schedule_automation_run_history(integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activation_feed_worker_schedule_automation_run_history(integer, integer) FROM service_role;
GRANT EXECUTE ON FUNCTION public.activation_feed_worker_schedule_automation_run_history(integer, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.run_activation_feed_worker_schedule_automation_tick() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_activation_feed_worker_schedule_automation_tick() FROM service_role;
GRANT EXECUTE ON FUNCTION public.run_activation_feed_worker_schedule_automation_tick() TO postgres;
GRANT EXECUTE ON FUNCTION public.run_activation_feed_worker_schedule_automation_tick() TO supabase_admin;

REVOKE ALL ON FUNCTION public.activation_demographic_feed_worker_schedule_automation_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activation_demographic_feed_worker_schedule_automation_status() FROM service_role;
GRANT EXECUTE ON FUNCTION public.activation_demographic_feed_worker_schedule_automation_status() TO authenticated;

REVOKE ALL ON FUNCTION public.schedule_activation_demographic_feed_worker_jobs(boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.schedule_activation_demographic_feed_worker_jobs(boolean) FROM service_role;
GRANT EXECUTE ON FUNCTION public.schedule_activation_demographic_feed_worker_jobs(boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.run_activation_demographic_feed_worker_schedule_automation(boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_activation_demographic_feed_worker_schedule_automation(boolean) FROM authenticated;
REVOKE ALL ON FUNCTION public.run_activation_demographic_feed_worker_schedule_automation(boolean) FROM service_role;
GRANT EXECUTE ON FUNCTION public.run_activation_demographic_feed_worker_schedule_automation(boolean) TO postgres;
GRANT EXECUTE ON FUNCTION public.run_activation_demographic_feed_worker_schedule_automation(boolean) TO supabase_admin;
