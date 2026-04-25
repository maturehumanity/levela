import type {
  GovernancePublicAuditVerifierFederationExchangeReceiptAutomationRunRow,
  GovernancePublicAuditVerifierFederationExchangeReceiptEscalationHistoryRow,
  GovernancePublicAuditVerifierFederationExchangeReceiptAutomationStatus,
  GovernancePublicAuditVerifierFederationExchangeReceiptPolicyEventRow,
  GovernancePublicAuditVerifierFederationExchangeReceiptPolicySummary,
  GovernancePublicAuditVerifierFederationExchangeAttestationRow,
  GovernancePublicAuditVerifierFederationExchangeAttestationSummary,
  GovernancePublicAuditVerifierFederationDistributionGateSnapshot,
  GovernancePublicAuditVerifierFederationPackage,
  GovernancePublicAuditVerifierFederationPackageDistributionSummary,
  GovernancePublicAuditVerifierFederationPackageHistoryRow,
  GovernancePublicAuditVerifierFederationPackageSignatureRow,
  GovernancePublicAuditVerifierFederationRecentPackageRow,
  GovernancePublicAuditVerifierMirrorFederationOperationsSummary,
} from '@/lib/governance-public-audit-verifier-federation.types';

export type {
  GovernancePublicAuditVerifierFederationExchangeReceiptAutomationRunRow,
  GovernancePublicAuditVerifierFederationExchangeReceiptEscalationHistoryRow,
  GovernancePublicAuditVerifierFederationExchangeReceiptAutomationStatus,
  GovernancePublicAuditVerifierFederationExchangeReceiptPolicyEventRow,
  GovernancePublicAuditVerifierFederationExchangeReceiptPolicySummary,
  GovernancePublicAuditVerifierFederationExchangeAttestationRow,
  GovernancePublicAuditVerifierFederationExchangeAttestationSummary,
  GovernancePublicAuditVerifierFederationDistributionGateSnapshot,
  GovernancePublicAuditVerifierFederationPackage,
  GovernancePublicAuditVerifierFederationPackageDistributionSummary,
  GovernancePublicAuditVerifierFederationPackageHistoryRow,
  GovernancePublicAuditVerifierFederationPackageSignatureRow,
  GovernancePublicAuditVerifierFederationRecentPackageRow,
  GovernancePublicAuditVerifierMirrorFederationOperationsSummary,
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

function asNullableNonNegativeInteger(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return Math.max(0, parsed);
  }
  return null;
}

function asAttestationVerdict(
  value: unknown,
): GovernancePublicAuditVerifierFederationExchangeAttestationRow['attestationVerdict'] {
  const normalized = asString(value).trim().toLowerCase();
  if (normalized === 'accepted' || normalized === 'rejected' || normalized === 'needs_followup') return normalized;
  return 'unknown';
}

function asPolicyEventType(
  value: unknown,
): GovernancePublicAuditVerifierFederationExchangeReceiptPolicyEventRow['eventType'] {
  const normalized = asString(value).trim().toLowerCase();
  if (normalized === 'created' || normalized === 'updated' || normalized === 'rollback') return normalized;
  return 'unknown';
}

function asEscalationSeverity(
  value: unknown,
): GovernancePublicAuditVerifierFederationExchangeReceiptEscalationHistoryRow['severity'] {
  const normalized = asString(value).trim().toLowerCase();
  if (normalized === 'info' || normalized === 'warning' || normalized === 'critical') return normalized;
  return 'unknown';
}

