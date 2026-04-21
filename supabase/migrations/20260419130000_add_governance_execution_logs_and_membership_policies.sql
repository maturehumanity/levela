CREATE TABLE IF NOT EXISTS public.governance_implementation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  implementation_id uuid NOT NULL REFERENCES public.governance_proposal_implementations(id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL REFERENCES public.governance_proposals(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  execution_status public.governance_implementation_status NOT NULL,
  execution_summary text NOT NULL DEFAULT '',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_governance_implementation_logs_implementation
  ON public.governance_implementation_logs (implementation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_implementation_logs_proposal
  ON public.governance_implementation_logs (proposal_id, created_at DESC);

GRANT INSERT, UPDATE ON public.governance_execution_unit_memberships TO authenticated;
GRANT SELECT, INSERT ON public.governance_implementation_logs TO authenticated;

ALTER TABLE public.governance_implementation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Governance execution unit memberships are manageable by admins" ON public.governance_execution_unit_memberships;
CREATE POLICY "Governance execution unit memberships are manageable by admins" ON public.governance_execution_unit_memberships
  FOR ALL USING (
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
  )
  WITH CHECK (
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
  );

DROP POLICY IF EXISTS "Governance implementations are updatable by unit members or admins" ON public.governance_proposal_implementations;
DROP POLICY IF EXISTS "Governance implementations are updatable by admins" ON public.governance_proposal_implementations;
CREATE POLICY "Governance implementations are updatable by unit members or admins" ON public.governance_proposal_implementations
  FOR UPDATE USING (
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
  WITH CHECK (
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR EXISTS (
      SELECT 1
      FROM public.governance_execution_unit_memberships AS membership
      WHERE membership.unit_id = governance_proposal_implementations.unit_id
        AND membership.profile_id = public.current_profile_id()
        AND membership.is_active = true
    )
  );

DROP POLICY IF EXISTS "Governance implementation logs are readable by authenticated users" ON public.governance_implementation_logs;
CREATE POLICY "Governance implementation logs are readable by authenticated users" ON public.governance_implementation_logs
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Governance implementation logs are insertable by current profile" ON public.governance_implementation_logs;
CREATE POLICY "Governance implementation logs are insertable by current profile" ON public.governance_implementation_logs
  FOR INSERT WITH CHECK (
    actor_id = public.current_profile_id()
    OR (
      actor_id IS NULL
      AND (
        public.has_permission('role.assign'::public.app_permission)
        OR public.has_permission('settings.manage'::public.app_permission)
      )
    )
  );
