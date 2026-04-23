import { Badge } from '@/components/ui/badge';
import { GovernancePublicAuditVerifierMirrorFederationControls } from '@/components/governance/GovernancePublicAuditVerifierMirrorFederationControls';
import { GovernancePublicAuditVerifierMirrorFederationDistributionControls } from '@/components/governance/GovernancePublicAuditVerifierMirrorFederationDistributionControls';
import { GovernancePublicAuditVerifierMirrorSignerGovernanceControls } from '@/components/governance/GovernancePublicAuditVerifierMirrorSignerGovernanceControls';
import {
  formatGovernancePublicAuditVerifierMirrorFederationAlertHeading,
  formatGovernancePublicAuditVerifierMirrorFederationAlertSeverityLabel,
  formatGovernancePublicAuditVerifierMirrorFederationAlertStatusLabel,
  formatGovernancePublicAuditVerifierMirrorFederationCandidateStatusLabel,
  formatGovernancePublicAuditVerifierMirrorFederationOnboardingRequestStatusLabel,
  formatGovernancePublicAuditVerifierMirrorFederationWorkerRunScopeLabel,
  formatGovernancePublicAuditVerifierMirrorFederationWorkerRunStatusLabel,
  formatGovernancePublicAuditVerifierMirrorSignerGovernanceStatusLabel,
  type GovernancePublicAuditVerifierFederationPackage,
  type GovernancePublicAuditVerifierFederationPackageDistributionSummary,
  type GovernancePublicAuditVerifierFederationPackageHistoryRow,
  type GovernancePublicAuditVerifierFederationPackageSignatureRow,
  type GovernancePublicAuditVerifierMirrorDiscoveredCandidateBoardRow,
  type GovernancePublicAuditVerifierMirrorDiscoverySourceBoardRow,
  type GovernancePublicAuditVerifierMirrorDiscoverySummary,
  type GovernancePublicAuditVerifierMirrorFederationAlertBoardRow,
  type GovernancePublicAuditVerifierMirrorFederationWorkerRunRow,
  type GovernancePublicAuditVerifierMirrorFederationOnboardingBoardRow,
  type GovernancePublicAuditVerifierMirrorFederationOperationsSummary,
  type GovernancePublicAuditVerifierMirrorPolicyRatificationSummary,
  type GovernancePublicAuditVerifierMirrorSignerGovernanceBoardRow,
  type GovernancePublicAuditVerifierMirrorSignerGovernanceSummary,
} from '@/lib/governance-public-audit-verifiers';

interface GovernancePublicAuditVerifierMirrorFederationCardProps {
  canManageMirrorFederation: boolean;
  registeringDiscoverySource: boolean;
  recordingDiscoveryRun: boolean;
  upsertingDiscoveredCandidate: boolean;
  promotingDiscoveredCandidate: boolean;
  savingPolicyRatification: boolean;
  capturingFederationPackage: boolean;
  signingFederationPackage: boolean;
  verifyingFederationDistribution: boolean;
  savingFederationOpsRequirement: boolean;
  registeringFederationOperator: boolean;
  submittingOnboardingRequest: boolean;
  reviewingOnboardingRequest: boolean;
  onboardingFederationRequest: boolean;
  recordingFederationWorkerRun: boolean;
  openingFederationAlert: boolean;
  resolvingFederationAlert: boolean;
  canManageSignerGovernance: boolean;
  savingSignerGovernanceRequirement: boolean;
  savingSignerGovernanceAttestation: boolean;
  policyRatificationSummary: GovernancePublicAuditVerifierMirrorPolicyRatificationSummary | null;
  discoverySummary: GovernancePublicAuditVerifierMirrorDiscoverySummary | null;
  federationOperationsSummary: GovernancePublicAuditVerifierMirrorFederationOperationsSummary | null;
  federationPackage: GovernancePublicAuditVerifierFederationPackage | null;
  federationPackageDistributionSummary: GovernancePublicAuditVerifierFederationPackageDistributionSummary | null;
  federationPackageSignatures: GovernancePublicAuditVerifierFederationPackageSignatureRow[];
  federationPackageHistory: GovernancePublicAuditVerifierFederationPackageHistoryRow[];
  signerGovernanceSummary: GovernancePublicAuditVerifierMirrorSignerGovernanceSummary | null;
  discoverySources: GovernancePublicAuditVerifierMirrorDiscoverySourceBoardRow[];
  discoveredCandidates: GovernancePublicAuditVerifierMirrorDiscoveredCandidateBoardRow[];
  federationOnboardingBoard: GovernancePublicAuditVerifierMirrorFederationOnboardingBoardRow[];
  federationAlertBoard: GovernancePublicAuditVerifierMirrorFederationAlertBoardRow[];
  federationWorkerRuns: GovernancePublicAuditVerifierMirrorFederationWorkerRunRow[];
  federationDistributionEscalationOpenPageCount: number;
  signerGovernanceBoard: GovernancePublicAuditVerifierMirrorSignerGovernanceBoardRow[];
  formatTimestamp: (value: string | null) => string;
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
  captureFederationPackage: (packageNotes: string) => Promise<void> | void;
  signFederationPackage: (draft: {
    packageId: string;
    signerKey: string;
    signature: string;
    signatureAlgorithm: string;
    signerTrustDomain: string;
    signerJurisdictionCountryCode: string;
    signerIdentityUri: string;
    distributionChannel: string;
  }) => Promise<void> | void;
  runFederationDistributionVerification: (staleAfterHours: string) => Promise<void> | void;
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
  saveSignerGovernanceRequirement: (draft: {
    requireSignerGovernanceApproval: boolean;
    minSignerGovernanceIndependentApprovals: string;
  }) => Promise<void> | void;
  saveSignerGovernanceAttestation: (draft: {
    targetSignerId: string;
    attestorSignerKey: string;
    attestationDecision: 'approve' | 'reject';
    attestationSignature: string;
  }) => Promise<void> | void;
}

