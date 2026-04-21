ALTER TABLE public.governance_guardian_relay_policies
  ADD COLUMN IF NOT EXISTS min_distinct_relay_jurisdictions integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS min_distinct_relay_trust_domains integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_dominant_relay_region_share_percent numeric(5,2) NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS max_dominant_relay_provider_share_percent numeric(5,2) NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS max_dominant_relay_operator_share_percent numeric(5,2) NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS max_dominant_relay_jurisdiction_share_percent numeric(5,2) NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS max_dominant_relay_trust_domain_share_percent numeric(5,2) NOT NULL DEFAULT 80;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'governance_guardian_relay_policies_min_distinct_relay_jurisdictions_check'
  ) THEN
    ALTER TABLE public.governance_guardian_relay_policies
      ADD CONSTRAINT governance_guardian_relay_policies_min_distinct_relay_jurisdictions_check
      CHECK (min_distinct_relay_jurisdictions >= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'governance_guardian_relay_policies_min_distinct_relay_trust_domains_check'
  ) THEN
    ALTER TABLE public.governance_guardian_relay_policies
      ADD CONSTRAINT governance_guardian_relay_policies_min_distinct_relay_trust_domains_check
      CHECK (min_distinct_relay_trust_domains >= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'governance_guardian_relay_policies_max_dominant_relay_region_share_percent_check'
  ) THEN
    ALTER TABLE public.governance_guardian_relay_policies
      ADD CONSTRAINT governance_guardian_relay_policies_max_dominant_relay_region_share_percent_check
      CHECK (
        max_dominant_relay_region_share_percent > 0
        AND max_dominant_relay_region_share_percent <= 100
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'governance_guardian_relay_policies_max_dominant_relay_provider_share_percent_check'
  ) THEN
    ALTER TABLE public.governance_guardian_relay_policies
      ADD CONSTRAINT governance_guardian_relay_policies_max_dominant_relay_provider_share_percent_check
      CHECK (
        max_dominant_relay_provider_share_percent > 0
        AND max_dominant_relay_provider_share_percent <= 100
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'governance_guardian_relay_policies_max_dominant_relay_operator_share_percent_check'
  ) THEN
    ALTER TABLE public.governance_guardian_relay_policies
      ADD CONSTRAINT governance_guardian_relay_policies_max_dominant_relay_operator_share_percent_check
      CHECK (
        max_dominant_relay_operator_share_percent > 0
        AND max_dominant_relay_operator_share_percent <= 100
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'governance_guardian_relay_policies_max_dominant_relay_jurisdiction_share_percent_check'
  ) THEN
    ALTER TABLE public.governance_guardian_relay_policies
      ADD CONSTRAINT governance_guardian_relay_policies_max_dominant_relay_jurisdiction_share_percent_check
      CHECK (
        max_dominant_relay_jurisdiction_share_percent > 0
        AND max_dominant_relay_jurisdiction_share_percent <= 100
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'governance_guardian_relay_policies_max_dominant_relay_trust_domain_share_percent_check'
  ) THEN
    ALTER TABLE public.governance_guardian_relay_policies
      ADD CONSTRAINT governance_guardian_relay_policies_max_dominant_relay_trust_domain_share_percent_check
      CHECK (
        max_dominant_relay_trust_domain_share_percent > 0
        AND max_dominant_relay_trust_domain_share_percent <= 100
      );
  END IF;
END $$;

UPDATE public.governance_guardian_relay_policies
SET
  min_distinct_relay_jurisdictions = greatest(1, coalesce(min_distinct_relay_jurisdictions, 1)),
  min_distinct_relay_trust_domains = greatest(1, coalesce(min_distinct_relay_trust_domains, 1)),
  max_dominant_relay_region_share_percent = greatest(1::numeric, least(100::numeric, coalesce(max_dominant_relay_region_share_percent, 80))),
  max_dominant_relay_provider_share_percent = greatest(1::numeric, least(100::numeric, coalesce(max_dominant_relay_provider_share_percent, 80))),
  max_dominant_relay_operator_share_percent = greatest(1::numeric, least(100::numeric, coalesce(max_dominant_relay_operator_share_percent, 80))),
  max_dominant_relay_jurisdiction_share_percent = greatest(1::numeric, least(100::numeric, coalesce(max_dominant_relay_jurisdiction_share_percent, 80))),
  max_dominant_relay_trust_domain_share_percent = greatest(1::numeric, least(100::numeric, coalesce(max_dominant_relay_trust_domain_share_percent, 80)))
