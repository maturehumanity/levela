-- Production scheduling slice for signed demographic feed workers: policy defaults,
-- per-adapter sweep intervals, and an append-only style outbox queue external automation
-- or the steward UI can drain without double-scheduling the same adapter.

CREATE TABLE IF NOT EXISTS public.activation_demographic_feed_worker_schedule_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key text NOT NULL,
  default_interval_minutes integer NOT NULL DEFAULT 360,
  claim_ttl_minutes integer NOT NULL DEFAULT 15,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT act_demo_feed_sched_pol_key_nonempty CHECK (length(trim(policy_key)) > 0),
  CONSTRAINT act_demo_feed_sched_ivl_chk CHECK (
    default_interval_minutes >= 5 AND default_interval_minutes <= 10080
  ),
  CONSTRAINT act_demo_feed_sched_claim_ttl_chk CHECK (
    claim_ttl_minutes >= 1 AND claim_ttl_minutes <= 240
  ),
  CONSTRAINT act_demo_feed_sched_pol_key_uniq UNIQUE (policy_key)
);

INSERT INTO public.activation_demographic_feed_worker_schedule_policies (policy_key, default_interval_minutes, claim_ttl_minutes)
VALUES ('default', 360, 15)
ON CONFLICT (policy_key) DO NOTHING;

ALTER TABLE public.activation_demographic_feed_adapters
  ADD COLUMN IF NOT EXISTS worker_sweep_interval_minutes integer;

