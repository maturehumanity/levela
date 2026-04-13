DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'citizen'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'citizen' AFTER 'member';
  END IF;
END $$;

INSERT INTO public.role_permissions (role, permission)
SELECT 'citizen'::public.app_role, permission
FROM public.role_permissions
WHERE role = 'verified_member'::public.app_role
ON CONFLICT (role, permission) DO NOTHING;

UPDATE public.content_contribution_rules AS rule
SET allowed_roles = CASE category.contribution_policy
  WHEN 'open' THEN ARRAY['member', 'citizen', 'verified_member', 'certified', 'moderator', 'market_manager', 'founder', 'admin', 'system']::public.app_role[]
  WHEN 'verified_only' THEN ARRAY['citizen', 'verified_member', 'certified', 'moderator', 'market_manager', 'founder', 'admin', 'system']::public.app_role[]
  WHEN 'certified_professionals' THEN ARRAY['certified', 'moderator', 'founder', 'admin', 'system']::public.app_role[]
  WHEN 'staff_only' THEN ARRAY['moderator', 'founder', 'admin', 'system']::public.app_role[]
  ELSE ARRAY[]::public.app_role[]
END,
updated_at = now()
FROM public.content_categories AS category
WHERE category.id = rule.category_id;

CREATE OR REPLACE FUNCTION public.levela_identity_status_prefix(user_role public.app_role, verified boolean)
RETURNS text AS $$
BEGIN
  IF user_role = 'founder' OR user_role = 'admin' THEN
    RETURN 'F';
  ELSIF user_role IN ('system', 'moderator', 'market_manager') THEN
    RETURN 'G';
  ELSIF user_role IN ('citizen', 'certified') OR verified THEN
    RETURN 'W';
  END IF;

  RETURN 'E';
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_contribute_to_content_category(
  target_category_id text,
  target_profile_id uuid DEFAULT public.current_profile_id()
)
RETURNS boolean AS $$
DECLARE
  current_role public.app_role;
  category public.content_categories%ROWTYPE;
BEGIN
  IF target_profile_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT role INTO current_role
  FROM public.profiles
  WHERE id = target_profile_id
  LIMIT 1;

  SELECT * INTO category
  FROM public.content_categories
  WHERE id = target_category_id;

  IF current_role IS NULL OR NOT FOUND THEN
    RETURN false;
  END IF;

  IF current_role IN ('founder', 'admin', 'system') THEN
    RETURN true;
  END IF;

  IF NOT public.has_permission(category.required_contribution_permission) THEN
    RETURN false;
  END IF;

  IF category.contribution_policy = 'open' THEN
    RETURN true;
  END IF;

  IF category.contribution_policy = 'verified_only' THEN
    RETURN current_role IN ('citizen', 'verified_member', 'certified', 'moderator', 'market_manager', 'founder', 'admin', 'system');
  END IF;

  IF category.contribution_policy = 'staff_only' THEN
    RETURN current_role IN ('moderator', 'founder', 'admin', 'system');
  END IF;

  IF category.contribution_policy = 'certified_professionals' THEN
    RETURN current_role IN ('certified', 'moderator', 'founder', 'admin', 'system')
      AND public.profile_has_approved_profession(target_profile_id, category.allowed_professions);
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.sync_profile_role_from_professions(target_profile_id uuid)
RETURNS void AS $$
DECLARE
  approved_count integer := 0;
  current_role public.app_role;
  current_verified boolean := false;
BEGIN
  IF target_profile_id IS NULL THEN
    RETURN;
  END IF;

  SELECT role, coalesce(is_verified, false)
  INTO current_role, current_verified
  FROM public.profiles
  WHERE id = target_profile_id
  LIMIT 1;

  IF current_role IS NULL THEN
    RETURN;
  END IF;

  IF current_role IN ('founder', 'admin', 'system', 'moderator', 'market_manager') THEN
    RETURN;
  END IF;

  SELECT count(*)::integer
  INTO approved_count
  FROM public.profile_professions
  WHERE profile_id = target_profile_id
    AND status = 'approved'::public.profession_verification_status;

  IF approved_count > 0 AND current_role IN ('guest', 'member', 'citizen', 'verified_member') THEN
    UPDATE public.profiles
    SET role = 'certified'::public.app_role
    WHERE id = target_profile_id;
    RETURN;
  END IF;

  IF approved_count = 0 AND current_role = 'certified'::public.app_role THEN
    UPDATE public.profiles
    SET role = CASE
      WHEN current_verified THEN 'citizen'::public.app_role
      ELSE 'member'::public.app_role
    END
    WHERE id = target_profile_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

UPDATE public.profiles AS profile
SET role = 'certified'::public.app_role
WHERE profile.role IN ('guest', 'member', 'citizen', 'verified_member')
  AND EXISTS (
    SELECT 1
    FROM public.profile_professions AS profile_profession
    WHERE profile_profession.profile_id = profile.id
      AND profile_profession.status = 'approved'::public.profession_verification_status
  );

UPDATE public.profiles AS profile
SET role = CASE
  WHEN coalesce(profile.is_verified, false) THEN 'citizen'::public.app_role
  ELSE 'member'::public.app_role
END
WHERE profile.role = 'certified'::public.app_role
  AND NOT EXISTS (
    SELECT 1
    FROM public.profile_professions AS profile_profession
    WHERE profile_profession.profile_id = profile.id
      AND profile_profession.status = 'approved'::public.profession_verification_status
  );
