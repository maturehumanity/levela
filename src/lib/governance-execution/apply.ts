import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/integrations/supabase/types';

import { applyRolePermissionExecution, applyUnitMembershipExecution } from './apply-access';
import { applyActivationScopeExecution, applyVerificationExecution } from './apply-civic';
import { applyContentReviewExecution, applyMonetaryPolicyExecution, applyStudyCertificationExecution } from './apply-policy';
import type {
  GovernanceExecutionApplyResult,
  GovernanceExecutionUnitRow,
  GovernanceProposalExecutionSpec,
} from './types';

export async function applyGovernanceProposalExecution(args: {
  client: SupabaseClient<Database>;
  spec: GovernanceProposalExecutionSpec;
  actorId: string | null;
  unitsByKey: Record<string, GovernanceExecutionUnitRow>;
}): Promise<GovernanceExecutionApplyResult> {
  switch (args.spec.actionType) {
    case 'grant_role_permission':
    case 'revoke_role_permission':
      return applyRolePermissionExecution({ client: args.client, spec: args.spec });
    case 'assign_unit_member':
    case 'deactivate_unit_member':
      return applyUnitMembershipExecution({ client: args.client, actorId: args.actorId, unitsByKey: args.unitsByKey, spec: args.spec });
    case 'approve_identity_verification':
    case 'revoke_identity_verification':
      return applyVerificationExecution({ client: args.client, actorId: args.actorId, spec: args.spec });
    case 'activate_citizen_scope':
    case 'deactivate_citizen_scope':
      return applyActivationScopeExecution({ client: args.client, actorId: args.actorId, spec: args.spec });
    case 'activate_monetary_policy':
    case 'deactivate_monetary_policy':
      return applyMonetaryPolicyExecution({ client: args.client, actorId: args.actorId, spec: args.spec });
    case 'award_study_certification':
    case 'revoke_study_certification':
      return applyStudyCertificationExecution({ client: args.client, spec: args.spec });
    case 'approve_content_item':
    case 'reject_content_item':
    case 'archive_content_item':
      return applyContentReviewExecution({ client: args.client, actorId: args.actorId, spec: args.spec });
    case 'manual_follow_through':
    default:
      return {
        status: 'blocked',
        summary: 'This implementation requires manual follow-through and cannot be auto-executed yet.',
        details: { action_type: args.spec.actionType },
      };
  }
}
