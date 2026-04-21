import type { Database } from '@/integrations/supabase/types';

export const DEFAULT_GOVERNANCE_VOTING_WINDOW_HOURS = 72;

export type GovernanceDecisionClass = Database['public']['Enums']['governance_decision_class'];
export type GovernanceProposalStatus = Database['public']['Enums']['governance_proposal_status'];
export type GovernanceVoteChoice = Database['public']['Enums']['governance_vote_choice'];

export type GovernanceProposalRow = Database['public']['Tables']['governance_proposals']['Row'];
export type GovernanceProposalVoteRow = Database['public']['Tables']['governance_proposal_votes']['Row'];

export type GovernanceTimingWindow = {
  bootstrapMode: boolean;
  eligibleVoterCount: number;
  requiredQuorum: number;
  opensAt: string;
  closesAt: string;
  waitRequired: boolean;
};

export type GovernanceVoteTally = {
  approvals: number;
  rejections: number;
  abstentions: number;
  totalVotes: number;
  decisiveVotes: number;
};

export type GovernanceProposalResolution = {
  finalizable: boolean;
  status: GovernanceProposalStatus;
  summary: string;
  tally: GovernanceVoteTally;
};

export type GovernanceProposalResolutionThresholds = {
  minApprovalShare?: number;
  minDecisiveVotes?: number;
  minApprovalVotes?: number;
  minQuorum?: number;
  requiresWindowClose?: boolean;
};

function addHours(timestamp: number, hours: number) {
  return timestamp + hours * 60 * 60 * 1000;
}

export function computeGovernanceTimingWindow(args: {
  eligibleVoterCount: number;
  now?: string | Date;
  votingWindowHours?: number;
  minimumQuorum?: number;
  requireWaitWindow?: boolean;
}): GovernanceTimingWindow {
  const currentTime = args.now ? new Date(args.now).getTime() : Date.now();
  const eligibleVoterCount = Math.max(0, Math.floor(args.eligibleVoterCount));
  const baselineWaitRequired = eligibleVoterCount > 1;
  const baselineQuorum = baselineWaitRequired ? Math.max(2, Math.ceil(eligibleVoterCount / 2)) : 1;
  const requiredQuorum = Math.max(1, baselineQuorum, Math.floor(args.minimumQuorum ?? 1));
  const waitRequired = baselineWaitRequired || requiredQuorum > 1 || Boolean(args.requireWaitWindow);
  const opensAt = new Date(currentTime).toISOString();
  const closesAt = new Date(
    waitRequired ? addHours(currentTime, args.votingWindowHours ?? DEFAULT_GOVERNANCE_VOTING_WINDOW_HOURS) : currentTime,
  ).toISOString();

  return {
    bootstrapMode: !waitRequired,
    eligibleVoterCount,
    requiredQuorum,
    opensAt,
    closesAt,
    waitRequired,
  };
}

export function tallyGovernanceVotes(votes: GovernanceProposalVoteRow[]): GovernanceVoteTally {
  return votes.reduce<GovernanceVoteTally>(
    (accumulator, vote) => {
      const weight = Math.max(0, vote.weight || 0);
      accumulator.totalVotes += weight;

      if (vote.choice === 'approve') {
        accumulator.approvals += weight;
        accumulator.decisiveVotes += weight;
      } else if (vote.choice === 'reject') {
        accumulator.rejections += weight;
        accumulator.decisiveVotes += weight;
      } else {
        accumulator.abstentions += weight;
      }

      return accumulator;
    },
    {
      approvals: 0,
      rejections: 0,
      abstentions: 0,
      totalVotes: 0,
      decisiveVotes: 0,
    },
  );
}

