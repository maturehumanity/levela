CREATE TABLE IF NOT EXISTS public.monetary_policy_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_name text NOT NULL DEFAULT 'Foundational Policy',
  version text NOT NULL DEFAULT '1.0.0-foundational',
  policy_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.monetary_policy_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_profile_id uuid NOT NULL REFERENCES public.monetary_policy_profiles(id) ON DELETE CASCADE,
  approver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  approval_class text NOT NULL CHECK (approval_class IN ('ordinary', 'elevated', 'emergency')),
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (policy_profile_id, approver_id, approval_class)
);

CREATE TABLE IF NOT EXISTS public.monetary_policy_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_profile_id uuid REFERENCES public.monetary_policy_profiles(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.study_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_key text NOT NULL,
  progress_percent integer NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  completed_at timestamptz,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, document_key)
);

CREATE TABLE IF NOT EXISTS public.study_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_key text NOT NULL,
  title text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, document_key)
);

CREATE TABLE IF NOT EXISTS public.study_certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  certification_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'eligible', 'earned')),
  earned_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, certification_key)
);

CREATE INDEX IF NOT EXISTS idx_monetary_policy_profiles_active
  ON public.monetary_policy_profiles (is_active, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_monetary_policy_approvals_policy
  ON public.monetary_policy_approvals (policy_profile_id, approval_class);
CREATE INDEX IF NOT EXISTS idx_monetary_policy_audit_events_policy
  ON public.monetary_policy_audit_events (policy_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_progress_profile
  ON public.study_progress (profile_id, document_key);
CREATE INDEX IF NOT EXISTS idx_study_bookmarks_profile
  ON public.study_bookmarks (profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_certifications_profile
  ON public.study_certifications (profile_id, certification_key);

DO $$
BEGIN
  CREATE TRIGGER update_monetary_policy_profiles_updated_at
    BEFORE UPDATE ON public.monetary_policy_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_study_progress_updated_at
    BEFORE UPDATE ON public.study_progress
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_study_certifications_updated_at
    BEFORE UPDATE ON public.study_certifications
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT ON public.monetary_policy_profiles TO authenticated;
GRANT SELECT ON public.monetary_policy_approvals TO authenticated;
GRANT SELECT ON public.monetary_policy_audit_events TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.monetary_policy_profiles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.monetary_policy_approvals TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.monetary_policy_audit_events TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_progress TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_bookmarks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_certifications TO authenticated;

ALTER TABLE public.monetary_policy_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monetary_policy_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monetary_policy_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_certifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active monetary policies are readable" ON public.monetary_policy_profiles;
CREATE POLICY "Active monetary policies are readable" ON public.monetary_policy_profiles
  FOR SELECT USING (
    is_active = true
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
  );

DROP POLICY IF EXISTS "Monetary policies are manageable by admins" ON public.monetary_policy_profiles;
CREATE POLICY "Monetary policies are manageable by admins" ON public.monetary_policy_profiles
  FOR ALL USING (
    public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
  )
  WITH CHECK (
    public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
  );

DROP POLICY IF EXISTS "Monetary approvals are readable by admins" ON public.monetary_policy_approvals;
CREATE POLICY "Monetary approvals are readable by admins" ON public.monetary_policy_approvals
  FOR SELECT USING (
    public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
  );

DROP POLICY IF EXISTS "Monetary approvals are manageable by admins" ON public.monetary_policy_approvals;
CREATE POLICY "Monetary approvals are manageable by admins" ON public.monetary_policy_approvals
  FOR ALL USING (
    public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
  )
  WITH CHECK (
    public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
  );

DROP POLICY IF EXISTS "Monetary audit events are readable by admins" ON public.monetary_policy_audit_events;
CREATE POLICY "Monetary audit events are readable by admins" ON public.monetary_policy_audit_events
  FOR SELECT USING (
    public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
  );

DROP POLICY IF EXISTS "Monetary audit events are insertable by admins" ON public.monetary_policy_audit_events;
CREATE POLICY "Monetary audit events are insertable by admins" ON public.monetary_policy_audit_events
  FOR INSERT WITH CHECK (
    public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
  );

DROP POLICY IF EXISTS "Study progress is owned by current user" ON public.study_progress;
CREATE POLICY "Study progress is owned by current user" ON public.study_progress
  FOR ALL USING (profile_id = public.current_profile_id())
  WITH CHECK (profile_id = public.current_profile_id());

DROP POLICY IF EXISTS "Study bookmarks are owned by current user" ON public.study_bookmarks;
CREATE POLICY "Study bookmarks are owned by current user" ON public.study_bookmarks
  FOR ALL USING (profile_id = public.current_profile_id())
  WITH CHECK (profile_id = public.current_profile_id());

DROP POLICY IF EXISTS "Study certifications are owned by current user" ON public.study_certifications;
CREATE POLICY "Study certifications are owned by current user" ON public.study_certifications
  FOR ALL USING (profile_id = public.current_profile_id())
  WITH CHECK (profile_id = public.current_profile_id());
