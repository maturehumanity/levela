CREATE TABLE IF NOT EXISTS public.governance_public_audit_verifier_mirror_directory_signers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signer_key text NOT NULL UNIQUE,
  signer_label text,
  public_key text NOT NULL,
  signing_algorithm text NOT NULL DEFAULT 'ed25519',
  trust_tier text NOT NULL DEFAULT 'observer',
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  added_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_public_audit_verifier_mirror_directory_signers_key_not_empty_check CHECK (length(trim(signer_key)) > 0),
  CONSTRAINT governance_public_audit_verifier_mirror_directory_signers_public_key_not_empty_check CHECK (length(trim(public_key)) > 0),
  CONSTRAINT governance_public_audit_verifier_mirror_directory_signers_algorithm_not_empty_check CHECK (length(trim(signing_algorithm)) > 0),
  CONSTRAINT governance_public_audit_verifier_mirror_directory_signers_trust_tier_check CHECK (
    trust_tier IN ('bootstrap', 'observer', 'independent', 'community')
  ),
  CONSTRAINT governance_public_audit_verifier_mirror_directory_signers_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE IF NOT EXISTS public.governance_public_audit_verifier_mirror_directories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES public.governance_public_audit_batches(id) ON DELETE SET NULL,
  directory_version text NOT NULL DEFAULT 'public_audit_verifier_mirror_directory_v1',
  directory_hash text NOT NULL,
  directory_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  signer_id uuid NOT NULL REFERENCES public.governance_public_audit_verifier_mirror_directory_signers(id) ON DELETE RESTRICT,
  signer_key text NOT NULL,
  signature text NOT NULL,
  signature_algorithm text NOT NULL DEFAULT 'ed25519',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_public_audit_verifier_mirror_directories_version_not_empty_check CHECK (length(trim(directory_version)) > 0),
  CONSTRAINT governance_public_audit_verifier_mirror_directories_hash_not_empty_check CHECK (length(trim(directory_hash)) > 0),
  CONSTRAINT governance_public_audit_verifier_mirror_directories_signer_key_not_empty_check CHECK (length(trim(signer_key)) > 0),
  CONSTRAINT governance_public_audit_verifier_mirror_directories_signature_not_empty_check CHECK (length(trim(signature)) > 0),
  CONSTRAINT governance_public_audit_verifier_mirror_directories_algorithm_not_empty_check CHECK (length(trim(signature_algorithm)) > 0),
  CONSTRAINT governance_public_audit_verifier_mirror_directories_payload_object_check CHECK (jsonb_typeof(directory_payload) = 'object'),
  CONSTRAINT governance_public_audit_verifier_mirror_directories_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT governance_public_audit_verifier_mirror_directories_unique_hash UNIQUE (directory_hash, signer_id)
);

