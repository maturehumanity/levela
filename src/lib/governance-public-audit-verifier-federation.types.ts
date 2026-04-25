export interface GovernancePublicAuditVerifierMirrorPolicyRatificationSummary {
  policyKey: string;
  policyHash: string;
  requirePolicyRatification: boolean;
  minPolicyRatificationApprovals: number;
  requiredIndependentSigners: number;
  approvalCount: number;
  independentApprovalCount: number;
  communityApprovalCount: number;
  rejectCount: number;
  ratificationMet: boolean;
  latestRatifiedAt: string | null;
}

export interface GovernancePublicAuditVerifierMirrorDiscoverySourceBoardRow {
  sourceId: string;
  sourceKey: string;
  sourceLabel: string | null;
  endpointUrl: string;
  discoveryScope: string;
  trustTier: string;
  isActive: boolean;
  lastRunAt: string | null;
  lastRunStatus: 'ok' | 'degraded' | 'failed' | 'unknown';
  candidateCount: number;
  newCandidateCount: number;
  promotedCandidateCount: number;
}

export interface GovernancePublicAuditVerifierMirrorDiscoveredCandidateBoardRow {
  candidateId: string;
  sourceId: string;
  sourceKey: string;
  sourceLabel: string | null;
  trustTier: string;
  candidateKey: string;
  candidateLabel: string | null;
  endpointUrl: string;
  regionCode: string;
  operatorLabel: string;
  trustDomain: string;
  candidateStatus: 'new' | 'reviewed' | 'promoted' | 'rejected' | 'inactive' | 'unknown';
  discoveryConfidence: number;
  lastSeenAt: string | null;
}

export interface GovernancePublicAuditVerifierMirrorDiscoverySummary {
  batchId: string | null;
  lookbackHours: number;
  activeSourceCount: number;
  candidateCount: number;
  newCandidateCount: number;
  promotedCandidateCount: number;
  lastRunAt: string | null;
  lastRunStatus: 'ok' | 'degraded' | 'failed' | 'unknown';
}

export interface GovernancePublicAuditVerifierMirrorSignerGovernanceSummary {
  policyKey: string;
  requireSignerGovernanceApproval: boolean;
  minSignerGovernanceIndependentApprovals: number;
  approvedSignerCount: number;
  approvedIndependentSignerCount: number;
  pendingSignerCount: number;
  rejectedSignerCount: number;
  suspendedSignerCount: number;
  governanceReady: boolean;
  latestAttestedAt: string | null;
}

export interface GovernancePublicAuditVerifierMirrorSignerGovernanceBoardRow {
  signerId: string;
  signerKey: string;
  signerLabel: string | null;
  trustTier: string;
  isActive: boolean;
  governanceStatus: 'pending' | 'approved' | 'rejected' | 'suspended' | 'unknown';
  requiredIndependentApprovals: number;
  approvalCount: number;
  independentApprovalCount: number;
  communityApprovalCount: number;
  rejectCount: number;
  governanceMet: boolean;
  latestAttestedAt: string | null;
  governanceLastReviewedAt: string | null;
}

export interface GovernancePublicAuditVerifierMirrorFederationOnboardingBoardRow {
  requestId: string;
  operatorId: string;
  operatorKey: string;
  operatorLabel: string | null;
  operatorOnboardingStatus: 'pending' | 'approved' | 'onboarded' | 'rejected' | 'suspended' | 'unknown';
  requestStatus: 'pending' | 'approved' | 'onboarded' | 'rejected' | 'unknown';
  requestedMirrorKey: string;
  requestedMirrorLabel: string | null;
  requestedEndpointUrl: string;
  requestedRegionCode: string;
  requestedTrustDomain: string;
  onboardedMirrorId: string | null;
  reviewedAt: string | null;
  createdAt: string | null;
}

export interface GovernancePublicAuditVerifierMirrorFederationWorkerRunRow {
  runId: string;
  runScope: string;
  runStatus: 'ok' | 'degraded' | 'failed' | 'unknown';
  discoveredRequestCount: number;
  approvedRequestCount: number;
  onboardedRequestCount: number;
  openAlertCount: number;
  observedAt: string | null;
}

