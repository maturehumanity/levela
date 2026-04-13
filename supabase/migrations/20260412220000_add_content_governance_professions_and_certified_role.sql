DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'certified'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'certified' AFTER 'verified_member';
  END IF;
END $$;

DO $$
DECLARE
  permission_label text;
BEGIN
  FOREACH permission_label IN ARRAY ARRAY[
    'content.read',
    'content.contribute_unmoderated',
    'content.contribute_moderated',
    'content.review',
    'content.moderate',
    'profession.verify'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typname = 'app_permission' AND e.enumlabel = permission_label
    ) THEN
      EXECUTE format('ALTER TYPE public.app_permission ADD VALUE %L', permission_label);
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  CREATE TYPE public.content_moderation_lane AS ENUM ('unmoderated', 'moderated');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.profession_verification_status AS ENUM ('pending', 'approved', 'suspended', 'revoked');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.content_review_status AS ENUM (
    'draft',
    'proposed',
    'in_review',
    'changes_requested',
    'approved',
    'rejected',
    'archived'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.professions (
  id text PRIMARY KEY,
  label text NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profile_professions (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  profession_id text NOT NULL REFERENCES public.professions(id) ON DELETE RESTRICT,
  status public.profession_verification_status NOT NULL DEFAULT 'pending',
  evidence_url text,
  notes text,
  verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, profession_id)
);

CREATE TABLE IF NOT EXISTS public.content_categories (
  id text PRIMARY KEY,
  label text NOT NULL,
  description text NOT NULL,
  default_moderation_lane public.content_moderation_lane NOT NULL,
  default_content_types text[] NOT NULL DEFAULT '{}'::text[],
  allowed_professions text[] NOT NULL DEFAULT '{}'::text[],
  contribution_policy text NOT NULL CHECK (contribution_policy IN ('open', 'verified_only', 'certified_professionals', 'staff_only')),
  required_contribution_permission public.app_permission NOT NULL,
  required_review_permission public.app_permission NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.content_contribution_rules (
  category_id text NOT NULL REFERENCES public.content_categories(id) ON DELETE CASCADE,
  content_type text NOT NULL DEFAULT '*',
  moderation_lane public.content_moderation_lane NOT NULL,
  allowed_roles public.app_role[] NOT NULL DEFAULT '{}'::public.app_role[],
  allowed_professions text[] NOT NULL DEFAULT '{}'::text[],
  required_permission public.app_permission NOT NULL,
  requires_approved_profession boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (category_id, content_type)
);

CREATE TABLE IF NOT EXISTS public.content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id text NOT NULL REFERENCES public.content_categories(id) ON DELETE RESTRICT DEFAULT 'community_knowledge',
  moderation_lane public.content_moderation_lane NOT NULL DEFAULT 'unmoderated',
  content_type text NOT NULL DEFAULT 'social_post',
  professional_domain text NOT NULL DEFAULT 'none',
  contribution_policy text NOT NULL DEFAULT 'open' CHECK (contribution_policy IN ('open', 'verified_only', 'certified_professionals', 'staff_only')),
  review_status public.content_review_status NOT NULL DEFAULT 'draft',
  title text,
  body_preview text,
  source_table text,
  source_id uuid,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  classification_method text NOT NULL DEFAULT 'auto',
  classification_confidence numeric(4, 3) NOT NULL DEFAULT 0.550 CHECK (classification_confidence >= 0 AND classification_confidence <= 1),
  classification_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_table, source_id)
);

INSERT INTO public.professions (id, label, description) VALUES
  ('education', 'Education', 'Academic materials, curricula, learning design, and assessment.'),
  ('law', 'Law', 'Legal references, rights frameworks, compliance-sensitive material, and contracts.'),
  ('governance', 'Governance', 'Policy, civic systems, institutional design, and public administration.'),
  ('medicine', 'Medicine', 'Health, medical education, and safety-sensitive wellness content.'),
  ('finance', 'Finance', 'Financial-risk, accounting, monetary, and value-system material.'),
  ('engineering', 'Engineering', 'Engineering standards, safety systems, and technical professional material.'),
  ('technology', 'Technology', 'Software, AI, data, security, and operational documentation.'),
  ('environment', 'Environment', 'Environmental stewardship, sustainability, climate, and ecological policy.'),
  ('economics', 'Economics', 'Economic systems, labor, markets, and public value material.'),
  ('arts_culture', 'Arts and Culture', 'Cultural, creative, humanities, and public education content.')
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  updated_at = now();

