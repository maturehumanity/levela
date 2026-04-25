-- Stewardship auditability: append-only policy change events for emergency access ops.

CREATE TABLE IF NOT EXISTS public.governance_emergency_access_ops_policy_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key text NOT NULL,
  event_type text NOT NULL,
  actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_emergency_access_ops_policy_events_event_type_check CHECK (
    event_type IN ('created', 'updated')
  ),
  CONSTRAINT governance_emergency_access_ops_policy_events_policy_key_not_empty_check CHECK (
    length(trim(policy_key)) > 0
  ),
  CONSTRAINT governance_emergency_access_ops_policy_events_event_message_not_empty_check CHECK (
    length(trim(event_message)) > 0
  ),
  CONSTRAINT governance_emergency_access_ops_policy_events_metadata_object_check CHECK (
    jsonb_typeof(metadata) = 'object'
  )
);

CREATE INDEX IF NOT EXISTS idx_governance_emergency_access_ops_policy_events_policy_created
  ON public.governance_emergency_access_ops_policy_events (policy_key, created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION public.append_governance_emergency_access_ops_policy_event(
  target_policy_key text,
  target_event_type text,
  target_actor_profile_id uuid DEFAULT NULL,
  target_event_message text DEFAULT NULL,
  target_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  inserted_id uuid;
  normalized_policy_key text := lower(btrim(coalesce(target_policy_key, '')));
  normalized_event_type text := lower(btrim(coalesce(target_event_type, '')));
  normalized_message text := nullif(btrim(coalesce(target_event_message, '')), '');
BEGIN
  IF normalized_policy_key = '' THEN
    RAISE EXCEPTION 'Policy key is required';
  END IF;

  IF normalized_event_type NOT IN ('created', 'updated') THEN
    RAISE EXCEPTION 'Policy event type must be created or updated';
  END IF;

  IF normalized_message IS NULL THEN
    normalized_message := CASE
      WHEN normalized_event_type = 'created' THEN 'Emergency access ops policy created'
      ELSE 'Emergency access ops policy updated'
    END;
  END IF;

  INSERT INTO public.governance_emergency_access_ops_policy_events (
    policy_key,
    event_type,
    actor_profile_id,
    event_message,
    metadata
  )
  VALUES (
    normalized_policy_key,
    normalized_event_type,
    target_actor_profile_id,
    normalized_message,
    coalesce(target_metadata, '{}'::jsonb)
  )
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_emergency_access_ops_policy_event_history(
  requested_policy_key text DEFAULT 'default',
  requested_lookback_hours integer DEFAULT 336,
  max_events integer DEFAULT 120
)
RETURNS TABLE (
  event_id uuid,
  policy_key text,
  event_type text,
  actor_profile_id uuid,
  actor_name text,
  event_message text,
  metadata jsonb,
  created_at timestamptz
) AS $$
DECLARE
  normalized_policy_key text := coalesce(nullif(lower(btrim(coalesce(requested_policy_key, ''))), ''), 'default');
  lookback_hours integer := greatest(1, coalesce(requested_lookback_hours, 336));
BEGIN
  IF NOT (
    public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
  ) THEN
    RAISE EXCEPTION 'Current profile is not authorized to read emergency access ops policy history';
  END IF;

  RETURN QUERY
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
  LIMIT greatest(1, coalesce(max_events, 120));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

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
  effective_metadata jsonb := coalesce(metadata, '{}'::jsonb);
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

GRANT SELECT, INSERT ON public.governance_emergency_access_ops_policy_events TO authenticated;
GRANT EXECUTE ON FUNCTION public.append_governance_emergency_access_ops_policy_event(text, text, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_emergency_access_ops_policy_event_history(text, integer, integer) TO authenticated;
