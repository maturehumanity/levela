DROP POLICY IF EXISTS "Study certifications are readable by governance units or owner" ON public.study_certifications;
DROP POLICY IF EXISTS "Study certifications are owned by current user" ON public.study_certifications;
CREATE POLICY "Study certifications are readable by governance units or owner" ON public.study_certifications
  FOR SELECT USING (
    profile_id = public.current_profile_id()
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
    OR EXISTS (
      SELECT 1
      FROM public.governance_execution_unit_memberships AS membership
      JOIN public.governance_execution_units AS unit ON unit.id = membership.unit_id
      WHERE membership.profile_id = public.current_profile_id()
        AND membership.is_active = true
        AND unit.unit_key IN ('civic_operations', 'constitutional_council')
    )
  );

DROP POLICY IF EXISTS "Study certifications are manageable by governance units or owner" ON public.study_certifications;
CREATE POLICY "Study certifications are manageable by governance units or owner" ON public.study_certifications
  FOR ALL USING (
    profile_id = public.current_profile_id()
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
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
    profile_id = public.current_profile_id()
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
    OR EXISTS (
      SELECT 1
      FROM public.governance_execution_unit_memberships AS membership
      JOIN public.governance_execution_units AS unit ON unit.id = membership.unit_id
      WHERE membership.profile_id = public.current_profile_id()
        AND membership.is_active = true
        AND unit.unit_key IN ('civic_operations', 'constitutional_council')
    )
  );

DROP POLICY IF EXISTS "Approved or owned content is readable by governance units" ON public.content_items;
DROP POLICY IF EXISTS "Approved or owned content is readable" ON public.content_items;
CREATE POLICY "Approved or owned content is readable by governance units" ON public.content_items
  FOR SELECT USING (
    review_status = 'approved'::public.content_review_status
    OR author_id = public.current_profile_id()
    OR public.has_permission('content.review'::public.app_permission)
    OR public.has_permission('content.moderate'::public.app_permission)
    OR EXISTS (
      SELECT 1
      FROM public.governance_execution_unit_memberships AS membership
      JOIN public.governance_execution_units AS unit ON unit.id = membership.unit_id
      WHERE membership.profile_id = public.current_profile_id()
        AND membership.is_active = true
        AND unit.unit_key IN ('policy_legal', 'constitutional_council')
    )
  );

DROP POLICY IF EXISTS "Authors and reviewers can update content items with governance units" ON public.content_items;
DROP POLICY IF EXISTS "Authors and reviewers can update content items" ON public.content_items;
CREATE POLICY "Authors and reviewers can update content items with governance units" ON public.content_items
  FOR UPDATE USING (
    author_id = public.current_profile_id()
    OR public.has_permission('content.review'::public.app_permission)
    OR public.has_permission('content.moderate'::public.app_permission)
    OR EXISTS (
      SELECT 1
      FROM public.governance_execution_unit_memberships AS membership
      JOIN public.governance_execution_units AS unit ON unit.id = membership.unit_id
      WHERE membership.profile_id = public.current_profile_id()
        AND membership.is_active = true
        AND unit.unit_key IN ('policy_legal', 'constitutional_council')
    )
  )
  WITH CHECK (
    author_id = public.current_profile_id()
    OR public.has_permission('content.review'::public.app_permission)
    OR public.has_permission('content.moderate'::public.app_permission)
    OR EXISTS (
      SELECT 1
      FROM public.governance_execution_unit_memberships AS membership
      JOIN public.governance_execution_units AS unit ON unit.id = membership.unit_id
      WHERE membership.profile_id = public.current_profile_id()
        AND membership.is_active = true
        AND unit.unit_key IN ('policy_legal', 'constitutional_council')
    )
  );
