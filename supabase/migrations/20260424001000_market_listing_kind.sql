-- Distinguish physical or digital goods from services for browsing and filters.

ALTER TABLE public.market_listings
  ADD COLUMN IF NOT EXISTS listing_kind text NOT NULL DEFAULT 'product'
  CHECK (listing_kind IN ('product', 'service'));

COMMENT ON COLUMN public.market_listings.listing_kind IS 'product: goods or digital items; service: labor, appointments, or delivered work.';
