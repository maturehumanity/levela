DO $$
BEGIN
  CREATE TYPE public.activation_demographic_feed_worker_status AS ENUM (
    'ingested',
    'signature_failed',
    'fetch_failed',
    'invalid_payload',
    'ingestion_failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.activation_demographic_feed_alert_type AS ENUM (
    'freshness',
    'signature_failure',
    'connectivity',
    'payload'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.activation_demographic_feed_worker_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adapter_id uuid NOT NULL REFERENCES public.activation_demographic_feed_adapters(id) ON DELETE CASCADE,
  run_status public.activation_demographic_feed_worker_status NOT NULL,
  alert_type public.activation_demographic_feed_alert_type NOT NULL,
  alert_severity text NOT NULL DEFAULT 'warning',
  alert_message text NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  payload_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activation_demographic_feed_worker_runs_alert_severity_check CHECK (
    alert_severity IN ('info', 'warning', 'critical')
  ),
  CONSTRAINT activation_demographic_feed_worker_runs_alert_message_not_empty CHECK (
    length(trim(alert_message)) > 0
  ),
  CONSTRAINT activation_demographic_feed_worker_runs_payload_hash_not_empty CHECK (
    payload_hash IS NULL OR length(trim(payload_hash)) > 0
  ),
  CONSTRAINT activation_demographic_feed_worker_runs_metadata_object_check CHECK (
    jsonb_typeof(metadata) = 'object'
  )
);

