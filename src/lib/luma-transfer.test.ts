import { describe, expect, it } from 'vitest';

import { createLumaTransferIdempotencyKey, lumaTransferErrorMessageKey } from '@/lib/luma-transfer';

describe('luma-transfer helpers', () => {
  it('creates idempotency keys with reasonable length', () => {
    const a = createLumaTransferIdempotencyKey();
    const b = createLumaTransferIdempotencyKey();
    expect(a.length).toBeGreaterThanOrEqual(8);
    expect(b.length).toBeGreaterThanOrEqual(8);
    expect(a).not.toBe(b);
  });

  it('maps known RPC error fragments to message keys', () => {
    expect(lumaTransferErrorMessageKey('insufficient_balance')).toBe('buyErrorInsufficientBalance');
    expect(lumaTransferErrorMessageKey('P0001: insufficient_balance')).toBe('buyErrorInsufficientBalance');
    expect(lumaTransferErrorMessageKey('cannot_buy_own_listing')).toBe('buyErrorOwnListing');
    expect(lumaTransferErrorMessageKey('forbidden_mint')).toBe('lumaMintForbidden');
    expect(lumaTransferErrorMessageKey('target_profile_not_found')).toBe('lumaMintRecipient');
    expect(lumaTransferErrorMessageKey('listing_sold_out')).toBe('buyErrorListingSoldOut');
    expect(lumaTransferErrorMessageKey('listing_inventory_race')).toBe('buyErrorListingRace');
    expect(lumaTransferErrorMessageKey('unknown')).toBe('buyErrorGeneric');
  });
});
