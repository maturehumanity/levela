-- Receipt verification age SLO policy and age-bucket analytics.

ALTER TABLE public.gpav_fed_exchange_receipt_policies
  ADD COLUMN IF NOT EXISTS receipt_max_verification_age_hours integer NOT NULL DEFAULT 72,
  ADD COLUMN IF NOT EXISTS critical_stale_receipt_count_threshold integer NOT NULL DEFAULT 3;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gpav_fed_xchg_receipt_policy_max_age_chk'
  ) THEN
    ALTER TABLE public.gpav_fed_exchange_receipt_policies
      ADD CONSTRAINT gpav_fed_xchg_receipt_policy_max_age_chk
      CHECK (receipt_max_verification_age_hours >= 1);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gpav_fed_xchg_receipt_policy_stale_thresh_chk'
  ) THEN
    ALTER TABLE public.gpav_fed_exchange_receipt_policies
      ADD CONSTRAINT gpav_fed_xchg_receipt_policy_stale_thresh_chk
      CHECK (critical_stale_receipt_count_threshold >= 1);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.gpav_fed_exchange_receipt_backlog_age_summary(
  target_batch_id uuid DEFAULT NULL,
  requested_lookback_hours integer DEFAULT NULL,
  requested_max_receipt_age_hours integer DEFAULT NULL
)
RETURNS TABLE (
  batch_id uuid,
  lookback_hours integer,
  max_receipt_age_hours integer,
  pending_verification_count integer,
  stale_pending_count integer,
  pending_under_24h_count integer,
  pending_24h_to_72h_count integer,
  pending_over_72h_count integer,
  oldest_pending_hours integer,
  latest_pending_attested_at timestamptz
) AS $$
DECLARE
  policy_row record;
  effective_lookback_hours integer := greatest(1, coalesce(requested_lookback_hours, 336));
  effective_max_receipt_age_hours integer := greatest(1, coalesce(requested_max_receipt_age_hours, 72));
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to read federation exchange receipt age summary';
  END IF;

  SELECT *
  INTO policy_row
  FROM public.gpav_fed_exchange_receipt_policy_summary('default')
  LIMIT 1;

  IF policy_row IS NOT NULL THEN
    IF requested_lookback_hours IS NULL THEN
      effective_lookback_hours := greatest(1, coalesce(policy_row.lookback_hours, effective_lookback_hours));
    END IF;
    IF requested_max_receipt_age_hours IS NULL THEN
      effective_max_receipt_age_hours := greatest(1, coalesce(policy_row.receipt_max_verification_age_hours, effective_max_receipt_age_hours));
    END IF;
  END IF;

  RETURN QUERY
  WITH pending AS (
    SELECT
      attestation.batch_id,
      attestation.attested_at,
      greatest(0, floor(extract(epoch from (now() - attestation.attested_at)) / 3600))::integer AS pending_age_hours
    FROM public.governance_public_audit_verifier_federation_exchange_attestations AS attestation
    WHERE (target_batch_id IS NULL OR attestation.batch_id = target_batch_id)
      AND attestation.attested_at >= now() - make_interval(hours => effective_lookback_hours)
      AND attestation.receipt_signature IS NOT NULL
      AND attestation.receipt_signer_key IS NOT NULL
      AND NOT coalesce(attestation.receipt_verified, false)
  )
  SELECT
    coalesce(target_batch_id, max(pending.batch_id)) AS batch_id,
    effective_lookback_hours AS lookback_hours,
    effective_max_receipt_age_hours AS max_receipt_age_hours,
    count(*)::integer AS pending_verification_count,
    count(*) FILTER (WHERE pending.pending_age_hours >= effective_max_receipt_age_hours)::integer AS stale_pending_count,
    count(*) FILTER (WHERE pending.pending_age_hours < 24)::integer AS pending_under_24h_count,
    count(*) FILTER (WHERE pending.pending_age_hours >= 24 AND pending.pending_age_hours < 72)::integer AS pending_24h_to_72h_count,
    count(*) FILTER (WHERE pending.pending_age_hours >= 72)::integer AS pending_over_72h_count,
    max(pending.pending_age_hours)::integer AS oldest_pending_hours,
    max(pending.attested_at) AS latest_pending_attested_at
  FROM pending;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS public.gpav_fed_exchange_receipt_policy_summary(text);

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
  receipt_max_verification_age_hours integer,
  critical_stale_receipt_count_threshold integer,
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
    policy.receipt_max_verification_age_hours,
    policy.critical_stale_receipt_count_threshold,
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

