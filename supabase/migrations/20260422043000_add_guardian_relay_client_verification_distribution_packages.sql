CREATE TABLE IF NOT EXISTS public.governance_proposal_client_verification_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.governance_proposals(id) ON DELETE CASCADE,
  package_scope text NOT NULL,
  package_version text NOT NULL,
  package_hash text NOT NULL,
  package_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_manifest_id uuid NOT NULL REFERENCES public.governance_proposal_client_verification_manifests(id) ON DELETE CASCADE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  captured_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_proposal_client_verification_packages_scope_not_empty_check CHECK (length(trim(package_scope)) > 0),
  CONSTRAINT governance_proposal_client_verification_packages_version_not_empty_check CHECK (length(trim(package_version)) > 0),
  CONSTRAINT governance_proposal_client_verification_packages_hash_not_empty_check CHECK (length(trim(package_hash)) > 0),
  CONSTRAINT governance_proposal_client_verification_packages_payload_object_check CHECK (jsonb_typeof(package_payload) = 'object'),
  CONSTRAINT governance_proposal_client_verification_packages_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT governance_proposal_client_verification_packages_scope_enum_check CHECK (
    package_scope IN ('guardian_relay_quorum_client_proof_distribution')
  ),
  CONSTRAINT governance_proposal_client_verification_packages_unique_hash UNIQUE (proposal_id, package_scope, package_hash)
);

