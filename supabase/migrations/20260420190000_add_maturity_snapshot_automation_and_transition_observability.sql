CREATE TABLE IF NOT EXISTS public.governance_domain_maturity_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_key text NOT NULL REFERENCES public.governance_domains(domain_key) ON DELETE CASCADE,
  previous_snapshot_id uuid REFERENCES public.governance_domain_maturity_snapshots(id) ON DELETE SET NULL,
  current_snapshot_id uuid NOT NULL REFERENCES public.governance_domain_maturity_snapshots(id) ON DELETE CASCADE,
  transition_type text NOT NULL,
  previous_is_mature boolean,
  current_is_mature boolean NOT NULL,
  previous_threshold_count integer,
  current_threshold_count integer NOT NULL,
  previous_thresholds_met_count integer,
  current_thresholds_met_count integer NOT NULL,
  trigger_source text NOT NULL DEFAULT 'snapshot_insert',
  triggered_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_domain_maturity_transitions_transition_type_check CHECK (
    transition_type = ANY (ARRAY['initial', 'matured', 'regressed', 'unchanged'])
  ),
  CONSTRAINT governance_domain_maturity_transitions_threshold_count_check CHECK (
    current_threshold_count >= 0
    AND current_thresholds_met_count >= 0
    AND current_thresholds_met_count <= current_threshold_count
  ),
  CONSTRAINT governance_domain_maturity_transitions_previous_threshold_count_check CHECK (
    previous_threshold_count IS NULL
    OR (
      previous_threshold_count >= 0
      AND coalesce(previous_thresholds_met_count, 0) >= 0
      AND coalesce(previous_thresholds_met_count, 0) <= previous_threshold_count
    )
  ),
  CONSTRAINT governance_domain_maturity_transitions_snapshot_unique UNIQUE (current_snapshot_id)
);

