DO $$
BEGIN
  CREATE TYPE public.governance_sanction_appeal_status AS ENUM (
    'open',
    'under_review',
    'accepted',
    'rejected',
    'withdrawn'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.governance_sanction_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sanction_id uuid NOT NULL REFERENCES public.governance_sanctions(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.governance_sanction_appeal_status NOT NULL DEFAULT 'open',
  appeal_reason text NOT NULL DEFAULT '',
  evidence_notes text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolution_notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_governance_sanction_appeals_profile
  ON public.governance_sanction_appeals (profile_id, opened_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_sanction_appeals_sanction
  ON public.governance_sanction_appeals (sanction_id, opened_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_governance_sanction_appeals_open_unique
  ON public.governance_sanction_appeals (sanction_id, profile_id)
  WHERE status IN (
    'open'::public.governance_sanction_appeal_status,
    'under_review'::public.governance_sanction_appeal_status
  );

DO $$
BEGIN
  CREATE TRIGGER update_governance_sanction_appeals_updated_at
    BEFORE UPDATE ON public.governance_sanction_appeals
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.governance_sanction_appeals TO authenticated;

ALTER TABLE public.governance_sanction_appeals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Governance sanction appeals are readable by owner or stewards" ON public.governance_sanction_appeals;
CREATE POLICY "Governance sanction appeals are readable by owner or stewards" ON public.governance_sanction_appeals
  FOR SELECT USING (
    profile_id = public.current_profile_id()
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.current_profile_in_governance_unit(
      ARRAY['constitutional_council', 'security_response', 'civic_operations', 'identity_verification']
    )
  );

DROP POLICY IF EXISTS "Governance sanction appeals are insertable by owner" ON public.governance_sanction_appeals;
CREATE POLICY "Governance sanction appeals are insertable by owner" ON public.governance_sanction_appeals
  FOR INSERT WITH CHECK (
    profile_id = public.current_profile_id()
    AND status = 'open'::public.governance_sanction_appeal_status
    AND EXISTS (
      SELECT 1
      FROM public.governance_sanctions AS sanction
      WHERE sanction.id = sanction_id
        AND sanction.profile_id = profile_id
        AND sanction.is_active = true
        AND sanction.starts_at <= now()
        AND (sanction.ends_at IS NULL OR sanction.ends_at > now())
    )
  );

DROP POLICY IF EXISTS "Governance sanction appeals are withdrawable by owner" ON public.governance_sanction_appeals;
CREATE POLICY "Governance sanction appeals are withdrawable by owner" ON public.governance_sanction_appeals
  FOR UPDATE USING (
    profile_id = public.current_profile_id()
    AND status IN (
      'open'::public.governance_sanction_appeal_status,
      'under_review'::public.governance_sanction_appeal_status
    )
  )
  WITH CHECK (
    profile_id = public.current_profile_id()
    AND status = 'withdrawn'::public.governance_sanction_appeal_status
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
  );

DROP POLICY IF EXISTS "Governance sanction appeals are manageable by stewards" ON public.governance_sanction_appeals;
CREATE POLICY "Governance sanction appeals are manageable by stewards" ON public.governance_sanction_appeals
  FOR UPDATE USING (
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.current_profile_in_governance_unit(
      ARRAY['constitutional_council', 'security_response', 'civic_operations', 'identity_verification']
    )
  )
  WITH CHECK (
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.current_profile_in_governance_unit(
      ARRAY['constitutional_council', 'security_response', 'civic_operations', 'identity_verification']
    )
  );