CREATE INDEX IF NOT EXISTS idx_governance_proposal_client_verification_packages_proposal_scope
  ON public.governance_proposal_client_verification_packages (proposal_id, package_scope, captured_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_proposal_client_verification_packages_manifest
  ON public.governance_proposal_client_verification_packages (source_manifest_id, captured_at DESC, created_at DESC);

DO $$
BEGIN
  CREATE TRIGGER update_governance_proposal_client_verification_packages_updated_at
    BEFORE UPDATE ON public.governance_proposal_client_verification_packages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.prevent_governance_proposal_client_verification_package_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Client verification packages are append-only';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS prevent_governance_proposal_client_verification_packages_update_trigger
ON public.governance_proposal_client_verification_packages;
CREATE TRIGGER prevent_governance_proposal_client_verification_packages_update_trigger
  BEFORE UPDATE ON public.governance_proposal_client_verification_packages
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_governance_proposal_client_verification_package_mutation();

DROP TRIGGER IF EXISTS prevent_governance_proposal_client_verification_packages_delete_trigger
ON public.governance_proposal_client_verification_packages;
CREATE TRIGGER prevent_governance_proposal_client_verification_packages_delete_trigger
  BEFORE DELETE ON public.governance_proposal_client_verification_packages
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_governance_proposal_client_verification_package_mutation();

CREATE TABLE IF NOT EXISTS public.governance_proposal_client_verification_package_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.governance_proposal_client_verification_packages(id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL REFERENCES public.governance_proposals(id) ON DELETE CASCADE,
  package_scope text NOT NULL,
  signer_key text NOT NULL,
  signature_algorithm text NOT NULL,
  signature text NOT NULL,
  signer_trust_domain text NOT NULL DEFAULT 'public',
  signer_jurisdiction_country_code text,
  signer_identity_uri text,
  distribution_channel text NOT NULL DEFAULT 'primary',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  signed_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_proposal_client_verification_package_signatures_scope_check CHECK (
    package_scope IN ('guardian_relay_quorum_client_proof_distribution')
  ),
  CONSTRAINT governance_proposal_client_verification_package_signatures_signer_key_check CHECK (length(trim(signer_key)) > 0),
  CONSTRAINT governance_proposal_client_verification_package_signatures_algorithm_check CHECK (length(trim(signature_algorithm)) > 0),
  CONSTRAINT governance_proposal_client_verification_package_signatures_signature_check CHECK (length(trim(signature)) > 0),
  CONSTRAINT governance_proposal_client_verification_package_signatures_trust_domain_check CHECK (length(trim(signer_trust_domain)) > 0),
  CONSTRAINT governance_proposal_client_verification_package_signatures_jurisdiction_check CHECK (
    signer_jurisdiction_country_code IS NULL
    OR length(trim(signer_jurisdiction_country_code)) = 2
  ),
  CONSTRAINT governance_proposal_client_verification_package_signatures_channel_check CHECK (length(trim(distribution_channel)) > 0),
  CONSTRAINT governance_proposal_client_verification_package_signatures_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT governance_proposal_client_verification_package_signatures_unique_signature UNIQUE (package_id, signer_key, signature)
);

CREATE INDEX IF NOT EXISTS idx_governance_proposal_client_verification_package_signatures_package
  ON public.governance_proposal_client_verification_package_signatures (package_id, signed_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_proposal_client_verification_package_signatures_proposal_scope
  ON public.governance_proposal_client_verification_package_signatures (proposal_id, package_scope, signed_at DESC, created_at DESC);

DO $$
BEGIN
  CREATE TRIGGER update_governance_proposal_client_verification_package_signatures_updated_at
    BEFORE UPDATE ON public.governance_proposal_client_verification_package_signatures
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.prevent_governance_proposal_client_verification_package_signature_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Client verification package signatures are append-only';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS prevent_governance_proposal_client_verification_package_signatures_update_trigger
ON public.governance_proposal_client_verification_package_signatures;
CREATE TRIGGER prevent_governance_proposal_client_verification_package_signatures_update_trigger
  BEFORE UPDATE ON public.governance_proposal_client_verification_package_signatures
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_governance_proposal_client_verification_package_signature_mutation();

DROP TRIGGER IF EXISTS prevent_governance_proposal_client_verification_package_signatures_delete_trigger
ON public.governance_proposal_client_verification_package_signatures;
CREATE TRIGGER prevent_governance_proposal_client_verification_package_signatures_delete_trigger
  BEFORE DELETE ON public.governance_proposal_client_verification_package_signatures
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_governance_proposal_client_verification_package_signature_mutation();

CREATE OR REPLACE FUNCTION public.governance_proposal_guardian_relay_client_verification_package(
  target_proposal_id uuid
)
RETURNS TABLE (
  package_version text,
  package_hash text,
  package_payload jsonb,
  source_manifest_id uuid,
  source_manifest_hash text,
  trust_minimized_quorum_met boolean,
  relay_ops_ready boolean
) AS $$
WITH source_manifest AS (
  SELECT
    manifest.id AS source_manifest_id,
    manifest.manifest_version,
    manifest.manifest_hash,
    manifest.manifest_payload
  FROM public.governance_proposal_client_verification_manifests AS manifest
  WHERE manifest.proposal_id = target_proposal_id
    AND manifest.manifest_scope = 'guardian_relay_quorum_client_proof'
  ORDER BY manifest.captured_at DESC, manifest.created_at DESC, manifest.id DESC
  LIMIT 1
),
package_payload_cte AS (
  SELECT jsonb_build_object(
    'package_version', 'guardian_relay_client_verification_package_v1',
    'proposal_id', target_proposal_id,
    'manifest_scope', 'guardian_relay_quorum_client_proof',
    'manifest_id', source_manifest.source_manifest_id,
    'manifest_version', source_manifest.manifest_version,
    'manifest_hash', source_manifest.manifest_hash,
    'manifest_payload', source_manifest.manifest_payload
  ) AS package_payload
  FROM source_manifest
)
SELECT
  'guardian_relay_client_verification_package_v1'::text AS package_version,
  encode(
    digest(
      (package_payload_cte.package_payload::text)::bytea,
      'sha256'
    ),
    'hex'
  ) AS package_hash,
  package_payload_cte.package_payload,
  source_manifest.source_manifest_id,
  source_manifest.manifest_hash AS source_manifest_hash,
  coalesce((source_manifest.manifest_payload #>> '{trust_summary,trust_minimized_quorum_met}')::boolean, false) AS trust_minimized_quorum_met,
  coalesce((source_manifest.manifest_payload #>> '{relay_operations,relay_ops_ready}')::boolean, false) AS relay_ops_ready
FROM source_manifest
CROSS JOIN package_payload_cte;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.capture_governance_proposal_guardian_relay_client_verification_package(
  target_proposal_id uuid,
  package_notes text DEFAULT NULL,
  package_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  package_record record;
  inserted_id uuid;
BEGIN
  IF NOT public.current_profile_can_manage_guardian_relays() THEN
    RAISE EXCEPTION 'Current profile is not authorized to capture guardian relay verification packages';
  END IF;

  SELECT *
  INTO package_record
  FROM public.governance_proposal_guardian_relay_client_verification_package(target_proposal_id)
  LIMIT 1;

  IF package_record.package_hash IS NULL OR package_record.source_manifest_id IS NULL THEN
    RAISE EXCEPTION 'Could not generate guardian relay client verification package';
  END IF;

  INSERT INTO public.governance_proposal_client_verification_packages (
    proposal_id,
    package_scope,
    package_version,
    package_hash,
    package_payload,
    source_manifest_id,
    metadata,
    captured_by,
    captured_at
  )
  VALUES (
    target_proposal_id,
    'guardian_relay_quorum_client_proof_distribution',
    package_record.package_version,
    package_record.package_hash,
    coalesce(package_record.package_payload, '{}'::jsonb),
    package_record.source_manifest_id,
    coalesce(package_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'source', 'capture_governance_proposal_guardian_relay_client_verification_package',
        'notes', nullif(btrim(coalesce(package_notes, '')), ''),
        'trust_minimized_quorum_met', coalesce(package_record.trust_minimized_quorum_met, false),
        'relay_ops_ready', coalesce(package_record.relay_ops_ready, false)
      ),
    public.current_profile_id(),
    now()
  )
  ON CONFLICT (proposal_id, package_scope, package_hash) DO NOTHING
  RETURNING id INTO inserted_id;

  IF inserted_id IS NULL THEN
    SELECT package.id
    INTO inserted_id
    FROM public.governance_proposal_client_verification_packages AS package
    WHERE package.proposal_id = target_proposal_id
      AND package.package_scope = 'guardian_relay_quorum_client_proof_distribution'
      AND package.package_hash = package_record.package_hash
    ORDER BY package.captured_at DESC, package.created_at DESC, package.id DESC
    LIMIT 1;
  END IF;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.sign_governance_proposal_guardian_relay_client_verification_package(
  target_package_id uuid,
  signer_key text,
  signature text,
  signature_algorithm text DEFAULT 'ed25519',
  signer_trust_domain text DEFAULT 'public',
  signer_jurisdiction_country_code text DEFAULT NULL,
  signer_identity_uri text DEFAULT NULL,
  distribution_channel text DEFAULT 'primary',
  signature_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  package_record public.governance_proposal_client_verification_packages%ROWTYPE;
  inserted_id uuid;
BEGIN
  IF NOT public.current_profile_can_manage_guardian_relays() THEN
    RAISE EXCEPTION 'Current profile is not authorized to sign guardian relay verification packages';
  END IF;

  IF target_package_id IS NULL THEN
    RAISE EXCEPTION 'Target package id is required';
  END IF;

  SELECT *
  INTO package_record
  FROM public.governance_proposal_client_verification_packages AS package
  WHERE package.id = target_package_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Guardian relay verification package not found';
  END IF;

  INSERT INTO public.governance_proposal_client_verification_package_signatures (
    package_id,
    proposal_id,
    package_scope,
    signer_key,
    signature_algorithm,
    signature,
    signer_trust_domain,
    signer_jurisdiction_country_code,
    signer_identity_uri,
    distribution_channel,
    metadata,
    signed_at,
    created_by
  )
  VALUES (
    package_record.id,
    package_record.proposal_id,
    package_record.package_scope,
    btrim(coalesce(signer_key, '')),
    lower(coalesce(nullif(btrim(coalesce(signature_algorithm, '')), ''), 'ed25519')),
    btrim(coalesce(signature, '')),
    lower(coalesce(nullif(btrim(coalesce(signer_trust_domain, '')), ''), 'public')),
    nullif(upper(btrim(coalesce(signer_jurisdiction_country_code, ''))), ''),
    nullif(btrim(coalesce(signer_identity_uri, '')), ''),
    lower(coalesce(nullif(btrim(coalesce(distribution_channel, '')), ''), 'primary')),
    coalesce(signature_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'source', 'sign_governance_proposal_guardian_relay_client_verification_package',
        'signed_package_hash', package_record.package_hash
      ),
    now(),
    public.current_profile_id()
  )
  ON CONFLICT (package_id, signer_key, signature) DO NOTHING
  RETURNING id INTO inserted_id;

  IF inserted_id IS NULL THEN
    SELECT signature_row.id
    INTO inserted_id
    FROM public.governance_proposal_client_verification_package_signatures AS signature_row
    WHERE signature_row.package_id = package_record.id
      AND signature_row.signer_key = btrim(coalesce(signer_key, ''))
      AND signature_row.signature = btrim(coalesce(signature, ''))
    ORDER BY signature_row.signed_at DESC, signature_row.created_at DESC, signature_row.id DESC
    LIMIT 1;
  END IF;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_proposal_guardian_relay_recent_client_verification_packages(
  target_proposal_id uuid,
  max_packages integer DEFAULT 12
)
RETURNS TABLE (
  package_id uuid,
  captured_at timestamptz,
  package_version text,
  package_hash text,
  source_manifest_hash text,
  signature_count integer,
  distribution_ready boolean,
  package_notes text
) AS $$
WITH policy AS (
  SELECT greatest(1, coalesce(relay_policy.required_relay_attestations, 2))::integer AS required_signatures
  FROM public.governance_guardian_relay_policies AS relay_policy
  WHERE relay_policy.policy_key = 'guardian_relay_default'
  ORDER BY relay_policy.updated_at DESC, relay_policy.created_at DESC, relay_policy.id DESC
  LIMIT 1
),
effective_policy AS (
  SELECT coalesce((SELECT required_signatures FROM policy), 1)::integer AS required_signatures
)
SELECT
  package.id AS package_id,
  package.captured_at,
  package.package_version,
  package.package_hash,
  source_manifest.manifest_hash AS source_manifest_hash,
  coalesce(signature_tally.signature_count, 0) AS signature_count,
  coalesce(signature_tally.distinct_signer_count, 0) >= effective_policy.required_signatures AS distribution_ready,
  nullif(btrim(coalesce(package.metadata ->> 'notes', '')), '') AS package_notes
FROM public.governance_proposal_client_verification_packages AS package
JOIN public.governance_proposal_client_verification_manifests AS source_manifest
  ON source_manifest.id = package.source_manifest_id
LEFT JOIN LATERAL (
  SELECT
    count(*)::integer AS signature_count,
    count(DISTINCT lower(btrim(signature_row.signer_key)))::integer AS distinct_signer_count
  FROM public.governance_proposal_client_verification_package_signatures AS signature_row
  WHERE signature_row.package_id = package.id
) AS signature_tally ON true
CROSS JOIN effective_policy
WHERE package.proposal_id = target_proposal_id
  AND package.package_scope = 'guardian_relay_quorum_client_proof_distribution'
ORDER BY package.captured_at DESC, package.created_at DESC, package.id DESC
LIMIT greatest(1, coalesce(max_packages, 12));
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_proposal_guardian_relay_client_verification_distribution_summary(
  target_proposal_id uuid
)
RETURNS TABLE (
  package_id uuid,
  captured_at timestamptz,
  package_version text,
  package_hash text,
  source_manifest_hash text,
  required_distribution_signatures integer,
  signature_count integer,
  distinct_signer_count integer,
  distinct_signer_jurisdictions_count integer,
  distinct_signer_trust_domains_count integer,
  last_signed_at timestamptz,
  distribution_ready boolean
) AS $$
WITH latest_package AS (
  SELECT *
  FROM public.governance_proposal_client_verification_packages AS package
  WHERE package.proposal_id = target_proposal_id
    AND package.package_scope = 'guardian_relay_quorum_client_proof_distribution'
  ORDER BY package.captured_at DESC, package.created_at DESC, package.id DESC
  LIMIT 1
),
policy AS (
  SELECT greatest(1, coalesce(relay_policy.required_relay_attestations, 2))::integer AS required_signatures
  FROM public.governance_guardian_relay_policies AS relay_policy
  WHERE relay_policy.policy_key = 'guardian_relay_default'
  ORDER BY relay_policy.updated_at DESC, relay_policy.created_at DESC, relay_policy.id DESC
  LIMIT 1
),
effective_policy AS (
  SELECT coalesce((SELECT required_signatures FROM policy), 1)::integer AS required_signatures
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
  LEFT JOIN public.governance_proposal_client_verification_package_signatures AS signature_row
    ON signature_row.package_id = latest_package.id
  GROUP BY latest_package.id
)
SELECT
  latest_package.id AS package_id,
  latest_package.captured_at,
  latest_package.package_version,
  latest_package.package_hash,
  source_manifest.manifest_hash AS source_manifest_hash,
  effective_policy.required_signatures AS required_distribution_signatures,
  coalesce(signature_tally.signature_count, 0) AS signature_count,
  coalesce(signature_tally.distinct_signer_count, 0) AS distinct_signer_count,
  coalesce(signature_tally.distinct_signer_jurisdictions_count, 0) AS distinct_signer_jurisdictions_count,
  coalesce(signature_tally.distinct_signer_trust_domains_count, 0) AS distinct_signer_trust_domains_count,
  signature_tally.last_signed_at,
  coalesce(signature_tally.distinct_signer_count, 0) >= effective_policy.required_signatures AS distribution_ready
FROM latest_package
JOIN public.governance_proposal_client_verification_manifests AS source_manifest
  ON source_manifest.id = latest_package.source_manifest_id
LEFT JOIN signature_tally
  ON signature_tally.package_id = latest_package.id
CROSS JOIN effective_policy;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_proposal_guardian_relay_client_verification_signature_board(
  target_proposal_id uuid,
  max_entries integer DEFAULT 40
)
RETURNS TABLE (
  signature_id uuid,
  package_id uuid,
  package_hash text,
  signer_key text,
  signature_algorithm text,
  distribution_channel text,
  signer_trust_domain text,
  signer_jurisdiction_country_code text,
  signed_at timestamptz
) AS $$
WITH latest_package AS (
  SELECT *
  FROM public.governance_proposal_client_verification_packages AS package
  WHERE package.proposal_id = target_proposal_id
    AND package.package_scope = 'guardian_relay_quorum_client_proof_distribution'
  ORDER BY package.captured_at DESC, package.created_at DESC, package.id DESC
  LIMIT 1
)
SELECT
  signature_row.id AS signature_id,
  latest_package.id AS package_id,
  latest_package.package_hash,
  signature_row.signer_key,
  signature_row.signature_algorithm,
  signature_row.distribution_channel,
  signature_row.signer_trust_domain,
  signature_row.signer_jurisdiction_country_code,
  signature_row.signed_at
FROM latest_package
JOIN public.governance_proposal_client_verification_package_signatures AS signature_row
  ON signature_row.package_id = latest_package.id
ORDER BY signature_row.signed_at DESC, signature_row.created_at DESC, signature_row.id DESC
LIMIT greatest(1, coalesce(max_entries, 40));
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

GRANT SELECT, INSERT ON public.governance_proposal_client_verification_packages TO authenticated;
GRANT SELECT, INSERT ON public.governance_proposal_client_verification_package_signatures TO authenticated;

GRANT EXECUTE ON FUNCTION public.governance_proposal_guardian_relay_client_verification_package(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.capture_governance_proposal_guardian_relay_client_verification_package(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sign_governance_proposal_guardian_relay_client_verification_package(uuid, text, text, text, text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_proposal_guardian_relay_recent_client_verification_packages(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_proposal_guardian_relay_client_verification_distribution_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_proposal_guardian_relay_client_verification_signature_board(uuid, integer) TO authenticated;

ALTER TABLE public.governance_proposal_client_verification_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_proposal_client_verification_package_signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Guardian client verification packages are readable by authenticated users"
ON public.governance_proposal_client_verification_packages;
CREATE POLICY "Guardian client verification packages are readable by authenticated users"
ON public.governance_proposal_client_verification_packages
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Guardian client verification packages are capturable by relay stewards"
ON public.governance_proposal_client_verification_packages;
CREATE POLICY "Guardian client verification packages are capturable by relay stewards"
ON public.governance_proposal_client_verification_packages
  FOR INSERT WITH CHECK (public.current_profile_can_manage_guardian_relays());

DROP POLICY IF EXISTS "Guardian client verification package signatures are readable by authenticated users"
ON public.governance_proposal_client_verification_package_signatures;
CREATE POLICY "Guardian client verification package signatures are readable by authenticated users"
ON public.governance_proposal_client_verification_package_signatures
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Guardian client verification package signatures are signable by relay stewards"
ON public.governance_proposal_client_verification_package_signatures;
CREATE POLICY "Guardian client verification package signatures are signable by relay stewards"
ON public.governance_proposal_client_verification_package_signatures
  FOR INSERT WITH CHECK (public.current_profile_can_manage_guardian_relays());
