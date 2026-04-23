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

export interface ActivationDemographicFeedWorkerAlertSummaryRow {
  adapter_id: string;
  adapter_key: string;
  adapter_name: string;
  scope_type: Database['public']['Enums']['activation_scope_type'];
  country_code: string;
  last_ingested_at: string | null;
  freshness_alert: boolean;
  stale_by_hours: number | null;
  signature_failure_count: number;
  connectivity_failure_count: number;
  payload_failure_count: number;
  latest_run_status: ActivationDemographicFeedWorkerRunStatus | null;
  latest_run_message: string | null;
  latest_run_at: string | null;
}

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
  'schedule_activation_demographic_feed_worker_jobs',
  'claim_activation_demographic_feed_worker_jobs',
  'complete_activation_demographic_feed_worker_outbox',
  'release_stale_activation_demographic_feed_worker_claims',
  'schedule_activation_demographic_feed_worker_jobs_impl',
  'run_activation_demographic_feed_worker_schedule_automation',
  'activation_demographic_feed_worker_schedule_automation_status',
] as const;

function includesMissingBackendToken(message: string, tokens: readonly string[]) {
  return tokens.some((token) => message.includes(token));
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
  const message = `${error.code || ''} ${error.message || ''} ${error.details || ''}`.toLowerCase();
  return (
    error.code === '42P01'
    || error.code === 'PGRST205'
    || error.code === 'PGRST202'
    || includesMissingBackendToken(message, activationDemographicFeedWorkerBackendTokens)
  );
}
