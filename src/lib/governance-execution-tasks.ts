import type { GovernanceExecutionUnitRow, GovernanceImplementationStatus } from '@/lib/governance-implementation';
import type { GovernanceProposalRow } from '@/lib/governance-proposals';
import type { Database } from '@/integrations/supabase/types';

export const GOVERNANCE_EXECUTION_TASKS_DEFAULT_LIMIT = 8;

export type GovernanceImplementationRow = Database['public']['Tables']['governance_proposal_implementations']['Row'];

export type GovernanceExecutionTaskItem = {
  implementationId: string;
  proposalId: string;
  proposalTitle: string;
  implementationStatus: GovernanceImplementationStatus;
  implementationSummary: string;
  assignedAt: string;
  unitName: string;
  unitKey: string;
};

export function buildGovernanceExecutionTasksForUser(args: {
  implementations: GovernanceImplementationRow[];
  proposalsById: Record<string, GovernanceProposalRow | undefined>;
  unitsById: Record<string, GovernanceExecutionUnitRow | undefined>;
  currentUserUnitIds: Set<string>;
  limit?: number;
}): GovernanceExecutionTaskItem[] {
  const maxItems = args.limit ?? GOVERNANCE_EXECUTION_TASKS_DEFAULT_LIMIT;
  const actionableStatuses: GovernanceImplementationStatus[] = ['queued', 'blocked', 'in_progress'];

  const tasks = args.implementations
    .filter((item) => args.currentUserUnitIds.has(item.unit_id))
    .filter((item) => actionableStatuses.includes(item.status))
    .map((item) => {
      const proposal = args.proposalsById[item.proposal_id];
      const unit = args.unitsById[item.unit_id];
      if (!proposal || !unit) return null;

      return {
        implementationId: item.id,
        proposalId: proposal.id,
        proposalTitle: proposal.title,
        implementationStatus: item.status,
        implementationSummary: item.implementation_summary,
        assignedAt: item.assigned_at,
        unitName: unit.name,
        unitKey: unit.unit_key,
      } satisfies GovernanceExecutionTaskItem;
    })
    .filter((task): task is GovernanceExecutionTaskItem => Boolean(task))
    .sort((left, right) => (left.assignedAt < right.assignedAt ? 1 : -1));

  return tasks.slice(0, Math.max(1, maxItems));
}
