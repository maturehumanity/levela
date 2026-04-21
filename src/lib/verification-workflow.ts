import type { Database } from '@/integrations/supabase/types';

export type IdentityVerificationCaseStatus = Database['public']['Enums']['identity_verification_case_status'];
export type IdentityVerificationDecision = Database['public']['Enums']['identity_verification_decision'];

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
