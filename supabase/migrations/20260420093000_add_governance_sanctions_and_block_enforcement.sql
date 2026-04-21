DO $$
BEGIN
  CREATE TYPE public.governance_block_scope AS ENUM (
    'proposal_create',
    'vote',
    'verification_review',
    'execution'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.governance_sanctions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT '',
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  issued_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  lifted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  lifted_at timestamptz,
  blocks_governance_all boolean NOT NULL DEFAULT true,
  blocks_proposal_creation boolean NOT NULL DEFAULT false,
  blocks_voting boolean NOT NULL DEFAULT false,
  blocks_verification_review boolean NOT NULL DEFAULT false,
  blocks_execution boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_sanctions_window_check CHECK (
    ends_at IS NULL OR ends_at > starts_at
  ),
  CONSTRAINT governance_sanctions_scope_check CHECK (
    blocks_governance_all
    OR blocks_proposal_creation
    OR blocks_voting
    OR blocks_verification_review
    OR blocks_execution
  )
);

CREATE INDEX IF NOT EXISTS idx_governance_sanctions_profile_active
  ON public.governance_sanctions (profile_id, is_active, starts_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_sanctions_active_window
  ON public.governance_sanctions (is_active, starts_at DESC, ends_at);

DO $$
BEGIN
  CREATE TRIGGER update_governance_sanctions_updated_at
    BEFORE UPDATE ON public.governance_sanctions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.current_profile_in_governance_unit(unit_keys text[])
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.governance_execution_unit_memberships AS membership
    JOIN public.governance_execution_units AS unit ON unit.id = membership.unit_id
    WHERE membership.profile_id = public.current_profile_id()
      AND membership.is_active = true
      AND unit.is_active = true
      AND unit.unit_key = ANY(coalesce(unit_keys, '{}'::text[]))
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.profile_has_governance_block(
  target_profile_id uuid,
  requested_scope public.governance_block_scope
)
RETURNS boolean AS $$
  SELECT coalesce(
    target_profile_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.governance_sanctions AS sanction
      WHERE sanction.profile_id = target_profile_id
        AND sanction.is_active = true
        AND sanction.starts_at <= now()
        AND (sanction.ends_at IS NULL OR sanction.ends_at > now())
        AND (
          sanction.blocks_governance_all
          OR (
            requested_scope = 'proposal_create'::public.governance_block_scope
            AND sanction.blocks_proposal_creation
          )
          OR (
            requested_scope = 'vote'::public.governance_block_scope
            AND sanction.blocks_voting
          )
          OR (
            requested_scope = 'verification_review'::public.governance_block_scope
            AND sanction.blocks_verification_review
          )
          OR (
            requested_scope = 'execution'::public.governance_block_scope
            AND sanction.blocks_execution
          )
        )
    ),
    false
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.current_profile_has_governance_block(
  requested_scope public.governance_block_scope
)
RETURNS boolean AS $$
  SELECT public.profile_has_governance_block(public.current_profile_id(), requested_scope);
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

GRANT SELECT, INSERT, UPDATE ON public.governance_sanctions TO authenticated;

ALTER TABLE public.governance_sanctions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Governance sanctions are readable by owner or stewards" ON public.governance_sanctions;
CREATE POLICY "Governance sanctions are readable by owner or stewards" ON public.governance_sanctions
  FOR SELECT USING (
    profile_id = public.current_profile_id()
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.current_profile_in_governance_unit(
      ARRAY['constitutional_council', 'security_response', 'civic_operations']
    )
  );

DROP POLICY IF EXISTS "Governance sanctions are manageable by stewards" ON public.governance_sanctions;
CREATE POLICY "Governance sanctions are manageable by stewards" ON public.governance_sanctions
  FOR ALL USING (
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.current_profile_in_governance_unit(
      ARRAY['constitutional_council', 'security_response', 'civic_operations']
    )
  )
  WITH CHECK (
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.current_profile_in_governance_unit(
      ARRAY['constitutional_council', 'security_response', 'civic_operations']
    )
  );

DROP POLICY IF EXISTS "Governance proposals are insertable by current profile" ON public.governance_proposals;
CREATE POLICY "Governance proposals are insertable by current profile" ON public.governance_proposals
  FOR INSERT WITH CHECK (
    proposer_id = public.current_profile_id()
    AND NOT public.current_profile_has_governance_block('proposal_create'::public.governance_block_scope)
  );

DROP POLICY IF EXISTS "Governance votes are insertable by voter" ON public.governance_proposal_votes;
CREATE POLICY "Governance votes are insertable by voter" ON public.governance_proposal_votes
  FOR INSERT WITH CHECK (
    voter_id = public.current_profile_id()
    AND NOT public.current_profile_has_governance_block('vote'::public.governance_block_scope)
  );

DROP POLICY IF EXISTS "Governance votes are updatable by voter" ON public.governance_proposal_votes;
CREATE POLICY "Governance votes are updatable by voter" ON public.governance_proposal_votes
  FOR UPDATE USING (
    voter_id = public.current_profile_id()
    AND NOT public.current_profile_has_governance_block('vote'::public.governance_block_scope)
  )
  WITH CHECK (
    voter_id = public.current_profile_id()
    AND NOT public.current_profile_has_governance_block('vote'::public.governance_block_scope)
  );

DROP POLICY IF EXISTS "Identity verification cases are insertable by governance units or admins" ON public.identity_verification_cases;
CREATE POLICY "Identity verification cases are insertable by governance units or admins" ON public.identity_verification_cases
  FOR INSERT WITH CHECK (
    profile_id = public.current_profile_id()
    OR (
      NOT public.current_profile_has_governance_block('verification_review'::public.governance_block_scope)
      AND (
        public.has_permission('role.assign'::public.app_permission)
        OR public.has_permission('settings.manage'::public.app_permission)
        OR public.current_profile_in_governance_unit(ARRAY['identity_verification'])
      )
    )
  );

DROP POLICY IF EXISTS "Identity verification cases are updatable by governance units or admins" ON public.identity_verification_cases;
CREATE POLICY "Identity verification cases are updatable by governance units or admins" ON public.identity_verification_cases
  FOR UPDATE USING (
    profile_id = public.current_profile_id()
    OR (
      NOT public.current_profile_has_governance_block('verification_review'::public.governance_block_scope)
      AND (
        public.has_permission('role.assign'::public.app_permission)
        OR public.has_permission('settings.manage'::public.app_permission)
        OR public.current_profile_in_governance_unit(ARRAY['identity_verification'])
      )
    )
  )
  WITH CHECK (
    profile_id = public.current_profile_id()
    OR (
      NOT public.current_profile_has_governance_block('verification_review'::public.governance_block_scope)
      AND (
        public.has_permission('role.assign'::public.app_permission)
        OR public.has_permission('settings.manage'::public.app_permission)
        OR public.current_profile_in_governance_unit(ARRAY['identity_verification'])
      )
    )
  );

DROP POLICY IF EXISTS "Identity verification reviews are insertable by governance units or admins" ON public.identity_verification_reviews;
CREATE POLICY "Identity verification reviews are insertable by governance units or admins" ON public.identity_verification_reviews
  FOR INSERT WITH CHECK (
    NOT public.current_profile_has_governance_block('verification_review'::public.governance_block_scope)
    AND (
      public.has_permission('role.assign'::public.app_permission)
      OR public.has_permission('settings.manage'::public.app_permission)
      OR public.current_profile_in_governance_unit(ARRAY['identity_verification'])
    )
  );

DROP POLICY IF EXISTS "Governance implementations are insertable by current profile" ON public.governance_proposal_implementations;
CREATE POLICY "Governance implementations are insertable by current profile" ON public.governance_proposal_implementations
  FOR INSERT WITH CHECK (
    NOT public.current_profile_has_governance_block('execution'::public.governance_block_scope)
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
    NOT public.current_profile_has_governance_block('execution'::public.governance_block_scope)
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
    NOT public.current_profile_has_governance_block('execution'::public.governance_block_scope)
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
    NOT public.current_profile_has_governance_block('execution'::public.governance_block_scope)
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
