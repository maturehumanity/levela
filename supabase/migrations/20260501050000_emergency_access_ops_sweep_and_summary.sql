-- Decentralization hardening: add autonomous emergency-access request expiry
-- and steward-facing ops health summary.

CREATE OR REPLACE FUNCTION public.expire_governance_emergency_access_requests(
  requested_pending_max_age_hours integer DEFAULT 24,
  requested_approved_max_age_minutes integer DEFAULT 120
)
RETURNS TABLE (
  expired_pending_count integer,
  expired_approved_count integer,
  total_expired_count integer
) AS $$
DECLARE
  pending_max_age_hours integer := greatest(1, coalesce(requested_pending_max_age_hours, 24));
  approved_max_age_minutes integer := greatest(1, coalesce(requested_approved_max_age_minutes, 120));
  expired_pending integer := 0;
  expired_approved integer := 0;
BEGIN
  IF NOT (
    session_user IN ('postgres', 'supabase_admin')
    OR public.has_permission('settings.manage'::public.app_permission)
  ) THEN
    RAISE EXCEPTION 'Current profile is not authorized to expire emergency access requests';
  END IF;

  WITH expired_pending_rows AS (
    UPDATE public.governance_emergency_access_requests AS request
    SET
      request_status = 'expired',
      reviewed_by = coalesce(request.reviewed_by, public.current_profile_id()),
      reviewed_at = coalesce(request.reviewed_at, now()),
      review_notes = coalesce(nullif(btrim(coalesce(request.review_notes, '')), ''), 'Auto-expired: pending request exceeded max age'),
      approved_expires_at = NULL,
      updated_by = public.current_profile_id()
    WHERE request.request_status = 'pending'
      AND request.created_at <= now() - make_interval(hours => pending_max_age_hours)
    RETURNING request.id
  )
  SELECT count(*)::integer INTO expired_pending
  FROM expired_pending_rows;

  WITH expired_approved_rows AS (
    UPDATE public.governance_emergency_access_requests AS request
    SET
      request_status = 'expired',
      review_notes = coalesce(nullif(btrim(coalesce(request.review_notes, '')), ''), 'Auto-expired: approved request exceeded TTL'),
      approved_expires_at = request.approved_expires_at,
      updated_by = public.current_profile_id()
    WHERE request.request_status = 'approved'
      AND request.consumed_at IS NULL
      AND (
        (request.approved_expires_at IS NOT NULL AND request.approved_expires_at <= now())
        OR request.reviewed_at <= now() - make_interval(mins => approved_max_age_minutes)
      )
    RETURNING request.id
  )
  SELECT count(*)::integer INTO expired_approved
  FROM expired_approved_rows;

  RETURN QUERY
  SELECT
    coalesce(expired_pending, 0),
    coalesce(expired_approved, 0),
    coalesce(expired_pending, 0) + coalesce(expired_approved, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_emergency_access_ops_summary(
  requested_pending_max_age_hours integer DEFAULT 24,
  requested_near_expiry_window_minutes integer DEFAULT 15
)
RETURNS TABLE (
  pending_count integer,
  stale_pending_count integer,
  approved_unconsumed_count integer,
  near_expiry_approved_count integer,
  consumed_count integer,
  rejected_count integer,
  expired_count integer,
  latest_request_at timestamptz,
  latest_event_at timestamptz
) AS $$
DECLARE
  pending_max_age_hours integer := greatest(1, coalesce(requested_pending_max_age_hours, 24));
  near_expiry_window_minutes integer := greatest(1, coalesce(requested_near_expiry_window_minutes, 15));
BEGIN
  IF NOT (
    public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
  ) THEN
    RAISE EXCEPTION 'Current profile is not authorized to read emergency access operations summary';
  END IF;

  RETURN QUERY
  SELECT
    coalesce(count(*) FILTER (WHERE request.request_status = 'pending'), 0)::integer AS pending_count,
    coalesce(count(*) FILTER (
      WHERE request.request_status = 'pending'
        AND request.created_at <= now() - make_interval(hours => pending_max_age_hours)
    ), 0)::integer AS stale_pending_count,
    coalesce(count(*) FILTER (
      WHERE request.request_status = 'approved'
        AND request.consumed_at IS NULL
    ), 0)::integer AS approved_unconsumed_count,
    coalesce(count(*) FILTER (
      WHERE request.request_status = 'approved'
        AND request.consumed_at IS NULL
        AND request.approved_expires_at IS NOT NULL
        AND request.approved_expires_at <= now() + make_interval(mins => near_expiry_window_minutes)
    ), 0)::integer AS near_expiry_approved_count,
    coalesce(count(*) FILTER (WHERE request.consumed_at IS NOT NULL), 0)::integer AS consumed_count,
    coalesce(count(*) FILTER (WHERE request.request_status = 'rejected'), 0)::integer AS rejected_count,
    coalesce(count(*) FILTER (WHERE request.request_status = 'expired'), 0)::integer AS expired_count,
    max(request.created_at) AS latest_request_at,
    (
      SELECT max(event.created_at)
      FROM public.governance_emergency_access_request_events AS event
    ) AS latest_event_at
  FROM public.governance_emergency_access_requests AS request;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.gpav_emergency_access_expiry_tick()
RETURNS void AS $$
DECLARE
  _rec record;
BEGIN
  IF session_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Emergency access expiry tick is restricted to database superuser sessions';
  END IF;

  FOR _rec IN
    SELECT *
    FROM public.expire_governance_emergency_access_requests(24, 120)
  LOOP
    NULL;
  END LOOP;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Emergency access expiry tick non-fatal: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.gpav_emergency_access_expiry_tick() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gpav_emergency_access_expiry_tick() FROM authenticated;
REVOKE ALL ON FUNCTION public.gpav_emergency_access_expiry_tick() FROM service_role;

GRANT EXECUTE ON FUNCTION public.gpav_emergency_access_expiry_tick() TO postgres;
GRANT EXECUTE ON FUNCTION public.gpav_emergency_access_expiry_tick() TO supabase_admin;

DO $$
BEGIN
  IF to_regnamespace('cron') IS NULL THEN
    RAISE NOTICE 'pg_cron schema missing; skipping emergency access expiry cron registration.';
    RETURN;
  END IF;

  BEGIN
    EXECUTE $cron$
      SELECT cron.unschedule(job.jobid)
      FROM cron.job
      WHERE job.jobname = 'governance_emergency_access_expiry_tick'
    $cron$;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Could not unschedule emergency access expiry cron job: %', SQLERRM;
  END;

  BEGIN
    EXECUTE $cron$
      SELECT cron.schedule(
        'governance_emergency_access_expiry_tick',
        '10 * * * *',
        $job$SELECT public.gpav_emergency_access_expiry_tick();$job$
      )
    $cron$;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Could not schedule emergency access expiry cron job: %', SQLERRM;
  END;
END $$;

GRANT EXECUTE ON FUNCTION public.expire_governance_emergency_access_requests(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_emergency_access_ops_summary(integer, integer) TO authenticated;
