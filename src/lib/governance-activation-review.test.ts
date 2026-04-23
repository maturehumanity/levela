import { describe, expect, it } from 'vitest';

import {
  calculateActivationCoveragePercent,
  getActivationDecisionLabel,
  getActivationStatusLabel,
  isMissingActivationReviewBackend,
  readLatestActivationIngestionTimestamp,
  toActivationScopeKey,
} from '@/lib/governance-activation-review';

describe('governance activation review helpers', () => {
  it('detects missing activation backend errors', () => {
    expect(
      isMissingActivationReviewBackend({
        code: 'PGRST202',
        message: 'Function capture_activation_demographic_snapshot does not exist',
      }),
    ).toBe(true);

    expect(
      isMissingActivationReviewBackend({
        code: 'PGRST202',
        message: 'Could not find the function public.capture_scheduled_activation_demographic_snapshots',
        details: null,
      }),
    ).toBe(true);

    expect(
      isMissingActivationReviewBackend({
        code: '42P01',
        message: 'relation "activation_demographic_snapshots" does not exist',
        details: null,
      }),
    ).toBe(true);

    expect(
      isMissingActivationReviewBackend({
        code: '42P01',
        message: 'relation "activation_threshold_reviews" does not exist',
        details: null,
      }),
    ).toBe(true);

    expect(
      isMissingActivationReviewBackend({
        code: '42P01',
        message: 'relation "activation_evidence" does not exist',
        details: null,
      }),
    ).toBe(true);

    expect(
      isMissingActivationReviewBackend({
        code: '42P01',
        message: 'relation "activation_decisions" does not exist',
        details: null,
      }),
    ).toBe(true);

    expect(isMissingActivationReviewBackend(null)).toBe(false);

    expect(
      isMissingActivationReviewBackend({
        code: '22023',
        message: 'Some unrelated error',
      }),
    ).toBe(false);
  });

  it('builds normalized activation scope keys', () => {
    expect(toActivationScopeKey('world', 'us')).toBe('world:');
    expect(toActivationScopeKey('country', 'us')).toBe('country:US');
  });

  it('reads ingestion timestamps from metadata payloads', () => {
    expect(
      readLatestActivationIngestionTimestamp({
        last_demographic_ingested_at: '2026-04-20T09:30:00.000Z',
      }),
    ).toBe('2026-04-20T09:30:00.000Z');

    expect(readLatestActivationIngestionTimestamp({})).toBe(null);
    expect(readLatestActivationIngestionTimestamp([])).toBe(null);
  });

  it('calculates coverage percentages from review totals', () => {
    expect(
      calculateActivationCoveragePercent({
        eligible_verified_citizens_count: 510,
        target_population: 1000,
      }),
    ).toBe(51);

    expect(
      calculateActivationCoveragePercent({
        eligible_verified_citizens_count: 510,
        target_population: null,
      }),
    ).toBe(null);
  });

  it('maps activation labels', () => {
    expect(getActivationStatusLabel('approved_for_activation')).toBe('Approved for activation');
    expect(getActivationDecisionLabel('declare_activation')).toBe('Declare activation');
  });
});