CREATE TABLE IF NOT EXISTS public.governance_public_audit_verifier_mirror_failover_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key text NOT NULL UNIQUE,
  policy_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  min_healthy_mirrors integer NOT NULL DEFAULT 1,
  max_mirror_latency_ms integer NOT NULL DEFAULT 2500,
  max_failures_before_cooldown integer NOT NULL DEFAULT 2,
  cooldown_minutes integer NOT NULL DEFAULT 10,
  prefer_same_region boolean NOT NULL DEFAULT false,
  required_distinct_regions integer NOT NULL DEFAULT 1,
  required_distinct_operators integer NOT NULL DEFAULT 1,
  mirror_selection_strategy text NOT NULL DEFAULT 'health_latency_diversity',
  max_mirror_candidates integer NOT NULL DEFAULT 8,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_public_audit_verifier_mirror_failover_policies_key_not_empty_check CHECK (length(trim(policy_key)) > 0),
  CONSTRAINT governance_public_audit_verifier_mirror_failover_policies_name_not_empty_check CHECK (length(trim(policy_name)) > 0),
  CONSTRAINT governance_public_audit_verifier_mirror_failover_policies_min_healthy_check CHECK (min_healthy_mirrors >= 1),
  CONSTRAINT governance_public_audit_verifier_mirror_failover_policies_max_latency_check CHECK (max_mirror_latency_ms >= 100),
  CONSTRAINT governance_public_audit_verifier_mirror_failover_policies_max_failures_check CHECK (max_failures_before_cooldown >= 1),
  CONSTRAINT governance_public_audit_verifier_mirror_failover_policies_cooldown_check CHECK (cooldown_minutes >= 1),
  CONSTRAINT governance_public_audit_verifier_mirror_failover_policies_required_regions_check CHECK (required_distinct_regions >= 1),
  CONSTRAINT governance_public_audit_verifier_mirror_failover_policies_required_operators_check CHECK (required_distinct_operators >= 1),
  CONSTRAINT governance_public_audit_verifier_mirror_failover_policies_strategy_not_empty_check CHECK (length(trim(mirror_selection_strategy)) > 0),
  CONSTRAINT governance_public_audit_verifier_mirror_failover_policies_max_candidates_check CHECK (max_mirror_candidates >= 1),
  CONSTRAINT governance_public_audit_verifier_mirror_failover_policies_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE IF NOT EXISTS public.governance_public_audit_verifier_mirror_probe_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mirror_id uuid NOT NULL REFERENCES public.governance_public_audit_verifier_mirrors(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.governance_public_audit_batches(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  probe_timeout_ms integer NOT NULL DEFAULT 8000,
  observed_check_status text,
  observed_latency_ms integer,
  observed_batch_hash text,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_public_audit_verifier_mirror_probe_jobs_status_check CHECK (
    status IN ('pending', 'running', 'completed', 'failed', 'cancelled')
  ),
  CONSTRAINT governance_public_audit_verifier_mirror_probe_jobs_attempt_count_check CHECK (attempt_count >= 0),
  CONSTRAINT governance_public_audit_verifier_mirror_probe_jobs_max_attempts_check CHECK (max_attempts >= 1),
  CONSTRAINT governance_public_audit_verifier_mirror_probe_jobs_timeout_check CHECK (probe_timeout_ms >= 100),
  CONSTRAINT governance_public_audit_verifier_mirror_probe_jobs_observed_status_check CHECK (
    observed_check_status IS NULL OR observed_check_status IN ('ok', 'degraded', 'failed')
  ),
  CONSTRAINT governance_public_audit_verifier_mirror_probe_jobs_observed_latency_check CHECK (
    observed_latency_ms IS NULL OR observed_latency_ms >= 0
  ),
  CONSTRAINT governance_public_audit_verifier_mirror_probe_jobs_observed_hash_not_empty_check CHECK (
    observed_batch_hash IS NULL OR length(trim(observed_batch_hash)) > 0
  ),
  CONSTRAINT governance_public_audit_verifier_mirror_probe_jobs_error_not_empty_check CHECK (
    error_message IS NULL OR length(trim(error_message)) > 0
  ),
  CONSTRAINT governance_public_audit_verifier_mirror_probe_jobs_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_verifier_mirror_directory_signers_active
  ON public.governance_public_audit_verifier_mirror_directory_signers (is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_verifier_mirror_directories_batch_published
  ON public.governance_public_audit_verifier_mirror_directories (batch_id, published_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_verifier_mirror_directories_signer_published
  ON public.governance_public_audit_verifier_mirror_directories (signer_id, published_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_verifier_mirror_failover_policies_active
  ON public.governance_public_audit_verifier_mirror_failover_policies (is_active, updated_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_verifier_mirror_probe_jobs_batch_status
  ON public.governance_public_audit_verifier_mirror_probe_jobs (batch_id, status, scheduled_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_verifier_mirror_probe_jobs_mirror_status
  ON public.governance_public_audit_verifier_mirror_probe_jobs (mirror_id, status, scheduled_at DESC, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_governance_public_audit_verifier_mirror_probe_jobs_pending_unique
  ON public.governance_public_audit_verifier_mirror_probe_jobs (
    mirror_id,
    coalesce(batch_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE status IN ('pending', 'running');

DO $$
BEGIN
  CREATE TRIGGER update_governance_public_audit_verifier_mirror_directory_signers_updated_at
    BEFORE UPDATE ON public.governance_public_audit_verifier_mirror_directory_signers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_governance_public_audit_verifier_mirror_directories_updated_at
    BEFORE UPDATE ON public.governance_public_audit_verifier_mirror_directories
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_governance_public_audit_verifier_mirror_failover_policies_updated_at
    BEFORE UPDATE ON public.governance_public_audit_verifier_mirror_failover_policies
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_governance_public_audit_verifier_mirror_probe_jobs_updated_at
    BEFORE UPDATE ON public.governance_public_audit_verifier_mirror_probe_jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.prevent_governance_public_audit_verifier_mirror_directory_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Verifier mirror directories are append-only';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS prevent_governance_public_audit_verifier_mirror_directories_update_trigger
ON public.governance_public_audit_verifier_mirror_directories;
CREATE TRIGGER prevent_governance_public_audit_verifier_mirror_directories_update_trigger
  BEFORE UPDATE ON public.governance_public_audit_verifier_mirror_directories
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_governance_public_audit_verifier_mirror_directory_mutation();

DROP TRIGGER IF EXISTS prevent_governance_public_audit_verifier_mirror_directories_delete_trigger
ON public.governance_public_audit_verifier_mirror_directories;
CREATE TRIGGER prevent_governance_public_audit_verifier_mirror_directories_delete_trigger
  BEFORE DELETE ON public.governance_public_audit_verifier_mirror_directories
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_governance_public_audit_verifier_mirror_directory_mutation();

INSERT INTO public.governance_public_audit_verifier_mirror_failover_policies (
  policy_key,
  policy_name,
  is_active,
  min_healthy_mirrors,
  max_mirror_latency_ms,
  max_failures_before_cooldown,
  cooldown_minutes,
  prefer_same_region,
  required_distinct_regions,
  required_distinct_operators,
  mirror_selection_strategy,
  max_mirror_candidates,
  metadata
)
VALUES (
  'default',
  'Default mirror failover policy',
  true,
  1,
  2500,
  2,
  10,
  false,
  1,
  1,
  'health_latency_diversity',
  8,
  jsonb_build_object('source', 'baseline_seed')
)
ON CONFLICT (policy_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.register_governance_public_audit_verifier_mirror_directory_signer(
  signer_key text,
  signer_label text DEFAULT NULL,
  public_key text DEFAULT NULL,
  signing_algorithm text DEFAULT 'ed25519',
  trust_tier text DEFAULT 'observer',
  metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  inserted_id uuid;
  normalized_trust_tier text;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to manage verifier mirror directory signers';
  END IF;

  normalized_trust_tier := lower(coalesce(nullif(btrim(coalesce(trust_tier, '')), ''), 'observer'));
  IF normalized_trust_tier NOT IN ('bootstrap', 'observer', 'independent', 'community') THEN
    RAISE EXCEPTION 'Trust tier must be bootstrap, observer, independent, or community';
  END IF;

  INSERT INTO public.governance_public_audit_verifier_mirror_directory_signers (
    signer_key,
    signer_label,
    public_key,
    signing_algorithm,
    trust_tier,
    is_active,
    metadata,
    added_by
  )
  VALUES (
    btrim(coalesce(signer_key, '')),
    nullif(btrim(coalesce(signer_label, '')), ''),
    btrim(coalesce(public_key, '')),
    lower(coalesce(nullif(btrim(coalesce(signing_algorithm, '')), ''), 'ed25519')),
    normalized_trust_tier,
    true,
    coalesce(metadata, '{}'::jsonb),
    public.current_profile_id()
  )
  ON CONFLICT (signer_key) DO UPDATE
    SET signer_label = excluded.signer_label,
        public_key = excluded.public_key,
        signing_algorithm = excluded.signing_algorithm,
        trust_tier = excluded.trust_tier,
        is_active = true,
        metadata = coalesce(public.governance_public_audit_verifier_mirror_directory_signers.metadata, '{}'::jsonb)
          || coalesce(excluded.metadata, '{}'::jsonb)
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.upsert_governance_public_audit_verifier_mirror_failover_policy(
  policy_key text DEFAULT 'default',
  policy_name text DEFAULT 'Default mirror failover policy',
  is_active boolean DEFAULT true,
  min_healthy_mirrors integer DEFAULT 1,
  max_mirror_latency_ms integer DEFAULT 2500,
  max_failures_before_cooldown integer DEFAULT 2,
  cooldown_minutes integer DEFAULT 10,
  prefer_same_region boolean DEFAULT false,
  required_distinct_regions integer DEFAULT 1,
  required_distinct_operators integer DEFAULT 1,
  mirror_selection_strategy text DEFAULT 'health_latency_diversity',
  max_mirror_candidates integer DEFAULT 8,
  metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  inserted_id uuid;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to manage verifier mirror failover policy';
  END IF;

  INSERT INTO public.governance_public_audit_verifier_mirror_failover_policies (
    policy_key,
    policy_name,
    is_active,
    min_healthy_mirrors,
    max_mirror_latency_ms,
    max_failures_before_cooldown,
    cooldown_minutes,
    prefer_same_region,
    required_distinct_regions,
    required_distinct_operators,
    mirror_selection_strategy,
    max_mirror_candidates,
    metadata,
    created_by,
    updated_by
  )
  VALUES (
    lower(coalesce(nullif(btrim(coalesce(policy_key, '')), ''), 'default')),
    coalesce(nullif(btrim(coalesce(policy_name, '')), ''), 'Default mirror failover policy'),
    coalesce(is_active, true),
    greatest(1, coalesce(min_healthy_mirrors, 1)),
    greatest(100, coalesce(max_mirror_latency_ms, 2500)),
    greatest(1, coalesce(max_failures_before_cooldown, 2)),
    greatest(1, coalesce(cooldown_minutes, 10)),
    coalesce(prefer_same_region, false),
    greatest(1, coalesce(required_distinct_regions, 1)),
    greatest(1, coalesce(required_distinct_operators, 1)),
    lower(coalesce(nullif(btrim(coalesce(mirror_selection_strategy, '')), ''), 'health_latency_diversity')),
    greatest(1, coalesce(max_mirror_candidates, 8)),
    coalesce(metadata, '{}'::jsonb),
    public.current_profile_id(),
    public.current_profile_id()
  )
  ON CONFLICT (policy_key) DO UPDATE
    SET policy_name = excluded.policy_name,
        is_active = excluded.is_active,
        min_healthy_mirrors = excluded.min_healthy_mirrors,
        max_mirror_latency_ms = excluded.max_mirror_latency_ms,
        max_failures_before_cooldown = excluded.max_failures_before_cooldown,
        cooldown_minutes = excluded.cooldown_minutes,
        prefer_same_region = excluded.prefer_same_region,
        required_distinct_regions = excluded.required_distinct_regions,
        required_distinct_operators = excluded.required_distinct_operators,
        mirror_selection_strategy = excluded.mirror_selection_strategy,
        max_mirror_candidates = excluded.max_mirror_candidates,
        metadata = coalesce(public.governance_public_audit_verifier_mirror_failover_policies.metadata, '{}'::jsonb)
          || coalesce(excluded.metadata, '{}'::jsonb),
        updated_by = public.current_profile_id()
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_public_audit_verifier_mirror_failover_policy_summary(
  requested_policy_key text DEFAULT 'default'
)
RETURNS TABLE (
  policy_id uuid,
  policy_key text,
  policy_name text,
  is_active boolean,
  min_healthy_mirrors integer,
  max_mirror_latency_ms integer,
  max_failures_before_cooldown integer,
  cooldown_minutes integer,
  prefer_same_region boolean,
  required_distinct_regions integer,
  required_distinct_operators integer,
  mirror_selection_strategy text,
  max_mirror_candidates integer,
  updated_at timestamptz
) AS $$
SELECT
  policy.id AS policy_id,
  policy.policy_key,
  policy.policy_name,
  policy.is_active,
  policy.min_healthy_mirrors,
  policy.max_mirror_latency_ms,
  policy.max_failures_before_cooldown,
  policy.cooldown_minutes,
  policy.prefer_same_region,
  policy.required_distinct_regions,
  policy.required_distinct_operators,
  policy.mirror_selection_strategy,
  policy.max_mirror_candidates,
  policy.updated_at
FROM public.governance_public_audit_verifier_mirror_failover_policies AS policy
WHERE policy.policy_key = lower(coalesce(nullif(btrim(coalesce(requested_policy_key, '')), ''), 'default'))
ORDER BY policy.updated_at DESC, policy.created_at DESC, policy.id DESC
LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_public_audit_verifier_mirror_directory_summary(
  requested_batch_id uuid DEFAULT NULL,
  max_entries integer DEFAULT 10
)
RETURNS TABLE (
  directory_id uuid,
  batch_id uuid,
  directory_version text,
  directory_hash text,
  signer_id uuid,
  signer_key text,
  signer_label text,
  trust_tier text,
  signature text,
  signature_algorithm text,
  published_at timestamptz,
  is_latest_for_batch boolean
) AS $$
WITH scoped_directories AS (
  SELECT
    directory.id,
    directory.batch_id,
    directory.directory_version,
    directory.directory_hash,
    directory.signer_id,
    directory.signer_key,
    signer.signer_label,
    signer.trust_tier,
    directory.signature,
    directory.signature_algorithm,
    directory.published_at,
    row_number() OVER (
      PARTITION BY coalesce(directory.batch_id, '00000000-0000-0000-0000-000000000000'::uuid)
      ORDER BY directory.published_at DESC, directory.created_at DESC, directory.id DESC
    ) AS batch_rank
  FROM public.governance_public_audit_verifier_mirror_directories AS directory
  LEFT JOIN public.governance_public_audit_verifier_mirror_directory_signers AS signer
    ON signer.id = directory.signer_id
  WHERE requested_batch_id IS NULL
     OR directory.batch_id = requested_batch_id
)
SELECT
  scoped.id AS directory_id,
  scoped.batch_id,
  scoped.directory_version,
  scoped.directory_hash,
  scoped.signer_id,
  scoped.signer_key,
  scoped.signer_label,
  coalesce(scoped.trust_tier, 'observer') AS trust_tier,
  scoped.signature,
  scoped.signature_algorithm,
  scoped.published_at,
  scoped.batch_rank = 1 AS is_latest_for_batch
FROM scoped_directories AS scoped
ORDER BY scoped.published_at DESC, scoped.id DESC
LIMIT greatest(1, coalesce(max_entries, 10));
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_public_audit_verifier_mirror_probe_job_board(
  requested_batch_id uuid DEFAULT NULL,
  max_jobs integer DEFAULT 120
)
RETURNS TABLE (
  job_id uuid,
  batch_id uuid,
  mirror_id uuid,
  mirror_key text,
  mirror_label text,
  endpoint_url text,
  status text,
  scheduled_at timestamptz,
  completed_at timestamptz,
  observed_check_status text,
  observed_latency_ms integer,
  observed_batch_hash text,
  error_message text
) AS $$
SELECT
  job.id AS job_id,
  job.batch_id,
  job.mirror_id,
  mirror.mirror_key,
  mirror.mirror_label,
  mirror.endpoint_url,
  job.status,
  job.scheduled_at,
  job.completed_at,
  job.observed_check_status,
  job.observed_latency_ms,
  job.observed_batch_hash,
  job.error_message
FROM public.governance_public_audit_verifier_mirror_probe_jobs AS job
JOIN public.governance_public_audit_verifier_mirrors AS mirror
  ON mirror.id = job.mirror_id
WHERE requested_batch_id IS NULL
   OR job.batch_id = requested_batch_id
ORDER BY
  CASE
    WHEN job.status = 'pending' THEN 0
    WHEN job.status = 'running' THEN 1
    WHEN job.status = 'failed' THEN 2
    WHEN job.status = 'completed' THEN 3
    ELSE 4
  END,
  job.scheduled_at DESC,
  job.created_at DESC
LIMIT greatest(1, coalesce(max_jobs, 120));
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_public_audit_verifier_mirror_probe_job_summary(
  requested_batch_id uuid DEFAULT NULL,
  requested_pending_sla_minutes integer DEFAULT 30,
  requested_lookback_hours integer DEFAULT 24
)
RETURNS TABLE (
  batch_id uuid,
  pending_sla_minutes integer,
  lookback_hours integer,
  pending_count integer,
  running_count integer,
  stale_pending_count integer,
  failed_lookback_count integer,
  completed_lookback_count integer,
  oldest_pending_at timestamptz,
  pending_sla_met boolean
) AS $$
WITH config AS (
  SELECT
    greatest(1, coalesce(requested_pending_sla_minutes, 30))::integer AS pending_sla_minutes,
    greatest(1, coalesce(requested_lookback_hours, 24))::integer AS lookback_hours
),
resolved_batch AS (
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
scoped_jobs AS (
  SELECT job.*
  FROM public.governance_public_audit_verifier_mirror_probe_jobs AS job
  CROSS JOIN resolved_batch
  WHERE resolved_batch.batch_id IS NULL
     OR job.batch_id = resolved_batch.batch_id
),
pending_jobs AS (
  SELECT job.scheduled_at
  FROM scoped_jobs AS job
  WHERE job.status IN ('pending', 'running')
)
SELECT
  resolved_batch.batch_id,
  config.pending_sla_minutes,
  config.lookback_hours,
  coalesce(count(*) FILTER (WHERE job.status = 'pending'), 0)::integer AS pending_count,
  coalesce(count(*) FILTER (WHERE job.status = 'running'), 0)::integer AS running_count,
  coalesce(count(*) FILTER (
    WHERE job.status IN ('pending', 'running')
      AND job.scheduled_at < (now() - make_interval(mins => config.pending_sla_minutes))
  ), 0)::integer AS stale_pending_count,
  coalesce(count(*) FILTER (
    WHERE job.status = 'failed'
      AND job.completed_at >= (now() - make_interval(hours => config.lookback_hours))
  ), 0)::integer AS failed_lookback_count,
  coalesce(count(*) FILTER (
    WHERE job.status = 'completed'
      AND job.completed_at >= (now() - make_interval(hours => config.lookback_hours))
  ), 0)::integer AS completed_lookback_count,
  min(pending_jobs.scheduled_at) AS oldest_pending_at,
  coalesce(count(*) FILTER (
    WHERE job.status IN ('pending', 'running')
      AND job.scheduled_at < (now() - make_interval(mins => config.pending_sla_minutes))
  ), 0) = 0 AS pending_sla_met
FROM scoped_jobs AS job
CROSS JOIN config
CROSS JOIN resolved_batch
LEFT JOIN pending_jobs ON true
GROUP BY resolved_batch.batch_id, config.pending_sla_minutes, config.lookback_hours;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.schedule_governance_public_audit_verifier_mirror_probe_jobs(
  target_batch_id uuid DEFAULT NULL,
  force_reschedule boolean DEFAULT false,
  requested_timeout_ms integer DEFAULT 8000
)
RETURNS integer AS $$
DECLARE
  resolved_batch_id uuid;
  inserted_count integer := 0;
  normalized_timeout_ms integer;
  mirror_record RECORD;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to schedule verifier mirror probe jobs';
  END IF;

  SELECT coalesce(
    target_batch_id,
    (
      SELECT batch.id
      FROM public.governance_public_audit_batches AS batch
      ORDER BY batch.batch_index DESC
      LIMIT 1
    )
  )
  INTO resolved_batch_id;

  normalized_timeout_ms := greatest(100, least(120000, coalesce(requested_timeout_ms, 8000)));

  IF force_reschedule THEN
    UPDATE public.governance_public_audit_verifier_mirror_probe_jobs AS job
    SET
      status = 'cancelled',
      completed_at = now(),
      error_message = coalesce(job.error_message, 'rescheduled'),
      completed_by = public.current_profile_id(),
      metadata = coalesce(job.metadata, '{}'::jsonb) || jsonb_build_object('rescheduled_at', now())
    WHERE job.status IN ('pending', 'running')
      AND (
        (resolved_batch_id IS NULL AND job.batch_id IS NULL)
        OR job.batch_id = resolved_batch_id
      );
  END IF;

  FOR mirror_record IN
    SELECT mirror.id
    FROM public.governance_public_audit_verifier_mirrors AS mirror
    WHERE mirror.is_active = true
    ORDER BY mirror.created_at ASC
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.governance_public_audit_verifier_mirror_probe_jobs AS job
      WHERE job.mirror_id = mirror_record.id
        AND (
          (resolved_batch_id IS NULL AND job.batch_id IS NULL)
          OR job.batch_id = resolved_batch_id
        )
        AND job.status IN ('pending', 'running')
    ) THEN
      INSERT INTO public.governance_public_audit_verifier_mirror_probe_jobs (
        mirror_id,
        batch_id,
        status,
        scheduled_at,
        max_attempts,
        probe_timeout_ms,
        metadata,
        created_by
      )
      VALUES (
        mirror_record.id,
        resolved_batch_id,
        'pending',
        now(),
        3,
        normalized_timeout_ms,
        jsonb_build_object('source', 'schedule_governance_public_audit_verifier_mirror_probe_jobs'),
        public.current_profile_id()
      );

      inserted_count := inserted_count + 1;
    END IF;
  END LOOP;

  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.complete_governance_public_audit_verifier_mirror_probe_job(
  target_job_id uuid,
  completion_status text,
  mirror_check_status text DEFAULT NULL,
  observed_latency_ms integer DEFAULT NULL,
  observed_batch_hash text DEFAULT NULL,
  error_message text DEFAULT NULL,
  metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  job_record public.governance_public_audit_verifier_mirror_probe_jobs%ROWTYPE;
  normalized_completion_status text;
  normalized_check_status text;
  resolved_error_message text;
  policy_record RECORD;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to complete verifier mirror probe jobs';
  END IF;

  normalized_completion_status := lower(btrim(coalesce(completion_status, '')));
  IF normalized_completion_status NOT IN ('completed', 'failed', 'cancelled') THEN
    RAISE EXCEPTION 'Completion status must be completed, failed, or cancelled';
  END IF;

  SELECT *
  INTO job_record
  FROM public.governance_public_audit_verifier_mirror_probe_jobs AS job
  WHERE job.id = target_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Verifier mirror probe job not found';
  END IF;

  IF job_record.status NOT IN ('pending', 'running') THEN
    RAISE EXCEPTION 'Verifier mirror probe job is already finalized';
  END IF;

  SELECT *
  INTO policy_record
  FROM public.governance_public_audit_verifier_mirror_failover_policy_summary('default')
  LIMIT 1;

  normalized_check_status := lower(coalesce(nullif(btrim(coalesce(mirror_check_status, '')), ''), ''));
  IF normalized_check_status NOT IN ('ok', 'degraded', 'failed') THEN
    normalized_check_status := NULL;
  END IF;

  IF normalized_completion_status = 'completed' THEN
    IF normalized_check_status IS NULL THEN
      IF observed_latency_ms IS NOT NULL
         AND observed_latency_ms > coalesce(policy_record.max_mirror_latency_ms, 2500)
      THEN
        normalized_check_status := 'degraded';
      ELSE
        normalized_check_status := 'ok';
      END IF;
    END IF;
  ELSIF normalized_completion_status = 'failed' THEN
    normalized_check_status := 'failed';
  ELSE
    normalized_check_status := NULL;
  END IF;

  resolved_error_message := nullif(btrim(coalesce(error_message, '')), '');

  UPDATE public.governance_public_audit_verifier_mirror_probe_jobs
  SET
    status = normalized_completion_status,
    started_at = coalesce(job_record.started_at, now()),
    completed_at = now(),
    attempt_count = greatest(0, coalesce(job_record.attempt_count, 0)) + 1,
    observed_check_status = normalized_check_status,
    observed_latency_ms = CASE
      WHEN normalized_completion_status = 'completed' THEN observed_latency_ms
      ELSE NULL
    END,
    observed_batch_hash = CASE
      WHEN normalized_completion_status = 'completed' THEN nullif(btrim(coalesce(observed_batch_hash, '')), '')
      ELSE NULL
    END,
    error_message = CASE
      WHEN normalized_completion_status = 'completed' THEN resolved_error_message
      ELSE coalesce(resolved_error_message, 'probe failed')
    END,
    completed_by = public.current_profile_id(),
    metadata = coalesce(job_record.metadata, '{}'::jsonb)
      || coalesce(metadata, '{}'::jsonb)
      || jsonb_build_object('completed_at', now())
  WHERE id = job_record.id;

  IF normalized_completion_status = 'completed' THEN
    PERFORM public.record_governance_public_audit_verifier_mirror_check(
      job_record.mirror_id,
      coalesce(normalized_check_status, 'ok'),
      job_record.batch_id,
      observed_latency_ms,
      nullif(btrim(coalesce(observed_batch_hash, '')), ''),
      resolved_error_message,
      coalesce(metadata, '{}'::jsonb)
        || jsonb_build_object('probe_job_id', job_record.id, 'source', 'complete_governance_public_audit_verifier_mirror_probe_job')
    );
  ELSIF normalized_completion_status = 'failed' THEN
    PERFORM public.record_governance_public_audit_verifier_mirror_check(
      job_record.mirror_id,
      'failed',
      job_record.batch_id,
      NULL,
      nullif(btrim(coalesce(observed_batch_hash, '')), ''),
      coalesce(resolved_error_message, 'probe failed'),
      coalesce(metadata, '{}'::jsonb)
        || jsonb_build_object('probe_job_id', job_record.id, 'source', 'complete_governance_public_audit_verifier_mirror_probe_job')
    );
  END IF;

  RETURN job_record.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.publish_governance_public_audit_verifier_mirror_directory(
  signer_key text,
  signature text,
  target_batch_id uuid DEFAULT NULL,
  signature_algorithm text DEFAULT 'ed25519',
  metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  resolved_signer_record public.governance_public_audit_verifier_mirror_directory_signers%ROWTYPE;
  bundle_record RECORD;
  payload jsonb;
  directory_hash text;
  inserted_id uuid;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to publish verifier mirror directories';
  END IF;

  SELECT *
  INTO resolved_signer_record
  FROM public.governance_public_audit_verifier_mirror_directory_signers AS signer
  WHERE signer.signer_key = btrim(coalesce(signer_key, ''))
    AND signer.is_active = true
  ORDER BY signer.updated_at DESC, signer.created_at DESC, signer.id DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mirror directory signer not found or inactive';
  END IF;

  SELECT *
  INTO bundle_record
  FROM public.governance_public_audit_client_verifier_bundle(target_batch_id, 16)
  LIMIT 1;

  payload := jsonb_build_object(
    'directory_version', 'public_audit_verifier_mirror_directory_v1',
    'generated_at', now(),
    'batch_id', bundle_record.bundle_payload #>> '{batch,id}',
    'bundle_hash', bundle_record.bundle_hash,
    'bundle_payload', bundle_record.bundle_payload
  );

  directory_hash := encode(
    digest((payload::text)::bytea, 'sha256'),
    'hex'
  );

  INSERT INTO public.governance_public_audit_verifier_mirror_directories (
    batch_id,
    directory_version,
    directory_hash,
    directory_payload,
    signer_id,
    signer_key,
    signature,
    signature_algorithm,
    metadata,
    published_by,
    published_at
  )
  VALUES (
    nullif(bundle_record.bundle_payload #>> '{batch,id}', '')::uuid,
    'public_audit_verifier_mirror_directory_v1',
    directory_hash,
    payload,
    resolved_signer_record.id,
    resolved_signer_record.signer_key,
    btrim(coalesce(signature, '')),
    lower(coalesce(nullif(btrim(coalesce(signature_algorithm, '')), ''), 'ed25519')),
    coalesce(metadata, '{}'::jsonb),
    public.current_profile_id(),
    now()
  )
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_public_audit_client_verifier_bundle(
  target_batch_id uuid DEFAULT NULL,
  max_mirrors integer DEFAULT 8
)
RETURNS TABLE (
  bundle_version text,
  bundle_hash text,
  bundle_payload jsonb,
  healthy_mirror_count integer,
  quorum_met boolean
) AS $$
WITH resolved_batch AS (
  SELECT coalesce(
    target_batch_id,
    (
      SELECT batch.id
      FROM public.governance_public_audit_batches AS batch
      ORDER BY batch.batch_index DESC
      LIMIT 1
    )
  ) AS batch_id
),
failover_policy AS (
  SELECT *
  FROM public.governance_public_audit_verifier_mirror_failover_policy_summary('default')
),
fallback_failover_policy AS (
  SELECT
    NULL::uuid AS policy_id,
    'default'::text AS policy_key,
    'Default mirror failover policy'::text AS policy_name,
    true AS is_active,
    1::integer AS min_healthy_mirrors,
    2500::integer AS max_mirror_latency_ms,
    2::integer AS max_failures_before_cooldown,
    10::integer AS cooldown_minutes,
    false AS prefer_same_region,
    1::integer AS required_distinct_regions,
    1::integer AS required_distinct_operators,
    'health_latency_diversity'::text AS mirror_selection_strategy,
    8::integer AS max_mirror_candidates,
    now()::timestamptz AS updated_at
  WHERE NOT EXISTS (SELECT 1 FROM failover_policy)
),
effective_failover_policy AS (
  SELECT * FROM failover_policy
  UNION ALL
  SELECT * FROM fallback_failover_policy
),
batch_snapshot AS (
  SELECT
    batch.id,
    batch.batch_index,
    batch.batch_hash,
    batch.previous_batch_hash,
    batch.created_at,
    batch.anchored_at,
    batch.anchor_network,
    batch.anchor_reference,
    batch.anchor_proof
  FROM public.governance_public_audit_batches AS batch
  JOIN resolved_batch ON resolved_batch.batch_id = batch.id
),
verifier_summary AS (
  SELECT *
  FROM public.governance_public_audit_batch_verifier_summary((SELECT batch_id FROM resolved_batch))
),
mirror_health AS (
  SELECT *
  FROM public.governance_public_audit_verifier_mirror_health_summary((SELECT batch_id FROM resolved_batch), 90)
  WHERE is_active = true
),
ranked_mirrors AS (
  SELECT
    mirror.*,
    CASE
      WHEN mirror.health_status = 'healthy' THEN 0
      WHEN mirror.health_status = 'degraded' THEN 1
      WHEN mirror.health_status = 'unknown' THEN 2
      ELSE 3
    END AS health_rank,
    CASE
      WHEN mirror.last_check_latency_ms IS NULL THEN 2147483647
      ELSE mirror.last_check_latency_ms
    END AS latency_rank,
    row_number() OVER (
      ORDER BY
        CASE
          WHEN mirror.health_status = 'healthy' THEN 0
          WHEN mirror.health_status = 'degraded' THEN 1
          WHEN mirror.health_status = 'unknown' THEN 2
          ELSE 3
        END,
        mirror.is_stale,
        CASE
          WHEN mirror.last_check_latency_ms IS NULL THEN 2147483647
          ELSE mirror.last_check_latency_ms
        END,
        mirror.region_code,
        mirror.operator_label,
        mirror.mirror_key
    ) AS failover_rank
  FROM mirror_health AS mirror
),
selected_mirrors AS (
  SELECT *
  FROM ranked_mirrors
  ORDER BY failover_rank
  LIMIT greatest(
    1,
    least(
      coalesce(max_mirrors, 8),
      coalesce((SELECT max_mirror_candidates FROM effective_failover_policy LIMIT 1), 8)
    )
  )
),
network_proofs AS (
  SELECT
    proof.id,
    proof.network,
    proof.proof_reference,
    proof.block_height,
    proof.recorded_at
  FROM public.governance_public_audit_network_proofs AS proof
  JOIN resolved_batch ON resolved_batch.batch_id = proof.batch_id
  ORDER BY proof.recorded_at DESC, proof.created_at DESC
),
latest_directory AS (
  SELECT
    directory.id,
    directory.batch_id,
    directory.directory_hash,
    directory.signer_key,
    signer.signer_label,
    signer.trust_tier,
    directory.signature,
    directory.signature_algorithm,
    directory.published_at
  FROM public.governance_public_audit_verifier_mirror_directories AS directory
  LEFT JOIN public.governance_public_audit_verifier_mirror_directory_signers AS signer
    ON signer.id = directory.signer_id
  WHERE resolved_batch.batch_id IS NULL
     OR directory.batch_id = resolved_batch.batch_id
  ORDER BY directory.published_at DESC, directory.created_at DESC
  LIMIT 1
),
payload_cte AS (
  SELECT jsonb_build_object(
    'bundle_version', 'public_audit_client_verifier_bundle_v1',
    'generated_at', now(),
    'batch', coalesce((SELECT to_jsonb(row_data) FROM batch_snapshot AS row_data), '{}'::jsonb),
    'verifier_summary', coalesce((SELECT to_jsonb(row_data) FROM verifier_summary AS row_data), '{}'::jsonb),
    'mirrors', coalesce((
      SELECT jsonb_agg(
        to_jsonb(row_data)
        ORDER BY row_data.failover_rank ASC
      )
      FROM selected_mirrors AS row_data
    ), '[]'::jsonb),
    'failover_policy', coalesce((SELECT to_jsonb(row_data) FROM effective_failover_policy AS row_data LIMIT 1), '{}'::jsonb),
    'failover_order', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'mirror_id', row_data.mirror_id,
          'mirror_key', row_data.mirror_key,
          'mirror_label', row_data.mirror_label,
          'region_code', row_data.region_code,
          'operator_label', row_data.operator_label,
          'health_status', row_data.health_status,
          'last_check_latency_ms', row_data.last_check_latency_ms,
          'failover_rank', row_data.failover_rank
        )
        ORDER BY row_data.failover_rank ASC
      )
      FROM selected_mirrors AS row_data
    ), '[]'::jsonb),
    'network_proofs', coalesce((
      SELECT jsonb_agg(to_jsonb(row_data) ORDER BY row_data.recorded_at DESC, row_data.id DESC)
      FROM network_proofs AS row_data
    ), '[]'::jsonb),
    'signed_directory', coalesce((
      SELECT to_jsonb(row_data)
      FROM latest_directory AS row_data
      LIMIT 1
    ), '{}'::jsonb)
  ) AS bundle_payload
),
healthy_mirror_count_cte AS (
  SELECT coalesce(count(*) FILTER (WHERE mirror.health_status = 'healthy'), 0)::integer AS healthy_mirror_count
  FROM selected_mirrors AS mirror
)
SELECT
  'public_audit_client_verifier_bundle_v1'::text AS bundle_version,
  encode(
    digest(
      (payload_cte.bundle_payload::text)::bytea,
      'sha256'
    ),
    'hex'
  ) AS bundle_hash,
  payload_cte.bundle_payload,
  coalesce(healthy_mirror_count_cte.healthy_mirror_count, 0) AS healthy_mirror_count,
  (
    coalesce((payload_cte.bundle_payload #>> '{verifier_summary,meets_replication_threshold}')::boolean, false)
    AND coalesce(healthy_mirror_count_cte.healthy_mirror_count, 0)
      >= greatest(1, coalesce((payload_cte.bundle_payload #>> '{failover_policy,min_healthy_mirrors}')::integer, 1))
  ) AS quorum_met
FROM payload_cte
CROSS JOIN healthy_mirror_count_cte;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

GRANT SELECT, INSERT, UPDATE ON public.governance_public_audit_verifier_mirror_directory_signers TO authenticated;
GRANT SELECT, INSERT ON public.governance_public_audit_verifier_mirror_directories TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.governance_public_audit_verifier_mirror_failover_policies TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.governance_public_audit_verifier_mirror_probe_jobs TO authenticated;

GRANT EXECUTE ON FUNCTION public.register_governance_public_audit_verifier_mirror_directory_signer(text, text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_governance_public_audit_verifier_mirror_failover_policy(text, text, boolean, integer, integer, integer, integer, boolean, integer, integer, text, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_verifier_mirror_failover_policy_summary(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_verifier_mirror_directory_summary(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_verifier_mirror_probe_job_board(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_verifier_mirror_probe_job_summary(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_governance_public_audit_verifier_mirror_probe_jobs(uuid, boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_governance_public_audit_verifier_mirror_probe_job(uuid, text, text, integer, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_governance_public_audit_verifier_mirror_directory(text, text, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_client_verifier_bundle(uuid, integer) TO authenticated;

ALTER TABLE public.governance_public_audit_verifier_mirror_directory_signers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_public_audit_verifier_mirror_directories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_public_audit_verifier_mirror_failover_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_public_audit_verifier_mirror_probe_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Verifier mirror directory signers are readable by authenticated users" ON public.governance_public_audit_verifier_mirror_directory_signers;
CREATE POLICY "Verifier mirror directory signers are readable by authenticated users" ON public.governance_public_audit_verifier_mirror_directory_signers
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Verifier mirror directory signers are manageable by verifier stewards" ON public.governance_public_audit_verifier_mirror_directory_signers;
CREATE POLICY "Verifier mirror directory signers are manageable by verifier stewards" ON public.governance_public_audit_verifier_mirror_directory_signers
  FOR ALL USING (public.current_profile_can_manage_public_audit_verifiers())
  WITH CHECK (public.current_profile_can_manage_public_audit_verifiers());

DROP POLICY IF EXISTS "Verifier mirror directories are readable by authenticated users" ON public.governance_public_audit_verifier_mirror_directories;
CREATE POLICY "Verifier mirror directories are readable by authenticated users" ON public.governance_public_audit_verifier_mirror_directories
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Verifier mirror directories are insertable by verifier stewards" ON public.governance_public_audit_verifier_mirror_directories;
CREATE POLICY "Verifier mirror directories are insertable by verifier stewards" ON public.governance_public_audit_verifier_mirror_directories
  FOR INSERT WITH CHECK (public.current_profile_can_manage_public_audit_verifiers());

DROP POLICY IF EXISTS "Verifier mirror failover policies are readable by authenticated users" ON public.governance_public_audit_verifier_mirror_failover_policies;
CREATE POLICY "Verifier mirror failover policies are readable by authenticated users" ON public.governance_public_audit_verifier_mirror_failover_policies
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Verifier mirror failover policies are manageable by verifier stewards" ON public.governance_public_audit_verifier_mirror_failover_policies;
CREATE POLICY "Verifier mirror failover policies are manageable by verifier stewards" ON public.governance_public_audit_verifier_mirror_failover_policies
  FOR ALL USING (public.current_profile_can_manage_public_audit_verifiers())
  WITH CHECK (public.current_profile_can_manage_public_audit_verifiers());

DROP POLICY IF EXISTS "Verifier mirror probe jobs are readable by authenticated users" ON public.governance_public_audit_verifier_mirror_probe_jobs;
CREATE POLICY "Verifier mirror probe jobs are readable by authenticated users" ON public.governance_public_audit_verifier_mirror_probe_jobs
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Verifier mirror probe jobs are manageable by verifier stewards" ON public.governance_public_audit_verifier_mirror_probe_jobs;
CREATE POLICY "Verifier mirror probe jobs are manageable by verifier stewards" ON public.governance_public_audit_verifier_mirror_probe_jobs
  FOR ALL USING (public.current_profile_can_manage_public_audit_verifiers())
  WITH CHECK (public.current_profile_can_manage_public_audit_verifiers());
