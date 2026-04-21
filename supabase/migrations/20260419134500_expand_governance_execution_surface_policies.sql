GRANT INSERT, UPDATE, DELETE ON public.citizen_activation_scopes TO authenticated;

DROP POLICY IF EXISTS "Citizen activation scopes are readable by governance units or admins" ON public.citizen_activation_scopes;
DROP POLICY IF EXISTS "Citizen activation scopes are readable by owner or admins" ON public.citizen_activation_scopes;
CREATE POLICY "Citizen activation scopes are readable by governance units or admins" ON public.citizen_activation_scopes
  FOR SELECT USING (
    profile_id = public.current_profile_id()
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR EXISTS (
      SELECT 1
      FROM public.governance_execution_unit_memberships AS membership
      JOIN public.governance_execution_units AS unit ON unit.id = membership.unit_id
      WHERE membership.profile_id = public.current_profile_id()
        AND membership.is_active = true
        AND unit.unit_key IN ('civic_operations', 'constitutional_council')
    )
  );

DROP POLICY IF EXISTS "Citizen activation scopes are manageable by governance units or admins" ON public.citizen_activation_scopes;
DROP POLICY IF EXISTS "Citizen activation scopes are manageable by admins" ON public.citizen_activation_scopes;
CREATE POLICY "Citizen activation scopes are manageable by governance units or admins" ON public.citizen_activation_scopes
  FOR ALL USING (
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR EXISTS (
      SELECT 1
      FROM public.governance_execution_unit_memberships AS membership
      JOIN public.governance_execution_units AS unit ON unit.id = membership.unit_id
      WHERE membership.profile_id = public.current_profile_id()
        AND membership.is_active = true
        AND unit.unit_key IN ('civic_operations', 'constitutional_council')
    )
  )
  WITH CHECK (
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR EXISTS (
      SELECT 1
      FROM public.governance_execution_unit_memberships AS membership
      JOIN public.governance_execution_units AS unit ON unit.id = membership.unit_id
      WHERE membership.profile_id = public.current_profile_id()
        AND membership.is_active = true
        AND unit.unit_key IN ('civic_operations', 'constitutional_council')
    )
  );

DROP POLICY IF EXISTS "Identity verification cases are readable by governance units or admins" ON public.identity_verification_cases;
DROP POLICY IF EXISTS "Identity verification cases are readable by owner or admins" ON public.identity_verification_cases;
CREATE POLICY "Identity verification cases are readable by governance units or admins" ON public.identity_verification_cases
  FOR SELECT USING (
    profile_id = public.current_profile_id()
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR EXISTS (
      SELECT 1
      FROM public.governance_execution_unit_memberships AS membership
      JOIN public.governance_execution_units AS unit ON unit.id = membership.unit_id
      WHERE membership.profile_id = public.current_profile_id()
        AND membership.is_active = true
        AND unit.unit_key = 'identity_verification'
    )
  );

DROP POLICY IF EXISTS "Identity verification cases are insertable by governance units or admins" ON public.identity_verification_cases;
DROP POLICY IF EXISTS "Identity verification cases are insertable by owner or admins" ON public.identity_verification_cases;
CREATE POLICY "Identity verification cases are insertable by governance units or admins" ON public.identity_verification_cases
  FOR INSERT WITH CHECK (
    profile_id = public.current_profile_id()
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR EXISTS (
      SELECT 1
      FROM public.governance_execution_unit_memberships AS membership
      JOIN public.governance_execution_units AS unit ON unit.id = membership.unit_id
      WHERE membership.profile_id = public.current_profile_id()
        AND membership.is_active = true
        AND unit.unit_key = 'identity_verification'
    )
  );

DROP POLICY IF EXISTS "Identity verification cases are updatable by governance units or admins" ON public.identity_verification_cases;
DROP POLICY IF EXISTS "Identity verification cases are updatable by owner or admins" ON public.identity_verification_cases;
CREATE POLICY "Identity verification cases are updatable by governance units or admins" ON public.identity_verification_cases
  FOR UPDATE USING (
    profile_id = public.current_profile_id()
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR EXISTS (
      SELECT 1
      FROM public.governance_execution_unit_memberships AS membership
      JOIN public.governance_execution_units AS unit ON unit.id = membership.unit_id
      WHERE membership.profile_id = public.current_profile_id()
        AND membership.is_active = true
        AND unit.unit_key = 'identity_verification'
    )
  )
  WITH CHECK (
    profile_id = public.current_profile_id()
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR EXISTS (
      SELECT 1
      FROM public.governance_execution_unit_memberships AS membership
      JOIN public.governance_execution_units AS unit ON unit.id = membership.unit_id
      WHERE membership.profile_id = public.current_profile_id()
        AND membership.is_active = true
        AND unit.unit_key = 'identity_verification'
    )
  );

DROP POLICY IF EXISTS "Identity verification reviews are insertable by governance units or admins" ON public.identity_verification_reviews;
DROP POLICY IF EXISTS "Identity verification reviews are insertable by admins" ON public.identity_verification_reviews;
CREATE POLICY "Identity verification reviews are insertable by governance units or admins" ON public.identity_verification_reviews
  FOR INSERT WITH CHECK (
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR EXISTS (
      SELECT 1
      FROM public.governance_execution_unit_memberships AS membership
      JOIN public.governance_execution_units AS unit ON unit.id = membership.unit_id
      WHERE membership.profile_id = public.current_profile_id()
        AND membership.is_active = true
        AND unit.unit_key = 'identity_verification'
    )
  );
