import { GovernancePublicAuditVerifierMirrorFederationDiscoveryControls } from '@/components/governance/GovernancePublicAuditVerifierMirrorFederationDiscoveryControls';
import { GovernancePublicAuditVerifierMirrorFederationOnboardingOpsControls } from '@/components/governance/GovernancePublicAuditVerifierMirrorFederationOnboardingOpsControls';
import { GovernancePublicAuditVerifierMirrorFederationWorkerAlertControls } from '@/components/governance/GovernancePublicAuditVerifierMirrorFederationWorkerAlertControls';
import type {
  GovernancePublicAuditVerifierMirrorDiscoveredCandidateBoardRow,
  GovernancePublicAuditVerifierMirrorDiscoverySourceBoardRow,
  GovernancePublicAuditVerifierMirrorFederationAlertBoardRow,
  GovernancePublicAuditVerifierMirrorFederationOnboardingBoardRow,
  GovernancePublicAuditVerifierMirrorFederationOperationsSummary,
} from '@/lib/governance-public-audit-verifiers';

interface GovernancePublicAuditVerifierMirrorFederationControlsProps {
  canManageMirrorFederation: boolean;
  registeringDiscoverySource: boolean;
  recordingDiscoveryRun: boolean;
  upsertingDiscoveredCandidate: boolean;
  promotingDiscoveredCandidate: boolean;
  savingPolicyRatification: boolean;
  savingFederationOpsRequirement: boolean;
  registeringFederationOperator: boolean;
  submittingOnboardingRequest: boolean;
  reviewingOnboardingRequest: boolean;
  onboardingFederationRequest: boolean;
  recordingFederationWorkerRun: boolean;
  openingFederationAlert: boolean;
  resolvingFederationAlert: boolean;
  discoverySources: GovernancePublicAuditVerifierMirrorDiscoverySourceBoardRow[];
  discoveredCandidates: GovernancePublicAuditVerifierMirrorDiscoveredCandidateBoardRow[];
  federationOperationsSummary: GovernancePublicAuditVerifierMirrorFederationOperationsSummary | null;
  federationOnboardingBoard: GovernancePublicAuditVerifierMirrorFederationOnboardingBoardRow[];
  federationAlertBoard: GovernancePublicAuditVerifierMirrorFederationAlertBoardRow[];
  registerDiscoverySource: (draft: {
    sourceKey: string;
    sourceLabel: string;
    endpointUrl: string;
    discoveryScope: string;
    trustTier: string;
  }) => Promise<void> | void;
  recordDiscoveryRun: (draft: {
    sourceId: string;
    runStatus: 'ok' | 'degraded' | 'failed';
    discoveredCount: string;
    acceptedCandidateCount: string;
    staleCandidateCount: string;
    errorMessage: string;
  }) => Promise<void> | void;
  upsertDiscoveredCandidate: (draft: {
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
  }) => Promise<void> | void;
  promoteDiscoveredCandidate: (candidateId: string) => Promise<void> | void;
  recordPolicyRatification: (draft: {
    policyKey: string;
    signerKey: string;
    ratificationDecision: 'approve' | 'reject';
    ratificationSignature: string;
  }) => Promise<void> | void;
  saveFederationOpsRequirement: (draft: {
    requireFederationOpsReadiness: boolean;
    maxOpenCriticalAlerts: string;
    minOnboardedOperators: string;
  }) => Promise<void> | void;
  registerFederationOperator: (draft: {
    operatorKey: string;
    operatorLabel: string;
    contactEndpoint: string;
    jurisdictionCountryCode: string;
    trustDomain: string;
  }) => Promise<void> | void;
  submitFederationOnboardingRequest: (draft: {
    operatorKey: string;
    requestedMirrorKey: string;
    requestedMirrorLabel: string;
    requestedEndpointUrl: string;
    requestedMirrorType: string;
    requestedRegionCode: string;
    requestedJurisdictionCountryCode: string;
    requestedTrustDomain: string;
  }) => Promise<void> | void;
  reviewFederationOnboardingRequest: (draft: {
    requestId: string;
    reviewDecision: 'approve' | 'reject';
    reviewNotes: string;
  }) => Promise<void> | void;
  onboardFederationRequest: (draft: {
    requestId: string;
    activateMirror: boolean;
  }) => Promise<void> | void;
  recordFederationWorkerRun: (draft: {
    runScope: 'onboarding_sweep' | 'operator_health_audit' | 'diversity_audit' | 'package_distribution_verification' | 'manual';
    runStatus: 'ok' | 'degraded' | 'failed';
    discoveredRequestCount: string;
    approvedRequestCount: string;
    onboardedRequestCount: string;
    openAlertCount: string;
    errorMessage: string;
  }) => Promise<void> | void;
  openFederationAlert: (draft: {
    alertKey: string;
    severity: 'info' | 'warning' | 'critical';
    alertScope: string;
    alertMessage: string;
  }) => Promise<void> | void;
  resolveFederationAlert: (draft: {
    alertId: string;
    resolutionNotes: string;
  }) => Promise<void> | void;
}

export function GovernancePublicAuditVerifierMirrorFederationControls({
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
  discoverySources,
  discoveredCandidates,
  federationOperationsSummary,
  federationOnboardingBoard,
  federationAlertBoard,
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
}: GovernancePublicAuditVerifierMirrorFederationControlsProps) {
  if (!canManageMirrorFederation) return null;

  return (
    <>
      <GovernancePublicAuditVerifierMirrorFederationOnboardingOpsControls
        federationOperationsSummary={federationOperationsSummary}
        federationOnboardingBoard={federationOnboardingBoard}
        registeringFederationOperator={registeringFederationOperator}
        submittingOnboardingRequest={submittingOnboardingRequest}
        reviewingOnboardingRequest={reviewingOnboardingRequest}
        onboardingFederationRequest={onboardingFederationRequest}
        savingFederationOpsRequirement={savingFederationOpsRequirement}
        registerFederationOperator={registerFederationOperator}
        submitFederationOnboardingRequest={submitFederationOnboardingRequest}
        reviewFederationOnboardingRequest={reviewFederationOnboardingRequest}
        onboardFederationRequest={onboardFederationRequest}
        saveFederationOpsRequirement={saveFederationOpsRequirement}
      />
      <GovernancePublicAuditVerifierMirrorFederationWorkerAlertControls
        federationAlertBoard={federationAlertBoard}
        recordingFederationWorkerRun={recordingFederationWorkerRun}
        openingFederationAlert={openingFederationAlert}
        resolvingFederationAlert={resolvingFederationAlert}
        recordFederationWorkerRun={recordFederationWorkerRun}
        openFederationAlert={openFederationAlert}
        resolveFederationAlert={resolveFederationAlert}
      />
      <GovernancePublicAuditVerifierMirrorFederationDiscoveryControls
        discoverySources={discoverySources}
        discoveredCandidates={discoveredCandidates}
        registeringDiscoverySource={registeringDiscoverySource}
        recordingDiscoveryRun={recordingDiscoveryRun}
        upsertingDiscoveredCandidate={upsertingDiscoveredCandidate}
        promotingDiscoveredCandidate={promotingDiscoveredCandidate}
        savingPolicyRatification={savingPolicyRatification}
        registerDiscoverySource={registerDiscoverySource}
        recordDiscoveryRun={recordDiscoveryRun}
        upsertDiscoveredCandidate={upsertDiscoveredCandidate}
        promoteDiscoveredCandidate={promoteDiscoveredCandidate}
        recordPolicyRatification={recordPolicyRatification}
      />
    </>
  );
}