WHERE policy_key = 'guardian_relay_default';

CREATE TABLE IF NOT EXISTS public.governance_proposal_client_verification_manifests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.governance_proposals(id) ON DELETE CASCADE,
  manifest_scope text NOT NULL,
  manifest_version text NOT NULL,
  manifest_hash text NOT NULL,
  manifest_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  captured_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_proposal_client_verification_manifests_scope_not_empty_check CHECK (length(trim(manifest_scope)) > 0),
  CONSTRAINT governance_proposal_client_verification_manifests_version_not_empty_check CHECK (length(trim(manifest_version)) > 0),
  CONSTRAINT governance_proposal_client_verification_manifests_hash_not_empty_check CHECK (length(trim(manifest_hash)) > 0),
  CONSTRAINT governance_proposal_client_verification_manifests_payload_object_check CHECK (jsonb_typeof(manifest_payload) = 'object'),
  CONSTRAINT governance_proposal_client_verification_manifests_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT governance_proposal_client_verification_manifests_scope_enum_check CHECK (
    manifest_scope IN ('guardian_relay_quorum_client_proof')
  ),
  CONSTRAINT governance_proposal_client_verification_manifests_unique_hash UNIQUE (proposal_id, manifest_scope, manifest_hash)
);

CREATE INDEX IF NOT EXISTS idx_governance_proposal_client_verification_manifests_proposal_scope
  ON public.governance_proposal_client_verification_manifests (proposal_id, manifest_scope, captured_at DESC, created_at DESC);

DO $$
BEGIN
  CREATE TRIGGER update_governance_proposal_client_verification_manifests_updated_at
    BEFORE UPDATE ON public.governance_proposal_client_verification_manifests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.prevent_governance_proposal_client_verification_manifest_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Client verification manifests are append-only';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS prevent_governance_proposal_client_verification_manifests_update_trigger
ON public.governance_proposal_client_verification_manifests;
CREATE TRIGGER prevent_governance_proposal_client_verification_manifests_update_trigger
  BEFORE UPDATE ON public.governance_proposal_client_verification_manifests
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_governance_proposal_client_verification_manifest_mutation();

DROP TRIGGER IF EXISTS prevent_governance_proposal_client_verification_manifests_delete_trigger
ON public.governance_proposal_client_verification_manifests;
CREATE TRIGGER prevent_governance_proposal_client_verification_manifests_delete_trigger
  BEFORE DELETE ON public.governance_proposal_client_verification_manifests
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_governance_proposal_client_verification_manifest_mutation();

