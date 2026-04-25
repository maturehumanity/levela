-- Allow treasury mint rows (no sender profile) and add mint RPC for market operators.

ALTER TABLE public.luma_ledger_entries DROP CONSTRAINT IF EXISTS luma_ledger_entries_entry_kind_check;
ALTER TABLE public.luma_ledger_entries
  ADD CONSTRAINT luma_ledger_entries_entry_kind_check
  CHECK (entry_kind IN ('peer_transfer', 'market_purchase', 'treasury_mint'));

ALTER TABLE public.luma_ledger_entries DROP CONSTRAINT IF EXISTS luma_ledger_entries_from_profile_id_fkey;
ALTER TABLE public.luma_ledger_entries
  ALTER COLUMN from_profile_id DROP NOT NULL;
ALTER TABLE public.luma_ledger_entries
  ADD CONSTRAINT luma_ledger_entries_from_profile_id_fkey
  FOREIGN KEY (from_profile_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.luma_ledger_entries DROP CONSTRAINT IF EXISTS luma_ledger_entries_from_kind_consistency;
ALTER TABLE public.luma_ledger_entries
  ADD CONSTRAINT luma_ledger_entries_from_kind_consistency CHECK (
    (entry_kind = 'treasury_mint' AND from_profile_id IS NULL)
    OR (entry_kind <> 'treasury_mint' AND from_profile_id IS NOT NULL)
  );

DROP POLICY IF EXISTS "Ledger visible to sender or receiver" ON public.luma_ledger_entries;
CREATE POLICY "Ledger visible to sender or receiver"
  ON public.luma_ledger_entries
  FOR SELECT
  USING (
    (
      from_profile_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = luma_ledger_entries.from_profile_id AND p.user_id = auth.uid()
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = luma_ledger_entries.to_profile_id AND p.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.mint_luma_to_profile(
  p_target_profile_id uuid,
  p_amount_lumens bigint,
  p_idempotency_key text,
  p_memo text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ledger_id uuid := gen_random_uuid();
  v_existing uuid;
BEGIN
  IF NOT public.has_permission('market.manage'::public.app_permission) THEN
    RAISE EXCEPTION 'forbidden_mint' USING ERRCODE = '42501';
  END IF;

  IF p_amount_lumens IS NULL OR p_amount_lumens <= 0 THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = '22023';
  END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) < 8 OR length(p_idempotency_key) > 200 THEN
    RAISE EXCEPTION 'invalid_idempotency_key' USING ERRCODE = '22023';
  END IF;
  IF p_memo IS NOT NULL AND length(p_memo) > 500 THEN
    RAISE EXCEPTION 'memo_too_long' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_target_profile_id) THEN
    RAISE EXCEPTION 'target_profile_not_found' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(884291218, hashtext(p_idempotency_key));

  SELECT id INTO v_existing FROM public.luma_ledger_entries WHERE idempotency_key = p_idempotency_key LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  INSERT INTO public.luma_wallet_balances (profile_id) VALUES (p_target_profile_id) ON CONFLICT (profile_id) DO NOTHING;

  PERFORM 1 FROM public.luma_wallet_balances WHERE profile_id = p_target_profile_id FOR UPDATE;

  UPDATE public.luma_wallet_balances
  SET balance_lumens = balance_lumens + p_amount_lumens,
      updated_at = now()
  WHERE profile_id = p_target_profile_id;
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
    NULL,
    p_target_profile_id,
    p_amount_lumens,
    'treasury_mint',
    NULL,
    p_memo
  );

  RETURN v_ledger_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mint_luma_to_profile(uuid, bigint, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mint_luma_to_profile(uuid, bigint, text, text) TO authenticated;
