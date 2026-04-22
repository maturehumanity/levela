CREATE TABLE IF NOT EXISTS public.governance_public_audit_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_index bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  batch_scope text NOT NULL DEFAULT 'governance_events',
  batch_source text NOT NULL DEFAULT 'manual',
  from_created_at timestamptz,
  to_created_at timestamptz,
  event_count integer NOT NULL DEFAULT 0,
  previous_batch_id uuid REFERENCES public.governance_public_audit_batches(id) ON DELETE SET NULL,
  previous_batch_hash text,
  batch_hash text NOT NULL,
  anchor_network text,
  anchor_reference text,
  anchored_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_public_audit_batches_event_count_check CHECK (event_count >= 0),
  CONSTRAINT governance_public_audit_batches_batch_hash_not_empty CHECK (length(trim(batch_hash)) > 0),
  CONSTRAINT governance_public_audit_batches_anchor_reference_not_empty CHECK (
    anchor_reference IS NULL OR length(trim(anchor_reference)) > 0
  ),
  CONSTRAINT governance_public_audit_batches_anchor_network_not_empty CHECK (
    anchor_network IS NULL OR length(trim(anchor_network)) > 0
  ),
  CONSTRAINT governance_public_audit_batches_anchor_fields_coherence_check CHECK (
    (anchor_reference IS NULL AND anchored_at IS NULL)
    OR (anchor_reference IS NOT NULL AND anchored_at IS NOT NULL)
  ),
  CONSTRAINT governance_public_audit_batches_metadata_object_check CHECK (
    jsonb_typeof(metadata) = 'object'
  ),
  CONSTRAINT governance_public_audit_batches_batch_hash_unique UNIQUE (batch_hash)
);

ALTER TABLE public.governance_public_audit_batches
  ADD COLUMN IF NOT EXISTS anchor_proof jsonb;

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_batches_created
  ON public.governance_public_audit_batches (created_at DESC, batch_index DESC);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_batches_anchor
  ON public.governance_public_audit_batches (anchored_at DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS public.governance_public_audit_batch_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.governance_public_audit_batches(id) ON DELETE CASCADE,
  event_source text NOT NULL,
  event_id uuid NOT NULL,
  event_position integer NOT NULL,
  event_created_at timestamptz NOT NULL,
  event_actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  event_digest text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_public_audit_batch_items_source_check CHECK (
    event_source = ANY(
      ARRAY[
        'governance_proposal_events',
        'governance_implementation_logs',
        'governance_proposal_guardian_approvals'
      ]
    )
  ),
  CONSTRAINT governance_public_audit_batch_items_position_check CHECK (event_position > 0),
  CONSTRAINT governance_public_audit_batch_items_event_digest_not_empty CHECK (length(trim(event_digest)) > 0),
  CONSTRAINT governance_public_audit_batch_items_payload_object_check CHECK (
    jsonb_typeof(event_payload) = 'object'
  ),
  CONSTRAINT governance_public_audit_batch_items_batch_position_unique UNIQUE (batch_id, event_position),
  CONSTRAINT governance_public_audit_batch_items_event_unique UNIQUE (event_source, event_id)
);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_batch_items_batch
  ON public.governance_public_audit_batch_items (batch_id, event_position);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_batch_items_event
  ON public.governance_public_audit_batch_items (event_source, event_id);

DO $$
BEGIN
  CREATE TRIGGER update_governance_public_audit_batches_updated_at
    BEFORE UPDATE ON public.governance_public_audit_batches
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.prevent_governance_public_audit_batch_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.batch_index IS DISTINCT FROM OLD.batch_index
    OR NEW.batch_scope IS DISTINCT FROM OLD.batch_scope
    OR NEW.batch_source IS DISTINCT FROM OLD.batch_source
    OR NEW.from_created_at IS DISTINCT FROM OLD.from_created_at
    OR NEW.to_created_at IS DISTINCT FROM OLD.to_created_at
    OR NEW.event_count IS DISTINCT FROM OLD.event_count
    OR NEW.previous_batch_id IS DISTINCT FROM OLD.previous_batch_id
    OR NEW.previous_batch_hash IS DISTINCT FROM OLD.previous_batch_hash
    OR NEW.batch_hash IS DISTINCT FROM OLD.batch_hash
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
  THEN
    RAISE EXCEPTION 'Public audit batch core fields are immutable after creation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS prevent_governance_public_audit_batch_mutation_trigger ON public.governance_public_audit_batches;
