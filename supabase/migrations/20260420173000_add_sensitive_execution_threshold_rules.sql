DO $$
BEGIN
  CREATE TYPE public.governance_threshold_approval_class AS ENUM (
    'ordinary_majority',
    'supermajority',
    'guardian_threshold'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.governance_execution_threshold_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL,
  decision_class public.governance_decision_class,
  approval_class public.governance_threshold_approval_class NOT NULL DEFAULT 'ordinary_majority',
  min_approval_share numeric(5,2) NOT NULL DEFAULT 0.50,
  min_decisive_votes integer NOT NULL DEFAULT 1,
  min_approval_votes integer NOT NULL DEFAULT 1,
  min_quorum integer NOT NULL DEFAULT 1,
  requires_window_close boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_execution_threshold_rules_action_type_check CHECK (
    action_type = ANY(
      ARRAY[
        'manual_follow_through',
        'grant_role_permission',
        'revoke_role_permission',
        'assign_unit_member',
        'deactivate_unit_member',
        'approve_identity_verification',
        'revoke_identity_verification',
        'activate_citizen_scope',
        'deactivate_citizen_scope',
        'activate_monetary_policy',
        'deactivate_monetary_policy',
        'award_study_certification',
        'revoke_study_certification',
        'approve_content_item',
        'reject_content_item',
        'archive_content_item'
      ]
    )
  ),
  CONSTRAINT governance_execution_threshold_rules_min_approval_share_check CHECK (
    min_approval_share > 0 AND min_approval_share <= 1
  ),
  CONSTRAINT governance_execution_threshold_rules_min_decisive_votes_check CHECK (
    min_decisive_votes >= 1
  ),
  CONSTRAINT governance_execution_threshold_rules_min_approval_votes_check CHECK (
    min_approval_votes >= 1
  ),
  CONSTRAINT governance_execution_threshold_rules_min_quorum_check CHECK (
    min_quorum >= 1
  ),
  CONSTRAINT governance_execution_threshold_rules_approval_votes_le_decisive_check CHECK (
    min_approval_votes <= min_decisive_votes
  ),
  CONSTRAINT governance_execution_threshold_rules_action_decision_unique UNIQUE (
    action_type,
    decision_class
  )
);

CREATE INDEX IF NOT EXISTS idx_governance_execution_threshold_rules_action_active
  ON public.governance_execution_threshold_rules (action_type, is_active, decision_class);

