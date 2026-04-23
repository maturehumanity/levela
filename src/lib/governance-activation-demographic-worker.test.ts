import { describe, expect, it } from 'vitest';

import {
  formatActivationDemographicFeedOutboxClosedStatusLabel,
  formatActivationDemographicFeedScopeLabel,
  formatActivationDemographicFeedWorkerAlertKindLabel,
  formatActivationDemographicFeedWorkerRunOutcomeLabel,
  formatTruncatedGovernanceNote,
  isActivationDemographicFeedStale,
  parseActivationDemographicWorkerPayload,
} from '@/lib/governance-activation-demographic-worker';

describe('parseActivationDemographicWorkerPayload', () => {
  it('parses camelCase payload fields', () => {
    const parsed = parseActivationDemographicWorkerPayload({
      targetPopulation: 12345,
      observedAt: '2026-04-20T09:30:00.000Z',
      sourceUrl: 'https://example.com/feed/world',
      signedPayload: '{"scope":"world"}',
      payloadSignature: 'abc123',
      ingestionNotes: 'Daily world feed',
    });

    expect(parsed).toEqual({
      targetPopulation: 12345,
      observedAt: '2026-04-20T09:30:00.000Z',
      sourceUrl: 'https://example.com/feed/world',
      signedPayload: '{"scope":"world"}',
      payloadSignature: 'abc123',
      ingestionNotes: 'Daily world feed',
    });
  });

  it('parses snake_case payload fields', () => {
    const parsed = parseActivationDemographicWorkerPayload({
      target_population: '8800',
      signed_payload: '{"scope":"country","country":"US"}',
      payload_signature: 'sig-v1',
      source_url: 'https://example.com/feed/us',
    });

    expect(parsed.targetPopulation).toBe(8800);
    expect(parsed.signedPayload).toContain('country');
    expect(parsed.payloadSignature).toBe('sig-v1');
    expect(parsed.sourceUrl).toBe('https://example.com/feed/us');
  });

  it('throws when target population is invalid', () => {
    expect(() => parseActivationDemographicWorkerPayload({
      targetPopulation: 0,
      signedPayload: '{}',
      payloadSignature: 'sig',
    })).toThrowError('Target population must be a positive integer.');
  });

  it('throws when signature field is missing', () => {
    expect(() => parseActivationDemographicWorkerPayload({
      targetPopulation: 100,
      signedPayload: '{}',
    })).toThrowError('Payload signature is required.');
  });
});

describe('isActivationDemographicFeedStale', () => {
  it('flags missing ingestion timestamps as stale', () => {
    expect(isActivationDemographicFeedStale(null, 24)).toBe(true);
  });

  it('returns false for fresh timestamps', () => {
    const freshTimestamp = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    expect(isActivationDemographicFeedStale(freshTimestamp, 2)).toBe(false);
  });
});

describe('formatActivationDemographicFeedScopeLabel', () => {
  it('formats world and country labels', () => {
    expect(formatActivationDemographicFeedScopeLabel('world', '')).toBe('World');
    expect(formatActivationDemographicFeedScopeLabel('country', 'US')).toBe('US');
  });
});

describe('formatActivationDemographicFeedOutboxClosedStatusLabel', () => {
  it('maps known terminal outbox statuses', () => {
    expect(formatActivationDemographicFeedOutboxClosedStatusLabel('completed')).toBe('Completed');
    expect(formatActivationDemographicFeedOutboxClosedStatusLabel('cancelled')).toBe('Cancelled');
    expect(formatActivationDemographicFeedOutboxClosedStatusLabel('failed')).toBe('Failed');
  });

  it('falls back for unknown statuses', () => {
    expect(formatActivationDemographicFeedOutboxClosedStatusLabel('custom_status')).toBe('custom status');
  });
});

describe('formatActivationDemographicFeedWorkerRunOutcomeLabel', () => {
  it('maps known worker run outcomes', () => {
    expect(formatActivationDemographicFeedWorkerRunOutcomeLabel('ingested')).toBe('Ingested');
    expect(formatActivationDemographicFeedWorkerRunOutcomeLabel('signature_failed')).toBe('Signature check failed');
  });

  it('falls back for unknown outcomes', () => {
    expect(formatActivationDemographicFeedWorkerRunOutcomeLabel('custom_failed')).toBe('custom failed');
  });
});

describe('formatActivationDemographicFeedWorkerAlertKindLabel', () => {
  it('maps known alert kinds', () => {
    expect(formatActivationDemographicFeedWorkerAlertKindLabel('signature_failure')).toBe('Signature');
    expect(formatActivationDemographicFeedWorkerAlertKindLabel('freshness')).toBe('Freshness');
  });

  it('falls back for unknown kinds', () => {
    expect(formatActivationDemographicFeedWorkerAlertKindLabel('custom_alert')).toBe('custom alert');
  });
});

describe('formatTruncatedGovernanceNote', () => {
  it('returns short text unchanged', () => {
    expect(formatTruncatedGovernanceNote('hello', 10)).toBe('hello');
  });

  it('truncates long text', () => {
    expect(formatTruncatedGovernanceNote('0123456789abcdef', 10)).toBe('0123456789…');
  });
});
