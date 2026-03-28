CREATE TABLE IF NOT EXISTS public.role_permissions (
  role public.app_role NOT NULL,
  permission public.app_permission NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, permission)
);

INSERT INTO public.role_permissions (role, permission)
SELECT role, permission
FROM (
  SELECT role, unnest(public.app_role_permissions(role)) AS permission
  FROM unnest(enum_range(NULL::public.app_role)) AS role
) seed
ON CONFLICT (role, permission) DO NOTHING;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS granted_permissions public.app_permission[] NOT NULL DEFAULT '{}'::public.app_permission[],
  ADD COLUMN IF NOT EXISTS denied_permissions public.app_permission[] NOT NULL DEFAULT '{}'::public.app_permission[];

UPDATE public.profiles
SET granted_permissions = COALESCE(custom_permissions, '{}'::public.app_permission[])
WHERE granted_permissions = '{}'::public.app_permission[]
  AND COALESCE(custom_permissions, '{}'::public.app_permission[]) <> '{}'::public.app_permission[];

GRANT SELECT ON public.role_permissions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Role permissions are viewable by admins" ON public.role_permissions;
CREATE POLICY "Role permissions are viewable by admins" ON public.role_permissions
  FOR SELECT USING (
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
  );

DROP POLICY IF EXISTS "Role permissions are manageable by admins" ON public.role_permissions;
CREATE POLICY "Role permissions are manageable by admins" ON public.role_permissions
  FOR ALL USING (
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
  )
  WITH CHECK (
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
  );

CREATE OR REPLACE FUNCTION public.app_role_permissions(target_role public.app_role)
RETURNS public.app_permission[] AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT permission
      FROM public.role_permissions
      WHERE role = target_role
      ORDER BY permission::text
    ),
    '{}'::public.app_permission[]
  );
$$ LANGUAGE SQL STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.current_app_permissions()
RETURNS public.app_permission[] AS $$
  SELECT COALESCE(
    (
      SELECT ARRAY(
        SELECT DISTINCT permission
        FROM unnest(
          public.app_role_permissions(role)
          || COALESCE(granted_permissions, '{}'::public.app_permission[])
          || COALESCE(custom_permissions, '{}'::public.app_permission[])
        ) AS permission
        WHERE permission <> ALL(COALESCE(denied_permissions, '{}'::public.app_permission[]))
      )
      FROM public.profiles
      WHERE user_id = auth.uid()
      LIMIT 1
    ),
    public.app_role_permissions('guest'::public.app_role)
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role);
