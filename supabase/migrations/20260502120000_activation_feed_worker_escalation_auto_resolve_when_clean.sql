-- Roadmap §14.1: when activation feed worker alert summary has no qualifying issues,
-- auto-resolve an open or acknowledged activation_demographic_feed_worker_escalation
-- page for the same batch (closes the escalation loop without leaving stale pages).

CREATE OR REPLACE FUNCTION public.maybe_escalate_activation_feed_worker_exec_page(
  target_batch_id uuid DEFAULT NULL,
  requested_freshness_hours integer DEFAULT 24,
  escalation_context jsonb DEFAULT '{}'::jsonb
)
RETURNS void AS $$
DECLARE
  resolved_batch_id uuid;
  normalized_hours integer;
  adapter_issue_count integer;
  page_to_resolve_id uuid;
BEGIN
  IF NOT (
    session_user IN ('postgres', 'supabase_admin')
    OR public.current_profile_can_manage_activation_demographic_feed_workers()
    OR public.current_profile_can_manage_public_audit_verifiers()
  ) THEN
    RAISE EXCEPTION 'Current caller is not authorized to evaluate activation demographic feed worker escalation';
  END IF;

  normalized_hours := greatest(1, coalesce(requested_freshness_hours, 24));

  SELECT coalesce(
    target_batch_id,
    (
      SELECT batch.id
      FROM public.governance_public_audit_batches AS batch
      ORDER BY batch.batch_index DESC
      LIMIT 1
    )
  )
  INTO resolved_batch_id;

  IF resolved_batch_id IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*)::integer
  INTO adapter_issue_count
  FROM public.activation_demographic_feed_worker_alert_summary(normalized_hours) AS summary
  WHERE summary.freshness_alert
    OR coalesce(summary.signature_failure_count, 0) > 0
    OR coalesce(summary.connectivity_failure_count, 0) > 0
    OR coalesce(summary.payload_failure_count, 0) > 0;

  IF coalesce(adapter_issue_count, 0) <= 0 THEN
    SELECT page.id
    INTO page_to_resolve_id
    FROM public.governance_public_audit_external_execution_pages AS page
    WHERE page.batch_id = resolved_batch_id
      AND lower(btrim(page.page_key)) = 'activation_demographic_feed_worker_escalation'
      AND page.page_status IN ('open', 'acknowledged')
    ORDER BY page.opened_at DESC NULLS LAST, page.id DESC
    LIMIT 1;

    IF page_to_resolve_id IS NOT NULL THEN
      BEGIN
        PERFORM public.resolve_governance_public_audit_external_execution_page(
          page_to_resolve_id,
          format(
            'Automatically resolved: activation feed worker alert summary has no open issues (freshness window %s hours).',
            normalized_hours
          )
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'maybe_escalate_activation_feed_worker_exec_page auto-resolve skipped (non-fatal): %', SQLERRM;
      END;
    END IF;

    RETURN;
  END IF;

  PERFORM public.open_governance_public_audit_external_execution_page(
    resolved_batch_id,
    'activation_demographic_feed_worker_escalation',
    'critical',
    format(
      '%s active activation demographic feed adapter(s) need attention (freshness SLA and/or unresolved worker alerts).',
      adapter_issue_count
    ),
    jsonb_build_object(
      'source', 'maybe_escalate_activation_feed_worker_exec_page',
      'adapter_issue_count', adapter_issue_count,
      'requested_freshness_hours', normalized_hours
    ) || coalesce(escalation_context, '{}'::jsonb)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
