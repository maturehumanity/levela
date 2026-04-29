import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Loader2, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ACTIVATION_FEED_DATA_AUTO_RELOAD_MIN_MS } from '@/lib/governance-activation-demographic-feeds';
import {
  formatActivationDemographicFeedOutboxClosedStatusLabel,
  formatActivationDemographicFeedScopeLabel,
  formatActivationDemographicFeedWorkerAlertKindLabel,
  formatActivationDemographicFeedWorkerRunOutcomeLabel,
  formatTruncatedGovernanceNote,
} from '@/lib/governance-activation-demographic-worker';
import {
  activationFeedSchedulerHealthExplainTitlesFromCadence,
  activationFeedSchedulerStaleThresholdsFromCadence,
  computeActivationFeedSchedulerCronRunHealthBadge,
  computeActivationFeedSchedulerEnqueueHealthBadge,
  type ActivationFeedSchedulerHealthBadge,
} from '@/lib/governance-activation-demographic-feed-scheduler-health';
import { useGovernanceActivationDemographicFeeds } from '@/lib/use-governance-activation-demographic-feeds';
interface GovernanceActivationFeedAdaptersPanelProps {
  formatTimestamp: (value: string | null) => string;
}
function getLocalDateTimeInputValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
function formatShortWorkerIdentity(value: string | null) {
  if (!value?.trim()) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 52 ? `${trimmed.slice(0, 52)}…` : trimmed;
}

function formatShortId(value: string | null) {
  if (!value?.trim()) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 14 ? `${trimmed.slice(0, 8)}…${trimmed.slice(-4)}` : trimmed;
}

function formatScheduleAutomationTriggerLabel(value: string | null) {
  if (!value?.trim()) {
    return 'Unknown';
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'cron') {
    return 'Database cron';
  }
  if (normalized === 'steward_manual') {
    return 'Operator console';
  }
  if (normalized === 'system') {
    return 'System';
  }
  return value.trim();
}

function formatCronRunStatusLabel(value: string | null) {
  if (!value?.trim()) {
    return 'Unknown';
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'succeeded' || normalized === 'success') {
    return 'Succeeded';
  }
  if (normalized === 'failed' || normalized === 'error') {
    return 'Failed';
  }
  if (normalized === 'running') {
    return 'Running';
  }
  return value.trim();
}

function countFeedWorkerAlerts(alert: {
  freshness_alert: boolean;
  signature_failure_count: number;
  connectivity_failure_count: number;
  payload_failure_count: number;
}) {
  return (
    (alert.freshness_alert ? 1 : 0)
    + alert.signature_failure_count
    + alert.connectivity_failure_count
    + alert.payload_failure_count
  );
}

const ACTIVATION_FEED_WORKER_ESCALATION_PAGE_KEY = 'activation_demographic_feed_worker_escalation';
const FEED_WORKER_ALERTS_FIRST_PAGE = 8;
const FEED_WORKER_ALERTS_APPEND_PAGE = 8;

async function copyActivationFeedWorkerEscalationPageKey() {
  try {
    await navigator.clipboard.writeText(ACTIVATION_FEED_WORKER_ESCALATION_PAGE_KEY);
    toast.success('On-call page key copied to the clipboard.');
  } catch {
    toast.error('Could not copy to the clipboard.');
  }
}

