import type { Database } from '@/integrations/supabase/types';

export type GovernancePublicAuditAnchorAdapterRow = Database['public']['Tables']['governance_public_audit_anchor_adapters']['Row'];
export type GovernancePublicAuditImmutableAnchorRow = Database['public']['Tables']['governance_public_audit_immutable_anchors']['Row'];
export type GovernancePublicAuditVerifierJobRow = Database['public']['Tables']['governance_public_audit_verifier_jobs']['Row'];
export type GovernancePublicAuditAnchorExecutionJobStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

export interface GovernancePublicAuditOperationsSlaSummary {
  batchId: string;
  pendingSlaHours: number;
  lookbackHours: number;
  activeAnchorAdapterCount: number;
  activeVerifierCount: number;
  anchorPendingCount: number;
  anchorStalePendingCount: number;
  anchorFailedLookbackCount: number;
  anchorCompletedLookbackCount: number;
  anchorFailureSharePercent: number | null;
  verifierPendingCount: number;
  verifierStalePendingCount: number;
  verifierFailedLookbackCount: number;
  verifierCompletedLookbackCount: number;
  verifierFailureSharePercent: number | null;
  oldestAnchorPendingAt: string | null;
  oldestVerifierPendingAt: string | null;
  anchorSlaMet: boolean;
  verifierSlaMet: boolean;
  overallSlaMet: boolean;
}

export interface GovernancePublicAuditAnchorExecutionJobBoardRow {
  jobId: string;
  batchId: string;
  adapterId: string;
  adapterKey: string;
  adapterName: string;
  network: string;
  status: GovernancePublicAuditAnchorExecutionJobStatus;
  scheduledAt: string;
  completedAt: string | null;
  immutableReference: string | null;
  errorMessage: string | null;
}

export interface GovernancePublicAuditExternalExecutionCycleResult {
  batchId: string | null;
  anchorJobsScheduled: number;
  verifierJobsScheduled: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asNullableString(value: unknown) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function asString(value: unknown, fallback = '') {
  if (typeof value !== 'string') return fallback;
  return value;
}

function asNonNegativeInteger(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return Math.max(0, parsed);
  }
  return fallback;
}

function asNullableNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asAnchorExecutionJobStatus(value: unknown): GovernancePublicAuditAnchorExecutionJobStatus {
  const status = asString(value).trim().toLowerCase();
  if (status === 'completed' || status === 'failed' || status === 'cancelled') return status;
  return 'pending';
}

export function readGovernancePublicAuditOperationsSlaSummary(rows: unknown): GovernancePublicAuditOperationsSlaSummary | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row = asRecord(rows[0]);
  if (!row) return null;

  const batchId = asNullableString(row.batch_id);
  if (!batchId) return null;

  return {
    batchId,
    pendingSlaHours: Math.max(1, asNonNegativeInteger(row.pending_sla_hours, 4)),
    lookbackHours: Math.max(1, asNonNegativeInteger(row.lookback_hours, 24)),
    activeAnchorAdapterCount: asNonNegativeInteger(row.active_anchor_adapter_count),
    activeVerifierCount: asNonNegativeInteger(row.active_verifier_count),
    anchorPendingCount: asNonNegativeInteger(row.anchor_pending_count),
    anchorStalePendingCount: asNonNegativeInteger(row.anchor_stale_pending_count),
    anchorFailedLookbackCount: asNonNegativeInteger(row.anchor_failed_lookback_count),
    anchorCompletedLookbackCount: asNonNegativeInteger(row.anchor_completed_lookback_count),
    anchorFailureSharePercent: asNullableNumber(row.anchor_failure_share_percent),
    verifierPendingCount: asNonNegativeInteger(row.verifier_pending_count),
    verifierStalePendingCount: asNonNegativeInteger(row.verifier_stale_pending_count),
    verifierFailedLookbackCount: asNonNegativeInteger(row.verifier_failed_lookback_count),
    verifierCompletedLookbackCount: asNonNegativeInteger(row.verifier_completed_lookback_count),
    verifierFailureSharePercent: asNullableNumber(row.verifier_failure_share_percent),
    oldestAnchorPendingAt: asNullableString(row.oldest_anchor_pending_at),
    oldestVerifierPendingAt: asNullableString(row.oldest_verifier_pending_at),
    anchorSlaMet: Boolean(row.anchor_sla_met),
    verifierSlaMet: Boolean(row.verifier_sla_met),
    overallSlaMet: Boolean(row.overall_sla_met),
  };
}

export function readGovernancePublicAuditAnchorExecutionJobBoardRows(rows: unknown): GovernancePublicAuditAnchorExecutionJobBoardRow[] {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => ({
      jobId: asString(entry.job_id),
      batchId: asString(entry.batch_id),
      adapterId: asString(entry.adapter_id),
      adapterKey: asString(entry.adapter_key),
      adapterName: asString(entry.adapter_name),
      network: asString(entry.network),
      status: asAnchorExecutionJobStatus(entry.status),
      scheduledAt: asString(entry.scheduled_at),
      completedAt: asNullableString(entry.completed_at),
      immutableReference: asNullableString(entry.immutable_reference),
      errorMessage: asNullableString(entry.error_message),
    }))
    .filter((entry) => entry.jobId.length > 0 && entry.batchId.length > 0 && entry.adapterId.length > 0);
}

export function readGovernancePublicAuditExternalExecutionCycleResult(rows: unknown): GovernancePublicAuditExternalExecutionCycleResult | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row = asRecord(rows[0]);
  if (!row) return null;

  return {
    batchId: asNullableString(row.batch_id),
    anchorJobsScheduled: asNonNegativeInteger(row.anchor_jobs_scheduled),
    verifierJobsScheduled: asNonNegativeInteger(row.verifier_jobs_scheduled),
  };
}

export function isMissingPublicAuditAutomationBackend(error: { code?: string | null; message?: string | null; details?: string | null } | null) {
  if (!error) return false;
  const message = `${error.code || ''} ${error.message || ''} ${error.details || ''}`.toLowerCase();
  return (
    error.code === '42P01'
    || error.code === 'PGRST205'
    || error.code === 'PGRST202'
    || message.includes('governance_public_audit_anchor_adapters')
    || message.includes('governance_public_audit_immutable_anchors')
    || message.includes('governance_public_audit_verifier_jobs')
    || message.includes('governance_public_audit_anchor_execution_jobs')
    || message.includes('governance_public_audit_operations_sla_summary')
    || message.includes('governance_public_audit_anchor_execution_job_board')
    || message.includes('run_governance_public_audit_external_execution_cycle')
    || message.includes('register_governance_public_audit_anchor_adapter')
    || message.includes('record_governance_public_audit_immutable_anchor')
    || message.includes('schedule_governance_public_audit_verifier_jobs')
    || message.includes('complete_governance_public_audit_verifier_job')
    || message.includes('schedule_governance_public_audit_anchor_execution_jobs')
    || message.includes('complete_governance_public_audit_anchor_execution_job')
    || message.includes('current_profile_can_manage_public_audit_verifiers')
  );
}
