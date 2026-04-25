import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/integrations/supabase/client';

export type MarketListingSeller = {
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export type MarketListingKind = 'product' | 'service';

export type PublishedMarketListing = {
  id: string;
  title: string;
  description: string | null;
  price_lumens: number;
  remaining_quantity: number;
  created_at: string;
  seller_profile_id: string;
  listing_kind: MarketListingKind;
  profiles: MarketListingSeller | null;
};

function coerceProfiles(
  value: MarketListingSeller | MarketListingSeller[] | null,
): MarketListingSeller | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

type RawListingRow = Omit<PublishedMarketListing, 'profiles' | 'remaining_quantity' | 'listing_kind'> & {
  remaining_quantity?: number | string | null;
  listing_kind?: string | null;
  profiles: MarketListingSeller | MarketListingSeller[] | null;
};

function normalizeListingRows(rows: RawListingRow[]): PublishedMarketListing[] {
  return rows.map((row) => {
    const rawPrice = row.price_lumens as unknown;
    const price =
      typeof rawPrice === 'string' ? Number(rawPrice) : typeof rawPrice === 'number' ? rawPrice : Number.NaN;
    const rawQty = row.remaining_quantity as unknown;
    let qty =
      typeof rawQty === 'string' ? Number.parseInt(rawQty, 10) : typeof rawQty === 'number' ? rawQty : Number.NaN;
    if (!Number.isFinite(qty) || qty < 0) {
      qty = 1;
    }
    const kindRaw = row.listing_kind;
    const listing_kind: MarketListingKind = kindRaw === 'service' ? 'service' : 'product';
    return {
      ...row,
      price_lumens: Number.isFinite(price) ? price : 0,
      remaining_quantity: qty,
      listing_kind,
      profiles: coerceProfiles(row.profiles),
    };
  });
}

const listingSelect = `
        id,
        title,
        description,
        price_lumens,
        remaining_quantity,
        created_at,
        seller_profile_id,
        listing_kind,
        profiles (full_name, username, avatar_url)
      `;

export function useMarketPublishedListings() {
  const [listings, setListings] = useState<PublishedMarketListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('market_listings')
      .select(listingSelect)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(50);

    if (fetchError) {
      setListings([]);
      setError(fetchError.message);
    } else {
      setListings(normalizeListingRows((data ?? []) as RawListingRow[]));
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { listings, loading, error, refetch };
}

/** Current member’s published offers (for Selling tab). */
export function useMarketMyPublishedListings(sellerProfileId: string | null) {
  const [listings, setListings] = useState<PublishedMarketListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!sellerProfileId) {
      setListings([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('market_listings')
      .select(listingSelect)
      .eq('status', 'published')
      .eq('seller_profile_id', sellerProfileId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (fetchError) {
      setListings([]);
      setError(fetchError.message);
    } else {
      setListings(normalizeListingRows((data ?? []) as RawListingRow[]));
    }

    setLoading(false);
  }, [sellerProfileId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { listings, loading, error, refetch };
}
