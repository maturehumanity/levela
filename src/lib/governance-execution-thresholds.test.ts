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

  it('returns null when execution threshold metadata is missing or malformed', () => {
    expect(readGovernanceExecutionThresholdRuleFromMetadata(null)).toBeNull();
    expect(readGovernanceExecutionThresholdRuleFromMetadata({})).toBeNull();
    expect(readGovernanceExecutionThresholdRuleFromMetadata({ execution_threshold: 'bad' })).toBeNull();
  });

  it('returns null when stored numeric or approval fields fail validation', () => {
    const base = serializeGovernanceExecutionThresholdRule(
      resolveGovernanceExecutionThresholdRule({
        actionType: 'manual_follow_through',
        decisionClass: 'ordinary',
      }),
    );

    expect(
      readGovernanceExecutionThresholdRuleFromMetadata({
        execution_threshold: { ...base, min_approval_share: 1.5 },
      }),
    ).toBeNull();

    expect(
      readGovernanceExecutionThresholdRuleFromMetadata({
        execution_threshold: { ...base, approval_class: 'founder_only' },
      }),
    ).toBeNull();

    expect(
      readGovernanceExecutionThresholdRuleFromMetadata({
        execution_threshold: { ...base, requires_window_close: 'yes' },
      }),
    ).toBeNull();
  });

  it('still applies the manual follow-through override when the proposal class is constitutional', () => {
    const rule = resolveGovernanceExecutionThresholdRule({
      actionType: 'manual_follow_through',
      decisionClass: 'constitutional',
    });

    expect(rule.decisionClass).toBe('constitutional');
    expect(rule.approvalClass).toBe('ordinary_majority');
    expect(rule.minQuorum).toBe(1);
    expect(rule.requiresWindowClose).toBe(false);
  });

  it('uses monetary activation guardian overrides even under an ordinary decision class', () => {
    const rule = resolveGovernanceExecutionThresholdRule({
      actionType: 'activate_monetary_policy',
      decisionClass: 'ordinary',
    });

    expect(rule.approvalClass).toBe('guardian_threshold');
    expect(rule.minApprovalShare).toBe(0.67);
    expect(rule.requiresWindowClose).toBe(true);
  });

  it('rejects stored threshold rows when approval share is out of range', () => {
    const base = serializeGovernanceExecutionThresholdRule(
      resolveGovernanceExecutionThresholdRule({
        actionType: 'manual_follow_through',
        decisionClass: 'ordinary',
      }),
    );

    expect(
      readGovernanceExecutionThresholdRuleFromMetadata({
        execution_threshold: { ...base, min_approval_share: 0 },
      }),
    ).toBeNull();
  });

  it('rejects non-object execution_threshold blobs', () => {
    expect(
      readGovernanceExecutionThresholdRuleFromMetadata({
        execution_threshold: [] as unknown as Record<string, never>,
      }),
    ).toBeNull();
  });
});
