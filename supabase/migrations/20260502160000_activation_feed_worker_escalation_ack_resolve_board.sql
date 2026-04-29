-- Roadmap §14.1: activation feed stewards can list open escalation pages for the latest (or
-- requested) public audit batch and acknowledge/resolve without public-audit verifier manager
-- permission (fixed page_key only).

CREATE OR REPLACE FUNCTION public.activation_demographic_feed_worker_escalation_page_board(
  requested_batch_id uuid DEFAULT NULL,
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
  resolved_at timestamptz
) AS $$
BEGIN
  IF NOT public.current_profile_can_manage_activation_demographic_feed_workers() THEN
    RAISE EXCEPTION 'Current caller is not authorized to read activation demographic feed worker escalation page board';
  END IF;

  RETURN QUERY
  WITH target_batch AS (
    SELECT coalesce(
      requested_batch_id,
      (
        SELECT batch.id
        FROM public.governance_public_audit_batches AS batch
        ORDER BY batch.batch_index DESC
        LIMIT 1
      )
    ) AS batch_id
  )
  SELECT
    page.id AS page_id,
    page.batch_id,
    page.page_key,
    page.severity,
    page.page_status,
    page.page_message,
    page.oncall_channel,
    page.opened_at,
    page.resolved_at
  FROM public.governance_public_audit_external_execution_pages AS page
  JOIN target_batch ON target_batch.batch_id = page.batch_id
  WHERE page.page_key = 'activation_demographic_feed_worker_escalation'
  ORDER BY page.opened_at DESC, page.created_at DESC, page.id DESC
  LIMIT greatest(1, coalesce(max_pages, 120));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.acknowledge_activation_demographic_feed_worker_escalation_page(
  target_page_id uuid,
  acknowledgement_notes text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  page_record public.governance_public_audit_external_execution_pages%ROWTYPE;
BEGIN
  IF NOT public.current_profile_can_manage_activation_demographic_feed_workers() THEN
    RAISE EXCEPTION 'Current caller is not authorized to acknowledge activation demographic feed worker escalation pages';
  END IF;

  IF target_page_id IS NULL THEN
    RAISE EXCEPTION 'Target page id is required';
  END IF;

  SELECT *
  INTO page_record
  FROM public.governance_public_audit_external_execution_pages AS page
  WHERE page.id = target_page_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Public audit external execution page not found';
  END IF;

  IF page_record.page_key IS DISTINCT FROM 'activation_demographic_feed_worker_escalation' THEN
    RAISE EXCEPTION 'External execution page is not an activation demographic feed worker escalation page';
  END IF;

  IF page_record.page_status = 'resolved' THEN
    RAISE EXCEPTION 'Resolved external execution pages cannot be acknowledged';
  END IF;

  UPDATE public.governance_public_audit_external_execution_pages
  SET
    page_status = 'acknowledged',
    acknowledged_at = now(),
    page_payload = coalesce(page_record.page_payload, '{}'::jsonb)
      || jsonb_build_object(
        'acknowledgement_notes', nullif(btrim(coalesce(acknowledgement_notes, '')), ''),
        'acknowledged_at', now(),
        'acknowledged_by', public.current_profile_id()
      ),
    updated_at = now()
  WHERE id = page_record.id;

  RETURN page_record.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.resolve_activation_demographic_feed_worker_escalation_page(
  target_page_id uuid,
  resolution_notes text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  page_record public.governance_public_audit_external_execution_pages%ROWTYPE;
BEGIN
  IF NOT public.current_profile_can_manage_activation_demographic_feed_workers() THEN
    RAISE EXCEPTION 'Current caller is not authorized to resolve activation demographic feed worker escalation pages';
  END IF;

  IF target_page_id IS NULL THEN
    RAISE EXCEPTION 'Target page id is required';
  END IF;

  SELECT *
  INTO page_record
  FROM public.governance_public_audit_external_execution_pages AS page
  WHERE page.id = target_page_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Public audit external execution page not found';
  END IF;

  IF page_record.page_key IS DISTINCT FROM 'activation_demographic_feed_worker_escalation' THEN
    RAISE EXCEPTION 'External execution page is not an activation demographic feed worker escalation page';
  END IF;

  UPDATE public.governance_public_audit_external_execution_pages
  SET
    page_status = 'resolved',
    page_payload = coalesce(page_record.page_payload, '{}'::jsonb)
      || jsonb_build_object(
        'resolution_notes', nullif(btrim(coalesce(resolution_notes, '')), ''),
        'resolved_at', now()
      ),
    resolved_at = now(),
    resolved_by = public.current_profile_id()
  WHERE id = page_record.id;

  RETURN page_record.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.activation_demographic_feed_worker_escalation_page_board(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activation_demographic_feed_worker_escalation_page_board(uuid, integer) FROM service_role;
GRANT EXECUTE ON FUNCTION public.activation_demographic_feed_worker_escalation_page_board(uuid, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.acknowledge_activation_demographic_feed_worker_escalation_page(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.acknowledge_activation_demographic_feed_worker_escalation_page(uuid, text) FROM service_role;
GRANT EXECUTE ON FUNCTION public.acknowledge_activation_demographic_feed_worker_escalation_page(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.resolve_activation_demographic_feed_worker_escalation_page(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_activation_demographic_feed_worker_escalation_page(uuid, text) FROM service_role;
GRANT EXECUTE ON FUNCTION public.resolve_activation_demographic_feed_worker_escalation_page(uuid, text) TO authenticated;
