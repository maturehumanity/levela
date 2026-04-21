import { describe, expect, it } from 'vitest';

import {
  buildGovernanceSanctionScopeFlags,
  governanceSanctionBlocksScope,
  isAppealOpen,
  isGovernanceSanctionCurrentlyActive,
  type GovernanceSanctionRow,
} from '@/lib/governance-sanctions';

function buildSanction(partial?: Partial<GovernanceSanctionRow>): GovernanceSanctionRow {
  return {
    id: 'sanction-1',
    profile_id: 'profile-1',
    reason: 'reason',
    notes: null,
    is_active: true,
    starts_at: '2026-01-01T00:00:00.000Z',
    ends_at: null,
    issued_by: 'issuer-1',
    lifted_by: null,
    lifted_at: null,
    blocks_governance_all: true,
    blocks_proposal_creation: false,
    blocks_voting: false,
    blocks_verification_review: false,
    blocks_execution: false,
    metadata: {},
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('governance sanctions', () => {
  it('matches scope flags for a specific scope', () => {
    expect(buildGovernanceSanctionScopeFlags('vote')).toEqual({
      blocks_governance_all: false,
      blocks_proposal_creation: false,
      blocks_voting: true,
      blocks_verification_review: false,
      blocks_execution: false,
    });
  });

  it('treats window-expired sanctions as inactive', () => {
    const sanction = buildSanction({
      starts_at: '2026-01-01T00:00:00.000Z',
      ends_at: '2026-02-01T00:00:00.000Z',
    });

    expect(isGovernanceSanctionCurrentlyActive(sanction, new Date('2026-02-01T00:00:00.000Z').getTime())).toBe(false);
    expect(isGovernanceSanctionCurrentlyActive(sanction, new Date('2026-01-15T00:00:00.000Z').getTime())).toBe(true);
  });

  it('checks specific scope blocks when not globally blocked', () => {
    const sanction = buildSanction({
      blocks_governance_all: false,
      blocks_voting: true,
    });

    expect(governanceSanctionBlocksScope(sanction, 'vote')).toBe(true);
    expect(governanceSanctionBlocksScope(sanction, 'proposal_create')).toBe(false);
  });

  it('marks open and under-review appeals as open', () => {
    expect(isAppealOpen('open')).toBe(true);
    expect(isAppealOpen('under_review')).toBe(true);
    expect(isAppealOpen('accepted')).toBe(false);
  });
});
