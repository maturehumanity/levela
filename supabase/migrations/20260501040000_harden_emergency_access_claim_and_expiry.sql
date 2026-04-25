-- Decentralization hardening: emergency access requests must be approved with
-- bounded TTL and one-time claim semantics before any impersonation token can be issued.

ALTER TABLE public.governance_emergency_access_requests
  ADD COLUMN IF NOT EXISTS approved_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS consumed_at timestamptz,
  ADD COLUMN IF NOT EXISTS consumed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'governance_emergency_access_requests_reviewed_fields_check'
  ) THEN
    ALTER TABLE public.governance_emergency_access_requests
      ADD CONSTRAINT governance_emergency_access_requests_reviewed_fields_check CHECK (
        (request_status = 'pending' AND reviewed_at IS NULL AND reviewed_by IS NULL)
        OR (request_status <> 'pending' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'governance_emergency_access_requests_consumed_requires_approved_check'
  ) THEN
    ALTER TABLE public.governance_emergency_access_requests
      ADD CONSTRAINT governance_emergency_access_requests_consumed_requires_approved_check CHECK (
        consumed_at IS NULL OR request_status = 'approved'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'governance_emergency_access_requests_expiry_requires_approved_check'
  ) THEN
    ALTER TABLE public.governance_emergency_access_requests
      ADD CONSTRAINT governance_emergency_access_requests_expiry_requires_approved_check CHECK (
        approved_expires_at IS NULL OR request_status = 'approved'
      );
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.governance_emergency_access_request_board(text, integer);

CREATE OR REPLACE FUNCTION public.governance_emergency_access_request_board(
  requested_status text DEFAULT NULL,
  max_requests integer DEFAULT 80
)
RETURNS TABLE (
  request_id uuid,
  target_profile_id uuid,
  target_display_name text,
  target_username text,
  request_reason text,
  request_status text,
  requested_by uuid,
  requested_by_name text,
  reviewed_by uuid,
  reviewed_by_name text,
  review_notes text,
  reviewed_at timestamptz,
  approved_expires_at timestamptz,
  consumed_at timestamptz,
  consumed_by uuid,
  consumed_by_name text,
  created_at timestamptz,
  updated_at timestamptz
) AS $$
DECLARE
  normalized_status text := nullif(lower(btrim(coalesce(requested_status, ''))), '');
BEGIN
  IF NOT (
    public.has_permission('settings.manage'::public.app_permission)
    OR public.has_permission('role.assign'::public.app_permission)
  ) THEN
    RAISE EXCEPTION 'Current profile is not authorized to read emergency access requests';
  END IF;

  IF normalized_status IS NOT NULL
     AND normalized_status NOT IN ('pending', 'approved', 'rejected', 'expired')
  THEN
    RAISE EXCEPTION 'Requested emergency access status must be pending, approved, rejected, or expired';
  END IF;

  RETURN QUERY
  SELECT
    request.id AS request_id,
    request.target_profile_id,
    coalesce(target.full_name, target.username, target.id::text) AS target_display_name,
    target.username AS target_username,
    request.request_reason,
    request.request_status,
    request.requested_by,
    coalesce(requester.full_name, requester.username, requester.id::text) AS requested_by_name,
    request.reviewed_by,
    CASE
      WHEN reviewer.id IS NULL THEN NULL
      ELSE coalesce(reviewer.full_name, reviewer.username, reviewer.id::text)
    END AS reviewed_by_name,
    request.review_notes,
    request.reviewed_at,
    request.approved_expires_at,
    request.consumed_at,
    request.consumed_by,
    CASE
      WHEN consumer.id IS NULL THEN NULL
      ELSE coalesce(consumer.full_name, consumer.username, consumer.id::text)
    END AS consumed_by_name,
    request.created_at,
    request.updated_at
  FROM public.governance_emergency_access_requests AS request
  JOIN public.profiles AS target
    ON target.id = request.target_profile_id
  JOIN public.profiles AS requester
    ON requester.id = request.requested_by
  LEFT JOIN public.profiles AS reviewer
    ON reviewer.id = request.reviewed_by
  LEFT JOIN public.profiles AS consumer
    ON consumer.id = request.consumed_by
  WHERE normalized_status IS NULL OR request.request_status = normalized_status
  ORDER BY request.created_at DESC, request.id DESC
  LIMIT greatest(1, coalesce(max_requests, 80));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.review_governance_emergency_access_request(
  target_request_id uuid,
  next_status text,
  review_notes text DEFAULT NULL,
  approved_ttl_minutes integer DEFAULT 30
)
RETURNS uuid AS $$
DECLARE
  normalized_status text := lower(btrim(coalesce(next_status, '')));
  normalized_notes text := nullif(btrim(coalesce(review_notes, '')), '');
  request_record public.governance_emergency_access_requests%ROWTYPE;
  safe_ttl_minutes integer := greatest(1, coalesce(approved_ttl_minutes, 30));
BEGIN
  IF NOT public.has_permission('settings.manage'::public.app_permission) THEN
    RAISE EXCEPTION 'Current profile is not authorized to review emergency access requests';
  END IF;

  IF target_request_id IS NULL THEN
    RAISE EXCEPTION 'Target request id is required';
  END IF;

  IF normalized_status NOT IN ('approved', 'rejected', 'expired') THEN
    RAISE EXCEPTION 'Emergency access review status must be approved, rejected, or expired';
  END IF;

  IF normalized_status = 'rejected' AND normalized_notes IS NULL THEN
    RAISE EXCEPTION 'Review notes are required when rejecting emergency access requests';
  END IF;

  SELECT *
  INTO request_record
  FROM public.governance_emergency_access_requests AS request
  WHERE request.id = target_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Emergency access request does not exist';
  END IF;

  IF request_record.request_status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending emergency access requests can be reviewed';
  END IF;

  UPDATE public.governance_emergency_access_requests AS request
  SET
    request_status = normalized_status,
    reviewed_by = public.current_profile_id(),
    reviewed_at = now(),
    updated_by = public.current_profile_id(),
    review_notes = normalized_notes,
    approved_expires_at = CASE
      WHEN normalized_status = 'approved'
        THEN now() + make_interval(mins => safe_ttl_minutes)
      ELSE NULL
    END,
    consumed_at = NULL,
    consumed_by = NULL
  WHERE request.id = request_record.id;

  RETURN request_record.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.claim_governance_emergency_access_request_for_impersonation(
  target_request_id uuid
)
RETURNS uuid AS $$
DECLARE
  request_record public.governance_emergency_access_requests%ROWTYPE;
  claimant_profile_id uuid := public.current_profile_id();
BEGIN
  IF claimant_profile_id IS NULL THEN
    RAISE EXCEPTION 'Current profile is required';
  END IF;

  IF NOT public.has_permission('settings.manage'::public.app_permission) THEN
    RAISE EXCEPTION 'Current profile is not authorized to claim emergency access impersonation requests';
  END IF;

  IF target_request_id IS NULL THEN
    RAISE EXCEPTION 'Target request id is required';
  END IF;

  SELECT *
  INTO request_record
  FROM public.governance_emergency_access_requests AS request
  WHERE request.id = target_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Emergency access request does not exist';
  END IF;

  IF request_record.request_status <> 'approved' THEN
    RAISE EXCEPTION 'Emergency access request is not approved';
  END IF;

  IF request_record.consumed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Emergency access request has already been consumed';
  END IF;

  IF request_record.approved_expires_at IS NOT NULL AND request_record.approved_expires_at <= now() THEN
    UPDATE public.governance_emergency_access_requests
    SET request_status = 'expired',
        review_notes = coalesce(review_notes, '')
          || CASE WHEN review_notes IS NULL OR length(trim(review_notes)) = 0 THEN '' ELSE E'\n' END
          || 'Auto-expired before claim',
        updated_at = now()
    WHERE id = request_record.id;
    RAISE EXCEPTION 'Emergency access request has expired';
  END IF;

  UPDATE public.governance_emergency_access_requests AS request
  SET
    consumed_at = now(),
    consumed_by = claimant_profile_id,
    updated_by = claimant_profile_id
  WHERE request.id = request_record.id;

  RETURN request_record.target_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.review_governance_emergency_access_request(uuid, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_governance_emergency_access_request_for_impersonation(uuid) TO authenticated;
