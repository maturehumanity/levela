ALTER TABLE public.governance_public_audit_verifier_mirror_failover_policies
  ADD COLUMN IF NOT EXISTS require_policy_ratification boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_policy_ratification_approvals integer NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gpav_mirror_failover_min_pol_ratif_app_chk'
  ) THEN
    ALTER TABLE public.governance_public_audit_verifier_mirror_failover_policies
      ADD CONSTRAINT gpav_mirror_failover_min_pol_ratif_app_chk
      CHECK (min_policy_ratification_approvals >= 1);
  END IF;
END $$;

UPDATE public.governance_public_audit_verifier_mirror_failover_policies
SET
  require_policy_ratification = coalesce(require_policy_ratification, false),
  min_policy_ratification_approvals = greatest(1, coalesce(min_policy_ratification_approvals, 1));

CREATE TABLE IF NOT EXISTS public.governance_public_audit_verifier_mirror_discovery_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL UNIQUE,
  source_label text,
  endpoint_url text NOT NULL,
  discovery_scope text NOT NULL DEFAULT 'public_registry',
  trust_tier text NOT NULL DEFAULT 'observer',
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  added_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gpav_dsrc_key_chk CHECK (length(trim(source_key)) > 0),
  CONSTRAINT gpav_dsrc_endpoint_chk CHECK (length(trim(endpoint_url)) > 0),
  CONSTRAINT gpav_dsrc_scope_chk CHECK (
    discovery_scope IN ('public_registry', 'signed_catalog', 'community_feed', 'manual_seed')
  ),
  CONSTRAINT gpav_dsrc_tier_chk CHECK (
    trust_tier IN ('bootstrap', 'observer', 'independent', 'community')
  ),
  CONSTRAINT gpav_dsrc_metadata_chk CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE IF NOT EXISTS public.governance_public_audit_verifier_mirror_discovery_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.governance_public_audit_verifier_mirror_discovery_sources(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.governance_public_audit_batches(id) ON DELETE SET NULL,
  run_status text NOT NULL,
  discovered_count integer NOT NULL DEFAULT 0,
  accepted_candidate_count integer NOT NULL DEFAULT 0,
  stale_candidate_count integer NOT NULL DEFAULT 0,
  error_message text,
  run_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gpav_drun_status_chk CHECK (
    run_status IN ('ok', 'degraded', 'failed')
  ),
  CONSTRAINT gpav_drun_discovered_cnt_chk CHECK (discovered_count >= 0),
  CONSTRAINT gpav_drun_accepted_cnt_chk CHECK (accepted_candidate_count >= 0),
  CONSTRAINT gpav_drun_stale_cnt_chk CHECK (stale_candidate_count >= 0),
  CONSTRAINT gpav_drun_err_chk CHECK (
    error_message IS NULL OR length(trim(error_message)) > 0
  ),
  CONSTRAINT gpav_drun_payload_chk CHECK (jsonb_typeof(run_payload) = 'object')
);

CREATE TABLE IF NOT EXISTS public.governance_public_audit_verifier_mirror_discovered_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.governance_public_audit_verifier_mirror_discovery_sources(id) ON DELETE CASCADE,
  discovery_run_id uuid REFERENCES public.governance_public_audit_verifier_mirror_discovery_runs(id) ON DELETE SET NULL,
  candidate_key text NOT NULL,
  candidate_label text,
  endpoint_url text NOT NULL,
  mirror_type text NOT NULL DEFAULT 'https_gateway',
  region_code text NOT NULL DEFAULT 'GLOBAL',
  jurisdiction_country_code text NOT NULL DEFAULT '',
  operator_label text NOT NULL DEFAULT 'unspecified',
  trust_domain text NOT NULL DEFAULT 'public',
  discovery_confidence numeric(5,2) NOT NULL DEFAULT 50,
  candidate_status text NOT NULL DEFAULT 'new',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gpav_dcand_key_chk CHECK (length(trim(candidate_key)) > 0),
  CONSTRAINT gpav_dcand_endpoint_chk CHECK (length(trim(endpoint_url)) > 0),
  CONSTRAINT gpav_dcand_mirror_type_chk CHECK (length(trim(mirror_type)) > 0),
  CONSTRAINT gpav_dcand_region_chk CHECK (length(trim(region_code)) > 0),
  CONSTRAINT gpav_dcand_operator_chk CHECK (length(trim(operator_label)) > 0),
  CONSTRAINT gpav_dcand_country_chk CHECK (
    jurisdiction_country_code = '' OR length(jurisdiction_country_code) = 2
  ),
  CONSTRAINT gpav_dcand_trust_domain_chk CHECK (length(trim(trust_domain)) > 0),
  CONSTRAINT gpav_dcand_confidence_chk CHECK (
    discovery_confidence >= 0 AND discovery_confidence <= 100
  ),
  CONSTRAINT gpav_dcand_status_chk CHECK (
    candidate_status IN ('new', 'reviewed', 'promoted', 'rejected', 'inactive')
  ),
  CONSTRAINT gpav_dcand_metadata_chk CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT gpav_dcand_unique_src_cand UNIQUE (source_id, candidate_key)
);

