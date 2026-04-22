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
