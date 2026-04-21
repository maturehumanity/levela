import type { Database, Json } from '@/integrations/supabase/types';

export type GovernanceDomainRow = Database['public']['Tables']['governance_domains']['Row'];
export type GovernanceDomainMaturitySnapshotRow = Database['public']['Tables']['governance_domain_maturity_snapshots']['Row'];
export type GovernanceDomainMaturityTransitionRow = Database['public']['Tables']['governance_domain_maturity_transitions']['Row'];

export type GovernanceDomainMaturityState = 'unknown' | 'building' | 'at_risk' | 'mature';

export interface GovernanceDomainThresholdResult {
  thresholdKey: string;
  thresholdName: string;
  requiredCount: number;
  observedCount: number;
  meetsThreshold: boolean;
  roleKeys: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asNonNegativeInteger(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const normalized = Math.floor(value);
  return normalized >= 0 ? normalized : null;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

export function parseGovernanceDomainThresholdResults(results: Json | null | undefined): GovernanceDomainThresholdResult[] {
  if (!Array.isArray(results)) return [];

  return results
    .map((entry) => {
      if (!isObject(entry)) return null;

      const thresholdKey = typeof entry.threshold_key === 'string' ? entry.threshold_key : null;
      const thresholdName = typeof entry.threshold_name === 'string' ? entry.threshold_name : null;
      const requiredCount = asNonNegativeInteger(entry.required_count);
      const observedCount = asNonNegativeInteger(entry.observed_count);
      const meetsThreshold = typeof entry.meets_threshold === 'boolean' ? entry.meets_threshold : null;

      if (!thresholdKey || !thresholdName || requiredCount === null || observedCount === null || meetsThreshold === null) {
        return null;
      }

      return {
        thresholdKey,
        thresholdName,
        requiredCount,
        observedCount,
        meetsThreshold,
        roleKeys: asStringArray(entry.role_keys),
      };
    })
    .filter((entry): entry is GovernanceDomainThresholdResult => Boolean(entry));
}

export function getGovernanceDomainMaturityProgress(snapshot: Pick<GovernanceDomainMaturitySnapshotRow, 'threshold_count' | 'thresholds_met_count'> | null | undefined) {
  if (!snapshot || snapshot.threshold_count <= 0) {
    return {
      thresholdCount: 0,
      thresholdsMetCount: 0,
      percentage: 0,
    };
  }

  const thresholdCount = Math.max(0, Math.floor(snapshot.threshold_count));
  const thresholdsMetCount = Math.max(0, Math.min(thresholdCount, Math.floor(snapshot.thresholds_met_count)));

  return {
    thresholdCount,
    thresholdsMetCount,
    percentage: Math.round((thresholdsMetCount / thresholdCount) * 100),
  };
}

export function getGovernanceDomainMaturityDeficits(snapshot: Pick<GovernanceDomainMaturitySnapshotRow, 'threshold_results'> | null | undefined) {
  return parseGovernanceDomainThresholdResults(snapshot?.threshold_results)
    .filter((result) => !result.meetsThreshold)
    .sort((left, right) => {
      const leftDeficit = left.requiredCount - left.observedCount;
      const rightDeficit = right.requiredCount - right.observedCount;
      return rightDeficit - leftDeficit;
    });
}

export function getGovernanceDomainMaturityState(args: {
  snapshot: Pick<GovernanceDomainMaturitySnapshotRow, 'is_mature'> | null | undefined;
  transition?: Pick<GovernanceDomainMaturityTransitionRow, 'transition_type'> | null;
}): GovernanceDomainMaturityState {
  if (!args.snapshot) return 'unknown';
  if (args.snapshot.is_mature) return 'mature';
  if (args.transition?.transition_type === 'regressed') return 'at_risk';
  return 'building';
}

export function getGovernanceDomainTransitionSummary(transitionType: GovernanceDomainMaturityTransitionRow['transition_type']) {
  switch (transitionType) {
    case 'matured':
      return 'Matured';
    case 'regressed':
      return 'Regressed';
    case 'unchanged':
      return 'No change';
    case 'initial':
      return 'Initial snapshot';
    default:
      return transitionType;
  }
}
