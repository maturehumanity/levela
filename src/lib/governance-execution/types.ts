import type { Database } from '@/integrations/supabase/types';
import { APP_PERMISSIONS, APP_ROLES, type AppPermission, type AppRole } from '@/lib/access-control';

export const GOVERNANCE_EXECUTION_ACTION_TYPES = [
  'manual_follow_through',
  'grant_role_permission',
  'revoke_role_permission',
  'assign_unit_member',
  'deactivate_unit_member',
  'approve_identity_verification',
  'revoke_identity_verification',
  'activate_citizen_scope',
  'deactivate_citizen_scope',
  'activate_monetary_policy',
  'deactivate_monetary_policy',
  'award_study_certification',
  'revoke_study_certification',
  'approve_content_item',
  'reject_content_item',
  'archive_content_item',
] as const;

export type GovernanceExecutionActionType = (typeof GOVERNANCE_EXECUTION_ACTION_TYPES)[number];
export type GovernanceUnitMembershipRole = Database['public']['Enums']['governance_unit_membership_role'];
export type ActivationScopeType = Database['public']['Enums']['activation_scope_type'];
export type GovernanceExecutionUnitRow = Database['public']['Tables']['governance_execution_units']['Row'];

type GovernanceExecutionPayload =
  | Record<string, never>
  | { role: AppRole; permission: AppPermission }
  | {
      target_unit_key: string;
      profile_id: string;
      membership_role: GovernanceUnitMembershipRole;
      notes?: string;
    }
  | { profile_id: string; notes?: string }
  | {
      profile_id: string;
      scope_type: ActivationScopeType;
      country_code?: string;
      notes?: string;
    }
  | {
      policy_profile_id: string;
      notes?: string;
    }
  | {
      profile_id: string;
      certification_key: string;
      notes?: string;
    }
  | {
      content_item_id: string;
      review_status: Database['public']['Enums']['content_review_status'];
      notes?: string;
    };

export type GovernanceExecutionMetadata = {
  execution_action_type?: GovernanceExecutionActionType;
  execution_payload?: GovernanceExecutionPayload;
  requested_unit_key?: string;
};

export type GovernanceProposalExecutionSpec =
  | {
      actionType: 'manual_follow_through';
      autoExecutable: false;
      requestedUnitKey: 'civic_operations';
    }
  | {
      actionType: 'grant_role_permission' | 'revoke_role_permission';
      autoExecutable: true;
      requestedUnitKey: 'policy_legal';
      role: AppRole;
      permission: AppPermission;
    }
  | {
      actionType: 'assign_unit_member' | 'deactivate_unit_member';
      autoExecutable: true;
      requestedUnitKey: 'civic_operations';
      targetUnitKey: string;
      profileId: string;
      membershipRole: GovernanceUnitMembershipRole;
      notes: string | null;
    }
  | {
      actionType: 'approve_identity_verification' | 'revoke_identity_verification';
      autoExecutable: true;
      requestedUnitKey: 'identity_verification';
      profileId: string;
      notes: string | null;
    }
  | {
      actionType: 'activate_citizen_scope' | 'deactivate_citizen_scope';
      autoExecutable: true;
      requestedUnitKey: 'civic_operations';
      profileId: string;
      scopeType: ActivationScopeType;
      countryCode: string;
      notes: string | null;
    }
  | {
      actionType: 'activate_monetary_policy' | 'deactivate_monetary_policy';
      autoExecutable: true;
      requestedUnitKey: 'treasury_finance';
      policyProfileId: string;
      notes: string | null;
    }
  | {
      actionType: 'award_study_certification' | 'revoke_study_certification';
      autoExecutable: true;
      requestedUnitKey: 'civic_operations';
      profileId: string;
      certificationKey: string;
      notes: string | null;
    }
  | {
      actionType: 'approve_content_item' | 'reject_content_item' | 'archive_content_item';
      autoExecutable: true;
      requestedUnitKey: 'policy_legal';
      contentItemId: string;
      reviewStatus: Database['public']['Enums']['content_review_status'];
      notes: string | null;
    };

export type GovernanceExecutionDraft = {
  actionType: GovernanceExecutionActionType;
  targetRole: AppRole | '';
  targetPermission: AppPermission | '';
  targetUnitKey: string;
  targetProfileId: string;
  membershipRole: GovernanceUnitMembershipRole;
  activationScopeType: ActivationScopeType;
  activationCountryCode: string;
  policyProfileId: string;
  studyCertificationKey: string;
  contentItemId: string;
  notes: string;
};

export type GovernanceExecutionApplyResult = {
  status: Database['public']['Enums']['governance_implementation_status'];
  summary: string;
  details: Database['public']['Tables']['governance_proposal_implementations']['Row']['metadata'];
};

export const emptyGovernanceExecutionDraft: GovernanceExecutionDraft = {
  actionType: 'manual_follow_through',
  targetRole: '',
  targetPermission: '',
  targetUnitKey: '',
  targetProfileId: '',
  membershipRole: 'member',
  activationScopeType: 'world',
  activationCountryCode: '',
  policyProfileId: '',
  studyCertificationKey: '',
  contentItemId: '',
  notes: '',
};

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === 'string' && APP_ROLES.includes(value as AppRole);
}

export function isAppPermission(value: unknown): value is AppPermission {
  return typeof value === 'string' && APP_PERMISSIONS.includes(value as AppPermission);
}

export function isGovernanceExecutionActionType(value: unknown): value is GovernanceExecutionActionType {
  return typeof value === 'string' && GOVERNANCE_EXECUTION_ACTION_TYPES.includes(value as GovernanceExecutionActionType);
}

export function isGovernanceUnitMembershipRole(value: unknown): value is GovernanceUnitMembershipRole {
  return value === 'lead' || value === 'member' || value === 'observer';
}

export function isActivationScopeType(value: unknown): value is ActivationScopeType {
  return value === 'world' || value === 'country';
}

export function normalizeCountryCode(scopeType: ActivationScopeType, countryCode: string) {
  return scopeType === 'country' ? countryCode.trim().toUpperCase() : '';
}
