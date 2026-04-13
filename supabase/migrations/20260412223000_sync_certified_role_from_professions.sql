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

  IF approved_count > 0 AND current_role IN ('guest', 'member', 'verified_member') THEN
    UPDATE public.profiles
    SET role = 'certified'::public.app_role
    WHERE id = target_profile_id;
    RETURN;
  END IF;

  IF approved_count = 0 AND current_role = 'certified'::public.app_role THEN
    UPDATE public.profiles
    SET role = CASE
      WHEN current_verified THEN 'verified_member'::public.app_role
      ELSE 'member'::public.app_role
    END
    WHERE id = target_profile_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.handle_profile_profession_role_sync()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.sync_profile_role_from_professions(COALESCE(NEW.profile_id, OLD.profile_id));
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS sync_profile_role_from_professions ON public.profile_professions;
CREATE TRIGGER sync_profile_role_from_professions
  AFTER INSERT OR UPDATE OR DELETE ON public.profile_professions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_profession_role_sync();

UPDATE public.profiles profile
SET role = 'certified'::public.app_role
WHERE profile.role IN ('guest', 'member', 'verified_member')
  AND EXISTS (
    SELECT 1
    FROM public.profile_professions profile_profession
    WHERE profile_profession.profile_id = profile.id
      AND profile_profession.status = 'approved'::public.profession_verification_status
  );

UPDATE public.profiles profile
SET role = CASE
  WHEN coalesce(profile.is_verified, false) THEN 'verified_member'::public.app_role
  ELSE 'member'::public.app_role
END
WHERE profile.role = 'certified'::public.app_role
  AND NOT EXISTS (
    SELECT 1
    FROM public.profile_professions profile_profession
    WHERE profile_profession.profile_id = profile.id
      AND profile_profession.status = 'approved'::public.profession_verification_status
  );
