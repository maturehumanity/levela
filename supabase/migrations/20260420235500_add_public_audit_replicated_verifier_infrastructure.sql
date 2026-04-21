DO $$
BEGIN
  CREATE TYPE public.governance_public_audit_verification_status AS ENUM (
    'verified',
    'mismatch',
    'unreachable'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.governance_public_audit_replication_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key text NOT NULL UNIQUE,
  policy_name text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  required_verified_count integer NOT NULL DEFAULT 2,
  required_network_proof_count integer NOT NULL DEFAULT 1,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_public_audit_replication_policies_policy_key_not_empty CHECK (length(trim(policy_key)) > 0),
  CONSTRAINT governance_public_audit_replication_policies_policy_name_not_empty CHECK (length(trim(policy_name)) > 0),
  CONSTRAINT governance_public_audit_replication_policies_required_verified_count_check CHECK (required_verified_count >= 1),
  CONSTRAINT governance_public_audit_replication_policies_required_network_proof_count_check CHECK (required_network_proof_count >= 0),
  CONSTRAINT governance_public_audit_replication_policies_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE IF NOT EXISTS public.governance_public_audit_verifier_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verifier_key text NOT NULL UNIQUE,
  verifier_label text,
  endpoint_url text,
  key_algorithm text NOT NULL DEFAULT 'ECDSA_P256_SHA256_V1',
  is_active boolean NOT NULL DEFAULT true,
  added_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_public_audit_verifier_nodes_verifier_key_not_empty CHECK (length(trim(verifier_key)) > 0),
  CONSTRAINT governance_public_audit_verifier_nodes_key_algorithm_not_empty CHECK (length(trim(key_algorithm)) > 0),
  CONSTRAINT governance_public_audit_verifier_nodes_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE IF NOT EXISTS public.governance_public_audit_batch_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.governance_public_audit_batches(id) ON DELETE CASCADE,
  verifier_id uuid NOT NULL REFERENCES public.governance_public_audit_verifier_nodes(id) ON DELETE CASCADE,
  status public.governance_public_audit_verification_status NOT NULL,
  verification_hash text,
  proof_reference text,
  proof_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  verified_at timestamptz NOT NULL DEFAULT now(),
  verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_public_audit_batch_verifications_hash_not_empty CHECK (verification_hash IS NULL OR length(trim(verification_hash)) > 0),
  CONSTRAINT governance_public_audit_batch_verifications_reference_not_empty CHECK (proof_reference IS NULL OR length(trim(proof_reference)) > 0),
  CONSTRAINT governance_public_audit_batch_verifications_payload_object_check CHECK (jsonb_typeof(proof_payload) = 'object'),
  CONSTRAINT governance_public_audit_batch_verifications_unique_verifier UNIQUE (batch_id, verifier_id)
);

