-- Idempotent: same update as 20260427120000 for hosts where the first file was applied
-- before the WHERE clause was relaxed. Safe to re-run.

UPDATE public.profiles
SET
  username = 'nela',
  full_name = 'Nela',
  updated_at = now()
WHERE id = 'a0000000-0000-4000-8000-000000000001'::uuid;