export interface GovernancePublicAuditVerifierMirrorFederationAlertBoardRow {
  alertId: string;
  alertKey: string;
  severity: 'info' | 'warning' | 'critical' | 'unknown';
  alertScope: string;
  alertStatus: 'open' | 'acknowledged' | 'resolved' | 'unknown';
  alertMessage: string;
  openedAt: string | null;
  resolvedAt: string | null;
}

export interface GovernancePublicAuditVerifierMirrorFederationOperationsSummary {
  policyKey: string;
  requireFederationOpsReadiness: boolean;
  maxOpenCriticalFederationAlerts: number;
  minOnboardedFederationOperators: number;
  registeredOperatorCount: number;
  approvedOperatorCount: number;
  onboardedOperatorCount: number;
  pendingRequestCount: number;
  approvedRequestCount: number;
  onboardedRequestCount: number;
  openWarningAlertCount: number;
  openCriticalAlertCount: number;
  alertSlaHours: number;
  alertSlaBreachedCount: number;
  lastWorkerRunAt: string | null;
  lastWorkerRunStatus: 'ok' | 'degraded' | 'failed' | 'unknown';
  distributionVerificationLookbackHours: number;
  lastDistributionVerificationRunAt: string | null;
  lastDistributionVerificationRunStatus: 'ok' | 'degraded' | 'failed' | 'unknown';
  distributionVerificationStale: boolean;
  openDistributionStalePackageAlertCount: number;
  openDistributionBadSignatureAlertCount: number;
  openDistributionPolicyMismatchAlertCount: number;
  openDistributionVerificationAlertCount: number;
  federationOpsReady: boolean;
}

export interface GovernancePublicAuditVerifierFederationPackage {
  packageVersion: string;
  packageHash: string;
  packagePayload: Record<string, unknown>;
  batchId: string;
  sourceDirectoryId: string;
  sourceDirectoryHash: string;
  federationOpsReady: boolean;
  /** Postgres `package_payload::text` byte-identical to digest input for `package_hash`. */
  digestSourceText: string | null;
}

export interface GovernancePublicAuditVerifierFederationPackageHistoryRow {
  packageId: string;
  batchId: string;
  capturedAt: string;
  packageVersion: string;
  packageHash: string;
  sourceDirectoryId: string;
  signatureCount: number;
}

export interface GovernancePublicAuditVerifierFederationRecentPackageRow {
  packageId: string;
  batchId: string;
  capturedAt: string;
  packageVersion: string;
  packageHash: string;
  sourceDirectoryId: string;
  sourceDirectoryHash: string;
  signatureCount: number;
  distributionReady: boolean;
  packageNotes: string | null;
}

export interface GovernancePublicAuditVerifierFederationPackageDistributionSummary {
  packageId: string;
  batchId: string;
  capturedAt: string;
  packageVersion: string;
  packageHash: string;
  sourceDirectoryHash: string;
  requiredDistributionSignatures: number;
  signatureCount: number;
  distinctSignerCount: number;
  distinctSignerJurisdictionsCount: number;
  distinctSignerTrustDomainsCount: number;
  lastSignedAt: string | null;
  federationOpsReady: boolean;
  distributionReady: boolean;
}

/** First-row snapshot from `governance_public_audit_verifier_federation_distribution_gate` (includes no-package rows). */
export interface GovernancePublicAuditVerifierFederationDistributionGateSnapshot {
  hasCapturedPackage: boolean;
  packageId: string | null;
  batchId: string | null;
  capturedAt: string | null;
  packageVersion: string;
  packageHash: string;
  sourceDirectoryHash: string;
  requiredDistributionSignatures: number;
  signatureCount: number;
  distinctSignerCount: number;
  distinctSignerJurisdictionsCount: number;
  distinctSignerTrustDomainsCount: number;
  lastSignedAt: string | null;
  federationOpsReady: boolean;
  distributionReady: boolean;
}

export interface GovernancePublicAuditVerifierFederationPackageSignatureRow {
  signatureId: string;
  packageId: string;
  packageHash: string;
  signerKey: string;
  signatureAlgorithm: string;
  distributionChannel: string;
  signerTrustDomain: string;
  signerJurisdictionCountryCode: string | null;
  signedAt: string | null;
}

