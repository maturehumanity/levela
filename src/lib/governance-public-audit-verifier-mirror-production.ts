import type {
  GovernancePublicAuditVerifierMirrorFederationOperationsSummary,
  GovernancePublicAuditVerifierMirrorPolicyRatificationSummary,
} from '@/lib/governance-public-audit-verifier-federation';
import {
  readGovernancePublicAuditVerifierFederationPackageDistributionSummary,
  type GovernancePublicAuditVerifierFederationPackageDistributionSummary,
} from '@/lib/governance-public-audit-verifier-federation-distribution';
import type {
  GovernancePublicAuditClientMirrorFailoverTarget,
  GovernancePublicAuditVerifierMirrorDirectorySummaryRow,
  GovernancePublicAuditVerifierMirrorDirectoryTrustSummary,
  GovernancePublicAuditVerifierMirrorFailoverPolicySummary,
  GovernancePublicAuditVerifierMirrorFederationDiversitySummary,
  GovernancePublicAuditVerifierMirrorProbeJobBoardRow,
  GovernancePublicAuditVerifierMirrorProbeJobStatus,
  GovernancePublicAuditVerifierMirrorProbeJobSummary,
} from '@/lib/governance-public-audit-verifier-mirror-production.types';

export type {
  GovernancePublicAuditClientMirrorFailoverTarget,
  GovernancePublicAuditVerifierMirrorDirectorySummaryRow,
  GovernancePublicAuditVerifierMirrorDirectoryTrustSummary,
  GovernancePublicAuditVerifierMirrorFailoverPolicySummary,
  GovernancePublicAuditVerifierMirrorFederationDiversitySummary,
  GovernancePublicAuditVerifierMirrorProbeJobBoardRow,
  GovernancePublicAuditVerifierMirrorProbeJobStatus,
  GovernancePublicAuditVerifierMirrorProbeJobSummary,
} from '@/lib/governance-public-audit-verifier-mirror-production.types';

function asNonNegativeInteger(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return Math.max(0, parsed);
  }
  return fallback;
}

function asNullableInteger(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return Math.max(0, parsed);
  }
  return null;
}

function asNonNegativeNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value);
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return Math.max(0, parsed);
  }
  return fallback;
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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asMirrorStatus(value: unknown): GovernancePublicAuditVerifierMirrorProbeJobBoardRow['observedCheckStatus'] {
  const normalized = asString(value).trim().toLowerCase();
  if (normalized === 'ok' || normalized === 'degraded' || normalized === 'failed') return normalized;
  return 'unknown';
}

function asProbeJobStatus(value: unknown): GovernancePublicAuditVerifierMirrorProbeJobStatus {
  const normalized = asString(value).trim().toLowerCase();
  if (normalized === 'running' || normalized === 'completed' || normalized === 'failed' || normalized === 'cancelled') return normalized;
  return 'pending';
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

export function readFailoverPolicyRecord(
  row: Record<string, unknown> | null,
): GovernancePublicAuditVerifierMirrorFailoverPolicySummary | null {
  if (!row) return null;

  const policyKey = asString(row.policy_key);
  const policyName = asString(row.policy_name);
  if (!policyKey || !policyName) return null;

  return {
    policyId: asNullableString(row.policy_id),
    policyKey,
    policyName,
    isActive: asBoolean(row.is_active, true),
    minHealthyMirrors: Math.max(1, asNonNegativeInteger(row.min_healthy_mirrors, 1)),
    maxMirrorLatencyMs: Math.max(100, asNonNegativeInteger(row.max_mirror_latency_ms, 2500)),
    maxFailuresBeforeCooldown: Math.max(1, asNonNegativeInteger(row.max_failures_before_cooldown, 2)),
    cooldownMinutes: Math.max(1, asNonNegativeInteger(row.cooldown_minutes, 10)),
    preferSameRegion: asBoolean(row.prefer_same_region, false),
    requiredDistinctRegions: Math.max(1, asNonNegativeInteger(row.required_distinct_regions, 1)),
    requiredDistinctOperators: Math.max(1, asNonNegativeInteger(row.required_distinct_operators, 1)),
    mirrorSelectionStrategy: asString(row.mirror_selection_strategy, 'health_latency_diversity'),
    maxMirrorCandidates: Math.max(1, asNonNegativeInteger(row.max_mirror_candidates, 8)),
    minIndependentDirectorySigners: Math.max(1, asNonNegativeInteger(row.min_independent_directory_signers, 1)),
    requirePolicyRatification: asBoolean(row.require_policy_ratification, false),
    minPolicyRatificationApprovals: Math.max(1, asNonNegativeInteger(row.min_policy_ratification_approvals, 1)),
    requireSignerGovernanceApproval: asBoolean(row.require_signer_governance_approval, false),
    minSignerGovernanceIndependentApprovals: Math.max(1, asNonNegativeInteger(row.min_signer_governance_independent_approvals, 1)),
    requireFederationOpsReadiness: asBoolean(row.require_federation_ops_readiness, false),
    maxOpenCriticalFederationAlerts: asNonNegativeInteger(row.max_open_critical_federation_alerts),
    minOnboardedFederationOperators: Math.max(1, asNonNegativeInteger(row.min_onboarded_federation_operators, 1)),
    updatedAt: asNullableString(row.updated_at),
  };
}

export function readGovernancePublicAuditVerifierMirrorFailoverPolicySummary(
  rows: unknown,
): GovernancePublicAuditVerifierMirrorFailoverPolicySummary | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return readFailoverPolicyRecord(asRecord(rows[0]));
}

