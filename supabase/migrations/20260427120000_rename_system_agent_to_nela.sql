-- Rename the built-in messaging assistant profile to Nela (display + username).

UPDATE public.profiles
SET
  username = 'nela',
  full_name = 'Nela',
  updated_at = now()
WHERE id = 'a0000000-0000-4000-8000-000000000001'::uuid;
