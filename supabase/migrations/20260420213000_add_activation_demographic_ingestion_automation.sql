CREATE TABLE IF NOT EXISTS public.activation_demographic_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type public.activation_scope_type NOT NULL,
  country_code text NOT NULL DEFAULT '',
  jurisdiction_label text NOT NULL DEFAULT '',
  target_population bigint NOT NULL,
  source_label text NOT NULL,
  source_url text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  ingestion_notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activation_demographic_snapshots_country_code_check CHECK (
    (scope_type = 'world'::public.activation_scope_type AND country_code = '')
    OR (scope_type = 'country'::public.activation_scope_type AND country_code <> '')
  ),
  CONSTRAINT activation_demographic_snapshots_target_population_check CHECK (
    target_population > 0
  ),
  CONSTRAINT activation_demographic_snapshots_source_label_check CHECK (
    length(trim(source_label)) > 0
  )
);

CREATE INDEX IF NOT EXISTS idx_activation_demographic_snapshots_scope_observed
  ON public.activation_demographic_snapshots (scope_type, country_code, observed_at DESC, created_at DESC);

DO $$
BEGIN
  CREATE TRIGGER update_activation_demographic_snapshots_updated_at
    BEFORE UPDATE ON public.activation_demographic_snapshots
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.sync_activation_demographic_snapshot_country_code()
RETURNS TRIGGER AS $$
BEGIN
  NEW.country_code := public.normalize_activation_scope_country_code(NEW.scope_type, NEW.country_code);
  NEW.jurisdiction_label := CASE
    WHEN NEW.scope_type = 'world'::public.activation_scope_type
      THEN coalesce(nullif(trim(NEW.jurisdiction_label), ''), 'World')
    ELSE coalesce(nullif(trim(NEW.jurisdiction_label), ''), NEW.country_code)
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS sync_activation_demographic_snapshot_country_code_trigger ON public.activation_demographic_snapshots;
CREATE TRIGGER sync_activation_demographic_snapshot_country_code_trigger
  BEFORE INSERT OR UPDATE OF scope_type, country_code, jurisdiction_label
  ON public.activation_demographic_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_activation_demographic_snapshot_country_code();

