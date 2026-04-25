-- Digital agreements linked to Market listings: draft → pending counterparty → signed.

CREATE TABLE IF NOT EXISTS public.agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_listing_id uuid REFERENCES public.market_listings(id) ON DELETE SET NULL,
  initiator_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  buyer_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_key text NOT NULL CHECK (template_key IN ('core', 'product', 'service')),
  listing_title_snapshot text NOT NULL,
  listing_price_lumens_snapshot bigint NOT NULL,
  listing_kind_snapshot text NOT NULL DEFAULT 'product',
  body_markdown text NOT NULL CHECK (char_length(body_markdown) <= 32000),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_counterparty', 'signed', 'cancelled')),
  buyer_signed_at timestamptz,
  seller_signed_at timestamptz,
  signed_at timestamptz,
  signed_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agreements_distinct_parties CHECK (buyer_profile_id <> seller_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_agreements_buyer_created ON public.agreements (buyer_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agreements_seller_created ON public.agreements (seller_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agreements_listing ON public.agreements (market_listing_id) WHERE market_listing_id IS NOT NULL;

COMMENT ON TABLE public.agreements IS 'Buyer–seller digital agreements; mutations via RPC; parties read via RLS.';

DROP TRIGGER IF EXISTS update_agreements_updated_at ON public.agreements;
CREATE TRIGGER update_agreements_updated_at
  BEFORE UPDATE ON public.agreements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.agreements TO authenticated;

DROP POLICY IF EXISTS "Agreement parties can read" ON public.agreements;
CREATE POLICY "Agreement parties can read"
  ON public.agreements
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = agreements.buyer_profile_id AND p.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = agreements.seller_profile_id AND p.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Default body text (server-built; listing context injected)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.build_default_agreement_body_markdown(
  p_template_key text,
  p_listing_title text,
  p_price_lumens bigint,
  p_listing_kind text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_kind_label text;
BEGIN
  v_kind_label := CASE WHEN lower(coalesce(p_listing_kind, '')) = 'service' THEN 'Service' ELSE 'Product' END;

  RETURN format(
$md$
# Agreement

**Listing:** %1$s  
**Kind:** %2$s  
**Price (Lumens):** %3$s

## Parties
The **Buyer** and **Seller** identified by this agreement record in Levela agree to the terms below.

## Scope
The Seller provides the listing described above. Deliverables, timelines, and acceptance criteria are as agreed in messages or as specified in the listing description unless amended below.

## Payment
Payment is in Lumens as shown above unless the parties record a different arrangement in writing (including within Levela messaging). Transfers follow Levela wallet rules.

## Cancellation
Either party may cancel before both signatures are recorded. After full execution (both signed), this record is closed for editing.

## Disputes
Parties should seek good-faith resolution. Steward or governance channels may apply per Levela civic rules.

## Amendments
Edits to the body are allowed only while the agreement is in **draft** (no signatures yet).

---
*Template: %4$s*
$md$,
    replace(p_listing_title, '%', '%%'),
    v_kind_label,
    p_price_lumens::text,
    initcap(p_template_key)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- create_agreement_from_listing
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_agreement_from_listing(
  p_market_listing_id uuid,
  p_template_key text DEFAULT 'product'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer uuid;
  v_seller uuid;
  v_title text;
  v_price bigint;
  v_kind text;
  v_body text;
  v_tid text;
  v_new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_tid := lower(trim(p_template_key));
  IF v_tid NOT IN ('core', 'product', 'service') THEN
    RAISE EXCEPTION 'Invalid template key';
  END IF;

  SELECT p.id INTO v_buyer FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1;
  IF v_buyer IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  SELECT
    ml.seller_profile_id,
    trim(ml.title),
    ml.price_lumens,
    coalesce(ml.listing_kind::text, 'product')
  INTO v_seller, v_title, v_price, v_kind
  FROM public.market_listings ml
  WHERE ml.id = p_market_listing_id
    AND ml.status = 'published';

  IF v_seller IS NULL OR v_title IS NULL OR v_price IS NULL THEN
    RAISE EXCEPTION 'Listing not available';
  END IF;

  IF v_buyer = v_seller THEN
    RAISE EXCEPTION 'Cannot create agreement with yourself';
  END IF;

  v_body := public.build_default_agreement_body_markdown(v_tid, v_title, v_price, v_kind);

  INSERT INTO public.agreements (
    market_listing_id,
    initiator_profile_id,
    buyer_profile_id,
    seller_profile_id,
    template_key,
    listing_title_snapshot,
    listing_price_lumens_snapshot,
    listing_kind_snapshot,
    body_markdown,
    status
  ) VALUES (
    p_market_listing_id,
    v_buyer,
    v_buyer,
    v_seller,
    v_tid,
    v_title,
    v_price,
    v_kind,
    v_body,
    'draft'
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_agreement_from_listing(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- update_agreement_body
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_agreement_body(
  p_agreement_id uuid,
  p_body_markdown text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  r public.agreements%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_body_markdown IS NULL OR char_length(trim(p_body_markdown)) < 1 OR char_length(p_body_markdown) > 32000 THEN
    RAISE EXCEPTION 'Invalid body';
  END IF;

  SELECT p.id INTO v_actor FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1;

  SELECT * INTO r FROM public.agreements WHERE id = p_agreement_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agreement not found';
  END IF;

  IF v_actor IS NULL OR (v_actor <> r.buyer_profile_id AND v_actor <> r.seller_profile_id) THEN
    RAISE EXCEPTION 'Not a party to this agreement';
  END IF;

  IF r.status NOT IN ('draft') THEN
    RAISE EXCEPTION 'Body can only be edited in draft';
  END IF;

  IF r.buyer_signed_at IS NOT NULL OR r.seller_signed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot edit after signing started';
  END IF;

  UPDATE public.agreements
  SET body_markdown = trim(p_body_markdown)
  WHERE id = p_agreement_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_agreement_body(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- sign_agreement
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sign_agreement(p_agreement_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  r public.agreements%ROWTYPE;
  v_snap jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT p.id INTO v_actor FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1;

  SELECT * INTO r FROM public.agreements WHERE id = p_agreement_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agreement not found';
  END IF;

  IF r.status = 'cancelled' THEN
    RAISE EXCEPTION 'Agreement was cancelled';
  END IF;

  IF r.status = 'signed' THEN
    RETURN;
  END IF;

  IF v_actor IS NULL OR (v_actor <> r.buyer_profile_id AND v_actor <> r.seller_profile_id) THEN
    RAISE EXCEPTION 'Not a party to this agreement';
  END IF;

  IF v_actor = r.buyer_profile_id THEN
    IF r.buyer_signed_at IS NOT NULL THEN
      RETURN;
    END IF;
    UPDATE public.agreements SET buyer_signed_at = now() WHERE id = p_agreement_id;
  ELSIF v_actor = r.seller_profile_id THEN
    IF r.seller_signed_at IS NOT NULL THEN
      RETURN;
    END IF;
    UPDATE public.agreements SET seller_signed_at = now() WHERE id = p_agreement_id;
  END IF;

  SELECT * INTO r FROM public.agreements WHERE id = p_agreement_id;

  IF r.buyer_signed_at IS NOT NULL AND r.seller_signed_at IS NOT NULL THEN
    v_snap := jsonb_build_object(
      'agreement_id', r.id,
      'market_listing_id', r.market_listing_id,
      'buyer_profile_id', r.buyer_profile_id,
      'seller_profile_id', r.seller_profile_id,
      'template_key', r.template_key,
      'listing_title_snapshot', r.listing_title_snapshot,
      'listing_price_lumens_snapshot', r.listing_price_lumens_snapshot,
      'listing_kind_snapshot', r.listing_kind_snapshot,
      'body_markdown', r.body_markdown,
      'buyer_signed_at', r.buyer_signed_at,
      'seller_signed_at', r.seller_signed_at,
      'signed_at', now()
    );
    UPDATE public.agreements
    SET
      status = 'signed',
      signed_at = now(),
      signed_snapshot = v_snap
    WHERE id = p_agreement_id;
  ELSE
    UPDATE public.agreements
    SET status = 'pending_counterparty'
    WHERE id = p_agreement_id AND status = 'draft';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sign_agreement(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- cancel_agreement
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cancel_agreement(p_agreement_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  r public.agreements%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT p.id INTO v_actor FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1;

  SELECT * INTO r FROM public.agreements WHERE id = p_agreement_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agreement not found';
  END IF;

  IF v_actor IS NULL OR (v_actor <> r.buyer_profile_id AND v_actor <> r.seller_profile_id) THEN
    RAISE EXCEPTION 'Not a party to this agreement';
  END IF;

  IF r.status = 'signed' THEN
    RAISE EXCEPTION 'Cannot cancel a signed agreement';
  END IF;

  UPDATE public.agreements
  SET status = 'cancelled', buyer_signed_at = NULL, seller_signed_at = NULL
  WHERE id = p_agreement_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_agreement(uuid) TO authenticated;
