-- Phase D: federation package capture only when the published mirror directory's
-- publisher signer is active and governance-approved (pairs with 20260422103000).

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

  IF NOT EXISTS (
    SELECT 1
    FROM public.governance_public_audit_verifier_mirror_directories AS directory
    JOIN public.governance_public_audit_verifier_mirror_directory_signers AS publisher
      ON publisher.id = directory.signer_id
    WHERE directory.id = package_record.source_directory_id
      AND publisher.is_active = true
      AND publisher.governance_status = 'approved'
  ) THEN
    RAISE EXCEPTION
      'Federation package capture requires the published directory signer to be governance-approved and active';
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
