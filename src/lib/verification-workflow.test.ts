import { describe, expect, it } from 'vitest';

import {
  getAdminVerificationDecision,
  getVerificationCaseBadgeClassName,
  getVerificationCaseStatusLabelKey,
  resolveGovernanceHubIdentityVerificationPresentation,
  type IdentityVerificationCaseStatus,
} from '@/lib/verification-workflow';

describe('verification-workflow', () => {
  it('maps each case status to an admin label key', () => {
    const cases = [
      ['draft', 'admin.users.verificationCaseStatuses.draft'],
      ['submitted', 'admin.users.verificationCaseStatuses.submitted'],
      ['in_review', 'admin.users.verificationCaseStatuses.in_review'],
      ['approved', 'admin.users.verificationCaseStatuses.approved'],
      ['rejected', 'admin.users.verificationCaseStatuses.rejected'],
      ['revoked', 'admin.users.verificationCaseStatuses.revoked'],
    ] as const;

    for (const [status, key] of cases) {
      expect(getVerificationCaseStatusLabelKey(status)).toBe(key);
    }
  });

  it('falls back to draft label for unknown status values', () => {
    expect(getVerificationCaseStatusLabelKey('__unknown__' as IdentityVerificationCaseStatus)).toBe(
      'admin.users.verificationCaseStatuses.draft',
    );
  });

  it('returns distinct badge classes for approved, in-flight, negative, and draft states', () => {
    const approved = getVerificationCaseBadgeClassName('approved');
    const inFlight = getVerificationCaseBadgeClassName('in_review');
    const negative = getVerificationCaseBadgeClassName('rejected');
    const draft = getVerificationCaseBadgeClassName('draft');

    expect(approved).toContain('sky');
    expect(inFlight).toContain('amber');
    expect(negative).toContain('destructive');
    expect(draft).toContain('muted');
    expect(new Set([approved, inFlight, negative, draft]).size).toBe(4);
  });

  it('treats submitted like in_review for badge styling', () => {
    expect(getVerificationCaseBadgeClassName('submitted')).toBe(getVerificationCaseBadgeClassName('in_review'));
  });

  it('maps admin verification decision from target verified flag', () => {
    expect(getAdminVerificationDecision(true)).toBe('approved');
    expect(getAdminVerificationDecision(false)).toBe('revoked');
  });

  describe('resolveGovernanceHubIdentityVerificationPresentation', () => {
    it('treats verified profiles as the success path regardless of stored case', () => {
      const presentation = resolveGovernanceHubIdentityVerificationPresentation({
        isVerified: true,
        caseRow: {
          status: 'draft',
          personal_info_completed: false,
          contact_info_completed: false,
          live_verification_completed: false,
        },
      });

      expect(presentation.badgeStatus).toBe('approved');
      expect(presentation.badgeLabelKey).toBe('governanceHub.identityVerification.badgeVerified');
      expect(presentation.bodyKey).toBe('governanceHub.identityVerification.verifiedBody');
      expect(presentation.checklistKeys).toEqual([]);
    });

    it('describes a missing case for unverified members', () => {
      const presentation = resolveGovernanceHubIdentityVerificationPresentation({
        isVerified: false,
        caseRow: null,
      });

      expect(presentation.badgeLabelKey).toBe('governanceHub.identityVerification.badgeNotStarted');
      expect(presentation.bodyKey).toBe('governanceHub.identityVerification.noCaseBody');
    });

    it('lists incomplete draft checklist items in stable order', () => {
      const presentation = resolveGovernanceHubIdentityVerificationPresentation({
        isVerified: false,
        caseRow: {
          status: 'draft',
          personal_info_completed: false,
          contact_info_completed: true,
          live_verification_completed: false,
        },
      });

      expect(presentation.bodyKey).toBe('governanceHub.identityVerification.draftIncompleteBody');
      expect(presentation.checklistKeys).toEqual([
        'governanceHub.identityVerification.checklist.personal',
        'governanceHub.identityVerification.checklist.live',
      ]);
    });

    it('flags approved cases that are still syncing to the public profile', () => {
      const presentation = resolveGovernanceHubIdentityVerificationPresentation({
        isVerified: false,
        caseRow: {
          status: 'approved',
          personal_info_completed: true,
          contact_info_completed: true,
          live_verification_completed: true,
        },
      });

      expect(presentation.badgeStatus).toBe('in_review');
      expect(presentation.badgeLabelKey).toBe('governanceHub.identityVerification.badgeFinishingUp');
      expect(presentation.bodyKey).toBe('governanceHub.identityVerification.approvedPendingProfileBody');
    });

    it('maps reviewer queue states to the shared under-review copy', () => {
      for (const status of ['submitted', 'in_review'] as const) {
        const presentation = resolveGovernanceHubIdentityVerificationPresentation({
          isVerified: false,
          caseRow: {
            status,
            personal_info_completed: true,
            contact_info_completed: true,
            live_verification_completed: true,
          },
        });

        expect(presentation.badgeStatus).toBe(status);
        expect(presentation.bodyKey).toBe('governanceHub.identityVerification.underReviewBody');
      }
    });
  });
});
