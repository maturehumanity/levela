ALTER TABLE public.development_stories
  ADD COLUMN IF NOT EXISTS story_kind text NOT NULL DEFAULT 'development',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_id text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS chat_id text,
  ADD COLUMN IF NOT EXISTS commit_sha text,
  ADD COLUMN IF NOT EXISTS pr_number integer,
  ADD COLUMN IF NOT EXISTS confidence_score numeric(5,2),
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS development_stories_status_requested_idx
  ON public.development_stories (status, requested_at DESC);

CREATE INDEX IF NOT EXISTS development_stories_story_kind_requested_idx
  ON public.development_stories (story_kind, requested_at DESC);

CREATE INDEX IF NOT EXISTS development_stories_source_type_source_id_idx
  ON public.development_stories (source_type, source_id);
