DROP POLICY IF EXISTS "Owners can insert linked accounts" ON public.linked_accounts;
CREATE POLICY "Owners can insert linked accounts"
  ON public.linked_accounts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = linked_accounts.owner_profile_id
        AND p.user_id = auth.uid()
    )
    OR public.has_permission('settings.manage'::public.app_permission)
  );
