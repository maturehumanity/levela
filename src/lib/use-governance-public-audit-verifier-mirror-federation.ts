import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import {
  countOpenGovernancePublicAuditExternalExecutionPagesForPageKeySubstring,
  isMissingPublicAuditAutomationBackend,
  readGovernancePublicAuditExternalExecutionPageBoardRows,
} from '@/lib/governance-public-audit-automation';
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
  readGovernancePublicAuditVerifierMirrorFederationWorkerRunRows,
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
  type GovernancePublicAuditVerifierMirrorFederationWorkerRunRow,
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
  const [federationWorkerRuns, setFederationWorkerRuns] =
    useState<GovernancePublicAuditVerifierMirrorFederationWorkerRunRow[]>([]);
  const [federationDistributionEscalationOpenPageCount, setFederationDistributionEscalationOpenPageCount] = useState(0);
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
      workerRunsResponse,
      executionPageBoardResponse,
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
      supabase
        .from('governance_public_audit_verifier_mirror_federation_worker_runs')
        .select(
          'id, run_scope, run_status, discovered_request_count, approved_request_count, onboarded_request_count, open_alert_count, observed_at',
        )
        .order('observed_at', { ascending: false })
        .limit(12),
      callUntypedRpc<unknown[]>('governance_public_audit_external_execution_page_board', {
        requested_batch_id: args.latestBatchId,
        max_pages: 120,
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
      || packageHistoryResponse.error
      || workerRunsResponse.error;

    if (isMissingPublicAuditVerifierBackend(sharedError)) {
      setFederationBackendUnavailable(true);
      setFederationDistributionEscalationOpenPageCount(0);
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
        workerRunsError: workerRunsResponse.error,
      });
      toast.error('Could not load verifier mirror federation data.');
      setFederationDistributionEscalationOpenPageCount(0);
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
    setFederationWorkerRuns(readGovernancePublicAuditVerifierMirrorFederationWorkerRunRows(workerRunsResponse.data));

    if (!executionPageBoardResponse.error) {
      const executionPages = readGovernancePublicAuditExternalExecutionPageBoardRows(executionPageBoardResponse.data);
      setFederationDistributionEscalationOpenPageCount(
        countOpenGovernancePublicAuditExternalExecutionPagesForPageKeySubstring(
          executionPages,
          'verifier_federation_distribution',
        ),
      );
    } else if (isMissingPublicAuditAutomationBackend(executionPageBoardResponse.error)) {
      setFederationDistributionEscalationOpenPageCount(0);
    } else {
      console.warn('Could not load external execution page board for federation escalation summary:', executionPageBoardResponse.error);
      setFederationDistributionEscalationOpenPageCount(0);
    }

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
    federationWorkerRuns,
    federationDistributionEscalationOpenPageCount,
    federationPackage,
    federationPackageDistributionSummary,
    federationPackageSignatures,
    federationPackageHistory,
    loadFederationData,
    ...actions,
  };
}
