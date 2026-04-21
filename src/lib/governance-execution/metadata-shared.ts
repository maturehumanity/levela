import type { GovernanceExecutionDraft, GovernanceExecutionMetadata } from './types';
import { isAppPermission, isAppRole, normalizeCountryCode } from './types';

export function getActionMetadataPayload(draft: GovernanceExecutionDraft): GovernanceExecutionMetadata['execution_payload'] {
  switch (draft.actionType) {
    case 'grant_role_permission':
    case 'revoke_role_permission':
      return isAppRole(draft.targetRole) && isAppPermission(draft.targetPermission)
        ? {
            role: draft.targetRole,
            permission: draft.targetPermission,
          }
        : {};
    case 'assign_unit_member':
    case 'deactivate_unit_member':
      return {
        target_unit_key: draft.targetUnitKey,
        profile_id: draft.targetProfileId,
        membership_role: draft.membershipRole,
        notes: draft.notes.trim() || undefined,
      };
    case 'approve_identity_verification':
    case 'revoke_identity_verification':
      return {
        profile_id: draft.targetProfileId,
        notes: draft.notes.trim() || undefined,
      };
    case 'activate_citizen_scope':
    case 'deactivate_citizen_scope':
      return {
        profile_id: draft.targetProfileId,
        scope_type: draft.activationScopeType,
        country_code: normalizeCountryCode(draft.activationScopeType, draft.activationCountryCode),
        notes: draft.notes.trim() || undefined,
      };
    case 'activate_monetary_policy':
    case 'deactivate_monetary_policy':
      return {
        policy_profile_id: draft.policyProfileId,
        notes: draft.notes.trim() || undefined,
      };
    case 'award_study_certification':
    case 'revoke_study_certification':
      return {
        profile_id: draft.targetProfileId,
        certification_key: draft.studyCertificationKey,
        notes: draft.notes.trim() || undefined,
      };
    case 'approve_content_item':
      return {
        content_item_id: draft.contentItemId,
        review_status: 'approved',
        notes: draft.notes.trim() || undefined,
      };
    case 'reject_content_item':
      return {
        content_item_id: draft.contentItemId,
        review_status: 'rejected',
        notes: draft.notes.trim() || undefined,
      };
    case 'archive_content_item':
      return {
        content_item_id: draft.contentItemId,
        review_status: 'archived',
        notes: draft.notes.trim() || undefined,
      };
    case 'manual_follow_through':
    default:
      return {};
  }
}
