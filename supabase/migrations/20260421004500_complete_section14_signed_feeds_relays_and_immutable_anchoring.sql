DO $$
BEGIN
  CREATE TYPE public.activation_demographic_feed_adapter_type AS ENUM (
    'signed_json_feed',
    'oracle_attestation',
    'manual_signed_import'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.governance_guardian_relay_attestation_status AS ENUM (
    'verified',
    'mismatch',
    'unreachable'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.governance_public_audit_verifier_job_status AS ENUM (
    'pending',
    'completed',
    'failed',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.activation_demographic_feed_adapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adapter_key text NOT NULL UNIQUE,
  adapter_name text NOT NULL,
  adapter_type public.activation_demographic_feed_adapter_type NOT NULL DEFAULT 'signed_json_feed',
  scope_type public.activation_scope_type NOT NULL DEFAULT 'world',
  country_code text NOT NULL DEFAULT '',
  endpoint_url text,
  public_signer_key text NOT NULL,
  key_algorithm text NOT NULL DEFAULT 'ECDSA_P256_SHA256_V1',
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  added_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_ingested_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activation_demographic_feed_adapters_adapter_key_not_empty CHECK (length(trim(adapter_key)) > 0),
  CONSTRAINT activation_demographic_feed_adapters_adapter_name_not_empty CHECK (length(trim(adapter_name)) > 0),
  CONSTRAINT activation_demographic_feed_adapters_public_signer_key_not_empty CHECK (length(trim(public_signer_key)) > 0),
  CONSTRAINT activation_demographic_feed_adapters_key_algorithm_not_empty CHECK (length(trim(key_algorithm)) > 0),
  CONSTRAINT activation_demographic_feed_adapters_country_code_check CHECK (
    (scope_type = 'world'::public.activation_scope_type AND country_code = '')
    OR (scope_type = 'country'::public.activation_scope_type AND country_code <> '')
  ),
  CONSTRAINT activation_demographic_feed_adapters_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE IF NOT EXISTS public.activation_demographic_feed_ingestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adapter_id uuid NOT NULL REFERENCES public.activation_demographic_feed_adapters(id) ON DELETE CASCADE,
  snapshot_id uuid REFERENCES public.activation_demographic_snapshots(id) ON DELETE SET NULL,
  scope_type public.activation_scope_type NOT NULL,
  country_code text NOT NULL DEFAULT '',
  observed_at timestamptz NOT NULL,
  target_population bigint NOT NULL,
  signed_payload text,
  payload_hash text,
  payload_signature text,
  signature_verified boolean NOT NULL DEFAULT false,
  ingestion_status text NOT NULL DEFAULT 'accepted',
  ingestion_notes text,
  ingestion_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ingested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activation_demographic_feed_ingestions_country_code_check CHECK (
    (scope_type = 'world'::public.activation_scope_type AND country_code = '')
    OR (scope_type = 'country'::public.activation_scope_type AND country_code <> '')
  ),
  CONSTRAINT activation_demographic_feed_ingestions_target_population_check CHECK (target_population > 0),
  CONSTRAINT activation_demographic_feed_ingestions_payload_hash_not_empty CHECK (payload_hash IS NULL OR length(trim(payload_hash)) > 0),
  CONSTRAINT activation_demographic_feed_ingestions_payload_signature_not_empty CHECK (payload_signature IS NULL OR length(trim(payload_signature)) > 0),
  CONSTRAINT activation_demographic_feed_ingestions_signed_payload_not_empty CHECK (signed_payload IS NULL OR length(trim(signed_payload)) > 0),
  CONSTRAINT activation_demographic_feed_ingestions_signature_verified_check CHECK (
    signature_verified = false
    OR (signed_payload IS NOT NULL AND payload_hash IS NOT NULL AND payload_signature IS NOT NULL)
  ),
  CONSTRAINT activation_demographic_feed_ingestions_metadata_object_check CHECK (jsonb_typeof(ingestion_metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_activation_demographic_feed_adapters_scope_active
  ON public.activation_demographic_feed_adapters (scope_type, country_code, is_active, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_activation_demographic_feed_ingestions_adapter_created
  ON public.activation_demographic_feed_ingestions (adapter_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activation_demographic_feed_ingestions_scope_observed
  ON public.activation_demographic_feed_ingestions (scope_type, country_code, observed_at DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS public.governance_guardian_relay_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key text NOT NULL UNIQUE,
  policy_name text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  required_relay_attestations integer NOT NULL DEFAULT 2,
  require_chain_proof_match boolean NOT NULL DEFAULT true,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_guardian_relay_policies_policy_key_not_empty CHECK (length(trim(policy_key)) > 0),
  CONSTRAINT governance_guardian_relay_policies_policy_name_not_empty CHECK (length(trim(policy_name)) > 0),
  CONSTRAINT governance_guardian_relay_policies_required_relay_attestations_check CHECK (required_relay_attestations >= 1),
  CONSTRAINT governance_guardian_relay_policies_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE IF NOT EXISTS public.governance_guardian_relay_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relay_key text NOT NULL UNIQUE,
  relay_label text,
  endpoint_url text,
  key_algorithm text NOT NULL DEFAULT 'ECDSA_P256_SHA256_V1',
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  added_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_guardian_relay_nodes_relay_key_not_empty CHECK (length(trim(relay_key)) > 0),
  CONSTRAINT governance_guardian_relay_nodes_key_algorithm_not_empty CHECK (length(trim(key_algorithm)) > 0),
  CONSTRAINT governance_guardian_relay_nodes_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE IF NOT EXISTS public.governance_proposal_guardian_relay_attestations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.governance_proposals(id) ON DELETE CASCADE,
  external_signer_id uuid NOT NULL REFERENCES public.governance_guardian_external_signers(id) ON DELETE CASCADE,
  relay_id uuid NOT NULL REFERENCES public.governance_guardian_relay_nodes(id) ON DELETE CASCADE,
  decision public.governance_guardian_decision NOT NULL,
  status public.governance_guardian_relay_attestation_status NOT NULL DEFAULT 'verified',
  payload_hash text,
  relay_reference text,
  chain_network text,
  chain_reference text,
  attestation_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_proposal_guardian_relay_attestations_payload_hash_not_empty CHECK (payload_hash IS NULL OR length(trim(payload_hash)) > 0),
  CONSTRAINT governance_proposal_guardian_relay_attestations_relay_reference_not_empty CHECK (relay_reference IS NULL OR length(trim(relay_reference)) > 0),
  CONSTRAINT governance_proposal_guardian_relay_attestations_chain_network_not_empty CHECK (chain_network IS NULL OR length(trim(chain_network)) > 0),
  CONSTRAINT governance_proposal_guardian_relay_attestations_chain_reference_not_empty CHECK (chain_reference IS NULL OR length(trim(chain_reference)) > 0),
  CONSTRAINT governance_proposal_guardian_relay_attestations_attestation_metadata_object_check CHECK (jsonb_typeof(attestation_metadata) = 'object'),
  CONSTRAINT governance_proposal_guardian_relay_attestations_unique_relay UNIQUE (proposal_id, external_signer_id, relay_id)
);

CREATE INDEX IF NOT EXISTS idx_governance_guardian_relay_nodes_active
  ON public.governance_guardian_relay_nodes (is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_proposal_guardian_relay_attestations_proposal
  ON public.governance_proposal_guardian_relay_attestations (proposal_id, verified_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_proposal_guardian_relay_attestations_external_signer
  ON public.governance_proposal_guardian_relay_attestations (external_signer_id, verified_at DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS public.governance_public_audit_anchor_adapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adapter_key text NOT NULL UNIQUE,
  adapter_name text NOT NULL,
  network text NOT NULL,
  endpoint_url text,
  attestation_scheme text NOT NULL DEFAULT 'append_only_receipt_v1',
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  added_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_public_audit_anchor_adapters_adapter_key_not_empty CHECK (length(trim(adapter_key)) > 0),
  CONSTRAINT governance_public_audit_anchor_adapters_adapter_name_not_empty CHECK (length(trim(adapter_name)) > 0),
  CONSTRAINT governance_public_audit_anchor_adapters_network_not_empty CHECK (length(trim(network)) > 0),
  CONSTRAINT governance_public_audit_anchor_adapters_attestation_scheme_not_empty CHECK (length(trim(attestation_scheme)) > 0),
  CONSTRAINT governance_public_audit_anchor_adapters_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE IF NOT EXISTS public.governance_public_audit_immutable_anchors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.governance_public_audit_batches(id) ON DELETE CASCADE,
  adapter_id uuid REFERENCES public.governance_public_audit_anchor_adapters(id) ON DELETE SET NULL,
  network text NOT NULL,
  immutable_reference text NOT NULL,
  proof_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  block_height bigint,
  anchored_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  anchored_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_public_audit_immutable_anchors_network_not_empty CHECK (length(trim(network)) > 0),
  CONSTRAINT governance_public_audit_immutable_anchors_reference_not_empty CHECK (length(trim(immutable_reference)) > 0),
  CONSTRAINT governance_public_audit_immutable_anchors_block_height_check CHECK (block_height IS NULL OR block_height >= 0),
  CONSTRAINT governance_public_audit_immutable_anchors_payload_object_check CHECK (jsonb_typeof(proof_payload) = 'object'),
  CONSTRAINT governance_public_audit_immutable_anchors_unique_reference UNIQUE (batch_id, network, immutable_reference)
);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_anchor_adapters_active
  ON public.governance_public_audit_anchor_adapters (is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_immutable_anchors_batch
  ON public.governance_public_audit_immutable_anchors (batch_id, anchored_at DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS public.governance_public_audit_verifier_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.governance_public_audit_batches(id) ON DELETE CASCADE,
  verifier_id uuid NOT NULL REFERENCES public.governance_public_audit_verifier_nodes(id) ON DELETE CASCADE,
  status public.governance_public_audit_verifier_job_status NOT NULL DEFAULT 'pending',
  result_reference text,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT governance_public_audit_verifier_jobs_result_reference_not_empty CHECK (result_reference IS NULL OR length(trim(result_reference)) > 0),
  CONSTRAINT governance_public_audit_verifier_jobs_error_message_not_empty CHECK (error_message IS NULL OR length(trim(error_message)) > 0),
  CONSTRAINT governance_public_audit_verifier_jobs_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_verifier_jobs_batch_status
  ON public.governance_public_audit_verifier_jobs (batch_id, status, scheduled_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_governance_public_audit_verifier_jobs_verifier_status
  ON public.governance_public_audit_verifier_jobs (verifier_id, status, scheduled_at DESC, created_at DESC);

DO $$
BEGIN
  CREATE TRIGGER update_activation_demographic_feed_adapters_updated_at
    BEFORE UPDATE ON public.activation_demographic_feed_adapters
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_governance_guardian_relay_policies_updated_at
    BEFORE UPDATE ON public.governance_guardian_relay_policies
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_governance_guardian_relay_nodes_updated_at
    BEFORE UPDATE ON public.governance_guardian_relay_nodes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_governance_proposal_guardian_relay_attestations_updated_at
    BEFORE UPDATE ON public.governance_proposal_guardian_relay_attestations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_governance_public_audit_anchor_adapters_updated_at
    BEFORE UPDATE ON public.governance_public_audit_anchor_adapters
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_governance_public_audit_verifier_jobs_updated_at
    BEFORE UPDATE ON public.governance_public_audit_verifier_jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.sync_activation_demographic_feed_adapter_country_code()
RETURNS TRIGGER AS $$
BEGIN
  NEW.country_code := public.normalize_activation_scope_country_code(NEW.scope_type, NEW.country_code);
  NEW.adapter_key := btrim(coalesce(NEW.adapter_key, ''));
  NEW.adapter_name := btrim(coalesce(NEW.adapter_name, ''));
  NEW.public_signer_key := btrim(coalesce(NEW.public_signer_key, ''));
  NEW.key_algorithm := upper(btrim(coalesce(NEW.key_algorithm, 'ECDSA_P256_SHA256_V1')));
  NEW.endpoint_url := nullif(btrim(coalesce(NEW.endpoint_url, '')), '');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS sync_activation_demographic_feed_adapter_country_code_trigger ON public.activation_demographic_feed_adapters;
CREATE TRIGGER sync_activation_demographic_feed_adapter_country_code_trigger
  BEFORE INSERT OR UPDATE OF scope_type, country_code, adapter_key, adapter_name, public_signer_key, key_algorithm, endpoint_url
  ON public.activation_demographic_feed_adapters
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_activation_demographic_feed_adapter_country_code();

CREATE OR REPLACE FUNCTION public.prevent_governance_public_audit_immutable_anchor_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Immutable public audit anchors are append-only';
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS prevent_governance_public_audit_immutable_anchor_update_trigger ON public.governance_public_audit_immutable_anchors;
CREATE TRIGGER prevent_governance_public_audit_immutable_anchor_update_trigger
  BEFORE UPDATE ON public.governance_public_audit_immutable_anchors
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_governance_public_audit_immutable_anchor_mutation();

DROP TRIGGER IF EXISTS prevent_governance_public_audit_immutable_anchor_delete_trigger ON public.governance_public_audit_immutable_anchors;
CREATE TRIGGER prevent_governance_public_audit_immutable_anchor_delete_trigger
  BEFORE DELETE ON public.governance_public_audit_immutable_anchors
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_governance_public_audit_immutable_anchor_mutation();

CREATE OR REPLACE FUNCTION public.current_profile_can_manage_activation_demographic_feeds()
RETURNS boolean AS $$
  SELECT coalesce(
    public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.current_profile_in_governance_domain(ARRAY['activation_review', 'technical_stewardship', 'constitutional_review']),
    false
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.current_profile_can_manage_guardian_relays()
RETURNS boolean AS $$
  SELECT coalesce(
    public.current_profile_can_manage_guardian_multisig()
    OR public.has_permission('role.assign'::public.app_permission)
    OR public.has_permission('settings.manage'::public.app_permission)
    OR public.current_profile_in_governance_domain(ARRAY['security_incident_response', 'technical_stewardship']),
    false
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.register_activation_demographic_feed_adapter(
  adapter_key text,
  adapter_name text,
  adapter_type public.activation_demographic_feed_adapter_type DEFAULT 'signed_json_feed',
  scope_type public.activation_scope_type DEFAULT 'world',
  country_code text DEFAULT '',
  endpoint_url text DEFAULT NULL,
  public_signer_key text DEFAULT NULL,
  key_algorithm text DEFAULT 'ECDSA_P256_SHA256_V1',
  metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  inserted_id uuid;
BEGIN
  IF NOT public.current_profile_can_manage_activation_demographic_feeds() THEN
    RAISE EXCEPTION 'Current profile is not authorized to manage activation demographic feed adapters';
  END IF;

  INSERT INTO public.activation_demographic_feed_adapters (
    adapter_key,
    adapter_name,
    adapter_type,
    scope_type,
    country_code,
    endpoint_url,
    public_signer_key,
    key_algorithm,
    added_by,
    metadata
  )
  VALUES (
    btrim(coalesce(adapter_key, '')),
    btrim(coalesce(adapter_name, '')),
    coalesce(adapter_type, 'signed_json_feed'::public.activation_demographic_feed_adapter_type),
    coalesce(scope_type, 'world'::public.activation_scope_type),
    public.normalize_activation_scope_country_code(coalesce(scope_type, 'world'::public.activation_scope_type), country_code),
    nullif(btrim(coalesce(endpoint_url, '')), ''),
    btrim(coalesce(public_signer_key, '')),
    upper(btrim(coalesce(key_algorithm, 'ECDSA_P256_SHA256_V1'))),
    public.current_profile_id(),
    coalesce(metadata, '{}'::jsonb)
  )
  ON CONFLICT (adapter_key) DO UPDATE
    SET adapter_name = excluded.adapter_name,
        adapter_type = excluded.adapter_type,
        scope_type = excluded.scope_type,
        country_code = excluded.country_code,
        endpoint_url = excluded.endpoint_url,
        public_signer_key = excluded.public_signer_key,
        key_algorithm = excluded.key_algorithm,
        is_active = true,
        metadata = coalesce(public.activation_demographic_feed_adapters.metadata, '{}'::jsonb) || coalesce(excluded.metadata, '{}'::jsonb)
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.ingest_signed_activation_demographic_feed_snapshot(
  target_adapter_id uuid,
  requested_target_population bigint,
  requested_source_url text DEFAULT NULL,
  requested_observed_at timestamptz DEFAULT now(),
  signed_payload text DEFAULT NULL,
  payload_hash text DEFAULT NULL,
  payload_signature text DEFAULT NULL,
  signature_verified boolean DEFAULT false,
  ingestion_notes text DEFAULT NULL,
  ingestion_metadata jsonb DEFAULT '{}'::jsonb,
  measured_by_profile_id uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  adapter_record public.activation_demographic_feed_adapters%ROWTYPE;
  actor_id uuid;
  snapshot_id uuid;
BEGIN
  IF NOT public.current_profile_can_manage_activation_demographic_feeds() THEN
    RAISE EXCEPTION 'Current profile is not authorized to ingest signed demographic feed snapshots';
  END IF;

  IF requested_target_population IS NULL OR requested_target_population <= 0 THEN
    RAISE EXCEPTION 'Requested target population must be positive';
  END IF;

  SELECT adapter.*
  INTO adapter_record
  FROM public.activation_demographic_feed_adapters AS adapter
  WHERE adapter.id = target_adapter_id
    AND adapter.is_active = true
  LIMIT 1;

  IF adapter_record.id IS NULL THEN
    RAISE EXCEPTION 'Activation demographic feed adapter does not exist or is inactive';
  END IF;

  actor_id := coalesce(measured_by_profile_id, public.current_profile_id());

  INSERT INTO public.activation_demographic_snapshots (
    scope_type,
    country_code,
    jurisdiction_label,
    target_population,
    source_label,
    source_url,
    observed_at,
    ingestion_notes,
    metadata,
    created_by
  )
  VALUES (
    adapter_record.scope_type,
    adapter_record.country_code,
    CASE
      WHEN adapter_record.scope_type = 'world'::public.activation_scope_type THEN 'World'
      ELSE adapter_record.country_code
    END,
    requested_target_population,
    adapter_record.adapter_name,
    coalesce(nullif(btrim(coalesce(requested_source_url, '')), ''), adapter_record.endpoint_url),
    coalesce(requested_observed_at, now()),
    nullif(btrim(coalesce(ingestion_notes, '')), ''),
    coalesce(adapter_record.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'feed_adapter_id', adapter_record.id,
        'feed_adapter_key', adapter_record.adapter_key,
        'feed_adapter_type', adapter_record.adapter_type,
        'ingestion_mode', 'signed_external_feed',
        'signed_payload_hash', nullif(btrim(coalesce(payload_hash, '')), ''),
        'signature_verified', coalesce(signature_verified, false),
        'ingestion_metadata', coalesce(ingestion_metadata, '{}'::jsonb)
      ),
    actor_id
  )
  RETURNING id INTO snapshot_id;

  INSERT INTO public.activation_demographic_feed_ingestions (
    adapter_id,
    snapshot_id,
    scope_type,
    country_code,
    observed_at,
    target_population,
    signed_payload,
    payload_hash,
    payload_signature,
    signature_verified,
    ingestion_status,
    ingestion_notes,
    ingestion_metadata,
    ingested_by
  )
  VALUES (
    adapter_record.id,
    snapshot_id,
    adapter_record.scope_type,
    adapter_record.country_code,
    coalesce(requested_observed_at, now()),
    requested_target_population,
    nullif(btrim(coalesce(signed_payload, '')), ''),
    nullif(btrim(coalesce(payload_hash, '')), ''),
    nullif(btrim(coalesce(payload_signature, '')), ''),
    coalesce(signature_verified, false),
    CASE WHEN coalesce(signature_verified, false) THEN 'accepted_signed' ELSE 'accepted_attested' END,
    nullif(btrim(coalesce(ingestion_notes, '')), ''),
    coalesce(ingestion_metadata, '{}'::jsonb),
    actor_id
  );

  UPDATE public.activation_demographic_feed_adapters
  SET last_ingested_at = now()
  WHERE id = adapter_record.id;

  PERFORM public.capture_activation_demographic_snapshot(
    adapter_record.scope_type,
    adapter_record.country_code,
    'signed_external_feed_ingestion',
    coalesce(nullif(btrim(coalesce(ingestion_notes, '')), ''), 'Signed external demographic feed ingestion'),
    actor_id
  );

  RETURN snapshot_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.register_governance_guardian_relay_node(
  relay_key text,
  relay_label text DEFAULT NULL,
  endpoint_url text DEFAULT NULL,
  key_algorithm text DEFAULT 'ECDSA_P256_SHA256_V1',
  metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  inserted_id uuid;
BEGIN
  IF NOT public.current_profile_can_manage_guardian_relays() THEN
    RAISE EXCEPTION 'Current profile is not authorized to manage guardian relay nodes';
  END IF;

  INSERT INTO public.governance_guardian_relay_nodes (
    relay_key,
    relay_label,
    endpoint_url,
    key_algorithm,
    metadata,
    added_by
  )
  VALUES (
    btrim(coalesce(relay_key, '')),
    nullif(btrim(coalesce(relay_label, '')), ''),
    nullif(btrim(coalesce(endpoint_url, '')), ''),
    upper(btrim(coalesce(key_algorithm, 'ECDSA_P256_SHA256_V1'))),
    coalesce(metadata, '{}'::jsonb),
    public.current_profile_id()
  )
  ON CONFLICT (relay_key) DO UPDATE
    SET relay_label = excluded.relay_label,
        endpoint_url = excluded.endpoint_url,
        key_algorithm = excluded.key_algorithm,
        metadata = coalesce(public.governance_guardian_relay_nodes.metadata, '{}'::jsonb) || coalesce(excluded.metadata, '{}'::jsonb),
        is_active = true
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.record_governance_guardian_relay_attestation(
  target_proposal_id uuid,
  target_external_signer_id uuid,
  target_relay_id uuid,
  attestation_decision public.governance_guardian_decision,
  attestation_status public.governance_guardian_relay_attestation_status DEFAULT 'verified',
  attestation_payload_hash text DEFAULT NULL,
  attestation_reference text DEFAULT NULL,
  attestation_chain_network text DEFAULT NULL,
  attestation_chain_reference text DEFAULT NULL,
  attestation_metadata jsonb DEFAULT '{}'::jsonb,
  verified_at timestamptz DEFAULT now()
)
RETURNS uuid AS $$
DECLARE
  proposal_status public.governance_proposal_status;
  inserted_id uuid;
BEGIN
  IF NOT public.current_profile_can_manage_guardian_relays() THEN
    RAISE EXCEPTION 'Current profile is not authorized to record guardian relay attestations';
  END IF;

  IF target_proposal_id IS NULL OR target_external_signer_id IS NULL OR target_relay_id IS NULL THEN
    RAISE EXCEPTION 'Proposal, external signer, and relay ids are required';
  END IF;

  SELECT proposal.status
  INTO proposal_status
  FROM public.governance_proposals AS proposal
  WHERE proposal.id = target_proposal_id
  LIMIT 1;

  IF proposal_status IS NULL THEN
    RAISE EXCEPTION 'Guardian relay attestation proposal does not exist';
  END IF;

  IF proposal_status <> 'open'::public.governance_proposal_status THEN
    RAISE EXCEPTION 'Guardian relay attestations can only be recorded while proposal is open';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.governance_guardian_external_signers AS signer
    WHERE signer.id = target_external_signer_id
      AND signer.is_active = true
  ) THEN
    RAISE EXCEPTION 'Guardian relay attestation external signer is not active';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.governance_guardian_relay_nodes AS relay
    WHERE relay.id = target_relay_id
      AND relay.is_active = true
  ) THEN
    RAISE EXCEPTION 'Guardian relay node is not active';
  END IF;

  INSERT INTO public.governance_proposal_guardian_relay_attestations (
    proposal_id,
    external_signer_id,
    relay_id,
    decision,
    status,
    payload_hash,
    relay_reference,
    chain_network,
    chain_reference,
    attestation_metadata,
    verified_by,
    verified_at
  )
  VALUES (
    target_proposal_id,
    target_external_signer_id,
    target_relay_id,
    attestation_decision,
    coalesce(attestation_status, 'verified'::public.governance_guardian_relay_attestation_status),
    nullif(btrim(coalesce(attestation_payload_hash, '')), ''),
    nullif(btrim(coalesce(attestation_reference, '')), ''),
    nullif(btrim(coalesce(attestation_chain_network, '')), ''),
    nullif(btrim(coalesce(attestation_chain_reference, '')), ''),
    coalesce(attestation_metadata, '{}'::jsonb),
    public.current_profile_id(),
    coalesce(verified_at, now())
  )
  ON CONFLICT (proposal_id, external_signer_id, relay_id) DO UPDATE
    SET decision = excluded.decision,
        status = excluded.status,
        payload_hash = excluded.payload_hash,
        relay_reference = excluded.relay_reference,
        chain_network = excluded.chain_network,
        chain_reference = excluded.chain_reference,
        attestation_metadata = excluded.attestation_metadata,
        verified_by = excluded.verified_by,
        verified_at = excluded.verified_at
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_proposal_guardian_relay_summary(
  target_proposal_id uuid
)
RETURNS TABLE (
  policy_enabled boolean,
  required_relay_attestations integer,
  require_chain_proof_match boolean,
  active_relay_count integer,
  relay_verified_count integer,
  relay_mismatch_count integer,
  relay_unreachable_count integer,
  signers_with_relay_quorum_count integer,
  signers_with_chain_proof_count integer,
  external_approval_count integer,
  relay_quorum_met boolean,
  chain_proof_match_met boolean
) AS $$
WITH policy AS (
  SELECT
    coalesce(relay_policy.is_enabled, false) AS policy_enabled,
    greatest(1, coalesce(relay_policy.required_relay_attestations, 2)) AS required_relay_attestations,
    coalesce(relay_policy.require_chain_proof_match, true) AS require_chain_proof_match
  FROM public.governance_guardian_relay_policies AS relay_policy
  WHERE relay_policy.policy_key = 'guardian_relay_default'
  ORDER BY relay_policy.updated_at DESC, relay_policy.created_at DESC, relay_policy.id DESC
  LIMIT 1
),
active_relays AS (
  SELECT count(*)::integer AS active_relay_count
  FROM public.governance_guardian_relay_nodes AS relay
  WHERE relay.is_active = true
),
external_approvals AS (
  SELECT signature.external_signer_id
  FROM public.governance_proposal_guardian_external_signatures AS signature
  JOIN public.governance_guardian_external_signers AS signer
    ON signer.id = signature.external_signer_id
  WHERE signature.proposal_id = target_proposal_id
    AND signature.decision = 'approve'::public.governance_guardian_decision
    AND signature.verified_at IS NOT NULL
    AND signer.is_active = true
),
relay_attestations AS (
  SELECT
    attestation.external_signer_id,
    attestation.status,
    attestation.chain_network,
    attestation.chain_reference
  FROM public.governance_proposal_guardian_relay_attestations AS attestation
  JOIN public.governance_guardian_relay_nodes AS relay
    ON relay.id = attestation.relay_id
  JOIN external_approvals AS approval
    ON approval.external_signer_id = attestation.external_signer_id
  WHERE attestation.proposal_id = target_proposal_id
    AND relay.is_active = true
),
relay_tally AS (
  SELECT
    coalesce(count(*) FILTER (WHERE status = 'verified'::public.governance_guardian_relay_attestation_status), 0)::integer AS relay_verified_count,
    coalesce(count(*) FILTER (WHERE status = 'mismatch'::public.governance_guardian_relay_attestation_status), 0)::integer AS relay_mismatch_count,
    coalesce(count(*) FILTER (WHERE status = 'unreachable'::public.governance_guardian_relay_attestation_status), 0)::integer AS relay_unreachable_count
  FROM relay_attestations
),
signer_tally AS (
  SELECT
    coalesce(count(*) FILTER (WHERE signer_summary.verified_relay_count >= coalesce(policy.required_relay_attestations, 2)), 0)::integer AS signers_with_relay_quorum_count,
    coalesce(count(*) FILTER (
      WHERE signer_summary.verified_relay_count >= coalesce(policy.required_relay_attestations, 2)
        AND signer_summary.chain_verified_count > 0
    ), 0)::integer AS signers_with_chain_proof_count
  FROM (
    SELECT
      approval.external_signer_id,
      coalesce(count(*) FILTER (WHERE attestation.status = 'verified'::public.governance_guardian_relay_attestation_status), 0)::integer AS verified_relay_count,
      coalesce(count(*) FILTER (
        WHERE attestation.status = 'verified'::public.governance_guardian_relay_attestation_status
          AND attestation.chain_network IS NOT NULL
          AND attestation.chain_reference IS NOT NULL
      ), 0)::integer AS chain_verified_count
    FROM external_approvals AS approval
    LEFT JOIN relay_attestations AS attestation
      ON attestation.external_signer_id = approval.external_signer_id
    GROUP BY approval.external_signer_id
  ) AS signer_summary
  CROSS JOIN policy
),
external_approval_tally AS (
  SELECT coalesce(count(*), 0)::integer AS external_approval_count
  FROM external_approvals
)
SELECT
  coalesce(policy.policy_enabled, false) AS policy_enabled,
  coalesce(policy.required_relay_attestations, 2) AS required_relay_attestations,
  coalesce(policy.require_chain_proof_match, true) AS require_chain_proof_match,
  coalesce(active_relays.active_relay_count, 0) AS active_relay_count,
  coalesce(relay_tally.relay_verified_count, 0) AS relay_verified_count,
  coalesce(relay_tally.relay_mismatch_count, 0) AS relay_mismatch_count,
  coalesce(relay_tally.relay_unreachable_count, 0) AS relay_unreachable_count,
  coalesce(signer_tally.signers_with_relay_quorum_count, 0) AS signers_with_relay_quorum_count,
  coalesce(signer_tally.signers_with_chain_proof_count, 0) AS signers_with_chain_proof_count,
  coalesce(external_approval_tally.external_approval_count, 0) AS external_approval_count,
  (
    coalesce(external_approval_tally.external_approval_count, 0) > 0
    AND coalesce(signer_tally.signers_with_relay_quorum_count, 0) >= coalesce(external_approval_tally.external_approval_count, 0)
  ) AS relay_quorum_met,
  (
    NOT coalesce(policy.require_chain_proof_match, true)
    OR (
      coalesce(external_approval_tally.external_approval_count, 0) > 0
      AND coalesce(signer_tally.signers_with_chain_proof_count, 0) >= coalesce(external_approval_tally.external_approval_count, 0)
    )
  ) AS chain_proof_match_met
FROM policy
FULL JOIN active_relays ON true
FULL JOIN relay_tally ON true
FULL JOIN signer_tally ON true
FULL JOIN external_approval_tally ON true;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.governance_proposal_guardian_signoff_summary(
  target_proposal_id uuid
)
RETURNS TABLE (
  requires_guardian_signoff boolean,
  approval_class public.governance_threshold_approval_class,
  required_approvals integer,
  approval_count integer,
  rejection_count integer,
  decisive_count integer,
  requires_window_close boolean,
  meets_signoff boolean
) AS $$
WITH target_proposal AS (
  SELECT
    proposal.id,
    proposal.decision_class,
    proposal.closes_at,
    proposal.metadata,
    coalesce(nullif(proposal.metadata ->> 'execution_action_type', ''), 'manual_follow_through') AS execution_action_type
  FROM public.governance_proposals AS proposal
  WHERE proposal.id = target_proposal_id
  LIMIT 1
),
threshold_rule AS (
  SELECT
    rule.approval_class,
    rule.min_approval_votes,
    rule.requires_window_close
  FROM target_proposal
  CROSS JOIN LATERAL public.resolve_governance_execution_threshold_rule(
    target_proposal.execution_action_type,
    target_proposal.decision_class
  ) AS rule
),
internal_tally AS (
  SELECT
    coalesce(count(*) FILTER (WHERE approval.decision = 'approve'::public.governance_guardian_decision), 0)::integer AS approvals,
    coalesce(count(*) FILTER (WHERE approval.decision = 'reject'::public.governance_guardian_decision), 0)::integer AS rejections
  FROM public.governance_proposal_guardian_approvals AS approval
  JOIN target_proposal ON target_proposal.id = approval.proposal_id
  WHERE public.profile_is_guardian_signer(approval.signer_profile_id)
),
multisig_summary AS (
  SELECT *
  FROM public.governance_proposal_external_multisig_summary(target_proposal_id)
),
relay_summary AS (
  SELECT *
  FROM public.governance_proposal_guardian_relay_summary(target_proposal_id)
)
SELECT
  (coalesce(threshold_rule.approval_class, 'ordinary_majority'::public.governance_threshold_approval_class)
    = 'guardian_threshold'::public.governance_threshold_approval_class) AS requires_guardian_signoff,
  coalesce(threshold_rule.approval_class, 'ordinary_majority'::public.governance_threshold_approval_class) AS approval_class,
  CASE
    WHEN coalesce(threshold_rule.approval_class, 'ordinary_majority'::public.governance_threshold_approval_class)
      = 'guardian_threshold'::public.governance_threshold_approval_class
    THEN greatest(2, coalesce(threshold_rule.min_approval_votes, 2))
    ELSE 0
  END AS required_approvals,
  (
    coalesce(internal_tally.approvals, 0)
    + CASE WHEN coalesce(multisig_summary.external_multisig_required, false) THEN coalesce(multisig_summary.external_approval_count, 0) ELSE 0 END
  ) AS approval_count,
  (
    coalesce(internal_tally.rejections, 0)
    + CASE WHEN coalesce(multisig_summary.external_multisig_required, false) THEN coalesce(multisig_summary.external_rejection_count, 0) ELSE 0 END
  ) AS rejection_count,
  (
    coalesce(internal_tally.approvals, 0)
    + coalesce(internal_tally.rejections, 0)
    + CASE WHEN coalesce(multisig_summary.external_multisig_required, false) THEN coalesce(multisig_summary.external_decisive_count, 0) ELSE 0 END
  ) AS decisive_count,
  coalesce(threshold_rule.requires_window_close, false) AS requires_window_close,
  CASE
    WHEN coalesce(threshold_rule.approval_class, 'ordinary_majority'::public.governance_threshold_approval_class)
      <> 'guardian_threshold'::public.governance_threshold_approval_class
    THEN true
    WHEN coalesce(threshold_rule.requires_window_close, false)
      AND now() < target_proposal.closes_at
    THEN false
    ELSE (
      (
        coalesce(internal_tally.approvals, 0)
        + CASE WHEN coalesce(multisig_summary.external_multisig_required, false) THEN coalesce(multisig_summary.external_approval_count, 0) ELSE 0 END
      ) >= greatest(2, coalesce(threshold_rule.min_approval_votes, 2))
      AND (
        coalesce(internal_tally.approvals, 0)
        + CASE WHEN coalesce(multisig_summary.external_multisig_required, false) THEN coalesce(multisig_summary.external_approval_count, 0) ELSE 0 END
      ) > (
        coalesce(internal_tally.rejections, 0)
        + CASE WHEN coalesce(multisig_summary.external_multisig_required, false) THEN coalesce(multisig_summary.external_rejection_count, 0) ELSE 0 END
      )
      AND (
        NOT coalesce(multisig_summary.external_multisig_required, false)
        OR coalesce(multisig_summary.external_approval_count, 0) >= coalesce(multisig_summary.required_external_approvals, 1)
      )
      AND (
        NOT coalesce(multisig_summary.external_multisig_required, false)
        OR NOT coalesce(relay_summary.policy_enabled, false)
        OR (
          coalesce(relay_summary.signers_with_relay_quorum_count, 0) >= coalesce(multisig_summary.external_approval_count, 0)
          AND (
            NOT coalesce(relay_summary.require_chain_proof_match, true)
            OR coalesce(relay_summary.chain_proof_match_met, false)
          )
        )
      )
    )
  END AS meets_signoff
FROM target_proposal
LEFT JOIN threshold_rule ON true
LEFT JOIN internal_tally ON true
LEFT JOIN multisig_summary ON true
LEFT JOIN relay_summary ON true;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.register_governance_public_audit_anchor_adapter(
  adapter_key text,
  adapter_name text,
  network text,
  endpoint_url text DEFAULT NULL,
  attestation_scheme text DEFAULT 'append_only_receipt_v1',
  metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  inserted_id uuid;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to manage public audit anchor adapters';
  END IF;

  INSERT INTO public.governance_public_audit_anchor_adapters (
    adapter_key,
    adapter_name,
    network,
    endpoint_url,
    attestation_scheme,
    metadata,
    added_by
  )
  VALUES (
    btrim(coalesce(adapter_key, '')),
    btrim(coalesce(adapter_name, '')),
    btrim(coalesce(network, '')),
    nullif(btrim(coalesce(endpoint_url, '')), ''),
    btrim(coalesce(attestation_scheme, 'append_only_receipt_v1')),
    coalesce(metadata, '{}'::jsonb),
    public.current_profile_id()
  )
  ON CONFLICT (adapter_key) DO UPDATE
    SET adapter_name = excluded.adapter_name,
        network = excluded.network,
        endpoint_url = excluded.endpoint_url,
        attestation_scheme = excluded.attestation_scheme,
        metadata = coalesce(public.governance_public_audit_anchor_adapters.metadata, '{}'::jsonb) || coalesce(excluded.metadata, '{}'::jsonb),
        is_active = true
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.record_governance_public_audit_immutable_anchor(
  target_batch_id uuid,
  target_adapter_id uuid DEFAULT NULL,
  target_network text DEFAULT NULL,
  immutable_reference text DEFAULT NULL,
  proof_payload jsonb DEFAULT '{}'::jsonb,
  proof_block_height bigint DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  adapter_record public.governance_public_audit_anchor_adapters%ROWTYPE;
  normalized_network text;
  normalized_reference text;
  inserted_id uuid;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to record immutable public audit anchors';
  END IF;

  IF target_batch_id IS NULL THEN
    RAISE EXCEPTION 'Target batch id is required';
  END IF;

  IF target_adapter_id IS NOT NULL THEN
    SELECT adapter.*
    INTO adapter_record
    FROM public.governance_public_audit_anchor_adapters AS adapter
    WHERE adapter.id = target_adapter_id
      AND adapter.is_active = true
    LIMIT 1;

    IF adapter_record.id IS NULL THEN
      RAISE EXCEPTION 'Target anchor adapter does not exist or is inactive';
    END IF;
  END IF;

  normalized_network := coalesce(
    nullif(btrim(coalesce(target_network, '')), ''),
    nullif(btrim(coalesce(adapter_record.network, '')), ''),
    'external_anchor'
  );
  normalized_reference := nullif(btrim(coalesce(immutable_reference, '')), '');

  IF normalized_reference IS NULL THEN
    RAISE EXCEPTION 'Immutable reference is required';
  END IF;

  INSERT INTO public.governance_public_audit_immutable_anchors (
    batch_id,
    adapter_id,
    network,
    immutable_reference,
    proof_payload,
    block_height,
    anchored_by,
    anchored_at
  )
  VALUES (
    target_batch_id,
    adapter_record.id,
    normalized_network,
    normalized_reference,
    coalesce(proof_payload, '{}'::jsonb),
    proof_block_height,
    public.current_profile_id(),
    now()
  )
  ON CONFLICT (batch_id, network, immutable_reference) DO NOTHING
  RETURNING id INTO inserted_id;

  IF inserted_id IS NULL THEN
    SELECT anchor.id
    INTO inserted_id
    FROM public.governance_public_audit_immutable_anchors AS anchor
    WHERE anchor.batch_id = target_batch_id
      AND anchor.network = normalized_network
      AND anchor.immutable_reference = normalized_reference
    LIMIT 1;
  END IF;

  UPDATE public.governance_public_audit_batches
  SET anchor_network = coalesce(anchor_network, normalized_network),
      anchor_reference = coalesce(anchor_reference, normalized_reference),
      anchored_at = coalesce(anchored_at, now()),
      metadata = coalesce(metadata, '{}'::jsonb)
        || jsonb_build_object(
          'immutable_anchor_recorded_at', now(),
          'immutable_anchor_recorded_by', public.current_profile_id(),
          'immutable_anchor_reference', normalized_reference,
          'immutable_anchor_network', normalized_network
        )
  WHERE id = target_batch_id;

  INSERT INTO public.governance_public_audit_network_proofs (
    batch_id,
    network,
    proof_reference,
    proof_payload,
    block_height,
    recorded_by,
    recorded_at
  )
  VALUES (
    target_batch_id,
    normalized_network,
    normalized_reference,
    coalesce(proof_payload, '{}'::jsonb),
    proof_block_height,
    public.current_profile_id(),
    now()
  )
  ON CONFLICT (batch_id, network, proof_reference) DO UPDATE
    SET proof_payload = excluded.proof_payload,
        block_height = excluded.block_height,
        recorded_by = excluded.recorded_by,
        recorded_at = excluded.recorded_at;

  RETURN inserted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.schedule_governance_public_audit_verifier_jobs(
  target_batch_id uuid DEFAULT NULL,
  force_reschedule boolean DEFAULT false
)
RETURNS integer AS $$
DECLARE
  batch_record record;
  verifier_record record;
  inserted_count integer := 0;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to schedule public audit verifier jobs';
  END IF;

  FOR batch_record IN
    SELECT batch.id
    FROM public.governance_public_audit_batches AS batch
    WHERE target_batch_id IS NULL OR batch.id = target_batch_id
    ORDER BY batch.batch_index DESC
    LIMIT CASE WHEN target_batch_id IS NULL THEN 3 ELSE 1 END
  LOOP
    FOR verifier_record IN
      SELECT verifier.id
      FROM public.governance_public_audit_verifier_nodes AS verifier
      WHERE verifier.is_active = true
      ORDER BY verifier.created_at ASC
    LOOP
      IF force_reschedule
         OR NOT EXISTS (
           SELECT 1
           FROM public.governance_public_audit_verifier_jobs AS job
           WHERE job.batch_id = batch_record.id
             AND job.verifier_id = verifier_record.id
             AND job.status = 'pending'::public.governance_public_audit_verifier_job_status
         )
      THEN
        INSERT INTO public.governance_public_audit_verifier_jobs (
          batch_id,
          verifier_id,
          status,
          metadata,
          scheduled_by,
          scheduled_at
        )
        VALUES (
          batch_record.id,
          verifier_record.id,
          'pending'::public.governance_public_audit_verifier_job_status,
          jsonb_build_object('source', 'automated_verifier_scheduler'),
          public.current_profile_id(),
          now()
        );
        inserted_count := inserted_count + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.complete_governance_public_audit_verifier_job(
  target_job_id uuid,
  completion_status public.governance_public_audit_verifier_job_status,
  verification_status public.governance_public_audit_verification_status DEFAULT NULL,
  verification_hash text DEFAULT NULL,
  proof_reference text DEFAULT NULL,
  error_message text DEFAULT NULL,
  proof_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  job_record public.governance_public_audit_verifier_jobs%ROWTYPE;
BEGIN
  IF NOT public.current_profile_can_manage_public_audit_verifiers() THEN
    RAISE EXCEPTION 'Current profile is not authorized to complete public audit verifier jobs';
  END IF;

  SELECT job.*
  INTO job_record
  FROM public.governance_public_audit_verifier_jobs AS job
  WHERE job.id = target_job_id
  LIMIT 1;

  IF job_record.id IS NULL THEN
    RAISE EXCEPTION 'Verifier job does not exist';
  END IF;

  UPDATE public.governance_public_audit_verifier_jobs
  SET status = completion_status,
      result_reference = nullif(btrim(coalesce(proof_reference, '')), ''),
      error_message = nullif(btrim(coalesce(error_message, '')), ''),
      completed_at = CASE
        WHEN completion_status IN (
          'completed'::public.governance_public_audit_verifier_job_status,
          'failed'::public.governance_public_audit_verifier_job_status,
          'cancelled'::public.governance_public_audit_verifier_job_status
        )
        THEN now()
        ELSE completed_at
      END,
      metadata = coalesce(metadata, '{}'::jsonb) || coalesce(proof_payload, '{}'::jsonb)
  WHERE id = job_record.id;

  IF completion_status = 'completed'::public.governance_public_audit_verifier_job_status
     AND verification_status IS NOT NULL
  THEN
    PERFORM public.record_governance_public_audit_batch_verification(
      job_record.batch_id,
      job_record.verifier_id,
      verification_status,
      verification_hash,
      proof_reference,
      proof_payload,
      now()
    );
  END IF;

  RETURN job_record.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.run_governance_public_audit_verifier_cycle(
  target_batch_id uuid DEFAULT NULL
)
RETURNS integer AS $$
DECLARE
  scheduled_count integer;
BEGIN
  scheduled_count := public.schedule_governance_public_audit_verifier_jobs(target_batch_id, false);
  RETURN coalesce(scheduled_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

ALTER TABLE public.governance_public_audit_batch_items
  DROP CONSTRAINT IF EXISTS governance_public_audit_batch_items_source_check;

ALTER TABLE public.governance_public_audit_batch_items
  ADD CONSTRAINT governance_public_audit_batch_items_source_check CHECK (
    event_source = ANY(
      ARRAY[
        'governance_proposal_events',
        'governance_implementation_logs',
        'governance_proposal_guardian_approvals',
        'governance_proposal_guardian_external_signatures',
        'governance_proposal_guardian_relay_attestations',
        'governance_public_audit_immutable_anchors'
      ]
    )
  );

CREATE OR REPLACE FUNCTION public.list_pending_governance_public_audit_events(
  max_events integer DEFAULT 500,
  requested_from timestamptz DEFAULT NULL,
  requested_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  event_position integer,
  event_source text,
  event_id uuid,
  event_created_at timestamptz,
  event_actor_id uuid,
  event_payload jsonb,
  event_digest text
) AS $$
WITH candidate_events AS (
  SELECT
    'governance_proposal_events'::text AS event_source,
    event.id AS event_id,
    event.created_at AS event_created_at,
    event.actor_id AS event_actor_id,
    coalesce(event.payload, '{}'::jsonb) AS event_payload
  FROM public.governance_proposal_events AS event
  WHERE (requested_from IS NULL OR event.created_at >= requested_from)
    AND (requested_to IS NULL OR event.created_at <= requested_to)

  UNION ALL

  SELECT
    'governance_implementation_logs'::text AS event_source,
    log.id AS event_id,
    log.created_at AS event_created_at,
    log.actor_id AS event_actor_id,
    jsonb_build_object(
      'execution_status', log.execution_status,
      'execution_summary', log.execution_summary,
      'details', coalesce(log.details, '{}'::jsonb),
      'proposal_id', log.proposal_id,
      'implementation_id', log.implementation_id
    ) AS event_payload
  FROM public.governance_implementation_logs AS log
  WHERE (requested_from IS NULL OR log.created_at >= requested_from)
    AND (requested_to IS NULL OR log.created_at <= requested_to)

  UNION ALL

  SELECT
    'governance_proposal_guardian_approvals'::text AS event_source,
    approval.id AS event_id,
    approval.signed_at AS event_created_at,
    approval.signer_profile_id AS event_actor_id,
    jsonb_build_object(
      'proposal_id', approval.proposal_id,
      'decision', approval.decision,
      'rationale', approval.rationale,
      'snapshot', coalesce(approval.snapshot, '{}'::jsonb),
      'signed_at', approval.signed_at
    ) AS event_payload
  FROM public.governance_proposal_guardian_approvals AS approval
  WHERE (requested_from IS NULL OR approval.signed_at >= requested_from)
    AND (requested_to IS NULL OR approval.signed_at <= requested_to)

  UNION ALL

  SELECT
    'governance_proposal_guardian_external_signatures'::text AS event_source,
    signature.id AS event_id,
    signature.signed_at AS event_created_at,
    signature.verified_by AS event_actor_id,
    jsonb_build_object(
      'proposal_id', signature.proposal_id,
      'external_signer_id', signature.external_signer_id,
      'decision', signature.decision,
      'payload_hash', signature.payload_hash,
      'signature_reference', signature.signature_reference,
      'verification_method', signature.verification_method,
      'snapshot', coalesce(signature.snapshot, '{}'::jsonb),
      'signed_at', signature.signed_at,
      'verified_at', signature.verified_at
    ) AS event_payload
  FROM public.governance_proposal_guardian_external_signatures AS signature
  WHERE (requested_from IS NULL OR signature.signed_at >= requested_from)
    AND (requested_to IS NULL OR signature.signed_at <= requested_to)

  UNION ALL

  SELECT
    'governance_proposal_guardian_relay_attestations'::text AS event_source,
    attestation.id AS event_id,
    attestation.verified_at AS event_created_at,
    attestation.verified_by AS event_actor_id,
    jsonb_build_object(
      'proposal_id', attestation.proposal_id,
      'external_signer_id', attestation.external_signer_id,
      'relay_id', attestation.relay_id,
      'decision', attestation.decision,
      'status', attestation.status,
      'payload_hash', attestation.payload_hash,
      'relay_reference', attestation.relay_reference,
      'chain_network', attestation.chain_network,
      'chain_reference', attestation.chain_reference,
      'verified_at', attestation.verified_at
    ) AS event_payload
  FROM public.governance_proposal_guardian_relay_attestations AS attestation
  WHERE (requested_from IS NULL OR attestation.verified_at >= requested_from)
    AND (requested_to IS NULL OR attestation.verified_at <= requested_to)

  UNION ALL

  SELECT
    'governance_public_audit_immutable_anchors'::text AS event_source,
    anchor.id AS event_id,
    anchor.anchored_at AS event_created_at,
    anchor.anchored_by AS event_actor_id,
    jsonb_build_object(
      'batch_id', anchor.batch_id,
      'adapter_id', anchor.adapter_id,
      'network', anchor.network,
      'immutable_reference', anchor.immutable_reference,
      'block_height', anchor.block_height,
      'anchored_at', anchor.anchored_at,
      'proof_payload', coalesce(anchor.proof_payload, '{}'::jsonb)
    ) AS event_payload
  FROM public.governance_public_audit_immutable_anchors AS anchor
  WHERE (requested_from IS NULL OR anchor.anchored_at >= requested_from)
    AND (requested_to IS NULL OR anchor.anchored_at <= requested_to)
),
unbatched_events AS (
  SELECT candidate.*
  FROM candidate_events AS candidate
  LEFT JOIN public.governance_public_audit_batch_items AS item
    ON item.event_source = candidate.event_source
   AND item.event_id = candidate.event_id
  WHERE item.id IS NULL
),
selected_events AS (
  SELECT *
  FROM unbatched_events
  ORDER BY event_created_at ASC, event_source ASC, event_id ASC
  LIMIT greatest(1, coalesce(max_events, 500))
),
ordered_events AS (
  SELECT
    row_number() OVER (ORDER BY event_created_at ASC, event_source ASC, event_id ASC)::integer AS event_position,
    event_source,
    event_id,
    event_created_at,
    event_actor_id,
    event_payload
  FROM selected_events
)
SELECT
  ordered_events.event_position,
  ordered_events.event_source,
  ordered_events.event_id,
  ordered_events.event_created_at,
  ordered_events.event_actor_id,
  ordered_events.event_payload,
  encode(
    extensions.digest(
      concat_ws(
        '|',
        ordered_events.event_source,
        ordered_events.event_id::text,
        coalesce(ordered_events.event_actor_id::text, ''),
        coalesce(ordered_events.event_created_at::text, ''),
        coalesce(ordered_events.event_payload::text, '{}')
      )::bytea,
      'sha256'
    ),
    'hex'
  ) AS event_digest
FROM ordered_events
ORDER BY ordered_events.event_position ASC;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

INSERT INTO public.governance_guardian_relay_policies (
  policy_key,
  policy_name,
  is_enabled,
  required_relay_attestations,
  require_chain_proof_match,
  notes,
  metadata
)
VALUES (
  'guardian_relay_default',
  'Guardian Relay Quorum Default Policy',
  false,
  2,
  true,
  'Require independent relay attestations and chain-reference matching for external guardian approvals.',
  jsonb_build_object('source', 'bootstrap_seed')
)
ON CONFLICT (policy_key) DO NOTHING;

INSERT INTO public.governance_public_audit_anchor_adapters (
  adapter_key,
  adapter_name,
  network,
  attestation_scheme,
  metadata
)
VALUES (
  'public_audit_default_adapter',
  'Public Audit Default Adapter',
  'external_anchor',
  'append_only_receipt_v1',
  jsonb_build_object('source', 'bootstrap_seed')
)
ON CONFLICT (adapter_key) DO NOTHING;

GRANT SELECT, INSERT, UPDATE ON public.activation_demographic_feed_adapters TO authenticated;
GRANT SELECT, INSERT ON public.activation_demographic_feed_ingestions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.governance_guardian_relay_policies TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.governance_guardian_relay_nodes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.governance_proposal_guardian_relay_attestations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.governance_public_audit_anchor_adapters TO authenticated;
GRANT SELECT, INSERT ON public.governance_public_audit_immutable_anchors TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.governance_public_audit_verifier_jobs TO authenticated;

GRANT EXECUTE ON FUNCTION public.current_profile_can_manage_activation_demographic_feeds() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_profile_can_manage_guardian_relays() TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_activation_demographic_feed_adapter(text, text, public.activation_demographic_feed_adapter_type, public.activation_scope_type, text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_signed_activation_demographic_feed_snapshot(uuid, bigint, text, timestamptz, text, text, text, boolean, text, jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_governance_guardian_relay_node(text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_governance_guardian_relay_attestation(uuid, uuid, uuid, public.governance_guardian_decision, public.governance_guardian_relay_attestation_status, text, text, text, text, jsonb, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_proposal_guardian_relay_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_governance_public_audit_anchor_adapter(text, text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_governance_public_audit_immutable_anchor(uuid, uuid, text, text, jsonb, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_governance_public_audit_verifier_jobs(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_governance_public_audit_verifier_job(uuid, public.governance_public_audit_verifier_job_status, public.governance_public_audit_verification_status, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_governance_public_audit_verifier_cycle(uuid) TO authenticated;

ALTER TABLE public.activation_demographic_feed_adapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activation_demographic_feed_ingestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_guardian_relay_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_guardian_relay_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_proposal_guardian_relay_attestations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_public_audit_anchor_adapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_public_audit_immutable_anchors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_public_audit_verifier_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Activation feed adapters are readable by authenticated users" ON public.activation_demographic_feed_adapters;
CREATE POLICY "Activation feed adapters are readable by authenticated users" ON public.activation_demographic_feed_adapters
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Activation feed adapters are manageable by feed stewards" ON public.activation_demographic_feed_adapters;
CREATE POLICY "Activation feed adapters are manageable by feed stewards" ON public.activation_demographic_feed_adapters
  FOR ALL USING (public.current_profile_can_manage_activation_demographic_feeds())
  WITH CHECK (public.current_profile_can_manage_activation_demographic_feeds());

DROP POLICY IF EXISTS "Activation feed ingestions are readable by authenticated users" ON public.activation_demographic_feed_ingestions;
CREATE POLICY "Activation feed ingestions are readable by authenticated users" ON public.activation_demographic_feed_ingestions
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Activation feed ingestions are insertable by feed stewards" ON public.activation_demographic_feed_ingestions;
CREATE POLICY "Activation feed ingestions are insertable by feed stewards" ON public.activation_demographic_feed_ingestions
  FOR INSERT WITH CHECK (public.current_profile_can_manage_activation_demographic_feeds());

DROP POLICY IF EXISTS "Guardian relay policies are readable by authenticated users" ON public.governance_guardian_relay_policies;
CREATE POLICY "Guardian relay policies are readable by authenticated users" ON public.governance_guardian_relay_policies
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Guardian relay policies are manageable by relay stewards" ON public.governance_guardian_relay_policies;
CREATE POLICY "Guardian relay policies are manageable by relay stewards" ON public.governance_guardian_relay_policies
  FOR ALL USING (public.current_profile_can_manage_guardian_relays())
  WITH CHECK (public.current_profile_can_manage_guardian_relays());

DROP POLICY IF EXISTS "Guardian relay nodes are readable by authenticated users" ON public.governance_guardian_relay_nodes;
CREATE POLICY "Guardian relay nodes are readable by authenticated users" ON public.governance_guardian_relay_nodes
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Guardian relay nodes are manageable by relay stewards" ON public.governance_guardian_relay_nodes;
CREATE POLICY "Guardian relay nodes are manageable by relay stewards" ON public.governance_guardian_relay_nodes
  FOR ALL USING (public.current_profile_can_manage_guardian_relays())
  WITH CHECK (public.current_profile_can_manage_guardian_relays());

DROP POLICY IF EXISTS "Guardian relay attestations are readable by authenticated users" ON public.governance_proposal_guardian_relay_attestations;
CREATE POLICY "Guardian relay attestations are readable by authenticated users" ON public.governance_proposal_guardian_relay_attestations
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Guardian relay attestations are manageable by relay stewards" ON public.governance_proposal_guardian_relay_attestations;
CREATE POLICY "Guardian relay attestations are manageable by relay stewards" ON public.governance_proposal_guardian_relay_attestations
  FOR ALL USING (public.current_profile_can_manage_guardian_relays())
  WITH CHECK (public.current_profile_can_manage_guardian_relays());

DROP POLICY IF EXISTS "Public audit anchor adapters are readable by authenticated users" ON public.governance_public_audit_anchor_adapters;
CREATE POLICY "Public audit anchor adapters are readable by authenticated users" ON public.governance_public_audit_anchor_adapters
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Public audit anchor adapters are manageable by verifier stewards" ON public.governance_public_audit_anchor_adapters;
CREATE POLICY "Public audit anchor adapters are manageable by verifier stewards" ON public.governance_public_audit_anchor_adapters
  FOR ALL USING (public.current_profile_can_manage_public_audit_verifiers())
  WITH CHECK (public.current_profile_can_manage_public_audit_verifiers());

DROP POLICY IF EXISTS "Immutable public audit anchors are readable by authenticated users" ON public.governance_public_audit_immutable_anchors;
CREATE POLICY "Immutable public audit anchors are readable by authenticated users" ON public.governance_public_audit_immutable_anchors
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Immutable public audit anchors are insertable by verifier stewards" ON public.governance_public_audit_immutable_anchors;
CREATE POLICY "Immutable public audit anchors are insertable by verifier stewards" ON public.governance_public_audit_immutable_anchors
  FOR INSERT WITH CHECK (public.current_profile_can_manage_public_audit_verifiers());

DROP POLICY IF EXISTS "Public audit verifier jobs are readable by authenticated users" ON public.governance_public_audit_verifier_jobs;
CREATE POLICY "Public audit verifier jobs are readable by authenticated users" ON public.governance_public_audit_verifier_jobs
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Public audit verifier jobs are manageable by verifier stewards" ON public.governance_public_audit_verifier_jobs;
CREATE POLICY "Public audit verifier jobs are manageable by verifier stewards" ON public.governance_public_audit_verifier_jobs
  FOR ALL USING (public.current_profile_can_manage_public_audit_verifiers())
  WITH CHECK (public.current_profile_can_manage_public_audit_verifiers());