CREATE TRIGGER prevent_governance_public_audit_batch_mutation_trigger
  BEFORE UPDATE ON public.governance_public_audit_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_governance_public_audit_batch_mutation();

CREATE OR REPLACE FUNCTION public.list_pending_governance_public_audit_events(
  max_events integer DEFAULT 500,
  requested_from timestamptz DEFAULT NULL,
  requested_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  event_position integer,
  event_source text,
  event_id uuid,
  event_created_at timestamptz,
  event_actor_id uuid,
  event_payload jsonb,
  event_digest text
) AS $$
WITH candidate_events AS (
  SELECT
    'governance_proposal_events'::text AS event_source,
    event.id AS event_id,
    event.created_at AS event_created_at,
    event.actor_id AS event_actor_id,
    coalesce(event.payload, '{}'::jsonb) AS event_payload
  FROM public.governance_proposal_events AS event
  WHERE (requested_from IS NULL OR event.created_at >= requested_from)
    AND (requested_to IS NULL OR event.created_at <= requested_to)

  UNION ALL

  SELECT
    'governance_implementation_logs'::text AS event_source,
    log.id AS event_id,
    log.created_at AS event_created_at,
    log.actor_id AS event_actor_id,
    jsonb_build_object(
      'execution_status', log.execution_status,
      'execution_summary', log.execution_summary,
      'details', coalesce(log.details, '{}'::jsonb),
      'proposal_id', log.proposal_id,
      'implementation_id', log.implementation_id
    ) AS event_payload
  FROM public.governance_implementation_logs AS log
  WHERE (requested_from IS NULL OR log.created_at >= requested_from)
    AND (requested_to IS NULL OR log.created_at <= requested_to)

  UNION ALL

  SELECT
    'governance_proposal_guardian_approvals'::text AS event_source,
    approval.id AS event_id,
    approval.signed_at AS event_created_at,
    approval.signer_profile_id AS event_actor_id,
    jsonb_build_object(
      'proposal_id', approval.proposal_id,
      'decision', approval.decision,
      'rationale', approval.rationale,
      'snapshot', coalesce(approval.snapshot, '{}'::jsonb),
      'signed_at', approval.signed_at
    ) AS event_payload
  FROM public.governance_proposal_guardian_approvals AS approval
  WHERE (requested_from IS NULL OR approval.signed_at >= requested_from)
    AND (requested_to IS NULL OR approval.signed_at <= requested_to)
),
unbatched_events AS (
  SELECT candidate.*
  FROM candidate_events AS candidate
  LEFT JOIN public.governance_public_audit_batch_items AS item
    ON item.event_source = candidate.event_source
   AND item.event_id = candidate.event_id
  WHERE item.id IS NULL
),
selected_events AS (
  SELECT *
  FROM unbatched_events
  ORDER BY event_created_at ASC, event_source ASC, event_id ASC
  LIMIT greatest(1, coalesce(max_events, 500))
),
ordered_events AS (
  SELECT
    row_number() OVER (ORDER BY event_created_at ASC, event_source ASC, event_id ASC)::integer AS event_position,
    event_source,
    event_id,
    event_created_at,
    event_actor_id,
    event_payload
  FROM selected_events
)
SELECT
  ordered_events.event_position,
  ordered_events.event_source,
  ordered_events.event_id,
  ordered_events.event_created_at,
  ordered_events.event_actor_id,
  ordered_events.event_payload,
  encode(
    extensions.digest(
      concat_ws(
        '|',
        ordered_events.event_source,
        ordered_events.event_id::text,
        to_char(ordered_events.event_created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        coalesce(ordered_events.event_actor_id::text, ''),
        ordered_events.event_payload::text
      ),
      'sha256'
    ),
    'hex'
  ) AS event_digest
FROM ordered_events
ORDER BY ordered_events.event_position ASC;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.capture_governance_public_audit_batch(
  max_events integer DEFAULT 500,
  batch_source text DEFAULT 'manual',
  created_by_profile_id uuid DEFAULT public.current_profile_id(),
  requested_from timestamptz DEFAULT NULL,
  requested_to timestamptz DEFAULT NULL,
  requested_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  actor_id uuid := public.current_profile_id();
  summary record;
  previous_batch record;
  inserted_id uuid;
  normalized_source text;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated profile is required for public audit batch capture';
  END IF;

  IF NOT (
    public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.current_profile_in_governance_domain(ARRAY['constitutional_review', 'technical_stewardship', 'civic_operations'])
  ) THEN
    RAISE EXCEPTION 'Current profile is not authorized to capture public audit batches';
  END IF;

  IF created_by_profile_id IS NULL THEN
    created_by_profile_id := actor_id;
  END IF;

  IF created_by_profile_id <> actor_id
    AND NOT (
      public.has_permission('settings.manage'::public.app_permission)
      OR public.has_permission('role.assign'::public.app_permission)
    )
  THEN
    RAISE EXCEPTION 'Cannot assign public audit batch ownership to another profile';
  END IF;

  normalized_source := coalesce(nullif(trim(batch_source), ''), 'manual');

  SELECT
    min(pending.event_created_at) AS from_created_at,
    max(pending.event_created_at) AS to_created_at,
    count(*)::integer AS event_count,
    coalesce(string_agg(pending.event_digest, '|' ORDER BY pending.event_position), '') AS digest_chain
  INTO summary
  FROM public.list_pending_governance_public_audit_events(
    max_events,
    requested_from,
    requested_to
  ) AS pending;

  IF coalesce(summary.event_count, 0) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT
    batch.id,
    batch.batch_hash
  INTO previous_batch
  FROM public.governance_public_audit_batches AS batch
  ORDER BY batch.batch_index DESC
  LIMIT 1;

  INSERT INTO public.governance_public_audit_batches (
    batch_scope,
    batch_source,
    from_created_at,
    to_created_at,
    event_count,
    previous_batch_id,
    previous_batch_hash,
    batch_hash,
    created_by,
    metadata
  )
  VALUES (
    'governance_events',
    normalized_source,
    summary.from_created_at,
    summary.to_created_at,
    summary.event_count,
    previous_batch.id,
    previous_batch.batch_hash,
    encode(
      extensions.digest(
        concat_ws('|', coalesce(previous_batch.batch_hash, ''), summary.digest_chain),
        'sha256'
      ),
      'hex'
    ),
    created_by_profile_id,
    coalesce(requested_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'captured_by', actor_id,
        'requested_from', requested_from,
        'requested_to', requested_to,
        'max_events', max_events
      )
  )
  RETURNING id INTO inserted_id;

  INSERT INTO public.governance_public_audit_batch_items (
    batch_id,
    event_source,
    event_id,
    event_position,
    event_created_at,
    event_actor_id,
    event_payload,
    event_digest
  )
  SELECT
    inserted_id,
    pending.event_source,
    pending.event_id,
    pending.event_position,
    pending.event_created_at,
    pending.event_actor_id,
    pending.event_payload,
    pending.event_digest
  FROM public.list_pending_governance_public_audit_events(
    max_events,
    requested_from,
    requested_to
  ) AS pending
  ORDER BY pending.event_position ASC;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.record_governance_public_audit_anchor(
  target_batch_id uuid,
  anchor_network text,
  anchor_reference text,
  anchor_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean AS $$
DECLARE
  actor_id uuid := public.current_profile_id();
  normalized_network text;
  normalized_reference text;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated profile is required for audit anchor recording';
  END IF;

  IF NOT (
    public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.current_profile_in_governance_domain(ARRAY['constitutional_review', 'technical_stewardship'])
  ) THEN
    RAISE EXCEPTION 'Current profile is not authorized to record public audit anchors';
  END IF;

  normalized_network := coalesce(nullif(trim(anchor_network), ''), 'external_anchor');
  normalized_reference := nullif(trim(anchor_reference), '');

  IF normalized_reference IS NULL THEN
    RAISE EXCEPTION 'Anchor reference cannot be empty';
  END IF;

  UPDATE public.governance_public_audit_batches
  SET
    anchor_network = normalized_network,
    anchor_reference = normalized_reference,
    anchored_at = now(),
    metadata = coalesce(governance_public_audit_batches.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'anchor_recorded_by', actor_id,
        'anchor_recorded_at', now(),
        'anchor_metadata', coalesce(anchor_metadata, '{}'::jsonb)
      ),
    updated_at = now()
  WHERE id = target_batch_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.verify_governance_public_audit_chain(
  max_batches integer DEFAULT 200
)
RETURNS jsonb AS $$
WITH selected_batches AS (
  SELECT batch.*
  FROM public.governance_public_audit_batches AS batch
  ORDER BY batch.batch_index DESC
  LIMIT greatest(1, coalesce(max_batches, 200))
),
ordered_batches AS (
  SELECT
    selected.id,
    selected.batch_index,
    selected.batch_hash,
    selected.previous_batch_hash,
    row_number() OVER (ORDER BY selected.batch_index ASC) AS chain_position,
    lag(selected.batch_hash) OVER (ORDER BY selected.batch_index ASC) AS expected_previous_hash
  FROM selected_batches AS selected
),
first_invalid_link AS (
  SELECT ordered.id
  FROM ordered_batches AS ordered
  WHERE ordered.chain_position > 1
    AND coalesce(ordered.previous_batch_hash, '') <> coalesce(ordered.expected_previous_hash, '')
  ORDER BY ordered.chain_position ASC
  LIMIT 1
),
recomputed_hashes AS (
  SELECT
    batch.id,
    encode(
      extensions.digest(
        concat_ws(
          '|',
          coalesce(batch.previous_batch_hash, ''),
          coalesce(string_agg(item.event_digest, '|' ORDER BY item.event_position), '')
        ),
        'sha256'
      ),
      'hex'
    ) AS recomputed_hash
  FROM selected_batches AS batch
  LEFT JOIN public.governance_public_audit_batch_items AS item
    ON item.batch_id = batch.id
  GROUP BY batch.id, batch.previous_batch_hash
),
first_invalid_hash AS (
  SELECT batch.id
  FROM selected_batches AS batch
  JOIN recomputed_hashes AS recomputed ON recomputed.id = batch.id
  WHERE batch.batch_hash <> recomputed.recomputed_hash
  ORDER BY batch.batch_index ASC
  LIMIT 1
)
SELECT jsonb_build_object(
  'checked_batch_count', coalesce((SELECT count(*) FROM selected_batches), 0),
  'link_valid', NOT EXISTS (SELECT 1 FROM first_invalid_link),
  'hash_valid', NOT EXISTS (SELECT 1 FROM first_invalid_hash),
  'first_invalid_link_batch_id', (SELECT id FROM first_invalid_link),
  'first_invalid_hash_batch_id', (SELECT id FROM first_invalid_hash),
  'valid', (
    NOT EXISTS (SELECT 1 FROM first_invalid_link)
    AND NOT EXISTS (SELECT 1 FROM first_invalid_hash)
  )
);
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

GRANT SELECT ON public.governance_public_audit_batches TO authenticated;
GRANT SELECT ON public.governance_public_audit_batch_items TO authenticated;

GRANT EXECUTE ON FUNCTION public.list_pending_governance_public_audit_events(integer, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.capture_governance_public_audit_batch(integer, text, uuid, timestamptz, timestamptz, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_governance_public_audit_anchor(uuid, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_governance_public_audit_chain(integer) TO authenticated;

ALTER TABLE public.governance_public_audit_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_public_audit_batch_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Governance public audit batches are readable by authenticated users" ON public.governance_public_audit_batches;
CREATE POLICY "Governance public audit batches are readable by authenticated users" ON public.governance_public_audit_batches
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Governance public audit batch items are readable by authenticated users" ON public.governance_public_audit_batch_items;
CREATE POLICY "Governance public audit batch items are readable by authenticated users" ON public.governance_public_audit_batch_items
  FOR SELECT USING (auth.role() = 'authenticated');
