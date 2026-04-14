ALTER TABLE public.linked_accounts
  ADD COLUMN IF NOT EXISTS business_name_normalized text;

UPDATE public.linked_accounts AS linked_accounts
SET business_name_normalized = lower(regexp_replace(trim(coalesce(profiles.full_name, '')), '\s+', ' ', 'g'))
FROM public.profiles
WHERE profiles.id = linked_accounts.linked_profile_id
  AND linked_accounts.relationship_type = 'business'
  AND (
    linked_accounts.business_name_normalized IS NULL
    OR linked_accounts.business_name_normalized = ''
  );

UPDATE public.linked_accounts
SET business_name_normalized = lower(trim(coalesce(business_name_normalized, linked_profile_id::text)))
WHERE relationship_type = 'business'
  AND (
    business_name_normalized IS NULL
    OR business_name_normalized = ''
  );

DROP INDEX IF EXISTS idx_linked_accounts_business_name_unique;
CREATE UNIQUE INDEX idx_linked_accounts_business_name_unique
  ON public.linked_accounts (business_name_normalized)
  WHERE relationship_type = 'business';

ALTER TABLE public.linked_accounts
  DROP CONSTRAINT IF EXISTS linked_accounts_business_name_normalized_required;

ALTER TABLE public.linked_accounts
  ADD CONSTRAINT linked_accounts_business_name_normalized_required
  CHECK (
    relationship_type <> 'business'
    OR (business_name_normalized IS NOT NULL AND length(trim(business_name_normalized)) > 0)
  );

CREATE TABLE IF NOT EXISTS public.business_account_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requester_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  request_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_account_access_requests_target
  ON public.business_account_access_requests (target_profile_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_business_account_access_requests_requester
  ON public.business_account_access_requests (requester_profile_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_business_account_access_requests_pending_unique
  ON public.business_account_access_requests (target_profile_id, requester_profile_id)
  WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE ON public.business_account_access_requests TO authenticated;

ALTER TABLE public.business_account_access_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Requesters can create business access requests" ON public.business_account_access_requests;
CREATE POLICY "Requesters can create business access requests"
  ON public.business_account_access_requests
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles requester_profile
      WHERE requester_profile.id = business_account_access_requests.requester_profile_id
        AND requester_profile.user_id = auth.uid()
    )
    AND business_account_access_requests.target_profile_id <> business_account_access_requests.requester_profile_id
    AND EXISTS (
      SELECT 1
      FROM public.linked_accounts linked_accounts
      WHERE linked_accounts.relationship_type = 'business'
        AND linked_accounts.linked_profile_id = business_account_access_requests.target_profile_id
    )
  );

DROP POLICY IF EXISTS "Requesters can read their business access requests" ON public.business_account_access_requests;
CREATE POLICY "Requesters can read their business access requests"
  ON public.business_account_access_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles requester_profile
      WHERE requester_profile.id = business_account_access_requests.requester_profile_id
        AND requester_profile.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Business owners can read business access requests" ON public.business_account_access_requests;
CREATE POLICY "Business owners can read business access requests"
  ON public.business_account_access_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.linked_accounts linked_accounts
      JOIN public.profiles owner_profile ON owner_profile.id = linked_accounts.owner_profile_id
      WHERE linked_accounts.relationship_type = 'business'
        AND linked_accounts.linked_profile_id = business_account_access_requests.target_profile_id
        AND owner_profile.user_id = auth.uid()
    )
    OR public.has_permission('settings.manage'::public.app_permission)
  );

DROP POLICY IF EXISTS "Business owners can update business access requests" ON public.business_account_access_requests;
CREATE POLICY "Business owners can update business access requests"
  ON public.business_account_access_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.linked_accounts linked_accounts
      JOIN public.profiles owner_profile ON owner_profile.id = linked_accounts.owner_profile_id
      WHERE linked_accounts.relationship_type = 'business'
        AND linked_accounts.linked_profile_id = business_account_access_requests.target_profile_id
        AND owner_profile.user_id = auth.uid()
    )
    OR public.has_permission('settings.manage'::public.app_permission)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.linked_accounts linked_accounts
      JOIN public.profiles owner_profile ON owner_profile.id = linked_accounts.owner_profile_id
      WHERE linked_accounts.relationship_type = 'business'
        AND linked_accounts.linked_profile_id = business_account_access_requests.target_profile_id
        AND owner_profile.user_id = auth.uid()
    )
    OR public.has_permission('settings.manage'::public.app_permission)
  );

DROP TRIGGER IF EXISTS update_business_account_access_requests_updated_at ON public.business_account_access_requests;
CREATE TRIGGER update_business_account_access_requests_updated_at
  BEFORE UPDATE ON public.business_account_access_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
