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
  p_requested_at timestamptz DEFAULT now(),
  p_story_kind text DEFAULT 'development',
  p_status text DEFAULT 'published',
  p_visibility text DEFAULT 'public',
  p_source_type text DEFAULT 'manual',
  p_source_id text DEFAULT NULL,
  p_source_url text DEFAULT NULL,
  p_chat_id text DEFAULT NULL,
  p_commit_sha text DEFAULT NULL,
  p_pr_number integer DEFAULT NULL,
  p_confidence_score numeric DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
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
    requested_at,
    story_kind,
    status,
    visibility,
    source_type,
    source_id,
    source_url,
    chat_id,
    commit_sha,
    pr_number,
    confidence_score,
    metadata,
    published_at
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
    COALESCE(p_requested_at, now()),
    COALESCE(NULLIF(btrim(p_story_kind), ''), 'development'),
    COALESCE(NULLIF(btrim(p_status), ''), 'published'),
    COALESCE(NULLIF(btrim(p_visibility), ''), 'public'),
    COALESCE(NULLIF(btrim(p_source_type), ''), 'manual'),
    NULLIF(btrim(COALESCE(p_source_id, '')), ''),
    NULLIF(btrim(COALESCE(p_source_url, '')), ''),
    NULLIF(btrim(COALESCE(p_chat_id, '')), ''),
    NULLIF(btrim(COALESCE(p_commit_sha, '')), ''),
    p_pr_number,
    p_confidence_score,
    COALESCE(p_metadata, '{}'::jsonb),
    CASE WHEN COALESCE(NULLIF(btrim(p_status), ''), 'published') = 'published' THEN now() ELSE NULL END
  )
  ON CONFLICT (source_story_key) DO UPDATE
    SET
      title = EXCLUDED.title,
      original_instruction = EXCLUDED.original_instruction,
      rephrased_description = EXCLUDED.rephrased_description,
      section = EXCLUDED.section,
      area = EXCLUDED.area,
      created_features = EXCLUDED.created_features,
      expected_behavior = EXCLUDED.expected_behavior,
      source = EXCLUDED.source,
      requested_at = EXCLUDED.requested_at,
      story_kind = EXCLUDED.story_kind,
      status = EXCLUDED.status,
      visibility = EXCLUDED.visibility,
      source_type = EXCLUDED.source_type,
      source_id = EXCLUDED.source_id,
      source_url = EXCLUDED.source_url,
      chat_id = EXCLUDED.chat_id,
      commit_sha = EXCLUDED.commit_sha,
      pr_number = EXCLUDED.pr_number,
      confidence_score = EXCLUDED.confidence_score,
      metadata = EXCLUDED.metadata,
      published_at = CASE WHEN EXCLUDED.status = 'published' THEN COALESCE(public.development_stories.published_at, now()) ELSE NULL END
  RETURNING * INTO v_story;

  RETURN v_story;
END;
$$;

REVOKE ALL ON FUNCTION public.ingest_development_story(text, text, text, text, text, text, text[], text, text, timestamptz, text, text, text, text, text, text, text, text, integer, numeric, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ingest_development_story(text, text, text, text, text, text, text[], text, text, timestamptz, text, text, text, text, text, text, text, text, integer, numeric, jsonb) TO authenticated;
