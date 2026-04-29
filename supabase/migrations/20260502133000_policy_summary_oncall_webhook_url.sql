-- Expose optional paging webhook URL (from policy metadata) on the policy summary RPC
-- so steward UIs can load and edit it without ad hoc SQL.

DROP FUNCTION IF EXISTS public.governance_public_audit_external_execution_policy_summary(text);

CREATE OR REPLACE FUNCTION public.governance_public_audit_external_execution_policy_summary(
  requested_policy_key text DEFAULT 'default'
)
RETURNS TABLE (
  policy_key text,
  policy_name text,
  is_active boolean,
  claim_ttl_minutes integer,
  anchor_max_attempts integer,
  verifier_max_attempts integer,
  retry_base_delay_minutes integer,
  retry_max_delay_minutes integer,
  paging_enabled boolean,
  paging_stale_pending_minutes integer,
  paging_failure_share_percent numeric,
  oncall_channel text,
  oncall_webhook_url text,
  updated_at timestamptz
) AS $$
SELECT
  policy.policy_key,
  policy.policy_name,
  policy.is_active,
  policy.claim_ttl_minutes,
  policy.anchor_max_attempts,
  policy.verifier_max_attempts,
  policy.retry_base_delay_minutes,
  policy.retry_max_delay_minutes,
  policy.paging_enabled,
  policy.paging_stale_pending_minutes,
  policy.paging_failure_share_percent,
  policy.oncall_channel,
  nullif(trim(coalesce(policy.metadata ->> 'oncall_webhook_url', '')), '') AS oncall_webhook_url,
  policy.updated_at
FROM public.governance_public_audit_external_execution_policies AS policy
WHERE policy.policy_key = coalesce(nullif(btrim(coalesce(requested_policy_key, '')), ''), 'default')
LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.governance_public_audit_external_execution_policy_summary(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.governance_public_audit_external_execution_policy_summary(text) FROM service_role;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_external_execution_policy_summary(text) TO authenticated;
