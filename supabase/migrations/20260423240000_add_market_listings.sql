-- Published offers on the Market page: priced in whole Lumens, identity-linked seller.

CREATE TABLE IF NOT EXISTS public.market_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(trim(title)) >= 1 AND char_length(title) <= 200),
  description text CHECK (description IS NULL OR char_length(description) <= 2000),
  price_lumens bigint NOT NULL CHECK (price_lumens > 0 AND price_lumens <= 1000000000000000),
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_listings_published_created
  ON public.market_listings (status, created_at DESC)
  WHERE status = 'published';

COMMENT ON TABLE public.market_listings IS 'Goods and services offers; price_lumens is whole Lumens (100 Lumens = 1 Luma).';

DROP TRIGGER IF EXISTS update_market_listings_updated_at ON public.market_listings;
CREATE TRIGGER update_market_listings_updated_at
  BEFORE UPDATE ON public.market_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT ON public.market_listings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.market_listings TO authenticated;

ALTER TABLE public.market_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Published market listings are readable" ON public.market_listings;
CREATE POLICY "Published market listings are readable"
  ON public.market_listings
  FOR SELECT
  USING (status = 'published');

DROP POLICY IF EXISTS "Sellers read own market listings" ON public.market_listings;
CREATE POLICY "Sellers read own market listings"
  ON public.market_listings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = market_listings.seller_profile_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Sellers insert own market listings" ON public.market_listings;
CREATE POLICY "Sellers insert own market listings"
  ON public.market_listings
  FOR INSERT
  WITH CHECK (
    status = 'published'
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = market_listings.seller_profile_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Sellers update own market listings" ON public.market_listings;
CREATE POLICY "Sellers update own market listings"
  ON public.market_listings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = market_listings.seller_profile_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = market_listings.seller_profile_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Market managers update any listing" ON public.market_listings;
CREATE POLICY "Market managers update any listing"
  ON public.market_listings
  FOR UPDATE
  USING (public.has_permission('market.manage'::public.app_permission))
  WITH CHECK (public.has_permission('market.manage'::public.app_permission));
