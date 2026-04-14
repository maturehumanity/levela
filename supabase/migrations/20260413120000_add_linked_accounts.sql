CREATE TABLE IF NOT EXISTS public.linked_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  linked_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  relationship_type text NOT NULL DEFAULT 'business' CHECK (relationship_type IN ('business')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_profile_id, linked_profile_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_linked_accounts_owner_business_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_linked_accounts_owner_business_unique
      ON public.linked_accounts(owner_profile_id)
      WHERE relationship_type = 'business';
  END IF;
END $$;

ALTER TABLE public.linked_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Linked accounts are visible to owners and linked profiles" ON public.linked_accounts;
CREATE POLICY "Linked accounts are visible to owners and linked profiles"
  ON public.linked_accounts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = linked_accounts.owner_profile_id
        AND p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = linked_accounts.linked_profile_id
        AND p.user_id = auth.uid()
    )
    OR public.has_permission('settings.manage'::public.app_permission)
  );

DROP POLICY IF EXISTS "Owners can delete linked accounts" ON public.linked_accounts;
CREATE POLICY "Owners can delete linked accounts"
  ON public.linked_accounts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = linked_accounts.owner_profile_id
        AND p.user_id = auth.uid()
    )
    OR public.has_permission('settings.manage'::public.app_permission)
  );

DROP TRIGGER IF EXISTS update_linked_accounts_updated_at ON public.linked_accounts;
CREATE TRIGGER update_linked_accounts_updated_at
  BEFORE UPDATE ON public.linked_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