function asEscalationStatus(
  value: unknown,
): GovernancePublicAuditVerifierFederationExchangeReceiptEscalationHistoryRow['pageStatus'] {
  const normalized = asString(value).trim().toLowerCase();
  if (normalized === 'open' || normalized === 'acknowledged' || normalized === 'resolved') return normalized;
  return 'unknown';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function readGovernancePublicAuditVerifierFederationExchangeAttestationSummary(
  rows: unknown,
): GovernancePublicAuditVerifierFederationExchangeAttestationSummary | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row = asRecord(rows[0]);
  if (!row) return null;

  return {
    batchId: asNullableString(row.batch_id),
    lookbackHours: asNonNegativeInteger(row.lookback_hours, 168),
    attestationCount: asNonNegativeInteger(row.attestation_count),
    acceptedCount: asNonNegativeInteger(row.accepted_count),
    rejectedCount: asNonNegativeInteger(row.rejected_count),
    needsFollowupCount: asNonNegativeInteger(row.needs_followup_count),
    distinctOperatorCount: asNonNegativeInteger(row.distinct_operator_count),
    distinctExternalOperatorCount: asNonNegativeInteger(row.distinct_external_operator_count),
    receiptEvidenceCount: asNonNegativeInteger(row.receipt_evidence_count),
    receiptVerifiedCount: asNonNegativeInteger(row.receipt_verified_count),
    receiptPendingVerificationCount: asNonNegativeInteger(row.receipt_pending_verification_count),
    latestAttestedAt: asNullableString(row.latest_attested_at),
  };
}

export function readGovernancePublicAuditVerifierFederationExchangeAttestationRows(
  rows: unknown,
): GovernancePublicAuditVerifierFederationExchangeAttestationRow[] {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => ({
      attestationId: asString(entry.attestation_id),
      packageId: asString(entry.package_id),
      batchId: asString(entry.batch_id),
      packageHash: asString(entry.package_hash),
      operatorLabel: asString(entry.operator_label),
      operatorIdentityUri: asNullableString(entry.operator_identity_uri),
      operatorTrustDomain: asString(entry.operator_trust_domain, 'external'),
      operatorJurisdictionCountryCode: asNullableString(entry.operator_jurisdiction_country_code),
      exchangeChannel: asString(entry.exchange_channel, 'api'),
      attestationVerdict: asAttestationVerdict(entry.attestation_verdict),
      attestationNotes: asNullableString(entry.attestation_notes),
      attestationMetadata: asRecord(entry.attestation_metadata),
      receiptPayload: asRecord(entry.receipt_payload),
      receiptSignature: asNullableString(entry.receipt_signature),
      receiptSignerKey: asNullableString(entry.receipt_signer_key),
      receiptSignatureAlgorithm: asNullableString(entry.receipt_signature_algorithm),
      receiptVerified: asBoolean(entry.receipt_verified, false),
      receiptVerifiedAt: asNullableString(entry.receipt_verified_at),
      receiptVerificationNotes: asNullableString(entry.receipt_verification_notes),
      receiptVerifiedBy: asNullableString(entry.receipt_verified_by),
      receiptVerifiedByName: asNullableString(entry.receipt_verified_by_name),
      attestedBy: asNullableString(entry.attested_by),
      attestedByName: asNullableString(entry.attested_by_name),
      attestedAt: asNullableString(entry.attested_at),
    }))
    .filter((entry) => entry.attestationId.length > 0 && entry.packageId.length > 0 && entry.operatorLabel.length > 0);
}

export function readGovernancePublicAuditVerifierFederationExchangeReceiptPolicySummary(
  rows: unknown,
): GovernancePublicAuditVerifierFederationExchangeReceiptPolicySummary | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row = asRecord(rows[0]);
  if (!row) return null;

  return {
    policyKey: asString(row.policy_key),
    policyName: asString(row.policy_name),
    lookbackHours: asNonNegativeInteger(row.lookback_hours, 336),
    warningPendingThreshold: asNonNegativeInteger(row.warning_pending_threshold, 1),
    criticalPendingThreshold: asNonNegativeInteger(row.critical_pending_threshold, 5),
    escalationEnabled: asBoolean(row.escalation_enabled, true),
    oncallChannel: asString(row.oncall_channel, 'public_audit_ops'),
    receiptMaxVerificationAgeHours: asNonNegativeInteger(row.receipt_max_verification_age_hours, 72),
    criticalStaleReceiptCountThreshold: asNonNegativeInteger(row.critical_stale_receipt_count_threshold, 3),
    metadata: asRecord(row.metadata),
    updatedAt: asNullableString(row.updated_at),
    updatedBy: asNullableString(row.updated_by),
    updatedByName: asNullableString(row.updated_by_name),
  };
}

