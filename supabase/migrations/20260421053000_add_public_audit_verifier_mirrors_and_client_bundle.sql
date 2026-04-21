CREATE TABLE IF NOT EXISTS public.governance_public_audit_verifier_mirrors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mirror_key text NOT NULL UNIQUE,
  mirror_label text,
  endpoint_url text NOT NULL,
  mirror_type text NOT NULL DEFAULT 'https_gateway',
  region_code text NOT NULL DEFAULT 'GLOBAL',
  jurisdiction_country_code text NOT NULL DEFAULT '',
  operator_label text NOT NULL DEFAULT 'unspecified',
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  added_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_public_audit_verifier_mirrors_mirror_key_not_empty_check CHECK (length(trim(mirror_key)) > 0),
  CONSTRAINT governance_public_audit_verifier_mirrors_endpoint_not_empty_check CHECK (length(trim(endpoint_url)) > 0),
  CONSTRAINT governance_public_audit_verifier_mirrors_type_not_empty_check CHECK (length(trim(mirror_type)) > 0),
  CONSTRAINT governance_public_audit_verifier_mirrors_region_not_empty_check CHECK (length(trim(region_code)) > 0),
  CONSTRAINT governance_public_audit_verifier_mirrors_operator_not_empty_check CHECK (length(trim(operator_label)) > 0),
  CONSTRAINT governance_public_audit_verifier_mirrors_country_code_check CHECK (
    jurisdiction_country_code = '' OR length(jurisdiction_country_code) = 2
  ),
  CONSTRAINT governance_public_audit_verifier_mirrors_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE IF NOT EXISTS public.governance_public_audit_verifier_mirror_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mirror_id uuid NOT NULL REFERENCES public.governance_public_audit_verifier_mirrors(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.governance_public_audit_batches(id) ON DELETE SET NULL,
  check_status text NOT NULL,
  latency_ms integer,
  observed_batch_hash text,
  error_message text,
  check_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  checked_at timestamptz NOT NULL DEFAULT now(),
  checked_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_public_audit_verifier_mirror_checks_status_check CHECK (
    check_status IN ('ok', 'degraded', 'failed')
  ),
  CONSTRAINT governance_public_audit_verifier_mirror_checks_latency_check CHECK (
    latency_ms IS NULL OR latency_ms >= 0
  ),
  CONSTRAINT governance_public_audit_verifier_mirror_checks_hash_not_empty_check CHECK (
    observed_batch_hash IS NULL OR length(trim(observed_batch_hash)) > 0
  ),
  CONSTRAINT governance_public_audit_verifier_mirror_checks_error_not_empty_check CHECK (
    error_message IS NULL OR length(trim(error_message)) > 0
  ),
  CONSTRAINT governance_public_audit_verifier_mirror_checks_payload_object_check CHECK (jsonb_typeof(check_payload) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_verifier_mirrors_active
  ON public.governance_public_audit_verifier_mirrors (is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_verifier_mirror_checks_mirror_checked
  ON public.governance_public_audit_verifier_mirror_checks (mirror_id, checked_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_verifier_mirror_checks_batch_checked
  ON public.governance_public_audit_verifier_mirror_checks (batch_id, checked_at DESC, created_at DESC);

DO $$
BEGIN
  CREATE TRIGGER update_governance_public_audit_verifier_mirrors_updated_at
    BEFORE UPDATE ON public.governance_public_audit_verifier_mirrors
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_governance_public_audit_verifier_mirror_checks_updated_at
    BEFORE UPDATE ON public.governance_public_audit_verifier_mirror_checks
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.register_governance_public_audit_verifier_mirror(
  mirror_key text,
  mirror_label text DEFAULT NULL,
  endpoint_url text DEFAULT NULL,
  mirror_type text DEFAULT 'https_gateway',
  region_code text DEFAULT 'GLOBAL',
  jurisdiction_country_code text DEFAULT '',
  operator_label text DEFAULT 'unspecified',
  metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  inserted_id uuid;
  normalized_country_code text;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to manage public audit verifier mirrors';
  END IF;

  normalized_country_code := upper(coalesce(nullif(btrim(coalesce(jurisdiction_country_code, '')), ''), ''));

  INSERT INTO public.governance_public_audit_verifier_mirrors (
    mirror_key,
    mirror_label,
    endpoint_url,
    mirror_type,
    region_code,
    jurisdiction_country_code,
    operator_label,
    is_active,
    metadata,
    added_by
  )
  VALUES (
    btrim(coalesce(mirror_key, '')),
    nullif(btrim(coalesce(mirror_label, '')), ''),
    btrim(coalesce(endpoint_url, '')),
    lower(coalesce(nullif(btrim(coalesce(mirror_type, '')), ''), 'https_gateway')),
    upper(coalesce(nullif(btrim(coalesce(region_code, '')), ''), 'GLOBAL')),
    normalized_country_code,
    coalesce(nullif(btrim(coalesce(operator_label, '')), ''), 'unspecified'),
    true,
    coalesce(metadata, '{}'::jsonb),
    public.current_profile_id()
  )
  ON CONFLICT (mirror_key) DO UPDATE
    SET mirror_label = excluded.mirror_label,
        endpoint_url = excluded.endpoint_url,
        mirror_type = excluded.mirror_type,
        region_code = excluded.region_code,
        jurisdiction_country_code = excluded.jurisdiction_country_code,
        operator_label = excluded.operator_label,
        is_active = true,
        metadata = coalesce(public.governance_public_audit_verifier_mirrors.metadata, '{}'::jsonb) || coalesce(excluded.metadata, '{}'::jsonb)
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.record_governance_public_audit_verifier_mirror_check(
  target_mirror_id uuid,
  check_status text,
  target_batch_id uuid DEFAULT NULL,
  latency_ms integer DEFAULT NULL,
  observed_batch_hash text DEFAULT NULL,
  error_message text DEFAULT NULL,
  check_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  inserted_id uuid;
  normalized_status text;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to record verifier mirror checks';
  END IF;

  normalized_status := lower(btrim(coalesce(check_status, '')));
  IF normalized_status NOT IN ('ok', 'degraded', 'failed') THEN
    RAISE EXCEPTION 'Mirror check status must be ok, degraded, or failed';
  END IF;

  IF target_mirror_id IS NULL THEN
    RAISE EXCEPTION 'Mirror id is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.governance_public_audit_verifier_mirrors AS mirror
    WHERE mirror.id = target_mirror_id
      AND mirror.is_active = true
  ) THEN
    RAISE EXCEPTION 'Verifier mirror is not active';
  END IF;

  IF target_batch_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.governance_public_audit_batches AS batch
       WHERE batch.id = target_batch_id
     )
  THEN
    RAISE EXCEPTION 'Public audit batch does not exist';
  END IF;

  INSERT INTO public.governance_public_audit_verifier_mirror_checks (
    mirror_id,
    batch_id,
    check_status,
    latency_ms,
    observed_batch_hash,
    error_message,
    check_payload,
    checked_at,
    checked_by
  )
  VALUES (
    target_mirror_id,
    target_batch_id,
    normalized_status,
    latency_ms,
    nullif(btrim(coalesce(observed_batch_hash, '')), ''),
    nullif(btrim(coalesce(error_message, '')), ''),
    coalesce(check_payload, '{}'::jsonb),
    now(),
    public.current_profile_id()
  )
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_public_audit_verifier_mirror_health_summary(
  requested_batch_id uuid DEFAULT NULL,
  stale_after_minutes integer DEFAULT 90
)
RETURNS TABLE (
  mirror_id uuid,
  mirror_key text,
  mirror_label text,
  endpoint_url text,
  mirror_type text,
  region_code text,
  jurisdiction_country_code text,
  operator_label text,
  is_active boolean,
  last_check_at timestamptz,
  last_check_status text,
  last_check_latency_ms integer,
  last_observed_batch_id uuid,
  last_observed_batch_hash text,
  last_error_message text,
  is_stale boolean,
  health_status text
) AS $$
WITH latest_checks AS (
  SELECT DISTINCT ON (check_row.mirror_id)
    check_row.mirror_id,
    check_row.batch_id,
    check_row.check_status,
    check_row.latency_ms,
    check_row.observed_batch_hash,
    check_row.error_message,
    check_row.checked_at
  FROM public.governance_public_audit_verifier_mirror_checks AS check_row
  WHERE requested_batch_id IS NULL
     OR check_row.batch_id = requested_batch_id
  ORDER BY check_row.mirror_id, check_row.checked_at DESC, check_row.created_at DESC
),
config AS (
  SELECT greatest(1, coalesce(stale_after_minutes, 90))::integer AS stale_after_minutes
)
SELECT
  mirror.id AS mirror_id,
  mirror.mirror_key,
  mirror.mirror_label,
  mirror.endpoint_url,
  mirror.mirror_type,
  mirror.region_code,
  mirror.jurisdiction_country_code,
  mirror.operator_label,
  mirror.is_active,
  latest_checks.checked_at AS last_check_at,
  latest_checks.check_status AS last_check_status,
  latest_checks.latency_ms AS last_check_latency_ms,
  latest_checks.batch_id AS last_observed_batch_id,
  latest_checks.observed_batch_hash AS last_observed_batch_hash,
  latest_checks.error_message AS last_error_message,
  (
    latest_checks.checked_at IS NULL
    OR latest_checks.checked_at < (now() - make_interval(mins => config.stale_after_minutes))
  ) AS is_stale,
  CASE
    WHEN mirror.is_active = false THEN 'inactive'
    WHEN latest_checks.checked_at IS NULL THEN 'unknown'
    WHEN latest_checks.checked_at < (now() - make_interval(mins => config.stale_after_minutes)) THEN 'critical'
    WHEN latest_checks.check_status = 'ok' THEN 'healthy'
    WHEN latest_checks.check_status = 'degraded' THEN 'degraded'
    ELSE 'critical'
  END AS health_status
FROM public.governance_public_audit_verifier_mirrors AS mirror
LEFT JOIN latest_checks
  ON latest_checks.mirror_id = mirror.id
CROSS JOIN config
ORDER BY mirror.is_active DESC, mirror.created_at ASC;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

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
  ORDER BY is_active DESC, last_check_at DESC NULLS LAST, mirror_key ASC
  LIMIT greatest(1, coalesce(max_mirrors, 8))
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
payload_cte AS (
  SELECT jsonb_build_object(
    'bundle_version', 'public_audit_client_verifier_bundle_v1',
    'generated_at', now(),
    'batch', coalesce((SELECT to_jsonb(row_data) FROM batch_snapshot AS row_data), '{}'::jsonb),
    'verifier_summary', coalesce((SELECT to_jsonb(row_data) FROM verifier_summary AS row_data), '{}'::jsonb),
    'mirrors', coalesce((
      SELECT jsonb_agg(to_jsonb(row_data) ORDER BY row_data.last_check_at DESC NULLS LAST, row_data.mirror_key ASC)
      FROM mirror_health AS row_data
    ), '[]'::jsonb),
    'network_proofs', coalesce((
      SELECT jsonb_agg(to_jsonb(row_data) ORDER BY row_data.recorded_at DESC, row_data.id DESC)
      FROM network_proofs AS row_data
    ), '[]'::jsonb)
  ) AS bundle_payload
),
healthy_mirror_count_cte AS (
  SELECT coalesce(count(*) FILTER (WHERE mirror.health_status = 'healthy'), 0)::integer AS healthy_mirror_count
  FROM mirror_health AS mirror
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
    AND coalesce(healthy_mirror_count_cte.healthy_mirror_count, 0) > 0
  ) AS quorum_met
FROM payload_cte
CROSS JOIN healthy_mirror_count_cte;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

GRANT SELECT, INSERT, UPDATE ON public.governance_public_audit_verifier_mirrors TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.governance_public_audit_verifier_mirror_checks TO authenticated;

GRANT EXECUTE ON FUNCTION public.register_governance_public_audit_verifier_mirror(text, text, text, text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_governance_public_audit_verifier_mirror_check(uuid, text, uuid, integer, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_verifier_mirror_health_summary(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_client_verifier_bundle(uuid, integer) TO authenticated;

ALTER TABLE public.governance_public_audit_verifier_mirrors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_public_audit_verifier_mirror_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public audit verifier mirrors are readable by authenticated users" ON public.governance_public_audit_verifier_mirrors;
CREATE POLICY "Public audit verifier mirrors are readable by authenticated users" ON public.governance_public_audit_verifier_mirrors
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Public audit verifier mirrors are manageable by verifier stewards" ON public.governance_public_audit_verifier_mirrors;
CREATE POLICY "Public audit verifier mirrors are manageable by verifier stewards" ON public.governance_public_audit_verifier_mirrors
  FOR ALL USING (public.current_profile_can_manage_public_audit_verifiers())
  WITH CHECK (public.current_profile_can_manage_public_audit_verifiers());

DROP POLICY IF EXISTS "Public audit verifier mirror checks are readable by authenticated users" ON public.governance_public_audit_verifier_mirror_checks;
CREATE POLICY "Public audit verifier mirror checks are readable by authenticated users" ON public.governance_public_audit_verifier_mirror_checks
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Public audit verifier mirror checks are manageable by verifier stewards" ON public.governance_public_audit_verifier_mirror_checks;
CREATE POLICY "Public audit verifier mirror checks are manageable by verifier stewards" ON public.governance_public_audit_verifier_mirror_checks
  FOR ALL USING (public.current_profile_can_manage_public_audit_verifiers())
  WITH CHECK (public.current_profile_can_manage_public_audit_verifiers());
