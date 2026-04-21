ALTER TABLE public.governance_guardian_relay_policies
  ADD COLUMN IF NOT EXISTS min_distinct_relay_regions integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS min_distinct_relay_providers integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS min_distinct_relay_operators integer NOT NULL DEFAULT 2;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'governance_guardian_relay_policies_min_distinct_relay_regions_check'
  ) THEN
    ALTER TABLE public.governance_guardian_relay_policies
      ADD CONSTRAINT governance_guardian_relay_policies_min_distinct_relay_regions_check
      CHECK (min_distinct_relay_regions >= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'governance_guardian_relay_policies_min_distinct_relay_providers_check'
  ) THEN
    ALTER TABLE public.governance_guardian_relay_policies
      ADD CONSTRAINT governance_guardian_relay_policies_min_distinct_relay_providers_check
      CHECK (min_distinct_relay_providers >= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'governance_guardian_relay_policies_min_distinct_relay_operators_check'
  ) THEN
    ALTER TABLE public.governance_guardian_relay_policies
      ADD CONSTRAINT governance_guardian_relay_policies_min_distinct_relay_operators_check
      CHECK (min_distinct_relay_operators >= 1);
  END IF;
END $$;

ALTER TABLE public.governance_guardian_relay_nodes
  ADD COLUMN IF NOT EXISTS relay_region_code text NOT NULL DEFAULT 'GLOBAL',
  ADD COLUMN IF NOT EXISTS relay_infrastructure_provider text NOT NULL DEFAULT 'unspecified',
  ADD COLUMN IF NOT EXISTS relay_operator_label text NOT NULL DEFAULT 'unspecified',
  ADD COLUMN IF NOT EXISTS relay_operator_uri text,
  ADD COLUMN IF NOT EXISTS relay_jurisdiction_country_code text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS relay_trust_domain text NOT NULL DEFAULT 'public';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'governance_guardian_relay_nodes_relay_region_code_not_empty_check'
  ) THEN
    ALTER TABLE public.governance_guardian_relay_nodes
      ADD CONSTRAINT governance_guardian_relay_nodes_relay_region_code_not_empty_check
      CHECK (length(trim(relay_region_code)) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'governance_guardian_relay_nodes_relay_infrastructure_provider_not_empty_check'
  ) THEN
    ALTER TABLE public.governance_guardian_relay_nodes
      ADD CONSTRAINT governance_guardian_relay_nodes_relay_infrastructure_provider_not_empty_check
      CHECK (length(trim(relay_infrastructure_provider)) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'governance_guardian_relay_nodes_relay_operator_label_not_empty_check'
  ) THEN
    ALTER TABLE public.governance_guardian_relay_nodes
      ADD CONSTRAINT governance_guardian_relay_nodes_relay_operator_label_not_empty_check
      CHECK (length(trim(relay_operator_label)) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'governance_guardian_relay_nodes_relay_jurisdiction_country_code_check'
  ) THEN
    ALTER TABLE public.governance_guardian_relay_nodes
      ADD CONSTRAINT governance_guardian_relay_nodes_relay_jurisdiction_country_code_check
      CHECK (relay_jurisdiction_country_code = '' OR length(relay_jurisdiction_country_code) = 2);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'governance_guardian_relay_nodes_relay_trust_domain_not_empty_check'
  ) THEN
    ALTER TABLE public.governance_guardian_relay_nodes
      ADD CONSTRAINT governance_guardian_relay_nodes_relay_trust_domain_not_empty_check
      CHECK (length(trim(relay_trust_domain)) > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_governance_guardian_relay_nodes_diversity
  ON public.governance_guardian_relay_nodes (
    is_active,
    relay_region_code,
    relay_infrastructure_provider,
    relay_operator_label,
    relay_trust_domain,
    created_at DESC
  );

UPDATE public.governance_guardian_relay_policies
SET
  min_distinct_relay_regions = greatest(1, coalesce(min_distinct_relay_regions, 2)),
  min_distinct_relay_providers = greatest(1, coalesce(min_distinct_relay_providers, 2)),
  min_distinct_relay_operators = greatest(1, coalesce(min_distinct_relay_operators, 2))
WHERE policy_key = 'guardian_relay_default';

UPDATE public.governance_guardian_relay_nodes
SET
  relay_region_code = upper(coalesce(nullif(trim(relay_region_code), ''), 'GLOBAL')),
  relay_infrastructure_provider = coalesce(nullif(trim(relay_infrastructure_provider), ''), 'unspecified'),
  relay_operator_label = coalesce(nullif(trim(relay_operator_label), ''), 'unspecified'),
  relay_operator_uri = nullif(trim(coalesce(relay_operator_uri, '')), ''),
  relay_jurisdiction_country_code = upper(coalesce(nullif(trim(relay_jurisdiction_country_code), ''), '')),
  relay_trust_domain = lower(coalesce(nullif(trim(relay_trust_domain), ''), 'public'));

CREATE OR REPLACE FUNCTION public.register_governance_guardian_relay_node(
  relay_key text,
  relay_label text DEFAULT NULL,
  endpoint_url text DEFAULT NULL,
  key_algorithm text DEFAULT 'ECDSA_P256_SHA256_V1',
  metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  inserted_id uuid;
  normalized_region_code text;
  normalized_provider text;
  normalized_operator text;
  normalized_operator_uri text;
  normalized_country_code text;
  normalized_trust_domain text;
BEGIN
  IF NOT public.current_profile_can_manage_guardian_relays() THEN
    RAISE EXCEPTION 'Current profile is not authorized to manage guardian relay nodes';
  END IF;

  normalized_region_code := upper(coalesce(nullif(btrim(coalesce(metadata->>'relay_region_code', '')), ''), 'GLOBAL'));
  normalized_provider := coalesce(nullif(btrim(coalesce(metadata->>'relay_infrastructure_provider', '')), ''), 'unspecified');
  normalized_operator := coalesce(nullif(btrim(coalesce(metadata->>'relay_operator_label', '')), ''), 'unspecified');
  normalized_operator_uri := nullif(btrim(coalesce(metadata->>'relay_operator_uri', '')), '');
  normalized_country_code := upper(coalesce(nullif(btrim(coalesce(metadata->>'relay_jurisdiction_country_code', '')), ''), ''));
  normalized_trust_domain := lower(coalesce(nullif(btrim(coalesce(metadata->>'relay_trust_domain', '')), ''), 'public'));

  IF normalized_country_code <> '' AND length(normalized_country_code) <> 2 THEN
    RAISE EXCEPTION 'Relay jurisdiction country code must be empty or a 2-character code';
  END IF;

  INSERT INTO public.governance_guardian_relay_nodes (
    relay_key,
    relay_label,
    endpoint_url,
    key_algorithm,
    relay_region_code,
    relay_infrastructure_provider,
    relay_operator_label,
    relay_operator_uri,
    relay_jurisdiction_country_code,
    relay_trust_domain,
    metadata,
    added_by
  )
  VALUES (
    btrim(coalesce(relay_key, '')),
    nullif(btrim(coalesce(relay_label, '')), ''),
    nullif(btrim(coalesce(endpoint_url, '')), ''),
    upper(btrim(coalesce(key_algorithm, 'ECDSA_P256_SHA256_V1'))),
    normalized_region_code,
    normalized_provider,
    normalized_operator,
    normalized_operator_uri,
    normalized_country_code,
    normalized_trust_domain,
    coalesce(metadata, '{}'::jsonb),
    public.current_profile_id()
  )
  ON CONFLICT (relay_key) DO UPDATE
    SET relay_label = excluded.relay_label,
        endpoint_url = excluded.endpoint_url,
        key_algorithm = excluded.key_algorithm,
        relay_region_code = excluded.relay_region_code,
        relay_infrastructure_provider = excluded.relay_infrastructure_provider,
        relay_operator_label = excluded.relay_operator_label,
        relay_operator_uri = excluded.relay_operator_uri,
        relay_jurisdiction_country_code = excluded.relay_jurisdiction_country_code,
        relay_trust_domain = excluded.relay_trust_domain,
        metadata = coalesce(public.governance_guardian_relay_nodes.metadata, '{}'::jsonb) || coalesce(excluded.metadata, '{}'::jsonb),
        is_active = true
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TABLE IF NOT EXISTS public.governance_guardian_relay_audit_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.governance_proposals(id) ON DELETE CASCADE,
  policy_enabled boolean NOT NULL DEFAULT false,
  required_relay_attestations integer NOT NULL DEFAULT 1,
  min_distinct_relay_regions integer NOT NULL DEFAULT 1,
  min_distinct_relay_providers integer NOT NULL DEFAULT 1,
  min_distinct_relay_operators integer NOT NULL DEFAULT 1,
  verified_relay_count integer NOT NULL DEFAULT 0,
  distinct_regions_count integer NOT NULL DEFAULT 0,
  distinct_providers_count integer NOT NULL DEFAULT 0,
  distinct_operators_count integer NOT NULL DEFAULT 0,
  overall_diversity_met boolean NOT NULL DEFAULT false,
  relay_quorum_met boolean NOT NULL DEFAULT false,
  chain_proof_match_met boolean NOT NULL DEFAULT false,
  audit_notes text,
  audit_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  captured_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_guardian_relay_audit_reports_required_relay_attestations_check CHECK (required_relay_attestations >= 1),
  CONSTRAINT governance_guardian_relay_audit_reports_min_regions_check CHECK (min_distinct_relay_regions >= 1),
  CONSTRAINT governance_guardian_relay_audit_reports_min_providers_check CHECK (min_distinct_relay_providers >= 1),
  CONSTRAINT governance_guardian_relay_audit_reports_min_operators_check CHECK (min_distinct_relay_operators >= 1),
  CONSTRAINT governance_guardian_relay_audit_reports_verified_relay_count_check CHECK (verified_relay_count >= 0),
  CONSTRAINT governance_guardian_relay_audit_reports_distinct_regions_count_check CHECK (distinct_regions_count >= 0),
  CONSTRAINT governance_guardian_relay_audit_reports_distinct_providers_count_check CHECK (distinct_providers_count >= 0),
  CONSTRAINT governance_guardian_relay_audit_reports_distinct_operators_count_check CHECK (distinct_operators_count >= 0),
  CONSTRAINT governance_guardian_relay_audit_reports_metadata_object_check CHECK (jsonb_typeof(audit_metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_governance_guardian_relay_audit_reports_proposal_captured
  ON public.governance_guardian_relay_audit_reports (proposal_id, captured_at DESC, created_at DESC);

CREATE OR REPLACE FUNCTION public.prevent_governance_guardian_relay_audit_report_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Guardian relay audit reports are append-only';
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS prevent_governance_guardian_relay_audit_reports_update_trigger ON public.governance_guardian_relay_audit_reports;
CREATE TRIGGER prevent_governance_guardian_relay_audit_reports_update_trigger
  BEFORE UPDATE ON public.governance_guardian_relay_audit_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_governance_guardian_relay_audit_report_mutation();

DROP TRIGGER IF EXISTS prevent_governance_guardian_relay_audit_reports_delete_trigger ON public.governance_guardian_relay_audit_reports;
CREATE TRIGGER prevent_governance_guardian_relay_audit_reports_delete_trigger
  BEFORE DELETE ON public.governance_guardian_relay_audit_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_governance_guardian_relay_audit_report_mutation();

CREATE OR REPLACE FUNCTION public.governance_proposal_guardian_relay_diversity_audit(
  target_proposal_id uuid
)
RETURNS TABLE (
  policy_enabled boolean,
  required_relay_attestations integer,
  min_distinct_relay_regions integer,
  min_distinct_relay_providers integer,
  min_distinct_relay_operators integer,
  verified_relay_count integer,
  distinct_regions_count integer,
  distinct_providers_count integer,
  distinct_operators_count integer,
  dominant_region_share_percent numeric,
  dominant_provider_share_percent numeric,
  dominant_operator_share_percent numeric,
  region_diversity_met boolean,
  provider_diversity_met boolean,
  operator_diversity_met boolean,
  overall_diversity_met boolean
) AS $$
WITH policy AS (
  SELECT
    coalesce(relay_policy.is_enabled, false) AS policy_enabled,
    greatest(1, coalesce(relay_policy.required_relay_attestations, 2))::integer AS required_relay_attestations,
    greatest(1, coalesce(relay_policy.min_distinct_relay_regions, 2))::integer AS min_distinct_relay_regions,
    greatest(1, coalesce(relay_policy.min_distinct_relay_providers, 2))::integer AS min_distinct_relay_providers,
    greatest(1, coalesce(relay_policy.min_distinct_relay_operators, 2))::integer AS min_distinct_relay_operators
  FROM public.governance_guardian_relay_policies AS relay_policy
  WHERE relay_policy.policy_key = 'guardian_relay_default'
  ORDER BY relay_policy.updated_at DESC, relay_policy.created_at DESC, relay_policy.id DESC
  LIMIT 1
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
    relay.relay_operator_label
  FROM public.governance_proposal_guardian_relay_attestations AS attestation
  JOIN public.governance_guardian_relay_nodes AS relay
    ON relay.id = attestation.relay_id
  JOIN external_approvals AS approval
    ON approval.external_signer_id = attestation.external_signer_id
  WHERE attestation.proposal_id = target_proposal_id
    AND relay.is_active = true
    AND attestation.status = 'verified'::public.governance_guardian_relay_attestation_status
),
region_counts AS (
  SELECT
    coalesce(nullif(upper(btrim(coalesce(relay_region_code, ''))), ''), 'GLOBAL') AS region_value,
    count(*)::integer AS region_count
  FROM verified_attestations
  GROUP BY 1
),
provider_counts AS (
  SELECT
    coalesce(nullif(lower(btrim(coalesce(relay_infrastructure_provider, ''))), ''), 'unspecified') AS provider_value,
    count(*)::integer AS provider_count
  FROM verified_attestations
  GROUP BY 1
),
operator_counts AS (
  SELECT
    coalesce(nullif(lower(btrim(coalesce(relay_operator_label, ''))), ''), 'unspecified') AS operator_value,
    count(*)::integer AS operator_count
  FROM verified_attestations
  GROUP BY 1
),
tally AS (
  SELECT
    coalesce((SELECT count(*) FROM verified_attestations), 0)::integer AS verified_relay_count,
    coalesce((SELECT count(*) FROM region_counts), 0)::integer AS distinct_regions_count,
    coalesce((SELECT count(*) FROM provider_counts), 0)::integer AS distinct_providers_count,
    coalesce((SELECT count(*) FROM operator_counts), 0)::integer AS distinct_operators_count,
    coalesce((SELECT max(region_count) FROM region_counts), 0)::integer AS dominant_region_count,
    coalesce((SELECT max(provider_count) FROM provider_counts), 0)::integer AS dominant_provider_count,
    coalesce((SELECT max(operator_count) FROM operator_counts), 0)::integer AS dominant_operator_count
)
SELECT
  coalesce(policy.policy_enabled, false) AS policy_enabled,
  coalesce(policy.required_relay_attestations, 1) AS required_relay_attestations,
  coalesce(policy.min_distinct_relay_regions, 1) AS min_distinct_relay_regions,
  coalesce(policy.min_distinct_relay_providers, 1) AS min_distinct_relay_providers,
  coalesce(policy.min_distinct_relay_operators, 1) AS min_distinct_relay_operators,
  tally.verified_relay_count,
  tally.distinct_regions_count,
  tally.distinct_providers_count,
  tally.distinct_operators_count,
  CASE
    WHEN tally.verified_relay_count <= 0 THEN NULL
    ELSE round((tally.dominant_region_count::numeric / tally.verified_relay_count::numeric) * 100, 2)
  END AS dominant_region_share_percent,
  CASE
    WHEN tally.verified_relay_count <= 0 THEN NULL
    ELSE round((tally.dominant_provider_count::numeric / tally.verified_relay_count::numeric) * 100, 2)
  END AS dominant_provider_share_percent,
  CASE
    WHEN tally.verified_relay_count <= 0 THEN NULL
    ELSE round((tally.dominant_operator_count::numeric / tally.verified_relay_count::numeric) * 100, 2)
  END AS dominant_operator_share_percent,
  tally.distinct_regions_count >= coalesce(policy.min_distinct_relay_regions, 1) AS region_diversity_met,
  tally.distinct_providers_count >= coalesce(policy.min_distinct_relay_providers, 1) AS provider_diversity_met,
  tally.distinct_operators_count >= coalesce(policy.min_distinct_relay_operators, 1) AS operator_diversity_met,
  (
    NOT coalesce(policy.policy_enabled, false)
    OR (
      tally.distinct_regions_count >= coalesce(policy.min_distinct_relay_regions, 1)
      AND tally.distinct_providers_count >= coalesce(policy.min_distinct_relay_providers, 1)
      AND tally.distinct_operators_count >= coalesce(policy.min_distinct_relay_operators, 1)
    )
  ) AS overall_diversity_met
FROM tally
LEFT JOIN policy ON true;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_proposal_guardian_relay_attestation_audit_report(
  target_proposal_id uuid,
  requested_lookback_hours integer DEFAULT 168
)
RETURNS TABLE (
  relay_id uuid,
  relay_key text,
  relay_label text,
  relay_region_code text,
  relay_infrastructure_provider text,
  relay_operator_label text,
  relay_trust_domain text,
  total_attestation_count integer,
  verified_count integer,
  mismatch_count integer,
  unreachable_count integer,
  last_attested_at timestamptz,
  recent_attestation_count integer,
  recent_failure_count integer,
  recent_health_score numeric,
  recent_health_status text
) AS $$
WITH lookback AS (
  SELECT greatest(1, coalesce(requested_lookback_hours, 168))::integer AS lookback_hours
),
active_relays AS (
  SELECT
    relay.id,
    relay.relay_key,
    relay.relay_label,
    relay.relay_region_code,
    relay.relay_infrastructure_provider,
    relay.relay_operator_label,
    relay.relay_trust_domain,
    relay.is_active
  FROM public.governance_guardian_relay_nodes AS relay
  WHERE relay.is_active = true
),
proposal_attestations AS (
  SELECT
    attestation.relay_id,
    attestation.status,
    attestation.verified_at
  FROM public.governance_proposal_guardian_relay_attestations AS attestation
  WHERE attestation.proposal_id = target_proposal_id
),
relay_rollup AS (
  SELECT
    relay.id AS relay_id,
    relay.relay_key,
    relay.relay_label,
    relay.relay_region_code,
    relay.relay_infrastructure_provider,
    relay.relay_operator_label,
    relay.relay_trust_domain,
    coalesce(count(attestation.*), 0)::integer AS total_attestation_count,
    coalesce(count(attestation.*) FILTER (
      WHERE attestation.status = 'verified'::public.governance_guardian_relay_attestation_status
    ), 0)::integer AS verified_count,
    coalesce(count(attestation.*) FILTER (
      WHERE attestation.status = 'mismatch'::public.governance_guardian_relay_attestation_status
    ), 0)::integer AS mismatch_count,
    coalesce(count(attestation.*) FILTER (
      WHERE attestation.status = 'unreachable'::public.governance_guardian_relay_attestation_status
    ), 0)::integer AS unreachable_count,
    max(attestation.verified_at) AS last_attested_at,
    coalesce(count(attestation.*) FILTER (
      WHERE attestation.verified_at >= (now() - make_interval(hours => lookback.lookback_hours))
    ), 0)::integer AS recent_attestation_count,
    coalesce(count(attestation.*) FILTER (
      WHERE attestation.verified_at >= (now() - make_interval(hours => lookback.lookback_hours))
        AND attestation.status <> 'verified'::public.governance_guardian_relay_attestation_status
    ), 0)::integer AS recent_failure_count,
    coalesce(count(attestation.*) FILTER (
      WHERE attestation.verified_at >= (now() - make_interval(hours => lookback.lookback_hours))
        AND attestation.status = 'verified'::public.governance_guardian_relay_attestation_status
    ), 0)::integer AS recent_verified_count
  FROM active_relays AS relay
  CROSS JOIN lookback
  LEFT JOIN proposal_attestations AS attestation
    ON attestation.relay_id = relay.id
  GROUP BY
    relay.id,
    relay.relay_key,
    relay.relay_label,
    relay.relay_region_code,
    relay.relay_infrastructure_provider,
    relay.relay_operator_label,
    relay.relay_trust_domain,
    lookback.lookback_hours
)
SELECT
  rollup.relay_id,
  rollup.relay_key,
  rollup.relay_label,
  rollup.relay_region_code,
  rollup.relay_infrastructure_provider,
  rollup.relay_operator_label,
  rollup.relay_trust_domain,
  rollup.total_attestation_count,
  rollup.verified_count,
  rollup.mismatch_count,
  rollup.unreachable_count,
  rollup.last_attested_at,
  rollup.recent_attestation_count,
  rollup.recent_failure_count,
  CASE
    WHEN rollup.recent_attestation_count <= 0 THEN NULL
    ELSE round((rollup.recent_verified_count::numeric / rollup.recent_attestation_count::numeric) * 100, 2)
  END AS recent_health_score,
  CASE
    WHEN rollup.recent_attestation_count <= 0 THEN 'unknown'
    WHEN rollup.recent_failure_count = 0 AND rollup.recent_verified_count = rollup.recent_attestation_count THEN 'healthy'
    WHEN (rollup.recent_verified_count::numeric / greatest(1, rollup.recent_attestation_count)::numeric) >= 0.6 THEN 'degraded'
    ELSE 'critical'
  END AS recent_health_status
FROM relay_rollup AS rollup
ORDER BY
  CASE
    WHEN rollup.recent_attestation_count <= 0 THEN 1
    ELSE 0
  END,
  CASE
    WHEN rollup.recent_attestation_count <= 0 THEN 0
    ELSE (rollup.recent_verified_count::numeric / greatest(1, rollup.recent_attestation_count)::numeric)
  END ASC,
  rollup.relay_key ASC;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_proposal_guardian_relay_recent_audits(
  target_proposal_id uuid,
  max_reports integer DEFAULT 12
)
RETURNS TABLE (
  report_id uuid,
  captured_at timestamptz,
  overall_diversity_met boolean,
  relay_quorum_met boolean,
  chain_proof_match_met boolean,
  verified_relay_count integer,
  distinct_regions_count integer,
  distinct_providers_count integer,
  distinct_operators_count integer,
  audit_notes text
) AS $$
SELECT
  report.id AS report_id,
  report.captured_at,
  report.overall_diversity_met,
  report.relay_quorum_met,
  report.chain_proof_match_met,
  report.verified_relay_count,
  report.distinct_regions_count,
  report.distinct_providers_count,
  report.distinct_operators_count,
  report.audit_notes
FROM public.governance_guardian_relay_audit_reports AS report
WHERE report.proposal_id = target_proposal_id
ORDER BY report.captured_at DESC, report.created_at DESC, report.id DESC
LIMIT greatest(1, coalesce(max_reports, 12));
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.capture_governance_guardian_relay_audit_report(
  target_proposal_id uuid,
  audit_notes text DEFAULT NULL,
  audit_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  relay_summary record;
  diversity_summary record;
  inserted_id uuid;
BEGIN
  IF target_proposal_id IS NULL THEN
    RAISE EXCEPTION 'Target proposal id is required';
  END IF;

  IF NOT (
    public.current_profile_can_manage_guardian_relays()
    OR auth.role() = 'service_role'
  ) THEN
    RAISE EXCEPTION 'Current profile is not authorized to capture guardian relay audit reports';
  END IF;

  SELECT *
  INTO relay_summary
  FROM public.governance_proposal_guardian_relay_summary(target_proposal_id)
  LIMIT 1;

  SELECT *
  INTO diversity_summary
  FROM public.governance_proposal_guardian_relay_diversity_audit(target_proposal_id)
  LIMIT 1;

  INSERT INTO public.governance_guardian_relay_audit_reports (
    proposal_id,
    policy_enabled,
    required_relay_attestations,
    min_distinct_relay_regions,
    min_distinct_relay_providers,
    min_distinct_relay_operators,
    verified_relay_count,
    distinct_regions_count,
    distinct_providers_count,
    distinct_operators_count,
    overall_diversity_met,
    relay_quorum_met,
    chain_proof_match_met,
    audit_notes,
    audit_metadata,
    captured_by,
    captured_at
  )
  VALUES (
    target_proposal_id,
    coalesce(diversity_summary.policy_enabled, false),
    coalesce(diversity_summary.required_relay_attestations, 1),
    coalesce(diversity_summary.min_distinct_relay_regions, 1),
    coalesce(diversity_summary.min_distinct_relay_providers, 1),
    coalesce(diversity_summary.min_distinct_relay_operators, 1),
    coalesce(diversity_summary.verified_relay_count, 0),
    coalesce(diversity_summary.distinct_regions_count, 0),
    coalesce(diversity_summary.distinct_providers_count, 0),
    coalesce(diversity_summary.distinct_operators_count, 0),
    coalesce(diversity_summary.overall_diversity_met, false),
    coalesce(relay_summary.relay_quorum_met, false),
    coalesce(relay_summary.chain_proof_match_met, false),
    nullif(btrim(coalesce(audit_notes, '')), ''),
    coalesce(audit_metadata, '{}'::jsonb) || jsonb_build_object(
      'source', 'guardian_relay_audit_capture',
      'captured_at', now(),
      'proposal_id', target_proposal_id
    ),
    public.current_profile_id(),
    now()
  )
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT SELECT, INSERT ON public.governance_guardian_relay_audit_reports TO authenticated;

GRANT EXECUTE ON FUNCTION public.governance_proposal_guardian_relay_diversity_audit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_proposal_guardian_relay_attestation_audit_report(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_proposal_guardian_relay_recent_audits(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.capture_governance_guardian_relay_audit_report(uuid, text, jsonb) TO authenticated;

ALTER TABLE public.governance_guardian_relay_audit_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Guardian relay audit reports are readable by authenticated users" ON public.governance_guardian_relay_audit_reports;
CREATE POLICY "Guardian relay audit reports are readable by authenticated users" ON public.governance_guardian_relay_audit_reports
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Guardian relay audit reports are insertable by relay stewards" ON public.governance_guardian_relay_audit_reports;
CREATE POLICY "Guardian relay audit reports are insertable by relay stewards" ON public.governance_guardian_relay_audit_reports
  FOR INSERT WITH CHECK (
    public.current_profile_can_manage_guardian_relays()
    OR auth.role() = 'service_role'
  );
