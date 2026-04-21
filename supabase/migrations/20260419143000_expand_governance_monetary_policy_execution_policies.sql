DROP POLICY IF EXISTS "Active monetary policies are readable by governance units or admins" ON public.monetary_policy_profiles;
DROP POLICY IF EXISTS "Active monetary policies are readable" ON public.monetary_policy_profiles;
CREATE POLICY "Active monetary policies are readable by governance units or admins" ON public.monetary_policy_profiles
  FOR SELECT USING (
    is_active = true
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
    OR EXISTS (
      SELECT 1
      FROM public.governance_execution_unit_memberships AS membership
      JOIN public.governance_execution_units AS unit ON unit.id = membership.unit_id
      WHERE membership.profile_id = public.current_profile_id()
        AND membership.is_active = true
        AND unit.unit_key IN ('treasury_finance', 'policy_legal')
    )
  );

DROP POLICY IF EXISTS "Monetary policies are manageable by governance units or admins" ON public.monetary_policy_profiles;
DROP POLICY IF EXISTS "Monetary policies are manageable by admins" ON public.monetary_policy_profiles;
CREATE POLICY "Monetary policies are manageable by governance units or admins" ON public.monetary_policy_profiles
  FOR ALL USING (
    public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
    OR EXISTS (
      SELECT 1
      FROM public.governance_execution_unit_memberships AS membership
      JOIN public.governance_execution_units AS unit ON unit.id = membership.unit_id
      WHERE membership.profile_id = public.current_profile_id()
        AND membership.is_active = true
        AND unit.unit_key = 'treasury_finance'
    )
  )
  WITH CHECK (
    public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
    OR EXISTS (
      SELECT 1
      FROM public.governance_execution_unit_memberships AS membership
      JOIN public.governance_execution_units AS unit ON unit.id = membership.unit_id
      WHERE membership.profile_id = public.current_profile_id()
        AND membership.is_active = true
        AND unit.unit_key = 'treasury_finance'
    )
  );

DROP POLICY IF EXISTS "Monetary audit events are readable by governance units or admins" ON public.monetary_policy_audit_events;
DROP POLICY IF EXISTS "Monetary audit events are readable by admins" ON public.monetary_policy_audit_events;
CREATE POLICY "Monetary audit events are readable by governance units or admins" ON public.monetary_policy_audit_events
  FOR SELECT USING (
    public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
    OR EXISTS (
      SELECT 1
      FROM public.governance_execution_unit_memberships AS membership
      JOIN public.governance_execution_units AS unit ON unit.id = membership.unit_id
      WHERE membership.profile_id = public.current_profile_id()
        AND membership.is_active = true
        AND unit.unit_key = 'treasury_finance'
    )
  );

DROP POLICY IF EXISTS "Monetary audit events are insertable by governance units or admins" ON public.monetary_policy_audit_events;
DROP POLICY IF EXISTS "Monetary audit events are insertable by admins" ON public.monetary_policy_audit_events;
CREATE POLICY "Monetary audit events are insertable by governance units or admins" ON public.monetary_policy_audit_events
  FOR INSERT WITH CHECK (
    public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
    OR EXISTS (
      SELECT 1
      FROM public.governance_execution_unit_memberships AS membership
      JOIN public.governance_execution_units AS unit ON unit.id = membership.unit_id
      WHERE membership.profile_id = public.current_profile_id()
        AND membership.is_active = true
        AND unit.unit_key = 'treasury_finance'
    )
  );