CREATE OR REPLACE FUNCTION public.governance_proposal_guardian_relay_trust_minimized_summary(
  target_proposal_id uuid
)
RETURNS TABLE (
  policy_enabled boolean,
  required_relay_attestations integer,
  min_distinct_relay_regions integer,
  min_distinct_relay_providers integer,
  min_distinct_relay_operators integer,
  min_distinct_relay_jurisdictions integer,
  min_distinct_relay_trust_domains integer,
  max_dominant_relay_region_share_percent numeric,
  max_dominant_relay_provider_share_percent numeric,
  max_dominant_relay_operator_share_percent numeric,
  max_dominant_relay_jurisdiction_share_percent numeric,
  max_dominant_relay_trust_domain_share_percent numeric,
  external_approval_count integer,
  signers_with_relay_quorum_count integer,
  signers_with_chain_proof_count integer,
  verified_relay_count integer,
  distinct_regions_count integer,
  distinct_providers_count integer,
  distinct_operators_count integer,
  distinct_jurisdictions_count integer,
  distinct_trust_domains_count integer,
  dominant_region_share_percent numeric,
  dominant_provider_share_percent numeric,
  dominant_operator_share_percent numeric,
  dominant_jurisdiction_share_percent numeric,
  dominant_trust_domain_share_percent numeric,
  relay_quorum_met boolean,
  chain_proof_match_met boolean,
  region_diversity_met boolean,
  provider_diversity_met boolean,
  operator_diversity_met boolean,
  jurisdiction_diversity_met boolean,
  trust_domain_diversity_met boolean,
  concentration_limits_met boolean,
  trust_minimized_quorum_met boolean
) AS $$
WITH policy AS (
  SELECT
    coalesce(relay_policy.is_enabled, false) AS policy_enabled,
    greatest(1, coalesce(relay_policy.required_relay_attestations, 2))::integer AS required_relay_attestations,
    greatest(1, coalesce(relay_policy.min_distinct_relay_regions, 2))::integer AS min_distinct_relay_regions,
    greatest(1, coalesce(relay_policy.min_distinct_relay_providers, 2))::integer AS min_distinct_relay_providers,
    greatest(1, coalesce(relay_policy.min_distinct_relay_operators, 2))::integer AS min_distinct_relay_operators,
    greatest(1, coalesce(relay_policy.min_distinct_relay_jurisdictions, 1))::integer AS min_distinct_relay_jurisdictions,
    greatest(1, coalesce(relay_policy.min_distinct_relay_trust_domains, 1))::integer AS min_distinct_relay_trust_domains,
    greatest(1::numeric, least(100::numeric, coalesce(relay_policy.max_dominant_relay_region_share_percent, 80)))::numeric AS max_dominant_relay_region_share_percent,
    greatest(1::numeric, least(100::numeric, coalesce(relay_policy.max_dominant_relay_provider_share_percent, 80)))::numeric AS max_dominant_relay_provider_share_percent,
    greatest(1::numeric, least(100::numeric, coalesce(relay_policy.max_dominant_relay_operator_share_percent, 80)))::numeric AS max_dominant_relay_operator_share_percent,
    greatest(1::numeric, least(100::numeric, coalesce(relay_policy.max_dominant_relay_jurisdiction_share_percent, 80)))::numeric AS max_dominant_relay_jurisdiction_share_percent,
    greatest(1::numeric, least(100::numeric, coalesce(relay_policy.max_dominant_relay_trust_domain_share_percent, 80)))::numeric AS max_dominant_relay_trust_domain_share_percent
  FROM public.governance_guardian_relay_policies AS relay_policy
  WHERE relay_policy.policy_key = 'guardian_relay_default'
  ORDER BY relay_policy.updated_at DESC, relay_policy.created_at DESC, relay_policy.id DESC
  LIMIT 1
),
base_summary AS (
  SELECT *
  FROM public.governance_proposal_guardian_relay_summary(target_proposal_id)
),
diversity_summary AS (
  SELECT *
  FROM public.governance_proposal_guardian_relay_diversity_audit(target_proposal_id)
),
external_approvals AS (
  SELECT signature.external_signer_id
  FROM public.governance_proposal_guardian_external_signatures AS signature
  JOIN public.governance_guardian_external_signers AS signer
    ON signer.id = signature.external_signer_id
  WHERE signature.proposal_id = target_proposal_id
    AND signature.decision = 'approve'::public.governance_guardian_decision
    AND signature.verified_at IS NOT NULL
    AND signer.is_active = true
),
verified_attestations AS (
  SELECT
    relay.relay_region_code,
    relay.relay_infrastructure_provider,
    relay.relay_operator_label,
    relay.relay_jurisdiction_country_code,
    relay.relay_trust_domain
  FROM public.governance_proposal_guardian_relay_attestations AS attestation
  JOIN public.governance_guardian_relay_nodes AS relay
    ON relay.id = attestation.relay_id
  JOIN external_approvals AS approval
    ON approval.external_signer_id = attestation.external_signer_id
  WHERE attestation.proposal_id = target_proposal_id
    AND relay.is_active = true
    AND attestation.status = 'verified'::public.governance_guardian_relay_attestation_status
),
normalized_verified_attestations AS (
  SELECT
    coalesce(nullif(upper(btrim(coalesce(relay_region_code, ''))), ''), 'GLOBAL') AS region_value,
    coalesce(nullif(lower(btrim(coalesce(relay_infrastructure_provider, ''))), ''), 'unspecified') AS provider_value,
    coalesce(nullif(lower(btrim(coalesce(relay_operator_label, ''))), ''), 'unspecified') AS operator_value,
    coalesce(nullif(upper(btrim(coalesce(relay_jurisdiction_country_code, ''))), ''), 'UNSPECIFIED') AS jurisdiction_value,
    coalesce(nullif(lower(btrim(coalesce(relay_trust_domain, ''))), ''), 'public') AS trust_domain_value
  FROM verified_attestations
),
jurisdiction_and_trust_tally AS (
  SELECT
    coalesce(count(*)::integer, 0) AS verified_relay_count,
    coalesce(count(DISTINCT jurisdiction_value)::integer, 0) AS distinct_jurisdictions_count,
    coalesce(count(DISTINCT trust_domain_value)::integer, 0) AS distinct_trust_domains_count,
    coalesce((
      SELECT max(inner_tally.count_value)
      FROM (
        SELECT count(*)::integer AS count_value
        FROM normalized_verified_attestations
        GROUP BY jurisdiction_value
      ) AS inner_tally
    ), 0)::integer AS dominant_jurisdiction_count,
    coalesce((
      SELECT max(inner_tally.count_value)
      FROM (
        SELECT count(*)::integer AS count_value
        FROM normalized_verified_attestations
        GROUP BY trust_domain_value
      ) AS inner_tally
    ), 0)::integer AS dominant_trust_domain_count
  FROM normalized_verified_attestations
)
SELECT
  coalesce(policy.policy_enabled, false) AS policy_enabled,
  coalesce(policy.required_relay_attestations, 1) AS required_relay_attestations,
  coalesce(policy.min_distinct_relay_regions, 1) AS min_distinct_relay_regions,
  coalesce(policy.min_distinct_relay_providers, 1) AS min_distinct_relay_providers,
  coalesce(policy.min_distinct_relay_operators, 1) AS min_distinct_relay_operators,
  coalesce(policy.min_distinct_relay_jurisdictions, 1) AS min_distinct_relay_jurisdictions,
  coalesce(policy.min_distinct_relay_trust_domains, 1) AS min_distinct_relay_trust_domains,
  coalesce(policy.max_dominant_relay_region_share_percent, 80) AS max_dominant_relay_region_share_percent,
  coalesce(policy.max_dominant_relay_provider_share_percent, 80) AS max_dominant_relay_provider_share_percent,
  coalesce(policy.max_dominant_relay_operator_share_percent, 80) AS max_dominant_relay_operator_share_percent,
  coalesce(policy.max_dominant_relay_jurisdiction_share_percent, 80) AS max_dominant_relay_jurisdiction_share_percent,
  coalesce(policy.max_dominant_relay_trust_domain_share_percent, 80) AS max_dominant_relay_trust_domain_share_percent,
  coalesce(base_summary.external_approval_count, 0) AS external_approval_count,
  coalesce(base_summary.signers_with_relay_quorum_count, 0) AS signers_with_relay_quorum_count,
  coalesce(base_summary.signers_with_chain_proof_count, 0) AS signers_with_chain_proof_count,
  coalesce(diversity_summary.verified_relay_count, 0) AS verified_relay_count,
  coalesce(diversity_summary.distinct_regions_count, 0) AS distinct_regions_count,
  coalesce(diversity_summary.distinct_providers_count, 0) AS distinct_providers_count,
  coalesce(diversity_summary.distinct_operators_count, 0) AS distinct_operators_count,
  coalesce(jurisdiction_and_trust_tally.distinct_jurisdictions_count, 0) AS distinct_jurisdictions_count,
  coalesce(jurisdiction_and_trust_tally.distinct_trust_domains_count, 0) AS distinct_trust_domains_count,
  diversity_summary.dominant_region_share_percent,
  diversity_summary.dominant_provider_share_percent,
  diversity_summary.dominant_operator_share_percent,
  CASE
    WHEN coalesce(jurisdiction_and_trust_tally.verified_relay_count, 0) <= 0 THEN NULL
    ELSE round(
      (coalesce(jurisdiction_and_trust_tally.dominant_jurisdiction_count, 0)::numeric / jurisdiction_and_trust_tally.verified_relay_count::numeric) * 100,
      2
    )
  END AS dominant_jurisdiction_share_percent,
  CASE
    WHEN coalesce(jurisdiction_and_trust_tally.verified_relay_count, 0) <= 0 THEN NULL
    ELSE round(
      (coalesce(jurisdiction_and_trust_tally.dominant_trust_domain_count, 0)::numeric / jurisdiction_and_trust_tally.verified_relay_count::numeric) * 100,
      2
    )
  END AS dominant_trust_domain_share_percent,
  coalesce(base_summary.relay_quorum_met, false) AS relay_quorum_met,
  coalesce(base_summary.chain_proof_match_met, false) AS chain_proof_match_met,
  coalesce(diversity_summary.region_diversity_met, false) AS region_diversity_met,
  coalesce(diversity_summary.provider_diversity_met, false) AS provider_diversity_met,
  coalesce(diversity_summary.operator_diversity_met, false) AS operator_diversity_met,
  (
    coalesce(jurisdiction_and_trust_tally.distinct_jurisdictions_count, 0)
    >= coalesce(policy.min_distinct_relay_jurisdictions, 1)
  ) AS jurisdiction_diversity_met,
  (
    coalesce(jurisdiction_and_trust_tally.distinct_trust_domains_count, 0)
    >= coalesce(policy.min_distinct_relay_trust_domains, 1)
  ) AS trust_domain_diversity_met,
  (
    (diversity_summary.dominant_region_share_percent IS NULL
      OR diversity_summary.dominant_region_share_percent <= coalesce(policy.max_dominant_relay_region_share_percent, 80))
    AND (diversity_summary.dominant_provider_share_percent IS NULL
      OR diversity_summary.dominant_provider_share_percent <= coalesce(policy.max_dominant_relay_provider_share_percent, 80))
    AND (diversity_summary.dominant_operator_share_percent IS NULL
      OR diversity_summary.dominant_operator_share_percent <= coalesce(policy.max_dominant_relay_operator_share_percent, 80))
    AND (
      coalesce(jurisdiction_and_trust_tally.verified_relay_count, 0) <= 0
      OR round(
        (coalesce(jurisdiction_and_trust_tally.dominant_jurisdiction_count, 0)::numeric / jurisdiction_and_trust_tally.verified_relay_count::numeric) * 100,
        2
      ) <= coalesce(policy.max_dominant_relay_jurisdiction_share_percent, 80)
    )
    AND (
      coalesce(jurisdiction_and_trust_tally.verified_relay_count, 0) <= 0
      OR round(
        (coalesce(jurisdiction_and_trust_tally.dominant_trust_domain_count, 0)::numeric / jurisdiction_and_trust_tally.verified_relay_count::numeric) * 100,
        2
      ) <= coalesce(policy.max_dominant_relay_trust_domain_share_percent, 80)
    )
  ) AS concentration_limits_met,
  (
    coalesce(base_summary.relay_quorum_met, false)
    AND coalesce(base_summary.chain_proof_match_met, false)
    AND coalesce(diversity_summary.region_diversity_met, false)
    AND coalesce(diversity_summary.provider_diversity_met, false)
    AND coalesce(diversity_summary.operator_diversity_met, false)
    AND (
      coalesce(jurisdiction_and_trust_tally.distinct_jurisdictions_count, 0)
      >= coalesce(policy.min_distinct_relay_jurisdictions, 1)
    )
    AND (
      coalesce(jurisdiction_and_trust_tally.distinct_trust_domains_count, 0)
      >= coalesce(policy.min_distinct_relay_trust_domains, 1)
    )
    AND (
      (diversity_summary.dominant_region_share_percent IS NULL
        OR diversity_summary.dominant_region_share_percent <= coalesce(policy.max_dominant_relay_region_share_percent, 80))
      AND (diversity_summary.dominant_provider_share_percent IS NULL
        OR diversity_summary.dominant_provider_share_percent <= coalesce(policy.max_dominant_relay_provider_share_percent, 80))
      AND (diversity_summary.dominant_operator_share_percent IS NULL
        OR diversity_summary.dominant_operator_share_percent <= coalesce(policy.max_dominant_relay_operator_share_percent, 80))
      AND (
        coalesce(jurisdiction_and_trust_tally.verified_relay_count, 0) <= 0
        OR round(
          (coalesce(jurisdiction_and_trust_tally.dominant_jurisdiction_count, 0)::numeric / jurisdiction_and_trust_tally.verified_relay_count::numeric) * 100,
          2
        ) <= coalesce(policy.max_dominant_relay_jurisdiction_share_percent, 80)
      )
      AND (
        coalesce(jurisdiction_and_trust_tally.verified_relay_count, 0) <= 0
        OR round(
          (coalesce(jurisdiction_and_trust_tally.dominant_trust_domain_count, 0)::numeric / jurisdiction_and_trust_tally.verified_relay_count::numeric) * 100,
          2
        ) <= coalesce(policy.max_dominant_relay_trust_domain_share_percent, 80)
      )
    )
  ) AS trust_minimized_quorum_met