export function readGovernancePublicAuditVerifierFederationExchangeReceiptAutomationStatus(
  rows: unknown,
): GovernancePublicAuditVerifierFederationExchangeReceiptAutomationStatus | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row = asRecord(rows[0]);
  if (!row) return null;

  return {
    cronSchemaAvailable: asBoolean(row.cron_schema_available, false),
    cronJobRegistered: asBoolean(row.cron_job_registered, false),
    cronJobActive: asBoolean(row.cron_job_active, false),
    cronJobSchedule: asNullableString(row.cron_job_schedule),
    cronJobCommand: asNullableString(row.cron_job_command),
    latestCronRunStartedAt: asNullableString(row.latest_cron_run_started_at),
    latestCronRunFinishedAt: asNullableString(row.latest_cron_run_finished_at),
    latestCronRunStatus: asNullableString(row.latest_cron_run_status),
    latestCronRunDetails: asNullableString(row.latest_cron_run_details),
    latestPendingReceiptAttestedAt: asNullableString(row.latest_pending_receipt_attested_at),
    latestVerifiedReceiptAt: asNullableString(row.latest_verified_receipt_at),
    latestEscalationPageOpenedAt: asNullableString(row.latest_escalation_page_opened_at),
    latestEscalationPageStatus: asNullableString(row.latest_escalation_page_status),
    latestAutomationRunStartedAt: asNullableString(row.latest_automation_run_started_at),
    latestAutomationRunFinishedAt: asNullableString(row.latest_automation_run_finished_at),
    latestAutomationRunStatus: asNullableString(row.latest_automation_run_status),
    latestAutomationRunMessage: asNullableString(row.latest_automation_run_message),
    latestAutomationRunTriggerSource: asNullableString(row.latest_automation_run_trigger_source),
  };
}

export function readGovernancePublicAuditVerifierFederationExchangeReceiptAutomationRunRows(
  rows: unknown,
): GovernancePublicAuditVerifierFederationExchangeReceiptAutomationRunRow[] {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => ({
      runId: asString(entry.run_id),
      triggeredBy: asNullableString(entry.triggered_by),
      triggeredByName: asNullableString(entry.triggered_by_name),
      triggerSource: asString(entry.trigger_source, 'unknown'),
      requestedLookbackHours: asNullableNonNegativeInteger(entry.requested_lookback_hours),
      runStartedAt: asNullableString(entry.run_started_at),
      runFinishedAt: asNullableString(entry.run_finished_at),
      runStatus: asString(entry.run_status, 'unknown'),
      runMessage: asNullableString(entry.run_message),
      receiptPendingCount: asNonNegativeInteger(entry.receipt_pending_count),
      staleReceiptCount: asNonNegativeInteger(entry.stale_receipt_count),
      criticalBacklog: asBoolean(entry.critical_backlog, false),
      openOrAckPageCount: asNonNegativeInteger(entry.open_or_ack_page_count),
    }))
    .filter((entry) => entry.runId.length > 0);
}

export function readGovernancePublicAuditVerifierFederationExchangeReceiptEscalationHistoryRows(
  rows: unknown,
): GovernancePublicAuditVerifierFederationExchangeReceiptEscalationHistoryRow[] {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => ({
      pageId: asString(entry.page_id),
      batchId: asNullableString(entry.batch_id),
      pageKey: asString(entry.page_key),
      severity: asEscalationSeverity(entry.severity),
      pageStatus: asEscalationStatus(entry.page_status),
      pageMessage: asString(entry.page_message),
      oncallChannel: asString(entry.oncall_channel, 'public_audit_ops'),
      openedAt: asNullableString(entry.opened_at),
      acknowledgedAt: asNullableString(entry.acknowledged_at),
      resolvedAt: asNullableString(entry.resolved_at),
      updatedAt: asNullableString(entry.updated_at),
    }))
    .filter((entry) => entry.pageId.length > 0);
}