CREATE OR REPLACE FUNCTION public.capture_activation_demographic_snapshot(
  requested_scope_type public.activation_scope_type,
  requested_country_code text DEFAULT '',
  snapshot_source text DEFAULT 'manual_refresh',
  snapshot_notes text DEFAULT NULL,
  measured_by_profile_id uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  normalized_country_code text;
  normalized_jurisdiction_label text;
  latest_snapshot public.activation_demographic_snapshots%ROWTYPE;
  target_review public.activation_threshold_reviews%ROWTYPE;
  effective_target_population bigint;
  verified_count bigint;
  eligible_verified_count bigint;
  progress_percent numeric(7,4);
BEGIN
  normalized_country_code := public.normalize_activation_scope_country_code(requested_scope_type, requested_country_code);
  normalized_jurisdiction_label := CASE
    WHEN requested_scope_type = 'world'::public.activation_scope_type THEN 'World'
    ELSE normalized_country_code
  END;

  SELECT snapshot.*
  INTO latest_snapshot
  FROM public.activation_demographic_snapshots AS snapshot
  WHERE snapshot.scope_type = requested_scope_type
    AND snapshot.country_code = normalized_country_code
  ORDER BY snapshot.observed_at DESC, snapshot.created_at DESC, snapshot.id DESC
  LIMIT 1;

  SELECT review.*
  INTO target_review
  FROM public.activation_threshold_reviews AS review
  WHERE review.scope_type = requested_scope_type
    AND review.country_code = normalized_country_code
  LIMIT 1;

  IF target_review.id IS NULL THEN
    INSERT INTO public.activation_threshold_reviews (
      scope_type,
      country_code,
      jurisdiction_label,
      status,
      threshold_percent,
      target_population,
      opened_by,
      metadata
    )
    VALUES (
      requested_scope_type,
      normalized_country_code,
      normalized_jurisdiction_label,
      'pre_activation'::public.activation_review_status,
      51,
      latest_snapshot.target_population,
      measured_by_profile_id,
      jsonb_build_object(
        'source', 'activation_demographic_ingestion',
        'created_from_snapshot_id', latest_snapshot.id
      )
    )
    RETURNING * INTO target_review;
  END IF;

  SELECT count(*)::bigint
  INTO verified_count
  FROM public.profiles AS profile
  WHERE profile.deleted_at IS NULL
    AND coalesce(profile.is_verified, false) = true
    AND (
      requested_scope_type = 'world'::public.activation_scope_type
      OR upper(coalesce(profile.country_code, '')) = normalized_country_code
    );

  SELECT count(*)::bigint
  INTO eligible_verified_count
  FROM public.profiles AS profile
  WHERE profile.deleted_at IS NULL
    AND coalesce(profile.is_verified, false) = true
    AND profile.citizenship_status = 'citizen'::public.citizenship_status
    AND (
      requested_scope_type = 'world'::public.activation_scope_type
      OR upper(coalesce(profile.country_code, '')) = normalized_country_code
    );

  effective_target_population := coalesce(latest_snapshot.target_population, target_review.target_population);

  progress_percent := CASE
    WHEN effective_target_population IS NULL OR effective_target_population <= 0 THEN NULL
    ELSE round((eligible_verified_count::numeric / effective_target_population::numeric) * 100, 4)
  END;

  UPDATE public.activation_threshold_reviews
  SET
    jurisdiction_label = CASE
      WHEN nullif(trim(coalesce(jurisdiction_label, '')), '') IS NULL THEN normalized_jurisdiction_label
      ELSE jurisdiction_label
    END,
    target_population = effective_target_population,
    verified_citizens_count = verified_count,
    eligible_verified_citizens_count = eligible_verified_count,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'last_demographic_snapshot_id', latest_snapshot.id,
      'last_demographic_snapshot_observed_at', latest_snapshot.observed_at,
      'last_demographic_snapshot_source', latest_snapshot.source_label,
      'last_demographic_ingestion_source', coalesce(nullif(snapshot_source, ''), 'manual_refresh'),
      'last_demographic_ingestion_notes', snapshot_notes,
      'last_demographic_ingested_at', now(),
      'last_demographic_progress_percent', progress_percent
    )
  WHERE id = target_review.id
  RETURNING * INTO target_review;

  IF coalesce(nullif(snapshot_source, ''), 'manual_refresh') <> 'profile_demographic_change' THEN
    INSERT INTO public.activation_evidence (
      review_id,
      evidence_type,
      source_label,
      source_url,
      metric_key,
      metric_value,
      observed_at,
      notes,
      created_by,
      metadata
    )
    VALUES (
      target_review.id,
      'demographic_snapshot_ingested',
      coalesce(latest_snapshot.source_label, 'verified_profile_counts'),
      latest_snapshot.source_url,
      'eligible_verified_percent_of_target',
      progress_percent,
      coalesce(latest_snapshot.observed_at, now()),
      coalesce(snapshot_notes, 'Demographic threshold ingestion snapshot'),
      measured_by_profile_id,
      jsonb_build_object(
        'scope_type', requested_scope_type,
        'country_code', normalized_country_code,
        'verified_citizens_count', verified_count,
        'eligible_verified_citizens_count', eligible_verified_count,
        'target_population', effective_target_population,
        'demographic_snapshot_id', latest_snapshot.id,
        'snapshot_source', snapshot_source
      )
    );
  END IF;

  RETURN target_review.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.capture_scheduled_activation_demographic_snapshots(
  snapshot_source text DEFAULT 'scheduled_refresh',
  snapshot_notes text DEFAULT NULL
)
RETURNS integer AS $$
DECLARE
  scope_record record;
  captured_count integer := 0;
BEGIN
  FOR scope_record IN
    SELECT scope.scope_type, scope.country_code
    FROM (
      SELECT review.scope_type, review.country_code
      FROM public.activation_threshold_reviews AS review
      UNION
      SELECT snapshot.scope_type, snapshot.country_code
      FROM public.activation_demographic_snapshots AS snapshot
    ) AS scope
    ORDER BY scope.scope_type, scope.country_code
  LOOP
    PERFORM public.capture_activation_demographic_snapshot(
      scope_record.scope_type,
      scope_record.country_code,
      snapshot_source,
      snapshot_notes,
      NULL
    );
    captured_count := captured_count + 1;
  END LOOP;

  RETURN captured_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.refresh_activation_demographics_on_profile_change()
