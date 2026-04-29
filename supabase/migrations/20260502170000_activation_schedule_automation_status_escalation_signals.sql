-- Roadmap §14.1: surface feed-worker on-call escalation pressure on the same RPC stewards use
-- for pg_cron + automation ledger health (parity with receipt automation status telemetry pattern).

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
  latest_automation_run_trigger_source text,
  worker_escalation_open_or_ack_page_count integer,
  worker_escalation_latest_opened_at timestamptz,
  worker_escalation_latest_page_severity text
) AS $$
DECLARE
  cron_record record;
  latest_batch_id uuid;
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
  worker_escalation_open_or_ack_page_count := 0;
  worker_escalation_latest_opened_at := NULL;
  worker_escalation_latest_page_severity := NULL;

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

  SELECT batch.id
  INTO latest_batch_id
  FROM public.governance_public_audit_batches AS batch
  ORDER BY batch.batch_index DESC
  LIMIT 1;

  IF latest_batch_id IS NOT NULL THEN
    SELECT
      count(*) FILTER (WHERE page.page_status IN ('open', 'acknowledged'))::integer,
      max(page.opened_at) FILTER (WHERE page.page_status IN ('open', 'acknowledged'))
    INTO worker_escalation_open_or_ack_page_count, worker_escalation_latest_opened_at
    FROM public.governance_public_audit_external_execution_pages AS page
    WHERE page.batch_id = latest_batch_id
      AND page.page_key = 'activation_demographic_feed_worker_escalation';

    IF coalesce(worker_escalation_open_or_ack_page_count, 0) > 0 THEN
      SELECT page.severity
      INTO worker_escalation_latest_page_severity
      FROM public.governance_public_audit_external_execution_pages AS page
      WHERE page.batch_id = latest_batch_id
        AND page.page_key = 'activation_demographic_feed_worker_escalation'
        AND page.page_status IN ('open', 'acknowledged')
      ORDER BY
        CASE coalesce(lower(page.severity), '')
          WHEN 'critical' THEN 3
          WHEN 'warning' THEN 2
          WHEN 'info' THEN 1
          ELSE 0
        END DESC,
        page.opened_at DESC NULLS LAST,
        page.id DESC
      LIMIT 1;
    END IF;
  END IF;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.activation_demographic_feed_worker_schedule_automation_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activation_demographic_feed_worker_schedule_automation_status() FROM service_role;
GRANT EXECUTE ON FUNCTION public.activation_demographic_feed_worker_schedule_automation_status() TO authenticated;
