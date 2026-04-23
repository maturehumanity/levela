-- Roadmap §14.1 productionization: expose feed-worker scheduler automation health
-- so stewards can verify whether pg_cron registration exists and when schedule
-- enqueue activity most recently happened.

CREATE OR REPLACE FUNCTION public.activation_demographic_feed_worker_schedule_automation_status()
RETURNS TABLE (
  cron_schema_available boolean,
  cron_job_registered boolean,
  cron_job_active boolean,
  cron_job_schedule text,
  cron_job_command text,
  latest_scheduled_enqueue_at timestamptz,
  latest_scheduled_enqueue_job_id uuid
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

REVOKE ALL ON FUNCTION public.activation_demographic_feed_worker_schedule_automation_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activation_demographic_feed_worker_schedule_automation_status() FROM service_role;
GRANT EXECUTE ON FUNCTION public.activation_demographic_feed_worker_schedule_automation_status() TO authenticated;