INSERT INTO public.content_categories (
  id,
  label,
  description,
  default_moderation_lane,
  default_content_types,
  allowed_professions,
  contribution_policy,
  required_contribution_permission,
  required_review_permission,
  sort_order
) VALUES
  ('intercommunication', 'Intercommunication', 'Ordinary chat, direct messages, comments, and lightweight social posts.', 'unmoderated', ARRAY['chat_message', 'direct_message', 'comment', 'social_post'], ARRAY['none'], 'open', 'content.contribute_unmoderated', 'content.moderate', 10),
  ('leisure_reading', 'Leisure Reading', 'Books and notes used for personal enjoyment rather than formal learning.', 'unmoderated', ARRAY['book', 'leisure_note'], ARRAY['none', 'arts_culture', 'education'], 'open', 'content.contribute_unmoderated', 'content.moderate', 20),
  ('community_knowledge', 'Community Knowledge', 'Informal public-interest knowledge that is not authoritative professional material.', 'unmoderated', ARRAY['social_post', 'lesson'], ARRAY['none', 'education', 'governance', 'technology', 'arts_culture'], 'verified_only', 'content.contribute_unmoderated', 'content.review', 30),
  ('academic_material', 'Academic Material', 'Study books, courses, lessons, exams, curricula, and formal learning paths.', 'moderated', ARRAY['study_book', 'course', 'lesson', 'exam'], ARRAY['education', 'law', 'governance', 'technology', 'environment', 'economics'], 'certified_professionals', 'content.contribute_moderated', 'content.review', 40),
  ('professional_material', 'Professional Material', 'Professional standards, certification material, and discipline-specific guidance.', 'moderated', ARRAY['professional_standard', 'professional_guide'], ARRAY['education', 'law', 'governance', 'medicine', 'finance', 'engineering', 'technology', 'environment', 'economics'], 'certified_professionals', 'content.contribute_moderated', 'content.review', 50),
  ('legal_content', 'Legal Content', 'Constitutions, laws, contracts, compliance material, and rights frameworks.', 'moderated', ARRAY['legal_reference', 'contract'], ARRAY['law', 'governance'], 'certified_professionals', 'content.contribute_moderated', 'content.review', 60),
  ('policy', 'Policy', 'Platform policy, governance rules, monetary policy, and moderation policy.', 'moderated', ARRAY['policy_document', 'governance_proposal'], ARRAY['governance', 'finance', 'economics', 'law'], 'staff_only', 'content.contribute_moderated', 'content.review', 70),
  ('system_operations', 'System Operations', 'Developer runbooks, release procedures, infrastructure, security, and database operations.', 'moderated', ARRAY['runbook', 'release_note'], ARRAY['technology', 'engineering', 'governance'], 'staff_only', 'content.contribute_moderated', 'content.review', 80)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  default_moderation_lane = EXCLUDED.default_moderation_lane,
  default_content_types = EXCLUDED.default_content_types,
  allowed_professions = EXCLUDED.allowed_professions,
  contribution_policy = EXCLUDED.contribution_policy,
  required_contribution_permission = EXCLUDED.required_contribution_permission,
  required_review_permission = EXCLUDED.required_review_permission,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.content_contribution_rules (
  category_id,
  content_type,
  moderation_lane,
  allowed_roles,
  allowed_professions,
  required_permission,
  requires_approved_profession
)
SELECT
  id,
  '*',
  default_moderation_lane,
  CASE contribution_policy
    WHEN 'open' THEN ARRAY['member', 'verified_member', 'certified', 'moderator', 'market_manager', 'founder', 'admin', 'system']::public.app_role[]
    WHEN 'verified_only' THEN ARRAY['verified_member', 'certified', 'moderator', 'market_manager', 'founder', 'admin', 'system']::public.app_role[]
    WHEN 'certified_professionals' THEN ARRAY['certified', 'moderator', 'founder', 'admin', 'system']::public.app_role[]
    WHEN 'staff_only' THEN ARRAY['moderator', 'founder', 'admin', 'system']::public.app_role[]
    ELSE ARRAY[]::public.app_role[]
  END,
  allowed_professions,
  required_contribution_permission,
  contribution_policy = 'certified_professionals'
FROM public.content_categories
ON CONFLICT (category_id, content_type) DO UPDATE SET
  moderation_lane = EXCLUDED.moderation_lane,
  allowed_roles = EXCLUDED.allowed_roles,
  allowed_professions = EXCLUDED.allowed_professions,
  required_permission = EXCLUDED.required_permission,
  requires_approved_profession = EXCLUDED.requires_approved_profession,
  updated_at = now();

