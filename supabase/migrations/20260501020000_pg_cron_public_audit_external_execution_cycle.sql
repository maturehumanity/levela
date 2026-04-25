-- Roadmap §14 hardening: allow non-interactive database automation to run
-- public-audit external execution scheduling and paging evaluation.

CREATE OR REPLACE FUNCTION public.current_profile_can_manage_public_audit_verifiers()
RETURNS boolean AS $$
  SELECT coalesce(
    session_user IN ('postgres', 'supabase_admin')
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.current_profile_in_governance_domain(ARRAY['constitutional_review', 'technical_stewardship', 'security_incident_response']),
    false
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.gpav_external_execution_cycle_tick()
RETURNS void AS $$
DECLARE
  _batch_id uuid;
  _rec record;
BEGIN
  IF session_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Public audit external execution cycle tick is restricted to database superuser sessions';
  END IF;

  SELECT batch.id
  INTO _batch_id
  FROM public.governance_public_audit_batches AS batch
  ORDER BY batch.batch_index DESC
  LIMIT 1;

  IF _batch_id IS NULL THEN
    RETURN;
  END IF;

  FOR _rec IN
    SELECT *
    FROM public.run_governance_public_audit_external_execution_cycle(
      _batch_id,
      false
    )
  LOOP
    NULL;
  END LOOP;

  FOR _rec IN
    SELECT *
    FROM public.governance_public_audit_external_execution_paging_summary(
      _batch_id,
      true,
      24
    )
  LOOP
    NULL;
  END LOOP;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Public audit external execution cycle tick non-fatal: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.gpav_external_execution_cycle_tick() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gpav_external_execution_cycle_tick() FROM authenticated;
REVOKE ALL ON FUNCTION public.gpav_external_execution_cycle_tick() FROM service_role;

GRANT EXECUTE ON FUNCTION public.gpav_external_execution_cycle_tick() TO postgres;
GRANT EXECUTE ON FUNCTION public.gpav_external_execution_cycle_tick() TO supabase_admin;

DO $$
BEGIN
  IF to_regnamespace('cron') IS NULL THEN
    RAISE NOTICE 'pg_cron schema missing; skipping public audit external execution cycle cron registration.';
    RETURN;
  END IF;

  BEGIN
    EXECUTE $cron$
      SELECT cron.unschedule(job.jobid)
      FROM cron.job
      WHERE job.jobname = 'public_audit_external_execution_cycle_tick'
    $cron$;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Could not unschedule public audit external execution cycle cron job: %', SQLERRM;
  END;

  BEGIN
    EXECUTE $cron$
      SELECT cron.schedule(
        'public_audit_external_execution_cycle_tick',
        '35 * * * *',
        $job$SELECT public.gpav_external_execution_cycle_tick();$job$
      )
    $cron$;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Could not schedule public audit external execution cycle cron job: %', SQLERRM;
  END;
END $$;
