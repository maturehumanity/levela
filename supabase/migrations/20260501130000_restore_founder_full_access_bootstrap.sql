-- Bootstrap governance rule: founder retains full ecosystem access
-- until explicit transition to distributed authority is approved.

UPDATE public.profiles
SET is_admin = role IN ('founder', 'admin', 'system');

UPDATE public.profiles
SET denied_permissions = '{}'::public.app_permission[]
WHERE role = 'founder'::public.app_role;

DELETE FROM public.role_permissions
WHERE role = 'founder'::public.app_role;

INSERT INTO public.role_permissions (role, permission)
SELECT
  'founder'::public.app_role,
  permission
FROM unnest(enum_range(NULL::public.app_permission)) AS permission
ON CONFLICT (role, permission) DO NOTHING;
