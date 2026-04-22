CREATE TABLE IF NOT EXISTS public.governance_public_audit_verifier_federation_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.governance_public_audit_batches(id) ON DELETE CASCADE,
  package_scope text NOT NULL,
  package_version text NOT NULL,
  package_hash text NOT NULL,
  package_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_directory_id uuid NOT NULL REFERENCES public.governance_public_audit_verifier_mirror_directories(id) ON DELETE CASCADE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  captured_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_public_audit_verifier_federation_packages_scope_not_empty_check CHECK (length(trim(package_scope)) > 0),
  CONSTRAINT governance_public_audit_verifier_federation_packages_version_not_empty_check CHECK (length(trim(package_version)) > 0),
  CONSTRAINT governance_public_audit_verifier_federation_packages_hash_not_empty_check CHECK (length(trim(package_hash)) > 0),
  CONSTRAINT governance_public_audit_verifier_federation_packages_payload_object_check CHECK (jsonb_typeof(package_payload) = 'object'),
  CONSTRAINT governance_public_audit_verifier_federation_packages_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT governance_public_audit_verifier_federation_packages_scope_check CHECK (
    package_scope IN ('verifier_federation_distribution')
  ),
  CONSTRAINT governance_public_audit_verifier_federation_packages_unique_hash UNIQUE (batch_id, package_scope, package_hash)
);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_verifier_federation_packages_batch_scope
  ON public.governance_public_audit_verifier_federation_packages (batch_id, package_scope, captured_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_verifier_federation_packages_directory
  ON public.governance_public_audit_verifier_federation_packages (source_directory_id, captured_at DESC, created_at DESC);

DO $$
BEGIN
  CREATE TRIGGER update_governance_public_audit_verifier_federation_packages_updated_at
    BEFORE UPDATE ON public.governance_public_audit_verifier_federation_packages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.prevent_governance_public_audit_verifier_federation_package_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Verifier federation packages are append-only';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS prevent_governance_public_audit_verifier_federation_packages_update_trigger
ON public.governance_public_audit_verifier_federation_packages;
CREATE TRIGGER prevent_governance_public_audit_verifier_federation_packages_update_trigger
  BEFORE UPDATE ON public.governance_public_audit_verifier_federation_packages
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_governance_public_audit_verifier_federation_package_mutation();

DROP TRIGGER IF EXISTS prevent_governance_public_audit_verifier_federation_packages_delete_trigger
ON public.governance_public_audit_verifier_federation_packages;
CREATE TRIGGER prevent_governance_public_audit_verifier_federation_packages_delete_trigger
  BEFORE DELETE ON public.governance_public_audit_verifier_federation_packages
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_governance_public_audit_verifier_federation_package_mutation();

CREATE TABLE IF NOT EXISTS public.governance_public_audit_verifier_federation_package_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.governance_public_audit_verifier_federation_packages(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES public.governance_public_audit_batches(id) ON DELETE CASCADE,
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
  CONSTRAINT governance_public_audit_verifier_federation_package_signatures_scope_check CHECK (
    package_scope IN ('verifier_federation_distribution')
  ),
  CONSTRAINT governance_public_audit_verifier_federation_package_signatures_signer_key_check CHECK (length(trim(signer_key)) > 0),
  CONSTRAINT governance_public_audit_verifier_federation_package_signatures_algorithm_check CHECK (length(trim(signature_algorithm)) > 0),
  CONSTRAINT governance_public_audit_verifier_federation_package_signatures_signature_check CHECK (length(trim(signature)) > 0),
  CONSTRAINT governance_public_audit_verifier_federation_package_signatures_trust_domain_check CHECK (length(trim(signer_trust_domain)) > 0),
  CONSTRAINT governance_public_audit_verifier_federation_package_signatures_jurisdiction_check CHECK (
    signer_jurisdiction_country_code IS NULL
    OR length(trim(signer_jurisdiction_country_code)) = 2
  ),
  CONSTRAINT governance_public_audit_verifier_federation_package_signatures_channel_check CHECK (length(trim(distribution_channel)) > 0),
  CONSTRAINT governance_public_audit_verifier_federation_package_signatures_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT governance_public_audit_verifier_federation_package_signatures_unique_signature UNIQUE (package_id, signer_key, signature)
);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_verifier_federation_package_signatures_package
  ON public.governance_public_audit_verifier_federation_package_signatures (package_id, signed_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_verifier_federation_package_signatures_batch_scope
  ON public.governance_public_audit_verifier_federation_package_signatures (batch_id, package_scope, signed_at DESC, created_at DESC);

DO $$
BEGIN
  CREATE TRIGGER update_governance_public_audit_verifier_federation_package_signatures_updated_at
    BEFORE UPDATE ON public.governance_public_audit_verifier_federation_package_signatures
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.prevent_governance_public_audit_verifier_federation_package_signature_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Verifier federation package signatures are append-only';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS prevent_governance_public_audit_verifier_federation_package_signatures_update_trigger
ON public.governance_public_audit_verifier_federation_package_signatures;
CREATE TRIGGER prevent_governance_public_audit_verifier_federation_package_signatures_update_trigger
  BEFORE UPDATE ON public.governance_public_audit_verifier_federation_package_signatures
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_governance_public_audit_verifier_federation_package_signature_mutation();

DROP TRIGGER IF EXISTS prevent_governance_public_audit_verifier_federation_package_signatures_delete_trigger
ON public.governance_public_audit_verifier_federation_package_signatures;
CREATE TRIGGER prevent_governance_public_audit_verifier_federation_package_signatures_delete_trigger
  BEFORE DELETE ON public.governance_public_audit_verifier_federation_package_signatures
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_governance_public_audit_verifier_federation_package_signature_mutation();

CREATE OR REPLACE FUNCTION public.governance_public_audit_verifier_federation_package(
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
  federation_ops_ready boolean
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
directory_for_batch AS (
  SELECT directory.*
  FROM public.governance_public_audit_verifier_mirror_directories AS directory
  JOIN resolved_batch ON resolved_batch.batch_id = directory.batch_id
  ORDER BY directory.published_at DESC, directory.created_at DESC, directory.id DESC
  LIMIT 1
),
directory_fallback AS (
  SELECT directory.*
  FROM public.governance_public_audit_verifier_mirror_directories AS directory
  WHERE NOT EXISTS (SELECT 1 FROM directory_for_batch)
  ORDER BY directory.published_at DESC, directory.created_at DESC, directory.id DESC
  LIMIT 1
),
effective_directory AS (
  SELECT * FROM directory_for_batch
  UNION ALL
  SELECT * FROM directory_fallback
),
policy_summary AS (
  SELECT *
  FROM public.governance_public_audit_verifier_mirror_failover_policy_summary(requested_policy_key)
),
federation_ops_summary AS (
  SELECT *
  FROM public.governance_public_audit_verifier_mirror_federation_operations_summary(requested_policy_key, 24, 12)
),
package_payload_cte AS (
  SELECT jsonb_build_object(
    'package_version', 'public_audit_verifier_federation_distribution_package_v1',
    'batch_id', effective_directory.batch_id,
    'directory', jsonb_build_object(
      'directory_id', effective_directory.id,
      'directory_version', effective_directory.directory_version,
      'directory_hash', effective_directory.directory_hash,
      'directory_payload', effective_directory.directory_payload,
      'signer_key', effective_directory.signer_key,
      'signature', effective_directory.signature,
      'signature_algorithm', effective_directory.signature_algorithm,
      'published_at', effective_directory.published_at
    ),
    'policy_summary', coalesce((SELECT to_jsonb(row_data) FROM policy_summary AS row_data), '{}'::jsonb),
    'federation_ops_summary', coalesce((SELECT to_jsonb(row_data) FROM federation_ops_summary AS row_data), '{}'::jsonb)
  ) AS package_payload
  FROM effective_directory
)
SELECT
  'public_audit_verifier_federation_distribution_package_v1'::text AS package_version,
  encode(
    digest(
      (package_payload_cte.package_payload::text)::bytea,
      'sha256'
    ),
    'hex'
  ) AS package_hash,
  package_payload_cte.package_payload,
  effective_directory.batch_id,
  effective_directory.id AS source_directory_id,
  effective_directory.directory_hash AS source_directory_hash,
  coalesce((package_payload_cte.package_payload #>> '{federation_ops_summary,federation_ops_ready}')::boolean, false) AS federation_ops_ready
FROM effective_directory
CROSS JOIN package_payload_cte;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.capture_governance_public_audit_verifier_federation_package(
  target_batch_id uuid DEFAULT NULL,
  requested_policy_key text DEFAULT 'default',
  package_notes text DEFAULT NULL,
  package_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  package_record record;
  inserted_id uuid;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to capture verifier federation packages';
  END IF;

  SELECT *
  INTO package_record
  FROM public.governance_public_audit_verifier_federation_package(target_batch_id, requested_policy_key)
  LIMIT 1;

  IF package_record.package_hash IS NULL
     OR package_record.batch_id IS NULL
     OR package_record.source_directory_id IS NULL THEN
    RAISE EXCEPTION 'Could not generate verifier federation package';
  END IF;

  INSERT INTO public.governance_public_audit_verifier_federation_packages (
    batch_id,
    package_scope,
    package_version,
    package_hash,
    package_payload,
    source_directory_id,
    metadata,
    captured_by,
    captured_at
  )
  VALUES (
    package_record.batch_id,
    'verifier_federation_distribution',
    package_record.package_version,
    package_record.package_hash,
    coalesce(package_record.package_payload, '{}'::jsonb),
    package_record.source_directory_id,
    coalesce(package_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'source', 'capture_governance_public_audit_verifier_federation_package',
        'notes', nullif(btrim(coalesce(package_notes, '')), ''),
        'federation_ops_ready', coalesce(package_record.federation_ops_ready, false)
      ),
    public.current_profile_id(),
    now()
  )
  ON CONFLICT (batch_id, package_scope, package_hash) DO NOTHING
  RETURNING id INTO inserted_id;

  IF inserted_id IS NULL THEN
    SELECT package.id
    INTO inserted_id
    FROM public.governance_public_audit_verifier_federation_packages AS package
    WHERE package.batch_id = package_record.batch_id
      AND package.package_scope = 'verifier_federation_distribution'
      AND package.package_hash = package_record.package_hash
    ORDER BY package.captured_at DESC, package.created_at DESC, package.id DESC
    LIMIT 1;
  END IF;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.sign_governance_public_audit_verifier_federation_package(
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
  package_record public.governance_public_audit_verifier_federation_packages%ROWTYPE;
  inserted_id uuid;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to sign verifier federation packages';
  END IF;

  IF target_package_id IS NULL THEN
    RAISE EXCEPTION 'Target package id is required';
  END IF;

  SELECT *
  INTO package_record
  FROM public.governance_public_audit_verifier_federation_packages AS package
  WHERE package.id = target_package_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Verifier federation package not found';
  END IF;

  INSERT INTO public.governance_public_audit_verifier_federation_package_signatures (
    package_id,
    batch_id,
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
    package_record.batch_id,
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
        'source', 'sign_governance_public_audit_verifier_federation_package',
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
    FROM public.governance_public_audit_verifier_federation_package_signatures AS signature_row
    WHERE signature_row.package_id = package_record.id
      AND signature_row.signer_key = btrim(coalesce(signer_key, ''))
      AND signature_row.signature = btrim(coalesce(signature, ''))
    ORDER BY signature_row.signed_at DESC, signature_row.created_at DESC, signature_row.id DESC
    LIMIT 1;
  END IF;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_public_audit_verifier_federation_package_distribution_summary(
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
latest_package AS (
  SELECT *
  FROM public.governance_public_audit_verifier_federation_packages AS package
  JOIN resolved_batch ON resolved_batch.batch_id = package.batch_id
  WHERE package.package_scope = 'verifier_federation_distribution'
  ORDER BY package.captured_at DESC, package.created_at DESC, package.id DESC
  LIMIT 1
),
policy_summary AS (
  SELECT *
  FROM public.governance_public_audit_verifier_mirror_failover_policy_summary(requested_policy_key)
),
effective_required_signatures AS (
  SELECT greatest(
    1,
    coalesce(
      (SELECT summary.min_policy_ratification_approvals FROM policy_summary AS summary LIMIT 1),
      (SELECT summary.min_independent_directory_signers FROM policy_summary AS summary LIMIT 1),
      1
    )
  )::integer AS required_signatures
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
  effective_required_signatures.required_signatures AS required_distribution_signatures,
  coalesce(signature_tally.signature_count, 0) AS signature_count,
  coalesce(signature_tally.distinct_signer_count, 0) AS distinct_signer_count,
  coalesce(signature_tally.distinct_signer_jurisdictions_count, 0) AS distinct_signer_jurisdictions_count,
  coalesce(signature_tally.distinct_signer_trust_domains_count, 0) AS distinct_signer_trust_domains_count,
  signature_tally.last_signed_at,
  coalesce((latest_package.package_payload #>> '{federation_ops_summary,federation_ops_ready}')::boolean, false) AS federation_ops_ready,
  (
    coalesce(signature_tally.distinct_signer_count, 0) >= effective_required_signatures.required_signatures
    AND coalesce((latest_package.package_payload #>> '{federation_ops_summary,federation_ops_ready}')::boolean, false)
  ) AS distribution_ready
FROM latest_package
JOIN public.governance_public_audit_verifier_mirror_directories AS source_directory
  ON source_directory.id = latest_package.source_directory_id
LEFT JOIN signature_tally
  ON signature_tally.package_id = latest_package.id
CROSS JOIN effective_required_signatures;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_public_audit_verifier_federation_package_signature_board(
  target_batch_id uuid DEFAULT NULL,
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
latest_package AS (
  SELECT *
  FROM public.governance_public_audit_verifier_federation_packages AS package
  JOIN resolved_batch ON resolved_batch.batch_id = package.batch_id
  WHERE package.package_scope = 'verifier_federation_distribution'
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
JOIN public.governance_public_audit_verifier_federation_package_signatures AS signature_row
  ON signature_row.package_id = latest_package.id
ORDER BY signature_row.signed_at DESC, signature_row.created_at DESC, signature_row.id DESC
LIMIT greatest(1, coalesce(max_entries, 40));
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

GRANT SELECT, INSERT ON public.governance_public_audit_verifier_federation_packages TO authenticated;
GRANT SELECT, INSERT ON public.governance_public_audit_verifier_federation_package_signatures TO authenticated;

GRANT EXECUTE ON FUNCTION public.governance_public_audit_verifier_federation_package(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.capture_governance_public_audit_verifier_federation_package(uuid, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sign_governance_public_audit_verifier_federation_package(uuid, text, text, text, text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_verifier_federation_package_distribution_summary(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_verifier_federation_package_signature_board(uuid, integer) TO authenticated;

ALTER TABLE public.governance_public_audit_verifier_federation_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_public_audit_verifier_federation_package_signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Verifier federation packages are readable by authenticated users"
ON public.governance_public_audit_verifier_federation_packages;
CREATE POLICY "Verifier federation packages are readable by authenticated users"
ON public.governance_public_audit_verifier_federation_packages
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Verifier federation packages are capturable by verifier stewards"
ON public.governance_public_audit_verifier_federation_packages;
CREATE POLICY "Verifier federation packages are capturable by verifier stewards"
ON public.governance_public_audit_verifier_federation_packages
  FOR INSERT WITH CHECK (public.current_profile_can_manage_public_audit_verifiers());

DROP POLICY IF EXISTS "Verifier federation package signatures are readable by authenticated users"
ON public.governance_public_audit_verifier_federation_package_signatures;
CREATE POLICY "Verifier federation package signatures are readable by authenticated users"
ON public.governance_public_audit_verifier_federation_package_signatures
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Verifier federation package signatures are signable by verifier stewards"
ON public.governance_public_audit_verifier_federation_package_signatures;
CREATE POLICY "Verifier federation package signatures are signable by verifier stewards"
ON public.governance_public_audit_verifier_federation_package_signatures
  FOR INSERT WITH CHECK (public.current_profile_can_manage_public_audit_verifiers());
