import type { Database } from '@/integrations/supabase/types';

export interface ActivationDemographicWorkerPayload {
  targetPopulation: number;
  observedAt: string;
  sourceUrl: string | null;
  signedPayload: string;
  payloadSignature: string;
  ingestionNotes: string | null;
}

function readStringValue(candidate: unknown) {
  if (typeof candidate !== 'string') return null;
  const normalized = candidate.trim();
  return normalized.length > 0 ? normalized : null;
}

function readOptionalStringField(payload: Record<string, unknown>, camelKey: string, snakeKey: string) {
  return readStringValue(payload[camelKey] ?? payload[snakeKey]);
}

function readRequiredStringField(payload: Record<string, unknown>, camelKey: string, snakeKey: string, label: string) {
  const value = readOptionalStringField(payload, camelKey, snakeKey);
  if (!value) {
    throw new Error(`${label} is required.`);
  }
  return value;
}

function readPositiveIntegerField(payload: Record<string, unknown>, camelKey: string, snakeKey: string, label: string) {
  const candidate = payload[camelKey] ?? payload[snakeKey];
  const parsed = typeof candidate === 'number'
    ? candidate
    : Number.parseInt(String(candidate ?? ''), 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }

  return Math.round(parsed);
}

export function parseActivationDemographicWorkerPayload(rawPayload: unknown): ActivationDemographicWorkerPayload {
  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
    throw new Error('Worker endpoint payload must be a JSON object.');
  }

  const payload = rawPayload as Record<string, unknown>;
  const targetPopulation = readPositiveIntegerField(payload, 'targetPopulation', 'target_population', 'Target population');
  const signedPayload = readRequiredStringField(payload, 'signedPayload', 'signed_payload', 'Signed payload');
  const payloadSignature = readRequiredStringField(payload, 'payloadSignature', 'payload_signature', 'Payload signature');
  const sourceUrl = readOptionalStringField(payload, 'sourceUrl', 'source_url');
  const ingestionNotes = readOptionalStringField(payload, 'ingestionNotes', 'ingestion_notes');
  const observedAtCandidate = readOptionalStringField(payload, 'observedAt', 'observed_at');

  let observedAt = new Date().toISOString();
  if (observedAtCandidate) {
    const parsedObservedAt = new Date(observedAtCandidate);
    if (Number.isNaN(parsedObservedAt.valueOf())) {
      throw new Error('Observed at must be a valid datetime.');
    }
    observedAt = parsedObservedAt.toISOString();
  }

  return {
    targetPopulation,
    observedAt,
    sourceUrl,
    signedPayload,
    payloadSignature,
    ingestionNotes,
  };
}

export function isActivationDemographicFeedStale(lastIngestedAt: string | null, freshnessHours: number) {
  if (!lastIngestedAt) return true;
  const parsed = new Date(lastIngestedAt);
  if (Number.isNaN(parsed.valueOf())) return true;

  const freshnessWindowHours = Math.max(1, Math.round(freshnessHours));
  return (Date.now() - parsed.getTime()) > freshnessWindowHours * 60 * 60 * 1000;
}

export function formatActivationDemographicFeedScopeLabel(
  scopeType: Database['public']['Enums']['activation_scope_type'],
  countryCode: string,
) {
  if (scopeType === 'world') return 'World';
  return countryCode?.trim() || 'Country';
}

/** Human label for sweep outbox rows in completed / cancelled / failed terminal states. */
export function formatActivationDemographicFeedOutboxClosedStatusLabel(status: string) {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'failed':
      return 'Failed';
    default:
      return status.replace(/_/g, ' ');
  }
}

export function formatActivationDemographicFeedWorkerRunOutcomeLabel(status: string) {
  switch (status) {
    case 'ingested':
      return 'Ingested';
    case 'signature_failed':
      return 'Signature check failed';
    case 'fetch_failed':
      return 'Fetch failed';
    case 'invalid_payload':
      return 'Invalid payload';
    case 'ingestion_failed':
      return 'Ingestion failed';
    default:
      return status.replace(/_/g, ' ');
  }
}

export function formatActivationDemographicFeedWorkerAlertKindLabel(alertType: string) {
  switch (alertType) {
    case 'freshness':
      return 'Freshness';
    case 'signature_failure':
      return 'Signature';
    case 'connectivity':
      return 'Connectivity';
    case 'payload':
      return 'Payload';
    default:
      return alertType.replace(/_/g, ' ');
  }
}

/** Shortens long steward-facing notes for dense panels (worker runs, outbox errors). */
export function formatTruncatedGovernanceNote(message: string, maxChars = 160) {
  const trimmed = message.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxChars)}…`;
}