export interface GovernancePublicAuditVerifierFederationExchangeAttestationSummary {
  batchId: string | null;
  lookbackHours: number;
  attestationCount: number;
  acceptedCount: number;
  rejectedCount: number;
  needsFollowupCount: number;
  distinctOperatorCount: number;
  distinctExternalOperatorCount: number;
  receiptEvidenceCount: number;
  receiptVerifiedCount: number;
  receiptPendingVerificationCount: number;
  latestAttestedAt: string | null;
}

export interface GovernancePublicAuditVerifierFederationExchangeAttestationRow {
  attestationId: string;
  packageId: string;
  batchId: string;
  packageHash: string;
  operatorLabel: string;
  operatorIdentityUri: string | null;
  operatorTrustDomain: string;
  operatorJurisdictionCountryCode: string | null;
  exchangeChannel: string;
  attestationVerdict: 'accepted' | 'rejected' | 'needs_followup' | 'unknown';
  attestationNotes: string | null;
  attestationMetadata: Record<string, unknown> | null;
  receiptPayload: Record<string, unknown> | null;
  receiptSignature: string | null;
  receiptSignerKey: string | null;
  receiptSignatureAlgorithm: string | null;
  receiptVerified: boolean;
  receiptVerifiedAt: string | null;
  receiptVerificationNotes: string | null;
  receiptVerifiedBy: string | null;
  receiptVerifiedByName: string | null;
  attestedBy: string | null;
  attestedByName: string | null;
  attestedAt: string | null;
}

export interface GovernancePublicAuditVerifierFederationExchangeReceiptPolicySummary {
  policyKey: string;
  policyName: string;
  lookbackHours: number;
  warningPendingThreshold: number;
  criticalPendingThreshold: number;
  escalationEnabled: boolean;
  oncallChannel: string;
  receiptMaxVerificationAgeHours: number;
  criticalStaleReceiptCountThreshold: number;
  metadata: Record<string, unknown> | null;
  updatedAt: string | null;
  updatedBy: string | null;
  updatedByName: string | null;
}

export interface GovernancePublicAuditVerifierFederationExchangeReceiptAutomationStatus {
  cronSchemaAvailable: boolean;
  cronJobRegistered: boolean;
  cronJobActive: boolean;
  cronJobSchedule: string | null;
  cronJobCommand: string | null;
  latestCronRunStartedAt: string | null;
  latestCronRunFinishedAt: string | null;
  latestCronRunStatus: string | null;
  latestCronRunDetails: string | null;
  latestPendingReceiptAttestedAt: string | null;
  latestVerifiedReceiptAt: string | null;
  latestEscalationPageOpenedAt: string | null;
  latestEscalationPageStatus: string | null;
  latestAutomationRunStartedAt: string | null;
  latestAutomationRunFinishedAt: string | null;
  latestAutomationRunStatus: string | null;
  latestAutomationRunMessage: string | null;
  latestAutomationRunTriggerSource: string | null;
}

export interface GovernancePublicAuditVerifierFederationExchangeReceiptAutomationRunRow {
  runId: string;
  triggeredBy: string | null;
  triggeredByName: string | null;
  triggerSource: string;
  requestedLookbackHours: number | null;
  runStartedAt: string | null;
  runFinishedAt: string | null;
  runStatus: string;
  runMessage: string | null;
  receiptPendingCount: number;
  staleReceiptCount: number;
  criticalBacklog: boolean;
  openOrAckPageCount: number;
}

export interface GovernancePublicAuditVerifierFederationExchangeReceiptEscalationHistoryRow {
  pageId: string;
  batchId: string | null;
  pageKey: string;
  severity: 'info' | 'warning' | 'critical' | 'unknown';
  pageStatus: 'open' | 'acknowledged' | 'resolved' | 'unknown';
  pageMessage: string;
  oncallChannel: string;
  openedAt: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  updatedAt: string | null;
}

export interface GovernancePublicAuditVerifierFederationExchangeReceiptPolicyEventRow {
  eventId: string;
  policyKey: string;
  eventType: 'created' | 'updated' | 'rollback' | 'unknown';
  actorProfileId: string | null;
  actorName: string | null;
  eventMessage: string;
  metadata: Record<string, unknown> | null;
  createdAt: string | null;
}
