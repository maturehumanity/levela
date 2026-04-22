-- Verifier federation / Section 14: surface blocked guardian relay client proof distribution
-- to the public audit external execution paging channel.

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
      normalized_page_key = 'guardian_relay_critical_escalation'
      AND public.current_profile_can_manage_guardian_relays()
    )
    OR (
      normalized_page_key = 'guardian_relay_proof_distribution_escalation'
      AND public.current_profile_can_manage_guardian_relays()
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
      lower(btrim(page_record.page_key)) = 'guardian_relay_critical_escalation'
      AND public.current_profile_can_manage_guardian_relays()
    )
    OR (
      lower(btrim(page_record.page_key)) = 'guardian_relay_proof_distribution_escalation'
      AND public.current_profile_can_manage_guardian_relays()
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
    public.current_profile_can_manage_guardian_relays()
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

GRANT EXECUTE ON FUNCTION public.maybe_escalate_guardian_relay_proof_distribution_exec_page(uuid, uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.capture_governance_proposal_guardian_relay_client_verification_package(
  target_proposal_id uuid,
  package_notes text DEFAULT NULL,
  package_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  package_record record;
  inserted_id uuid;
BEGIN
  IF NOT public.current_profile_can_manage_guardian_relays() THEN
    RAISE EXCEPTION 'Current profile is not authorized to capture guardian relay verification packages';
  END IF;

  SELECT *
  INTO package_record
  FROM public.governance_proposal_guardian_relay_client_verification_package(target_proposal_id)
  LIMIT 1;

  IF package_record.package_hash IS NULL OR package_record.source_manifest_id IS NULL THEN
    RAISE EXCEPTION 'Could not generate guardian relay client verification package';
  END IF;

  INSERT INTO public.governance_proposal_client_verification_packages (
    proposal_id,
    package_scope,
    package_version,
    package_hash,
    package_payload,
    source_manifest_id,
    metadata,
    captured_by,
    captured_at
  )
  VALUES (
    target_proposal_id,
    'guardian_relay_quorum_client_proof_distribution',
    package_record.package_version,
    package_record.package_hash,
    coalesce(package_record.package_payload, '{}'::jsonb),
    package_record.source_manifest_id,
    coalesce(package_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'source', 'capture_governance_proposal_guardian_relay_client_verification_package',
        'notes', nullif(btrim(coalesce(package_notes, '')), ''),
        'trust_minimized_quorum_met', coalesce(package_record.trust_minimized_quorum_met, false),
        'relay_ops_ready', coalesce(package_record.relay_ops_ready, false)
      ),
    public.current_profile_id(),
    now()
  )
  ON CONFLICT (proposal_id, package_scope, package_hash) DO NOTHING
  RETURNING id INTO inserted_id;

  IF inserted_id IS NULL THEN
    SELECT package.id
    INTO inserted_id
    FROM public.governance_proposal_client_verification_packages AS package
    WHERE package.proposal_id = target_proposal_id
      AND package.package_scope = 'guardian_relay_quorum_client_proof_distribution'
      AND package.package_hash = package_record.package_hash
    ORDER BY package.captured_at DESC, package.created_at DESC, package.id DESC
    LIMIT 1;
  END IF;

  PERFORM public.maybe_escalate_guardian_relay_proof_distribution_exec_page(
    target_proposal_id,
    NULL,
    jsonb_build_object(
      'trigger', 'capture_governance_proposal_guardian_relay_client_verification_package',
      'package_id', inserted_id
    )
  );

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.sign_governance_proposal_guardian_relay_client_verification_package(
  target_package_id uuid,
  signer_key text,
  signature text,
  signature_algorithm text DEFAULT 'ed25519',
  signer_trust_domain text DEFAULT 'public',
  signer_jurisdiction_country_code text DEFAULT NULL,
  signer_identity_uri text DEFAULT NULL,
  distribution_channel text DEFAULT 'primary',
  signature_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  package_record public.governance_proposal_client_verification_packages%ROWTYPE;
  inserted_id uuid;
BEGIN
  IF NOT public.current_profile_can_manage_guardian_relays() THEN
    RAISE EXCEPTION 'Current profile is not authorized to sign guardian relay verification packages';
  END IF;

  IF target_package_id IS NULL THEN
    RAISE EXCEPTION 'Target package id is required';
  END IF;

  SELECT *
  INTO package_record
  FROM public.governance_proposal_client_verification_packages AS package
  WHERE package.id = target_package_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Guardian relay verification package not found';
  END IF;

  INSERT INTO public.governance_proposal_client_verification_package_signatures (
    package_id,
    proposal_id,
    package_scope,
    signer_key,
    signature_algorithm,
    signature,
    signer_trust_domain,
    signer_jurisdiction_country_code,
    signer_identity_uri,
    distribution_channel,
    metadata,
    signed_at,
    created_by
  )
  VALUES (
    package_record.id,
    package_record.proposal_id,
    package_record.package_scope,
    btrim(coalesce(signer_key, '')),
    lower(coalesce(nullif(btrim(coalesce(signature_algorithm, '')), ''), 'ed25519')),
    btrim(coalesce(signature, '')),
    lower(coalesce(nullif(btrim(coalesce(signer_trust_domain, '')), ''), 'public')),
    nullif(upper(btrim(coalesce(signer_jurisdiction_country_code, ''))), ''),
    nullif(btrim(coalesce(signer_identity_uri, '')), ''),
    lower(coalesce(nullif(btrim(coalesce(distribution_channel, '')), ''), 'primary')),
    coalesce(signature_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'source', 'sign_governance_proposal_guardian_relay_client_verification_package',
        'signed_package_hash', package_record.package_hash
      ),
    now(),
    public.current_profile_id()
  )
  ON CONFLICT (package_id, signer_key, signature) DO NOTHING
  RETURNING id INTO inserted_id;

  IF inserted_id IS NULL THEN
    SELECT signature_row.id
    INTO inserted_id
    FROM public.governance_proposal_client_verification_package_signatures AS signature_row
    WHERE signature_row.package_id = package_record.id
      AND signature_row.signer_key = btrim(coalesce(signer_key, ''))
      AND signature_row.signature = btrim(coalesce(signature, ''))
    ORDER BY signature_row.signed_at DESC, signature_row.created_at DESC, signature_row.id DESC
    LIMIT 1;
  END IF;

  PERFORM public.maybe_escalate_guardian_relay_proof_distribution_exec_page(
    package_record.proposal_id,
    NULL,
    jsonb_build_object(
      'trigger', 'sign_governance_proposal_guardian_relay_client_verification_package',
      'package_id', package_record.id
    )
  );

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
