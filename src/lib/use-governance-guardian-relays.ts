import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import {
  isMissingGuardianRelayBackend,
  readGovernanceProposalGuardianRelayAlertBoardRows,
  readGovernanceProposalGuardianRelayAttestationAuditRows,
  readGovernanceProposalGuardianRelayClientProofManifest,
  readGovernanceProposalGuardianRelayDiversityAudit,
  readGovernanceProposalGuardianRelayOperationsSummary,
  readGovernanceProposalGuardianRelayRecentClientManifestRows,
  readGovernanceProposalGuardianRelayRecentAuditRows,
  readGovernanceProposalGuardianRelaySummary,
  readGovernanceProposalGuardianRelayTrustMinimizedSummary,
  readGovernanceProposalGuardianRelayWorkerRunBoardRows,
  type GovernanceProposalGuardianRelayAlertBoardRow,
  type GovernanceProposalGuardianRelayAttestationAuditRow,
  type GovernanceProposalGuardianRelayClientProofManifest,
  type GovernanceProposalGuardianRelayDiversityAudit,
  type GovernanceProposalGuardianRelayOperationsSummary,
  type GovernanceProposalGuardianRelayRecentClientManifestRow,
  type GovernanceProposalGuardianRelayRecentAuditRow,
  type GovernanceProposalGuardianRelaySummary,
  type GovernanceProposalGuardianRelayTrustMinimizedSummary,
  type GovernanceProposalGuardianRelayWorkerRunBoardRow,
  type GuardianRelayAttestationRow,
  type GuardianRelayNodeRow,
  type GuardianRelayPolicyRow,
} from '@/lib/governance-guardian-relays';

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