CREATE OR REPLACE FUNCTION public.set_gpav_fed_exchange_receipt_policy(
  requested_policy_key text DEFAULT 'default',
  requested_policy_name text DEFAULT 'Default federation exchange receipt escalation policy',
  requested_lookback_hours integer DEFAULT 336,
  requested_warning_pending_threshold integer DEFAULT 1,
  requested_critical_pending_threshold integer DEFAULT 5,
  requested_escalation_enabled boolean DEFAULT true,
  requested_oncall_channel text DEFAULT 'public_audit_ops',
  metadata jsonb DEFAULT '{}'::jsonb,
  requested_receipt_max_verification_age_hours integer DEFAULT 72,
  requested_critical_stale_receipt_count_threshold integer DEFAULT 3
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
  safe_max_receipt_age_hours integer := greatest(1, coalesce(requested_receipt_max_verification_age_hours, 72));
  safe_critical_stale_threshold integer := greatest(1, coalesce(requested_critical_stale_receipt_count_threshold, 3));
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

  SELECT * INTO existing_policy
  FROM public.gpav_fed_exchange_receipt_policies AS policy
  WHERE policy.policy_key = normalized_policy_key
  LIMIT 1;

  INSERT INTO public.gpav_fed_exchange_receipt_policies (
    policy_key, policy_name, lookback_hours, warning_pending_threshold, critical_pending_threshold,
    escalation_enabled, oncall_channel, metadata, updated_by,
    receipt_max_verification_age_hours, critical_stale_receipt_count_threshold
  )
  VALUES (
    normalized_policy_key, normalized_policy_name, safe_lookback_hours, safe_warning_threshold, safe_critical_threshold,
    coalesce(requested_escalation_enabled, true), normalized_oncall_channel, effective_metadata, actor_profile_id,
    safe_max_receipt_age_hours, safe_critical_stale_threshold
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
    receipt_max_verification_age_hours = excluded.receipt_max_verification_age_hours,
    critical_stale_receipt_count_threshold = excluded.critical_stale_receipt_count_threshold,
    updated_at = now();

  IF existing_policy.policy_key IS NULL THEN
    PERFORM public.append_gpav_fed_exchange_receipt_policy_event(
      normalized_policy_key, 'created', 'Federation exchange receipt escalation policy created',
      jsonb_build_object(
        'policy_schema_version','1',
        'lookback_hours',safe_lookback_hours,
        'warning_pending_threshold',safe_warning_threshold,
        'critical_pending_threshold',safe_critical_threshold,
        'escalation_enabled',coalesce(requested_escalation_enabled, true),
        'oncall_channel',normalized_oncall_channel,
        'receipt_max_verification_age_hours',safe_max_receipt_age_hours,
        'critical_stale_receipt_count_threshold',safe_critical_stale_threshold
      )
    );
  ELSE
    PERFORM public.append_gpav_fed_exchange_receipt_policy_event(
      normalized_policy_key, 'updated', 'Federation exchange receipt escalation policy updated',
      jsonb_build_object(
        'policy_schema_version','1',
        'previous_lookback_hours',existing_policy.lookback_hours,
        'next_lookback_hours',safe_lookback_hours,
        'previous_warning_pending_threshold',existing_policy.warning_pending_threshold,
        'next_warning_pending_threshold',safe_warning_threshold,
        'previous_critical_pending_threshold',existing_policy.critical_pending_threshold,
        'next_critical_pending_threshold',safe_critical_threshold,
        'previous_escalation_enabled',existing_policy.escalation_enabled,
        'next_escalation_enabled',coalesce(requested_escalation_enabled, true),
        'previous_oncall_channel',existing_policy.oncall_channel,
        'next_oncall_channel',normalized_oncall_channel,
        'previous_receipt_max_verification_age_hours',existing_policy.receipt_max_verification_age_hours,
        'next_receipt_max_verification_age_hours',safe_max_receipt_age_hours,
        'previous_critical_stale_receipt_count_threshold',existing_policy.critical_stale_receipt_count_threshold,
        'next_critical_stale_receipt_count_threshold',safe_critical_stale_threshold
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
  receipt_max_verification_age_hours integer;
  critical_stale_receipt_count_threshold integer;
  required_schema_version text := coalesce(nullif(btrim(coalesce(required_policy_schema_version, '')), ''), '1');
  event_schema_version text;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to rollback federation exchange receipt policy';
  END IF;

  IF target_event_id IS NULL THEN
    RAISE EXCEPTION 'Target event id is required';
  END IF;

  SELECT * INTO event_record
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

  lookback_hours := coalesce(nullif(event_record.metadata ->> 'next_lookback_hours','')::integer, nullif(event_record.metadata ->> 'lookback_hours','')::integer);
  warning_pending_threshold := coalesce(nullif(event_record.metadata ->> 'next_warning_pending_threshold','')::integer, nullif(event_record.metadata ->> 'warning_pending_threshold','')::integer);
  critical_pending_threshold := coalesce(nullif(event_record.metadata ->> 'next_critical_pending_threshold','')::integer, nullif(event_record.metadata ->> 'critical_pending_threshold','')::integer);
  escalation_enabled := coalesce(nullif(event_record.metadata ->> 'next_escalation_enabled','')::boolean, nullif(event_record.metadata ->> 'escalation_enabled','')::boolean);
  oncall_channel := coalesce(nullif(event_record.metadata ->> 'next_oncall_channel',''), nullif(event_record.metadata ->> 'oncall_channel',''));
  receipt_max_verification_age_hours := coalesce(nullif(event_record.metadata ->> 'next_receipt_max_verification_age_hours','')::integer, nullif(event_record.metadata ->> 'receipt_max_verification_age_hours','')::integer);
  critical_stale_receipt_count_threshold := coalesce(nullif(event_record.metadata ->> 'next_critical_stale_receipt_count_threshold','')::integer, nullif(event_record.metadata ->> 'critical_stale_receipt_count_threshold','')::integer);

  IF lookback_hours IS NULL OR warning_pending_threshold IS NULL OR critical_pending_threshold IS NULL
    OR escalation_enabled IS NULL OR oncall_channel IS NULL
    OR receipt_max_verification_age_hours IS NULL OR critical_stale_receipt_count_threshold IS NULL
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
    metadata := jsonb_build_object('source','rollback_gpav_fed_exchange_receipt_policy_to_event','rollback_event_id',event_record.id,'rollback_event_type',event_record.event_type,'policy_schema_version',required_schema_version),
    requested_receipt_max_verification_age_hours := receipt_max_verification_age_hours,
    requested_critical_stale_receipt_count_threshold := critical_stale_receipt_count_threshold
  );

  PERFORM public.append_gpav_fed_exchange_receipt_policy_event(
    event_record.policy_key, 'rollback',
    'Federation exchange receipt escalation policy rolled back to historical snapshot',
    jsonb_build_object('source_event_id',event_record.id,'source_event_type',event_record.event_type,'policy_schema_version',required_schema_version)
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
  age_summary_row record;
  policy_row record;
  latest_batch_id uuid;
  page_id uuid := NULL;
  effective_lookback_hours integer := greatest(1, coalesce(requested_lookback_hours, 336));
  effective_warning_threshold integer := 1;
  effective_critical_threshold integer := 5;
  effective_escalation_enabled boolean := true;
  effective_oncall_channel text := 'public_audit_ops';
  effective_max_receipt_age_hours integer := 72;
  effective_critical_stale_threshold integer := 3;
BEGIN
  IF NOT (
    session_user IN ('postgres', 'supabase_admin')
    OR public.current_profile_can_manage_public_audit_verifiers()
  ) THEN
    RAISE EXCEPTION 'Current profile is not authorized to escalate verifier federation exchange receipt pages';
  END IF;

  SELECT * INTO policy_row
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
    effective_max_receipt_age_hours := greatest(1, coalesce(policy_row.receipt_max_verification_age_hours, effective_max_receipt_age_hours));
    effective_critical_stale_threshold := greatest(1, coalesce(policy_row.critical_stale_receipt_count_threshold, effective_critical_stale_threshold));
  END IF;

  SELECT * INTO summary_row
  FROM public.governance_public_audit_verifier_federation_exchange_summary(
    target_batch_id := NULL,
    requested_lookback_hours := effective_lookback_hours
  );
  IF summary_row IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO age_summary_row
  FROM public.gpav_fed_exchange_receipt_backlog_age_summary(
    target_batch_id := NULL,
    requested_lookback_hours := effective_lookback_hours,
    requested_max_receipt_age_hours := effective_max_receipt_age_hours
  );

  SELECT batch.id INTO latest_batch_id
  FROM public.governance_public_audit_batches AS batch
  ORDER BY batch.batch_index DESC
  LIMIT 1;
  IF latest_batch_id IS NULL THEN RETURN NULL; END IF;

  IF effective_escalation_enabled AND (
    coalesce(summary_row.receipt_pending_verification_count, 0) >= effective_warning_threshold
    OR coalesce(age_summary_row.stale_pending_count, 0) > 0
  ) THEN
    INSERT INTO public.governance_public_audit_external_execution_pages (
      batch_id,page_key,severity,page_status,page_message,oncall_channel,page_payload,opened_at,created_by
    )
    VALUES (
      latest_batch_id,
      'verifier_federation_exchange_receipt_escalation',
      CASE
        WHEN coalesce(summary_row.receipt_pending_verification_count, 0) >= effective_critical_threshold
          OR coalesce(age_summary_row.stale_pending_count, 0) >= effective_critical_stale_threshold
          THEN 'critical'
        ELSE 'warning'
      END,
      'open',
      format(
        'Federation exchange receipt backlog (pending=%s, stale=%s, max-age=%sh)',
        coalesce(summary_row.receipt_pending_verification_count, 0),
        coalesce(age_summary_row.stale_pending_count, 0),
        effective_max_receipt_age_hours
      ),
      effective_oncall_channel,
      jsonb_build_object(
        'receipt_pending_verification_count', summary_row.receipt_pending_verification_count,
        'receipt_evidence_count', summary_row.receipt_evidence_count,
        'receipt_verified_count', summary_row.receipt_verified_count,
        'stale_pending_count', coalesce(age_summary_row.stale_pending_count, 0),
        'pending_under_24h_count', coalesce(age_summary_row.pending_under_24h_count, 0),
        'pending_24h_to_72h_count', coalesce(age_summary_row.pending_24h_to_72h_count, 0),
        'pending_over_72h_count', coalesce(age_summary_row.pending_over_72h_count, 0),
        'oldest_pending_hours', coalesce(age_summary_row.oldest_pending_hours, 0),
        'max_receipt_age_hours', effective_max_receipt_age_hours,
        'critical_stale_receipt_count_threshold', effective_critical_stale_threshold,
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
        'critical_pending_threshold', effective_critical_threshold,
        'max_receipt_age_hours', effective_max_receipt_age_hours,
        'critical_stale_receipt_count_threshold', effective_critical_stale_threshold
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

GRANT EXECUTE ON FUNCTION public.gpav_fed_exchange_receipt_backlog_age_summary(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gpav_fed_exchange_receipt_policy_summary(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_gpav_fed_exchange_receipt_policy(text, text, integer, integer, integer, boolean, text, jsonb, integer, integer) TO authenticated;
