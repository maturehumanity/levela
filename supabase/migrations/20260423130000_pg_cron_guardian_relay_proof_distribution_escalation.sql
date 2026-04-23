-- Phase C.13: periodic superuser tick re-evaluates guardian relay client proof distribution
-- escalation for recent approved proposals (trust-minimized policy still enforced inside
-- maybe_escalate_guardian_relay_proof_distribution_exec_page).

CREATE OR REPLACE FUNCTION public.open_governance_public_audit_external_execution_page(
  target_batch_id uuid,
  page_key text,
  severity text,
  page_message text,
  page_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  policy_record public.governance_public_audit_external_execution_policies%ROWTYPE;
  inserted_id uuid;
  normalized_page_key text;
  normalized_severity text;
  normalized_message text;
  caller_authorized boolean;
BEGIN
  normalized_page_key := lower(coalesce(nullif(btrim(coalesce(page_key, '')), ''), 'external_execution_ops'));
  normalized_severity := lower(coalesce(nullif(btrim(coalesce(severity, '')), ''), 'warning'));
  normalized_message := coalesce(nullif(btrim(coalesce(page_message, '')), ''), 'Public audit external execution policy threshold breached');

  caller_authorized := public.current_profile_can_manage_public_audit_verifiers()
    OR (
      normalized_page_key = 'activation_demographic_feed_worker_escalation'
      AND public.current_profile_can_manage_activation_demographic_feed_workers()
    )
    OR (
      session_user IN ('postgres', 'supabase_admin')
      AND normalized_page_key = 'activation_demographic_feed_worker_escalation'
    )
    OR (
      session_user IN ('postgres', 'supabase_admin')
      AND normalized_page_key = 'verifier_federation_distribution_escalation'
    )
    OR (
      normalized_page_key = 'guardian_relay_critical_escalation'
      AND public.current_profile_can_manage_guardian_relays()
    )
    OR (
      normalized_page_key = 'guardian_relay_proof_distribution_escalation'
      AND public.current_profile_can_manage_guardian_relays()
    )
    OR (
      session_user IN ('postgres', 'supabase_admin')
      AND normalized_page_key = 'guardian_relay_proof_distribution_escalation'
    );

  IF NOT caller_authorized THEN
    RAISE EXCEPTION 'Current profile is not authorized to open public audit external execution pages';
  END IF;

  IF target_batch_id IS NULL THEN
    RAISE EXCEPTION 'Target batch id is required';
  END IF;

  IF normalized_severity NOT IN ('info', 'warning', 'critical') THEN
    RAISE EXCEPTION 'Page severity must be info, warning, or critical';
  END IF;

  SELECT policy.*
  INTO policy_record
  FROM public.governance_public_audit_external_execution_policies AS policy
  WHERE policy.policy_key = 'default'
  LIMIT 1;

  INSERT INTO public.governance_public_audit_external_execution_pages (
    batch_id,
    page_key,
    severity,
    page_status,
    page_message,
    oncall_channel,
    page_payload,
    opened_at,
    created_by
  )
  VALUES (
    target_batch_id,
    normalized_page_key,
    normalized_severity,
    'open',
    normalized_message,
    coalesce(policy_record.oncall_channel, 'public_audit_ops'),
    coalesce(page_payload, '{}'::jsonb),
    now(),
    public.current_profile_id()
  )
  ON CONFLICT (batch_id, page_key) DO UPDATE
    SET severity = excluded.severity,
        page_status = 'open',
        page_message = excluded.page_message,
        oncall_channel = excluded.oncall_channel,
        page_payload = coalesce(public.governance_public_audit_external_execution_pages.page_payload, '{}'::jsonb)
          || coalesce(excluded.page_payload, '{}'::jsonb),
        opened_at = now(),
        acknowledged_at = NULL,
        resolved_at = NULL,
        resolved_by = NULL
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.resolve_governance_public_audit_external_execution_page(
  target_page_id uuid,
  resolution_notes text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  page_record public.governance_public_audit_external_execution_pages%ROWTYPE;
  caller_authorized boolean;
BEGIN
  SELECT *
  INTO page_record
  FROM public.governance_public_audit_external_execution_pages AS page
  WHERE page.id = target_page_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Public audit external execution page not found';
  END IF;

  caller_authorized := public.current_profile_can_manage_public_audit_verifiers()
    OR (
      lower(btrim(page_record.page_key)) = 'activation_demographic_feed_worker_escalation'
      AND public.current_profile_can_manage_activation_demographic_feed_workers()
    )
    OR (
      session_user IN ('postgres', 'supabase_admin')
      AND lower(btrim(page_record.page_key)) = 'activation_demographic_feed_worker_escalation'
    )
    OR (
      session_user IN ('postgres', 'supabase_admin')
      AND lower(btrim(page_record.page_key)) = 'verifier_federation_distribution_escalation'
    )
    OR (
      lower(btrim(page_record.page_key)) = 'guardian_relay_critical_escalation'
      AND public.current_profile_can_manage_guardian_relays()
    )
    OR (
      lower(btrim(page_record.page_key)) = 'guardian_relay_proof_distribution_escalation'
      AND public.current_profile_can_manage_guardian_relays()
    )
    OR (
      session_user IN ('postgres', 'supabase_admin')
      AND lower(btrim(page_record.page_key)) = 'guardian_relay_proof_distribution_escalation'
    );

  IF NOT caller_authorized THEN
    RAISE EXCEPTION 'Current profile is not authorized to resolve public audit external execution pages';
  END IF;

  UPDATE public.governance_public_audit_external_execution_pages
  SET page_status = 'resolved',
      page_payload = coalesce(page_record.page_payload, '{}'::jsonb)
        || jsonb_build_object(
          'resolution_notes', nullif(btrim(coalesce(resolution_notes, '')), ''),
          'resolved_at', now()
        ),
      resolved_at = now(),
      resolved_by = public.current_profile_id()
  WHERE id = page_record.id;

  RETURN page_record.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.maybe_escalate_guardian_relay_proof_distribution_exec_page(
  target_proposal_id uuid,
  target_batch_id uuid DEFAULT NULL,
  escalation_context jsonb DEFAULT '{}'::jsonb
)
RETURNS void AS $$
DECLARE
  resolved_batch_id uuid;
  require_tm boolean;
  dist_ready boolean;
  required_sigs integer;
  distinct_sigs integer;
  package_id uuid;
BEGIN
  IF NOT (
    session_user IN ('postgres', 'supabase_admin')
    OR public.current_profile_can_manage_guardian_relays()
    OR public.current_profile_can_manage_public_audit_verifiers()
  ) THEN
    RAISE EXCEPTION 'Current caller is not authorized to escalate guardian relay proof distribution to external execution paging';
  END IF;

  IF target_proposal_id IS NULL THEN
    RETURN;
  END IF;

  SELECT coalesce(relay_policy.require_trust_minimized_quorum, false)
  INTO require_tm
  FROM public.governance_guardian_relay_policies AS relay_policy
  WHERE relay_policy.policy_key = 'guardian_relay_default'
  ORDER BY relay_policy.updated_at DESC, relay_policy.created_at DESC, relay_policy.id DESC
  LIMIT 1;

  IF NOT coalesce(require_tm, false) THEN
    RETURN;
  END IF;

  SELECT
    coalesce(summary.distribution_ready, false),
    summary.required_distribution_signatures,
    summary.distinct_signer_count,
    summary.package_id
  INTO dist_ready, required_sigs, distinct_sigs, package_id
  FROM public.governance_proposal_guardian_relay_client_verification_distribution_summary(target_proposal_id) AS summary
  LIMIT 1;

  IF coalesce(dist_ready, false) THEN
    RETURN;
  END IF;

  SELECT coalesce(
    target_batch_id,
    (
      SELECT batch.id
      FROM public.governance_public_audit_batches AS batch
      ORDER BY batch.batch_index DESC
      LIMIT 1
    )
  )
  INTO resolved_batch_id;

  IF resolved_batch_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM public.open_governance_public_audit_external_execution_page(
    resolved_batch_id,
    'guardian_relay_proof_distribution_escalation',
    'critical',
    format(
      'Guardian relay client proof distribution pending for proposal %s (%s/%s signatures on latest package).',
      target_proposal_id,
      coalesce(distinct_sigs, 0),
      greatest(1, coalesce(required_sigs, 1))
    ),
    jsonb_build_object(
      'source', 'maybe_escalate_guardian_relay_proof_distribution_exec_page',
      'proposal_id', target_proposal_id,
      'package_id', package_id,
      'required_distribution_signatures', greatest(1, coalesce(required_sigs, 1)),
      'distinct_signer_count', coalesce(distinct_sigs, 0),
      'distribution_ready', coalesce(dist_ready, false)
    ) || coalesce(escalation_context, '{}'::jsonb)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.gpav_gr_proof_dist_esc_tick()
RETURNS void AS $$
DECLARE
  proposal_rec record;
BEGIN
  IF session_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Guardian relay proof distribution escalation tick is restricted to database superuser sessions';
  END IF;

  FOR proposal_rec IN
    SELECT proposal.id
    FROM public.governance_proposals AS proposal
    WHERE proposal.status = 'approved'::public.governance_proposal_status
    ORDER BY proposal.updated_at DESC, proposal.created_at DESC
    LIMIT 40
  LOOP
    BEGIN
      PERFORM public.maybe_escalate_guardian_relay_proof_distribution_exec_page(
        proposal_rec.id,
        NULL,
        jsonb_build_object('source', 'gpav_gr_proof_dist_esc_tick')
      );
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'gpav_gr_proof_dist_esc_tick skipped proposal %: %', proposal_rec.id, SQLERRM;
    END;
  END LOOP;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'gpav_gr_proof_dist_esc_tick non-fatal: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.gpav_gr_proof_dist_esc_tick() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gpav_gr_proof_dist_esc_tick() FROM authenticated;
REVOKE ALL ON FUNCTION public.gpav_gr_proof_dist_esc_tick() FROM service_role;

GRANT EXECUTE ON FUNCTION public.gpav_gr_proof_dist_esc_tick() TO postgres;
GRANT EXECUTE ON FUNCTION public.gpav_gr_proof_dist_esc_tick() TO supabase_admin;

DO $$
BEGIN
  IF to_regnamespace('cron') IS NULL THEN
    RAISE NOTICE
      'pg_cron schema missing; skipping guardian relay proof distribution escalation cron registration.';
    RETURN;
  END IF;

  BEGIN
    EXECUTE $cron$
      SELECT cron.unschedule(job.jobid)
      FROM cron.job
      WHERE job.jobname = 'guardian_relay_proof_distribution_escalation_tick'
    $cron$;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Could not unschedule guardian relay proof distribution escalation cron job: %', SQLERRM;
  END;

  BEGIN
    EXECUTE $cron$
      SELECT cron.schedule(
        'guardian_relay_proof_distribution_escalation_tick',
        '25 * * * *',
        $job$SELECT public.gpav_gr_proof_dist_esc_tick();$job$
      )
    $cron$;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Could not schedule guardian relay proof distribution escalation cron job: %', SQLERRM;
  END;
END $$;
