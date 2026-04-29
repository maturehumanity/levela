import { describe, expect, it } from 'vitest';

import {
  ACTIVATION_FEED_DATA_AUTO_RELOAD_MIN_MS,
  isFeedDataAutoReloadThrottled,
  isMissingActivationDemographicFeedBackend,
  isMissingActivationDemographicFeedScheduleRunHistoryRpc,
  isMissingActivationDemographicFeedSchedulerStatusRpc,
  isMissingActivationDemographicFeedWorkerBackend,
  isMissingActivationDemographicFeedWorkerEscalationAcknowledgePageRpc,
  isMissingActivationDemographicFeedWorkerEscalationPageBoardRpc,
  isMissingActivationDemographicFeedWorkerEscalationPageHistoryRpc,
  isMissingActivationDemographicFeedWorkerEscalationResolvePageRpc,
} from '@/lib/governance-activation-demographic-feeds';

describe('isFeedDataAutoReloadThrottled', () => {
  it('is false when the interval has fully elapsed', () => {
    expect(
      isFeedDataAutoReloadThrottled(
        120_000,
        59_000,
        ACTIVATION_FEED_DATA_AUTO_RELOAD_MIN_MS,
      ),
    ).toBe(false);
  });

  it('is true when still inside the window', () => {
    expect(
      isFeedDataAutoReloadThrottled(
        119_000,
        60_000,
        ACTIVATION_FEED_DATA_AUTO_RELOAD_MIN_MS,
      ),
    ).toBe(true);
  });

  it('is false when elapsed equals the minimum interval (exclusive upper bound)', () => {
    expect(
      isFeedDataAutoReloadThrottled(
        160_000,
        100_000,
        ACTIVATION_FEED_DATA_AUTO_RELOAD_MIN_MS,
      ),
    ).toBe(false);
  });
});

describe('isMissingActivationDemographicFeedBackend', () => {
  it('returns false when error is null', () => {
    expect(isMissingActivationDemographicFeedBackend(null)).toBe(false);
  });

  it('detects missing feed tables and core RPCs from PostgREST or Postgres codes', () => {
    expect(
      isMissingActivationDemographicFeedBackend({
        code: '42P01',
        message: 'relation "activation_demographic_feed_adapters" does not exist',
        details: null,
      }),
    ).toBe(true);

    expect(
      isMissingActivationDemographicFeedBackend({
        code: 'PGRST202',
        message: 'Could not find the function public.register_activation_demographic_feed_adapter',
        details: null,
      }),
    ).toBe(true);

    expect(
      isMissingActivationDemographicFeedBackend({
        code: 'PGRST202',
        message: 'Could not find the function public.ingest_signed_activation_demographic_feed_snapshot',
        details: null,
      }),
    ).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(
      isMissingActivationDemographicFeedBackend({
        code: '23505',
        message: 'duplicate key value violates unique constraint',
        details: null,
      }),
    ).toBe(false);
  });
});

describe('isMissingActivationDemographicFeedSchedulerStatusRpc', () => {
  it('returns false when error is null', () => {
    expect(isMissingActivationDemographicFeedSchedulerStatusRpc(null)).toBe(false);
  });

  it('returns false for PGRST202 when the message does not reference the scheduler status RPC', () => {
    expect(
      isMissingActivationDemographicFeedSchedulerStatusRpc({
        code: 'PGRST202',
        message: 'Could not find the function public.some_other_fn',
        details: null,
      }),
    ).toBe(false);
  });

  it('returns true for PGRST202 when the message references the scheduler status RPC', () => {
    expect(
      isMissingActivationDemographicFeedSchedulerStatusRpc({
        code: 'PGRST202',
        message: 'Could not find the function public.activation_demographic_feed_worker_schedule_automation_status',
        details: null,
      }),
    ).toBe(true);
  });
});