RETURNS TRIGGER AS $$
DECLARE
  old_country_code text;
  new_country_code text;
BEGIN
  IF TG_OP = 'UPDATE'
    AND NEW.is_verified IS NOT DISTINCT FROM OLD.is_verified
    AND NEW.citizenship_status IS NOT DISTINCT FROM OLD.citizenship_status
    AND upper(coalesce(NEW.country_code, '')) IS NOT DISTINCT FROM upper(coalesce(OLD.country_code, ''))
    AND NEW.deleted_at IS NOT DISTINCT FROM OLD.deleted_at
  THEN
    RETURN NEW;
  END IF;

  old_country_code := CASE
    WHEN TG_OP IN ('UPDATE', 'DELETE') THEN upper(coalesce(OLD.country_code, ''))
    ELSE NULL
  END;

  new_country_code := CASE
    WHEN TG_OP IN ('INSERT', 'UPDATE') THEN upper(coalesce(NEW.country_code, ''))
    ELSE NULL
  END;

  PERFORM public.capture_activation_demographic_snapshot(
    'world'::public.activation_scope_type,
    '',
    'profile_demographic_change',
    'Auto-refresh after profile demographic change',
    NULL
  );

  IF old_country_code IS NOT NULL AND old_country_code <> '' THEN
    PERFORM public.capture_activation_demographic_snapshot(
      'country'::public.activation_scope_type,
      old_country_code,
      'profile_demographic_change',
      'Auto-refresh after profile demographic change',
      NULL
    );
  END IF;

  IF new_country_code IS NOT NULL AND new_country_code <> '' AND new_country_code IS DISTINCT FROM old_country_code THEN
    PERFORM public.capture_activation_demographic_snapshot(
      'country'::public.activation_scope_type,
      new_country_code,
      'profile_demographic_change',
      'Auto-refresh after profile demographic change',
      NULL
    );
  END IF;

  RETURN coalesce(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS refresh_activation_demographics_on_profile_change_trigger ON public.profiles;
CREATE TRIGGER refresh_activation_demographics_on_profile_change_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_activation_demographics_on_profile_change();

DO $$
BEGIN
  IF to_regnamespace('cron') IS NOT NULL THEN
    BEGIN
      EXECUTE $cron$
        SELECT cron.unschedule(job.jobid)
        FROM cron.job
        WHERE job.jobname = 'activation_demographic_snapshot_refresh'
      $cron$;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Could not unschedule existing activation demographic cron job: %', SQLERRM;
    END;

    BEGIN
      EXECUTE $cron$
        SELECT cron.schedule(
          'activation_demographic_snapshot_refresh',
          '20 */6 * * *',
          $$SELECT public.capture_scheduled_activation_demographic_snapshots(
            'scheduled_refresh',
            'Automated scheduled activation demographic ingestion'
          );$$
        )
      $cron$;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Could not schedule activation demographic cron job: %', SQLERRM;
    END;
  END IF;
END $$;

GRANT SELECT ON public.activation_demographic_snapshots TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.activation_demographic_snapshots TO authenticated;
GRANT EXECUTE ON FUNCTION public.capture_activation_demographic_snapshot(public.activation_scope_type, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.capture_scheduled_activation_demographic_snapshots(text, text) TO authenticated;

ALTER TABLE public.activation_demographic_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Activation demographic snapshots are readable by authenticated users" ON public.activation_demographic_snapshots;
CREATE POLICY "Activation demographic snapshots are readable by authenticated users" ON public.activation_demographic_snapshots
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Activation demographic snapshots are manageable by reviewers" ON public.activation_demographic_snapshots;
CREATE POLICY "Activation demographic snapshots are manageable by reviewers" ON public.activation_demographic_snapshots
  FOR ALL USING (
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.current_profile_in_governance_domain(ARRAY['activation_review', 'constitutional_review'])
  )
  WITH CHECK (
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.current_profile_in_governance_domain(ARRAY['activation_review', 'constitutional_review'])
  );
