ALTER TABLE public.governance_public_audit_anchor_execution_jobs
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS claim_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS claimed_by text;

ALTER TABLE public.governance_public_audit_verifier_jobs
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS claim_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS claimed_by text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'governance_public_audit_anchor_execution_jobs_attempt_count_check'
  ) THEN
    ALTER TABLE public.governance_public_audit_anchor_execution_jobs
      ADD CONSTRAINT governance_public_audit_anchor_execution_jobs_attempt_count_check
      CHECK (attempt_count >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'governance_public_audit_anchor_execution_jobs_max_attempts_check'
  ) THEN
    ALTER TABLE public.governance_public_audit_anchor_execution_jobs
      ADD CONSTRAINT governance_public_audit_anchor_execution_jobs_max_attempts_check
      CHECK (max_attempts >= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'governance_public_audit_anchor_execution_jobs_claimed_by_not_empty_check'
  ) THEN
    ALTER TABLE public.governance_public_audit_anchor_execution_jobs
      ADD CONSTRAINT governance_public_audit_anchor_execution_jobs_claimed_by_not_empty_check
      CHECK (claimed_by IS NULL OR length(trim(claimed_by)) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'governance_public_audit_verifier_jobs_attempt_count_check'
  ) THEN
    ALTER TABLE public.governance_public_audit_verifier_jobs
      ADD CONSTRAINT governance_public_audit_verifier_jobs_attempt_count_check
      CHECK (attempt_count >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'governance_public_audit_verifier_jobs_max_attempts_check'
  ) THEN
    ALTER TABLE public.governance_public_audit_verifier_jobs
      ADD CONSTRAINT governance_public_audit_verifier_jobs_max_attempts_check
      CHECK (max_attempts >= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'governance_public_audit_verifier_jobs_claimed_by_not_empty_check'
  ) THEN
    ALTER TABLE public.governance_public_audit_verifier_jobs
      ADD CONSTRAINT governance_public_audit_verifier_jobs_claimed_by_not_empty_check
      CHECK (claimed_by IS NULL OR length(trim(claimed_by)) > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_anchor_execution_jobs_pending_ready
  ON public.governance_public_audit_anchor_execution_jobs (status, next_attempt_at, scheduled_at, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_anchor_execution_jobs_claim_expiry
  ON public.governance_public_audit_anchor_execution_jobs (status, claim_expires_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_verifier_jobs_pending_ready
  ON public.governance_public_audit_verifier_jobs (status, next_attempt_at, scheduled_at, created_at)
  WHERE status = 'pending'::public.governance_public_audit_verifier_job_status;

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_verifier_jobs_claim_expiry
  ON public.governance_public_audit_verifier_jobs (status, claim_expires_at)
  WHERE status = 'pending'::public.governance_public_audit_verifier_job_status;

CREATE TABLE IF NOT EXISTS public.governance_public_audit_external_execution_policies (
  policy_key text PRIMARY KEY,
  policy_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  claim_ttl_minutes integer NOT NULL DEFAULT 10,
  anchor_max_attempts integer NOT NULL DEFAULT 5,
  verifier_max_attempts integer NOT NULL DEFAULT 5,
  retry_base_delay_minutes integer NOT NULL DEFAULT 5,
  retry_max_delay_minutes integer NOT NULL DEFAULT 120,
  paging_enabled boolean NOT NULL DEFAULT true,
  paging_stale_pending_minutes integer NOT NULL DEFAULT 30,
  paging_failure_share_percent numeric(5,2) NOT NULL DEFAULT 25,
  oncall_channel text NOT NULL DEFAULT 'public_audit_ops',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_public_audit_external_execution_policies_policy_key_not_empty_check CHECK (
    length(trim(policy_key)) > 0
  ),
  CONSTRAINT governance_public_audit_external_execution_policies_policy_name_not_empty_check CHECK (
    length(trim(policy_name)) > 0
  ),
  CONSTRAINT governance_public_audit_external_execution_policies_claim_ttl_minutes_check CHECK (
    claim_ttl_minutes >= 1
  ),
  CONSTRAINT governance_public_audit_external_execution_policies_anchor_max_attempts_check CHECK (
    anchor_max_attempts >= 1
  ),
  CONSTRAINT governance_public_audit_external_execution_policies_verifier_max_attempts_check CHECK (
    verifier_max_attempts >= 1
  ),
  CONSTRAINT governance_public_audit_external_execution_policies_retry_base_delay_minutes_check CHECK (
    retry_base_delay_minutes >= 1
  ),
  CONSTRAINT governance_public_audit_external_execution_policies_retry_max_delay_minutes_check CHECK (
    retry_max_delay_minutes >= retry_base_delay_minutes
  ),
  CONSTRAINT governance_public_audit_external_execution_policies_paging_stale_pending_minutes_check CHECK (
    paging_stale_pending_minutes >= 1
  ),
  CONSTRAINT governance_public_audit_external_execution_policies_paging_failure_share_percent_check CHECK (
    paging_failure_share_percent >= 0
    AND paging_failure_share_percent <= 100
  ),
  CONSTRAINT governance_public_audit_external_execution_policies_oncall_channel_not_empty_check CHECK (
    length(trim(oncall_channel)) > 0
  ),
  CONSTRAINT governance_public_audit_external_execution_policies_metadata_object_check CHECK (
    jsonb_typeof(metadata) = 'object'
  )
);

CREATE TABLE IF NOT EXISTS public.governance_public_audit_external_execution_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES public.governance_public_audit_batches(id) ON DELETE CASCADE,
  page_key text NOT NULL,
  severity text NOT NULL,
  page_status text NOT NULL DEFAULT 'open',
  page_message text NOT NULL,
  oncall_channel text NOT NULL,
  page_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  opened_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_public_audit_external_execution_pages_page_key_not_empty_check CHECK (
    length(trim(page_key)) > 0
  ),
  CONSTRAINT governance_public_audit_external_execution_pages_severity_check CHECK (
    severity IN ('info', 'warning', 'critical')
  ),
  CONSTRAINT governance_public_audit_external_execution_pages_status_check CHECK (
    page_status IN ('open', 'acknowledged', 'resolved')
  ),
  CONSTRAINT governance_public_audit_external_execution_pages_message_not_empty_check CHECK (
    length(trim(page_message)) > 0
  ),
  CONSTRAINT governance_public_audit_external_execution_pages_oncall_channel_not_empty_check CHECK (
    length(trim(oncall_channel)) > 0
  ),
  CONSTRAINT governance_public_audit_external_execution_pages_payload_object_check CHECK (
    jsonb_typeof(page_payload) = 'object'
  ),
  CONSTRAINT governance_public_audit_external_execution_pages_batch_key_unique UNIQUE (batch_id, page_key)
);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_external_execution_policies_active
  ON public.governance_public_audit_external_execution_policies (is_active, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_external_execution_pages_batch_status
  ON public.governance_public_audit_external_execution_pages (batch_id, page_status, severity, opened_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_external_execution_pages_status
  ON public.governance_public_audit_external_execution_pages (page_status, severity, opened_at DESC);

DO $$
BEGIN
  CREATE TRIGGER update_governance_public_audit_external_execution_policies_updated_at
    BEFORE UPDATE ON public.governance_public_audit_external_execution_policies
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_governance_public_audit_external_execution_pages_updated_at
    BEFORE UPDATE ON public.governance_public_audit_external_execution_pages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO public.governance_public_audit_external_execution_policies (
  policy_key,
  policy_name,
  is_active,
  claim_ttl_minutes,
  anchor_max_attempts,
  verifier_max_attempts,
  retry_base_delay_minutes,
  retry_max_delay_minutes,
  paging_enabled,
  paging_stale_pending_minutes,
  paging_failure_share_percent,
  oncall_channel,
  metadata,
  updated_by
)
VALUES (
  'default',
  'Default external execution policy',
  true,
  10,
  5,
  5,
  5,
  120,
  true,
  30,
  25,
  'public_audit_ops',
  jsonb_build_object('source', 'external_execution_policy_bootstrap'),
  public.current_profile_id()
)
ON CONFLICT (policy_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.governance_public_audit_retry_backoff_minutes(
  requested_attempt_count integer,
  requested_base_delay_minutes integer,
  requested_max_delay_minutes integer
)
RETURNS integer AS $$
DECLARE
  safe_attempt integer := greatest(1, coalesce(requested_attempt_count, 1));
  safe_base integer := greatest(1, coalesce(requested_base_delay_minutes, 5));
  safe_max integer := greatest(safe_base, coalesce(requested_max_delay_minutes, 120));
  computed numeric;
BEGIN
  computed := safe_base::numeric * power(2::numeric, greatest(0, safe_attempt - 1));
  RETURN least(safe_max, greatest(safe_base, ceil(computed)::integer));
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_public_audit_external_execution_policy_summary(
  requested_policy_key text DEFAULT 'default'
)
RETURNS TABLE (
  policy_key text,
  policy_name text,
  is_active boolean,
  claim_ttl_minutes integer,
  anchor_max_attempts integer,
  verifier_max_attempts integer,
  retry_base_delay_minutes integer,
  retry_max_delay_minutes integer,
  paging_enabled boolean,
  paging_stale_pending_minutes integer,
  paging_failure_share_percent numeric,
  oncall_channel text,
  updated_at timestamptz
) AS $$
SELECT
  policy.policy_key,
  policy.policy_name,
  policy.is_active,
  policy.claim_ttl_minutes,
  policy.anchor_max_attempts,
  policy.verifier_max_attempts,
  policy.retry_base_delay_minutes,
  policy.retry_max_delay_minutes,
  policy.paging_enabled,
  policy.paging_stale_pending_minutes,
  policy.paging_failure_share_percent,
  policy.oncall_channel,
  policy.updated_at
FROM public.governance_public_audit_external_execution_policies AS policy
WHERE policy.policy_key = coalesce(nullif(btrim(coalesce(requested_policy_key, '')), ''), 'default')
LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.set_governance_public_audit_external_execution_policy(
  requested_policy_key text DEFAULT 'default',
  requested_policy_name text DEFAULT 'Default external execution policy',
  requested_is_active boolean DEFAULT true,
  requested_claim_ttl_minutes integer DEFAULT 10,
  requested_anchor_max_attempts integer DEFAULT 5,
  requested_verifier_max_attempts integer DEFAULT 5,
  requested_retry_base_delay_minutes integer DEFAULT 5,
  requested_retry_max_delay_minutes integer DEFAULT 120,
  requested_paging_enabled boolean DEFAULT true,
  requested_paging_stale_pending_minutes integer DEFAULT 30,
  requested_paging_failure_share_percent numeric DEFAULT 25,
  requested_oncall_channel text DEFAULT 'public_audit_ops',
  metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS text AS $$
DECLARE
  normalized_policy_key text;
  normalized_policy_name text;
  normalized_oncall_channel text;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to manage public audit external execution policies';
  END IF;

  normalized_policy_key := lower(coalesce(nullif(btrim(coalesce(requested_policy_key, '')), ''), 'default'));
  normalized_policy_name := coalesce(nullif(btrim(coalesce(requested_policy_name, '')), ''), 'Default external execution policy');
  normalized_oncall_channel := coalesce(nullif(btrim(coalesce(requested_oncall_channel, '')), ''), 'public_audit_ops');

  IF coalesce(requested_claim_ttl_minutes, 0) < 1 THEN
    RAISE EXCEPTION 'Claim TTL minutes must be at least 1';
  END IF;

  IF coalesce(requested_anchor_max_attempts, 0) < 1 THEN
    RAISE EXCEPTION 'Anchor max attempts must be at least 1';
  END IF;

  IF coalesce(requested_verifier_max_attempts, 0) < 1 THEN
    RAISE EXCEPTION 'Verifier max attempts must be at least 1';
  END IF;

  IF coalesce(requested_retry_base_delay_minutes, 0) < 1 THEN
    RAISE EXCEPTION 'Retry base delay minutes must be at least 1';
  END IF;

  IF coalesce(requested_retry_max_delay_minutes, 0) < coalesce(requested_retry_base_delay_minutes, 1) THEN
    RAISE EXCEPTION 'Retry max delay minutes must be greater than or equal to retry base delay minutes';
  END IF;

  IF coalesce(requested_paging_stale_pending_minutes, 0) < 1 THEN
    RAISE EXCEPTION 'Paging stale pending minutes must be at least 1';
  END IF;

  IF coalesce(requested_paging_failure_share_percent, -1) < 0
     OR coalesce(requested_paging_failure_share_percent, 101) > 100
  THEN
    RAISE EXCEPTION 'Paging failure share threshold percent must be between 0 and 100';
  END IF;

  INSERT INTO public.governance_public_audit_external_execution_policies (
    policy_key,
    policy_name,
    is_active,
    claim_ttl_minutes,
    anchor_max_attempts,
    verifier_max_attempts,
    retry_base_delay_minutes,
    retry_max_delay_minutes,
    paging_enabled,
    paging_stale_pending_minutes,
    paging_failure_share_percent,
    oncall_channel,
    metadata,
    updated_by
  )
  VALUES (
    normalized_policy_key,
    normalized_policy_name,
    coalesce(requested_is_active, true),
    greatest(1, coalesce(requested_claim_ttl_minutes, 10)),
    greatest(1, coalesce(requested_anchor_max_attempts, 5)),
    greatest(1, coalesce(requested_verifier_max_attempts, 5)),
    greatest(1, coalesce(requested_retry_base_delay_minutes, 5)),
    greatest(
      greatest(1, coalesce(requested_retry_base_delay_minutes, 5)),
      coalesce(requested_retry_max_delay_minutes, 120)
    ),
    coalesce(requested_paging_enabled, true),
    greatest(1, coalesce(requested_paging_stale_pending_minutes, 30)),
    round(coalesce(requested_paging_failure_share_percent, 25)::numeric, 2),
    normalized_oncall_channel,
    coalesce(metadata, '{}'::jsonb),
    public.current_profile_id()
  )
  ON CONFLICT (policy_key) DO UPDATE
    SET policy_name = excluded.policy_name,
        is_active = excluded.is_active,
        claim_ttl_minutes = excluded.claim_ttl_minutes,
        anchor_max_attempts = excluded.anchor_max_attempts,
        verifier_max_attempts = excluded.verifier_max_attempts,
        retry_base_delay_minutes = excluded.retry_base_delay_minutes,
        retry_max_delay_minutes = excluded.retry_max_delay_minutes,
        paging_enabled = excluded.paging_enabled,
        paging_stale_pending_minutes = excluded.paging_stale_pending_minutes,
        paging_failure_share_percent = excluded.paging_failure_share_percent,
        oncall_channel = excluded.oncall_channel,
        metadata = coalesce(public.governance_public_audit_external_execution_policies.metadata, '{}'::jsonb)
          || coalesce(excluded.metadata, '{}'::jsonb),
        updated_by = excluded.updated_by;

  UPDATE public.governance_public_audit_anchor_execution_jobs
  SET max_attempts = greatest(
      1,
      coalesce(
        (
          SELECT policy.anchor_max_attempts
          FROM public.governance_public_audit_external_execution_policies AS policy
          WHERE policy.policy_key = normalized_policy_key
          LIMIT 1
        ),
        max_attempts
      )
    )
  WHERE status = 'pending';

  UPDATE public.governance_public_audit_verifier_jobs
  SET max_attempts = greatest(
      1,
      coalesce(
        (
          SELECT policy.verifier_max_attempts
          FROM public.governance_public_audit_external_execution_policies AS policy
          WHERE policy.policy_key = normalized_policy_key
          LIMIT 1
        ),
        max_attempts
      )
    )
  WHERE status = 'pending'::public.governance_public_audit_verifier_job_status;

  RETURN normalized_policy_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.open_governance_public_audit_external_execution_page(
  target_batch_id uuid,
  page_key text,
  severity text,
  page_message text,
  page_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  policy_record public.governance_public_audit_external_execution_policies%ROWTYPE;
  inserted_id uuid;
  normalized_page_key text;
  normalized_severity text;
  normalized_message text;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to open public audit external execution pages';
  END IF;

  IF target_batch_id IS NULL THEN
    RAISE EXCEPTION 'Target batch id is required';
  END IF;

  normalized_page_key := lower(coalesce(nullif(btrim(coalesce(page_key, '')), ''), 'external_execution_ops'));
  normalized_severity := lower(coalesce(nullif(btrim(coalesce(severity, '')), ''), 'warning'));
  normalized_message := coalesce(nullif(btrim(coalesce(page_message, '')), ''), 'Public audit external execution policy threshold breached');

  IF normalized_severity NOT IN ('info', 'warning', 'critical') THEN
    RAISE EXCEPTION 'Page severity must be info, warning, or critical';
  END IF;

  SELECT policy.*
  INTO policy_record
  FROM public.governance_public_audit_external_execution_policies AS policy
  WHERE policy.policy_key = 'default'
  LIMIT 1;

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
    target_batch_id,
    normalized_page_key,
    normalized_severity,
    'open',
    normalized_message,
    coalesce(policy_record.oncall_channel, 'public_audit_ops'),
    coalesce(page_payload, '{}'::jsonb),
    now(),
    public.current_profile_id()
  )
  ON CONFLICT (batch_id, page_key) DO UPDATE
    SET severity = excluded.severity,
        page_status = 'open',
        page_message = excluded.page_message,
        oncall_channel = excluded.oncall_channel,
        page_payload = coalesce(public.governance_public_audit_external_execution_pages.page_payload, '{}'::jsonb)
          || coalesce(excluded.page_payload, '{}'::jsonb),
        opened_at = now(),
        acknowledged_at = NULL,
        resolved_at = NULL,
        resolved_by = NULL
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.resolve_governance_public_audit_external_execution_page(
  target_page_id uuid,
  resolution_notes text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  page_record public.governance_public_audit_external_execution_pages%ROWTYPE;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to resolve public audit external execution pages';
  END IF;

  SELECT *
  INTO page_record
  FROM public.governance_public_audit_external_execution_pages AS page
  WHERE page.id = target_page_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Public audit external execution page not found';
  END IF;

  UPDATE public.governance_public_audit_external_execution_pages
  SET page_status = 'resolved',
      page_payload = coalesce(page_record.page_payload, '{}'::jsonb)
        || jsonb_build_object(
          'resolution_notes', nullif(btrim(coalesce(resolution_notes, '')), ''),
          'resolved_at', now()
        ),
      resolved_at = now(),
      resolved_by = public.current_profile_id()
  WHERE id = page_record.id;

  RETURN page_record.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.claim_governance_public_audit_external_execution_jobs(
  requested_batch_id uuid DEFAULT NULL,
  requested_anchor_limit integer DEFAULT 6,
  requested_verifier_limit integer DEFAULT 10,
  worker_identity text DEFAULT NULL
)
RETURNS TABLE (
  job_type text,
  job_id uuid,
  batch_id uuid,
  adapter_id uuid,
  verifier_id uuid,
  network text,
  scheduled_at timestamptz,
  attempt_count integer,
  max_attempts integer,
  next_attempt_at timestamptz,
  claimed_at timestamptz,
  claim_expires_at timestamptz
) AS $$
DECLARE
  policy_record public.governance_public_audit_external_execution_policies%ROWTYPE;
  normalized_worker_identity text;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to claim public audit external execution jobs';
  END IF;

  SELECT policy.*
  INTO policy_record
  FROM public.governance_public_audit_external_execution_policies AS policy
  WHERE policy.policy_key = 'default'
  LIMIT 1;

  IF policy_record.policy_key IS NULL THEN
    INSERT INTO public.governance_public_audit_external_execution_policies (
      policy_key,
      policy_name,
      updated_by,
      metadata
    )
    VALUES (
      'default',
      'Default external execution policy',
      public.current_profile_id(),
      jsonb_build_object('source', 'claim_external_execution_jobs_bootstrap')
    )
    ON CONFLICT (policy_key) DO NOTHING;

    SELECT policy.*
    INTO policy_record
    FROM public.governance_public_audit_external_execution_policies AS policy
    WHERE policy.policy_key = 'default'
    LIMIT 1;
  END IF;

  normalized_worker_identity := nullif(btrim(coalesce(worker_identity, '')), '');
  normalized_worker_identity := coalesce(
    normalized_worker_identity,
    concat('profile:', coalesce(public.current_profile_id()::text, 'unknown'))
  );

  RETURN QUERY
  WITH claim_candidates AS (
    SELECT job.id
    FROM public.governance_public_audit_anchor_execution_jobs AS job
    WHERE job.status = 'pending'
      AND (requested_batch_id IS NULL OR job.batch_id = requested_batch_id)
      AND job.next_attempt_at <= now()
      AND (job.claim_expires_at IS NULL OR job.claim_expires_at <= now())
    ORDER BY job.next_attempt_at ASC, job.scheduled_at ASC, job.created_at ASC
    LIMIT greatest(0, coalesce(requested_anchor_limit, 6))
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.governance_public_audit_anchor_execution_jobs AS job
    SET
      started_at = now(),
      claimed_at = now(),
      claim_expires_at = now() + make_interval(mins => greatest(1, coalesce(policy_record.claim_ttl_minutes, 10))),
      claimed_by = normalized_worker_identity,
      attempt_count = greatest(0, coalesce(job.attempt_count, 0)) + 1,
      max_attempts = greatest(1, coalesce(job.max_attempts, policy_record.anchor_max_attempts, 5)),
      metadata = coalesce(job.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'last_claimed_at', now(),
          'last_claimed_by', normalized_worker_identity
        )
    FROM claim_candidates
    WHERE job.id = claim_candidates.id
    RETURNING job.*
  )
  SELECT
    'anchor'::text AS job_type,
    claimed.id AS job_id,
    claimed.batch_id,
    claimed.adapter_id,
    NULL::uuid AS verifier_id,
    claimed.network,
    claimed.scheduled_at,
    claimed.attempt_count,
    claimed.max_attempts,
    claimed.next_attempt_at,
    claimed.claimed_at,
    claimed.claim_expires_at
  FROM claimed;

  RETURN QUERY
  WITH claim_candidates AS (
    SELECT job.id
    FROM public.governance_public_audit_verifier_jobs AS job
    WHERE job.status = 'pending'::public.governance_public_audit_verifier_job_status
      AND (requested_batch_id IS NULL OR job.batch_id = requested_batch_id)
      AND job.next_attempt_at <= now()
      AND (job.claim_expires_at IS NULL OR job.claim_expires_at <= now())
    ORDER BY job.next_attempt_at ASC, job.scheduled_at ASC, job.created_at ASC
    LIMIT greatest(0, coalesce(requested_verifier_limit, 10))
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.governance_public_audit_verifier_jobs AS job
    SET
      started_at = now(),
      claimed_at = now(),
      claim_expires_at = now() + make_interval(mins => greatest(1, coalesce(policy_record.claim_ttl_minutes, 10))),
      claimed_by = normalized_worker_identity,
      attempt_count = greatest(0, coalesce(job.attempt_count, 0)) + 1,
      max_attempts = greatest(1, coalesce(job.max_attempts, policy_record.verifier_max_attempts, 5)),
      metadata = coalesce(job.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'last_claimed_at', now(),
          'last_claimed_by', normalized_worker_identity
        )
    FROM claim_candidates
    WHERE job.id = claim_candidates.id
    RETURNING job.*
  )
  SELECT
    'verifier'::text AS job_type,
    claimed.id AS job_id,
    claimed.batch_id,
    NULL::uuid AS adapter_id,
    claimed.verifier_id,
    NULL::text AS network,
    claimed.scheduled_at,
    claimed.attempt_count,
    claimed.max_attempts,
    claimed.next_attempt_at,
    claimed.claimed_at,
    claimed.claim_expires_at
  FROM claimed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.schedule_governance_public_audit_anchor_execution_jobs(
  target_batch_id uuid DEFAULT NULL,
  force_reschedule boolean DEFAULT false
)
RETURNS integer AS $$
DECLARE
  batch_record record;
  adapter_record record;
  policy_record public.governance_public_audit_external_execution_policies%ROWTYPE;
  inserted_count integer := 0;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to schedule public audit anchor execution jobs';
  END IF;

  SELECT policy.*
  INTO policy_record
  FROM public.governance_public_audit_external_execution_policies AS policy
  WHERE policy.policy_key = 'default'
  LIMIT 1;

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
          error_message = coalesce(job.error_message, 'Rescheduled anchor execution job'),
          claimed_at = NULL,
          claim_expires_at = NULL,
          claimed_by = NULL
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
          attempt_count,
          max_attempts,
          next_attempt_at,
          metadata,
          scheduled_by,
          scheduled_at,
          claimed_at,
          claim_expires_at,
          claimed_by
        )
        VALUES (
          batch_record.id,
          adapter_record.id,
          coalesce(nullif(btrim(coalesce(adapter_record.network, '')), ''), 'external_anchor'),
          'pending',
          0,
          greatest(1, coalesce(policy_record.anchor_max_attempts, 5)),
          now(),
          jsonb_build_object('source', 'automated_anchor_scheduler'),
          public.current_profile_id(),
          now(),
          NULL,
          NULL,
          NULL
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

CREATE OR REPLACE FUNCTION public.schedule_governance_public_audit_verifier_jobs(
  target_batch_id uuid DEFAULT NULL,
  force_reschedule boolean DEFAULT false
)
RETURNS integer AS $$
DECLARE
  batch_record record;
  verifier_record record;
  policy_record public.governance_public_audit_external_execution_policies%ROWTYPE;
  inserted_count integer := 0;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to schedule public audit verifier jobs';
  END IF;

  SELECT policy.*
  INTO policy_record
  FROM public.governance_public_audit_external_execution_policies AS policy
  WHERE policy.policy_key = 'default'
  LIMIT 1;

  FOR batch_record IN
    SELECT batch.id
    FROM public.governance_public_audit_batches AS batch
    WHERE target_batch_id IS NULL OR batch.id = target_batch_id
    ORDER BY batch.batch_index DESC
    LIMIT CASE WHEN target_batch_id IS NULL THEN 3 ELSE 1 END
  LOOP
    FOR verifier_record IN
      SELECT verifier.id
      FROM public.governance_public_audit_verifier_nodes AS verifier
      WHERE verifier.is_active = true
      ORDER BY verifier.created_at ASC
    LOOP
      IF force_reschedule THEN
        UPDATE public.governance_public_audit_verifier_jobs AS job
        SET
          status = 'cancelled'::public.governance_public_audit_verifier_job_status,
          completed_at = coalesce(job.completed_at, now()),
          error_message = coalesce(job.error_message, 'Rescheduled verifier job'),
          claimed_at = NULL,
          claim_expires_at = NULL,
          claimed_by = NULL
        WHERE job.batch_id = batch_record.id
          AND job.verifier_id = verifier_record.id
          AND job.status = 'pending'::public.governance_public_audit_verifier_job_status;
      END IF;

      IF force_reschedule
         OR NOT EXISTS (
           SELECT 1
           FROM public.governance_public_audit_verifier_jobs AS job
           WHERE job.batch_id = batch_record.id
             AND job.verifier_id = verifier_record.id
             AND job.status = 'pending'::public.governance_public_audit_verifier_job_status
         )
      THEN
        INSERT INTO public.governance_public_audit_verifier_jobs (
          batch_id,
          verifier_id,
          status,
          attempt_count,
          max_attempts,
          next_attempt_at,
          metadata,
          scheduled_by,
          scheduled_at,
          claimed_at,
          claim_expires_at,
          claimed_by
        )
        VALUES (
          batch_record.id,
          verifier_record.id,
          'pending'::public.governance_public_audit_verifier_job_status,
          0,
          greatest(1, coalesce(policy_record.verifier_max_attempts, 5)),
          now(),
          jsonb_build_object('source', 'automated_verifier_scheduler'),
          public.current_profile_id(),
          now(),
          NULL,
          NULL,
          NULL
        );
        inserted_count := inserted_count + 1;
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
  proof_payload jsonb DEFAULT '{}'::jsonb,
  retry_on_failure boolean DEFAULT true,
  requested_retry_base_delay_minutes integer DEFAULT NULL,
  requested_retry_max_delay_minutes integer DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  job_record public.governance_public_audit_anchor_execution_jobs%ROWTYPE;
  policy_record public.governance_public_audit_external_execution_policies%ROWTYPE;
  normalized_status text;
  normalized_reference text;
  linked_anchor_id uuid;
  should_retry boolean := false;
  retry_delay_minutes integer := 0;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to complete public audit anchor execution jobs';
  END IF;

  SELECT job.*
  INTO job_record
  FROM public.governance_public_audit_anchor_execution_jobs AS job
  WHERE job.id = target_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Anchor execution job does not exist';
  END IF;

  SELECT policy.*
  INTO policy_record
  FROM public.governance_public_audit_external_execution_policies AS policy
  WHERE policy.policy_key = 'default'
  LIMIT 1;

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

  should_retry := normalized_status = 'failed'
    AND coalesce(retry_on_failure, true)
    AND greatest(0, coalesce(job_record.attempt_count, 0)) < greatest(1, coalesce(job_record.max_attempts, policy_record.anchor_max_attempts, 5));

  IF should_retry THEN
    retry_delay_minutes := public.governance_public_audit_retry_backoff_minutes(
      greatest(1, coalesce(job_record.attempt_count, 1)),
      coalesce(requested_retry_base_delay_minutes, policy_record.retry_base_delay_minutes, 5),
      coalesce(requested_retry_max_delay_minutes, policy_record.retry_max_delay_minutes, 120)
    );

    UPDATE public.governance_public_audit_anchor_execution_jobs
    SET
      status = 'pending',
      immutable_reference = job_record.immutable_reference,
      block_height = job_record.block_height,
      error_message = nullif(btrim(coalesce(error_message, '')), ''),
      completed_at = NULL,
      next_attempt_at = now() + make_interval(mins => retry_delay_minutes),
      claimed_at = NULL,
      claim_expires_at = NULL,
      claimed_by = NULL,
      metadata = coalesce(job_record.metadata, '{}'::jsonb)
        || coalesce(proof_payload, '{}'::jsonb)
        || jsonb_build_object(
          'completion_status', normalized_status,
          'retry_scheduled', true,
          'retry_delay_minutes', retry_delay_minutes,
          'retry_scheduled_at', now(),
          'completed_via', 'governance_public_audit_anchor_execution_worker',
          'linked_anchor_id', linked_anchor_id
        )
    WHERE id = job_record.id;

    RETURN job_record.id;
  END IF;

  UPDATE public.governance_public_audit_anchor_execution_jobs
  SET
    status = normalized_status,
    immutable_reference = CASE
      WHEN normalized_status = 'completed' THEN normalized_reference
      ELSE job_record.immutable_reference
    END,
    block_height = CASE
      WHEN normalized_status = 'completed' THEN proof_block_height
      ELSE job_record.block_height
    END,
    error_message = nullif(btrim(coalesce(error_message, '')), ''),
    completed_at = CASE
      WHEN normalized_status IN ('completed', 'failed', 'cancelled') THEN now()
      ELSE completed_at
    END,
    next_attempt_at = CASE
      WHEN normalized_status = 'pending' THEN now()
      ELSE next_attempt_at
    END,
    claimed_at = NULL,
    claim_expires_at = NULL,
    claimed_by = NULL,
    metadata = coalesce(job_record.metadata, '{}'::jsonb)
      || coalesce(proof_payload, '{}'::jsonb)
      || jsonb_build_object(
        'completion_status', normalized_status,
        'retry_scheduled', false,
        'completed_via', 'governance_public_audit_anchor_execution_worker',
        'linked_anchor_id', linked_anchor_id,
        'completed_at', now()
      )
  WHERE id = job_record.id;

  RETURN job_record.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.complete_governance_public_audit_verifier_job(
  target_job_id uuid,
  completion_status public.governance_public_audit_verifier_job_status,
  verification_status public.governance_public_audit_verification_status DEFAULT NULL,
  verification_hash text DEFAULT NULL,
  proof_reference text DEFAULT NULL,
  error_message text DEFAULT NULL,
  proof_payload jsonb DEFAULT '{}'::jsonb,
  retry_on_failure boolean DEFAULT true,
  requested_retry_base_delay_minutes integer DEFAULT NULL,
  requested_retry_max_delay_minutes integer DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  job_record public.governance_public_audit_verifier_jobs%ROWTYPE;
  policy_record public.governance_public_audit_external_execution_policies%ROWTYPE;
  should_retry boolean := false;
  retry_delay_minutes integer := 0;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to complete public audit verifier jobs';
  END IF;

  SELECT job.*
  INTO job_record
  FROM public.governance_public_audit_verifier_jobs AS job
  WHERE job.id = target_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Verifier job does not exist';
  END IF;

  SELECT policy.*
  INTO policy_record
  FROM public.governance_public_audit_external_execution_policies AS policy
  WHERE policy.policy_key = 'default'
  LIMIT 1;

  should_retry := completion_status = 'failed'::public.governance_public_audit_verifier_job_status
    AND coalesce(retry_on_failure, true)
    AND greatest(0, coalesce(job_record.attempt_count, 0)) < greatest(1, coalesce(job_record.max_attempts, policy_record.verifier_max_attempts, 5));

  IF should_retry THEN
    retry_delay_minutes := public.governance_public_audit_retry_backoff_minutes(
      greatest(1, coalesce(job_record.attempt_count, 1)),
      coalesce(requested_retry_base_delay_minutes, policy_record.retry_base_delay_minutes, 5),
      coalesce(requested_retry_max_delay_minutes, policy_record.retry_max_delay_minutes, 120)
    );

    UPDATE public.governance_public_audit_verifier_jobs
    SET status = 'pending'::public.governance_public_audit_verifier_job_status,
        result_reference = job_record.result_reference,
        error_message = nullif(btrim(coalesce(error_message, '')), ''),
        completed_at = NULL,
        next_attempt_at = now() + make_interval(mins => retry_delay_minutes),
        claimed_at = NULL,
        claim_expires_at = NULL,
        claimed_by = NULL,
        metadata = coalesce(job_record.metadata, '{}'::jsonb)
          || coalesce(proof_payload, '{}'::jsonb)
          || jsonb_build_object(
            'completion_status', completion_status,
            'retry_scheduled', true,
            'retry_delay_minutes', retry_delay_minutes,
            'retry_scheduled_at', now()
          )
    WHERE id = job_record.id;

    RETURN job_record.id;
  END IF;

  UPDATE public.governance_public_audit_verifier_jobs
  SET status = completion_status,
      result_reference = nullif(btrim(coalesce(proof_reference, '')), ''),
      error_message = nullif(btrim(coalesce(error_message, '')), ''),
      completed_at = CASE
        WHEN completion_status IN (
          'completed'::public.governance_public_audit_verifier_job_status,
          'failed'::public.governance_public_audit_verifier_job_status,
          'cancelled'::public.governance_public_audit_verifier_job_status
        )
        THEN now()
        ELSE completed_at
      END,
      next_attempt_at = CASE
        WHEN completion_status = 'pending'::public.governance_public_audit_verifier_job_status THEN now()
        ELSE next_attempt_at
      END,
      claimed_at = NULL,
      claim_expires_at = NULL,
      claimed_by = NULL,
      metadata = coalesce(job_record.metadata, '{}'::jsonb)
        || coalesce(proof_payload, '{}'::jsonb)
        || jsonb_build_object(
          'completion_status', completion_status,
          'retry_scheduled', false,
          'completed_at', now()
        )
  WHERE id = job_record.id;

  IF completion_status = 'completed'::public.governance_public_audit_verifier_job_status
     AND verification_status IS NOT NULL
  THEN
    PERFORM public.record_governance_public_audit_batch_verification(
      job_record.batch_id,
      job_record.verifier_id,
      verification_status,
      verification_hash,
      proof_reference,
      proof_payload,
      now()
    );
  END IF;

  RETURN job_record.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_public_audit_external_execution_paging_summary(
  requested_batch_id uuid DEFAULT NULL,
  auto_open_pages boolean DEFAULT false,
  requested_lookback_hours integer DEFAULT 24
)
RETURNS TABLE (
  batch_id uuid,
  paging_enabled boolean,
  oncall_channel text,
  paging_stale_pending_minutes integer,
  paging_failure_share_percent numeric,
  anchor_stale_pending_count integer,
  verifier_stale_pending_count integer,
  anchor_failure_share_percent numeric,
  verifier_failure_share_percent numeric,
  should_page boolean,
  open_page_count integer,
  latest_open_page_at timestamptz
) AS $$
DECLARE
  effective_batch_id uuid;
  policy_record public.governance_public_audit_external_execution_policies%ROWTYPE;
  anchor_stale_count integer := 0;
  verifier_stale_count integer := 0;
  anchor_failed_count integer := 0;
  anchor_completed_count integer := 0;
  verifier_failed_count integer := 0;
  verifier_completed_count integer := 0;
  anchor_failure_percent numeric := NULL;
  verifier_failure_percent numeric := NULL;
  should_page_now boolean := false;
  resolved_open_page_count integer := 0;
  resolved_latest_open_page_at timestamptz := NULL;
  lookback_hours integer := greatest(1, coalesce(requested_lookback_hours, 24));
  page_message text;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to inspect public audit external execution paging state';
  END IF;

  effective_batch_id := coalesce(
    requested_batch_id,
    (
      SELECT batch.id
      FROM public.governance_public_audit_batches AS batch
      ORDER BY batch.batch_index DESC
      LIMIT 1
    )
  );

  IF effective_batch_id IS NULL THEN
    RETURN QUERY
    SELECT
      NULL::uuid,
      false,
      'public_audit_ops'::text,
      30::integer,
      25::numeric,
      0::integer,
      0::integer,
      NULL::numeric,
      NULL::numeric,
      false,
      0::integer,
      NULL::timestamptz;
    RETURN;
  END IF;

  SELECT policy.*
  INTO policy_record
  FROM public.governance_public_audit_external_execution_policies AS policy
  WHERE policy.policy_key = 'default'
  LIMIT 1;

  IF policy_record.policy_key IS NULL THEN
    INSERT INTO public.governance_public_audit_external_execution_policies (
      policy_key,
      policy_name,
      updated_by
    )
    VALUES (
      'default',
      'Default external execution policy',
      public.current_profile_id()
    )
    ON CONFLICT (policy_key) DO NOTHING;

    SELECT policy.*
    INTO policy_record
    FROM public.governance_public_audit_external_execution_policies AS policy
    WHERE policy.policy_key = 'default'
    LIMIT 1;
  END IF;

  SELECT coalesce(count(*), 0)::integer
  INTO anchor_stale_count
  FROM public.governance_public_audit_anchor_execution_jobs AS job
  WHERE job.batch_id = effective_batch_id
    AND job.status = 'pending'
    AND job.next_attempt_at <= now()
    AND job.scheduled_at < (now() - make_interval(mins => greatest(1, coalesce(policy_record.paging_stale_pending_minutes, 30))));

  SELECT coalesce(count(*), 0)::integer
  INTO verifier_stale_count
  FROM public.governance_public_audit_verifier_jobs AS job
  WHERE job.batch_id = effective_batch_id
    AND job.status = 'pending'::public.governance_public_audit_verifier_job_status
    AND job.next_attempt_at <= now()
    AND job.scheduled_at < (now() - make_interval(mins => greatest(1, coalesce(policy_record.paging_stale_pending_minutes, 30))));

  SELECT
    coalesce(count(*) FILTER (WHERE job.status = 'failed'), 0)::integer,
    coalesce(count(*) FILTER (WHERE job.status = 'completed'), 0)::integer
  INTO anchor_failed_count, anchor_completed_count
  FROM public.governance_public_audit_anchor_execution_jobs AS job
  WHERE job.batch_id = effective_batch_id
    AND job.completed_at >= (now() - make_interval(hours => lookback_hours));

  IF anchor_failed_count + anchor_completed_count > 0 THEN
    anchor_failure_percent := round((anchor_failed_count::numeric / (anchor_failed_count + anchor_completed_count)::numeric) * 100, 2);
  END IF;

  SELECT
    coalesce(count(*) FILTER (WHERE job.status = 'failed'::public.governance_public_audit_verifier_job_status), 0)::integer,
    coalesce(count(*) FILTER (WHERE job.status = 'completed'::public.governance_public_audit_verifier_job_status), 0)::integer
  INTO verifier_failed_count, verifier_completed_count
  FROM public.governance_public_audit_verifier_jobs AS job
  WHERE job.batch_id = effective_batch_id
    AND job.completed_at >= (now() - make_interval(hours => lookback_hours));

  IF verifier_failed_count + verifier_completed_count > 0 THEN
    verifier_failure_percent := round((verifier_failed_count::numeric / (verifier_failed_count + verifier_completed_count)::numeric) * 100, 2);
  END IF;

  should_page_now := coalesce(policy_record.paging_enabled, true)
    AND (
      anchor_stale_count > 0
      OR verifier_stale_count > 0
      OR coalesce(anchor_failure_percent, 0) >= coalesce(policy_record.paging_failure_share_percent, 25)
      OR coalesce(verifier_failure_percent, 0) >= coalesce(policy_record.paging_failure_share_percent, 25)
    );

  IF should_page_now AND coalesce(auto_open_pages, false) THEN
    page_message := format(
      'External execution SLA risk detected (anchor stale=%s, verifier stale=%s, anchor failure=%s%%, verifier failure=%s%%)',
      anchor_stale_count,
      verifier_stale_count,
      coalesce(anchor_failure_percent::text, 'n/a'),
      coalesce(verifier_failure_percent::text, 'n/a')
    );

    PERFORM public.open_governance_public_audit_external_execution_page(
      effective_batch_id,
      'external_execution_sla',
      CASE
        WHEN anchor_stale_count > 0 OR verifier_stale_count > 0 THEN 'critical'
        ELSE 'warning'
      END,
      page_message,
      jsonb_build_object(
        'anchor_stale_pending_count', anchor_stale_count,
        'verifier_stale_pending_count', verifier_stale_count,
        'anchor_failure_share_percent', anchor_failure_percent,
        'verifier_failure_share_percent', verifier_failure_percent,
        'lookback_hours', lookback_hours,
        'paging_failure_share_percent', policy_record.paging_failure_share_percent,
        'paging_stale_pending_minutes', policy_record.paging_stale_pending_minutes,
        'evaluated_at', now()
      )
    );
  END IF;

  SELECT
    coalesce(count(*) FILTER (WHERE page.page_status = 'open'), 0)::integer,
    max(page.opened_at) FILTER (WHERE page.page_status = 'open')
  INTO resolved_open_page_count, resolved_latest_open_page_at
  FROM public.governance_public_audit_external_execution_pages AS page
  WHERE page.batch_id = effective_batch_id;

  RETURN QUERY
  SELECT
    effective_batch_id,
    coalesce(policy_record.paging_enabled, true),
    coalesce(policy_record.oncall_channel, 'public_audit_ops'),
    greatest(1, coalesce(policy_record.paging_stale_pending_minutes, 30)),
    round(coalesce(policy_record.paging_failure_share_percent, 25)::numeric, 2),
    anchor_stale_count,
    verifier_stale_count,
    anchor_failure_percent,
    verifier_failure_percent,
    should_page_now,
    resolved_open_page_count,
    resolved_latest_open_page_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_public_audit_external_execution_page_board(
  requested_batch_id uuid DEFAULT NULL,
  max_pages integer DEFAULT 80
)
RETURNS TABLE (
  page_id uuid,
  batch_id uuid,
  page_key text,
  severity text,
  page_status text,
  page_message text,
  oncall_channel text,
  opened_at timestamptz,
  resolved_at timestamptz
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
  page.id AS page_id,
  page.batch_id,
  page.page_key,
  page.severity,
  page.page_status,
  page.page_message,
  page.oncall_channel,
  page.opened_at,
  page.resolved_at
FROM public.governance_public_audit_external_execution_pages AS page
JOIN target_batch
  ON target_batch.batch_id = page.batch_id
ORDER BY page.opened_at DESC, page.created_at DESC, page.id DESC
LIMIT greatest(1, coalesce(max_pages, 80));
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

GRANT SELECT, INSERT, UPDATE ON public.governance_public_audit_external_execution_policies TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.governance_public_audit_external_execution_pages TO authenticated;

GRANT EXECUTE ON FUNCTION public.governance_public_audit_retry_backoff_minutes(integer, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_external_execution_policy_summary(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_governance_public_audit_external_execution_policy(text, text, boolean, integer, integer, integer, integer, integer, boolean, integer, numeric, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_governance_public_audit_external_execution_page(uuid, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_governance_public_audit_external_execution_page(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_governance_public_audit_external_execution_jobs(uuid, integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_external_execution_paging_summary(uuid, boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_external_execution_page_board(uuid, integer) TO authenticated;

GRANT EXECUTE ON FUNCTION public.schedule_governance_public_audit_anchor_execution_jobs(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_governance_public_audit_verifier_jobs(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_governance_public_audit_anchor_execution_job(uuid, text, text, bigint, text, jsonb, boolean, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_governance_public_audit_verifier_job(uuid, public.governance_public_audit_verifier_job_status, public.governance_public_audit_verification_status, text, text, text, jsonb, boolean, integer, integer) TO authenticated;

ALTER TABLE public.governance_public_audit_external_execution_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_public_audit_external_execution_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public audit external execution policies are readable by authenticated users" ON public.governance_public_audit_external_execution_policies;
CREATE POLICY "Public audit external execution policies are readable by authenticated users" ON public.governance_public_audit_external_execution_policies
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Public audit external execution policies are manageable by verifier stewards" ON public.governance_public_audit_external_execution_policies;
CREATE POLICY "Public audit external execution policies are manageable by verifier stewards" ON public.governance_public_audit_external_execution_policies
  FOR ALL USING (public.current_profile_can_manage_public_audit_verifiers())
  WITH CHECK (public.current_profile_can_manage_public_audit_verifiers());

DROP POLICY IF EXISTS "Public audit external execution pages are readable by authenticated users" ON public.governance_public_audit_external_execution_pages;
CREATE POLICY "Public audit external execution pages are readable by authenticated users" ON public.governance_public_audit_external_execution_pages
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Public audit external execution pages are manageable by verifier stewards" ON public.governance_public_audit_external_execution_pages;
CREATE POLICY "Public audit external execution pages are manageable by verifier stewards" ON public.governance_public_audit_external_execution_pages
  FOR ALL USING (public.current_profile_can_manage_public_audit_verifiers())
  WITH CHECK (public.current_profile_can_manage_public_audit_verifiers());
