import { describe, expect, it } from 'vitest';

import { emptyGovernanceExecutionDraft } from '@/lib/governance-execution';

import { createEmptyGovernanceProposalDraft } from './governance-proposal-draft';

describe('governance-proposal-draft', () => {
  it('creates an empty draft with ordinary class and the shared execution template', () => {
    expect(createEmptyGovernanceProposalDraft()).toEqual({
      title: '',
      summary: '',
      body: '',
      decisionClass: 'ordinary',
      execution: {
        ...emptyGovernanceExecutionDraft,
      },
    });
  });

  it('returns a fresh execution object each time', () => {
    const a = createEmptyGovernanceProposalDraft();
    const b = createEmptyGovernanceProposalDraft();
    expect(a.execution).not.toBe(b.execution);
    expect(a.execution).toEqual(b.execution);
  });
});
