import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileSignature } from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import type { AgreementRow } from '@/lib/agreements';
import { isMissingAgreementsBackend } from '@/lib/agreements-backend';

export default function Agreements() {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const [rows, setRows] = useState<AgreementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [backendMissing, setBackendMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile?.id) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const { data, error: qError } = await supabase
      .from('agreements')
      .select('*')
      .or(`buyer_profile_id.eq.${profile.id},seller_profile_id.eq.${profile.id}`)
      .order('created_at', { ascending: false });

    if (qError) {
      if (isMissingAgreementsBackend(qError)) {
        setBackendMissing(true);
      } else {
        setError(qError.message);
      }
      setRows([]);
      setLoading(false);
      return;
    }

    setBackendMissing(false);
    setRows((data ?? []) as AgreementRow[]);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const statusLabel = (status: string) => {
    const key = `agreements.status.${status}` as const;
    const translated = t(key);
    return translated === key ? status : translated;
  };

  return (
    <AppLayout>
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-primary/10 p-3 text-primary">
            <FileSignature className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">{t('agreements.listTitle')}</h1>
            <p className="text-sm text-muted-foreground">{t('agreements.listSubtitle')}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link to="/market">{t('agreements.backToMarket')}</Link>
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : backendMissing ? (
          <Card className="rounded-2xl border-border/60 p-5 text-sm text-muted-foreground">
            {t('agreements.backendUnavailable')}
          </Card>
        ) : error ? (
          <Card className="rounded-2xl border-destructive/40 p-5 text-sm text-destructive">{error}</Card>
        ) : rows.length === 0 ? (
          <Card className="rounded-2xl border-border/60 p-8 text-center text-sm text-muted-foreground">
            {t('agreements.listEmpty')}
          </Card>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => (
              <li key={row.id}>
                <Link to={`/agreements/${row.id}`}>
                  <Card className="rounded-2xl border-border/60 p-4 shadow-sm transition-colors hover:bg-muted/30">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <p className="font-medium text-foreground">{row.listing_title_snapshot}</p>
                        <p className="text-xs text-muted-foreground">
                          {t('agreements.listRowTemplate', { key: row.template_key })}
                        </p>
                      </div>
                      <Badge variant="secondary">{statusLabel(row.status)}</Badge>
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppLayout>
  );
}
