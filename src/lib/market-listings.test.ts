import { describe, expect, it } from 'vitest';

import {
  MARKET_LISTING_DESCRIPTION_MAX,
  MARKET_LISTING_TITLE_MAX,
  normalizeMarketListingDescription,
  normalizeMarketListingTitle,
  parseInitialListingQuantity,
} from '@/lib/market-listings';

describe('market-listings helpers', () => {
  it('trims and caps listing titles', () => {
    expect(normalizeMarketListingTitle('  Hello  ')).toBe('Hello');
    const long = 'x'.repeat(MARKET_LISTING_TITLE_MAX + 20);
    expect(normalizeMarketListingTitle(long).length).toBe(MARKET_LISTING_TITLE_MAX);
  });

  it('parses initial listing quantity', () => {
    expect(parseInitialListingQuantity('')).toBeNull();
    expect(parseInitialListingQuantity('3')).toBe(3);
    expect(parseInitialListingQuantity('0')).toBeNull();
  });

  it('returns null for empty descriptions and trims non-empty values', () => {
    expect(normalizeMarketListingDescription('   ')).toBeNull();
    expect(normalizeMarketListingDescription('  Notes  ')).toBe('Notes');
    const long = 'y'.repeat(MARKET_LISTING_DESCRIPTION_MAX + 5);
    expect(normalizeMarketListingDescription(long)!.length).toBe(MARKET_LISTING_DESCRIPTION_MAX);
  });
});
