ALTER TABLE public.governance_public_audit_verifier_mirror_failover_policies
  ADD COLUMN IF NOT EXISTS require_signer_governance_approval boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_signer_governance_independent_approvals integer NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'governance_public_audit_verifier_mirror_failover_policies_min_signer_governance_independent_approvals_check'
  ) THEN
    ALTER TABLE public.governance_public_audit_verifier_mirror_failover_policies
      ADD CONSTRAINT governance_public_audit_verifier_mirror_failover_policies_min_signer_governance_independent_approvals_check
      CHECK (min_signer_governance_independent_approvals >= 1);
  END IF;
END $$;

UPDATE public.governance_public_audit_verifier_mirror_failover_policies
SET
  require_signer_governance_approval = coalesce(require_signer_governance_approval, false),
  min_signer_governance_independent_approvals = greatest(1, coalesce(min_signer_governance_independent_approvals, 1));

ALTER TABLE public.governance_public_audit_verifier_mirror_directory_signers
  ADD COLUMN IF NOT EXISTS governance_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS governance_last_reviewed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'governance_public_audit_verifier_mirror_directory_signers_governance_status_check'
  ) THEN
    ALTER TABLE public.governance_public_audit_verifier_mirror_directory_signers
      ADD CONSTRAINT governance_public_audit_verifier_mirror_directory_signers_governance_status_check
      CHECK (governance_status IN ('pending', 'approved', 'rejected', 'suspended'));
  END IF;
END $$;

UPDATE public.governance_public_audit_verifier_mirror_directory_signers
SET
  governance_status = CASE
    WHEN is_active = false THEN 'suspended'
    ELSE 'approved'
  END,
  governance_last_reviewed_at = coalesce(governance_last_reviewed_at, now())
WHERE coalesce(governance_status, 'pending') = 'pending';

