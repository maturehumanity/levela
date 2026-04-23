export type ActivationFeedSchedulerHealthBadge = {
  label: string;
  className: string;
};

export type ActivationFeedSchedulerAutomationStatusLike = {
  cron_job_registered: boolean;
  cron_job_active: boolean;
  latest_cron_run_started_at: string | null;
  latest_cron_run_status: string | null;
  latest_scheduled_enqueue_at: string | null;
};

/** Derive stale windows from the configured per-adapter sweep cadence (minutes). */
export function activationFeedSchedulerStaleThresholdsFromCadence(defaultIntervalMinutes: number) {
  const cadenceMinutes = Math.max(5, Math.floor(defaultIntervalMinutes || 360));
  const enqueueStaleMs = Math.min(24 * 60 * 60 * 1000, 2 * cadenceMinutes * 60 * 1000);
  const cronRunStaleMs = Math.min(
    6 * 60 * 60 * 1000,
    Math.max(90 * 60 * 1000, Math.floor(1.5 * cadenceMinutes) * 60 * 1000),
  );
  return { enqueueStaleMs, cronRunStaleMs, cadenceMinutes };
}

export function computeActivationFeedSchedulerCronRunHealthBadge(args: {
  status: ActivationFeedSchedulerAutomationStatusLike;
  nowMs: number;
  staleAfterMs: number;
}): ActivationFeedSchedulerHealthBadge | null {
  const { status, nowMs, staleAfterMs } = args;
  if (status.cron_job_registered && !status.cron_job_active) {
    return {
      label: 'Cron job paused',
      className: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    };
  }

  if (!status.latest_cron_run_started_at) {
    return {
      label: 'No cron run recorded',
      className: 'border-border bg-muted text-muted-foreground',
    };
  }

  const normalizedStatus = (status.latest_cron_run_status || '').trim().toLowerCase();
  if (normalizedStatus === 'failed' || normalizedStatus === 'error') {
    return {
      label: 'Latest cron run failed',
      className: 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300',
    };
  }
  if (normalizedStatus === 'running') {
    return {
      label: 'Cron run in progress',
      className: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    };
  }

  const startedAtMs = Date.parse(status.latest_cron_run_started_at);
  if (Number.isFinite(startedAtMs)) {
    const elapsedMs = nowMs - startedAtMs;
    if (elapsedMs > staleAfterMs) {
      return {
        label: 'Latest cron run is stale',
        className: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
      };
    }
  }

  return {
    label: 'Latest cron run healthy',
    className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  };
}

export function computeActivationFeedSchedulerEnqueueHealthBadge(args: {
  latestScheduledEnqueueAt: string | null;
  nowMs: number;
  staleAfterMs: number;
}): ActivationFeedSchedulerHealthBadge | null {
  const { latestScheduledEnqueueAt, nowMs, staleAfterMs } = args;
  if (!latestScheduledEnqueueAt) {
    return {
      label: 'No schedule enqueue observed',
      className: 'border-border bg-muted text-muted-foreground',
    };
  }

  const enqueueAtMs = Date.parse(latestScheduledEnqueueAt);
  if (Number.isFinite(enqueueAtMs)) {
    const elapsedMs = nowMs - enqueueAtMs;
    if (elapsedMs > staleAfterMs) {
      return {
        label: 'Schedule enqueue is stale',
        className: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
      };
    }
  }

  return {
    label: 'Schedule enqueue is fresh',
    className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  };
}

/** Rounded duration for steward tooltips (stable wording for multi-hour windows). */
export function formatApproxStaleDurationMs(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return 'less than a minute';
  }
  if (totalMinutes >= 24 * 60) {
    const days = Math.round(totalMinutes / (24 * 60));
    return `${days} day${days === 1 ? '' : 's'}`;
  }
  if (totalMinutes >= 120) {
    const hours = Math.round(totalMinutes / 60);
    return `${hours} hours`;
  }
  if (totalMinutes === 60) {
    return '1 hour';
  }
  if (totalMinutes > 60) {
    return `${totalMinutes} minutes`;
  }
  if (totalMinutes === 1) {
    return '1 minute';
  }
  return `${totalMinutes} minutes`;
}

export function activationFeedSchedulerHealthExplainTitlesFromCadence(defaultIntervalMinutes: number): {
  cronRunTitle: string;
  enqueueTitle: string;
} {
  const { enqueueStaleMs, cronRunStaleMs, cadenceMinutes } =
    activationFeedSchedulerStaleThresholdsFromCadence(defaultIntervalMinutes);
  const cronWord = formatApproxStaleDurationMs(cronRunStaleMs);
  const encWord = formatApproxStaleDurationMs(enqueueStaleMs);
  const refreshHint =
    'The badge also updates about once per minute, when this tab becomes visible again, when the network comes back, or when the page is restored from cache.';
  return {
    cronRunTitle:
      `Health uses your configured ${cadenceMinutes}-minute sweep cadence (plus latest run status such as failed or running). Stale means the latest recorded cron run started more than about ${cronWord} ago. ${refreshHint}`,
    enqueueTitle:
      `Stale means no schedule enqueue timestamp has been seen for more than about ${encWord}, derived from your ${cadenceMinutes}-minute cadence. ${refreshHint}`,
  };
}
