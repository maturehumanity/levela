-- Provide a Postgres-safe RPC name for emergency access policy rollback eligibility history.

CREATE OR REPLACE FUNCTION public.governance_emergency_access_ops_policy_event_eligibility(
  requested_policy_key text DEFAULT 'default',
  requested_lookback_hours integer DEFAULT 336,
  max_events integer DEFAULT 120,
  max_rollback_age_hours integer DEFAULT 336,
  required_policy_schema_version text DEFAULT '1'
)
RETURNS TABLE (
  event_id uuid,
  policy_key text,
  event_type text,
  actor_profile_id uuid,
  actor_name text,
  event_message text,
  metadata jsonb,
  created_at timestamptz,
  rollback_eligible boolean,
  rollback_eligibility_reason text
) AS $$
  SELECT *
  FROM public.governance_emergency_access_ops_policy_event_history_with_eligibility(
    requested_policy_key,
    requested_lookback_hours,
    max_events,
    max_rollback_age_hours,
    required_policy_schema_version
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.governance_emergency_access_ops_policy_event_eligibility(text, integer, integer, integer, text) TO authenticated;
