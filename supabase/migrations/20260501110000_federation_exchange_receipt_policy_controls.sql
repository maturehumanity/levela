-- Policy controls, audit history, and rollback safety for federation exchange receipt backlog escalation.

CREATE TABLE IF NOT EXISTS public.gpav_fed_exchange_receipt_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key text NOT NULL UNIQUE,
  policy_name text NOT NULL,
  lookback_hours integer NOT NULL DEFAULT 336,
  warning_pending_threshold integer NOT NULL DEFAULT 1,
  critical_pending_threshold integer NOT NULL DEFAULT 5,
  escalation_enabled boolean NOT NULL DEFAULT true,
  oncall_channel text NOT NULL DEFAULT 'public_audit_ops',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gpav_fed_xchg_receipt_policy_key_not_empty_chk CHECK (btrim(policy_key) <> ''),
  CONSTRAINT gpav_fed_xchg_receipt_policy_name_not_empty_chk CHECK (btrim(policy_name) <> ''),
  CONSTRAINT gpav_fed_xchg_receipt_policy_lookback_positive_chk CHECK (lookback_hours >= 1),
  CONSTRAINT gpav_fed_xchg_receipt_policy_warn_positive_chk CHECK (warning_pending_threshold >= 1),
  CONSTRAINT gpav_fed_xchg_receipt_policy_crit_positive_chk CHECK (critical_pending_threshold >= 1),
  CONSTRAINT gpav_fed_xchg_receipt_policy_thresh_order_chk CHECK (critical_pending_threshold >= warning_pending_threshold),
  CONSTRAINT gpav_fed_xchg_receipt_policy_channel_not_empty_chk CHECK (btrim(oncall_channel) <> ''),
  CONSTRAINT gpav_fed_xchg_receipt_policy_metadata_obj_chk CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_gpav_fed_exchange_receipt_policies_key
  ON public.gpav_fed_exchange_receipt_policies (policy_key);

