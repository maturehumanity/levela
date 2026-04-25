import type { Database, Json } from '@/integrations/supabase/types';

export type ActivationThresholdReviewRow = Database['public']['Tables']['activation_threshold_reviews']['Row'];
export type ActivationThresholdReviewHubRow = Pick<
  ActivationThresholdReviewRow,
  | 'id'
  | 'scope_type'
  | 'country_code'
  | 'jurisdiction_label'
  | 'status'
  | 'threshold_percent'
  | 'target_population'
  | 'eligible_verified_citizens_count'
  | 'metadata'
  | 'updated_at'
>;
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

export function normalizeProfileCountryCodeForActivation(raw: string | null | undefined) {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.toUpperCase();
}

/**
 * Picks the world review plus the member's country review (when profile country code matches),
 * preferring the newest row per scope when duplicates exist.
 */
export function pickActivationReviewsForCitizenHub(
  reviews: ActivationThresholdReviewHubRow[],
  memberCountryCode: string | null,
): ActivationThresholdReviewHubRow[] {
  const normalizedMember = normalizeProfileCountryCodeForActivation(memberCountryCode);
  const sorted = [...reviews].sort((left, right) => (left.updated_at < right.updated_at ? 1 : -1));
  const world = sorted.find((row) => row.scope_type === 'world') ?? null;
  const country = normalizedMember
    ? sorted.find(
        (row) => row.scope_type === 'country' && row.country_code.trim().toUpperCase() === normalizedMember,
      ) ?? null
    : null;

  const picked: ActivationThresholdReviewHubRow[] = [];
  if (world) picked.push(world);
  if (country) picked.push(country);
  return picked;
}

export function getActivationReviewStatusLabelKey(status: ActivationReviewStatus) {
  switch (status) {
    case 'pre_activation':
      return 'governanceHub.activationReview.statuses.pre_activation';
    case 'pending_review':
      return 'governanceHub.activationReview.statuses.pending_review';
    case 'approved_for_activation':
      return 'governanceHub.activationReview.statuses.approved_for_activation';
    case 'activated':
      return 'governanceHub.activationReview.statuses.activated';
    case 'rejected':
      return 'governanceHub.activationReview.statuses.rejected';
    case 'revoked':
      return 'governanceHub.activationReview.statuses.revoked';
    default:
      return 'governanceHub.activationReview.statuses.unknown';
  }
}

export function getActivationReviewStatusBadgeClassName(status: ActivationReviewStatus) {
  switch (status) {
    case 'activated':
    case 'approved_for_activation':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200';
    case 'pending_review':
      return 'border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-200';
    case 'pre_activation':
      return 'border-border bg-muted text-muted-foreground';
    case 'rejected':
    case 'revoked':
      return 'border-destructive/20 bg-destructive/10 text-destructive';
    default:
      return 'border-border bg-muted text-muted-foreground';
  }
}
