-- Cryptographic receipt evidence and verification workflow for federation exchange attestations.

ALTER TABLE public.governance_public_audit_verifier_federation_exchange_attestations
  ADD COLUMN IF NOT EXISTS receipt_payload jsonb,
  ADD COLUMN IF NOT EXISTS receipt_signature text,
  ADD COLUMN IF NOT EXISTS receipt_signer_key text,
  ADD COLUMN IF NOT EXISTS receipt_signature_algorithm text,
  ADD COLUMN IF NOT EXISTS receipt_verified boolean,
  ADD COLUMN IF NOT EXISTS receipt_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS receipt_verification_notes text,
  ADD COLUMN IF NOT EXISTS receipt_verified_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gpav_fed_xchg_attest_receipt_payload_obj_chk'
  ) THEN
    ALTER TABLE public.governance_public_audit_verifier_federation_exchange_attestations
      ADD CONSTRAINT gpav_fed_xchg_attest_receipt_payload_obj_chk
      CHECK (receipt_payload IS NULL OR jsonb_typeof(receipt_payload) = 'object');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gpav_fed_xchg_attest_receipt_verified_fields_chk'
  ) THEN
    ALTER TABLE public.governance_public_audit_verifier_federation_exchange_attestations
      ADD CONSTRAINT gpav_fed_xchg_attest_receipt_verified_fields_chk
      CHECK (
        (receipt_verified IS DISTINCT FROM true)
        OR (receipt_verified_at IS NOT NULL AND receipt_verified_by IS NOT NULL)
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.record_governance_public_audit_verifier_federation_exchange(
  target_package_id uuid,
  operator_label text,
  operator_identity_uri text DEFAULT NULL,
  operator_trust_domain text DEFAULT 'external',
  operator_jurisdiction_country_code text DEFAULT NULL,
  exchange_channel text DEFAULT 'api',
  attestation_verdict text DEFAULT 'accepted',
  attestation_notes text DEFAULT NULL,
  attestation_metadata jsonb DEFAULT '{}'::jsonb,
  receipt_payload jsonb DEFAULT NULL,
  receipt_signature text DEFAULT NULL,
  receipt_signer_key text DEFAULT NULL,
  receipt_signature_algorithm text DEFAULT 'ed25519'
)
RETURNS uuid AS $$
DECLARE
  package_record public.governance_public_audit_verifier_federation_packages%ROWTYPE;
  inserted_id uuid;
  normalized_operator_label text := nullif(btrim(coalesce(operator_label, '')), '');
  normalized_operator_identity_uri text := nullif(btrim(coalesce(operator_identity_uri, '')), '');
  normalized_operator_trust_domain text := lower(coalesce(nullif(btrim(coalesce(operator_trust_domain, '')), ''), 'external'));
  normalized_operator_jurisdiction_country_code text := upper(coalesce(nullif(btrim(coalesce(operator_jurisdiction_country_code, '')), ''), ''));
  normalized_exchange_channel text := lower(coalesce(nullif(btrim(coalesce(exchange_channel, '')), ''), 'api'));
  normalized_attestation_verdict text := lower(coalesce(nullif(btrim(coalesce(attestation_verdict, '')), ''), 'accepted'));
  normalized_attestation_notes text := nullif(btrim(coalesce(attestation_notes, '')), '');
  normalized_receipt_signature text := nullif(btrim(coalesce(receipt_signature, '')), '');
  normalized_receipt_signer_key text := nullif(btrim(coalesce(receipt_signer_key, '')), '');
  normalized_receipt_signature_algorithm text := lower(coalesce(nullif(btrim(coalesce(receipt_signature_algorithm, '')), ''), 'ed25519'));
  actor_profile_id uuid := public.current_profile_id();
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to record verifier federation exchange attestations';
  END IF;

  IF actor_profile_id IS NULL THEN
    RAISE EXCEPTION 'Current profile is required to record verifier federation exchange attestations';
  END IF;

  IF target_package_id IS NULL THEN
    RAISE EXCEPTION 'Target package id is required';
  END IF;

  IF normalized_operator_label IS NULL THEN
    RAISE EXCEPTION 'Operator label is required';
  END IF;

  IF normalized_attestation_verdict NOT IN ('accepted', 'rejected', 'needs_followup') THEN
    RAISE EXCEPTION 'Attestation verdict must be accepted, rejected, or needs_followup';
  END IF;

  IF (normalized_receipt_signature IS NULL) <> (normalized_receipt_signer_key IS NULL) THEN
    RAISE EXCEPTION 'Receipt signature and signer key must be provided together';
  END IF;

  IF receipt_payload IS NOT NULL AND jsonb_typeof(receipt_payload) <> 'object' THEN
    RAISE EXCEPTION 'Receipt payload must be a JSON object';
  END IF;

  SELECT *
  INTO package_record
  FROM public.governance_public_audit_verifier_federation_packages AS package
  WHERE package.id = target_package_id
  LIMIT 1;

  IF package_record.id IS NULL THEN
    RAISE EXCEPTION 'Verifier federation package does not exist';
  END IF;

  INSERT INTO public.governance_public_audit_verifier_federation_exchange_attestations (
    package_id,
    batch_id,
    package_hash,
    operator_label,
    operator_identity_uri,
    operator_trust_domain,
    operator_jurisdiction_country_code,
    exchange_channel,
    attestation_verdict,
    attestation_notes,
    attestation_metadata,
    attested_by,
    receipt_payload,
    receipt_signature,
    receipt_signer_key,
    receipt_signature_algorithm,
    receipt_verified,
    receipt_verified_at,
    receipt_verification_notes,
    receipt_verified_by
  )
  VALUES (
    package_record.id,
    package_record.batch_id,
    package_record.package_hash,
    normalized_operator_label,
    normalized_operator_identity_uri,
    normalized_operator_trust_domain,
    nullif(normalized_operator_jurisdiction_country_code, ''),
    normalized_exchange_channel,
    normalized_attestation_verdict,
    normalized_attestation_notes,
    coalesce(attestation_metadata, '{}'::jsonb),
    actor_profile_id,
    receipt_payload,
    normalized_receipt_signature,
    normalized_receipt_signer_key,
    normalized_receipt_signature_algorithm,
    false,
    NULL,
    NULL,
    NULL
  )
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.verify_governance_public_audit_verifier_federation_exchange_rcpt(
  target_attestation_id uuid,
  receipt_verified boolean,
  receipt_verification_notes text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  attestation_record public.governance_public_audit_verifier_federation_exchange_attestations%ROWTYPE;
  actor_profile_id uuid := public.current_profile_id();
  normalized_notes text := nullif(btrim(coalesce(receipt_verification_notes, '')), '');
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to verify verifier federation exchange receipts';
  END IF;

  IF target_attestation_id IS NULL THEN
    RAISE EXCEPTION 'Target attestation id is required';
  END IF;

  IF actor_profile_id IS NULL THEN
    RAISE EXCEPTION 'Current profile is required to verify verifier federation exchange receipts';
  END IF;

  SELECT *
  INTO attestation_record
  FROM public.governance_public_audit_verifier_federation_exchange_attestations AS attestation
  WHERE attestation.id = target_attestation_id
  FOR UPDATE;

  IF attestation_record.id IS NULL THEN
    RAISE EXCEPTION 'Exchange attestation does not exist';
  END IF;

  IF attestation_record.receipt_signature IS NULL OR attestation_record.receipt_signer_key IS NULL THEN
    RAISE EXCEPTION 'Exchange attestation does not include receipt signature evidence';
  END IF;

  UPDATE public.governance_public_audit_verifier_federation_exchange_attestations AS attestation
  SET
    receipt_verified = coalesce(receipt_verified, false),
    receipt_verified_at = now(),
    receipt_verification_notes = normalized_notes,
    receipt_verified_by = actor_profile_id
  WHERE attestation.id = attestation_record.id;

  RETURN attestation_record.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS public.governance_public_audit_verifier_federation_exchange_board(uuid, uuid, integer);

CREATE OR REPLACE FUNCTION public.governance_public_audit_verifier_federation_exchange_board(
  target_batch_id uuid DEFAULT NULL,
  target_package_id uuid DEFAULT NULL,
  max_entries integer DEFAULT 80
)
RETURNS TABLE (
  attestation_id uuid,
  package_id uuid,
  batch_id uuid,
  package_hash text,
  operator_label text,
  operator_identity_uri text,
  operator_trust_domain text,
  operator_jurisdiction_country_code text,
  exchange_channel text,
  attestation_verdict text,
  attestation_notes text,
  attestation_metadata jsonb,
  attested_by uuid,
  attested_by_name text,
  attested_at timestamptz,
  receipt_payload jsonb,
  receipt_signature text,
  receipt_signer_key text,
  receipt_signature_algorithm text,
  receipt_verified boolean,
  receipt_verified_at timestamptz,
  receipt_verification_notes text,
  receipt_verified_by uuid,
  receipt_verified_by_name text
) AS $$
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to read verifier federation exchange attestations';
  END IF;

  RETURN QUERY
  SELECT
    attestation.id AS attestation_id,
    attestation.package_id,
    attestation.batch_id,
    attestation.package_hash,
    attestation.operator_label,
    attestation.operator_identity_uri,
    attestation.operator_trust_domain,
    attestation.operator_jurisdiction_country_code,
    attestation.exchange_channel,
    attestation.attestation_verdict,
    attestation.attestation_notes,
    attestation.attestation_metadata,
    attestation.attested_by,
    coalesce(actor.full_name, actor.username, actor.id::text) AS attested_by_name,
    attestation.attested_at,
    attestation.receipt_payload,
    attestation.receipt_signature,
    attestation.receipt_signer_key,
    attestation.receipt_signature_algorithm,
    coalesce(attestation.receipt_verified, false) AS receipt_verified,
    attestation.receipt_verified_at,
    attestation.receipt_verification_notes,
    attestation.receipt_verified_by,
    coalesce(verifier.full_name, verifier.username, verifier.id::text) AS receipt_verified_by_name
  FROM public.governance_public_audit_verifier_federation_exchange_attestations AS attestation
  LEFT JOIN public.profiles AS actor
    ON actor.id = attestation.attested_by
  LEFT JOIN public.profiles AS verifier
    ON verifier.id = attestation.receipt_verified_by
  WHERE (target_batch_id IS NULL OR attestation.batch_id = target_batch_id)
    AND (target_package_id IS NULL OR attestation.package_id = target_package_id)
  ORDER BY attestation.attested_at DESC, attestation.id DESC
  LIMIT greatest(1, coalesce(max_entries, 80));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS public.governance_public_audit_verifier_federation_exchange_summary(uuid, integer);

CREATE OR REPLACE FUNCTION public.governance_public_audit_verifier_federation_exchange_summary(
  target_batch_id uuid DEFAULT NULL,
  requested_lookback_hours integer DEFAULT 168
)
RETURNS TABLE (
  batch_id uuid,
  lookback_hours integer,
  attestation_count integer,
  accepted_count integer,
  rejected_count integer,
  needs_followup_count integer,
  distinct_operator_count integer,
  distinct_external_operator_count integer,
  receipt_evidence_count integer,
  receipt_verified_count integer,
  receipt_pending_verification_count integer,
  latest_attested_at timestamptz
) AS $$
DECLARE
  lookback_hours integer := greatest(1, coalesce(requested_lookback_hours, 168));
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to read verifier federation exchange attestation summary';
  END IF;

  RETURN QUERY
  SELECT
    coalesce(target_batch_id, attestation.batch_id) AS batch_id,
    lookback_hours,
    count(*)::integer AS attestation_count,
    count(*) FILTER (WHERE attestation.attestation_verdict = 'accepted')::integer AS accepted_count,
    count(*) FILTER (WHERE attestation.attestation_verdict = 'rejected')::integer AS rejected_count,
    count(*) FILTER (WHERE attestation.attestation_verdict = 'needs_followup')::integer AS needs_followup_count,
    count(DISTINCT lower(attestation.operator_label))::integer AS distinct_operator_count,
    count(DISTINCT lower(attestation.operator_label)) FILTER (
      WHERE lower(attestation.operator_trust_domain) <> 'internal'
    )::integer AS distinct_external_operator_count,
    count(*) FILTER (
      WHERE attestation.receipt_signature IS NOT NULL
        AND attestation.receipt_signer_key IS NOT NULL
    )::integer AS receipt_evidence_count,
    count(*) FILTER (WHERE coalesce(attestation.receipt_verified, false))::integer AS receipt_verified_count,
    count(*) FILTER (
      WHERE attestation.receipt_signature IS NOT NULL
        AND attestation.receipt_signer_key IS NOT NULL
        AND NOT coalesce(attestation.receipt_verified, false)
    )::integer AS receipt_pending_verification_count,
    max(attestation.attested_at) AS latest_attested_at
  FROM public.governance_public_audit_verifier_federation_exchange_attestations AS attestation
  WHERE (target_batch_id IS NULL OR attestation.batch_id = target_batch_id)
    AND attestation.attested_at >= now() - make_interval(hours => lookback_hours);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.record_governance_public_audit_verifier_federation_exchange(uuid, text, text, text, text, text, text, text, jsonb, jsonb, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_governance_public_audit_verifier_federation_exchange_rcpt(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_verifier_federation_exchange_board(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_verifier_federation_exchange_summary(uuid, integer) TO authenticated;
