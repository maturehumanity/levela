ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS date_of_birth date;

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
    phone_e164,
    date_of_birth
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
    NULLIF(NEW.raw_user_meta_data->>'phone_e164', ''),
    NULLIF(NEW.raw_user_meta_data->>'date_of_birth', '')::date
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
