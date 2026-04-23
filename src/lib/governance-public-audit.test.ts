import {
  isMissingPublicAuditAnchoringBackend,
  readGovernancePublicAuditChainStatus,
  summarizeGovernancePublicAuditBatch,
} from '@/lib/governance-public-audit';

describe('governance-public-audit helpers', () => {
  it('parses valid chain verification payloads', () => {
    const parsed = readGovernancePublicAuditChainStatus({
      checked_batch_count: 7,
      link_valid: true,
      hash_valid: true,
      valid: true,
      first_invalid_link_batch_id: null,
      first_invalid_hash_batch_id: null,
    } as never);

    expect(parsed).toEqual({
      checkedBatchCount: 7,
      linkValid: true,
      hashValid: true,
      valid: true,
      firstInvalidLinkBatchId: null,
      firstInvalidHashBatchId: null,
    });
  });

  it('returns null for malformed chain payloads', () => {
    expect(
      readGovernancePublicAuditChainStatus({
        checked_batch_count: '7',
        link_valid: true,
        hash_valid: true,
        valid: true,
      } as never),
    ).toBeNull();
  });

  it('summarizes batch metadata for UI cards', () => {
    const summary = summarizeGovernancePublicAuditBatch({
      batch_hash: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
      event_count: 4,
      anchored_at: '2026-04-20T12:00:00Z',
      anchor_reference: 'ipfs://bafyexample',
    } as never);

    expect(summary).toEqual({
      anchored: true,
      eventCount: 4,
      hashPreview: 'abcdef012345...23456789',
    });
  });

  it('detects missing anchoring backend from PostgREST codes', () => {
    expect(isMissingPublicAuditAnchoringBackend({ code: '42P01', message: null, details: null })).toBe(true);
    expect(isMissingPublicAuditAnchoringBackend({ code: 'PGRST205', message: null, details: null })).toBe(true);
    expect(isMissingPublicAuditAnchoringBackend({ code: 'PGRST202', message: null, details: null })).toBe(true);
  });

  it('detects missing anchoring backend from RPC/table hints in messages', () => {
    expect(
      isMissingPublicAuditAnchoringBackend({
        code: null,
        message: 'function capture_governance_public_audit_batch not found',
        details: null,
      }),
    ).toBe(true);
    expect(
      isMissingPublicAuditAnchoringBackend({
        code: null,
        message: 'verify_governance_public_audit_chain',
        details: null,
      }),
    ).toBe(true);
    expect(
      isMissingPublicAuditAnchoringBackend({
        code: null,
        message: 'relation "governance_public_audit_batches" does not exist',
        details: null,
      }),
    ).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(isMissingPublicAuditAnchoringBackend(null)).toBe(false);
    expect(isMissingPublicAuditAnchoringBackend({ code: '23505', message: 'duplicate', details: null })).toBe(false);
  });
});
