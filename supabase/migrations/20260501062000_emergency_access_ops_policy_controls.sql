-- Stewardship policy controls for emergency access operations SLO thresholds.

CREATE TABLE IF NOT EXISTS public.governance_emergency_access_ops_policies (
  policy_key text PRIMARY KEY,
  policy_name text NOT NULL,
  pending_max_age_hours integer NOT NULL DEFAULT 24,
  approved_max_age_minutes integer NOT NULL DEFAULT 120,
  near_expiry_window_minutes integer NOT NULL DEFAULT 15,
  escalation_enabled boolean NOT NULL DEFAULT true,
  oncall_channel text NOT NULL DEFAULT 'public_audit_ops',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_emergency_access_ops_policies_policy_key_not_empty_check CHECK (length(trim(policy_key)) > 0),
  CONSTRAINT governance_emergency_access_ops_policies_policy_name_not_empty_check CHECK (length(trim(policy_name)) > 0),
  CONSTRAINT governance_emergency_access_ops_policies_pending_max_age_hours_check CHECK (pending_max_age_hours >= 1),
  CONSTRAINT governance_emergency_access_ops_policies_approved_max_age_minutes_check CHECK (approved_max_age_minutes >= 1),
  CONSTRAINT governance_emergency_access_ops_policies_near_expiry_window_minutes_check CHECK (near_expiry_window_minutes >= 1),
  CONSTRAINT governance_emergency_access_ops_policies_oncall_channel_not_empty_check CHECK (length(trim(oncall_channel)) > 0),
  CONSTRAINT governance_emergency_access_ops_policies_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object')
);

