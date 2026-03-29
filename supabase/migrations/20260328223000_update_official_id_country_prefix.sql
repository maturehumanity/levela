CREATE OR REPLACE FUNCTION public.generate_official_id_candidate(country_code text DEFAULT NULL)
RETURNS text AS $$
DECLARE
  prefix text := upper(left(regexp_replace(coalesce(country_code, ''), '[^A-Za-z]', '', 'g'), 2));
BEGIN
  IF prefix = '' THEN
    prefix := 'ZZ';
  END IF;

  RETURN prefix || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
END;
$$ LANGUAGE plpgsql VOLATILE SET search_path = public;

CREATE OR REPLACE FUNCTION public.prepare_profile_identity()
RETURNS trigger AS $$
DECLARE
  candidate text;
BEGIN
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

  IF NEW.official_id IS NULL OR NEW.official_id = '' THEN
    LOOP
      candidate := public.generate_official_id_candidate(NEW.country_code);
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE official_id = candidate
      );
    END LOOP;
    NEW.official_id := candidate;
  END IF;

  IF NEW.social_security_number IS NULL OR NEW.social_security_number = '' THEN
    LOOP
      candidate := public.generate_ssn_candidate();
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE social_security_number = candidate
      );
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

UPDATE public.profiles
SET official_id = (
  CASE
    WHEN upper(left(regexp_replace(coalesce(country_code, ''), '[^A-Za-z]', '', 'g'), 2)) <> ''
      THEN upper(left(regexp_replace(coalesce(country_code, ''), '[^A-Za-z]', '', 'g'), 2))
    ELSE 'ZZ'
  END
) || right(regexp_replace(coalesce(official_id, ''), '[^A-Z0-9]', '', 'g'), 12)
WHERE official_id IS NOT NULL;
