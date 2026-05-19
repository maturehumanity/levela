-- Archive low-value chat ingest rows so list_published_development_stories() no longer returns them.
-- Matches client-side journal filters (slice / move-on chatter, planning-only, meta frustration, etc.).
-- Preserves seeds and any row that clearly references decentralization or migrations.

UPDATE public.development_stories ds
SET
  status = 'archived',
  metadata = COALESCE(ds.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'journal_cleanup',
      '202604251900',
      'journal_cleanup_at',
      to_jsonb(now())
    )
WHERE ds.status = 'published'
  AND COALESCE(ds.source, '') <> 'cursor-seed'
  AND (
    (
      lower(ds.original_instruction) ~ '(next slice|move on to the next slice)'
      AND lower(ds.original_instruction) !~ 'decentral'
    )
    OR lower(ds.original_instruction) ~ 'so,?\s*can we move on to the next slice'
    OR lower(ds.original_instruction) ~ 'move on,\s+and\s+at\s+the\s+end\s+of\s+every\s+r'
    OR lower(ds.original_instruction) ~ 'are you asking me'
    OR lower(ds.original_instruction) ~ 'divide\s+the\s+plan\s+into'
    OR lower(ds.original_instruction) ~ 'move on,\s+with\s+larger\s+chunks'
    OR (
      lower(ds.original_instruction) ~ 'didn''t move on'
      AND lower(ds.original_instruction) !~ 'decentral'
      AND lower(ds.original_instruction) !~ 'migration'
    )
    OR (
      lower(ds.original_instruction) ~ 'move on as per your recommendations'
      AND lower(ds.original_instruction) !~ 'migration'
      AND lower(ds.original_instruction) !~ 'ssh'
      AND lower(ds.original_instruction) !~ 'vps'
    )
    OR lower(ds.original_instruction) ~ 'let''s make a plan out of your recommendations'
    OR lower(ds.original_instruction) ~ 'commit,?\s*push,?\s*build and ship'
    OR lower(ds.original_instruction) ~ 'build and ship the updated version'
    OR (
      lower(ds.original_instruction) ~ 'i\s+just\s+restarted'
      AND lower(ds.original_instruction) ~ 'failed to connect'
    )
    OR (
      lower(ds.original_instruction) ~ 'did you take all necessary measures'
      AND lower(ds.original_instruction) !~ 'preload'
      AND lower(ds.original_instruction) !~ 'prefetch'
    )
  );