export function readGovernancePublicAuditVerifierMirrorDirectorySummaryRows(
  rows: unknown,
): GovernancePublicAuditVerifierMirrorDirectorySummaryRow[] {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => ({
      directoryId: asString(entry.directory_id),
      batchId: asNullableString(entry.batch_id),
      directoryVersion: asString(entry.directory_version),
      directoryHash: asString(entry.directory_hash),
      signerId: asString(entry.signer_id),
      signerKey: asString(entry.signer_key),
      signerLabel: asNullableString(entry.signer_label),
      trustTier: asString(entry.trust_tier, 'observer'),
      signature: asString(entry.signature),
      signatureAlgorithm: asString(entry.signature_algorithm, 'ed25519'),
      publishedAt: asString(entry.published_at),
      isLatestForBatch: Boolean(entry.is_latest_for_batch),
    }))
    .filter((entry) => entry.directoryId.length > 0 && entry.directoryHash.length > 0 && entry.signerKey.length > 0);
}

export function readGovernancePublicAuditVerifierMirrorProbeJobSummary(
  rows: unknown,
): GovernancePublicAuditVerifierMirrorProbeJobSummary | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row = asRecord(rows[0]);
  if (!row) return null;

  return {
    batchId: asNullableString(row.batch_id),
    pendingSlaMinutes: Math.max(1, asNonNegativeInteger(row.pending_sla_minutes, 30)),
    lookbackHours: Math.max(1, asNonNegativeInteger(row.lookback_hours, 24)),
    pendingCount: asNonNegativeInteger(row.pending_count),
    runningCount: asNonNegativeInteger(row.running_count),
    stalePendingCount: asNonNegativeInteger(row.stale_pending_count),
    failedLookbackCount: asNonNegativeInteger(row.failed_lookback_count),
    completedLookbackCount: asNonNegativeInteger(row.completed_lookback_count),
    oldestPendingAt: asNullableString(row.oldest_pending_at),
    pendingSlaMet: asBoolean(row.pending_sla_met, true),
  };
}

export function readGovernancePublicAuditVerifierMirrorProbeJobBoardRows(
  rows: unknown,
): GovernancePublicAuditVerifierMirrorProbeJobBoardRow[] {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => ({
      jobId: asString(entry.job_id),
      batchId: asNullableString(entry.batch_id),
      mirrorId: asString(entry.mirror_id),
      mirrorKey: asString(entry.mirror_key),
      mirrorLabel: asNullableString(entry.mirror_label),
      endpointUrl: asString(entry.endpoint_url),
      status: asProbeJobStatus(entry.status),
      scheduledAt: asString(entry.scheduled_at),
      completedAt: asNullableString(entry.completed_at),
      observedCheckStatus: asMirrorStatus(entry.observed_check_status),
      observedLatencyMs: asNullableInteger(entry.observed_latency_ms),
      observedBatchHash: asNullableString(entry.observed_batch_hash),
      errorMessage: asNullableString(entry.error_message),
    }))
    .filter((entry) => entry.jobId.length > 0 && entry.mirrorId.length > 0 && entry.mirrorKey.length > 0);
}