export function useGovernanceGuardianRelays(args: { proposalId: string }) {
  const [loadingRelayData, setLoadingRelayData] = useState(true);
  const [relayBackendUnavailable, setRelayBackendUnavailable] = useState(false);
  const [canManageGuardianRelays, setCanManageGuardianRelays] = useState(false);
  const [registeringRelayNode, setRegisteringRelayNode] = useState(false);
  const [recordingRelayAttestation, setRecordingRelayAttestation] = useState(false);
  const [capturingRelayAuditReport, setCapturingRelayAuditReport] = useState(false);
  const [capturingRelayClientManifest, setCapturingRelayClientManifest] = useState(false);
  const [savingRelayOpsRequirement, setSavingRelayOpsRequirement] = useState(false);
  const [recordingRelayWorkerRun, setRecordingRelayWorkerRun] = useState(false);
  const [openingRelayAlert, setOpeningRelayAlert] = useState(false);
  const [resolvingRelayAlert, setResolvingRelayAlert] = useState(false);
  const [togglingRelayNodeId, setTogglingRelayNodeId] = useState<string | null>(null);

  const [relayPolicy, setRelayPolicy] = useState<GuardianRelayPolicyRow | null>(null);
  const [relayNodes, setRelayNodes] = useState<GuardianRelayNodeRow[]>([]);
  const [relayAttestations, setRelayAttestations] = useState<GuardianRelayAttestationRow[]>([]);
  const [relaySummary, setRelaySummary] = useState<GovernanceProposalGuardianRelaySummary | null>(null);
  const [relayTrustMinimizedSummary, setRelayTrustMinimizedSummary] = useState<GovernanceProposalGuardianRelayTrustMinimizedSummary | null>(null);
  const [relayOperationsSummary, setRelayOperationsSummary] = useState<GovernanceProposalGuardianRelayOperationsSummary | null>(null);
  const [relayClientProofManifest, setRelayClientProofManifest] = useState<GovernanceProposalGuardianRelayClientProofManifest | null>(null);
  const [relayDiversityAudit, setRelayDiversityAudit] = useState<GovernanceProposalGuardianRelayDiversityAudit | null>(null);
  const [relayAttestationAuditRows, setRelayAttestationAuditRows] = useState<GovernanceProposalGuardianRelayAttestationAuditRow[]>([]);
  const [relayRecentAuditReports, setRelayRecentAuditReports] = useState<GovernanceProposalGuardianRelayRecentAuditRow[]>([]);
  const [relayRecentClientManifests, setRelayRecentClientManifests] = useState<GovernanceProposalGuardianRelayRecentClientManifestRow[]>([]);
  const [relayAlertBoardRows, setRelayAlertBoardRows] = useState<GovernanceProposalGuardianRelayAlertBoardRow[]>([]);
  const [relayWorkerRunBoardRows, setRelayWorkerRunBoardRows] = useState<GovernanceProposalGuardianRelayWorkerRunBoardRow[]>([]);

  const loadRelayData = useCallback(async () => {
    setLoadingRelayData(true);

    const [
      policyResponse,
      nodesResponse,
      summaryResponse,
      attestationResponse,
      permissionResponse,
      diversityResponse,
      attestationAuditResponse,
      recentAuditsResponse,
      trustMinimizedSummaryResponse,
      operationsSummaryResponse,
      clientProofManifestResponse,
      recentClientManifestsResponse,
      alertBoardResponse,
      workerRunBoardResponse,
    ] = await Promise.all([
      supabase
        .from('governance_guardian_relay_policies')
        .select('*')
        .eq('policy_key', 'guardian_relay_default')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('governance_guardian_relay_nodes')
        .select('*')
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: true }),
      supabase.rpc('governance_proposal_guardian_relay_summary', {
        target_proposal_id: args.proposalId,
      }),
      supabase
        .from('governance_proposal_guardian_relay_attestations')
        .select('*')
        .eq('proposal_id', args.proposalId)
        .order('verified_at', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.rpc('current_profile_can_manage_guardian_relays'),
      callUntypedRpc<unknown[]>('governance_proposal_guardian_relay_diversity_audit', {
        target_proposal_id: args.proposalId,
      }),
      callUntypedRpc<unknown[]>('governance_proposal_guardian_relay_attestation_audit_report', {
        target_proposal_id: args.proposalId,
        requested_lookback_hours: 168,
      }),
      callUntypedRpc<unknown[]>('governance_proposal_guardian_relay_recent_audits', {
        target_proposal_id: args.proposalId,
        max_reports: 12,
      }),
      callUntypedRpc<unknown[]>('governance_proposal_guardian_relay_trust_minimized_summary', {
        target_proposal_id: args.proposalId,
      }),
      callUntypedRpc<unknown[]>('governance_proposal_guardian_relay_operations_summary', {
        target_proposal_id: args.proposalId,
        requested_policy_key: 'guardian_relay_default',
        requested_attestation_sla_minutes: null,
      }),
      callUntypedRpc<unknown[]>('governance_proposal_guardian_relay_client_proof_manifest', {
        target_proposal_id: args.proposalId,
      }),
      callUntypedRpc<unknown[]>('governance_proposal_guardian_relay_recent_client_manifests', {
        target_proposal_id: args.proposalId,
        max_manifests: 12,
      }),
      callUntypedRpc<unknown[]>('governance_proposal_guardian_relay_alert_board', {
        target_proposal_id: args.proposalId,
        status_filter: null,
        max_entries: 80,
      }),
      callUntypedRpc<unknown[]>('governance_proposal_guardian_relay_worker_run_board', {
        target_proposal_id: args.proposalId,
        max_entries: 80,
      }),
    ]);

    const sharedError =
      policyResponse.error
      || nodesResponse.error
      || summaryResponse.error
      || attestationResponse.error
      || permissionResponse.error
      || diversityResponse.error
      || attestationAuditResponse.error
      || recentAuditsResponse.error
      || trustMinimizedSummaryResponse.error
      || operationsSummaryResponse.error
      || clientProofManifestResponse.error
      || recentClientManifestsResponse.error
      || alertBoardResponse.error
      || workerRunBoardResponse.error;

    if (isMissingGuardianRelayBackend(sharedError)) {
      setRelayBackendUnavailable(true);
      setLoadingRelayData(false);
      return;
    }

    if (sharedError) {
      console.error('Failed to load guardian relay data:', {
        policyError: policyResponse.error,
        nodesError: nodesResponse.error,
        summaryError: summaryResponse.error,
        attestationError: attestationResponse.error,
        permissionError: permissionResponse.error,
        diversityError: diversityResponse.error,
        attestationAuditError: attestationAuditResponse.error,
        recentAuditsError: recentAuditsResponse.error,
        trustMinimizedSummaryError: trustMinimizedSummaryResponse.error,
        operationsSummaryError: operationsSummaryResponse.error,
        clientProofManifestError: clientProofManifestResponse.error,
        recentClientManifestsError: recentClientManifestsResponse.error,
        alertBoardError: alertBoardResponse.error,
        workerRunBoardError: workerRunBoardResponse.error,
      });
      toast.error('Could not load guardian relay data.');
      setLoadingRelayData(false);
      return;
    }

    setRelayPolicy((policyResponse.data as GuardianRelayPolicyRow | null) || null);
    setRelayNodes((nodesResponse.data as GuardianRelayNodeRow[]) || []);
    setRelayAttestations((attestationResponse.data as GuardianRelayAttestationRow[]) || []);
    setRelaySummary(readGovernanceProposalGuardianRelaySummary(summaryResponse.data));
    setRelayTrustMinimizedSummary(readGovernanceProposalGuardianRelayTrustMinimizedSummary(trustMinimizedSummaryResponse.data));
    setRelayOperationsSummary(readGovernanceProposalGuardianRelayOperationsSummary(operationsSummaryResponse.data));
    setRelayClientProofManifest(readGovernanceProposalGuardianRelayClientProofManifest(clientProofManifestResponse.data));
    setRelayDiversityAudit(readGovernanceProposalGuardianRelayDiversityAudit(diversityResponse.data));
    setRelayAttestationAuditRows(readGovernanceProposalGuardianRelayAttestationAuditRows(attestationAuditResponse.data));
    setRelayRecentAuditReports(readGovernanceProposalGuardianRelayRecentAuditRows(recentAuditsResponse.data));
    setRelayRecentClientManifests(readGovernanceProposalGuardianRelayRecentClientManifestRows(recentClientManifestsResponse.data));
    setRelayAlertBoardRows(readGovernanceProposalGuardianRelayAlertBoardRows(alertBoardResponse.data));
    setRelayWorkerRunBoardRows(readGovernanceProposalGuardianRelayWorkerRunBoardRows(workerRunBoardResponse.data));
    setCanManageGuardianRelays(Boolean(permissionResponse.data));
    setRelayBackendUnavailable(false);
    setLoadingRelayData(false);
  }, [args.proposalId]);

  useEffect(() => {
    void loadRelayData();
  }, [loadRelayData]);

  const registerRelayNode = useCallback(async (draft: {
    relayKey: string;
    relayLabel: string;
    endpointUrl: string;
    keyAlgorithm: string;
    relayRegionCode: string;
    relayInfrastructureProvider: string;
    relayOperatorLabel: string;
    relayOperatorUri: string;
    relayJurisdictionCountryCode: string;
    relayTrustDomain: string;
  }) => {
    if (relayBackendUnavailable || !canManageGuardianRelays) return;

    if (!draft.relayKey.trim()) {
      toast.error('Relay key is required.');
      return;
    }

    setRegisteringRelayNode(true);

    const { error } = await supabase.rpc('register_governance_guardian_relay_node', {
      relay_key: draft.relayKey.trim(),
      relay_label: draft.relayLabel.trim() || null,
      endpoint_url: draft.endpointUrl.trim() || null,
      key_algorithm: draft.keyAlgorithm.trim() || 'ECDSA_P256_SHA256_V1',
      metadata: {
        source: 'governance_guardian_relay_panel',
        relay_region_code: draft.relayRegionCode.trim().toUpperCase() || 'GLOBAL',
        relay_infrastructure_provider: draft.relayInfrastructureProvider.trim() || 'unspecified',
        relay_operator_label: draft.relayOperatorLabel.trim() || 'unspecified',
        relay_operator_uri: draft.relayOperatorUri.trim() || null,
        relay_jurisdiction_country_code: draft.relayJurisdictionCountryCode.trim().toUpperCase() || '',
        relay_trust_domain: draft.relayTrustDomain.trim().toLowerCase() || 'public',
      },
    });

    if (error) {
      console.error('Failed to register guardian relay node:', error);
      toast.error('Could not register guardian relay node.');
      setRegisteringRelayNode(false);
      return;
    }

    toast.success('Guardian relay node saved.');
    setRegisteringRelayNode(false);
    await loadRelayData();
  }, [canManageGuardianRelays, loadRelayData, relayBackendUnavailable]);

  const setRelayNodeActive = useCallback(async (relayNodeId: string, isActive: boolean) => {
    if (relayBackendUnavailable || !canManageGuardianRelays) return;

    setTogglingRelayNodeId(relayNodeId);

    const { error } = await supabase
      .from('governance_guardian_relay_nodes')
      .update({ is_active: isActive })
      .eq('id', relayNodeId);

    if (error) {
      console.error('Failed to update guardian relay node status:', { relayNodeId, error });
      toast.error('Could not update guardian relay node status.');
      setTogglingRelayNodeId(null);
      return;
    }

    toast.success(isActive ? 'Guardian relay node enabled.' : 'Guardian relay node disabled.');
    setTogglingRelayNodeId(null);
    await loadRelayData();
  }, [canManageGuardianRelays, loadRelayData, relayBackendUnavailable]);

  const recordRelayAttestation = useCallback(async (draft: {
    externalSignerId: string;
    relayId: string;
    decision: Database['public']['Enums']['governance_guardian_decision'];
    status: Database['public']['Enums']['governance_guardian_relay_attestation_status'];
    payloadHash: string;
    relayReference: string;
    chainNetwork: string;
    chainReference: string;
  }) => {
    if (relayBackendUnavailable || !canManageGuardianRelays) return;

    if (!draft.externalSignerId || !draft.relayId) {
      toast.error('External signer and relay node are required.');
      return;
    }

    setRecordingRelayAttestation(true);

    const { error } = await supabase.rpc('record_governance_guardian_relay_attestation', {
      target_proposal_id: args.proposalId,
      target_external_signer_id: draft.externalSignerId,
      target_relay_id: draft.relayId,
      attestation_decision: draft.decision,
      attestation_status: draft.status,
      attestation_payload_hash: draft.payloadHash.trim() || null,
      attestation_reference: draft.relayReference.trim() || null,
      attestation_chain_network: draft.chainNetwork.trim() || null,
      attestation_chain_reference: draft.chainReference.trim() || null,
      attestation_metadata: {
        source: 'governance_guardian_relay_panel',
      },
      verified_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Failed to record guardian relay attestation:', error);
      toast.error('Could not record guardian relay attestation.');
      setRecordingRelayAttestation(false);
      return;
    }

    toast.success('Guardian relay attestation recorded.');
    setRecordingRelayAttestation(false);
    await loadRelayData();
  }, [args.proposalId, canManageGuardianRelays, loadRelayData, relayBackendUnavailable]);

  const captureRelayAuditReport = useCallback(async (auditNotes: string) => {
    if (relayBackendUnavailable || !canManageGuardianRelays) return;

    setCapturingRelayAuditReport(true);

    const { error } = await callUntypedRpc<unknown>('capture_governance_guardian_relay_audit_report', {
      target_proposal_id: args.proposalId,
      audit_notes: auditNotes.trim() || null,
      audit_metadata: {
        source: 'governance_guardian_relay_panel',
      },
    });

    if (error) {
      console.error('Failed to capture guardian relay audit report:', error);
      toast.error('Could not capture guardian relay audit report.');
      setCapturingRelayAuditReport(false);
      return;
    }

    toast.success('Guardian relay audit report captured.');
    setCapturingRelayAuditReport(false);
    await loadRelayData();
  }, [args.proposalId, canManageGuardianRelays, loadRelayData, relayBackendUnavailable]);

  const captureRelayClientManifest = useCallback(async (manifestNotes: string) => {
    if (relayBackendUnavailable || !canManageGuardianRelays) return;

    setCapturingRelayClientManifest(true);

    const { error } = await callUntypedRpc<string>('capture_governance_proposal_guardian_relay_client_manifest', {
      target_proposal_id: args.proposalId,
      manifest_notes: manifestNotes.trim() || null,
      manifest_metadata: {
        source: 'governance_guardian_relay_panel',
      },
    });

    if (error) {
      console.error('Failed to capture guardian relay client manifest:', error);
      toast.error('Could not capture guardian relay client manifest.');
      setCapturingRelayClientManifest(false);
      return;
    }

    toast.success('Guardian relay client manifest captured.');
    setCapturingRelayClientManifest(false);
    await loadRelayData();
  }, [args.proposalId, canManageGuardianRelays, loadRelayData, relayBackendUnavailable]);

  const saveRelayOpsRequirement = useCallback(async (draft: {
    requireTrustMinimizedQuorum: boolean;
    requireRelayOpsReadiness: boolean;
    maxOpenCriticalRelayAlerts: string;
    relayAttestationSlaMinutes: string;
  }) => {
    if (relayBackendUnavailable || !canManageGuardianRelays) return;

    setSavingRelayOpsRequirement(true);

    const { error } = await callUntypedRpc<string>('set_governance_guardian_relay_ops_requirement', {
      requested_policy_key: 'guardian_relay_default',
      requested_require_trust_minimized_quorum: draft.requireTrustMinimizedQuorum,
      requested_require_relay_ops_readiness: draft.requireRelayOpsReadiness,
      requested_max_open_critical_relay_alerts: asIntegerOrNull(draft.maxOpenCriticalRelayAlerts),
      requested_relay_attestation_sla_minutes: asIntegerOrNull(draft.relayAttestationSlaMinutes),
    });

    if (error) {
      console.error('Failed to save guardian relay operations requirement:', error);
      toast.error('Could not save relay operations requirement.');
      setSavingRelayOpsRequirement(false);
      return;
    }

    toast.success('Guardian relay operations requirement saved.');
    setSavingRelayOpsRequirement(false);
    await loadRelayData();
  }, [canManageGuardianRelays, loadRelayData, relayBackendUnavailable]);

  const recordRelayWorkerRun = useCallback(async (draft: {
    runScope: 'attestation_sweep' | 'diversity_audit' | 'manifest_capture' | 'manual';
    runStatus: 'ok' | 'degraded' | 'failed';
    processedSignerCount: string;
    staleSignerCount: string;
    openAlertCount: string;
    errorMessage: string;
  }) => {
    if (relayBackendUnavailable || !canManageGuardianRelays) return;

    setRecordingRelayWorkerRun(true);

    const { error } = await callUntypedRpc<string>('record_governance_guardian_relay_worker_run', {
      target_proposal_id: args.proposalId,
      run_scope: draft.runScope,
      run_status: draft.runStatus,
      processed_signer_count: asIntegerOrNull(draft.processedSignerCount),
      stale_signer_count: asIntegerOrNull(draft.staleSignerCount),
      open_alert_count: asIntegerOrNull(draft.openAlertCount),
      error_message: draft.errorMessage.trim() || null,
      run_payload: {
        source: 'governance_guardian_relay_panel',
      },
    });

    if (error) {
      console.error('Failed to record guardian relay worker run:', error);
      toast.error('Could not record relay worker run.');
      setRecordingRelayWorkerRun(false);
      return;
    }

    toast.success('Guardian relay worker run recorded.');
    setRecordingRelayWorkerRun(false);
    await loadRelayData();
  }, [args.proposalId, canManageGuardianRelays, loadRelayData, relayBackendUnavailable]);

  const openRelayAlert = useCallback(async (draft: {
    alertKey: string;
    severity: 'info' | 'warning' | 'critical';
    alertScope: string;
    alertMessage: string;
  }) => {
    if (relayBackendUnavailable || !canManageGuardianRelays) return;

    const alertKey = draft.alertKey.trim();
    const alertMessage = draft.alertMessage.trim();
    if (!alertKey || !alertMessage) {
      toast.error('Alert key and message are required.');
      return;
    }

    setOpeningRelayAlert(true);

    const { error } = await callUntypedRpc<string>('open_governance_guardian_relay_alert', {
      target_proposal_id: args.proposalId,
      alert_key: alertKey,
      severity: draft.severity,
      alert_scope: draft.alertScope.trim() || 'manual',
      alert_message: alertMessage,
      metadata: {
        source: 'governance_guardian_relay_panel',
      },
    });

    if (error) {
      console.error('Failed to open guardian relay alert:', error);
      toast.error('Could not open relay alert.');
      setOpeningRelayAlert(false);
      return;
    }

    toast.success('Guardian relay alert opened.');
    setOpeningRelayAlert(false);
    await loadRelayData();
  }, [args.proposalId, canManageGuardianRelays, loadRelayData, relayBackendUnavailable]);

  const resolveRelayAlert = useCallback(async (draft: {
    alertId: string;
    resolutionNotes: string;
  }) => {
    if (relayBackendUnavailable || !canManageGuardianRelays) return;

    if (!draft.alertId) {
      toast.error('Select an alert first.');
      return;
    }

    setResolvingRelayAlert(true);

    const { error } = await callUntypedRpc<string>('resolve_governance_guardian_relay_alert', {
      target_alert_id: draft.alertId,
      resolution_notes: draft.resolutionNotes.trim() || null,
    });

    if (error) {
      console.error('Failed to resolve guardian relay alert:', error);
      toast.error('Could not resolve relay alert.');
      setResolvingRelayAlert(false);
      return;
    }

    toast.success('Guardian relay alert resolved.');
    setResolvingRelayAlert(false);
    await loadRelayData();
  }, [canManageGuardianRelays, loadRelayData, relayBackendUnavailable]);

  return {
    loadingRelayData,
    relayBackendUnavailable,
    canManageGuardianRelays,
    registeringRelayNode,
    recordingRelayAttestation,
    capturingRelayAuditReport,
    capturingRelayClientManifest,
    savingRelayOpsRequirement,
    recordingRelayWorkerRun,
    openingRelayAlert,
    resolvingRelayAlert,
    togglingRelayNodeId,
    relayPolicy,
    relayNodes,
    relayAttestations,
    relaySummary,
    relayTrustMinimizedSummary,
    relayOperationsSummary,
    relayClientProofManifest,
    relayDiversityAudit,
    relayAttestationAuditRows,
    relayRecentAuditReports,
    relayRecentClientManifests,
    relayAlertBoardRows,
    relayWorkerRunBoardRows,
    loadRelayData,
    registerRelayNode,
    setRelayNodeActive,
    recordRelayAttestation,
    captureRelayAuditReport,
    captureRelayClientManifest,
    saveRelayOpsRequirement,
    recordRelayWorkerRun,
    openRelayAlert,
    resolveRelayAlert,
  };
}
