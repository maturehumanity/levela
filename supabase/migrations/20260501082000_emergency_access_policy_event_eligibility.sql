-- Steward-facing rollback eligibility status for emergency access policy timeline events.

CREATE OR REPLACE FUNCTION public.governance_emergency_access_ops_policy_event_history_with_eligibility(
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
DECLARE
  normalized_policy_key text := coalesce(nullif(lower(btrim(coalesce(requested_policy_key, ''))), ''), 'default');
  lookback_hours integer := greatest(1, coalesce(requested_lookback_hours, 336));
  rollback_age_hours integer := greatest(1, coalesce(max_rollback_age_hours, 336));
  required_schema_version text := coalesce(nullif(btrim(coalesce(required_policy_schema_version, '')), ''), '1');
BEGIN
  IF NOT (
    public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
  ) THEN
    RAISE EXCEPTION 'Current profile is not authorized to read emergency access ops policy history';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      event.id AS event_id,
      event.policy_key,
      event.event_type,
      event.actor_profile_id,
      CASE
        WHEN actor.id IS NULL THEN NULL
        ELSE coalesce(actor.full_name, actor.username, actor.id::text)
      END AS actor_name,
      event.event_message,
      event.metadata,
      event.created_at
    FROM public.governance_emergency_access_ops_policy_events AS event
    LEFT JOIN public.profiles AS actor
      ON actor.id = event.actor_profile_id
    WHERE event.policy_key = normalized_policy_key
      AND event.created_at >= now() - make_interval(hours => lookback_hours)
    ORDER BY event.created_at DESC, event.id DESC
    LIMIT greatest(1, coalesce(max_events, 120))
  )
  SELECT
    base.event_id,
    base.policy_key,
    base.event_type,
    base.actor_profile_id,
    base.actor_name,
    base.event_message,
    base.metadata,
    base.created_at,
    (
      base.event_type IN ('created', 'updated')
      AND coalesce(nullif(base.metadata ->> 'policy_schema_version', ''), 'unknown') = required_schema_version
      AND base.created_at >= now() - make_interval(hours => rollback_age_hours)
      AND coalesce(
        nullif(base.metadata ->> 'next_pending_max_age_hours', '')::integer,
        nullif(base.metadata ->> 'pending_max_age_hours', '')::integer
      ) IS NOT NULL
      AND coalesce(
        nullif(base.metadata ->> 'next_approved_max_age_minutes', '')::integer,
        nullif(base.metadata ->> 'approved_max_age_minutes', '')::integer
      ) IS NOT NULL
      AND coalesce(
        nullif(base.metadata ->> 'next_near_expiry_window_minutes', '')::integer,
        nullif(base.metadata ->> 'near_expiry_window_minutes', '')::integer
      ) IS NOT NULL
      AND coalesce(
        nullif(base.metadata ->> 'next_escalation_enabled', '')::boolean,
        nullif(base.metadata ->> 'escalation_enabled', '')::boolean
      ) IS NOT NULL
      AND coalesce(
        nullif(base.metadata ->> 'next_oncall_channel', ''),
        nullif(base.metadata ->> 'oncall_channel', '')
      ) IS NOT NULL
    ) AS rollback_eligible,
    CASE
      WHEN base.event_type NOT IN ('created', 'updated')
        THEN 'Not a rollback snapshot event'
      WHEN coalesce(nullif(base.metadata ->> 'policy_schema_version', ''), 'unknown') <> required_schema_version
        THEN format(
          'Incompatible schema version (%s)',
          coalesce(nullif(base.metadata ->> 'policy_schema_version', ''), 'unknown')
        )
      WHEN base.created_at < now() - make_interval(hours => rollback_age_hours)
        THEN format('Older than rollback window (%sh)', rollback_age_hours::text)
      WHEN coalesce(
        nullif(base.metadata ->> 'next_pending_max_age_hours', '')::integer,
        nullif(base.metadata ->> 'pending_max_age_hours', '')::integer
      ) IS NULL
        OR coalesce(
          nullif(base.metadata ->> 'next_approved_max_age_minutes', '')::integer,
          nullif(base.metadata ->> 'approved_max_age_minutes', '')::integer
        ) IS NULL
        OR coalesce(
          nullif(base.metadata ->> 'next_near_expiry_window_minutes', '')::integer,
          nullif(base.metadata ->> 'near_expiry_window_minutes', '')::integer
        ) IS NULL
        OR coalesce(
          nullif(base.metadata ->> 'next_escalation_enabled', '')::boolean,
          nullif(base.metadata ->> 'escalation_enabled', '')::boolean
        ) IS NULL
        OR coalesce(
          nullif(base.metadata ->> 'next_oncall_channel', ''),
          nullif(base.metadata ->> 'oncall_channel', '')
        ) IS NULL
        THEN 'Snapshot metadata incomplete'
      ELSE 'Eligible'
    END AS rollback_eligibility_reason
  FROM base;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.governance_emergency_access_ops_policy_event_history_with_eligibility(text, integer, integer, integer, text) TO authenticated;
