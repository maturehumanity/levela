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
        code: 'PGRST202',
        message: 'Could not find the function public.current_profile_can_manage_guardian_multisig',
        details: null,
      }),
    ).toBe(true);

    expect(
      isMissingGuardianMultisigBackend({
        code: '42P01',
        message: 'relation "governance_guardian_external_signers" does not exist',
        details: null,
      }),
    ).toBe(true);

    expect(
      isMissingGuardianMultisigBackend({
        code: '42P01',
        message: 'relation "governance_guardian_multisig_policies" does not exist',
        details: null,
      }),
    ).toBe(true);

    expect(isMissingGuardianMultisigBackend(null)).toBe(false);

    expect(
      isMissingGuardianMultisigBackend({
        code: '22023',
        message: 'random error',
      }),
    ).toBe(false);

    expect(
      isMissingGuardianMultisigBackend({
        code: 'PGRST205',
        message: 'Could not find the table public.governance_proposal_guardian_external_signatures in the schema cache',
        details: null,
      }),
    ).toBe(true);
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

  it('returns null when the multisig summary RPC yields no rows', () => {
    expect(readGovernanceProposalExternalMultisigSummary(null)).toBeNull();
    expect(readGovernanceProposalExternalMultisigSummary([])).toBeNull();
  });
});
