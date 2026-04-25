-- Stewardship analytics: query external execution page history across batches.

CREATE OR REPLACE FUNCTION public.governance_public_audit_external_execution_page_history(
  requested_page_key_substring text,
  requested_lookback_hours integer DEFAULT 168,
  max_pages integer DEFAULT 200
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
  normalized_substring text := nullif(lower(btrim(coalesce(requested_page_key_substring, ''))), '');
  lookback_hours integer := greatest(1, coalesce(requested_lookback_hours, 168));
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to read external execution page history';
  END IF;

  IF normalized_substring IS NULL THEN
    RAISE EXCEPTION 'Page key substring is required';
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
  WHERE lower(page.page_key) LIKE '%' || normalized_substring || '%'
    AND page.opened_at >= now() - make_interval(hours => lookback_hours)
  ORDER BY page.opened_at DESC, page.created_at DESC, page.id DESC
  LIMIT greatest(1, coalesce(max_pages, 200));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.governance_public_audit_external_execution_page_history(text, integer, integer) TO authenticated;
