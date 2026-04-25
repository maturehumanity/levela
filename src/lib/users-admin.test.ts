import { describe, expect, it } from 'vitest';

import {
  getDisplayNameParts,
  getEffectiveCitizenshipStatus,
  getEffectiveVerificationStatus,
  getInitials,
  getNextUserExperienceLevel,
} from '@/lib/users-admin';

describe('users-admin helpers', () => {
  it('derives initials from name or username', () => {
    expect(getInitials('Ada Lovelace', null)).toBe('AL');
    expect(getInitials('Marie Skłodowska Curie', null)).toBe('MS');
    expect(getInitials(null, 'countess')).toBe('C');
    expect(getInitials('  ', null)).toBe('?');
  });

  it('advances experience level cyclically', () => {
    expect(getNextUserExperienceLevel('entry')).toBe('junior');
    expect(getNextUserExperienceLevel('mid')).toBe('senior');
    expect(getNextUserExperienceLevel('professional')).toBe('entry');
    expect(getNextUserExperienceLevel(null)).toBe('junior');
    expect(getNextUserExperienceLevel(undefined)).toBe('junior');
  });

  it('prefers verification case status when present', () => {
    expect(getEffectiveVerificationStatus({ is_verified: false }, { status: 'pending_review' })).toBe('pending_review');
    expect(getEffectiveVerificationStatus({ is_verified: true }, { status: 'rejected' })).toBe('rejected');
  });

  it('falls back to verified flag when no case status', () => {
    expect(getEffectiveVerificationStatus({ is_verified: true }, null)).toBe('approved');
    expect(getEffectiveVerificationStatus({ is_verified: false }, null)).toBe('draft');
  });

  it('strips trailing professional suffix from display names', () => {
    expect(getDisplayNameParts({ full_name: 'Ada Lovelace Professional', username: null })).toEqual({
      name: 'Ada Lovelace',
      hasProfessionalSuffix: true,
    });
    expect(getDisplayNameParts({ full_name: 'Ada Lovelace', username: 'ada' })).toEqual({
      name: 'Ada Lovelace',
      hasProfessionalSuffix: false,
    });
    expect(getDisplayNameParts({ full_name: null, username: 'ada' })).toEqual({
      name: null,
      hasProfessionalSuffix: false,
    });
    expect(getDisplayNameParts({ full_name: 'Ada Lovelace professional', username: null })).toEqual({
      name: 'Ada Lovelace',
      hasProfessionalSuffix: true,
    });
  });


  it('handles edge cases in initials and display names', () => {
    expect(getInitials('  Ada   Lovelace  ', null)).toBe('AL');
    expect(getDisplayNameParts({ full_name: 'Professional', username: null })).toEqual({
      name: 'Professional',
      hasProfessionalSuffix: false,
    });
  });

  it('falls back to verified flag when verification case has no status', () => {
    expect(getEffectiveVerificationStatus({ is_verified: true }, {})).toBe('approved');
    expect(getEffectiveVerificationStatus({ is_verified: false }, { status: undefined })).toBe('draft');
  });

  it('coerces citizenship using stored status and role projection', () => {
    expect(
      getEffectiveCitizenshipStatus({
        citizenship_status: 'registered_member',
        is_verified: false,
        role: 'member',
      }),
    ).toBe('registered_member');

    expect(
      getEffectiveCitizenshipStatus({
        citizenship_status: 'registered_member',
        is_verified: false,
        role: 'citizen',
      }),
    ).toBe('citizen');

    expect(
      getEffectiveCitizenshipStatus({
        citizenship_status: 'citizen',
        is_verified: true,
        role: 'member',
      }),
    ).toBe('citizen');
  });
});
