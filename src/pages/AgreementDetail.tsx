import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import type { AgreementRow } from '@/lib/agreements';
import { isMissingAgreementsBackend } from '@/lib/agreements-backend';
import { formatLumaFromLumens } from '@/lib/monetary';

type PartyRow = { id: string; full_name: string | null; username: string | null };

function partyLabel(row: PartyRow | undefined, t: (k: string) => string) {
  if (!row) return t('agreements.partyUnknown');
  return row.full_name?.trim() || row.username?.trim() || t('agreements.partyUnknown');
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function AgreementDetail() {
  const { agreementId } = useParams<{ agreementId: string }>();
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const amountLocale = language === 'en' ? 'en-US' : language;

  const [row, setRow] = useState<AgreementRow | null>(null);
  const [buyer, setBuyer] = useState<PartyRow | undefined>();
  const [seller, setSeller] = useState<PartyRow | undefined>();
  const [bodyDraft, setBodyDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [backendMissing, setBackendMissing] = useState(false);
  const [savingBody, setSavingBody] = useState(false);
  const [signing, setSigning] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    if (!agreementId || !UUID_RE.test(agreementId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setNotFound(false);

    const { data, error } = await supabase.from('agreements').select('*').eq('id', agreementId).maybeSingle();

    if (error) {
      if (isMissingAgreementsBackend(error)) {
        setBackendMissing(true);
      } else {
        toast.error(error.message);
      }
      setRow(null);
      setLoading(false);
      return;
    }

    if (!data) {
      setNotFound(true);
      setRow(null);
      setLoading(false);
      return;
    }

    const typed = data as AgreementRow;
    setRow(typed);
    setBodyDraft(typed.body_markdown);
    setBackendMissing(false);

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, username')
      .in('id', [typed.buyer_profile_id, typed.seller_profile_id]);

    const list = (profiles ?? []) as PartyRow[];
    setBuyer(list.find((p) => p.id === typed.buyer_profile_id));
    setSeller(list.find((p) => p.id === typed.seller_profile_id));
    setLoading(false);
  }, [agreementId]);

  useEffect(() => {
    void load();
  }, [load]);

  const isParty = useMemo(
    () => Boolean(profile?.id && row && (profile.id === row.buyer_profile_id || profile.id === row.seller_profile_id)),
    [profile?.id, row],
  );

  const role = useMemo(() => {
    if (!profile?.id || !row) return null;
    if (profile.id === row.buyer_profile_id) return 'buyer' as const;
    if (profile.id === row.seller_profile_id) return 'seller' as const;
    return null;
  }, [profile?.id, row]);

  const canEditBody = Boolean(row && row.status === 'draft' && isParty && !row.buyer_signed_at && !row.seller_signed_at);
  const canSign = Boolean(row && isParty && row.status !== 'signed' && row.status !== 'cancelled');
  const mySignaturePending = Boolean(
    row
      && isParty
      && ((role === 'buyer' && !row.buyer_signed_at) || (role === 'seller' && !row.seller_signed_at)),
  );
  const mySignDone =
    role === 'buyer' ? Boolean(row?.buyer_signed_at) : role === 'seller' ? Boolean(row?.seller_signed_at) : false;
  const canCancel = Boolean(row && isParty && row.status !== 'signed');

  const saveBody = async () => {
    if (!row || !canEditBody) return;
    setSavingBody(true);
    const { error } = await supabase.rpc('update_agreement_body', {
      p_agreement_id: row.id,
      p_body_markdown: bodyDraft,
    });
    setSavingBody(false);
    if (error) {
      toast.error(error.message || t('agreements.saveBodyError'));
      return;
    }
    toast.success(t('agreements.saveBodySuccess'));
    await load();
  };

  const sign = async () => {
    if (!row) return;
    setSigning(true);
    const { error } = await supabase.rpc('sign_agreement', { p_agreement_id: row.id });
    setSigning(false);
    if (error) {
      toast.error(error.message || t('agreements.signError'));
      return;
    }
    toast.success(t('agreements.signSuccess'));
    await load();
  };

  const cancel = async () => {
    if (!row) return;
    setCancelling(true);
    const { error } = await supabase.rpc('cancel_agreement', { p_agreement_id: row.id });
    setCancelling(false);
    if (error) {
      toast.error(error.message || t('agreements.cancelError'));
      return;
    }
    toast.success(t('agreements.cancelSuccess'));
    await load();
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">{t('common.loading')}</div>
      </AppLayout>
    );
  }

  if (backendMissing) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-2xl px-4 py-8">
          <Card className="rounded-2xl border-border/60 p-5 text-sm text-muted-foreground">
            {t('agreements.backendUnavailable')}
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (notFound || !row) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-md space-y-4 px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">{t('agreements.notFound')}</p>
          <Button type="button" variant="outline" asChild>
            <Link to="/agreements">{t('agreements.backToList')}</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  const priceLabel = formatLumaFromLumens(row.listing_price_lumens_snapshot, { locale: amountLocale });
  const statusKey = `agreements.status.${row.status}` as const;
  const statusText = t(statusKey) === statusKey ? row.status : t(statusKey);

  return (
    <AppLayout>
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link to="/agreements">{t('agreements.backToList')}</Link>
          </Button>
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link to="/market">{t('agreements.backToMarket')}</Link>
          </Button>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-display font-bold text-foreground">{row.listing_title_snapshot}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('agreements.metaPrice', { price: priceLabel })} · {t('agreements.metaTemplate', { key: row.template_key })}
            </p>
          </div>
          <Badge variant="secondary">{statusText}</Badge>
        </div>

        <Card className="rounded-2xl border-border/60 p-4 text-sm shadow-sm">
          <p>
            <span className="text-muted-foreground">{t('agreements.roleBuyer')}:</span> {partyLabel(buyer, t)}
          </p>
          <p className="mt-1">
            <span className="text-muted-foreground">{t('agreements.roleSeller')}:</span> {partyLabel(seller, t)}
          </p>
          {row.market_listing_id ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {t('agreements.linkedListing')}{' '}
              <Link to="/market" className="font-medium text-primary underline-offset-2 hover:underline">
                {t('agreements.viewMarket')}
              </Link>
            </p>
          ) : null}
        </Card>

        {row.status === 'signed' && row.signed_snapshot ? (
          <Card className="rounded-2xl border-border/60 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('agreements.signedSnapshotTitle')}</p>
            <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-muted/40 p-3 text-xs">
              {JSON.stringify(row.signed_snapshot, null, 2)}
            </pre>
          </Card>
        ) : null}

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">{t('agreements.bodyLabel')}</p>
          {canEditBody ? (
            <Textarea value={bodyDraft} onChange={(e) => setBodyDraft(e.target.value)} className="min-h-[220px] font-mono text-sm" />
          ) : (
            <div className="whitespace-pre-wrap rounded-xl border border-border/60 bg-muted/20 p-4 text-sm leading-relaxed">
              {row.body_markdown}
            </div>
          )}
        </div>

        {canEditBody ? (
          <Button type="button" onClick={() => void saveBody()} disabled={savingBody || bodyDraft.trim() === row.body_markdown.trim()}>
            {savingBody ? t('agreements.savingBody') : t('agreements.saveBody')}
          </Button>
        ) : null}

        {row.status !== 'signed' && row.status !== 'cancelled' ? (
          <Card className="rounded-2xl border-border/60 p-4 text-sm shadow-sm">
            <p className="text-muted-foreground">{t('agreements.signProgress')}</p>
            <p className="mt-2">
              {t('agreements.signBuyer')}: {row.buyer_signed_at ? t('agreements.signedYes') : t('agreements.signedNo')}
            </p>
            <p className="mt-1">
              {t('agreements.signSeller')}: {row.seller_signed_at ? t('agreements.signedYes') : t('agreements.signedNo')}
            </p>
          </Card>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {canSign && mySignaturePending ? (
            <Button type="button" onClick={() => void sign()} disabled={signing}>
              {signing ? t('agreements.signWorking') : t('agreements.signAction')}
            </Button>
          ) : null}
          {canSign && mySignDone && row.status === 'pending_counterparty' ? (
            <p className="self-center text-sm text-muted-foreground">{t('agreements.waitingOtherParty')}</p>
          ) : null}
          {!isParty ? (
            <p className="text-sm text-muted-foreground">{t('agreements.readOnlyVisitor')}</p>
          ) : null}
          {canCancel ? (
            <Button type="button" variant="outline" onClick={() => void cancel()} disabled={cancelling}>
              {cancelling ? t('agreements.cancelWorking') : t('agreements.cancelAction')}
            </Button>
          ) : null}
        </div>
      </div>
    </AppLayout>
  );
}
