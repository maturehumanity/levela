ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sex text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_sex_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_sex_check CHECK (sex IS NULL OR sex IN ('M', 'F', 'X'));

CREATE OR REPLACE FUNCTION public.prepare_profile_identity()
RETURNS trigger AS $$
DECLARE
  candidate text;
  attempt integer := 0;
  normalized_official_id text;
  expected_prefix text;
  normalized_lsi text;
  needs_official_id boolean := false;
  needs_lsi boolean := false;
BEGIN
  IF NEW.full_name IS NOT NULL THEN
    NEW.full_name := nullif(trim(NEW.full_name), '');
  END IF;

  IF NEW.place_of_birth IS NOT NULL THEN
    NEW.place_of_birth := nullif(trim(NEW.place_of_birth), '');
  END IF;

  IF NEW.sex IS NOT NULL THEN
    NEW.sex := upper(nullif(trim(NEW.sex), ''));
    IF NEW.sex IS NOT NULL AND NEW.sex NOT IN ('M', 'F', 'X') THEN
      RAISE EXCEPTION 'Sex must be one of M, F, or X.';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE'
     AND (
       NEW.full_name IS DISTINCT FROM OLD.full_name
       OR NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth
       OR NEW.place_of_birth IS DISTINCT FROM OLD.place_of_birth
       OR NEW.sex IS DISTINCT FROM OLD.sex
     ) THEN
    IF now() > OLD.created_at + interval '7 days' THEN
      RAISE EXCEPTION 'You can only change identity information during the first 7 days after signup.';
    END IF;

    NEW.full_name_change_count := coalesce(OLD.full_name_change_count, 0) + 1;
    NEW.full_name_last_changed_at := now();
  END IF;

  IF NEW.username IS NOT NULL THEN
    NEW.username := public.slugify_username_base(NEW.username);
  END IF;

  IF NEW.username IS NULL OR NEW.username = '' THEN
    NEW.username := public.generate_unique_username(coalesce(NEW.full_name, 'member'));
  ELSIF TG_OP = 'INSERT' AND EXISTS (
    SELECT 1 FROM public.profiles WHERE username = NEW.username
  ) THEN
    NEW.username := public.generate_unique_username(NEW.username);
  ELSIF TG_OP = 'UPDATE' AND NEW.username IS DISTINCT FROM OLD.username THEN
    NEW.username := public.generate_unique_username(NEW.username, OLD.id);
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.username IS DISTINCT FROM OLD.username THEN
    IF now() > OLD.created_at + interval '24 hours' THEN
      IF OLD.username_last_changed_at IS NOT NULL
         AND now() < OLD.username_last_changed_at + interval '1 year' THEN
        RAISE EXCEPTION 'You can only change your username once per year after the first 24 hours.';
      END IF;

      NEW.username_last_changed_at := now();
    END IF;
  END IF;

  expected_prefix := public.levela_identity_status_prefix(NEW.role, coalesce(NEW.is_verified, false));
  normalized_official_id := upper(regexp_replace(coalesce(NEW.official_id, ''), '[^A-Z0-9]', '', 'g'));
  needs_official_id := normalized_official_id = ''
    OR char_length(normalized_official_id) <> 9
    OR left(normalized_official_id, 1) <> expected_prefix
    OR right(normalized_official_id, 1) <> public.levela_mrz_check_digit(left(normalized_official_id, 8))::text;

  IF needs_official_id THEN
    attempt := 0;
    LOOP
      candidate := public.generate_world_citizen_id(
        coalesce(NEW.user_id::text, NEW.id::text, gen_random_uuid()::text),
        NEW.role,
        coalesce(NEW.is_verified, false),
        attempt
      );

      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE official_id = candidate
          AND (TG_OP <> 'UPDATE' OR id <> OLD.id)
      );

      attempt := attempt + 1;
    END LOOP;

    NEW.official_id := candidate;
  END IF;

  normalized_lsi := upper(regexp_replace(coalesce(NEW.social_security_number, ''), '[^A-Z0-9]', '', 'g'));
  needs_lsi := normalized_lsi = ''
    OR char_length(normalized_lsi) <> 12
    OR left(normalized_lsi, 4) <> 'LVLA'
    OR right(normalized_lsi, 1) <> public.levela_luhn36_check_char(left(normalized_lsi, 11));

  IF needs_lsi THEN
    attempt := 0;
    LOOP
      candidate := public.generate_levela_lsi(
        coalesce(NEW.user_id::text, NEW.id::text, gen_random_uuid()::text),
        attempt
      );
      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE social_security_number = candidate
          AND (TG_OP <> 'UPDATE' OR id <> OLD.id)
      );
      attempt := attempt + 1;
    END LOOP;
    NEW.social_security_number := candidate;
  END IF;

  IF NEW.phone_country_code IS NOT NULL THEN
    NEW.phone_country_code := trim(NEW.phone_country_code);
  END IF;

  IF NEW.phone_number IS NOT NULL THEN
    NEW.phone_number := regexp_replace(NEW.phone_number, '[^0-9]', '', 'g');
  END IF;

  IF NEW.phone_e164 IS NOT NULL THEN
    NEW.phone_e164 := regexp_replace(NEW.phone_e164, '[^0-9+]', '', 'g');
  END IF;

  IF coalesce(NEW.country_code, '') <> '' THEN
    NEW.country_code := upper(NEW.country_code);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
