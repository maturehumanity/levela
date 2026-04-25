-- Limited inventory per listing; market purchases decrement stock and archive when sold out.

ALTER TABLE public.market_listings
  ADD COLUMN IF NOT EXISTS remaining_quantity integer NOT NULL DEFAULT 1
  CHECK (remaining_quantity >= 0 AND remaining_quantity <= 1000000);

COMMENT ON COLUMN public.market_listings.remaining_quantity IS 'How many times this offer can still be purchased at the listed price; decremented by transfer_luma_between_profiles.';

CREATE OR REPLACE FUNCTION public.enforce_market_listing_stock_monotonic()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.remaining_quantity > OLD.remaining_quantity THEN
    IF NOT public.has_permission('market.manage'::public.app_permission) THEN
      RAISE EXCEPTION 'listing_stock_increase_forbidden' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_market_listing_stock_monotonic ON public.market_listings;
CREATE TRIGGER enforce_market_listing_stock_monotonic
  BEFORE UPDATE ON public.market_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_market_listing_stock_monotonic();

CREATE OR REPLACE FUNCTION public.transfer_luma_between_profiles(
  p_from_profile_id uuid,
  p_to_profile_id uuid,
  p_amount_lumens bigint,
  p_idempotency_key text,
  p_market_listing_id uuid DEFAULT NULL,
  p_memo text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_from_user uuid;
  v_existing uuid;
  v_listing_seller uuid;
  v_listing_price bigint;
  v_listing_status text;
  v_listing_remaining integer;
  v_entry_kind text;
  v_ledger_id uuid := gen_random_uuid();
BEGIN
  IF p_amount_lumens IS NULL OR p_amount_lumens <= 0 THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = '22023';
  END IF;
  IF p_from_profile_id = p_to_profile_id THEN
    RAISE EXCEPTION 'same_account' USING ERRCODE = '22023';
  END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) < 8 OR length(p_idempotency_key) > 200 THEN
    RAISE EXCEPTION 'invalid_idempotency_key' USING ERRCODE = '22023';
  END IF;
  IF p_memo IS NOT NULL AND length(p_memo) > 500 THEN
    RAISE EXCEPTION 'memo_too_long' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(884291217, hashtext(p_idempotency_key));

  SELECT id INTO v_existing FROM public.luma_ledger_entries WHERE idempotency_key = p_idempotency_key LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  SELECT user_id INTO v_from_user FROM public.profiles WHERE id = p_from_profile_id;
  IF v_from_user IS NULL OR v_from_user <> v_uid THEN
    RAISE EXCEPTION 'forbidden_sender' USING ERRCODE = '42501';
  END IF;

  IF p_market_listing_id IS NULL THEN
    v_entry_kind := 'peer_transfer';
  ELSE
    v_entry_kind := 'market_purchase';
    SELECT seller_profile_id, price_lumens, status, remaining_quantity
      INTO v_listing_seller, v_listing_price, v_listing_status, v_listing_remaining
    FROM public.market_listings
    WHERE id = p_market_listing_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'listing_not_found' USING ERRCODE = '22023';
    END IF;
    IF v_listing_status IS DISTINCT FROM 'published' THEN
      RAISE EXCEPTION 'listing_not_published' USING ERRCODE = '22023';
    END IF;
    IF v_listing_remaining IS NULL OR v_listing_remaining < 1 THEN
      RAISE EXCEPTION 'listing_sold_out' USING ERRCODE = '22023';
    END IF;
    IF v_listing_seller IS DISTINCT FROM p_to_profile_id THEN
      RAISE EXCEPTION 'listing_seller_mismatch' USING ERRCODE = '22023';
    END IF;
    IF v_listing_price IS DISTINCT FROM p_amount_lumens THEN
      RAISE EXCEPTION 'listing_price_mismatch' USING ERRCODE = '22023';
    END IF;
    IF v_listing_seller = p_from_profile_id THEN
      RAISE EXCEPTION 'cannot_buy_own_listing' USING ERRCODE = '22023';
    END IF;
  END IF;

  INSERT INTO public.luma_wallet_balances (profile_id) VALUES (p_from_profile_id) ON CONFLICT (profile_id) DO NOTHING;
  INSERT INTO public.luma_wallet_balances (profile_id) VALUES (p_to_profile_id) ON CONFLICT (profile_id) DO NOTHING;

  IF p_from_profile_id::text < p_to_profile_id::text THEN
    PERFORM 1 FROM public.luma_wallet_balances WHERE profile_id = p_from_profile_id FOR UPDATE;
    PERFORM 1 FROM public.luma_wallet_balances WHERE profile_id = p_to_profile_id FOR UPDATE;
  ELSE
    PERFORM 1 FROM public.luma_wallet_balances WHERE profile_id = p_to_profile_id FOR UPDATE;
    PERFORM 1 FROM public.luma_wallet_balances WHERE profile_id = p_from_profile_id FOR UPDATE;
  END IF;

  UPDATE public.luma_wallet_balances
  SET balance_lumens = balance_lumens - p_amount_lumens,
      updated_at = now()
  WHERE profile_id = p_from_profile_id
    AND balance_lumens >= p_amount_lumens;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_balance' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.luma_wallet_balances
  SET balance_lumens = balance_lumens + p_amount_lumens,
      updated_at = now()
  WHERE profile_id = p_to_profile_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'credit_failed' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.luma_ledger_entries (
    id,
    idempotency_key,
    from_profile_id,
    to_profile_id,
    amount_lumens,
    entry_kind,
    market_listing_id,
    memo
  ) VALUES (
    v_ledger_id,
    p_idempotency_key,
    p_from_profile_id,
    p_to_profile_id,
    p_amount_lumens,
    v_entry_kind,
    p_market_listing_id,
    p_memo
  );

  IF p_market_listing_id IS NOT NULL THEN
    UPDATE public.market_listings
    SET remaining_quantity = remaining_quantity - 1,
        status = CASE WHEN remaining_quantity - 1 < 1 THEN 'archived' ELSE status END,
        updated_at = now()
    WHERE id = p_market_listing_id
      AND remaining_quantity >= 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'listing_inventory_race' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN v_ledger_id;
END;
$$;
