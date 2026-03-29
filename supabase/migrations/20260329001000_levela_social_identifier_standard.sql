CREATE OR REPLACE FUNCTION public.levela_base36_hash_prefix(source text, output_length integer DEFAULT 7)
RETURNS text AS $$
DECLARE
  hash_bytes bytea := extensions.digest(coalesce(source, ''), 'sha256');
  alphabet text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  result text := '';
  idx integer := 0;
  hash_length integer := length(hash_bytes);
BEGIN
  IF hash_length = 0 THEN
    hash_bytes := extensions.digest(gen_random_uuid()::text, 'sha256');
    hash_length := length(hash_bytes);
  END IF;

  WHILE char_length(result) < output_length LOOP
    result := result || substr(alphabet, (get_byte(hash_bytes, idx % hash_length) % 36) + 1, 1);
    idx := idx + 1;
  END LOOP;

  RETURN left(result, output_length);
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.levela_luhn36_char_value(input_char text)
RETURNS integer AS $$
DECLARE
  alphabet text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  position_index integer;
BEGIN
  position_index := strpos(alphabet, upper(coalesce(input_char, '')));
  IF position_index <= 0 THEN
    RETURN 0;
  END IF;

  RETURN position_index - 1;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.levela_luhn36_check_char(input_text text)
RETURNS text AS $$
DECLARE
  alphabet text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  compact text := upper(regexp_replace(coalesce(input_text, ''), '[^A-Z0-9]', '', 'g'));
  factor integer := 2;
  total integer := 0;
  idx integer;
  code_point integer;
  addend integer;
  check_code_point integer;
BEGIN
  FOR idx IN REVERSE char_length(compact)..1 LOOP
    code_point := public.levela_luhn36_char_value(substr(compact, idx, 1));
    addend := factor * code_point;
    factor := CASE WHEN factor = 2 THEN 1 ELSE 2 END;
    addend := floor(addend / 36.0)::integer + (addend % 36);
    total := total + addend;
  END LOOP;

  check_code_point := (36 - (total % 36)) % 36;
  RETURN substr(alphabet, check_code_point + 1, 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.generate_levela_lsi(source text, attempt integer DEFAULT 0)
RETURNS text AS $$
DECLARE
  registry_code text := 'LVLA';
  hashed text := public.levela_base36_hash_prefix(coalesce(source, '') || ':' || attempt::text, 7);
  entropy text := substr(hashed, 1, 4);
  checksum_seed text := substr(hashed, 5, 3);
  raw_value text;
BEGIN
  raw_value := registry_code || entropy || checksum_seed;
  RETURN registry_code || '-' || entropy || '-' || checksum_seed || public.levela_luhn36_check_char(raw_value);
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

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

UPDATE public.profiles
SET social_security_number = public.generate_levela_lsi(coalesce(user_id::text, id::text), 0);
