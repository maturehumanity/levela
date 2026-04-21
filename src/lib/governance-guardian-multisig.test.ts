import { describe, expect, it } from 'vitest';

import {
  isMissingGuardianMultisigBackend,
  readGovernanceProposalExternalMultisigSummary,
} from '@/lib/governance-guardian-multisig';

describe('governance guardian multisig helpers', () => {
  it('detects missing guardian multisig backend errors', () => {
    expect(
      isMissingGuardianMultisigBackend({
        code: 'PGRST202',
        message: 'Function governance_proposal_external_multisig_summary does not exist',
      }),
    ).toBe(true);

    expect(
      isMissingGuardianMultisigBackend({
        code: '22023',
        message: 'random error',
      }),
    ).toBe(false);
  });

  it('normalizes external multisig summary rows', () => {
    const summary = readGovernanceProposalExternalMultisigSummary([
      {
        active_external_signer_count: 3,
        external_approval_count: 2,
        external_decisive_count: 2,
        external_multisig_required: true,
        external_rejection_count: 0,
        policy_contract_reference: 'safe://chain/0xabc',
        policy_network: 'ethereum-mainnet',
        required_external_approvals: 2,
      },
    ]);

    expect(summary).toEqual({
      externalMultisigRequired: true,
      requiredExternalApprovals: 2,
      activeExternalSignerCount: 3,
      externalApprovalCount: 2,
      externalRejectionCount: 0,
      externalDecisiveCount: 2,
      policyNetwork: 'ethereum-mainnet',
      policyContractReference: 'safe://chain/0xabc',
    });
  });
});