DO $$
BEGIN
  CREATE TRIGGER update_governance_emergency_access_ops_policies_updated_at
    BEFORE UPDATE ON public.governance_emergency_access_ops_policies
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO public.governance_emergency_access_ops_policies (
  policy_key,
  policy_name,
  pending_max_age_hours,
  approved_max_age_minutes,
  near_expiry_window_minutes,
  escalation_enabled,
  oncall_channel,
  metadata,
  updated_by
)
VALUES (
  'default',
  'Default emergency access operations policy',
  24,
  120,
  15,
  true,
  'public_audit_ops',
  jsonb_build_object('source', 'emergency_access_ops_policy_bootstrap'),
  public.current_profile_id()
)
ON CONFLICT (policy_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.governance_emergency_access_ops_policy_summary(
  requested_policy_key text DEFAULT 'default'
)
RETURNS TABLE (
  policy_key text,
  policy_name text,
  pending_max_age_hours integer,
  approved_max_age_minutes integer,
  near_expiry_window_minutes integer,
  escalation_enabled boolean,
  oncall_channel text,
  updated_at timestamptz
) AS $$
BEGIN
  IF NOT (
    public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
  ) THEN
    RAISE EXCEPTION 'Current profile is not authorized to read emergency access ops policy';
  END IF;

  RETURN QUERY
  SELECT
    policy.policy_key,
    policy.policy_name,
    policy.pending_max_age_hours,
    policy.approved_max_age_minutes,
    policy.near_expiry_window_minutes,
    policy.escalation_enabled,
    policy.oncall_channel,
    policy.updated_at
  FROM public.governance_emergency_access_ops_policies AS policy
  WHERE policy.policy_key = coalesce(nullif(btrim(coalesce(requested_policy_key, '')), ''), 'default')
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.set_governance_emergency_access_ops_policy(
  requested_policy_key text DEFAULT 'default',
  requested_policy_name text DEFAULT 'Default emergency access operations policy',
  requested_pending_max_age_hours integer DEFAULT 24,
  requested_approved_max_age_minutes integer DEFAULT 120,
  requested_near_expiry_window_minutes integer DEFAULT 15,
  requested_escalation_enabled boolean DEFAULT true,
  requested_oncall_channel text DEFAULT 'public_audit_ops',
  metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS text AS $$
DECLARE
  normalized_policy_key text;
  normalized_policy_name text;
  normalized_oncall_channel text;
BEGIN
  IF NOT public.has_permission('settings.manage'::public.app_permission) THEN
    RAISE EXCEPTION 'Current profile is not authorized to update emergency access ops policy';
  END IF;

  normalized_policy_key := lower(coalesce(nullif(btrim(coalesce(requested_policy_key, '')), ''), 'default'));
  normalized_policy_name := coalesce(nullif(btrim(coalesce(requested_policy_name, '')), ''), 'Default emergency access operations policy');
  normalized_oncall_channel := coalesce(nullif(btrim(coalesce(requested_oncall_channel, '')), ''), 'public_audit_ops');

  IF coalesce(requested_pending_max_age_hours, 0) < 1 THEN
    RAISE EXCEPTION 'Pending max age hours must be at least 1';
  END IF;
  IF coalesce(requested_approved_max_age_minutes, 0) < 1 THEN
    RAISE EXCEPTION 'Approved max age minutes must be at least 1';
  END IF;
  IF coalesce(requested_near_expiry_window_minutes, 0) < 1 THEN
    RAISE EXCEPTION 'Near-expiry window minutes must be at least 1';
  END IF;

  INSERT INTO public.governance_emergency_access_ops_policies (
    policy_key,
    policy_name,
    pending_max_age_hours,
    approved_max_age_minutes,
    near_expiry_window_minutes,
    escalation_enabled,
    oncall_channel,
    metadata,
    updated_by
  )
  VALUES (
    normalized_policy_key,
    normalized_policy_name,
    greatest(1, requested_pending_max_age_hours),
    greatest(1, requested_approved_max_age_minutes),
    greatest(1, requested_near_expiry_window_minutes),
    coalesce(requested_escalation_enabled, true),
    normalized_oncall_channel,
    coalesce(metadata, '{}'::jsonb),
    public.current_profile_id()
  )
  ON CONFLICT (policy_key) DO UPDATE
  SET
    policy_name = excluded.policy_name,
    pending_max_age_hours = excluded.pending_max_age_hours,
    approved_max_age_minutes = excluded.approved_max_age_minutes,
    near_expiry_window_minutes = excluded.near_expiry_window_minutes,
    escalation_enabled = excluded.escalation_enabled,
    oncall_channel = excluded.oncall_channel,
    metadata = coalesce(public.governance_emergency_access_ops_policies.metadata, '{}'::jsonb)
      || coalesce(excluded.metadata, '{}'::jsonb),
    updated_by = excluded.updated_by;

  RETURN normalized_policy_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.gpav_emergency_access_expiry_tick()
RETURNS void AS $$
DECLARE
  _rec record;
  policy_row record;
BEGIN
  IF session_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Emergency access expiry tick is restricted to database superuser sessions';
  END IF;

  SELECT *
  INTO policy_row
  FROM public.governance_emergency_access_ops_policies
  WHERE policy_key = 'default'
  LIMIT 1;

  IF policy_row IS NULL THEN
    SELECT *
    INTO policy_row
    FROM (
      SELECT
        24::integer AS pending_max_age_hours,
        120::integer AS approved_max_age_minutes,
        15::integer AS near_expiry_window_minutes,
        true::boolean AS escalation_enabled
    ) AS fallback_policy;
  END IF;

  FOR _rec IN
    SELECT *
    FROM public.expire_governance_emergency_access_requests(
      coalesce(policy_row.pending_max_age_hours, 24),
      coalesce(policy_row.approved_max_age_minutes, 120)
    )
  LOOP
    NULL;
  END LOOP;

  IF coalesce(policy_row.escalation_enabled, true) THEN
    PERFORM public.maybe_escalate_governance_emergency_access_ops_execution_page(
      coalesce(policy_row.pending_max_age_hours, 24),
      coalesce(policy_row.near_expiry_window_minutes, 15)
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Emergency access expiry tick non-fatal: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.governance_emergency_access_ops_policy_summary(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_governance_emergency_access_ops_policy(text, text, integer, integer, integer, boolean, text, jsonb) TO authenticated;