export function readGovernancePublicAuditVerifierFederationExchangeReceiptPolicyEventRows(
  rows: unknown,
): GovernancePublicAuditVerifierFederationExchangeReceiptPolicyEventRow[] {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => ({
      eventId: asString(entry.event_id),
      policyKey: asString(entry.policy_key),
      eventType: asPolicyEventType(entry.event_type),
      actorProfileId: asNullableString(entry.actor_profile_id),
      actorName: asNullableString(entry.actor_name),
      eventMessage: asString(entry.event_message),
      metadata: asRecord(entry.metadata),
      createdAt: asNullableString(entry.created_at),
    }))
    .filter((entry) => entry.eventId.length > 0 && entry.policyKey.length > 0);
}

export function readGovernancePublicAuditVerifierFederationPackage(
  rows: unknown,
): GovernancePublicAuditVerifierFederationPackage | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row = asRecord(rows[0]);
  if (!row) return null;

  const packageVersion = asString(row.package_version);
  const packageHash = asString(row.package_hash);
  const packagePayload = asRecord(row.package_payload);
  const batchId = asString(row.batch_id);
  const sourceDirectoryId = asString(row.source_directory_id);
  const sourceDirectoryHash = asString(row.source_directory_hash);

  if (!packageVersion || !packageHash || !packagePayload || !batchId || !sourceDirectoryId || !sourceDirectoryHash) {
    return null;
  }

  return {
    packageVersion,
    packageHash,
    packagePayload,
    batchId,
    sourceDirectoryId,
    sourceDirectoryHash,
    federationOpsReady: asBoolean(row.federation_ops_ready, false),
    digestSourceText: asNullableString(row.digest_source_text),
  };
}

export function readGovernancePublicAuditVerifierFederationPackageHistoryRows(
  rows: unknown,
): GovernancePublicAuditVerifierFederationPackageHistoryRow[] {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => ({
      packageId: asString(entry.package_id),
      batchId: asString(entry.batch_id),
      capturedAt: asString(entry.captured_at),
      packageVersion: asString(entry.package_version),
      packageHash: asString(entry.package_hash),
      sourceDirectoryId: asString(entry.source_directory_id),
      signatureCount: asNonNegativeInteger(entry.signature_count),
    }))
    .filter((entry) => entry.packageId.length > 0 && entry.batchId.length > 0 && entry.capturedAt.length > 0);
}

export function readGovernancePublicAuditVerifierFederationRecentPackageRows(
  rows: unknown,
): GovernancePublicAuditVerifierFederationRecentPackageRow[] {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => {
      const metadata = asRecord(entry.metadata);

      return {
        packageId: asString(entry.id),
        batchId: asString(entry.batch_id),
        capturedAt: asString(entry.captured_at),
        packageVersion: asString(entry.package_version),
        packageHash: asString(entry.package_hash),
        sourceDirectoryId: asString(entry.source_directory_id),
        sourceDirectoryHash: asString(entry.source_directory_hash),
        signatureCount: asNonNegativeInteger(entry.signature_count),
        distributionReady: asBoolean(entry.distribution_ready, false),
        packageNotes: asNullableString(metadata?.notes),
      };
    })
    .filter((entry) => entry.packageId.length > 0 && entry.batchId.length > 0 && entry.capturedAt.length > 0);
}

