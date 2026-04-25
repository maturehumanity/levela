-- Postgres-safe alias for federation exchange receipt verification RPC.

CREATE OR REPLACE FUNCTION public.gpav_verify_federation_exchange_receipt(
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

GRANT EXECUTE ON FUNCTION public.gpav_verify_federation_exchange_receipt(uuid, boolean, text) TO authenticated;
