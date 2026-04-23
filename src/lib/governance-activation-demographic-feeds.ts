import type { Database } from '@/integrations/supabase/types';

export type ActivationDemographicFeedAdapterRow = Database['public']['Tables']['activation_demographic_feed_adapters']['Row'];
export type ActivationDemographicFeedIngestionRow = Database['public']['Tables']['activation_demographic_feed_ingestions']['Row'];
export type ActivationDemographicFeedWorkerOutboxRow = Database['public']['Tables']['activation_demographic_feed_worker_outbox']['Row'];
export type ActivationDemographicFeedWorkerRunRow = Database['public']['Tables']['activation_demographic_feed_worker_runs']['Row'];

export type ActivationDemographicFeedWorkerRunStatus =
  | 'ingested'
  | 'signature_failed'
  | 'fetch_failed'
  | 'invalid_payload'
  | 'ingestion_failed';

export type ActivationDemographicFeedAlertType =
  | 'freshness'
  | 'signature_failure'
  | 'connectivity'
  | 'payload';

export type ActivationDemographicFeedWorkerAlertSummaryRow =
  Database['public']['Functions']['activation_demographic_feed_worker_alert_summary']['Returns'][number];

const activationDemographicFeedBackendTokens = [
  'activation_demographic_feed_adapters',
  'activation_demographic_feed_ingestions',
  'register_activation_demographic_feed_adapter',
  'ingest_signed_activation_demographic_feed_snapshot',
] as const;

const activationDemographicFeedWorkerBackendTokens = [
  'activation_demographic_feed_worker_runs',
  'record_activation_demographic_feed_worker_run',
  'resolve_activation_demographic_feed_worker_alerts',
  'activation_demographic_feed_worker_alert_summary',
  'maybe_escalate_activation_feed_worker_exec_page',
  'activation_demographic_feed_worker_outbox',
  'activation_demographic_feed_worker_schedule_policies',
  'current_profile_can_manage_activation_demographic_feed_workers',
  'schedule_activation_demographic_feed_worker_jobs',
  'claim_activation_demographic_feed_worker_jobs',
  'complete_activation_demographic_feed_worker_outbox',
  'release_stale_activation_demographic_feed_worker_claims',
  'schedule_activation_demographic_feed_worker_jobs_impl',
  'run_activation_demographic_feed_worker_schedule_automation',
] as const;

function includesMissingBackendToken(message: string, tokens: readonly string[]) {
  return tokens.some((token) => message.includes(token));
}

export const ACTIVATION_FEED_DATA_AUTO_RELOAD_MIN_MS = 60_000;

/** True when a tab/network/bfcache-driven steward reload should wait (last load start is still inside the window). */
export function isFeedDataAutoReloadThrottled(nowMs: number, lastLoadStartedAtMs: number, minIntervalMs: number) {
  return nowMs - lastLoadStartedAtMs < minIntervalMs;
}

/** PostgREST “function not found” for the optional scheduler status RPC alone (older DB migrations). */
export function isMissingActivationDemographicFeedSchedulerStatusRpc(
  error: { code?: string | null; message?: string | null; details?: string | null } | null,
) {
  if (!error) {
    return false;
  }
  const message = `${error.code || ''} ${error.message || ''} ${error.details || ''}`.toLowerCase();
  return (
    error.code === 'PGRST202'
    && message.includes('activation_demographic_feed_worker_schedule_automation_status')
  );
}

export function isMissingActivationDemographicFeedBackend(error: { code?: string | null; message?: string | null; details?: string | null } | null) {
  if (!error) return false;
  const message = `${error.code || ''} ${error.message || ''} ${error.details || ''}`.toLowerCase();
  return (
    error.code === '42P01'
    || error.code === 'PGRST205'
    || error.code === 'PGRST202'
    || includesMissingBackendToken(message, activationDemographicFeedBackendTokens)
  );
}

export function isMissingActivationDemographicFeedWorkerBackend(error: { code?: string | null; message?: string | null; details?: string | null } | null) {
  if (!error) return false;
  if (isMissingActivationDemographicFeedSchedulerStatusRpc(error)) {
    return false;
  }
  const message = `${error.code || ''} ${error.message || ''} ${error.details || ''}`.toLowerCase();
  return (
    error.code === '42P01'
    || error.code === 'PGRST205'
    || error.code === 'PGRST202'
    || includesMissingBackendToken(message, activationDemographicFeedWorkerBackendTokens)
  );
}
