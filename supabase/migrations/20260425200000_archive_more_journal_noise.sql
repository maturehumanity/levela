-- Second pass: typos and repo-only chores still stored as published stories.

UPDATE public.development_stories ds
SET
  status = 'archived',
  metadata = COALESCE(ds.metadata, '{}'::jsonb)
    || jsonb_build_object('journal_cleanup', '202604252000', 'journal_cleanup_at', to_jsonb(now()))
WHERE ds.status = 'published'
  AND COALESCE(ds.source, '') <> 'cursor-seed'
  AND (
    lower(ds.original_instruction) ~ 'move on\s+with\s+larger\s+ch[uw]+'
    OR lower(ds.original_instruction) ~ 'chuncks'
    OR lower(ds.original_instruction) ~ 'chunds'
    OR lower(ds.title) ~ '^\s*chore:\s*refresh'
    OR lower(ds.original_instruction) ~ '^\s*chore:\s*refresh'
    OR lower(ds.rephrased_description) ~ 'implemented repository change:\s*chore:\s*refresh'
  );
