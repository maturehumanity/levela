import type { Database } from '@/integrations/supabase/types';

export type GovernanceSanctionRow = Database['public']['Tables']['governance_sanctions']['Row'];
export type GovernanceSanctionAppealRow = Database['public']['Tables']['governance_sanction_appeals']['Row'];
export type GovernanceBlockScope = Database['public']['Enums']['governance_block_scope'];
export type GovernanceSanctionAppealStatus = Database['public']['Enums']['governance_sanction_appeal_status'];
export type GovernanceSanctionScopeOption = 'all' | GovernanceBlockScope;

export const governanceSanctionScopeOptions: GovernanceSanctionScopeOption[] = [
  'all',
  'proposal_create',
  'vote',
  'verification_review',
  'execution',
];

function toTimestamp(value: string | null) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function isGovernanceSanctionCurrentlyActive(sanction: GovernanceSanctionRow, now = Date.now()) {
  if (!sanction.is_active) return false;
  const startsAt = toTimestamp(sanction.starts_at);
  const endsAt = toTimestamp(sanction.ends_at);

  if (startsAt !== null && startsAt > now) return false;
  if (endsAt !== null && endsAt <= now) return false;

  return true;
}

export function governanceSanctionBlocksScope(
  sanction: GovernanceSanctionRow,
  scope: GovernanceBlockScope,
  now = Date.now(),
) {
  if (!isGovernanceSanctionCurrentlyActive(sanction, now)) return false;
  if (sanction.blocks_governance_all) return true;

  if (scope === 'proposal_create') return sanction.blocks_proposal_creation;
  if (scope === 'vote') return sanction.blocks_voting;
  if (scope === 'verification_review') return sanction.blocks_verification_review;
  return sanction.blocks_execution;
}

export function getGovernanceSanctionScopeOptionFromRow(sanction: GovernanceSanctionRow): GovernanceSanctionScopeOption {
  if (sanction.blocks_governance_all) return 'all';
  if (sanction.blocks_proposal_creation) return 'proposal_create';
  if (sanction.blocks_voting) return 'vote';
  if (sanction.blocks_verification_review) return 'verification_review';
  if (sanction.blocks_execution) return 'execution';
  return 'all';
}

export function buildGovernanceSanctionScopeFlags(scope: GovernanceSanctionScopeOption) {
  return {
    blocks_governance_all: scope === 'all',
    blocks_proposal_creation: scope === 'proposal_create',
    blocks_voting: scope === 'vote',
    blocks_verification_review: scope === 'verification_review',
    blocks_execution: scope === 'execution',
  };
}

export function isAppealOpen(status: GovernanceSanctionAppealStatus) {
  return status === 'open' || status === 'under_review';
}

export function getGovernanceSanctionScopeLabelKey(scope: GovernanceSanctionScopeOption) {
  return `governanceSanctions.scopes.${scope}` as const;
}

export function getGovernanceSanctionAppealStatusLabelKey(status: GovernanceSanctionAppealStatus) {
  return `governanceSanctions.appealStatuses.${status}` as const;
}
