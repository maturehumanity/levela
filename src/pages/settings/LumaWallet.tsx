import { motion } from 'framer-motion';
import { ArrowLeft, Coins, Wallet } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { MarketLumaActivitySection } from '@/components/market/MarketLumaActivitySection';
import { PeerSendLumaDialog } from '@/components/market/PeerSendLumaDialog';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatLumaFromLumens } from '@/lib/monetary';
import { useLumaWalletBalance } from '@/lib/use-luma-wallet-balance';

export default function LumaWallet() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { profile, loading: authLoading } = useAuth();
  const { balanceLumens, loading: balanceLoading, error: balanceError, refetch: refetchBalance } = useLumaWalletBalance();
  const [peerOpen, setPeerOpen] = useState(false);
  const [ledgerTick, setLedgerTick] = useState(0);
  const bumpLedger = useCallback(() => setLedgerTick((n) => n + 1), []);
  const refreshMoney = useCallback(() => {
    void refetchBalance();
    bumpLedger();
  }, [refetchBalance, bumpLedger]);
  const amountLocale = language === 'en' ? 'en-US' : language;

  if (authLoading) {
    return (
      <AppLayout>
        <div className="flex min-h-[40vh] items-center justify-center px-4">
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        </div>
      </AppLayout>
    );
  }

  if (!profile?.id) {
    return (
      <AppLayout>
        <div className="px-4 py-6">
          <p className="text-sm text-muted-foreground">{t('settings.lumaWalletSignIn')}</p>
          <Button type="button" variant="link" className="mt-2 px-0" onClick={() => navigate('/settings')}>
            {t('settings.lumaWalletBack')}
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 px-4 py-6" data-build-key="lumaWalletPage" data-build-label="Luma wallet page">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => navigate('/settings')}
            aria-label={t('settings.lumaWalletBack')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-display font-bold text-foreground">{t('settings.lumaWalletPageTitle')}</h1>
            <p className="text-sm text-muted-foreground">{t('settings.lumaWalletPageSubtitle')}</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          data-build-key="lumaWalletBalance"
          data-build-label="Luma balance"
        >
          <Card className="border-border/70 bg-card/95 p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <Coins className="mt-0.5 h-9 w-9 shrink-0 text-primary/80" aria-hidden />
              <div className="min-w-0 flex-1 space-y-1">
                <h2 className="text-base font-semibold text-foreground">{t('market.lumaBalanceTitle')}</h2>
                {balanceLoading ? (
                  <p className="text-sm text-muted-foreground">{t('market.lumaBalanceLoading')}</p>
                ) : balanceError ? (
                  <p className="text-sm text-destructive">{t('market.lumaBalanceUnavailable')}</p>
                ) : balanceLumens !== null ? (
                  <p className="text-2xl font-semibold tracking-tight text-foreground">
                    {formatLumaFromLumens(balanceLumens, { locale: amountLocale })}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('market.lumaBalanceUnavailable')}</p>
                )}
                <p className="text-xs text-muted-foreground">{t('market.lumaBalanceHint')}</p>
                <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => setPeerOpen(true)}>
                  {t('market.sendLumaButton')}
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          data-build-key="lumaWalletMarketLink"
          data-build-label="Link to marketplace"
        >
          <Button type="button" variant="outline" className="w-full justify-center gap-2" asChild>
            <Link to="/market">{t('settings.lumaWalletOpenMarket')}</Link>
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          data-build-key="lumaWalletActivity"
          data-build-label="Luma activity"
        >
          <MarketLumaActivitySection
            key={`ledger-${profile.id}-${ledgerTick}`}
            profileId={profile.id}
            amountLocale={amountLocale}
            t={t}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          data-build-key="lumaWalletPaymentsInfo"
          data-build-label="Luma payments help"
        >
          <Card className="border-border/70 bg-card/95 p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <Wallet className="mt-0.5 h-9 w-9 shrink-0 text-primary/70" aria-hidden />
              <div className="min-w-0 space-y-2">
                <h2 className="text-base font-semibold text-foreground">{t('market.paymentsInfoTitle')}</h2>
                <p className="text-sm text-muted-foreground">{t('market.paymentsInfoBody')}</p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      <PeerSendLumaDialog
        open={peerOpen}
        onOpenChange={setPeerOpen}
        fromProfileId={profile.id}
        onSent={refreshMoney}
        t={t}
      />
    </AppLayout>
  );
}
