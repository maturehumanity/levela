-- Governance hub cross-surface escalation for emergency access operations risk.

CREATE OR REPLACE FUNCTION public.maybe_escalate_governance_emergency_access_ops_execution_page(
  requested_pending_max_age_hours integer DEFAULT 24,
  requested_near_expiry_window_minutes integer DEFAULT 15
)
RETURNS uuid AS $$
DECLARE
  summary_row record;
  latest_batch_id uuid;
  page_message text;
  page_id uuid := NULL;
BEGIN
  IF NOT (
    session_user IN ('postgres', 'supabase_admin')
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.current_profile_can_manage_public_audit_verifiers()
  ) THEN
    RAISE EXCEPTION 'Current profile is not authorized to escalate emergency access operations pages';
  END IF;

  SELECT *
  INTO summary_row
  FROM public.governance_emergency_access_ops_summary(
    requested_pending_max_age_hours,
    requested_near_expiry_window_minutes
  );

  IF summary_row IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT batch.id
  INTO latest_batch_id
  FROM public.governance_public_audit_batches AS batch
  ORDER BY batch.batch_index DESC
  LIMIT 1;

  IF latest_batch_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF coalesce(summary_row.stale_pending_count, 0) > 0
     OR coalesce(summary_row.near_expiry_approved_count, 0) > 0
  THEN
    page_message := format(
      'Emergency access ops risk (stale pending=%s, near-expiry approved=%s, pending=%s)',
      coalesce(summary_row.stale_pending_count, 0),
      coalesce(summary_row.near_expiry_approved_count, 0),
      coalesce(summary_row.pending_count, 0)
    );

    page_id := public.open_governance_public_audit_external_execution_page(
      latest_batch_id,
      'governance_emergency_access_ops_escalation',
      CASE
        WHEN coalesce(summary_row.stale_pending_count, 0) > 0 THEN 'critical'
        ELSE 'warning'
      END,
      page_message,
      jsonb_build_object(
        'pending_count', summary_row.pending_count,
        'stale_pending_count', summary_row.stale_pending_count,
        'approved_unconsumed_count', summary_row.approved_unconsumed_count,
        'near_expiry_approved_count', summary_row.near_expiry_approved_count,
        'consumed_count', summary_row.consumed_count,
        'expired_count', summary_row.expired_count,
        'latest_request_at', summary_row.latest_request_at,
        'latest_event_at', summary_row.latest_event_at
      )
    );
    RETURN page_id;
  END IF;

  UPDATE public.governance_public_audit_external_execution_pages AS page
  SET
    page_status = 'resolved',
    page_payload = coalesce(page.page_payload, '{}'::jsonb)
      || jsonb_build_object(
        'resolved_reason', 'Emergency access ops risk cleared',
        'resolved_at', now()
      ),
    resolved_at = now(),
    resolved_by = public.current_profile_id(),
    updated_at = now()
  WHERE page.batch_id = latest_batch_id
    AND page.page_key = 'governance_emergency_access_ops_escalation'
    AND page.page_status IN ('open', 'acknowledged');

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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

  PERFORM public.maybe_escalate_governance_emergency_access_ops_execution_page(24, 15);
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Emergency access expiry tick non-fatal: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.maybe_escalate_governance_emergency_access_ops_execution_page(integer, integer) TO authenticated;
