import { describe, expect, it } from 'vitest';

import {
  buildGovernanceProposalExecutionMetadata,
  describeGovernanceProposalExecution,
  readGovernanceProposalExecutionSpec,
  validateGovernanceExecutionDraft,
} from './governance-execution';

describe('governance-execution', () => {
  it('builds and reads a role permission execution spec', () => {
    const metadata = buildGovernanceProposalExecutionMetadata({
      actionType: 'grant_role_permission',
      targetRole: 'moderator',
      targetPermission: 'law.review',
      targetUnitKey: '',
      targetProfileId: '',
      membershipRole: 'member',
      activationScopeType: 'world',
      activationCountryCode: '',
      notes: '',
      policyProfileId: '',
      studyCertificationKey: '',
      contentItemId: '',
    });

    const spec = readGovernanceProposalExecutionSpec(metadata);

    expect(spec).toMatchObject({
      actionType: 'grant_role_permission',
      autoExecutable: true,
      role: 'moderator',
      permission: 'law.review',
      requestedUnitKey: 'policy_legal',
    });
  });

  it('builds and reads a unit membership execution spec', () => {
    const metadata = buildGovernanceProposalExecutionMetadata({
      actionType: 'assign_unit_member',
      targetRole: '',
      targetPermission: '',
      targetUnitKey: 'security_response',
      targetProfileId: 'profile-123',
      membershipRole: 'lead',
      activationScopeType: 'world',
      activationCountryCode: '',
      notes: 'Emergency rotation',
      policyProfileId: '',
      studyCertificationKey: '',
      contentItemId: '',
    });

    const spec = readGovernanceProposalExecutionSpec(metadata);

    expect(spec).toMatchObject({
      actionType: 'assign_unit_member',
      autoExecutable: true,
      targetUnitKey: 'security_response',
      profileId: 'profile-123',
      membershipRole: 'lead',
      requestedUnitKey: 'civic_operations',
    });
  });

  it('falls back to manual follow-through when metadata is incomplete', () => {
    const spec = readGovernanceProposalExecutionSpec({
      execution_action_type: 'grant_role_permission',
      execution_payload: {
        role: 'moderator',
      },
    });

    expect(spec).toMatchObject({
      actionType: 'manual_follow_through',
      autoExecutable: false,
    });
  });

  it('validates draft requirements per action type', () => {
    expect(
      validateGovernanceExecutionDraft({
        actionType: 'grant_role_permission',
        targetRole: 'moderator',
        targetPermission: 'law.review',
        targetUnitKey: '',
        targetProfileId: '',
        membershipRole: 'member',
        activationScopeType: 'world',
        activationCountryCode: '',
        notes: '',
        policyProfileId: '',
        studyCertificationKey: '',
        contentItemId: '',
      }),
    ).toBe(true);

    expect(
      validateGovernanceExecutionDraft({
        actionType: 'assign_unit_member',
        targetRole: '',
        targetPermission: '',
        targetUnitKey: 'technical_stewardship',
        targetProfileId: '',
        membershipRole: 'member',
        activationScopeType: 'world',
        activationCountryCode: '',
        notes: '',
        policyProfileId: '',
        studyCertificationKey: '',
        contentItemId: '',
      }),
    ).toBe(false);
  });

  it('builds and reads an identity verification execution spec', () => {
    const metadata = buildGovernanceProposalExecutionMetadata({
      actionType: 'approve_identity_verification',
      targetRole: '',
      targetPermission: '',
      targetUnitKey: '',
      targetProfileId: 'profile-999',
      membershipRole: 'member',
      activationScopeType: 'world',
      activationCountryCode: '',
      notes: 'Approved after live review',
      policyProfileId: '',
      studyCertificationKey: '',
      contentItemId: '',
    });

    const spec = readGovernanceProposalExecutionSpec(metadata);

    expect(spec).toMatchObject({
      actionType: 'approve_identity_verification',
      autoExecutable: true,
      profileId: 'profile-999',
      requestedUnitKey: 'identity_verification',
    });
  });

  it('requires a country code for country activation drafts', () => {
    expect(
      validateGovernanceExecutionDraft({
        actionType: 'activate_citizen_scope',
        targetRole: '',
        targetPermission: '',
        targetUnitKey: '',
        targetProfileId: 'profile-321',
        membershipRole: 'member',
        activationScopeType: 'country',
        activationCountryCode: '',
        notes: '',
        policyProfileId: '',
        studyCertificationKey: '',
        contentItemId: '',
      }),
    ).toBe(false);
  });

  it('builds and reads a study certification execution spec', () => {
    const metadata = buildGovernanceProposalExecutionMetadata({
      actionType: 'award_study_certification',
      targetRole: '',
      targetPermission: '',
      targetUnitKey: '',
      targetProfileId: 'profile-abc',
      membershipRole: 'member',
      activationScopeType: 'world',
      activationCountryCode: '',
      notes: 'Foundations complete',
      policyProfileId: '',
      studyCertificationKey: 'civic_foundations',
      contentItemId: '',
    });

    const spec = readGovernanceProposalExecutionSpec(metadata);
    expect(spec).toMatchObject({
      actionType: 'award_study_certification',
      autoExecutable: true,
      profileId: 'profile-abc',
      certificationKey: 'civic_foundations',
      requestedUnitKey: 'civic_operations',
    });
  });

  it('builds and reads a content review execution spec', () => {
    const metadata = buildGovernanceProposalExecutionMetadata({
      actionType: 'approve_content_item',
      targetRole: '',
      targetPermission: '',
      targetUnitKey: '',
      targetProfileId: '',
      membershipRole: 'member',
      activationScopeType: 'world',
      activationCountryCode: '',
      notes: 'Publication approved',
      policyProfileId: '',
      studyCertificationKey: '',
      contentItemId: 'content-777',
    });

    const spec = readGovernanceProposalExecutionSpec(metadata);
    expect(spec).toMatchObject({
      actionType: 'approve_content_item',
      autoExecutable: true,
      contentItemId: 'content-777',
      reviewStatus: 'approved',
      requestedUnitKey: 'policy_legal',
    });
  });

  it('describes execution plans in plain language', () => {
    expect(
      describeGovernanceProposalExecution({
        actionType: 'revoke_role_permission',
        autoExecutable: true,
        requestedUnitKey: 'policy_legal',
        role: 'member',
        permission: 'law.contribute',
      }),
    ).toContain('Revoke law.contribute from the member role.');
  });
});
