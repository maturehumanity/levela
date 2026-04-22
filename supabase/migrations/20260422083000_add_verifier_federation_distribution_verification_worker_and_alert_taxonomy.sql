ALTER TABLE public.governance_public_audit_verifier_mirror_federation_worker_runs
  DROP CONSTRAINT IF EXISTS gpav_fed_wr_scope_chk;
ALTER TABLE public.governance_public_audit_verifier_mirror_federation_worker_runs
  DROP CONSTRAINT IF EXISTS governance_public_audit_verifier_mirror_federation_worker_runs_;

ALTER TABLE public.governance_public_audit_verifier_mirror_federation_worker_runs
  ADD CONSTRAINT gpav_fed_wr_scope_chk CHECK (
    run_scope IN ('onboarding_sweep', 'operator_health_audit', 'diversity_audit', 'package_distribution_verification', 'manual')
  );

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
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
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
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
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

DROP FUNCTION IF EXISTS public.governance_public_audit_verifier_mirror_federation_operations_summary(text, integer, integer);

CREATE OR REPLACE FUNCTION public.governance_public_audit_verifier_mirror_federation_operations_summary(
  requested_policy_key text DEFAULT 'default',
  requested_lookback_hours integer DEFAULT 24,
  requested_alert_sla_hours integer DEFAULT 12
)
RETURNS TABLE (
  policy_key text,
  require_federation_ops_readiness boolean,
  max_open_critical_federation_alerts integer,
  min_onboarded_federation_operators integer,
  registered_operator_count integer,
  approved_operator_count integer,
  onboarded_operator_count integer,
  pending_request_count integer,
  approved_request_count integer,
  onboarded_request_count integer,
  open_warning_alert_count integer,
  open_critical_alert_count integer,
  alert_sla_hours integer,
  alert_sla_breached_count integer,
  last_worker_run_at timestamptz,
  last_worker_run_status text,
  distribution_verification_lookback_hours integer,
  last_distribution_verification_run_at timestamptz,
  last_distribution_verification_run_status text,
  distribution_verification_stale boolean,
  open_distribution_stale_package_alert_count integer,
  open_distribution_bad_signature_alert_count integer,
  open_distribution_policy_mismatch_alert_count integer,
  open_distribution_verification_alert_count integer,
  federation_ops_ready boolean
) AS $$
WITH policy AS (
  SELECT
    coalesce(summary.policy_key, 'default') AS policy_key,
    coalesce(summary.require_federation_ops_readiness, false) AS require_federation_ops_readiness,
    greatest(0, coalesce(summary.max_open_critical_federation_alerts, 0)) AS max_open_critical_federation_alerts,
    greatest(1, coalesce(summary.min_onboarded_federation_operators, 1)) AS min_onboarded_federation_operators
  FROM public.governance_public_audit_verifier_mirror_failover_policy_summary(requested_policy_key) AS summary
),
fallback_policy AS (
  SELECT
    lower(coalesce(nullif(btrim(coalesce(requested_policy_key, '')), ''), 'default')) AS policy_key,
    false AS require_federation_ops_readiness,
    0 AS max_open_critical_federation_alerts,
    1 AS min_onboarded_federation_operators
  WHERE NOT EXISTS (SELECT 1 FROM policy)
),
effective_policy AS (
  SELECT * FROM policy
  UNION ALL
  SELECT * FROM fallback_policy
),
operator_counts AS (
  SELECT
    coalesce(count(*)::integer, 0) AS registered_operator_count,
    coalesce(count(*) FILTER (WHERE operator.onboarding_status = 'approved')::integer, 0) AS approved_operator_count,
    coalesce(count(*) FILTER (WHERE operator.onboarding_status = 'onboarded')::integer, 0) AS onboarded_operator_count
  FROM public.governance_public_audit_verifier_mirror_federation_operators AS operator
),
request_counts AS (
  SELECT
    coalesce(count(*) FILTER (WHERE request.request_status = 'pending')::integer, 0) AS pending_request_count,
    coalesce(count(*) FILTER (WHERE request.request_status = 'approved')::integer, 0) AS approved_request_count,
    coalesce(count(*) FILTER (WHERE request.request_status = 'onboarded')::integer, 0) AS onboarded_request_count
  FROM public.governance_public_audit_verifier_mirror_federation_onboarding_requests AS request
),
alert_counts AS (
  SELECT
    coalesce(count(*) FILTER (WHERE alert.alert_status = 'open' AND alert.severity = 'warning')::integer, 0) AS open_warning_alert_count,
    coalesce(count(*) FILTER (WHERE alert.alert_status = 'open' AND alert.severity = 'critical')::integer, 0) AS open_critical_alert_count,
    coalesce(count(*) FILTER (
      WHERE alert.alert_status = 'open'
        AND alert.opened_at < (now() - make_interval(hours => greatest(1, coalesce(requested_alert_sla_hours, 12))))
    )::integer, 0) AS alert_sla_breached_count
  FROM public.governance_public_audit_verifier_mirror_federation_alerts AS alert
),
last_worker_run AS (
  SELECT run.observed_at AS last_worker_run_at, run.run_status AS last_worker_run_status
  FROM public.governance_public_audit_verifier_mirror_federation_worker_runs AS run
  WHERE run.observed_at >= (now() - make_interval(hours => greatest(1, coalesce(requested_lookback_hours, 24))))
  ORDER BY run.observed_at DESC, run.created_at DESC
  LIMIT 1
),
last_distribution_verification_run AS (
  SELECT
    run.observed_at AS last_distribution_verification_run_at,
    run.run_status AS last_distribution_verification_run_status
  FROM public.governance_public_audit_verifier_mirror_federation_worker_runs AS run
  WHERE run.run_scope = 'package_distribution_verification'
  ORDER BY run.observed_at DESC, run.created_at DESC
  LIMIT 1
),
distribution_alert_counts AS (
  SELECT
    coalesce(count(*) FILTER (
      WHERE alert.alert_status IN ('open', 'acknowledged')
        AND alert.alert_scope = 'federation_distribution_stale_package'
    )::integer, 0) AS open_distribution_stale_package_alert_count,
    coalesce(count(*) FILTER (
      WHERE alert.alert_status IN ('open', 'acknowledged')
        AND alert.alert_scope = 'federation_distribution_bad_signature'
    )::integer, 0) AS open_distribution_bad_signature_alert_count,
    coalesce(count(*) FILTER (
      WHERE alert.alert_status IN ('open', 'acknowledged')
        AND alert.alert_scope = 'federation_distribution_policy_mismatch'
    )::integer, 0) AS open_distribution_policy_mismatch_alert_count,
    coalesce(count(*) FILTER (
      WHERE alert.alert_status IN ('open', 'acknowledged')
        AND alert.alert_scope IN (
          'federation_distribution_stale_package',
          'federation_distribution_bad_signature',
          'federation_distribution_policy_mismatch'
        )
    )::integer, 0) AS open_distribution_verification_alert_count
  FROM public.governance_public_audit_verifier_mirror_federation_alerts AS alert
),
distribution_health AS (
  SELECT
    greatest(1, coalesce(requested_lookback_hours, 24))::integer AS distribution_verification_lookback_hours,
    distribution_run.last_distribution_verification_run_at,
    coalesce(distribution_run.last_distribution_verification_run_status, 'unknown') AS last_distribution_verification_run_status,
    (
      distribution_run.last_distribution_verification_run_at IS NULL
      OR distribution_run.last_distribution_verification_run_at < (now() - make_interval(hours => greatest(1, coalesce(requested_lookback_hours, 24))))
    ) AS distribution_verification_stale,
    distribution_alert_counts.open_distribution_stale_package_alert_count,
    distribution_alert_counts.open_distribution_bad_signature_alert_count,
    distribution_alert_counts.open_distribution_policy_mismatch_alert_count,
    distribution_alert_counts.open_distribution_verification_alert_count
  FROM distribution_alert_counts
  LEFT JOIN last_distribution_verification_run AS distribution_run ON true
)
SELECT
  effective_policy.policy_key,
  effective_policy.require_federation_ops_readiness,
  effective_policy.max_open_critical_federation_alerts,
  effective_policy.min_onboarded_federation_operators,
  operator_counts.registered_operator_count,
  operator_counts.approved_operator_count,
  operator_counts.onboarded_operator_count,
  request_counts.pending_request_count,
  request_counts.approved_request_count,
  request_counts.onboarded_request_count,
  alert_counts.open_warning_alert_count,
  alert_counts.open_critical_alert_count,
  greatest(1, coalesce(requested_alert_sla_hours, 12))::integer AS alert_sla_hours,
  alert_counts.alert_sla_breached_count,
  last_worker_run.last_worker_run_at,
  coalesce(last_worker_run.last_worker_run_status, 'unknown') AS last_worker_run_status,
  distribution_health.distribution_verification_lookback_hours,
  distribution_health.last_distribution_verification_run_at,
  distribution_health.last_distribution_verification_run_status,
  distribution_health.distribution_verification_stale,
  distribution_health.open_distribution_stale_package_alert_count,
  distribution_health.open_distribution_bad_signature_alert_count,
  distribution_health.open_distribution_policy_mismatch_alert_count,
  distribution_health.open_distribution_verification_alert_count,
  (
    effective_policy.require_federation_ops_readiness = false
    OR (
      operator_counts.onboarded_operator_count >= effective_policy.min_onboarded_federation_operators
      AND alert_counts.open_critical_alert_count <= effective_policy.max_open_critical_federation_alerts
      AND alert_counts.alert_sla_breached_count = 0
      AND distribution_health.distribution_verification_stale = false
      AND distribution_health.open_distribution_verification_alert_count = 0
    )
  ) AS federation_ops_ready
FROM effective_policy
CROSS JOIN operator_counts
CROSS JOIN request_counts
CROSS JOIN alert_counts
CROSS JOIN distribution_health
LEFT JOIN last_worker_run ON true;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.record_governance_public_audit_verifier_mirror_federation_worker_run(text, text, integer, integer, integer, integer, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_governance_public_audit_verifier_federation_distribution_verification(uuid, text, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_verifier_mirror_federation_operations_summary(text, integer, integer) TO authenticated;
