import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { createLumaTransferIdempotencyKey, lumaTransferErrorMessageKey } from '@/lib/luma-transfer';
import { parseUserLumaInputToLumens } from '@/lib/monetary';

type Translate = (key: string, vars?: Record<string, string | number>) => string;

type PeerSendLumaDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromProfileId: string;
  onSent: () => void;
  t: Translate;
};

export function PeerSendLumaDialog({ open, onOpenChange, fromProfileId, onSent, t }: PeerSendLumaDialogProps) {
  const [username, setUsername] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const reset = () => {
    setUsername('');
    setAmountInput('');
    setMemo('');
    setLocalError(null);
  };

  const submit = async () => {
    setLocalError(null);
    const handle = username.trim();
    if (!handle) {
      setLocalError(t('market.peerSendUsernameRequired'));
      return;
    }
    const lumens = parseUserLumaInputToLumens(amountInput);
    if (lumens === null || lumens <= 0) {
      setLocalError(t('market.postOfferPriceRequired'));
      return;
    }

    setBusy(true);
    const { data: recipient, error: lookupError } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', handle)
      .is('deleted_at', null)
      .maybeSingle();

    if (lookupError || !recipient?.id) {
      setBusy(false);
      setLocalError(t('market.peerSendRecipientNotFound'));
      return;
    }

    if (recipient.id === fromProfileId) {
      setBusy(false);
      setLocalError(t('market.peerSendSelf'));
      return;
    }

    const idempotencyKey = createLumaTransferIdempotencyKey();
    const { data, error: rpcError } = await supabase.rpc('transfer_luma_between_profiles', {
      p_from_profile_id: fromProfileId,
      p_to_profile_id: recipient.id,
      p_amount_lumens: lumens,
      p_idempotency_key: idempotencyKey,
      p_market_listing_id: null,
      p_memo: memo.trim() ? memo.trim().slice(0, 500) : null,
    });
    setBusy(false);

    if (rpcError) {
      const key = lumaTransferErrorMessageKey(rpcError.message);
      setLocalError(t(`market.${key}`));
      return;
    }

    if (!data) {
      setLocalError(t('market.buyErrorGeneric'));
      return;
    }

    reset();
    onOpenChange(false);
    onSent();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('market.peerSendTitle')}</DialogTitle>
          <DialogDescription>{t('market.peerSendDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="peer-send-username">{t('market.peerSendUsernameLabel')}</Label>
            <Input
              id="peer-send-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
              placeholder={t('market.peerSendUsernamePlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="peer-send-amount">{t('market.postOfferFieldPrice')}</Label>
            <Input
              id="peer-send-amount"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              inputMode="decimal"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">{t('market.postOfferPriceHint')}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="peer-send-memo">{t('market.peerSendMemoLabel')}</Label>
            <Textarea id="peer-send-memo" value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={500} rows={2} />
          </div>
          {localError ? <p className="text-sm text-destructive">{localError}</p> : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t('market.postOfferCancel')}
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={busy}>
            {busy ? t('market.peerSendWorking') : t('market.peerSendSubmit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
