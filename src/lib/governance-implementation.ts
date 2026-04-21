import type { Database } from '@/integrations/supabase/types';
import {
  describeGovernanceProposalExecution,
  readGovernanceProposalExecutionSpec,
} from '@/lib/governance-execution';
import type { GovernanceDecisionClass, GovernanceProposalRow } from '@/lib/governance-proposals';

export type GovernanceExecutionUnitRow = Database['public']['Tables']['governance_execution_units']['Row'];
export type GovernanceProposalImplementationInsert = Database['public']['Tables']['governance_proposal_implementations']['Insert'];
export type GovernanceImplementationStatus = Database['public']['Enums']['governance_implementation_status'];

export const GOVERNANCE_EXECUTION_UNIT_KEYS = {
  civicOperations: 'civic_operations',
  policyLegal: 'policy_legal',
  technicalStewardship: 'technical_stewardship',
  constitutionalCouncil: 'constitutional_council',
  identityVerification: 'identity_verification',
  securityResponse: 'security_response',
  treasuryFinance: 'treasury_finance',
} as const;

export function determineGovernanceExecutionUnitKeys(args: {
  decisionClass: GovernanceDecisionClass;
  proposalType: string;
  metadata?: Record<string, unknown> | null;
}) {
  const requestedUnitKey = typeof args.metadata?.requested_unit_key === 'string'
    ? args.metadata.requested_unit_key
    : null;

  if (requestedUnitKey) {
    return [requestedUnitKey];
  }

  if (args.proposalType.includes('treasury') || args.proposalType.includes('monetary')) {
    return [GOVERNANCE_EXECUTION_UNIT_KEYS.treasuryFinance];
  }

  if (args.proposalType.includes('identity') || args.proposalType.includes('verification')) {
    return [GOVERNANCE_EXECUTION_UNIT_KEYS.identityVerification];
  }

  if (args.proposalType.includes('security')) {
    return [GOVERNANCE_EXECUTION_UNIT_KEYS.securityResponse];
  }

  if (args.proposalType.includes('technical') || args.proposalType.includes('system') || args.proposalType.includes('build')) {
    return [GOVERNANCE_EXECUTION_UNIT_KEYS.technicalStewardship];
  }

  if (args.decisionClass === 'constitutional') {
    return [GOVERNANCE_EXECUTION_UNIT_KEYS.constitutionalCouncil];
  }

  if (args.decisionClass === 'elevated') {
    return [GOVERNANCE_EXECUTION_UNIT_KEYS.policyLegal];
  }

  return [GOVERNANCE_EXECUTION_UNIT_KEYS.civicOperations];
}

export function buildGovernanceImplementationSummary(
  proposal: Pick<GovernanceProposalRow, 'title' | 'summary' | 'decision_class' | 'metadata'>,
) {
  const executionSpec = readGovernanceProposalExecutionSpec(proposal.metadata);
  const executionSummary = describeGovernanceProposalExecution(executionSpec);
  return executionSpec.actionType === 'manual_follow_through'
    ? `${proposal.title}: ${proposal.summary}`
    : `${proposal.title}: ${executionSummary}`;
}

export function buildGovernanceImplementationQueue(args: {
  proposal: Pick<GovernanceProposalRow, 'id' | 'title' | 'summary' | 'decision_class' | 'proposal_type' | 'metadata'>;
  createdBy: string | null;
  unitsByKey: Record<string, GovernanceExecutionUnitRow>;
}): GovernanceProposalImplementationInsert[] {
  const unitKeys = determineGovernanceExecutionUnitKeys({
    decisionClass: args.proposal.decision_class,
    proposalType: args.proposal.proposal_type,
    metadata: (args.proposal.metadata as Record<string, unknown> | null) || null,
  });

  return unitKeys
    .map((unitKey) => args.unitsByKey[unitKey])
    .filter(Boolean)
    .map((unit) => ({
      proposal_id: args.proposal.id,
      unit_id: unit.id,
      status: 'queued' satisfies GovernanceImplementationStatus,
      implementation_summary: buildGovernanceImplementationSummary(args.proposal),
      created_by: args.createdBy,
      metadata: {
        unit_key: unit.unit_key,
        unit_domain_key: unit.domain_key,
        decision_class: args.proposal.decision_class,
      },
    }));
}

export function getGovernanceImplementationStatusLabelKey(status: GovernanceImplementationStatus) {
  switch (status) {
    case 'in_progress':
      return 'governanceHub.implementationStatuses.in_progress';
    case 'completed':
      return 'governanceHub.implementationStatuses.completed';
    case 'blocked':
      return 'governanceHub.implementationStatuses.blocked';
    case 'cancelled':
      return 'governanceHub.implementationStatuses.cancelled';
    case 'queued':
    default:
      return 'governanceHub.implementationStatuses.queued';
  }
}

export function getGovernanceImplementationStatusClassName(status: GovernanceImplementationStatus) {
  switch (status) {
    case 'completed':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
    case 'in_progress':
      return 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300';
    case 'blocked':
      return 'border-destructive/20 bg-destructive/10 text-destructive';
    case 'cancelled':
      return 'border-border bg-muted text-muted-foreground';
    case 'queued':
    default:
      return 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
}

export function getGovernanceUnitLabelKey(unitKey: string) {
  return `governanceHub.units.${unitKey}`;
}
