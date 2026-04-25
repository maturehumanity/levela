import type { Database } from '@/integrations/supabase/types';

export type IdentityVerificationCaseStatus = Database['public']['Enums']['identity_verification_case_status'];
export type IdentityVerificationDecision = Database['public']['Enums']['identity_verification_decision'];

export type GovernanceHubIdentityVerificationCasePick = Pick<
  Database['public']['Tables']['identity_verification_cases']['Row'],
  'status' | 'personal_info_completed' | 'contact_info_completed' | 'live_verification_completed'
>;

export type GovernanceHubIdentityVerificationPresentation = {
  badgeStatus: IdentityVerificationCaseStatus;
  /** When set, prefer this hub-specific label over `getVerificationCaseStatusLabelKey`. */
  badgeLabelKey?: string;
  bodyKey: string;
  checklistKeys: string[];
  ctaLabelKey: string;
};

export function resolveGovernanceHubIdentityVerificationPresentation(args: {
  isVerified: boolean;
  caseRow: GovernanceHubIdentityVerificationCasePick | null;
}): GovernanceHubIdentityVerificationPresentation {
  const { isVerified, caseRow } = args;

  if (isVerified) {
    return {
      badgeStatus: 'approved',
      badgeLabelKey: 'governanceHub.identityVerification.badgeVerified',
      bodyKey: 'governanceHub.identityVerification.verifiedBody',
      checklistKeys: [],
      ctaLabelKey: 'governanceHub.identityVerification.ctaReviewProfile',
    };
  }

  if (!caseRow) {
    return {
      badgeStatus: 'draft',
      badgeLabelKey: 'governanceHub.identityVerification.badgeNotStarted',
      bodyKey: 'governanceHub.identityVerification.noCaseBody',
      checklistKeys: [],
      ctaLabelKey: 'governanceHub.identityVerification.ctaStartInProfile',
    };
  }

  const { status, personal_info_completed, contact_info_completed, live_verification_completed } = caseRow;

  if (status === 'approved') {
    return {
      badgeStatus: 'in_review',
      badgeLabelKey: 'governanceHub.identityVerification.badgeFinishingUp',
      bodyKey: 'governanceHub.identityVerification.approvedPendingProfileBody',
      checklistKeys: [],
      ctaLabelKey: 'governanceHub.identityVerification.ctaViewStatusInProfile',
    };
  }

  if (status === 'draft') {
    const checklistKeys: string[] = [];
    if (!personal_info_completed) {
      checklistKeys.push('governanceHub.identityVerification.checklist.personal');
    }
    if (!contact_info_completed) {
      checklistKeys.push('governanceHub.identityVerification.checklist.contact');
    }
    if (!live_verification_completed) {
      checklistKeys.push('governanceHub.identityVerification.checklist.live');
    }

    return {
      badgeStatus: 'draft',
      bodyKey: checklistKeys.length
        ? 'governanceHub.identityVerification.draftIncompleteBody'
        : 'governanceHub.identityVerification.draftReadyBody',
      checklistKeys,
      ctaLabelKey: 'governanceHub.identityVerification.ctaContinueInProfile',
    };
  }

  if (status === 'submitted' || status === 'in_review') {
    return {
      badgeStatus: status,
      bodyKey: 'governanceHub.identityVerification.underReviewBody',
      checklistKeys: [],
      ctaLabelKey: 'governanceHub.identityVerification.ctaViewStatusInProfile',
    };
  }

  if (status === 'rejected') {
    return {
      badgeStatus: 'rejected',
      bodyKey: 'governanceHub.identityVerification.rejectedBody',
      checklistKeys: [],
      ctaLabelKey: 'governanceHub.identityVerification.ctaReviewInProfile',
    };
  }

  if (status === 'revoked') {
    return {
      badgeStatus: 'revoked',
      bodyKey: 'governanceHub.identityVerification.revokedBody',
      checklistKeys: [],
      ctaLabelKey: 'governanceHub.identityVerification.ctaReviewInProfile',
    };
  }

  return {
    badgeStatus: status,
    bodyKey: 'governanceHub.identityVerification.genericBody',
    checklistKeys: [],
    ctaLabelKey: 'governanceHub.identityVerification.ctaReviewProfile',
  };
}

export function getVerificationCaseStatusLabelKey(status: IdentityVerificationCaseStatus) {
  switch (status) {
    case 'submitted':
      return 'admin.users.verificationCaseStatuses.submitted';
    case 'in_review':
      return 'admin.users.verificationCaseStatuses.in_review';
    case 'approved':
      return 'admin.users.verificationCaseStatuses.approved';
    case 'rejected':
      return 'admin.users.verificationCaseStatuses.rejected';
    case 'revoked':
      return 'admin.users.verificationCaseStatuses.revoked';
    case 'draft':
    default:
      return 'admin.users.verificationCaseStatuses.draft';
  }
}

export function getVerificationCaseBadgeClassName(status: IdentityVerificationCaseStatus) {
  switch (status) {
    case 'approved':
      return 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300';
    case 'submitted':
    case 'in_review':
      return 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300';
    case 'rejected':
    case 'revoked':
      return 'border-destructive/20 bg-destructive/10 text-destructive';
    case 'draft':
    default:
      return 'border-border bg-muted text-muted-foreground';
  }
}

export function getAdminVerificationDecision(nextVerified: boolean): IdentityVerificationDecision {
  return nextVerified ? 'approved' : 'revoked';
}
