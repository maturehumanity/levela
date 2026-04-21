import { describe, expect, it } from 'vitest';

import { coerceCitizenshipStatus, deriveProjectedCitizenshipStatus } from './civic-status';

describe('civic-status', () => {
  it('projects founder and citizen-class roles to citizen status', () => {
    expect(deriveProjectedCitizenshipStatus('founder', false)).toBe('citizen');
    expect(deriveProjectedCitizenshipStatus('certified', true)).toBe('citizen');
  });

  it('projects verified members below citizen-class roles to verified_member', () => {
    expect(deriveProjectedCitizenshipStatus('member', true)).toBe('verified_member');
    expect(deriveProjectedCitizenshipStatus('verified_member', true)).toBe('verified_member');
  });

  it('keeps the stronger of current and projected citizenship status', () => {
    expect(coerceCitizenshipStatus('citizen', 'verified_member')).toBe('citizen');
    expect(coerceCitizenshipStatus('registered_member', 'verified_member')).toBe('verified_member');
  });
});
