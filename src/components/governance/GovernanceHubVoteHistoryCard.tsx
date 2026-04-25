import { History } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { getGovernanceProposalStatusLabelKey, getGovernanceVoteChoiceLabelKey } from '@/lib/governance-proposals';
import type { GovernanceVoteHistoryEntry } from '@/lib/governance-vote-history';

export type GovernanceHubVoteHistoryCardProps = {
  t: (key: string, vars?: Record<string, string | number>) => string;
  formatDateTime: (value: string | null) => string;
  entries: GovernanceVoteHistoryEntry[];
};

export function GovernanceHubVoteHistoryCard({ t, formatDateTime, entries }: GovernanceHubVoteHistoryCardProps) {
  return (
    <Card className="rounded-3xl border-border/60 p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="rounded-2xl bg-primary/10 p-3 text-primary">
          <History className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">{t('governanceHub.voteHistory.title')}</h3>
            <p className="text-sm text-muted-foreground">{t('governanceHub.voteHistory.subtitle')}</p>
          </div>

          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('governanceHub.voteHistory.empty')}</p>
          ) : (
            <ul className="space-y-3">
              {entries.map((entry) => (
                <li key={entry.voteId} className="rounded-2xl border border-border/60 bg-background/60 p-3">
                  <p className="font-medium text-foreground line-clamp-2">{entry.proposalTitle}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                    <Badge variant="outline" className="rounded-full">
                      {t(getGovernanceVoteChoiceLabelKey(entry.choice))}
                    </Badge>
                    <span>
                      {t('governanceHub.voteHistory.proposalStatusLine', {
                        status: t(getGovernanceProposalStatusLabelKey(entry.proposalStatus)),
                      })}
                    </span>
                    <span aria-hidden>·</span>
                    <span>{formatDateTime(entry.votedAt)}</span>
                  </div>
                  {Math.abs(entry.weight - 1) > 0.000_1 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t('governanceHub.voteHistory.weightLine', { weight: entry.weight })}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}
