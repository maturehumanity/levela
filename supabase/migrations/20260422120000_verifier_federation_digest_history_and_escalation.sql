-- Phase A/B/C completion: expose Postgres jsonb::text used for package_hash, add package
-- history RPC, and escalate open distribution alerts to external execution paging.

CREATE OR REPLACE FUNCTION public.governance_public_audit_verifier_federation_package_with_digest_source(
  target_batch_id uuid DEFAULT NULL,
  requested_policy_key text DEFAULT 'default'
)
RETURNS TABLE (
  package_version text,
  package_hash text,
  package_payload jsonb,
  batch_id uuid,
  source_directory_id uuid,
  source_directory_hash text,
  federation_ops_ready boolean,
  digest_source_text text
) AS $$
  SELECT
    pkg.package_version,
    pkg.package_hash,
    pkg.package_payload,
    pkg.batch_id,
    pkg.source_directory_id,
    pkg.source_directory_hash,
    pkg.federation_ops_ready,
    pkg.package_payload::text AS digest_source_text
  FROM public.governance_public_audit_verifier_federation_package(target_batch_id, requested_policy_key) AS pkg;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_public_audit_verifier_federation_distribution_package_history(
  target_batch_id uuid DEFAULT NULL,
  max_entries integer DEFAULT 40
)
RETURNS TABLE (
  package_id uuid,
  batch_id uuid,
  captured_at timestamptz,
  package_version text,
  package_hash text,
  source_directory_id uuid,
  signature_count integer
) AS $$
WITH resolved_batch AS (
  SELECT coalesce(
    target_batch_id,
    (
      SELECT batch.id
      FROM public.governance_public_audit_batches AS batch
      ORDER BY batch.batch_index DESC
      LIMIT 1
    )
  ) AS batch_id
),
packages AS (
  SELECT package.*
  FROM public.governance_public_audit_verifier_federation_packages AS package
  JOIN resolved_batch ON resolved_batch.batch_id = package.batch_id
  WHERE package.package_scope = 'verifier_federation_distribution'
  ORDER BY package.captured_at DESC, package.created_at DESC, package.id DESC
  LIMIT greatest(1, coalesce(max_entries, 40))
),
signature_counts AS (
  SELECT
    signature_row.package_id,
    coalesce(count(*)::integer, 0) AS signature_count
  FROM public.governance_public_audit_verifier_federation_package_signatures AS signature_row
  WHERE signature_row.package_id IN (SELECT packages.id FROM packages)
  GROUP BY signature_row.package_id
)
SELECT
  pkg.id AS package_id,
  pkg.batch_id,
  pkg.captured_at,
  pkg.package_version,
  pkg.package_hash,
  pkg.source_directory_id,
  coalesce(signature_counts.signature_count, 0) AS signature_count
FROM packages AS pkg
LEFT JOIN signature_counts ON signature_counts.package_id = pkg.id
ORDER BY pkg.captured_at DESC, pkg.created_at DESC, pkg.id DESC;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.maybe_escalate_verifier_federation_distribution_execution_page(
  target_batch_id uuid,
  open_distribution_alert_count integer,
  escalation_context jsonb DEFAULT '{}'::jsonb
)
RETURNS void AS $$
BEGIN
  IF target_batch_id IS NULL OR coalesce(open_distribution_alert_count, 0) <= 0 THEN
    RETURN;
  END IF;

  PERFORM public.open_governance_public_audit_external_execution_page(
    target_batch_id,
    'verifier_federation_distribution_escalation',
    'critical',
    format(
      '%s open federation distribution alert(s); resolve federation alerts or re-run verification after remediation.',
      open_distribution_alert_count
    ),
    jsonb_build_object(
      'source', 'maybe_escalate_verifier_federation_distribution_execution_page',
      'open_distribution_alert_count', open_distribution_alert_count
    ) || coalesce(escalation_context, '{}'::jsonb)
  );
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

GRANT EXECUTE ON FUNCTION public.governance_public_audit_verifier_federation_package_with_digest_source(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_verifier_federation_distribution_package_history(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.maybe_escalate_verifier_federation_distribution_execution_page(uuid, integer, jsonb) TO authenticated;