CREATE TABLE IF NOT EXISTS public.governance_public_audit_verifier_mirror_signer_governance_attestations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_signer_id uuid NOT NULL REFERENCES public.governance_public_audit_verifier_mirror_directory_signers(id) ON DELETE CASCADE,
  attestor_signer_id uuid NOT NULL REFERENCES public.governance_public_audit_verifier_mirror_directory_signers(id) ON DELETE RESTRICT,
  attestor_signer_key text NOT NULL,
  attestation_decision text NOT NULL,
  attestation_signature text NOT NULL,
  attestation_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  attested_at timestamptz NOT NULL DEFAULT now(),
  attested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_public_audit_verifier_mirror_signer_governance_attestations_no_self_check CHECK (target_signer_id <> attestor_signer_id),
  CONSTRAINT governance_public_audit_verifier_mirror_signer_governance_attestations_signer_key_not_empty_check CHECK (length(trim(attestor_signer_key)) > 0),
  CONSTRAINT governance_public_audit_verifier_mirror_signer_governance_attestations_decision_check CHECK (
    attestation_decision IN ('approve', 'reject')
  ),
  CONSTRAINT governance_public_audit_verifier_mirror_signer_governance_attestations_signature_not_empty_check CHECK (length(trim(attestation_signature)) > 0),
  CONSTRAINT governance_public_audit_verifier_mirror_signer_governance_attestations_payload_object_check CHECK (jsonb_typeof(attestation_payload) = 'object'),
  CONSTRAINT governance_public_audit_verifier_mirror_signer_governance_attestations_unique_attestor UNIQUE (target_signer_id, attestor_signer_id)
);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_verifier_mirror_directory_signers_governance
  ON public.governance_public_audit_verifier_mirror_directory_signers (governance_status, trust_tier, is_active, updated_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_verifier_mirror_signer_governance_attestations_target_attested
  ON public.governance_public_audit_verifier_mirror_signer_governance_attestations (target_signer_id, attested_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_verifier_mirror_signer_governance_attestations_attestor_attested
  ON public.governance_public_audit_verifier_mirror_signer_governance_attestations (attestor_signer_id, attested_at DESC, created_at DESC);

DO $$
BEGIN
  CREATE TRIGGER update_governance_public_audit_verifier_mirror_signer_governance_attestations_updated_at
    BEFORE UPDATE ON public.governance_public_audit_verifier_mirror_signer_governance_attestations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.governance_public_audit_verifier_mirror_signer_governance_board(
  max_entries integer DEFAULT 40
)
RETURNS TABLE (
  signer_id uuid,
  signer_key text,
  signer_label text,
  trust_tier text,
  is_active boolean,
  governance_status text,
  required_independent_approvals integer,
  approval_count integer,
  independent_approval_count integer,
  community_approval_count integer,
  reject_count integer,
  governance_met boolean,
  latest_attested_at timestamptz,
  governance_last_reviewed_at timestamptz
) AS $$
WITH policy AS (
  SELECT
    coalesce(policy_row.require_signer_governance_approval, false) AS require_signer_governance_approval,
    greatest(1, coalesce(policy_row.min_signer_governance_independent_approvals, 1)) AS required_independent_approvals
  FROM public.governance_public_audit_verifier_mirror_failover_policies AS policy_row
  WHERE policy_row.policy_key = 'default'
  ORDER BY policy_row.updated_at DESC, policy_row.created_at DESC, policy_row.id DESC
  LIMIT 1
),
fallback_policy AS (
  SELECT false AS require_signer_governance_approval, 1 AS required_independent_approvals
  WHERE NOT EXISTS (SELECT 1 FROM policy)
),
effective_policy AS (
  SELECT * FROM policy
  UNION ALL
  SELECT * FROM fallback_policy
),
attestation_counts AS (
  SELECT
    attestation.target_signer_id,
    coalesce(count(*) FILTER (WHERE attestation.attestation_decision = 'approve'), 0)::integer AS approval_count,
    coalesce(count(*) FILTER (
      WHERE attestation.attestation_decision = 'approve'
        AND attestor.trust_tier = 'independent'
    ), 0)::integer AS independent_approval_count,
    coalesce(count(*) FILTER (
      WHERE attestation.attestation_decision = 'approve'
        AND attestor.trust_tier = 'community'
    ), 0)::integer AS community_approval_count,
    coalesce(count(*) FILTER (WHERE attestation.attestation_decision = 'reject'), 0)::integer AS reject_count,
    max(attestation.attested_at) AS latest_attested_at
  FROM public.governance_public_audit_verifier_mirror_signer_governance_attestations AS attestation
  JOIN public.governance_public_audit_verifier_mirror_directory_signers AS attestor
    ON attestor.id = attestation.attestor_signer_id
  WHERE attestor.is_active = true
    AND attestor.governance_status = 'approved'
  GROUP BY attestation.target_signer_id
)
SELECT
  signer.id AS signer_id,
  signer.signer_key,
  signer.signer_label,
  signer.trust_tier,
  signer.is_active,
  signer.governance_status,
  effective_policy.required_independent_approvals,
  coalesce(attestation_counts.approval_count, 0) AS approval_count,
  coalesce(attestation_counts.independent_approval_count, 0) AS independent_approval_count,
  coalesce(attestation_counts.community_approval_count, 0) AS community_approval_count,
  coalesce(attestation_counts.reject_count, 0) AS reject_count,
  (
    signer.is_active = true
    AND coalesce(attestation_counts.reject_count, 0) = 0
    AND coalesce(attestation_counts.independent_approval_count, 0) >= effective_policy.required_independent_approvals
  ) AS governance_met,
  attestation_counts.latest_attested_at,
  signer.governance_last_reviewed_at
FROM public.governance_public_audit_verifier_mirror_directory_signers AS signer
CROSS JOIN effective_policy
LEFT JOIN attestation_counts
  ON attestation_counts.target_signer_id = signer.id
ORDER BY
  CASE
    WHEN signer.governance_status = 'approved' THEN 0
    WHEN signer.governance_status = 'pending' THEN 1
    WHEN signer.governance_status = 'rejected' THEN 2
    WHEN signer.governance_status = 'suspended' THEN 3
    ELSE 4
  END,
  signer.is_active DESC,
  signer.updated_at DESC,
  signer.created_at DESC
LIMIT greatest(1, coalesce(max_entries, 40));
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_public_audit_verifier_mirror_signer_governance_summary(
  requested_policy_key text DEFAULT 'default'
)
RETURNS TABLE (
  policy_key text,
  require_signer_governance_approval boolean,
  min_signer_governance_independent_approvals integer,
  approved_signer_count integer,
  approved_independent_signer_count integer,
  pending_signer_count integer,
  rejected_signer_count integer,
  suspended_signer_count integer,
  governance_ready boolean,
  latest_attested_at timestamptz
) AS $$
WITH policy AS (
  SELECT
    coalesce(policy_row.policy_key, 'default') AS policy_key,
    coalesce(policy_row.require_signer_governance_approval, false) AS require_signer_governance_approval,
    greatest(1, coalesce(policy_row.min_signer_governance_independent_approvals, 1)) AS min_signer_governance_independent_approvals
  FROM public.governance_public_audit_verifier_mirror_failover_policies AS policy_row
  WHERE policy_row.policy_key = lower(coalesce(nullif(btrim(coalesce(requested_policy_key, '')), ''), 'default'))
  ORDER BY policy_row.updated_at DESC, policy_row.created_at DESC, policy_row.id DESC
  LIMIT 1
),
fallback_policy AS (
  SELECT
    lower(coalesce(nullif(btrim(coalesce(requested_policy_key, '')), ''), 'default')) AS policy_key,
    false AS require_signer_governance_approval,
    1 AS min_signer_governance_independent_approvals
  WHERE NOT EXISTS (SELECT 1 FROM policy)
),
effective_policy AS (
  SELECT * FROM policy
  UNION ALL
  SELECT * FROM fallback_policy
),
counts AS (
  SELECT
    coalesce(count(*) FILTER (WHERE signer.is_active = true AND signer.governance_status = 'approved'), 0)::integer AS approved_signer_count,
    coalesce(count(*) FILTER (
      WHERE signer.is_active = true
        AND signer.governance_status = 'approved'
        AND signer.trust_tier = 'independent'
    ), 0)::integer AS approved_independent_signer_count,
    coalesce(count(*) FILTER (WHERE signer.governance_status = 'pending'), 0)::integer AS pending_signer_count,
    coalesce(count(*) FILTER (WHERE signer.governance_status = 'rejected'), 0)::integer AS rejected_signer_count,
    coalesce(count(*) FILTER (WHERE signer.governance_status = 'suspended' OR signer.is_active = false), 0)::integer AS suspended_signer_count
  FROM public.governance_public_audit_verifier_mirror_directory_signers AS signer
),
attestation_summary AS (
  SELECT max(attestation.attested_at) AS latest_attested_at
  FROM public.governance_public_audit_verifier_mirror_signer_governance_attestations AS attestation
)
SELECT
  effective_policy.policy_key,
  effective_policy.require_signer_governance_approval,
  effective_policy.min_signer_governance_independent_approvals,
  counts.approved_signer_count,
  counts.approved_independent_signer_count,
  counts.pending_signer_count,
  counts.rejected_signer_count,
  counts.suspended_signer_count,
  (
    effective_policy.require_signer_governance_approval = false
    OR counts.approved_independent_signer_count >= effective_policy.min_signer_governance_independent_approvals
  ) AS governance_ready,
  attestation_summary.latest_attested_at
FROM effective_policy
CROSS JOIN counts
CROSS JOIN attestation_summary;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.sync_governance_public_audit_verifier_mirror_signer_governance_status(
  target_signer_id uuid,
  requested_policy_key text DEFAULT 'default'
)
RETURNS text AS $$
DECLARE
  signer_record public.governance_public_audit_verifier_mirror_directory_signers%ROWTYPE;
  required_independent integer;
  independent_approval_count integer;
  independent_reject_count integer;
  resolved_status text;
BEGIN
  IF target_signer_id IS NULL THEN
    RAISE EXCEPTION 'Target signer id is required';
  END IF;

  SELECT *
  INTO signer_record
  FROM public.governance_public_audit_verifier_mirror_directory_signers AS signer
  WHERE signer.id = target_signer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Verifier mirror directory signer not found';
  END IF;

  SELECT
    greatest(1, coalesce(policy.min_signer_governance_independent_approvals, 1))
  INTO required_independent
  FROM public.governance_public_audit_verifier_mirror_failover_policies AS policy
  WHERE policy.policy_key = lower(coalesce(nullif(btrim(coalesce(requested_policy_key, '')), ''), 'default'))
  ORDER BY policy.updated_at DESC, policy.created_at DESC, policy.id DESC
  LIMIT 1;

  required_independent := greatest(1, coalesce(required_independent, 1));

  SELECT
    coalesce(count(*) FILTER (
      WHERE attestation.attestation_decision = 'approve'
        AND attestor.trust_tier = 'independent'
    ), 0)::integer,
    coalesce(count(*) FILTER (
      WHERE attestation.attestation_decision = 'reject'
        AND attestor.trust_tier = 'independent'
    ), 0)::integer
  INTO independent_approval_count, independent_reject_count
  FROM public.governance_public_audit_verifier_mirror_signer_governance_attestations AS attestation
  JOIN public.governance_public_audit_verifier_mirror_directory_signers AS attestor
    ON attestor.id = attestation.attestor_signer_id
  WHERE attestation.target_signer_id = signer_record.id
    AND attestor.is_active = true
    AND attestor.governance_status = 'approved';

  IF signer_record.is_active = false THEN
    resolved_status := 'suspended';
  ELSIF independent_reject_count > 0 THEN
    resolved_status := 'rejected';
  ELSIF independent_approval_count >= required_independent THEN
    resolved_status := 'approved';
  ELSE
    resolved_status := 'pending';
  END IF;

  UPDATE public.governance_public_audit_verifier_mirror_directory_signers
  SET
    governance_status = resolved_status,
    governance_last_reviewed_at = now(),
    metadata = coalesce(signer_record.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'governance_status_updated_at', now(),
        'governance_independent_approval_count', independent_approval_count,
        'governance_independent_reject_count', independent_reject_count,
        'governance_required_independent_approvals', required_independent
      )
  WHERE id = signer_record.id;

  RETURN resolved_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.register_governance_public_audit_verifier_mirror_directory_signer(
  signer_key text,
  signer_label text DEFAULT NULL,
  public_key text DEFAULT NULL,
  signing_algorithm text DEFAULT 'ed25519',
  trust_tier text DEFAULT 'observer',
  metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  inserted_id uuid;
  normalized_trust_tier text;
  has_approved_seed boolean;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to manage verifier mirror directory signers';
  END IF;

  normalized_trust_tier := lower(coalesce(nullif(btrim(coalesce(trust_tier, '')), ''), 'observer'));
  IF normalized_trust_tier NOT IN ('bootstrap', 'observer', 'independent', 'community') THEN
    RAISE EXCEPTION 'Trust tier must be bootstrap, observer, independent, or community';
  END IF;

  SELECT EXISTS(
    SELECT 1
    FROM public.governance_public_audit_verifier_mirror_directory_signers AS signer
    WHERE signer.is_active = true
      AND signer.governance_status = 'approved'
  ) INTO has_approved_seed;

  INSERT INTO public.governance_public_audit_verifier_mirror_directory_signers (
    signer_key,
    signer_label,
    public_key,
    signing_algorithm,
    trust_tier,
    is_active,
    governance_status,
    governance_last_reviewed_at,
    metadata,
    added_by
  )
  VALUES (
    btrim(coalesce(signer_key, '')),
    nullif(btrim(coalesce(signer_label, '')), ''),
    btrim(coalesce(public_key, '')),
    lower(coalesce(nullif(btrim(coalesce(signing_algorithm, '')), ''), 'ed25519')),
    normalized_trust_tier,
    true,
    CASE WHEN has_approved_seed THEN 'pending' ELSE 'approved' END,
    now(),
    coalesce(metadata, '{}'::jsonb),
    public.current_profile_id()
  )
  ON CONFLICT (signer_key) DO UPDATE
    SET signer_label = excluded.signer_label,
        public_key = excluded.public_key,
        signing_algorithm = excluded.signing_algorithm,
        trust_tier = excluded.trust_tier,
        is_active = true,
        governance_status = CASE
          WHEN public.governance_public_audit_verifier_mirror_directory_signers.governance_status = 'suspended' THEN 'pending'
          ELSE public.governance_public_audit_verifier_mirror_directory_signers.governance_status
        END,
        governance_last_reviewed_at = CASE
          WHEN public.governance_public_audit_verifier_mirror_directory_signers.governance_status = 'suspended' THEN now()
          ELSE public.governance_public_audit_verifier_mirror_directory_signers.governance_last_reviewed_at
        END,
        metadata = coalesce(public.governance_public_audit_verifier_mirror_directory_signers.metadata, '{}'::jsonb)
          || coalesce(excluded.metadata, '{}'::jsonb)
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.record_governance_public_audit_verifier_mirror_signer_governance_attestation(
  target_signer_id uuid,
  attestor_signer_key text,
  attestation_decision text,
  attestation_signature text,
  attestation_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  target_signer_record public.governance_public_audit_verifier_mirror_directory_signers%ROWTYPE;
  attestor_signer_record public.governance_public_audit_verifier_mirror_directory_signers%ROWTYPE;
  inserted_id uuid;
  normalized_decision text;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to manage verifier mirror signer governance attestations';
  END IF;

  IF target_signer_id IS NULL THEN
    RAISE EXCEPTION 'Target signer is required';
  END IF;

  SELECT *
  INTO target_signer_record
  FROM public.governance_public_audit_verifier_mirror_directory_signers AS signer
  WHERE signer.id = target_signer_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target verifier mirror directory signer not found';
  END IF;

  SELECT *
  INTO attestor_signer_record
  FROM public.governance_public_audit_verifier_mirror_directory_signers AS signer
  WHERE signer.signer_key = btrim(coalesce(attestor_signer_key, ''))
    AND signer.is_active = true
    AND signer.governance_status = 'approved'
  ORDER BY signer.updated_at DESC, signer.created_at DESC, signer.id DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attestor signer not found, inactive, or not governance-approved';
  END IF;

  IF attestor_signer_record.id = target_signer_record.id THEN
    RAISE EXCEPTION 'Signer cannot self-attest governance approval';
  END IF;

  normalized_decision := lower(coalesce(nullif(btrim(coalesce(attestation_decision, '')), ''), ''));
  IF normalized_decision NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Attestation decision must be approve or reject';
  END IF;

  INSERT INTO public.governance_public_audit_verifier_mirror_signer_governance_attestations (
    target_signer_id,
    attestor_signer_id,
    attestor_signer_key,
    attestation_decision,
    attestation_signature,
    attestation_payload,
    attested_at,
    attested_by
  )
  VALUES (
    target_signer_record.id,
    attestor_signer_record.id,
    attestor_signer_record.signer_key,
    normalized_decision,
    btrim(coalesce(attestation_signature, '')),
    coalesce(attestation_payload, '{}'::jsonb),
    now(),
    public.current_profile_id()
  )
  ON CONFLICT (target_signer_id, attestor_signer_id) DO UPDATE
    SET attestor_signer_key = excluded.attestor_signer_key,
        attestation_decision = excluded.attestation_decision,
        attestation_signature = excluded.attestation_signature,
        attestation_payload = excluded.attestation_payload,
        attested_at = now(),
        attested_by = public.current_profile_id()
  RETURNING id INTO inserted_id;

  PERFORM public.sync_governance_public_audit_verifier_mirror_signer_governance_status(target_signer_record.id, 'default');

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.set_governance_public_audit_verifier_mirror_signer_governance_requirement(
  requested_policy_key text DEFAULT 'default',
  require_governance_approval boolean DEFAULT false,
  required_independent_approvals integer DEFAULT 1
)
RETURNS uuid AS $$
DECLARE
  resolved_id uuid;
  signer_record RECORD;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to manage signer governance requirements';
  END IF;

  UPDATE public.governance_public_audit_verifier_mirror_failover_policies
  SET
    require_signer_governance_approval = coalesce(require_governance_approval, false),
    min_signer_governance_independent_approvals = greatest(1, coalesce(required_independent_approvals, 1)),
    updated_by = public.current_profile_id(),
    updated_at = now()
  WHERE policy_key = lower(coalesce(nullif(btrim(coalesce(requested_policy_key, '')), ''), 'default'))
  RETURNING id INTO resolved_id;

  IF resolved_id IS NULL THEN
    INSERT INTO public.governance_public_audit_verifier_mirror_failover_policies (
      policy_key,
      policy_name,
      is_active,
      min_healthy_mirrors,
      max_mirror_latency_ms,
      max_failures_before_cooldown,
      cooldown_minutes,
      prefer_same_region,
      required_distinct_regions,
      required_distinct_operators,
      mirror_selection_strategy,
      max_mirror_candidates,
      min_independent_directory_signers,
      require_policy_ratification,
      min_policy_ratification_approvals,
      require_signer_governance_approval,
      min_signer_governance_independent_approvals,
      metadata,
      created_by,
      updated_by
    )
    VALUES (
      lower(coalesce(nullif(btrim(coalesce(requested_policy_key, '')), ''), 'default')),
      'Default mirror failover policy',
      true,
      1,
      2500,
      2,
      10,
      false,
      1,
      1,
      'health_latency_diversity',
      8,
      1,
      false,
      1,
      coalesce(require_governance_approval, false),
      greatest(1, coalesce(required_independent_approvals, 1)),
      jsonb_build_object('source', 'set_governance_public_audit_verifier_mirror_signer_governance_requirement'),
      public.current_profile_id(),
      public.current_profile_id()
    )
    RETURNING id INTO resolved_id;
  END IF;

  FOR signer_record IN
    SELECT signer.id
    FROM public.governance_public_audit_verifier_mirror_directory_signers AS signer
  LOOP
    PERFORM public.sync_governance_public_audit_verifier_mirror_signer_governance_status(signer_record.id, requested_policy_key);
  END LOOP;

  RETURN resolved_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.publish_governance_public_audit_verifier_mirror_directory(
  signer_key text,
  signature text,
  target_batch_id uuid DEFAULT NULL,
  signature_algorithm text DEFAULT 'ed25519',
  metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  resolved_signer_record public.governance_public_audit_verifier_mirror_directory_signers%ROWTYPE;
  governance_summary RECORD;
  bundle_record RECORD;
  payload jsonb;
  directory_hash text;
  inserted_id uuid;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to publish verifier mirror directories';
  END IF;

  SELECT *
  INTO resolved_signer_record
  FROM public.governance_public_audit_verifier_mirror_directory_signers AS signer
  WHERE signer.signer_key = btrim(coalesce(signer_key, ''))
    AND signer.is_active = true
  ORDER BY signer.updated_at DESC, signer.created_at DESC, signer.id DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mirror directory signer not found or inactive';
  END IF;

  SELECT *
  INTO governance_summary
  FROM public.governance_public_audit_verifier_mirror_signer_governance_summary('default')
  LIMIT 1;

  IF coalesce(governance_summary.require_signer_governance_approval, false) = true THEN
    IF coalesce(governance_summary.governance_ready, false) = false THEN
      RAISE EXCEPTION 'Signer governance requirement is enabled but independent governance quorum is not ready';
    END IF;

    IF coalesce(resolved_signer_record.governance_status, 'pending') <> 'approved' THEN
      RAISE EXCEPTION 'Selected mirror directory signer is not governance-approved';
    END IF;
  END IF;

  SELECT *
  INTO bundle_record
  FROM public.governance_public_audit_client_verifier_bundle(target_batch_id, 16)
  LIMIT 1;

  payload := jsonb_build_object(
    'directory_version', 'public_audit_verifier_mirror_directory_v1',
    'generated_at', now(),
    'batch_id', bundle_record.bundle_payload #>> '{batch,id}',
    'bundle_hash', bundle_record.bundle_hash,
    'bundle_payload', bundle_record.bundle_payload,
    'signer_governance', coalesce(to_jsonb(governance_summary), '{}'::jsonb)
  );

  directory_hash := encode(
    digest((payload::text)::bytea, 'sha256'),
    'hex'
  );

  INSERT INTO public.governance_public_audit_verifier_mirror_directories (
    batch_id,
    directory_version,
    directory_hash,
    directory_payload,
    signer_id,
    signer_key,
    signature,
    signature_algorithm,
    metadata,
    published_by,
    published_at
  )
  VALUES (
    nullif(bundle_record.bundle_payload #>> '{batch,id}', '')::uuid,
    'public_audit_verifier_mirror_directory_v1',
    directory_hash,
    payload,
    resolved_signer_record.id,
    resolved_signer_record.signer_key,
    btrim(coalesce(signature, '')),
    lower(coalesce(nullif(btrim(coalesce(signature_algorithm, '')), ''), 'ed25519')),
    coalesce(metadata, '{}'::jsonb),
    public.current_profile_id(),
    now()
  )
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT SELECT, INSERT, UPDATE ON public.governance_public_audit_verifier_mirror_signer_governance_attestations TO authenticated;

GRANT EXECUTE ON FUNCTION public.governance_public_audit_verifier_mirror_signer_governance_board(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_verifier_mirror_signer_governance_summary(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_governance_public_audit_verifier_mirror_signer_governance_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_governance_public_audit_verifier_mirror_signer_governance_attestation(uuid, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_governance_public_audit_verifier_mirror_signer_governance_requirement(text, boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_governance_public_audit_verifier_mirror_directory_signer(text, text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_governance_public_audit_verifier_mirror_directory(text, text, uuid, text, jsonb) TO authenticated;

ALTER TABLE public.governance_public_audit_verifier_mirror_signer_governance_attestations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Verifier mirror signer governance attestations are readable by authenticated users" ON public.governance_public_audit_verifier_mirror_signer_governance_attestations;
CREATE POLICY "Verifier mirror signer governance attestations are readable by authenticated users" ON public.governance_public_audit_verifier_mirror_signer_governance_attestations
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Verifier mirror signer governance attestations are manageable by verifier stewards" ON public.governance_public_audit_verifier_mirror_signer_governance_attestations;
CREATE POLICY "Verifier mirror signer governance attestations are manageable by verifier stewards" ON public.governance_public_audit_verifier_mirror_signer_governance_attestations
  FOR ALL USING (public.current_profile_can_manage_public_audit_verifiers())
  WITH CHECK (public.current_profile_can_manage_public_audit_verifiers());
