CREATE OR REPLACE FUNCTION public.levela_mrz_char_value(input_char text)
RETURNS integer AS $$
BEGIN
  IF input_char = '<' THEN
    RETURN 0;
  ELSIF input_char ~ '^[0-9]$' THEN
    RETURN input_char::integer;
  ELSIF input_char ~ '^[A-Z]$' THEN
    RETURN ascii(input_char) - 55;
  END IF;

  RETURN 0;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.levela_mrz_check_digit(input_text text)
RETURNS integer AS $$
DECLARE
  weights integer[] := ARRAY[7, 3, 1];
  total integer := 0;
  idx integer;
  current_char text;
BEGIN
  FOR idx IN 1..char_length(coalesce(input_text, '')) LOOP
    current_char := upper(substr(input_text, idx, 1));
    total := total + public.levela_mrz_char_value(current_char) * weights[((idx - 1) % 3) + 1];
  END LOOP;

  RETURN total % 10;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.levela_identity_status_prefix(user_role public.app_role, verified boolean)
RETURNS text AS $$
BEGIN
  IF user_role IN ('admin', 'system', 'moderator', 'market_manager') THEN
    RETURN 'G';
  ELSIF verified THEN
    RETURN 'W';
  END IF;

  RETURN 'E';
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.levela_base32_hash_prefix(source text, output_length integer DEFAULT 7)
RETURNS text AS $$
DECLARE
  hash_bytes bytea := extensions.digest(coalesce(source, ''), 'sha256');
  alphabet text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  buffer bigint := 0;
  remaining_bits integer := 0;
  result text := '';
  current_byte integer;
  idx integer;
BEGIN
  FOR idx IN 0..length(hash_bytes) - 1 LOOP
    current_byte := get_byte(hash_bytes, idx);
    buffer := (buffer << 8) | current_byte;
    remaining_bits := remaining_bits + 8;

    WHILE remaining_bits >= 5 AND char_length(result) < output_length LOOP
      result := result || substr(alphabet, (((buffer >> (remaining_bits - 5)) & 31)::integer) + 1, 1);
      remaining_bits := remaining_bits - 5;

      IF remaining_bits > 0 THEN
        buffer := buffer & ((1::bigint << remaining_bits) - 1);
      ELSE
        buffer := 0;
      END IF;
    END LOOP;

    EXIT WHEN char_length(result) >= output_length;
  END LOOP;

  IF remaining_bits > 0 AND char_length(result) < output_length THEN
    result := result || substr(alphabet, (((buffer << (5 - remaining_bits)) & 31)::integer) + 1, 1);
  END IF;

  RETURN left(result, output_length);
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.generate_world_citizen_id(source text, user_role public.app_role, verified boolean, attempt integer DEFAULT 0)
RETURNS text AS $$
DECLARE
  prefix text := public.levela_identity_status_prefix(user_role, verified);
  core text := public.levela_base32_hash_prefix(coalesce(source, '') || ':' || attempt::text, 7);
BEGIN
  RETURN prefix || core || public.levela_mrz_check_digit(prefix || core)::text;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.prepare_profile_identity()
RETURNS trigger AS $$
DECLARE
  candidate text;
  attempt integer := 0;
  normalized_official_id text;
  expected_prefix text;
  needs_official_id boolean := false;
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

  expected_prefix := public.levela_identity_status_prefix(NEW.role, coalesce(NEW.is_verified, false));
  normalized_official_id := upper(regexp_replace(coalesce(NEW.official_id, ''), '[^A-Z0-9]', '', 'g'));
  needs_official_id := normalized_official_id = ''
    OR char_length(normalized_official_id) <> 9
    OR left(normalized_official_id, 1) <> expected_prefix
    OR right(normalized_official_id, 1) <> public.levela_mrz_check_digit(left(normalized_official_id, 8))::text;

  IF needs_official_id THEN
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
SET official_id = public.generate_world_citizen_id(
  coalesce(user_id::text, id::text),
  role,
  coalesce(is_verified, false),
  0
);