CREATE TABLE IF NOT EXISTS public.governance_public_audit_verifier_mirror_policy_ratifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key text NOT NULL,
  policy_hash text NOT NULL,
  signer_id uuid NOT NULL REFERENCES public.governance_public_audit_verifier_mirror_directory_signers(id) ON DELETE RESTRICT,
  signer_key text NOT NULL,
  ratification_decision text NOT NULL,
  ratification_signature text NOT NULL,
  ratification_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ratified_at timestamptz NOT NULL DEFAULT now(),
  ratified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gpav_prat_policy_key_chk CHECK (length(trim(policy_key)) > 0),
  CONSTRAINT gpav_prat_policy_hash_chk CHECK (length(trim(policy_hash)) > 0),
  CONSTRAINT gpav_prat_signer_key_chk CHECK (length(trim(signer_key)) > 0),
  CONSTRAINT gpav_prat_decision_chk CHECK (
    ratification_decision IN ('approve', 'reject')
  ),
  CONSTRAINT gpav_prat_sig_chk CHECK (length(trim(ratification_signature)) > 0),
  CONSTRAINT gpav_prat_payload_chk CHECK (jsonb_typeof(ratification_payload) = 'object'),
  CONSTRAINT gpav_prat_unique_signer UNIQUE (policy_key, policy_hash, signer_id)
);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_verifier_mirror_discovery_sources_active
  ON public.governance_public_audit_verifier_mirror_discovery_sources (is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_verifier_mirror_discovery_runs_source_observed
  ON public.governance_public_audit_verifier_mirror_discovery_runs (source_id, observed_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_verifier_mirror_discovery_runs_batch_observed
  ON public.governance_public_audit_verifier_mirror_discovery_runs (batch_id, observed_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_verifier_mirror_discovered_candidates_source_seen
  ON public.governance_public_audit_verifier_mirror_discovered_candidates (source_id, last_seen_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_verifier_mirror_discovered_candidates_status_seen
  ON public.governance_public_audit_verifier_mirror_discovered_candidates (candidate_status, last_seen_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_verifier_mirror_policy_ratifications_policy_ratified
  ON public.governance_public_audit_verifier_mirror_policy_ratifications (policy_key, policy_hash, ratified_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_verifier_mirror_policy_ratifications_signer_ratified
  ON public.governance_public_audit_verifier_mirror_policy_ratifications (signer_id, ratified_at DESC, created_at DESC);

DO $$
BEGIN
  CREATE TRIGGER update_governance_public_audit_verifier_mirror_discovery_sources_updated_at
    BEFORE UPDATE ON public.governance_public_audit_verifier_mirror_discovery_sources
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_governance_public_audit_verifier_mirror_discovery_runs_updated_at
    BEFORE UPDATE ON public.governance_public_audit_verifier_mirror_discovery_runs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_governance_public_audit_verifier_mirror_discovered_candidates_updated_at
    BEFORE UPDATE ON public.governance_public_audit_verifier_mirror_discovered_candidates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_governance_public_audit_verifier_mirror_policy_ratifications_updated_at
    BEFORE UPDATE ON public.governance_public_audit_verifier_mirror_policy_ratifications
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.register_governance_public_audit_verifier_mirror_discovery_source(
  source_key text,
  source_label text DEFAULT NULL,
  endpoint_url text DEFAULT NULL,
  discovery_scope text DEFAULT 'public_registry',
  trust_tier text DEFAULT 'observer',
  metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  inserted_id uuid;
  normalized_scope text;
  normalized_tier text;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to manage verifier mirror discovery sources';
  END IF;

  normalized_scope := lower(coalesce(nullif(btrim(coalesce(discovery_scope, '')), ''), 'public_registry'));
  IF normalized_scope NOT IN ('public_registry', 'signed_catalog', 'community_feed', 'manual_seed') THEN
    RAISE EXCEPTION 'Discovery scope must be public_registry, signed_catalog, community_feed, or manual_seed';
  END IF;

  normalized_tier := lower(coalesce(nullif(btrim(coalesce(trust_tier, '')), ''), 'observer'));
  IF normalized_tier NOT IN ('bootstrap', 'observer', 'independent', 'community') THEN
    RAISE EXCEPTION 'Trust tier must be bootstrap, observer, independent, or community';
  END IF;

  INSERT INTO public.governance_public_audit_verifier_mirror_discovery_sources (
    source_key,
    source_label,
    endpoint_url,
    discovery_scope,
    trust_tier,
    is_active,
    metadata,
    added_by
  )
  VALUES (
    btrim(coalesce(source_key, '')),
    nullif(btrim(coalesce(source_label, '')), ''),
    btrim(coalesce(endpoint_url, '')),
    normalized_scope,
    normalized_tier,
    true,
    coalesce(metadata, '{}'::jsonb),
    public.current_profile_id()
  )
  ON CONFLICT (source_key) DO UPDATE
    SET source_label = excluded.source_label,
        endpoint_url = excluded.endpoint_url,
        discovery_scope = excluded.discovery_scope,
        trust_tier = excluded.trust_tier,
        is_active = true,
        metadata = coalesce(public.governance_public_audit_verifier_mirror_discovery_sources.metadata, '{}'::jsonb)
          || coalesce(excluded.metadata, '{}'::jsonb)
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.record_governance_public_audit_verifier_mirror_discovery_run(
  target_source_id uuid,
  target_batch_id uuid DEFAULT NULL,
  run_status text DEFAULT 'ok',
  discovered_count integer DEFAULT 0,
  accepted_candidate_count integer DEFAULT 0,
  stale_candidate_count integer DEFAULT 0,
  error_message text DEFAULT NULL,
  run_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  inserted_id uuid;
  normalized_status text;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to record verifier mirror discovery runs';
  END IF;

  normalized_status := lower(coalesce(nullif(btrim(coalesce(run_status, '')), ''), 'ok'));
  IF normalized_status NOT IN ('ok', 'degraded', 'failed') THEN
    RAISE EXCEPTION 'Run status must be ok, degraded, or failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.governance_public_audit_verifier_mirror_discovery_sources AS source
    WHERE source.id = target_source_id
      AND source.is_active = true
  ) THEN
    RAISE EXCEPTION 'Discovery source not found or inactive';
  END IF;

  IF target_batch_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.governance_public_audit_batches AS batch
       WHERE batch.id = target_batch_id
     )
  THEN
    RAISE EXCEPTION 'Public audit batch not found';
  END IF;

  INSERT INTO public.governance_public_audit_verifier_mirror_discovery_runs (
    source_id,
    batch_id,
    run_status,
    discovered_count,
    accepted_candidate_count,
    stale_candidate_count,
    error_message,
    run_payload,
    observed_at,
    created_by
  )
  VALUES (
    target_source_id,
    target_batch_id,
    normalized_status,
    greatest(0, coalesce(discovered_count, 0)),
    greatest(0, coalesce(accepted_candidate_count, 0)),
    greatest(0, coalesce(stale_candidate_count, 0)),
    nullif(btrim(coalesce(error_message, '')), ''),
    coalesce(run_payload, '{}'::jsonb),
    now(),
    public.current_profile_id()
  )
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.upsert_governance_public_audit_verifier_mirror_discovered_candidate(
  target_source_id uuid,
  candidate_key text,
  candidate_label text DEFAULT NULL,
  endpoint_url text DEFAULT NULL,
  mirror_type text DEFAULT 'https_gateway',
  region_code text DEFAULT 'GLOBAL',
  jurisdiction_country_code text DEFAULT '',
  operator_label text DEFAULT 'unspecified',
  trust_domain text DEFAULT 'public',
  discovery_confidence numeric DEFAULT 50,
  candidate_status text DEFAULT 'new',
  run_id uuid DEFAULT NULL,
  metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  inserted_id uuid;
  normalized_status text;
  normalized_country text;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to manage discovered verifier mirrors';
  END IF;

  normalized_status := lower(coalesce(nullif(btrim(coalesce(candidate_status, '')), ''), 'new'));
  IF normalized_status NOT IN ('new', 'reviewed', 'promoted', 'rejected', 'inactive') THEN
    RAISE EXCEPTION 'Candidate status must be new, reviewed, promoted, rejected, or inactive';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.governance_public_audit_verifier_mirror_discovery_sources AS source
    WHERE source.id = target_source_id
      AND source.is_active = true
  ) THEN
    RAISE EXCEPTION 'Discovery source not found or inactive';
  END IF;

  IF run_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.governance_public_audit_verifier_mirror_discovery_runs AS run
       WHERE run.id = run_id
         AND run.source_id = target_source_id
     )
  THEN
    RAISE EXCEPTION 'Discovery run not found for this source';
  END IF;

  normalized_country := upper(coalesce(nullif(btrim(coalesce(jurisdiction_country_code, '')), ''), ''));

  INSERT INTO public.governance_public_audit_verifier_mirror_discovered_candidates (
    source_id,
    discovery_run_id,
    candidate_key,
    candidate_label,
    endpoint_url,
    mirror_type,
    region_code,
    jurisdiction_country_code,
    operator_label,
    trust_domain,
    discovery_confidence,
    candidate_status,
    metadata,
    first_seen_at,
    last_seen_at
  )
  VALUES (
    target_source_id,
    run_id,
    btrim(coalesce(candidate_key, '')),
    nullif(btrim(coalesce(candidate_label, '')), ''),
    btrim(coalesce(endpoint_url, '')),
    lower(coalesce(nullif(btrim(coalesce(mirror_type, '')), ''), 'https_gateway')),
    upper(coalesce(nullif(btrim(coalesce(region_code, '')), ''), 'GLOBAL')),
    normalized_country,
    coalesce(nullif(btrim(coalesce(operator_label, '')), ''), 'unspecified'),
    lower(coalesce(nullif(btrim(coalesce(trust_domain, '')), ''), 'public')),
    greatest(0::numeric, least(100::numeric, coalesce(discovery_confidence, 50))),
    normalized_status,
    coalesce(metadata, '{}'::jsonb),
    now(),
    now()
  )
  ON CONFLICT (source_id, candidate_key) DO UPDATE
    SET discovery_run_id = excluded.discovery_run_id,
        candidate_label = excluded.candidate_label,
        endpoint_url = excluded.endpoint_url,
        mirror_type = excluded.mirror_type,
        region_code = excluded.region_code,
        jurisdiction_country_code = excluded.jurisdiction_country_code,
        operator_label = excluded.operator_label,
        trust_domain = excluded.trust_domain,
        discovery_confidence = excluded.discovery_confidence,
        candidate_status = excluded.candidate_status,
        metadata = coalesce(public.governance_public_audit_verifier_mirror_discovered_candidates.metadata, '{}'::jsonb)
          || coalesce(excluded.metadata, '{}'::jsonb),
        last_seen_at = now()
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_public_audit_verifier_mirror_discovery_source_board(
  max_entries integer DEFAULT 20
)
RETURNS TABLE (
  source_id uuid,
  source_key text,
  source_label text,
  endpoint_url text,
  discovery_scope text,
  trust_tier text,
  is_active boolean,
  last_run_at timestamptz,
  last_run_status text,
  candidate_count integer,
  new_candidate_count integer,
  promoted_candidate_count integer
) AS $$
WITH latest_runs AS (
  SELECT DISTINCT ON (run.source_id)
    run.source_id,
    run.observed_at,
    run.run_status
  FROM public.governance_public_audit_verifier_mirror_discovery_runs AS run
  ORDER BY run.source_id, run.observed_at DESC, run.created_at DESC
),
candidate_counts AS (
  SELECT
    candidate.source_id,
    coalesce(count(*)::integer, 0) AS candidate_count,
    coalesce(count(*) FILTER (WHERE candidate.candidate_status = 'new')::integer, 0) AS new_candidate_count,
    coalesce(count(*) FILTER (WHERE candidate.candidate_status = 'promoted')::integer, 0) AS promoted_candidate_count
  FROM public.governance_public_audit_verifier_mirror_discovered_candidates AS candidate
  GROUP BY candidate.source_id
)
SELECT
  source.id AS source_id,
  source.source_key,
  source.source_label,
  source.endpoint_url,
  source.discovery_scope,
  source.trust_tier,
  source.is_active,
  latest_runs.observed_at AS last_run_at,
  latest_runs.run_status AS last_run_status,
  coalesce(candidate_counts.candidate_count, 0) AS candidate_count,
  coalesce(candidate_counts.new_candidate_count, 0) AS new_candidate_count,
  coalesce(candidate_counts.promoted_candidate_count, 0) AS promoted_candidate_count
FROM public.governance_public_audit_verifier_mirror_discovery_sources AS source
LEFT JOIN latest_runs
  ON latest_runs.source_id = source.id
LEFT JOIN candidate_counts
  ON candidate_counts.source_id = source.id
ORDER BY source.is_active DESC, latest_runs.observed_at DESC NULLS LAST, source.created_at ASC
LIMIT greatest(1, coalesce(max_entries, 20));
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_public_audit_verifier_mirror_discovered_candidate_board(
  status_filter text DEFAULT NULL,
  max_candidates integer DEFAULT 80
)
RETURNS TABLE (
  candidate_id uuid,
  source_id uuid,
  source_key text,
  source_label text,
  trust_tier text,
  candidate_key text,
  candidate_label text,
  endpoint_url text,
  region_code text,
  operator_label text,
  trust_domain text,
  candidate_status text,
  discovery_confidence numeric,
  last_seen_at timestamptz
) AS $$
SELECT
  candidate.id AS candidate_id,
  candidate.source_id,
  source.source_key,
  source.source_label,
  source.trust_tier,
  candidate.candidate_key,
  candidate.candidate_label,
  candidate.endpoint_url,
  candidate.region_code,
  candidate.operator_label,
  candidate.trust_domain,
  candidate.candidate_status,
  candidate.discovery_confidence,
  candidate.last_seen_at
FROM public.governance_public_audit_verifier_mirror_discovered_candidates AS candidate
JOIN public.governance_public_audit_verifier_mirror_discovery_sources AS source
  ON source.id = candidate.source_id
WHERE status_filter IS NULL
   OR candidate.candidate_status = lower(btrim(status_filter))
ORDER BY
  CASE
    WHEN candidate.candidate_status = 'new' THEN 0
    WHEN candidate.candidate_status = 'reviewed' THEN 1
    WHEN candidate.candidate_status = 'promoted' THEN 2
    WHEN candidate.candidate_status = 'rejected' THEN 3
    ELSE 4
  END,
  candidate.discovery_confidence DESC,
  candidate.last_seen_at DESC,
  candidate.created_at DESC
LIMIT greatest(1, coalesce(max_candidates, 80));
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.promote_governance_public_audit_verifier_mirror_discovered_candidate(
  target_candidate_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  candidate_record public.governance_public_audit_verifier_mirror_discovered_candidates%ROWTYPE;
  source_record public.governance_public_audit_verifier_mirror_discovery_sources%ROWTYPE;
  promoted_mirror_id uuid;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to promote discovered verifier mirrors';
  END IF;

  SELECT *
  INTO candidate_record
  FROM public.governance_public_audit_verifier_mirror_discovered_candidates AS candidate
  WHERE candidate.id = target_candidate_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Discovered verifier mirror candidate not found';
  END IF;

  IF candidate_record.candidate_status NOT IN ('new', 'reviewed', 'promoted') THEN
    RAISE EXCEPTION 'Only new or reviewed candidates can be promoted';
  END IF;

  SELECT *
  INTO source_record
  FROM public.governance_public_audit_verifier_mirror_discovery_sources AS source
  WHERE source.id = candidate_record.source_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Discovery source not found';
  END IF;

  promoted_mirror_id := public.register_governance_public_audit_verifier_mirror(
    candidate_record.candidate_key,
    candidate_record.candidate_label,
    candidate_record.endpoint_url,
    candidate_record.mirror_type,
    candidate_record.region_code,
    candidate_record.jurisdiction_country_code,
    candidate_record.operator_label,
    coalesce(candidate_record.metadata, '{}'::jsonb)
      || coalesce(metadata, '{}'::jsonb)
      || jsonb_build_object(
        'source_key', source_record.source_key,
        'source_trust_tier', source_record.trust_tier,
        'candidate_id', candidate_record.id,
        'promoted_at', now()
      )
  );

  UPDATE public.governance_public_audit_verifier_mirror_discovered_candidates
  SET
    candidate_status = 'promoted',
    metadata = coalesce(candidate_record.metadata, '{}'::jsonb)
      || coalesce(metadata, '{}'::jsonb)
      || jsonb_build_object('promoted_mirror_id', promoted_mirror_id, 'promoted_at', now()),
    last_seen_at = now()
  WHERE id = candidate_record.id;

  RETURN promoted_mirror_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_public_audit_verifier_mirror_discovery_summary(
  requested_batch_id uuid DEFAULT NULL,
  requested_lookback_hours integer DEFAULT 24
)
RETURNS TABLE (
  batch_id uuid,
  lookback_hours integer,
  active_source_count integer,
  candidate_count integer,
  new_candidate_count integer,
  promoted_candidate_count integer,
  last_run_at timestamptz,
  last_run_status text
) AS $$
WITH config AS (
  SELECT greatest(1, coalesce(requested_lookback_hours, 24))::integer AS lookback_hours
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
candidate_counts AS (
  SELECT
    coalesce(count(*)::integer, 0) AS candidate_count,
    coalesce(count(*) FILTER (WHERE candidate.candidate_status = 'new')::integer, 0) AS new_candidate_count,
    coalesce(count(*) FILTER (WHERE candidate.candidate_status = 'promoted')::integer, 0) AS promoted_candidate_count
  FROM public.governance_public_audit_verifier_mirror_discovered_candidates AS candidate
),
recent_runs AS (
  SELECT run.*
  FROM public.governance_public_audit_verifier_mirror_discovery_runs AS run
  CROSS JOIN config
  WHERE run.observed_at >= (now() - make_interval(hours => config.lookback_hours))
    AND (
      requested_batch_id IS NULL
      OR run.batch_id = requested_batch_id
    )
  ORDER BY run.observed_at DESC, run.created_at DESC
),
latest_run AS (
  SELECT run.observed_at, run.run_status
  FROM recent_runs AS run
  ORDER BY run.observed_at DESC, run.created_at DESC
  LIMIT 1
)
SELECT
  resolved_batch.batch_id,
  config.lookback_hours,
  coalesce((SELECT count(*)::integer FROM public.governance_public_audit_verifier_mirror_discovery_sources WHERE is_active = true), 0) AS active_source_count,
  coalesce(candidate_counts.candidate_count, 0) AS candidate_count,
  coalesce(candidate_counts.new_candidate_count, 0) AS new_candidate_count,
  coalesce(candidate_counts.promoted_candidate_count, 0) AS promoted_candidate_count,
  latest_run.observed_at AS last_run_at,
  latest_run.run_status AS last_run_status
FROM resolved_batch
CROSS JOIN config
CROSS JOIN candidate_counts
LEFT JOIN latest_run ON true;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS public.governance_public_audit_verifier_mirror_failover_policy_summary(text);
CREATE FUNCTION public.governance_public_audit_verifier_mirror_failover_policy_summary(
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
  min_independent_directory_signers integer,
  require_policy_ratification boolean,
  min_policy_ratification_approvals integer,
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
  policy.min_independent_directory_signers,
  policy.require_policy_ratification,
  policy.min_policy_ratification_approvals,
  policy.updated_at
FROM public.governance_public_audit_verifier_mirror_failover_policies AS policy
WHERE policy.policy_key = lower(coalesce(nullif(btrim(coalesce(requested_policy_key, '')), ''), 'default'))
ORDER BY policy.updated_at DESC, policy.created_at DESC, policy.id DESC
LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.set_governance_public_audit_verifier_mirror_policy_ratification_requirement(
  requested_policy_key text DEFAULT 'default',
  require_ratification boolean DEFAULT false,
  min_approval_count integer DEFAULT 1
)
RETURNS uuid AS $$
DECLARE
  resolved_id uuid;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to manage verifier mirror policy ratification requirements';
  END IF;

  UPDATE public.governance_public_audit_verifier_mirror_failover_policies
  SET
    require_policy_ratification = coalesce(require_ratification, false),
    min_policy_ratification_approvals = greatest(1, coalesce(min_approval_count, 1)),
    updated_by = public.current_profile_id(),
    updated_at = now()
  WHERE policy_key = lower(coalesce(nullif(btrim(coalesce(requested_policy_key, '')), ''), 'default'))
  RETURNING id INTO resolved_id;

  IF resolved_id IS NULL THEN
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
      min_independent_directory_signers,
      require_policy_ratification,
      min_policy_ratification_approvals,
      metadata,
      created_by,
      updated_by
    )
    VALUES (
      lower(coalesce(nullif(btrim(coalesce(requested_policy_key, '')), ''), 'default')),
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
      1,
      coalesce(require_ratification, false),
      greatest(1, coalesce(min_approval_count, 1)),
      jsonb_build_object('source', 'set_governance_public_audit_verifier_mirror_policy_ratification_requirement'),
      public.current_profile_id(),
      public.current_profile_id()
    )
    RETURNING id INTO resolved_id;
  END IF;

  RETURN resolved_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_public_audit_verifier_mirror_policy_hash(
  requested_policy_key text DEFAULT 'default'
)
RETURNS TABLE (
  policy_key text,
  policy_hash text,
  policy_payload jsonb,
  require_policy_ratification boolean,
  min_policy_ratification_approvals integer,
  min_independent_directory_signers integer
) AS $$
WITH policy AS (
  SELECT *
  FROM public.governance_public_audit_verifier_mirror_failover_policy_summary(requested_policy_key)
),
payload_cte AS (
  SELECT jsonb_build_object(
    'policy_key', policy.policy_key,
    'policy_name', policy.policy_name,
    'is_active', policy.is_active,
    'min_healthy_mirrors', policy.min_healthy_mirrors,
    'max_mirror_latency_ms', policy.max_mirror_latency_ms,
    'max_failures_before_cooldown', policy.max_failures_before_cooldown,
    'cooldown_minutes', policy.cooldown_minutes,
    'prefer_same_region', policy.prefer_same_region,
    'required_distinct_regions', policy.required_distinct_regions,
    'required_distinct_operators', policy.required_distinct_operators,
    'mirror_selection_strategy', policy.mirror_selection_strategy,
    'max_mirror_candidates', policy.max_mirror_candidates,
    'min_independent_directory_signers', policy.min_independent_directory_signers,
    'require_policy_ratification', policy.require_policy_ratification,
    'min_policy_ratification_approvals', policy.min_policy_ratification_approvals
  ) AS policy_payload
  FROM policy
)
SELECT
  coalesce((SELECT policy.policy_key FROM policy LIMIT 1), lower(coalesce(nullif(btrim(coalesce(requested_policy_key, '')), ''), 'default'))) AS policy_key,
  encode(
    extensions.digest(
      coalesce((SELECT (payload_cte.policy_payload::text)::bytea FROM payload_cte LIMIT 1), '{}'::text::bytea),
      'sha256'
    ),
    'hex'
  ) AS policy_hash,
  coalesce((SELECT payload_cte.policy_payload FROM payload_cte LIMIT 1), '{}'::jsonb) AS policy_payload,
  coalesce((SELECT policy.require_policy_ratification FROM policy LIMIT 1), false) AS require_policy_ratification,
  coalesce((SELECT policy.min_policy_ratification_approvals FROM policy LIMIT 1), 1) AS min_policy_ratification_approvals,
  coalesce((SELECT policy.min_independent_directory_signers FROM policy LIMIT 1), 1) AS min_independent_directory_signers;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.record_governance_public_audit_verifier_mirror_policy_ratification(
  requested_policy_key text,
  signer_key text,
  ratification_decision text,
  ratification_signature text,
  ratification_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  resolved_signer public.governance_public_audit_verifier_mirror_directory_signers%ROWTYPE;
  policy_record RECORD;
  normalized_decision text;
  inserted_id uuid;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to record verifier mirror policy ratifications';
  END IF;

  SELECT *
  INTO resolved_signer
  FROM public.governance_public_audit_verifier_mirror_directory_signers AS signer
  WHERE signer.signer_key = btrim(coalesce(signer_key, ''))
    AND signer.is_active = true
  ORDER BY signer.updated_at DESC, signer.created_at DESC, signer.id DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Verifier mirror directory signer not found or inactive';
  END IF;

  SELECT *
  INTO policy_record
  FROM public.governance_public_audit_verifier_mirror_policy_hash(requested_policy_key)
  LIMIT 1;

  normalized_decision := lower(coalesce(nullif(btrim(coalesce(ratification_decision, '')), ''), ''));
  IF normalized_decision NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Ratification decision must be approve or reject';
  END IF;

  INSERT INTO public.governance_public_audit_verifier_mirror_policy_ratifications (
    policy_key,
    policy_hash,
    signer_id,
    signer_key,
    ratification_decision,
    ratification_signature,
    ratification_payload,
    ratified_at,
    ratified_by
  )
  VALUES (
    policy_record.policy_key,
    policy_record.policy_hash,
    resolved_signer.id,
    resolved_signer.signer_key,
    normalized_decision,
    btrim(coalesce(ratification_signature, '')),
    coalesce(ratification_payload, '{}'::jsonb),
    now(),
    public.current_profile_id()
  )
  ON CONFLICT (policy_key, policy_hash, signer_id) DO UPDATE
    SET signer_key = excluded.signer_key,
        ratification_decision = excluded.ratification_decision,
        ratification_signature = excluded.ratification_signature,
        ratification_payload = excluded.ratification_payload,
        ratified_at = now(),
        ratified_by = public.current_profile_id()
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_public_audit_verifier_mirror_policy_ratification_summary(
  requested_policy_key text DEFAULT 'default'
)
RETURNS TABLE (
  policy_key text,
  policy_hash text,
  require_policy_ratification boolean,
  min_policy_ratification_approvals integer,
  required_independent_signers integer,
  approval_count integer,
  independent_approval_count integer,
  community_approval_count integer,
  reject_count integer,
  ratification_met boolean,
  latest_ratified_at timestamptz
) AS $$
WITH policy_hash AS (
  SELECT *
  FROM public.governance_public_audit_verifier_mirror_policy_hash(requested_policy_key)
),
ratifications AS (
  SELECT
    ratification.ratification_decision,
    ratification.ratified_at,
    signer.trust_tier
  FROM policy_hash
  LEFT JOIN public.governance_public_audit_verifier_mirror_policy_ratifications AS ratification
    ON ratification.policy_key = policy_hash.policy_key
   AND ratification.policy_hash = policy_hash.policy_hash
  LEFT JOIN public.governance_public_audit_verifier_mirror_directory_signers AS signer
    ON signer.id = ratification.signer_id
)
SELECT
  policy_hash.policy_key,
  policy_hash.policy_hash,
  policy_hash.require_policy_ratification,
  policy_hash.min_policy_ratification_approvals,
  policy_hash.min_independent_directory_signers AS required_independent_signers,
  coalesce(count(*) FILTER (WHERE ratifications.ratification_decision = 'approve'), 0)::integer AS approval_count,
  coalesce(count(*) FILTER (
    WHERE ratifications.ratification_decision = 'approve'
      AND coalesce(ratifications.trust_tier, 'observer') = 'independent'
  ), 0)::integer AS independent_approval_count,
  coalesce(count(*) FILTER (
    WHERE ratifications.ratification_decision = 'approve'
      AND coalesce(ratifications.trust_tier, 'observer') = 'community'
  ), 0)::integer AS community_approval_count,
  coalesce(count(*) FILTER (WHERE ratifications.ratification_decision = 'reject'), 0)::integer AS reject_count,
  (
    policy_hash.require_policy_ratification = false
    OR (
      coalesce(count(*) FILTER (
        WHERE ratifications.ratification_decision = 'approve'
          AND coalesce(ratifications.trust_tier, 'observer') = 'independent'
      ), 0) >= greatest(1, policy_hash.min_policy_ratification_approvals)
      AND coalesce(count(*) FILTER (WHERE ratifications.ratification_decision = 'approve'), 0) > 0
    )
  ) AS ratification_met,
  max(ratifications.ratified_at) AS latest_ratified_at
FROM policy_hash
LEFT JOIN ratifications ON true
GROUP BY
  policy_hash.policy_key,
  policy_hash.policy_hash,
  policy_hash.require_policy_ratification,
  policy_hash.min_policy_ratification_approvals,
  policy_hash.min_independent_directory_signers;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS public.governance_public_audit_client_verifier_bundle(uuid, integer);
CREATE FUNCTION public.governance_public_audit_client_verifier_bundle(
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
    1::integer AS min_independent_directory_signers,
    false AS require_policy_ratification,
    1::integer AS min_policy_ratification_approvals,
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
  CROSS JOIN resolved_batch
  WHERE resolved_batch.batch_id IS NULL
     OR directory.batch_id = resolved_batch.batch_id
  ORDER BY directory.published_at DESC, directory.created_at DESC
  LIMIT 1
),
directory_trust_summary AS (
  SELECT *
  FROM public.governance_public_audit_verifier_mirror_directory_trust_summary((SELECT batch_id FROM resolved_batch))
),
policy_ratification_summary AS (
  SELECT *
  FROM public.governance_public_audit_verifier_mirror_policy_ratification_summary('default')
),
discovery_summary AS (
  SELECT *
  FROM public.governance_public_audit_verifier_mirror_discovery_summary((SELECT batch_id FROM resolved_batch), 24)
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
    ), '{}'::jsonb),
    'signed_directory_trust', coalesce((
      SELECT to_jsonb(row_data)
      FROM directory_trust_summary AS row_data
      LIMIT 1
    ), '{}'::jsonb),
    'policy_ratification', coalesce((
      SELECT to_jsonb(row_data)
      FROM policy_ratification_summary AS row_data
      LIMIT 1
    ), '{}'::jsonb),
    'discovery_summary', coalesce((
      SELECT to_jsonb(row_data)
      FROM discovery_summary AS row_data
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
    extensions.digest(
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
    AND coalesce((payload_cte.bundle_payload #>> '{signed_directory_trust,trust_quorum_met}')::boolean, false)
    AND (
      NOT coalesce((payload_cte.bundle_payload #>> '{failover_policy,require_policy_ratification}')::boolean, false)
      OR coalesce((payload_cte.bundle_payload #>> '{policy_ratification,ratification_met}')::boolean, false)
    )
  ) AS quorum_met
FROM payload_cte
CROSS JOIN healthy_mirror_count_cte;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

GRANT SELECT, INSERT, UPDATE ON public.governance_public_audit_verifier_mirror_discovery_sources TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.governance_public_audit_verifier_mirror_discovery_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.governance_public_audit_verifier_mirror_discovered_candidates TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.governance_public_audit_verifier_mirror_policy_ratifications TO authenticated;

GRANT EXECUTE ON FUNCTION public.register_governance_public_audit_verifier_mirror_discovery_source(text, text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_governance_public_audit_verifier_mirror_discovery_run(uuid, uuid, text, integer, integer, integer, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_governance_public_audit_verifier_mirror_discovered_candidate(uuid, text, text, text, text, text, text, text, text, numeric, text, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_verifier_mirror_discovery_source_board(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_verifier_mirror_discovered_candidate_board(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_governance_public_audit_verifier_mirror_discovered_candidate(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_verifier_mirror_discovery_summary(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_governance_public_audit_verifier_mirror_policy_ratification_requirement(text, boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_verifier_mirror_policy_hash(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_governance_public_audit_verifier_mirror_policy_ratification(text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_verifier_mirror_policy_ratification_summary(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_verifier_mirror_failover_policy_summary(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_client_verifier_bundle(uuid, integer) TO authenticated;

ALTER TABLE public.governance_public_audit_verifier_mirror_discovery_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_public_audit_verifier_mirror_discovery_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_public_audit_verifier_mirror_discovered_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_public_audit_verifier_mirror_policy_ratifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Verifier mirror discovery sources are readable by authenticated users" ON public.governance_public_audit_verifier_mirror_discovery_sources;
CREATE POLICY "Verifier mirror discovery sources are readable by authenticated users" ON public.governance_public_audit_verifier_mirror_discovery_sources
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Verifier mirror discovery sources are manageable by verifier stewards" ON public.governance_public_audit_verifier_mirror_discovery_sources;
CREATE POLICY "Verifier mirror discovery sources are manageable by verifier stewards" ON public.governance_public_audit_verifier_mirror_discovery_sources
  FOR ALL USING (public.current_profile_can_manage_public_audit_verifiers())
  WITH CHECK (public.current_profile_can_manage_public_audit_verifiers());

DROP POLICY IF EXISTS "Verifier mirror discovery runs are readable by authenticated users" ON public.governance_public_audit_verifier_mirror_discovery_runs;
CREATE POLICY "Verifier mirror discovery runs are readable by authenticated users" ON public.governance_public_audit_verifier_mirror_discovery_runs
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Verifier mirror discovery runs are manageable by verifier stewards" ON public.governance_public_audit_verifier_mirror_discovery_runs;
CREATE POLICY "Verifier mirror discovery runs are manageable by verifier stewards" ON public.governance_public_audit_verifier_mirror_discovery_runs
  FOR ALL USING (public.current_profile_can_manage_public_audit_verifiers())
  WITH CHECK (public.current_profile_can_manage_public_audit_verifiers());

DROP POLICY IF EXISTS "Verifier mirror discovered candidates are readable by authenticated users" ON public.governance_public_audit_verifier_mirror_discovered_candidates;
CREATE POLICY "Verifier mirror discovered candidates are readable by authenticated users" ON public.governance_public_audit_verifier_mirror_discovered_candidates
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Verifier mirror discovered candidates are manageable by verifier stewards" ON public.governance_public_audit_verifier_mirror_discovered_candidates;
CREATE POLICY "Verifier mirror discovered candidates are manageable by verifier stewards" ON public.governance_public_audit_verifier_mirror_discovered_candidates
  FOR ALL USING (public.current_profile_can_manage_public_audit_verifiers())
  WITH CHECK (public.current_profile_can_manage_public_audit_verifiers());

DROP POLICY IF EXISTS "Verifier mirror policy ratifications are readable by authenticated users" ON public.governance_public_audit_verifier_mirror_policy_ratifications;
CREATE POLICY "Verifier mirror policy ratifications are readable by authenticated users" ON public.governance_public_audit_verifier_mirror_policy_ratifications
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Verifier mirror policy ratifications are manageable by verifier stewards" ON public.governance_public_audit_verifier_mirror_policy_ratifications;
CREATE POLICY "Verifier mirror policy ratifications are manageable by verifier stewards" ON public.governance_public_audit_verifier_mirror_policy_ratifications
  FOR ALL USING (public.current_profile_can_manage_public_audit_verifiers())
  WITH CHECK (public.current_profile_can_manage_public_audit_verifiers());
