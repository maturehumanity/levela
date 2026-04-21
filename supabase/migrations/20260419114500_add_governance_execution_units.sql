DO $$
BEGIN
  CREATE TYPE public.governance_unit_membership_role AS ENUM (
    'lead',
    'member',
    'observer'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.governance_implementation_status AS ENUM (
    'queued',
    'in_progress',
    'completed',
    'blocked',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.governance_execution_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  domain_key text NOT NULL,
  is_system_unit boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.governance_execution_unit_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.governance_execution_units(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  membership_role public.governance_unit_membership_role NOT NULL DEFAULT 'member',
  is_active boolean NOT NULL DEFAULT true,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unit_id, profile_id)
);

CREATE TABLE IF NOT EXISTS public.governance_proposal_implementations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.governance_proposals(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.governance_execution_units(id) ON DELETE CASCADE,
  status public.governance_implementation_status NOT NULL DEFAULT 'queued',
  implementation_summary text NOT NULL DEFAULT '',
  assigned_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, unit_id)
);

CREATE INDEX IF NOT EXISTS idx_governance_execution_units_active
  ON public.governance_execution_units (is_active, unit_key);

CREATE INDEX IF NOT EXISTS idx_governance_execution_unit_memberships_profile
  ON public.governance_execution_unit_memberships (profile_id, is_active, assigned_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_proposal_implementations_status
  ON public.governance_proposal_implementations (status, assigned_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_proposal_implementations_proposal
  ON public.governance_proposal_implementations (proposal_id, created_at DESC);

DO $$
BEGIN
  CREATE TRIGGER update_governance_execution_units_updated_at
    BEFORE UPDATE ON public.governance_execution_units
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_governance_proposal_implementations_updated_at
    BEFORE UPDATE ON public.governance_proposal_implementations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO public.governance_execution_units (unit_key, name, description, domain_key)
VALUES
  (
    'civic_operations',
    'Civic Operations Unit',
    'Implements ordinary approved decisions, keeps execution moving, and coordinates follow-through across the system.',
    'civic_operations'
  ),
  (
    'policy_legal',
    'Policy and Legal Unit',
    'Translates approved governance outcomes into platform rules, policy language, and legal-operational updates.',
    'policy_legal'
  ),
  (
    'technical_stewardship',
    'Technical Stewardship Unit',
    'Implements approved technical, product, and infrastructure changes required by governance outcomes.',
    'technical_stewardship'
  ),
  (
    'constitutional_council',
    'Constitutional Council Unit',
    'Owns constitutional implementation, reserved interpretation changes, and ratified structural transitions.',
    'constitutional_review'
  ),
  (
    'identity_verification',
    'Identity Verification Unit',
    'Implements approved identity, verification, and trust workflow changes.',
    'identity_verification'
  ),
  (
    'security_response',
    'Security Response Unit',
    'Implements approved security, recovery, and incident-response decisions.',
    'security_incident_response'
  ),
  (
    'treasury_finance',
    'Treasury and Finance Unit',
    'Implements approved monetary, treasury, and financial governance outcomes.',
    'treasury_finance'
  )
ON CONFLICT (unit_key) DO UPDATE
SET
  name = excluded.name,
  description = excluded.description,
  domain_key = excluded.domain_key,
  is_active = true;

INSERT INTO public.governance_execution_unit_memberships (
  unit_id,
  profile_id,
  membership_role,
  is_active,
  assigned_at,
  assigned_by,
  notes
)
SELECT
  unit.id,
  profile.id,
  'lead'::public.governance_unit_membership_role,
  true,
  now(),
  profile.id,
  'Bootstrap founder membership'
FROM public.governance_execution_units AS unit
JOIN public.profiles AS profile ON profile.role = 'founder'::public.app_role
ON CONFLICT (unit_id, profile_id) DO UPDATE
SET
  membership_role = excluded.membership_role,
  is_active = true,
  notes = excluded.notes;

GRANT SELECT ON public.governance_execution_units TO authenticated;
GRANT SELECT ON public.governance_execution_unit_memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.governance_proposal_implementations TO authenticated;

ALTER TABLE public.governance_execution_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_execution_unit_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_proposal_implementations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Governance execution units are readable by authenticated users" ON public.governance_execution_units;
CREATE POLICY "Governance execution units are readable by authenticated users" ON public.governance_execution_units
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Governance execution unit memberships are readable by authenticated users" ON public.governance_execution_unit_memberships;
CREATE POLICY "Governance execution unit memberships are readable by authenticated users" ON public.governance_execution_unit_memberships
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Governance implementations are readable by authenticated users" ON public.governance_proposal_implementations;
CREATE POLICY "Governance implementations are readable by authenticated users" ON public.governance_proposal_implementations
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Governance implementations are insertable by current profile" ON public.governance_proposal_implementations;
CREATE POLICY "Governance implementations are insertable by current profile" ON public.governance_proposal_implementations
  FOR INSERT WITH CHECK (
    created_by = public.current_profile_id()
    OR (
      created_by IS NULL
      AND (
        public.has_permission('role.assign'::public.app_permission)
        OR public.has_permission('settings.manage'::public.app_permission)
      )
    )
  );

DROP POLICY IF EXISTS "Governance implementations are updatable by admins" ON public.governance_proposal_implementations;
CREATE POLICY "Governance implementations are updatable by admins" ON public.governance_proposal_implementations
  FOR UPDATE USING (
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
  )
  WITH CHECK (
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
  );
