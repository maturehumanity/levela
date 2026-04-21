import type { GovernanceDecisionClass } from '@/lib/governance-proposals';

import {
  emptyGovernanceExecutionDraft,
  type GovernanceExecutionDraft,
} from '@/lib/governance-execution';

export type GovernanceProposalDraft = {
  title: string;
  summary: string;
  body: string;
  decisionClass: GovernanceDecisionClass;
  execution: GovernanceExecutionDraft;
};

export function createEmptyGovernanceProposalDraft(): GovernanceProposalDraft {
  return {
    title: '',
    summary: '',
    body: '',
    decisionClass: 'ordinary',
    execution: {
      ...emptyGovernanceExecutionDraft,
    },
  };
}
