import type { Json } from '@/integrations/supabase/types';

import {
  type GovernanceExecutionActionType,
  type GovernanceExecutionDraft,
  type GovernanceExecutionMetadata,
  type GovernanceProposalExecutionSpec,
  isActivationScopeType,
  isAppPermission,
  isAppRole,
  isGovernanceExecutionActionType,
  isGovernanceUnitMembershipRole,
  normalizeCountryCode,
} from './types';
import { getActionMetadataPayload } from './metadata-shared';

function getRequestedUnitKey(actionType: GovernanceExecutionActionType) {
  switch (actionType) {
    case 'grant_role_permission':
    case 'revoke_role_permission':
      return 'policy_legal' as const;
    case 'approve_identity_verification':
    case 'revoke_identity_verification':
      return 'identity_verification' as const;
    case 'activate_monetary_policy':
    case 'deactivate_monetary_policy':
      return 'treasury_finance' as const;
    case 'award_study_certification':
    case 'revoke_study_certification':
      return 'civic_operations' as const;
    case 'approve_content_item':
    case 'reject_content_item':
    case 'archive_content_item':
      return 'policy_legal' as const;
    case 'assign_unit_member':
    case 'deactivate_unit_member':
    case 'activate_citizen_scope':
    case 'deactivate_citizen_scope':
    case 'manual_follow_through':
    default:
      return 'civic_operations' as const;
  }
}

export function getGovernanceExecutionActionLabelKey(actionType: GovernanceExecutionActionType) {
  return `governanceHub.executionActions.${actionType}`;
}

export function getGovernanceUnitMembershipRoleLabelKey(role: 'lead' | 'member' | 'observer') {
  return `governanceHub.membershipRoles.${role}`;
}

export function getGovernanceProposalTypeForExecutionAction(actionType: GovernanceExecutionActionType) {
  switch (actionType) {
    case 'grant_role_permission':
    case 'revoke_role_permission':
      return 'role_permission_change';
    case 'assign_unit_member':
    case 'deactivate_unit_member':
      return 'unit_membership_change';
    case 'approve_identity_verification':
    case 'revoke_identity_verification':
      return 'verification_case_change';
    case 'activate_citizen_scope':
    case 'deactivate_citizen_scope':
      return 'citizen_activation_change';
    case 'activate_monetary_policy':
    case 'deactivate_monetary_policy':
      return 'monetary_policy_change';
    case 'award_study_certification':
    case 'revoke_study_certification':
      return 'study_certification_change';
    case 'approve_content_item':
    case 'reject_content_item':
    case 'archive_content_item':
      return 'content_review_change';
    case 'manual_follow_through':
    default:
      return 'citizen_proposal';
  }
}

export function buildGovernanceProposalExecutionMetadata(draft: GovernanceExecutionDraft): GovernanceExecutionMetadata {
  return {
    execution_action_type: draft.actionType,
    requested_unit_key: getRequestedUnitKey(draft.actionType),
    execution_payload: getActionMetadataPayload(draft),
  };
}

export function readGovernanceProposalExecutionSpec(metadata: Json | null | undefined): GovernanceProposalExecutionSpec {
  const normalized = ((metadata && typeof metadata === 'object' && !Array.isArray(metadata))
    ? metadata
    : {}) as GovernanceExecutionMetadata;
  const actionType = isGovernanceExecutionActionType(normalized.execution_action_type)
    ? normalized.execution_action_type
    : 'manual_follow_through';
  const payload = ((normalized.execution_payload && typeof normalized.execution_payload === 'object' && !Array.isArray(normalized.execution_payload))
    ? normalized.execution_payload
    : {}) as Record<string, unknown>;

  if ((actionType === 'grant_role_permission' || actionType === 'revoke_role_permission')
    && isAppRole(payload.role)
    && isAppPermission(payload.permission)) {
    return { actionType, autoExecutable: true, requestedUnitKey: 'policy_legal', role: payload.role, permission: payload.permission };
  }

  if ((actionType === 'assign_unit_member' || actionType === 'deactivate_unit_member')
    && typeof payload.target_unit_key === 'string'
    && typeof payload.profile_id === 'string') {
    return {
      actionType,
      autoExecutable: true,
      requestedUnitKey: 'civic_operations',
      targetUnitKey: payload.target_unit_key,
      profileId: payload.profile_id,
      membershipRole: isGovernanceUnitMembershipRole(payload.membership_role) ? payload.membership_role : 'member',
      notes: typeof payload.notes === 'string' ? payload.notes : null,
    };
  }

  if ((actionType === 'approve_identity_verification' || actionType === 'revoke_identity_verification')
    && typeof payload.profile_id === 'string') {
    return { actionType, autoExecutable: true, requestedUnitKey: 'identity_verification', profileId: payload.profile_id, notes: typeof payload.notes === 'string' ? payload.notes : null };
  }

  if ((actionType === 'activate_citizen_scope' || actionType === 'deactivate_citizen_scope')
    && typeof payload.profile_id === 'string'
    && isActivationScopeType(payload.scope_type)) {
    return {
      actionType,
      autoExecutable: true,
      requestedUnitKey: 'civic_operations',
      profileId: payload.profile_id,
      scopeType: payload.scope_type,
      countryCode: typeof payload.country_code === 'string' ? payload.country_code : '',
      notes: typeof payload.notes === 'string' ? payload.notes : null,
    };
  }

  if ((actionType === 'activate_monetary_policy' || actionType === 'deactivate_monetary_policy')
    && typeof payload.policy_profile_id === 'string') {
    return {
      actionType,
      autoExecutable: true,
      requestedUnitKey: 'treasury_finance',
      policyProfileId: payload.policy_profile_id,
      notes: typeof payload.notes === 'string' ? payload.notes : null,
    };
  }

  if ((actionType === 'award_study_certification' || actionType === 'revoke_study_certification')
    && typeof payload.profile_id === 'string'
    && typeof payload.certification_key === 'string') {
    return {
      actionType,
      autoExecutable: true,
      requestedUnitKey: 'civic_operations',
      profileId: payload.profile_id,
      certificationKey: payload.certification_key,
      notes: typeof payload.notes === 'string' ? payload.notes : null,
    };
  }

  if ((actionType === 'approve_content_item' || actionType === 'reject_content_item' || actionType === 'archive_content_item')
    && typeof payload.content_item_id === 'string'
    && typeof payload.review_status === 'string') {
    return {
      actionType,
      autoExecutable: true,
      requestedUnitKey: 'policy_legal',
      contentItemId: payload.content_item_id,
      reviewStatus: payload.review_status as 'approved' | 'rejected' | 'archived',
      notes: typeof payload.notes === 'string' ? payload.notes : null,
    };
  }

  return { actionType: 'manual_follow_through', autoExecutable: false, requestedUnitKey: 'civic_operations' };
}

