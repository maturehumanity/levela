CREATE TABLE IF NOT EXISTS public.governance_guardian_multisig_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key text NOT NULL UNIQUE,
  policy_name text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  required_external_approvals integer NOT NULL DEFAULT 1,
  network text,
  contract_reference text,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_guardian_multisig_policies_policy_key_not_empty CHECK (length(trim(policy_key)) > 0),
  CONSTRAINT governance_guardian_multisig_policies_policy_name_not_empty CHECK (length(trim(policy_name)) > 0),
  CONSTRAINT governance_guardian_multisig_policies_required_external_approvals_check CHECK (required_external_approvals >= 1),
  CONSTRAINT governance_guardian_multisig_policies_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE IF NOT EXISTS public.governance_guardian_external_signers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signer_key text NOT NULL UNIQUE,
  signer_label text,
  key_algorithm text NOT NULL DEFAULT 'ECDSA_P256_SHA256_V1',
  custody_provider text,
  is_active boolean NOT NULL DEFAULT true,
  activated_at timestamptz NOT NULL DEFAULT now(),
  deactivated_at timestamptz,
  added_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_guardian_external_signers_signer_key_not_empty CHECK (length(trim(signer_key)) > 0),
  CONSTRAINT governance_guardian_external_signers_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE IF NOT EXISTS public.governance_proposal_guardian_external_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.governance_proposals(id) ON DELETE CASCADE,
  external_signer_id uuid NOT NULL REFERENCES public.governance_guardian_external_signers(id) ON DELETE CASCADE,
  decision public.governance_guardian_decision NOT NULL,
  payload_hash text,
  signature text,
  signed_message text,
  signature_reference text,
  verification_method text NOT NULL DEFAULT 'manual_attestation',
  rationale text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  signed_at timestamptz NOT NULL DEFAULT now(),
  verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_proposal_guardian_external_signatures_snapshot_object_check CHECK (jsonb_typeof(snapshot) = 'object'),
  CONSTRAINT governance_proposal_guardian_external_signatures_unique_signer UNIQUE (proposal_id, external_signer_id)
);

