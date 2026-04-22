DO $$
BEGIN
  CREATE TYPE public.activation_review_status AS ENUM (
    'pre_activation',
    'pending_review',
    'approved_for_activation',
    'activated',
    'rejected',
    'revoked'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.activation_review_decision AS ENUM (
    'approve',
    'reject',
    'request_changes',
    'declare_activation',
    'revoke_activation'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.activation_threshold_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type public.activation_scope_type NOT NULL,
  country_code text NOT NULL DEFAULT '',
  jurisdiction_label text NOT NULL DEFAULT '',
  status public.activation_review_status NOT NULL DEFAULT 'pre_activation',
  threshold_percent numeric(5,2) NOT NULL DEFAULT 51,
  target_population bigint,
  verified_citizens_count bigint NOT NULL DEFAULT 0,
  eligible_verified_citizens_count bigint NOT NULL DEFAULT 0,
  review_notes text,
  declaration_notes text,
  opened_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  declared_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  declared_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activation_threshold_reviews_scope_country_unique UNIQUE (scope_type, country_code),
  CONSTRAINT activation_threshold_reviews_country_code_check CHECK (
    (scope_type = 'world'::public.activation_scope_type AND country_code = '')
    OR (scope_type = 'country'::public.activation_scope_type AND country_code <> '')
  ),
  CONSTRAINT activation_threshold_reviews_threshold_percent_check CHECK (
    threshold_percent > 0 AND threshold_percent <= 100
  ),
  CONSTRAINT activation_threshold_reviews_counts_check CHECK (
    verified_citizens_count >= 0
    AND eligible_verified_citizens_count >= 0
    AND (target_population IS NULL OR target_population >= 0)
  )
);

CREATE TABLE IF NOT EXISTS public.activation_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.activation_threshold_reviews(id) ON DELETE CASCADE,
  evidence_type text NOT NULL,
  source_label text,
  source_url text,
  metric_key text,
  metric_value numeric,
  observed_at timestamptz,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activation_evidence_type_not_empty CHECK (length(trim(evidence_type)) > 0)
);

