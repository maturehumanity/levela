import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import {
  isMissingGuardianRelayBackend,
  readGovernanceProposalGuardianRelayAttestationAuditRows,
  readGovernanceProposalGuardianRelayClientProofManifest,
  readGovernanceProposalGuardianRelayDiversityAudit,
  readGovernanceProposalGuardianRelayRecentClientManifestRows,
  readGovernanceProposalGuardianRelayRecentAuditRows,
  readGovernanceProposalGuardianRelaySummary,
  readGovernanceProposalGuardianRelayTrustMinimizedSummary,
  type GovernanceProposalGuardianRelayAttestationAuditRow,
  type GovernanceProposalGuardianRelayClientProofManifest,
  type GovernanceProposalGuardianRelayDiversityAudit,
  type GovernanceProposalGuardianRelayRecentClientManifestRow,
  type GovernanceProposalGuardianRelayRecentAuditRow,
  type GovernanceProposalGuardianRelaySummary,
  type GovernanceProposalGuardianRelayTrustMinimizedSummary,
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

export function useGovernanceGuardianRelays(args: { proposalId: string }) {
  const [loadingRelayData, setLoadingRelayData] = useState(true);
  const [relayBackendUnavailable, setRelayBackendUnavailable] = useState(false);
  const [canManageGuardianRelays, setCanManageGuardianRelays] = useState(false);
  const [registeringRelayNode, setRegisteringRelayNode] = useState(false);
  const [recordingRelayAttestation, setRecordingRelayAttestation] = useState(false);
  const [capturingRelayAuditReport, setCapturingRelayAuditReport] = useState(false);
  const [capturingRelayClientManifest, setCapturingRelayClientManifest] = useState(false);
  const [togglingRelayNodeId, setTogglingRelayNodeId] = useState<string | null>(null);

  const [relayPolicy, setRelayPolicy] = useState<GuardianRelayPolicyRow | null>(null);
  const [relayNodes, setRelayNodes] = useState<GuardianRelayNodeRow[]>([]);
  const [relayAttestations, setRelayAttestations] = useState<GuardianRelayAttestationRow[]>([]);
  const [relaySummary, setRelaySummary] = useState<GovernanceProposalGuardianRelaySummary | null>(null);
  const [relayTrustMinimizedSummary, setRelayTrustMinimizedSummary] = useState<GovernanceProposalGuardianRelayTrustMinimizedSummary | null>(null);
  const [relayClientProofManifest, setRelayClientProofManifest] = useState<GovernanceProposalGuardianRelayClientProofManifest | null>(null);
  const [relayDiversityAudit, setRelayDiversityAudit] = useState<GovernanceProposalGuardianRelayDiversityAudit | null>(null);
  const [relayAttestationAuditRows, setRelayAttestationAuditRows] = useState<GovernanceProposalGuardianRelayAttestationAuditRow[]>([]);
  const [relayRecentAuditReports, setRelayRecentAuditReports] = useState<GovernanceProposalGuardianRelayRecentAuditRow[]>([]);
  const [relayRecentClientManifests, setRelayRecentClientManifests] = useState<GovernanceProposalGuardianRelayRecentClientManifestRow[]>([]);

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
      clientProofManifestResponse,
      recentClientManifestsResponse,
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
      callUntypedRpc<unknown[]>('governance_proposal_guardian_relay_client_proof_manifest', {
        target_proposal_id: args.proposalId,
      }),
      callUntypedRpc<unknown[]>('governance_proposal_guardian_relay_recent_client_manifests', {
        target_proposal_id: args.proposalId,
        max_manifests: 12,
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
      || clientProofManifestResponse.error
      || recentClientManifestsResponse.error;

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
        clientProofManifestError: clientProofManifestResponse.error,
        recentClientManifestsError: recentClientManifestsResponse.error,
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
    setRelayClientProofManifest(readGovernanceProposalGuardianRelayClientProofManifest(clientProofManifestResponse.data));
    setRelayDiversityAudit(readGovernanceProposalGuardianRelayDiversityAudit(diversityResponse.data));
    setRelayAttestationAuditRows(readGovernanceProposalGuardianRelayAttestationAuditRows(attestationAuditResponse.data));
    setRelayRecentAuditReports(readGovernanceProposalGuardianRelayRecentAuditRows(recentAuditsResponse.data));
    setRelayRecentClientManifests(readGovernanceProposalGuardianRelayRecentClientManifestRows(recentClientManifestsResponse.data));
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

  return {
    loadingRelayData,
    relayBackendUnavailable,
    canManageGuardianRelays,
    registeringRelayNode,
    recordingRelayAttestation,
    capturingRelayAuditReport,
    capturingRelayClientManifest,
    togglingRelayNodeId,
    relayPolicy,
    relayNodes,
    relayAttestations,
    relaySummary,
    relayTrustMinimizedSummary,
    relayClientProofManifest,
    relayDiversityAudit,
    relayAttestationAuditRows,
    relayRecentAuditReports,
    relayRecentClientManifests,
    loadRelayData,
    registerRelayNode,
    setRelayNodeActive,
    recordRelayAttestation,
    captureRelayAuditReport,
    captureRelayClientManifest,
  };
}
