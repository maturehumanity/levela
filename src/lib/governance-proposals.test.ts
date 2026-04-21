import { describe, expect, it } from 'vitest';

import {
  computeGovernanceTimingWindow,
  resolveGovernanceProposal,
  tallyGovernanceVotes,
} from './governance-proposals';

describe('governance-proposals', () => {
  it('allows bootstrap proposals to close immediately when only one eligible citizen exists', () => {
    expect(
      computeGovernanceTimingWindow({
        eligibleVoterCount: 1,
        now: '2026-04-19T00:00:00.000Z',
      }),
    ).toEqual({
      bootstrapMode: true,
      eligibleVoterCount: 1,
      requiredQuorum: 1,
      opensAt: '2026-04-19T00:00:00.000Z',
      closesAt: '2026-04-19T00:00:00.000Z',
      waitRequired: false,
    });
  });

  it('gives mature proposals a quorum and future close time', () => {
    const timing = computeGovernanceTimingWindow({
      eligibleVoterCount: 4,
      now: '2026-04-19T00:00:00.000Z',
      votingWindowHours: 48,
    });

    expect(timing.bootstrapMode).toBe(false);
    expect(timing.requiredQuorum).toBe(2);
    expect(timing.closesAt).toBe('2026-04-21T00:00:00.000Z');
  });

  it('forces wait-window timing when threshold rules require extra quorum', () => {
    const timing = computeGovernanceTimingWindow({
      eligibleVoterCount: 1,
      now: '2026-04-19T00:00:00.000Z',
      minimumQuorum: 3,
      requireWaitWindow: true,
      votingWindowHours: 24,
    });

    expect(timing.bootstrapMode).toBe(false);
    expect(timing.requiredQuorum).toBe(3);
    expect(timing.waitRequired).toBe(true);
    expect(timing.closesAt).toBe('2026-04-20T00:00:00.000Z');
  });

  it('tallies votes by weight and category', () => {
    expect(
      tallyGovernanceVotes([
        {
          id: '1',
          proposal_id: 'p1',
          voter_id: 'u1',
          choice: 'approve',
          weight: 1,
          rationale: null,
          snapshot: {},
          created_at: '',
          updated_at: '',
        },
        {
          id: '2',
          proposal_id: 'p1',
          voter_id: 'u2',
          choice: 'abstain',
          weight: 1,
          rationale: null,
          snapshot: {},
          created_at: '',
          updated_at: '',
        },
      ]),
    ).toEqual({
      approvals: 1,
      rejections: 0,
      abstentions: 1,
      totalVotes: 2,
      decisiveVotes: 1,
    });
  });

  it('finalizes a bootstrap proposal immediately after a decisive vote', () => {
    const resolution = resolveGovernanceProposal({
      proposal: {
        bootstrap_mode: true,
        approval_threshold: 0.5,
        closes_at: '2026-04-19T00:00:00.000Z',
        eligible_voter_count_snapshot: 1,
        required_quorum: 1,
        status: 'open',
      },
      votes: [
        {
          id: '1',
          proposal_id: 'p1',
          voter_id: 'u1',
          choice: 'approve',
          weight: 1,
          rationale: null,
          snapshot: {},
          created_at: '',
          updated_at: '',
        },
      ],
      now: '2026-04-19T00:00:00.000Z',
    });

    expect(resolution.finalizable).toBe(true);
    expect(resolution.status).toBe('approved');
  });

  it('keeps mature proposals open until quorum and timing conditions are satisfied', () => {
    const resolution = resolveGovernanceProposal({
      proposal: {
        bootstrap_mode: false,
        approval_threshold: 0.5,
        closes_at: '2026-04-22T00:00:00.000Z',
        eligible_voter_count_snapshot: 4,
        required_quorum: 2,
        status: 'open',
      },
      votes: [
        {
          id: '1',
          proposal_id: 'p1',
          voter_id: 'u1',
          choice: 'approve',
          weight: 1,
          rationale: null,
          snapshot: {},
          created_at: '',
          updated_at: '',
        },
      ],
      now: '2026-04-20T00:00:00.000Z',
    });

    expect(resolution.finalizable).toBe(false);
    expect(resolution.status).toBe('open');
  });

  it('applies stricter threshold requirements when provided', () => {
    const resolution = resolveGovernanceProposal({
      proposal: {
        bootstrap_mode: false,
        approval_threshold: 0.5,
        closes_at: '2026-04-22T00:00:00.000Z',
        eligible_voter_count_snapshot: 4,
        required_quorum: 2,
        status: 'open',
      },
      votes: [
        {
          id: '1',
          proposal_id: 'p1',
          voter_id: 'u1',
          choice: 'approve',
          weight: 1,
          rationale: null,
          snapshot: {},
          created_at: '',
          updated_at: '',
        },
        {
          id: '2',
          proposal_id: 'p1',
          voter_id: 'u2',
          choice: 'approve',
          weight: 1,
          rationale: null,
          snapshot: {},
          created_at: '',
          updated_at: '',
        },
      ],
      thresholds: {
        minApprovalShare: 0.67,
        minDecisiveVotes: 3,
        minApprovalVotes: 2,
        minQuorum: 3,
        requiresWindowClose: true,
      },
      now: '2026-04-22T00:00:00.000Z',
    });

    expect(resolution.finalizable).toBe(false);
    expect(resolution.status).toBe('open');
  });
});
