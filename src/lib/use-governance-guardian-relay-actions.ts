import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { asIntegerOrNull, callUntypedRpc } from '@/lib/governance-rpc';
import { useGovernanceGuardianRelayDistributionActions } from '@/lib/use-governance-guardian-relay-distribution-actions';

interface UseGovernanceGuardianRelayActionsArgs {
  proposalId: string;
  canManageGuardianRelays: boolean;
  relayBackendUnavailable: boolean;
  loadRelayData: () => Promise<void>;
}

export function useGovernanceGuardianRelayActions({
  proposalId,
  canManageGuardianRelays,
  relayBackendUnavailable,
  loadRelayData,
}: UseGovernanceGuardianRelayActionsArgs) {
  const [registeringRelayNode, setRegisteringRelayNode] = useState(false);
  const [recordingRelayAttestation, setRecordingRelayAttestation] = useState(false);
  const [capturingRelayAuditReport, setCapturingRelayAuditReport] = useState(false);
  const [capturingRelayClientManifest, setCapturingRelayClientManifest] = useState(false);
  const [savingRelayOpsRequirement, setSavingRelayOpsRequirement] = useState(false);
  const [recordingRelayWorkerRun, setRecordingRelayWorkerRun] = useState(false);
  const [openingRelayAlert, setOpeningRelayAlert] = useState(false);
  const [resolvingRelayAlert, setResolvingRelayAlert] = useState(false);
  const [togglingRelayNodeId, setTogglingRelayNodeId] = useState<string | null>(null);

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
      target_proposal_id: proposalId,
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
  }, [canManageGuardianRelays, loadRelayData, proposalId, relayBackendUnavailable]);

  const captureRelayAuditReport = useCallback(async (auditNotes: string) => {
    if (relayBackendUnavailable || !canManageGuardianRelays) return;

    setCapturingRelayAuditReport(true);

    const { error } = await callUntypedRpc<unknown>('capture_governance_guardian_relay_audit_report', {
      target_proposal_id: proposalId,
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
  }, [canManageGuardianRelays, loadRelayData, proposalId, relayBackendUnavailable]);

  const captureRelayClientManifest = useCallback(async (manifestNotes: string) => {
    if (relayBackendUnavailable || !canManageGuardianRelays) return;

    setCapturingRelayClientManifest(true);

    const { error } = await callUntypedRpc<string>('capture_governance_proposal_guardian_relay_client_manifest', {
      target_proposal_id: proposalId,
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
  }, [canManageGuardianRelays, loadRelayData, proposalId, relayBackendUnavailable]);

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
      target_proposal_id: proposalId,
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
  }, [canManageGuardianRelays, loadRelayData, proposalId, relayBackendUnavailable]);

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
      target_proposal_id: proposalId,
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
  }, [canManageGuardianRelays, loadRelayData, proposalId, relayBackendUnavailable]);

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

  const distributionActions = useGovernanceGuardianRelayDistributionActions({
    proposalId,
    canManageGuardianRelays,
    relayBackendUnavailable,
    loadRelayData,
  });

  return {
    registeringRelayNode,
    recordingRelayAttestation,
    capturingRelayAuditReport,
    capturingRelayClientManifest,
    savingRelayOpsRequirement,
    recordingRelayWorkerRun,
    openingRelayAlert,
    resolvingRelayAlert,
    togglingRelayNodeId,
    registerRelayNode,
    setRelayNodeActive,
    recordRelayAttestation,
    captureRelayAuditReport,
    captureRelayClientManifest,
    saveRelayOpsRequirement,
    recordRelayWorkerRun,
    openRelayAlert,
    resolveRelayAlert,
    ...distributionActions,
  };
}
