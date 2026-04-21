CREATE TABLE IF NOT EXISTS public.governance_domains (
  domain_key text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.governance_domain_roles (
  domain_key text NOT NULL REFERENCES public.governance_domains(domain_key) ON DELETE CASCADE,
  role_key text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_system_role boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (domain_key, role_key)
);

CREATE TABLE IF NOT EXISTS public.profile_governance_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  domain_key text NOT NULL,
  role_key text NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  ended_at timestamptz,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  assignment_source text NOT NULL DEFAULT 'manual',
  source_unit_id uuid REFERENCES public.governance_execution_units(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_governance_roles_role_fkey
    FOREIGN KEY (domain_key, role_key)
    REFERENCES public.governance_domain_roles(domain_key, role_key)
    ON DELETE CASCADE,
  CONSTRAINT profile_governance_roles_profile_domain_role_unique
    UNIQUE (profile_id, domain_key, role_key),
  CONSTRAINT profile_governance_roles_window_check CHECK (
    ended_at IS NULL OR ended_at > assigned_at
  ),
  CONSTRAINT profile_governance_roles_assignment_source_check CHECK (
    assignment_source IN ('manual', 'unit_membership_sync', 'bootstrap_migration')
  )
);

CREATE INDEX IF NOT EXISTS idx_profile_governance_roles_profile_active
  ON public.profile_governance_roles (profile_id, is_active, domain_key, role_key);

CREATE INDEX IF NOT EXISTS idx_profile_governance_roles_domain_active
  ON public.profile_governance_roles (domain_key, is_active, role_key);

DO $$
BEGIN
  CREATE TRIGGER update_governance_domains_updated_at
    BEFORE UPDATE ON public.governance_domains
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_governance_domain_roles_updated_at
    BEFORE UPDATE ON public.governance_domain_roles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_profile_governance_roles_updated_at
    BEFORE UPDATE ON public.profile_governance_roles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO public.governance_domains (domain_key, name, description)
VALUES
  (
    'identity_verification',
    'Identity Verification',
    'Verification workflow stewardship and identity trust review operations.'
  ),
  (
    'moderation_conduct',
    'Moderation and Conduct',
    'Moderation operations, conduct standards, and enforcement stewardship.'
  ),
  (
    'constitutional_review',
    'Constitutional Review',
    'Constitutional interpretation, ratification support, and structural governance oversight.'
  ),
  (
    'policy_legal',
    'Policy and Legal',
    'Policy authoring, legal-operational review, and governance rule translation.'
  ),
  (
    'treasury_finance',
    'Treasury and Finance',
    'Treasury policy, monetary controls, and financial governance stewardship.'
  ),
  (
    'market_oversight',
    'Market Oversight',
    'Marketplace integrity, risk controls, and economic oversight functions.'
  ),
  (
    'technical_stewardship',
    'Technical Stewardship',
    'Technical execution, release stewardship, and infrastructure governance.'
  ),
  (
    'dispute_resolution',
    'Dispute Resolution',
    'Appeals, dispute handling, and procedural fairness stewardship.'
  ),
  (
    'security_incident_response',
    'Security and Incident Response',
    'Security operations, incident-response governance, and recovery review.'
  ),
  (
    'civic_education',
    'Civic Education',
    'Civic education standards, certification quality, and governance literacy stewardship.'
  ),
  (
    'activation_review',
    'Activation Review',
    'Country/world activation review and declaration oversight.'
  ),
  (
    'civic_operations',
    'Civic Operations',
    'Operational follow-through and governance implementation coordination.'
  )
ON CONFLICT (domain_key) DO UPDATE
SET
  name = excluded.name,
  description = excluded.description,
  is_active = true;

DO $$
BEGIN
  ALTER TABLE public.governance_execution_units
    ADD CONSTRAINT governance_execution_units_domain_key_fkey
    FOREIGN KEY (domain_key)
    REFERENCES public.governance_domains(domain_key)
    ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO public.governance_domain_roles (domain_key, role_key, name, description, is_system_role)
SELECT
  domain.domain_key,
  role.role_key,
  role.name,
  role.description,
  true
FROM public.governance_domains AS domain
CROSS JOIN (
  VALUES
    ('domain_lead', 'Domain Lead', 'Primary accountable steward for this governance domain.'),
    ('steward', 'Domain Steward', 'Operational steward with active responsibilities in this domain.'),
    ('reviewer', 'Domain Reviewer', 'Review and oversight role for this domain.''s governance flow.')
) AS role(role_key, name, description)
ON CONFLICT (domain_key, role_key) DO UPDATE
SET
  name = excluded.name,
  description = excluded.description,
  is_system_role = true;

CREATE OR REPLACE FUNCTION public.map_governance_domain_role_from_unit_membership_role(
  membership_role public.governance_unit_membership_role
)
RETURNS text AS $$
  SELECT CASE membership_role
    WHEN 'lead'::public.governance_unit_membership_role THEN 'domain_lead'
    WHEN 'observer'::public.governance_unit_membership_role THEN 'reviewer'
    ELSE 'steward'
  END;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

INSERT INTO public.profile_governance_roles (
  profile_id,
  domain_key,
  role_key,
  assigned_at,
  assigned_by,
  is_active,
  ended_at,
  notes,
  metadata,
  assignment_source,
  source_unit_id
)
SELECT
  membership.profile_id,
  unit.domain_key,
  public.map_governance_domain_role_from_unit_membership_role(membership.membership_role),
  membership.assigned_at,
  membership.assigned_by,
  true,
  NULL,
  coalesce(membership.notes, 'Backfilled from governance execution unit membership'),
  jsonb_build_object(
    'source', 'governance_execution_unit_membership',
    'unit_id', membership.unit_id,
    'membership_id', membership.id
  ),
  'bootstrap_migration',
  membership.unit_id
FROM public.governance_execution_unit_memberships AS membership
JOIN public.governance_execution_units AS unit ON unit.id = membership.unit_id
WHERE membership.is_active = true
  AND unit.is_active = true
ON CONFLICT (profile_id, domain_key, role_key) DO UPDATE
SET
  is_active = true,
  ended_at = NULL,
  assigned_by = excluded.assigned_by,
  assignment_source = 'unit_membership_sync',
  source_unit_id = excluded.source_unit_id,
  metadata = public.profile_governance_roles.metadata
    || jsonb_build_object('last_backfilled_at', now()),
  updated_at = now();

CREATE OR REPLACE FUNCTION public.sync_profile_governance_roles_from_unit_memberships()
RETURNS TRIGGER AS $$
DECLARE
  old_domain_key text;
  new_domain_key text;
  old_role_key text;
  new_role_key text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    SELECT unit.domain_key
    INTO old_domain_key
    FROM public.governance_execution_units AS unit
    WHERE unit.id = OLD.unit_id;

    old_role_key := public.map_governance_domain_role_from_unit_membership_role(OLD.membership_role);
  END IF;

  IF TG_OP <> 'DELETE' THEN
    SELECT unit.domain_key
    INTO new_domain_key
    FROM public.governance_execution_units AS unit
    WHERE unit.id = NEW.unit_id;

    new_role_key := public.map_governance_domain_role_from_unit_membership_role(NEW.membership_role);
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE')
    AND coalesce(OLD.is_active, false)
    AND old_domain_key IS NOT NULL
    AND (
      TG_OP = 'DELETE'
      OR NOT coalesce(NEW.is_active, false)
      OR OLD.profile_id IS DISTINCT FROM NEW.profile_id
      OR OLD.unit_id IS DISTINCT FROM NEW.unit_id
      OR OLD.membership_role IS DISTINCT FROM NEW.membership_role
    )
  THEN
    UPDATE public.profile_governance_roles
    SET
      is_active = false,
      ended_at = coalesce(ended_at, now()),
      updated_at = now()
    WHERE profile_id = OLD.profile_id
      AND domain_key = old_domain_key
      AND role_key = old_role_key
      AND assignment_source IN ('unit_membership_sync', 'bootstrap_migration')
      AND (source_unit_id = OLD.unit_id OR source_unit_id IS NULL);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE')
    AND coalesce(NEW.is_active, false)
    AND new_domain_key IS NOT NULL
  THEN
    INSERT INTO public.profile_governance_roles (
      profile_id,
      domain_key,
      role_key,
      assigned_at,
      assigned_by,
      is_active,
      ended_at,
      notes,
      metadata,
      assignment_source,
      source_unit_id
    )
    VALUES (
      NEW.profile_id,
      new_domain_key,
      new_role_key,
      coalesce(NEW.assigned_at, now()),
      NEW.assigned_by,
      true,
      NULL,
      coalesce(NEW.notes, 'Synced from governance execution unit membership'),
      jsonb_build_object(
        'source', 'governance_execution_unit_membership',
        'unit_id', NEW.unit_id,
        'membership_id', NEW.id,
        'synced_at', now()
      ),
      'unit_membership_sync',
      NEW.unit_id
    )
    ON CONFLICT (profile_id, domain_key, role_key) DO UPDATE
    SET
      is_active = true,
      ended_at = NULL,
      assigned_by = excluded.assigned_by,
      notes = excluded.notes,
      metadata = public.profile_governance_roles.metadata
        || jsonb_build_object('last_synced_at', now()),
      assignment_source = 'unit_membership_sync',
      source_unit_id = excluded.source_unit_id,
      updated_at = now();
  END IF;

  RETURN coalesce(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS sync_profile_governance_roles_from_unit_memberships_trigger ON public.governance_execution_unit_memberships;
CREATE TRIGGER sync_profile_governance_roles_from_unit_memberships_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.governance_execution_unit_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_governance_roles_from_unit_memberships();

CREATE OR REPLACE FUNCTION public.profile_has_governance_domain_role(
  target_profile_id uuid,
  domain_keys text[],
  role_keys text[] DEFAULT NULL
)
RETURNS boolean AS $$
  SELECT coalesce(
    target_profile_id IS NOT NULL
    AND EXISTS (
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
    ),
    false
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.current_profile_has_governance_domain_role(
  domain_keys text[],
  role_keys text[] DEFAULT NULL
)
RETURNS boolean AS $$
  SELECT public.profile_has_governance_domain_role(public.current_profile_id(), domain_keys, role_keys);
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.current_profile_in_governance_domain(
  domain_keys text[]
)
RETURNS boolean AS $$
  SELECT public.current_profile_has_governance_domain_role(domain_keys, NULL);
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

GRANT SELECT ON public.governance_domains TO authenticated;
GRANT SELECT ON public.governance_domain_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profile_governance_roles TO authenticated;

ALTER TABLE public.governance_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_domain_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_governance_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Governance domains are readable by authenticated users" ON public.governance_domains;
CREATE POLICY "Governance domains are readable by authenticated users" ON public.governance_domains
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Governance domain roles are readable by authenticated users" ON public.governance_domain_roles;
CREATE POLICY "Governance domain roles are readable by authenticated users" ON public.governance_domain_roles
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Profile governance roles are readable by authenticated users" ON public.profile_governance_roles;
CREATE POLICY "Profile governance roles are readable by authenticated users" ON public.profile_governance_roles
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Profile governance roles are manageable by admins" ON public.profile_governance_roles;
CREATE POLICY "Profile governance roles are manageable by admins" ON public.profile_governance_roles
  FOR ALL USING (
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
  )
  WITH CHECK (
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
  );

DROP POLICY IF EXISTS "Citizen activation scopes are readable by governance units or admins" ON public.citizen_activation_scopes;
DROP POLICY IF EXISTS "Citizen activation scopes are readable by governance domains or admins" ON public.citizen_activation_scopes;
CREATE POLICY "Citizen activation scopes are readable by governance domains or admins" ON public.citizen_activation_scopes
  FOR SELECT USING (
    profile_id = public.current_profile_id()
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.current_profile_in_governance_domain(ARRAY['civic_operations', 'constitutional_review'])
  );

DROP POLICY IF EXISTS "Citizen activation scopes are manageable by governance units or admins" ON public.citizen_activation_scopes;
DROP POLICY IF EXISTS "Citizen activation scopes are manageable by governance domains or admins" ON public.citizen_activation_scopes;
CREATE POLICY "Citizen activation scopes are manageable by governance domains or admins" ON public.citizen_activation_scopes
  FOR ALL USING (
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.current_profile_in_governance_domain(ARRAY['civic_operations', 'constitutional_review'])
  )
  WITH CHECK (
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.current_profile_in_governance_domain(ARRAY['civic_operations', 'constitutional_review'])
  );

DROP POLICY IF EXISTS "Identity verification cases are readable by governance units or admins" ON public.identity_verification_cases;
DROP POLICY IF EXISTS "Identity verification cases are readable by governance domains or admins" ON public.identity_verification_cases;
CREATE POLICY "Identity verification cases are readable by governance domains or admins" ON public.identity_verification_cases
  FOR SELECT USING (
    profile_id = public.current_profile_id()
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.current_profile_in_governance_domain(ARRAY['identity_verification'])
  );

DROP POLICY IF EXISTS "Identity verification cases are insertable by governance units or admins" ON public.identity_verification_cases;
DROP POLICY IF EXISTS "Identity verification cases are insertable by governance domains or admins" ON public.identity_verification_cases;
CREATE POLICY "Identity verification cases are insertable by governance domains or admins" ON public.identity_verification_cases
  FOR INSERT WITH CHECK (
    profile_id = public.current_profile_id()
    OR (
      NOT public.current_profile_has_governance_block('verification_review'::public.governance_block_scope)
      AND (
        public.has_permission('role.assign'::public.app_permission)
        OR public.has_permission('settings.manage'::public.app_permission)
        OR public.current_profile_in_governance_domain(ARRAY['identity_verification'])
      )
    )
  );

DROP POLICY IF EXISTS "Identity verification cases are updatable by governance units or admins" ON public.identity_verification_cases;
DROP POLICY IF EXISTS "Identity verification cases are updatable by governance domains or admins" ON public.identity_verification_cases;
CREATE POLICY "Identity verification cases are updatable by governance domains or admins" ON public.identity_verification_cases
  FOR UPDATE USING (
    profile_id = public.current_profile_id()
    OR (
      NOT public.current_profile_has_governance_block('verification_review'::public.governance_block_scope)
      AND (
        public.has_permission('role.assign'::public.app_permission)
        OR public.has_permission('settings.manage'::public.app_permission)
        OR public.current_profile_in_governance_domain(ARRAY['identity_verification'])
      )
    )
  )
  WITH CHECK (
    profile_id = public.current_profile_id()
    OR (
      NOT public.current_profile_has_governance_block('verification_review'::public.governance_block_scope)
      AND (
        public.has_permission('role.assign'::public.app_permission)
        OR public.has_permission('settings.manage'::public.app_permission)
        OR public.current_profile_in_governance_domain(ARRAY['identity_verification'])
      )
    )
  );

DROP POLICY IF EXISTS "Identity verification reviews are insertable by governance units or admins" ON public.identity_verification_reviews;
DROP POLICY IF EXISTS "Identity verification reviews are insertable by governance domains or admins" ON public.identity_verification_reviews;
CREATE POLICY "Identity verification reviews are insertable by governance domains or admins" ON public.identity_verification_reviews
  FOR INSERT WITH CHECK (
    NOT public.current_profile_has_governance_block('verification_review'::public.governance_block_scope)
    AND (
      public.has_permission('role.assign'::public.app_permission)
      OR public.has_permission('settings.manage'::public.app_permission)
      OR public.current_profile_in_governance_domain(ARRAY['identity_verification'])
    )
  );

DROP POLICY IF EXISTS "Active monetary policies are readable by governance units or admins" ON public.monetary_policy_profiles;
DROP POLICY IF EXISTS "Active monetary policies are readable by governance domains or admins" ON public.monetary_policy_profiles;
CREATE POLICY "Active monetary policies are readable by governance domains or admins" ON public.monetary_policy_profiles
  FOR SELECT USING (
    is_active = true
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.current_profile_in_governance_domain(ARRAY['treasury_finance', 'policy_legal'])
  );

DROP POLICY IF EXISTS "Monetary policies are manageable by governance units or admins" ON public.monetary_policy_profiles;
DROP POLICY IF EXISTS "Monetary policies are manageable by governance domains or admins" ON public.monetary_policy_profiles;
CREATE POLICY "Monetary policies are manageable by governance domains or admins" ON public.monetary_policy_profiles
  FOR ALL USING (
    public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.current_profile_in_governance_domain(ARRAY['treasury_finance'])
  )
  WITH CHECK (
    public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.current_profile_in_governance_domain(ARRAY['treasury_finance'])
  );

DROP POLICY IF EXISTS "Monetary audit events are readable by governance units or admins" ON public.monetary_policy_audit_events;
DROP POLICY IF EXISTS "Monetary audit events are readable by governance domains or admins" ON public.monetary_policy_audit_events;
CREATE POLICY "Monetary audit events are readable by governance domains or admins" ON public.monetary_policy_audit_events
  FOR SELECT USING (
    public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.current_profile_in_governance_domain(ARRAY['treasury_finance'])
  );

DROP POLICY IF EXISTS "Monetary audit events are insertable by governance units or admins" ON public.monetary_policy_audit_events;
DROP POLICY IF EXISTS "Monetary audit events are insertable by governance domains or admins" ON public.monetary_policy_audit_events;
CREATE POLICY "Monetary audit events are insertable by governance domains or admins" ON public.monetary_policy_audit_events
  FOR INSERT WITH CHECK (
    public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.current_profile_in_governance_domain(ARRAY['treasury_finance'])
  );

DROP POLICY IF EXISTS "Study certifications are readable by governance units or owner" ON public.study_certifications;
DROP POLICY IF EXISTS "Study certifications are readable by governance domains or owner" ON public.study_certifications;
CREATE POLICY "Study certifications are readable by governance domains or owner" ON public.study_certifications
  FOR SELECT USING (
    profile_id = public.current_profile_id()
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.current_profile_in_governance_domain(ARRAY['civic_operations', 'constitutional_review'])
  );

DROP POLICY IF EXISTS "Study certifications are manageable by governance units or owner" ON public.study_certifications;
DROP POLICY IF EXISTS "Study certifications are manageable by governance domains or owner" ON public.study_certifications;
CREATE POLICY "Study certifications are manageable by governance domains or owner" ON public.study_certifications
  FOR ALL USING (
    profile_id = public.current_profile_id()
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.current_profile_in_governance_domain(ARRAY['civic_operations', 'constitutional_review'])
  )
  WITH CHECK (
    profile_id = public.current_profile_id()
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.current_profile_in_governance_domain(ARRAY['civic_operations', 'constitutional_review'])
  );

DROP POLICY IF EXISTS "Approved or owned content is readable by governance units" ON public.content_items;
DROP POLICY IF EXISTS "Approved or owned content is readable by governance domains" ON public.content_items;
CREATE POLICY "Approved or owned content is readable by governance domains" ON public.content_items
  FOR SELECT USING (
    review_status = 'approved'::public.content_review_status
    OR author_id = public.current_profile_id()
    OR public.has_permission('content.review'::public.app_permission)
    OR public.has_permission('content.moderate'::public.app_permission)
    OR public.current_profile_in_governance_domain(ARRAY['policy_legal', 'constitutional_review'])
  );

DROP POLICY IF EXISTS "Authors and reviewers can update content items with governance units" ON public.content_items;
DROP POLICY IF EXISTS "Authors and reviewers can update content items with governance domains" ON public.content_items;
CREATE POLICY "Authors and reviewers can update content items with governance domains" ON public.content_items
  FOR UPDATE USING (
    author_id = public.current_profile_id()
    OR public.has_permission('content.review'::public.app_permission)
    OR public.has_permission('content.moderate'::public.app_permission)
    OR public.current_profile_in_governance_domain(ARRAY['policy_legal', 'constitutional_review'])
  )
  WITH CHECK (
    author_id = public.current_profile_id()
    OR public.has_permission('content.review'::public.app_permission)
    OR public.has_permission('content.moderate'::public.app_permission)
    OR public.current_profile_in_governance_domain(ARRAY['policy_legal', 'constitutional_review'])
  );

DROP POLICY IF EXISTS "Governance sanctions are readable by owner or stewards" ON public.governance_sanctions;
DROP POLICY IF EXISTS "Governance sanctions are readable by owner or domain stewards" ON public.governance_sanctions;
CREATE POLICY "Governance sanctions are readable by owner or domain stewards" ON public.governance_sanctions
  FOR SELECT USING (
    profile_id = public.current_profile_id()
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.current_profile_in_governance_domain(
      ARRAY['constitutional_review', 'security_incident_response', 'civic_operations', 'identity_verification']
    )
  );

DROP POLICY IF EXISTS "Governance sanctions are manageable by stewards" ON public.governance_sanctions;
DROP POLICY IF EXISTS "Governance sanctions are manageable by domain stewards" ON public.governance_sanctions;
CREATE POLICY "Governance sanctions are manageable by domain stewards" ON public.governance_sanctions
  FOR ALL USING (
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.current_profile_in_governance_domain(
      ARRAY['constitutional_review', 'security_incident_response', 'civic_operations', 'identity_verification']
    )
  )
  WITH CHECK (
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.current_profile_in_governance_domain(
      ARRAY['constitutional_review', 'security_incident_response', 'civic_operations', 'identity_verification']
    )
  );

DROP POLICY IF EXISTS "Governance sanction appeals are readable by owner or stewards" ON public.governance_sanction_appeals;
DROP POLICY IF EXISTS "Governance sanction appeals are readable by owner or domain stewards" ON public.governance_sanction_appeals;
CREATE POLICY "Governance sanction appeals are readable by owner or domain stewards" ON public.governance_sanction_appeals
  FOR SELECT USING (
    profile_id = public.current_profile_id()
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.current_profile_in_governance_domain(
      ARRAY['constitutional_review', 'security_incident_response', 'civic_operations', 'identity_verification']
    )
  );

DROP POLICY IF EXISTS "Governance sanction appeals are manageable by stewards" ON public.governance_sanction_appeals;
DROP POLICY IF EXISTS "Governance sanction appeals are manageable by domain stewards" ON public.governance_sanction_appeals;
CREATE POLICY "Governance sanction appeals are manageable by domain stewards" ON public.governance_sanction_appeals
  FOR UPDATE USING (
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.current_profile_in_governance_domain(
      ARRAY['constitutional_review', 'security_incident_response', 'civic_operations', 'identity_verification']
    )
  )
  WITH CHECK (
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.current_profile_in_governance_domain(
      ARRAY['constitutional_review', 'security_incident_response', 'civic_operations', 'identity_verification']
    )
  );
