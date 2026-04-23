-- Repair Postgres 63-character identifier collision: a long *_cron_tick name truncated
-- to the same symbol as run_governance_public_audit_verifier_federation_distribution_verification,
-- overwriting the steward RPC. Restore the verification body and register gpav_* cron helper.

CREATE OR REPLACE FUNCTION public.run_governance_public_audit_verifier_federation_distribution_verification(
  target_batch_id uuid DEFAULT NULL,
  requested_policy_key text DEFAULT 'default',
  stale_after_hours integer DEFAULT 24,
  run_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  run_id uuid,
  run_status text,
  package_id uuid,
  package_hash text,
  distribution_ready boolean,
  stale_package boolean,
  bad_signature_count integer,
  policy_mismatch boolean,
  open_alert_count integer,
  captured_at timestamptz,
  last_signed_at timestamptz
) AS $$
DECLARE
  distribution_summary record;
  normalized_stale_after_hours integer;
  computed_stale_package boolean;
  computed_bad_signature_count integer := 0;
  computed_policy_mismatch boolean;
  computed_open_alert_count integer := 0;
  computed_run_status text := 'ok';
  computed_run_id uuid;
  computed_error_message text;
  payload jsonb;
BEGIN
  IF NOT (
    public.current_profile_can_manage_public_audit_verifiers()
    OR session_user IN ('postgres', 'supabase_admin')
  ) THEN
    RAISE EXCEPTION 'Current profile is not authorized to run federation distribution verification';
  END IF;

  normalized_stale_after_hours := greatest(1, coalesce(stale_after_hours, 24));

  SELECT *
  INTO distribution_summary
  FROM public.governance_public_audit_verifier_federation_distribution_gate(target_batch_id, requested_policy_key)
  LIMIT 1;

  computed_stale_package := (
    distribution_summary.package_id IS NULL
    OR distribution_summary.captured_at IS NULL
    OR distribution_summary.captured_at < (now() - make_interval(hours => normalized_stale_after_hours))
  );

  IF distribution_summary.package_id IS NOT NULL THEN
    SELECT coalesce(count(*)::integer, 0)
    INTO computed_bad_signature_count
    FROM public.governance_public_audit_verifier_federation_package_signatures AS signature_row
    WHERE signature_row.package_id = distribution_summary.package_id
      AND (
        lower(coalesce(signature_row.signature_algorithm, '')) NOT IN ('ed25519', 'ecdsa-secp256k1', 'secp256k1', 'rsa-pss-sha256')
        OR length(btrim(coalesce(signature_row.signature, ''))) < 32
        OR btrim(coalesce(signature_row.signature, '')) ~ '[[:space:]]'
      );
  END IF;

  computed_policy_mismatch := (
    distribution_summary.package_id IS NULL
    OR NOT coalesce(distribution_summary.distribution_ready, false)
  );

  IF computed_stale_package THEN
    PERFORM public.open_governance_public_audit_verifier_mirror_federation_alert(
      'verifier_federation_distribution_stale_package',
      'critical',
      'federation_distribution_stale_package',
      format('Latest federation package is stale or missing (window %s hours).', normalized_stale_after_hours),
      jsonb_build_object(
        'source', 'run_governance_public_audit_verifier_federation_distribution_verification',
        'target_batch_id', distribution_summary.batch_id,
        'package_id', distribution_summary.package_id,
        'captured_at', distribution_summary.captured_at,
        'stale_after_hours', normalized_stale_after_hours
      )
    );
  ELSE
    PERFORM public.resolve_governance_public_audit_verifier_mirror_federation_alert(
      alert.id,
      'Auto-resolved by federation distribution verification run.'
    )
    FROM public.governance_public_audit_verifier_mirror_federation_alerts AS alert
    WHERE alert.alert_key = 'verifier_federation_distribution_stale_package'
      AND alert.alert_status IN ('open', 'acknowledged')
    LIMIT 1;
  END IF;

  IF computed_bad_signature_count > 0 THEN
    PERFORM public.open_governance_public_audit_verifier_mirror_federation_alert(
      'verifier_federation_distribution_bad_signature',
      'critical',
      'federation_distribution_bad_signature',
      format('Detected %s malformed or unsupported federation package signatures.', computed_bad_signature_count),
      jsonb_build_object(
        'source', 'run_governance_public_audit_verifier_federation_distribution_verification',
        'target_batch_id', distribution_summary.batch_id,
        'package_id', distribution_summary.package_id,
        'package_hash', distribution_summary.package_hash,
        'bad_signature_count', computed_bad_signature_count
      )
    );
  ELSE
    PERFORM public.resolve_governance_public_audit_verifier_mirror_federation_alert(
      alert.id,
      'Auto-resolved by federation distribution verification run.'
    )
    FROM public.governance_public_audit_verifier_mirror_federation_alerts AS alert
    WHERE alert.alert_key = 'verifier_federation_distribution_bad_signature'
      AND alert.alert_status IN ('open', 'acknowledged')
    LIMIT 1;
  END IF;

  IF computed_policy_mismatch THEN
    PERFORM public.open_governance_public_audit_verifier_mirror_federation_alert(
      'verifier_federation_distribution_policy_mismatch',
      'critical',
      'federation_distribution_policy_mismatch',
      format(
        'Federation distribution policy mismatch: %s/%s distinct signatures and ops_ready=%s.',
        coalesce(distribution_summary.distinct_signer_count, 0),
        coalesce(distribution_summary.required_distribution_signatures, 1),
        coalesce(distribution_summary.federation_ops_ready, false)
      ),
      jsonb_build_object(
        'source', 'run_governance_public_audit_verifier_federation_distribution_verification',
        'target_batch_id', distribution_summary.batch_id,
        'package_id', distribution_summary.package_id,
        'required_distribution_signatures', distribution_summary.required_distribution_signatures,
        'distinct_signer_count', distribution_summary.distinct_signer_count,
        'signature_count', distribution_summary.signature_count,
        'federation_ops_ready', distribution_summary.federation_ops_ready,
        'distribution_ready', distribution_summary.distribution_ready
      )
    );
  ELSE
    PERFORM public.resolve_governance_public_audit_verifier_mirror_federation_alert(
      alert.id,
      'Auto-resolved by federation distribution verification run.'
    )
    FROM public.governance_public_audit_verifier_mirror_federation_alerts AS alert
    WHERE alert.alert_key = 'verifier_federation_distribution_policy_mismatch'
      AND alert.alert_status IN ('open', 'acknowledged')
    LIMIT 1;
  END IF;

  SELECT coalesce(count(*)::integer, 0)
  INTO computed_open_alert_count
  FROM public.governance_public_audit_verifier_mirror_federation_alerts AS alert
  WHERE alert.alert_status IN ('open', 'acknowledged')
    AND alert.alert_scope IN (
      'federation_distribution_stale_package',
      'federation_distribution_bad_signature',
      'federation_distribution_policy_mismatch'
    );

  computed_run_status := CASE
    WHEN computed_stale_package OR computed_bad_signature_count > 0 THEN 'failed'
    WHEN computed_policy_mismatch OR computed_open_alert_count > 0 THEN 'degraded'
    ELSE 'ok'
  END;

  computed_error_message := CASE
    WHEN computed_run_status = 'ok' THEN NULL
    ELSE 'Federation distribution verification reported blocking findings.'
  END;

  payload := coalesce(run_metadata, '{}'::jsonb)
    || jsonb_build_object(
      'source', 'run_governance_public_audit_verifier_federation_distribution_verification',
      'target_batch_id', distribution_summary.batch_id,
      'requested_policy_key', lower(coalesce(nullif(btrim(coalesce(requested_policy_key, '')), ''), 'default')),
      'stale_after_hours', normalized_stale_after_hours,
      'package_id', distribution_summary.package_id,
      'package_hash', distribution_summary.package_hash,
      'distribution_ready', coalesce(distribution_summary.distribution_ready, false),
      'stale_package', computed_stale_package,
      'bad_signature_count', computed_bad_signature_count,
      'policy_mismatch', computed_policy_mismatch,
      'open_alert_count', computed_open_alert_count,
      'required_distribution_signatures', distribution_summary.required_distribution_signatures,
      'distinct_signer_count', distribution_summary.distinct_signer_count,
      'signature_count', distribution_summary.signature_count
    );

  computed_run_id := public.record_governance_public_audit_verifier_mirror_federation_worker_run(
    'package_distribution_verification',
    computed_run_status,
    0,
    0,
    0,
    computed_open_alert_count,
    computed_error_message,
    payload
  );

  IF distribution_summary.batch_id IS NOT NULL AND computed_open_alert_count > 0 THEN
    PERFORM public.maybe_escalate_verifier_federation_distribution_execution_page(
      distribution_summary.batch_id,
      computed_open_alert_count,
      jsonb_build_object(
        'run_id', computed_run_id,
        'run_status', computed_run_status,
        'stale_package', computed_stale_package,
        'bad_signature_count', computed_bad_signature_count,
        'policy_mismatch', computed_policy_mismatch
      )
    );
  END IF;

  RETURN QUERY
  SELECT
    computed_run_id,
    computed_run_status,
    distribution_summary.package_id,
    distribution_summary.package_hash,
    coalesce(distribution_summary.distribution_ready, false),
    computed_stale_package,
    computed_bad_signature_count,
    computed_policy_mismatch,
    computed_open_alert_count,
    distribution_summary.captured_at,
    distribution_summary.last_signed_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Short symbol: Postgres truncates identifiers to 63 chars, so a long *_cron_tick name