INSERT INTO public.role_permissions (role, permission) VALUES
  ('guest', 'content.read'),
  ('member', 'content.read'),
  ('member', 'content.contribute_unmoderated'),
  ('verified_member', 'content.read'),
  ('verified_member', 'content.contribute_unmoderated'),
  ('certified', 'content.read'),
  ('certified', 'content.contribute_unmoderated'),
  ('certified', 'content.contribute_moderated'),
  ('certified', 'content.review'),
  ('certified', 'law.read'),
  ('certified', 'law.contribute'),
  ('certified', 'profile.read'),
  ('certified', 'profile.update_self'),
  ('certified', 'post.create'),
  ('certified', 'post.edit_self'),
  ('certified', 'post.delete_self'),
  ('certified', 'comment.create'),
  ('certified', 'comment.edit_self'),
  ('certified', 'comment.delete_self'),
  ('certified', 'message.create'),
  ('certified', 'message.edit_self'),
  ('certified', 'endorsement.create'),
  ('certified', 'report.create'),
  ('certified', 'like.create'),
  ('certified', 'like.delete_self'),
  ('moderator', 'content.read'),
  ('moderator', 'content.contribute_unmoderated'),
  ('moderator', 'content.contribute_moderated'),
  ('moderator', 'content.review'),
  ('moderator', 'content.moderate'),
  ('market_manager', 'content.read'),
  ('market_manager', 'content.contribute_unmoderated'),
  ('founder', 'content.read'),
  ('founder', 'content.contribute_unmoderated'),
  ('founder', 'content.contribute_moderated'),
  ('founder', 'content.review'),
  ('founder', 'content.moderate'),
  ('founder', 'profession.verify'),
  ('admin', 'content.read'),
  ('admin', 'content.contribute_unmoderated'),
  ('admin', 'content.contribute_moderated'),
  ('admin', 'content.review'),
  ('admin', 'content.moderate'),
  ('admin', 'profession.verify'),
  ('system', 'content.read'),
  ('system', 'content.contribute_unmoderated'),
  ('system', 'content.contribute_moderated'),
  ('system', 'content.review'),
  ('system', 'content.moderate'),
  ('system', 'profession.verify')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_legacy_admin_flag()
RETURNS TRIGGER AS $$
BEGIN
  NEW.is_admin = NEW.role IN ('founder', 'admin', 'system');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.levela_identity_status_prefix(user_role public.app_role, verified boolean)
