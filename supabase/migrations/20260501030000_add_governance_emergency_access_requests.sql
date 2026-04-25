-- Decentralization hardening: replace direct user impersonation workflows with
-- auditable emergency access requests.

CREATE TABLE IF NOT EXISTS public.governance_emergency_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_reason text NOT NULL,
  request_status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_emergency_access_requests_reason_not_empty_check CHECK (length(trim(request_reason)) > 0),
  CONSTRAINT governance_emergency_access_requests_status_check CHECK (request_status IN ('pending', 'approved', 'rejected', 'expired')),
  CONSTRAINT governance_emergency_access_requests_review_notes_not_empty_check CHECK (
    review_notes IS NULL OR length(trim(review_notes)) > 0
  )
);

CREATE INDEX IF NOT EXISTS idx_governance_emergency_access_requests_target_status
  ON public.governance_emergency_access_requests (target_profile_id, request_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_emergency_access_requests_requester_status
  ON public.governance_emergency_access_requests (requested_by, request_status, created_at DESC);

DO $$
BEGIN
  CREATE TRIGGER update_governance_emergency_access_requests_updated_at
    BEFORE UPDATE ON public.governance_emergency_access_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.request_governance_emergency_access(
  target_profile_id uuid,
  request_reason text
)
RETURNS uuid AS $$
DECLARE
  request_id uuid;
  current_profile uuid := public.current_profile_id();
  normalized_reason text := nullif(btrim(coalesce(request_reason, '')), '');
BEGIN
  IF current_profile IS NULL THEN
    RAISE EXCEPTION 'Current profile is required';
  END IF;

  IF NOT (
    public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
  ) THEN
    RAISE EXCEPTION 'Current profile is not authorized to request emergency access';
  END IF;

  IF target_profile_id IS NULL THEN
    RAISE EXCEPTION 'Target profile is required';
  END IF;

  IF normalized_reason IS NULL THEN
    RAISE EXCEPTION 'Emergency access reason is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id = target_profile_id
      AND profile.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Target profile does not exist';
  END IF;

  INSERT INTO public.governance_emergency_access_requests (
    target_profile_id,
    requested_by,
    request_reason,
    request_status
  )
  VALUES (
    target_profile_id,
    current_profile,
    normalized_reason,
    'pending'
  )
  RETURNING id INTO request_id;

  RETURN request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT SELECT, INSERT, UPDATE ON public.governance_emergency_access_requests TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_governance_emergency_access(uuid, text) TO authenticated;

ALTER TABLE public.governance_emergency_access_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Emergency access requests readable by staff" ON public.governance_emergency_access_requests;
CREATE POLICY "Emergency access requests readable by staff" ON public.governance_emergency_access_requests
  FOR SELECT USING (
    public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
  );

DROP POLICY IF EXISTS "Emergency access requests insert by staff" ON public.governance_emergency_access_requests;
CREATE POLICY "Emergency access requests insert by staff" ON public.governance_emergency_access_requests
  FOR INSERT WITH CHECK (
    requested_by = public.current_profile_id()
    AND (
      public.has_permission('settings.manage'::public.app_permission)
      OR public.has_permission('role.assign'::public.app_permission)
    )
  );

DROP POLICY IF EXISTS "Emergency access requests review by managers" ON public.governance_emergency_access_requests;
CREATE POLICY "Emergency access requests review by managers" ON public.governance_emergency_access_requests
  FOR UPDATE USING (public.has_permission('settings.manage'::public.app_permission))
  WITH CHECK (public.has_permission('settings.manage'::public.app_permission));
