import type { Database } from '@/integrations/supabase/types';

export type GuardianExternalSignerRow = Database['public']['Tables']['governance_guardian_external_signers']['Row'];
export type GuardianExternalSignatureRow = Database['public']['Tables']['governance_proposal_guardian_external_signatures']['Row'];
export type GuardianMultisigPolicyRow = Database['public']['Tables']['governance_guardian_multisig_policies']['Row'];

export interface GovernanceProposalExternalMultisigSummary {
  externalMultisigRequired: boolean;
  requiredExternalApprovals: number;
  activeExternalSignerCount: number;
  externalApprovalCount: number;
  externalRejectionCount: number;
  externalDecisiveCount: number;
  policyNetwork: string | null;
  policyContractReference: string | null;
}

export function isMissingGuardianMultisigBackend(error: { code?: string | null; message?: string | null; details?: string | null } | null) {
  if (!error) return false;
  const message = `${error.code || ''} ${error.message || ''} ${error.details || ''}`.toLowerCase();
  return (
    error.code === '42P01'
    || error.code === 'PGRST205'
    || error.code === 'PGRST202'
    || message.includes('governance_guardian_multisig')
    || message.includes('governance_guardian_external_signers')
    || message.includes('governance_proposal_guardian_external_signatures')
    || message.includes('governance_proposal_external_multisig_summary')
    || message.includes('current_profile_can_manage_guardian_multisig')
  );
}

function asNonNegativeInteger(value: unknown, fallback = 0) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

export function readGovernanceProposalExternalMultisigSummary(
  rows: Database['public']['Functions']['governance_proposal_external_multisig_summary']['Returns'] | null,
): GovernanceProposalExternalMultisigSummary | null {
  const row = rows?.[0];
  if (!row) return null;

  return {
    externalMultisigRequired: Boolean(row.external_multisig_required),
    requiredExternalApprovals: Math.max(1, asNonNegativeInteger(row.required_external_approvals, 1)),
    activeExternalSignerCount: asNonNegativeInteger(row.active_external_signer_count),
    externalApprovalCount: asNonNegativeInteger(row.external_approval_count),
    externalRejectionCount: asNonNegativeInteger(row.external_rejection_count),
    externalDecisiveCount: asNonNegativeInteger(row.external_decisive_count),
    policyNetwork: row.policy_network || null,
    policyContractReference: row.policy_contract_reference || null,
  };
}
