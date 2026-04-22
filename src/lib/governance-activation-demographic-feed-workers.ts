import { supabase } from '@/integrations/supabase/client';
import {
  formatActivationDemographicFeedScopeLabel,
  isActivationDemographicFeedStale,
  parseActivationDemographicWorkerPayload,
} from '@/lib/governance-activation-demographic-worker';
import {
  hashActivationDemographicPayload,
  verifyActivationDemographicPayloadSignature,
} from '@/lib/governance-activation-demographic-signing';
import type {
  ActivationDemographicFeedAdapterRow,
  ActivationDemographicFeedAlertType,
  ActivationDemographicFeedWorkerAlertSummaryRow,
  ActivationDemographicFeedWorkerRunStatus,
} from '@/lib/governance-activation-demographic-feeds';

export const FEED_WORKER_DEFAULT_FRESHNESS_HOURS = 24;
const FEED_WORKER_FETCH_TIMEOUT_MS = 15_000;

export type RecordFeedWorkerRunDraft = {
  adapterId: string;
  status: ActivationDemographicFeedWorkerRunStatus;
  alertType: ActivationDemographicFeedAlertType;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  payloadHash?: string | null;
  metadata?: Record<string, unknown>;
  observedAt?: string;
  resolvedAt?: string;
};

export type FeedWorkerSweepStats = {
  ingested: number;
  signatureFailures: number;
  fetchFailures: number;
  invalidPayloads: number;
  ingestionFailures: number;
};

function readErrorMessage(error: unknown) {
  if (!error) return 'Unknown error';
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === 'object') {
    const candidate = error as { message?: unknown; details?: unknown };
    if (typeof candidate.message === 'string' && candidate.message.trim()) return candidate.message;
    if (typeof candidate.details === 'string' && candidate.details.trim()) return candidate.details;
  }
  return String(error);
}

async function fetchFeedWorkerPayload(endpointUrl: string) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), FEED_WORKER_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(endpointUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Endpoint responded with status ${response.status}.`);
    }

    return await response.json();
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function buildFallbackWorkerAlertRows(adapters: ActivationDemographicFeedAdapterRow[]): ActivationDemographicFeedWorkerAlertSummaryRow[] {
  return adapters
    .filter((adapter) => adapter.is_active)
    .map((adapter) => ({
      adapter_id: adapter.id,
      adapter_key: adapter.adapter_key,
      adapter_name: adapter.adapter_name,
      scope_type: adapter.scope_type,
      country_code: adapter.country_code,
      last_ingested_at: adapter.last_ingested_at,
      freshness_alert: isActivationDemographicFeedStale(adapter.last_ingested_at, FEED_WORKER_DEFAULT_FRESHNESS_HOURS),
      stale_by_hours: null,
      signature_failure_count: 0,
      connectivity_failure_count: 0,
      payload_failure_count: 0,
      latest_run_status: null,
      latest_run_message: null,
      latest_run_at: null,
    }));
}

export async function runActivationDemographicFeedWorkerSweep(args: {
  adapters: ActivationDemographicFeedAdapterRow[];
  recordFeedWorkerRun: (draft: RecordFeedWorkerRunDraft) => Promise<void>;
}) {
  const stats: FeedWorkerSweepStats = {
    ingested: 0,
    signatureFailures: 0,
    fetchFailures: 0,
    invalidPayloads: 0,
    ingestionFailures: 0,
  };

  for (const adapter of args.adapters) {
    const endpointUrl = adapter.endpoint_url?.trim() ?? '';
    const observedAt = new Date().toISOString();

    try {
      const rawPayload = await fetchFeedWorkerPayload(endpointUrl);
      const payload = parseActivationDemographicWorkerPayload(rawPayload);

      const signatureVerified = await verifyActivationDemographicPayloadSignature({
        keyAlgorithm: adapter.key_algorithm,
        signerPublicKey: adapter.public_signer_key,
        signedPayload: payload.signedPayload,
        signature: payload.payloadSignature,
      });

      if (!signatureVerified) {
        stats.signatureFailures += 1;
        await args.recordFeedWorkerRun({
          adapterId: adapter.id,
          status: 'signature_failed',
          alertType: 'signature_failure',
          severity: 'critical',
          message: `Signature verification failed for ${formatActivationDemographicFeedScopeLabel(adapter.scope_type, adapter.country_code)} adapter ${adapter.adapter_name}.`,
          metadata: {
            endpoint_url: endpointUrl,
            source: 'activation_feed_worker_sweep',
          },
          observedAt,
        });
        continue;
      }

      const payloadHash = await hashActivationDemographicPayload(payload.signedPayload);

      const { error } = await supabase.rpc('ingest_signed_activation_demographic_feed_snapshot', {
        target_adapter_id: adapter.id,
        requested_target_population: payload.targetPopulation,
        requested_source_url: payload.sourceUrl,
        requested_observed_at: payload.observedAt,
        signed_payload: payload.signedPayload,
        payload_hash: payloadHash,
        payload_signature: payload.payloadSignature,
        signature_verified: true,
        ingestion_notes: payload.ingestionNotes,
        ingestion_metadata: {
          source: 'activation_feed_worker_sweep',
          endpoint_url: endpointUrl,
        },
      });

      if (error) {
        stats.ingestionFailures += 1;
        await args.recordFeedWorkerRun({
          adapterId: adapter.id,
          status: 'ingestion_failed',
          alertType: 'payload',
          severity: 'critical',
          message: `Ingestion failed for adapter ${adapter.adapter_name}: ${readErrorMessage(error)}`,
          payloadHash,
          metadata: {
            endpoint_url: endpointUrl,
            source: 'activation_feed_worker_sweep',
          },
          observedAt,
        });
        continue;
      }

      stats.ingested += 1;
      await args.recordFeedWorkerRun({
        adapterId: adapter.id,
        status: 'ingested',
        alertType: 'freshness',
        severity: 'info',
        message: `Feed worker ingested signed snapshot for ${adapter.adapter_name}.`,
        payloadHash,
        metadata: {
          endpoint_url: endpointUrl,
          source: 'activation_feed_worker_sweep',
        },
        observedAt,
        resolvedAt: observedAt,
      });
    } catch (error) {
      const message = readErrorMessage(error);
      const lowerMessage = message.toLowerCase();
      const isPayloadError = lowerMessage.includes('payload') || lowerMessage.includes('target population');

      if (isPayloadError) {
        stats.invalidPayloads += 1;
      } else {
        stats.fetchFailures += 1;
      }

      await args.recordFeedWorkerRun({
        adapterId: adapter.id,
        status: isPayloadError ? 'invalid_payload' : 'fetch_failed',
        alertType: isPayloadError ? 'payload' : 'connectivity',
        severity: 'warning',
        message: `${adapter.adapter_name} worker ${isPayloadError ? 'payload error' : 'fetch error'}: ${message}`,
        metadata: {
          endpoint_url: endpointUrl,
          source: 'activation_feed_worker_sweep',
        },
        observedAt,
      });
    }
  }

  const { error: escalationError } = await supabase.rpc('maybe_escalate_activation_feed_worker_exec_page', {
    requested_freshness_hours: FEED_WORKER_DEFAULT_FRESHNESS_HOURS,
  });
  if (escalationError) {
    console.error('Activation demographic feed worker escalation check failed:', escalationError);
  }

  return stats;
}