CREATE INDEX IF NOT EXISTS idx_activation_demographic_feed_worker_runs_adapter_observed
  ON public.activation_demographic_feed_worker_runs (adapter_id, observed_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activation_demographic_feed_worker_runs_open_alerts
  ON public.activation_demographic_feed_worker_runs (adapter_id, alert_type, resolved_at, observed_at DESC)
  WHERE resolved_at IS NULL;

DO $$
BEGIN
  CREATE TRIGGER update_activation_demographic_feed_worker_runs_updated_at
    BEFORE UPDATE ON public.activation_demographic_feed_worker_runs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.current_profile_can_manage_activation_demographic_feed_workers()
RETURNS boolean AS $$
  SELECT coalesce(
    public.current_profile_can_manage_activation_demographic_feeds()
    OR auth.role() = 'service_role',
    false
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.record_activation_demographic_feed_worker_run(
  target_adapter_id uuid,
  worker_status public.activation_demographic_feed_worker_status,
  worker_alert_type public.activation_demographic_feed_alert_type,
  worker_alert_severity text DEFAULT 'warning',
  worker_message text DEFAULT NULL,
  worker_observed_at timestamptz DEFAULT now(),
  worker_payload_hash text DEFAULT NULL,
  worker_metadata jsonb DEFAULT '{}'::jsonb,
  worker_resolved_at timestamptz DEFAULT NULL,
  actor_profile_id uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  normalized_severity text;
  normalized_message text;
  inserted_id uuid;
BEGIN
  IF NOT public.current_profile_can_manage_activation_demographic_feed_workers() THEN
    RAISE EXCEPTION 'Current caller is not authorized to record activation demographic feed worker runs';
  END IF;

  IF target_adapter_id IS NULL THEN
    RAISE EXCEPTION 'Adapter id is required for worker run recording';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.activation_demographic_feed_adapters AS adapter
    WHERE adapter.id = target_adapter_id
  ) THEN
    RAISE EXCEPTION 'Activation demographic feed adapter does not exist';
  END IF;

  normalized_severity := lower(btrim(coalesce(worker_alert_severity, 'warning')));
  IF normalized_severity NOT IN ('info', 'warning', 'critical') THEN
    RAISE EXCEPTION 'Worker alert severity must be one of info, warning, or critical';
  END IF;

  normalized_message := nullif(btrim(coalesce(worker_message, '')), '');
  IF normalized_message IS NULL THEN
    normalized_message := CASE worker_status
      WHEN 'ingested'::public.activation_demographic_feed_worker_status THEN 'Feed worker ingestion completed'
      WHEN 'signature_failed'::public.activation_demographic_feed_worker_status THEN 'Feed worker signature verification failed'
      WHEN 'fetch_failed'::public.activation_demographic_feed_worker_status THEN 'Feed worker endpoint fetch failed'
      WHEN 'invalid_payload'::public.activation_demographic_feed_worker_status THEN 'Feed worker payload was invalid'
      WHEN 'ingestion_failed'::public.activation_demographic_feed_worker_status THEN 'Feed worker ingestion request failed'
      ELSE 'Feed worker run recorded'
    END;
  END IF;

  INSERT INTO public.activation_demographic_feed_worker_runs (
    adapter_id,
    run_status,
    alert_type,
    alert_severity,
    alert_message,
    observed_at,
    payload_hash,
    metadata,
    resolved_at,
    created_by
  )
  VALUES (
    target_adapter_id,
    worker_status,
    worker_alert_type,
    normalized_severity,
    normalized_message,
    coalesce(worker_observed_at, now()),
    nullif(btrim(coalesce(worker_payload_hash, '')), ''),
    coalesce(worker_metadata, '{}'::jsonb),
    worker_resolved_at,
    coalesce(actor_profile_id, public.current_profile_id())
  )
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.resolve_activation_demographic_feed_worker_alerts(
  target_adapter_id uuid,
  target_alert_type public.activation_demographic_feed_alert_type DEFAULT NULL
)
RETURNS integer AS $$
DECLARE
  updated_count integer := 0;
BEGIN
  IF NOT public.current_profile_can_manage_activation_demographic_feed_workers() THEN
    RAISE EXCEPTION 'Current caller is not authorized to resolve activation demographic feed worker alerts';
  END IF;

  UPDATE public.activation_demographic_feed_worker_runs
  SET resolved_at = now()
  WHERE adapter_id = target_adapter_id
    AND resolved_at IS NULL
    AND run_status <> 'ingested'::public.activation_demographic_feed_worker_status
    AND (
      target_alert_type IS NULL
      OR alert_type = target_alert_type
    );

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.activation_demographic_feed_worker_alert_summary(
  requested_freshness_hours integer DEFAULT 24
)
RETURNS TABLE (
  adapter_id uuid,
  adapter_key text,
  adapter_name text,
  scope_type public.activation_scope_type,
  country_code text,
  last_ingested_at timestamptz,
  freshness_alert boolean,
  stale_by_hours integer,
  signature_failure_count integer,
  connectivity_failure_count integer,
  payload_failure_count integer,
  latest_run_status public.activation_demographic_feed_worker_status,
  latest_run_message text,
  latest_run_at timestamptz
) AS $$
WITH active_adapters AS (
  SELECT
    adapter.id,
    adapter.adapter_key,
    adapter.adapter_name,
    adapter.scope_type,
    adapter.country_code,
    adapter.last_ingested_at,
    adapter.updated_at,
    adapter.created_at
  FROM public.activation_demographic_feed_adapters AS adapter
  WHERE adapter.is_active = true
),
latest_runs AS (
  SELECT DISTINCT ON (run.adapter_id)
    run.adapter_id,
    run.run_status,
    run.alert_message,
    run.observed_at
  FROM public.activation_demographic_feed_worker_runs AS run
  ORDER BY run.adapter_id, run.observed_at DESC, run.created_at DESC, run.id DESC
),
open_alert_counts AS (
  SELECT
    run.adapter_id,
    coalesce(count(*) FILTER (
      WHERE run.resolved_at IS NULL
        AND run.alert_type = 'signature_failure'::public.activation_demographic_feed_alert_type
    ), 0)::integer AS signature_failure_count,
    coalesce(count(*) FILTER (
      WHERE run.resolved_at IS NULL
        AND run.alert_type = 'connectivity'::public.activation_demographic_feed_alert_type
    ), 0)::integer AS connectivity_failure_count,
    coalesce(count(*) FILTER (
      WHERE run.resolved_at IS NULL
        AND run.alert_type = 'payload'::public.activation_demographic_feed_alert_type
    ), 0)::integer AS payload_failure_count
  FROM public.activation_demographic_feed_worker_runs AS run
  GROUP BY run.adapter_id
),
freshness AS (
  SELECT greatest(1, coalesce(requested_freshness_hours, 24))::integer AS freshness_hours
)
SELECT
  adapter.id AS adapter_id,
  adapter.adapter_key,
  adapter.adapter_name,
  adapter.scope_type,
  adapter.country_code,
  adapter.last_ingested_at,
  (
    adapter.last_ingested_at IS NULL
    OR adapter.last_ingested_at < (now() - make_interval(hours => freshness.freshness_hours))
  ) AS freshness_alert,
  CASE
    WHEN adapter.last_ingested_at IS NULL THEN NULL
    WHEN adapter.last_ingested_at < (now() - make_interval(hours => freshness.freshness_hours)) THEN
      floor(extract(epoch FROM (now() - adapter.last_ingested_at)) / 3600)::integer
    ELSE NULL
  END AS stale_by_hours,
  coalesce(alert_counts.signature_failure_count, 0) AS signature_failure_count,
  coalesce(alert_counts.connectivity_failure_count, 0) AS connectivity_failure_count,
  coalesce(alert_counts.payload_failure_count, 0) AS payload_failure_count,
  latest.run_status AS latest_run_status,
  latest.alert_message AS latest_run_message,
  latest.observed_at AS latest_run_at
FROM active_adapters AS adapter
CROSS JOIN freshness
LEFT JOIN latest_runs AS latest
  ON latest.adapter_id = adapter.id
LEFT JOIN open_alert_counts AS alert_counts
  ON alert_counts.adapter_id = adapter.id
ORDER BY
  freshness_alert DESC,
  coalesce(alert_counts.signature_failure_count, 0) DESC,
  coalesce(alert_counts.connectivity_failure_count, 0) DESC,
  coalesce(alert_counts.payload_failure_count, 0) DESC,
  adapter.updated_at DESC NULLS LAST,
  adapter.created_at DESC NULLS LAST;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

GRANT SELECT, INSERT, UPDATE ON public.activation_demographic_feed_worker_runs TO authenticated;

GRANT EXECUTE ON FUNCTION public.current_profile_can_manage_activation_demographic_feed_workers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_activation_demographic_feed_worker_run(
  uuid,
  public.activation_demographic_feed_worker_status,
  public.activation_demographic_feed_alert_type,
  text,
  text,
  timestamptz,
  text,
  jsonb,
  timestamptz,
  uuid
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_activation_demographic_feed_worker_alerts(
  uuid,
  public.activation_demographic_feed_alert_type
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activation_demographic_feed_worker_alert_summary(integer) TO authenticated;

ALTER TABLE public.activation_demographic_feed_worker_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Activation feed worker runs are readable by authenticated users" ON public.activation_demographic_feed_worker_runs;
CREATE POLICY "Activation feed worker runs are readable by authenticated users" ON public.activation_demographic_feed_worker_runs
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Activation feed worker runs are manageable by worker stewards" ON public.activation_demographic_feed_worker_runs;
CREATE POLICY "Activation feed worker runs are manageable by worker stewards" ON public.activation_demographic_feed_worker_runs
  FOR INSERT WITH CHECK (public.current_profile_can_manage_activation_demographic_feed_workers());

DROP POLICY IF EXISTS "Activation feed worker runs are updatable by worker stewards" ON public.activation_demographic_feed_worker_runs;
CREATE POLICY "Activation feed worker runs are updatable by worker stewards" ON public.activation_demographic_feed_worker_runs
  FOR UPDATE USING (public.current_profile_can_manage_activation_demographic_feed_workers())
  WITH CHECK (public.current_profile_can_manage_activation_demographic_feed_workers());
