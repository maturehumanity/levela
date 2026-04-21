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

function asString(value: unknown, fallback = '') {
  if (typeof value !== 'string') return fallback;
  return value;
}

function asNullableString(value: unknown) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function asNonNegativeInteger(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return Math.max(0, parsed);
  }
  return fallback;
}

function asBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === 't' || normalized === '1' || normalized === 'yes') return true;
    if (normalized === 'false' || normalized === 'f' || normalized === '0' || normalized === 'no') return false;
  }
  return fallback;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asRunStatus(value: unknown): GovernancePublicAuditVerifierMirrorDiscoverySourceBoardRow['lastRunStatus'] {
  const normalized = asString(value).trim().toLowerCase();
  if (normalized === 'ok' || normalized === 'degraded' || normalized === 'failed') return normalized;
  return 'unknown';
}

function asCandidateStatus(value: unknown): GovernancePublicAuditVerifierMirrorDiscoveredCandidateBoardRow['candidateStatus'] {
  const normalized = asString(value).trim().toLowerCase();
  if (normalized === 'new' || normalized === 'reviewed' || normalized === 'promoted' || normalized === 'rejected' || normalized === 'inactive') return normalized;
  return 'unknown';
}

function asGovernanceStatus(value: unknown): GovernancePublicAuditVerifierMirrorSignerGovernanceBoardRow['governanceStatus'] {
  const normalized = asString(value).trim().toLowerCase();
  if (normalized === 'pending' || normalized === 'approved' || normalized === 'rejected' || normalized === 'suspended') return normalized;
  return 'unknown';
}

export function readGovernancePublicAuditVerifierMirrorPolicyRatificationSummary(
  rows: unknown,
): GovernancePublicAuditVerifierMirrorPolicyRatificationSummary | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row = asRecord(rows[0]);
  if (!row) return null;

  const policyKey = asString(row.policy_key);
  const policyHash = asString(row.policy_hash);
  if (!policyKey || !policyHash) return null;

  return {
    policyKey,
    policyHash,
    requirePolicyRatification: asBoolean(row.require_policy_ratification, false),
    minPolicyRatificationApprovals: Math.max(1, asNonNegativeInteger(row.min_policy_ratification_approvals, 1)),
    requiredIndependentSigners: Math.max(1, asNonNegativeInteger(row.required_independent_signers, 1)),
    approvalCount: asNonNegativeInteger(row.approval_count),
    independentApprovalCount: asNonNegativeInteger(row.independent_approval_count),
    communityApprovalCount: asNonNegativeInteger(row.community_approval_count),
    rejectCount: asNonNegativeInteger(row.reject_count),
    ratificationMet: asBoolean(row.ratification_met, false),
    latestRatifiedAt: asNullableString(row.latest_ratified_at),
  };
}

export function readGovernancePublicAuditVerifierMirrorDiscoverySourceBoardRows(
  rows: unknown,
): GovernancePublicAuditVerifierMirrorDiscoverySourceBoardRow[] {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => ({
      sourceId: asString(entry.source_id),
      sourceKey: asString(entry.source_key),
      sourceLabel: asNullableString(entry.source_label),
      endpointUrl: asString(entry.endpoint_url),
      discoveryScope: asString(entry.discovery_scope, 'public_registry'),
      trustTier: asString(entry.trust_tier, 'observer'),
      isActive: asBoolean(entry.is_active, true),
      lastRunAt: asNullableString(entry.last_run_at),
      lastRunStatus: asRunStatus(entry.last_run_status),
      candidateCount: asNonNegativeInteger(entry.candidate_count),
      newCandidateCount: asNonNegativeInteger(entry.new_candidate_count),
      promotedCandidateCount: asNonNegativeInteger(entry.promoted_candidate_count),
    }))
    .filter((entry) => entry.sourceId.length > 0 && entry.sourceKey.length > 0 && entry.endpointUrl.length > 0);
}

