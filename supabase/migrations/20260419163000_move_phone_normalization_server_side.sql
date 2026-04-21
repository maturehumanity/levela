CREATE OR REPLACE FUNCTION public.normalize_phone_e164(
  phone_country_code_input text,
  phone_number_input text
)
RETURNS text AS $$
DECLARE
  country_digits text := regexp_replace(coalesce(phone_country_code_input, ''), '[^0-9]', '', 'g');
  phone_digits text := regexp_replace(coalesce(phone_number_input, ''), '[^0-9]', '', 'g');
BEGIN
  IF country_digits = '' OR phone_digits = '' THEN
    RETURN NULL;
  END IF;

  RETURN '+' || country_digits || phone_digits;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.prepare_profile_identity()
RETURNS trigger AS $$
DECLARE
  candidate text;
  country_digits text;
BEGIN
  IF NEW.username IS NOT NULL THEN
    NEW.username := lower(trim(NEW.username));
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
    country_digits := regexp_replace(trim(NEW.phone_country_code), '[^0-9]', '', 'g');
    NEW.phone_country_code := CASE
      WHEN country_digits = '' THEN NULL
      ELSE '+' || country_digits
    END;
  END IF;

  IF NEW.phone_number IS NOT NULL THEN
    NEW.phone_number := NULLIF(regexp_replace(NEW.phone_number, '[^0-9]', '', 'g'), '');
  END IF;

  NEW.phone_e164 := public.normalize_phone_e164(NEW.phone_country_code, NEW.phone_number);

  IF coalesce(NEW.country_code, '') <> '' THEN
    NEW.country_code := upper(NEW.country_code);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

UPDATE public.profiles
SET
  phone_country_code = phone_country_code,
  phone_number = phone_number,
  updated_at = updated_at
WHERE
  phone_country_code IS NOT NULL
  OR phone_number IS NOT NULL
  OR phone_e164 IS NOT NULL;
