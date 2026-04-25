-- Foundational per-profile Luma balance (integer Lumens). Client reads only; writes stay server-side for now.

CREATE TABLE IF NOT EXISTS public.luma_wallet_balances (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance_lumens bigint NOT NULL DEFAULT 0 CHECK (balance_lumens >= 0),
  currency_code text NOT NULL DEFAULT 'LUMA' CHECK (currency_code = 'LUMA'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.luma_wallet_balances IS 'Non-negative Luma balance in whole Lumens (1 Luma = 100 Lumens). Ticker LUMA; client updates use controlled paths only.';

DROP TRIGGER IF EXISTS update_luma_wallet_balances_updated_at ON public.luma_wallet_balances;
CREATE TRIGGER update_luma_wallet_balances_updated_at
  BEFORE UPDATE ON public.luma_wallet_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.ensure_luma_wallet_balance_for_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.luma_wallet_balances (profile_id)
  VALUES (NEW.id)
  ON CONFLICT (profile_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_ensure_luma_wallet_balance ON public.profiles;
CREATE TRIGGER profiles_ensure_luma_wallet_balance
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_luma_wallet_balance_for_profile();

INSERT INTO public.luma_wallet_balances (profile_id)
SELECT p.id
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.luma_wallet_balances w WHERE w.profile_id = p.id
);

ALTER TABLE public.luma_wallet_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Citizens read own Luma balance" ON public.luma_wallet_balances;
CREATE POLICY "Citizens read own Luma balance"
  ON public.luma_wallet_balances
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles prof
      WHERE prof.id = luma_wallet_balances.profile_id
        AND prof.user_id = auth.uid()
    )
  );