export function readGovernancePublicAuditVerifierMirrorDiscoveredCandidateBoardRows(
  rows: unknown,
): GovernancePublicAuditVerifierMirrorDiscoveredCandidateBoardRow[] {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => ({
      candidateId: asString(entry.candidate_id),
      sourceId: asString(entry.source_id),
      sourceKey: asString(entry.source_key),
      sourceLabel: asNullableString(entry.source_label),
      trustTier: asString(entry.trust_tier, 'observer'),
      candidateKey: asString(entry.candidate_key),
      candidateLabel: asNullableString(entry.candidate_label),
      endpointUrl: asString(entry.endpoint_url),
      regionCode: asString(entry.region_code, 'GLOBAL'),
      operatorLabel: asString(entry.operator_label, 'unspecified'),
      trustDomain: asString(entry.trust_domain, 'public'),
      candidateStatus: asCandidateStatus(entry.candidate_status),
      discoveryConfidence: asNonNegativeInteger(entry.discovery_confidence),
      lastSeenAt: asNullableString(entry.last_seen_at),
    }))
    .filter((entry) => entry.candidateId.length > 0 && entry.sourceId.length > 0 && entry.candidateKey.length > 0 && entry.endpointUrl.length > 0);
}

export function readGovernancePublicAuditVerifierMirrorDiscoverySummary(
  rows: unknown,
): GovernancePublicAuditVerifierMirrorDiscoverySummary | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row = asRecord(rows[0]);
  if (!row) return null;

  return {
    batchId: asNullableString(row.batch_id),
    lookbackHours: Math.max(1, asNonNegativeInteger(row.lookback_hours, 24)),
    activeSourceCount: asNonNegativeInteger(row.active_source_count),
    candidateCount: asNonNegativeInteger(row.candidate_count),
    newCandidateCount: asNonNegativeInteger(row.new_candidate_count),
    promotedCandidateCount: asNonNegativeInteger(row.promoted_candidate_count),
    lastRunAt: asNullableString(row.last_run_at),
    lastRunStatus: asRunStatus(row.last_run_status),
  };
}

export function readGovernancePublicAuditVerifierMirrorSignerGovernanceSummary(
  rows: unknown,
): GovernancePublicAuditVerifierMirrorSignerGovernanceSummary | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row = asRecord(rows[0]);
  if (!row) return null;

  const policyKey = asString(row.policy_key);
  if (!policyKey) return null;

  return {
    policyKey,
    requireSignerGovernanceApproval: asBoolean(row.require_signer_governance_approval, false),
    minSignerGovernanceIndependentApprovals: Math.max(1, asNonNegativeInteger(row.min_signer_governance_independent_approvals, 1)),
    approvedSignerCount: asNonNegativeInteger(row.approved_signer_count),
    approvedIndependentSignerCount: asNonNegativeInteger(row.approved_independent_signer_count),
    pendingSignerCount: asNonNegativeInteger(row.pending_signer_count),
    rejectedSignerCount: asNonNegativeInteger(row.rejected_signer_count),
    suspendedSignerCount: asNonNegativeInteger(row.suspended_signer_count),
    governanceReady: asBoolean(row.governance_ready, false),
    latestAttestedAt: asNullableString(row.latest_attested_at),
  };
}

export function readGovernancePublicAuditVerifierMirrorSignerGovernanceBoardRows(
  rows: unknown,
): GovernancePublicAuditVerifierMirrorSignerGovernanceBoardRow[] {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => ({
      signerId: asString(entry.signer_id),
      signerKey: asString(entry.signer_key),
      signerLabel: asNullableString(entry.signer_label),
      trustTier: asString(entry.trust_tier, 'observer'),
      isActive: asBoolean(entry.is_active, true),
      governanceStatus: asGovernanceStatus(entry.governance_status),
      requiredIndependentApprovals: Math.max(1, asNonNegativeInteger(entry.required_independent_approvals, 1)),
      approvalCount: asNonNegativeInteger(entry.approval_count),
      independentApprovalCount: asNonNegativeInteger(entry.independent_approval_count),
      communityApprovalCount: asNonNegativeInteger(entry.community_approval_count),
      rejectCount: asNonNegativeInteger(entry.reject_count),
      governanceMet: asBoolean(entry.governance_met, false),
      latestAttestedAt: asNullableString(entry.latest_attested_at),
      governanceLastReviewedAt: asNullableString(entry.governance_last_reviewed_at),
    }))
    .filter((entry) => entry.signerId.length > 0 && entry.signerKey.length > 0);
}
