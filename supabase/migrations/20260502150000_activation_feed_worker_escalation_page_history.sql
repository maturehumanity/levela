-- Roadmap §14.1: activation feed stewards read feed-worker escalation page history without
-- public-audit verifier manager permission (fixed page_key; same row shape as
-- governance_public_audit_external_execution_page_history).

CREATE OR REPLACE FUNCTION public.activation_demographic_feed_worker_escalation_page_history(
  requested_lookback_hours integer DEFAULT 168,
  max_pages integer DEFAULT 120
)
RETURNS TABLE (
  page_id uuid,
  batch_id uuid,
  page_key text,
  severity text,
  page_status text,
  page_message text,
  oncall_channel text,
  opened_at timestamptz,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  updated_at timestamptz
) AS $$
DECLARE
  lookback_hours integer := greatest(1, coalesce(requested_lookback_hours, 168));
  page_limit integer := greatest(1, coalesce(max_pages, 120));
BEGIN
  IF NOT public.current_profile_can_manage_activation_demographic_feed_workers() THEN
    RAISE EXCEPTION 'Current caller is not authorized to read activation demographic feed worker escalation page history';
  END IF;

  RETURN QUERY
  SELECT
    page.id AS page_id,
    page.batch_id,
    page.page_key,
    page.severity,
    page.page_status,
    page.page_message,
    page.oncall_channel,
    page.opened_at,
    page.acknowledged_at,
    page.resolved_at,
    page.updated_at
  FROM public.governance_public_audit_external_execution_pages AS page
  WHERE page.page_key = 'activation_demographic_feed_worker_escalation'
    AND page.opened_at >= now() - make_interval(hours => lookback_hours)
  ORDER BY page.opened_at DESC, page.created_at DESC, page.id DESC
  LIMIT page_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.activation_demographic_feed_worker_escalation_page_history(integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activation_demographic_feed_worker_escalation_page_history(integer, integer) FROM service_role;
GRANT EXECUTE ON FUNCTION public.activation_demographic_feed_worker_escalation_page_history(integer, integer) TO authenticated;
