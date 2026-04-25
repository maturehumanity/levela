import { describe, expect, it } from 'vitest';

import {
  computeGovernanceTimingWindow,
  getGovernanceDecisionClassLabelKey,
  getGovernanceProposalStatusLabelKey,
  getGovernanceVoteChoiceLabelKey,
  resolveGovernanceProposal,
  tallyGovernanceVotes,
  type GovernanceDecisionClass,
  type GovernanceProposalStatus,
  type GovernanceVoteChoice,
} from './governance-proposals';

describe('governance-proposals', () => {
  it('exposes stable translation keys for decision classes, statuses, and vote choices', () => {
    expect(getGovernanceDecisionClassLabelKey('ordinary')).toBe('governanceHub.decisionClasses.ordinary');
    expect(getGovernanceDecisionClassLabelKey('elevated')).toBe('governanceHub.decisionClasses.elevated');
    expect(getGovernanceDecisionClassLabelKey('constitutional')).toBe('governanceHub.decisionClasses.constitutional');

    expect(getGovernanceProposalStatusLabelKey('open')).toBe('governanceHub.statuses.open');
    expect(getGovernanceProposalStatusLabelKey('approved')).toBe('governanceHub.statuses.approved');
    expect(getGovernanceProposalStatusLabelKey('rejected')).toBe('governanceHub.statuses.rejected');
    expect(getGovernanceProposalStatusLabelKey('cancelled')).toBe('governanceHub.statuses.cancelled');

    expect(getGovernanceVoteChoiceLabelKey('approve')).toBe('governanceHub.voteChoices.approve');
    expect(getGovernanceVoteChoiceLabelKey('reject')).toBe('governanceHub.voteChoices.reject');
    expect(getGovernanceVoteChoiceLabelKey('abstain')).toBe('governanceHub.voteChoices.abstain');
  });

  it('falls back to ordinary label keys for unknown enum-like values', () => {
    expect(getGovernanceDecisionClassLabelKey('future_class' as GovernanceDecisionClass)).toBe(
      'governanceHub.decisionClasses.ordinary',
    );
    expect(getGovernanceProposalStatusLabelKey('future_status' as GovernanceProposalStatus)).toBe('governanceHub.statuses.open');
    expect(getGovernanceVoteChoiceLabelKey('future_choice' as GovernanceVoteChoice)).toBe('governanceHub.voteChoices.approve');
  });

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

  it('treats null or missing vote weights as zero', () => {
    expect(
      tallyGovernanceVotes([
        {
          id: '1',
          proposal_id: 'p1',
          voter_id: 'u1',
          choice: 'approve',
          weight: null as unknown as number,
          rationale: null,
          snapshot: {},
          created_at: '',
          updated_at: '',
        },
        {
          id: '2',
          proposal_id: 'p1',
          voter_id: 'u2',
          choice: 'reject',
          weight: undefined as unknown as number,
          rationale: null,
          snapshot: {},
          created_at: '',
          updated_at: '',
        },
      ]),
    ).toEqual({
      approvals: 0,
      rejections: 0,
      abstentions: 0,
      totalVotes: 0,
      decisiveVotes: 0,
    });
  });

  it('weights approvals and rejections and clamps bad vote weights', () => {
    expect(
      tallyGovernanceVotes([
        {
          id: '1',
          proposal_id: 'p1',
          voter_id: 'u1',
          choice: 'approve',
          weight: 2,
          rationale: null,
          snapshot: {},
          created_at: '',
          updated_at: '',
        },
        {
          id: '2',
          proposal_id: 'p1',
          voter_id: 'u2',
          choice: 'reject',
          weight: 1,
          rationale: null,
          snapshot: {},
          created_at: '',
          updated_at: '',
        },
        {
          id: '3',
          proposal_id: 'p1',
          voter_id: 'u3',
          choice: 'approve',
          weight: -5,
          rationale: null,
          snapshot: {},
          created_at: '',
          updated_at: '',
        },
      ]),
    ).toEqual({
      approvals: 2,
      rejections: 1,
      abstentions: 0,
      totalVotes: 3,
      decisiveVotes: 3,
    });
  });

  it('normalizes fractional eligible voter counts when computing timing windows', () => {
    const timing = computeGovernanceTimingWindow({
      eligibleVoterCount: 4.9,
      now: '2026-04-19T00:00:00.000Z',
      votingWindowHours: 48,
    });
    expect(timing.eligibleVoterCount).toBe(4);
    expect(timing.requiredQuorum).toBe(2);
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

  it('does not re-evaluate proposals that already left the open state', () => {
    const resolution = resolveGovernanceProposal({
      proposal: {
        bootstrap_mode: false,
        approval_threshold: 0.5,
        closes_at: '2026-04-22T00:00:00.000Z',
        eligible_voter_count_snapshot: 4,
        required_quorum: 2,
        status: 'approved',
      },
      votes: [],
      now: '2026-04-23T00:00:00.000Z',
    });

    expect(resolution.finalizable).toBe(false);
    expect(resolution.status).toBe('approved');
    expect(resolution.summary).toBe('Proposal already resolved.');
  });

  it('finalizes as rejected when decisive votes exist but rejections win', () => {
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
          choice: 'reject',
          weight: 2,
          rationale: null,
          snapshot: {},
          created_at: '',
          updated_at: '',
        },
      ],
      now: '2026-04-23T00:00:00.000Z',
    });

    expect(resolution.finalizable).toBe(true);
    expect(resolution.status).toBe('rejected');
    expect(resolution.summary).toContain('Rejected');
  });
});