function previewHash(value: string) {
  if (!value) return 'n/a';
  if (value.length <= 24) return value;
  return `${value.slice(0, 12)}...${value.slice(-8)}`;
}

export function GovernancePublicAuditVerifierMirrorFederationCard({
  canManageMirrorFederation,
  registeringDiscoverySource,
  recordingDiscoveryRun,
  upsertingDiscoveredCandidate,
  promotingDiscoveredCandidate,
  savingPolicyRatification,
  capturingFederationPackage,
  signingFederationPackage,
  verifyingFederationDistribution,
  savingFederationOpsRequirement,
  registeringFederationOperator,
  submittingOnboardingRequest,
  reviewingOnboardingRequest,
  onboardingFederationRequest,
  recordingFederationWorkerRun,
  openingFederationAlert,
  resolvingFederationAlert,
  canManageSignerGovernance,
  savingSignerGovernanceRequirement,
  savingSignerGovernanceAttestation,
  policyRatificationSummary,
  discoverySummary,
  federationOperationsSummary,
  federationPackage,
  federationPackageDistributionSummary,
  federationPackageSignatures,
  federationPackageHistory,
  signerGovernanceSummary,
  discoverySources,
  discoveredCandidates,
  federationOnboardingBoard,
  federationAlertBoard,
  federationWorkerRuns,
  federationDistributionEscalationOpenPageCount,
  signerGovernanceBoard,
  formatTimestamp,
  registerDiscoverySource,
  recordDiscoveryRun,
  upsertDiscoveredCandidate,
  promoteDiscoveredCandidate,
  recordPolicyRatification,
  captureFederationPackage,
  signFederationPackage,
  runFederationDistributionVerification,
  saveFederationOpsRequirement,
  registerFederationOperator,
  submitFederationOnboardingRequest,
  reviewFederationOnboardingRequest,
  onboardFederationRequest,
  recordFederationWorkerRun,
  openFederationAlert,
  resolveFederationAlert,
  saveSignerGovernanceRequirement,
  saveSignerGovernanceAttestation,
}: GovernancePublicAuditVerifierMirrorFederationCardProps) {
  return (
    <div className="space-y-2 rounded-md border border-border/60 bg-card p-2 text-xs">
      <p className="font-medium text-foreground">Mirror federation</p>
      <div className="flex flex-wrap gap-2">
        {policyRatificationSummary && (
          <Badge
            variant="outline"
            className={policyRatificationSummary.ratificationMet
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'}
          >
            Policy ratification {policyRatificationSummary.ratificationMet ? 'met' : 'pending'}
          </Badge>
        )}
        {discoverySummary && (
          <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
            Candidates {discoverySummary.candidateCount}
          </Badge>
        )}
        {discoverySummary && (
          <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
            Sources {discoverySummary.activeSourceCount}
          </Badge>
        )}
        {signerGovernanceSummary && (
          <Badge
            variant="outline"
            className={signerGovernanceSummary.governanceReady
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'}
          >
            Signer governance {signerGovernanceSummary.governanceReady ? 'ready' : 'pending'}
          </Badge>
        )}
        {federationOperationsSummary && (
          <Badge
            variant="outline"
            className={federationOperationsSummary.federationOpsReady
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'}
          >
            Federation ops {federationOperationsSummary.federationOpsReady ? 'ready' : 'pending'}
          </Badge>
        )}
      </div>

      <GovernancePublicAuditVerifierMirrorFederationControls
        canManageMirrorFederation={canManageMirrorFederation}
        registeringDiscoverySource={registeringDiscoverySource}
        recordingDiscoveryRun={recordingDiscoveryRun}
        upsertingDiscoveredCandidate={upsertingDiscoveredCandidate}
        promotingDiscoveredCandidate={promotingDiscoveredCandidate}
        savingPolicyRatification={savingPolicyRatification}
        savingFederationOpsRequirement={savingFederationOpsRequirement}
        registeringFederationOperator={registeringFederationOperator}
        submittingOnboardingRequest={submittingOnboardingRequest}
        reviewingOnboardingRequest={reviewingOnboardingRequest}
        onboardingFederationRequest={onboardingFederationRequest}
        recordingFederationWorkerRun={recordingFederationWorkerRun}
        openingFederationAlert={openingFederationAlert}
        resolvingFederationAlert={resolvingFederationAlert}
        discoverySources={discoverySources}
        discoveredCandidates={discoveredCandidates}
        federationOperationsSummary={federationOperationsSummary}
        federationOnboardingBoard={federationOnboardingBoard}
        federationAlertBoard={federationAlertBoard}
        registerDiscoverySource={registerDiscoverySource}
        recordDiscoveryRun={recordDiscoveryRun}
        upsertDiscoveredCandidate={upsertDiscoveredCandidate}
        promoteDiscoveredCandidate={promoteDiscoveredCandidate}
        recordPolicyRatification={recordPolicyRatification}
        saveFederationOpsRequirement={saveFederationOpsRequirement}
        registerFederationOperator={registerFederationOperator}
        submitFederationOnboardingRequest={submitFederationOnboardingRequest}
        reviewFederationOnboardingRequest={reviewFederationOnboardingRequest}
        onboardFederationRequest={onboardFederationRequest}
        recordFederationWorkerRun={recordFederationWorkerRun}
        openFederationAlert={openFederationAlert}
        resolveFederationAlert={resolveFederationAlert}
      />
      <GovernancePublicAuditVerifierMirrorFederationDistributionControls
        canManageMirrorFederation={canManageMirrorFederation}
        federationPackage={federationPackage}
        federationPackageDistributionSummary={federationPackageDistributionSummary}
        federationPackageSignatures={federationPackageSignatures}
        federationPackageHistory={federationPackageHistory}
        federationOperationsSummary={federationOperationsSummary}
        capturingFederationPackage={capturingFederationPackage}
        signingFederationPackage={signingFederationPackage}
        verifyingFederationDistribution={verifyingFederationDistribution}
        captureFederationPackage={captureFederationPackage}
        signFederationPackage={signFederationPackage}
        runFederationDistributionVerification={runFederationDistributionVerification}
        formatTimestamp={formatTimestamp}
      />
      <GovernancePublicAuditVerifierMirrorSignerGovernanceControls
        canManageSignerGovernance={canManageSignerGovernance}
        savingSignerGovernanceRequirement={savingSignerGovernanceRequirement}
        savingSignerGovernanceAttestation={savingSignerGovernanceAttestation}
        signerGovernanceSummary={signerGovernanceSummary}
        signerGovernanceBoard={signerGovernanceBoard}
        saveSignerGovernanceRequirement={saveSignerGovernanceRequirement}
        saveSignerGovernanceAttestation={saveSignerGovernanceAttestation}
      />

      {policyRatificationSummary && (
        <p className="text-muted-foreground">
          {previewHash(policyRatificationSummary.policyHash)} • approvals {policyRatificationSummary.independentApprovalCount}/{policyRatificationSummary.minPolicyRatificationApprovals} independent
        </p>
      )}
      {discoverySummary && (
        <p className="text-muted-foreground">
          New {discoverySummary.newCandidateCount} • Promoted {discoverySummary.promotedCandidateCount}
          {' '}• Last discovery run {formatGovernancePublicAuditVerifierMirrorFederationWorkerRunStatusLabel(discoverySummary.lastRunStatus)}
          {' '}· {formatTimestamp(discoverySummary.lastRunAt)}
        </p>
      )}
      {federationOperationsSummary && (
        <p className="text-muted-foreground">
          Onboarded operators {federationOperationsSummary.onboardedOperatorCount}/{federationOperationsSummary.minOnboardedFederationOperators}
          {' '}• Open critical alerts {federationOperationsSummary.openCriticalAlertCount}/{federationOperationsSummary.maxOpenCriticalFederationAlerts}
          {' '}• SLA breaches {federationOperationsSummary.alertSlaBreachedCount}
          {' '}• Distribution verification {federationOperationsSummary.distributionVerificationStale ? 'Stale' : 'Current'}
          {' '}• Open distribution alerts {federationOperationsSummary.openDistributionVerificationAlertCount}
          {' '}• Last verification run {formatGovernancePublicAuditVerifierMirrorFederationWorkerRunStatusLabel(federationOperationsSummary.lastDistributionVerificationRunStatus)}
          {federationOperationsSummary.lastDistributionVerificationRunAt
            ? ` · ${formatTimestamp(federationOperationsSummary.lastDistributionVerificationRunAt)}`
            : ''}
          {' '}• Federation operations {federationOperationsSummary.federationOpsReady ? 'Ready' : 'Not ready'}
        </p>
      )}
      {federationDistributionEscalationOpenPageCount > 0 && (
        <p className="text-xs text-amber-800 dark:text-amber-200">
          Open on-call pages for federation distribution verification: {federationDistributionEscalationOpenPageCount}. Resolve them under Immutable anchoring automation (on-call page board).
        </p>
      )}
      {federationWorkerRuns.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-foreground">Recent federation worker runs</p>
          <div className="space-y-1 text-muted-foreground">
            {federationWorkerRuns.map((run) => (
              <p key={run.runId}>
                {formatGovernancePublicAuditVerifierMirrorFederationWorkerRunScopeLabel(run.runScope)}
                {' '}• {formatGovernancePublicAuditVerifierMirrorFederationWorkerRunStatusLabel(run.runStatus)}
                {' '}• Open alerts {run.openAlertCount} • {formatTimestamp(run.observedAt)}
              </p>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-1 text-muted-foreground">
        {discoverySources.slice(0, 3).map((source) => (
          <p key={source.sourceId}>
            {source.sourceLabel || source.sourceKey}
            {' '}• Last run {formatGovernancePublicAuditVerifierMirrorFederationWorkerRunStatusLabel(source.lastRunStatus)}
            {' '}• {source.candidateCount} candidates
          </p>
        ))}
      </div>
      <div className="space-y-1 text-muted-foreground">
        {discoveredCandidates.slice(0, 3).map((candidate) => (
          <p key={candidate.candidateId}>
            {candidate.candidateLabel || candidate.candidateKey}
            {' '}• {formatGovernancePublicAuditVerifierMirrorFederationCandidateStatusLabel(candidate.candidateStatus)}
            {' '}• Confidence score {candidate.discoveryConfidence}
          </p>
        ))}
      </div>
      <div className="space-y-1 text-muted-foreground">
        {federationOnboardingBoard.slice(0, 3).map((request) => (
          <p key={request.requestId}>
            {request.operatorLabel || request.operatorKey}
            {' '}• Request {formatGovernancePublicAuditVerifierMirrorFederationOnboardingRequestStatusLabel(request.requestStatus)}
            {' '}• Mirror {request.requestedMirrorLabel || request.requestedMirrorKey}
          </p>
        ))}
      </div>
      {federationAlertBoard.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-foreground">Recent federation alerts</p>
          <div className="space-y-1 text-muted-foreground">
            {federationAlertBoard.slice(0, 3).map((alert) => (
              <p key={alert.alertId}>
                {formatGovernancePublicAuditVerifierMirrorFederationAlertHeading(alert)}
                {' '}• {formatGovernancePublicAuditVerifierMirrorFederationAlertSeverityLabel(alert.severity)}
                {' '}• {formatGovernancePublicAuditVerifierMirrorFederationAlertStatusLabel(alert.alertStatus)}
              </p>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-1 text-muted-foreground">
        {signerGovernanceBoard.slice(0, 3).map((signer) => (
          <p key={signer.signerId}>
            {signer.signerLabel || signer.signerKey}
            {' '}• {formatGovernancePublicAuditVerifierMirrorSignerGovernanceStatusLabel(signer.governanceStatus)}
            {' '}• Independent approvals {signer.independentApprovalCount}/{signer.requiredIndependentApprovals}
          </p>
        ))}
      </div>
    </div>
  );
}
