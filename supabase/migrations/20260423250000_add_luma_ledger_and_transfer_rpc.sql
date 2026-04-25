-- Append-only Luma ledger + idempotent transfer RPC (SECURITY DEFINER updates wallet balances).

CREATE TABLE IF NOT EXISTS public.luma_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL,
  from_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  to_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount_lumens bigint NOT NULL CHECK (amount_lumens > 0),
  entry_kind text NOT NULL CHECK (entry_kind IN ('peer_transfer', 'market_purchase')),
  market_listing_id uuid REFERENCES public.market_listings(id) ON DELETE SET NULL,
  memo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT luma_ledger_entries_idempotency_key_unique UNIQUE (idempotency_key),
  CONSTRAINT luma_ledger_entries_memo_len CHECK (memo IS NULL OR char_length(memo) <= 500),
  CONSTRAINT luma_ledger_entries_idempotency_len CHECK (char_length(idempotency_key) <= 200)
);

CREATE INDEX IF NOT EXISTS idx_luma_ledger_entries_from_created
  ON public.luma_ledger_entries (from_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_luma_ledger_entries_to_created
  ON public.luma_ledger_entries (to_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_luma_ledger_entries_listing
  ON public.luma_ledger_entries (market_listing_id)
  WHERE market_listing_id IS NOT NULL;

COMMENT ON TABLE public.luma_ledger_entries IS 'Append-only movement log; balances change only through transfer_luma_between_profiles.';

CREATE OR REPLACE FUNCTION public.prevent_luma_ledger_entries_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'luma_ledger_entries is append-only';
END;
$$;

DROP TRIGGER IF EXISTS prevent_luma_ledger_entries_update ON public.luma_ledger_entries;
CREATE TRIGGER prevent_luma_ledger_entries_update
  BEFORE UPDATE ON public.luma_ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_luma_ledger_entries_mutation();

DROP TRIGGER IF EXISTS prevent_luma_ledger_entries_delete ON public.luma_ledger_entries;
CREATE TRIGGER prevent_luma_ledger_entries_delete
  BEFORE DELETE ON public.luma_ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_luma_ledger_entries_mutation();

ALTER TABLE public.luma_ledger_entries ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.luma_ledger_entries TO authenticated;

DROP POLICY IF EXISTS "Ledger visible to sender or receiver" ON public.luma_ledger_entries;
CREATE POLICY "Ledger visible to sender or receiver"
  ON public.luma_ledger_entries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = luma_ledger_entries.from_profile_id AND p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = luma_ledger_entries.to_profile_id AND p.user_id = auth.uid()
    )
  );

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
    SELECT seller_profile_id, price_lumens, status
      INTO v_listing_seller, v_listing_price, v_listing_status
    FROM public.market_listings
    WHERE id = p_market_listing_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'listing_not_found' USING ERRCODE = '22023';
    END IF;
    IF v_listing_status IS DISTINCT FROM 'published' THEN
      RAISE EXCEPTION 'listing_not_published' USING ERRCODE = '22023';
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

  RETURN v_ledger_id;
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_luma_between_profiles(uuid, uuid, bigint, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_luma_between_profiles(uuid, uuid, bigint, text, uuid, text) TO authenticated;
