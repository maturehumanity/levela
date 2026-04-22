ALTER TABLE public.governance_public_audit_verifier_mirror_failover_policies
  ADD COLUMN IF NOT EXISTS min_independent_directory_signers integer NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gpav_mirror_failover_min_ind_dir_signers_chk'
  ) THEN
    ALTER TABLE public.governance_public_audit_verifier_mirror_failover_policies
      ADD CONSTRAINT gpav_mirror_failover_min_ind_dir_signers_chk
      CHECK (min_independent_directory_signers >= 1);
  END IF;
END $$;

UPDATE public.governance_public_audit_verifier_mirror_failover_policies
SET min_independent_directory_signers = greatest(1, coalesce(min_independent_directory_signers, 1));

CREATE TABLE IF NOT EXISTS public.governance_public_audit_verifier_mirror_directory_attestations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  directory_id uuid NOT NULL REFERENCES public.governance_public_audit_verifier_mirror_directories(id) ON DELETE CASCADE,
  signer_id uuid NOT NULL REFERENCES public.governance_public_audit_verifier_mirror_directory_signers(id) ON DELETE RESTRICT,
  signer_key text NOT NULL,
  attestation_decision text NOT NULL,
  attestation_signature text NOT NULL,
  attestation_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  attested_at timestamptz NOT NULL DEFAULT now(),
  attested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gpav_mirror_dir_attest_signer_key_chk CHECK (length(trim(signer_key)) > 0),
  CONSTRAINT gpav_mirror_dir_attest_decision_chk CHECK (
    attestation_decision IN ('approve', 'reject')
  ),
  CONSTRAINT gpav_mirror_dir_attest_sig_chk CHECK (length(trim(attestation_signature)) > 0),
  CONSTRAINT gpav_mirror_dir_attest_payload_chk CHECK (jsonb_typeof(attestation_payload) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_governance_public_audit_verifier_mirror_directory_attestations_unique
  ON public.governance_public_audit_verifier_mirror_directory_attestations (directory_id, signer_id);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_verifier_mirror_directory_attestations_directory
  ON public.governance_public_audit_verifier_mirror_directory_attestations (directory_id, attested_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_verifier_mirror_directory_attestations_signer
  ON public.governance_public_audit_verifier_mirror_directory_attestations (signer_id, attested_at DESC, created_at DESC);

DO $$
BEGIN
  CREATE TRIGGER update_governance_public_audit_verifier_mirror_directory_attestations_updated_at
    BEFORE UPDATE ON public.governance_public_audit_verifier_mirror_directory_attestations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.set_governance_public_audit_verifier_mirror_min_independent_signers(
  requested_policy_key text DEFAULT 'default',
  required_signer_count integer DEFAULT 1
)
RETURNS uuid AS $$
DECLARE
  resolved_id uuid;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to manage verifier mirror failover policies';
  END IF;

  UPDATE public.governance_public_audit_verifier_mirror_failover_policies
  SET
    min_independent_directory_signers = greatest(1, coalesce(required_signer_count, 1)),
    updated_by = public.current_profile_id(),
    updated_at = now()
  WHERE policy_key = lower(coalesce(nullif(btrim(coalesce(requested_policy_key, '')), ''), 'default'))
  RETURNING id INTO resolved_id;

  IF resolved_id IS NULL THEN
    INSERT INTO public.governance_public_audit_verifier_mirror_failover_policies (
      policy_key,
      policy_name,
      is_active,
      min_healthy_mirrors,
      max_mirror_latency_ms,
      max_failures_before_cooldown,
      cooldown_minutes,
      prefer_same_region,
      required_distinct_regions,
      required_distinct_operators,
      mirror_selection_strategy,
      max_mirror_candidates,
      min_independent_directory_signers,
      metadata,
      created_by,
      updated_by
    )
    VALUES (
      lower(coalesce(nullif(btrim(coalesce(requested_policy_key, '')), ''), 'default')),
      'Default mirror failover policy',
      true,
      1,
      2500,
      2,
      10,
      false,
      1,
      1,
      'health_latency_diversity',
      8,
      greatest(1, coalesce(required_signer_count, 1)),
      jsonb_build_object('source', 'set_governance_public_audit_verifier_mirror_min_independent_signers'),
      public.current_profile_id(),
      public.current_profile_id()
    )
    RETURNING id INTO resolved_id;
  END IF;

  RETURN resolved_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.record_governance_public_audit_verifier_mirror_directory_attestation(
  target_directory_id uuid,
  signer_key text,
  attestation_decision text,
  attestation_signature text,
  attestation_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  resolved_signer public.governance_public_audit_verifier_mirror_directory_signers%ROWTYPE;
  inserted_id uuid;
  normalized_decision text;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to record mirror directory attestations';
  END IF;

  IF target_directory_id IS NULL THEN
    RAISE EXCEPTION 'Target directory is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.governance_public_audit_verifier_mirror_directories AS directory
    WHERE directory.id = target_directory_id
  ) THEN
    RAISE EXCEPTION 'Verifier mirror directory not found';
  END IF;

  SELECT *
  INTO resolved_signer
  FROM public.governance_public_audit_verifier_mirror_directory_signers AS signer
  WHERE signer.signer_key = btrim(coalesce(signer_key, ''))
    AND signer.is_active = true
  ORDER BY signer.updated_at DESC, signer.created_at DESC, signer.id DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Verifier mirror directory signer not found or inactive';
  END IF;

  normalized_decision := lower(btrim(coalesce(attestation_decision, '')));
  IF normalized_decision NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Attestation decision must be approve or reject';
  END IF;

  INSERT INTO public.governance_public_audit_verifier_mirror_directory_attestations (
    directory_id,
    signer_id,
    signer_key,
    attestation_decision,
    attestation_signature,
    attestation_payload,
    attested_at,
    attested_by
  )
  VALUES (
    target_directory_id,
    resolved_signer.id,
    resolved_signer.signer_key,
    normalized_decision,
    btrim(coalesce(attestation_signature, '')),
    coalesce(attestation_payload, '{}'::jsonb),
    now(),
    public.current_profile_id()
  )
  ON CONFLICT (directory_id, signer_id) DO UPDATE
    SET signer_key = excluded.signer_key,
        attestation_decision = excluded.attestation_decision,
        attestation_signature = excluded.attestation_signature,
        attestation_payload = excluded.attestation_payload,
        attested_at = now(),
        attested_by = public.current_profile_id()
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS public.governance_public_audit_verifier_mirror_failover_policy_summary(text);
CREATE FUNCTION public.governance_public_audit_verifier_mirror_failover_policy_summary(
  requested_policy_key text DEFAULT 'default'
)
RETURNS TABLE (
  policy_id uuid,
  policy_key text,
  policy_name text,
  is_active boolean,
  min_healthy_mirrors integer,
  max_mirror_latency_ms integer,
  max_failures_before_cooldown integer,
  cooldown_minutes integer,
  prefer_same_region boolean,
  required_distinct_regions integer,
  required_distinct_operators integer,
  mirror_selection_strategy text,
  max_mirror_candidates integer,
  min_independent_directory_signers integer,
  updated_at timestamptz
) AS $$
SELECT
  policy.id AS policy_id,
  policy.policy_key,
  policy.policy_name,
  policy.is_active,
  policy.min_healthy_mirrors,
  policy.max_mirror_latency_ms,
  policy.max_failures_before_cooldown,
  policy.cooldown_minutes,
  policy.prefer_same_region,
  policy.required_distinct_regions,
  policy.required_distinct_operators,
  policy.mirror_selection_strategy,
  policy.max_mirror_candidates,
  policy.min_independent_directory_signers,
  policy.updated_at
FROM public.governance_public_audit_verifier_mirror_failover_policies AS policy
WHERE policy.policy_key = lower(coalesce(nullif(btrim(coalesce(requested_policy_key, '')), ''), 'default'))
ORDER BY policy.updated_at DESC, policy.created_at DESC, policy.id DESC
LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_public_audit_verifier_mirror_directory_trust_summary(
  requested_batch_id uuid DEFAULT NULL
)
RETURNS TABLE (
  directory_id uuid,
  batch_id uuid,
  directory_hash text,
  published_at timestamptz,
  required_independent_signers integer,
  approval_count integer,
  independent_approval_count integer,
  community_approval_count integer,
  reject_count integer,
  trust_quorum_met boolean
) AS $$
WITH policy AS (
  SELECT
    greatest(1, coalesce(failover.min_independent_directory_signers, 1))::integer AS required_independent_signers
  FROM public.governance_public_audit_verifier_mirror_failover_policies AS failover
  WHERE failover.policy_key = 'default'
  ORDER BY failover.updated_at DESC, failover.created_at DESC, failover.id DESC
  LIMIT 1
),
latest_directory AS (
  SELECT
    directory.id,
    directory.batch_id,
    directory.directory_hash,
    directory.published_at
  FROM public.governance_public_audit_verifier_mirror_directories AS directory
  WHERE requested_batch_id IS NULL
     OR directory.batch_id = requested_batch_id
  ORDER BY directory.published_at DESC, directory.created_at DESC, directory.id DESC
  LIMIT 1
),
attestations AS (
  SELECT
    attestation.attestation_decision,
    signer.trust_tier
  FROM latest_directory
  LEFT JOIN public.governance_public_audit_verifier_mirror_directory_attestations AS attestation
    ON attestation.directory_id = latest_directory.id
  LEFT JOIN public.governance_public_audit_verifier_mirror_directory_signers AS signer
    ON signer.id = attestation.signer_id
)
SELECT
  latest_directory.id AS directory_id,
  latest_directory.batch_id,
  latest_directory.directory_hash,
  latest_directory.published_at,
  coalesce((SELECT policy.required_independent_signers FROM policy), 1) AS required_independent_signers,
  coalesce(count(*) FILTER (WHERE attestations.attestation_decision = 'approve'), 0)::integer AS approval_count,
  coalesce(count(*) FILTER (
    WHERE attestations.attestation_decision = 'approve'
      AND coalesce(attestations.trust_tier, 'observer') = 'independent'
  ), 0)::integer AS independent_approval_count,
  coalesce(count(*) FILTER (
    WHERE attestations.attestation_decision = 'approve'
      AND coalesce(attestations.trust_tier, 'observer') = 'community'
  ), 0)::integer AS community_approval_count,
  coalesce(count(*) FILTER (WHERE attestations.attestation_decision = 'reject'), 0)::integer AS reject_count,
  (
    coalesce(count(*) FILTER (
      WHERE attestations.attestation_decision = 'approve'
        AND coalesce(attestations.trust_tier, 'observer') = 'independent'
    ), 0)
      >= coalesce((SELECT policy.required_independent_signers FROM policy), 1)
    AND coalesce(count(*) FILTER (WHERE attestations.attestation_decision = 'approve'), 0) > 0
  ) AS trust_quorum_met
FROM latest_directory
LEFT JOIN attestations ON true
GROUP BY latest_directory.id, latest_directory.batch_id, latest_directory.directory_hash, latest_directory.published_at;
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
    AND coalesce((payload_cte.bundle_payload #>> '{signed_directory_trust,trust_quorum_met}')::boolean, false)
  ) AS quorum_met
FROM payload_cte
CROSS JOIN healthy_mirror_count_cte;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

GRANT SELECT, INSERT, UPDATE ON public.governance_public_audit_verifier_mirror_directory_attestations TO authenticated;

GRANT EXECUTE ON FUNCTION public.set_governance_public_audit_verifier_mirror_min_independent_signers(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_governance_public_audit_verifier_mirror_directory_attestation(uuid, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_verifier_mirror_failover_policy_summary(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_verifier_mirror_directory_trust_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_client_verifier_bundle(uuid, integer) TO authenticated;

ALTER TABLE public.governance_public_audit_verifier_mirror_directory_attestations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Verifier mirror directory attestations are readable by authenticated users" ON public.governance_public_audit_verifier_mirror_directory_attestations;
CREATE POLICY "Verifier mirror directory attestations are readable by authenticated users" ON public.governance_public_audit_verifier_mirror_directory_attestations
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Verifier mirror directory attestations are manageable by verifier stewards" ON public.governance_public_audit_verifier_mirror_directory_attestations;
CREATE POLICY "Verifier mirror directory attestations are manageable by verifier stewards" ON public.governance_public_audit_verifier_mirror_directory_attestations
  FOR ALL USING (public.current_profile_can_manage_public_audit_verifiers())
  WITH CHECK (public.current_profile_can_manage_public_audit_verifiers());
