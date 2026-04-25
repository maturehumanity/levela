import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/integrations/supabase/client';

export type LedgerParty = { username: string | null; full_name: string | null } | null;

export type LumaLedgerActivityRow = {
  id: string;
  amount_lumens: number;
  entry_kind: string;
  created_at: string;
  market_listing_id: string | null;
  memo: string | null;
  from_profile_id: string | null;
  to_profile_id: string;
  from_party: LedgerParty | LedgerParty[] | null;
  to_party: LedgerParty | LedgerParty[] | null;
};

function one<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function coerceAmount(raw: unknown): number {
  if (typeof raw === 'string') return Number(raw);
  if (typeof raw === 'number') return raw;
  return Number.NaN;
}

export function useLumaLedgerActivity(profileId: string | undefined) {
  const [rows, setRows] = useState<LumaLedgerActivityRow[]>([]);
  const [loading, setLoading] = useState(Boolean(profileId));
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!profileId) {
      setRows([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('luma_ledger_entries')
      .select(
        `
        id,
        amount_lumens,
        entry_kind,
        created_at,
        market_listing_id,
        memo,
        from_profile_id,
        to_profile_id,
        from_party:profiles!luma_ledger_entries_from_profile_id_fkey(username, full_name),
        to_party:profiles!luma_ledger_entries_to_profile_id_fkey(username, full_name)
      `,
      )
      .or(`from_profile_id.eq.${profileId},to_profile_id.eq.${profileId}`)
      .order('created_at', { ascending: false })
      .limit(40);

    if (fetchError) {
      setRows([]);
      setError(fetchError.message);
    } else {
      const parsed = (data ?? []) as LumaLedgerActivityRow[];
      setRows(
        parsed.map((row) => ({
          ...row,
          amount_lumens: coerceAmount(row.amount_lumens as unknown),
          from_party: one(row.from_party as LedgerParty | LedgerParty[] | null),
          to_party: one(row.to_party as LedgerParty | LedgerParty[] | null),
        })),
      );
    }

    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { rows, loading, error, refetch };
}
