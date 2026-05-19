-- Third pass: archive remaining "move on with larger chunk" phrasing variants.

UPDATE public.development_stories ds
SET
  status = 'archived',
  metadata = COALESCE(ds.metadata, '{}'::jsonb)
    || jsonb_build_object('journal_cleanup', '202604260200', 'journal_cleanup_at', to_jsonb(now()))
WHERE ds.status = 'published'
  AND COALESCE(ds.source, '') <> 'cursor-seed'
  AND (
    lower(ds.original_instruction) ~ 'move on\\s*,?\\s*with\\s+(a\\s+)?(much\\s+)?larger\\s+chunk'
    OR lower(ds.original_instruction) ~ 'stuck on 30%'
  );
