import type { Database, Json } from '@/integrations/supabase/types';

export type ActivationThresholdReviewRow = Database['public']['Tables']['activation_threshold_reviews']['Row'];
export type ActivationEvidenceRow = Database['public']['Tables']['activation_evidence']['Row'];
export type ActivationDecisionRow = Database['public']['Tables']['activation_decisions']['Row'];
export type ActivationDemographicSnapshotRow = Database['public']['Tables']['activation_demographic_snapshots']['Row'];

export type ActivationScopeType = Database['public']['Enums']['activation_scope_type'];
export type ActivationReviewDecision = Database['public']['Enums']['activation_review_decision'];
export type ActivationReviewStatus = Database['public']['Enums']['activation_review_status'];

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isMissingActivationReviewBackend(error: { code?: string | null; message?: string | null; details?: string | null } | null) {
  if (!error) return false;
  const message = `${error.code || ''} ${error.message || ''} ${error.details || ''}`.toLowerCase();
  return (
    error.code === '42P01'
    || error.code === 'PGRST205'
    || error.code === 'PGRST202'
    || message.includes('activation_threshold_reviews')
    || message.includes('activation_evidence')
    || message.includes('activation_decisions')
    || message.includes('activation_demographic_snapshots')
    || message.includes('capture_activation_demographic_snapshot')
    || message.includes('capture_scheduled_activation_demographic_snapshots')
  );
}

export function toActivationScopeKey(scopeType: ActivationScopeType, countryCode: string) {
  return `${scopeType}:${scopeType === 'world' ? '' : countryCode.toUpperCase()}`;
}

export function readLatestActivationIngestionTimestamp(metadata: Json | null | undefined) {
  if (!isObject(metadata)) return null;

  const raw = metadata.last_demographic_ingested_at;
  return typeof raw === 'string' && raw.trim().length > 0 ? raw : null;
}

export function calculateActivationCoveragePercent(review: Pick<ActivationThresholdReviewRow, 'eligible_verified_citizens_count' | 'target_population'>) {
  const targetPopulation = review.target_population;
  if (!targetPopulation || targetPopulation <= 0) return null;

  return Number(((review.eligible_verified_citizens_count / targetPopulation) * 100).toFixed(2));
}

export function getActivationStatusLabel(status: ActivationReviewStatus) {
  switch (status) {
    case 'pre_activation':
      return 'Pre-activation';
    case 'pending_review':
      return 'Pending review';
    case 'approved_for_activation':
      return 'Approved for activation';
    case 'activated':
      return 'Activated';
    case 'rejected':
      return 'Rejected';
    case 'revoked':
      return 'Revoked';
    default:
      return status;
  }
}

export function getActivationDecisionLabel(decision: ActivationReviewDecision) {
  switch (decision) {
    case 'approve':
      return 'Approve';
    case 'reject':
      return 'Reject';
    case 'request_changes':
      return 'Request changes';
    case 'declare_activation':
      return 'Declare activation';
    case 'revoke_activation':
      return 'Revoke activation';
    default:
      return decision;
  }
}
