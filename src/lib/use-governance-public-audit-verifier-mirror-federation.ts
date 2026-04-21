import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import {
  isMissingPublicAuditVerifierBackend,
  readGovernancePublicAuditVerifierMirrorDiscoveredCandidateBoardRows,
  readGovernancePublicAuditVerifierMirrorDiscoverySourceBoardRows,
  readGovernancePublicAuditVerifierMirrorDiscoverySummary,
  readGovernancePublicAuditVerifierMirrorFederationAlertBoardRows,
  readGovernancePublicAuditVerifierMirrorFederationOnboardingBoardRows,
  readGovernancePublicAuditVerifierMirrorFederationOperationsSummary,
  readGovernancePublicAuditVerifierMirrorPolicyRatificationSummary,
  type GovernancePublicAuditVerifierMirrorDiscoveredCandidateBoardRow,
  type GovernancePublicAuditVerifierMirrorDiscoverySourceBoardRow,
  type GovernancePublicAuditVerifierMirrorDiscoverySummary,
  type GovernancePublicAuditVerifierMirrorFederationAlertBoardRow,
  type GovernancePublicAuditVerifierMirrorFederationOnboardingBoardRow,
  type GovernancePublicAuditVerifierMirrorFederationOperationsSummary,
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
  const [savingFederationOpsRequirement, setSavingFederationOpsRequirement] = useState(false);
  const [registeringFederationOperator, setRegisteringFederationOperator] = useState(false);
  const [submittingOnboardingRequest, setSubmittingOnboardingRequest] = useState(false);
  const [reviewingOnboardingRequest, setReviewingOnboardingRequest] = useState(false);
  const [onboardingFederationRequest, setOnboardingFederationRequest] = useState(false);
  const [recordingFederationWorkerRun, setRecordingFederationWorkerRun] = useState(false);
  const [openingFederationAlert, setOpeningFederationAlert] = useState(false);
  const [resolvingFederationAlert, setResolvingFederationAlert] = useState(false);

  const [policyRatificationSummary, setPolicyRatificationSummary] =
    useState<GovernancePublicAuditVerifierMirrorPolicyRatificationSummary | null>(null);
  const [discoverySummary, setDiscoverySummary] = useState<GovernancePublicAuditVerifierMirrorDiscoverySummary | null>(null);
  const [federationOperationsSummary, setFederationOperationsSummary] =
    useState<GovernancePublicAuditVerifierMirrorFederationOperationsSummary | null>(null);
  const [discoverySources, setDiscoverySources] = useState<GovernancePublicAuditVerifierMirrorDiscoverySourceBoardRow[]>([]);
  const [discoveredCandidates, setDiscoveredCandidates] = useState<GovernancePublicAuditVerifierMirrorDiscoveredCandidateBoardRow[]>([]);
  const [federationOnboardingBoard, setFederationOnboardingBoard] =
    useState<GovernancePublicAuditVerifierMirrorFederationOnboardingBoardRow[]>([]);
  const [federationAlertBoard, setFederationAlertBoard] =
    useState<GovernancePublicAuditVerifierMirrorFederationAlertBoardRow[]>([]);

  const loadFederationData = useCallback(async () => {
    setLoadingFederationData(true);

    const [
      permissionResponse,
      ratificationSummaryResponse,
      discoverySummaryResponse,
      discoverySourcesResponse,
      discoveredCandidatesResponse,
      operationsSummaryResponse,
      onboardingBoardResponse,
      alertBoardResponse,
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
      callUntypedRpc<unknown[]>('governance_public_audit_verifier_mirror_federation_operations_summary', {
        requested_policy_key: 'default',
        requested_lookback_hours: 24,
        requested_alert_sla_hours: 12,
      }),
      callUntypedRpc<unknown[]>('governance_public_audit_verifier_mirror_federation_onboarding_board', {
        status_filter: null,
        max_entries: 80,
      }),
      callUntypedRpc<unknown[]>('governance_public_audit_verifier_mirror_federation_alert_board', {
        status_filter: null,
        max_entries: 80,
      }),
    ]);

    const sharedError = permissionResponse.error
      || ratificationSummaryResponse.error
      || discoverySummaryResponse.error
      || discoverySourcesResponse.error
      || discoveredCandidatesResponse.error
      || operationsSummaryResponse.error
      || onboardingBoardResponse.error
      || alertBoardResponse.error;

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
        operationsSummaryError: operationsSummaryResponse.error,
        onboardingBoardError: onboardingBoardResponse.error,
        alertBoardError: alertBoardResponse.error,
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
    setFederationOperationsSummary(readGovernancePublicAuditVerifierMirrorFederationOperationsSummary(operationsSummaryResponse.data));
    setFederationOnboardingBoard(readGovernancePublicAuditVerifierMirrorFederationOnboardingBoardRows(onboardingBoardResponse.data));
    setFederationAlertBoard(readGovernancePublicAuditVerifierMirrorFederationAlertBoardRows(alertBoardResponse.data));
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

  const saveFederationOpsRequirement = useCallback(async (draft: {
    requireFederationOpsReadiness: boolean;
    maxOpenCriticalAlerts: string;
    minOnboardedOperators: string;
  }) => {
    if (federationBackendUnavailable || !canManageMirrorFederation) return;

    setSavingFederationOpsRequirement(true);

    const { error } = await callUntypedRpc<string>('set_governance_public_audit_verifier_mirror_federation_ops_requirement', {
      requested_policy_key: 'default',
      requested_require_federation_ops_readiness: draft.requireFederationOpsReadiness,
      max_open_critical_alerts: asIntegerOrNull(draft.maxOpenCriticalAlerts),
      min_onboarded_operators: asIntegerOrNull(draft.minOnboardedOperators),
    });

    if (error) {
      console.error('Failed to save federation operations requirement:', error);
      toast.error('Could not save federation operations requirement.');
      setSavingFederationOpsRequirement(false);
      return;
    }

    toast.success('Federation operations requirement saved.');
    setSavingFederationOpsRequirement(false);
    await loadFederationData();
  }, [canManageMirrorFederation, federationBackendUnavailable, loadFederationData]);

  const registerFederationOperator = useCallback(async (draft: {
    operatorKey: string;
    operatorLabel: string;
    contactEndpoint: string;
    jurisdictionCountryCode: string;
    trustDomain: string;
  }) => {
    if (federationBackendUnavailable || !canManageMirrorFederation) return;

    const operatorKey = draft.operatorKey.trim();
    if (!operatorKey) {
      toast.error('Operator key is required.');
      return;
    }

    setRegisteringFederationOperator(true);

    const { error } = await callUntypedRpc<string>('register_governance_public_audit_verifier_mirror_federation_operator', {
      operator_key: operatorKey,
      operator_label: draft.operatorLabel.trim() || null,
      contact_endpoint: draft.contactEndpoint.trim() || null,
      jurisdiction_country_code: draft.jurisdictionCountryCode.trim().toUpperCase() || '',
      trust_domain: draft.trustDomain.trim().toLowerCase() || 'public',
      metadata: {
        source: 'governance_public_audit_verifier_panel',
      },
    });

    if (error) {
      console.error('Failed to register federation operator:', error);
      toast.error('Could not save federation operator.');
      setRegisteringFederationOperator(false);
      return;
    }

    toast.success('Federation operator saved.');
    setRegisteringFederationOperator(false);
    await loadFederationData();
  }, [canManageMirrorFederation, federationBackendUnavailable, loadFederationData]);

  const submitFederationOnboardingRequest = useCallback(async (draft: {
    operatorKey: string;
    requestedMirrorKey: string;
    requestedMirrorLabel: string;
    requestedEndpointUrl: string;
    requestedMirrorType: string;
    requestedRegionCode: string;
    requestedJurisdictionCountryCode: string;
    requestedTrustDomain: string;
  }) => {
    if (federationBackendUnavailable || !canManageMirrorFederation) return;

    const operatorKey = draft.operatorKey.trim();
    const requestedMirrorKey = draft.requestedMirrorKey.trim();
    const requestedEndpointUrl = draft.requestedEndpointUrl.trim();
    if (!operatorKey || !requestedMirrorKey || !requestedEndpointUrl) {
      toast.error('Operator key, mirror key, and endpoint URL are required.');
      return;
    }

    setSubmittingOnboardingRequest(true);

    const { error } = await callUntypedRpc<string>('submit_governance_public_audit_verifier_mirror_federation_onboarding_request', {
      operator_key: operatorKey,
      requested_mirror_key: requestedMirrorKey,
      requested_mirror_label: draft.requestedMirrorLabel.trim() || null,
      requested_endpoint_url: requestedEndpointUrl,
      requested_mirror_type: draft.requestedMirrorType.trim() || 'https_gateway',
      requested_region_code: draft.requestedRegionCode.trim().toUpperCase() || 'GLOBAL',
      requested_jurisdiction_country_code: draft.requestedJurisdictionCountryCode.trim().toUpperCase() || '',
      requested_trust_domain: draft.requestedTrustDomain.trim().toLowerCase() || 'public',
      metadata: {
        source: 'governance_public_audit_verifier_panel',
      },
    });

    if (error) {
      console.error('Failed to submit federation onboarding request:', error);
      toast.error('Could not submit onboarding request.');
      setSubmittingOnboardingRequest(false);
      return;
    }

    toast.success('Federation onboarding request submitted.');
    setSubmittingOnboardingRequest(false);
    await loadFederationData();
  }, [canManageMirrorFederation, federationBackendUnavailable, loadFederationData]);

  const reviewFederationOnboardingRequest = useCallback(async (draft: {
    requestId: string;
    reviewDecision: 'approve' | 'reject';
    reviewNotes: string;
  }) => {
    if (federationBackendUnavailable || !canManageMirrorFederation) return;

    if (!draft.requestId) {
      toast.error('Select an onboarding request first.');
      return;
    }

    setReviewingOnboardingRequest(true);

    const { error } = await callUntypedRpc<string>('review_governance_public_audit_verifier_mirror_federation_onboarding_request', {
      target_request_id: draft.requestId,
      review_decision: draft.reviewDecision,
      requested_review_notes: draft.reviewNotes.trim() || null,
    });

    if (error) {
      console.error('Failed to review federation onboarding request:', error);
      toast.error('Could not review onboarding request.');
      setReviewingOnboardingRequest(false);
      return;
    }

    toast.success('Federation onboarding request reviewed.');
    setReviewingOnboardingRequest(false);
    await loadFederationData();
  }, [canManageMirrorFederation, federationBackendUnavailable, loadFederationData]);

  const onboardFederationRequest = useCallback(async (draft: {
    requestId: string;
    activateMirror: boolean;
  }) => {
    if (federationBackendUnavailable || !canManageMirrorFederation) return;

    if (!draft.requestId) {
      toast.error('Select an approved onboarding request first.');
      return;
    }

    setOnboardingFederationRequest(true);

    const { error } = await callUntypedRpc<string>('onboard_governance_public_audit_verifier_mirror_federation_request', {
      target_request_id: draft.requestId,
      activate_mirror: draft.activateMirror,
      requested_metadata: {
        source: 'governance_public_audit_verifier_panel',
      },
    });

    if (error) {
      console.error('Failed to onboard federation request:', error);
      toast.error('Could not onboard request.');
      setOnboardingFederationRequest(false);
      return;
    }

    toast.success('Federation onboarding request onboarded.');
    setOnboardingFederationRequest(false);
    await loadFederationData();
  }, [canManageMirrorFederation, federationBackendUnavailable, loadFederationData]);

  const recordFederationWorkerRun = useCallback(async (draft: {
    runScope: 'onboarding_sweep' | 'operator_health_audit' | 'diversity_audit' | 'manual';
    runStatus: 'ok' | 'degraded' | 'failed';
    discoveredRequestCount: string;
    approvedRequestCount: string;
    onboardedRequestCount: string;
    openAlertCount: string;
    errorMessage: string;
  }) => {
    if (federationBackendUnavailable || !canManageMirrorFederation) return;

    setRecordingFederationWorkerRun(true);

    const { error } = await callUntypedRpc<string>('record_governance_public_audit_verifier_mirror_federation_worker_run', {
      run_scope: draft.runScope,
      run_status: draft.runStatus,
      discovered_request_count: asIntegerOrNull(draft.discoveredRequestCount),
      approved_request_count: asIntegerOrNull(draft.approvedRequestCount),
      onboarded_request_count: asIntegerOrNull(draft.onboardedRequestCount),
      open_alert_count: asIntegerOrNull(draft.openAlertCount),
      error_message: draft.errorMessage.trim() || null,
      run_payload: {
        source: 'governance_public_audit_verifier_panel',
      },
    });

    if (error) {
      console.error('Failed to record federation worker run:', error);
      toast.error('Could not record federation worker run.');
      setRecordingFederationWorkerRun(false);
      return;
    }

    toast.success('Federation worker run recorded.');
    setRecordingFederationWorkerRun(false);
    await loadFederationData();
  }, [canManageMirrorFederation, federationBackendUnavailable, loadFederationData]);

  const openFederationAlert = useCallback(async (draft: {
    alertKey: string;
    severity: 'info' | 'warning' | 'critical';
    alertScope: string;
    alertMessage: string;
  }) => {
    if (federationBackendUnavailable || !canManageMirrorFederation) return;

    const alertKey = draft.alertKey.trim();
    const alertMessage = draft.alertMessage.trim();
    if (!alertKey || !alertMessage) {
      toast.error('Alert key and alert message are required.');
      return;
    }

    setOpeningFederationAlert(true);

    const { error } = await callUntypedRpc<string>('open_governance_public_audit_verifier_mirror_federation_alert', {
      alert_key: alertKey,
      severity: draft.severity,
      alert_scope: draft.alertScope.trim() || 'manual',
      alert_message: alertMessage,
      metadata: {
        source: 'governance_public_audit_verifier_panel',
      },
    });

    if (error) {
      console.error('Failed to open federation alert:', error);
      toast.error('Could not open federation alert.');
      setOpeningFederationAlert(false);
      return;
    }

    toast.success('Federation alert opened.');
    setOpeningFederationAlert(false);
    await loadFederationData();
  }, [canManageMirrorFederation, federationBackendUnavailable, loadFederationData]);

  const resolveFederationAlert = useCallback(async (draft: {
    alertId: string;
    resolutionNotes: string;
  }) => {
    if (federationBackendUnavailable || !canManageMirrorFederation) return;

    if (!draft.alertId) {
      toast.error('Select an alert first.');
      return;
    }

    setResolvingFederationAlert(true);

    const { error } = await callUntypedRpc<string>('resolve_governance_public_audit_verifier_mirror_federation_alert', {
      target_alert_id: draft.alertId,
      resolution_notes: draft.resolutionNotes.trim() || null,
    });

    if (error) {
      console.error('Failed to resolve federation alert:', error);
      toast.error('Could not resolve federation alert.');
      setResolvingFederationAlert(false);
      return;
    }

    toast.success('Federation alert resolved.');
    setResolvingFederationAlert(false);
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
    savingFederationOpsRequirement,
    registeringFederationOperator,
    submittingOnboardingRequest,
    reviewingOnboardingRequest,
    onboardingFederationRequest,
    recordingFederationWorkerRun,
    openingFederationAlert,
    resolvingFederationAlert,
    policyRatificationSummary,
    discoverySummary,
    federationOperationsSummary,
    discoverySources,
    discoveredCandidates,
    federationOnboardingBoard,
    federationAlertBoard,
    loadFederationData,
    registerDiscoverySource,
    recordDiscoveryRun,
    upsertDiscoveredCandidate,
    promoteDiscoveredCandidate,
    recordPolicyRatification,
    saveFederationOpsRequirement,
    registerFederationOperator,
    submitFederationOnboardingRequest,
    reviewFederationOnboardingRequest,
    onboardFederationRequest,
    recordFederationWorkerRun,
    openFederationAlert,
    resolveFederationAlert,
  };
}