DO $$
BEGIN
  CREATE TRIGGER update_governance_execution_threshold_rules_updated_at
    BEFORE UPDATE ON public.governance_execution_threshold_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO public.governance_execution_threshold_rules (
  action_type,
  decision_class,
  approval_class,
  min_approval_share,
  min_decisive_votes,
  min_approval_votes,
  min_quorum,
  requires_window_close,
  notes,
  metadata
)
VALUES
  (
    'manual_follow_through',
    NULL,
    'ordinary_majority',
    0.50,
    1,
    1,
    1,
    false,
    'Baseline majority rule for non-automated follow-through proposals.',
    jsonb_build_object('source', 'section_14_step_2')
  ),
  (
    'grant_role_permission',
    NULL,
    'guardian_threshold',
    0.67,
    3,
    2,
    3,
    true,
    'Sensitive permission grants require guardian-threshold approval.',
    jsonb_build_object('source', 'section_14_step_2')
  ),
  (
    'revoke_role_permission',
    NULL,
    'guardian_threshold',
    0.67,
    3,
    2,
    3,
    true,
    'Sensitive permission revocations require guardian-threshold approval.',
    jsonb_build_object('source', 'section_14_step_2')
  ),
  (
    'assign_unit_member',
    NULL,
    'supermajority',
    0.60,
    3,
    2,
    3,
    true,
    'Governance unit membership assignments require supermajority approval.',
    jsonb_build_object('source', 'section_14_step_2')
  ),
  (
    'deactivate_unit_member',
    NULL,
    'supermajority',
    0.60,
    3,
    2,
    3,
    true,
    'Governance unit membership removals require supermajority approval.',
    jsonb_build_object('source', 'section_14_step_2')
  ),
  (
    'approve_identity_verification',
    NULL,
    'supermajority',
    0.60,
    3,
    2,
    3,
    true,
    'Identity-verification approvals are threshold-gated due civic sensitivity.',
    jsonb_build_object('source', 'section_14_step_2')
  ),
  (
    'revoke_identity_verification',
    NULL,
    'supermajority',
    0.60,
    3,
    2,
    3,
    true,
    'Identity-verification revocations are threshold-gated due civic sensitivity.',
    jsonb_build_object('source', 'section_14_step_2')
  ),
  (
    'activate_citizen_scope',
    NULL,
    'guardian_threshold',
    0.67,
    3,
    2,
    3,
    true,
    'Citizen activation declarations require guardian-threshold approval.',
    jsonb_build_object('source', 'section_14_step_2')
  ),
  (
    'deactivate_citizen_scope',
    NULL,
    'guardian_threshold',
    0.67,
    3,
    2,
    3,
    true,
    'Citizen deactivation actions require guardian-threshold approval.',
    jsonb_build_object('source', 'section_14_step_2')
  ),
  (
    'activate_monetary_policy',
    NULL,
    'guardian_threshold',
    0.67,
    3,
    2,
    3,
    true,
    'Monetary-policy activation requires guardian-threshold approval.',
    jsonb_build_object('source', 'section_14_step_2')
  ),
  (
    'deactivate_monetary_policy',
    NULL,
    'guardian_threshold',
    0.67,
    3,
    2,
    3,
    true,
    'Monetary-policy deactivation requires guardian-threshold approval.',
    jsonb_build_object('source', 'section_14_step_2')
  ),
  (
    'award_study_certification',
    NULL,
    'ordinary_majority',
    0.50,
    1,
    1,
    1,
    false,
    'Certification awards keep ordinary-majority thresholds.',
    jsonb_build_object('source', 'section_14_step_2')
  ),
  (
    'revoke_study_certification',
    NULL,
    'ordinary_majority',
    0.50,
    1,
    1,
    1,
    false,
    'Certification revocations keep ordinary-majority thresholds.',
    jsonb_build_object('source', 'section_14_step_2')
  ),
  (
    'approve_content_item',
    NULL,
    'ordinary_majority',
    0.50,
    1,
    1,
    1,
    false,
    'Content approvals keep ordinary-majority thresholds.',
    jsonb_build_object('source', 'section_14_step_2')
  ),
  (
    'reject_content_item',
    NULL,
    'ordinary_majority',
    0.50,
    1,
    1,
    1,
    false,
    'Content rejection keeps ordinary-majority thresholds.',
    jsonb_build_object('source', 'section_14_step_2')
  ),
  (
    'archive_content_item',
    NULL,
    'ordinary_majority',
    0.50,
    1,
    1,
    1,
    false,
    'Content archival keeps ordinary-majority thresholds.',
    jsonb_build_object('source', 'section_14_step_2')
  )
ON CONFLICT (action_type, decision_class) DO UPDATE
SET
  approval_class = excluded.approval_class,
  min_approval_share = excluded.min_approval_share,
  min_decisive_votes = excluded.min_decisive_votes,
  min_approval_votes = excluded.min_approval_votes,
  min_quorum = excluded.min_quorum,
  requires_window_close = excluded.requires_window_close,
  is_active = true,
  notes = excluded.notes,
  metadata = excluded.metadata,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.resolve_governance_execution_threshold_rule(
  requested_action_type text,
  requested_decision_class public.governance_decision_class
)
RETURNS TABLE (
  approval_class public.governance_threshold_approval_class,
  min_approval_share numeric,
  min_decisive_votes integer,
  min_approval_votes integer,
  min_quorum integer,
  requires_window_close boolean
) AS $$
  WITH normalized AS (
    SELECT coalesce(nullif(trim(requested_action_type), ''), 'manual_follow_through') AS action_type
  ),
  matched_rule AS (
    SELECT
      rule.approval_class,
      rule.min_approval_share,
      rule.min_decisive_votes,
      rule.min_approval_votes,
      rule.min_quorum,
      rule.requires_window_close
    FROM public.governance_execution_threshold_rules AS rule
    JOIN normalized ON normalized.action_type = rule.action_type
    WHERE rule.is_active = true
      AND (
        rule.decision_class = requested_decision_class
        OR rule.decision_class IS NULL
      )
    ORDER BY CASE WHEN rule.decision_class = requested_decision_class THEN 0 ELSE 1 END, rule.updated_at DESC
    LIMIT 1
  )
  SELECT
    coalesce(
      matched_rule.approval_class,
      CASE requested_decision_class
        WHEN 'constitutional'::public.governance_decision_class THEN 'guardian_threshold'::public.governance_threshold_approval_class
        WHEN 'elevated'::public.governance_decision_class THEN 'supermajority'::public.governance_threshold_approval_class
        ELSE 'ordinary_majority'::public.governance_threshold_approval_class
      END
    ) AS approval_class,
    coalesce(
      matched_rule.min_approval_share,
      CASE requested_decision_class
        WHEN 'constitutional'::public.governance_decision_class THEN 0.67
        WHEN 'elevated'::public.governance_decision_class THEN 0.60
        ELSE 0.50
      END
    )::numeric AS min_approval_share,
    coalesce(
      matched_rule.min_decisive_votes,
      CASE requested_decision_class
        WHEN 'constitutional'::public.governance_decision_class THEN 3
        WHEN 'elevated'::public.governance_decision_class THEN 2
        ELSE 1
      END
    )::integer AS min_decisive_votes,
    coalesce(
      matched_rule.min_approval_votes,
      CASE requested_decision_class
        WHEN 'constitutional'::public.governance_decision_class THEN 2
        WHEN 'elevated'::public.governance_decision_class THEN 2
        ELSE 1
      END
    )::integer AS min_approval_votes,
    coalesce(
      matched_rule.min_quorum,
      CASE requested_decision_class
        WHEN 'constitutional'::public.governance_decision_class THEN 3
        WHEN 'elevated'::public.governance_decision_class THEN 2
        ELSE 1
      END
    )::integer AS min_quorum,
    coalesce(
      matched_rule.requires_window_close,
      requested_decision_class <> 'ordinary'::public.governance_decision_class
    ) AS requires_window_close
  FROM normalized
  LEFT JOIN matched_rule ON true;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_proposal_meets_execution_threshold(
  target_proposal_id uuid
)
RETURNS boolean AS $$
DECLARE
  target_proposal public.governance_proposals%ROWTYPE;
  threshold_rule record;
  approvals integer := 0;
  rejections integer := 0;
  decisive_votes integer := 0;
  required_share numeric := 0.50;
  required_quorum integer := 1;
  required_decisive integer := 1;
  required_approvals integer := 1;
  approval_share numeric := 0;
  execution_action_type text := 'manual_follow_through';