export function resolveGovernanceProposal(args: {
  proposal: Pick<
    GovernanceProposalRow,
    'bootstrap_mode' | 'approval_threshold' | 'closes_at' | 'eligible_voter_count_snapshot' | 'required_quorum' | 'status'
  >;
  votes: GovernanceProposalVoteRow[];
  now?: string | Date;
  thresholds?: GovernanceProposalResolutionThresholds;
}): GovernanceProposalResolution {
  const tally = tallyGovernanceVotes(args.votes);
  const proposal = args.proposal;
  const thresholds = args.thresholds;
  const nowMs = args.now ? new Date(args.now).getTime() : Date.now();
  const closesAtMs = new Date(proposal.closes_at).getTime();
  const requiredQuorum = Math.max(1, proposal.required_quorum, Math.floor(thresholds?.minQuorum ?? 1));
  const requiredDecisiveVotes = Math.max(requiredQuorum, Math.floor(thresholds?.minDecisiveVotes ?? requiredQuorum));
  const requiredApprovalShare = Math.max(proposal.approval_threshold, thresholds?.minApprovalShare ?? proposal.approval_threshold);
  const requiredApprovalVotes = Math.max(
    Math.floor(thresholds?.minApprovalVotes ?? 1),
    Math.ceil(requiredDecisiveVotes * requiredApprovalShare),
  );
  const quorumReached = tally.decisiveVotes >= requiredQuorum;
  const allEligibleCitizensVoted = tally.totalVotes >= proposal.eligible_voter_count_snapshot;
  const waitExpired = nowMs >= closesAtMs;
  const waitSatisfied = thresholds?.requiresWindowClose
    ? waitExpired
    : (waitExpired || allEligibleCitizensVoted);
  const canEvaluate = proposal.bootstrap_mode
    ? tally.decisiveVotes >= requiredDecisiveVotes && waitSatisfied
    : quorumReached && tally.decisiveVotes >= requiredDecisiveVotes && waitSatisfied;

  if (proposal.status !== 'open') {
    return {
      finalizable: false,
      status: proposal.status,
      summary: 'Proposal already resolved.',
      tally,
    };
  }

  if (!canEvaluate) {
    return {
      finalizable: false,
      status: 'open',
      summary: proposal.bootstrap_mode
        ? 'Bootstrap vote pending the first decisive vote.'
        : 'Proposal remains open until quorum and timing requirements are met.',
      tally,
    };
  }

  const decisiveVotes = tally.approvals + tally.rejections;
  const approvalShare = decisiveVotes > 0 ? tally.approvals / decisiveVotes : 0;
  const passed = (
    tally.approvals > tally.rejections
    && decisiveVotes >= requiredDecisiveVotes
    && tally.approvals >= requiredApprovalVotes
    && approvalShare >= requiredApprovalShare
  );

  return {
    finalizable: true,
    status: passed ? 'approved' : 'rejected',
    summary: passed
      ? `Approved with ${tally.approvals} approval vote${tally.approvals === 1 ? '' : 's'} against ${tally.rejections} rejection vote${tally.rejections === 1 ? '' : 's'}.`
      : `Rejected with ${tally.approvals} approval vote${tally.approvals === 1 ? '' : 's'} against ${tally.rejections} rejection vote${tally.rejections === 1 ? '' : 's'}.`,
    tally,
  };
}

export function getGovernanceDecisionClassLabelKey(decisionClass: GovernanceDecisionClass) {
  switch (decisionClass) {
    case 'elevated':
      return 'governanceHub.decisionClasses.elevated';
    case 'constitutional':
      return 'governanceHub.decisionClasses.constitutional';
    case 'ordinary':
    default:
      return 'governanceHub.decisionClasses.ordinary';
  }
}

export function getGovernanceProposalStatusLabelKey(status: GovernanceProposalStatus) {
  switch (status) {
    case 'approved':
      return 'governanceHub.statuses.approved';
    case 'rejected':
      return 'governanceHub.statuses.rejected';
    case 'cancelled':
      return 'governanceHub.statuses.cancelled';
    case 'open':
    default:
      return 'governanceHub.statuses.open';
  }
}

export function getGovernanceVoteChoiceLabelKey(choice: GovernanceVoteChoice) {
  switch (choice) {
    case 'reject':
      return 'governanceHub.voteChoices.reject';
    case 'abstain':
      return 'governanceHub.voteChoices.abstain';
    case 'approve':
    default:
      return 'governanceHub.voteChoices.approve';
  }
}
