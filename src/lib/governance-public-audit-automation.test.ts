import { describe, expect, it } from 'vitest';

import {
  countOpenGovernancePublicAuditExternalExecutionPagesForPageKeySubstring,
  formatGovernancePublicAuditQueueJobStatusLabel,
  isMissingPublicAuditAutomationBackend,
  readGovernancePublicAuditAnchorExecutionJobBoardRows,
  readGovernancePublicAuditClaimedExecutionJobs,
  readGovernancePublicAuditExternalExecutionCycleResult,
  readGovernancePublicAuditExternalExecutionAutomationStatus,
  readGovernancePublicAuditExternalExecutionPageBoardRows,
  readGovernancePublicAuditExternalExecutionPagingSummary,
  readGovernancePublicAuditExternalExecutionPolicySummary,
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

  it('returns null when operations SLA summary RPC rows are absent or lack a batch id', () => {
    expect(readGovernancePublicAuditOperationsSlaSummary(null)).toBeNull();
    expect(readGovernancePublicAuditOperationsSlaSummary([])).toBeNull();
    expect(
      readGovernancePublicAuditOperationsSlaSummary([
        {
          batch_id: null,
          pending_sla_hours: 4,
          lookback_hours: 24,
        },
      ]),
    ).toBeNull();
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

  it('parses external execution policy summary rows', () => {
    const summary = readGovernancePublicAuditExternalExecutionPolicySummary([
      {
        policy_key: 'default',
        policy_name: 'Default policy',
        is_active: true,
        claim_ttl_minutes: 12,
        anchor_max_attempts: 4,
        verifier_max_attempts: 6,
        retry_base_delay_minutes: 5,
        retry_max_delay_minutes: 90,
        paging_enabled: false,
        paging_stale_pending_minutes: 45,
        paging_failure_share_percent: '22.5',
        oncall_channel: 'gov_ops',
        updated_at: '2026-04-21T01:00:00.000Z',
      },
    ]);

    expect(summary).toEqual({
      policyKey: 'default',
      policyName: 'Default policy',
      isActive: true,
      claimTtlMinutes: 12,
      anchorMaxAttempts: 4,
      verifierMaxAttempts: 6,
      retryBaseDelayMinutes: 5,
      retryMaxDelayMinutes: 90,
      pagingEnabled: false,
      pagingStalePendingMinutes: 45,
      pagingFailureSharePercent: 22.5,
      oncallChannel: 'gov_ops',
      updatedAt: '2026-04-21T01:00:00.000Z',
    });
  });

  it('parses external execution paging summary rows', () => {
    const summary = readGovernancePublicAuditExternalExecutionPagingSummary([
      {
        batch_id: 'batch-5',
        paging_enabled: true,
        oncall_channel: 'gov_ops',
        paging_stale_pending_minutes: 30,
        paging_failure_share_percent: 20,
        anchor_stale_pending_count: 2,
        verifier_stale_pending_count: 1,
        anchor_failure_share_percent: 33.3,
        verifier_failure_share_percent: null,
        should_page: true,
        open_page_count: 1,
        latest_open_page_at: '2026-04-21T02:00:00.000Z',
      },
    ]);

    expect(summary).toEqual({
      batchId: 'batch-5',
      pagingEnabled: true,
      oncallChannel: 'gov_ops',
      pagingStalePendingMinutes: 30,
      pagingFailureSharePercent: 20,
      anchorStalePendingCount: 2,
      verifierStalePendingCount: 1,
      anchorFailureSharePercent: 33.3,
      verifierFailureSharePercent: null,
      shouldPage: true,
      openPageCount: 1,
      latestOpenPageAt: '2026-04-21T02:00:00.000Z',
    });
  });

  it('parses external execution automation status rows', () => {
    const status = readGovernancePublicAuditExternalExecutionAutomationStatus([
      {
        cron_schema_available: true,
        cron_job_registered: true,
        cron_job_active: true,
        cron_job_schedule: '35 * * * *',
        cron_job_command: 'SELECT public.gpav_external_execution_cycle_tick();',
        latest_batch_id: 'batch-9',
        latest_cycle_anchor_jobs_scheduled: 4,
        latest_cycle_verifier_jobs_scheduled: 5,
        latest_cycle_evaluated_at: '2026-05-01T08:35:00.000Z',
        latest_anchor_job_scheduled_at: '2026-05-01T08:35:01.000Z',
        latest_verifier_job_scheduled_at: '2026-05-01T08:35:02.000Z',
        latest_external_execution_page_opened_at: '2026-05-01T08:36:00.000Z',
      },
    ]);

    expect(status).toEqual({
      cronSchemaAvailable: true,
      cronJobRegistered: true,
      cronJobActive: true,
      cronJobSchedule: '35 * * * *',
      cronJobCommand: 'SELECT public.gpav_external_execution_cycle_tick();',
      latestBatchId: 'batch-9',
      latestCycleAnchorJobsScheduled: 4,
      latestCycleVerifierJobsScheduled: 5,
      latestCycleEvaluatedAt: '2026-05-01T08:35:00.000Z',
      latestAnchorJobScheduledAt: '2026-05-01T08:35:01.000Z',
      latestVerifierJobScheduledAt: '2026-05-01T08:35:02.000Z',
      latestExternalExecutionPageOpenedAt: '2026-05-01T08:36:00.000Z',
    });
  });

  it('returns null when external execution summary RPC payloads are empty or lack policy_key', () => {
    expect(readGovernancePublicAuditExternalExecutionCycleResult(null)).toBeNull();
    expect(readGovernancePublicAuditExternalExecutionCycleResult([])).toBeNull();

    expect(readGovernancePublicAuditExternalExecutionPagingSummary(null)).toBeNull();
    expect(readGovernancePublicAuditExternalExecutionPagingSummary([])).toBeNull();
    expect(readGovernancePublicAuditExternalExecutionAutomationStatus(null)).toBeNull();
    expect(readGovernancePublicAuditExternalExecutionAutomationStatus([])).toBeNull();

    expect(readGovernancePublicAuditExternalExecutionPolicySummary(null)).toBeNull();
    expect(readGovernancePublicAuditExternalExecutionPolicySummary([])).toBeNull();
    expect(
      readGovernancePublicAuditExternalExecutionPolicySummary([
        {
          policy_key: null,
          policy_name: 'Orphan row',
        },
      ]),
    ).toBeNull();
  });

  it('parses external execution page board rows', () => {
    const pages = readGovernancePublicAuditExternalExecutionPageBoardRows([
      {
        page_id: 'page-1',
        batch_id: 'batch-5',
        page_key: 'external_execution_sla',
        severity: 'critical',
        page_status: 'open',
        page_message: 'SLA breached',
        oncall_channel: 'gov_ops',
        opened_at: '2026-04-21T02:00:00.000Z',
        resolved_at: null,
      },
      {
        page_id: '',
        page_key: 'invalid',
      },
    ]);

    expect(pages).toHaveLength(1);
    expect(pages[0]).toEqual({
      pageId: 'page-1',
      batchId: 'batch-5',
      pageKey: 'external_execution_sla',
      severity: 'critical',
      pageStatus: 'open',
      pageMessage: 'SLA breached',
      oncallChannel: 'gov_ops',
      openedAt: '2026-04-21T02:00:00.000Z',
      resolvedAt: null,
    });
  });

  it('returns empty lists for non-array automation board payloads', () => {
    expect(readGovernancePublicAuditExternalExecutionPageBoardRows(null)).toEqual([]);
    expect(readGovernancePublicAuditAnchorExecutionJobBoardRows({})).toEqual([]);
    expect(readGovernancePublicAuditClaimedExecutionJobs(undefined)).toEqual([]);
  });

  it('parses claimed execution jobs', () => {
    const jobs = readGovernancePublicAuditClaimedExecutionJobs([
      {
        job_type: 'anchor',
        job_id: 'job-7',
        batch_id: 'batch-5',
        adapter_id: 'adapter-1',
        verifier_id: null,
        network: 'eth-mainnet',
        scheduled_at: '2026-04-21T00:00:00.000Z',
        attempt_count: 2,
        max_attempts: 5,
        next_attempt_at: '2026-04-21T00:05:00.000Z',
        claimed_at: '2026-04-21T00:01:00.000Z',
        claim_expires_at: '2026-04-21T00:11:00.000Z',
      },
    ]);

    expect(jobs).toEqual([
      {
        jobType: 'anchor',
        jobId: 'job-7',
        batchId: 'batch-5',
        adapterId: 'adapter-1',
        verifierId: null,
        network: 'eth-mainnet',
        scheduledAt: '2026-04-21T00:00:00.000Z',
        attemptCount: 2,
        maxAttempts: 5,
        nextAttemptAt: '2026-04-21T00:05:00.000Z',
        claimedAt: '2026-04-21T00:01:00.000Z',
        claimExpiresAt: '2026-04-21T00:11:00.000Z',
      },
    ]);
  });

  it('counts open external execution pages by page key substring', () => {
    const pages = [
      {
        pageId: 'p1',
        batchId: 'b1',
        pageKey: 'verifier_federation_distribution_escalation',
        severity: 'critical' as const,
        pageStatus: 'open' as const,
        pageMessage: 'Distribution alerts remain open',
        oncallChannel: 'ops',
        openedAt: '2026-04-21T00:00:00.000Z',
        resolvedAt: null,
      },
      {
        pageId: 'p2',
        batchId: 'b1',
        pageKey: 'verifier_federation_distribution_escalation',
        severity: 'critical' as const,
        pageStatus: 'resolved' as const,
        pageMessage: 'Done',
        oncallChannel: 'ops',
        openedAt: '2026-04-21T01:00:00.000Z',
        resolvedAt: '2026-04-21T02:00:00.000Z',
      },
      {
        pageId: 'p3',
        batchId: 'b1',
        pageKey: 'external_execution_sla',
        severity: 'critical' as const,
        pageStatus: 'open' as const,
        pageMessage: 'Other',
        oncallChannel: 'ops',
        openedAt: '2026-04-21T03:00:00.000Z',
        resolvedAt: null,
      },
    ];
    expect(countOpenGovernancePublicAuditExternalExecutionPagesForPageKeySubstring(pages, 'verifier_federation_distribution')).toBe(1);
  });

  it('returns zero when the page key substring is empty after trimming', () => {
    const pages = [
      {
        pageId: 'p1',
        batchId: 'b1',
        pageKey: 'verifier_federation_distribution_escalation',
        severity: 'critical' as const,
        pageStatus: 'open' as const,
        pageMessage: 'Open',
        oncallChannel: 'ops',
        openedAt: '2026-04-21T00:00:00.000Z',
        resolvedAt: null,
      },
    ];
    expect(countOpenGovernancePublicAuditExternalExecutionPagesForPageKeySubstring(pages, '')).toBe(0);
    expect(countOpenGovernancePublicAuditExternalExecutionPagesForPageKeySubstring(pages, '   ')).toBe(0);
  });

  it('counts open guardian relay external execution pages by page key substring', () => {
    const pages = [
      {
        pageId: 'g1',
        batchId: 'b1',
        pageKey: 'guardian_relay_proof_distribution_escalation',
        severity: 'critical' as const,
        pageStatus: 'acknowledged' as const,
        pageMessage: 'Relay proof distribution needs attention',
        oncallChannel: 'ops',
        openedAt: '2026-04-21T00:00:00.000Z',
        resolvedAt: null,
      },
      {
        pageId: 'g2',
        batchId: 'b1',
        pageKey: 'guardian_relay_critical_escalation',
        severity: 'critical' as const,
        pageStatus: 'resolved' as const,
        pageMessage: 'Cleared',
        oncallChannel: 'ops',
        openedAt: '2026-04-21T01:00:00.000Z',
        resolvedAt: '2026-04-21T02:00:00.000Z',
      },
    ];
    expect(countOpenGovernancePublicAuditExternalExecutionPagesForPageKeySubstring(pages, 'guardian_relay')).toBe(1);
  });

  it('can tally federation distribution and guardian relay open pages from one board list', () => {
    const pages = [
      {
        pageId: 'f1',
        batchId: 'b1',
        pageKey: 'verifier_federation_distribution_escalation',
        severity: 'critical' as const,
        pageStatus: 'open' as const,
        pageMessage: 'Federation distribution',
        oncallChannel: 'ops',
        openedAt: '2026-04-21T00:00:00.000Z',
        resolvedAt: null,
      },
      {
        pageId: 'g1',
        batchId: 'b1',
        pageKey: 'guardian_relay_proof_distribution_escalation',
        severity: 'critical' as const,
        pageStatus: 'open' as const,
        pageMessage: 'Relay',
        oncallChannel: 'ops',
        openedAt: '2026-04-21T01:00:00.000Z',
        resolvedAt: null,
      },
    ];
    expect(countOpenGovernancePublicAuditExternalExecutionPagesForPageKeySubstring(pages, 'verifier_federation_distribution')).toBe(1);
    expect(countOpenGovernancePublicAuditExternalExecutionPagesForPageKeySubstring(pages, 'guardian_relay')).toBe(1);
  });

  it('counts open activation demographic feed worker external execution pages by substring', () => {
    const pages = [
      {
        pageId: 'a1',
        batchId: 'b1',
        pageKey: 'activation_demographic_feed_worker_escalation',
        severity: 'critical' as const,
        pageStatus: 'open' as const,
        pageMessage: 'Feed worker stalled',
        oncallChannel: 'ops',
        openedAt: '2026-04-21T00:00:00.000Z',
        resolvedAt: null,
      },
      {
        pageId: 'a2',
        batchId: 'b1',
        pageKey: 'activation_demographic_feed_worker_escalation',
        severity: 'critical' as const,
        pageStatus: 'resolved' as const,
        pageMessage: 'Done',
        oncallChannel: 'ops',
        openedAt: '2026-04-21T01:00:00.000Z',
        resolvedAt: '2026-04-21T02:00:00.000Z',
      },
    ];
    expect(countOpenGovernancePublicAuditExternalExecutionPagesForPageKeySubstring(pages, 'activation_demographic_feed')).toBe(1);
  });

  it('formats queue job status labels for stewards', () => {
    expect(formatGovernancePublicAuditQueueJobStatusLabel('pending')).toBe('Pending');
    expect(formatGovernancePublicAuditQueueJobStatusLabel('COMPLETED')).toBe('Completed');
    expect(formatGovernancePublicAuditQueueJobStatusLabel('unknown')).toBe('Unknown status');
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
        code: 'PGRST202',
        message: 'Could not find the function public.governance_public_audit_external_execution_page_board',
        details: null,
      }),
    ).toBe(true);

    expect(
      isMissingPublicAuditAutomationBackend({
        code: 'PGRST202',
        message: 'Could not find the function public.claim_governance_public_audit_external_execution_jobs',
        details: null,
      }),
    ).toBe(true);

    expect(
      isMissingPublicAuditAutomationBackend({
        code: '42P01',
        message: 'relation "governance_public_audit_external_execution_pages" does not exist',
        details: null,
      }),
    ).toBe(true);

    expect(isMissingPublicAuditAutomationBackend(null)).toBe(false);

    expect(
      isMissingPublicAuditAutomationBackend({
        code: '22023',
        message: 'random failure without public audit keywords',
      }),
    ).toBe(false);
  });
});
