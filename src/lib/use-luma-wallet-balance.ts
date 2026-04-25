import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type LumaWalletBalanceState = {
  balanceLumens: number | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

/**
 * Read the signed-in citizen's Luma balance (whole Lumens). Returns null when signed out or row missing.
 */
export function useLumaWalletBalance(): LumaWalletBalanceState {
  const { profile, user } = useAuth();
  const [balanceLumens, setBalanceLumens] = useState<number | null>(null);
  const [loading, setLoading] = useState(Boolean(user));
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!user?.id || !profile?.id) {
      setBalanceLumens(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('luma_wallet_balances')
      .select('balance_lumens')
      .eq('profile_id', profile.id)
      .maybeSingle();

    if (fetchError) {
      setBalanceLumens(null);
      setError(fetchError.message);
    } else if (data && data.balance_lumens != null) {
      const n = typeof data.balance_lumens === 'string' ? Number(data.balance_lumens) : data.balance_lumens;
      if (Number.isFinite(n) && Number.isInteger(n) && n >= 0) {
        setBalanceLumens(n);
      } else {
        setBalanceLumens(null);
      }
    } else {
      setBalanceLumens(null);
    }

    setLoading(false);
  }, [profile?.id, user?.id]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { balanceLumens, loading, error, refetch };
}
