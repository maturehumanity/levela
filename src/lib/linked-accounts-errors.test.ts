import { describe, expect, it } from 'vitest';

import {
  isDuplicateLinkError,
  isMissingBusinessAccessRequestsTableError,
  isMissingLinkedAccountsTableError,
} from '@/lib/linked-accounts-errors';

describe('linked-accounts-errors', () => {
  it('detects missing linked_accounts surface', () => {
    expect(isMissingLinkedAccountsTableError(null)).toBe(false);
    expect(isMissingLinkedAccountsTableError(undefined)).toBe(false);

    expect(
      isMissingLinkedAccountsTableError({
        code: 'PGRST205',
        message: 'Could not find the table public.other_table in the schema cache',
      }),
    ).toBe(true);

    expect(
      isMissingLinkedAccountsTableError({
        code: null,
        message: 'relation "linked_accounts" does not exist',
      }),
    ).toBe(true);
  });

  it('detects missing business_account_access_requests surface', () => {
    expect(isMissingBusinessAccessRequestsTableError(null)).toBe(false);

    expect(
      isMissingBusinessAccessRequestsTableError({
        code: '42P01',
        message: 'relation "profiles" does not exist',
      }),
    ).toBe(true);

    expect(
      isMissingBusinessAccessRequestsTableError({
        code: null,
        message: 'relation "business_account_access_requests" does not exist',
      }),
    ).toBe(true);
  });

  it('detects duplicate link errors', () => {
    expect(isDuplicateLinkError(null)).toBe(false);
    expect(isDuplicateLinkError({ code: '23505', message: null })).toBe(true);
    expect(isDuplicateLinkError({ code: null, message: 'Duplicate key violates unique constraint' })).toBe(true);
    expect(isDuplicateLinkError({ code: '42501', message: 'permission denied' })).toBe(false);
  });

  it('returns false when there is no schema miss signal', () => {
    expect(
      isMissingLinkedAccountsTableError({
        code: '23505',
        message: 'duplicate key value violates unique constraint',
      }),
    ).toBe(false);

    expect(
      isMissingBusinessAccessRequestsTableError({
        code: '23505',
        message: 'duplicate key value violates unique constraint',
      }),
    ).toBe(false);
  });
});
