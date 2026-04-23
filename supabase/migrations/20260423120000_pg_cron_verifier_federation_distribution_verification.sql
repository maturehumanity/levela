-- Phase C.12: hourly in-database tick runs federation package distribution verification
-- (same logic as steward UI) so alerts, worker runs, and external execution escalation
-- stay fresh without a browser session. Superuser sessions are limited to the same
-- distribution alert scopes and external page key as automation (narrow carve-out).

CREATE OR REPLACE FUNCTION public.open_governance_public_audit_external_execution_page(
  target_batch_id uuid,
  page_key text,
  severity text,
  page_message text,
  page_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  policy_record public.governance_public_audit_external_execution_policies%ROWTYPE;
  inserted_id uuid;
  normalized_page_key text;
  normalized_severity text;
  normalized_message text;
  caller_authorized boolean;
BEGIN
  normalized_page_key := lower(coalesce(nullif(btrim(coalesce(page_key, '')), ''), 'external_execution_ops'));
  normalized_severity := lower(coalesce(nullif(btrim(coalesce(severity, '')), ''), 'warning'));
  normalized_message := coalesce(nullif(btrim(coalesce(page_message, '')), ''), 'Public audit external execution policy threshold breached');

  caller_authorized := public.current_profile_can_manage_public_audit_verifiers()
    OR (
      normalized_page_key = 'activation_demographic_feed_worker_escalation'
      AND public.current_profile_can_manage_activation_demographic_feed_workers()
    )
    OR (
      session_user IN ('postgres', 'supabase_admin')
      AND normalized_page_key = 'activation_demographic_feed_worker_escalation'
    )
    OR (
      session_user IN ('postgres', 'supabase_admin')
      AND normalized_page_key = 'verifier_federation_distribution_escalation'
    )
    OR (
      normalized_page_key = 'guardian_relay_critical_escalation'
      AND public.current_profile_can_manage_guardian_relays()
    )
    OR (
      normalized_page_key = 'guardian_relay_proof_distribution_escalation'
      AND public.current_profile_can_manage_guardian_relays()
    );

  IF NOT caller_authorized THEN
    RAISE EXCEPTION 'Current profile is not authorized to open public audit external execution pages';
  END IF;

  IF target_batch_id IS NULL THEN
    RAISE EXCEPTION 'Target batch id is required';
  END IF;

  IF normalized_severity NOT IN ('info', 'warning', 'critical') THEN
    RAISE EXCEPTION 'Page severity must be info, warning, or critical';
  END IF;

  SELECT policy.*
  INTO policy_record
  FROM public.governance_public_audit_external_execution_policies AS policy
  WHERE policy.policy_key = 'default'
  LIMIT 1;

  INSERT INTO public.governance_public_audit_external_execution_pages (
    batch_id,
    page_key,
    severity,
    page_status,
    page_message,
    oncall_channel,
    page_payload,
    opened_at,
    created_by
  )
  VALUES (
    target_batch_id,
    normalized_page_key,
    normalized_severity,
    'open',
    normalized_message,
    coalesce(policy_record.oncall_channel, 'public_audit_ops'),
    coalesce(page_payload, '{}'::jsonb),
    now(),
    public.current_profile_id()
  )
  ON CONFLICT (batch_id, page_key) DO UPDATE
    SET severity = excluded.severity,
        page_status = 'open',
        page_message = excluded.page_message,
        oncall_channel = excluded.oncall_channel,
        page_payload = coalesce(public.governance_public_audit_external_execution_pages.page_payload, '{}'::jsonb)
          || coalesce(excluded.page_payload, '{}'::jsonb),
        opened_at = now(),
        acknowledged_at = NULL,
        resolved_at = NULL,
        resolved_by = NULL
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.resolve_governance_public_audit_external_execution_page(
  target_page_id uuid,
  resolution_notes text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  page_record public.governance_public_audit_external_execution_pages%ROWTYPE;
  caller_authorized boolean;
BEGIN
  SELECT *
  INTO page_record
  FROM public.governance_public_audit_external_execution_pages AS page
  WHERE page.id = target_page_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Public audit external execution page not found';
  END IF;

  caller_authorized := public.current_profile_can_manage_public_audit_verifiers()
    OR (
      lower(btrim(page_record.page_key)) = 'activation_demographic_feed_worker_escalation'
      AND public.current_profile_can_manage_activation_demographic_feed_workers()
    )
    OR (
      session_user IN ('postgres', 'supabase_admin')
      AND lower(btrim(page_record.page_key)) = 'activation_demographic_feed_worker_escalation'
    )
    OR (
      session_user IN ('postgres', 'supabase_admin')
      AND lower(btrim(page_record.page_key)) = 'verifier_federation_distribution_escalation'
    )
    OR (
      lower(btrim(page_record.page_key)) = 'guardian_relay_critical_escalation'
      AND public.current_profile_can_manage_guardian_relays()
    )
    OR (
      lower(btrim(page_record.page_key)) = 'guardian_relay_proof_distribution_escalation'
      AND public.current_profile_can_manage_guardian_relays()
    );

  IF NOT caller_authorized THEN
    RAISE EXCEPTION 'Current profile is not authorized to resolve public audit external execution pages';
  END IF;

  UPDATE public.governance_public_audit_external_execution_pages
  SET page_status = 'resolved',
      page_payload = coalesce(page_record.page_payload, '{}'::jsonb)
        || jsonb_build_object(
          'resolution_notes', nullif(btrim(coalesce(resolution_notes, '')), ''),
          'resolved_at', now()
        ),
      resolved_at = now(),
      resolved_by = public.current_profile_id()
  WHERE id = page_record.id;

  RETURN page_record.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.open_governance_public_audit_verifier_mirror_federation_alert(
  alert_key text,
  severity text,
  alert_scope text,
  alert_message text,
  metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  inserted_id uuid;
  normalized_severity text;
  normalized_scope text;
BEGIN
  normalized_scope := lower(coalesce(nullif(btrim(coalesce(alert_scope, '')), ''), 'manual'));

  IF NOT (
    public.current_profile_can_manage_public_audit_verifiers()
    OR (
      session_user IN ('postgres', 'supabase_admin')
      AND normalized_scope IN (
        'federation_distribution_stale_package',
        'federation_distribution_bad_signature',
        'federation_distribution_policy_mismatch'
      )
    )
  ) THEN
    RAISE EXCEPTION 'Current profile is not authorized to open federation alerts';
  END IF;

  normalized_severity := lower(coalesce(nullif(btrim(coalesce(severity, '')), ''), 'warning'));
  IF normalized_severity NOT IN ('info', 'warning', 'critical') THEN
    RAISE EXCEPTION 'Alert severity must be info, warning, or critical';
  END IF;

  INSERT INTO public.governance_public_audit_verifier_mirror_federation_alerts (
    alert_key,
    severity,
    alert_scope,
    alert_status,
    alert_message,
    metadata,
    opened_at,
    created_by
  )
  VALUES (
    btrim(coalesce(alert_key, '')),
    normalized_severity,
    normalized_scope,
    'open',
    btrim(coalesce(alert_message, '')),
    coalesce(metadata, '{}'::jsonb),
    now(),
    public.current_profile_id()
  )
  ON CONFLICT (alert_key) DO UPDATE
    SET severity = excluded.severity,
        alert_scope = excluded.alert_scope,
        alert_status = 'open',
        alert_message = excluded.alert_message,
        metadata = coalesce(public.governance_public_audit_verifier_mirror_federation_alerts.metadata, '{}'::jsonb)
          || coalesce(excluded.metadata, '{}'::jsonb),
        opened_at = now(),
        acknowledged_at = NULL,
        resolved_at = NULL,
        resolved_by = NULL
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.resolve_governance_public_audit_verifier_mirror_federation_alert(
  target_alert_id uuid,
  resolution_notes text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  alert_record public.governance_public_audit_verifier_mirror_federation_alerts%ROWTYPE;
BEGIN
  SELECT *
  INTO alert_record
  FROM public.governance_public_audit_verifier_mirror_federation_alerts AS alert
  WHERE alert.id = target_alert_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Federation alert not found';
  END IF;

  IF NOT (
    public.current_profile_can_manage_public_audit_verifiers()
    OR (
      session_user IN ('postgres', 'supabase_admin')
      AND lower(btrim(coalesce(alert_record.alert_scope, ''))) IN (
        'federation_distribution_stale_package',
        'federation_distribution_bad_signature',
        'federation_distribution_policy_mismatch'
      )
    )
  ) THEN
    RAISE EXCEPTION 'Current profile is not authorized to resolve federation alerts';
  END IF;

  UPDATE public.governance_public_audit_verifier_mirror_federation_alerts
  SET
    alert_status = 'resolved',
    metadata = coalesce(alert_record.metadata, '{}'::jsonb)
      || jsonb_build_object('resolution_notes', nullif(btrim(coalesce(resolution_notes, '')), ''), 'resolved_at', now()),
    resolved_at = now(),
    resolved_by = public.current_profile_id()
  WHERE id = alert_record.id;

  RETURN alert_record.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.record_governance_public_audit_verifier_mirror_federation_worker_run(
  run_scope text,
  run_status text,
  discovered_request_count integer DEFAULT 0,
  approved_request_count integer DEFAULT 0,
  onboarded_request_count integer DEFAULT 0,
  open_alert_count integer DEFAULT 0,
  error_message text DEFAULT NULL,
  run_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  inserted_id uuid;
  normalized_scope text;
  normalized_status text;
BEGIN
  IF NOT (
    public.current_profile_can_manage_public_audit_verifiers()
    OR (
      session_user IN ('postgres', 'supabase_admin')
      AND lower(coalesce(nullif(btrim(coalesce(run_scope, '')), ''), '')) = 'package_distribution_verification'
    )
  ) THEN
    RAISE EXCEPTION 'Current profile is not authorized to record federation worker runs';
  END IF;

  normalized_scope := lower(coalesce(nullif(btrim(coalesce(run_scope, '')), ''), 'manual'));
  IF normalized_scope NOT IN ('onboarding_sweep', 'operator_health_audit', 'diversity_audit', 'package_distribution_verification', 'manual') THEN
    RAISE EXCEPTION 'Worker run scope must be onboarding_sweep, operator_health_audit, diversity_audit, package_distribution_verification, or manual';
  END IF;

  normalized_status := lower(coalesce(nullif(btrim(coalesce(run_status, '')), ''), 'ok'));
  IF normalized_status NOT IN ('ok', 'degraded', 'failed') THEN
    RAISE EXCEPTION 'Worker run status must be ok, degraded, or failed';
  END IF;

  INSERT INTO public.governance_public_audit_verifier_mirror_federation_worker_runs (
    run_scope,
    run_status,
    discovered_request_count,
    approved_request_count,
    onboarded_request_count,
    open_alert_count,
    error_message,
    run_payload,
    observed_at,
    created_by
  )
  VALUES (
    normalized_scope,
    normalized_status,
    greatest(0, coalesce(discovered_request_count, 0)),
    greatest(0, coalesce(approved_request_count, 0)),
    greatest(0, coalesce(onboarded_request_count, 0)),
    greatest(0, coalesce(open_alert_count, 0)),
    nullif(btrim(coalesce(error_message, '')), ''),
    coalesce(run_payload, '{}'::jsonb),
    now(),
    public.current_profile_id()
  )
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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
