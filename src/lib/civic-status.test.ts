import { describe, expect, it } from 'vitest';

import {
  coerceCitizenshipStatus,
  deriveProjectedCitizenshipStatus,
  getCitizenStatusLabelKey,
  type CitizenshipStatus,
} from './civic-status';

describe('civic-status', () => {
  it('projects founder and citizen-class roles to citizen status', () => {
    expect(deriveProjectedCitizenshipStatus('founder', false)).toBe('citizen');
    expect(deriveProjectedCitizenshipStatus('certified', true)).toBe('citizen');
    expect(deriveProjectedCitizenshipStatus('moderator', false)).toBe('citizen');
    expect(deriveProjectedCitizenshipStatus('admin', false)).toBe('citizen');
  });

  it('projects verified members below citizen-class roles to verified_member', () => {
    expect(deriveProjectedCitizenshipStatus('member', true)).toBe('verified_member');
    expect(deriveProjectedCitizenshipStatus('verified_member', true)).toBe('verified_member');
  });

  it('projects unverified baseline members to registered_member', () => {
    expect(deriveProjectedCitizenshipStatus('member', false)).toBe('registered_member');
    expect(deriveProjectedCitizenshipStatus('guest', false)).toBe('registered_member');
  });

  it('treats a missing role like a baseline member for projection', () => {
    expect(deriveProjectedCitizenshipStatus(null, true)).toBe('verified_member');
    expect(deriveProjectedCitizenshipStatus(undefined, false)).toBe('registered_member');
  });

  it('projects market_manager to citizen even when unverified', () => {
    expect(deriveProjectedCitizenshipStatus('market_manager', false)).toBe('citizen');
  });

  it('keeps the stronger of current and projected citizenship status', () => {
    expect(coerceCitizenshipStatus('citizen', 'verified_member')).toBe('citizen');
    expect(coerceCitizenshipStatus('registered_member', 'verified_member')).toBe('verified_member');
    expect(coerceCitizenshipStatus(null, 'citizen')).toBe('citizen');
    expect(coerceCitizenshipStatus(undefined, 'registered_member')).toBe('registered_member');
    expect(coerceCitizenshipStatus('verified_member', 'verified_member')).toBe('verified_member');
  });

  it('exposes stable i18n keys for citizenship labels', () => {
    expect(getCitizenStatusLabelKey('citizen')).toBe('admin.users.citizenshipStatuses.citizen');
    expect(getCitizenStatusLabelKey('verified_member')).toBe('admin.users.citizenshipStatuses.verified_member');
    expect(getCitizenStatusLabelKey('registered_member')).toBe('admin.users.citizenshipStatuses.registered_member');
  });

  it('falls back to the registered label for unknown status values', () => {
    expect(getCitizenStatusLabelKey('not_a_status' as CitizenshipStatus)).toBe(
      'admin.users.citizenshipStatuses.registered_member',
    );
  });
});
