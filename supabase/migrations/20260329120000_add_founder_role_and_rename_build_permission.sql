DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'founder'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'founder';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'app_permission' AND e.enumlabel = 'profile.build_cards'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'app_permission' AND e.enumlabel = 'build.use'
  ) THEN
    ALTER TYPE public.app_permission RENAME VALUE 'profile.build_cards' TO 'build.use';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sync_legacy_admin_flag()
RETURNS TRIGGER AS $$
BEGIN
  NEW.is_admin = NEW.role IN ('founder', 'admin', 'system');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

UPDATE public.profiles
SET is_admin = role IN ('founder', 'admin', 'system');

UPDATE public.profiles
SET role = 'founder'::public.app_role
WHERE role = 'admin'::public.app_role
  AND official_id LIKE 'F%';

INSERT INTO public.role_permissions (role, permission)
SELECT 'founder'::public.app_role, permission
FROM public.role_permissions
WHERE role = 'admin'::public.app_role
ON CONFLICT DO NOTHING;