BEGIN
  SELECT *
  INTO target_proposal
  FROM public.governance_proposals
  WHERE id = target_proposal_id
  LIMIT 1;

  IF target_proposal.id IS NULL THEN
    RETURN false;
  END IF;

  IF jsonb_typeof(target_proposal.metadata) = 'object'
    AND target_proposal.metadata ? 'execution_action_type'
    AND nullif(target_proposal.metadata ->> 'execution_action_type', '') IS NOT NULL
  THEN
    execution_action_type := target_proposal.metadata ->> 'execution_action_type';
  END IF;

  SELECT *
  INTO threshold_rule
  FROM public.resolve_governance_execution_threshold_rule(
    execution_action_type,
    target_proposal.decision_class
  );

  SELECT
    coalesce(sum(CASE WHEN vote.choice = 'approve'::public.governance_vote_choice THEN vote.weight ELSE 0 END), 0)::integer,
    coalesce(sum(CASE WHEN vote.choice = 'reject'::public.governance_vote_choice THEN vote.weight ELSE 0 END), 0)::integer,
    coalesce(sum(CASE WHEN vote.choice IN ('approve'::public.governance_vote_choice, 'reject'::public.governance_vote_choice) THEN vote.weight ELSE 0 END), 0)::integer
  INTO approvals, rejections, decisive_votes
  FROM public.governance_proposal_votes AS vote
  WHERE vote.proposal_id = target_proposal.id;

  required_share := greatest(
    coalesce(target_proposal.approval_threshold, 0.50),
    coalesce(threshold_rule.min_approval_share, 0.50)
  );

  required_quorum := greatest(
    coalesce(target_proposal.required_quorum, 1),
    coalesce(threshold_rule.min_quorum, 1)
  );

  required_decisive := greatest(
    required_quorum,
    coalesce(threshold_rule.min_decisive_votes, 1)
  );

  required_approvals := greatest(
    coalesce(threshold_rule.min_approval_votes, 1),
    ceil(required_decisive * required_share)::integer
  );

  IF coalesce(threshold_rule.requires_window_close, false)
    AND now() < target_proposal.closes_at
  THEN
    RETURN false;
  END IF;

  IF decisive_votes <= 0 THEN
    RETURN false;
  END IF;

  approval_share := approvals::numeric / decisive_votes::numeric;

  RETURN (
    decisive_votes >= required_decisive
    AND approvals > rejections
    AND approvals >= required_approvals
    AND approval_share >= required_share
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

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
    ),
    false
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.prevent_governance_proposal_threshold_field_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'open'::public.governance_proposal_status
    AND (
      NEW.decision_class IS DISTINCT FROM OLD.decision_class
      OR NEW.proposal_type IS DISTINCT FROM OLD.proposal_type
      OR NEW.approval_threshold IS DISTINCT FROM OLD.approval_threshold
      OR NEW.required_quorum IS DISTINCT FROM OLD.required_quorum
      OR NEW.opens_at IS DISTINCT FROM OLD.opens_at
      OR NEW.closes_at IS DISTINCT FROM OLD.closes_at
      OR coalesce(NEW.metadata ->> 'execution_action_type', '') IS DISTINCT FROM coalesce(OLD.metadata ->> 'execution_action_type', '')
    )
  THEN
    RAISE EXCEPTION 'Threshold-sensitive governance proposal fields are immutable after creation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS prevent_governance_proposal_threshold_field_mutation_trigger ON public.governance_proposals;
