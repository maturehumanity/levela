DO $$
BEGIN
  CREATE TYPE public.governance_guardian_decision AS ENUM (
    'approve',
    'reject'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.governance_proposal_guardian_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.governance_proposals(id) ON DELETE CASCADE,
  signer_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  decision public.governance_guardian_decision NOT NULL,
  rationale text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  signed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_proposal_guardian_approvals_snapshot_object_check CHECK (
    jsonb_typeof(snapshot) = 'object'
  ),
  CONSTRAINT governance_proposal_guardian_approvals_unique_signer UNIQUE (proposal_id, signer_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_governance_proposal_guardian_approvals_proposal_signed
  ON public.governance_proposal_guardian_approvals (proposal_id, signed_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_proposal_guardian_approvals_signer_signed
  ON public.governance_proposal_guardian_approvals (signer_profile_id, signed_at DESC, created_at DESC);

DO $$
BEGIN
  CREATE TRIGGER update_governance_proposal_guardian_approvals_updated_at
    BEFORE UPDATE ON public.governance_proposal_guardian_approvals
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.profile_is_guardian_signer(
  target_profile_id uuid
)
RETURNS boolean AS $$
  SELECT coalesce(
    target_profile_id IS NOT NULL
    AND NOT public.profile_has_governance_block(target_profile_id, 'vote'::public.governance_block_scope)
    AND NOT public.profile_has_governance_block(target_profile_id, 'execution'::public.governance_block_scope)
    AND (
      public.profile_has_governance_domain_role(
        target_profile_id,
        ARRAY['constitutional_review'],
        ARRAY['domain_lead', 'reviewer']
      )
      OR public.profile_has_constitutional_office(
        target_profile_id,
        'founder'::public.constitutional_office_key
      )
    ),
    false
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.current_profile_is_guardian_signer()
RETURNS boolean AS $$
  SELECT public.profile_is_guardian_signer(public.current_profile_id());
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
guardian_tally AS (
  SELECT
    coalesce(count(*) FILTER (WHERE approval.decision = 'approve'::public.governance_guardian_decision), 0)::integer AS approvals,
    coalesce(count(*) FILTER (WHERE approval.decision = 'reject'::public.governance_guardian_decision), 0)::integer AS rejections
  FROM public.governance_proposal_guardian_approvals AS approval
  JOIN target_proposal ON target_proposal.id = approval.proposal_id
  WHERE public.profile_is_guardian_signer(approval.signer_profile_id)
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
  coalesce(guardian_tally.approvals, 0) AS approval_count,
  coalesce(guardian_tally.rejections, 0) AS rejection_count,
  (coalesce(guardian_tally.approvals, 0) + coalesce(guardian_tally.rejections, 0)) AS decisive_count,
  coalesce(threshold_rule.requires_window_close, false) AS requires_window_close,
  CASE
    WHEN coalesce(threshold_rule.approval_class, 'ordinary_majority'::public.governance_threshold_approval_class)
      <> 'guardian_threshold'::public.governance_threshold_approval_class
    THEN true
    WHEN coalesce(threshold_rule.requires_window_close, false)
      AND now() < target_proposal.closes_at
    THEN false
    ELSE (
      coalesce(guardian_tally.approvals, 0) >= greatest(2, coalesce(threshold_rule.min_approval_votes, 2))
      AND coalesce(guardian_tally.approvals, 0) > coalesce(guardian_tally.rejections, 0)
    )
  END AS meets_signoff
FROM target_proposal
LEFT JOIN threshold_rule ON true
LEFT JOIN guardian_tally ON true;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_proposal_requires_guardian_signoff(
  target_proposal_id uuid
)
RETURNS boolean AS $$
  SELECT coalesce(
    (
      SELECT summary.requires_guardian_signoff
      FROM public.governance_proposal_guardian_signoff_summary(target_proposal_id) AS summary
      LIMIT 1
    ),
    false
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_proposal_meets_guardian_signoff(
  target_proposal_id uuid
)
RETURNS boolean AS $$
  SELECT coalesce(
    (
      SELECT summary.meets_signoff
      FROM public.governance_proposal_guardian_signoff_summary(target_proposal_id) AS summary
      LIMIT 1
    ),
    false
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.enforce_governance_guardian_signoff_row_integrity()
RETURNS TRIGGER AS $$
DECLARE
  proposal_status public.governance_proposal_status;
BEGIN
  IF TG_OP = 'UPDATE'
    AND (
      NEW.proposal_id IS DISTINCT FROM OLD.proposal_id
      OR NEW.signer_profile_id IS DISTINCT FROM OLD.signer_profile_id
    )
  THEN
    RAISE EXCEPTION 'Guardian signoff proposal and signer bindings are immutable';
  END IF;

  SELECT proposal.status
  INTO proposal_status
  FROM public.governance_proposals AS proposal
  WHERE proposal.id = NEW.proposal_id
  LIMIT 1;

  IF proposal_status IS NULL THEN
    RAISE EXCEPTION 'Guardian signoff proposal does not exist';
  END IF;

  IF proposal_status <> 'open'::public.governance_proposal_status THEN
    RAISE EXCEPTION 'Guardian signoffs can only be updated while proposal is open';
  END IF;

  IF NOT public.profile_is_guardian_signer(NEW.signer_profile_id) THEN
    RAISE EXCEPTION 'Guardian signoff requires an active guardian signer';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS enforce_governance_guardian_signoff_row_integrity_trigger ON public.governance_proposal_guardian_approvals;
CREATE TRIGGER enforce_governance_guardian_signoff_row_integrity_trigger
  BEFORE INSERT OR UPDATE ON public.governance_proposal_guardian_approvals
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_governance_guardian_signoff_row_integrity();

CREATE OR REPLACE FUNCTION public.governance_proposal_is_execution_ready(
  target_proposal_id uuid
)
RETURNS boolean AS $$
  SELECT coalesce(
    EXISTS (
      SELECT 1
      FROM public.governance_proposals AS proposal
      WHERE proposal.id = target_proposal_id
        AND proposal.status = 'approved'::public.governance_proposal_status
        AND public.governance_proposal_meets_execution_threshold(proposal.id)
        AND public.governance_proposal_meets_guardian_signoff(proposal.id)
    ),
    false
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS "Governance proposals are updatable by proposer or admins" ON public.governance_proposals;
CREATE POLICY "Governance proposals are updatable by proposer or admins" ON public.governance_proposals
  FOR UPDATE USING (
    proposer_id = public.current_profile_id()
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
  )
  WITH CHECK (
    (
      proposer_id = public.current_profile_id()
      OR public.has_permission('role.assign'::public.app_permission)
      OR public.has_permission('settings.manage'::public.app_permission)
    )
    AND (
      status <> 'approved'::public.governance_proposal_status
      OR (
        public.governance_proposal_meets_execution_threshold(id)
        AND public.governance_proposal_meets_guardian_signoff(id)
      )
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.governance_proposal_guardian_approvals TO authenticated;

GRANT EXECUTE ON FUNCTION public.profile_is_guardian_signer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_profile_is_guardian_signer() TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_proposal_guardian_signoff_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_proposal_requires_guardian_signoff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_proposal_meets_guardian_signoff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_proposal_is_execution_ready(uuid) TO authenticated;

ALTER TABLE public.governance_proposal_guardian_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Governance guardian approvals are readable by authenticated users" ON public.governance_proposal_guardian_approvals;
CREATE POLICY "Governance guardian approvals are readable by authenticated users" ON public.governance_proposal_guardian_approvals
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Governance guardian approvals are insertable by guardian signer" ON public.governance_proposal_guardian_approvals;
CREATE POLICY "Governance guardian approvals are insertable by guardian signer" ON public.governance_proposal_guardian_approvals
  FOR INSERT WITH CHECK (
    signer_profile_id = public.current_profile_id()
    AND public.current_profile_is_guardian_signer()
    AND NOT public.current_profile_has_governance_block('vote'::public.governance_block_scope)
  );

DROP POLICY IF EXISTS "Governance guardian approvals are updatable by guardian signer" ON public.governance_proposal_guardian_approvals;
CREATE POLICY "Governance guardian approvals are updatable by guardian signer" ON public.governance_proposal_guardian_approvals
  FOR UPDATE USING (
    signer_profile_id = public.current_profile_id()
    AND public.current_profile_is_guardian_signer()
    AND NOT public.current_profile_has_governance_block('vote'::public.governance_block_scope)
  )
  WITH CHECK (
    signer_profile_id = public.current_profile_id()
    AND public.current_profile_is_guardian_signer()
    AND NOT public.current_profile_has_governance_block('vote'::public.governance_block_scope)
  );
