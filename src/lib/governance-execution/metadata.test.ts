import { describe, expect, it } from 'vitest';

import type { Json } from '@/integrations/supabase/types';

import {
  buildGovernanceProposalExecutionMetadata,
  describeGovernanceProposalExecution,
  getGovernanceExecutionActionLabelKey,
  getGovernanceProposalTypeForExecutionAction,
  getGovernanceUnitMembershipRoleLabelKey,
  readGovernanceProposalExecutionSpec,
  validateGovernanceExecutionDraft,
} from './metadata';
import {
  GOVERNANCE_EXECUTION_ACTION_TYPES,
  emptyGovernanceExecutionDraft,
  type GovernanceExecutionActionType,
} from './types';

const expectedProposalType: Record<GovernanceExecutionActionType, string> = {
  manual_follow_through: 'citizen_proposal',
  grant_role_permission: 'role_permission_change',
  revoke_role_permission: 'role_permission_change',
  assign_unit_member: 'unit_membership_change',
  deactivate_unit_member: 'unit_membership_change',
  approve_identity_verification: 'verification_case_change',
  revoke_identity_verification: 'verification_case_change',
  activate_citizen_scope: 'citizen_activation_change',
  deactivate_citizen_scope: 'citizen_activation_change',
  activate_monetary_policy: 'monetary_policy_change',
  deactivate_monetary_policy: 'monetary_policy_change',
  award_study_certification: 'study_certification_change',
  revoke_study_certification: 'study_certification_change',
  approve_content_item: 'content_review_change',
  reject_content_item: 'content_review_change',
  archive_content_item: 'content_review_change',
};

describe('governance-execution metadata helpers', () => {
  it('maps every execution action type to a governance proposal type', () => {
    for (const actionType of GOVERNANCE_EXECUTION_ACTION_TYPES) {
      expect(getGovernanceProposalTypeForExecutionAction(actionType)).toBe(expectedProposalType[actionType]);
    }
  });

  it('uses stable i18n label keys for execution actions', () => {
    expect(getGovernanceExecutionActionLabelKey('activate_monetary_policy')).toBe(
      'governanceHub.executionActions.activate_monetary_policy',
    );
  });

  it('uses stable i18n label keys for unit membership roles', () => {
    expect(getGovernanceUnitMembershipRoleLabelKey('lead')).toBe('governanceHub.membershipRoles.lead');
    expect(getGovernanceUnitMembershipRoleLabelKey('observer')).toBe('governanceHub.membershipRoles.observer');
  });

  it('builds metadata with requested_unit_key derived from the action', () => {
    const meta = buildGovernanceProposalExecutionMetadata({
      ...emptyGovernanceExecutionDraft,
      actionType: 'approve_identity_verification',
      targetProfileId: 'profile-77',
      notes: 'Ready',
    });

    expect(meta).toMatchObject({
      execution_action_type: 'approve_identity_verification',
      requested_unit_key: 'identity_verification',
      execution_payload: {
        profile_id: 'profile-77',
        notes: 'Ready',
      },
    });
  });

  it('routes monetary actions to the treasury unit key', () => {
    const meta = buildGovernanceProposalExecutionMetadata({
      ...emptyGovernanceExecutionDraft,
      actionType: 'deactivate_monetary_policy',
      policyProfileId: 'pol-1',
      notes: '',
    });

    expect(meta.requested_unit_key).toBe('treasury_finance');
  });
});

describe('readGovernanceProposalExecutionSpec', () => {
  it('treats null, arrays, and invalid action types as manual follow-through', () => {
    expect(readGovernanceProposalExecutionSpec(null)).toMatchObject({
      actionType: 'manual_follow_through',
      autoExecutable: false,
    });

    expect(readGovernanceProposalExecutionSpec([] as unknown as Json)).toMatchObject({
      actionType: 'manual_follow_through',
    });

    expect(
      readGovernanceProposalExecutionSpec({
        execution_action_type: 'not_a_real_action',
        execution_payload: { role: 'moderator', permission: 'law.review' },
      }),
    ).toMatchObject({ actionType: 'manual_follow_through', autoExecutable: false });
  });

  it('defaults unknown unit membership roles to member when profile fields are present', () => {
    const spec = readGovernanceProposalExecutionSpec({
      execution_action_type: 'assign_unit_member',
      execution_payload: {
        target_unit_key: 'security_response',
        profile_id: 'profile-1',
        membership_role: 'not_valid',
      },
    });

    expect(spec).toMatchObject({
      actionType: 'assign_unit_member',
      membershipRole: 'member',
      profileId: 'profile-1',
      targetUnitKey: 'security_response',
    });
  });

  it('requires activation scope_type to match known scopes', () => {
    const spec = readGovernanceProposalExecutionSpec({
      execution_action_type: 'activate_citizen_scope',
      execution_payload: {
        profile_id: 'profile-2',
        scope_type: 'galaxy',
        country_code: '',
      },
    });

    expect(spec).toMatchObject({ actionType: 'manual_follow_through' });
  });
});

describe('describeGovernanceProposalExecution', () => {
  it('summarizes citizen scope actions for country vs world', () => {
    expect(
      describeGovernanceProposalExecution({
        actionType: 'activate_citizen_scope',
        autoExecutable: true,
        requestedUnitKey: 'civic_operations',
        profileId: 'p1',
        scopeType: 'country',
        countryCode: 'NO',
        notes: null,
      }),
    ).toContain('NO');

    expect(
      describeGovernanceProposalExecution({
        actionType: 'deactivate_citizen_scope',
        autoExecutable: true,
        requestedUnitKey: 'civic_operations',
        profileId: 'p1',
        scopeType: 'world',
        countryCode: '',
        notes: null,
      }),
    ).toContain('world citizen scope');
  });
});

describe('validateGovernanceExecutionDraft', () => {
  it('rejects study certification drafts with a blank certification key', () => {
    expect(
      validateGovernanceExecutionDraft({
        ...emptyGovernanceExecutionDraft,
        actionType: 'award_study_certification',
        targetProfileId: 'profile-1',
        studyCertificationKey: '   ',
      }),
    ).toBe(false);
  });

  it('accepts monetary policy drafts when a policy profile id is set', () => {
    expect(
      validateGovernanceExecutionDraft({
        ...emptyGovernanceExecutionDraft,
        actionType: 'activate_monetary_policy',
        policyProfileId: 'pol-42',
      }),
    ).toBe(true);
  });
});