CREATE TABLE IF NOT EXISTS public.activation_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.activation_threshold_reviews(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  decision public.activation_review_decision NOT NULL,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activation_threshold_reviews_status
  ON public.activation_threshold_reviews (status, reviewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_activation_threshold_reviews_scope
  ON public.activation_threshold_reviews (scope_type, country_code);

CREATE INDEX IF NOT EXISTS idx_activation_evidence_review
  ON public.activation_evidence (review_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activation_decisions_review
  ON public.activation_decisions (review_id, created_at DESC);

DO $$
BEGIN
  CREATE TRIGGER update_activation_threshold_reviews_updated_at
    BEFORE UPDATE ON public.activation_threshold_reviews
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_activation_evidence_updated_at
    BEFORE UPDATE ON public.activation_evidence
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.normalize_activation_scope_country_code(
  requested_scope_type public.activation_scope_type,
  raw_country_code text
)
RETURNS text AS $$
  SELECT CASE
    WHEN requested_scope_type = 'world'::public.activation_scope_type THEN ''
    ELSE upper(trim(coalesce(raw_country_code, '')))
  END;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.sync_activation_threshold_review_country_code()
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

DROP TRIGGER IF EXISTS sync_activation_threshold_review_country_code_trigger ON public.activation_threshold_reviews;
CREATE TRIGGER sync_activation_threshold_review_country_code_trigger
  BEFORE INSERT OR UPDATE OF scope_type, country_code, jurisdiction_label
  ON public.activation_threshold_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_activation_threshold_review_country_code();

CREATE OR REPLACE FUNCTION public.sync_activation_threshold_review_from_decision()
RETURNS TRIGGER AS $$
DECLARE
  next_status public.activation_review_status;
  decision_time timestamptz;
BEGIN
  decision_time := coalesce(NEW.created_at, now());

  next_status := CASE NEW.decision
    WHEN 'approve'::public.activation_review_decision THEN 'approved_for_activation'::public.activation_review_status
    WHEN 'reject'::public.activation_review_decision THEN 'rejected'::public.activation_review_status
    WHEN 'request_changes'::public.activation_review_decision THEN 'pending_review'::public.activation_review_status
    WHEN 'declare_activation'::public.activation_review_decision THEN 'activated'::public.activation_review_status
    WHEN 'revoke_activation'::public.activation_review_decision THEN 'revoked'::public.activation_review_status
  END;

  UPDATE public.activation_threshold_reviews
  SET
    status = next_status,
    reviewed_by = NEW.reviewer_id,
    reviewed_at = decision_time,
    review_notes = coalesce(NEW.notes, review_notes),
    declared_by = CASE
      WHEN NEW.decision = 'declare_activation'::public.activation_review_decision THEN coalesce(declared_by, NEW.reviewer_id)
      WHEN NEW.decision = 'revoke_activation'::public.activation_review_decision THEN NULL
      ELSE declared_by
    END,
    declared_at = CASE
      WHEN NEW.decision = 'declare_activation'::public.activation_review_decision THEN coalesce(declared_at, decision_time)
      WHEN NEW.decision = 'revoke_activation'::public.activation_review_decision THEN NULL
      ELSE declared_at
    END,
    declaration_notes = CASE
      WHEN NEW.decision IN ('declare_activation'::public.activation_review_decision, 'revoke_activation'::public.activation_review_decision)
        THEN coalesce(NEW.notes, declaration_notes)
      ELSE declaration_notes
    END
  WHERE id = NEW.review_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS sync_activation_threshold_review_from_decision_trigger ON public.activation_decisions;
CREATE TRIGGER sync_activation_threshold_review_from_decision_trigger
  AFTER INSERT ON public.activation_decisions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_activation_threshold_review_from_decision();

CREATE OR REPLACE FUNCTION public.activation_scope_is_declared(
  requested_scope_type public.activation_scope_type,
  requested_country_code text DEFAULT ''
)
RETURNS boolean AS $$
  SELECT exists (
    SELECT 1
    FROM public.activation_threshold_reviews AS review
    WHERE review.scope_type = requested_scope_type
      AND review.country_code = public.normalize_activation_scope_country_code(requested_scope_type, requested_country_code)
      AND review.status = 'activated'::public.activation_review_status
      AND review.declared_at IS NOT NULL
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

UPDATE public.citizen_activation_scopes
SET country_code = public.normalize_activation_scope_country_code(scope_type, country_code);

INSERT INTO public.activation_threshold_reviews (
  scope_type,
  country_code,
  jurisdiction_label,
  status,
  threshold_percent,
  verified_citizens_count,
  eligible_verified_citizens_count,
  review_notes,
  declaration_notes,
  opened_by,
  opened_at,
  reviewed_by,
  reviewed_at,
  declared_by,
  declared_at,
  metadata
)
SELECT
  scope.scope_type,
  public.normalize_activation_scope_country_code(scope.scope_type, scope.country_code),
  CASE
    WHEN scope.scope_type = 'world'::public.activation_scope_type THEN 'World'
    ELSE public.normalize_activation_scope_country_code(scope.scope_type, scope.country_code)
  END,
  'activated'::public.activation_review_status,
  51,
  count(*)::bigint,
  count(*)::bigint,
  'Backfilled from existing activation scopes',
  'Bootstrap declaration imported from existing activation scopes',
  (array_agg(scope.activated_by ORDER BY scope.activated_at ASC) FILTER (WHERE scope.activated_by IS NOT NULL))[1],
  min(scope.activated_at),
  (array_agg(scope.activated_by ORDER BY scope.activated_at ASC) FILTER (WHERE scope.activated_by IS NOT NULL))[1],
  max(scope.activated_at),
  (array_agg(scope.activated_by ORDER BY scope.activated_at ASC) FILTER (WHERE scope.activated_by IS NOT NULL))[1],
  max(scope.activated_at),
  jsonb_build_object('source', 'legacy_activation_scope_projection')
FROM public.citizen_activation_scopes AS scope
GROUP BY scope.scope_type, public.normalize_activation_scope_country_code(scope.scope_type, scope.country_code)
ON CONFLICT (scope_type, country_code) DO NOTHING;

INSERT INTO public.activation_threshold_reviews (
  scope_type,
  country_code,
  jurisdiction_label,
  status,
  threshold_percent,
  review_notes,
  metadata
)
VALUES (
  'world'::public.activation_scope_type,
  '',
  'World',
  'pre_activation'::public.activation_review_status,
  51,
  'Bootstrap world review record',
  jsonb_build_object('source', 'bootstrap_seed')
)
ON CONFLICT (scope_type, country_code) DO NOTHING;

GRANT SELECT ON public.activation_threshold_reviews TO authenticated;
GRANT SELECT ON public.activation_evidence TO authenticated;
GRANT SELECT ON public.activation_decisions TO authenticated;
GRANT INSERT, UPDATE ON public.activation_threshold_reviews TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.activation_evidence TO authenticated;
GRANT INSERT ON public.activation_decisions TO authenticated;

ALTER TABLE public.activation_threshold_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activation_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activation_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Activation threshold reviews are readable by authenticated users" ON public.activation_threshold_reviews;
CREATE POLICY "Activation threshold reviews are readable by authenticated users" ON public.activation_threshold_reviews
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Activation threshold reviews are manageable by reviewers" ON public.activation_threshold_reviews;
CREATE POLICY "Activation threshold reviews are manageable by reviewers" ON public.activation_threshold_reviews
  FOR INSERT WITH CHECK (
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.current_profile_in_governance_domain(ARRAY['activation_review', 'constitutional_review'])
  );

DROP POLICY IF EXISTS "Activation threshold reviews are updatable by reviewers" ON public.activation_threshold_reviews;
CREATE POLICY "Activation threshold reviews are updatable by reviewers" ON public.activation_threshold_reviews
  FOR UPDATE USING (
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.current_profile_in_governance_domain(ARRAY['activation_review', 'constitutional_review'])
  )
  WITH CHECK (
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.current_profile_in_governance_domain(ARRAY['activation_review', 'constitutional_review'])
  );

DROP POLICY IF EXISTS "Activation evidence is readable by authenticated users" ON public.activation_evidence;
CREATE POLICY "Activation evidence is readable by authenticated users" ON public.activation_evidence
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Activation evidence is manageable by reviewers" ON public.activation_evidence;
CREATE POLICY "Activation evidence is manageable by reviewers" ON public.activation_evidence
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

DROP POLICY IF EXISTS "Activation decisions are readable by authenticated users" ON public.activation_decisions;
CREATE POLICY "Activation decisions are readable by authenticated users" ON public.activation_decisions
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Activation decisions are insertable by reviewers" ON public.activation_decisions;
CREATE POLICY "Activation decisions are insertable by reviewers" ON public.activation_decisions
  FOR INSERT WITH CHECK (
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.current_profile_in_governance_domain(ARRAY['activation_review', 'constitutional_review'])
  );

DROP POLICY IF EXISTS "Citizen activation scopes are readable by governance domains or admins" ON public.citizen_activation_scopes;
DROP POLICY IF EXISTS "Citizen activation scopes are readable with declaration controls" ON public.citizen_activation_scopes;
CREATE POLICY "Citizen activation scopes are readable with declaration controls" ON public.citizen_activation_scopes
  FOR SELECT USING (
    profile_id = public.current_profile_id()
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.current_profile_in_governance_domain(ARRAY['activation_review', 'civic_operations', 'constitutional_review'])
  );

DROP POLICY IF EXISTS "Citizen activation scopes are manageable by governance domains or admins" ON public.citizen_activation_scopes;
DROP POLICY IF EXISTS "Citizen activation scopes are insertable with declaration controls" ON public.citizen_activation_scopes;
DROP POLICY IF EXISTS "Citizen activation scopes are updatable with declaration controls" ON public.citizen_activation_scopes;
DROP POLICY IF EXISTS "Citizen activation scopes are deletable with declaration controls" ON public.citizen_activation_scopes;

CREATE POLICY "Citizen activation scopes are insertable with declaration controls" ON public.citizen_activation_scopes
  FOR INSERT WITH CHECK (
    (
      public.has_permission('role.assign'::public.app_permission)
      OR public.has_permission('settings.manage'::public.app_permission)
      OR public.current_profile_in_governance_domain(ARRAY['activation_review', 'civic_operations', 'constitutional_review'])
    )
    AND public.activation_scope_is_declared(scope_type, country_code)
  );

CREATE POLICY "Citizen activation scopes are updatable with declaration controls" ON public.citizen_activation_scopes
  FOR UPDATE USING (
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.current_profile_in_governance_domain(ARRAY['activation_review', 'civic_operations', 'constitutional_review'])
  )
  WITH CHECK (
    (
      public.has_permission('role.assign'::public.app_permission)
      OR public.has_permission('settings.manage'::public.app_permission)
      OR public.current_profile_in_governance_domain(ARRAY['activation_review', 'civic_operations', 'constitutional_review'])
    )
    AND public.activation_scope_is_declared(scope_type, country_code)
  );

CREATE POLICY "Citizen activation scopes are deletable with declaration controls" ON public.citizen_activation_scopes
  FOR DELETE USING (
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.current_profile_in_governance_domain(ARRAY['activation_review', 'civic_operations', 'constitutional_review'])
  );
