import { describe, expect, it } from 'vitest';

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

  it('preserves optional invalid batch id strings on otherwise valid chain payloads', () => {
    const parsed = readGovernancePublicAuditChainStatus({
      checked_batch_count: 2,
      link_valid: false,
      hash_valid: true,
      valid: false,
      first_invalid_link_batch_id: 'batch-trouble',
      first_invalid_hash_batch_id: null,
    } as never);

    expect(parsed).toEqual({
      checkedBatchCount: 2,
      linkValid: false,
      hashValid: true,
      valid: false,
      firstInvalidLinkBatchId: 'batch-trouble',
      firstInvalidHashBatchId: null,
    });
  });

  it('returns null for malformed chain payloads', () => {
    expect(readGovernancePublicAuditChainStatus(null)).toBeNull();
    expect(readGovernancePublicAuditChainStatus(undefined)).toBeNull();
    expect(readGovernancePublicAuditChainStatus([] as never)).toBeNull();

    expect(
      readGovernancePublicAuditChainStatus({
        checked_batch_count: '7',
        link_valid: true,
        hash_valid: true,
        valid: true,
      } as never),
    ).toBeNull();

    expect(
      readGovernancePublicAuditChainStatus({
        checked_batch_count: -1,
        link_valid: true,
        hash_valid: true,
        valid: true,
      } as never),
    ).toBeNull();

    expect(
      readGovernancePublicAuditChainStatus({
        checked_batch_count: 3,
        link_valid: 'true',
        hash_valid: true,
        valid: true,
      } as never),
    ).toBeNull();
  });

  it('floors fractional checked batch counts when parsing chain payloads', () => {
    expect(
      readGovernancePublicAuditChainStatus({
        checked_batch_count: 4.9,
        link_valid: true,
        hash_valid: true,
        valid: true,
        first_invalid_link_batch_id: null,
        first_invalid_hash_batch_id: null,
      } as never),
    ).toEqual({
      checkedBatchCount: 4,
      linkValid: true,
      hashValid: true,
      valid: true,
      firstInvalidLinkBatchId: null,
      firstInvalidHashBatchId: null,
    });
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

  it('treats anchoring as incomplete unless both timestamp and reference are present', () => {
    const hash = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
    expect(
      summarizeGovernancePublicAuditBatch({
        batch_hash: hash,
        event_count: 1,
        anchored_at: '2026-04-20T12:00:00Z',
        anchor_reference: null,
      } as never).anchored,
    ).toBe(false);
    expect(
      summarizeGovernancePublicAuditBatch({
        batch_hash: hash,
        event_count: 1,
        anchored_at: null,
        anchor_reference: 'ipfs://bafyexample',
      } as never).anchored,
    ).toBe(false);
  });

  it('clamps event counts to non-negative integers', () => {
    const hash = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
    expect(
      summarizeGovernancePublicAuditBatch({
        batch_hash: hash,
        event_count: -2.7,
        anchored_at: null,
        anchor_reference: null,
      } as never).eventCount,
    ).toBe(0);
    expect(
      summarizeGovernancePublicAuditBatch({
        batch_hash: hash,
        event_count: 2.9,
        anchored_at: null,
        anchor_reference: null,
      } as never).eventCount,
    ).toBe(2);
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

  it('detects missing anchoring backend when messages reference other audit tables', () => {
    expect(
      isMissingPublicAuditAnchoringBackend({
        code: null,
        message: 'relation "governance_public_audit_events" does not exist',
        details: null,
      }),
    ).toBe(true);

    expect(
      isMissingPublicAuditAnchoringBackend({
        code: null,
        message: null,
        details: 'timeout calling verify_governance_public_audit_chain',
      }),
    ).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(isMissingPublicAuditAnchoringBackend(null)).toBe(false);
    expect(isMissingPublicAuditAnchoringBackend({ code: '23505', message: 'duplicate', details: null })).toBe(false);
  });
});