DO $$
BEGIN
  ALTER TABLE public.activation_demographic_feed_adapters
    ADD CONSTRAINT act_demo_feed_adapters_sweep_ivl_chk CHECK (
      worker_sweep_interval_minutes IS NULL
      OR (worker_sweep_interval_minutes >= 5 AND worker_sweep_interval_minutes <= 10080)
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.activation_demographic_feed_worker_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adapter_id uuid NOT NULL REFERENCES public.activation_demographic_feed_adapters(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  claim_expires_at timestamptz,
  completed_at timestamptz,
  worker_identity text,
  attempt_count integer NOT NULL DEFAULT 0,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT act_demo_feed_outbox_status_chk CHECK (
    status IN ('pending', 'claimed', 'completed', 'failed', 'cancelled')
  ),
  CONSTRAINT act_demo_feed_outbox_worker_id_chk CHECK (
    worker_identity IS NULL OR length(trim(worker_identity)) > 0
  ),
  CONSTRAINT act_demo_feed_outbox_err_chk CHECK (
    error_message IS NULL OR length(trim(error_message)) > 0
  ),
  CONSTRAINT act_demo_feed_outbox_metadata_obj_chk CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_act_demo_feed_outbox_one_pending_adapter
  ON public.activation_demographic_feed_worker_outbox (adapter_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_act_demo_feed_outbox_status_requested
  ON public.activation_demographic_feed_worker_outbox (status, requested_at ASC, created_at ASC);

DO $$
BEGIN
  CREATE TRIGGER update_activation_demographic_feed_worker_outbox_updated_at
    BEFORE UPDATE ON public.activation_demographic_feed_worker_outbox
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.release_stale_activation_demographic_feed_worker_claims()
RETURNS integer AS $$
DECLARE
  released integer := 0;
BEGIN
  UPDATE public.activation_demographic_feed_worker_outbox AS ob
  SET
    status = 'pending',
    claimed_at = NULL,
    claim_expires_at = NULL,
    worker_identity = NULL,
    metadata = coalesce(ob.metadata, '{}'::jsonb) || jsonb_build_object('released_stale_claim_at', now())
  WHERE ob.status = 'claimed'
    AND ob.claim_expires_at IS NOT NULL
    AND ob.claim_expires_at < now();

  GET DIAGNOSTICS released = ROW_COUNT;
  RETURN released;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.schedule_activation_demographic_feed_worker_jobs(
  force_reschedule boolean DEFAULT false
)
RETURNS integer AS $$
DECLARE
  policy_record public.activation_demographic_feed_worker_schedule_policies%ROWTYPE;
  inserted_count integer := 0;
  adapter_record record;
  effective_interval integer;
  last_sweep_at timestamptz;
  has_pending boolean;
BEGIN
  IF NOT public.current_profile_can_manage_activation_demographic_feed_workers() THEN
    RAISE EXCEPTION 'Current caller is not authorized to schedule activation demographic feed worker jobs';
  END IF;

  PERFORM public.release_stale_activation_demographic_feed_worker_claims();

  SELECT sched.*
  INTO policy_record
  FROM public.activation_demographic_feed_worker_schedule_policies AS sched
  WHERE sched.policy_key = 'default'
  LIMIT 1;

  IF policy_record.policy_key IS NULL THEN
    RAISE EXCEPTION 'Activation demographic feed worker schedule policy is missing';
  END IF;

  IF force_reschedule THEN
    UPDATE public.activation_demographic_feed_worker_outbox AS ob
    SET
      status = 'cancelled',
      completed_at = coalesce(ob.completed_at, now()),
      error_message = coalesce(ob.error_message, 'Cancelled by force_reschedule'),
      metadata = coalesce(ob.metadata, '{}'::jsonb) || jsonb_build_object('cancelled_at', now())
    WHERE ob.status IN ('pending', 'claimed');
  END IF;

  FOR adapter_record IN
    SELECT adapter.id, adapter.worker_sweep_interval_minutes, adapter.endpoint_url
    FROM public.activation_demographic_feed_adapters AS adapter
    WHERE adapter.is_active = true
      AND length(trim(coalesce(adapter.endpoint_url, ''))) > 0
    ORDER BY adapter.updated_at DESC, adapter.created_at DESC
  LOOP
    BEGIN
    effective_interval := coalesce(
      adapter_record.worker_sweep_interval_minutes,
      policy_record.default_interval_minutes
    );

    SELECT max(run.observed_at)
    INTO last_sweep_at
    FROM public.activation_demographic_feed_worker_runs AS run
    WHERE run.adapter_id = adapter_record.id
      AND coalesce(run.metadata ->> 'source', '') = 'activation_feed_worker_sweep';

    IF last_sweep_at IS NOT NULL
       AND last_sweep_at > (now() - make_interval(mins => greatest(5, effective_interval))) THEN
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.activation_demographic_feed_worker_outbox AS ob
      WHERE ob.adapter_id = adapter_record.id
        AND ob.status IN ('pending', 'claimed')
    )
    INTO has_pending;

    IF has_pending THEN
      CONTINUE;
    END IF;

      INSERT INTO public.activation_demographic_feed_worker_outbox (
        adapter_id,
        status,
        metadata,
        created_by
      )
      VALUES (
        adapter_record.id,
        'pending',
        jsonb_build_object(
          'source', 'schedule_activation_demographic_feed_worker_jobs',
          'effective_interval_minutes', effective_interval
        ),
        public.current_profile_id()
      );

      inserted_count := inserted_count + 1;
    EXCEPTION
      WHEN unique_violation THEN
        NULL;
    END;
  END LOOP;

  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.claim_activation_demographic_feed_worker_jobs(
  worker_identity text,
  job_limit integer DEFAULT 8
)
RETURNS TABLE (
  outbox_job_id uuid,
  adapter_id uuid
) AS $$
DECLARE
  policy_record public.activation_demographic_feed_worker_schedule_policies%ROWTYPE;
  normalized_identity text;
  normalized_limit integer;
BEGIN
  IF NOT public.current_profile_can_manage_activation_demographic_feed_workers() THEN
    RAISE EXCEPTION 'Current caller is not authorized to claim activation demographic feed worker jobs';
  END IF;

  normalized_identity := nullif(btrim(coalesce(worker_identity, '')), '');
  IF normalized_identity IS NULL THEN
    RAISE EXCEPTION 'worker_identity is required';
  END IF;

  normalized_limit := greatest(1, least(coalesce(job_limit, 8), 40));

  PERFORM public.release_stale_activation_demographic_feed_worker_claims();

  SELECT sched.*
  INTO policy_record
  FROM public.activation_demographic_feed_worker_schedule_policies AS sched
  WHERE sched.policy_key = 'default'
  LIMIT 1;

  IF policy_record.policy_key IS NULL THEN
    RAISE EXCEPTION 'Activation demographic feed worker schedule policy is missing';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT ob.id
    FROM public.activation_demographic_feed_worker_outbox AS ob
    WHERE ob.status = 'pending'
    ORDER BY ob.requested_at ASC, ob.created_at ASC, ob.id ASC
    LIMIT normalized_limit
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.activation_demographic_feed_worker_outbox AS ob
    SET
      status = 'claimed',
      claimed_at = now(),
      claim_expires_at = now() + make_interval(mins => greatest(1, coalesce(policy_record.claim_ttl_minutes, 15))),
      worker_identity = normalized_identity,
      attempt_count = greatest(0, coalesce(ob.attempt_count, 0)) + 1,
      metadata = coalesce(ob.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'last_claimed_at', now(),
          'last_claimed_by', normalized_identity
        )
    FROM candidates
    WHERE ob.id = candidates.id
    RETURNING ob.id, ob.adapter_id
  )
  SELECT claimed.id AS outbox_job_id, claimed.adapter_id FROM claimed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.complete_activation_demographic_feed_worker_outbox(
  target_outbox_id uuid,
  completed_ok boolean,
  resolution_message text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  normalized_message text;
BEGIN
  IF NOT public.current_profile_can_manage_activation_demographic_feed_workers() THEN
    RAISE EXCEPTION 'Current caller is not authorized to complete activation demographic feed worker outbox jobs';
  END IF;

  IF target_outbox_id IS NULL THEN
    RAISE EXCEPTION 'Outbox id is required';
  END IF;

  normalized_message := nullif(btrim(coalesce(resolution_message, '')), '');

  UPDATE public.activation_demographic_feed_worker_outbox AS ob
  SET
    status = CASE
      WHEN completed_ok THEN 'completed'
      ELSE 'failed'
    END,
    completed_at = now(),
    error_message = CASE
      WHEN completed_ok THEN ob.error_message
      ELSE coalesce(normalized_message, 'Feed worker sweep failed')
    END,
    metadata = coalesce(ob.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'completed_ok', completed_ok,
        'completed_at', now()
      )
      || CASE
        WHEN normalized_message IS NULL THEN '{}'::jsonb
        ELSE jsonb_build_object('resolution_message', normalized_message)
      END
  WHERE ob.id = target_outbox_id
    AND ob.status = 'claimed';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Outbox job not found or not in claimed state';
  END IF;

  RETURN target_outbox_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT SELECT, INSERT, UPDATE ON public.activation_demographic_feed_worker_schedule_policies TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.activation_demographic_feed_worker_outbox TO authenticated;

GRANT EXECUTE ON FUNCTION public.release_stale_activation_demographic_feed_worker_claims() TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_activation_demographic_feed_worker_jobs(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_activation_demographic_feed_worker_jobs(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_activation_demographic_feed_worker_outbox(uuid, boolean, text) TO authenticated;

ALTER TABLE public.activation_demographic_feed_worker_schedule_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activation_demographic_feed_worker_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Activation demographic feed schedule policies readable" ON public.activation_demographic_feed_worker_schedule_policies;
CREATE POLICY "Activation demographic feed schedule policies readable"
  ON public.activation_demographic_feed_worker_schedule_policies
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Activation demographic feed schedule policies manageable" ON public.activation_demographic_feed_worker_schedule_policies;
CREATE POLICY "Activation demographic feed schedule policies manageable"
  ON public.activation_demographic_feed_worker_schedule_policies
  FOR ALL USING (public.current_profile_can_manage_activation_demographic_feed_workers())
  WITH CHECK (public.current_profile_can_manage_activation_demographic_feed_workers());

DROP POLICY IF EXISTS "Activation demographic feed worker outbox readable" ON public.activation_demographic_feed_worker_outbox;
CREATE POLICY "Activation demographic feed worker outbox readable"
  ON public.activation_demographic_feed_worker_outbox
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Activation demographic feed worker outbox manageable" ON public.activation_demographic_feed_worker_outbox;
CREATE POLICY "Activation demographic feed worker outbox manageable"
  ON public.activation_demographic_feed_worker_outbox
  FOR ALL USING (public.current_profile_can_manage_activation_demographic_feed_workers())
  WITH CHECK (public.current_profile_can_manage_activation_demographic_feed_workers());
