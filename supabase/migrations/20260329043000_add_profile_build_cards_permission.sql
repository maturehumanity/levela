DO $$
BEGIN
  ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'profile.build_cards';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO public.role_permissions (role, permission)
VALUES
  ('admin', 'profile.build_cards'),
  ('system', 'profile.build_cards')
ON CONFLICT (role, permission) DO NOTHING;
