import { describe, expect, it } from 'vitest';

import { buildGovernanceVoteHistoryForVoter, GOVERNANCE_VOTE_HISTORY_LIMIT } from '@/lib/governance-vote-history';
import type { GovernanceProposalRow, GovernanceProposalVoteRow } from '@/lib/governance-proposals';

function proposal(overrides: Partial<GovernanceProposalRow>): GovernanceProposalRow {
  return {
    id: 'p-default',
    approval_threshold: 0.5,
    body: '',
    bootstrap_mode: false,
    closes_at: '2026-01-10T00:00:00.000Z',
    created_at: '2026-01-01T00:00:00.000Z',
    decision_class: 'ordinary',
    eligible_voter_count_snapshot: 1,
    final_decision_summary: null,
    opens_at: '2026-01-01T00:00:00.000Z',
    proposal_type: 'test',
    proposer_id: 'u1',
    required_quorum: 1,
    resolved_at: null,
    status: 'open',
    summary: '',
    title: 'Default',
    updated_at: '2026-01-01T00:00:00.000Z',
    metadata: {},
    ...overrides,
  };
}

function vote(overrides: Partial<GovernanceProposalVoteRow>): GovernanceProposalVoteRow {
  return {
    id: 'v-default',
    choice: 'approve',
    created_at: '2026-01-01T00:00:00.000Z',
    proposal_id: 'p-default',
    rationale: null,
    snapshot: {},
    updated_at: '2026-01-01T00:00:00.000Z',
    voter_id: 'citizen-1',
    weight: 1,
    ...overrides,
  };
}

describe('governance-vote-history', () => {
  it('returns newest votes first with proposal context', () => {
    const proposalsById: Record<string, GovernanceProposalRow> = {
      p1: proposal({ id: 'p1', title: 'Older proposal' }),
      p2: proposal({ id: 'p2', title: 'Newer proposal' }),
    };

    const votes = [
      vote({ id: 'v1', proposal_id: 'p1', choice: 'approve', created_at: '2026-01-01T00:00:00.000Z' }),
      vote({ id: 'v2', proposal_id: 'p2', choice: 'reject', created_at: '2026-02-01T00:00:00.000Z' }),
    ];

    const entries = buildGovernanceVoteHistoryForVoter({
      votes,
      proposalsById,
      voterId: 'citizen-1',
    });

    expect(entries.map((e) => e.voteId)).toEqual(['v2', 'v1']);
    expect(entries[0]).toMatchObject({
      proposalTitle: 'Newer proposal',
      choice: 'reject',
    });
  });

  it('ignores other voters and missing proposals', () => {
    const proposalsById: Record<string, GovernanceProposalRow> = {
      p1: proposal({ id: 'p1', title: 'Kept' }),
    };

    const votes = [
      vote({ id: 'v1', proposal_id: 'p1', voter_id: 'citizen-1' }),
      vote({ id: 'v2', proposal_id: 'missing', voter_id: 'citizen-1' }),
      vote({ id: 'v3', proposal_id: 'p1', voter_id: 'someone-else' }),
    ];

    const entries = buildGovernanceVoteHistoryForVoter({ votes, proposalsById, voterId: 'citizen-1' });
    expect(entries).toHaveLength(1);
    expect(entries[0].voteId).toBe('v1');
  });

  it('respects the history limit', () => {
    const proposalsById: Record<string, GovernanceProposalRow> = Object.fromEntries(
      Array.from({ length: GOVERNANCE_VOTE_HISTORY_LIMIT + 5 }, (_, index) => {
        const id = `p-${index}`;
        return [id, proposal({ id, title: `Proposal ${index}` })] as const;
      }),
    );

    const votes: GovernanceProposalVoteRow[] = Array.from({ length: GOVERNANCE_VOTE_HISTORY_LIMIT + 5 }, (_, index) =>
      vote({
        id: `v-${index}`,
        proposal_id: `p-${index}`,
        created_at: `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
      }),
    );

    const entries = buildGovernanceVoteHistoryForVoter({ votes, proposalsById, voterId: 'citizen-1' });
    expect(entries).toHaveLength(GOVERNANCE_VOTE_HISTORY_LIMIT);
  });
});
