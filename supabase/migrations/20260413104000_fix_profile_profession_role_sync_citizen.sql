CREATE OR REPLACE FUNCTION public.sync_profile_role_from_professions(target_profile_id uuid)
RETURNS void AS $$
DECLARE
  approved_count integer := 0;
  current_role_value public.app_role;
  current_verified boolean := false;
BEGIN
  IF target_profile_id IS NULL THEN
    RETURN;
  END IF;

  SELECT role, coalesce(is_verified, false)
  INTO current_role_value, current_verified
  FROM public.profiles
  WHERE id = target_profile_id
  LIMIT 1;

  IF current_role_value IS NULL THEN
    RETURN;
  END IF;

  IF current_role_value IN ('founder', 'admin', 'system', 'moderator', 'market_manager') THEN
    RETURN;
  END IF;

  SELECT count(*)::integer
  INTO approved_count
  FROM public.profile_professions
  WHERE profile_id = target_profile_id
    AND status = 'approved'::public.profession_verification_status;

  IF approved_count > 0 AND current_role_value IN ('guest', 'member', 'citizen', 'verified_member') THEN
    UPDATE public.profiles
    SET role = 'certified'::public.app_role
    WHERE id = target_profile_id;
    RETURN;
  END IF;

  IF approved_count = 0 AND current_role_value = 'certified'::public.app_role THEN
    UPDATE public.profiles
    SET role = CASE
      WHEN current_verified THEN 'citizen'::public.app_role
      ELSE 'member'::public.app_role
    END
    WHERE id = target_profile_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
