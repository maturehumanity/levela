import { motion } from 'framer-motion';
import { ArrowLeft, Coins } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { createLumaTransferIdempotencyKey, lumaTransferErrorMessageKey } from '@/lib/luma-transfer';
import { parseUserLumaInputToLumens } from '@/lib/monetary';
import { useLanguage } from '@/contexts/LanguageContext';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function LumaCreditsAdmin() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [username, setUsername] = useState('');
  const [profileIdRaw, setProfileIdRaw] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const resolveTargetProfileId = async (): Promise<string | null> => {
    const u = username.trim();
    if (u) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', u)
        .is('deleted_at', null)
        .maybeSingle();
      if (error || !data?.id) return null;
      return data.id;
    }
    const id = profileIdRaw.trim();
    if (!UUID_RE.test(id)) return null;
    const { data, error } = await supabase.from('profiles').select('id').eq('id', id).is('deleted_at', null).maybeSingle();
    if (error || !data?.id) return null;
    return data.id;
  };

  const mint = async () => {
    setLocalError(null);
    setSuccess(null);
    if (!username.trim() && !profileIdRaw.trim()) {
      setLocalError(t('settings.lumaMintRecipientRequired'));
      return;
    }
    const lumens = parseUserLumaInputToLumens(amountInput);
    if (lumens === null || lumens <= 0) {
      setLocalError(t('settings.lumaMintAmountInvalid'));
      return;
    }

    setBusy(true);
    const targetId = await resolveTargetProfileId();
    if (!targetId) {
      setBusy(false);
      setLocalError(t('settings.lumaMintRecipientInvalid'));
      return;
    }

    const idempotencyKey = createLumaTransferIdempotencyKey();
    const { data, error: rpcError } = await supabase.rpc('mint_luma_to_profile', {
      p_target_profile_id: targetId,
      p_amount_lumens: lumens,
      p_idempotency_key: idempotencyKey,
      p_memo: memo.trim() ? memo.trim().slice(0, 500) : null,
    });
    setBusy(false);

    if (rpcError) {
      const key = lumaTransferErrorMessageKey(rpcError.message);
      if (key === 'lumaMintForbidden') {
        setLocalError(t('settings.lumaMintForbidden'));
      } else if (key === 'lumaMintRecipient') {
        setLocalError(t('settings.lumaMintRecipientInvalid'));
      } else {
        setLocalError(t(`market.${key}`));
      }
      return;
    }

    if (!data) {
      setLocalError(t('market.buyErrorGeneric'));
      return;
    }

    setSuccess(t('settings.lumaMintSuccess'));
    setUsername('');
    setProfileIdRaw('');
    setAmountInput('');
    setMemo('');
  };

  return (
    <AppLayout>
      <div className="space-y-6 px-4 py-6">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <Button type="button" variant="ghost" className="mb-2 gap-2 px-0" onClick={() => navigate('/settings')}>
            <ArrowLeft className="h-4 w-4" />
            {t('settings.lumaMintBack')}
          </Button>
          <div className="flex items-start gap-3">
            <Coins className="mt-1 h-10 w-10 shrink-0 text-primary/80" aria-hidden />
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">{t('settings.lumaMintTitle')}</h1>
              <p className="text-sm text-muted-foreground">{t('settings.lumaMintSubtitle')}</p>
            </div>
          </div>
        </motion.div>

        <Card className="border-border/70 p-5 shadow-sm">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="luma-mint-username">{t('settings.lumaMintUsernameLabel')}</Label>
              <Input
                id="luma-mint-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">{t('settings.lumaMintUsernameHint')}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="luma-mint-profile-id">{t('settings.lumaMintProfileIdLabel')}</Label>
              <Input
                id="luma-mint-profile-id"
                value={profileIdRaw}
                onChange={(e) => setProfileIdRaw(e.target.value)}
                autoComplete="off"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
              <p className="text-xs text-muted-foreground">{t('settings.lumaMintProfileIdHint')}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="luma-mint-amount">{t('settings.lumaMintAmountLabel')}</Label>
              <Input
                id="luma-mint-amount"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                inputMode="decimal"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="luma-mint-memo">{t('settings.lumaMintMemoLabel')}</Label>
              <Textarea id="luma-mint-memo" value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={500} rows={2} />
            </div>
            {localError ? <p className="text-sm text-destructive">{localError}</p> : null}
            {success ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p> : null}
            <Button type="button" onClick={() => void mint()} disabled={busy}>
              {busy ? t('settings.lumaMintWorking') : t('settings.lumaMintSubmit')}
            </Button>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
