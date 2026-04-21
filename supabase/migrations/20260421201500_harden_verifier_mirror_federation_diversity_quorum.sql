CREATE OR REPLACE FUNCTION public.governance_public_audit_verifier_mirror_federation_diversity_summary(
  requested_batch_id uuid DEFAULT NULL,
  max_mirrors integer DEFAULT 8
)
RETURNS TABLE (
  batch_id uuid,
  required_distinct_regions integer,
  required_distinct_operators integer,
  selected_mirror_count integer,
  healthy_mirror_count integer,
  distinct_region_count integer,
  distinct_operator_count integer,
  largest_operator_mirror_count integer,
  largest_operator_share_percent numeric,
  meets_region_diversity boolean,
  meets_operator_diversity boolean
) AS $$
WITH resolved_batch AS (
  SELECT coalesce(
    requested_batch_id,
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
    now()::timestamptz AS updated_at
  WHERE NOT EXISTS (SELECT 1 FROM failover_policy)
),
effective_failover_policy AS (
  SELECT * FROM failover_policy
  UNION ALL
  SELECT * FROM fallback_failover_policy
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
healthy_selected_mirrors AS (
  SELECT *
  FROM selected_mirrors
  WHERE health_status = 'healthy'
),
operator_counts AS (
  SELECT
    coalesce(nullif(btrim(coalesce(mirror.operator_label, '')), ''), 'unspecified') AS operator_label,
    count(*)::integer AS operator_mirror_count
  FROM healthy_selected_mirrors AS mirror
  GROUP BY coalesce(nullif(btrim(coalesce(mirror.operator_label, '')), ''), 'unspecified')
),
counts AS (
  SELECT
    coalesce((SELECT count(*)::integer FROM selected_mirrors), 0) AS selected_mirror_count,
    coalesce((SELECT count(*)::integer FROM healthy_selected_mirrors), 0) AS healthy_mirror_count,
    coalesce((SELECT count(DISTINCT upper(coalesce(nullif(btrim(coalesce(mirror.region_code, '')), ''), 'GLOBAL')))::integer FROM healthy_selected_mirrors AS mirror), 0) AS distinct_region_count,
    coalesce((SELECT count(DISTINCT coalesce(nullif(btrim(coalesce(mirror.operator_label, '')), ''), 'unspecified'))::integer FROM healthy_selected_mirrors AS mirror), 0) AS distinct_operator_count,
    coalesce((SELECT max(operator_counts.operator_mirror_count) FROM operator_counts), 0) AS largest_operator_mirror_count
)
SELECT
  resolved_batch.batch_id,
  greatest(1, coalesce((SELECT required_distinct_regions FROM effective_failover_policy LIMIT 1), 1)) AS required_distinct_regions,
  greatest(1, coalesce((SELECT required_distinct_operators FROM effective_failover_policy LIMIT 1), 1)) AS required_distinct_operators,
  counts.selected_mirror_count,
  counts.healthy_mirror_count,
  counts.distinct_region_count,
  counts.distinct_operator_count,
  counts.largest_operator_mirror_count,
  CASE
    WHEN counts.healthy_mirror_count <= 0 THEN 0::numeric
    ELSE round((counts.largest_operator_mirror_count::numeric * 100.0) / counts.healthy_mirror_count::numeric, 2)
  END AS largest_operator_share_percent,
  counts.distinct_region_count >= greatest(1, coalesce((SELECT required_distinct_regions FROM effective_failover_policy LIMIT 1), 1)) AS meets_region_diversity,
  counts.distinct_operator_count >= greatest(1, coalesce((SELECT required_distinct_operators FROM effective_failover_policy LIMIT 1), 1)) AS meets_operator_diversity
FROM resolved_batch
CROSS JOIN counts;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS public.governance_public_audit_client_verifier_bundle(uuid, integer);
CREATE FUNCTION public.governance_public_audit_client_verifier_bundle(
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
    digest(
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
  ) AS quorum_met
FROM payload_cte
CROSS JOIN healthy_mirror_count_cte;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.governance_public_audit_verifier_mirror_federation_diversity_summary(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_client_verifier_bundle(uuid, integer) TO authenticated;
