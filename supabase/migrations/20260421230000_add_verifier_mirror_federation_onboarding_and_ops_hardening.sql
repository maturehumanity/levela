ALTER TABLE public.governance_public_audit_verifier_mirror_failover_policies
  ADD COLUMN IF NOT EXISTS require_federation_ops_readiness boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_open_critical_federation_alerts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_onboarded_federation_operators integer NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'governance_public_audit_verifier_mirror_failover_policies_max_open_critical_federation_alerts_check'
  ) THEN
    ALTER TABLE public.governance_public_audit_verifier_mirror_failover_policies
      ADD CONSTRAINT governance_public_audit_verifier_mirror_failover_policies_max_open_critical_federation_alerts_check
      CHECK (max_open_critical_federation_alerts >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'governance_public_audit_verifier_mirror_failover_policies_min_onboarded_federation_operators_check'
  ) THEN
    ALTER TABLE public.governance_public_audit_verifier_mirror_failover_policies
      ADD CONSTRAINT governance_public_audit_verifier_mirror_failover_policies_min_onboarded_federation_operators_check
      CHECK (min_onboarded_federation_operators >= 1);
  END IF;
END $$;

UPDATE public.governance_public_audit_verifier_mirror_failover_policies
SET
  require_federation_ops_readiness = coalesce(require_federation_ops_readiness, false),
  max_open_critical_federation_alerts = greatest(0, coalesce(max_open_critical_federation_alerts, 0)),
  min_onboarded_federation_operators = greatest(1, coalesce(min_onboarded_federation_operators, 1));

CREATE TABLE IF NOT EXISTS public.governance_public_audit_verifier_mirror_federation_operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_key text NOT NULL UNIQUE,
  operator_label text,
  contact_endpoint text,
  jurisdiction_country_code text NOT NULL DEFAULT '',
  trust_domain text NOT NULL DEFAULT 'public',
  onboarding_status text NOT NULL DEFAULT 'pending',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_public_audit_verifier_mirror_federation_operators_key_not_empty_check CHECK (length(trim(operator_key)) > 0),
  CONSTRAINT governance_public_audit_verifier_mirror_federation_operators_contact_not_empty_check CHECK (
    contact_endpoint IS NULL OR length(trim(contact_endpoint)) > 0
  ),
  CONSTRAINT governance_public_audit_verifier_mirror_federation_operators_country_code_check CHECK (
    jurisdiction_country_code = '' OR length(jurisdiction_country_code) = 2
  ),
  CONSTRAINT governance_public_audit_verifier_mirror_federation_operators_trust_domain_not_empty_check CHECK (length(trim(trust_domain)) > 0),
  CONSTRAINT governance_public_audit_verifier_mirror_federation_operators_onboarding_status_check CHECK (
    onboarding_status IN ('pending', 'approved', 'onboarded', 'rejected', 'suspended')
  ),
  CONSTRAINT governance_public_audit_verifier_mirror_federation_operators_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE IF NOT EXISTS public.governance_public_audit_verifier_mirror_federation_onboarding_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.governance_public_audit_verifier_mirror_federation_operators(id) ON DELETE CASCADE,
  operator_key text NOT NULL,
  request_status text NOT NULL DEFAULT 'pending',
  requested_mirror_key text NOT NULL,
  requested_mirror_label text,
  requested_endpoint_url text NOT NULL,
  requested_mirror_type text NOT NULL DEFAULT 'https_gateway',
  requested_region_code text NOT NULL DEFAULT 'GLOBAL',
  requested_jurisdiction_country_code text NOT NULL DEFAULT '',
  requested_trust_domain text NOT NULL DEFAULT 'public',
  review_notes text,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  onboarded_mirror_id uuid REFERENCES public.governance_public_audit_verifier_mirrors(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_public_audit_verifier_mirror_federation_onboarding_requests_operator_key_not_empty_check CHECK (length(trim(operator_key)) > 0),
  CONSTRAINT governance_public_audit_verifier_mirror_federation_onboarding_requests_status_check CHECK (
    request_status IN ('pending', 'approved', 'rejected', 'onboarded')
  ),
  CONSTRAINT governance_public_audit_verifier_mirror_federation_onboarding_requests_mirror_key_not_empty_check CHECK (length(trim(requested_mirror_key)) > 0),
  CONSTRAINT governance_public_audit_verifier_mirror_federation_onboarding_requests_endpoint_not_empty_check CHECK (length(trim(requested_endpoint_url)) > 0),
  CONSTRAINT governance_public_audit_verifier_mirror_federation_onboarding_requests_mirror_type_not_empty_check CHECK (length(trim(requested_mirror_type)) > 0),
  CONSTRAINT governance_public_audit_verifier_mirror_federation_onboarding_requests_region_not_empty_check CHECK (length(trim(requested_region_code)) > 0),
  CONSTRAINT governance_public_audit_verifier_mirror_federation_onboarding_requests_country_code_check CHECK (
    requested_jurisdiction_country_code = '' OR length(requested_jurisdiction_country_code) = 2
  ),
  CONSTRAINT governance_public_audit_verifier_mirror_federation_onboarding_requests_trust_domain_not_empty_check CHECK (length(trim(requested_trust_domain)) > 0),
  CONSTRAINT governance_public_audit_verifier_mirror_federation_onboarding_requests_review_notes_not_empty_check CHECK (
    review_notes IS NULL OR length(trim(review_notes)) > 0
  ),
  CONSTRAINT governance_public_audit_verifier_mirror_federation_onboarding_requests_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE IF NOT EXISTS public.governance_public_audit_verifier_mirror_federation_worker_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_scope text NOT NULL,
  run_status text NOT NULL,
  discovered_request_count integer NOT NULL DEFAULT 0,
  approved_request_count integer NOT NULL DEFAULT 0,
  onboarded_request_count integer NOT NULL DEFAULT 0,
  open_alert_count integer NOT NULL DEFAULT 0,
  error_message text,
  run_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_public_audit_verifier_mirror_federation_worker_runs_scope_check CHECK (
    run_scope IN ('onboarding_sweep', 'operator_health_audit', 'diversity_audit', 'manual')
  ),
  CONSTRAINT governance_public_audit_verifier_mirror_federation_worker_runs_status_check CHECK (
    run_status IN ('ok', 'degraded', 'failed')
  ),
  CONSTRAINT governance_public_audit_verifier_mirror_federation_worker_runs_discovered_count_check CHECK (discovered_request_count >= 0),
  CONSTRAINT governance_public_audit_verifier_mirror_federation_worker_runs_approved_count_check CHECK (approved_request_count >= 0),
  CONSTRAINT governance_public_audit_verifier_mirror_federation_worker_runs_onboarded_count_check CHECK (onboarded_request_count >= 0),
  CONSTRAINT governance_public_audit_verifier_mirror_federation_worker_runs_open_alert_count_check CHECK (open_alert_count >= 0),
  CONSTRAINT governance_public_audit_verifier_mirror_federation_worker_runs_error_not_empty_check CHECK (
    error_message IS NULL OR length(trim(error_message)) > 0
  ),
  CONSTRAINT governance_public_audit_verifier_mirror_federation_worker_runs_payload_object_check CHECK (jsonb_typeof(run_payload) = 'object')
);

