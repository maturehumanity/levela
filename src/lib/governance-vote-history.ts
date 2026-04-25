import type { GovernanceProposalRow, GovernanceProposalVoteRow } from '@/lib/governance-proposals';

export const GOVERNANCE_VOTE_HISTORY_LIMIT = 20;

export type GovernanceVoteHistoryEntry = {
  voteId: string;
  proposalId: string;
  proposalTitle: string;
  proposalStatus: GovernanceProposalRow['status'];
  choice: GovernanceProposalVoteRow['choice'];
  weight: number;
  votedAt: string;
};

export function buildGovernanceVoteHistoryForVoter(args: {
  votes: GovernanceProposalVoteRow[];
  proposalsById: Record<string, GovernanceProposalRow | undefined>;
  voterId: string;
  limit?: number;
}): GovernanceVoteHistoryEntry[] {
  const limit = args.limit ?? GOVERNANCE_VOTE_HISTORY_LIMIT;
  const mine = args.votes.filter((vote) => vote.voter_id === args.voterId);
  const sorted = [...mine].sort((left, right) => (left.created_at < right.created_at ? 1 : -1));

  const entries: GovernanceVoteHistoryEntry[] = [];

  for (const vote of sorted) {
    if (entries.length >= limit) break;

    const proposal = args.proposalsById[vote.proposal_id];
    if (!proposal) continue;

    entries.push({
      voteId: vote.id,
      proposalId: proposal.id,
      proposalTitle: proposal.title,
      proposalStatus: proposal.status,
      choice: vote.choice,
      weight: vote.weight,
      votedAt: vote.created_at,
    });
  }

  return entries;
}
