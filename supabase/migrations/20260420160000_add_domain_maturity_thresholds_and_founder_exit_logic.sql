CREATE TABLE IF NOT EXISTS public.governance_domain_maturity_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_key text NOT NULL REFERENCES public.governance_domains(domain_key) ON DELETE CASCADE,
  threshold_key text NOT NULL,
  threshold_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  required_count integer NOT NULL,
  role_keys text[] NOT NULL DEFAULT '{}'::text[],
  is_active boolean NOT NULL DEFAULT true,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_until timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_domain_maturity_thresholds_required_count_check CHECK (required_count > 0),
  CONSTRAINT governance_domain_maturity_thresholds_effective_window_check CHECK (
    effective_until IS NULL OR effective_until > effective_from
  ),
  CONSTRAINT governance_domain_maturity_thresholds_domain_threshold_unique UNIQUE (domain_key, threshold_key)
);

CREATE INDEX IF NOT EXISTS idx_governance_domain_maturity_thresholds_domain_active
  ON public.governance_domain_maturity_thresholds (domain_key, is_active, threshold_key);

CREATE TABLE IF NOT EXISTS public.governance_domain_maturity_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_key text NOT NULL REFERENCES public.governance_domains(domain_key) ON DELETE CASCADE,
  is_mature boolean NOT NULL,
  threshold_count integer NOT NULL DEFAULT 0,
  thresholds_met_count integer NOT NULL DEFAULT 0,
  threshold_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  measured_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'manual',
  measured_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_domain_maturity_snapshots_threshold_count_check CHECK (threshold_count >= 0),
  CONSTRAINT governance_domain_maturity_snapshots_thresholds_met_count_check CHECK (
    thresholds_met_count >= 0
    AND thresholds_met_count <= threshold_count
  ),
  CONSTRAINT governance_domain_maturity_snapshots_threshold_results_is_array_check CHECK (
    jsonb_typeof(threshold_results) = 'array'
  )
);