FROM policy
FULL JOIN base_summary ON true
FULL JOIN diversity_summary ON true
FULL JOIN jurisdiction_and_trust_tally ON true;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_proposal_guardian_relay_client_proof_manifest(
  target_proposal_id uuid
)
RETURNS TABLE (
  manifest_version text,
  manifest_hash text,
  manifest_payload jsonb,
  trust_minimized_quorum_met boolean
) AS $$
WITH relay_summary AS (
  SELECT *
  FROM public.governance_proposal_guardian_relay_summary(target_proposal_id)
),
trust_summary AS (
  SELECT *
  FROM public.governance_proposal_guardian_relay_trust_minimized_summary(target_proposal_id)
),
latest_relay_audit AS (
  SELECT *
  FROM public.governance_proposal_guardian_relay_recent_audits(target_proposal_id, 1)
),
manifest_payload_cte AS (
  SELECT jsonb_build_object(
    'manifest_version', 'guardian_relay_client_proof_v1',
    'generated_at', now(),
    'proposal_id', target_proposal_id,
    'relay_summary', coalesce((SELECT to_jsonb(row_data) FROM relay_summary AS row_data), '{}'::jsonb),
    'trust_summary', coalesce((SELECT to_jsonb(row_data) FROM trust_summary AS row_data), '{}'::jsonb),
    'latest_relay_audit', coalesce((SELECT to_jsonb(row_data) FROM latest_relay_audit AS row_data), '{}'::jsonb),
    'external_approvals', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'external_signer_id', signature.external_signer_id,
          'signer_key', signer.signer_key,
          'decision', signature.decision,
          'payload_hash', signature.payload_hash,
          'signature_reference', signature.signature_reference,
          'verification_method', signature.verification_method,
          'verified_at', signature.verified_at,
          'signed_at', signature.signed_at
        )
        ORDER BY signature.verified_at DESC NULLS LAST, signature.created_at DESC
      )
      FROM public.governance_proposal_guardian_external_signatures AS signature
      JOIN public.governance_guardian_external_signers AS signer
        ON signer.id = signature.external_signer_id
      WHERE signature.proposal_id = target_proposal_id
        AND signer.is_active = true
        AND signature.verified_at IS NOT NULL
    ), '[]'::jsonb),
    'relay_attestations', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'external_signer_id', attestation.external_signer_id,
          'relay_id', attestation.relay_id,
          'relay_key', relay.relay_key,
          'relay_region_code', relay.relay_region_code,
          'relay_infrastructure_provider', relay.relay_infrastructure_provider,
          'relay_operator_label', relay.relay_operator_label,
          'relay_jurisdiction_country_code', relay.relay_jurisdiction_country_code,
          'relay_trust_domain', relay.relay_trust_domain,
          'status', attestation.status,
          'payload_hash', attestation.payload_hash,
          'attestation_reference', attestation.attestation_reference,
          'chain_network', attestation.chain_network,
          'chain_reference', attestation.chain_reference,
          'verified_at', attestation.verified_at
        )
        ORDER BY attestation.verified_at DESC NULLS LAST, attestation.created_at DESC
      )
      FROM public.governance_proposal_guardian_relay_attestations AS attestation
      JOIN public.governance_guardian_relay_nodes AS relay
        ON relay.id = attestation.relay_id
      WHERE attestation.proposal_id = target_proposal_id
    ), '[]'::jsonb)
  ) AS manifest_payload
)
SELECT
  'guardian_relay_client_proof_v1'::text AS manifest_version,
  encode(
    digest(
      (manifest_payload_cte.manifest_payload::text)::bytea,
      'sha256'
    ),
    'hex'
  ) AS manifest_hash,
  manifest_payload_cte.manifest_payload,
  coalesce((manifest_payload_cte.manifest_payload #>> '{trust_summary,trust_minimized_quorum_met}')::boolean, false) AS trust_minimized_quorum_met
FROM manifest_payload_cte;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.capture_governance_proposal_guardian_relay_client_manifest(
  target_proposal_id uuid,
  manifest_notes text DEFAULT NULL,
  manifest_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  manifest_record record;
  inserted_id uuid;
BEGIN
  IF NOT public.current_profile_can_manage_guardian_relays() THEN
    RAISE EXCEPTION 'Current profile is not authorized to capture guardian relay client manifests';
  END IF;

  SELECT *
  INTO manifest_record
  FROM public.governance_proposal_guardian_relay_client_proof_manifest(target_proposal_id)
  LIMIT 1;

  IF manifest_record.manifest_hash IS NULL THEN
    RAISE EXCEPTION 'Could not generate guardian relay client manifest';
  END IF;

  INSERT INTO public.governance_proposal_client_verification_manifests (
    proposal_id,
    manifest_scope,
    manifest_version,
    manifest_hash,
    manifest_payload,
    metadata,
    captured_by,
    captured_at
  )
  VALUES (
    target_proposal_id,
    'guardian_relay_quorum_client_proof',
    manifest_record.manifest_version,
    manifest_record.manifest_hash,
    coalesce(manifest_record.manifest_payload, '{}'::jsonb),
    coalesce(manifest_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'source', 'capture_governance_proposal_guardian_relay_client_manifest',
        'notes', nullif(btrim(coalesce(manifest_notes, '')), ''),
        'trust_minimized_quorum_met', coalesce(manifest_record.trust_minimized_quorum_met, false)
      ),
    public.current_profile_id(),
    now()
  )
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_proposal_guardian_relay_recent_client_manifests(
  target_proposal_id uuid,
  max_manifests integer DEFAULT 12
)
RETURNS TABLE (
  manifest_id uuid,
  captured_at timestamptz,
  manifest_version text,
  manifest_hash text,
  trust_minimized_quorum_met boolean,
  relay_quorum_met boolean,
  chain_proof_match_met boolean,
  manifest_notes text
) AS $$
SELECT
  manifest.id AS manifest_id,
  manifest.captured_at,
  manifest.manifest_version,
  manifest.manifest_hash,
  coalesce((manifest.manifest_payload #>> '{trust_summary,trust_minimized_quorum_met}')::boolean, false) AS trust_minimized_quorum_met,
  coalesce((manifest.manifest_payload #>> '{relay_summary,relay_quorum_met}')::boolean, false) AS relay_quorum_met,
  coalesce((manifest.manifest_payload #>> '{relay_summary,chain_proof_match_met}')::boolean, false) AS chain_proof_match_met,
  nullif(btrim(coalesce(manifest.metadata ->> 'notes', '')), '') AS manifest_notes
FROM public.governance_proposal_client_verification_manifests AS manifest
WHERE manifest.proposal_id = target_proposal_id
  AND manifest.manifest_scope = 'guardian_relay_quorum_client_proof'
ORDER BY manifest.captured_at DESC, manifest.created_at DESC, manifest.id DESC
LIMIT greatest(1, coalesce(max_manifests, 12));
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

GRANT SELECT, INSERT ON public.governance_proposal_client_verification_manifests TO authenticated;

GRANT EXECUTE ON FUNCTION public.governance_proposal_guardian_relay_trust_minimized_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_proposal_guardian_relay_client_proof_manifest(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.capture_governance_proposal_guardian_relay_client_manifest(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_proposal_guardian_relay_recent_client_manifests(uuid, integer) TO authenticated;

ALTER TABLE public.governance_proposal_client_verification_manifests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Guardian client verification manifests are readable by authenticated users"
ON public.governance_proposal_client_verification_manifests;
CREATE POLICY "Guardian client verification manifests are readable by authenticated users"
ON public.governance_proposal_client_verification_manifests
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Guardian client verification manifests are capturable by relay stewards"
ON public.governance_proposal_client_verification_manifests;
CREATE POLICY "Guardian client verification manifests are capturable by relay stewards"
ON public.governance_proposal_client_verification_manifests
  FOR INSERT WITH CHECK (public.current_profile_can_manage_guardian_relays());
