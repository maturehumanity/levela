import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  getGovernanceSanctionAppealStatusLabelKey,
  getGovernanceSanctionScopeLabelKey,
  getGovernanceSanctionScopeOptionFromRow,
  governanceSanctionScopeOptions,
  isAppealOpen,
  isGovernanceSanctionCurrentlyActive,
  type GovernanceSanctionAppealStatus,
  type GovernanceSanctionScopeOption,
} from '@/lib/governance-sanctions';
import type { GovernanceSanctionAppealRow, GovernanceSanctionRow, ProfileRow } from '@/lib/users-admin';

type UsersAdminGovernanceSanctionsCardProps = {
  selectedUser: ProfileRow;
  selectedUserSanctions: GovernanceSanctionRow[];
  selectedUserAppeals: GovernanceSanctionAppealRow[];
  sanctionSavingUserId: string | null;
  appealSavingId: string | null;
  t: (key: string, vars?: Record<string, string | number>) => string;
  formatDate: (value: string) => string;
  handleIssueSanction: (args: {
    targetUser: ProfileRow;
    scope: GovernanceSanctionScopeOption;
    reason: string;
    notes: string;
    durationDays: number | null;
  }) => Promise<boolean>;
  handleLiftSanction: (sanction: GovernanceSanctionRow) => Promise<boolean>;
  handleSaveAppeal: (args: {
    appeal: GovernanceSanctionAppealRow;
    status: GovernanceSanctionAppealStatus;
    resolutionNotes: string;
  }) => Promise<boolean>;
};

