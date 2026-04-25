-- Cross-operator verifier federation package exchange attestations.

CREATE TABLE IF NOT EXISTS public.governance_public_audit_verifier_federation_exchange_attestations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.governance_public_audit_verifier_federation_packages(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES public.governance_public_audit_batches(id) ON DELETE CASCADE,
  package_hash text NOT NULL,
  operator_label text NOT NULL,
  operator_identity_uri text,
  operator_trust_domain text NOT NULL DEFAULT 'external',
  operator_jurisdiction_country_code text,
  exchange_channel text NOT NULL DEFAULT 'api',
  attestation_verdict text NOT NULL DEFAULT 'accepted',
  attestation_notes text,
  attestation_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  attested_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  attested_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gpav_fed_xchg_attest_operator_label_chk CHECK (
    btrim(operator_label) <> ''
  ),
  CONSTRAINT gpav_fed_xchg_attest_trust_domain_chk CHECK (
    btrim(operator_trust_domain) <> ''
  ),
  CONSTRAINT gpav_fed_xchg_attest_exchange_channel_chk CHECK (
    btrim(exchange_channel) <> ''
  ),
  CONSTRAINT gpav_fed_xchg_attest_verdict_chk CHECK (
    attestation_verdict IN ('accepted', 'rejected', 'needs_followup')
  ),
  CONSTRAINT gpav_fed_xchg_attest_metadata_obj_chk CHECK (
    jsonb_typeof(attestation_metadata) = 'object'
  )
);

CREATE INDEX IF NOT EXISTS idx_gpav_federation_exchange_attestations_batch_attested
  ON public.governance_public_audit_verifier_federation_exchange_attestations (batch_id, attested_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_gpav_federation_exchange_attestations_package_attested
  ON public.governance_public_audit_verifier_federation_exchange_attestations (package_id, attested_at DESC, id DESC);

CREATE OR REPLACE FUNCTION public.record_governance_public_audit_verifier_federation_exchange(
  target_package_id uuid,
  operator_label text,
  operator_identity_uri text DEFAULT NULL,
  operator_trust_domain text DEFAULT 'external',
  operator_jurisdiction_country_code text DEFAULT NULL,
  exchange_channel text DEFAULT 'api',
  attestation_verdict text DEFAULT 'accepted',
  attestation_notes text DEFAULT NULL,
  attestation_metadata jsonb DEFAULT '{}'::jsonb
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
    attested_by
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
    actor_profile_id
  )
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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
  attested_at timestamptz
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
    attestation.attested_at
  FROM public.governance_public_audit_verifier_federation_exchange_attestations AS attestation
  LEFT JOIN public.profiles AS actor
    ON actor.id = attestation.attested_by
  WHERE (target_batch_id IS NULL OR attestation.batch_id = target_batch_id)
    AND (target_package_id IS NULL OR attestation.package_id = target_package_id)
  ORDER BY attestation.attested_at DESC, attestation.id DESC
  LIMIT greatest(1, coalesce(max_entries, 80));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

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
    max(attestation.attested_at) AS latest_attested_at
  FROM public.governance_public_audit_verifier_federation_exchange_attestations AS attestation
  WHERE (target_batch_id IS NULL OR attestation.batch_id = target_batch_id)
    AND attestation.attested_at >= now() - make_interval(hours => lookback_hours);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT SELECT, INSERT ON public.governance_public_audit_verifier_federation_exchange_attestations TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_governance_public_audit_verifier_federation_exchange(uuid, text, text, text, text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_verifier_federation_exchange_board(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_verifier_federation_exchange_summary(uuid, integer) TO authenticated;