export function GovernanceActivationFeedAdaptersPanel({
  formatTimestamp,
}: GovernanceActivationFeedAdaptersPanelProps) {
  const {
    loadingFeedData,
    feedBackendUnavailable,
    feedWorkerBackendUnavailable,
    canManageFeeds,
    registeringFeedAdapter,
    ingestingSignedFeedSnapshot,
    runningFeedWorkers,
    schedulingFeedWorkerJobs,
    processingFeedOutbox,
    releasingStaleFeedWorkerClaims,
    escalatingFeedWorkerPublicExecution,
    pendingFeedOutboxCount,
    claimedFeedOutboxCount,
    closedFeedOutboxCount,
    resolvingFeedAlertKey,
    openFeedWorkerAlertsCount,
    feedAdapters,
    feedIngestions,
    feedIngestionsHasMore,
    loadingMoreFeedIngestions,
    feedWorkerAlerts,
    feedWorkerOutboxActiveJobs,
    feedWorkerOutboxRecentClosedJobs,
    feedWorkerOutboxActiveJobsHasMore,
    feedWorkerOutboxRecentClosedJobsHasMore,
    loadingMoreFeedWorkerOutboxActiveJobs,
    loadingMoreFeedWorkerOutboxRecentClosedJobs,
    feedWorkerRecentRuns,
    feedWorkerRunsHasMore,
    loadingMoreFeedWorkerRuns,
    feedWorkerSchedulePolicy,
    feedWorkerScheduleAutomationStatus,
    feedWorkerScheduleAutomationRunHistory,
    feedWorkerEscalationPageHistory,
    feedWorkerEscalationBoardPages,
    feedWorkerEscalationOpenOrAckPageCount,
    acknowledgingFeedWorkerEscalationPageId,
    resolvingFeedWorkerEscalationPageId,
    acknowledgeFeedWorkerEscalationPage,
    resolveFeedWorkerEscalationPage,
    loadFeedData,
    loadMoreFeedIngestions,
    loadMoreFeedWorkerRuns,
    loadMoreFeedWorkerOutboxActiveJobs,
    loadMoreFeedWorkerOutboxRecentClosedJobs,
    registerFeedAdapter,
    ingestSignedFeedSnapshot,
    scheduleFeedWorkerJobs,
    processFeedWorkerOutboxQueue,
    releaseStaleFeedWorkerClaims,
    runFeedWorkerSweep,
    escalateFeedWorkerAlertsToPublicExecution,
    resolveFeedAlert,
  } = useGovernanceActivationDemographicFeeds();

  const [adapterDraft, setAdapterDraft] = useState({
    adapterKey: '',
    adapterName: '',
    scopeType: 'world' as 'world' | 'country',
    countryCode: '',
    endpointUrl: '',
    publicSignerKey: '',
    keyAlgorithm: 'ECDSA_P256_SHA256_V1',
  });
  const [ingestionDraft, setIngestionDraft] = useState({
    adapterId: '',
    targetPopulation: '',
    observedAt: getLocalDateTimeInputValue(),
    sourceUrl: '',
    signedPayload: '',
    payloadSignature: '',
    ingestionNotes: '',
  });
  const [forceRescheduleSweepOpen, setForceRescheduleSweepOpen] = useState(false);
  const [recentClosedSweepJobsOpen, setRecentClosedSweepJobsOpen] = useState(false);
  const [visibleFeedWorkerAlertsCount, setVisibleFeedWorkerAlertsCount] = useState(FEED_WORKER_ALERTS_FIRST_PAGE);

  const feedWorkerEscalationHistoryAnalytics = useMemo(() => {
    const nowMs = Date.now();
    const lookback24hMs = 24 * 60 * 60 * 1000;
    let opened24h = 0;
    let resolved24h = 0;
    let unresolved = 0;
    const resolutionDurationsHours: number[] = [];

    feedWorkerEscalationPageHistory.forEach((row) => {
      const openedMs = row.openedAt ? Date.parse(row.openedAt) : Number.NaN;
      const resolvedMs = row.resolvedAt ? Date.parse(row.resolvedAt) : Number.NaN;
      if (Number.isFinite(openedMs) && nowMs - openedMs <= lookback24hMs) opened24h += 1;
      if (Number.isFinite(resolvedMs) && nowMs - resolvedMs <= lookback24hMs) resolved24h += 1;
      if (row.pageStatus !== 'resolved') unresolved += 1;
      if (Number.isFinite(openedMs) && Number.isFinite(resolvedMs) && resolvedMs >= openedMs) {
        resolutionDurationsHours.push((resolvedMs - openedMs) / (60 * 60 * 1000));
      }
    });

    const averageResolutionHours = resolutionDurationsHours.length
      ? resolutionDurationsHours.reduce((sum, value) => sum + value, 0) / resolutionDurationsHours.length
      : null;

    return {
      opened24h,
      resolved24h,
      unresolved,
      averageResolutionHours,
    };
  }, [feedWorkerEscalationPageHistory]);

  const activeAdapters = useMemo(
    () => feedAdapters.filter((adapter) => adapter.is_active),
    [feedAdapters],
  );

  const feedAdapterNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const adapter of feedAdapters) {
      map.set(adapter.id, adapter.adapter_name);
    }
    return map;
  }, [feedAdapters]);

  const recentClosedSweepFailureCount = useMemo(
    () => feedWorkerOutboxRecentClosedJobs.filter((job) => job.status === 'failed').length,
    [feedWorkerOutboxRecentClosedJobs],
  );

  const outboxActiveVisiblePendingCount = useMemo(
    () => feedWorkerOutboxActiveJobs.filter((job) => job.status === 'pending').length,
    [feedWorkerOutboxActiveJobs],
  );
  const outboxActiveVisibleClaimedCount = useMemo(
    () => feedWorkerOutboxActiveJobs.filter((job) => job.status === 'claimed').length,
    [feedWorkerOutboxActiveJobs],
  );
  const activeFeedOutboxCount = pendingFeedOutboxCount + claimedFeedOutboxCount;
  const feedWorkerOutboxActiveListTruncated = useMemo(
    () =>
      pendingFeedOutboxCount > outboxActiveVisiblePendingCount ||
      claimedFeedOutboxCount > outboxActiveVisibleClaimedCount,
    [
      pendingFeedOutboxCount,
      claimedFeedOutboxCount,
      outboxActiveVisiblePendingCount,
      outboxActiveVisibleClaimedCount,
    ],
  );
  const feedWorkerOutboxClosedListTruncated = useMemo(
    () => closedFeedOutboxCount > feedWorkerOutboxRecentClosedJobs.length,
    [closedFeedOutboxCount, feedWorkerOutboxRecentClosedJobs.length],
  );

  useEffect(() => {
    if (recentClosedSweepFailureCount > 0) {
      setRecentClosedSweepJobsOpen(true);
    }
  }, [recentClosedSweepFailureCount]);

  useEffect(() => {
    setVisibleFeedWorkerAlertsCount((current) => (
      Math.max(FEED_WORKER_ALERTS_FIRST_PAGE, Math.min(current, feedWorkerAlerts.length))
    ));
  }, [feedWorkerAlerts.length]);

  const [schedulerHealthClockMs, setSchedulerHealthClockMs] = useState(() => Date.now());
  useEffect(() => {
    const tickClock = () => setSchedulerHealthClockMs(Date.now());
    const id = window.setInterval(tickClock, ACTIVATION_FEED_DATA_AUTO_RELOAD_MIN_MS);
    const onVisibilityChange = () => {
      if (typeof document === 'undefined' || document.visibilityState !== 'visible') {
        return;
      }
      tickClock();
    };
    const onPageShow = (event: Event) => {
      const pageEvent = event as PageTransitionEvent;
      if (pageEvent.persisted) {
        tickClock();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', tickClock);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('online', tickClock);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);

  const visibleFeedWorkerAlerts = useMemo(
    () => feedWorkerAlerts.slice(0, visibleFeedWorkerAlertsCount),
    [feedWorkerAlerts, visibleFeedWorkerAlertsCount],
  );
  const feedWorkerAlertsHasMore = visibleFeedWorkerAlertsCount < feedWorkerAlerts.length;
  const feedSchedulerRunHealth = useMemo<ActivationFeedSchedulerHealthBadge | null>(() => {
    const status = feedWorkerScheduleAutomationStatus;
    if (!status) {
      return null;
    }
    const cadenceMinutes = feedWorkerSchedulePolicy?.default_interval_minutes ?? 360;
    const { cronRunStaleMs } = activationFeedSchedulerStaleThresholdsFromCadence(cadenceMinutes);
    return computeActivationFeedSchedulerCronRunHealthBadge({
      status,
      nowMs: schedulerHealthClockMs,
      staleAfterMs: cronRunStaleMs,
    });
  }, [
    feedWorkerScheduleAutomationStatus,
    feedWorkerSchedulePolicy?.default_interval_minutes,
    schedulerHealthClockMs,
  ]);
  const feedSchedulerEnqueueHealth = useMemo<ActivationFeedSchedulerHealthBadge | null>(() => {
    const status = feedWorkerScheduleAutomationStatus;
    if (!status) {
      return null;
    }
    const cadenceMinutes = feedWorkerSchedulePolicy?.default_interval_minutes ?? 360;
    const { enqueueStaleMs } = activationFeedSchedulerStaleThresholdsFromCadence(cadenceMinutes);
    return computeActivationFeedSchedulerEnqueueHealthBadge({
      latestScheduledEnqueueAt: status.latest_scheduled_enqueue_at,
      nowMs: schedulerHealthClockMs,
      staleAfterMs: enqueueStaleMs,
    });
  }, [
    feedWorkerScheduleAutomationStatus,
    feedWorkerSchedulePolicy?.default_interval_minutes,
    schedulerHealthClockMs,
  ]);
  const feedSchedulerHealthBadgeTitles = useMemo(
    () =>
      activationFeedSchedulerHealthExplainTitlesFromCadence(
        feedWorkerSchedulePolicy?.default_interval_minutes ?? 360,
      ),
    [feedWorkerSchedulePolicy?.default_interval_minutes],
  );

  if (feedBackendUnavailable) {
    return (
      <div
        className="rounded-xl border border-border/70 bg-muted/20 p-3"
        data-build-key="governanceActivationFeedAdaptersPanelUnavailable"
        data-build-label="Signed demographic feed adapters unavailable"
      >
        <p
          className="text-sm text-muted-foreground"
          data-build-key="governanceActivationFeedAdaptersPanelUnavailableMessage"
          data-build-label="Signed demographic feed adapters unavailable explanation"
        >
          Signed demographic feed adapters are not available in this environment yet.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-border/70 bg-muted/20 p-3"
      data-build-key="governanceActivationFeedAdaptersPanel"
      data-build-label="Signed demographic feed adapters panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
          data-build-key="governanceActivationFeedAdaptersTitle"
          data-build-label="Signed demographic feed adapters heading"
        >
          Signed demographic feed adapters
        </p>
        <div
          className="flex flex-wrap items-center gap-2"
          data-build-key="governanceActivationFeedToolbar"
          data-build-label="Signed feed adapters toolbar"
        >
          <Badge
            variant="outline"
            className="border-border bg-muted text-muted-foreground"
            data-build-key="governanceActivationFeedActiveAdaptersBadge"
            data-build-label="Active feed adapters count"
          >
            {activeAdapters.length} active adapters
          </Badge>
          <Badge
            variant="outline"
            className={openFeedWorkerAlertsCount > 0
              ? 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'
              : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'}
            data-build-key="governanceActivationFeedWorkerAlertsBadge"
            data-build-label="Feed worker alerts count"
          >
            {openFeedWorkerAlertsCount > 0 ? `${openFeedWorkerAlertsCount} worker alerts` : 'Worker alerts clear'}
          </Badge>
          <Badge
            variant="outline"
            className={pendingFeedOutboxCount > 0 || claimedFeedOutboxCount > 0
              ? 'border-sky-500/20 bg-sky-500/10 text-sky-800 dark:text-sky-200'
              : 'border-border bg-muted text-muted-foreground'}
            data-build-key="governanceActivationFeedQueueStatusBadge"
            data-build-label="Sweep queue status summary"
          >
            {pendingFeedOutboxCount === 0 && claimedFeedOutboxCount === 0
              ? 'Sweep queue empty'
              : [
                  pendingFeedOutboxCount > 0 ? `${pendingFeedOutboxCount} pending` : null,
                  claimedFeedOutboxCount > 0 ? `${claimedFeedOutboxCount} claimed` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
          </Badge>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => void scheduleFeedWorkerJobs(false)}
            disabled={schedulingFeedWorkerJobs || !canManageFeeds || feedWorkerBackendUnavailable}
            aria-busy={schedulingFeedWorkerJobs}
            data-build-key="governanceActivationFeedQueueDueSweeps"
            data-build-label="Queue due feed worker sweeps"
          >
            {schedulingFeedWorkerJobs ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Queue due sweeps
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={() => setForceRescheduleSweepOpen(true)}
            disabled={schedulingFeedWorkerJobs || !canManageFeeds || feedWorkerBackendUnavailable}
            data-build-key="governanceActivationFeedOpenForceRescheduleDialog"
            data-build-label="Open reset sweep queue dialog"
          >
            Reset queue and re-queue…
          </Button>
          <AlertDialog open={forceRescheduleSweepOpen} onOpenChange={setForceRescheduleSweepOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset sweep queue and re-queue?</AlertDialogTitle>
                <AlertDialogDescription>
                  This cancels every pending or in-progress sweep job for all adapters, then evaluates the schedule again.
                  Use when the queue looks wrong or stuck. Worker run history is not deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
                  type="button"
                  data-build-key="governanceActivationFeedCancelForceReschedule"
                  data-build-label="Cancel reset sweep queue"
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  type="button"
                  className={buttonVariants({ variant: 'destructive' })}
                  disabled={schedulingFeedWorkerJobs}
                  aria-busy={schedulingFeedWorkerJobs}
                  data-build-key="governanceActivationFeedConfirmForceReschedule"
                  data-build-label="Confirm reset sweep queue and re-queue"
                  onClick={(event) => {
                    event.preventDefault();
                    void scheduleFeedWorkerJobs(true).finally(() => {
                      setForceRescheduleSweepOpen(false);
                    });
                  }}
                >
                  {schedulingFeedWorkerJobs ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Reset and re-queue
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => void processFeedWorkerOutboxQueue()}
            disabled={processingFeedOutbox || !canManageFeeds || feedWorkerBackendUnavailable}
            aria-busy={processingFeedOutbox}
            data-build-key="governanceActivationFeedProcessSweepQueue"
            data-build-label="Process feed worker sweep queue"
          >
            {processingFeedOutbox ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Process sweep queue
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => void releaseStaleFeedWorkerClaims()}
            disabled={releasingStaleFeedWorkerClaims || !canManageFeeds || feedWorkerBackendUnavailable}
            aria-busy={releasingStaleFeedWorkerClaims}
            data-build-key="governanceActivationFeedReleaseStaleSweepClaims"
            data-build-label="Release stuck feed worker sweep claims"
          >
            {releasingStaleFeedWorkerClaims ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Release stuck sweep claims
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => void runFeedWorkerSweep()}
            disabled={runningFeedWorkers || !canManageFeeds || feedWorkerBackendUnavailable}
            aria-busy={runningFeedWorkers}
            data-build-key="governanceActivationFeedRunWorkerSweep"
            data-build-label="Run feed worker sweep"
          >
            {runningFeedWorkers ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Run worker sweep
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => void loadFeedData()}
            disabled={loadingFeedData}
            aria-busy={loadingFeedData}
            data-build-key="governanceActivationFeedRefreshFeeds"
            data-build-label="Refresh signed demographic feeds"
          >
            {loadingFeedData ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Refresh feeds
          </Button>
        </div>
      </div>

      {feedWorkerSchedulePolicy && !feedWorkerBackendUnavailable ? (
        <div
          className="mt-3 space-y-1 rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-xs text-muted-foreground"
          data-build-key="governanceActivationFeedSweepSchedulePolicy"
          data-build-label="Feed worker sweep schedule policy"
        >
          <p
            data-build-key="governanceActivationFeedSweepSchedulePolicyCadence"
            data-build-label="Feed worker default sweep cadence and claim timeout"
          >
            <span className="font-medium text-foreground/80">Scheduled sweeps:</span>{' '}
            new queue entries aim for roughly{' '}
            {Math.max(1, feedWorkerSchedulePolicy.default_interval_minutes)} minutes between due runs per adapter
            (unless an adapter sets its own interval). Stuck work releases after about{' '}
            {Math.max(1, feedWorkerSchedulePolicy.claim_ttl_minutes)} minutes.
          </p>
          <p
            data-build-key="governanceActivationFeedSweepSchedulePolicyStuckClaims"
            data-build-label="Feed worker stuck claim release guidance"
          >
            If a browser session stops mid-queue, claims past that timeout return to pending automatically, or you can use Release stuck sweep claims to run the same cleanup on demand.
          </p>
          <p
            data-build-key="governanceActivationFeedSweepSchedulePolicyPgCron"
            data-build-label="Feed worker optional database automation note"
          >
            When your Postgres instance has the hourly automation extension enabled, due jobs can enqueue on their own without leaving this screen open.
          </p>
          {feedWorkerScheduleAutomationStatus ? (
            <p
              data-build-key="governanceActivationFeedSchedulerAutomationStatus"
              data-build-label="Feed worker scheduler automation status"
            >
              <span className="font-medium text-foreground/80">Scheduler automation:</span>{' '}
              {feedWorkerScheduleAutomationStatus.cron_schema_available
                ? (feedWorkerScheduleAutomationStatus.cron_job_registered
                    ? (feedWorkerScheduleAutomationStatus.cron_job_active
                        ? 'pg_cron job is registered and active.'
                        : 'pg_cron job is registered but currently paused.')
                    : 'pg_cron is available, but this scheduler job is not registered yet.')
                : 'pg_cron is not available on this database host.'}
              {feedWorkerScheduleAutomationStatus.latest_scheduled_enqueue_at
                ? ` Last schedule enqueue observed ${formatTimestamp(feedWorkerScheduleAutomationStatus.latest_scheduled_enqueue_at)}.`
                : ' No schedule-based enqueue has been observed yet.'}
            </p>
          ) : null}
          {feedWorkerScheduleAutomationStatus ? (
            <p
              className="mt-1 text-[11px] text-muted-foreground"
              data-build-key="governanceActivationFeedSchedulerEscalationSignals"
              data-build-label="Feed worker on-call escalation snapshot for latest batch"
            >
              <span className="font-medium text-foreground/80">On-call escalation (latest batch):</span>{' '}
              {(feedWorkerScheduleAutomationStatus.worker_escalation_open_or_ack_page_count ?? 0) > 0 ? (
                <>
                  <span className="text-amber-800 dark:text-amber-200">
                    {feedWorkerScheduleAutomationStatus.worker_escalation_open_or_ack_page_count} open or acknowledged
                    {' '}
                    {(feedWorkerScheduleAutomationStatus.worker_escalation_open_or_ack_page_count ?? 0) === 1 ? 'page' : 'pages'}
                  </span>
                  {feedWorkerScheduleAutomationStatus.worker_escalation_latest_page_severity
                    ? ` · highest severity ${feedWorkerScheduleAutomationStatus.worker_escalation_latest_page_severity}`
                    : ''}
                  {feedWorkerScheduleAutomationStatus.worker_escalation_latest_opened_at
                    ? ` · latest opened ${formatTimestamp(feedWorkerScheduleAutomationStatus.worker_escalation_latest_opened_at)}`
                    : ''}
                </>
              ) : (
                <span className="text-muted-foreground">none open or acknowledged.</span>
              )}
            </p>
          ) : (
            <p
              data-build-key="governanceActivationFeedSchedulerAutomationStatusUnavailable"
              data-build-label="Feed worker scheduler automation status unavailable"
            >
              Scheduler automation status is unavailable in this environment.
            </p>
          )}
          {feedWorkerScheduleAutomationStatus?.cron_job_registered ? (
            <p
              data-build-key="governanceActivationFeedSchedulerCronDetails"
              data-build-label="Feed worker scheduler cron registration details"
            >
              Cron schedule: {feedWorkerScheduleAutomationStatus.cron_job_schedule || 'Unknown'}.
              Entrypoint: {feedWorkerScheduleAutomationStatus.cron_job_command || 'Unknown'}.
            </p>
          ) : null}
          {feedWorkerScheduleAutomationStatus?.latest_scheduled_enqueue_job_id ? (
            <p
              data-build-key="governanceActivationFeedSchedulerLatestQueuedJob"
              data-build-label="Latest schedule-enqueued sweep job identifier"
            >
              Latest schedule-enqueued job ID:{' '}
              {formatShortId(feedWorkerScheduleAutomationStatus.latest_scheduled_enqueue_job_id)}
            </p>
          ) : null}
          {feedWorkerScheduleAutomationStatus?.latest_cron_run_started_at ? (
            <p
              data-build-key="governanceActivationFeedSchedulerLatestCronRun"
              data-build-label="Latest feed scheduler cron run outcome"
            >
              Latest cron run {formatCronRunStatusLabel(feedWorkerScheduleAutomationStatus.latest_cron_run_status)}:
              {' '}
              started {formatTimestamp(feedWorkerScheduleAutomationStatus.latest_cron_run_started_at)}
              {feedWorkerScheduleAutomationStatus.latest_cron_run_finished_at
                ? ` • finished ${formatTimestamp(feedWorkerScheduleAutomationStatus.latest_cron_run_finished_at)}`
                : ''}
              {feedWorkerScheduleAutomationStatus.latest_cron_run_details
                ? ` • ${formatTruncatedGovernanceNote(feedWorkerScheduleAutomationStatus.latest_cron_run_details, 120)}`
                : ''}
            </p>
          ) : null}
          {feedWorkerScheduleAutomationStatus?.latest_automation_run_started_at ? (
            <p
              data-build-key="governanceActivationFeedSchedulerLatestAutomationLedgerRun"
              data-build-label="Latest recorded scheduler automation run from audit ledger"
            >
              <span className="font-medium text-foreground/80">Latest automation run (ledger):</span>{' '}
              {formatCronRunStatusLabel(feedWorkerScheduleAutomationStatus.latest_automation_run_status)} —{' '}
              {formatScheduleAutomationTriggerLabel(feedWorkerScheduleAutomationStatus.latest_automation_run_trigger_source)}
              {' · '}
              started {formatTimestamp(feedWorkerScheduleAutomationStatus.latest_automation_run_started_at)}
              {feedWorkerScheduleAutomationStatus.latest_automation_run_finished_at
                ? ` • finished ${formatTimestamp(feedWorkerScheduleAutomationStatus.latest_automation_run_finished_at)}`
                : ''}
              {feedWorkerScheduleAutomationStatus.latest_automation_run_message
                ? ` • ${formatTruncatedGovernanceNote(feedWorkerScheduleAutomationStatus.latest_automation_run_message, 160)}`
                : ''}
            </p>
          ) : null}
          {feedWorkerScheduleAutomationRunHistory.length > 0 ? (
            <div
              className="mt-2 space-y-1 rounded-md border border-border/40 bg-muted/20 px-2 py-2"
              data-build-key="governanceActivationFeedSchedulerAutomationRunHistory"
              data-build-label="Recent scheduler automation run history"
            >
              <p className="text-xs font-semibold text-muted-foreground">Recent automation runs</p>
              <ul className="max-h-40 space-y-1.5 overflow-y-auto text-xs text-muted-foreground">
                {feedWorkerScheduleAutomationRunHistory.map((row) => (
                  <li
                    key={row.run_id}
                    data-build-key={`governanceActivationFeedSchedulerAutomationRunRow:${row.run_id}`}
                    data-build-label={`Automation run ${formatShortId(row.run_id) ?? row.run_id}`}
                  >
                    <span className="font-medium text-foreground/90">
                      {formatTimestamp(row.run_started_at)}
                    </span>
                    {' · '}
                    {formatCronRunStatusLabel(row.run_status)}
                    {' · '}
                    {formatScheduleAutomationTriggerLabel(row.trigger_source)}
                    {row.force_reschedule_applied ? ' · force reschedule' : ''}
                    {' · '}
                    jobs {row.jobs_enqueued_count}, adapter issues {row.adapter_issue_count}, open pages{' '}
                    {row.open_or_ack_page_count}
                    {row.triggered_by_name ? ` · ${row.triggered_by_name}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {feedSchedulerRunHealth ? (
            <Badge
              variant="outline"
              className={feedSchedulerRunHealth.className}
              title={feedSchedulerHealthBadgeTitles.cronRunTitle}
              data-build-key="governanceActivationFeedSchedulerRunHealthBadge"
              data-build-label="Feed scheduler latest run health badge"
            >
              {feedSchedulerRunHealth.label}
            </Badge>
          ) : null}
          {feedSchedulerEnqueueHealth ? (
            <Badge
              variant="outline"
              className={feedSchedulerEnqueueHealth.className}
              title={feedSchedulerHealthBadgeTitles.enqueueTitle}
              data-build-key="governanceActivationFeedSchedulerEnqueueHealthBadge"
              data-build-label="Feed scheduler enqueue freshness badge"
            >
              {feedSchedulerEnqueueHealth.label}
            </Badge>
          ) : null}
        </div>
      ) : null}

      {!feedWorkerBackendUnavailable ? (
        <div
          className="mt-3 space-y-2 rounded-lg border border-border/50 bg-background/40 px-3 py-2"
          data-build-key="governanceActivationFeedSweepQueueCard"
          data-build-label="Activation feed worker sweep queue"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Active sweep queue jobs
            <span
              className="ml-2 font-normal normal-case tracking-normal text-muted-foreground"
              data-build-key="governanceActivationFeedOutboxActivePaginationStatus"
              data-build-label="Active sweep queue pagination status"
            >
              ({feedWorkerOutboxActiveJobs.length} loaded of {activeFeedOutboxCount}
              {feedWorkerOutboxActiveJobsHasMore ? ', more available' : ''})
            </span>
          </p>
          {feedWorkerOutboxActiveJobs.length === 0 ? (
            <p
              className="text-xs text-muted-foreground"
              data-build-key="governanceActivationFeedOutboxActiveJobsEmpty"
              data-build-label="No active sweep queue jobs"
            >
              No jobs are pending or in progress right now.
            </p>
          ) : (
            <div className="max-h-44 space-y-2 overflow-y-auto text-xs text-muted-foreground">
              {feedWorkerOutboxActiveJobs.map((job) => {
                const adapterLabel = feedAdapterNameById.get(job.adapter_id) ?? 'Adapter';
                const workerLabel = formatShortWorkerIdentity(job.worker_identity);
                return (
                  <div
                    key={job.id}
                    className="rounded-md border border-border/50 bg-card/60 px-2 py-1.5"
                    data-build-key={`governanceActivationFeedOutboxActiveJobRow:${job.id}`}
                    data-build-label={`${adapterLabel} · ${job.status === 'claimed' ? 'Claimed' : 'Pending'} sweep job`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p
                        className="font-medium text-foreground"
                        data-build-key={`governanceActivationFeedOutboxActiveJobAdapterTitle:${job.id}`}
                        data-build-label={`Sweep queue adapter name (${adapterLabel})`}
                      >
                        {adapterLabel}
                      </p>
                      <Badge
                        variant="outline"
                        className={job.status === 'claimed'
                          ? 'border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-200'
                          : 'border-sky-500/20 bg-sky-500/10 text-sky-900 dark:text-sky-100'}
                        data-build-key={`governanceActivationFeedOutboxActiveJobStatus:${job.id}`}
                        data-build-label={job.status === 'claimed' ? 'Sweep job claimed' : 'Sweep job pending'}
                      >
                        {job.status === 'claimed' ? 'Claimed' : 'Pending'}
                      </Badge>
                    </div>
                    <p
                      className="mt-1"
                      data-build-key={`governanceActivationFeedOutboxActiveJobTimeline:${job.id}`}
                      data-build-label="Sweep queue job request and claim times"
                    >
                      Requested {formatTimestamp(job.requested_at)}
                      {job.claimed_at ? ` • claimed ${formatTimestamp(job.claimed_at)}` : ''}
                      {job.claim_expires_at ? ` • claim expires ${formatTimestamp(job.claim_expires_at)}` : ''}
                    </p>
                    {typeof job.attempt_count === 'number' && job.attempt_count > 0 ? (
                      <p
                        className="mt-0.5"
                        data-build-key={`governanceActivationFeedOutboxActiveJobAttempts:${job.id}`}
                        data-build-label="Sweep queue job attempt count"
                      >
                        Attempts {job.attempt_count}
                      </p>
                    ) : null}
                    {workerLabel ? (
                      <p
                        className="mt-0.5 break-all text-muted-foreground"
                        data-build-key={`governanceActivationFeedOutboxActiveJobWorker:${job.id}`}
                        data-build-label="Sweep queue job worker identity"
                      >
                        Worker: {workerLabel}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
          {feedWorkerOutboxActiveListTruncated ? (
            <p
              className="text-xs text-muted-foreground"
              data-build-key="governanceActivationFeedOutboxActiveListTruncationNote"
              data-build-label="Note when sweep queue list is capped"
            >
              Additional pending or claimed jobs may exist beyond this list; use Load older active queue jobs to fetch
              more rows.
            </p>
          ) : null}
          {feedWorkerOutboxActiveJobsHasMore ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full gap-2"
              disabled={loadingMoreFeedWorkerOutboxActiveJobs}
              aria-busy={loadingMoreFeedWorkerOutboxActiveJobs}
              onClick={() => void loadMoreFeedWorkerOutboxActiveJobs()}
              data-build-key="governanceActivationFeedLoadOlderOutboxActiveJobs"
              data-build-label="Load older active sweep queue jobs"
            >
              {loadingMoreFeedWorkerOutboxActiveJobs ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Load older active queue jobs
            </Button>
          ) : null}

          <Collapsible open={recentClosedSweepJobsOpen} onOpenChange={setRecentClosedSweepJobsOpen}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto w-full justify-start gap-2 px-0 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                data-build-key="governanceActivationFeedClosedSweepJobsToggle"
                data-build-label="Recently closed sweep jobs section"
              >
                {recentClosedSweepJobsOpen
                  ? <ChevronDown className="h-4 w-4 shrink-0" />
                  : <ChevronRight className="h-4 w-4 shrink-0" />}
                Recently closed sweep jobs
                {' '}
                <span
                  data-build-key="governanceActivationFeedOutboxClosedPaginationStatus"
                  data-build-label="Closed sweep queue pagination status"
                >
                  ({feedWorkerOutboxRecentClosedJobs.length} loaded of {closedFeedOutboxCount}
                  {feedWorkerOutboxRecentClosedJobsHasMore ? ', more available' : ''})
                </span>
                {recentClosedSweepFailureCount > 0
                  ? ` · ${recentClosedSweepFailureCount} failed`
                  : ''}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-1">
              {feedWorkerOutboxRecentClosedJobs.length === 0 ? (
                <p
                  className="text-xs text-muted-foreground"
                  data-build-key="governanceActivationFeedOutboxClosedJobsEmpty"
                  data-build-label="No closed sweep jobs in loaded window"
                >
                  No completed, cancelled, or failed sweep jobs in the latest window.
                </p>
              ) : (
                <div className="max-h-40 space-y-2 overflow-y-auto text-xs text-muted-foreground">
                  {feedWorkerOutboxRecentClosedJobs.map((job) => {
                    const adapterLabel = feedAdapterNameById.get(job.adapter_id) ?? 'Adapter';
                    const closedAt = job.completed_at ?? job.updated_at;
                    const statusBadgeClass = job.status === 'completed'
                      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                      : job.status === 'failed'
                        ? 'border-rose-500/20 bg-rose-500/10 text-rose-800 dark:text-rose-200'
                        : 'border-border bg-muted text-muted-foreground';
                    return (
                      <div
                        key={job.id}
                        className="rounded-md border border-border/50 bg-card/60 px-2 py-1.5"
                        data-build-key={`governanceActivationFeedOutboxClosedJobRow:${job.id}`}
                        data-build-label={`${adapterLabel} · ${formatActivationDemographicFeedOutboxClosedStatusLabel(job.status)} sweep job`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p
                            className="font-medium text-foreground"
                            data-build-key={`governanceActivationFeedOutboxClosedJobAdapterTitle:${job.id}`}
                            data-build-label={`Closed sweep queue adapter name (${adapterLabel})`}
                          >
                            {adapterLabel}
                          </p>
                          <Badge
                            variant="outline"
                            className={statusBadgeClass}
                            data-build-key={`governanceActivationFeedOutboxClosedJobStatus:${job.id}`}
                            data-build-label={`Closed sweep job: ${formatActivationDemographicFeedOutboxClosedStatusLabel(job.status)}`}
                          >
                            {formatActivationDemographicFeedOutboxClosedStatusLabel(job.status)}
                          </Badge>
                        </div>
                        <p
                          className="mt-1"
                          data-build-key={`governanceActivationFeedOutboxClosedJobTimeline:${job.id}`}
                          data-build-label="Closed sweep job close and request times"
                        >
                          Closed {formatTimestamp(closedAt)}
                          {job.requested_at ? ` • requested ${formatTimestamp(job.requested_at)}` : ''}
                        </p>
                        {job.error_message?.trim() ? (
                          <p
                            className={
                              job.status === 'failed'
                                ? 'mt-1 text-rose-700 dark:text-rose-300'
                                : 'mt-1 text-muted-foreground'
                            }
                            data-build-key={`governanceActivationFeedOutboxClosedJobMessage:${job.id}`}
                            data-build-label="Closed sweep job resolution message"
                          >
                            {formatTruncatedGovernanceNote(job.error_message, 140)}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
              {feedWorkerOutboxRecentClosedJobsHasMore ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full gap-2"
                  disabled={loadingMoreFeedWorkerOutboxRecentClosedJobs}
                  aria-busy={loadingMoreFeedWorkerOutboxRecentClosedJobs}
                  onClick={() => void loadMoreFeedWorkerOutboxRecentClosedJobs()}
                  data-build-key="governanceActivationFeedLoadOlderOutboxClosedJobs"
                  data-build-label="Load older closed sweep queue jobs"
                >
                  {loadingMoreFeedWorkerOutboxRecentClosedJobs ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Load older closed queue jobs
                </Button>
              ) : null}
              {feedWorkerOutboxClosedListTruncated && !feedWorkerOutboxRecentClosedJobsHasMore ? (
                <p
                  className="text-xs text-muted-foreground"
                  data-build-key="governanceActivationFeedOutboxClosedListTruncationNote"
                  data-build-label="Note when closed sweep queue list is capped"
                >
                  Additional closed jobs may exist beyond this list.
                </p>
              ) : null}
            </CollapsibleContent>
          </Collapsible>
        </div>
      ) : null}

      {!feedWorkerBackendUnavailable ? (
        <div
          className="mt-3 space-y-2 rounded-lg border border-border/50 bg-background/40 px-3 py-2"
          data-build-key="governanceActivationFeedWorkerRunsCard"
          data-build-label="Recent activation feed worker runs"
        >
          <p
            className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
            data-build-key="governanceActivationFeedWorkerRunsSectionTitle"
            data-build-label="Recent worker runs section heading"
          >
            Recent worker runs
            <span
              className="ml-2 font-normal normal-case tracking-normal text-muted-foreground"
              data-build-key="governanceActivationFeedWorkerRunsPaginationStatus"
              data-build-label="Recent worker runs pagination status"
            >
              ({feedWorkerRecentRuns.length} loaded{feedWorkerRunsHasMore ? ', more available' : ''} by observed time)
            </span>
          </p>
          {feedWorkerRecentRuns.length === 0 ? (
            <p
              className="text-xs text-muted-foreground"
              data-build-key="governanceActivationFeedWorkerRunsEmpty"
              data-build-label="No worker runs loaded yet"
            >
              No worker runs to show yet. Outcomes appear here after sweeps, queue jobs, or steward ingestions.
            </p>
          ) : (
            <div className="max-h-52 space-y-2 overflow-y-auto text-xs text-muted-foreground">
              {feedWorkerRecentRuns.map((run) => {
                const adapterLabel = feedAdapterNameById.get(run.adapter_id) ?? 'Adapter';
                const severityClass = run.alert_severity === 'critical'
                  ? 'border-rose-500/20 bg-rose-500/10 text-rose-800 dark:text-rose-200'
                  : run.alert_severity === 'warning'
                    ? 'border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-200'
                    : 'border-border bg-muted text-muted-foreground';
                const runStatusLabel = formatActivationDemographicFeedWorkerRunOutcomeLabel(run.run_status);
                const alertKindLabel = formatActivationDemographicFeedWorkerAlertKindLabel(run.alert_type);
                const severityLabel = run.alert_severity.charAt(0).toUpperCase() + run.alert_severity.slice(1);
                return (
                  <div
                    key={run.id}
                    className="rounded-md border border-border/50 bg-card/60 px-2 py-1.5"
                    data-build-key={`governanceActivationFeedWorkerRunRow:${run.id}`}
                    data-build-label={`${adapterLabel} worker run · ${runStatusLabel}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p
                        className="font-medium text-foreground"
                        data-build-key={`governanceActivationFeedWorkerRunAdapterTitle:${run.id}`}
                        data-build-label={`Worker run adapter name (${adapterLabel})`}
                      >
                        {adapterLabel}
                      </p>
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge
                          variant="outline"
                          className="border-border bg-muted/80 text-foreground/90"
                          data-build-key={`governanceActivationFeedWorkerRunStatus:${run.id}`}
                          data-build-label={`Worker run status: ${runStatusLabel}`}
                        >
                          {runStatusLabel}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="border-border bg-muted/80 text-foreground/90"
                          data-build-key={`governanceActivationFeedWorkerRunAlertKind:${run.id}`}
                          data-build-label={`Worker run alert kind: ${alertKindLabel}`}
                        >
                          {alertKindLabel}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={severityClass}
                          data-build-key={`governanceActivationFeedWorkerRunSeverity:${run.id}`}
                          data-build-label={`Worker run severity: ${severityLabel}`}
                        >
                          {severityLabel}
                        </Badge>
                        {run.resolved_at ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                            data-build-key={`governanceActivationFeedWorkerRunResolution:${run.id}`}
                            data-build-label="Worker run resolved status"
                          >
                            Resolved
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-border text-muted-foreground"
                            data-build-key={`governanceActivationFeedWorkerRunResolution:${run.id}`}
                            data-build-label="Worker run open status"
                          >
                            Open
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p
                      className="mt-1"
                      data-build-key={`governanceActivationFeedWorkerRunTimeline:${run.id}`}
                      data-build-label="Worker run observed and resolved times"
                    >
                      Observed {formatTimestamp(run.observed_at)}
                      {run.resolved_at ? ` • resolved ${formatTimestamp(run.resolved_at)}` : ''}
                    </p>
                    <p
                      className="mt-1 text-foreground/90"
                      data-build-key={`governanceActivationFeedWorkerRunMessage:${run.id}`}
                      data-build-label="Worker run alert message"
                    >
                      {formatTruncatedGovernanceNote(run.alert_message)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
          {feedWorkerRunsHasMore ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full gap-2"
              disabled={loadingMoreFeedWorkerRuns}
              aria-busy={loadingMoreFeedWorkerRuns}
              onClick={() => void loadMoreFeedWorkerRuns()}
              data-build-key="governanceActivationFeedLoadOlderWorkerRuns"
              data-build-label="Load older feed worker runs"
            >
              {loadingMoreFeedWorkerRuns ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Load older worker runs
            </Button>
          ) : null}
        </div>
      ) : null}

      {canManageFeeds && !feedWorkerBackendUnavailable ? (
        <div
          className="mt-3 rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-xs text-muted-foreground"
          data-build-key="governanceActivationFeedOnCallEscalationCard"
          data-build-label="Feed worker on-call escalation"
        >
          <p
            data-build-key="governanceActivationFeedOnCallEscalationGuidance"
            data-build-label="Feed worker on-call escalation guidance"
          >
            If adapters stay unhealthy, you can open or refresh the public audit on-call page for feed workers (same flow as queue and cron ticks). You can acknowledge or resolve open pages below without leaving this console; verifier stewards can still use Public audit → Immutable anchoring automation. Use copy below if you need the exact page identifier when searching the global board.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="gap-2"
              disabled={escalatingFeedWorkerPublicExecution}
              aria-busy={escalatingFeedWorkerPublicExecution}
              onClick={() => void escalateFeedWorkerAlertsToPublicExecution()}
              data-build-key="governanceActivationFeedEscalateWorkerAlerts"
              data-build-label="Update on-call page for feed worker alerts"
            >
              {escalatingFeedWorkerPublicExecution ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Update on-call page for feed worker alerts
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => void copyActivationFeedWorkerEscalationPageKey()}
              data-build-key="governanceActivationFeedCopyEscalationPageKey"
              data-build-label="Copy feed worker escalation page key"
            >
              <Copy className="h-4 w-4" />
              Copy on-call page key
            </Button>
          </div>
          <div
            className="mt-3 rounded-md border border-border/40 bg-background/50 px-2 py-2"
            data-build-key="governanceActivationFeedEscalationBoardActions"
            data-build-label="Feed worker escalation pages for current batch"
          >
            <p className="text-[11px] font-semibold text-foreground/90">Current batch on-call pages</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Open or acknowledged:
              {' '}
              <span className="font-semibold text-foreground/90">{feedWorkerEscalationOpenOrAckPageCount}</span>
            </p>
            {feedWorkerEscalationBoardPages.filter((p) => p.pageStatus === 'open' || p.pageStatus === 'acknowledged').length > 0 ? (
              <div className="mt-2 space-y-2">
                {feedWorkerEscalationBoardPages
                  .filter((page) => page.pageStatus === 'open' || page.pageStatus === 'acknowledged')
                  .map((page) => (
                    <div
                      key={page.pageId}
                      className="rounded border border-border/50 bg-background/60 px-2 py-2 text-[11px]"
                      data-build-key={`governanceActivationFeedEscalationBoardRow:${page.pageId}`}
                      data-build-label={`Feed worker batch escalation ${formatShortId(page.pageId) ?? page.pageId}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-foreground/90">
                          {page.pageStatus.toUpperCase()}
                          {' · '}
                          {page.severity.toUpperCase()}
                        </p>
                        <p className="text-muted-foreground">{formatTimestamp(page.openedAt)}</p>
                      </div>
                      <p className="mt-1 text-muted-foreground">{formatTruncatedGovernanceNote(page.pageMessage)}</p>
                      <p className="mt-1 text-muted-foreground">Channel: {page.oncallChannel}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[11px]"
                          disabled={acknowledgingFeedWorkerEscalationPageId === page.pageId}
                          aria-busy={acknowledgingFeedWorkerEscalationPageId === page.pageId}
                          onClick={() => void acknowledgeFeedWorkerEscalationPage(page.pageId)}
                          data-build-key={`governanceActivationFeedAckEscalation:${page.pageId}`}
                          data-build-label="Acknowledge feed worker escalation page"
                        >
                          {acknowledgingFeedWorkerEscalationPageId === page.pageId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          Acknowledge page
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-7 px-2 text-[11px]"
                          disabled={resolvingFeedWorkerEscalationPageId === page.pageId}
                          aria-busy={resolvingFeedWorkerEscalationPageId === page.pageId}
                          onClick={() => void resolveFeedWorkerEscalationPage(page.pageId)}
                          data-build-key={`governanceActivationFeedResolveEscalation:${page.pageId}`}
                          data-build-label="Resolve feed worker escalation page"
                        >
                          {resolvingFeedWorkerEscalationPageId === page.pageId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          Resolve page
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-muted-foreground">
                No open or acknowledged escalation pages on the current batch.
              </p>
            )}
          </div>
          <div
            className="mt-3 rounded-md border border-border/40 bg-muted/15 px-2 py-2"
            data-build-key="governanceActivationFeedEscalationHistoryAnalytics"
            data-build-label="Feed worker on-call escalation incident history summary"
          >
            <p className="text-[11px] font-semibold text-foreground/90">On-call page history (14-day lookback)</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 text-[11px] text-muted-foreground">
              <div>
                <p className="font-medium text-foreground/90">24-hour incident flow</p>
                <p className="mt-1">Opened (24h): {feedWorkerEscalationHistoryAnalytics.opened24h}</p>
                <p>Resolved (24h): {feedWorkerEscalationHistoryAnalytics.resolved24h}</p>
              </div>
              <div>
                <p className="font-medium text-foreground/90">Resolution quality</p>
                <p className="mt-1">Unresolved pages: {feedWorkerEscalationHistoryAnalytics.unresolved}</p>
                <p>
                  Average resolution:
                  {' '}
                  {feedWorkerEscalationHistoryAnalytics.averageResolutionHours === null
                    ? 'n/a'
                    : `${feedWorkerEscalationHistoryAnalytics.averageResolutionHours.toFixed(2)}h`}
                </p>
              </div>
            </div>
            {feedWorkerEscalationPageHistory.length > 0 ? (
              <details className="mt-2 rounded border border-border/50 bg-background/50 p-2">
                <summary className="cursor-pointer text-[11px] font-medium text-foreground">
                  Recent on-call pages ({feedWorkerEscalationPageHistory.length} in window)
                </summary>
                <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto">
                  {feedWorkerEscalationPageHistory.slice(0, 12).map((page) => (
                    <li
                      key={page.pageId}
                      className="rounded border border-border/40 bg-background/60 px-2 py-1.5 text-[11px]"
                      data-build-key={`governanceActivationFeedEscalationHistoryRow:${page.pageId}`}
                      data-build-label={`Feed worker escalation page ${formatShortId(page.pageId) ?? page.pageId}`}
                    >
                      <span className="font-medium text-foreground/90">
                        {page.pageStatus.toUpperCase()}
                        {' · '}
                        {page.severity.toUpperCase()}
                      </span>
                      {' · '}
                      {formatTimestamp(page.openedAt)}
                      {page.resolvedAt ? ` → resolved ${formatTimestamp(page.resolvedAt)}` : ''}
                      <p className="mt-1 text-muted-foreground">{formatTruncatedGovernanceNote(page.pageMessage)}</p>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        </div>
      ) : null}

      {feedWorkerBackendUnavailable && (
        <p
          className="mt-2 text-xs text-muted-foreground"
          data-build-key="governanceActivationFeedWorkerBackendUnavailable"
          data-build-label="Feed worker backend unavailable notice"
        >
          Worker alert persistence backend is not available here yet. Freshness fallback is still shown.
        </p>
      )}

      {!canManageFeeds ? (
        <p
          className="mt-2 text-sm text-muted-foreground"
          data-build-key="governanceActivationFeedStewardOnlyNotice"
          data-build-label="Feed management limited to stewards"
        >
          Feed management is limited to activation and technical stewards.
        </p>
      ) : (
        <div
          className="mt-3 grid gap-3 xl:grid-cols-2"
          data-build-key="governanceActivationFeedStewardFormsRow"
          data-build-label="Feed adapter stewardship forms"
        >
          <div
            className="space-y-2 rounded-lg border border-border/60 bg-background/70 p-2.5"
            data-build-key="governanceActivationFeedRegisterAdapterForm"
            data-build-label="Register signed demographic feed adapter"
          >
            <p
              className="text-xs uppercase tracking-[0.12em] text-muted-foreground"
              data-build-key="governanceActivationFeedRegisterAdapterSectionTitle"
              data-build-label="Register adapter section title"
            >
              Register adapter
            </p>
            <Input
              value={adapterDraft.adapterKey}
              onChange={(event) => setAdapterDraft((current) => ({ ...current, adapterKey: event.target.value }))}
              placeholder="Adapter key"
              data-build-key="governanceActivationFeedAdapterKeyInput"
              data-build-label="Adapter key"
            />
            <Input
              value={adapterDraft.adapterName}
              onChange={(event) => setAdapterDraft((current) => ({ ...current, adapterName: event.target.value }))}
              placeholder="Adapter name"
              data-build-key="governanceActivationFeedAdapterNameInput"
              data-build-label="Adapter name"
            />
            <Select
              value={adapterDraft.scopeType}
              onValueChange={(value) => setAdapterDraft((current) => ({
                ...current,
                scopeType: value as 'world' | 'country',
                countryCode: value === 'world' ? '' : current.countryCode,
              }))}
            >
              <SelectTrigger
                data-build-key="governanceActivationFeedAdapterScopeSelect"
                data-build-label="Adapter scope"
              >
                <SelectValue placeholder="Adapter scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="world">World</SelectItem>
                <SelectItem value="country">Country</SelectItem>
              </SelectContent>
            </Select>
            {adapterDraft.scopeType === 'country' && (
              <Input
                value={adapterDraft.countryCode}
                onChange={(event) => setAdapterDraft((current) => ({ ...current, countryCode: event.target.value.toUpperCase() }))}
                placeholder="Country code"
                maxLength={2}
                data-build-key="governanceActivationFeedAdapterCountryCodeInput"
                data-build-label="Adapter country code"
              />
            )}
            <Input
              value={adapterDraft.endpointUrl}
              onChange={(event) => setAdapterDraft((current) => ({ ...current, endpointUrl: event.target.value }))}
              placeholder="Endpoint URL"
              data-build-key="governanceActivationFeedAdapterEndpointUrlInput"
              data-build-label="Adapter endpoint URL"
            />
            <Input
              value={adapterDraft.publicSignerKey}
              onChange={(event) => setAdapterDraft((current) => ({ ...current, publicSignerKey: event.target.value }))}
              placeholder="Public signer key (base64url spki)"
              data-build-key="governanceActivationFeedAdapterPublicSignerKeyInput"
              data-build-label="Adapter public signer key"
            />
            <Input
              value={adapterDraft.keyAlgorithm}
              onChange={(event) => setAdapterDraft((current) => ({ ...current, keyAlgorithm: event.target.value }))}
              placeholder="Key algorithm"
              data-build-key="governanceActivationFeedAdapterKeyAlgorithmInput"
              data-build-label="Adapter key algorithm"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full gap-2"
              disabled={registeringFeedAdapter}
              aria-busy={registeringFeedAdapter}
              onClick={() => void registerFeedAdapter(adapterDraft)}
              data-build-key="governanceActivationFeedSaveAdapter"
              data-build-label="Save signed demographic feed adapter"
            >
              {registeringFeedAdapter ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save feed adapter
            </Button>
          </div>

          <div
            className="space-y-2 rounded-lg border border-border/60 bg-background/70 p-2.5"
            data-build-key="governanceActivationFeedIngestSignedSnapshotForm"
            data-build-label="Ingest signed demographic feed snapshot"
          >
            <p
              className="text-xs uppercase tracking-[0.12em] text-muted-foreground"
              data-build-key="governanceActivationFeedIngestSnapshotSectionTitle"
              data-build-label="Ingest signed feed snapshot section title"
            >
              Ingest signed feed snapshot
            </p>
            <Label
              className="text-xs"
              data-build-key="governanceActivationFeedIngestionAdapterLabel"
              data-build-label="Ingestion adapter label"
            >
              Adapter
            </Label>
            <Select
              value={ingestionDraft.adapterId}
              onValueChange={(value) => setIngestionDraft((current) => ({ ...current, adapterId: value }))}
            >
              <SelectTrigger
                data-build-key="governanceActivationFeedIngestionAdapterSelect"
                data-build-label="Ingestion target adapter"
              >
                <SelectValue placeholder="Select adapter" />
              </SelectTrigger>
              <SelectContent>
                {activeAdapters.map((adapter) => (
                  <SelectItem key={adapter.id} value={adapter.id}>{adapter.adapter_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              value={ingestionDraft.targetPopulation}
              onChange={(event) => setIngestionDraft((current) => ({ ...current, targetPopulation: event.target.value }))}
              placeholder="Target population"
              data-build-key="governanceActivationFeedIngestionTargetPopulationInput"
              data-build-label="Ingestion target population"
            />
            <Input
              type="datetime-local"
              value={ingestionDraft.observedAt}
              onChange={(event) => setIngestionDraft((current) => ({ ...current, observedAt: event.target.value }))}
              data-build-key="governanceActivationFeedIngestionObservedAtInput"
              data-build-label="Ingestion observed time"
            />
            <Input
              value={ingestionDraft.sourceUrl}
              onChange={(event) => setIngestionDraft((current) => ({ ...current, sourceUrl: event.target.value }))}
              placeholder="Source URL (optional)"
              data-build-key="governanceActivationFeedIngestionSourceUrlInput"
              data-build-label="Ingestion source URL"
            />
            <Textarea
              value={ingestionDraft.signedPayload}
              onChange={(event) => setIngestionDraft((current) => ({ ...current, signedPayload: event.target.value }))}
              rows={3}
              placeholder="Signed payload"
              data-build-key="governanceActivationFeedIngestionSignedPayload"
              data-build-label="Ingestion signed payload"
            />
            <Input
              value={ingestionDraft.payloadSignature}
              onChange={(event) => setIngestionDraft((current) => ({ ...current, payloadSignature: event.target.value }))}
              placeholder="Payload signature (base64url)"
              data-build-key="governanceActivationFeedIngestionPayloadSignatureInput"
              data-build-label="Ingestion payload signature"
            />
            <Textarea
              value={ingestionDraft.ingestionNotes}
              onChange={(event) => setIngestionDraft((current) => ({ ...current, ingestionNotes: event.target.value }))}
              rows={2}
              placeholder="Ingestion notes"
              data-build-key="governanceActivationFeedIngestionNotes"
              data-build-label="Ingestion notes"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full gap-2"
              disabled={ingestingSignedFeedSnapshot}
              aria-busy={ingestingSignedFeedSnapshot}
              onClick={() => void ingestSignedFeedSnapshot(ingestionDraft)}
              data-build-key="governanceActivationFeedIngestSignedSnapshot"
              data-build-label="Verify and ingest signed demographic snapshot"
            >
              {ingestingSignedFeedSnapshot ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Verify and ingest signed snapshot
            </Button>
          </div>
        </div>
      )}

      {feedWorkerAlerts.length > 0 && (
        <div
          className="mt-3 space-y-2 rounded-lg border border-border/60 bg-background/70 p-2.5"
          data-build-key="governanceActivationFeedWorkerAlerts"
          data-build-label="Feed worker freshness and signature alerts"
        >
          <p
            className="text-xs uppercase tracking-[0.12em] text-muted-foreground"
            data-build-key="governanceActivationFeedWorkerAlertsSectionTitle"
            data-build-label="Feed worker alerts section heading"
          >
            Worker freshness + signature alerts
            <span
              className="ml-2 font-normal normal-case tracking-normal text-muted-foreground"
              data-build-key="governanceActivationFeedWorkerAlertsPaginationStatus"
              data-build-label="Feed worker alerts pagination status"
            >
              ({visibleFeedWorkerAlerts.length} loaded{feedWorkerAlertsHasMore ? ', more available' : ''})
            </span>
          </p>
          {visibleFeedWorkerAlerts.map((alert) => {
            const alertCount = countFeedWorkerAlerts(alert);
            const resolveAllKey = `${alert.adapter_id}:all`;
            const scopeLabel = formatActivationDemographicFeedScopeLabel(alert.scope_type, alert.country_code);
            const adapterRow = feedAdapters.find((adapter) => adapter.id === alert.adapter_id);
            const customSweepMinutes = adapterRow?.worker_sweep_interval_minutes;

            return (
              <div
                key={alert.adapter_id}
                className="rounded-md border border-border/60 bg-card p-2 text-xs"
                data-build-key={`governanceActivationFeedWorkerAlertCard__${alert.adapter_id}`}
                data-build-label={`Feed worker alerts (${alert.adapter_key})`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p
                    className="font-medium text-foreground"
                    data-build-key={`governanceActivationFeedAlertAdapterTitle:${alert.adapter_id}`}
                    data-build-label={`Feed worker alert adapter title (${alert.adapter_key})`}
                  >
                    {alert.adapter_name} ({scopeLabel})
                  </p>
                  <div className="flex flex-wrap items-center gap-1">
                    {alert.freshness_alert && (
                      <Badge
                        variant="outline"
                        className="border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                        data-build-key={`governanceActivationFeedAlertFreshnessBadge:${alert.adapter_id}`}
                        data-build-label={`Freshness alert (${alert.adapter_key})`}
                      >
                        Freshness stale{typeof alert.stale_by_hours === 'number' ? ` ${alert.stale_by_hours}h` : ''}
                      </Badge>
                    )}
                    {alert.signature_failure_count > 0 && (
                      <Badge
                        variant="outline"
                        className="border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                        data-build-key={`governanceActivationFeedAlertSignatureBadge:${alert.adapter_id}`}
                        data-build-label={`Signature alert count (${alert.adapter_key})`}
                      >
                        Signature {alert.signature_failure_count}
                      </Badge>
                    )}
                    {alert.connectivity_failure_count > 0 && (
                      <Badge
                        variant="outline"
                        className="border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                        data-build-key={`governanceActivationFeedAlertConnectivityBadge:${alert.adapter_id}`}
                        data-build-label={`Connectivity alert count (${alert.adapter_key})`}
                      >
                        Connectivity {alert.connectivity_failure_count}
                      </Badge>
                    )}
                    {alert.payload_failure_count > 0 && (
                      <Badge
                        variant="outline"
                        className="border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                        data-build-key={`governanceActivationFeedAlertPayloadBadge:${alert.adapter_id}`}
                        data-build-label={`Payload alert count (${alert.adapter_key})`}
                      >
                        Payload {alert.payload_failure_count}
                      </Badge>
                    )}
                    {alertCount === 0 && (
                      <Badge
                        variant="outline"
                        className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        data-build-key={`governanceActivationFeedAlertHealthyBadge:${alert.adapter_id}`}
                        data-build-label={`Feed worker healthy status (${alert.adapter_key})`}
                      >
                        Healthy
                      </Badge>
                    )}
                  </div>
                </div>

                <p
                  className="mt-1 text-muted-foreground"
                  data-build-key={`governanceActivationFeedAlertLastIngested:${alert.adapter_id}`}
                  data-build-label={`Last ingested timestamp (${alert.adapter_key})`}
                >
                  Last ingested: {formatTimestamp(alert.last_ingested_at)}
                </p>
                {typeof customSweepMinutes === 'number' && customSweepMinutes > 0 ? (
                  <p
                    className="mt-1 text-muted-foreground"
                    data-build-key={`governanceActivationFeedAlertCustomCadence:${alert.adapter_id}`}
                    data-build-label={`Custom sweep cadence note (${alert.adapter_key})`}
                  >
                    This adapter requests a queued sweep about every {customSweepMinutes} minutes (overrides the default schedule above).
                  </p>
                ) : null}
                {alert.latest_run_message && (
                  <p
                    className="text-muted-foreground"
                    data-build-key={`governanceActivationFeedAlertLatestRunMessage:${alert.adapter_id}`}
                    data-build-label={`Latest worker run note (${alert.adapter_key})`}
                  >
                    Latest worker run: {alert.latest_run_message}
                    {alert.latest_run_at ? ` (${formatTimestamp(alert.latest_run_at)})` : ''}
                  </p>
                )}

                {canManageFeeds && !feedWorkerBackendUnavailable && alertCount > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={resolvingFeedAlertKey === resolveAllKey}
                      aria-busy={resolvingFeedAlertKey === resolveAllKey}
                      onClick={() => void resolveFeedAlert(alert.adapter_id, null)}
                      data-build-key={`governanceActivationFeedResolveAllAlerts__${alert.adapter_id}`}
                      data-build-label={`Resolve all feed worker alerts (${alert.adapter_key})`}
                    >
                      {resolvingFeedAlertKey === resolveAllKey ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Resolve all'}
                    </Button>
                    {alert.signature_failure_count > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={resolvingFeedAlertKey === `${alert.adapter_id}:signature_failure`}
                        aria-busy={resolvingFeedAlertKey === `${alert.adapter_id}:signature_failure`}
                        onClick={() => void resolveFeedAlert(alert.adapter_id, 'signature_failure')}
                        data-build-key={`governanceActivationFeedResolveSignatureAlerts__${alert.adapter_id}`}
                        data-build-label={`Resolve signature feed worker alerts (${alert.adapter_key})`}
                      >
                        {resolvingFeedAlertKey === `${alert.adapter_id}:signature_failure`
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : 'Resolve signature'}
                      </Button>
                    )}
                    {alert.connectivity_failure_count > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={resolvingFeedAlertKey === `${alert.adapter_id}:connectivity`}
                        aria-busy={resolvingFeedAlertKey === `${alert.adapter_id}:connectivity`}
                        onClick={() => void resolveFeedAlert(alert.adapter_id, 'connectivity')}
                        data-build-key={`governanceActivationFeedResolveConnectivityAlerts__${alert.adapter_id}`}
                        data-build-label={`Resolve connectivity feed worker alerts (${alert.adapter_key})`}
                      >
                        {resolvingFeedAlertKey === `${alert.adapter_id}:connectivity`
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : 'Resolve connectivity'}
                      </Button>
                    )}
                    {alert.payload_failure_count > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={resolvingFeedAlertKey === `${alert.adapter_id}:payload`}
                        aria-busy={resolvingFeedAlertKey === `${alert.adapter_id}:payload`}
                        onClick={() => void resolveFeedAlert(alert.adapter_id, 'payload')}
                        data-build-key={`governanceActivationFeedResolvePayloadAlerts__${alert.adapter_id}`}
                        data-build-label={`Resolve payload feed worker alerts (${alert.adapter_key})`}
                      >
                        {resolvingFeedAlertKey === `${alert.adapter_id}:payload`
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : 'Resolve payload'}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {feedWorkerAlertsHasMore ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full gap-2"
              onClick={() => setVisibleFeedWorkerAlertsCount((count) => count + FEED_WORKER_ALERTS_APPEND_PAGE)}
              data-build-key="governanceActivationFeedLoadOlderWorkerAlerts"
              data-build-label="Load older feed worker alerts"
            >
              Load older worker alerts
            </Button>
          ) : null}
        </div>
      )}

      {feedIngestions.length > 0 && (
        <div
          className="mt-3 space-y-2 rounded-lg border border-border/60 bg-background/50 p-2.5"
          data-build-key="governanceActivationFeedRecentIngestions"
          data-build-label="Recent signed demographic feed ingestions"
        >
          <p
            className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
            data-build-key="governanceActivationFeedRecentIngestionsSectionTitle"
            data-build-label="Recent signed ingestions section heading"
          >
            Recent signed ingestions
            <span
              className="ml-2 font-normal normal-case tracking-normal text-muted-foreground"
              data-build-key="governanceActivationFeedRecentIngestionsPaginationStatus"
              data-build-label="Recent signed ingestions pagination status"
            >
              ({feedIngestions.length} loaded{feedIngestionsHasMore ? ', more available' : ''})
            </span>
          </p>
          <div className="max-h-56 space-y-1 overflow-y-auto text-xs text-muted-foreground">
            {feedIngestions.map((ingestion) => {
              const adapterLabel = feedAdapterNameById.get(ingestion.adapter_id) ?? 'Adapter';
              const scopeLabel = ingestion.scope_type === 'world' ? 'World' : ingestion.country_code;
              const ingestionStatusLabel = ingestion.ingestion_status;
              return (
                <p
                  key={ingestion.id}
                  data-build-key={`governanceActivationFeedIngestionRow:${ingestion.id}`}
                  data-build-label={`${adapterLabel} ingestion · ${scopeLabel} · ${ingestionStatusLabel}`}
                >
                  {adapterLabel} • {scopeLabel} • population {ingestion.target_population} • {ingestion.ingestion_status}
                  {' • '}
                  observed {formatTimestamp(ingestion.observed_at)} • recorded {formatTimestamp(ingestion.created_at)}
                </p>
              );
            })}
          </div>
          {feedIngestionsHasMore ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full gap-2"
              disabled={loadingMoreFeedIngestions || feedBackendUnavailable}
              aria-busy={loadingMoreFeedIngestions}
              onClick={() => void loadMoreFeedIngestions()}
              data-build-key="governanceActivationFeedLoadOlderIngestions"
              data-build-label="Load older signed feed ingestions"
            >
              {loadingMoreFeedIngestions ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Load older ingestions
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