-- would collide with run_governance_public_audit_verifier_federation_distribution_verification.
CREATE OR REPLACE FUNCTION public.gpav_federation_dist_verification_cron_tick()
RETURNS void AS $$
DECLARE
  _rec record;
BEGIN
  IF session_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Verifier federation distribution verification cron tick is restricted to database superuser sessions';
  END IF;

  FOR _rec IN
    SELECT *
    FROM public.run_governance_public_audit_verifier_federation_distribution_verification(
      NULL::uuid,
      'default',
      24,
      jsonb_build_object('source', 'pg_cron_verifier_federation_distribution_verification')
    )
  LOOP
    NULL;
  END LOOP;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Verifier federation distribution verification cron tick non-fatal: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.gpav_federation_dist_verification_cron_tick() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gpav_federation_dist_verification_cron_tick() FROM authenticated;
REVOKE ALL ON FUNCTION public.gpav_federation_dist_verification_cron_tick() FROM service_role;

GRANT EXECUTE ON FUNCTION public.gpav_federation_dist_verification_cron_tick() TO postgres;
GRANT EXECUTE ON FUNCTION public.gpav_federation_dist_verification_cron_tick() TO supabase_admin;

DO $$
BEGIN
  IF to_regnamespace('cron') IS NULL THEN
    RAISE NOTICE
      'pg_cron schema missing; skipping verifier federation distribution verification cron registration.';
    RETURN;
  END IF;

  BEGIN
    EXECUTE $cron$
      SELECT cron.unschedule(job.jobid)
      FROM cron.job
      WHERE job.jobname = 'verifier_federation_distribution_verification_tick'
    $cron$;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Could not unschedule verifier federation distribution verification cron job: %', SQLERRM;
  END;

  BEGIN
    EXECUTE $cron$
      SELECT cron.schedule(
        'verifier_federation_distribution_verification_tick',
        '45 * * * *',
        $job$SELECT public.gpav_federation_dist_verification_cron_tick();$job$
      )
    $cron$;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Could not schedule verifier federation distribution verification cron job: %', SQLERRM;
  END;
END $$;