CREATE INDEX IF NOT EXISTS idx_governance_domain_maturity_transitions_domain_created
  ON public.governance_domain_maturity_transitions (domain_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_domain_maturity_transitions_transition_type
  ON public.governance_domain_maturity_transitions (transition_type, created_at DESC);

CREATE OR REPLACE FUNCTION public.capture_governance_domain_maturity_snapshot_if_stale(
  requested_domain_key text,
  max_snapshot_age interval DEFAULT interval '12 hours',
  snapshot_source text DEFAULT 'scheduled_refresh',
  measured_by_profile_id uuid DEFAULT NULL,
  snapshot_notes text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  latest_snapshot public.governance_domain_maturity_snapshots%ROWTYPE;
  inserted_id uuid;
BEGIN
  IF requested_domain_key IS NULL OR btrim(requested_domain_key) = '' THEN
    RETURN NULL;
  END IF;

  SELECT snapshot.*
  INTO latest_snapshot
  FROM public.governance_domain_maturity_snapshots AS snapshot
  WHERE snapshot.domain_key = requested_domain_key
  ORDER BY snapshot.measured_at DESC, snapshot.created_at DESC, snapshot.id DESC
  LIMIT 1;

  IF latest_snapshot.id IS NULL OR latest_snapshot.measured_at <= now() - coalesce(max_snapshot_age, interval '12 hours') THEN
    inserted_id := public.capture_governance_domain_maturity_snapshot(
      requested_domain_key,
      coalesce(nullif(snapshot_source, ''), 'scheduled_refresh'),
      measured_by_profile_id,
      snapshot_notes
    );
    RETURN inserted_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.capture_scheduled_governance_domain_maturity_snapshots(
  max_snapshot_age interval DEFAULT interval '12 hours',
  snapshot_source text DEFAULT 'scheduled_refresh',
  snapshot_notes text DEFAULT NULL
)
RETURNS integer AS $$
DECLARE
  domain_record record;
  captured_count integer := 0;
BEGIN
  FOR domain_record IN
    SELECT domain.domain_key
    FROM public.governance_domains AS domain
    WHERE domain.is_active = true
    ORDER BY domain.domain_key ASC
  LOOP
    IF public.capture_governance_domain_maturity_snapshot_if_stale(
      domain_record.domain_key,
      max_snapshot_age,
      snapshot_source,
      NULL,
      snapshot_notes
    ) IS NOT NULL THEN
      captured_count := captured_count + 1;
    END IF;
  END LOOP;

  RETURN captured_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.capture_governance_domain_maturity_snapshots_for_profile(
  requested_profile_id uuid,
  snapshot_source text DEFAULT 'profile_governance_change',
  snapshot_notes text DEFAULT NULL
)
RETURNS integer AS $$
DECLARE
  domain_record record;
  captured_count integer := 0;
BEGIN
  IF requested_profile_id IS NULL THEN
    RETURN 0;
  END IF;

  FOR domain_record IN
    SELECT DISTINCT assignment.domain_key
    FROM public.profile_governance_roles AS assignment
    JOIN public.governance_domains AS domain ON domain.domain_key = assignment.domain_key
    WHERE assignment.profile_id = requested_profile_id
      AND assignment.is_active = true
      AND (assignment.ended_at IS NULL OR assignment.ended_at > now())
      AND domain.is_active = true
    ORDER BY assignment.domain_key ASC
  LOOP
    PERFORM public.capture_governance_domain_maturity_snapshot(
      domain_record.domain_key,
      coalesce(nullif(snapshot_source, ''), 'profile_governance_change'),
      NULL,
      snapshot_notes
    );

    captured_count := captured_count + 1;
  END LOOP;

  RETURN captured_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.record_governance_domain_maturity_transition()
RETURNS TRIGGER AS $$
DECLARE
  previous_snapshot public.governance_domain_maturity_snapshots%ROWTYPE;
  computed_transition_type text;
  trigger_source_value text;
  triggered_by_profile_id uuid;
BEGIN
  SELECT snapshot.*
  INTO previous_snapshot
  FROM public.governance_domain_maturity_snapshots AS snapshot
  WHERE snapshot.domain_key = NEW.domain_key
    AND snapshot.id <> NEW.id
    AND (
      snapshot.measured_at < NEW.measured_at
      OR (snapshot.measured_at = NEW.measured_at AND snapshot.created_at < NEW.created_at)
      OR (
        snapshot.measured_at = NEW.measured_at
        AND snapshot.created_at = NEW.created_at
        AND snapshot.id < NEW.id
      )
    )
  ORDER BY snapshot.measured_at DESC, snapshot.created_at DESC, snapshot.id DESC
  LIMIT 1;

  IF previous_snapshot.id IS NULL THEN
    computed_transition_type := 'initial';
  ELSIF previous_snapshot.is_mature = false AND NEW.is_mature = true THEN
    computed_transition_type := 'matured';
  ELSIF previous_snapshot.is_mature = true AND NEW.is_mature = false THEN
    computed_transition_type := 'regressed';
  ELSE
    computed_transition_type := 'unchanged';
  END IF;

  trigger_source_value := coalesce(nullif(NEW.source, ''), 'snapshot_insert');

  IF NEW.measured_by IS NOT NULL THEN
    triggered_by_profile_id := NEW.measured_by;
  ELSIF jsonb_typeof(NEW.metadata -> 'triggered_by') = 'string'
    AND (NEW.metadata ->> 'triggered_by') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  THEN
    triggered_by_profile_id := nullif(NEW.metadata ->> 'triggered_by', '')::uuid;
  ELSE
    triggered_by_profile_id := NULL;
  END IF;

  INSERT INTO public.governance_domain_maturity_transitions (
    domain_key,
    previous_snapshot_id,
    current_snapshot_id,
    transition_type,
    previous_is_mature,
    current_is_mature,
    previous_threshold_count,
    current_threshold_count,
    previous_thresholds_met_count,
    current_thresholds_met_count,
    trigger_source,
    triggered_by,
    metadata
  )
  VALUES (
    NEW.domain_key,
    previous_snapshot.id,
    NEW.id,
    computed_transition_type,
    previous_snapshot.is_mature,
    NEW.is_mature,
    previous_snapshot.threshold_count,
    NEW.threshold_count,
    previous_snapshot.thresholds_met_count,
    NEW.thresholds_met_count,
    trigger_source_value,
    triggered_by_profile_id,
    jsonb_build_object(
      'snapshot_source', NEW.source,
      'snapshot_metadata', NEW.metadata
    )
  )
  ON CONFLICT (current_snapshot_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS record_governance_domain_maturity_transition_trigger ON public.governance_domain_maturity_snapshots;
CREATE TRIGGER record_governance_domain_maturity_transition_trigger
  AFTER INSERT ON public.governance_domain_maturity_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.record_governance_domain_maturity_transition();

CREATE OR REPLACE FUNCTION public.refresh_governance_maturity_on_profile_role_change()
RETURNS TRIGGER AS $$
DECLARE
  old_domain text;
  new_domain text;
BEGIN
  old_domain := CASE
    WHEN TG_OP IN ('UPDATE', 'DELETE')
      AND coalesce(OLD.is_active, false)
      AND (OLD.ended_at IS NULL OR OLD.ended_at > now())
    THEN OLD.domain_key
    ELSE NULL
  END;

  new_domain := CASE
    WHEN TG_OP IN ('INSERT', 'UPDATE')
      AND coalesce(NEW.is_active, false)
      AND (NEW.ended_at IS NULL OR NEW.ended_at > now())
    THEN NEW.domain_key
    ELSE NULL
  END;

  IF old_domain IS NOT NULL THEN
    PERFORM public.capture_governance_domain_maturity_snapshot(
      old_domain,
      'role_assignment_change',
      NULL,
      'Auto-refresh after governance domain role assignment change'
    );
  END IF;

  IF new_domain IS NOT NULL AND new_domain IS DISTINCT FROM old_domain THEN
    PERFORM public.capture_governance_domain_maturity_snapshot(
      new_domain,
      'role_assignment_change',
      NULL,
      'Auto-refresh after governance domain role assignment change'
    );
  END IF;

  RETURN coalesce(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS refresh_governance_maturity_on_profile_role_change_trigger ON public.profile_governance_roles;
CREATE TRIGGER refresh_governance_maturity_on_profile_role_change_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.profile_governance_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_governance_maturity_on_profile_role_change();

CREATE OR REPLACE FUNCTION public.refresh_governance_maturity_on_profile_eligibility_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.is_verified IS NOT DISTINCT FROM OLD.is_verified
    AND NEW.is_governance_eligible IS NOT DISTINCT FROM OLD.is_governance_eligible
    AND NEW.citizenship_status IS NOT DISTINCT FROM OLD.citizenship_status
    AND NEW.is_active_citizen IS NOT DISTINCT FROM OLD.is_active_citizen
  THEN
    RETURN NEW;
  END IF;

  PERFORM public.capture_governance_domain_maturity_snapshots_for_profile(
    NEW.id,
    'profile_eligibility_change',
    'Auto-refresh after governance eligibility profile update'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS refresh_governance_maturity_on_profile_eligibility_change_trigger ON public.profiles;
CREATE TRIGGER refresh_governance_maturity_on_profile_eligibility_change_trigger
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_governance_maturity_on_profile_eligibility_change();

CREATE OR REPLACE FUNCTION public.refresh_governance_maturity_on_sanction_change()
RETURNS TRIGGER AS $$
DECLARE
  target_profile_id uuid;
BEGIN
  target_profile_id := CASE
    WHEN TG_OP = 'DELETE' THEN OLD.profile_id
    ELSE NEW.profile_id
  END;

  IF target_profile_id IS NULL THEN
    RETURN coalesce(NEW, OLD);
  END IF;

  PERFORM public.capture_governance_domain_maturity_snapshots_for_profile(
    target_profile_id,
    'sanction_state_change',
    'Auto-refresh after sanction state update'
  );

  RETURN coalesce(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS refresh_governance_maturity_on_sanction_change_trigger ON public.governance_sanctions;
CREATE TRIGGER refresh_governance_maturity_on_sanction_change_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.governance_sanctions
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_governance_maturity_on_sanction_change();

CREATE OR REPLACE FUNCTION public.refresh_governance_maturity_on_threshold_change()
RETURNS TRIGGER AS $$
DECLARE
  old_domain text;
  new_domain text;
BEGIN
  old_domain := CASE
    WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.domain_key
    ELSE NULL
  END;

  new_domain := CASE
    WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.domain_key
    ELSE NULL
  END;

  IF old_domain IS NOT NULL THEN
    PERFORM public.capture_governance_domain_maturity_snapshot(
      old_domain,
      'threshold_rule_change',
      NULL,
      'Auto-refresh after maturity threshold change'
    );
  END IF;

  IF new_domain IS NOT NULL AND new_domain IS DISTINCT FROM old_domain THEN
    PERFORM public.capture_governance_domain_maturity_snapshot(
      new_domain,
      'threshold_rule_change',
      NULL,
      'Auto-refresh after maturity threshold change'
    );
  END IF;

  RETURN coalesce(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS refresh_governance_maturity_on_threshold_change_trigger ON public.governance_domain_maturity_thresholds;
CREATE TRIGGER refresh_governance_maturity_on_threshold_change_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.governance_domain_maturity_thresholds
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_governance_maturity_on_threshold_change();

DO $$
BEGIN
  IF to_regnamespace('cron') IS NOT NULL THEN
    BEGIN
      EXECUTE $cron$
        SELECT cron.unschedule(job.jobid)
        FROM cron.job
        WHERE job.jobname = 'governance_domain_maturity_snapshot_refresh'
      $cron$;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Could not unschedule existing maturity snapshot cron job: %', SQLERRM;
    END;

    BEGIN
      EXECUTE $cron$
        SELECT cron.schedule(
          'governance_domain_maturity_snapshot_refresh',
          '15 */6 * * *',
          $job$SELECT public.capture_scheduled_governance_domain_maturity_snapshots(
            '12 hours'::interval,
            'scheduled_refresh',
            'Automated scheduled maturity snapshot refresh'
          );$job$
        )
      $cron$;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Could not schedule maturity snapshot cron job: %', SQLERRM;
    END;
  END IF;
END $$;

GRANT SELECT ON public.governance_domain_maturity_transitions TO authenticated;
GRANT EXECUTE ON FUNCTION public.capture_governance_domain_maturity_snapshot_if_stale(text, interval, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.capture_scheduled_governance_domain_maturity_snapshots(interval, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.capture_governance_domain_maturity_snapshots_for_profile(uuid, text, text) TO authenticated;

ALTER TABLE public.governance_domain_maturity_transitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Governance domain maturity transitions are readable by authenticated users" ON public.governance_domain_maturity_transitions;
CREATE POLICY "Governance domain maturity transitions are readable by authenticated users" ON public.governance_domain_maturity_transitions
  FOR SELECT USING (auth.role() = 'authenticated');
