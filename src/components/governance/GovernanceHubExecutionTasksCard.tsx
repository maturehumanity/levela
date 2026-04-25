import { ListTodo } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { getGovernanceImplementationStatusClassName, getGovernanceImplementationStatusLabelKey } from '@/lib/governance-implementation';
import type { GovernanceExecutionTaskItem } from '@/lib/governance-execution-tasks';

export type GovernanceHubExecutionTasksCardProps = {
  t: (key: string, vars?: Record<string, string | number>) => string;
  formatDateTime: (value: string | null) => string;
  tasks: GovernanceExecutionTaskItem[];
};

export function GovernanceHubExecutionTasksCard({ t, formatDateTime, tasks }: GovernanceHubExecutionTasksCardProps) {
  return (
    <Card className="rounded-3xl border-border/60 p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="rounded-2xl bg-primary/10 p-3 text-primary">
          <ListTodo className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">{t('governanceHub.executionTasks.title')}</h3>
            <p className="text-sm text-muted-foreground">{t('governanceHub.executionTasks.subtitle')}</p>
          </div>

          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('governanceHub.executionTasks.empty')}</p>
          ) : (
            <ul className="space-y-3">
              {tasks.map((task) => (
                <li key={task.implementationId} className="rounded-2xl border border-border/60 bg-background/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-foreground">{task.proposalTitle}</p>
                    <Badge variant="outline" className={getGovernanceImplementationStatusClassName(task.implementationStatus)}>
                      {t(getGovernanceImplementationStatusLabelKey(task.implementationStatus))}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{task.implementationSummary}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span>{t('governanceHub.executionTasks.unitLabel', { unit: task.unitName })}</span>
                    <span aria-hidden>·</span>
                    <span>{t('governanceHub.executionTasks.assignedLabel', { at: formatDateTime(task.assignedAt) })}</span>
                    <span aria-hidden>·</span>
                    <a
                      className="font-medium text-primary underline-offset-4 hover:underline"
                      href={`#proposal-${task.proposalId}`}
                    >
                      {t('governanceHub.executionTasks.openProposal')}
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}