export function describeGovernanceProposalExecution(spec: GovernanceProposalExecutionSpec) {
  switch (spec.actionType) {
    case 'grant_role_permission':
      return `Grant ${spec.permission} to the ${spec.role} role.`;
    case 'revoke_role_permission':
      return `Revoke ${spec.permission} from the ${spec.role} role.`;
    case 'assign_unit_member':
      return `Assign profile ${spec.profileId} to the ${spec.targetUnitKey} unit as ${spec.membershipRole}.`;
    case 'deactivate_unit_member':
      return `Deactivate profile ${spec.profileId} from the ${spec.targetUnitKey} unit.`;
    case 'approve_identity_verification':
      return `Approve the identity verification case for profile ${spec.profileId}.`;
    case 'revoke_identity_verification':
      return `Revoke the identity verification status for profile ${spec.profileId}.`;
    case 'activate_citizen_scope':
      return spec.scopeType === 'country'
        ? `Activate citizen scope for profile ${spec.profileId} in ${spec.countryCode}.`
        : `Activate world citizen scope for profile ${spec.profileId}.`;
    case 'deactivate_citizen_scope':
      return spec.scopeType === 'country'
        ? `Deactivate citizen scope for profile ${spec.profileId} in ${spec.countryCode}.`
        : `Deactivate world citizen scope for profile ${spec.profileId}.`;
    case 'activate_monetary_policy':
      return `Activate monetary policy profile ${spec.policyProfileId}.`;
    case 'deactivate_monetary_policy':
      return `Deactivate monetary policy profile ${spec.policyProfileId}.`;
    case 'award_study_certification':
      return `Award ${spec.certificationKey} certification to profile ${spec.profileId}.`;
    case 'revoke_study_certification':
      return `Revoke ${spec.certificationKey} certification from profile ${spec.profileId}.`;
    case 'approve_content_item':
      return `Approve content item ${spec.contentItemId}.`;
    case 'reject_content_item':
      return `Reject content item ${spec.contentItemId}.`;
    case 'archive_content_item':
      return `Archive content item ${spec.contentItemId}.`;
    case 'manual_follow_through':
    default:
      return 'Manual implementation follow-through is required.';
  }
}

export function validateGovernanceExecutionDraft(draft: GovernanceExecutionDraft) {
  switch (draft.actionType) {
    case 'grant_role_permission':
    case 'revoke_role_permission':
      return Boolean(draft.targetRole && draft.targetPermission);
    case 'assign_unit_member':
    case 'deactivate_unit_member':
      return Boolean(draft.targetUnitKey && draft.targetProfileId);
    case 'approve_identity_verification':
    case 'revoke_identity_verification':
      return Boolean(draft.targetProfileId);
    case 'activate_citizen_scope':
    case 'deactivate_citizen_scope':
      return Boolean(draft.targetProfileId && (draft.activationScopeType === 'world' || normalizeCountryCode(draft.activationScopeType, draft.activationCountryCode)));
    case 'activate_monetary_policy':
    case 'deactivate_monetary_policy':
      return Boolean(draft.policyProfileId);
    case 'award_study_certification':
    case 'revoke_study_certification':
      return Boolean(draft.targetProfileId && draft.studyCertificationKey.trim());
    case 'approve_content_item':
    case 'reject_content_item':
    case 'archive_content_item':
      return Boolean(draft.contentItemId);
    case 'manual_follow_through':
    default:
      return true;
  }
}
