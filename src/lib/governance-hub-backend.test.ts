import { describe, expect, it } from 'vitest';

import { isMissingGovernanceProposalBackend, isMissingGovernanceSanctionsBackend } from '@/lib/governance-hub-backend';

describe('governance-hub-backend', () => {
  describe('isMissingGovernanceProposalBackend', () => {
    it('detects missing proposal or execution schema', () => {
      expect(
        isMissingGovernanceProposalBackend({
          code: '42P01',
          message: 'relation "governance_proposals" does not exist',
          details: null,
        }),
      ).toBe(true);

      expect(
        isMissingGovernanceProposalBackend({
          code: 'PGRST205',
          message: 'Could not find the table public.governance_execution_units in the schema cache',
          details: null,
        }),
      ).toBe(true);

      expect(
        isMissingGovernanceProposalBackend({
          code: null,
          message: 'column guardian_signoff_required does not exist',
          details: null,
        }),
      ).toBe(true);

      expect(
        isMissingGovernanceProposalBackend({
          code: null,
          message: 'foreign key violation on governance_proposal_guardian_approvals',
          details: null,
        }),
      ).toBe(true);
    });

    it('returns false for null or unrelated errors', () => {
      expect(isMissingGovernanceProposalBackend(null)).toBe(false);
      expect(
        isMissingGovernanceProposalBackend({
          code: '23505',
          message: 'duplicate key value violates unique constraint',
          details: null,
        }),
      ).toBe(false);
    });
  });

  describe('isMissingGovernanceSanctionsBackend', () => {
    it('detects missing sanctions schema', () => {
      expect(
        isMissingGovernanceSanctionsBackend({
          code: '42P01',
          message: 'relation "governance_sanctions" does not exist',
          details: null,
        }),
      ).toBe(true);

      expect(
        isMissingGovernanceSanctionsBackend({
          code: 'PGRST205',
          message: 'Could not find the table public.governance_sanction_appeals in the schema cache',
          details: null,
        }),
      ).toBe(true);
    });

    it('returns false for null or unrelated errors', () => {
      expect(isMissingGovernanceSanctionsBackend(null)).toBe(false);
      expect(
        isMissingGovernanceSanctionsBackend({
          code: '22023',
          message: 'invalid input syntax',
          details: null,
        }),
      ).toBe(false);
    });
  });
});
