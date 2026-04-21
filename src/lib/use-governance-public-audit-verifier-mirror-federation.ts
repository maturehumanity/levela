import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import {
  isMissingPublicAuditVerifierBackend,
  readGovernancePublicAuditVerifierMirrorDiscoveredCandidateBoardRows,
  readGovernancePublicAuditVerifierMirrorDiscoverySourceBoardRows,
  readGovernancePublicAuditVerifierMirrorDiscoverySummary,
  readGovernancePublicAuditVerifierMirrorPolicyRatificationSummary,
  type GovernancePublicAuditVerifierMirrorDiscoveredCandidateBoardRow,
  type GovernancePublicAuditVerifierMirrorDiscoverySourceBoardRow,
  type GovernancePublicAuditVerifierMirrorDiscoverySummary,
  type GovernancePublicAuditVerifierMirrorPolicyRatificationSummary,
} from '@/lib/governance-public-audit-verifiers';

type RpcErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
} | null;

type RpcResponseLike<T> = {
  data: T | null;
  error: RpcErrorLike;
};

function callUntypedRpc<T>(fnName: string, params?: Record<string, unknown>) {
  const rpc = supabase.rpc as unknown as (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<RpcResponseLike<T>>;

  return rpc(fnName, params);
}

function asIntegerOrNull(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function asNumericOrNull(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function useGovernancePublicAuditVerifierMirrorFederation(args: { latestBatchId: string | null }) {
  const [loadingFederationData, setLoadingFederationData] = useState(true);
  const [federationBackendUnavailable, setFederationBackendUnavailable] = useState(false);
  const [canManageMirrorFederation, setCanManageMirrorFederation] = useState(false);

  const [registeringDiscoverySource, setRegisteringDiscoverySource] = useState(false);
  const [recordingDiscoveryRun, setRecordingDiscoveryRun] = useState(false);
  const [upsertingDiscoveredCandidate, setUpsertingDiscoveredCandidate] = useState(false);
  const [promotingDiscoveredCandidate, setPromotingDiscoveredCandidate] = useState(false);
  const [savingPolicyRatification, setSavingPolicyRatification] = useState(false);

  const [policyRatificationSummary, setPolicyRatificationSummary] =
    useState<GovernancePublicAuditVerifierMirrorPolicyRatificationSummary | null>(null);
  const [discoverySummary, setDiscoverySummary] = useState<GovernancePublicAuditVerifierMirrorDiscoverySummary | null>(null);
  const [discoverySources, setDiscoverySources] = useState<GovernancePublicAuditVerifierMirrorDiscoverySourceBoardRow[]>([]);
  const [discoveredCandidates, setDiscoveredCandidates] = useState<GovernancePublicAuditVerifierMirrorDiscoveredCandidateBoardRow[]>([]);

  const loadFederationData = useCallback(async () => {
    setLoadingFederationData(true);

    const [
      permissionResponse,
      ratificationSummaryResponse,
      discoverySummaryResponse,
      discoverySourcesResponse,
      discoveredCandidatesResponse,
    ] = await Promise.all([
      supabase.rpc('current_profile_can_manage_public_audit_verifiers'),
      callUntypedRpc<unknown[]>('governance_public_audit_verifier_mirror_policy_ratification_summary', {
        requested_policy_key: 'default',
      }),
      callUntypedRpc<unknown[]>('governance_public_audit_verifier_mirror_discovery_summary', {
        requested_batch_id: args.latestBatchId,
        requested_lookback_hours: 24,
      }),
      callUntypedRpc<unknown[]>('governance_public_audit_verifier_mirror_discovery_source_board', {
        max_entries: 20,
      }),
      callUntypedRpc<unknown[]>('governance_public_audit_verifier_mirror_discovered_candidate_board', {
        status_filter: null,
        max_candidates: 80,
      }),
    ]);

    const sharedError = permissionResponse.error
      || ratificationSummaryResponse.error
      || discoverySummaryResponse.error
      || discoverySourcesResponse.error
      || discoveredCandidatesResponse.error;

    if (isMissingPublicAuditVerifierBackend(sharedError)) {
      setFederationBackendUnavailable(true);
      setLoadingFederationData(false);
      return;
    }

    if (sharedError) {
      console.error('Failed to load verifier mirror federation data:', {
        permissionError: permissionResponse.error,
        ratificationSummaryError: ratificationSummaryResponse.error,
        discoverySummaryError: discoverySummaryResponse.error,
        discoverySourcesError: discoverySourcesResponse.error,
        discoveredCandidatesError: discoveredCandidatesResponse.error,
      });
      toast.error('Could not load verifier mirror federation data.');
      setLoadingFederationData(false);
      return;
    }

    setCanManageMirrorFederation(Boolean(permissionResponse.data));
    setPolicyRatificationSummary(readGovernancePublicAuditVerifierMirrorPolicyRatificationSummary(ratificationSummaryResponse.data));
    setDiscoverySummary(readGovernancePublicAuditVerifierMirrorDiscoverySummary(discoverySummaryResponse.data));
    setDiscoverySources(readGovernancePublicAuditVerifierMirrorDiscoverySourceBoardRows(discoverySourcesResponse.data));
    setDiscoveredCandidates(readGovernancePublicAuditVerifierMirrorDiscoveredCandidateBoardRows(discoveredCandidatesResponse.data));
    setFederationBackendUnavailable(false);
    setLoadingFederationData(false);
  }, [args.latestBatchId]);

  useEffect(() => {
    void loadFederationData();
  }, [loadFederationData]);

  const registerDiscoverySource = useCallback(async (draft: {
    sourceKey: string;
    sourceLabel: string;
    endpointUrl: string;
    discoveryScope: string;
    trustTier: string;
  }) => {
    if (federationBackendUnavailable || !canManageMirrorFederation) return;

    const sourceKey = draft.sourceKey.trim();
    const endpointUrl = draft.endpointUrl.trim();
    if (!sourceKey || !endpointUrl) {
      toast.error('Source key and endpoint URL are required.');
      return;
    }

    setRegisteringDiscoverySource(true);

    const { error } = await callUntypedRpc<string>('register_governance_public_audit_verifier_mirror_discovery_source', {
      source_key: sourceKey,
      source_label: draft.sourceLabel.trim() || null,
      endpoint_url: endpointUrl,
      discovery_scope: draft.discoveryScope.trim() || 'public_registry',
      trust_tier: draft.trustTier.trim() || 'observer',
      metadata: {
        source: 'governance_public_audit_verifier_panel',
      },
    });

    if (error) {
      console.error('Failed to register verifier mirror discovery source:', error);
      toast.error('Could not save discovery source.');
      setRegisteringDiscoverySource(false);
      return;
    }

    toast.success('Discovery source saved.');
    setRegisteringDiscoverySource(false);
    await loadFederationData();
  }, [canManageMirrorFederation, federationBackendUnavailable, loadFederationData]);

  const recordDiscoveryRun = useCallback(async (draft: {
    sourceId: string;
    runStatus: 'ok' | 'degraded' | 'failed';
    discoveredCount: string;
    acceptedCandidateCount: string;
    staleCandidateCount: string;
    errorMessage: string;
  }) => {
    if (federationBackendUnavailable || !canManageMirrorFederation) return;

    if (!draft.sourceId) {
      toast.error('Select a discovery source first.');
      return;
    }

    setRecordingDiscoveryRun(true);

    const { error } = await callUntypedRpc<string>('record_governance_public_audit_verifier_mirror_discovery_run', {
      target_source_id: draft.sourceId,
      target_batch_id: args.latestBatchId,
      run_status: draft.runStatus,
      discovered_count: asIntegerOrNull(draft.discoveredCount),
      accepted_candidate_count: asIntegerOrNull(draft.acceptedCandidateCount),
      stale_candidate_count: asIntegerOrNull(draft.staleCandidateCount),
      error_message: draft.errorMessage.trim() || null,
      run_payload: {
        source: 'governance_public_audit_verifier_panel',
      },
    });

    if (error) {
      console.error('Failed to record verifier mirror discovery run:', error);
      toast.error('Could not save discovery run.');
      setRecordingDiscoveryRun(false);
      return;
    }

    toast.success('Discovery run recorded.');
    setRecordingDiscoveryRun(false);
    await loadFederationData();
  }, [args.latestBatchId, canManageMirrorFederation, federationBackendUnavailable, loadFederationData]);

  const upsertDiscoveredCandidate = useCallback(async (draft: {
    sourceId: string;
    candidateKey: string;
    candidateLabel: string;
    endpointUrl: string;
    mirrorType: string;
    regionCode: string;
    jurisdictionCountryCode: string;
    operatorLabel: string;
    trustDomain: string;
    discoveryConfidence: string;
    candidateStatus: 'new' | 'reviewed' | 'promoted' | 'rejected' | 'inactive';
  }) => {
    if (federationBackendUnavailable || !canManageMirrorFederation) return;

    const candidateKey = draft.candidateKey.trim();
    const endpointUrl = draft.endpointUrl.trim();
    if (!draft.sourceId || !candidateKey || !endpointUrl) {
      toast.error('Source, candidate key, and endpoint URL are required.');
      return;
    }

    setUpsertingDiscoveredCandidate(true);

    const { error } = await callUntypedRpc<string>('upsert_governance_public_audit_verifier_mirror_discovered_candidate', {
      target_source_id: draft.sourceId,
      candidate_key: candidateKey,
      candidate_label: draft.candidateLabel.trim() || null,
      endpoint_url: endpointUrl,
      mirror_type: draft.mirrorType.trim() || 'https_gateway',
      region_code: draft.regionCode.trim().toUpperCase() || 'GLOBAL',
      jurisdiction_country_code: draft.jurisdictionCountryCode.trim().toUpperCase() || '',
      operator_label: draft.operatorLabel.trim() || 'unspecified',
      trust_domain: draft.trustDomain.trim().toLowerCase() || 'public',
      discovery_confidence: asNumericOrNull(draft.discoveryConfidence),
      candidate_status: draft.candidateStatus,
      run_id: null,
      metadata: {
        source: 'governance_public_audit_verifier_panel',
      },
    });

    if (error) {
      console.error('Failed to upsert verifier mirror discovered candidate:', error);
      toast.error('Could not save discovered candidate.');
      setUpsertingDiscoveredCandidate(false);
      return;
    }

    toast.success('Discovered candidate saved.');
    setUpsertingDiscoveredCandidate(false);
    await loadFederationData();
  }, [canManageMirrorFederation, federationBackendUnavailable, loadFederationData]);

  const promoteDiscoveredCandidate = useCallback(async (candidateId: string) => {
    if (federationBackendUnavailable || !canManageMirrorFederation) return;

    if (!candidateId) {
      toast.error('Select a discovered candidate first.');
      return;
    }

    setPromotingDiscoveredCandidate(true);

    const { error } = await callUntypedRpc<string>('promote_governance_public_audit_verifier_mirror_discovered_candidate', {
      target_candidate_id: candidateId,
      metadata: {
        source: 'governance_public_audit_verifier_panel',
      },
    });

    if (error) {
      console.error('Failed to promote verifier mirror discovered candidate:', error);
      toast.error('Could not promote discovered candidate.');
      setPromotingDiscoveredCandidate(false);
      return;
    }

    toast.success('Discovered candidate promoted to mirror registry.');
    setPromotingDiscoveredCandidate(false);
    await loadFederationData();
  }, [canManageMirrorFederation, federationBackendUnavailable, loadFederationData]);

  const recordPolicyRatification = useCallback(async (draft: {
    policyKey: string;
    signerKey: string;
    ratificationDecision: 'approve' | 'reject';
    ratificationSignature: string;
  }) => {
    if (federationBackendUnavailable || !canManageMirrorFederation) return;

    const signerKey = draft.signerKey.trim();
    const ratificationSignature = draft.ratificationSignature.trim();
    if (!signerKey || !ratificationSignature) {
      toast.error('Signer key and ratification signature are required.');
      return;
    }

    setSavingPolicyRatification(true);

    const { error } = await callUntypedRpc<string>('record_governance_public_audit_verifier_mirror_policy_ratification', {
      requested_policy_key: draft.policyKey.trim() || 'default',
      signer_key: signerKey,
      ratification_decision: draft.ratificationDecision,
      ratification_signature: ratificationSignature,
      ratification_payload: {
        source: 'governance_public_audit_verifier_panel',
      },
    });

    if (error) {
      console.error('Failed to save verifier mirror policy ratification:', error);
      toast.error('Could not save policy ratification.');
      setSavingPolicyRatification(false);
      return;
    }

    toast.success('Policy ratification saved.');
    setSavingPolicyRatification(false);
    await loadFederationData();
  }, [canManageMirrorFederation, federationBackendUnavailable, loadFederationData]);

  return {
    loadingFederationData,
    federationBackendUnavailable,
    canManageMirrorFederation,
    registeringDiscoverySource,
    recordingDiscoveryRun,
    upsertingDiscoveredCandidate,
    promotingDiscoveredCandidate,
    savingPolicyRatification,
    policyRatificationSummary,
    discoverySummary,
    discoverySources,
    discoveredCandidates,
    loadFederationData,
    registerDiscoverySource,
    recordDiscoveryRun,
    upsertDiscoveredCandidate,
    promoteDiscoveredCandidate,
    recordPolicyRatification,
  };
}
