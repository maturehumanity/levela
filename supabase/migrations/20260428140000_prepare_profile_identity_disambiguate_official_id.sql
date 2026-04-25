-- prepare_profile_identity called generate_official_id_candidate() with no args, which is
-- ambiguous when both generate_official_id_candidate() and generate_official_id_candidate(text)
-- exist. Route through the text overload using NEW.country_code (nullable).

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
