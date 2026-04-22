-- Install pg_cron when permitted, split feed-worker scheduling into an internal
-- implementation callable only from trusted definer wrappers, and register an
-- hourly in-database tick that enqueues due adapters (outbox only; HTTP sweep
-- remains client/worker-side).

CREATE OR REPLACE FUNCTION public.schedule_activation_demographic_feed_worker_jobs_impl(
  force_reschedule boolean DEFAULT false
)
RETURNS integer AS $$
DECLARE
  policy_record public.activation_demographic_feed_worker_schedule_policies%ROWTYPE;
  inserted_count integer := 0;
  adapter_record record;
  effective_interval integer;
  last_sweep_at timestamptz;
  has_pending boolean;
BEGIN
  PERFORM public.release_stale_activation_demographic_feed_worker_claims();

  SELECT sched.*
  INTO policy_record
  FROM public.activation_demographic_feed_worker_schedule_policies AS sched
  WHERE sched.policy_key = 'default'
  LIMIT 1;

  IF policy_record.policy_key IS NULL THEN
    RAISE EXCEPTION 'Activation demographic feed worker schedule policy is missing';
  END IF;

  IF force_reschedule THEN
    UPDATE public.activation_demographic_feed_worker_outbox AS ob
    SET
      status = 'cancelled',
      completed_at = coalesce(ob.completed_at, now()),
      error_message = coalesce(ob.error_message, 'Cancelled by force_reschedule'),
      metadata = coalesce(ob.metadata, '{}'::jsonb) || jsonb_build_object('cancelled_at', now())
    WHERE ob.status IN ('pending', 'claimed');
  END IF;

  FOR adapter_record IN
    SELECT adapter.id, adapter.worker_sweep_interval_minutes, adapter.endpoint_url
    FROM public.activation_demographic_feed_adapters AS adapter
    WHERE adapter.is_active = true
      AND length(trim(coalesce(adapter.endpoint_url, ''))) > 0
    ORDER BY adapter.updated_at DESC, adapter.created_at DESC
  LOOP
    BEGIN
      effective_interval := coalesce(
        adapter_record.worker_sweep_interval_minutes,
        policy_record.default_interval_minutes
      );

      SELECT max(run.observed_at)
      INTO last_sweep_at
      FROM public.activation_demographic_feed_worker_runs AS run
      WHERE run.adapter_id = adapter_record.id
        AND coalesce(run.metadata ->> 'source', '') = 'activation_feed_worker_sweep';

      IF last_sweep_at IS NOT NULL
         AND last_sweep_at > (now() - make_interval(mins => greatest(5, effective_interval))) THEN
        CONTINUE;
      END IF;

      SELECT EXISTS (
        SELECT 1
        FROM public.activation_demographic_feed_worker_outbox AS ob
        WHERE ob.adapter_id = adapter_record.id
          AND ob.status IN ('pending', 'claimed')
      )
      INTO has_pending;

      IF has_pending THEN
        CONTINUE;
      END IF;

      INSERT INTO public.activation_demographic_feed_worker_outbox (
        adapter_id,
        status,
        metadata,
        created_by
      )
      VALUES (
        adapter_record.id,
        'pending',
        jsonb_build_object(
          'source', 'schedule_activation_demographic_feed_worker_jobs',
          'effective_interval_minutes', effective_interval
        ),
        public.current_profile_id()
      );

      inserted_count := inserted_count + 1;
    EXCEPTION
      WHEN unique_violation THEN
        NULL;
    END;
  END LOOP;

  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.schedule_activation_demographic_feed_worker_jobs(
  force_reschedule boolean DEFAULT false
)
RETURNS integer AS $$
BEGIN
  IF NOT public.current_profile_can_manage_activation_demographic_feed_workers() THEN
    RAISE EXCEPTION 'Current caller is not authorized to schedule activation demographic feed worker jobs';
  END IF;

  RETURN public.schedule_activation_demographic_feed_worker_jobs_impl(force_reschedule);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.run_activation_demographic_feed_worker_schedule_automation(
  force_reschedule boolean DEFAULT false
)
RETURNS integer AS $$
BEGIN
  IF session_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Automation entrypoint is restricted to database superuser sessions';
  END IF;

  RETURN public.schedule_activation_demographic_feed_worker_jobs_impl(force_reschedule);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.schedule_activation_demographic_feed_worker_jobs_impl(boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.schedule_activation_demographic_feed_worker_jobs_impl(boolean) FROM authenticated;
REVOKE ALL ON FUNCTION public.schedule_activation_demographic_feed_worker_jobs_impl(boolean) FROM service_role;

REVOKE ALL ON FUNCTION public.run_activation_demographic_feed_worker_schedule_automation(boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_activation_demographic_feed_worker_schedule_automation(boolean) FROM authenticated;
REVOKE ALL ON FUNCTION public.run_activation_demographic_feed_worker_schedule_automation(boolean) FROM service_role;

GRANT EXECUTE ON FUNCTION public.run_activation_demographic_feed_worker_schedule_automation(boolean) TO postgres;
GRANT EXECUTE ON FUNCTION public.run_activation_demographic_feed_worker_schedule_automation(boolean) TO supabase_admin;

GRANT EXECUTE ON FUNCTION public.schedule_activation_demographic_feed_worker_jobs(boolean) TO authenticated;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'pg_cron could not be created (insufficient privilege): %', SQLERRM;
  WHEN duplicate_object THEN
    NULL;
  WHEN OTHERS THEN
    RAISE NOTICE
      'pg_cron could not be created: %. On self-managed Postgres, ensure shared_preload_libraries includes ''pg_cron'', restart the server once, then re-run this migration (or CREATE EXTENSION manually).',
      SQLERRM;
END $$;

DO $$
BEGIN
  IF to_regnamespace('cron') IS NULL THEN
    RAISE NOTICE
      'pg_cron schema missing; skipping activation demographic feed worker cron registration (CREATE EXTENSION pg_cron may have failed—verify SHOW shared_preload_libraries includes pg_cron and that the instance was restarted after adding it).';
    RETURN;
  END IF;

  BEGIN
    EXECUTE $cron$
      SELECT cron.unschedule(job.jobid)
      FROM cron.job
      WHERE job.jobname = 'activation_demographic_feed_worker_schedule_tick'
    $cron$;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Could not unschedule activation demographic feed worker cron job: %', SQLERRM;
  END;

  BEGIN
    EXECUTE $cron$
      SELECT cron.schedule(
        'activation_demographic_feed_worker_schedule_tick',
        '15 * * * *',
        $job$SELECT public.run_activation_demographic_feed_worker_schedule_automation(false);$job$
      )
    $cron$;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Could not schedule activation demographic feed worker cron job: %', SQLERRM;
  END;
END $$;
