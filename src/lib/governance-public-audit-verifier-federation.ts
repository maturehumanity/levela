import type {
  GovernancePublicAuditVerifierMirrorDiscoveredCandidateBoardRow,
  GovernancePublicAuditVerifierMirrorDiscoverySourceBoardRow,
  GovernancePublicAuditVerifierMirrorDiscoverySummary,
  GovernancePublicAuditVerifierMirrorFederationAlertBoardRow,
  GovernancePublicAuditVerifierMirrorFederationOnboardingBoardRow,
  GovernancePublicAuditVerifierMirrorFederationOperationsSummary,
  GovernancePublicAuditVerifierMirrorPolicyRatificationSummary,
  GovernancePublicAuditVerifierMirrorSignerGovernanceBoardRow,
  GovernancePublicAuditVerifierMirrorSignerGovernanceSummary,
} from '@/lib/governance-public-audit-verifier-federation.types';

export type {
  GovernancePublicAuditVerifierMirrorDiscoveredCandidateBoardRow,
  GovernancePublicAuditVerifierMirrorDiscoverySourceBoardRow,
  GovernancePublicAuditVerifierMirrorDiscoverySummary,
  GovernancePublicAuditVerifierMirrorFederationAlertBoardRow,
  GovernancePublicAuditVerifierMirrorFederationOnboardingBoardRow,
  GovernancePublicAuditVerifierMirrorFederationOperationsSummary,
  GovernancePublicAuditVerifierMirrorPolicyRatificationSummary,
  GovernancePublicAuditVerifierMirrorSignerGovernanceBoardRow,
  GovernancePublicAuditVerifierMirrorSignerGovernanceSummary,
} from '@/lib/governance-public-audit-verifier-federation.types';

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

function asOperatorOnboardingStatus(value: unknown): GovernancePublicAuditVerifierMirrorFederationOnboardingBoardRow['operatorOnboardingStatus'] {
  const normalized = asString(value).trim().toLowerCase();
  if (normalized === 'pending' || normalized === 'approved' || normalized === 'onboarded' || normalized === 'rejected' || normalized === 'suspended') return normalized;
  return 'unknown';
}

function asOnboardingRequestStatus(value: unknown): GovernancePublicAuditVerifierMirrorFederationOnboardingBoardRow['requestStatus'] {
  const normalized = asString(value).trim().toLowerCase();
  if (normalized === 'pending' || normalized === 'approved' || normalized === 'onboarded' || normalized === 'rejected') return normalized;
  return 'unknown';
}

function asAlertSeverity(value: unknown): GovernancePublicAuditVerifierMirrorFederationAlertBoardRow['severity'] {
  const normalized = asString(value).trim().toLowerCase();
  if (normalized === 'info' || normalized === 'warning' || normalized === 'critical') return normalized;
  return 'unknown';
}

function asAlertStatus(value: unknown): GovernancePublicAuditVerifierMirrorFederationAlertBoardRow['alertStatus'] {
  const normalized = asString(value).trim().toLowerCase();
  if (normalized === 'open' || normalized === 'acknowledged' || normalized === 'resolved') return normalized;
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

export function readGovernancePublicAuditVerifierMirrorFederationOnboardingBoardRows(
  rows: unknown,
): GovernancePublicAuditVerifierMirrorFederationOnboardingBoardRow[] {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => ({
      requestId: asString(entry.request_id),
      operatorId: asString(entry.operator_id),
      operatorKey: asString(entry.operator_key),
      operatorLabel: asNullableString(entry.operator_label),
      operatorOnboardingStatus: asOperatorOnboardingStatus(entry.operator_onboarding_status),
      requestStatus: asOnboardingRequestStatus(entry.request_status),
      requestedMirrorKey: asString(entry.requested_mirror_key),
      requestedMirrorLabel: asNullableString(entry.requested_mirror_label),
      requestedEndpointUrl: asString(entry.requested_endpoint_url),
      requestedRegionCode: asString(entry.requested_region_code, 'GLOBAL'),
      requestedTrustDomain: asString(entry.requested_trust_domain, 'public'),
      onboardedMirrorId: asNullableString(entry.onboarded_mirror_id),
      reviewedAt: asNullableString(entry.reviewed_at),
      createdAt: asNullableString(entry.created_at),
    }))
    .filter((entry) => entry.requestId.length > 0 && entry.operatorId.length > 0 && entry.operatorKey.length > 0 && entry.requestedMirrorKey.length > 0);
}

export function readGovernancePublicAuditVerifierMirrorFederationAlertBoardRows(
  rows: unknown,
): GovernancePublicAuditVerifierMirrorFederationAlertBoardRow[] {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => ({
      alertId: asString(entry.alert_id),
      alertKey: asString(entry.alert_key),
      severity: asAlertSeverity(entry.severity),
      alertScope: asString(entry.alert_scope, 'manual'),
      alertStatus: asAlertStatus(entry.alert_status),
      alertMessage: asString(entry.alert_message),
      openedAt: asNullableString(entry.opened_at),
      resolvedAt: asNullableString(entry.resolved_at),
    }))
    .filter((entry) => entry.alertId.length > 0 && entry.alertKey.length > 0 && entry.alertMessage.length > 0);
}

export function readGovernancePublicAuditVerifierMirrorFederationOperationsSummary(
  rows: unknown,
): GovernancePublicAuditVerifierMirrorFederationOperationsSummary | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row = asRecord(rows[0]);
  if (!row) return null;

  const policyKey = asString(row.policy_key);
  if (!policyKey) return null;

  return {
    policyKey,
    requireFederationOpsReadiness: asBoolean(row.require_federation_ops_readiness, false),
    maxOpenCriticalFederationAlerts: asNonNegativeInteger(row.max_open_critical_federation_alerts),
    minOnboardedFederationOperators: Math.max(1, asNonNegativeInteger(row.min_onboarded_federation_operators, 1)),
    registeredOperatorCount: asNonNegativeInteger(row.registered_operator_count),
    approvedOperatorCount: asNonNegativeInteger(row.approved_operator_count),
    onboardedOperatorCount: asNonNegativeInteger(row.onboarded_operator_count),
    pendingRequestCount: asNonNegativeInteger(row.pending_request_count),
    approvedRequestCount: asNonNegativeInteger(row.approved_request_count),
    onboardedRequestCount: asNonNegativeInteger(row.onboarded_request_count),
    openWarningAlertCount: asNonNegativeInteger(row.open_warning_alert_count),
    openCriticalAlertCount: asNonNegativeInteger(row.open_critical_alert_count),
    alertSlaHours: Math.max(1, asNonNegativeInteger(row.alert_sla_hours, 12)),
    alertSlaBreachedCount: asNonNegativeInteger(row.alert_sla_breached_count),
    lastWorkerRunAt: asNullableString(row.last_worker_run_at),
    lastWorkerRunStatus: asRunStatus(row.last_worker_run_status),
    federationOpsReady: asBoolean(row.federation_ops_ready, false),
  };
}
