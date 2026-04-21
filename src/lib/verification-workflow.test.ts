import { describe, expect, it } from 'vitest';

import {
  getAdminVerificationDecision,
  getVerificationCaseBadgeClassName,
  getVerificationCaseStatusLabelKey,
} from './verification-workflow';

describe('verification-workflow', () => {
  it('maps verification statuses to translation keys', () => {
    expect(getVerificationCaseStatusLabelKey('draft')).toBe('admin.users.verificationCaseStatuses.draft');
    expect(getVerificationCaseStatusLabelKey('approved')).toBe('admin.users.verificationCaseStatuses.approved');
    expect(getVerificationCaseStatusLabelKey('revoked')).toBe('admin.users.verificationCaseStatuses.revoked');
  });

  it('returns distinct badge tones for approved and revoked states', () => {
    expect(getVerificationCaseBadgeClassName('approved')).toContain('sky');
    expect(getVerificationCaseBadgeClassName('revoked')).toContain('destructive');
  });

  it('uses approved for verify and revoked for unverify', () => {
    expect(getAdminVerificationDecision(true)).toBe('approved');
    expect(getAdminVerificationDecision(false)).toBe('revoked');
  });
});
