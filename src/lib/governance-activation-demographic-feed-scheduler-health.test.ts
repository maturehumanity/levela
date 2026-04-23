import { describe, expect, it } from 'vitest';

import {
  activationFeedSchedulerHealthExplainTitlesFromCadence,
  activationFeedSchedulerStaleThresholdsFromCadence,
  computeActivationFeedSchedulerCronRunHealthBadge,
  computeActivationFeedSchedulerEnqueueHealthBadge,
  formatApproxStaleDurationMs,
} from '@/lib/governance-activation-demographic-feed-scheduler-health';

describe('activationFeedSchedulerStaleThresholdsFromCadence', () => {
  it('uses 2x cadence for enqueue stale (capped at 24h)', () => {
    const { enqueueStaleMs, cadenceMinutes } = activationFeedSchedulerStaleThresholdsFromCadence(360);
    expect(cadenceMinutes).toBe(360);
    expect(enqueueStaleMs).toBe(12 * 60 * 60 * 1000);
  });

  it('floors cadence at 5 minutes', () => {
    const { cadenceMinutes } = activationFeedSchedulerStaleThresholdsFromCadence(1);
    expect(cadenceMinutes).toBe(5);
  });

  it('derives cron run stale from cadence (capped at 6h, floored at 90m)', () => {
    const { cronRunStaleMs } = activationFeedSchedulerStaleThresholdsFromCadence(360);
    expect(cronRunStaleMs).toBe(6 * 60 * 60 * 1000);
    const { cronRunStaleMs: short } = activationFeedSchedulerStaleThresholdsFromCadence(60);
    expect(short).toBe(90 * 60 * 1000);
  });
});

describe('computeActivationFeedSchedulerCronRunHealthBadge', () => {
  const base = {
    cron_job_registered: true,
    cron_job_active: true,
    latest_cron_run_started_at: '2026-01-01T00:00:00.000Z',
    latest_cron_run_status: 'succeeded',
    latest_scheduled_enqueue_at: null,
  };

  it('returns paused when cron job is registered but inactive', () => {
    const badge = computeActivationFeedSchedulerCronRunHealthBadge({
      status: { ...base, cron_job_active: false },
      nowMs: Date.parse('2026-01-01T01:00:00.000Z'),
      staleAfterMs: 60 * 60 * 1000,
    });
    expect(badge?.label).toBe('Cron job paused');
  });

  it('flags stale runs after threshold', () => {
    const badge = computeActivationFeedSchedulerCronRunHealthBadge({
      status: base,
      nowMs: Date.parse('2026-01-01T03:00:00.000Z'),
      staleAfterMs: 60 * 60 * 1000,
    });
    expect(badge?.label).toBe('Latest cron run is stale');
  });

  it('flags failed status', () => {
    const badge = computeActivationFeedSchedulerCronRunHealthBadge({
      status: { ...base, latest_cron_run_status: 'failed' },
      nowMs: Date.parse('2026-01-01T00:05:00.000Z'),
      staleAfterMs: 60 * 60 * 1000,
    });
    expect(badge?.label).toBe('Latest cron run failed');
  });
});

describe('formatApproxStaleDurationMs', () => {
  it('formats multi-hour windows in hours', () => {
    expect(formatApproxStaleDurationMs(6 * 60 * 60 * 1000)).toBe('6 hours');
    expect(formatApproxStaleDurationMs(12 * 60 * 60 * 1000)).toBe('12 hours');
  });

  it('formats sub-two-hour windows in minutes', () => {
    expect(formatApproxStaleDurationMs(90 * 60 * 1000)).toBe('90 minutes');
  });

  it('uses singular minute for a one-minute window', () => {
    expect(formatApproxStaleDurationMs(60 * 1000)).toBe('1 minute');
  });
});

describe('activationFeedSchedulerHealthExplainTitlesFromCadence', () => {
  it('mentions cadence and rounded stale windows for default-like cadence', () => {
    const titles = activationFeedSchedulerHealthExplainTitlesFromCadence(360);
    expect(titles.cronRunTitle).toContain('360-minute');
    expect(titles.cronRunTitle).toContain('6 hours');
    expect(titles.enqueueTitle).toContain('12 hours');
    expect(titles.cronRunTitle).toContain('restored from cache');
    expect(titles.enqueueTitle).toContain('restored from cache');
  });
});

describe('computeActivationFeedSchedulerEnqueueHealthBadge', () => {
  it('flags stale enqueue after threshold', () => {
    const badge = computeActivationFeedSchedulerEnqueueHealthBadge({
      latestScheduledEnqueueAt: '2026-01-01T00:00:00.000Z',
      nowMs: Date.parse('2026-01-01T05:00:00.000Z'),
      staleAfterMs: 60 * 60 * 1000,
    });
    expect(badge?.label).toBe('Schedule enqueue is stale');
  });

  it('returns fresh when within threshold', () => {
    const badge = computeActivationFeedSchedulerEnqueueHealthBadge({
      latestScheduledEnqueueAt: '2026-01-01T00:00:00.000Z',
      nowMs: Date.parse('2026-01-01T00:30:00.000Z'),
      staleAfterMs: 60 * 60 * 1000,
    });
    expect(badge?.label).toBe('Schedule enqueue is fresh');
  });
});
