CREATE OR REPLACE FUNCTION public.governance_public_audit_verifier_federation_distribution_gate(
  target_batch_id uuid DEFAULT NULL,
  requested_policy_key text DEFAULT 'default'
)
RETURNS TABLE (
  package_id uuid,
  batch_id uuid,
  captured_at timestamptz,
  package_version text,
  package_hash text,
  source_directory_hash text,
  required_distribution_signatures integer,
  signature_count integer,
  distinct_signer_count integer,
  distinct_signer_jurisdictions_count integer,
  distinct_signer_trust_domains_count integer,
  last_signed_at timestamptz,
  federation_ops_ready boolean,
  distribution_ready boolean
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
policy AS (
  SELECT
    greatest(
      1,
      coalesce(
        policy.min_policy_ratification_approvals,
        policy.min_independent_directory_signers,
        1
      )
    )::integer AS required_signatures
  FROM public.governance_public_audit_verifier_mirror_failover_policies AS policy
  WHERE policy.policy_key = lower(coalesce(nullif(btrim(coalesce(requested_policy_key, '')), ''), 'default'))
  ORDER BY policy.updated_at DESC, policy.created_at DESC, policy.id DESC
  LIMIT 1
),
fallback_policy AS (
  SELECT 1::integer AS required_signatures
  WHERE NOT EXISTS (SELECT 1 FROM policy)
),
effective_policy AS (
  SELECT * FROM policy
  UNION ALL
  SELECT * FROM fallback_policy
),
latest_package AS (
  SELECT package.*
  FROM public.governance_public_audit_verifier_federation_packages AS package
  JOIN resolved_batch ON resolved_batch.batch_id = package.batch_id
  WHERE package.package_scope = 'verifier_federation_distribution'
  ORDER BY package.captured_at DESC, package.created_at DESC, package.id DESC
  LIMIT 1
),
signature_tally AS (
  SELECT
    latest_package.id AS package_id,
    coalesce(count(signature_row.*), 0)::integer AS signature_count,
    coalesce(count(DISTINCT lower(btrim(signature_row.signer_key))), 0)::integer AS distinct_signer_count,
    coalesce(count(DISTINCT upper(nullif(btrim(coalesce(signature_row.signer_jurisdiction_country_code, '')), ''))), 0)::integer AS distinct_signer_jurisdictions_count,
    coalesce(count(DISTINCT lower(nullif(btrim(coalesce(signature_row.signer_trust_domain, '')), ''))), 0)::integer AS distinct_signer_trust_domains_count,
    max(signature_row.signed_at) AS last_signed_at
  FROM latest_package
  LEFT JOIN public.governance_public_audit_verifier_federation_package_signatures AS signature_row
    ON signature_row.package_id = latest_package.id
  GROUP BY latest_package.id
)
SELECT
  latest_package.id AS package_id,
  latest_package.batch_id,
  latest_package.captured_at,
  latest_package.package_version,
  latest_package.package_hash,
  source_directory.directory_hash AS source_directory_hash,
  effective_policy.required_signatures AS required_distribution_signatures,
  coalesce(signature_tally.signature_count, 0) AS signature_count,
  coalesce(signature_tally.distinct_signer_count, 0) AS distinct_signer_count,
  coalesce(signature_tally.distinct_signer_jurisdictions_count, 0) AS distinct_signer_jurisdictions_count,
  coalesce(signature_tally.distinct_signer_trust_domains_count, 0) AS distinct_signer_trust_domains_count,
  signature_tally.last_signed_at,
  coalesce((latest_package.package_payload #>> '{federation_ops_summary,federation_ops_ready}')::boolean, false) AS federation_ops_ready,
  (
    latest_package.id IS NOT NULL
    AND coalesce(signature_tally.distinct_signer_count, 0) >= effective_policy.required_signatures
    AND coalesce((latest_package.package_payload #>> '{federation_ops_summary,federation_ops_ready}')::boolean, false)
  ) AS distribution_ready
FROM effective_policy
LEFT JOIN latest_package ON true
LEFT JOIN public.governance_public_audit_verifier_mirror_directories AS source_directory
  ON source_directory.id = latest_package.source_directory_id
LEFT JOIN signature_tally
  ON signature_tally.package_id = latest_package.id;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_public_audit_client_verifier_bundle(
  target_batch_id uuid DEFAULT NULL,
  max_mirrors integer DEFAULT 8
)
RETURNS TABLE (
  bundle_version text,
  bundle_hash text,
  bundle_payload jsonb,
  healthy_mirror_count integer,
  quorum_met boolean
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
failover_policy AS (
  SELECT *
  FROM public.governance_public_audit_verifier_mirror_failover_policy_summary('default')
),
fallback_failover_policy AS (
  SELECT
    NULL::uuid AS policy_id,
    'default'::text AS policy_key,
    'Default mirror failover policy'::text AS policy_name,
    true AS is_active,
    1::integer AS min_healthy_mirrors,
    2500::integer AS max_mirror_latency_ms,
    2::integer AS max_failures_before_cooldown,
    10::integer AS cooldown_minutes,
    false AS prefer_same_region,
    1::integer AS required_distinct_regions,
    1::integer AS required_distinct_operators,
    'health_latency_diversity'::text AS mirror_selection_strategy,
    8::integer AS max_mirror_candidates,
    1::integer AS min_independent_directory_signers,
    false AS require_policy_ratification,
    1::integer AS min_policy_ratification_approvals,
    false AS require_signer_governance_approval,
    1::integer AS min_signer_governance_independent_approvals,
    false AS require_federation_ops_readiness,
    0::integer AS max_open_critical_federation_alerts,
    1::integer AS min_onboarded_federation_operators,
    now()::timestamptz AS updated_at
  WHERE NOT EXISTS (SELECT 1 FROM failover_policy)
),
effective_failover_policy AS (
  SELECT * FROM failover_policy
  UNION ALL
  SELECT * FROM fallback_failover_policy
),
batch_snapshot AS (
  SELECT
    batch.id,
    batch.batch_index,
    batch.batch_hash,
    batch.previous_batch_hash,
    batch.created_at,
    batch.anchored_at,
    batch.anchor_network,
    batch.anchor_reference,
    batch.anchor_proof
  FROM public.governance_public_audit_batches AS batch
  JOIN resolved_batch ON resolved_batch.batch_id = batch.id
),
verifier_summary AS (
  SELECT *
  FROM public.governance_public_audit_batch_verifier_summary((SELECT batch_id FROM resolved_batch))
),
mirror_health AS (
  SELECT *
  FROM public.governance_public_audit_verifier_mirror_health_summary((SELECT batch_id FROM resolved_batch), 90)
  WHERE is_active = true
),
ranked_mirrors AS (
  SELECT
    mirror.*,
    row_number() OVER (
      ORDER BY
        CASE
          WHEN mirror.health_status = 'healthy' THEN 0
          WHEN mirror.health_status = 'degraded' THEN 1
          WHEN mirror.health_status = 'unknown' THEN 2
          ELSE 3
        END,
        mirror.is_stale,
        CASE
          WHEN mirror.last_check_latency_ms IS NULL THEN 2147483647
          ELSE mirror.last_check_latency_ms
        END,
        mirror.region_code,
        mirror.operator_label,
        mirror.mirror_key
    ) AS failover_rank
  FROM mirror_health AS mirror
),
selected_mirrors AS (
  SELECT *
  FROM ranked_mirrors
  ORDER BY failover_rank
  LIMIT greatest(
    1,
    least(
      coalesce(max_mirrors, 8),
      coalesce((SELECT max_mirror_candidates FROM effective_failover_policy LIMIT 1), 8)
    )
  )
),
network_proofs AS (
  SELECT
    proof.id,
    proof.network,
    proof.proof_reference,
    proof.block_height,
    proof.recorded_at
  FROM public.governance_public_audit_network_proofs AS proof
  JOIN resolved_batch ON resolved_batch.batch_id = proof.batch_id
  ORDER BY proof.recorded_at DESC, proof.created_at DESC
),
latest_directory AS (
  SELECT
    directory.id,
    directory.batch_id,
    directory.directory_hash,
    directory.signer_key,
    signer.signer_label,
    signer.trust_tier,
    directory.signature,
    directory.signature_algorithm,
    directory.published_at
  FROM public.governance_public_audit_verifier_mirror_directories AS directory
  LEFT JOIN public.governance_public_audit_verifier_mirror_directory_signers AS signer
    ON signer.id = directory.signer_id
  CROSS JOIN resolved_batch
  WHERE resolved_batch.batch_id IS NULL
     OR directory.batch_id = resolved_batch.batch_id
  ORDER BY directory.published_at DESC, directory.created_at DESC
  LIMIT 1
),
directory_trust_summary AS (
  SELECT *
  FROM public.governance_public_audit_verifier_mirror_directory_trust_summary((SELECT batch_id FROM resolved_batch))
),
policy_ratification_summary AS (
  SELECT *
  FROM public.governance_public_audit_verifier_mirror_policy_ratification_summary('default')
),
discovery_summary AS (
  SELECT *
  FROM public.governance_public_audit_verifier_mirror_discovery_summary((SELECT batch_id FROM resolved_batch), 24)
),
federation_diversity_summary AS (
  SELECT *
  FROM public.governance_public_audit_verifier_mirror_federation_diversity_summary((SELECT batch_id FROM resolved_batch), max_mirrors)
),
federation_operations_summary AS (
  SELECT *
  FROM public.governance_public_audit_verifier_mirror_federation_operations_summary('default', 24, 12)
),
federation_distribution_summary AS (
  SELECT *
  FROM public.governance_public_audit_verifier_federation_distribution_gate((SELECT batch_id FROM resolved_batch), 'default')
),
payload_cte AS (
  SELECT jsonb_build_object(
    'bundle_version', 'public_audit_client_verifier_bundle_v1',
    'generated_at', now(),
    'batch', coalesce((SELECT to_jsonb(row_data) FROM batch_snapshot AS row_data), '{}'::jsonb),
    'verifier_summary', coalesce((SELECT to_jsonb(row_data) FROM verifier_summary AS row_data), '{}'::jsonb),
    'mirrors', coalesce((
      SELECT jsonb_agg(
        to_jsonb(row_data)
        ORDER BY row_data.failover_rank ASC
      )
      FROM selected_mirrors AS row_data
    ), '[]'::jsonb),
    'failover_policy', coalesce((SELECT to_jsonb(row_data) FROM effective_failover_policy AS row_data LIMIT 1), '{}'::jsonb),
    'failover_order', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'mirror_id', row_data.mirror_id,
          'mirror_key', row_data.mirror_key,
          'mirror_label', row_data.mirror_label,
          'region_code', row_data.region_code,
          'operator_label', row_data.operator_label,
          'health_status', row_data.health_status,
          'last_check_latency_ms', row_data.last_check_latency_ms,
          'failover_rank', row_data.failover_rank
        )
        ORDER BY row_data.failover_rank ASC
      )
      FROM selected_mirrors AS row_data
    ), '[]'::jsonb),
    'federation_diversity', coalesce((
      SELECT to_jsonb(row_data)
      FROM federation_diversity_summary AS row_data
      LIMIT 1
    ), '{}'::jsonb),
    'federation_operations', coalesce((
      SELECT to_jsonb(row_data)
      FROM federation_operations_summary AS row_data
      LIMIT 1
    ), '{}'::jsonb),
    'federation_distribution', coalesce((
      SELECT to_jsonb(row_data)
      FROM federation_distribution_summary AS row_data
      LIMIT 1
    ), '{}'::jsonb),
    'network_proofs', coalesce((
      SELECT jsonb_agg(to_jsonb(row_data) ORDER BY row_data.recorded_at DESC, row_data.id DESC)
      FROM network_proofs AS row_data
    ), '[]'::jsonb),
    'signed_directory', coalesce((
      SELECT to_jsonb(row_data)
      FROM latest_directory AS row_data
      LIMIT 1
    ), '{}'::jsonb),
    'signed_directory_trust', coalesce((
      SELECT to_jsonb(row_data)
      FROM directory_trust_summary AS row_data
      LIMIT 1
    ), '{}'::jsonb),
    'policy_ratification', coalesce((
      SELECT to_jsonb(row_data)
      FROM policy_ratification_summary AS row_data
      LIMIT 1
    ), '{}'::jsonb),
    'discovery_summary', coalesce((
      SELECT to_jsonb(row_data)
      FROM discovery_summary AS row_data
      LIMIT 1
    ), '{}'::jsonb)
  ) AS bundle_payload
),
healthy_mirror_count_cte AS (
  SELECT coalesce(count(*) FILTER (WHERE mirror.health_status = 'healthy'), 0)::integer AS healthy_mirror_count
  FROM selected_mirrors AS mirror
)
SELECT
  'public_audit_client_verifier_bundle_v1'::text AS bundle_version,
  encode(
    extensions.digest(
      (payload_cte.bundle_payload::text)::bytea,
      'sha256'
    ),
    'hex'
  ) AS bundle_hash,
  payload_cte.bundle_payload,
  coalesce(healthy_mirror_count_cte.healthy_mirror_count, 0) AS healthy_mirror_count,
  (
    coalesce((payload_cte.bundle_payload #>> '{verifier_summary,meets_replication_threshold}')::boolean, false)
    AND coalesce(healthy_mirror_count_cte.healthy_mirror_count, 0)
      >= greatest(1, coalesce((payload_cte.bundle_payload #>> '{failover_policy,min_healthy_mirrors}')::integer, 1))
    AND coalesce((payload_cte.bundle_payload #>> '{federation_diversity,meets_region_diversity}')::boolean, false)
    AND coalesce((payload_cte.bundle_payload #>> '{federation_diversity,meets_operator_diversity}')::boolean, false)
    AND coalesce((payload_cte.bundle_payload #>> '{signed_directory_trust,trust_quorum_met}')::boolean, false)
    AND (
      NOT coalesce((payload_cte.bundle_payload #>> '{failover_policy,require_policy_ratification}')::boolean, false)
      OR coalesce((payload_cte.bundle_payload #>> '{policy_ratification,ratification_met}')::boolean, false)
    )
    AND (
      NOT coalesce((payload_cte.bundle_payload #>> '{failover_policy,require_federation_ops_readiness}')::boolean, false)
      OR coalesce((payload_cte.bundle_payload #>> '{federation_operations,federation_ops_ready}')::boolean, false)
    )
    AND (
      NOT coalesce((payload_cte.bundle_payload #>> '{failover_policy,require_federation_ops_readiness}')::boolean, false)
      OR coalesce((payload_cte.bundle_payload #>> '{federation_distribution,distribution_ready}')::boolean, false)
    )
  ) AS quorum_met
FROM payload_cte
CROSS JOIN healthy_mirror_count_cte;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_proposal_meets_verifier_federation_distribution_gate(
  target_proposal_id uuid
)
RETURNS boolean AS $$
WITH policy AS (
  SELECT coalesce(failover_policy.require_federation_ops_readiness, false) AS require_distribution_gate
  FROM public.governance_public_audit_verifier_mirror_failover_policies AS failover_policy
  WHERE failover_policy.policy_key = 'default'
  ORDER BY failover_policy.updated_at DESC, failover_policy.created_at DESC, failover_policy.id DESC
  LIMIT 1
),
fallback_policy AS (
  SELECT false AS require_distribution_gate
  WHERE NOT EXISTS (SELECT 1 FROM policy)
),
effective_policy AS (
  SELECT * FROM policy
  UNION ALL
  SELECT * FROM fallback_policy
),
latest_batch AS (
  SELECT batch.id AS batch_id
  FROM public.governance_public_audit_batches AS batch
  ORDER BY batch.batch_index DESC
  LIMIT 1
),
distribution AS (
  SELECT *
  FROM public.governance_public_audit_verifier_federation_distribution_gate((SELECT batch_id FROM latest_batch), 'default')
  LIMIT 1
)
SELECT CASE
  WHEN coalesce((SELECT require_distribution_gate FROM effective_policy LIMIT 1), false) = false THEN true
  WHEN (SELECT batch_id FROM latest_batch LIMIT 1) IS NULL THEN true
  ELSE coalesce((SELECT distribution_ready FROM distribution LIMIT 1), false)
END;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_proposal_is_execution_ready(
  target_proposal_id uuid
)
RETURNS boolean AS $$
  SELECT coalesce(
    EXISTS (
      SELECT 1
      FROM public.governance_proposals AS proposal
      WHERE proposal.id = target_proposal_id
        AND proposal.status = 'approved'::public.governance_proposal_status
        AND public.governance_proposal_meets_execution_threshold(proposal.id)
        AND public.governance_proposal_meets_guardian_signoff(proposal.id)
        AND public.governance_proposal_meets_verifier_federation_distribution_gate(proposal.id)
    ),
    false
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.governance_public_audit_verifier_federation_distribution_gate(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_client_verifier_bundle(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_proposal_meets_verifier_federation_distribution_gate(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_proposal_is_execution_ready(uuid) TO authenticated;
