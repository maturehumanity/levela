-- Rollback guardrails: require recent compatible policy snapshots for rollback.

CREATE OR REPLACE FUNCTION public.set_governance_emergency_access_ops_policy(
  requested_policy_key text DEFAULT 'default',
  requested_policy_name text DEFAULT 'Default emergency access operations policy',
  requested_pending_max_age_hours integer DEFAULT 24,
  requested_approved_max_age_minutes integer DEFAULT 120,
  requested_near_expiry_window_minutes integer DEFAULT 15,
  requested_escalation_enabled boolean DEFAULT true,
  requested_oncall_channel text DEFAULT 'public_audit_ops',
  metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS text AS $$
DECLARE
  normalized_policy_key text;
  normalized_policy_name text;
  normalized_oncall_channel text;
  existing_policy public.governance_emergency_access_ops_policies%ROWTYPE;
  actor_id uuid := public.current_profile_id();
  effective_metadata jsonb := coalesce(metadata, '{}'::jsonb) || jsonb_build_object('policy_schema_version', '1');
BEGIN
  IF NOT public.has_permission('settings.manage'::public.app_permission) THEN
    RAISE EXCEPTION 'Current profile is not authorized to update emergency access ops policy';
  END IF;

  normalized_policy_key := lower(coalesce(nullif(btrim(coalesce(requested_policy_key, '')), ''), 'default'));
  normalized_policy_name := coalesce(nullif(btrim(coalesce(requested_policy_name, '')), ''), 'Default emergency access operations policy');
  normalized_oncall_channel := coalesce(nullif(btrim(coalesce(requested_oncall_channel, '')), ''), 'public_audit_ops');

  IF coalesce(requested_pending_max_age_hours, 0) < 1 THEN
    RAISE EXCEPTION 'Pending max age hours must be at least 1';
  END IF;
  IF coalesce(requested_approved_max_age_minutes, 0) < 1 THEN
    RAISE EXCEPTION 'Approved max age minutes must be at least 1';
  END IF;
  IF coalesce(requested_near_expiry_window_minutes, 0) < 1 THEN
    RAISE EXCEPTION 'Near-expiry window minutes must be at least 1';
  END IF;

  SELECT *
  INTO existing_policy
  FROM public.governance_emergency_access_ops_policies AS policy
  WHERE policy.policy_key = normalized_policy_key
  LIMIT 1;

  INSERT INTO public.governance_emergency_access_ops_policies (
    policy_key,
    policy_name,
    pending_max_age_hours,
    approved_max_age_minutes,
    near_expiry_window_minutes,
    escalation_enabled,
    oncall_channel,
    metadata,
    updated_by
  )
  VALUES (
    normalized_policy_key,
    normalized_policy_name,
    greatest(1, requested_pending_max_age_hours),
    greatest(1, requested_approved_max_age_minutes),
    greatest(1, requested_near_expiry_window_minutes),
    coalesce(requested_escalation_enabled, true),
    normalized_oncall_channel,
    effective_metadata,
    actor_id
  )
  ON CONFLICT (policy_key) DO UPDATE
  SET
    policy_name = excluded.policy_name,
    pending_max_age_hours = excluded.pending_max_age_hours,
    approved_max_age_minutes = excluded.approved_max_age_minutes,
    near_expiry_window_minutes = excluded.near_expiry_window_minutes,
    escalation_enabled = excluded.escalation_enabled,
    oncall_channel = excluded.oncall_channel,
    metadata = coalesce(public.governance_emergency_access_ops_policies.metadata, '{}'::jsonb)
      || coalesce(excluded.metadata, '{}'::jsonb),
    updated_by = excluded.updated_by;

  IF existing_policy.policy_key IS NULL THEN
    PERFORM public.append_governance_emergency_access_ops_policy_event(
      normalized_policy_key,
      'created',
      actor_id,
      'Emergency access operations policy created',
      jsonb_build_object(
        'policy_schema_version', '1',
        'pending_max_age_hours', greatest(1, requested_pending_max_age_hours),
        'approved_max_age_minutes', greatest(1, requested_approved_max_age_minutes),
        'near_expiry_window_minutes', greatest(1, requested_near_expiry_window_minutes),
        'escalation_enabled', coalesce(requested_escalation_enabled, true),
        'oncall_channel', normalized_oncall_channel
      )
    );
  ELSE
    PERFORM public.append_governance_emergency_access_ops_policy_event(
      normalized_policy_key,
      'updated',
      actor_id,
      'Emergency access operations policy updated',
      jsonb_build_object(
        'policy_schema_version', '1',
        'previous_pending_max_age_hours', existing_policy.pending_max_age_hours,
        'next_pending_max_age_hours', greatest(1, requested_pending_max_age_hours),
        'previous_approved_max_age_minutes', existing_policy.approved_max_age_minutes,
        'next_approved_max_age_minutes', greatest(1, requested_approved_max_age_minutes),
        'previous_near_expiry_window_minutes', existing_policy.near_expiry_window_minutes,
        'next_near_expiry_window_minutes', greatest(1, requested_near_expiry_window_minutes),
        'previous_escalation_enabled', existing_policy.escalation_enabled,
        'next_escalation_enabled', coalesce(requested_escalation_enabled, true),
        'previous_oncall_channel', existing_policy.oncall_channel,
        'next_oncall_channel', normalized_oncall_channel
      )
    );
  END IF;

  RETURN normalized_policy_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.rollback_governance_emergency_access_ops_policy_to_event(
  target_event_id uuid,
  max_rollback_age_hours integer DEFAULT 336,
  required_policy_schema_version text DEFAULT '1'
)
RETURNS text AS $$
DECLARE
  event_record public.governance_emergency_access_ops_policy_events%ROWTYPE;
  pending_max_age_hours integer;
  approved_max_age_minutes integer;
  near_expiry_window_minutes integer;
  escalation_enabled boolean;
  oncall_channel text;
  required_schema_version text := coalesce(nullif(btrim(coalesce(required_policy_schema_version, '')), ''), '1');
  event_schema_version text;
BEGIN
  IF NOT public.has_permission('settings.manage'::public.app_permission) THEN
    RAISE EXCEPTION 'Current profile is not authorized to rollback emergency access ops policy';
  END IF;

  IF target_event_id IS NULL THEN
    RAISE EXCEPTION 'Target event id is required';
  END IF;

  IF coalesce(max_rollback_age_hours, 0) < 1 THEN
    RAISE EXCEPTION 'Max rollback age hours must be at least 1';
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

  IF event_record.created_at < now() - make_interval(hours => max_rollback_age_hours) THEN
    RAISE EXCEPTION 'Rollback event is older than the allowed rollback age window';
  END IF;

  event_schema_version := coalesce(
    nullif(event_record.metadata ->> 'policy_schema_version', ''),
    'unknown'
  );
  IF event_schema_version <> required_schema_version THEN
    RAISE EXCEPTION 'Rollback event schema version mismatch (required %, found %)', required_schema_version, event_schema_version;
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
      'rollback_event_type', event_record.event_type,
      'policy_schema_version', required_schema_version
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
