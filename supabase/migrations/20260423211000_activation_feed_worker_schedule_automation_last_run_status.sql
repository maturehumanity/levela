-- Roadmap §14.1 productionization follow-up: include latest cron execution
-- outcome in feed-worker scheduler automation status for steward operators.

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
  latest_cron_run_details text
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

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
