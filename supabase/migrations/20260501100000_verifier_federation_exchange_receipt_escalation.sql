-- Autonomous escalation for pending federation exchange receipt verification backlog.

CREATE OR REPLACE FUNCTION public.maybe_escalate_verifier_fed_exchange_receipt_page(
  requested_lookback_hours integer DEFAULT 336
)
RETURNS uuid AS $$
DECLARE
  summary_row record;
  latest_batch_id uuid;
  page_id uuid := NULL;
BEGIN
  IF NOT (
    session_user IN ('postgres', 'supabase_admin')
    OR public.current_profile_can_manage_public_audit_verifiers()
  ) THEN
    RAISE EXCEPTION 'Current profile is not authorized to escalate verifier federation exchange receipt pages';
  END IF;

  SELECT *
  INTO summary_row
  FROM public.governance_public_audit_verifier_federation_exchange_summary(
    target_batch_id := NULL,
    requested_lookback_hours := requested_lookback_hours
  );

  IF summary_row IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT batch.id
  INTO latest_batch_id
  FROM public.governance_public_audit_batches AS batch
  ORDER BY batch.batch_index DESC
  LIMIT 1;

  IF latest_batch_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF coalesce(summary_row.receipt_pending_verification_count, 0) > 0 THEN
    page_id := public.open_governance_public_audit_external_execution_page(
      latest_batch_id,
      'verifier_federation_exchange_receipt_escalation',
      CASE
        WHEN coalesce(summary_row.receipt_pending_verification_count, 0) >= 5 THEN 'critical'
        ELSE 'warning'
      END,
      format(
        'Federation exchange receipt verification backlog (pending=%s, evidence=%s, verified=%s)',
        coalesce(summary_row.receipt_pending_verification_count, 0),
        coalesce(summary_row.receipt_evidence_count, 0),
        coalesce(summary_row.receipt_verified_count, 0)
      ),
      jsonb_build_object(
        'receipt_pending_verification_count', summary_row.receipt_pending_verification_count,
        'receipt_evidence_count', summary_row.receipt_evidence_count,
        'receipt_verified_count', summary_row.receipt_verified_count,
        'attestation_count', summary_row.attestation_count,
        'distinct_external_operator_count', summary_row.distinct_external_operator_count,
        'latest_attested_at', summary_row.latest_attested_at
      )
    );
    RETURN page_id;
  END IF;

  UPDATE public.governance_public_audit_external_execution_pages AS page
  SET
    page_status = 'resolved',
    page_payload = coalesce(page.page_payload, '{}'::jsonb)
      || jsonb_build_object(
        'resolved_reason', 'Federation exchange receipt verification backlog cleared',
        'resolved_at', now()
      ),
    resolved_at = now(),
    resolved_by = public.current_profile_id(),
    updated_at = now()
  WHERE page.batch_id = latest_batch_id
    AND page.page_key = 'verifier_federation_exchange_receipt_escalation'
    AND page.page_status IN ('open', 'acknowledged');

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.gpav_fed_exchange_receipt_tick()
RETURNS void AS $$
BEGIN
  IF session_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Federation exchange receipt tick is restricted to database superuser sessions';
  END IF;

  PERFORM public.maybe_escalate_verifier_fed_exchange_receipt_page(336);
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'gpav_fed_exchange_receipt_tick non-fatal: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.gpav_fed_exchange_receipt_tick() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gpav_fed_exchange_receipt_tick() FROM authenticated;
REVOKE ALL ON FUNCTION public.gpav_fed_exchange_receipt_tick() FROM service_role;

GRANT EXECUTE ON FUNCTION public.gpav_fed_exchange_receipt_tick() TO postgres;
GRANT EXECUTE ON FUNCTION public.gpav_fed_exchange_receipt_tick() TO supabase_admin;

GRANT EXECUTE ON FUNCTION public.maybe_escalate_verifier_fed_exchange_receipt_page(integer) TO authenticated;

DO $$
BEGIN
  IF to_regnamespace('cron') IS NULL THEN
    RAISE NOTICE 'pg_cron schema missing; skipping federation exchange receipt cron registration.';
    RETURN;
  END IF;

  BEGIN
    EXECUTE $cron$
      SELECT cron.unschedule(job.jobid)
      FROM cron.job
      WHERE job.jobname = 'verifier_federation_exchange_receipt_tick'
    $cron$;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Could not unschedule verifier federation exchange receipt cron job: %', SQLERRM;
  END;

  BEGIN
    EXECUTE $cron$
      SELECT cron.schedule(
        'verifier_federation_exchange_receipt_tick',
        '55 * * * *',
        $job$SELECT public.gpav_fed_exchange_receipt_tick();$job$
      )
    $cron$;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Could not schedule verifier federation exchange receipt cron job: %', SQLERRM;
  END;
END $$;
