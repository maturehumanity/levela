import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { callUntypedRpc } from '@/lib/governance-rpc';
import {
  isMissingPublicAuditVerifierBackend,
  readGovernancePublicAuditVerifierFederationPackage,
  readGovernancePublicAuditVerifierFederationPackageDistributionSummary,
  readGovernancePublicAuditVerifierFederationPackageHistoryRows,
  readGovernancePublicAuditVerifierFederationPackageSignatureRows,
  readGovernancePublicAuditVerifierMirrorDiscoveredCandidateBoardRows,
  readGovernancePublicAuditVerifierMirrorDiscoverySourceBoardRows,
  readGovernancePublicAuditVerifierMirrorDiscoverySummary,
  readGovernancePublicAuditVerifierMirrorFederationAlertBoardRows,
  readGovernancePublicAuditVerifierMirrorFederationOnboardingBoardRows,
  readGovernancePublicAuditVerifierMirrorFederationOperationsSummary,
  readGovernancePublicAuditVerifierMirrorPolicyRatificationSummary,
  type GovernancePublicAuditVerifierFederationPackage,
  type GovernancePublicAuditVerifierFederationPackageDistributionSummary,
  type GovernancePublicAuditVerifierFederationPackageHistoryRow,
  type GovernancePublicAuditVerifierFederationPackageSignatureRow,
  type GovernancePublicAuditVerifierMirrorDiscoveredCandidateBoardRow,
  type GovernancePublicAuditVerifierMirrorDiscoverySourceBoardRow,
  type GovernancePublicAuditVerifierMirrorDiscoverySummary,
  type GovernancePublicAuditVerifierMirrorFederationAlertBoardRow,
  type GovernancePublicAuditVerifierMirrorFederationOnboardingBoardRow,
  type GovernancePublicAuditVerifierMirrorFederationOperationsSummary,
  type GovernancePublicAuditVerifierMirrorPolicyRatificationSummary,
} from '@/lib/governance-public-audit-verifiers';
import { useGovernancePublicAuditVerifierMirrorFederationActions } from '@/lib/use-governance-public-audit-verifier-mirror-federation-actions';

export function useGovernancePublicAuditVerifierMirrorFederation(args: { latestBatchId: string | null }) {
  const [loadingFederationData, setLoadingFederationData] = useState(true);
  const [federationBackendUnavailable, setFederationBackendUnavailable] = useState(false);
  const [canManageMirrorFederation, setCanManageMirrorFederation] = useState(false);

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
  const [federationPackage, setFederationPackage] = useState<GovernancePublicAuditVerifierFederationPackage | null>(null);
  const [federationPackageDistributionSummary, setFederationPackageDistributionSummary] =
    useState<GovernancePublicAuditVerifierFederationPackageDistributionSummary | null>(null);
  const [federationPackageSignatures, setFederationPackageSignatures] =
    useState<GovernancePublicAuditVerifierFederationPackageSignatureRow[]>([]);
  const [federationPackageHistory, setFederationPackageHistory] =
    useState<GovernancePublicAuditVerifierFederationPackageHistoryRow[]>([]);

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
      packageWithDigestResponse,
      packageDistributionSummaryResponse,
      packageSignatureBoardResponse,
      packageHistoryResponse,
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
      callUntypedRpc<unknown[]>('governance_public_audit_verifier_federation_pkg_digest_text', {
        target_batch_id: args.latestBatchId,
        requested_policy_key: 'default',
      }),
      callUntypedRpc<unknown[]>('governance_public_audit_verifier_federation_package_distribution_summary', {
        target_batch_id: args.latestBatchId,
        requested_policy_key: 'default',
      }),
      callUntypedRpc<unknown[]>('governance_public_audit_verifier_federation_package_signature_board', {
        target_batch_id: args.latestBatchId,
        max_entries: 80,
      }),
      callUntypedRpc<unknown[]>('governance_public_audit_verifier_federation_dist_pkg_history', {
        target_batch_id: args.latestBatchId,
        max_entries: 40,
      }),
    ]);

    const sharedError = permissionResponse.error
      || ratificationSummaryResponse.error
      || discoverySummaryResponse.error
      || discoverySourcesResponse.error
      || discoveredCandidatesResponse.error
      || operationsSummaryResponse.error
      || onboardingBoardResponse.error
      || alertBoardResponse.error
      || packageWithDigestResponse.error
      || packageDistributionSummaryResponse.error
      || packageSignatureBoardResponse.error
      || packageHistoryResponse.error;

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
        packageError: packageWithDigestResponse.error,
        packageDistributionSummaryError: packageDistributionSummaryResponse.error,
        packageSignatureBoardError: packageSignatureBoardResponse.error,
        packageHistoryError: packageHistoryResponse.error,
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
    setFederationPackage(readGovernancePublicAuditVerifierFederationPackage(packageWithDigestResponse.data));
    setFederationPackageDistributionSummary(
      readGovernancePublicAuditVerifierFederationPackageDistributionSummary(packageDistributionSummaryResponse.data),
    );
    setFederationPackageSignatures(readGovernancePublicAuditVerifierFederationPackageSignatureRows(packageSignatureBoardResponse.data));
    setFederationPackageHistory(readGovernancePublicAuditVerifierFederationPackageHistoryRows(packageHistoryResponse.data));
    setFederationBackendUnavailable(false);
    setLoadingFederationData(false);
  }, [args.latestBatchId]);

  useEffect(() => {
    void loadFederationData();
  }, [loadFederationData]);

  const actions = useGovernancePublicAuditVerifierMirrorFederationActions({
    latestBatchId: args.latestBatchId,
    canManageMirrorFederation,
    federationBackendUnavailable,
    loadFederationData,
  });

  return {
    loadingFederationData,
    federationBackendUnavailable,
    canManageMirrorFederation,
    policyRatificationSummary,
    discoverySummary,
    federationOperationsSummary,
    discoverySources,
    discoveredCandidates,
    federationOnboardingBoard,
    federationAlertBoard,
    federationPackage,
    federationPackageDistributionSummary,
    federationPackageSignatures,
    federationPackageHistory,
    loadFederationData,
    ...actions,
  };
}
