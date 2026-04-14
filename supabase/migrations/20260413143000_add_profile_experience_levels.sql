ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS experience_level text;

UPDATE public.profiles
SET experience_level = CASE
  WHEN full_name ILIKE '% professional' THEN 'professional'
  ELSE 'entry'
END
WHERE experience_level IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN experience_level SET DEFAULT 'entry';

ALTER TABLE public.profiles
  ALTER COLUMN experience_level SET NOT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_experience_level_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_experience_level_check
  CHECK (experience_level IN ('entry', 'junior', 'mid', 'senior', 'professional'));

CREATE INDEX IF NOT EXISTS idx_profiles_experience_level
  ON public.profiles (experience_level);
