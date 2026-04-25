import { describe, expect, it } from 'vitest';

import {
  calculateActivationCoveragePercent,
  getActivationDecisionLabel,
  getActivationReviewStatusBadgeClassName,
  getActivationReviewStatusLabelKey,
  getActivationStatusLabel,
  isMissingActivationReviewBackend,
  normalizeProfileCountryCodeForActivation,
  pickActivationReviewsForCitizenHub,
  readLatestActivationIngestionTimestamp,
  toActivationScopeKey,
  type ActivationThresholdReviewRow,
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

    expect(
      isMissingActivationReviewBackend({
        code: 'PGRST205',
        message: 'JWT expired',
      }),
    ).toBe(true);

    expect(
      isMissingActivationReviewBackend({
        code: null,
        message: null,
        details: 'query failed on activation_evidence join',
      }),
    ).toBe(true);
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
    expect(readLatestActivationIngestionTimestamp(null)).toBe(null);
    expect(
      readLatestActivationIngestionTimestamp({
        last_demographic_ingested_at: '   ',
      }),
    ).toBe(null);
    expect(
      readLatestActivationIngestionTimestamp({
        last_demographic_ingested_at: 1_700_000_000,
      }),
    ).toBe(null);
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

    expect(
      calculateActivationCoveragePercent({
        eligible_verified_citizens_count: 0,
        target_population: 0,
      }),
    ).toBe(null);

    expect(
      calculateActivationCoveragePercent({
        eligible_verified_citizens_count: 1,
        target_population: 3,
      }),
    ).toBe(33.33);

    expect(
      calculateActivationCoveragePercent({
        eligible_verified_citizens_count: 10,
        target_population: -5,
      }),
    ).toBe(null);
  });

  it('maps activation labels', () => {
    expect(getActivationStatusLabel('pre_activation')).toBe('Pre-activation');
    expect(getActivationStatusLabel('pending_review')).toBe('Pending review');
    expect(getActivationStatusLabel('approved_for_activation')).toBe('Approved for activation');
    expect(getActivationStatusLabel('activated')).toBe('Activated');
    expect(getActivationStatusLabel('rejected')).toBe('Rejected');
    expect(getActivationStatusLabel('revoked')).toBe('Revoked');
    expect(getActivationStatusLabel('future_status' as Parameters<typeof getActivationStatusLabel>[0])).toBe(
      'future_status',
    );

    expect(getActivationDecisionLabel('approve')).toBe('Approve');
    expect(getActivationDecisionLabel('reject')).toBe('Reject');
    expect(getActivationDecisionLabel('request_changes')).toBe('Request changes');
    expect(getActivationDecisionLabel('declare_activation')).toBe('Declare activation');
    expect(getActivationDecisionLabel('revoke_activation')).toBe('Revoke activation');
    expect(
      getActivationDecisionLabel('future_decision' as Parameters<typeof getActivationDecisionLabel>[0]),
    ).toBe('future_decision');
  });

  it('normalizes profile country codes for activation matching', () => {
    expect(normalizeProfileCountryCodeForActivation('  de  ')).toBe('DE');
    expect(normalizeProfileCountryCodeForActivation('')).toBe(null);
    expect(normalizeProfileCountryCodeForActivation(null)).toBe(null);
  });

  it('picks world and matching country reviews preferring newest duplicates', () => {
    const base = {
      jurisdiction_label: 'Test',
      declaration_notes: null,
      declared_at: null,
      declared_by: null,
      opened_at: '2026-01-01T00:00:00.000Z',
      opened_by: null,
      reviewed_at: null,
      reviewed_by: null,
      review_notes: null,
      created_at: '2026-01-01T00:00:00.000Z',
      threshold_percent: 50,
      target_population: 1000,
      eligible_verified_citizens_count: 10,
      verified_citizens_count: 12,
      metadata: {},
    } satisfies Partial<ActivationThresholdReviewRow>;

    const reviews = [
      {
        ...base,
        id: 'w-old',
        scope_type: 'world',
        country_code: '',
        status: 'pre_activation',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      {
        ...base,
        id: 'w-new',
        scope_type: 'world',
        country_code: '',
        status: 'pending_review',
        updated_at: '2026-02-01T00:00:00.000Z',
      },
      {
        ...base,
        id: 'c-us',
        scope_type: 'country',
        country_code: 'US',
        status: 'activated',
        updated_at: '2026-01-15T00:00:00.000Z',
      },
      {
        ...base,
        id: 'c-de',
        scope_type: 'country',
        country_code: 'DE',
        status: 'pre_activation',
        updated_at: '2026-01-10T00:00:00.000Z',
      },
    ] as ActivationThresholdReviewRow[];

    const picked = pickActivationReviewsForCitizenHub(reviews, 'us');
    expect(picked.map((row) => row.id)).toEqual(['w-new', 'c-us']);
  });

  it('maps activation review statuses to governance hub label keys', () => {
    const statuses = [
      'pre_activation',
      'pending_review',
      'approved_for_activation',
      'activated',
      'rejected',
      'revoked',
    ] as const;

    for (const status of statuses) {
      expect(getActivationReviewStatusLabelKey(status)).toContain(status);
    }

    expect(getActivationReviewStatusLabelKey('__unknown__' as Parameters<typeof getActivationReviewStatusLabelKey>[0])).toBe(
      'governanceHub.activationReview.statuses.unknown',
    );
  });

  it('uses distinct badge styling buckets for activation statuses', () => {
    const activated = getActivationReviewStatusBadgeClassName('activated');
    const approvedFor = getActivationReviewStatusBadgeClassName('approved_for_activation');
    const pending = getActivationReviewStatusBadgeClassName('pending_review');
    const rejected = getActivationReviewStatusBadgeClassName('rejected');
    const pre = getActivationReviewStatusBadgeClassName('pre_activation');

    expect(activated).toContain('emerald');
    expect(approvedFor).toBe(activated);
    expect(pending).toContain('amber');
    expect(rejected).toContain('destructive');
    expect(pre).toContain('muted');
    expect(new Set([activated, pending, rejected, pre]).size).toBe(4);
  });
});
