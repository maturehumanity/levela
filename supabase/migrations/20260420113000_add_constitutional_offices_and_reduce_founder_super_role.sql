DO $$
BEGIN
  CREATE TYPE public.constitutional_office_key AS ENUM (
    'founder'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.constitutional_offices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_key public.constitutional_office_key NOT NULL,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  ended_at timestamptz,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT constitutional_offices_window_check CHECK (
    ended_at IS NULL OR ended_at > assigned_at
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_constitutional_offices_active_office
  ON public.constitutional_offices (office_key)
  WHERE is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_constitutional_offices_active_profile_office
  ON public.constitutional_offices (profile_id, office_key)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_constitutional_offices_profile_active
  ON public.constitutional_offices (profile_id, is_active, assigned_at DESC);

DO $$
BEGIN
  CREATE TRIGGER update_constitutional_offices_updated_at
    BEFORE UPDATE ON public.constitutional_offices
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.profile_has_constitutional_office(
  target_profile_id uuid,
  requested_office public.constitutional_office_key
)
RETURNS boolean AS $$
  SELECT coalesce(
    target_profile_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.constitutional_offices AS office
      WHERE office.profile_id = target_profile_id
        AND office.office_key = requested_office
        AND office.is_active = true
    ),
    false
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.current_profile_has_constitutional_office(
  requested_office public.constitutional_office_key
)
RETURNS boolean AS $$
  SELECT public.profile_has_constitutional_office(public.current_profile_id(), requested_office);
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

WITH founder_candidate AS (
  SELECT profile.id, profile.created_at
  FROM public.profiles AS profile
  WHERE profile.role = 'founder'::public.app_role
  ORDER BY profile.created_at ASC, profile.id ASC
  LIMIT 1
)
INSERT INTO public.constitutional_offices (
  office_key,
  profile_id,
  assigned_at,
  assigned_by,
  is_active,
  notes,
  metadata
)
SELECT
  'founder'::public.constitutional_office_key,
  founder_candidate.id,
  coalesce(founder_candidate.created_at, now()),
  founder_candidate.id,
  true,
  'Backfilled from legacy founder role',
  jsonb_build_object('source', 'legacy_founder_role')
FROM founder_candidate
WHERE NOT EXISTS (
  SELECT 1
  FROM public.constitutional_offices
  WHERE office_key = 'founder'::public.constitutional_office_key
    AND is_active = true
);

GRANT SELECT ON public.constitutional_offices TO authenticated;
GRANT INSERT, UPDATE ON public.constitutional_offices TO authenticated;

ALTER TABLE public.constitutional_offices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Constitutional offices are readable by authenticated users" ON public.constitutional_offices;
CREATE POLICY "Constitutional offices are readable by authenticated users" ON public.constitutional_offices
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Constitutional offices are manageable by admins" ON public.constitutional_offices;
CREATE POLICY "Constitutional offices are manageable by admins" ON public.constitutional_offices
  FOR ALL USING (
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
  )
  WITH CHECK (
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
  );

CREATE OR REPLACE FUNCTION public.sync_legacy_admin_flag()
RETURNS TRIGGER AS $$
BEGIN
  NEW.is_admin = NEW.role IN ('admin', 'system');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

UPDATE public.profiles
SET is_admin = role IN ('admin', 'system');

DELETE FROM public.role_permissions
WHERE role = 'founder'::public.app_role;

INSERT INTO public.role_permissions (role, permission)
SELECT 'founder'::public.app_role, permission
FROM unnest(
  ARRAY[
    'law.read'::public.app_permission,
    'law.contribute'::public.app_permission,
    'law.review'::public.app_permission,
    'content.read'::public.app_permission,
    'content.contribute_unmoderated'::public.app_permission,
    'content.contribute_moderated'::public.app_permission,
    'content.review'::public.app_permission,
    'content.moderate'::public.app_permission,
    'profession.verify'::public.app_permission,
    'build.use'::public.app_permission,
    'profile.read'::public.app_permission,
    'profile.update_self'::public.app_permission,
    'post.create'::public.app_permission,
    'post.edit_self'::public.app_permission,
    'post.delete_self'::public.app_permission,
    'post.moderate'::public.app_permission,
    'comment.create'::public.app_permission,
    'comment.edit_self'::public.app_permission,
    'comment.delete_self'::public.app_permission,
    'comment.moderate'::public.app_permission,
    'message.create'::public.app_permission,
    'message.edit_self'::public.app_permission,
    'message.moderate'::public.app_permission,
    'endorsement.create'::public.app_permission,
    'endorsement.review'::public.app_permission,
    'endorsement.moderate'::public.app_permission,
    'report.create'::public.app_permission,
    'report.review'::public.app_permission,
    'like.create'::public.app_permission,
    'like.delete_self'::public.app_permission
  ]::public.app_permission[]
) AS permission
ON CONFLICT (role, permission) DO NOTHING;