describe('isMissingActivationDemographicFeedWorkerBackend + scheduler RPC', () => {
  it('does not treat missing scheduler status RPC alone as missing the whole worker backend', () => {
    const error = {
      code: 'PGRST202',
      message: 'Could not find the function public.activation_demographic_feed_worker_schedule_automation_status',
      details: null,
    };
    expect(isMissingActivationDemographicFeedSchedulerStatusRpc(error)).toBe(true);
    expect(isMissingActivationDemographicFeedWorkerBackend(error)).toBe(false);
  });

  it('still treats other worker-backend PGRST202 failures as missing the worker backend', () => {
    const error = {
      code: 'PGRST202',
      message: 'Could not find the function public.claim_activation_demographic_feed_worker_jobs',
      details: null,
    };
    expect(isMissingActivationDemographicFeedSchedulerStatusRpc(error)).toBe(false);
    expect(isMissingActivationDemographicFeedWorkerBackend(error)).toBe(true);
  });

  it('treats missing worker permission RPC as missing the worker backend', () => {
    const error = {
      code: 'PGRST202',
      message: 'Could not find the function public.current_profile_can_manage_activation_demographic_feed_workers',
      details: null,
    };
    expect(isMissingActivationDemographicFeedSchedulerStatusRpc(error)).toBe(false);
    expect(isMissingActivationDemographicFeedWorkerBackend(error)).toBe(true);
  });

  it('does not treat missing schedule automation run history RPC alone as missing the whole worker backend', () => {
    const error = {
      code: 'PGRST202',
      message:
        'Could not find the function public.activation_feed_worker_schedule_automation_run_history',
      details: null,
    };
    expect(isMissingActivationDemographicFeedScheduleRunHistoryRpc(error)).toBe(true);
    expect(isMissingActivationDemographicFeedWorkerBackend(error)).toBe(false);
  });

  it('does not treat missing feed worker escalation page history RPC alone as missing the whole worker backend', () => {
    const error = {
      code: 'PGRST202',
      message:
        'Could not find the function public.activation_demographic_feed_worker_escalation_page_history',
      details: null,
    };
    expect(isMissingActivationDemographicFeedWorkerEscalationPageHistoryRpc(error)).toBe(true);
    expect(isMissingActivationDemographicFeedWorkerBackend(error)).toBe(false);
  });

  it('does not treat missing feed worker escalation page board RPC alone as missing the whole worker backend', () => {
    const error = {
      code: 'PGRST202',
      message:
        'Could not find the function public.activation_demographic_feed_worker_escalation_page_board',
      details: null,
    };
    expect(isMissingActivationDemographicFeedWorkerEscalationPageBoardRpc(error)).toBe(true);
    expect(isMissingActivationDemographicFeedWorkerBackend(error)).toBe(false);
  });

  it('does not treat missing feed worker escalation acknowledge RPC alone as missing the whole worker backend', () => {
    const error = {
      code: 'PGRST202',
      message:
        'Could not find the function public.acknowledge_activation_demographic_feed_worker_escalation_page',
      details: null,
    };
    expect(isMissingActivationDemographicFeedWorkerEscalationAcknowledgePageRpc(error)).toBe(true);
    expect(isMissingActivationDemographicFeedWorkerBackend(error)).toBe(false);
  });

  it('does not treat missing feed worker escalation resolve RPC alone as missing the whole worker backend', () => {
    const error = {
      code: 'PGRST202',
      message:
        'Could not find the function public.resolve_activation_demographic_feed_worker_escalation_page',
      details: null,
    };
    expect(isMissingActivationDemographicFeedWorkerEscalationResolvePageRpc(error)).toBe(true);
    expect(isMissingActivationDemographicFeedWorkerBackend(error)).toBe(false);
  });
});

describe('isMissingActivationDemographicFeedScheduleRunHistoryRpc', () => {
  it('returns false when error is null', () => {
    expect(isMissingActivationDemographicFeedScheduleRunHistoryRpc(null)).toBe(false);
  });

  it('returns true for PGRST202 when the message references the run history RPC', () => {
    expect(
      isMissingActivationDemographicFeedScheduleRunHistoryRpc({
        code: 'PGRST202',
        message:
          'Could not find the function public.activation_feed_worker_schedule_automation_run_history',
        details: null,
      }),
    ).toBe(true);
  });
});

describe('isMissingActivationDemographicFeedWorkerEscalationPageHistoryRpc', () => {
  it('returns false when error is null', () => {
    expect(isMissingActivationDemographicFeedWorkerEscalationPageHistoryRpc(null)).toBe(false);
  });

  it('returns true for PGRST202 when the message references the escalation page history RPC', () => {
    expect(
      isMissingActivationDemographicFeedWorkerEscalationPageHistoryRpc({
        code: 'PGRST202',
        message:
          'Could not find the function public.activation_demographic_feed_worker_escalation_page_history',
        details: null,
      }),
    ).toBe(true);
  });
});