export function readGovernancePublicAuditVerifierFederationPackageDistributionSummary(
  rows: unknown,
): GovernancePublicAuditVerifierFederationPackageDistributionSummary | null {
  const snapshot = readGovernancePublicAuditVerifierFederationDistributionGateSnapshot(rows);
  if (!snapshot || !snapshot.hasCapturedPackage) return null;

  return {
    packageId: snapshot.packageId as string,
    batchId: snapshot.batchId as string,
    capturedAt: snapshot.capturedAt as string,
    packageVersion: snapshot.packageVersion,
    packageHash: snapshot.packageHash,
    sourceDirectoryHash: snapshot.sourceDirectoryHash,
    requiredDistributionSignatures: snapshot.requiredDistributionSignatures,
    signatureCount: snapshot.signatureCount,
    distinctSignerCount: snapshot.distinctSignerCount,
    distinctSignerJurisdictionsCount: snapshot.distinctSignerJurisdictionsCount,
    distinctSignerTrustDomainsCount: snapshot.distinctSignerTrustDomainsCount,
    lastSignedAt: snapshot.lastSignedAt,
    federationOpsReady: snapshot.federationOpsReady,
    distributionReady: snapshot.distributionReady,
  };
}

export function readGovernancePublicAuditVerifierFederationDistributionGateSnapshot(
  rows: unknown,
): GovernancePublicAuditVerifierFederationDistributionGateSnapshot | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row = asRecord(rows[0]);
  if (!row) return null;

  const packageIdRaw = asString(row.package_id);
  const batchIdRaw = asString(row.batch_id);
  const capturedAtRaw = asString(row.captured_at);
  const packageVersion = asString(row.package_version);
  const packageHash = asString(row.package_hash);
  const sourceDirectoryHash = asString(row.source_directory_hash);
  const hasCapturedPackage =
    packageIdRaw.length > 0
    && batchIdRaw.length > 0
    && capturedAtRaw.length > 0
    && packageVersion.length > 0
    && packageHash.length > 0
    && sourceDirectoryHash.length > 0;

  return {
    hasCapturedPackage,
    packageId: hasCapturedPackage ? packageIdRaw : null,
    batchId: hasCapturedPackage ? batchIdRaw : null,
    capturedAt: hasCapturedPackage ? capturedAtRaw : null,
    packageVersion,
    packageHash,
    sourceDirectoryHash,
    requiredDistributionSignatures: Math.max(1, asNonNegativeInteger(row.required_distribution_signatures, 1)),
    signatureCount: asNonNegativeInteger(row.signature_count),
    distinctSignerCount: asNonNegativeInteger(row.distinct_signer_count),
    distinctSignerJurisdictionsCount: asNonNegativeInteger(row.distinct_signer_jurisdictions_count),
    distinctSignerTrustDomainsCount: asNonNegativeInteger(row.distinct_signer_trust_domains_count),
    lastSignedAt: asNullableString(row.last_signed_at),
    federationOpsReady: asBoolean(row.federation_ops_ready, false),
    distributionReady: asBoolean(row.distribution_ready, false),
  };
}

export type GovernancePublicAuditVerifierFederationOpsReadinessIssue =
  | 'operators_below_minimum'
  | 'critical_alert_budget_exceeded'
  | 'alert_sla_breaches_open'
  | 'distribution_verification_stale'
  | 'distribution_verification_alerts_open'
  | 'worker_run_not_ok'
  | 'federation_ops_not_ready';

export type GovernancePublicAuditVerifierFederationDistributionReadinessIssue =
  | 'missing_distribution_package'
  | 'distribution_signatures_below_required'
  | 'federation_ops_not_ready'
  | 'distribution_gate_not_ready';

export function readGovernancePublicAuditVerifierFederationOpsReadinessIssues(
  summary: GovernancePublicAuditVerifierMirrorFederationOperationsSummary | null,
): GovernancePublicAuditVerifierFederationOpsReadinessIssue[] {
  if (!summary) return ['federation_ops_not_ready'];

  const issues: GovernancePublicAuditVerifierFederationOpsReadinessIssue[] = [];
  if (summary.onboardedOperatorCount < summary.minOnboardedFederationOperators) {
    issues.push('operators_below_minimum');
  }
  if (summary.openCriticalAlertCount > summary.maxOpenCriticalFederationAlerts) {
    issues.push('critical_alert_budget_exceeded');
  }
  if (summary.alertSlaBreachedCount > 0) {
    issues.push('alert_sla_breaches_open');
  }
  if (summary.distributionVerificationStale) {
    issues.push('distribution_verification_stale');
  }
  if (summary.openDistributionVerificationAlertCount > 0) {
    issues.push('distribution_verification_alerts_open');
  }
  if (summary.lastWorkerRunStatus !== 'ok') {
    issues.push('worker_run_not_ok');
  }
  if (!summary.federationOpsReady) {
    issues.push('federation_ops_not_ready');
  }
  return issues;
}

