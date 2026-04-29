-- Roadmap §14.1 deeper paging: optional HTTPS POST when an external execution page opens,
-- using default policy metadata key oncall_webhook_url (https only). Requires pg_net on
-- the database host; otherwise dispatch is a no-op with NOTICE.

CREATE OR REPLACE FUNCTION public._dispatch_public_audit_external_execution_page_webhook(target_page_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  policy_metadata jsonb;
  webhook_url text;
  page_id uuid;
  page_batch_id uuid;
  page_key text;
  page_severity text;
  page_message text;
  page_oncall text;
  page_opened_at timestamptz;
  payload jsonb;
BEGIN
  IF target_page_id IS NULL THEN
    RETURN;
  END IF;

  SELECT p.metadata
  INTO policy_metadata
  FROM public.governance_public_audit_external_execution_policies AS p
  WHERE p.policy_key = 'default'
  LIMIT 1;

  webhook_url := nullif(btrim(coalesce(policy_metadata ->> 'oncall_webhook_url', '')), '');

  IF webhook_url IS NULL OR length(webhook_url) > 2048 THEN
    RETURN;
  END IF;

  IF lower(webhook_url) NOT LIKE 'https://%' THEN
    RAISE NOTICE '_dispatch_public_audit_external_execution_page_webhook: skipped oncall_webhook_url (https required)';
    RETURN;
  END IF;

  SELECT
    page.id,
    page.batch_id,
    page.page_key,
    page.severity,
    page.page_message,
    page.oncall_channel,
    page.opened_at
  INTO
    page_id,
    page_batch_id,
    page_key,
    page_severity,
    page_message,
    page_oncall,
    page_opened_at
  FROM public.governance_public_audit_external_execution_pages AS page
  WHERE page.id = target_page_id;

  IF NOT FOUND OR page_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE '_dispatch_public_audit_external_execution_page_webhook: pg_net not installed; skipping HTTP dispatch';
    RETURN;
  END IF;

  payload := jsonb_build_object(
    'event', 'levela.public_audit.external_execution_page_opened',
    'page_id', page_id,
    'batch_id', page_batch_id,
    'page_key', page_key,
    'severity', page_severity,
    'page_message', page_message,
    'oncall_channel', page_oncall,
    'opened_at', page_opened_at
  );

  BEGIN
    PERFORM net.http_post(
      url := webhook_url,
      body := payload,
      params := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Levela-Event', 'public_audit_external_execution_page_opened'
      ),
      timeout_milliseconds := 8000
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '_dispatch_public_audit_external_execution_page_webhook: net.http_post failed (%): %', SQLSTATE, SQLERRM;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public._dispatch_public_audit_external_execution_page_webhook(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._dispatch_public_audit_external_execution_page_webhook(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public._dispatch_public_audit_external_execution_page_webhook(uuid) FROM service_role;

CREATE OR REPLACE FUNCTION public.open_governance_public_audit_external_execution_page(
  target_batch_id uuid,
  page_key text,
  severity text,
  page_message text,
  page_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  policy_record public.governance_public_audit_external_execution_policies%ROWTYPE;
  inserted_id uuid;
  normalized_page_key text;
  normalized_severity text;
  normalized_message text;
  caller_authorized boolean;
BEGIN
  normalized_page_key := lower(coalesce(nullif(btrim(coalesce(page_key, '')), ''), 'external_execution_ops'));
  normalized_severity := lower(coalesce(nullif(btrim(coalesce(severity, '')), ''), 'warning'));
  normalized_message := coalesce(nullif(btrim(coalesce(page_message, '')), ''), 'Public audit external execution policy threshold breached');

  caller_authorized := public.current_profile_can_manage_public_audit_verifiers()
    OR (
      normalized_page_key = 'activation_demographic_feed_worker_escalation'
      AND public.current_profile_can_manage_activation_demographic_feed_workers()
    )
    OR (
      session_user IN ('postgres', 'supabase_admin')
      AND normalized_page_key = 'activation_demographic_feed_worker_escalation'
    )
    OR (
      session_user IN ('postgres', 'supabase_admin')
      AND normalized_page_key = 'verifier_federation_distribution_escalation'
    )
    OR (
      normalized_page_key = 'guardian_relay_critical_escalation'
      AND public.current_profile_can_manage_guardian_relays()
    )
    OR (
      normalized_page_key = 'guardian_relay_proof_distribution_escalation'
      AND public.current_profile_can_manage_guardian_relays()
    )
    OR (
      session_user IN ('postgres', 'supabase_admin')
      AND normalized_page_key = 'guardian_relay_proof_distribution_escalation'
    )
    OR (
      session_user IN ('postgres', 'supabase_admin')
      AND normalized_page_key = 'guardian_relay_critical_escalation'
    );

  IF NOT caller_authorized THEN
    RAISE EXCEPTION 'Current profile is not authorized to open public audit external execution pages';
  END IF;

  IF target_batch_id IS NULL THEN
    RAISE EXCEPTION 'Target batch id is required';
  END IF;

  IF normalized_severity NOT IN ('info', 'warning', 'critical') THEN
    RAISE EXCEPTION 'Page severity must be info, warning, or critical';
  END IF;

  SELECT policy.*
  INTO policy_record
  FROM public.governance_public_audit_external_execution_policies AS policy
  WHERE policy.policy_key = 'default'
  LIMIT 1;

  INSERT INTO public.governance_public_audit_external_execution_pages (
    batch_id,
    page_key,
    severity,
    page_status,
    page_message,
    oncall_channel,
    page_payload,
    opened_at,
    created_by
  )
  VALUES (
    target_batch_id,
    normalized_page_key,
    normalized_severity,
    'open',
    normalized_message,
    coalesce(policy_record.oncall_channel, 'public_audit_ops'),
    coalesce(page_payload, '{}'::jsonb),
    now(),
    public.current_profile_id()
  )
  ON CONFLICT (batch_id, page_key) DO UPDATE
    SET severity = excluded.severity,
        page_status = 'open',
        page_message = excluded.page_message,
        oncall_channel = excluded.oncall_channel,
        page_payload = coalesce(public.governance_public_audit_external_execution_pages.page_payload, '{}'::jsonb)
          || coalesce(excluded.page_payload, '{}'::jsonb),
        opened_at = now(),
        acknowledged_at = NULL,
        resolved_at = NULL,
        resolved_by = NULL
  RETURNING id INTO inserted_id;

  BEGIN
    PERFORM public._dispatch_public_audit_external_execution_page_webhook(inserted_id);
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'open_governance_public_audit_external_execution_page webhook dispatch non-fatal: %', SQLERRM;
  END;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
