-- Stewardship hardening: allow explicit acknowledgement of external execution pages
-- (in addition to open/resolve) for incident workflow visibility.

CREATE OR REPLACE FUNCTION public.acknowledge_governance_public_audit_external_execution_page(
  target_page_id uuid,
  acknowledgement_notes text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  page_record public.governance_public_audit_external_execution_pages%ROWTYPE;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to acknowledge public audit external execution pages';
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

GRANT EXECUTE ON FUNCTION public.acknowledge_governance_public_audit_external_execution_page(uuid, text) TO authenticated;
