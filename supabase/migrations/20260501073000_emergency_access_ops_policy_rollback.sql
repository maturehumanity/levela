-- Stewardship safety: allow rollback of emergency access ops policy to a prior
-- audited event snapshot.

CREATE OR REPLACE FUNCTION public.rollback_governance_emergency_access_ops_policy_to_event(
  target_event_id uuid
)
RETURNS text AS $$
DECLARE
  event_record public.governance_emergency_access_ops_policy_events%ROWTYPE;
  pending_max_age_hours integer;
  approved_max_age_minutes integer;
  near_expiry_window_minutes integer;
  escalation_enabled boolean;
  oncall_channel text;
BEGIN
  IF NOT public.has_permission('settings.manage'::public.app_permission) THEN
    RAISE EXCEPTION 'Current profile is not authorized to rollback emergency access ops policy';
  END IF;

  IF target_event_id IS NULL THEN
    RAISE EXCEPTION 'Target event id is required';
  END IF;

  SELECT *
  INTO event_record
  FROM public.governance_emergency_access_ops_policy_events AS event
  WHERE event.id = target_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Emergency access ops policy event does not exist';
  END IF;

  IF event_record.event_type NOT IN ('created', 'updated') THEN
    RAISE EXCEPTION 'Only created/updated policy events can be used for rollback';
  END IF;

  pending_max_age_hours := coalesce(
    nullif(event_record.metadata ->> 'next_pending_max_age_hours', '')::integer,
    nullif(event_record.metadata ->> 'pending_max_age_hours', '')::integer
  );
  approved_max_age_minutes := coalesce(
    nullif(event_record.metadata ->> 'next_approved_max_age_minutes', '')::integer,
    nullif(event_record.metadata ->> 'approved_max_age_minutes', '')::integer
  );
  near_expiry_window_minutes := coalesce(
    nullif(event_record.metadata ->> 'next_near_expiry_window_minutes', '')::integer,
    nullif(event_record.metadata ->> 'near_expiry_window_minutes', '')::integer
  );
  escalation_enabled := coalesce(
    nullif(event_record.metadata ->> 'next_escalation_enabled', '')::boolean,
    nullif(event_record.metadata ->> 'escalation_enabled', '')::boolean
  );
  oncall_channel := coalesce(
    nullif(event_record.metadata ->> 'next_oncall_channel', ''),
    nullif(event_record.metadata ->> 'oncall_channel', '')
  );

  IF pending_max_age_hours IS NULL
     OR approved_max_age_minutes IS NULL
     OR near_expiry_window_minutes IS NULL
     OR escalation_enabled IS NULL
     OR oncall_channel IS NULL
  THEN
    RAISE EXCEPTION 'Policy rollback event metadata is incomplete';
  END IF;

  RETURN public.set_governance_emergency_access_ops_policy(
    event_record.policy_key,
    'Default emergency access operations policy',
    pending_max_age_hours,
    approved_max_age_minutes,
    near_expiry_window_minutes,
    escalation_enabled,
    oncall_channel,
    jsonb_build_object(
      'source', 'rollback_governance_emergency_access_ops_policy_to_event',
      'rollback_event_id', event_record.id,
      'rollback_event_type', event_record.event_type
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.rollback_governance_emergency_access_ops_policy_to_event(uuid) TO authenticated;
