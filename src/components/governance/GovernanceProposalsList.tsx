import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { fetchGovernanceProposals, castGovernanceVote, getGovernanceProposalResults } from '@/lib/governance-ui-utils';
import { formatProposalStatus } from '@/lib/governance-ui-utils';
import type { GovernanceProposal, GovernanceProposalResults } from '@/lib/governance-ui.types';

interface GovernanceProposalsListProps {
  onProposalSelect?: (proposal: GovernanceProposal) => void;
}

export function GovernanceProposalsList({ onProposalSelect }: GovernanceProposalsListProps) {
  const { t } = useLanguage();
  const [proposals, setProposals] = useState<GovernanceProposal[]>([]);
  const [results, setResults] = useState<Record<string, GovernanceProposalResults>>({});
  const [loading, setLoading] = useState(true);
  const [votingProposalId, setVotingProposalId] = useState<string | null>(null);
  const [userVotes, setUserVotes] = useState<Record<string, string>>({});

  useEffect(() => {
    loadProposals();
  }, []);

  const loadProposals = async () => {
    setLoading(true);
    try {
      const data = await fetchGovernanceProposals('active');
      setProposals(data);
      
      // Load results for each proposal
      for (const proposal of data) {
        const proposalResults = await getGovernanceProposalResults(proposal.id);
        if (proposalResults) {
          setResults((prev) => ({
            ...prev,
            [proposal.id]: proposalResults,
          }));
        }
      }
    } catch (error) {
      console.error('Error loading proposals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (proposalId: string, choice: 'yes' | 'no' | 'abstain') => {
    setVotingProposalId(proposalId);
    try {
      await castGovernanceVote(proposalId, choice);
      setUserVotes((prev) => ({
        ...prev,
        [proposalId]: choice,
      }));
      
      // Refresh results
      const updatedResults = await getGovernanceProposalResults(proposalId);
      if (updatedResults) {
        setResults((prev) => ({
          ...prev,
          [proposalId]: updatedResults,
        }));
      }
    } catch (error) {
      console.error('Error casting vote:', error);
    } finally {
      setVotingProposalId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (proposals.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground">{t('governance.noProposals')}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {proposals.map((proposal) => {
        const proposalResults = results[proposal.id];
        const userVote = userVotes[proposal.id];

        return (
          <Card
            key={proposal.id}
            className="p-6 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onProposalSelect?.(proposal)}
          >
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">{proposal.proposal_title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {proposal.proposal_description}
                  </p>
                </div>
                <Badge variant={proposal.status === 'active' ? 'default' : 'secondary'}>
                  {formatProposalStatus(proposal.status)}
                </Badge>
              </div>

              {/* Voting Results */}
              {proposalResults && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Votes: {proposalResults.total_votes}</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span>Yes</span>
                        <span>{proposalResults.yes_percentage}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full transition-all"
                          style={{ width: `${proposalResults.yes_percentage}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span>No</span>
                        <span>{proposalResults.no_percentage}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-red-500 h-2 rounded-full transition-all"
                          style={{ width: `${proposalResults.no_percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Voting Actions */}
              {proposal.status === 'active' && !userVote && (
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleVote(proposal.id, 'yes');
                    }}
                    disabled={votingProposalId === proposal.id}
                  >
                    <ThumbsUp className="h-4 w-4 mr-1" />
                    {votingProposalId === proposal.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Vote Yes'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleVote(proposal.id, 'no');
                    }}
                    disabled={votingProposalId === proposal.id}
                  >
                    <ThumbsDown className="h-4 w-4 mr-1" />
                    {votingProposalId === proposal.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Vote No'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleVote(proposal.id, 'abstain');
                    }}
                    disabled={votingProposalId === proposal.id}
                  >
                    {votingProposalId === proposal.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Abstain'}
                  </Button>
                </div>
              )}

              {userVote && (
                <div className="text-sm text-muted-foreground pt-2">
                  Your vote: <Badge variant="secondary">{userVote}</Badge>
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