export function UsersAdminGovernanceSanctionsCard({
  selectedUser,
  selectedUserSanctions,
  selectedUserAppeals,
  sanctionSavingUserId,
  appealSavingId,
  t,
  formatDate,
  handleIssueSanction,
  handleLiftSanction,
  handleSaveAppeal,
}: UsersAdminGovernanceSanctionsCardProps) {
  const [sanctionScope, setSanctionScope] = useState<GovernanceSanctionScopeOption>('all');
  const [sanctionDurationDays, setSanctionDurationDays] = useState('');
  const [sanctionReason, setSanctionReason] = useState('');
  const [sanctionNotes, setSanctionNotes] = useState('');
  const [appealDrafts, setAppealDrafts] = useState<Record<string, {
    status: GovernanceSanctionAppealStatus;
    resolutionNotes: string;
  }>>({});

  const activeSanctions = useMemo(
    () => selectedUserSanctions.filter((sanction) => isGovernanceSanctionCurrentlyActive(sanction)),
    [selectedUserSanctions],
  );
  const openAppealCountBySanctionId = useMemo(() => {
    return selectedUserAppeals.reduce<Record<string, number>>((accumulator, appeal) => {
      if (!isAppealOpen(appeal.status)) return accumulator;
      accumulator[appeal.sanction_id] = (accumulator[appeal.sanction_id] || 0) + 1;
      return accumulator;
    }, {});
  }, [selectedUserAppeals]);
  const sortedAppeals = useMemo(
    () =>
      [...selectedUserAppeals].sort(
        (a, b) => new Date(b.opened_at || b.created_at).getTime() - new Date(a.opened_at || a.created_at).getTime(),
      ),
    [selectedUserAppeals],
  );
  const sanctionById = useMemo(
    () => Object.fromEntries(selectedUserSanctions.map((sanction) => [sanction.id, sanction])) as Record<string, GovernanceSanctionRow>,
    [selectedUserSanctions],
  );

  const handleIssueSanctionClick = async () => {
    const durationDaysValue = sanctionDurationDays.trim();
    const parsedDuration = durationDaysValue ? Number.parseInt(durationDaysValue, 10) : Number.NaN;
    const durationDays = Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : null;

    const issued = await handleIssueSanction({
      targetUser: selectedUser,
      scope: sanctionScope,
      reason: sanctionReason,
      notes: sanctionNotes,
      durationDays,
    });

    if (!issued) return;

    setSanctionReason('');
    setSanctionNotes('');
    setSanctionDurationDays('');
    setSanctionScope('all');
  };

  return (
    <>
      <Card className="rounded-3xl border-border/60 p-4 shadow-none">
        <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t('admin.users.sanctionsTitle')}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{t('admin.users.sanctionsSubtitle')}</p>

        <div className="mt-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t('admin.users.activeSanctionsTitle')}</p>
          {activeSanctions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('admin.users.activeSanctionsEmpty')}</p>
          ) : (
            activeSanctions.map((sanction) => {
              const sanctionScopeOption = getGovernanceSanctionScopeOptionFromRow(sanction);
              const openAppeals = openAppealCountBySanctionId[sanction.id] || 0;

              return (
                <div key={sanction.id} className="space-y-2 rounded-2xl border border-border/60 bg-background/70 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="rounded-full text-[11px]">
                      {t(getGovernanceSanctionScopeLabelKey(sanctionScopeOption))}
                    </Badge>
                    {openAppeals > 0 && (
                      <Badge variant="secondary" className="rounded-full bg-primary/10 text-primary hover:bg-primary/10">
                        {t('governanceHub.sanctionAppealOpenBadge')}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-foreground">{sanction.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('governanceHub.sanctionStartsAtLabel')}: {formatDate(sanction.starts_at)}
                    {' • '}
                    {t('governanceHub.sanctionEndsAtLabel')}: {sanction.ends_at ? formatDate(sanction.ends_at) : '—'}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={sanctionSavingUserId === selectedUser.id}
                    onClick={() => void handleLiftSanction(sanction)}
                  >
                    {sanctionSavingUserId === selectedUser.id ? t('admin.users.liftingSanction') : t('admin.users.liftSanction')}
                  </Button>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-4 space-y-3">
          <div className="space-y-2">
            <Label>{t('admin.users.sanctionScopeLabel')}</Label>
            <Select value={sanctionScope} onValueChange={(value) => setSanctionScope(value as GovernanceSanctionScopeOption)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {governanceSanctionScopeOptions.map((scope) => (
                  <SelectItem key={scope} value={scope}>{t(getGovernanceSanctionScopeLabelKey(scope))}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('admin.users.sanctionDurationDaysLabel')}</Label>
            <Input
              inputMode="numeric"
              placeholder={t('admin.users.sanctionDurationDaysPlaceholder')}
              value={sanctionDurationDays}
              onChange={(event) => setSanctionDurationDays(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('admin.users.sanctionReasonLabel')}</Label>
            <Textarea
              value={sanctionReason}
              onChange={(event) => setSanctionReason(event.target.value)}
              placeholder={t('admin.users.sanctionReasonPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('admin.users.sanctionNotesLabel')}</Label>
            <Textarea
              value={sanctionNotes}
              onChange={(event) => setSanctionNotes(event.target.value)}
              placeholder={t('admin.users.sanctionNotesPlaceholder')}
            />
          </div>
          <Button
            className="w-full"
            onClick={() => void handleIssueSanctionClick()}
            disabled={sanctionSavingUserId === selectedUser.id || !sanctionReason.trim()}
          >
            {sanctionSavingUserId === selectedUser.id ? t('admin.users.issuingSanction') : t('admin.users.issueSanction')}
          </Button>
        </div>
      </Card>

      <Card className="rounded-3xl border-border/60 p-4 shadow-none">
        <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t('admin.users.appealsTitle')}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{t('admin.users.appealsSubtitle')}</p>
        <div className="mt-4 space-y-3">
          {sortedAppeals.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('admin.users.appealsEmpty')}</p>
          ) : (
            sortedAppeals.map((appeal) => {
              const sanction = sanctionById[appeal.sanction_id];
              const scope = sanction ? getGovernanceSanctionScopeOptionFromRow(sanction) : null;
              const draft = appealDrafts[appeal.id] || {
                status: appeal.status,
                resolutionNotes: appeal.resolution_notes || '',
              };
              const editable = isAppealOpen(appeal.status);

              return (
                <div key={appeal.id} className="space-y-3 rounded-2xl border border-border/60 bg-background/70 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="rounded-full text-[11px]">
                      {t(getGovernanceSanctionAppealStatusLabelKey(appeal.status))}
                    </Badge>
                    {scope && (
                      <Badge variant="secondary" className="rounded-full bg-primary/10 text-primary hover:bg-primary/10">
                        {t(getGovernanceSanctionScopeLabelKey(scope))}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-foreground">{appeal.appeal_reason}</p>
                  {appeal.evidence_notes && (
                    <p className="text-xs text-muted-foreground">
                      {t('admin.users.appealEvidenceLabel')}: {appeal.evidence_notes}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {t('governanceHub.sanctionStartsAtLabel')}: {formatDate(appeal.opened_at)}
                  </p>
                  {editable && (
                    <div className="space-y-2">
                      <Label>{t('admin.users.appealStatusLabel')}</Label>
                      <Select
                        value={draft.status}
                        onValueChange={(value) => {
                          setAppealDrafts((current) => ({
                            ...current,
                            [appeal.id]: {
                              ...draft,
                              status: value as GovernanceSanctionAppealStatus,
                            },
                          }));
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="under_review">{t('governanceSanctions.appealStatuses.under_review')}</SelectItem>
                          <SelectItem value="accepted">{t('governanceSanctions.appealStatuses.accepted')}</SelectItem>
                          <SelectItem value="rejected">{t('governanceSanctions.appealStatuses.rejected')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Label>{t('admin.users.appealResolutionLabel')}</Label>
                      <Textarea
                        value={draft.resolutionNotes}
                        onChange={(event) => {
                          const value = event.target.value;
                          setAppealDrafts((current) => ({
                            ...current,
                            [appeal.id]: {
                              ...draft,
                              resolutionNotes: value,
                            },
                          }));
                        }}
                        placeholder={t('admin.users.appealResolutionPlaceholder')}
                      />
                      <Button
                        className="w-full"
                        disabled={appealSavingId === appeal.id}
                        onClick={() => void handleSaveAppeal({
                          appeal,
                          status: draft.status,
                          resolutionNotes: draft.resolutionNotes,
                        })}
                      >
                        {appealSavingId === appeal.id ? t('admin.users.appealSaving') : t('admin.users.appealSave')}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Card>
    </>
  );
}
