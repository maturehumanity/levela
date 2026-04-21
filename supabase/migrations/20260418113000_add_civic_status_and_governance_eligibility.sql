DO $$
BEGIN
  CREATE TYPE public.citizenship_status AS ENUM (
    'registered_member',
    'verified_member',
    'citizen'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.activation_scope_type AS ENUM (
    'country',
    'world'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS citizenship_status public.citizenship_status NOT NULL DEFAULT 'registered_member',
  ADD COLUMN IF NOT EXISTS citizenship_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS citizenship_acceptance_mode text,
  ADD COLUMN IF NOT EXISTS citizenship_review_cleared_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_active_citizen boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS active_citizen_since timestamptz,
  ADD COLUMN IF NOT EXISTS is_governance_eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS governance_eligible_at timestamptz;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_citizenship_acceptance_mode_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_citizenship_acceptance_mode_check
  CHECK (
    citizenship_acceptance_mode IS NULL
    OR citizenship_acceptance_mode IN ('auto', 'manual', 'bootstrap', 'system_projection')
  );

CREATE OR REPLACE FUNCTION public.project_citizenship_status(
  user_role public.app_role,
  verified boolean
)
RETURNS public.citizenship_status AS $$
BEGIN
  IF user_role IN (
    'citizen',
    'certified',
    'moderator',
    'market_manager',
    'founder',
    'admin',
    'system'
  ) THEN
    RETURN 'citizen'::public.citizenship_status;
  END IF;

  IF verified THEN
    RETURN 'verified_member'::public.citizenship_status;
  END IF;

  RETURN 'registered_member'::public.citizenship_status;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.sync_profile_civic_projection()
RETURNS TRIGGER AS $$
DECLARE
  projected_status public.citizenship_status;
BEGIN
  projected_status := public.project_citizenship_status(NEW.role, coalesce(NEW.is_verified, false));

  IF NEW.citizenship_status IS NULL OR NEW.citizenship_status < projected_status THEN
    NEW.citizenship_status = projected_status;
  END IF;

  IF NEW.citizenship_status = 'citizen'::public.citizenship_status THEN
    NEW.citizenship_accepted_at = coalesce(NEW.citizenship_accepted_at, now());
    NEW.citizenship_acceptance_mode = coalesce(NEW.citizenship_acceptance_mode, 'system_projection');
  END IF;

  IF coalesce(NEW.is_verified, false) THEN
    NEW.citizenship_review_cleared_at = coalesce(NEW.citizenship_review_cleared_at, now());
  END IF;

  IF NEW.role = 'founder'::public.app_role AND coalesce(NEW.is_active_citizen, false) = false THEN
    NEW.is_active_citizen = true;
    NEW.active_citizen_since = coalesce(NEW.active_citizen_since, now());
  END IF;

  IF coalesce(NEW.is_active_citizen, false) THEN
    NEW.active_citizen_since = coalesce(NEW.active_citizen_since, now());
  END IF;

  IF coalesce(NEW.is_governance_eligible, false) THEN
    NEW.governance_eligible_at = coalesce(NEW.governance_eligible_at, now());
  ELSIF NEW.is_governance_eligible = false THEN
    NEW.governance_eligible_at = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS sync_profiles_civic_projection ON public.profiles;
CREATE TRIGGER sync_profiles_civic_projection
  BEFORE INSERT OR UPDATE OF role, is_verified, citizenship_status, is_active_citizen, is_governance_eligible
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_civic_projection();

UPDATE public.profiles
SET
  citizenship_status = public.project_citizenship_status(role, coalesce(is_verified, false)),
  citizenship_accepted_at = CASE
    WHEN public.project_citizenship_status(role, coalesce(is_verified, false)) = 'citizen'::public.citizenship_status
      THEN coalesce(citizenship_accepted_at, updated_at, created_at, now())
    ELSE citizenship_accepted_at
  END,
  citizenship_acceptance_mode = CASE
    WHEN public.project_citizenship_status(role, coalesce(is_verified, false)) = 'citizen'::public.citizenship_status
      THEN coalesce(citizenship_acceptance_mode, 'system_projection')
    ELSE citizenship_acceptance_mode
  END,
  citizenship_review_cleared_at = CASE
    WHEN coalesce(is_verified, false)
      THEN coalesce(citizenship_review_cleared_at, updated_at, created_at, now())
    ELSE citizenship_review_cleared_at
  END,
  is_active_citizen = CASE
    WHEN role = 'founder'::public.app_role THEN true
    ELSE is_active_citizen
  END,
  active_citizen_since = CASE
    WHEN role = 'founder'::public.app_role THEN coalesce(active_citizen_since, updated_at, created_at, now())
    WHEN is_active_citizen THEN coalesce(active_citizen_since, updated_at, created_at, now())
    ELSE active_citizen_since
  END,
  governance_eligible_at = CASE
    WHEN is_governance_eligible THEN coalesce(governance_eligible_at, updated_at, created_at, now())
    ELSE NULL
  END;

CREATE TABLE IF NOT EXISTS public.citizen_activation_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scope_type public.activation_scope_type NOT NULL,
  country_code text NOT NULL DEFAULT '',
  activated_at timestamptz NOT NULL DEFAULT now(),
  activated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, scope_type, country_code),
  CONSTRAINT citizen_activation_scopes_country_code_check CHECK (
    (scope_type = 'world'::public.activation_scope_type AND country_code = '')
    OR (scope_type = 'country'::public.activation_scope_type AND country_code <> '')
  )
);

