import { describe, expect, it } from 'vitest';

import {
  isMissingActivationDemographicFeedSchedulerStatusRpc,
  isMissingActivationDemographicFeedWorkerBackend,
} from '@/lib/governance-activation-demographic-feeds';

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
});
