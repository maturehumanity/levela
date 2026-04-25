import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

type MarketListingArchiveButtonProps = {
  listingId: string;
  sellerProfileId: string;
  label: string;
  workingLabel: string;
  onArchived: () => void;
  className?: string;
};

export function MarketListingArchiveButton({
  listingId,
  sellerProfileId,
  label,
  workingLabel,
  onArchived,
  className,
}: MarketListingArchiveButtonProps) {
  const [busy, setBusy] = useState(false);

  const archive = async () => {
    setBusy(true);
    const { error } = await supabase
      .from('market_listings')
      .update({ status: 'archived' })
      .eq('id', listingId)
      .eq('seller_profile_id', sellerProfileId);
    setBusy(false);
    if (!error) {
      onArchived();
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className ?? 'h-8 text-muted-foreground'}
      disabled={busy}
      onClick={() => void archive()}
    >
      {busy ? workingLabel : label}
    </Button>
  );
}
