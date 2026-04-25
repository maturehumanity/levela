import type { Dispatch, SetStateAction } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import type { Database } from '@/integrations/supabase/types';
import {
  getGovernanceSanctionAppealStatusLabelKey,
  getGovernanceSanctionScopeLabelKey,
  getGovernanceSanctionScopeOptionFromRow,
} from '@/lib/governance-sanctions';

type GovernanceSanctionRow = Database['public']['Tables']['governance_sanctions']['Row'];
type GovernanceSanctionAppealRow = Database['public']['Tables']['governance_sanction_appeals']['Row'];
type AppealDraftBySanctionId = Record<string, { reason: string; evidence: string }>;

export type GovernanceHubSanctionsSectionProps = {
  t: (key: string, vars?: Record<string, string | number>) => string;
  formatDateTime: (value: string | null) => string;
  sanctionsBackendUnavailable: boolean;
  activeSanctions: GovernanceSanctionRow[];
  openAppealsBySanctionId: Record<string, GovernanceSanctionAppealRow>;
  appealDraftBySanctionId: AppealDraftBySanctionId;
  setAppealDraftBySanctionId: Dispatch<SetStateAction<AppealDraftBySanctionId>>;
  submittingAppealForSanctionId: string | null;
  onSubmitAppeal: (sanction: GovernanceSanctionRow) => Promise<void>;
  appeals: GovernanceSanctionAppealRow[];
};

export function GovernanceHubSanctionsSection({
  t,
  formatDateTime,
  sanctionsBackendUnavailable,
  activeSanctions,
  openAppealsBySanctionId,
  appealDraftBySanctionId,
  setAppealDraftBySanctionId,
  submittingAppealForSanctionId,
  onSubmitAppeal,
  appeals,
}: GovernanceHubSanctionsSectionProps) {
  return (
    <Card className="rounded-3xl border-border/60 p-5 shadow-sm">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">{t('governanceHub.sanctionsTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('governanceHub.sanctionsDescription')}</p>
      </div>

      {sanctionsBackendUnavailable ? (
        <p className="mt-4 text-sm text-muted-foreground">{t('governanceHub.backendUnavailable')}</p>
      ) : (
        <div className="mt-4 space-y-4">
          {activeSanctions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('governanceHub.activeSanctionsEmpty')}</p>
          ) : (
            activeSanctions.map((sanction) => {
              const scope = getGovernanceSanctionScopeOptionFromRow(sanction);
              const openAppeal = openAppealsBySanctionId[sanction.id] || null;
              const draft = appealDraftBySanctionId[sanction.id] || { reason: '', evidence: '' };
              const canSubmitAppeal = !openAppeal;

              return (
                <div key={sanction.id} className="space-y-3 rounded-2xl border border-border/60 bg-background/70 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="rounded-full">
                      {t(getGovernanceSanctionScopeLabelKey(scope))}
                    </Badge>
                    {openAppeal && (
                      <Badge variant="secondary" className="rounded-full bg-primary/10 text-primary hover:bg-primary/10">
                        {t(getGovernanceSanctionAppealStatusLabelKey(openAppeal.status))}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{t('governanceHub.sanctionReasonLabel')}:</span> {sanction.reason}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('governanceHub.sanctionStartsAtLabel')}: {formatDateTime(sanction.starts_at)}
                    {' • '}
                    {t('governanceHub.sanctionEndsAtLabel')}: {sanction.ends_at ? formatDateTime(sanction.ends_at) : '—'}
                  </p>

                  {openAppeal ? (
                    <p className="text-sm text-muted-foreground">{t('governanceHub.appealAlreadyOpen')}</p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">{t('governanceHub.appealsTitle')}</p>
                      <label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{t('governanceHub.appealReasonLabel')}</label>
                      <Textarea
                        value={draft.reason}
                        placeholder={t('governanceHub.appealReasonPlaceholder')}
                        onChange={(event) => {
                          const value = event.target.value;
                          setAppealDraftBySanctionId((current) => ({
                            ...current,
                            [sanction.id]: {
                              ...draft,
                              reason: value,
                            },
                          }));
                        }}
                      />
                      <label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{t('governanceHub.appealEvidenceLabel')}</label>
                      <Textarea
                        value={draft.evidence}
                        placeholder={t('governanceHub.appealEvidencePlaceholder')}
                        onChange={(event) => {
                          const value = event.target.value;
                          setAppealDraftBySanctionId((current) => ({
                            ...current,
                            [sanction.id]: {
                              ...draft,
                              evidence: value,
                            },
                          }));
                        }}
                      />
                      <Button
                        className="w-full md:w-auto"
                        disabled={!canSubmitAppeal || submittingAppealForSanctionId === sanction.id}
                        onClick={() => void onSubmitAppeal(sanction)}
                      >
                        {submittingAppealForSanctionId === sanction.id ? t('common.saving') : t('governanceHub.appealSubmit')}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">{t('governanceHub.appealsTitle')}</h3>
            {appeals.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('governanceHub.appealsEmpty')}</p>
            ) : (
              <div className="space-y-2">
                {appeals.map((appeal) => (
                  <div key={appeal.id} className="rounded-2xl border border-border/60 bg-background/70 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="rounded-full text-[11px]">
                        {t(getGovernanceSanctionAppealStatusLabelKey(appeal.status))}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-foreground">{appeal.appeal_reason}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(appeal.opened_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
