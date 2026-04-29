import type { Database } from '@/integrations/supabase/types';

export type ActivationFeedWorkerEscalationPolicySummaryRow =
  Database['public']['Functions']['activation_demographic_feed_worker_escalation_policy_summary']['Returns'][number];

export type ActivationFeedWorkerEscalationPolicyEventRow =
  Database['public']['Functions']['act_feed_worker_esc_pol_evt_hist']['Returns'][number];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = '') {
  if (typeof value !== 'string') return fallback;
  return value;
}

function asNullableString(value: unknown) {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

function asBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const n = value.trim().toLowerCase();
    if (n === 'true' || n === 't' || n === '1' || n === 'yes') return true;
    if (n === 'false' || n === 'f' || n === '0' || n === 'no') return false;
  }
  return fallback;
}

function asNonNegativeInt(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  if (typeof value === 'string' && value.trim()) {
    const p = Number.parseInt(value, 10);
    if (Number.isFinite(p)) return Math.max(0, p);
  }
  return fallback;
}

function asRecordOrNull(value: unknown): Record<string, unknown> | null {
  const r = asRecord(value);
  return r;
}

export function readActivationFeedWorkerEscalationPolicySummary(rows: unknown): ActivationFeedWorkerEscalationPolicySummaryRow | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row = asRecord(rows[0]);
  if (!row) return null;
  return {
    policy_key: asString(row.policy_key, 'default'),
    policy_name: asString(row.policy_name),
    escalation_enabled: asBoolean(row.escalation_enabled, true),
    freshness_hours: asNonNegativeInt(row.freshness_hours, 24) || 24,
    minimum_adapter_issues_for_escalation: asNonNegativeInt(row.minimum_adapter_issues_for_escalation, 1) || 1,
    escalation_severity: asString(row.escalation_severity, 'critical'),
    policy_schema_version: asNonNegativeInt(row.policy_schema_version, 1) || 1,
    metadata: asRecordOrNull(row.metadata) ?? {},
    updated_at: asNullableString(row.updated_at),
    updated_by: asNullableString(row.updated_by),
    updated_by_name: asNullableString(row.updated_by_name),
  };
}

export function readActivationFeedWorkerEscalationPolicyEventRows(rows: unknown): ActivationFeedWorkerEscalationPolicyEventRow[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((e) => asRecord(e))
    .filter((e): e is Record<string, unknown> => Boolean(e))
    .map((e) => ({
      event_id: asString(e.event_id),
      policy_key: asString(e.policy_key),
      event_type: asString(e.event_type),
      actor_profile_id: asNullableString(e.actor_profile_id),
      actor_name: asNullableString(e.actor_name),
      event_message: asString(e.event_message),
      metadata: asRecordOrNull(e.metadata) ?? {},
      created_at: asNullableString(e.created_at),
    }))
    .filter((e) => e.event_id.length > 0);
}
