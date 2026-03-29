ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS phone_country_code text,
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS phone_e164 text,
  ADD COLUMN IF NOT EXISTS official_id text,
  ADD COLUMN IF NOT EXISTS social_security_number text,
  ADD COLUMN IF NOT EXISTS username_last_changed_at timestamptz;

CREATE OR REPLACE FUNCTION public.slugify_username_base(source text)
RETURNS text AS $$
DECLARE
  normalized text;
BEGIN
  normalized := lower(coalesce(source, ''));
  normalized := regexp_replace(normalized, '[^a-z0-9]+', '_', 'g');
  normalized := regexp_replace(normalized, '_{2,}', '_', 'g');
  normalized := trim(both '_' from normalized);

  IF normalized = '' THEN
    normalized := 'member';
  END IF;

  RETURN left(normalized, 24);
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.generate_unique_username(source text, exclude_profile_id uuid DEFAULT NULL)
RETURNS text AS $$
DECLARE
  base_username text;
  candidate text;
  suffix integer := 0;
BEGIN
  base_username := public.slugify_username_base(source);
  candidate := base_username;

  LOOP
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE username = candidate
        AND (exclude_profile_id IS NULL OR id <> exclude_profile_id)
    );

    suffix := suffix + 1;
    candidate := left(base_username, greatest(1, 24 - length(suffix::text) - 1)) || '_' || suffix::text;
  END LOOP;

  RETURN candidate;
END;
$$ LANGUAGE plpgsql VOLATILE SET search_path = public;

CREATE OR REPLACE FUNCTION public.generate_official_id_candidate()
RETURNS text AS $$
BEGIN
  RETURN 'LVA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
END;
$$ LANGUAGE plpgsql VOLATILE SET search_path = public;

CREATE OR REPLACE FUNCTION public.generate_ssn_candidate()
RETURNS text AS $$
DECLARE
  raw_digits text := lpad(floor(random() * 1000000000)::bigint::text, 9, '0');
BEGIN
  RETURN substr(raw_digits, 1, 3) || '-' || substr(raw_digits, 4, 2) || '-' || substr(raw_digits, 6, 4);
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
      candidate := public.generate_official_id_candidate();
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

DROP TRIGGER IF EXISTS prepare_profile_identity_trigger ON public.profiles;
CREATE TRIGGER prepare_profile_identity_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prepare_profile_identity();

UPDATE public.profiles
SET
  username = NULLIF(username, ''),
  official_id = NULLIF(official_id, ''),
  social_security_number = NULLIF(social_security_number, ''),
  country_code = CASE
    WHEN upper(coalesce(country, '')) = 'EN' THEN 'US'
    WHEN country_code IS NOT NULL AND country_code <> '' THEN upper(country_code)
    ELSE country_code
  END,
  country = CASE
    WHEN upper(coalesce(country, '')) = 'EN' THEN 'United States'
    ELSE country
  END,
  updated_at = updated_at;

ALTER TABLE public.profiles
  ALTER COLUMN official_id SET NOT NULL,
  ALTER COLUMN social_security_number SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_profiles_phone_e164_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_profiles_phone_e164_unique
      ON public.profiles(phone_e164)
      WHERE phone_e164 IS NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_profiles_official_id_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_profiles_official_id_unique
      ON public.profiles(official_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_profiles_social_security_number_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_profiles_social_security_number_unique
      ON public.profiles(social_security_number);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id,
    username,
    full_name,
    avatar_url,
    country,
    country_code,
    language_code,
    phone_country_code,
    phone_number,
    phone_e164
  )
  VALUES (
    NEW.id,
    NULLIF(NEW.raw_user_meta_data->>'username', ''),
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    NULLIF(NEW.raw_user_meta_data->>'country', ''),
    NULLIF(upper(NEW.raw_user_meta_data->>'country_code'), ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'language_code', ''), 'en'),
    NULLIF(NEW.raw_user_meta_data->>'phone_country_code', ''),
    NULLIF(NEW.raw_user_meta_data->>'phone_number', ''),
    NULLIF(NEW.raw_user_meta_data->>'phone_e164', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.resolve_login_email(identifier text)
RETURNS text AS $$
DECLARE
  normalized text := lower(trim(coalesce(identifier, '')));
  digits text := regexp_replace(coalesce(identifier, ''), '[^0-9]', '', 'g');
  resolved_email text;
  match_count integer;
BEGIN
  IF normalized = '' THEN
    RETURN NULL;
  END IF;

  IF position('@' in normalized) > 0 THEN
    RETURN normalized;
  END IF;

  SELECT lower(u.email)
  INTO resolved_email
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE lower(p.username) = normalized
  LIMIT 1;

  IF resolved_email IS NOT NULL THEN
    RETURN resolved_email;
  END IF;

  IF digits <> '' THEN
    SELECT count(*), max(email_value)
    INTO match_count, resolved_email
    FROM (
      SELECT lower(u.email) AS email_value
      FROM public.profiles p
      JOIN auth.users u ON u.id = p.user_id
      WHERE regexp_replace(coalesce(p.phone_e164, ''), '[^0-9]', '', 'g') = digits
         OR regexp_replace(coalesce(p.phone_number, ''), '[^0-9]', '', 'g') = digits
    ) matches;

    IF match_count = 1 THEN
      RETURN resolved_email;
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

GRANT EXECUTE ON FUNCTION public.resolve_login_email(text) TO anon, authenticated;
