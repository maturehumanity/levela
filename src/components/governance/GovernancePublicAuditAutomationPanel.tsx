import { useMemo } from 'react';
import { Loader2, RefreshCcw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  GovernancePublicAuditAnchorExecutionJobCompletionSection,
  GovernancePublicAuditVerifierJobCompletionSection,
} from '@/components/governance/GovernancePublicAuditAutomationJobCompletionSections';
import { GovernancePublicAuditAutomationExecutionControls } from '@/components/governance/GovernancePublicAuditAutomationExecutionControls';
import { GovernancePublicAuditAutomationPolicyControls } from '@/components/governance/GovernancePublicAuditAutomationPolicyControls';
import { useGovernancePublicAuditAutomation } from '@/lib/use-governance-public-audit-automation';

interface GovernancePublicAuditAutomationPanelProps {
  latestBatchId: string | null;
  formatTimestamp: (value: string | null) => string;
}

function formatFailureShare(value: number | null) {
  if (value === null || !Number.isFinite(value)) return 'n/a';
  return `${value.toFixed(2)}%`;
}

export function GovernancePublicAuditAutomationPanel({
  latestBatchId,
  formatTimestamp,
}: GovernancePublicAuditAutomationPanelProps) {
  const {
    loadingAutomationData,
    automationBackendUnavailable,
    canManageAutomation,
    registeringAnchorAdapter,
    recordingImmutableAnchor,
    schedulingAnchorExecutionJobs,
    schedulingVerifierJobs,
    runningExternalExecutionCycle,
    completingAnchorExecutionJob,
    completingVerifierJob,
    savingExternalExecutionPolicy,
    drainingExternalExecutionQueue,
    evaluatingExternalExecutionPaging,
    resolvingExternalExecutionPage,
    anchorAdapters,
    immutableAnchors,
    anchorExecutionJobs,
    verifierJobs,
    operationsSlaSummary,
    externalExecutionPolicy,
    externalExecutionPagingSummary,
    externalExecutionPages,
    loadAutomationData,
    registerAnchorAdapter,
    recordImmutableAnchor,
    scheduleAnchorExecutionJobs,
    scheduleVerifierJobs,
    runExternalExecutionCycle,
    saveExternalExecutionPolicy,
    drainExternalExecutionQueue,
    evaluateExternalExecutionPaging,
    resolveExternalExecutionPage,
    completeAnchorExecutionJob,
    completeVerifierJob,
  } = useGovernancePublicAuditAutomation({ latestBatchId });

  const activeAnchorAdapters = useMemo(
    () => anchorAdapters.filter((adapter) => adapter.is_active),
    [anchorAdapters],
  );
  const pendingVerifierJobs = useMemo(
    () => verifierJobs.filter((job) => job.status === 'pending'),
    [verifierJobs],
  );
  const pendingAnchorExecutionJobs = useMemo(
    () => anchorExecutionJobs.filter((job) => job.status === 'pending'),
    [anchorExecutionJobs],
  );

  if (automationBackendUnavailable) {
    return (
      <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
        <p className="text-sm text-muted-foreground">
          Immutable anchor adapters, execution workers, and verifier automation are not available in this environment yet.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Immutable anchoring external execution ops</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => void loadAutomationData()}
          disabled={loadingAutomationData}
        >
          {loadingAutomationData ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          Refresh automation
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
          Active adapters {activeAnchorAdapters.length}
        </Badge>
        <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
          Immutable anchors {immutableAnchors.length}
        </Badge>
        <Badge variant="outline" className={pendingAnchorExecutionJobs.length > 0 ? 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'}>
          Pending anchor jobs {pendingAnchorExecutionJobs.length}
        </Badge>
        <Badge variant="outline" className={pendingVerifierJobs.length > 0 ? 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'}>
          Pending verifier jobs {pendingVerifierJobs.length}
        </Badge>
        {operationsSlaSummary && (
          <Badge variant="outline" className={operationsSlaSummary.overallSlaMet ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300'}>
            SLA {operationsSlaSummary.overallSlaMet ? 'met' : 'at risk'}
          </Badge>
        )}
        {externalExecutionPagingSummary && (
          <Badge variant="outline" className={externalExecutionPagingSummary.openPageCount > 0 ? 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'}>
            Open pages {externalExecutionPagingSummary.openPageCount}
          </Badge>
        )}
      </div>

      {operationsSlaSummary && (
        <div className="mt-3 grid gap-2 lg:grid-cols-3">
          <div className="rounded-lg border border-border/60 bg-background/70 p-2.5 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">SLA window</p>
            <p className="mt-1">Pending SLA: {operationsSlaSummary.pendingSlaHours}h</p>
            <p>Lookback: {operationsSlaSummary.lookbackHours}h</p>
            <p>Active adapters: {operationsSlaSummary.activeAnchorAdapterCount}</p>
            <p>Active verifiers: {operationsSlaSummary.activeVerifierCount}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/70 p-2.5 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Anchor workers</p>
            <p className="mt-1">Pending: {operationsSlaSummary.anchorPendingCount}</p>
            <p>Stale pending: {operationsSlaSummary.anchorStalePendingCount}</p>
            <p>Lookback failures: {operationsSlaSummary.anchorFailedLookbackCount}</p>
            <p>Failure share: {formatFailureShare(operationsSlaSummary.anchorFailureSharePercent)}</p>
            <p>Oldest pending: {formatTimestamp(operationsSlaSummary.oldestAnchorPendingAt)}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/70 p-2.5 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Verifier workers</p>
            <p className="mt-1">Pending: {operationsSlaSummary.verifierPendingCount}</p>
            <p>Stale pending: {operationsSlaSummary.verifierStalePendingCount}</p>
            <p>Lookback failures: {operationsSlaSummary.verifierFailedLookbackCount}</p>
            <p>Failure share: {formatFailureShare(operationsSlaSummary.verifierFailureSharePercent)}</p>
            <p>Oldest pending: {formatTimestamp(operationsSlaSummary.oldestVerifierPendingAt)}</p>
          </div>
        </div>
      )}

      {externalExecutionPagingSummary && (
        <div className="mt-2 grid gap-2 lg:grid-cols-3">
          <div className="rounded-lg border border-border/60 bg-background/70 p-2.5 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Paging policy</p>
            <p className="mt-1">On-call channel: {externalExecutionPagingSummary.oncallChannel}</p>
            <p>Stale threshold: {externalExecutionPagingSummary.pagingStalePendingMinutes}m</p>
            <p>Failure threshold: {externalExecutionPagingSummary.pagingFailureSharePercent.toFixed(2)}%</p>
            <p>Paging: {externalExecutionPagingSummary.pagingEnabled ? 'enabled' : 'disabled'}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/70 p-2.5 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Stale queue health</p>
            <p className="mt-1">Anchor stale: {externalExecutionPagingSummary.anchorStalePendingCount}</p>
            <p>Verifier stale: {externalExecutionPagingSummary.verifierStalePendingCount}</p>
            <p>Needs page: {externalExecutionPagingSummary.shouldPage ? 'yes' : 'no'}</p>
            <p>Last open page: {formatTimestamp(externalExecutionPagingSummary.latestOpenPageAt)}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/70 p-2.5 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Failure pressure</p>
            <p className="mt-1">Anchor failure: {formatFailureShare(externalExecutionPagingSummary.anchorFailureSharePercent)}</p>
            <p>Verifier failure: {formatFailureShare(externalExecutionPagingSummary.verifierFailureSharePercent)}</p>
            <p>Open pages: {externalExecutionPagingSummary.openPageCount}</p>
          </div>
        </div>
      )}

      {!canManageAutomation ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Automation controls are limited to public-audit verifier stewards.
        </p>
      ) : (
        <GovernancePublicAuditAutomationExecutionControls
          latestBatchId={latestBatchId}
          activeAnchorAdapters={activeAnchorAdapters}
          registeringAnchorAdapter={registeringAnchorAdapter}
          recordingImmutableAnchor={recordingImmutableAnchor}
          schedulingAnchorExecutionJobs={schedulingAnchorExecutionJobs}
          schedulingVerifierJobs={schedulingVerifierJobs}
          runningExternalExecutionCycle={runningExternalExecutionCycle}
          drainingExternalExecutionQueue={drainingExternalExecutionQueue}
          evaluatingExternalExecutionPaging={evaluatingExternalExecutionPaging}
          onRegisterAnchorAdapter={registerAnchorAdapter}
          onRecordImmutableAnchor={recordImmutableAnchor}
          onScheduleAnchorExecutionJobs={scheduleAnchorExecutionJobs}
          onScheduleVerifierJobs={scheduleVerifierJobs}
          onRunExternalExecutionCycle={runExternalExecutionCycle}
          onDrainExternalExecutionQueue={drainExternalExecutionQueue}
          onEvaluateExternalExecutionPaging={evaluateExternalExecutionPaging}
        />
      )}

      {canManageAutomation && (
        <GovernancePublicAuditAutomationPolicyControls
          externalExecutionPolicy={externalExecutionPolicy}
          externalExecutionPages={externalExecutionPages}
          savingExternalExecutionPolicy={savingExternalExecutionPolicy}
          resolvingExternalExecutionPage={resolvingExternalExecutionPage}
          formatTimestamp={formatTimestamp}
          onSaveExternalExecutionPolicy={saveExternalExecutionPolicy}
          onResolveExternalExecutionPage={resolveExternalExecutionPage}
        />
      )}

      {canManageAutomation && anchorExecutionJobs.length > 0 && (
        <GovernancePublicAuditAnchorExecutionJobCompletionSection
          anchorExecutionJobs={anchorExecutionJobs}
          formatTimestamp={formatTimestamp}
          completingAnchorExecutionJob={completingAnchorExecutionJob}
          completeAnchorExecutionJob={completeAnchorExecutionJob}
        />
      )}

      {canManageAutomation && verifierJobs.length > 0 && (
        <GovernancePublicAuditVerifierJobCompletionSection
          verifierJobs={verifierJobs}
          formatTimestamp={formatTimestamp}
          completingVerifierJob={completingVerifierJob}
          completeVerifierJob={completeVerifierJob}
        />
      )}
    </div>
  );
}
