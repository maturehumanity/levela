/**
 * Client-generated idempotency key for `transfer_luma_between_profiles` retries (same key = same outcome).
 */
export function createLumaTransferIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Map Postgres / RPC exception text to a short user-facing message key suffix (caller runs `t(\`market.${key}\`)`).
 */
export function lumaTransferErrorMessageKey(message: string | undefined | null): string {
  const m = (message ?? '').toLowerCase();
  if (m.includes('forbidden_mint')) return 'lumaMintForbidden';
  if (m.includes('target_profile_not_found')) return 'lumaMintRecipient';
  if (m.includes('insufficient_balance')) return 'buyErrorInsufficientBalance';
  if (m.includes('forbidden_sender')) return 'buyErrorForbidden';
  if (m.includes('cannot_buy_own_listing')) return 'buyErrorOwnListing';
  if (m.includes('listing_not_found') || m.includes('listing_not_published')) return 'buyErrorListingUnavailable';
  if (m.includes('listing_seller_mismatch') || m.includes('listing_price_mismatch')) return 'buyErrorListingMismatch';
  if (m.includes('listing_sold_out')) return 'buyErrorListingSoldOut';
  if (m.includes('listing_inventory_race')) return 'buyErrorListingRace';
  if (m.includes('invalid_amount') || m.includes('same_account')) return 'buyErrorInvalidAmount';
  if (m.includes('invalid_idempotency_key') || m.includes('memo_too_long')) return 'buyErrorInvalidRequest';
  return 'buyErrorGeneric';
}