CREATE TABLE IF NOT EXISTS public.governance_eligibility_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  citizenship_status public.citizenship_status NOT NULL,
  is_verified boolean NOT NULL DEFAULT false,
  is_active_citizen boolean NOT NULL DEFAULT false,
  levela_score numeric(6,2) NOT NULL DEFAULT 0,
  governance_score numeric(6,2) NOT NULL DEFAULT 0,
  influence_weight integer NOT NULL DEFAULT 0 CHECK (influence_weight >= 0),
  eligible boolean NOT NULL DEFAULT false,
  reason_codes text[] NOT NULL DEFAULT '{}'::text[],
  calculation_version text NOT NULL DEFAULT 'phase1-v1',
  source text NOT NULL DEFAULT 'client_projection',
  calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id)
);

CREATE INDEX IF NOT EXISTS idx_citizen_activation_scopes_profile
  ON public.citizen_activation_scopes (profile_id, scope_type, activated_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_eligibility_snapshots_eligible
  ON public.governance_eligibility_snapshots (eligible, calculated_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_eligibility_snapshots_profile
  ON public.governance_eligibility_snapshots (profile_id, calculated_at DESC);

DO $$
BEGIN
  CREATE TRIGGER update_governance_eligibility_snapshots_updated_at
    BEFORE UPDATE ON public.governance_eligibility_snapshots
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO public.citizen_activation_scopes (
  profile_id,
  scope_type,
  country_code,
  activated_at,
  activated_by,
  notes
)
SELECT
  id,
  'world'::public.activation_scope_type,
  '',
  coalesce(active_citizen_since, updated_at, created_at, now()),
  id,
  'Bootstrap founder activation'
FROM public.profiles
WHERE role = 'founder'::public.app_role
  AND is_active_citizen = true
ON CONFLICT (profile_id, scope_type, country_code) DO NOTHING;

GRANT SELECT ON public.citizen_activation_scopes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.governance_eligibility_snapshots TO authenticated;

ALTER TABLE public.citizen_activation_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_eligibility_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Citizen activation scopes are readable by owner or admins" ON public.citizen_activation_scopes;
CREATE POLICY "Citizen activation scopes are readable by owner or admins" ON public.citizen_activation_scopes
  FOR SELECT USING (
    profile_id = public.current_profile_id()
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
  );

DROP POLICY IF EXISTS "Citizen activation scopes are manageable by admins" ON public.citizen_activation_scopes;
CREATE POLICY "Citizen activation scopes are manageable by admins" ON public.citizen_activation_scopes
  FOR ALL USING (
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
  )
  WITH CHECK (
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
  );

DROP POLICY IF EXISTS "Governance eligibility snapshots are readable by owner or admins" ON public.governance_eligibility_snapshots;
CREATE POLICY "Governance eligibility snapshots are readable by owner or admins" ON public.governance_eligibility_snapshots
  FOR SELECT USING (
    profile_id = public.current_profile_id()
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
  );

DROP POLICY IF EXISTS "Governance eligibility snapshots are insertable by owner or admins" ON public.governance_eligibility_snapshots;
CREATE POLICY "Governance eligibility snapshots are insertable by owner or admins" ON public.governance_eligibility_snapshots
  FOR INSERT WITH CHECK (
    profile_id = public.current_profile_id()
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
  );

DROP POLICY IF EXISTS "Governance eligibility snapshots are updatable by owner or admins" ON public.governance_eligibility_snapshots;
CREATE POLICY "Governance eligibility snapshots are updatable by owner or admins" ON public.governance_eligibility_snapshots
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
