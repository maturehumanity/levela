CREATE TABLE IF NOT EXISTS public.governance_public_audit_anchor_execution_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.governance_public_audit_batches(id) ON DELETE CASCADE,
  adapter_id uuid NOT NULL REFERENCES public.governance_public_audit_anchor_adapters(id) ON DELETE CASCADE,
  network text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  immutable_reference text,
  block_height bigint,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_public_audit_anchor_execution_jobs_status_check CHECK (
    status IN ('pending', 'completed', 'failed', 'cancelled')
  ),
  CONSTRAINT governance_public_audit_anchor_execution_jobs_network_not_empty_check CHECK (
    length(trim(network)) > 0
  ),
  CONSTRAINT governance_public_audit_anchor_execution_jobs_immutable_reference_not_empty_check CHECK (
    immutable_reference IS NULL OR length(trim(immutable_reference)) > 0
  ),
  CONSTRAINT governance_public_audit_anchor_execution_jobs_error_message_not_empty_check CHECK (
    error_message IS NULL OR length(trim(error_message)) > 0
  ),
  CONSTRAINT governance_public_audit_anchor_execution_jobs_block_height_check CHECK (
    block_height IS NULL OR block_height >= 0
  ),
  CONSTRAINT governance_public_audit_anchor_execution_jobs_metadata_object_check CHECK (
    jsonb_typeof(metadata) = 'object'
  )
);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_anchor_execution_jobs_batch_status
  ON public.governance_public_audit_anchor_execution_jobs (batch_id, status, scheduled_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_anchor_execution_jobs_adapter_status
  ON public.governance_public_audit_anchor_execution_jobs (adapter_id, status, scheduled_at DESC, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_governance_public_audit_anchor_execution_jobs_pending_unique
  ON public.governance_public_audit_anchor_execution_jobs (batch_id, adapter_id)
  WHERE status = 'pending';

DO $$
BEGIN
  CREATE TRIGGER update_governance_public_audit_anchor_execution_jobs_updated_at
    BEFORE UPDATE ON public.governance_public_audit_anchor_execution_jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.schedule_governance_public_audit_anchor_execution_jobs(
  target_batch_id uuid DEFAULT NULL,
  force_reschedule boolean DEFAULT false
)
RETURNS integer AS $$
DECLARE
  batch_record record;
  adapter_record record;
  inserted_count integer := 0;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to schedule public audit anchor execution jobs';
  END IF;

  FOR batch_record IN
    SELECT batch.id
    FROM public.governance_public_audit_batches AS batch
    WHERE target_batch_id IS NULL OR batch.id = target_batch_id
    ORDER BY batch.batch_index DESC
    LIMIT CASE WHEN target_batch_id IS NULL THEN 3 ELSE 1 END
  LOOP
    FOR adapter_record IN
      SELECT adapter.id, adapter.network
      FROM public.governance_public_audit_anchor_adapters AS adapter
      WHERE adapter.is_active = true
      ORDER BY adapter.created_at ASC
    LOOP
      IF force_reschedule THEN
        UPDATE public.governance_public_audit_anchor_execution_jobs AS job
        SET
          status = 'cancelled',
          completed_at = coalesce(job.completed_at, now()),
          error_message = coalesce(job.error_message, 'Rescheduled anchor execution job')
        WHERE job.batch_id = batch_record.id
          AND job.adapter_id = adapter_record.id
          AND job.status = 'pending';
      END IF;

      IF NOT force_reschedule
         AND EXISTS (
           SELECT 1
           FROM public.governance_public_audit_immutable_anchors AS anchor
           WHERE anchor.batch_id = batch_record.id
             AND anchor.adapter_id = adapter_record.id
         )
      THEN
        CONTINUE;
      END IF;

      IF force_reschedule
         OR NOT EXISTS (
           SELECT 1
           FROM public.governance_public_audit_anchor_execution_jobs AS job
           WHERE job.batch_id = batch_record.id
             AND job.adapter_id = adapter_record.id
             AND job.status = 'pending'
         )
      THEN
        INSERT INTO public.governance_public_audit_anchor_execution_jobs (
          batch_id,
          adapter_id,
          network,
          status,
          metadata,
          scheduled_by,
          scheduled_at
        )
        VALUES (
          batch_record.id,
          adapter_record.id,
          coalesce(nullif(btrim(coalesce(adapter_record.network, '')), ''), 'external_anchor'),
          'pending',
          jsonb_build_object('source', 'automated_anchor_scheduler'),
          public.current_profile_id(),
          now()
        )
        ON CONFLICT DO NOTHING;

        IF FOUND THEN
          inserted_count := inserted_count + 1;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.complete_governance_public_audit_anchor_execution_job(
  target_job_id uuid,
  completion_status text,
  immutable_reference text DEFAULT NULL,
  proof_block_height bigint DEFAULT NULL,
  error_message text DEFAULT NULL,
  proof_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  job_record public.governance_public_audit_anchor_execution_jobs%ROWTYPE;
  normalized_status text;
  normalized_reference text;
  linked_anchor_id uuid;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to complete public audit anchor execution jobs';
  END IF;

  SELECT job.*
  INTO job_record
  FROM public.governance_public_audit_anchor_execution_jobs AS job
  WHERE job.id = target_job_id
  LIMIT 1;

  IF job_record.id IS NULL THEN
    RAISE EXCEPTION 'Anchor execution job does not exist';
  END IF;

  normalized_status := lower(btrim(coalesce(completion_status, '')));
  IF normalized_status NOT IN ('pending', 'completed', 'failed', 'cancelled') THEN
    RAISE EXCEPTION 'Anchor execution completion status must be pending, completed, failed, or cancelled';
  END IF;

  normalized_reference := nullif(btrim(coalesce(immutable_reference, '')), '');

  IF normalized_status = 'completed' THEN
    IF normalized_reference IS NULL THEN
      RAISE EXCEPTION 'Immutable reference is required when completing anchor execution jobs';
    END IF;

    linked_anchor_id := public.record_governance_public_audit_immutable_anchor(
      job_record.batch_id,
      job_record.adapter_id,
      job_record.network,
      normalized_reference,
      coalesce(proof_payload, '{}'::jsonb),
      proof_block_height
    );
  END IF;

  UPDATE public.governance_public_audit_anchor_execution_jobs
  SET
    status = normalized_status,
    immutable_reference = CASE
      WHEN normalized_status = 'completed' THEN normalized_reference
      ELSE immutable_reference
    END,
    block_height = CASE
      WHEN normalized_status = 'completed' THEN proof_block_height
      ELSE block_height
    END,
    error_message = nullif(btrim(coalesce(error_message, '')), ''),
    completed_at = CASE
      WHEN normalized_status IN ('completed', 'failed', 'cancelled') THEN now()
      ELSE completed_at
    END,
    metadata = coalesce(metadata, '{}'::jsonb)
      || coalesce(proof_payload, '{}'::jsonb)
      || jsonb_build_object(
        'completion_status', normalized_status,
        'completed_via', 'governance_public_audit_anchor_execution_worker',
        'linked_anchor_id', linked_anchor_id,
        'completed_at', now()
      )
  WHERE id = job_record.id;

  RETURN job_record.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.run_governance_public_audit_external_execution_cycle(
  target_batch_id uuid DEFAULT NULL,
  force_reschedule boolean DEFAULT false
)
RETURNS TABLE (
  batch_id uuid,
  anchor_jobs_scheduled integer,
  verifier_jobs_scheduled integer
) AS $$
DECLARE
  effective_batch_id uuid;
  anchor_count integer := 0;
  verifier_count integer := 0;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to run public audit external execution cycles';
  END IF;

  effective_batch_id := coalesce(
    target_batch_id,
    (
      SELECT batch.id
      FROM public.governance_public_audit_batches AS batch
      ORDER BY batch.batch_index DESC
      LIMIT 1
    )
  );

  IF effective_batch_id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, 0::integer, 0::integer;
    RETURN;
  END IF;

  anchor_count := coalesce(public.schedule_governance_public_audit_anchor_execution_jobs(effective_batch_id, force_reschedule), 0);
  verifier_count := coalesce(public.schedule_governance_public_audit_verifier_jobs(effective_batch_id, force_reschedule), 0);

  RETURN QUERY SELECT effective_batch_id, anchor_count, verifier_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_public_audit_operations_sla_summary(
  requested_batch_id uuid DEFAULT NULL,
  requested_pending_sla_hours integer DEFAULT 4,
  requested_lookback_hours integer DEFAULT 24
)
RETURNS TABLE (
  batch_id uuid,
  pending_sla_hours integer,
  lookback_hours integer,
  active_anchor_adapter_count integer,
  active_verifier_count integer,
  anchor_pending_count integer,
  anchor_stale_pending_count integer,
  anchor_failed_lookback_count integer,
  anchor_completed_lookback_count integer,
  anchor_failure_share_percent numeric,
  verifier_pending_count integer,
  verifier_stale_pending_count integer,
  verifier_failed_lookback_count integer,
  verifier_completed_lookback_count integer,
  verifier_failure_share_percent numeric,
  oldest_anchor_pending_at timestamptz,
  oldest_verifier_pending_at timestamptz,
  anchor_sla_met boolean,
  verifier_sla_met boolean,
  overall_sla_met boolean
) AS $$
WITH config AS (
  SELECT
    greatest(1, coalesce(requested_pending_sla_hours, 4))::integer AS pending_sla_hours,
    greatest(1, coalesce(requested_lookback_hours, 24))::integer AS lookback_hours
),
target_batch AS (
  SELECT coalesce(
    requested_batch_id,
    (
      SELECT batch.id
      FROM public.governance_public_audit_batches AS batch
      ORDER BY batch.batch_index DESC
      LIMIT 1
    )
  ) AS batch_id
),
anchor_rollup AS (
  SELECT
    coalesce(count(*) FILTER (WHERE job.status = 'pending'), 0)::integer AS pending_count,
    coalesce(count(*) FILTER (
      WHERE job.status = 'pending'
        AND job.scheduled_at < (now() - make_interval(hours => config.pending_sla_hours))
    ), 0)::integer AS stale_pending_count,
    coalesce(count(*) FILTER (
      WHERE job.status = 'failed'
        AND job.completed_at >= (now() - make_interval(hours => config.lookback_hours))
    ), 0)::integer AS failed_lookback_count,
    coalesce(count(*) FILTER (
      WHERE job.status = 'completed'
        AND job.completed_at >= (now() - make_interval(hours => config.lookback_hours))
    ), 0)::integer AS completed_lookback_count,
    min(job.scheduled_at) FILTER (WHERE job.status = 'pending') AS oldest_pending_at
  FROM public.governance_public_audit_anchor_execution_jobs AS job
  JOIN target_batch ON target_batch.batch_id = job.batch_id
  CROSS JOIN config
),
verifier_rollup AS (
  SELECT
    coalesce(count(*) FILTER (WHERE job.status = 'pending'::public.governance_public_audit_verifier_job_status), 0)::integer AS pending_count,
    coalesce(count(*) FILTER (
      WHERE job.status = 'pending'::public.governance_public_audit_verifier_job_status
        AND job.scheduled_at < (now() - make_interval(hours => config.pending_sla_hours))
    ), 0)::integer AS stale_pending_count,
    coalesce(count(*) FILTER (
      WHERE job.status = 'failed'::public.governance_public_audit_verifier_job_status
        AND job.completed_at >= (now() - make_interval(hours => config.lookback_hours))
    ), 0)::integer AS failed_lookback_count,
    coalesce(count(*) FILTER (
      WHERE job.status = 'completed'::public.governance_public_audit_verifier_job_status
        AND job.completed_at >= (now() - make_interval(hours => config.lookback_hours))
    ), 0)::integer AS completed_lookback_count,
    min(job.scheduled_at) FILTER (WHERE job.status = 'pending'::public.governance_public_audit_verifier_job_status) AS oldest_pending_at
  FROM public.governance_public_audit_verifier_jobs AS job
  JOIN target_batch ON target_batch.batch_id = job.batch_id
  CROSS JOIN config
),
counts AS (
  SELECT
    (SELECT count(*)::integer FROM public.governance_public_audit_anchor_adapters AS adapter WHERE adapter.is_active = true) AS active_anchor_adapter_count,
    (SELECT count(*)::integer FROM public.governance_public_audit_verifier_nodes AS verifier WHERE verifier.is_active = true) AS active_verifier_count
)
SELECT
  target_batch.batch_id,
  config.pending_sla_hours,
  config.lookback_hours,
  coalesce(counts.active_anchor_adapter_count, 0) AS active_anchor_adapter_count,
  coalesce(counts.active_verifier_count, 0) AS active_verifier_count,
  coalesce(anchor_rollup.pending_count, 0) AS anchor_pending_count,
  coalesce(anchor_rollup.stale_pending_count, 0) AS anchor_stale_pending_count,
  coalesce(anchor_rollup.failed_lookback_count, 0) AS anchor_failed_lookback_count,
  coalesce(anchor_rollup.completed_lookback_count, 0) AS anchor_completed_lookback_count,
  CASE
    WHEN coalesce(anchor_rollup.failed_lookback_count, 0) + coalesce(anchor_rollup.completed_lookback_count, 0) <= 0 THEN NULL
    ELSE round(
      (
        coalesce(anchor_rollup.failed_lookback_count, 0)::numeric
        / (coalesce(anchor_rollup.failed_lookback_count, 0) + coalesce(anchor_rollup.completed_lookback_count, 0))::numeric
      ) * 100,
      2
    )
  END AS anchor_failure_share_percent,
  coalesce(verifier_rollup.pending_count, 0) AS verifier_pending_count,
  coalesce(verifier_rollup.stale_pending_count, 0) AS verifier_stale_pending_count,
  coalesce(verifier_rollup.failed_lookback_count, 0) AS verifier_failed_lookback_count,
  coalesce(verifier_rollup.completed_lookback_count, 0) AS verifier_completed_lookback_count,
  CASE
    WHEN coalesce(verifier_rollup.failed_lookback_count, 0) + coalesce(verifier_rollup.completed_lookback_count, 0) <= 0 THEN NULL
    ELSE round(
      (
        coalesce(verifier_rollup.failed_lookback_count, 0)::numeric
        / (coalesce(verifier_rollup.failed_lookback_count, 0) + coalesce(verifier_rollup.completed_lookback_count, 0))::numeric
      ) * 100,
      2
    )
  END AS verifier_failure_share_percent,
  anchor_rollup.oldest_pending_at AS oldest_anchor_pending_at,
  verifier_rollup.oldest_pending_at AS oldest_verifier_pending_at,
  coalesce(anchor_rollup.stale_pending_count, 0) = 0 AS anchor_sla_met,
  coalesce(verifier_rollup.stale_pending_count, 0) = 0 AS verifier_sla_met,
  (
    coalesce(anchor_rollup.stale_pending_count, 0) = 0
    AND coalesce(verifier_rollup.stale_pending_count, 0) = 0
  ) AS overall_sla_met
FROM target_batch
CROSS JOIN config
CROSS JOIN counts
LEFT JOIN anchor_rollup ON true
LEFT JOIN verifier_rollup ON true
WHERE target_batch.batch_id IS NOT NULL;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_public_audit_anchor_execution_job_board(
  requested_batch_id uuid DEFAULT NULL,
  max_jobs integer DEFAULT 80
)
RETURNS TABLE (
  job_id uuid,
  batch_id uuid,
  adapter_id uuid,
  adapter_key text,
  adapter_name text,
  network text,
  status text,
  scheduled_at timestamptz,
  completed_at timestamptz,
  immutable_reference text,
  error_message text
) AS $$
WITH target_batch AS (
  SELECT coalesce(
    requested_batch_id,
    (
      SELECT batch.id
      FROM public.governance_public_audit_batches AS batch
      ORDER BY batch.batch_index DESC
      LIMIT 1
    )
  ) AS batch_id
)
SELECT
  job.id AS job_id,
  job.batch_id,
  job.adapter_id,
  adapter.adapter_key,
  adapter.adapter_name,
  job.network,
  job.status,
  job.scheduled_at,
  job.completed_at,
  job.immutable_reference,
  job.error_message
FROM public.governance_public_audit_anchor_execution_jobs AS job
JOIN public.governance_public_audit_anchor_adapters AS adapter
  ON adapter.id = job.adapter_id
JOIN target_batch
  ON target_batch.batch_id = job.batch_id
ORDER BY job.scheduled_at DESC, job.created_at DESC, job.id DESC
LIMIT greatest(1, coalesce(max_jobs, 80));
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

GRANT SELECT, INSERT, UPDATE ON public.governance_public_audit_anchor_execution_jobs TO authenticated;

GRANT EXECUTE ON FUNCTION public.schedule_governance_public_audit_anchor_execution_jobs(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_governance_public_audit_anchor_execution_job(uuid, text, text, bigint, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_governance_public_audit_external_execution_cycle(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_operations_sla_summary(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_anchor_execution_job_board(uuid, integer) TO authenticated;

ALTER TABLE public.governance_public_audit_anchor_execution_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public audit anchor execution jobs are readable by authenticated users" ON public.governance_public_audit_anchor_execution_jobs;
CREATE POLICY "Public audit anchor execution jobs are readable by authenticated users" ON public.governance_public_audit_anchor_execution_jobs
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Public audit anchor execution jobs are manageable by verifier stewards" ON public.governance_public_audit_anchor_execution_jobs;
CREATE POLICY "Public audit anchor execution jobs are manageable by verifier stewards" ON public.governance_public_audit_anchor_execution_jobs
  FOR ALL USING (public.current_profile_can_manage_public_audit_verifiers())
  WITH CHECK (public.current_profile_can_manage_public_audit_verifiers());
