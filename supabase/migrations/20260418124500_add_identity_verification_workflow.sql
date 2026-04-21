DO $$
BEGIN
  CREATE TYPE public.identity_verification_case_status AS ENUM (
    'draft',
    'submitted',
    'in_review',
    'approved',
    'rejected',
    'revoked'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.identity_verification_decision AS ENUM (
    'approved',
    'rejected',
    'revoked'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.identity_verification_artifact_kind AS ENUM (
    'personal_info',
    'contact_info',
    'live_presence',
    'duplicate_check',
    'supporting_document'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.identity_verification_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.identity_verification_case_status NOT NULL DEFAULT 'draft',
  verification_method text NOT NULL DEFAULT 'in_app_live',
  personal_info_completed boolean NOT NULL DEFAULT false,
  contact_info_completed boolean NOT NULL DEFAULT false,
  live_verification_completed boolean NOT NULL DEFAULT false,
  discrepancy_flags text[] NOT NULL DEFAULT '{}'::text[],
  submitted_at timestamptz,
  reviewed_at timestamptz,
  resolved_at timestamptz,
  last_reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.identity_verification_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.identity_verification_cases(id) ON DELETE CASCADE,
  artifact_kind public.identity_verification_artifact_kind NOT NULL,
  storage_path text,
  artifact_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.identity_verification_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.identity_verification_cases(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  decision public.identity_verification_decision NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_identity_verification_cases_status
  ON public.identity_verification_cases (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_identity_verification_artifacts_case
  ON public.identity_verification_artifacts (case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_identity_verification_reviews_case
  ON public.identity_verification_reviews (case_id, created_at DESC);

DO $$
BEGIN
  CREATE TRIGGER update_identity_verification_cases_updated_at
    BEFORE UPDATE ON public.identity_verification_cases
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.project_profile_verification_state(target_profile_id uuid)
RETURNS void AS $$
DECLARE
  active_case public.identity_verification_cases%ROWTYPE;
  projected_verified boolean := false;
BEGIN
  IF target_profile_id IS NULL THEN
    RETURN;
  END IF;

  SELECT *
  INTO active_case
  FROM public.identity_verification_cases
  WHERE profile_id = target_profile_id
  LIMIT 1;

  IF active_case.id IS NOT NULL THEN
    projected_verified := active_case.status = 'approved'::public.identity_verification_case_status;
  END IF;

  UPDATE public.profiles
  SET
    is_verified = projected_verified,
    citizenship_review_cleared_at = CASE
      WHEN projected_verified THEN coalesce(citizenship_review_cleared_at, active_case.reviewed_at, active_case.resolved_at, now())
      ELSE citizenship_review_cleared_at
    END
  WHERE id = target_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.sync_identity_verification_case_from_review()
RETURNS TRIGGER AS $$
DECLARE
  next_status public.identity_verification_case_status;
  target_profile_id uuid;
BEGIN
  next_status := CASE NEW.decision
    WHEN 'approved'::public.identity_verification_decision THEN 'approved'::public.identity_verification_case_status
    WHEN 'rejected'::public.identity_verification_decision THEN 'rejected'::public.identity_verification_case_status
    WHEN 'revoked'::public.identity_verification_decision THEN 'revoked'::public.identity_verification_case_status
    ELSE 'in_review'::public.identity_verification_case_status
  END;

  UPDATE public.identity_verification_cases
  SET
    status = next_status,
    reviewed_at = NEW.created_at,
    resolved_at = NEW.created_at,
    last_reviewed_by = NEW.reviewer_id,
    notes = coalesce(NEW.notes, notes)
  WHERE id = NEW.case_id
  RETURNING profile_id INTO target_profile_id;

  PERFORM public.project_profile_verification_state(target_profile_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.sync_identity_verification_profile_projection()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.project_profile_verification_state(
    CASE
      WHEN TG_OP = 'DELETE' THEN OLD.profile_id
      ELSE NEW.profile_id
    END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS sync_identity_verification_case_review ON public.identity_verification_reviews;
CREATE TRIGGER sync_identity_verification_case_review
  AFTER INSERT ON public.identity_verification_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_identity_verification_case_from_review();

DROP TRIGGER IF EXISTS sync_identity_verification_profile_projection ON public.identity_verification_cases;
CREATE TRIGGER sync_identity_verification_profile_projection
  AFTER INSERT OR UPDATE OR DELETE ON public.identity_verification_cases
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_identity_verification_profile_projection();

INSERT INTO public.identity_verification_cases (
  profile_id,
  status,
  verification_method,
  personal_info_completed,
  contact_info_completed,
  live_verification_completed,
  submitted_at,
  reviewed_at,
  resolved_at,
  notes,
  metadata,
  created_at,
  updated_at
)
SELECT
  profile.id,
  CASE
    WHEN coalesce(profile.is_verified, false) THEN 'approved'::public.identity_verification_case_status
    ELSE 'draft'::public.identity_verification_case_status
  END,
  'bootstrap_projection',
  (
    nullif(trim(coalesce(profile.full_name, '')), '') IS NOT NULL
    AND nullif(trim(coalesce(profile.country, '')), '') IS NOT NULL
    AND profile.date_of_birth IS NOT NULL
  ),
  (
    nullif(trim(coalesce(profile.phone_e164, '')), '') IS NOT NULL
    OR nullif(trim(coalesce(profile.phone_number, '')), '') IS NOT NULL
    OR nullif(trim(coalesce(profile.username, '')), '') IS NOT NULL
  ),
  coalesce(profile.is_verified, false),
  CASE
    WHEN coalesce(profile.is_verified, false) THEN coalesce(profile.citizenship_review_cleared_at, profile.updated_at, profile.created_at, now())
    ELSE NULL
  END,
  CASE
    WHEN coalesce(profile.is_verified, false) THEN coalesce(profile.citizenship_review_cleared_at, profile.updated_at, profile.created_at, now())
    ELSE NULL
  END,
  CASE
    WHEN coalesce(profile.is_verified, false) THEN coalesce(profile.citizenship_review_cleared_at, profile.updated_at, profile.created_at, now())
    ELSE NULL
  END,
  CASE
    WHEN coalesce(profile.is_verified, false) THEN 'Bootstrap approval imported from legacy verification flag'
    ELSE 'Bootstrap case created from legacy profile state'
  END,
  jsonb_build_object(
    'source', 'legacy_profiles_projection',
    'legacy_is_verified', coalesce(profile.is_verified, false)
  ),
  profile.created_at,
  coalesce(profile.updated_at, profile.created_at, now())
FROM public.profiles AS profile
ON CONFLICT (profile_id) DO NOTHING;

INSERT INTO public.identity_verification_reviews (
  case_id,
  reviewer_id,
  decision,
  notes,
  created_at
)
SELECT
  verification_case.id,
  CASE WHEN profile.role = 'founder'::public.app_role THEN profile.id ELSE NULL END,
  'approved'::public.identity_verification_decision,
  'Imported from legacy verification flag',
  coalesce(profile.citizenship_review_cleared_at, profile.updated_at, profile.created_at, now())
FROM public.identity_verification_cases AS verification_case
JOIN public.profiles AS profile ON profile.id = verification_case.profile_id
WHERE verification_case.status = 'approved'::public.identity_verification_case_status
  AND NOT EXISTS (
    SELECT 1
    FROM public.identity_verification_reviews AS review
    WHERE review.case_id = verification_case.id
  );

GRANT SELECT, INSERT, UPDATE ON public.identity_verification_cases TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.identity_verification_artifacts TO authenticated;
GRANT SELECT, INSERT ON public.identity_verification_reviews TO authenticated;

ALTER TABLE public.identity_verification_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_verification_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_verification_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Identity verification cases are readable by owner or admins" ON public.identity_verification_cases;
CREATE POLICY "Identity verification cases are readable by owner or admins" ON public.identity_verification_cases
  FOR SELECT USING (
    profile_id = public.current_profile_id()
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
  );

DROP POLICY IF EXISTS "Identity verification cases are insertable by owner or admins" ON public.identity_verification_cases;
CREATE POLICY "Identity verification cases are insertable by owner or admins" ON public.identity_verification_cases
  FOR INSERT WITH CHECK (
    profile_id = public.current_profile_id()
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
  );

DROP POLICY IF EXISTS "Identity verification cases are updatable by owner or admins" ON public.identity_verification_cases;
CREATE POLICY "Identity verification cases are updatable by owner or admins" ON public.identity_verification_cases
  FOR UPDATE USING (
    profile_id = public.current_profile_id()
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
  )
  WITH CHECK (
    profile_id = public.current_profile_id()
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
  );

DROP POLICY IF EXISTS "Identity verification artifacts are readable by owner or admins" ON public.identity_verification_artifacts;
CREATE POLICY "Identity verification artifacts are readable by owner or admins" ON public.identity_verification_artifacts
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.identity_verification_cases AS verification_case
      WHERE verification_case.id = case_id
        AND (
          verification_case.profile_id = public.current_profile_id()
          OR public.has_permission('role.assign'::public.app_permission)
          OR public.has_permission('settings.manage'::public.app_permission)
        )
    )
  );

DROP POLICY IF EXISTS "Identity verification artifacts are manageable by owner or admins" ON public.identity_verification_artifacts;
CREATE POLICY "Identity verification artifacts are manageable by owner or admins" ON public.identity_verification_artifacts
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.identity_verification_cases AS verification_case
      WHERE verification_case.id = case_id
        AND (
          verification_case.profile_id = public.current_profile_id()
          OR public.has_permission('role.assign'::public.app_permission)
          OR public.has_permission('settings.manage'::public.app_permission)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.identity_verification_cases AS verification_case
      WHERE verification_case.id = case_id
        AND (
          verification_case.profile_id = public.current_profile_id()
          OR public.has_permission('role.assign'::public.app_permission)
          OR public.has_permission('settings.manage'::public.app_permission)
        )
    )
  );

DROP POLICY IF EXISTS "Identity verification reviews are readable by owner or admins" ON public.identity_verification_reviews;
CREATE POLICY "Identity verification reviews are readable by owner or admins" ON public.identity_verification_reviews
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.identity_verification_cases AS verification_case
      WHERE verification_case.id = case_id
        AND (
          verification_case.profile_id = public.current_profile_id()
          OR public.has_permission('role.assign'::public.app_permission)
          OR public.has_permission('settings.manage'::public.app_permission)
        )
    )
  );

DROP POLICY IF EXISTS "Identity verification reviews are insertable by admins" ON public.identity_verification_reviews;
CREATE POLICY "Identity verification reviews are insertable by admins" ON public.identity_verification_reviews
  FOR INSERT WITH CHECK (
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
  );