CREATE INDEX IF NOT EXISTS idx_governance_domain_maturity_snapshots_domain_measured
  ON public.governance_domain_maturity_snapshots (domain_key, measured_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_domain_maturity_snapshots_domain_mature
  ON public.governance_domain_maturity_snapshots (domain_key, is_mature, measured_at DESC);

DO $$
BEGIN
  CREATE TRIGGER update_governance_domain_maturity_thresholds_updated_at
    BEFORE UPDATE ON public.governance_domain_maturity_thresholds
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_governance_domain_maturity_snapshots_updated_at
    BEFORE UPDATE ON public.governance_domain_maturity_snapshots
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.evaluate_governance_domain_maturity(
  requested_domain_key text
)
RETURNS jsonb AS $$
WITH active_thresholds AS (
  SELECT
    threshold.domain_key,
    threshold.threshold_key,
    threshold.threshold_name,
    threshold.required_count,
    threshold.role_keys
  FROM public.governance_domain_maturity_thresholds AS threshold
  JOIN public.governance_domains AS domain ON domain.domain_key = threshold.domain_key
  WHERE threshold.domain_key = requested_domain_key
    AND threshold.is_active = true
    AND domain.is_active = true
    AND threshold.effective_from <= now()
    AND (threshold.effective_until IS NULL OR threshold.effective_until > now())
),
evaluated AS (
  SELECT
    threshold.threshold_key,
    threshold.threshold_name,
    threshold.required_count,
    threshold.role_keys,
    (
      SELECT count(DISTINCT assignment.profile_id)::integer
      FROM public.profile_governance_roles AS assignment
      JOIN public.profiles AS profile ON profile.id = assignment.profile_id
      WHERE assignment.domain_key = threshold.domain_key
        AND assignment.is_active = true
        AND (assignment.ended_at IS NULL OR assignment.ended_at > now())
        AND (
          coalesce(array_length(threshold.role_keys, 1), 0) = 0
          OR assignment.role_key = ANY(threshold.role_keys)
        )
        AND profile.is_verified = true
        AND profile.is_governance_eligible = true
        AND profile.citizenship_status = 'citizen'::public.citizenship_status
        AND profile.is_active_citizen = true
        AND NOT public.profile_has_constitutional_office(
          profile.id,
          'founder'::public.constitutional_office_key
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.governance_sanctions AS sanction
          WHERE sanction.profile_id = assignment.profile_id
            AND sanction.is_active = true
            AND sanction.blocks_governance_all = true
            AND sanction.starts_at <= now()
            AND (sanction.ends_at IS NULL OR sanction.ends_at > now())
            AND sanction.lifted_at IS NULL
        )
    ) AS observed_count
  FROM active_thresholds AS threshold
),
summary AS (
  SELECT
    count(*)::integer AS threshold_count,
    count(*) FILTER (WHERE observed_count >= required_count)::integer AS thresholds_met_count,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'threshold_key', threshold_key,
          'threshold_name', threshold_name,
          'required_count', required_count,
          'observed_count', observed_count,
          'meets_threshold', observed_count >= required_count,
          'role_keys', role_keys
        )
        ORDER BY threshold_key
      ),
      '[]'::jsonb
    ) AS threshold_results
  FROM evaluated
)
SELECT jsonb_build_object(
  'domain_key', requested_domain_key,
  'threshold_count', coalesce(summary.threshold_count, 0),
  'thresholds_met_count', coalesce(summary.thresholds_met_count, 0),
  'threshold_results', coalesce(summary.threshold_results, '[]'::jsonb),
  'is_mature',
  coalesce(summary.threshold_count, 0) > 0
  AND coalesce(summary.threshold_count, 0) = coalesce(summary.thresholds_met_count, 0)
)
FROM summary;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.capture_governance_domain_maturity_snapshot(
  requested_domain_key text,
  snapshot_source text DEFAULT 'manual',
  measured_by_profile_id uuid DEFAULT public.current_profile_id(),
  snapshot_notes text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  evaluation jsonb;
  inserted_id uuid;
BEGIN
  evaluation := public.evaluate_governance_domain_maturity(requested_domain_key);

  INSERT INTO public.governance_domain_maturity_snapshots (
    domain_key,
    is_mature,
    threshold_count,
    thresholds_met_count,
    threshold_results,
    measured_at,
    source,
    measured_by,
    notes,
    metadata
  )
  VALUES (
    requested_domain_key,
    coalesce((evaluation ->> 'is_mature')::boolean, false),
    coalesce((evaluation ->> 'threshold_count')::integer, 0),
    coalesce((evaluation ->> 'thresholds_met_count')::integer, 0),
    coalesce(evaluation -> 'threshold_results', '[]'::jsonb),
    now(),
    coalesce(nullif(snapshot_source, ''), 'manual'),
    measured_by_profile_id,
    snapshot_notes,
    jsonb_build_object('evaluation', evaluation)
  )
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.capture_all_governance_domain_maturity_snapshots(
  snapshot_source text DEFAULT 'manual',
  measured_by_profile_id uuid DEFAULT public.current_profile_id(),
  snapshot_notes text DEFAULT NULL
)
RETURNS integer AS $$
DECLARE
  domain_record record;
  captured_count integer := 0;
BEGIN
  FOR domain_record IN
    SELECT domain_key
    FROM public.governance_domains
    WHERE is_active = true
    ORDER BY domain_key ASC
  LOOP
    PERFORM public.capture_governance_domain_maturity_snapshot(
      domain_record.domain_key,
      snapshot_source,
      measured_by_profile_id,
      snapshot_notes
    );
    captured_count := captured_count + 1;
  END LOOP;

  RETURN captured_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_domain_is_mature(
  requested_domain_key text
)
RETURNS boolean AS $$
  SELECT coalesce(
    (
      SELECT snapshot.is_mature
      FROM public.governance_domain_maturity_snapshots AS snapshot
      JOIN public.governance_domains AS domain ON domain.domain_key = snapshot.domain_key
      WHERE snapshot.domain_key = requested_domain_key
        AND domain.is_active = true
      ORDER BY snapshot.measured_at DESC, snapshot.created_at DESC, snapshot.id DESC
      LIMIT 1
    ),
    false
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.current_profile_is_maturity_steward()
RETURNS boolean AS $$
  SELECT coalesce(
    EXISTS (
      SELECT 1
      FROM public.profile_governance_roles AS assignment
      JOIN public.governance_domains AS domain ON domain.domain_key = assignment.domain_key
      WHERE assignment.profile_id = public.current_profile_id()
        AND assignment.is_active = true
        AND (assignment.ended_at IS NULL OR assignment.ended_at > now())
        AND domain.is_active = true
        AND assignment.domain_key = ANY(ARRAY['constitutional_review', 'civic_operations'])
    ),
    false
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

INSERT INTO public.governance_domain_maturity_thresholds (
  domain_key,
  threshold_key,
  threshold_name,
  description,
  required_count,
  role_keys,
  metadata
)
VALUES
  (
    'identity_verification',
    'verifiers_minimum',
    'Minimum Verifiers',
    'Minimum verified governance-eligible stewards actively covering identity verification.',
    5,
    ARRAY['steward']::text[],
    jsonb_build_object('source', 'role-domains-and-maturity-thresholds-v0.1', 'policy_section', '4')
  ),
  (
    'identity_verification',
    'review_leads_minimum',
    'Minimum Review Leads',
    'Minimum domain leads available for identity verification review leadership.',
    2,
    ARRAY['domain_lead']::text[],
    jsonb_build_object('source', 'role-domains-and-maturity-thresholds-v0.1', 'policy_section', '4')
  ),
  (
    'identity_verification',
    'appeals_reviewers_minimum',
    'Minimum Appeals Reviewers',
    'Minimum reviewers available for identity verification appeals review.',
    2,
    ARRAY['reviewer']::text[],
    jsonb_build_object('source', 'role-domains-and-maturity-thresholds-v0.1', 'policy_section', '4')
  ),
  (
    'moderation_conduct',
    'moderators_minimum',
    'Minimum Moderators',
    'Minimum verified governance-eligible moderation stewards.',
    7,
    ARRAY['steward']::text[],
    jsonb_build_object('source', 'role-domains-and-maturity-thresholds-v0.1', 'policy_section', '4')
  ),
  (
    'moderation_conduct',
    'senior_moderators_minimum',
    'Minimum Senior Moderators',
    'Minimum domain leads available for moderation escalation and supervision.',
    3,
    ARRAY['domain_lead']::text[],
    jsonb_build_object('source', 'role-domains-and-maturity-thresholds-v0.1', 'policy_section', '4')
  ),
  (
    'moderation_conduct',
    'appeals_reviewers_minimum',
    'Minimum Appeals Reviewers',
    'Minimum moderation reviewers available for appeals and contested actions.',
    3,
    ARRAY['reviewer']::text[],
    jsonb_build_object('source', 'role-domains-and-maturity-thresholds-v0.1', 'policy_section', '4')
  ),
  (
    'constitutional_review',
    'governance_members_minimum',
    'Minimum Governance Members',
    'Minimum stewards available for constitutional and governance review operations.',
    9,
    ARRAY['steward']::text[],
    jsonb_build_object('source', 'role-domains-and-maturity-thresholds-v0.1', 'policy_section', '4')
  ),
  (
    'constitutional_review',
    'constitutional_reviewers_minimum',
    'Minimum Constitutional Reviewers',
    'Minimum reviewers available for constitutional interpretation and appeals.',
    5,
    ARRAY['reviewer']::text[],
    jsonb_build_object('source', 'role-domains-and-maturity-thresholds-v0.1', 'policy_section', '4')
  ),
  (
    'constitutional_review',
    'ratification_board_minimum',
    'Minimum Ratification Board Members',
    'Minimum domain leads available for ratification and final governance review.',
    5,
    ARRAY['domain_lead']::text[],
    jsonb_build_object('source', 'role-domains-and-maturity-thresholds-v0.1', 'policy_section', '4')
  ),
  (
    'technical_stewardship',
    'technical_stewards_minimum',
    'Minimum Technical Stewards',
    'Minimum stewards available for technical governance operations.',
    5,
    ARRAY['steward']::text[],
    jsonb_build_object('source', 'role-domains-and-maturity-thresholds-v0.1', 'policy_section', '4')
  ),
  (
    'technical_stewardship',
    'release_stewards_minimum',
    'Minimum Release Stewards',
    'Minimum domain leads available for release stewardship.',
    2,
    ARRAY['domain_lead']::text[],
    jsonb_build_object('source', 'role-domains-and-maturity-thresholds-v0.1', 'policy_section', '4')
  ),
  (
    'technical_stewardship',
    'infrastructure_reviewers_minimum',
    'Minimum Infrastructure Reviewers',
    'Minimum reviewers available for infrastructure review and controls.',
    2,
    ARRAY['reviewer']::text[],
    jsonb_build_object('source', 'role-domains-and-maturity-thresholds-v0.1', 'policy_section', '4')
  ),
  (
    'civic_education',
    'educators_or_certification_reviewers_minimum',
    'Minimum Educators or Certification Reviewers',
    'Minimum stewards available for civic education and certification stewardship.',
    5,
    ARRAY['steward']::text[],
    jsonb_build_object('source', 'role-domains-and-maturity-thresholds-v0.1', 'policy_section', '4')
  ),
  (
    'civic_education',
    'examination_reviewers_minimum',
    'Minimum Examination Reviewers',
    'Minimum reviewers available for examination oversight.',
    2,
    ARRAY['reviewer']::text[],
    jsonb_build_object('source', 'role-domains-and-maturity-thresholds-v0.1', 'policy_section', '4')
  )
ON CONFLICT (domain_key, threshold_key) DO UPDATE
SET
  threshold_name = excluded.threshold_name,
  description = excluded.description,
  required_count = excluded.required_count,
  role_keys = excluded.role_keys,
  is_active = true,
  effective_until = NULL,
  metadata = excluded.metadata,
  updated_at = now();

SELECT public.capture_all_governance_domain_maturity_snapshots(
  'bootstrap_migration',
  NULL,
  'Bootstrap maturity baseline snapshot from governance role assignments'
);

CREATE OR REPLACE FUNCTION public.profile_has_governance_domain_role(
  target_profile_id uuid,
  domain_keys text[],
  role_keys text[] DEFAULT NULL
)
RETURNS boolean AS $$
  SELECT coalesce(
    target_profile_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.profile_governance_roles AS assignment
        JOIN public.governance_domains AS domain ON domain.domain_key = assignment.domain_key
        WHERE assignment.profile_id = target_profile_id
          AND assignment.is_active = true
          AND (assignment.ended_at IS NULL OR assignment.ended_at > now())
          AND domain.is_active = true
          AND assignment.domain_key = ANY(coalesce(domain_keys, '{}'::text[]))
          AND (
            role_keys IS NULL
            OR array_length(role_keys, 1) IS NULL
            OR assignment.role_key = ANY(role_keys)
          )
      )
      OR (
        (role_keys IS NULL OR array_length(role_keys, 1) IS NULL)
        AND public.profile_has_constitutional_office(
          target_profile_id,
          'founder'::public.constitutional_office_key
        )
        AND EXISTS (
          SELECT 1
          FROM unnest(coalesce(domain_keys, '{}'::text[])) AS requested_domain(domain_key)
          JOIN public.governance_domains AS domain ON domain.domain_key = requested_domain.domain_key
          WHERE requested_domain.domain_key IS NOT NULL
            AND requested_domain.domain_key <> ''
            AND domain.is_active = true
            AND NOT public.governance_domain_is_mature(requested_domain.domain_key)
        )
      )
    ),
    false
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

GRANT SELECT ON public.governance_domain_maturity_thresholds TO authenticated;
GRANT SELECT ON public.governance_domain_maturity_snapshots TO authenticated;
GRANT INSERT, UPDATE ON public.governance_domain_maturity_thresholds TO authenticated;
GRANT INSERT, UPDATE ON public.governance_domain_maturity_snapshots TO authenticated;

GRANT EXECUTE ON FUNCTION public.evaluate_governance_domain_maturity(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.capture_governance_domain_maturity_snapshot(text, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.capture_all_governance_domain_maturity_snapshots(text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_domain_is_mature(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_profile_is_maturity_steward() TO authenticated;

ALTER TABLE public.governance_domain_maturity_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_domain_maturity_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Governance domain maturity thresholds are readable by authenticated users" ON public.governance_domain_maturity_thresholds;
CREATE POLICY "Governance domain maturity thresholds are readable by authenticated users" ON public.governance_domain_maturity_thresholds
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Governance domain maturity thresholds are manageable by maturity stewards" ON public.governance_domain_maturity_thresholds;
CREATE POLICY "Governance domain maturity thresholds are manageable by maturity stewards" ON public.governance_domain_maturity_thresholds
  FOR ALL USING (
    public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.current_profile_has_constitutional_office('founder'::public.constitutional_office_key)
    OR public.current_profile_is_maturity_steward()
  )
  WITH CHECK (
    public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.current_profile_has_constitutional_office('founder'::public.constitutional_office_key)
    OR public.current_profile_is_maturity_steward()
  );

DROP POLICY IF EXISTS "Governance domain maturity snapshots are readable by authenticated users" ON public.governance_domain_maturity_snapshots;
CREATE POLICY "Governance domain maturity snapshots are readable by authenticated users" ON public.governance_domain_maturity_snapshots
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Governance domain maturity snapshots are insertable by maturity stewards" ON public.governance_domain_maturity_snapshots;
CREATE POLICY "Governance domain maturity snapshots are insertable by maturity stewards" ON public.governance_domain_maturity_snapshots
  FOR INSERT WITH CHECK (
    public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.current_profile_has_constitutional_office('founder'::public.constitutional_office_key)
    OR public.current_profile_is_maturity_steward()
  );

DROP POLICY IF EXISTS "Governance domain maturity snapshots are updatable by maturity stewards" ON public.governance_domain_maturity_snapshots;
CREATE POLICY "Governance domain maturity snapshots are updatable by maturity stewards" ON public.governance_domain_maturity_snapshots
  FOR UPDATE USING (
    public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.current_profile_has_constitutional_office('founder'::public.constitutional_office_key)
    OR public.current_profile_is_maturity_steward()
  )
  WITH CHECK (
    public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.current_profile_has_constitutional_office('founder'::public.constitutional_office_key)
    OR public.current_profile_is_maturity_steward()
  );
