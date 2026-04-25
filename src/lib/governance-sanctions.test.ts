import { describe, expect, it } from 'vitest';

import {
  buildGovernanceSanctionScopeFlags,
  getGovernanceSanctionAppealStatusLabelKey,
  getGovernanceSanctionScopeLabelKey,
  getGovernanceSanctionScopeOptionFromRow,
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
    expect(buildGovernanceSanctionScopeFlags('all').blocks_governance_all).toBe(true);
    expect(buildGovernanceSanctionScopeFlags('execution').blocks_execution).toBe(true);
  });

  it('derives the primary scope option from row flags in priority order', () => {
    expect(getGovernanceSanctionScopeOptionFromRow(buildSanction({ blocks_governance_all: true }))).toBe('all');
    expect(
      getGovernanceSanctionScopeOptionFromRow(
        buildSanction({
          blocks_governance_all: false,
          blocks_proposal_creation: true,
        }),
      ),
    ).toBe('proposal_create');
    expect(
      getGovernanceSanctionScopeOptionFromRow(
        buildSanction({
          blocks_governance_all: false,
          blocks_proposal_creation: false,
          blocks_voting: true,
        }),
      ),
    ).toBe('vote');
    expect(
      getGovernanceSanctionScopeOptionFromRow(
        buildSanction({
          blocks_governance_all: false,
          blocks_proposal_creation: false,
          blocks_voting: false,
          blocks_verification_review: true,
        }),
      ),
    ).toBe('verification_review');
    expect(
      getGovernanceSanctionScopeOptionFromRow(
        buildSanction({
          blocks_governance_all: false,
          blocks_proposal_creation: false,
          blocks_voting: false,
          blocks_verification_review: false,
          blocks_execution: true,
        }),
      ),
    ).toBe('execution');
    expect(
      getGovernanceSanctionScopeOptionFromRow(
        buildSanction({
          blocks_governance_all: false,
          blocks_proposal_creation: false,
          blocks_voting: false,
          blocks_verification_review: false,
          blocks_execution: false,
        }),
      ),
    ).toBe('all');
  });

  it('exposes stable i18n keys for scopes and appeal statuses', () => {
    expect(getGovernanceSanctionScopeLabelKey('vote')).toBe('governanceSanctions.scopes.vote');
    expect(getGovernanceSanctionAppealStatusLabelKey('open')).toBe('governanceSanctions.appealStatuses.open');
    expect(getGovernanceSanctionAppealStatusLabelKey('rejected')).toBe('governanceSanctions.appealStatuses.rejected');
  });

  it('treats window-expired sanctions as inactive', () => {
    const sanction = buildSanction({
      starts_at: '2026-01-01T00:00:00.000Z',
      ends_at: '2026-02-01T00:00:00.000Z',
    });

    expect(isGovernanceSanctionCurrentlyActive(sanction, new Date('2026-02-01T00:00:00.000Z').getTime())).toBe(false);
    expect(isGovernanceSanctionCurrentlyActive(sanction, new Date('2026-01-15T00:00:00.000Z').getTime())).toBe(true);
  });

  it('treats inactive rows and future start dates as not currently active', () => {
    expect(
      isGovernanceSanctionCurrentlyActive(
        buildSanction({ is_active: false }),
        new Date('2026-06-01T00:00:00.000Z').getTime(),
      ),
    ).toBe(false);

    expect(
      isGovernanceSanctionCurrentlyActive(
        buildSanction({
          starts_at: '2026-06-01T00:00:00.000Z',
          ends_at: null,
        }),
        new Date('2026-05-01T00:00:00.000Z').getTime(),
      ),
    ).toBe(false);
  });

  it('checks specific scope blocks when not globally blocked', () => {
    const sanction = buildSanction({
      blocks_governance_all: false,
      blocks_voting: true,
    });

    expect(governanceSanctionBlocksScope(sanction, 'vote')).toBe(true);
    expect(governanceSanctionBlocksScope(sanction, 'proposal_create')).toBe(false);
  });

  it('maps verification_review and execution flags to their scopes', () => {
    const reviewOnly = buildSanction({
      blocks_governance_all: false,
      blocks_verification_review: true,
    });
    expect(governanceSanctionBlocksScope(reviewOnly, 'verification_review')).toBe(true);
    expect(governanceSanctionBlocksScope(reviewOnly, 'execution')).toBe(false);

    const executionOnly = buildSanction({
      blocks_governance_all: false,
      blocks_execution: true,
    });
    expect(governanceSanctionBlocksScope(executionOnly, 'execution')).toBe(true);
    expect(governanceSanctionBlocksScope(executionOnly, 'vote')).toBe(false);
  });

  it('blocks every scope when governance-wide blocking is enabled', () => {
    const sanction = buildSanction({
      blocks_governance_all: true,
      blocks_voting: false,
    });
    expect(governanceSanctionBlocksScope(sanction, 'vote')).toBe(true);
    expect(governanceSanctionBlocksScope(sanction, 'execution')).toBe(true);
  });

  it('does not block scopes once the sanction window has ended', () => {
    const sanction = buildSanction({
      blocks_governance_all: false,
      blocks_execution: true,
      starts_at: '2026-01-01T00:00:00.000Z',
      ends_at: '2026-02-01T00:00:00.000Z',
    });
    expect(
      governanceSanctionBlocksScope(
        sanction,
        'execution',
        new Date('2026-02-01T00:00:00.000Z').getTime(),
      ),
    ).toBe(false);
  });

  it('marks open and under-review appeals as open', () => {
    expect(isAppealOpen('open')).toBe(true);
    expect(isAppealOpen('under_review')).toBe(true);
    expect(isAppealOpen('accepted')).toBe(false);
    expect(isAppealOpen('rejected')).toBe(false);
    expect(isAppealOpen('withdrawn')).toBe(false);
  });

  it('treats unparseable date strings like an open-ended window for activity checks', () => {
    const sanction = buildSanction({
      is_active: true,
      starts_at: 'not-a-date',
      ends_at: 'also-bad',
    });

    expect(isGovernanceSanctionCurrentlyActive(sanction, new Date('2026-06-01T00:00:00.000Z').getTime())).toBe(true);
  });
});