RETURNS text AS $$
BEGIN
  IF user_role = 'founder' OR user_role = 'admin' THEN
    RETURN 'F';
  ELSIF user_role IN ('system', 'moderator', 'market_manager') THEN
    RETURN 'G';
  ELSIF user_role = 'certified' OR verified THEN
    RETURN 'W';
  END IF;

  RETURN 'E';
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.profile_has_approved_profession(target_profile_id uuid, allowed_professions text[])
RETURNS boolean AS $$
  SELECT COALESCE(
    'none' = ANY(COALESCE(allowed_professions, '{}'::text[]))
    OR EXISTS (
      SELECT 1
      FROM public.profile_professions profile_profession
      WHERE profile_profession.profile_id = target_profile_id
        AND profile_profession.status = 'approved'::public.profession_verification_status
        AND profile_profession.profession_id = ANY(COALESCE(allowed_professions, '{}'::text[]))
    ),
    false
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.classify_content_category(
  source text DEFAULT NULL,
  content_type text DEFAULT NULL,
  title text DEFAULT NULL,
  body_preview text DEFAULT NULL
)
RETURNS text AS $$
  SELECT CASE
    WHEN lower(coalesce(content_type, '')) IN ('chat_message', 'direct_message', 'comment', 'social_post') THEN 'intercommunication'
    WHEN lower(coalesce(content_type, '')) IN ('book', 'leisure_note') THEN 'leisure_reading'
    WHEN lower(coalesce(content_type, '')) IN ('study_book', 'course', 'lesson', 'exam') THEN 'academic_material'
    WHEN lower(coalesce(content_type, '')) IN ('professional_standard', 'professional_guide') THEN 'professional_material'
    WHEN lower(coalesce(content_type, '')) IN ('legal_reference', 'contract') THEN 'legal_content'
    WHEN lower(coalesce(content_type, '')) IN ('policy_document', 'governance_proposal') THEN 'policy'
    WHEN lower(coalesce(content_type, '')) IN ('runbook', 'release_note') THEN 'system_operations'
    WHEN lower(coalesce(source, '')) IN ('chat', 'message', 'direct_message', 'comment', 'post') THEN 'intercommunication'
    WHEN lower(concat_ws(' ', title, body_preview)) ~ '(constitution|statute|legal|contract|compliance|regulation|rights)' THEN 'legal_content'
    WHEN lower(concat_ws(' ', title, body_preview)) ~ '(policy|governance|monetary policy|moderation policy|ratification)' THEN 'policy'
    WHEN lower(concat_ws(' ', title, body_preview)) ~ '(certification|professional standard|practice guide|clinical|engineering standard|accounting)' THEN 'professional_material'
    WHEN lower(concat_ws(' ', title, body_preview)) ~ '(study|course|lesson|curriculum|exam|workbook|academic|training)' THEN 'academic_material'
    WHEN lower(concat_ws(' ', title, body_preview)) ~ '(release|deployment|database|runbook|security|remote access|migration)' THEN 'system_operations'
    WHEN lower(concat_ws(' ', title, body_preview)) ~ '(novel|story|poem|leisure|fiction)' THEN 'leisure_reading'
    ELSE 'community_knowledge'
  END;
$$ LANGUAGE SQL IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.prepare_content_item_classification()
RETURNS TRIGGER AS $$
DECLARE
  selected_category public.content_categories%ROWTYPE;
BEGIN
  IF NEW.classification_method = 'auto' OR NEW.category_id IS NULL OR NEW.category_id = '' THEN
    NEW.category_id := public.classify_content_category(
      NEW.source_table,
      NEW.content_type,
      NEW.title,
      NEW.body_preview
    );
  END IF;

  SELECT * INTO selected_category
  FROM public.content_categories
  WHERE id = NEW.category_id;

  IF NOT FOUND THEN
    NEW.category_id := 'community_knowledge';
    SELECT * INTO selected_category
    FROM public.content_categories
    WHERE id = NEW.category_id;
  END IF;

  NEW.moderation_lane := selected_category.default_moderation_lane;
  NEW.contribution_policy := selected_category.contribution_policy;
  NEW.professional_domain := COALESCE(
    NULLIF(NEW.professional_domain, ''),
    NULLIF(selected_category.allowed_professions[1], ''),
    'none'
  );

  IF NEW.review_status = 'draft' AND NEW.moderation_lane = 'unmoderated' THEN
    NEW.review_status := 'approved';
    NEW.reviewed_at := COALESCE(NEW.reviewed_at, now());
  ELSIF NEW.review_status = 'draft' AND NEW.moderation_lane = 'moderated' THEN
    NEW.review_status := 'proposed';
    NEW.submitted_at := COALESCE(NEW.submitted_at, now());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS prepare_content_item_classification ON public.content_items;
CREATE TRIGGER prepare_content_item_classification
  BEFORE INSERT OR UPDATE OF category_id, content_type, professional_domain, source_table, title, body_preview, classification_method ON public.content_items
  FOR EACH ROW
  EXECUTE FUNCTION public.prepare_content_item_classification();

CREATE OR REPLACE FUNCTION public.can_contribute_to_content_category(
  target_category_id text,
  target_profile_id uuid DEFAULT public.current_profile_id()
)
RETURNS boolean AS $$
DECLARE
  current_role public.app_role;
  category public.content_categories%ROWTYPE;
BEGIN
  IF target_profile_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT role INTO current_role
  FROM public.profiles
  WHERE id = target_profile_id
  LIMIT 1;

  SELECT * INTO category
  FROM public.content_categories
  WHERE id = target_category_id;

  IF current_role IS NULL OR NOT FOUND THEN
    RETURN false;
  END IF;

  IF current_role IN ('founder', 'admin', 'system') THEN
    RETURN true;
  END IF;

  IF NOT public.has_permission(category.required_contribution_permission) THEN
    RETURN false;
  END IF;

  IF category.contribution_policy = 'open' THEN
    RETURN true;
  END IF;

  IF category.contribution_policy = 'verified_only' THEN
    RETURN current_role IN ('verified_member', 'certified', 'moderator', 'market_manager', 'founder', 'admin', 'system');
  END IF;

  IF category.contribution_policy = 'staff_only' THEN
    RETURN current_role IN ('moderator', 'founder', 'admin', 'system');
  END IF;

  IF category.contribution_policy = 'certified_professionals' THEN
    RETURN current_role IN ('certified', 'moderator', 'founder', 'admin', 'system')
      AND public.profile_has_approved_profession(target_profile_id, category.allowed_professions);
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

DO $$
BEGIN
  CREATE TRIGGER update_professions_updated_at
    BEFORE UPDATE ON public.professions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_profile_professions_updated_at
    BEFORE UPDATE ON public.profile_professions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_content_categories_updated_at
    BEFORE UPDATE ON public.content_categories
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_content_contribution_rules_updated_at
    BEFORE UPDATE ON public.content_contribution_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_content_items_updated_at
    BEFORE UPDATE ON public.content_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_profile_professions_profile ON public.profile_professions(profile_id, status);
CREATE INDEX IF NOT EXISTS idx_profile_professions_profession ON public.profile_professions(profession_id, status);
CREATE INDEX IF NOT EXISTS idx_content_categories_lane ON public.content_categories(default_moderation_lane, sort_order);
CREATE INDEX IF NOT EXISTS idx_content_items_category_status ON public.content_items(category_id, review_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_items_author ON public.content_items(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_items_source ON public.content_items(source_table, source_id);

GRANT SELECT ON public.professions TO anon, authenticated;
GRANT SELECT ON public.content_categories TO anon, authenticated;
GRANT SELECT ON public.content_contribution_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_professions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_items TO authenticated;

ALTER TABLE public.professions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_professions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_contribution_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Professions are readable" ON public.professions;
CREATE POLICY "Professions are readable" ON public.professions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Content categories are readable" ON public.content_categories;
CREATE POLICY "Content categories are readable" ON public.content_categories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Content contribution rules are readable by authenticated users" ON public.content_contribution_rules;
CREATE POLICY "Content contribution rules are readable by authenticated users" ON public.content_contribution_rules
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Profession records are visible to owners and verifiers" ON public.profile_professions;
CREATE POLICY "Profession records are visible to owners and verifiers" ON public.profile_professions
  FOR SELECT USING (
    profile_id = public.current_profile_id()
    OR public.has_permission('profession.verify'::public.app_permission)
    OR public.has_permission('content.review'::public.app_permission)
  );

DROP POLICY IF EXISTS "Users can request their own professions" ON public.profile_professions;
CREATE POLICY "Users can request their own professions" ON public.profile_professions
  FOR INSERT WITH CHECK (
    profile_id = public.current_profile_id()
    AND status = 'pending'::public.profession_verification_status
  );

DROP POLICY IF EXISTS "Users can update pending profession evidence" ON public.profile_professions;
CREATE POLICY "Users can update pending profession evidence" ON public.profile_professions
  FOR UPDATE USING (
    profile_id = public.current_profile_id()
    OR public.has_permission('profession.verify'::public.app_permission)
  )
  WITH CHECK (
    public.has_permission('profession.verify'::public.app_permission)
    OR (
      profile_id = public.current_profile_id()
      AND status = 'pending'::public.profession_verification_status
      AND verified_by IS NULL
      AND verified_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Profession verifiers can delete profession records" ON public.profile_professions;
CREATE POLICY "Profession verifiers can delete profession records" ON public.profile_professions
  FOR DELETE USING (public.has_permission('profession.verify'::public.app_permission));

DROP POLICY IF EXISTS "Approved or owned content is readable" ON public.content_items;
CREATE POLICY "Approved or owned content is readable" ON public.content_items
  FOR SELECT USING (
    review_status = 'approved'::public.content_review_status
    OR author_id = public.current_profile_id()
    OR public.has_permission('content.review'::public.app_permission)
    OR public.has_permission('content.moderate'::public.app_permission)
  );

DROP POLICY IF EXISTS "Eligible users can register content items" ON public.content_items;
CREATE POLICY "Eligible users can register content items" ON public.content_items
  FOR INSERT WITH CHECK (
    author_id = public.current_profile_id()
    AND public.can_contribute_to_content_category(category_id, author_id)
  );

DROP POLICY IF EXISTS "Authors and reviewers can update content items" ON public.content_items;
CREATE POLICY "Authors and reviewers can update content items" ON public.content_items
  FOR UPDATE USING (
    author_id = public.current_profile_id()
    OR public.has_permission('content.review'::public.app_permission)
    OR public.has_permission('content.moderate'::public.app_permission)
  )
  WITH CHECK (
    author_id = public.current_profile_id()
    OR public.has_permission('content.review'::public.app_permission)
    OR public.has_permission('content.moderate'::public.app_permission)
  );

DROP POLICY IF EXISTS "Moderators can delete content items" ON public.content_items;
CREATE POLICY "Moderators can delete content items" ON public.content_items
  FOR DELETE USING (public.has_permission('content.moderate'::public.app_permission));