CREATE TABLE IF NOT EXISTS public.gpav_fed_exchange_receipt_policy_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key text NOT NULL,
  event_type text NOT NULL,
  actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gpav_fed_xchg_receipt_policy_evt_key_not_empty_chk CHECK (btrim(policy_key) <> ''),
  CONSTRAINT gpav_fed_xchg_receipt_policy_evt_type_chk CHECK (event_type IN ('created', 'updated', 'rollback')),
  CONSTRAINT gpav_fed_xchg_receipt_policy_evt_msg_not_empty_chk CHECK (btrim(event_message) <> ''),
  CONSTRAINT gpav_fed_xchg_receipt_policy_evt_metadata_obj_chk CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_gpav_fed_exchange_receipt_policy_events_key_time
  ON public.gpav_fed_exchange_receipt_policy_events (policy_key, created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION public.append_gpav_fed_exchange_receipt_policy_event(
  target_policy_key text,
  target_event_type text,
  target_event_message text,
  target_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  inserted_id uuid;
  normalized_policy_key text := lower(coalesce(nullif(btrim(coalesce(target_policy_key, '')), ''), 'default'));
  normalized_event_type text := lower(coalesce(nullif(btrim(coalesce(target_event_type, '')), ''), 'updated'));
  normalized_event_message text := coalesce(nullif(btrim(coalesce(target_event_message, '')), ''), 'Policy event recorded');
BEGIN
  INSERT INTO public.gpav_fed_exchange_receipt_policy_events (
    policy_key,
    event_type,
    actor_profile_id,
    event_message,
    metadata
  )
  VALUES (
    normalized_policy_key,
    normalized_event_type,
    public.current_profile_id(),
    normalized_event_message,
    coalesce(target_metadata, '{}'::jsonb)
  )
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.gpav_fed_exchange_receipt_policy_summary(
  requested_policy_key text DEFAULT 'default'
)
RETURNS TABLE (
  policy_key text,
  policy_name text,
  lookback_hours integer,
  warning_pending_threshold integer,
  critical_pending_threshold integer,
  escalation_enabled boolean,
  oncall_channel text,
  metadata jsonb,
  updated_at timestamptz,
  updated_by uuid,
  updated_by_name text
) AS $$
DECLARE
  normalized_policy_key text := lower(coalesce(nullif(btrim(coalesce(requested_policy_key, '')), ''), 'default'));
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to read federation exchange receipt policy';
  END IF;

  RETURN QUERY
  SELECT
    policy.policy_key,
    policy.policy_name,
    policy.lookback_hours,
    policy.warning_pending_threshold,
    policy.critical_pending_threshold,
    policy.escalation_enabled,
    policy.oncall_channel,
    policy.metadata,
    policy.updated_at,
    policy.updated_by,
    coalesce(actor.full_name, actor.username, actor.id::text) AS updated_by_name
  FROM public.gpav_fed_exchange_receipt_policies AS policy
  LEFT JOIN public.profiles AS actor
    ON actor.id = policy.updated_by
  WHERE policy.policy_key = normalized_policy_key
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.gpav_fed_exchange_receipt_policy_event_history(
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
  normalized_policy_key text := lower(coalesce(nullif(btrim(coalesce(requested_policy_key, '')), ''), 'default'));
  lookback_hours integer := greatest(1, coalesce(requested_lookback_hours, 336));
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to read federation exchange receipt policy history';
  END IF;

  RETURN QUERY
  SELECT
    event.id AS event_id,
    event.policy_key,
    event.event_type,
    event.actor_profile_id,
    coalesce(actor.full_name, actor.username, actor.id::text) AS actor_name,
    event.event_message,
    event.metadata,
    event.created_at
  FROM public.gpav_fed_exchange_receipt_policy_events AS event
  LEFT JOIN public.profiles AS actor
    ON actor.id = event.actor_profile_id
  WHERE event.policy_key = normalized_policy_key
    AND event.created_at >= now() - make_interval(hours => lookback_hours)
  ORDER BY event.created_at DESC, event.id DESC
  LIMIT greatest(1, coalesce(max_events, 120));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.set_gpav_fed_exchange_receipt_policy(
  requested_policy_key text DEFAULT 'default',
  requested_policy_name text DEFAULT 'Default federation exchange receipt escalation policy',
  requested_lookback_hours integer DEFAULT 336,
  requested_warning_pending_threshold integer DEFAULT 1,
  requested_critical_pending_threshold integer DEFAULT 5,
  requested_escalation_enabled boolean DEFAULT true,
  requested_oncall_channel text DEFAULT 'public_audit_ops',
  metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS text AS $$
DECLARE
  existing_policy public.gpav_fed_exchange_receipt_policies%ROWTYPE;
  normalized_policy_key text := lower(coalesce(nullif(btrim(coalesce(requested_policy_key, '')), ''), 'default'));
  normalized_policy_name text := coalesce(nullif(btrim(coalesce(requested_policy_name, '')), ''), 'Default federation exchange receipt escalation policy');
  normalized_oncall_channel text := coalesce(nullif(btrim(coalesce(requested_oncall_channel, '')), ''), 'public_audit_ops');
  safe_lookback_hours integer := greatest(1, coalesce(requested_lookback_hours, 336));
  safe_warning_threshold integer := greatest(1, coalesce(requested_warning_pending_threshold, 1));
  safe_critical_threshold integer := greatest(1, coalesce(requested_critical_pending_threshold, 5));
  actor_profile_id uuid := public.current_profile_id();
  effective_metadata jsonb := coalesce(metadata, '{}'::jsonb) || jsonb_build_object('policy_schema_version', '1');
BEGIN
  IF NOT (
    public.current_profile_can_manage_public_audit_verifiers()
    OR session_user IN ('postgres', 'supabase_admin')
  ) THEN
    RAISE EXCEPTION 'Current profile is not authorized to update federation exchange receipt policy';
  END IF;

  IF safe_critical_threshold < safe_warning_threshold THEN
    RAISE EXCEPTION 'Critical threshold must be greater than or equal to warning threshold';
  END IF;

  SELECT *
  INTO existing_policy
  FROM public.gpav_fed_exchange_receipt_policies AS policy
  WHERE policy.policy_key = normalized_policy_key
  LIMIT 1;

  INSERT INTO public.gpav_fed_exchange_receipt_policies (
    policy_key,
    policy_name,
    lookback_hours,
    warning_pending_threshold,
    critical_pending_threshold,
    escalation_enabled,
    oncall_channel,
    metadata,
    updated_by
  )
  VALUES (
    normalized_policy_key,
    normalized_policy_name,
    safe_lookback_hours,
    safe_warning_threshold,
    safe_critical_threshold,
    coalesce(requested_escalation_enabled, true),
    normalized_oncall_channel,
    effective_metadata,
    actor_profile_id
  )
  ON CONFLICT (policy_key) DO UPDATE
  SET
    policy_name = excluded.policy_name,
    lookback_hours = excluded.lookback_hours,
    warning_pending_threshold = excluded.warning_pending_threshold,
    critical_pending_threshold = excluded.critical_pending_threshold,
    escalation_enabled = excluded.escalation_enabled,
    oncall_channel = excluded.oncall_channel,
    metadata = coalesce(public.gpav_fed_exchange_receipt_policies.metadata, '{}'::jsonb)
      || coalesce(excluded.metadata, '{}'::jsonb),
    updated_by = excluded.updated_by,
    updated_at = now();

  IF existing_policy.policy_key IS NULL THEN
    PERFORM public.append_gpav_fed_exchange_receipt_policy_event(
      normalized_policy_key,
      'created',
      'Federation exchange receipt escalation policy created',
      jsonb_build_object(
        'policy_schema_version', '1',
        'lookback_hours', safe_lookback_hours,
        'warning_pending_threshold', safe_warning_threshold,
        'critical_pending_threshold', safe_critical_threshold,
        'escalation_enabled', coalesce(requested_escalation_enabled, true),
        'oncall_channel', normalized_oncall_channel
      )
    );
  ELSE
    PERFORM public.append_gpav_fed_exchange_receipt_policy_event(
      normalized_policy_key,
      'updated',
      'Federation exchange receipt escalation policy updated',
      jsonb_build_object(
        'policy_schema_version', '1',
        'previous_lookback_hours', existing_policy.lookback_hours,
        'next_lookback_hours', safe_lookback_hours,
        'previous_warning_pending_threshold', existing_policy.warning_pending_threshold,
        'next_warning_pending_threshold', safe_warning_threshold,
        'previous_critical_pending_threshold', existing_policy.critical_pending_threshold,
        'next_critical_pending_threshold', safe_critical_threshold,
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

CREATE OR REPLACE FUNCTION public.rollback_gpav_fed_exchange_receipt_policy_to_event(
  target_event_id uuid,
  max_rollback_age_hours integer DEFAULT 336,
  required_policy_schema_version text DEFAULT '1'
)
RETURNS text AS $$
DECLARE
  event_record public.gpav_fed_exchange_receipt_policy_events%ROWTYPE;
  lookback_hours integer;
  warning_pending_threshold integer;
  critical_pending_threshold integer;
  escalation_enabled boolean;
  oncall_channel text;
  required_schema_version text := coalesce(nullif(btrim(coalesce(required_policy_schema_version, '')), ''), '1');
  event_schema_version text;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to rollback federation exchange receipt policy';
  END IF;

  IF target_event_id IS NULL THEN
    RAISE EXCEPTION 'Target event id is required';
  END IF;

  SELECT *
  INTO event_record
  FROM public.gpav_fed_exchange_receipt_policy_events AS event
  WHERE event.id = target_event_id
  FOR UPDATE;

  IF event_record.id IS NULL THEN
    RAISE EXCEPTION 'Federation exchange receipt policy event does not exist';
  END IF;

  IF event_record.event_type NOT IN ('created', 'updated') THEN
    RAISE EXCEPTION 'Only created/updated policy events can be used for rollback';
  END IF;

  IF event_record.created_at < now() - make_interval(hours => greatest(1, coalesce(max_rollback_age_hours, 336))) THEN
    RAISE EXCEPTION 'Rollback event is older than the allowed rollback age window';
  END IF;

  event_schema_version := coalesce(nullif(event_record.metadata ->> 'policy_schema_version', ''), 'unknown');
  IF event_schema_version <> required_schema_version THEN
    RAISE EXCEPTION 'Rollback event schema version mismatch (required %, found %)', required_schema_version, event_schema_version;
  END IF;

  lookback_hours := coalesce(
    nullif(event_record.metadata ->> 'next_lookback_hours', '')::integer,
    nullif(event_record.metadata ->> 'lookback_hours', '')::integer
  );
  warning_pending_threshold := coalesce(
    nullif(event_record.metadata ->> 'next_warning_pending_threshold', '')::integer,
    nullif(event_record.metadata ->> 'warning_pending_threshold', '')::integer
  );
  critical_pending_threshold := coalesce(
    nullif(event_record.metadata ->> 'next_critical_pending_threshold', '')::integer,
    nullif(event_record.metadata ->> 'critical_pending_threshold', '')::integer
  );
  escalation_enabled := coalesce(
    nullif(event_record.metadata ->> 'next_escalation_enabled', '')::boolean,
    nullif(event_record.metadata ->> 'escalation_enabled', '')::boolean
  );
  oncall_channel := coalesce(
    nullif(event_record.metadata ->> 'next_oncall_channel', ''),
    nullif(event_record.metadata ->> 'oncall_channel', '')
  );

  IF lookback_hours IS NULL
     OR warning_pending_threshold IS NULL
     OR critical_pending_threshold IS NULL
     OR escalation_enabled IS NULL
     OR oncall_channel IS NULL
  THEN
    RAISE EXCEPTION 'Federation exchange receipt policy rollback event metadata is incomplete';
  END IF;

  PERFORM public.set_gpav_fed_exchange_receipt_policy(
    requested_policy_key := event_record.policy_key,
    requested_policy_name := 'Default federation exchange receipt escalation policy',
    requested_lookback_hours := lookback_hours,
    requested_warning_pending_threshold := warning_pending_threshold,
    requested_critical_pending_threshold := critical_pending_threshold,
    requested_escalation_enabled := escalation_enabled,
    requested_oncall_channel := oncall_channel,
    metadata := jsonb_build_object(
      'source', 'rollback_gpav_fed_exchange_receipt_policy_to_event',
      'rollback_event_id', event_record.id,
      'rollback_event_type', event_record.event_type,
      'policy_schema_version', required_schema_version
    )
  );

  PERFORM public.append_gpav_fed_exchange_receipt_policy_event(
    event_record.policy_key,
    'rollback',
    'Federation exchange receipt escalation policy rolled back to historical snapshot',
    jsonb_build_object(
      'source_event_id', event_record.id,
      'source_event_type', event_record.event_type,
      'policy_schema_version', required_schema_version
    )
  );

  RETURN event_record.policy_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.maybe_escalate_verifier_fed_exchange_receipt_page(
  requested_lookback_hours integer DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  summary_row record;
  policy_row record;
  latest_batch_id uuid;
  page_id uuid := NULL;
  effective_lookback_hours integer := greatest(1, coalesce(requested_lookback_hours, 336));
  effective_warning_threshold integer := 1;
  effective_critical_threshold integer := 5;
  effective_escalation_enabled boolean := true;
  effective_oncall_channel text := 'public_audit_ops';
BEGIN
  IF NOT (
    session_user IN ('postgres', 'supabase_admin')
    OR public.current_profile_can_manage_public_audit_verifiers()
  ) THEN
    RAISE EXCEPTION 'Current profile is not authorized to escalate verifier federation exchange receipt pages';
  END IF;

  SELECT *
  INTO policy_row
  FROM public.gpav_fed_exchange_receipt_policy_summary('default')
  LIMIT 1;

  IF policy_row IS NOT NULL THEN
    IF requested_lookback_hours IS NULL THEN
      effective_lookback_hours := greatest(1, coalesce(policy_row.lookback_hours, effective_lookback_hours));
    END IF;
    effective_warning_threshold := greatest(1, coalesce(policy_row.warning_pending_threshold, effective_warning_threshold));
    effective_critical_threshold := greatest(effective_warning_threshold, coalesce(policy_row.critical_pending_threshold, effective_critical_threshold));
    effective_escalation_enabled := coalesce(policy_row.escalation_enabled, true);
    effective_oncall_channel := coalesce(nullif(btrim(coalesce(policy_row.oncall_channel, '')), ''), 'public_audit_ops');
  END IF;

  SELECT *
  INTO summary_row
  FROM public.governance_public_audit_verifier_federation_exchange_summary(
    target_batch_id := NULL,
    requested_lookback_hours := effective_lookback_hours
  );

  IF summary_row IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT batch.id
  INTO latest_batch_id
  FROM public.governance_public_audit_batches AS batch
  ORDER BY batch.batch_index DESC
  LIMIT 1;

  IF latest_batch_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF effective_escalation_enabled
     AND coalesce(summary_row.receipt_pending_verification_count, 0) >= effective_warning_threshold
  THEN
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
      latest_batch_id,
      'verifier_federation_exchange_receipt_escalation',
      CASE
        WHEN coalesce(summary_row.receipt_pending_verification_count, 0) >= effective_critical_threshold THEN 'critical'
        ELSE 'warning'
      END,
      'open',
      format(
        'Federation exchange receipt verification backlog (pending=%s, threshold=%s)',
        coalesce(summary_row.receipt_pending_verification_count, 0),
        effective_warning_threshold
      ),
      effective_oncall_channel,
      jsonb_build_object(
        'receipt_pending_verification_count', summary_row.receipt_pending_verification_count,
        'receipt_evidence_count', summary_row.receipt_evidence_count,
        'receipt_verified_count', summary_row.receipt_verified_count,
        'attestation_count', summary_row.attestation_count,
        'distinct_external_operator_count', summary_row.distinct_external_operator_count,
        'latest_attested_at', summary_row.latest_attested_at,
        'lookback_hours', effective_lookback_hours,
        'warning_pending_threshold', effective_warning_threshold,
        'critical_pending_threshold', effective_critical_threshold,
        'escalation_enabled', effective_escalation_enabled
      ),
      now(),
      public.current_profile_id()
    )
    ON CONFLICT (batch_id, page_key) DO UPDATE
    SET
      severity = excluded.severity,
      page_status = 'open',
      page_message = excluded.page_message,
      oncall_channel = excluded.oncall_channel,
      page_payload = coalesce(public.governance_public_audit_external_execution_pages.page_payload, '{}'::jsonb)
        || coalesce(excluded.page_payload, '{}'::jsonb),
      opened_at = now(),
      acknowledged_at = NULL,
      resolved_at = NULL,
      resolved_by = NULL
    RETURNING id INTO page_id;

    RETURN page_id;
  END IF;

  UPDATE public.governance_public_audit_external_execution_pages AS page
  SET
    page_status = 'resolved',
    page_payload = coalesce(page.page_payload, '{}'::jsonb)
      || jsonb_build_object(
        'resolved_reason', CASE
          WHEN NOT effective_escalation_enabled THEN 'Federation exchange receipt escalation disabled by policy'
          ELSE 'Federation exchange receipt verification backlog cleared'
        END,
        'resolved_at', now(),
        'lookback_hours', effective_lookback_hours,
        'warning_pending_threshold', effective_warning_threshold,
        'critical_pending_threshold', effective_critical_threshold
      ),
    resolved_at = now(),
    resolved_by = public.current_profile_id(),
    updated_at = now()
  WHERE page.batch_id = latest_batch_id
    AND page.page_key = 'verifier_federation_exchange_receipt_escalation'
    AND page.page_status IN ('open', 'acknowledged');

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.gpav_fed_exchange_receipt_tick()
RETURNS void AS $$
BEGIN
  IF session_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Federation exchange receipt tick is restricted to database superuser sessions';
  END IF;

  PERFORM public.maybe_escalate_verifier_fed_exchange_receipt_page(NULL);
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'gpav_fed_exchange_receipt_tick non-fatal: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Backfill default policy once.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.gpav_fed_exchange_receipt_policies AS policy
    WHERE policy.policy_key = 'default'
  ) THEN
    PERFORM public.set_gpav_fed_exchange_receipt_policy(
      requested_policy_key := 'default',
      requested_policy_name := 'Default federation exchange receipt escalation policy',
      requested_lookback_hours := 336,
      requested_warning_pending_threshold := 1,
      requested_critical_pending_threshold := 5,
      requested_escalation_enabled := true,
      requested_oncall_channel := 'public_audit_ops',
      metadata := jsonb_build_object('seeded_by_migration', '20260501110000')
    );
  END IF;
END $$;

GRANT SELECT, INSERT ON public.gpav_fed_exchange_receipt_policies TO authenticated;
GRANT SELECT, INSERT ON public.gpav_fed_exchange_receipt_policy_events TO authenticated;

GRANT EXECUTE ON FUNCTION public.append_gpav_fed_exchange_receipt_policy_event(text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gpav_fed_exchange_receipt_policy_summary(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gpav_fed_exchange_receipt_policy_event_history(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_gpav_fed_exchange_receipt_policy(text, text, integer, integer, integer, boolean, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rollback_gpav_fed_exchange_receipt_policy_to_event(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.maybe_escalate_verifier_fed_exchange_receipt_page(integer) TO authenticated;
