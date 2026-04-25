-- Roadmap §14 verifier federation hardening: expose receipt backlog automation health
-- so stewardship can verify pg_cron registration and latest backlog evaluation outcomes.

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
  latest_escalation_page_status text
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

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.gpav_fed_exchange_receipt_automation_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gpav_fed_exchange_receipt_automation_status() FROM service_role;
GRANT EXECUTE ON FUNCTION public.gpav_fed_exchange_receipt_automation_status() TO authenticated;
