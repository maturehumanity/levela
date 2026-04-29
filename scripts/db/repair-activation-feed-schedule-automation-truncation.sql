-- One-off repair: run BEFORE re-applying 20260502100000_activation_feed_worker_schedule_automation_runs.sql
-- if that migration was applied when RPC identifiers exceeded Postgres 63-byte limits
-- (PostgREST could not resolve truncated function names).
--
-- Usage (from repo root, after SSH works):
--   bash scripts/db/apply-remote-migration.sh scripts/db/repair-activation-feed-schedule-automation-truncation.sql
--   bash scripts/db/apply-remote-migration.sh supabase/migrations/20260502100000_activation_feed_worker_schedule_automation_runs.sql

DO $repair$
BEGIN
  IF to_regnamespace('cron') IS NOT NULL THEN
    BEGIN
      EXECUTE $cron$
        SELECT cron.unschedule(job.jobid)
        FROM cron.job
        WHERE job.jobname = 'activation_demographic_feed_worker_schedule_tick'
      $cron$;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'repair: could not unschedule activation feed worker cron job: %', SQLERRM;
    END;
  END IF;
END;
$repair$;

DROP FUNCTION IF EXISTS public.run_activation_demographic_feed_worker_schedule_automation_tick();
DROP FUNCTION IF EXISTS public.run_activation_feed_worker_schedule_automation_tick();
DROP FUNCTION IF EXISTS public.activation_demographic_feed_worker_schedule_automation_status();
DROP FUNCTION IF EXISTS public.schedule_activation_demographic_feed_worker_jobs(boolean);
DROP FUNCTION IF EXISTS public.run_activation_demographic_feed_worker_schedule_automation(boolean);
DROP FUNCTION IF EXISTS public.run_activation_demographic_feed_worker_schedule_automation_chec(boolean, text, text, jsonb);
DROP FUNCTION IF EXISTS public.run_activation_demographic_feed_worker_schedule_automation_check(boolean, text, text, jsonb);
DROP FUNCTION IF EXISTS public.run_activation_feed_worker_schedule_automation_check(boolean, text, text, jsonb);
DROP FUNCTION IF EXISTS public.activation_demographic_feed_worker_schedule_automation_run_hist(integer, integer);
DROP FUNCTION IF EXISTS public.activation_demographic_feed_worker_schedule_automation_run_history(integer, integer);
DROP FUNCTION IF EXISTS public.activation_feed_worker_schedule_automation_run_history(integer, integer);

DROP TABLE IF EXISTS public.activation_demographic_feed_worker_schedule_automation_runs CASCADE;
