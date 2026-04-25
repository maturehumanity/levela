export const MARKET_LISTING_TITLE_MAX = 200;
export const MARKET_LISTING_DESCRIPTION_MAX = 2000;
/** Maximum units available when creating a listing (each unit is one purchase at the listed price). */
export const MARKET_LISTING_INITIAL_QUANTITY_MAX = 10_000;

export const MARKET_LISTING_STATUSES = ['published', 'archived'] as const;
export type MarketListingStatus = (typeof MARKET_LISTING_STATUSES)[number];

export function normalizeMarketListingTitle(raw: string): string {
  return raw.trim().slice(0, MARKET_LISTING_TITLE_MAX);
}

export function normalizeMarketListingDescription(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  return t.slice(0, MARKET_LISTING_DESCRIPTION_MAX);
}

export function parseInitialListingQuantity(raw: string): number | null {
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n < 1 || n > MARKET_LISTING_INITIAL_QUANTITY_MAX) return null;
  return n;
}
