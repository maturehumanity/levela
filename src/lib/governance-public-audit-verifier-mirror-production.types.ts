export interface GovernancePublicAuditVerifierMirrorFailoverPolicySummary {
  policyId: string | null;
  policyKey: string;
  policyName: string;
  isActive: boolean;
  minHealthyMirrors: number;
  maxMirrorLatencyMs: number;
  maxFailuresBeforeCooldown: number;
  cooldownMinutes: number;
  preferSameRegion: boolean;
  requiredDistinctRegions: number;
  requiredDistinctOperators: number;
  mirrorSelectionStrategy: string;
  maxMirrorCandidates: number;
  minIndependentDirectorySigners: number;
  requirePolicyRatification: boolean;
  minPolicyRatificationApprovals: number;
  requireSignerGovernanceApproval: boolean;
  minSignerGovernanceIndependentApprovals: number;
  requireFederationOpsReadiness: boolean;
  maxOpenCriticalFederationAlerts: number;
  minOnboardedFederationOperators: number;
  updatedAt: string | null;
}

export interface GovernancePublicAuditVerifierMirrorDirectorySummaryRow {
  directoryId: string;
  batchId: string | null;
  directoryVersion: string;
  directoryHash: string;
  signerId: string;
  signerKey: string;
  signerLabel: string | null;
  trustTier: string;
  signature: string;
  signatureAlgorithm: string;
  publishedAt: string;
  isLatestForBatch: boolean;
}

export type GovernancePublicAuditVerifierMirrorProbeJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface GovernancePublicAuditVerifierMirrorProbeJobBoardRow {
  jobId: string;
  batchId: string | null;
  mirrorId: string;
  mirrorKey: string;
  mirrorLabel: string | null;
  endpointUrl: string;
  status: GovernancePublicAuditVerifierMirrorProbeJobStatus;
  scheduledAt: string;
  completedAt: string | null;
  observedCheckStatus: 'ok' | 'degraded' | 'failed' | 'unknown';
  observedLatencyMs: number | null;
  observedBatchHash: string | null;
  errorMessage: string | null;
}

export interface GovernancePublicAuditVerifierMirrorProbeJobSummary {
  batchId: string | null;
  pendingSlaMinutes: number;
  lookbackHours: number;
  pendingCount: number;
  runningCount: number;
  stalePendingCount: number;
  failedLookbackCount: number;
  completedLookbackCount: number;
  oldestPendingAt: string | null;
  pendingSlaMet: boolean;
}

export interface GovernancePublicAuditVerifierMirrorDirectoryTrustSummary {
  directoryId: string;
  batchId: string | null;
  directoryHash: string;
  publishedAt: string;
  requiredIndependentSigners: number;
  approvalCount: number;
  independentApprovalCount: number;
  communityApprovalCount: number;
  rejectCount: number;
  trustQuorumMet: boolean;
}

export interface GovernancePublicAuditVerifierMirrorFederationDiversitySummary {
  batchId: string | null;
  requiredDistinctRegions: number;
  requiredDistinctOperators: number;
  selectedMirrorCount: number;
  healthyMirrorCount: number;
  distinctRegionCount: number;
  distinctOperatorCount: number;
  largestOperatorMirrorCount: number;
  largestOperatorSharePercent: number;
  meetsRegionDiversity: boolean;
  meetsOperatorDiversity: boolean;
}

export interface GovernancePublicAuditClientMirrorFailoverTarget {
  mirrorId: string;
  mirrorKey: string;
  mirrorLabel: string | null;
  regionCode: string;
  operatorLabel: string;
  healthStatus: string;
  lastCheckLatencyMs: number | null;
  failoverRank: number;
}
