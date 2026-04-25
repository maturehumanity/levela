CREATE TABLE IF NOT EXISTS public.development_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_story_key text UNIQUE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  original_instruction text NOT NULL,
  rephrased_description text NOT NULL,
  section text NOT NULL,
  area text NOT NULL,
  created_features text[] NOT NULL DEFAULT '{}',
  expected_behavior text NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  requested_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS development_stories_requested_at_idx
  ON public.development_stories (requested_at DESC);

CREATE INDEX IF NOT EXISTS development_stories_section_idx
  ON public.development_stories (section);

CREATE INDEX IF NOT EXISTS development_stories_area_idx
  ON public.development_stories (area);

ALTER TABLE public.development_stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Development stories are visible to authenticated users" ON public.development_stories;
CREATE POLICY "Development stories are visible to authenticated users"
  ON public.development_stories
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authors can insert their own development stories" ON public.development_stories;
CREATE POLICY "Authors can insert their own development stories"
  ON public.development_stories
  FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid());

CREATE OR REPLACE FUNCTION public.ingest_development_story(
  p_source_story_key text,
  p_title text,
  p_original_instruction text,
  p_rephrased_description text DEFAULT NULL,
  p_section text DEFAULT 'General',
  p_area text DEFAULT 'General',
  p_created_features text[] DEFAULT '{}',
  p_expected_behavior text DEFAULT NULL,
  p_source text DEFAULT 'instruction',
  p_requested_at timestamptz DEFAULT now()
)
RETURNS public.development_stories
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_story public.development_stories;
  v_rephrased text;
  v_expected text;
  v_title text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_source_story_key IS NULL OR btrim(p_source_story_key) = '' THEN
    RAISE EXCEPTION 'source_story_key is required';
  END IF;

  IF p_original_instruction IS NULL OR btrim(p_original_instruction) = '' THEN
    RAISE EXCEPTION 'original_instruction is required';
  END IF;

  v_title := COALESCE(NULLIF(btrim(p_title), ''), left(btrim(p_original_instruction), 96));
  v_rephrased := COALESCE(
    NULLIF(btrim(p_rephrased_description), ''),
    regexp_replace(btrim(p_original_instruction), '\s+', ' ', 'g')
  );
  v_expected := COALESCE(
    NULLIF(btrim(p_expected_behavior), ''),
    'This instruction should be implemented and visible in product behavior.'
  );

  INSERT INTO public.development_stories (
    source_story_key,
    author_id,
    title,
    original_instruction,
    rephrased_description,
    section,
    area,
    created_features,
    expected_behavior,
    source,
    requested_at
  )
  VALUES (
    p_source_story_key,
    auth.uid(),
    v_title,
    btrim(p_original_instruction),
    v_rephrased,
    COALESCE(NULLIF(btrim(p_section), ''), 'General'),
    COALESCE(NULLIF(btrim(p_area), ''), 'General'),
    COALESCE(p_created_features, '{}'),
    v_expected,
    COALESCE(NULLIF(btrim(p_source), ''), 'instruction'),
    COALESCE(p_requested_at, now())
  )
  ON CONFLICT (source_story_key) DO NOTHING
  RETURNING * INTO v_story;

  IF v_story.id IS NULL THEN
    SELECT *
      INTO v_story
      FROM public.development_stories
     WHERE source_story_key = p_source_story_key
     LIMIT 1;
  END IF;

  RETURN v_story;
END;
$$;

REVOKE ALL ON FUNCTION public.ingest_development_story(text, text, text, text, text, text, text[], text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ingest_development_story(text, text, text, text, text, text, text[], text, text, timestamptz) TO authenticated;
