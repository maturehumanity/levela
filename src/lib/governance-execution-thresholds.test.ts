import { describe, expect, it } from 'vitest';

import {
  readGovernanceExecutionThresholdRuleFromMetadata,
  resolveGovernanceExecutionThresholdRule,
  serializeGovernanceExecutionThresholdRule,
  toGovernanceProposalResolutionThresholds,
} from './governance-execution-thresholds';

describe('governance-execution-thresholds', () => {
  it('returns guardian thresholds for sensitive role-permission changes', () => {
    const rule = resolveGovernanceExecutionThresholdRule({
      actionType: 'grant_role_permission',
      decisionClass: 'ordinary',
    });

    expect(rule.approvalClass).toBe('guardian_threshold');
    expect(rule.minApprovalShare).toBe(0.67);
    expect(rule.minQuorum).toBe(3);
    expect(rule.requiresWindowClose).toBe(true);
  });

  it('falls back to decision-class baseline for ordinary content review actions', () => {
    const rule = resolveGovernanceExecutionThresholdRule({
      actionType: 'approve_content_item',
      decisionClass: 'elevated',
    });

    expect(rule.approvalClass).toBe('ordinary_majority');
    expect(rule.minApprovalShare).toBe(0.5);
    expect(rule.minDecisiveVotes).toBe(1);
  });

  it('round-trips threshold metadata snapshots', () => {
    const original = resolveGovernanceExecutionThresholdRule({
      actionType: 'activate_monetary_policy',
      decisionClass: 'constitutional',
    });

    const metadata = {
      execution_threshold: serializeGovernanceExecutionThresholdRule(original),
    };

    const restored = readGovernanceExecutionThresholdRuleFromMetadata(metadata);
    expect(restored).toEqual(original);

    expect(toGovernanceProposalResolutionThresholds(restored!)).toEqual({
      minApprovalShare: original.minApprovalShare,
      minDecisiveVotes: original.minDecisiveVotes,
      minApprovalVotes: original.minApprovalVotes,
      minQuorum: original.minQuorum,
      requiresWindowClose: original.requiresWindowClose,
    });
  });
});
