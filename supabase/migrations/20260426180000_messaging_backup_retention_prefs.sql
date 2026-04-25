-- Per-user messaging archive preference and relay retention hints (no OAuth tokens stored).
-- Automated purge of private_messages should respect these in a future scheduled job.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS messaging_backup_provider text,
  ADD COLUMN IF NOT EXISTS messaging_backup_note text,
  ADD COLUMN IF NOT EXISTS messaging_server_retention_days integer,
  ADD COLUMN IF NOT EXISTS messaging_server_retention_max_kb integer;

COMMENT ON COLUMN public.profiles.messaging_backup_provider IS
  'User-declared category for where full message history should live (device_only, google_drive, etc.). No cloud credentials stored here.';

COMMENT ON COLUMN public.profiles.messaging_backup_note IS
  'Optional short user note (folder name, account hint). Not for secrets or tokens.';

COMMENT ON COLUMN public.profiles.messaging_server_retention_days IS
  'When the user relies on device or has not named a cloud archive, max age in days for ciphertext relay rows on Levela (null = use product default).';

COMMENT ON COLUMN public.profiles.messaging_server_retention_max_kb IS
  'Optional cap on total recent relay payload per account in kilobytes (null = use product default).';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_messaging_backup_provider_values;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_messaging_backup_provider_values CHECK (
    messaging_backup_provider IS NULL
    OR messaging_backup_provider IN (
      'device_only',
      'google_drive',
      'dropbox',
      'onedrive',
      'icloud',
      'other'
    )
  );

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_messaging_retention_days_range;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_messaging_retention_days_range CHECK (
    messaging_server_retention_days IS NULL
    OR (messaging_server_retention_days >= 1 AND messaging_server_retention_days <= 1095)
  );

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_messaging_retention_max_kb_range;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_messaging_retention_max_kb_range CHECK (
    messaging_server_retention_max_kb IS NULL
    OR (messaging_server_retention_max_kb >= 256 AND messaging_server_retention_max_kb <= 5242880)
  );