export function readGovernancePublicAuditVerifierMirrorDirectoryTrustSummary(
  rows: unknown,
): GovernancePublicAuditVerifierMirrorDirectoryTrustSummary | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row = asRecord(rows[0]);
  if (!row) return null;

  const directoryId = asNullableString(row.directory_id);
  const directoryHash = asNullableString(row.directory_hash);
  const publishedAt = asNullableString(row.published_at);
  if (!directoryId || !directoryHash || !publishedAt) return null;

  return {
    directoryId,
    batchId: asNullableString(row.batch_id),
    directoryHash,
    publishedAt,
    requiredIndependentSigners: Math.max(1, asNonNegativeInteger(row.required_independent_signers, 1)),
    approvalCount: asNonNegativeInteger(row.approval_count),
    independentApprovalCount: asNonNegativeInteger(row.independent_approval_count),
    communityApprovalCount: asNonNegativeInteger(row.community_approval_count),
    rejectCount: asNonNegativeInteger(row.reject_count),
    trustQuorumMet: asBoolean(row.trust_quorum_met, false),
  };
}

export function readGovernancePublicAuditClientVerifierBundleProductionData(bundlePayload: Record<string, unknown>) {
  const failoverPolicy = readFailoverPolicyRecord(asRecord(bundlePayload.failover_policy));

  const failoverOrder = Array.isArray(bundlePayload.failover_order)
    ? bundlePayload.failover_order
      .map((entry) => asRecord(entry))
      .filter((entry): entry is Record<string, unknown> => Boolean(entry))
      .map((entry) => ({
        mirrorId: asString(entry.mirror_id),
        mirrorKey: asString(entry.mirror_key),
        mirrorLabel: asNullableString(entry.mirror_label),
        regionCode: asString(entry.region_code, 'GLOBAL'),
        operatorLabel: asString(entry.operator_label, 'unspecified'),
        healthStatus: asString(entry.health_status, 'unknown'),
        lastCheckLatencyMs: asNullableInteger(entry.last_check_latency_ms),
        failoverRank: Math.max(1, asNonNegativeInteger(entry.failover_rank, 1)),
      }))
      .filter((entry) => entry.mirrorId.length > 0 && entry.mirrorKey.length > 0)
    : [];

  const signedDirectory = asRecord(bundlePayload.signed_directory);
  const signedDirectoryTrust = asRecord(bundlePayload.signed_directory_trust);
  const policyRatification = asRecord(bundlePayload.policy_ratification);
  const federationDiversity = asRecord(bundlePayload.federation_diversity);
  const federationOperations = asRecord(bundlePayload.federation_operations);
  const federationDistribution = asRecord(bundlePayload.federation_distribution);

  return {
    failoverPolicy,
    failoverOrder,
    signedDirectoryHash: signedDirectory ? asNullableString(signedDirectory.directory_hash) : null,
    signedDirectorySignature: signedDirectory ? asNullableString(signedDirectory.signature) : null,
    signedDirectorySignerKey: signedDirectory ? asNullableString(signedDirectory.signer_key) : null,
    signedDirectoryTrust: signedDirectoryTrust
      ? readGovernancePublicAuditVerifierMirrorDirectoryTrustSummary([signedDirectoryTrust])
      : null,
    federationDiversity: federationDiversity
      ? {
        batchId: asNullableString(federationDiversity.batch_id),
        requiredDistinctRegions: Math.max(1, asNonNegativeInteger(federationDiversity.required_distinct_regions, 1)),
        requiredDistinctOperators: Math.max(1, asNonNegativeInteger(federationDiversity.required_distinct_operators, 1)),
        selectedMirrorCount: asNonNegativeInteger(federationDiversity.selected_mirror_count),
        healthyMirrorCount: asNonNegativeInteger(federationDiversity.healthy_mirror_count),
        distinctRegionCount: asNonNegativeInteger(federationDiversity.distinct_region_count),
        distinctOperatorCount: asNonNegativeInteger(federationDiversity.distinct_operator_count),
        largestOperatorMirrorCount: asNonNegativeInteger(federationDiversity.largest_operator_mirror_count),
        largestOperatorSharePercent: asNonNegativeNumber(federationDiversity.largest_operator_share_percent),
        meetsRegionDiversity: asBoolean(federationDiversity.meets_region_diversity, false),
        meetsOperatorDiversity: asBoolean(federationDiversity.meets_operator_diversity, false),
      } as GovernancePublicAuditVerifierMirrorFederationDiversitySummary
      : null,
    federationOperations: federationOperations
      ? {
        policyKey: asString(federationOperations.policy_key, 'default'),
        requireFederationOpsReadiness: asBoolean(federationOperations.require_federation_ops_readiness, false),
        maxOpenCriticalFederationAlerts: asNonNegativeInteger(federationOperations.max_open_critical_federation_alerts),
        minOnboardedFederationOperators: Math.max(1, asNonNegativeInteger(federationOperations.min_onboarded_federation_operators, 1)),
        registeredOperatorCount: asNonNegativeInteger(federationOperations.registered_operator_count),
        approvedOperatorCount: asNonNegativeInteger(federationOperations.approved_operator_count),
        onboardedOperatorCount: asNonNegativeInteger(federationOperations.onboarded_operator_count),
        pendingRequestCount: asNonNegativeInteger(federationOperations.pending_request_count),
        approvedRequestCount: asNonNegativeInteger(federationOperations.approved_request_count),
        onboardedRequestCount: asNonNegativeInteger(federationOperations.onboarded_request_count),
        openWarningAlertCount: asNonNegativeInteger(federationOperations.open_warning_alert_count),
        openCriticalAlertCount: asNonNegativeInteger(federationOperations.open_critical_alert_count),
        alertSlaHours: Math.max(1, asNonNegativeInteger(federationOperations.alert_sla_hours, 12)),
        alertSlaBreachedCount: asNonNegativeInteger(federationOperations.alert_sla_breached_count),
        lastWorkerRunAt: asNullableString(federationOperations.last_worker_run_at),
        lastWorkerRunStatus: asMirrorStatus(federationOperations.last_worker_run_status),
        distributionVerificationLookbackHours: Math.max(1, asNonNegativeInteger(federationOperations.distribution_verification_lookback_hours, 24)),
        lastDistributionVerificationRunAt: asNullableString(federationOperations.last_distribution_verification_run_at),
        lastDistributionVerificationRunStatus: asMirrorStatus(federationOperations.last_distribution_verification_run_status),
        distributionVerificationStale: asBoolean(federationOperations.distribution_verification_stale, true),
        openDistributionStalePackageAlertCount: asNonNegativeInteger(federationOperations.open_distribution_stale_package_alert_count),
        openDistributionBadSignatureAlertCount: asNonNegativeInteger(federationOperations.open_distribution_bad_signature_alert_count),
        openDistributionPolicyMismatchAlertCount: asNonNegativeInteger(federationOperations.open_distribution_policy_mismatch_alert_count),
        openDistributionVerificationAlertCount: asNonNegativeInteger(federationOperations.open_distribution_verification_alert_count),
        federationOpsReady: asBoolean(federationOperations.federation_ops_ready, false),
      } as GovernancePublicAuditVerifierMirrorFederationOperationsSummary
      : null,
    federationDistribution: federationDistribution
      ? readGovernancePublicAuditVerifierFederationPackageDistributionSummary([federationDistribution]) as GovernancePublicAuditVerifierFederationPackageDistributionSummary | null
      : null,
    policyRatification: policyRatification
      ? {
        policyKey: asString(policyRatification.policy_key),
        policyHash: asString(policyRatification.policy_hash),
        requirePolicyRatification: asBoolean(policyRatification.require_policy_ratification, false),
        minPolicyRatificationApprovals: Math.max(1, asNonNegativeInteger(policyRatification.min_policy_ratification_approvals, 1)),
        requiredIndependentSigners: Math.max(1, asNonNegativeInteger(policyRatification.required_independent_signers, 1)),
        approvalCount: asNonNegativeInteger(policyRatification.approval_count),
        independentApprovalCount: asNonNegativeInteger(policyRatification.independent_approval_count),
        communityApprovalCount: asNonNegativeInteger(policyRatification.community_approval_count),
        rejectCount: asNonNegativeInteger(policyRatification.reject_count),
        ratificationMet: asBoolean(policyRatification.ratification_met, false),
        latestRatifiedAt: asNullableString(policyRatification.latest_ratified_at),
      } as GovernancePublicAuditVerifierMirrorPolicyRatificationSummary
      : null,
  };
}

const MIRROR_TRUST_TIER_LABELS: Record<string, string> = {
  observer: 'Observer',
  independent: 'Independent',
  community: 'Community',
  bootstrap: 'Bootstrap',
};

function humanizeMirrorTrustTierFallback(raw: string): string {
  const cleaned = raw.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned.length) return 'Unknown trust tier';
  return cleaned.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

export function formatGovernancePublicAuditVerifierMirrorTrustTierLabel(trustTier: string): string {
  const key = trustTier.trim().toLowerCase();
  return MIRROR_TRUST_TIER_LABELS[key] ?? humanizeMirrorTrustTierFallback(trustTier);
}

export function formatGovernancePublicAuditVerifierMirrorProbeJobLifecycleStatusLabel(
  status: GovernancePublicAuditVerifierMirrorProbeJobStatus,
): string {
  if (status === 'pending') return 'Pending';
  if (status === 'running') return 'Running';
  if (status === 'completed') return 'Completed';
  if (status === 'failed') return 'Failed';
  if (status === 'cancelled') return 'Cancelled';
  return 'Unknown status';
}
