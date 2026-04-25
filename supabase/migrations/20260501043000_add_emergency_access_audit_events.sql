-- Decentralization hardening: maintain append-only emergency access lifecycle
-- audit events and expose summary/timeline RPCs for governance review.

CREATE TABLE IF NOT EXISTS public.governance_emergency_access_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.governance_emergency_access_requests(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_message text NOT NULL,
  actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_emergency_access_request_events_event_type_check CHECK (
    event_type IN ('requested', 'approved', 'rejected', 'expired', 'consumed', 'updated')
  ),
  CONSTRAINT governance_emergency_access_request_events_message_not_empty_check CHECK (
    length(trim(event_message)) > 0
  ),
  CONSTRAINT governance_emergency_access_request_events_metadata_object_check CHECK (
    jsonb_typeof(metadata) = 'object'
  )
);

CREATE INDEX IF NOT EXISTS idx_governance_emergency_access_request_events_request_created
  ON public.governance_emergency_access_request_events (request_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_governance_emergency_access_request_events_type_created
  ON public.governance_emergency_access_request_events (event_type, created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION public.append_governance_emergency_access_request_event(
  target_request_id uuid,
  target_event_type text,
  target_event_message text,
  target_actor_profile_id uuid DEFAULT NULL,
  target_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  inserted_id uuid;
  normalized_event_type text := lower(btrim(coalesce(target_event_type, '')));
  normalized_message text := nullif(btrim(coalesce(target_event_message, '')), '');
BEGIN
  IF target_request_id IS NULL THEN
    RAISE EXCEPTION 'Target request id is required';
  END IF;

  IF normalized_event_type NOT IN ('requested', 'approved', 'rejected', 'expired', 'consumed', 'updated') THEN
    RAISE EXCEPTION 'Invalid emergency access event type';
  END IF;

  IF normalized_message IS NULL THEN
    RAISE EXCEPTION 'Emergency access event message is required';
  END IF;

  INSERT INTO public.governance_emergency_access_request_events (
    request_id,
    event_type,
    event_message,
    actor_profile_id,
    metadata
  )
  VALUES (
    target_request_id,
    normalized_event_type,
    normalized_message,
    target_actor_profile_id,
    coalesce(target_metadata, '{}'::jsonb)
  )
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.log_governance_emergency_access_request_event()
RETURNS trigger AS $$
DECLARE
  event_type text := 'updated';
  event_message text := 'Emergency access request updated';
  actor_profile uuid := coalesce(new.updated_by, new.reviewed_by, new.requested_by, public.current_profile_id());
BEGIN
  IF tg_op = 'INSERT' THEN
    PERFORM public.append_governance_emergency_access_request_event(
      new.id,
      'requested',
      'Emergency access request created',
      new.requested_by,
      jsonb_build_object(
        'request_status', new.request_status,
        'request_reason', new.request_reason
      )
    );
    RETURN new;
  END IF;

  IF new.request_status IS DISTINCT FROM old.request_status THEN
    IF new.request_status = 'approved' THEN
      event_type := 'approved';
      event_message := 'Emergency access request approved';
    ELSIF new.request_status = 'rejected' THEN
      event_type := 'rejected';
      event_message := 'Emergency access request rejected';
    ELSIF new.request_status = 'expired' THEN
      event_type := 'expired';
      event_message := 'Emergency access request expired';
    ELSE
      event_type := 'updated';
      event_message := format('Emergency access request status changed to %s', new.request_status);
    END IF;
  ELSIF new.consumed_at IS DISTINCT FROM old.consumed_at AND new.consumed_at IS NOT NULL THEN
    event_type := 'consumed';
    event_message := 'Emergency access request consumed for impersonation';
    actor_profile := coalesce(new.consumed_by, actor_profile);
  END IF;

  PERFORM public.append_governance_emergency_access_request_event(
    new.id,
    event_type,
    event_message,
    actor_profile,
    jsonb_build_object(
      'previous_status', old.request_status,
      'next_status', new.request_status,
      'reviewed_at', new.reviewed_at,
      'approved_expires_at', new.approved_expires_at,
      'consumed_at', new.consumed_at
    )
  );

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'governance_emergency_access_requests'
      AND column_name = 'updated_by'
  ) THEN
    NULL;
  ELSE
    ALTER TABLE public.governance_emergency_access_requests
      ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  CREATE TRIGGER governance_emergency_access_request_events_trigger
    AFTER INSERT OR UPDATE ON public.governance_emergency_access_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.log_governance_emergency_access_request_event();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.governance_emergency_access_event_summary(
  requested_lookback_hours integer DEFAULT 168
)
RETURNS TABLE (
  lookback_hours integer,
  request_count integer,
  approved_count integer,
  rejected_count integer,
  expired_count integer,
  consumed_count integer,
  pending_count integer,
  latest_event_at timestamptz
) AS $$
DECLARE
  lookback integer := greatest(1, coalesce(requested_lookback_hours, 168));
BEGIN
  IF NOT (
    public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
  ) THEN
    RAISE EXCEPTION 'Current profile is not authorized to read emergency access event summary';
  END IF;

  RETURN QUERY
  WITH recent_events AS (
    SELECT event.*
    FROM public.governance_emergency_access_request_events AS event
    WHERE event.created_at >= now() - make_interval(hours => lookback)
  ),
  pending_requests AS (
    SELECT count(*)::integer AS pending_count
    FROM public.governance_emergency_access_requests AS request
    WHERE request.request_status = 'pending'
  )
  SELECT
    lookback,
    coalesce(count(*) FILTER (WHERE recent_events.event_type = 'requested'), 0)::integer,
    coalesce(count(*) FILTER (WHERE recent_events.event_type = 'approved'), 0)::integer,
    coalesce(count(*) FILTER (WHERE recent_events.event_type = 'rejected'), 0)::integer,
    coalesce(count(*) FILTER (WHERE recent_events.event_type = 'expired'), 0)::integer,
    coalesce(count(*) FILTER (WHERE recent_events.event_type = 'consumed'), 0)::integer,
    coalesce((SELECT pending_count FROM pending_requests), 0),
    max(recent_events.created_at)
  FROM recent_events;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_emergency_access_request_event_board(
  target_request_id uuid,
  max_events integer DEFAULT 40
)
RETURNS TABLE (
  event_id uuid,
  request_id uuid,
  event_type text,
  event_message text,
  actor_profile_id uuid,
  actor_name text,
  metadata jsonb,
  created_at timestamptz
) AS $$
BEGIN
  IF NOT (
    public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
  ) THEN
    RAISE EXCEPTION 'Current profile is not authorized to read emergency access request events';
  END IF;

  IF target_request_id IS NULL THEN
    RAISE EXCEPTION 'Target request id is required';
  END IF;

  RETURN QUERY
  SELECT
    event.id AS event_id,
    event.request_id,
    event.event_type,
    event.event_message,
    event.actor_profile_id,
    CASE
      WHEN actor.id IS NULL THEN NULL
      ELSE coalesce(actor.full_name, actor.username, actor.id::text)
    END AS actor_name,
    event.metadata,
    event.created_at
  FROM public.governance_emergency_access_request_events AS event
  LEFT JOIN public.profiles AS actor
    ON actor.id = event.actor_profile_id
  WHERE event.request_id = target_request_id
  ORDER BY event.created_at DESC, event.id DESC
  LIMIT greatest(1, coalesce(max_events, 40));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT SELECT, INSERT ON public.governance_emergency_access_request_events TO authenticated;
GRANT EXECUTE ON FUNCTION public.append_governance_emergency_access_request_event(uuid, text, text, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_emergency_access_event_summary(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_emergency_access_request_event_board(uuid, integer) TO authenticated;