export function readGovernancePublicAuditVerifierFederationDistributionReadinessIssues(args: {
  snapshot: GovernancePublicAuditVerifierFederationDistributionGateSnapshot | null;
  federationOperationsSummary: GovernancePublicAuditVerifierMirrorFederationOperationsSummary | null;
}): GovernancePublicAuditVerifierFederationDistributionReadinessIssue[] {
  const { snapshot, federationOperationsSummary } = args;
  if (!snapshot) return ['missing_distribution_package', 'distribution_gate_not_ready'];

  const issues: GovernancePublicAuditVerifierFederationDistributionReadinessIssue[] = [];
  if (!snapshot.hasCapturedPackage) {
    issues.push('missing_distribution_package');
  }
  if (snapshot.signatureCount < snapshot.requiredDistributionSignatures) {
    issues.push('distribution_signatures_below_required');
  }
  if (!snapshot.federationOpsReady || !federationOperationsSummary?.federationOpsReady) {
    issues.push('federation_ops_not_ready');
  }
  if (!snapshot.distributionReady) {
    issues.push('distribution_gate_not_ready');
  }
  return issues;
}

export function formatGovernancePublicAuditVerifierFederationDistributionReadinessIssue(
  issue: GovernancePublicAuditVerifierFederationDistributionReadinessIssue,
): string {
  switch (issue) {
    case 'missing_distribution_package':
      return 'No captured federation distribution package exists yet.';
    case 'distribution_signatures_below_required':
      return 'Captured package still needs more distribution signatures.';
    case 'federation_ops_not_ready':
      return 'Federation operations readiness is not met.';
    case 'distribution_gate_not_ready':
      return 'Distribution gate status is still pending.';
    default:
      return 'Distribution readiness requirement is not met.';
  }
}

export function formatGovernancePublicAuditVerifierFederationOpsReadinessIssue(
  issue: GovernancePublicAuditVerifierFederationOpsReadinessIssue,
): string {
  switch (issue) {
    case 'operators_below_minimum':
      return 'Onboarded federation operators are below the configured minimum.';
    case 'critical_alert_budget_exceeded':
      return 'Open critical federation alerts exceed the configured budget.';
    case 'alert_sla_breaches_open':
      return 'At least one federation alert is beyond the SLA window.';
    case 'distribution_verification_stale':
      return 'Distribution verification is stale.';
    case 'distribution_verification_alerts_open':
      return 'Open distribution verification alerts remain unresolved.';
    case 'worker_run_not_ok':
      return 'Latest federation worker run is not OK.';
    case 'federation_ops_not_ready':
      return 'Federation operations summary is not ready.';
    default:
      return 'Federation operations readiness requirement is not met.';
  }
}

export function readGovernancePublicAuditVerifierFederationPackageSignatureRows(
  rows: unknown,
): GovernancePublicAuditVerifierFederationPackageSignatureRow[] {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => ({
      signatureId: asString(entry.signature_id),
      packageId: asString(entry.package_id),
      packageHash: asString(entry.package_hash),
      signerKey: asString(entry.signer_key),
      signatureAlgorithm: asString(entry.signature_algorithm, 'unknown'),
      distributionChannel: asString(entry.distribution_channel, 'primary'),
      signerTrustDomain: asString(entry.signer_trust_domain, 'public'),
      signerJurisdictionCountryCode: asNullableString(entry.signer_jurisdiction_country_code),
      signedAt: asNullableString(entry.signed_at),
    }))
    .filter((entry) => entry.signatureId.length > 0 && entry.packageId.length > 0 && entry.signerKey.length > 0);
}
