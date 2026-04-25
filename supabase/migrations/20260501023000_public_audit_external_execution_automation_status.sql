-- Roadmap §14 hardening: expose public-audit external execution automation health
-- so stewards can verify cron registration and latest scheduler activity.

CREATE OR REPLACE FUNCTION public.governance_public_audit_external_execution_automation_status()
RETURNS TABLE (
  cron_schema_available boolean,
  cron_job_registered boolean,
  cron_job_active boolean,
  cron_job_schedule text,
  cron_job_command text,
  latest_batch_id uuid,
  latest_cycle_anchor_jobs_scheduled integer,
  latest_cycle_verifier_jobs_scheduled integer,
  latest_cycle_evaluated_at timestamptz,
  latest_anchor_job_scheduled_at timestamptz,
  latest_verifier_job_scheduled_at timestamptz,
  latest_external_execution_page_opened_at timestamptz
) AS $$
DECLARE
  cron_record record;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current caller is not authorized to read public audit external execution automation status';
  END IF;

  cron_schema_available := to_regnamespace('cron') IS NOT NULL;
  cron_job_registered := false;
  cron_job_active := false;
  cron_job_schedule := NULL;
  cron_job_command := NULL;
  latest_batch_id := NULL;
  latest_cycle_anchor_jobs_scheduled := NULL;
  latest_cycle_verifier_jobs_scheduled := NULL;
  latest_cycle_evaluated_at := NULL;
  latest_anchor_job_scheduled_at := NULL;
  latest_verifier_job_scheduled_at := NULL;
  latest_external_execution_page_opened_at := NULL;

  IF cron_schema_available THEN
    BEGIN
      SELECT
        job.jobid,
        coalesce(job.active, false) AS active,
        job.schedule,
        job.command
      INTO cron_record
      FROM cron.job AS job
      WHERE job.jobname = 'public_audit_external_execution_cycle_tick'
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

  SELECT batch.id
  INTO latest_batch_id
  FROM public.governance_public_audit_batches AS batch
  ORDER BY batch.batch_index DESC
  LIMIT 1;

  IF latest_batch_id IS NOT NULL THEN
    SELECT
      max(job.scheduled_at),
      count(*)::integer
    INTO latest_cycle_evaluated_at, latest_cycle_verifier_jobs_scheduled
    FROM public.governance_public_audit_verifier_jobs AS job
    WHERE job.batch_id = latest_batch_id
      AND coalesce(job.metadata ->> 'source', '') = 'automated_verifier_scheduler';

    SELECT count(*)::integer
    INTO latest_cycle_anchor_jobs_scheduled
    FROM public.governance_public_audit_anchor_execution_jobs AS job
    WHERE job.batch_id = latest_batch_id
      AND coalesce(job.metadata ->> 'source', '') = 'automated_anchor_scheduler';

    SELECT max(job.scheduled_at)
    INTO latest_anchor_job_scheduled_at
    FROM public.governance_public_audit_anchor_execution_jobs AS job
    WHERE job.batch_id = latest_batch_id;

    SELECT max(job.scheduled_at)
    INTO latest_verifier_job_scheduled_at
    FROM public.governance_public_audit_verifier_jobs AS job
    WHERE job.batch_id = latest_batch_id;

    SELECT max(page.opened_at)
    INTO latest_external_execution_page_opened_at
    FROM public.governance_public_audit_external_execution_pages AS page
    WHERE page.batch_id = latest_batch_id
      AND page.page_key = 'external_execution_sla';
  END IF;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.governance_public_audit_external_execution_automation_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.governance_public_audit_external_execution_automation_status() FROM service_role;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_external_execution_automation_status() TO authenticated;
