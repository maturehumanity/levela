import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import {
  isMissingPublicAuditVerifierBackend,
  readGovernancePublicAuditVerifierSummary,
  type GovernancePublicAuditBatchVerificationRow,
  type GovernancePublicAuditNetworkProofRow,
  type GovernancePublicAuditReplicationPolicyRow,
  type GovernancePublicAuditVerifierNodeRow,
  type GovernancePublicAuditVerifierSummary,
} from '@/lib/governance-public-audit-verifiers';

export function useGovernancePublicAuditVerifiers(args: { latestBatchId: string | null }) {
  const [loadingVerifierData, setLoadingVerifierData] = useState(true);
  const [verifierBackendUnavailable, setVerifierBackendUnavailable] = useState(false);
  const [refreshingVerifierData, setRefreshingVerifierData] = useState(false);
  const [addingVerifierNode, setAddingVerifierNode] = useState(false);
  const [recordingBatchVerification, setRecordingBatchVerification] = useState(false);
  const [recordingNetworkProof, setRecordingNetworkProof] = useState(false);
  const [togglingVerifierId, setTogglingVerifierId] = useState<string | null>(null);

  const [replicationPolicy, setReplicationPolicy] = useState<GovernancePublicAuditReplicationPolicyRow | null>(null);
  const [verifierNodes, setVerifierNodes] = useState<GovernancePublicAuditVerifierNodeRow[]>([]);
  const [batchVerifications, setBatchVerifications] = useState<GovernancePublicAuditBatchVerificationRow[]>([]);
  const [networkProofs, setNetworkProofs] = useState<GovernancePublicAuditNetworkProofRow[]>([]);
  const [verifierSummary, setVerifierSummary] = useState<GovernancePublicAuditVerifierSummary | null>(null);

  const loadVerifierData = useCallback(async () => {
    setLoadingVerifierData(true);

    const baseRequests = await Promise.all([
      supabase
        .from('governance_public_audit_replication_policies')
        .select('*')
        .eq('policy_key', 'public_audit_replication_default')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('governance_public_audit_verifier_nodes')
        .select('*')
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: true }),
    ]);

    const [policyResponse, nodesResponse] = baseRequests;

    const scopedRequests = args.latestBatchId
      ? await Promise.all([
        supabase
          .from('governance_public_audit_batch_verifications')
          .select('*')
          .eq('batch_id', args.latestBatchId)
          .order('verified_at', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('governance_public_audit_network_proofs')
          .select('*')
          .eq('batch_id', args.latestBatchId)
          .order('recorded_at', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase.rpc('governance_public_audit_batch_verifier_summary', {
          target_batch_id: args.latestBatchId,
        }),
      ])
      : [
          { data: [], error: null },
          { data: [], error: null },
          { data: null, error: null },
        ];

    const [verificationsResponse, proofsResponse, summaryResponse] = scopedRequests;

    const sharedError =
      policyResponse.error
      || nodesResponse.error
      || verificationsResponse.error
      || proofsResponse.error
      || summaryResponse.error;

    if (isMissingPublicAuditVerifierBackend(sharedError)) {
      setVerifierBackendUnavailable(true);
      setLoadingVerifierData(false);
      return;
    }

    if (sharedError) {
      console.error('Failed to load public audit verifier data:', {
        policyError: policyResponse.error,
        nodesError: nodesResponse.error,
        verificationsError: verificationsResponse.error,
        proofsError: proofsResponse.error,
        summaryError: summaryResponse.error,
      });
      toast.error('Could not load replicated verifier data.');
      setLoadingVerifierData(false);
      return;
    }

    setReplicationPolicy((policyResponse.data as GovernancePublicAuditReplicationPolicyRow | null) || null);
    setVerifierNodes((nodesResponse.data as GovernancePublicAuditVerifierNodeRow[]) || []);
    setBatchVerifications((verificationsResponse.data as GovernancePublicAuditBatchVerificationRow[]) || []);
    setNetworkProofs((proofsResponse.data as GovernancePublicAuditNetworkProofRow[]) || []);
    setVerifierSummary(readGovernancePublicAuditVerifierSummary(summaryResponse.data));
    setVerifierBackendUnavailable(false);
    setLoadingVerifierData(false);
  }, [args.latestBatchId]);

  useEffect(() => {
    void loadVerifierData();
  }, [loadVerifierData]);

  const refreshVerifierData = useCallback(async () => {
    setRefreshingVerifierData(true);
    await loadVerifierData();
    setRefreshingVerifierData(false);
  }, [loadVerifierData]);

  const registerVerifierNode = useCallback(async (draft: {
    verifierKey: string;
    verifierLabel: string;
    endpointUrl: string;
    keyAlgorithm: string;
  }) => {
    if (verifierBackendUnavailable) return;

    const verifierKey = draft.verifierKey.trim();
    if (!verifierKey) {
      toast.error('Verifier key is required.');
      return;
    }

    setAddingVerifierNode(true);

    const { error } = await supabase.rpc('register_governance_public_audit_verifier_node', {
      verifier_key: verifierKey,
      verifier_label: draft.verifierLabel.trim() || null,
      endpoint_url: draft.endpointUrl.trim() || null,
      key_algorithm: draft.keyAlgorithm.trim() || 'ECDSA_P256_SHA256_V1',
      metadata: {
        source: 'governance_public_audit_card',
      },
    });

    if (error) {
      console.error('Failed to register public audit verifier node:', error);
      toast.error('Could not register verifier node.');
      setAddingVerifierNode(false);
      return;
    }

    toast.success('Verifier node registered.');
    setAddingVerifierNode(false);
    await loadVerifierData();
  }, [loadVerifierData, verifierBackendUnavailable]);

  const setVerifierNodeActive = useCallback(async (verifierId: string, isActive: boolean) => {
    if (verifierBackendUnavailable) return;

    setTogglingVerifierId(verifierId);

    const { error } = await supabase
      .from('governance_public_audit_verifier_nodes')
      .update({ is_active: isActive })
      .eq('id', verifierId);

    if (error) {
      console.error('Failed to update verifier node status:', { verifierId, error });
      toast.error('Could not update verifier node status.');
      setTogglingVerifierId(null);
      return;
    }

    toast.success(isActive ? 'Verifier node activated.' : 'Verifier node deactivated.');
    setTogglingVerifierId(null);
    await loadVerifierData();
  }, [loadVerifierData, verifierBackendUnavailable]);

  const recordBatchVerification = useCallback(async (draft: {
    verifierId: string;
    status: Database['public']['Enums']['governance_public_audit_verification_status'];
    verificationHash: string;
    proofReference: string;
  }) => {
    if (verifierBackendUnavailable || !args.latestBatchId) return;

    if (!draft.verifierId) {
      toast.error('Select a verifier node first.');
      return;
    }

    setRecordingBatchVerification(true);

    const { error } = await supabase.rpc('record_governance_public_audit_batch_verification', {
      target_batch_id: args.latestBatchId,
      target_verifier_id: draft.verifierId,
      verification_status: draft.status,
      verification_hash: draft.verificationHash.trim() || null,
      proof_reference: draft.proofReference.trim() || null,
      proof_payload: {
        source: 'governance_public_audit_card',
      },
      verified_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Failed to record batch verification result:', error);
      toast.error('Could not record verifier result.');
      setRecordingBatchVerification(false);
      return;
    }

    toast.success('Verifier result recorded.');
    setRecordingBatchVerification(false);
    await loadVerifierData();
  }, [args.latestBatchId, loadVerifierData, verifierBackendUnavailable]);

  const recordNetworkProof = useCallback(async (draft: {
    network: string;
    reference: string;
    blockHeight: string;
  }) => {
    if (verifierBackendUnavailable || !args.latestBatchId) return;

    const network = draft.network.trim();
    const reference = draft.reference.trim();

    if (!network || !reference) {
      toast.error('Network and proof reference are required.');
      return;
    }

    setRecordingNetworkProof(true);

    const parsedBlockHeight = Number.parseInt(draft.blockHeight, 10);

    const { error } = await supabase.rpc('record_governance_public_audit_network_proof', {
      target_batch_id: args.latestBatchId,
      proof_network: network,
      proof_reference: reference,
      proof_payload: {
        source: 'governance_public_audit_card',
      },
      proof_block_height: Number.isFinite(parsedBlockHeight) ? parsedBlockHeight : null,
    });

    if (error) {
      console.error('Failed to record network proof:', error);
      toast.error('Could not record network proof.');
      setRecordingNetworkProof(false);
      return;
    }

    toast.success('Network proof recorded.');
    setRecordingNetworkProof(false);
    await loadVerifierData();
  }, [args.latestBatchId, loadVerifierData, verifierBackendUnavailable]);

  return {
    loadingVerifierData,
    verifierBackendUnavailable,
    refreshingVerifierData,
    addingVerifierNode,
    recordingBatchVerification,
    recordingNetworkProof,
    togglingVerifierId,
    replicationPolicy,
    verifierNodes,
    batchVerifications,
    networkProofs,
    verifierSummary,
    refreshVerifierData,
    registerVerifierNode,
    setVerifierNodeActive,
    recordBatchVerification,
    recordNetworkProof,
  };
}