CREATE INDEX IF NOT EXISTS idx_governance_guardian_external_signers_active
  ON public.governance_guardian_external_signers (is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_proposal_guardian_external_signatures_proposal_signed
  ON public.governance_proposal_guardian_external_signatures (proposal_id, signed_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_proposal_guardian_external_signatures_signer_signed
  ON public.governance_proposal_guardian_external_signatures (external_signer_id, signed_at DESC, created_at DESC);

DO $$
BEGIN
  CREATE TRIGGER update_governance_guardian_multisig_policies_updated_at
    BEFORE UPDATE ON public.governance_guardian_multisig_policies
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_governance_guardian_external_signers_updated_at
    BEFORE UPDATE ON public.governance_guardian_external_signers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_governance_proposal_guardian_external_signatures_updated_at
    BEFORE UPDATE ON public.governance_proposal_guardian_external_signatures
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.current_profile_can_manage_guardian_multisig()
RETURNS boolean AS $$
  SELECT coalesce(
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.current_profile_in_governance_domain(ARRAY['constitutional_review', 'security_incident_response'])
    OR public.current_profile_is_guardian_signer(),
    false
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.enforce_governance_guardian_external_signer_row_integrity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.signer_key := btrim(coalesce(NEW.signer_key, ''));
  NEW.key_algorithm := upper(btrim(coalesce(NEW.key_algorithm, '')));

  IF NEW.signer_key = '' THEN
    RAISE EXCEPTION 'External guardian signer key is required';
  END IF;

  IF NEW.key_algorithm = '' THEN
    RAISE EXCEPTION 'External guardian key algorithm is required';
  END IF;

  IF NEW.is_active = false THEN
    NEW.deactivated_at := coalesce(NEW.deactivated_at, now());
  ELSE
    NEW.deactivated_at := NULL;
  END IF;

  IF NEW.is_active = true THEN
    NEW.activated_at := coalesce(NEW.activated_at, now());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS enforce_governance_guardian_external_signer_row_integrity_trigger ON public.governance_guardian_external_signers;
CREATE TRIGGER enforce_governance_guardian_external_signer_row_integrity_trigger
  BEFORE INSERT OR UPDATE ON public.governance_guardian_external_signers
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_governance_guardian_external_signer_row_integrity();

CREATE OR REPLACE FUNCTION public.enforce_governance_guardian_external_signature_row_integrity()
RETURNS TRIGGER AS $$
DECLARE
  proposal_status public.governance_proposal_status;
  signer_record public.governance_guardian_external_signers%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE'
    AND (
      NEW.proposal_id IS DISTINCT FROM OLD.proposal_id
      OR NEW.external_signer_id IS DISTINCT FROM OLD.external_signer_id
    )
  THEN
    RAISE EXCEPTION 'External guardian signature proposal and signer bindings are immutable';
  END IF;

  SELECT proposal.status
  INTO proposal_status
  FROM public.governance_proposals AS proposal
  WHERE proposal.id = NEW.proposal_id
  LIMIT 1;

  IF proposal_status IS NULL THEN
    RAISE EXCEPTION 'External guardian signature proposal does not exist';
  END IF;

  IF proposal_status <> 'open'::public.governance_proposal_status THEN
    RAISE EXCEPTION 'External guardian signatures can only be updated while proposal is open';
  END IF;

  SELECT signer.*
  INTO signer_record
  FROM public.governance_guardian_external_signers AS signer
  WHERE signer.id = NEW.external_signer_id
  LIMIT 1;

  IF signer_record.id IS NULL THEN
    RAISE EXCEPTION 'External guardian signer does not exist';
  END IF;

  IF signer_record.is_active = false THEN
    RAISE EXCEPTION 'External guardian signer is not active';
  END IF;

  NEW.verification_method := btrim(coalesce(NEW.verification_method, 'manual_attestation'));
  NEW.verified_at := coalesce(NEW.verified_at, now());
  NEW.signed_at := coalesce(NEW.signed_at, NEW.verified_at, now());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS enforce_governance_guardian_external_signature_row_integrity_trigger ON public.governance_proposal_guardian_external_signatures;
CREATE TRIGGER enforce_governance_guardian_external_signature_row_integrity_trigger
  BEFORE INSERT OR UPDATE ON public.governance_proposal_guardian_external_signatures
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_governance_guardian_external_signature_row_integrity();

INSERT INTO public.governance_guardian_multisig_policies (
  policy_key,
  policy_name,
  is_enabled,
  required_external_approvals,
  network,
  notes,
  metadata
)
VALUES (
  'guardian_threshold_default',
  'Guardian Threshold External Multisig',
  false,
  1,
  'external_anchor',
  'Bootstrap external guardian multisig policy. Enable after signer registry bootstrap.',
  jsonb_build_object('source', 'bootstrap_seed')
)
ON CONFLICT (policy_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.governance_proposal_external_multisig_summary(
  target_proposal_id uuid
)
RETURNS TABLE (
  external_multisig_required boolean,
  required_external_approvals integer,
  active_external_signer_count integer,
  external_approval_count integer,
  external_rejection_count integer,
  external_decisive_count integer,
  policy_network text,
  policy_contract_reference text
) AS $$
WITH target_proposal AS (
  SELECT
    proposal.id,
    proposal.metadata
  FROM public.governance_proposals AS proposal
  WHERE proposal.id = target_proposal_id
  LIMIT 1
),
policy AS (
  SELECT
    coalesce(multisig_policy.is_enabled, false) AS is_enabled,
    greatest(1, coalesce(multisig_policy.required_external_approvals, 1)) AS required_external_approvals,
    nullif(btrim(coalesce(multisig_policy.network, '')), '') AS policy_network,
    nullif(btrim(coalesce(multisig_policy.contract_reference, '')), '') AS policy_contract_reference
  FROM public.governance_guardian_multisig_policies AS multisig_policy
  WHERE multisig_policy.policy_key = 'guardian_threshold_default'
  ORDER BY multisig_policy.updated_at DESC, multisig_policy.created_at DESC, multisig_policy.id DESC
  LIMIT 1
),
active_signers AS (
  SELECT count(*)::integer AS active_signer_count
  FROM public.governance_guardian_external_signers AS signer
  WHERE signer.is_active = true
),
external_tally AS (
  SELECT
    coalesce(count(*) FILTER (WHERE signature.decision = 'approve'::public.governance_guardian_decision), 0)::integer AS approvals,
    coalesce(count(*) FILTER (WHERE signature.decision = 'reject'::public.governance_guardian_decision), 0)::integer AS rejections
  FROM public.governance_proposal_guardian_external_signatures AS signature
  JOIN target_proposal ON target_proposal.id = signature.proposal_id
  JOIN public.governance_guardian_external_signers AS signer ON signer.id = signature.external_signer_id
  WHERE signer.is_active = true
    AND signature.verified_at IS NOT NULL
)
SELECT
  CASE
    WHEN jsonb_typeof(target_proposal.metadata -> 'require_external_multisig') = 'boolean'
      THEN (target_proposal.metadata ->> 'require_external_multisig')::boolean
    ELSE coalesce(policy.is_enabled, false)
  END AS external_multisig_required,
  greatest(1, coalesce(policy.required_external_approvals, 1)) AS required_external_approvals,
  coalesce(active_signers.active_signer_count, 0) AS active_external_signer_count,
  coalesce(external_tally.approvals, 0) AS external_approval_count,
  coalesce(external_tally.rejections, 0) AS external_rejection_count,
  (coalesce(external_tally.approvals, 0) + coalesce(external_tally.rejections, 0)) AS external_decisive_count,
  policy.policy_network,
  policy.policy_contract_reference
FROM target_proposal
LEFT JOIN policy ON true
LEFT JOIN active_signers ON true
LEFT JOIN external_tally ON true;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_proposal_guardian_signoff_summary(
  target_proposal_id uuid
)
RETURNS TABLE (
  requires_guardian_signoff boolean,
  approval_class public.governance_threshold_approval_class,
  required_approvals integer,
  approval_count integer,
  rejection_count integer,
  decisive_count integer,
  requires_window_close boolean,
  meets_signoff boolean
) AS $$
WITH target_proposal AS (
  SELECT
    proposal.id,
    proposal.decision_class,
    proposal.closes_at,
    proposal.metadata,
    coalesce(nullif(proposal.metadata ->> 'execution_action_type', ''), 'manual_follow_through') AS execution_action_type
  FROM public.governance_proposals AS proposal
  WHERE proposal.id = target_proposal_id
  LIMIT 1
),
threshold_rule AS (
  SELECT
    rule.approval_class,
    rule.min_approval_votes,
    rule.requires_window_close
  FROM target_proposal
  CROSS JOIN LATERAL public.resolve_governance_execution_threshold_rule(
    target_proposal.execution_action_type,
    target_proposal.decision_class
  ) AS rule
),
internal_tally AS (
  SELECT
    coalesce(count(*) FILTER (WHERE approval.decision = 'approve'::public.governance_guardian_decision), 0)::integer AS approvals,
    coalesce(count(*) FILTER (WHERE approval.decision = 'reject'::public.governance_guardian_decision), 0)::integer AS rejections
  FROM public.governance_proposal_guardian_approvals AS approval
  JOIN target_proposal ON target_proposal.id = approval.proposal_id
  WHERE public.profile_is_guardian_signer(approval.signer_profile_id)
),
multisig_summary AS (
  SELECT *
  FROM public.governance_proposal_external_multisig_summary(target_proposal_id)
)
SELECT
  (coalesce(threshold_rule.approval_class, 'ordinary_majority'::public.governance_threshold_approval_class)
    = 'guardian_threshold'::public.governance_threshold_approval_class) AS requires_guardian_signoff,
  coalesce(threshold_rule.approval_class, 'ordinary_majority'::public.governance_threshold_approval_class) AS approval_class,
  CASE
    WHEN coalesce(threshold_rule.approval_class, 'ordinary_majority'::public.governance_threshold_approval_class)
      = 'guardian_threshold'::public.governance_threshold_approval_class
    THEN greatest(2, coalesce(threshold_rule.min_approval_votes, 2))
    ELSE 0
  END AS required_approvals,
  (
    coalesce(internal_tally.approvals, 0)
    + CASE WHEN coalesce(multisig_summary.external_multisig_required, false) THEN coalesce(multisig_summary.external_approval_count, 0) ELSE 0 END
  ) AS approval_count,
  (
    coalesce(internal_tally.rejections, 0)
    + CASE WHEN coalesce(multisig_summary.external_multisig_required, false) THEN coalesce(multisig_summary.external_rejection_count, 0) ELSE 0 END
  ) AS rejection_count,
  (
    coalesce(internal_tally.approvals, 0)
    + coalesce(internal_tally.rejections, 0)
    + CASE WHEN coalesce(multisig_summary.external_multisig_required, false) THEN coalesce(multisig_summary.external_decisive_count, 0) ELSE 0 END
  ) AS decisive_count,
  coalesce(threshold_rule.requires_window_close, false) AS requires_window_close,
  CASE
    WHEN coalesce(threshold_rule.approval_class, 'ordinary_majority'::public.governance_threshold_approval_class)
      <> 'guardian_threshold'::public.governance_threshold_approval_class
    THEN true
    WHEN coalesce(threshold_rule.requires_window_close, false)
      AND now() < target_proposal.closes_at
    THEN false
    ELSE (
      (
        coalesce(internal_tally.approvals, 0)
        + CASE WHEN coalesce(multisig_summary.external_multisig_required, false) THEN coalesce(multisig_summary.external_approval_count, 0) ELSE 0 END
      ) >= greatest(2, coalesce(threshold_rule.min_approval_votes, 2))
      AND (
        coalesce(internal_tally.approvals, 0)
        + CASE WHEN coalesce(multisig_summary.external_multisig_required, false) THEN coalesce(multisig_summary.external_approval_count, 0) ELSE 0 END
      ) > (
        coalesce(internal_tally.rejections, 0)
        + CASE WHEN coalesce(multisig_summary.external_multisig_required, false) THEN coalesce(multisig_summary.external_rejection_count, 0) ELSE 0 END
      )
      AND (
        NOT coalesce(multisig_summary.external_multisig_required, false)
        OR coalesce(multisig_summary.external_approval_count, 0) >= coalesce(multisig_summary.required_external_approvals, 1)
      )
    )
  END AS meets_signoff
FROM target_proposal
LEFT JOIN threshold_rule ON true
LEFT JOIN internal_tally ON true
LEFT JOIN multisig_summary ON true;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

ALTER TABLE public.governance_public_audit_batch_items
  DROP CONSTRAINT IF EXISTS governance_public_audit_batch_items_source_check;

ALTER TABLE public.governance_public_audit_batch_items
  ADD CONSTRAINT governance_public_audit_batch_items_source_check CHECK (
    event_source = ANY(
      ARRAY[
        'governance_proposal_events',
        'governance_implementation_logs',
        'governance_proposal_guardian_approvals',
        'governance_proposal_guardian_external_signatures'
      ]
    )
  );

CREATE OR REPLACE FUNCTION public.list_pending_governance_public_audit_events(
  max_events integer DEFAULT 500,
  requested_from timestamptz DEFAULT NULL,
  requested_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  event_position integer,
  event_source text,
  event_id uuid,
  event_created_at timestamptz,
  event_actor_id uuid,
  event_payload jsonb,
  event_digest text
) AS $$
WITH candidate_events AS (
  SELECT
    'governance_proposal_events'::text AS event_source,
    event.id AS event_id,
    event.created_at AS event_created_at,
    event.actor_id AS event_actor_id,
    coalesce(event.payload, '{}'::jsonb) AS event_payload
  FROM public.governance_proposal_events AS event
  WHERE (requested_from IS NULL OR event.created_at >= requested_from)
    AND (requested_to IS NULL OR event.created_at <= requested_to)

  UNION ALL

  SELECT
    'governance_implementation_logs'::text AS event_source,
    log.id AS event_id,
    log.created_at AS event_created_at,
    log.actor_id AS event_actor_id,
    jsonb_build_object(
      'execution_status', log.execution_status,
      'execution_summary', log.execution_summary,
      'details', coalesce(log.details, '{}'::jsonb),
      'proposal_id', log.proposal_id,
      'implementation_id', log.implementation_id
    ) AS event_payload
  FROM public.governance_implementation_logs AS log
  WHERE (requested_from IS NULL OR log.created_at >= requested_from)
    AND (requested_to IS NULL OR log.created_at <= requested_to)

  UNION ALL

  SELECT
    'governance_proposal_guardian_approvals'::text AS event_source,
    approval.id AS event_id,
    approval.signed_at AS event_created_at,
    approval.signer_profile_id AS event_actor_id,
    jsonb_build_object(
      'proposal_id', approval.proposal_id,
      'decision', approval.decision,
      'rationale', approval.rationale,
      'snapshot', coalesce(approval.snapshot, '{}'::jsonb),
      'signed_at', approval.signed_at
    ) AS event_payload
  FROM public.governance_proposal_guardian_approvals AS approval
  WHERE (requested_from IS NULL OR approval.signed_at >= requested_from)
    AND (requested_to IS NULL OR approval.signed_at <= requested_to)

  UNION ALL

  SELECT
    'governance_proposal_guardian_external_signatures'::text AS event_source,
    signature.id AS event_id,
    signature.signed_at AS event_created_at,
    signature.verified_by AS event_actor_id,
    jsonb_build_object(
      'proposal_id', signature.proposal_id,
      'external_signer_id', signature.external_signer_id,
      'decision', signature.decision,
      'payload_hash', signature.payload_hash,
      'signature_reference', signature.signature_reference,
      'verification_method', signature.verification_method,
      'snapshot', coalesce(signature.snapshot, '{}'::jsonb),
      'signed_at', signature.signed_at,
      'verified_at', signature.verified_at
    ) AS event_payload
  FROM public.governance_proposal_guardian_external_signatures AS signature
  WHERE (requested_from IS NULL OR signature.signed_at >= requested_from)
    AND (requested_to IS NULL OR signature.signed_at <= requested_to)
),
unbatched_events AS (
  SELECT candidate.*
  FROM candidate_events AS candidate
  LEFT JOIN public.governance_public_audit_batch_items AS item
    ON item.event_source = candidate.event_source
   AND item.event_id = candidate.event_id
  WHERE item.id IS NULL
),
selected_events AS (
  SELECT *
  FROM unbatched_events
  ORDER BY event_created_at ASC, event_source ASC, event_id ASC
  LIMIT greatest(1, coalesce(max_events, 500))
),
ordered_events AS (
  SELECT
    row_number() OVER (ORDER BY event_created_at ASC, event_source ASC, event_id ASC)::integer AS event_position,
    event_source,
    event_id,
    event_created_at,
    event_actor_id,
    event_payload
  FROM selected_events
)
SELECT
  ordered_events.event_position,
  ordered_events.event_source,
  ordered_events.event_id,
  ordered_events.event_created_at,
  ordered_events.event_actor_id,
  ordered_events.event_payload,
  encode(
    digest(
      concat_ws(
        '|',
        ordered_events.event_source,
        ordered_events.event_id::text,
        to_char(ordered_events.event_created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'),
        coalesce(ordered_events.event_actor_id::text, ''),
        ordered_events.event_payload::text
      ),
      'sha256'
    ),
    'hex'
  ) AS event_digest
FROM ordered_events
ORDER BY ordered_events.event_position ASC;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

GRANT SELECT, INSERT, UPDATE ON public.governance_guardian_multisig_policies TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.governance_guardian_external_signers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.governance_proposal_guardian_external_signatures TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_profile_can_manage_guardian_multisig() TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_proposal_external_multisig_summary(uuid) TO authenticated;

ALTER TABLE public.governance_guardian_multisig_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_guardian_external_signers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_proposal_guardian_external_signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Guardian multisig policies are readable by authenticated users" ON public.governance_guardian_multisig_policies;
CREATE POLICY "Guardian multisig policies are readable by authenticated users" ON public.governance_guardian_multisig_policies
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Guardian multisig policies are updatable by multisig managers" ON public.governance_guardian_multisig_policies;
CREATE POLICY "Guardian multisig policies are updatable by multisig managers" ON public.governance_guardian_multisig_policies
  FOR UPDATE USING (public.current_profile_can_manage_guardian_multisig())
  WITH CHECK (public.current_profile_can_manage_guardian_multisig());

DROP POLICY IF EXISTS "Guardian multisig policies are insertable by multisig managers" ON public.governance_guardian_multisig_policies;
CREATE POLICY "Guardian multisig policies are insertable by multisig managers" ON public.governance_guardian_multisig_policies
  FOR INSERT WITH CHECK (public.current_profile_can_manage_guardian_multisig());

DROP POLICY IF EXISTS "Guardian external signers are readable by authenticated users" ON public.governance_guardian_external_signers;
CREATE POLICY "Guardian external signers are readable by authenticated users" ON public.governance_guardian_external_signers
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Guardian external signers are manageable by multisig managers" ON public.governance_guardian_external_signers;
CREATE POLICY "Guardian external signers are manageable by multisig managers" ON public.governance_guardian_external_signers
  FOR ALL USING (public.current_profile_can_manage_guardian_multisig())
  WITH CHECK (public.current_profile_can_manage_guardian_multisig());

DROP POLICY IF EXISTS "Guardian external signatures are readable by authenticated users" ON public.governance_proposal_guardian_external_signatures;
CREATE POLICY "Guardian external signatures are readable by authenticated users" ON public.governance_proposal_guardian_external_signatures
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Guardian external signatures are insertable by multisig managers" ON public.governance_proposal_guardian_external_signatures;
CREATE POLICY "Guardian external signatures are insertable by multisig managers" ON public.governance_proposal_guardian_external_signatures
  FOR INSERT WITH CHECK (
    public.current_profile_can_manage_guardian_multisig()
    AND NOT public.current_profile_has_governance_block('vote'::public.governance_block_scope)
  );

DROP POLICY IF EXISTS "Guardian external signatures are updatable by multisig managers" ON public.governance_proposal_guardian_external_signatures;
CREATE POLICY "Guardian external signatures are updatable by multisig managers" ON public.governance_proposal_guardian_external_signatures
  FOR UPDATE USING (
    public.current_profile_can_manage_guardian_multisig()
    AND NOT public.current_profile_has_governance_block('vote'::public.governance_block_scope)
  )
  WITH CHECK (
    public.current_profile_can_manage_guardian_multisig()
    AND NOT public.current_profile_has_governance_block('vote'::public.governance_block_scope)
  );
