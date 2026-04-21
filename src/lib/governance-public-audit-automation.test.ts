import { describe, expect, it } from 'vitest';

import {
  isMissingPublicAuditAutomationBackend,
  readGovernancePublicAuditAnchorExecutionJobBoardRows,
  readGovernancePublicAuditExternalExecutionCycleResult,
  readGovernancePublicAuditOperationsSlaSummary,
} from '@/lib/governance-public-audit-automation';

describe('governance-public-audit-automation helpers', () => {
  it('parses public audit operations SLA summary rows', () => {
    const summary = readGovernancePublicAuditOperationsSlaSummary([
      {
        batch_id: 'batch-1',
        pending_sla_hours: '4',
        lookback_hours: 24,
        active_anchor_adapter_count: 3,
        active_verifier_count: 4,
        anchor_pending_count: 1,
        anchor_stale_pending_count: 0,
        anchor_failed_lookback_count: 2,
        anchor_completed_lookback_count: 8,
        anchor_failure_share_percent: '20.5',
        verifier_pending_count: 2,
        verifier_stale_pending_count: 1,
        verifier_failed_lookback_count: 1,
        verifier_completed_lookback_count: 9,
        verifier_failure_share_percent: 10,
        oldest_anchor_pending_at: '2026-04-21T00:00:00.000Z',
        oldest_verifier_pending_at: null,
        anchor_sla_met: true,
        verifier_sla_met: false,
        overall_sla_met: false,
      },
    ]);

    expect(summary).toEqual({
      batchId: 'batch-1',
      pendingSlaHours: 4,
      lookbackHours: 24,
      activeAnchorAdapterCount: 3,
      activeVerifierCount: 4,
      anchorPendingCount: 1,
      anchorStalePendingCount: 0,
      anchorFailedLookbackCount: 2,
      anchorCompletedLookbackCount: 8,
      anchorFailureSharePercent: 20.5,
      verifierPendingCount: 2,
      verifierStalePendingCount: 1,
      verifierFailedLookbackCount: 1,
      verifierCompletedLookbackCount: 9,
      verifierFailureSharePercent: 10,
      oldestAnchorPendingAt: '2026-04-21T00:00:00.000Z',
      oldestVerifierPendingAt: null,
      anchorSlaMet: true,
      verifierSlaMet: false,
      overallSlaMet: false,
    });
  });

  it('parses anchor execution job board rows', () => {
    const rows = readGovernancePublicAuditAnchorExecutionJobBoardRows([
      {
        job_id: 'job-1',
        batch_id: 'batch-1',
        adapter_id: 'adapter-1',
        adapter_key: 'anchor_eth',
        adapter_name: 'Ethereum',
        network: 'eth-mainnet',
        status: 'completed',
        scheduled_at: '2026-04-21T00:00:00.000Z',
        completed_at: '2026-04-21T00:05:00.000Z',
        immutable_reference: '0xabc',
        error_message: null,
      },
      {
        job_id: '',
        batch_id: 'batch-1',
        adapter_id: 'adapter-2',
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      jobId: 'job-1',
      batchId: 'batch-1',
      adapterId: 'adapter-1',
      adapterKey: 'anchor_eth',
      adapterName: 'Ethereum',
      network: 'eth-mainnet',
      status: 'completed',
      scheduledAt: '2026-04-21T00:00:00.000Z',
      completedAt: '2026-04-21T00:05:00.000Z',
      immutableReference: '0xabc',
      errorMessage: null,
    });
  });

  it('parses external execution cycle summary rows', () => {
    const summary = readGovernancePublicAuditExternalExecutionCycleResult([
      {
        batch_id: 'batch-2',
        anchor_jobs_scheduled: 2,
        verifier_jobs_scheduled: 3,
      },
    ]);

    expect(summary).toEqual({
      batchId: 'batch-2',
      anchorJobsScheduled: 2,
      verifierJobsScheduled: 3,
    });
  });

  it('detects missing immutable anchoring automation backend errors', () => {
    expect(
      isMissingPublicAuditAutomationBackend({
        code: 'PGRST202',
        message: 'Function governance_public_audit_operations_sla_summary does not exist',
      }),
    ).toBe(true);

    expect(
      isMissingPublicAuditAutomationBackend({
        code: '22023',
        message: 'random failure',
      }),
    ).toBe(false);
  });
});
