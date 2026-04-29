-- Enable pg_net when the instance allows it so optional HTTPS paging webhooks can run
-- without a separate manual extension step (same pattern as pg_cron migrations).

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'pg_net could not be created (insufficient privilege): %', SQLERRM;
  WHEN duplicate_object THEN
    NULL;
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_net could not be created: %', SQLERRM;
END $$;
