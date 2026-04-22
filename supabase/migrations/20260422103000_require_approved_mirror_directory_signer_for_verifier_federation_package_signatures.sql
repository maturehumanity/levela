-- Phase D (verifier federation rollout): federation distribution signatures must use
-- governance-approved verifier mirror directory signer keys (decentralization / anti-spoof).

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

  IF NOT EXISTS (
    SELECT 1
    FROM public.governance_public_audit_verifier_mirror_directory_signers AS directory_signer
    WHERE directory_signer.signer_key = btrim(coalesce(signer_key, ''))
      AND directory_signer.is_active = true
      AND directory_signer.governance_status = 'approved'
  ) THEN
    RAISE EXCEPTION
      'Federation distribution signatures require governance-approved verifier mirror directory signer keys';
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