CREATE TRIGGER prevent_governance_proposal_threshold_field_mutation_trigger
  BEFORE UPDATE ON public.governance_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_governance_proposal_threshold_field_mutation();

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
      OR public.governance_proposal_meets_execution_threshold(id)
    )
  );

DROP POLICY IF EXISTS "Governance implementations are insertable by current profile" ON public.governance_proposal_implementations;
CREATE POLICY "Governance implementations are insertable by current profile" ON public.governance_proposal_implementations
  FOR INSERT WITH CHECK (
    public.governance_proposal_is_execution_ready(proposal_id)
    AND NOT public.current_profile_has_governance_block('execution'::public.governance_block_scope)
    AND (
      created_by = public.current_profile_id()
      OR (
        created_by IS NULL
        AND (
          public.has_permission('role.assign'::public.app_permission)
          OR public.has_permission('settings.manage'::public.app_permission)
        )
      )
    )
  );

DROP POLICY IF EXISTS "Governance implementations are updatable by unit members or admins" ON public.governance_proposal_implementations;
CREATE POLICY "Governance implementations are updatable by unit members or admins" ON public.governance_proposal_implementations
  FOR UPDATE USING (
    public.governance_proposal_is_execution_ready(governance_proposal_implementations.proposal_id)
    AND NOT public.current_profile_has_governance_block('execution'::public.governance_block_scope)
    AND (
      public.has_permission('role.assign'::public.app_permission)
      OR public.has_permission('settings.manage'::public.app_permission)
      OR EXISTS (
        SELECT 1
        FROM public.governance_execution_unit_memberships AS membership
        WHERE membership.unit_id = governance_proposal_implementations.unit_id
          AND membership.profile_id = public.current_profile_id()
          AND membership.is_active = true
      )
    )
  )
  WITH CHECK (
    public.governance_proposal_is_execution_ready(governance_proposal_implementations.proposal_id)
    AND NOT public.current_profile_has_governance_block('execution'::public.governance_block_scope)
    AND (
      public.has_permission('role.assign'::public.app_permission)
      OR public.has_permission('settings.manage'::public.app_permission)
      OR EXISTS (
        SELECT 1
        FROM public.governance_execution_unit_memberships AS membership
        WHERE membership.unit_id = governance_proposal_implementations.unit_id
          AND membership.profile_id = public.current_profile_id()
          AND membership.is_active = true
      )
    )
  );

DROP POLICY IF EXISTS "Governance implementation logs are insertable by current profile" ON public.governance_implementation_logs;
CREATE POLICY "Governance implementation logs are insertable by current profile" ON public.governance_implementation_logs
  FOR INSERT WITH CHECK (
    public.governance_proposal_is_execution_ready(proposal_id)
    AND NOT public.current_profile_has_governance_block('execution'::public.governance_block_scope)
    AND (
      actor_id = public.current_profile_id()
      OR (
        actor_id IS NULL
        AND (
          public.has_permission('role.assign'::public.app_permission)
          OR public.has_permission('settings.manage'::public.app_permission)
        )
      )
    )
  );

GRANT SELECT ON public.governance_execution_threshold_rules TO authenticated;
GRANT INSERT, UPDATE ON public.governance_execution_threshold_rules TO authenticated;

GRANT EXECUTE ON FUNCTION public.resolve_governance_execution_threshold_rule(text, public.governance_decision_class) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_proposal_meets_execution_threshold(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_proposal_is_execution_ready(uuid) TO authenticated;

ALTER TABLE public.governance_execution_threshold_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Governance execution threshold rules are readable by authenticated users" ON public.governance_execution_threshold_rules;
CREATE POLICY "Governance execution threshold rules are readable by authenticated users" ON public.governance_execution_threshold_rules
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Governance execution threshold rules are manageable by threshold stewards" ON public.governance_execution_threshold_rules;
CREATE POLICY "Governance execution threshold rules are manageable by threshold stewards" ON public.governance_execution_threshold_rules
  FOR ALL USING (
    public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.current_profile_in_governance_domain(ARRAY['constitutional_review', 'policy_legal', 'civic_operations'])
  )
  WITH CHECK (
    public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.current_profile_in_governance_domain(ARRAY['constitutional_review', 'policy_legal', 'civic_operations'])
  );