CREATE TABLE IF NOT EXISTS public.governance_public_audit_network_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.governance_public_audit_batches(id) ON DELETE CASCADE,
  network text NOT NULL,
  proof_reference text NOT NULL,
  proof_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  block_height bigint,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_public_audit_network_proofs_network_not_empty CHECK (length(trim(network)) > 0),
  CONSTRAINT governance_public_audit_network_proofs_reference_not_empty CHECK (length(trim(proof_reference)) > 0),
  CONSTRAINT governance_public_audit_network_proofs_block_height_check CHECK (block_height IS NULL OR block_height >= 0),
  CONSTRAINT governance_public_audit_network_proofs_payload_object_check CHECK (jsonb_typeof(proof_payload) = 'object'),
  CONSTRAINT governance_public_audit_network_proofs_unique_ref UNIQUE (batch_id, network, proof_reference)
);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_verifier_nodes_active
  ON public.governance_public_audit_verifier_nodes (is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_batch_verifications_batch
  ON public.governance_public_audit_batch_verifications (batch_id, verified_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_batch_verifications_verifier
  ON public.governance_public_audit_batch_verifications (verifier_id, verified_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_network_proofs_batch
  ON public.governance_public_audit_network_proofs (batch_id, recorded_at DESC, created_at DESC);

DO $$
BEGIN
  CREATE TRIGGER update_governance_public_audit_replication_policies_updated_at
    BEFORE UPDATE ON public.governance_public_audit_replication_policies
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_governance_public_audit_verifier_nodes_updated_at
    BEFORE UPDATE ON public.governance_public_audit_verifier_nodes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_governance_public_audit_batch_verifications_updated_at
    BEFORE UPDATE ON public.governance_public_audit_batch_verifications
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_governance_public_audit_network_proofs_updated_at
    BEFORE UPDATE ON public.governance_public_audit_network_proofs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.current_profile_can_manage_public_audit_verifiers()
RETURNS boolean AS $$
  SELECT coalesce(
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.current_profile_in_governance_domain(ARRAY['constitutional_review', 'technical_stewardship', 'security_incident_response']),
    false
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.register_governance_public_audit_verifier_node(
  verifier_key text,
  verifier_label text DEFAULT NULL,
  endpoint_url text DEFAULT NULL,
  key_algorithm text DEFAULT 'ECDSA_P256_SHA256_V1',
  metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  inserted_id uuid;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to manage public audit verifier nodes';
  END IF;

  INSERT INTO public.governance_public_audit_verifier_nodes (
    verifier_key,
    verifier_label,
    endpoint_url,
    key_algorithm,
    added_by,
    metadata
  )
  VALUES (
    btrim(coalesce(verifier_key, '')),
    nullif(btrim(coalesce(verifier_label, '')), ''),
    nullif(btrim(coalesce(endpoint_url, '')), ''),
    upper(btrim(coalesce(key_algorithm, 'ECDSA_P256_SHA256_V1'))),
    public.current_profile_id(),
    coalesce(metadata, '{}'::jsonb)
  )
  ON CONFLICT (verifier_key) DO UPDATE
    SET verifier_label = excluded.verifier_label,
        endpoint_url = excluded.endpoint_url,
        key_algorithm = excluded.key_algorithm,
        metadata = coalesce(public.governance_public_audit_verifier_nodes.metadata, '{}'::jsonb) || coalesce(excluded.metadata, '{}'::jsonb),
        is_active = true
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.record_governance_public_audit_batch_verification(
  target_batch_id uuid,
  target_verifier_id uuid,
  verification_status public.governance_public_audit_verification_status,
  verification_hash text DEFAULT NULL,
  proof_reference text DEFAULT NULL,
  proof_payload jsonb DEFAULT '{}'::jsonb,
  verified_at timestamptz DEFAULT now()
)
RETURNS uuid AS $$
DECLARE
  verification_id uuid;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to record public audit verifier results';
  END IF;

  IF target_batch_id IS NULL OR target_verifier_id IS NULL THEN
    RAISE EXCEPTION 'Batch id and verifier id are required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.governance_public_audit_batches AS batch
    WHERE batch.id = target_batch_id
  ) THEN
    RAISE EXCEPTION 'Public audit batch does not exist';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.governance_public_audit_verifier_nodes AS verifier
    WHERE verifier.id = target_verifier_id
      AND verifier.is_active = true
  ) THEN
    RAISE EXCEPTION 'Public audit verifier is not active';
  END IF;

  INSERT INTO public.governance_public_audit_batch_verifications (
    batch_id,
    verifier_id,
    status,
    verification_hash,
    proof_reference,
    proof_payload,
    verified_at,
    verified_by
  )
  VALUES (
    target_batch_id,
    target_verifier_id,
    verification_status,
    nullif(btrim(coalesce(verification_hash, '')), ''),
    nullif(btrim(coalesce(proof_reference, '')), ''),
    coalesce(proof_payload, '{}'::jsonb),
    coalesce(verified_at, now()),
    public.current_profile_id()
  )
  ON CONFLICT (batch_id, verifier_id) DO UPDATE
    SET status = excluded.status,
        verification_hash = excluded.verification_hash,
        proof_reference = excluded.proof_reference,
        proof_payload = excluded.proof_payload,
        verified_at = excluded.verified_at,
        verified_by = excluded.verified_by
  RETURNING id INTO verification_id;

  RETURN verification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.record_governance_public_audit_network_proof(
  target_batch_id uuid,
  proof_network text,
  proof_reference text,
  proof_payload jsonb DEFAULT '{}'::jsonb,
  proof_block_height bigint DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  proof_id uuid;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to record public audit network proofs';
  END IF;

  IF target_batch_id IS NULL THEN
    RAISE EXCEPTION 'Batch id is required';
  END IF;

  INSERT INTO public.governance_public_audit_network_proofs (
    batch_id,
    network,
    proof_reference,
    proof_payload,
    block_height,
    recorded_by,
    recorded_at
  )
  VALUES (
    target_batch_id,
    btrim(coalesce(proof_network, '')),
    btrim(coalesce(proof_reference, '')),
    coalesce(proof_payload, '{}'::jsonb),
    proof_block_height,
    public.current_profile_id(),
    now()
  )
  ON CONFLICT (batch_id, network, proof_reference) DO UPDATE
    SET proof_payload = excluded.proof_payload,
        block_height = excluded.block_height,
        recorded_by = excluded.recorded_by,
        recorded_at = excluded.recorded_at
  RETURNING id INTO proof_id;

  RETURN proof_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_public_audit_batch_verifier_summary(
  target_batch_id uuid
)
RETURNS TABLE (
  policy_enabled boolean,
  required_verified_count integer,
  required_network_proof_count integer,
  active_verifier_count integer,
  verified_count integer,
  mismatch_count integer,
  unreachable_count integer,
  network_proof_count integer,
  meets_replication_threshold boolean
) AS $$
WITH policy AS (
  SELECT
    coalesce(replication_policy.is_enabled, true) AS policy_enabled,
    greatest(1, coalesce(replication_policy.required_verified_count, 2)) AS required_verified_count,
    greatest(0, coalesce(replication_policy.required_network_proof_count, 1)) AS required_network_proof_count
  FROM public.governance_public_audit_replication_policies AS replication_policy
  WHERE replication_policy.policy_key = 'public_audit_replication_default'
  ORDER BY replication_policy.updated_at DESC, replication_policy.created_at DESC, replication_policy.id DESC
  LIMIT 1
),
active_verifiers AS (
  SELECT count(*)::integer AS count
  FROM public.governance_public_audit_verifier_nodes AS verifier
  WHERE verifier.is_active = true
),
verification_tally AS (
  SELECT
    coalesce(count(*) FILTER (WHERE verification.status = 'verified'::public.governance_public_audit_verification_status), 0)::integer AS verified_count,
    coalesce(count(*) FILTER (WHERE verification.status = 'mismatch'::public.governance_public_audit_verification_status), 0)::integer AS mismatch_count,
    coalesce(count(*) FILTER (WHERE verification.status = 'unreachable'::public.governance_public_audit_verification_status), 0)::integer AS unreachable_count
  FROM public.governance_public_audit_batch_verifications AS verification
  JOIN public.governance_public_audit_verifier_nodes AS verifier
    ON verifier.id = verification.verifier_id
  WHERE verification.batch_id = target_batch_id
    AND verifier.is_active = true
),
proof_tally AS (
  SELECT count(*)::integer AS network_proof_count
  FROM public.governance_public_audit_network_proofs AS proof
  WHERE proof.batch_id = target_batch_id
)
SELECT
  coalesce(policy.policy_enabled, true) AS policy_enabled,
  coalesce(policy.required_verified_count, 2) AS required_verified_count,
  coalesce(policy.required_network_proof_count, 1) AS required_network_proof_count,
  coalesce(active_verifiers.count, 0) AS active_verifier_count,
  coalesce(verification_tally.verified_count, 0) AS verified_count,
  coalesce(verification_tally.mismatch_count, 0) AS mismatch_count,
  coalesce(verification_tally.unreachable_count, 0) AS unreachable_count,
  coalesce(proof_tally.network_proof_count, 0) AS network_proof_count,
  CASE
    WHEN NOT coalesce(policy.policy_enabled, true) THEN true
    ELSE (
      coalesce(verification_tally.verified_count, 0) >= coalesce(policy.required_verified_count, 2)
      AND coalesce(proof_tally.network_proof_count, 0) >= coalesce(policy.required_network_proof_count, 1)
    )
  END AS meets_replication_threshold
FROM policy
FULL JOIN active_verifiers ON true
FULL JOIN verification_tally ON true
FULL JOIN proof_tally ON true;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

INSERT INTO public.governance_public_audit_replication_policies (
  policy_key,
  policy_name,
  is_enabled,
  required_verified_count,
  required_network_proof_count,
  notes,
  metadata
)
VALUES (
  'public_audit_replication_default',
  'Public Audit Replication Default Policy',
  true,
  2,
  1,
  'Require independent replicated verifier checks and public network proof references for anchored batches.',
  jsonb_build_object('source', 'bootstrap_seed')
)
ON CONFLICT (policy_key) DO NOTHING;

GRANT SELECT, INSERT, UPDATE ON public.governance_public_audit_replication_policies TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.governance_public_audit_verifier_nodes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.governance_public_audit_batch_verifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.governance_public_audit_network_proofs TO authenticated;

GRANT EXECUTE ON FUNCTION public.current_profile_can_manage_public_audit_verifiers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_governance_public_audit_verifier_node(text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_governance_public_audit_batch_verification(uuid, uuid, public.governance_public_audit_verification_status, text, text, jsonb, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_governance_public_audit_network_proof(uuid, text, text, jsonb, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_batch_verifier_summary(uuid) TO authenticated;

ALTER TABLE public.governance_public_audit_replication_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_public_audit_verifier_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_public_audit_batch_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_public_audit_network_proofs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public audit replication policies are readable by authenticated users" ON public.governance_public_audit_replication_policies;
CREATE POLICY "Public audit replication policies are readable by authenticated users" ON public.governance_public_audit_replication_policies
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Public audit replication policies are manageable by verifier stewards" ON public.governance_public_audit_replication_policies;
CREATE POLICY "Public audit replication policies are manageable by verifier stewards" ON public.governance_public_audit_replication_policies
  FOR ALL USING (public.current_profile_can_manage_public_audit_verifiers())
  WITH CHECK (public.current_profile_can_manage_public_audit_verifiers());

DROP POLICY IF EXISTS "Public audit verifier nodes are readable by authenticated users" ON public.governance_public_audit_verifier_nodes;
CREATE POLICY "Public audit verifier nodes are readable by authenticated users" ON public.governance_public_audit_verifier_nodes
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Public audit verifier nodes are manageable by verifier stewards" ON public.governance_public_audit_verifier_nodes;
CREATE POLICY "Public audit verifier nodes are manageable by verifier stewards" ON public.governance_public_audit_verifier_nodes
  FOR ALL USING (public.current_profile_can_manage_public_audit_verifiers())
  WITH CHECK (public.current_profile_can_manage_public_audit_verifiers());

DROP POLICY IF EXISTS "Public audit batch verifications are readable by authenticated users" ON public.governance_public_audit_batch_verifications;
CREATE POLICY "Public audit batch verifications are readable by authenticated users" ON public.governance_public_audit_batch_verifications
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Public audit batch verifications are manageable by verifier stewards" ON public.governance_public_audit_batch_verifications;
CREATE POLICY "Public audit batch verifications are manageable by verifier stewards" ON public.governance_public_audit_batch_verifications
  FOR ALL USING (public.current_profile_can_manage_public_audit_verifiers())
  WITH CHECK (public.current_profile_can_manage_public_audit_verifiers());

DROP POLICY IF EXISTS "Public audit network proofs are readable by authenticated users" ON public.governance_public_audit_network_proofs;
CREATE POLICY "Public audit network proofs are readable by authenticated users" ON public.governance_public_audit_network_proofs
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Public audit network proofs are manageable by verifier stewards" ON public.governance_public_audit_network_proofs;
CREATE POLICY "Public audit network proofs are manageable by verifier stewards" ON public.governance_public_audit_network_proofs
  FOR ALL USING (public.current_profile_can_manage_public_audit_verifiers())
  WITH CHECK (public.current_profile_can_manage_public_audit_verifiers());