CREATE TABLE IF NOT EXISTS public.governance_public_audit_verifier_mirror_federation_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_key text NOT NULL UNIQUE,
  severity text NOT NULL,
  alert_scope text NOT NULL,
  alert_status text NOT NULL DEFAULT 'open',
  alert_message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  opened_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_public_audit_verifier_mirror_federation_alerts_key_not_empty_check CHECK (length(trim(alert_key)) > 0),
  CONSTRAINT governance_public_audit_verifier_mirror_federation_alerts_severity_check CHECK (
    severity IN ('info', 'warning', 'critical')
  ),
  CONSTRAINT governance_public_audit_verifier_mirror_federation_alerts_scope_not_empty_check CHECK (length(trim(alert_scope)) > 0),
  CONSTRAINT governance_public_audit_verifier_mirror_federation_alerts_status_check CHECK (
    alert_status IN ('open', 'acknowledged', 'resolved')
  ),
  CONSTRAINT governance_public_audit_verifier_mirror_federation_alerts_message_not_empty_check CHECK (length(trim(alert_message)) > 0),
  CONSTRAINT governance_public_audit_verifier_mirror_federation_alerts_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_verifier_mirror_federation_operators_status
  ON public.governance_public_audit_verifier_mirror_federation_operators (onboarding_status, created_at DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_verifier_mirror_federation_onboarding_requests_status
  ON public.governance_public_audit_verifier_mirror_federation_onboarding_requests (request_status, created_at DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_verifier_mirror_federation_onboarding_requests_operator_status
  ON public.governance_public_audit_verifier_mirror_federation_onboarding_requests (operator_id, request_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_verifier_mirror_federation_worker_runs_observed
  ON public.governance_public_audit_verifier_mirror_federation_worker_runs (observed_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_verifier_mirror_federation_alerts_status_severity
  ON public.governance_public_audit_verifier_mirror_federation_alerts (alert_status, severity, opened_at DESC, created_at DESC);

DO $$
BEGIN
  CREATE TRIGGER update_governance_public_audit_verifier_mirror_federation_operators_updated_at
    BEFORE UPDATE ON public.governance_public_audit_verifier_mirror_federation_operators
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_governance_public_audit_verifier_mirror_federation_onboarding_requests_updated_at
    BEFORE UPDATE ON public.governance_public_audit_verifier_mirror_federation_onboarding_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_governance_public_audit_verifier_mirror_federation_worker_runs_updated_at
    BEFORE UPDATE ON public.governance_public_audit_verifier_mirror_federation_worker_runs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_governance_public_audit_verifier_mirror_federation_alerts_updated_at
    BEFORE UPDATE ON public.governance_public_audit_verifier_mirror_federation_alerts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.register_governance_public_audit_verifier_mirror_federation_operator(
  operator_key text,
  operator_label text DEFAULT NULL,
  contact_endpoint text DEFAULT NULL,
  jurisdiction_country_code text DEFAULT '',
  trust_domain text DEFAULT 'public',
  metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  inserted_id uuid;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to manage federation operators';
  END IF;

  INSERT INTO public.governance_public_audit_verifier_mirror_federation_operators (
    operator_key,
    operator_label,
    contact_endpoint,
    jurisdiction_country_code,
    trust_domain,
    onboarding_status,
    metadata,
    created_by,
    updated_by
  )
  VALUES (
    btrim(coalesce(operator_key, '')),
    nullif(btrim(coalesce(operator_label, '')), ''),
    nullif(btrim(coalesce(contact_endpoint, '')), ''),
    upper(coalesce(nullif(btrim(coalesce(jurisdiction_country_code, '')), ''), '')),
    lower(coalesce(nullif(btrim(coalesce(trust_domain, '')), ''), 'public')),
    'pending',
    coalesce(metadata, '{}'::jsonb),
    public.current_profile_id(),
    public.current_profile_id()
  )
  ON CONFLICT (operator_key) DO UPDATE
    SET operator_label = excluded.operator_label,
        contact_endpoint = excluded.contact_endpoint,
        jurisdiction_country_code = excluded.jurisdiction_country_code,
        trust_domain = excluded.trust_domain,
        onboarding_status = CASE
          WHEN public.governance_public_audit_verifier_mirror_federation_operators.onboarding_status = 'suspended' THEN 'pending'
          ELSE public.governance_public_audit_verifier_mirror_federation_operators.onboarding_status
        END,
        metadata = coalesce(public.governance_public_audit_verifier_mirror_federation_operators.metadata, '{}'::jsonb)
          || coalesce(excluded.metadata, '{}'::jsonb),
        updated_by = public.current_profile_id()
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.submit_governance_public_audit_verifier_mirror_federation_onboarding_request(
  operator_key text,
  requested_mirror_key text,
  requested_mirror_label text DEFAULT NULL,
  requested_endpoint_url text DEFAULT NULL,
  requested_mirror_type text DEFAULT 'https_gateway',
  requested_region_code text DEFAULT 'GLOBAL',
  requested_jurisdiction_country_code text DEFAULT '',
  requested_trust_domain text DEFAULT 'public',
  metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  resolved_operator public.governance_public_audit_verifier_mirror_federation_operators%ROWTYPE;
  inserted_id uuid;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to submit federation onboarding requests';
  END IF;

  SELECT *
  INTO resolved_operator
  FROM public.governance_public_audit_verifier_mirror_federation_operators AS operator
  WHERE operator.operator_key = btrim(coalesce(operator_key, ''))
  ORDER BY operator.updated_at DESC, operator.created_at DESC, operator.id DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Federation operator not found';
  END IF;

  INSERT INTO public.governance_public_audit_verifier_mirror_federation_onboarding_requests (
    operator_id,
    operator_key,
    request_status,
    requested_mirror_key,
    requested_mirror_label,
    requested_endpoint_url,
    requested_mirror_type,
    requested_region_code,
    requested_jurisdiction_country_code,
    requested_trust_domain,
    metadata,
    requested_by
  )
  VALUES (
    resolved_operator.id,
    resolved_operator.operator_key,
    'pending',
    btrim(coalesce(requested_mirror_key, '')),
    nullif(btrim(coalesce(requested_mirror_label, '')), ''),
    btrim(coalesce(requested_endpoint_url, '')),
    lower(coalesce(nullif(btrim(coalesce(requested_mirror_type, '')), ''), 'https_gateway')),
    upper(coalesce(nullif(btrim(coalesce(requested_region_code, '')), ''), 'GLOBAL')),
    upper(coalesce(nullif(btrim(coalesce(requested_jurisdiction_country_code, '')), ''), '')),
    lower(coalesce(nullif(btrim(coalesce(requested_trust_domain, '')), ''), 'public')),
    coalesce(metadata, '{}'::jsonb),
    public.current_profile_id()
  )
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.review_governance_public_audit_verifier_mirror_federation_onboarding_request(
  target_request_id uuid,
  review_decision text,
  requested_review_notes text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  request_record public.governance_public_audit_verifier_mirror_federation_onboarding_requests%ROWTYPE;
  normalized_decision text;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to review federation onboarding requests';
  END IF;

  SELECT *
  INTO request_record
  FROM public.governance_public_audit_verifier_mirror_federation_onboarding_requests AS request
  WHERE request.id = target_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Federation onboarding request not found';
  END IF;

  normalized_decision := lower(coalesce(nullif(btrim(coalesce(review_decision, '')), ''), ''));
  IF normalized_decision NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Review decision must be approve or reject';
  END IF;

  UPDATE public.governance_public_audit_verifier_mirror_federation_onboarding_requests
  SET
    request_status = CASE
      WHEN normalized_decision = 'approve' THEN 'approved'
      ELSE 'rejected'
    END,
    review_notes = nullif(btrim(coalesce(requested_review_notes, '')), ''),
    reviewed_by = public.current_profile_id(),
    reviewed_at = now()
  WHERE id = request_record.id;

  UPDATE public.governance_public_audit_verifier_mirror_federation_operators
  SET
    onboarding_status = CASE
      WHEN normalized_decision = 'approve' THEN 'approved'
      ELSE 'rejected'
    END,
    updated_by = public.current_profile_id(),
    updated_at = now()
  WHERE id = request_record.operator_id;

  RETURN request_record.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.onboard_governance_public_audit_verifier_mirror_federation_request(
  target_request_id uuid,
  activate_mirror boolean DEFAULT true,
  requested_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  request_record public.governance_public_audit_verifier_mirror_federation_onboarding_requests%ROWTYPE;
  operator_record public.governance_public_audit_verifier_mirror_federation_operators%ROWTYPE;
  mirror_id uuid;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to onboard federation requests';
  END IF;

  SELECT *
  INTO request_record
  FROM public.governance_public_audit_verifier_mirror_federation_onboarding_requests AS request
  WHERE request.id = target_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Federation onboarding request not found';
  END IF;

  IF request_record.request_status NOT IN ('approved', 'onboarded') THEN
    RAISE EXCEPTION 'Only approved requests can be onboarded';
  END IF;

  SELECT *
  INTO operator_record
  FROM public.governance_public_audit_verifier_mirror_federation_operators AS operator
  WHERE operator.id = request_record.operator_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Federation operator not found';
  END IF;

  mirror_id := public.register_governance_public_audit_verifier_mirror(
    request_record.requested_mirror_key,
    request_record.requested_mirror_label,
    request_record.requested_endpoint_url,
    request_record.requested_mirror_type,
    request_record.requested_region_code,
    request_record.requested_jurisdiction_country_code,
    coalesce(operator_record.operator_label, request_record.operator_key),
    coalesce(request_record.metadata, '{}'::jsonb)
      || coalesce(requested_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'federation_operator_key', operator_record.operator_key,
        'federation_request_id', request_record.id,
        'federation_onboarded_at', now()
      )
  );

  IF coalesce(activate_mirror, true) = false THEN
    UPDATE public.governance_public_audit_verifier_mirrors
    SET is_active = false
    WHERE id = mirror_id;
  END IF;

  UPDATE public.governance_public_audit_verifier_mirror_federation_onboarding_requests
  SET
    request_status = 'onboarded',
    reviewed_by = coalesce(reviewed_by, public.current_profile_id()),
    reviewed_at = coalesce(reviewed_at, now()),
    onboarded_mirror_id = mirror_id,
    metadata = coalesce(request_record.metadata, '{}'::jsonb)
      || coalesce(requested_metadata, '{}'::jsonb)
      || jsonb_build_object('onboarded_at', now(), 'onboarded_mirror_id', mirror_id)
  WHERE id = request_record.id;

  UPDATE public.governance_public_audit_verifier_mirror_federation_operators
  SET
    onboarding_status = 'onboarded',
    metadata = coalesce(operator_record.metadata, '{}'::jsonb)
      || jsonb_build_object('onboarded_mirror_id', mirror_id, 'onboarded_at', now()),
    updated_by = public.current_profile_id(),
    updated_at = now()
  WHERE id = operator_record.id;

  RETURN mirror_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.record_governance_public_audit_verifier_mirror_federation_worker_run(
  run_scope text,
  run_status text,
  discovered_request_count integer DEFAULT 0,
  approved_request_count integer DEFAULT 0,
  onboarded_request_count integer DEFAULT 0,
  open_alert_count integer DEFAULT 0,
  error_message text DEFAULT NULL,
  run_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  inserted_id uuid;
  normalized_scope text;
  normalized_status text;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to record federation worker runs';
  END IF;

  normalized_scope := lower(coalesce(nullif(btrim(coalesce(run_scope, '')), ''), 'manual'));
  IF normalized_scope NOT IN ('onboarding_sweep', 'operator_health_audit', 'diversity_audit', 'manual') THEN
    RAISE EXCEPTION 'Worker run scope must be onboarding_sweep, operator_health_audit, diversity_audit, or manual';
  END IF;

  normalized_status := lower(coalesce(nullif(btrim(coalesce(run_status, '')), ''), 'ok'));
  IF normalized_status NOT IN ('ok', 'degraded', 'failed') THEN
    RAISE EXCEPTION 'Worker run status must be ok, degraded, or failed';
  END IF;

  INSERT INTO public.governance_public_audit_verifier_mirror_federation_worker_runs (
    run_scope,
    run_status,
    discovered_request_count,
    approved_request_count,
    onboarded_request_count,
    open_alert_count,
    error_message,
    run_payload,
    observed_at,
    created_by
  )
  VALUES (
    normalized_scope,
    normalized_status,
    greatest(0, coalesce(discovered_request_count, 0)),
    greatest(0, coalesce(approved_request_count, 0)),
    greatest(0, coalesce(onboarded_request_count, 0)),
    greatest(0, coalesce(open_alert_count, 0)),
    nullif(btrim(coalesce(error_message, '')), ''),
    coalesce(run_payload, '{}'::jsonb),
    now(),
    public.current_profile_id()
  )
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.open_governance_public_audit_verifier_mirror_federation_alert(
  alert_key text,
  severity text,
  alert_scope text,
  alert_message text,
  metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  inserted_id uuid;
  normalized_severity text;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to open federation alerts';
  END IF;

  normalized_severity := lower(coalesce(nullif(btrim(coalesce(severity, '')), ''), 'warning'));
  IF normalized_severity NOT IN ('info', 'warning', 'critical') THEN
    RAISE EXCEPTION 'Alert severity must be info, warning, or critical';
  END IF;

  INSERT INTO public.governance_public_audit_verifier_mirror_federation_alerts (
    alert_key,
    severity,
    alert_scope,
    alert_status,
    alert_message,
    metadata,
    opened_at,
    created_by
  )
  VALUES (
    btrim(coalesce(alert_key, '')),
    normalized_severity,
    lower(coalesce(nullif(btrim(coalesce(alert_scope, '')), ''), 'manual')),
    'open',
    btrim(coalesce(alert_message, '')),
    coalesce(metadata, '{}'::jsonb),
    now(),
    public.current_profile_id()
  )
  ON CONFLICT (alert_key) DO UPDATE
    SET severity = excluded.severity,
        alert_scope = excluded.alert_scope,
        alert_status = 'open',
        alert_message = excluded.alert_message,
        metadata = coalesce(public.governance_public_audit_verifier_mirror_federation_alerts.metadata, '{}'::jsonb)
          || coalesce(excluded.metadata, '{}'::jsonb),
        opened_at = now(),
        acknowledged_at = NULL,
        resolved_at = NULL,
        resolved_by = NULL
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.resolve_governance_public_audit_verifier_mirror_federation_alert(
  target_alert_id uuid,
  resolution_notes text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  alert_record public.governance_public_audit_verifier_mirror_federation_alerts%ROWTYPE;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to resolve federation alerts';
  END IF;

  SELECT *
  INTO alert_record
  FROM public.governance_public_audit_verifier_mirror_federation_alerts AS alert
  WHERE alert.id = target_alert_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Federation alert not found';
  END IF;

  UPDATE public.governance_public_audit_verifier_mirror_federation_alerts
  SET
    alert_status = 'resolved',
    metadata = coalesce(alert_record.metadata, '{}'::jsonb)
      || jsonb_build_object('resolution_notes', nullif(btrim(coalesce(resolution_notes, '')), ''), 'resolved_at', now()),
    resolved_at = now(),
    resolved_by = public.current_profile_id()
  WHERE id = alert_record.id;

  RETURN alert_record.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.set_governance_public_audit_verifier_mirror_federation_ops_requirement(
  requested_policy_key text DEFAULT 'default',
  requested_require_federation_ops_readiness boolean DEFAULT false,
  max_open_critical_alerts integer DEFAULT 0,
  min_onboarded_operators integer DEFAULT 1
)
RETURNS uuid AS $$
DECLARE
  resolved_id uuid;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to manage federation ops requirements';
  END IF;

  UPDATE public.governance_public_audit_verifier_mirror_failover_policies
  SET
    require_federation_ops_readiness = coalesce(requested_require_federation_ops_readiness, false),
    max_open_critical_federation_alerts = greatest(0, coalesce(max_open_critical_alerts, 0)),
    min_onboarded_federation_operators = greatest(1, coalesce(min_onboarded_operators, 1)),
    updated_by = public.current_profile_id(),
    updated_at = now()
  WHERE policy_key = lower(coalesce(nullif(btrim(coalesce(requested_policy_key, '')), ''), 'default'))
  RETURNING id INTO resolved_id;

  IF resolved_id IS NULL THEN
    INSERT INTO public.governance_public_audit_verifier_mirror_failover_policies (
      policy_key,
      policy_name,
      is_active,
      min_healthy_mirrors,
      max_mirror_latency_ms,
      max_failures_before_cooldown,
      cooldown_minutes,
      prefer_same_region,
      required_distinct_regions,
      required_distinct_operators,
      mirror_selection_strategy,
      max_mirror_candidates,
      min_independent_directory_signers,
      require_policy_ratification,
      min_policy_ratification_approvals,
      require_signer_governance_approval,
      min_signer_governance_independent_approvals,
      require_federation_ops_readiness,
      max_open_critical_federation_alerts,
      min_onboarded_federation_operators,
      metadata,
      created_by,
      updated_by
    )
    VALUES (
      lower(coalesce(nullif(btrim(coalesce(requested_policy_key, '')), ''), 'default')),
      'Default mirror failover policy',
      true,
      1,
      2500,
      2,
      10,
      false,
      1,
      1,
      'health_latency_diversity',
      8,
      1,
      false,
      1,
      false,
      1,
      coalesce(requested_require_federation_ops_readiness, false),
      greatest(0, coalesce(max_open_critical_alerts, 0)),
      greatest(1, coalesce(min_onboarded_operators, 1)),
      jsonb_build_object('source', 'set_governance_public_audit_verifier_mirror_federation_ops_requirement'),
      public.current_profile_id(),
      public.current_profile_id()
    )
    RETURNING id INTO resolved_id;
  END IF;

  RETURN resolved_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_public_audit_verifier_mirror_federation_onboarding_board(
  status_filter text DEFAULT NULL,
  max_entries integer DEFAULT 60
)
RETURNS TABLE (
  request_id uuid,
  operator_id uuid,
  operator_key text,
  operator_label text,
  operator_onboarding_status text,
  request_status text,
  requested_mirror_key text,
  requested_mirror_label text,
  requested_endpoint_url text,
  requested_region_code text,
  requested_trust_domain text,
  onboarded_mirror_id uuid,
  reviewed_at timestamptz,
  created_at timestamptz
) AS $$
SELECT
  request.id AS request_id,
  request.operator_id,
  operator.operator_key,
  operator.operator_label,
  operator.onboarding_status AS operator_onboarding_status,
  request.request_status,
  request.requested_mirror_key,
  request.requested_mirror_label,
  request.requested_endpoint_url,
  request.requested_region_code,
  request.requested_trust_domain,
  request.onboarded_mirror_id,
  request.reviewed_at,
  request.created_at
FROM public.governance_public_audit_verifier_mirror_federation_onboarding_requests AS request
JOIN public.governance_public_audit_verifier_mirror_federation_operators AS operator
  ON operator.id = request.operator_id
WHERE status_filter IS NULL
   OR request.request_status = lower(btrim(status_filter))
ORDER BY
  CASE
    WHEN request.request_status = 'pending' THEN 0
    WHEN request.request_status = 'approved' THEN 1
    WHEN request.request_status = 'onboarded' THEN 2
    ELSE 3
  END,
  request.created_at DESC,
  request.id DESC
LIMIT greatest(1, coalesce(max_entries, 60));
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_public_audit_verifier_mirror_federation_alert_board(
  status_filter text DEFAULT NULL,
  max_entries integer DEFAULT 60
)
RETURNS TABLE (
  alert_id uuid,
  alert_key text,
  severity text,
  alert_scope text,
  alert_status text,
  alert_message text,
  opened_at timestamptz,
  resolved_at timestamptz
) AS $$
SELECT
  alert.id AS alert_id,
  alert.alert_key,
  alert.severity,
  alert.alert_scope,
  alert.alert_status,
  alert.alert_message,
  alert.opened_at,
  alert.resolved_at
FROM public.governance_public_audit_verifier_mirror_federation_alerts AS alert
WHERE status_filter IS NULL
   OR alert.alert_status = lower(btrim(status_filter))
ORDER BY
  CASE
    WHEN alert.alert_status = 'open' THEN 0
    WHEN alert.alert_status = 'acknowledged' THEN 1
    ELSE 2
  END,
  CASE
    WHEN alert.severity = 'critical' THEN 0
    WHEN alert.severity = 'warning' THEN 1
    ELSE 2
  END,
  alert.opened_at DESC,
  alert.created_at DESC
LIMIT greatest(1, coalesce(max_entries, 60));
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_public_audit_verifier_mirror_federation_operations_summary(
  requested_policy_key text DEFAULT 'default',
  requested_lookback_hours integer DEFAULT 24,
  requested_alert_sla_hours integer DEFAULT 12
)
RETURNS TABLE (
  policy_key text,
  require_federation_ops_readiness boolean,
  max_open_critical_federation_alerts integer,
  min_onboarded_federation_operators integer,
  registered_operator_count integer,
  approved_operator_count integer,
  onboarded_operator_count integer,
  pending_request_count integer,
  approved_request_count integer,
  onboarded_request_count integer,
  open_warning_alert_count integer,
  open_critical_alert_count integer,
  alert_sla_hours integer,
  alert_sla_breached_count integer,
  last_worker_run_at timestamptz,
  last_worker_run_status text,
  federation_ops_ready boolean
) AS $$
WITH policy AS (
  SELECT
    coalesce(summary.policy_key, 'default') AS policy_key,
    coalesce(summary.require_federation_ops_readiness, false) AS require_federation_ops_readiness,
    greatest(0, coalesce(summary.max_open_critical_federation_alerts, 0)) AS max_open_critical_federation_alerts,
    greatest(1, coalesce(summary.min_onboarded_federation_operators, 1)) AS min_onboarded_federation_operators
  FROM public.governance_public_audit_verifier_mirror_failover_policy_summary(requested_policy_key) AS summary
),
fallback_policy AS (
  SELECT
    lower(coalesce(nullif(btrim(coalesce(requested_policy_key, '')), ''), 'default')) AS policy_key,
    false AS require_federation_ops_readiness,
    0 AS max_open_critical_federation_alerts,
    1 AS min_onboarded_federation_operators
  WHERE NOT EXISTS (SELECT 1 FROM policy)
),
effective_policy AS (
  SELECT * FROM policy
  UNION ALL
  SELECT * FROM fallback_policy
),
operator_counts AS (
  SELECT
    coalesce(count(*)::integer, 0) AS registered_operator_count,
    coalesce(count(*) FILTER (WHERE operator.onboarding_status = 'approved')::integer, 0) AS approved_operator_count,
    coalesce(count(*) FILTER (WHERE operator.onboarding_status = 'onboarded')::integer, 0) AS onboarded_operator_count
  FROM public.governance_public_audit_verifier_mirror_federation_operators AS operator
),
request_counts AS (
  SELECT
    coalesce(count(*) FILTER (WHERE request.request_status = 'pending')::integer, 0) AS pending_request_count,
    coalesce(count(*) FILTER (WHERE request.request_status = 'approved')::integer, 0) AS approved_request_count,
    coalesce(count(*) FILTER (WHERE request.request_status = 'onboarded')::integer, 0) AS onboarded_request_count
  FROM public.governance_public_audit_verifier_mirror_federation_onboarding_requests AS request
),
alert_counts AS (
  SELECT
    coalesce(count(*) FILTER (WHERE alert.alert_status = 'open' AND alert.severity = 'warning')::integer, 0) AS open_warning_alert_count,
    coalesce(count(*) FILTER (WHERE alert.alert_status = 'open' AND alert.severity = 'critical')::integer, 0) AS open_critical_alert_count,
    coalesce(count(*) FILTER (
      WHERE alert.alert_status = 'open'
        AND alert.opened_at < (now() - make_interval(hours => greatest(1, coalesce(requested_alert_sla_hours, 12))))
    )::integer, 0) AS alert_sla_breached_count
  FROM public.governance_public_audit_verifier_mirror_federation_alerts AS alert
),
last_worker_run AS (
  SELECT run.observed_at AS last_worker_run_at, run.run_status AS last_worker_run_status
  FROM public.governance_public_audit_verifier_mirror_federation_worker_runs AS run
  WHERE run.observed_at >= (now() - make_interval(hours => greatest(1, coalesce(requested_lookback_hours, 24))))
  ORDER BY run.observed_at DESC, run.created_at DESC
  LIMIT 1
)
SELECT
  effective_policy.policy_key,
  effective_policy.require_federation_ops_readiness,
  effective_policy.max_open_critical_federation_alerts,
  effective_policy.min_onboarded_federation_operators,
  operator_counts.registered_operator_count,
  operator_counts.approved_operator_count,
  operator_counts.onboarded_operator_count,
  request_counts.pending_request_count,
  request_counts.approved_request_count,
  request_counts.onboarded_request_count,
  alert_counts.open_warning_alert_count,
  alert_counts.open_critical_alert_count,
  greatest(1, coalesce(requested_alert_sla_hours, 12))::integer AS alert_sla_hours,
  alert_counts.alert_sla_breached_count,
  last_worker_run.last_worker_run_at,
  coalesce(last_worker_run.last_worker_run_status, 'unknown') AS last_worker_run_status,
  (
    effective_policy.require_federation_ops_readiness = false
    OR (
      operator_counts.onboarded_operator_count >= effective_policy.min_onboarded_federation_operators
      AND alert_counts.open_critical_alert_count <= effective_policy.max_open_critical_federation_alerts
      AND alert_counts.alert_sla_breached_count = 0
    )
  ) AS federation_ops_ready
FROM effective_policy
CROSS JOIN operator_counts
CROSS JOIN request_counts
CROSS JOIN alert_counts
LEFT JOIN last_worker_run ON true;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS public.governance_public_audit_verifier_mirror_failover_policy_summary(text);
CREATE FUNCTION public.governance_public_audit_verifier_mirror_failover_policy_summary(
  requested_policy_key text DEFAULT 'default'
)
RETURNS TABLE (
  policy_id uuid,
  policy_key text,
  policy_name text,
  is_active boolean,
  min_healthy_mirrors integer,
  max_mirror_latency_ms integer,
  max_failures_before_cooldown integer,
  cooldown_minutes integer,
  prefer_same_region boolean,
  required_distinct_regions integer,
  required_distinct_operators integer,
  mirror_selection_strategy text,
  max_mirror_candidates integer,
  min_independent_directory_signers integer,
  require_policy_ratification boolean,
  min_policy_ratification_approvals integer,
  require_signer_governance_approval boolean,
  min_signer_governance_independent_approvals integer,
  require_federation_ops_readiness boolean,
  max_open_critical_federation_alerts integer,
  min_onboarded_federation_operators integer,
  updated_at timestamptz
) AS $$
SELECT
  policy.id AS policy_id,
  policy.policy_key,
  policy.policy_name,
  policy.is_active,
  policy.min_healthy_mirrors,
  policy.max_mirror_latency_ms,
  policy.max_failures_before_cooldown,
  policy.cooldown_minutes,
  policy.prefer_same_region,
  policy.required_distinct_regions,
  policy.required_distinct_operators,
  policy.mirror_selection_strategy,
  policy.max_mirror_candidates,
  policy.min_independent_directory_signers,
  policy.require_policy_ratification,
  policy.min_policy_ratification_approvals,
  policy.require_signer_governance_approval,
  policy.min_signer_governance_independent_approvals,
  policy.require_federation_ops_readiness,
  policy.max_open_critical_federation_alerts,
  policy.min_onboarded_federation_operators,
  policy.updated_at
FROM public.governance_public_audit_verifier_mirror_failover_policies AS policy
WHERE policy.policy_key = lower(coalesce(nullif(btrim(coalesce(requested_policy_key, '')), ''), 'default'))
ORDER BY policy.updated_at DESC, policy.created_at DESC, policy.id DESC
LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS public.governance_public_audit_client_verifier_bundle(uuid, integer);
CREATE FUNCTION public.governance_public_audit_client_verifier_bundle(
  target_batch_id uuid DEFAULT NULL,
  max_mirrors integer DEFAULT 8
)
RETURNS TABLE (
  bundle_version text,
  bundle_hash text,
  bundle_payload jsonb,
  healthy_mirror_count integer,
  quorum_met boolean
) AS $$
WITH resolved_batch AS (
  SELECT coalesce(
    target_batch_id,
    (
      SELECT batch.id
      FROM public.governance_public_audit_batches AS batch
      ORDER BY batch.batch_index DESC
      LIMIT 1
    )
  ) AS batch_id
),
failover_policy AS (
  SELECT *
  FROM public.governance_public_audit_verifier_mirror_failover_policy_summary('default')
),
fallback_failover_policy AS (
  SELECT
    NULL::uuid AS policy_id,
    'default'::text AS policy_key,
    'Default mirror failover policy'::text AS policy_name,
    true AS is_active,
    1::integer AS min_healthy_mirrors,
    2500::integer AS max_mirror_latency_ms,
    2::integer AS max_failures_before_cooldown,
    10::integer AS cooldown_minutes,
    false AS prefer_same_region,
    1::integer AS required_distinct_regions,
    1::integer AS required_distinct_operators,
    'health_latency_diversity'::text AS mirror_selection_strategy,
    8::integer AS max_mirror_candidates,
    1::integer AS min_independent_directory_signers,
    false AS require_policy_ratification,
    1::integer AS min_policy_ratification_approvals,
    false AS require_signer_governance_approval,
    1::integer AS min_signer_governance_independent_approvals,
    false AS require_federation_ops_readiness,
    0::integer AS max_open_critical_federation_alerts,
    1::integer AS min_onboarded_federation_operators,
    now()::timestamptz AS updated_at
  WHERE NOT EXISTS (SELECT 1 FROM failover_policy)
),
effective_failover_policy AS (
  SELECT * FROM failover_policy
  UNION ALL
  SELECT * FROM fallback_failover_policy
),
batch_snapshot AS (
  SELECT
    batch.id,
    batch.batch_index,
    batch.batch_hash,
    batch.previous_batch_hash,
    batch.created_at,
    batch.anchored_at,
    batch.anchor_network,
    batch.anchor_reference,
    batch.anchor_proof
  FROM public.governance_public_audit_batches AS batch
  JOIN resolved_batch ON resolved_batch.batch_id = batch.id
),
verifier_summary AS (
  SELECT *
  FROM public.governance_public_audit_batch_verifier_summary((SELECT batch_id FROM resolved_batch))
),
mirror_health AS (
  SELECT *
  FROM public.governance_public_audit_verifier_mirror_health_summary((SELECT batch_id FROM resolved_batch), 90)
  WHERE is_active = true
),
ranked_mirrors AS (
  SELECT
    mirror.*,
    row_number() OVER (
      ORDER BY
        CASE
          WHEN mirror.health_status = 'healthy' THEN 0
          WHEN mirror.health_status = 'degraded' THEN 1
          WHEN mirror.health_status = 'unknown' THEN 2
          ELSE 3
        END,
        mirror.is_stale,
        CASE
          WHEN mirror.last_check_latency_ms IS NULL THEN 2147483647
          ELSE mirror.last_check_latency_ms
        END,
        mirror.region_code,
        mirror.operator_label,
        mirror.mirror_key
    ) AS failover_rank
  FROM mirror_health AS mirror
),
selected_mirrors AS (
  SELECT *
  FROM ranked_mirrors
  ORDER BY failover_rank
  LIMIT greatest(
    1,
    least(
      coalesce(max_mirrors, 8),
      coalesce((SELECT max_mirror_candidates FROM effective_failover_policy LIMIT 1), 8)
    )
  )
),
network_proofs AS (
  SELECT
    proof.id,
    proof.network,
    proof.proof_reference,
    proof.block_height,
    proof.recorded_at
  FROM public.governance_public_audit_network_proofs AS proof
  JOIN resolved_batch ON resolved_batch.batch_id = proof.batch_id
  ORDER BY proof.recorded_at DESC, proof.created_at DESC
),
latest_directory AS (
  SELECT
    directory.id,
    directory.batch_id,
    directory.directory_hash,
    directory.signer_key,
    signer.signer_label,
    signer.trust_tier,
    directory.signature,
    directory.signature_algorithm,
    directory.published_at
  FROM public.governance_public_audit_verifier_mirror_directories AS directory
  LEFT JOIN public.governance_public_audit_verifier_mirror_directory_signers AS signer
    ON signer.id = directory.signer_id
  WHERE resolved_batch.batch_id IS NULL
     OR directory.batch_id = resolved_batch.batch_id
  ORDER BY directory.published_at DESC, directory.created_at DESC
  LIMIT 1
),
directory_trust_summary AS (
  SELECT *
  FROM public.governance_public_audit_verifier_mirror_directory_trust_summary((SELECT batch_id FROM resolved_batch))
),
policy_ratification_summary AS (
  SELECT *
  FROM public.governance_public_audit_verifier_mirror_policy_ratification_summary('default')
),
discovery_summary AS (
  SELECT *
  FROM public.governance_public_audit_verifier_mirror_discovery_summary((SELECT batch_id FROM resolved_batch), 24)
),
federation_diversity_summary AS (
  SELECT *
  FROM public.governance_public_audit_verifier_mirror_federation_diversity_summary((SELECT batch_id FROM resolved_batch), max_mirrors)
),
federation_operations_summary AS (
  SELECT *
  FROM public.governance_public_audit_verifier_mirror_federation_operations_summary('default', 24, 12)
),
payload_cte AS (
  SELECT jsonb_build_object(
    'bundle_version', 'public_audit_client_verifier_bundle_v1',
    'generated_at', now(),
    'batch', coalesce((SELECT to_jsonb(row_data) FROM batch_snapshot AS row_data), '{}'::jsonb),
    'verifier_summary', coalesce((SELECT to_jsonb(row_data) FROM verifier_summary AS row_data), '{}'::jsonb),
    'mirrors', coalesce((
      SELECT jsonb_agg(
        to_jsonb(row_data)
        ORDER BY row_data.failover_rank ASC
      )
      FROM selected_mirrors AS row_data
    ), '[]'::jsonb),
    'failover_policy', coalesce((SELECT to_jsonb(row_data) FROM effective_failover_policy AS row_data LIMIT 1), '{}'::jsonb),
    'failover_order', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'mirror_id', row_data.mirror_id,
          'mirror_key', row_data.mirror_key,
          'mirror_label', row_data.mirror_label,
          'region_code', row_data.region_code,
          'operator_label', row_data.operator_label,
          'health_status', row_data.health_status,
          'last_check_latency_ms', row_data.last_check_latency_ms,
          'failover_rank', row_data.failover_rank
        )
        ORDER BY row_data.failover_rank ASC
      )
      FROM selected_mirrors AS row_data
    ), '[]'::jsonb),
    'federation_diversity', coalesce((
      SELECT to_jsonb(row_data)
      FROM federation_diversity_summary AS row_data
      LIMIT 1
    ), '{}'::jsonb),
    'federation_operations', coalesce((
      SELECT to_jsonb(row_data)
      FROM federation_operations_summary AS row_data
      LIMIT 1
    ), '{}'::jsonb),
    'network_proofs', coalesce((
      SELECT jsonb_agg(to_jsonb(row_data) ORDER BY row_data.recorded_at DESC, row_data.id DESC)
      FROM network_proofs AS row_data
    ), '[]'::jsonb),
    'signed_directory', coalesce((
      SELECT to_jsonb(row_data)
      FROM latest_directory AS row_data
      LIMIT 1
    ), '{}'::jsonb),
    'signed_directory_trust', coalesce((
      SELECT to_jsonb(row_data)
      FROM directory_trust_summary AS row_data
      LIMIT 1
    ), '{}'::jsonb),
    'policy_ratification', coalesce((
      SELECT to_jsonb(row_data)
      FROM policy_ratification_summary AS row_data
      LIMIT 1
    ), '{}'::jsonb),
    'discovery_summary', coalesce((
      SELECT to_jsonb(row_data)
      FROM discovery_summary AS row_data
      LIMIT 1
    ), '{}'::jsonb)
  ) AS bundle_payload
),
healthy_mirror_count_cte AS (
  SELECT coalesce(count(*) FILTER (WHERE mirror.health_status = 'healthy'), 0)::integer AS healthy_mirror_count
  FROM selected_mirrors AS mirror
)
SELECT
  'public_audit_client_verifier_bundle_v1'::text AS bundle_version,
  encode(
    digest(
      (payload_cte.bundle_payload::text)::bytea,
      'sha256'
    ),
    'hex'
  ) AS bundle_hash,
  payload_cte.bundle_payload,
  coalesce(healthy_mirror_count_cte.healthy_mirror_count, 0) AS healthy_mirror_count,
  (
    coalesce((payload_cte.bundle_payload #>> '{verifier_summary,meets_replication_threshold}')::boolean, false)
    AND coalesce(healthy_mirror_count_cte.healthy_mirror_count, 0)
      >= greatest(1, coalesce((payload_cte.bundle_payload #>> '{failover_policy,min_healthy_mirrors}')::integer, 1))
    AND coalesce((payload_cte.bundle_payload #>> '{federation_diversity,meets_region_diversity}')::boolean, false)
    AND coalesce((payload_cte.bundle_payload #>> '{federation_diversity,meets_operator_diversity}')::boolean, false)
    AND coalesce((payload_cte.bundle_payload #>> '{signed_directory_trust,trust_quorum_met}')::boolean, false)
    AND (
      NOT coalesce((payload_cte.bundle_payload #>> '{failover_policy,require_policy_ratification}')::boolean, false)
      OR coalesce((payload_cte.bundle_payload #>> '{policy_ratification,ratification_met}')::boolean, false)
    )
    AND (
      NOT coalesce((payload_cte.bundle_payload #>> '{failover_policy,require_federation_ops_readiness}')::boolean, false)
      OR coalesce((payload_cte.bundle_payload #>> '{federation_operations,federation_ops_ready}')::boolean, false)
    )
  ) AS quorum_met
FROM payload_cte
CROSS JOIN healthy_mirror_count_cte;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

GRANT SELECT, INSERT, UPDATE ON public.governance_public_audit_verifier_mirror_federation_operators TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.governance_public_audit_verifier_mirror_federation_onboarding_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.governance_public_audit_verifier_mirror_federation_worker_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.governance_public_audit_verifier_mirror_federation_alerts TO authenticated;

GRANT EXECUTE ON FUNCTION public.register_governance_public_audit_verifier_mirror_federation_operator(text, text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_governance_public_audit_verifier_mirror_federation_onboarding_request(text, text, text, text, text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_governance_public_audit_verifier_mirror_federation_onboarding_request(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.onboard_governance_public_audit_verifier_mirror_federation_request(uuid, boolean, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_governance_public_audit_verifier_mirror_federation_worker_run(text, text, integer, integer, integer, integer, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_governance_public_audit_verifier_mirror_federation_alert(text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_governance_public_audit_verifier_mirror_federation_alert(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_governance_public_audit_verifier_mirror_federation_ops_requirement(text, boolean, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_verifier_mirror_federation_onboarding_board(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_verifier_mirror_federation_alert_board(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_verifier_mirror_federation_operations_summary(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_verifier_mirror_failover_policy_summary(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_public_audit_client_verifier_bundle(uuid, integer) TO authenticated;

ALTER TABLE public.governance_public_audit_verifier_mirror_federation_operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_public_audit_verifier_mirror_federation_onboarding_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_public_audit_verifier_mirror_federation_worker_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_public_audit_verifier_mirror_federation_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Verifier mirror federation operators are readable by authenticated users" ON public.governance_public_audit_verifier_mirror_federation_operators;
CREATE POLICY "Verifier mirror federation operators are readable by authenticated users" ON public.governance_public_audit_verifier_mirror_federation_operators
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Verifier mirror federation operators are manageable by verifier stewards" ON public.governance_public_audit_verifier_mirror_federation_operators;
CREATE POLICY "Verifier mirror federation operators are manageable by verifier stewards" ON public.governance_public_audit_verifier_mirror_federation_operators
  FOR ALL USING (public.current_profile_can_manage_public_audit_verifiers())
  WITH CHECK (public.current_profile_can_manage_public_audit_verifiers());

DROP POLICY IF EXISTS "Verifier mirror federation onboarding requests are readable by authenticated users" ON public.governance_public_audit_verifier_mirror_federation_onboarding_requests;
CREATE POLICY "Verifier mirror federation onboarding requests are readable by authenticated users" ON public.governance_public_audit_verifier_mirror_federation_onboarding_requests
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Verifier mirror federation onboarding requests are manageable by verifier stewards" ON public.governance_public_audit_verifier_mirror_federation_onboarding_requests;
CREATE POLICY "Verifier mirror federation onboarding requests are manageable by verifier stewards" ON public.governance_public_audit_verifier_mirror_federation_onboarding_requests
  FOR ALL USING (public.current_profile_can_manage_public_audit_verifiers())
  WITH CHECK (public.current_profile_can_manage_public_audit_verifiers());

DROP POLICY IF EXISTS "Verifier mirror federation worker runs are readable by authenticated users" ON public.governance_public_audit_verifier_mirror_federation_worker_runs;
CREATE POLICY "Verifier mirror federation worker runs are readable by authenticated users" ON public.governance_public_audit_verifier_mirror_federation_worker_runs
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Verifier mirror federation worker runs are manageable by verifier stewards" ON public.governance_public_audit_verifier_mirror_federation_worker_runs;
CREATE POLICY "Verifier mirror federation worker runs are manageable by verifier stewards" ON public.governance_public_audit_verifier_mirror_federation_worker_runs
  FOR ALL USING (public.current_profile_can_manage_public_audit_verifiers())
  WITH CHECK (public.current_profile_can_manage_public_audit_verifiers());

DROP POLICY IF EXISTS "Verifier mirror federation alerts are readable by authenticated users" ON public.governance_public_audit_verifier_mirror_federation_alerts;
CREATE POLICY "Verifier mirror federation alerts are readable by authenticated users" ON public.governance_public_audit_verifier_mirror_federation_alerts
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Verifier mirror federation alerts are manageable by verifier stewards" ON public.governance_public_audit_verifier_mirror_federation_alerts;
CREATE POLICY "Verifier mirror federation alerts are manageable by verifier stewards" ON public.governance_public_audit_verifier_mirror_federation_alerts
  FOR ALL USING (public.current_profile_can_manage_public_audit_verifiers())
  WITH CHECK (public.current_profile_can_manage_public_audit_verifiers());
