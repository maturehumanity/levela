import { describe, expect, it } from 'vitest';

import { isMissingGovernanceBackend, isMissingMaturityBackend } from '@/lib/governance-admin-backend';

describe('governance-admin-backend', () => {
  describe('isMissingGovernanceBackend', () => {
    it('detects missing monetary policy tables', () => {
      expect(
        isMissingGovernanceBackend({
          code: '42P01',
          message: 'relation "monetary_policy_profiles" does not exist',
          details: null,
        }),
      ).toBe(true);

      expect(
        isMissingGovernanceBackend({
          code: 'PGRST205',
          message: 'Could not find the table public.monetary_policy_approvals in the schema cache',
          details: null,
        }),
      ).toBe(true);

      expect(
        isMissingGovernanceBackend({
          code: '22023',
          message: 'constraint failed on monetary_policy_audit_events',
          details: null,
        }),
      ).toBe(true);

      expect(
        isMissingGovernanceBackend({
          code: 'PGRST202',
          message: 'Could not find the function public.monetary_policy_profile_digest',
          details: null,
        }),
      ).toBe(true);

      expect(
        isMissingGovernanceBackend({
          code: null,
          message: null,
          details: 'FK violation on monetary_policy_profiles(id)',
        }),
      ).toBe(true);
    });

    it('returns false for null or unrelated errors', () => {
      expect(isMissingGovernanceBackend(null)).toBe(false);
      expect(
        isMissingGovernanceBackend({
          code: '23505',
          message: 'duplicate key value violates unique constraint',
          details: null,
        }),
      ).toBe(false);
    });
  });

  describe('isMissingMaturityBackend', () => {
    it('detects missing maturity schema or RPCs', () => {
      expect(
        isMissingMaturityBackend({
          code: 'PGRST202',
          message: 'Could not find the function public.capture_scheduled_governance_domain_maturity_snapshots',
          details: null,
        }),
      ).toBe(true);

      expect(
        isMissingMaturityBackend({
          code: '42P01',
          message: 'relation "governance_domain_maturity_snapshots" does not exist',
          details: null,
        }),
      ).toBe(true);

      expect(
        isMissingMaturityBackend({
          code: null,
          message: 'error in view governance_domain_maturity_transitions',
          details: null,
        }),
      ).toBe(true);

      expect(
        isMissingMaturityBackend({
          code: 'PGRST205',
          message: 'Could not find the table public.governance_domain_maturity_snapshots in the schema cache',
          details: null,
        }),
      ).toBe(true);

      expect(
        isMissingMaturityBackend({
          code: null,
          message: '',
          details: 'scheduled job governance_domain_maturity_snapshots failed',
        }),
      ).toBe(true);

      expect(
        isMissingMaturityBackend({
          code: 'PGRST202',
          message: 'unrelated RPC missing',
          details: null,
        }),
      ).toBe(true);
    });

    it('returns false for null or unrelated errors', () => {
      expect(isMissingMaturityBackend(null)).toBe(false);
      expect(
        isMissingMaturityBackend({
          code: '22023',
          message: 'invalid input syntax',
          details: null,
        }),
      ).toBe(false);
    });
  });
});
