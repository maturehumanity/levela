import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import type { AppPermission } from '@/lib/access-control';
import { getCitizenStatusLabelKey } from '@/lib/civic-status';
import {
  type GovernanceSanctionAppealStatus,
  type GovernanceSanctionScopeOption,
} from '@/lib/governance-sanctions';
import { permissionMetadata } from '@/lib/permission-metadata';
import { getVerificationCaseBadgeClassName, getVerificationCaseStatusLabelKey } from '@/lib/verification-workflow';
import {
  citizenshipBadgeClassName,
  roleBadgeClassName,
  type GovernanceSanctionAppealRow,
  type GovernanceSanctionRow,
  type OverrideMode,
  type ProfessionRow,
  type ProfessionStatusMode,
  type ProfileProfessionRow,
  type ProfileRow,
  type VerificationCaseRow,
} from '@/lib/users-admin';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UsersAdminGovernanceSanctionsCard } from '@/components/admin/UsersAdminGovernanceSanctionsCard';

type PagePermissionGroup = Array<{
  sectionId: string;
  pages: Array<{
    pageId: string;
    items: typeof permissionMetadata;
  }>;
}>;

type UsersAdminSelectedPanelProps = {
  groupedPermissions: PagePermissionGroup;
  overrideModes: Record<AppPermission, OverrideMode>;
  overrideSaveError: string | null;
  overrideSavingUserId: string | null;
  professionSavingKey: string | null;
  professions: ProfessionRow[];
  profileUserId?: string | null;
  rolePermissions: Record<ProfileRow['role'], AppPermission[]>;
  selectedUser: ProfileRow;
  selectedUserCitizenshipStatus: ProfileRow['citizenship_status'] | null;
  selectedUserSanctions: GovernanceSanctionRow[];
  selectedUserAppeals: GovernanceSanctionAppealRow[];
  selectedUserEffectivePermissions: AppPermission[];
  selectedUserVerificationCase: VerificationCaseRow | null;
  sanctionSavingUserId: string | null;
  appealSavingId: string | null;
  t: (key: string, vars?: Record<string, string | number>) => string;
  formatDate: (value: string) => string;
  getPageLabel: (pageId: string) => string;
  getProfessionAssignment: (targetUserId: string, professionId: string) => ProfileProfessionRow | null;
  handleOverrideChange: (permission: AppPermission, mode: OverrideMode) => void;
  handleProfessionStatusChange: (targetUser: ProfileRow, professionId: string, nextStatus: ProfessionStatusMode) => Promise<void>;
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
  handleRetrySaveOverrides: () => Promise<void>;
};

export function UsersAdminSelectedPanel({
  formatDate,
  getPageLabel,
  getProfessionAssignment,
  groupedPermissions,
  handleIssueSanction,
  handleOverrideChange,
  handleProfessionStatusChange,
  handleLiftSanction,
  handleSaveAppeal,
  handleRetrySaveOverrides,
  appealSavingId,
  overrideModes,
  overrideSaveError,
  overrideSavingUserId,
  professionSavingKey,
  professions,
  profileUserId,
  rolePermissions,
  sanctionSavingUserId,
  selectedUser,
  selectedUserAppeals,
  selectedUserCitizenshipStatus,
  selectedUserEffectivePermissions,
  selectedUserSanctions,
  selectedUserVerificationCase,
  t,
}: UsersAdminSelectedPanelProps) {
  const verificationStatus = selectedUserVerificationCase?.status || (selectedUser.is_verified ? 'approved' : 'draft');

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
      <Card className="rounded-3xl border-border/60 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{t('admin.users.overrideTitle')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('admin.users.overrideSubtitle', {
                user: selectedUser.full_name || selectedUser.username || t('common.anonymousUser'),
              })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className={cn('rounded-full border', roleBadgeClassName[selectedUser.role])} variant="outline">{t(`admin.roles.${selectedUser.role}`)}</Badge>
            {selectedUserCitizenshipStatus && <Badge className={cn('rounded-full border', citizenshipBadgeClassName[selectedUserCitizenshipStatus])} variant="outline">{t(getCitizenStatusLabelKey(selectedUserCitizenshipStatus))}</Badge>}
            {selectedUser.is_active_citizen && <Badge className="rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" variant="outline">{t('admin.users.activeCitizenBadge')}</Badge>}
            {selectedUser.is_governance_eligible && <Badge className="rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300" variant="outline">{t('admin.users.governanceEligibleBadge')}</Badge>}
            <Badge className={cn('rounded-full border', getVerificationCaseBadgeClassName(verificationStatus))} variant="outline">{t(getVerificationCaseStatusLabelKey(verificationStatus))}</Badge>
            <Badge variant="secondary" className="rounded-full bg-primary/10 text-primary hover:bg-primary/10">{t('admin.permissions.permissionCount', { count: selectedUserEffectivePermissions.length })}</Badge>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            {groupedPermissions.map((sectionGroup) => (
              <div key={sectionGroup.sectionId} className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t(`admin.permissions.sectionNames.${sectionGroup.sectionId}`)}</h3>
                <div className="space-y-3">
                  {sectionGroup.pages.map((pageGroup) => (
                    <div key={`${sectionGroup.sectionId}-${pageGroup.pageId}`} className="rounded-3xl border border-border/60 bg-card/80 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-foreground">{getPageLabel(pageGroup.pageId)}</p>
                        <Badge variant="outline" className="rounded-full text-[11px]">{t('admin.permissions.featureColumn')}</Badge>
                      </div>
                      <div className="space-y-3">
                        {pageGroup.items.map((entry) => {
                          const mode = overrideModes[entry.permission];
                          const inherited = (rolePermissions[selectedUser.role] || []).includes(entry.permission);

                          return (
                            <div key={entry.permission} className="rounded-2xl border border-border/60 bg-background/70 p-4">
                              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-medium text-foreground">{t(entry.titleKey)}</p>
                                    {inherited && <Badge variant="secondary" className="rounded-full bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300">{t('admin.users.inheritedEnabled')}</Badge>}
                                  </div>
                                  <p className="mt-1 text-sm text-muted-foreground">{t(entry.descriptionKey)}</p>
                                </div>
                                <Select value={mode} onValueChange={(value) => handleOverrideChange(entry.permission, value as OverrideMode)}>
                                  <SelectTrigger className="w-full lg:w-[170px]"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="inherit">{t('admin.users.overrideModes.inherit')}</SelectItem>
                                    <SelectItem value="grant">{t('admin.users.overrideModes.grant')}</SelectItem>
                                    <SelectItem value="deny">{t('admin.users.overrideModes.deny')}</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <Card className="rounded-3xl border-border/60 p-4 shadow-none">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t('admin.users.professionsTitle')}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t('admin.users.professionsSubtitle')}</p>
              <div className="mt-4 space-y-3">
                {professions.map((profession) => {
                  const assignment = getProfessionAssignment(selectedUser.id, profession.id);
                  const currentStatus = assignment?.status || 'unassigned';
                  const saveKey = `${selectedUser.id}:${profession.id}`;

                  return (
                    <div key={profession.id} className="rounded-2xl border border-border/60 bg-background/70 p-3">
                      <div className="flex flex-col gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-foreground">{profession.label}</p>
                            {assignment?.verified_at && currentStatus !== 'pending' && <Badge variant="outline" className="rounded-full text-[11px]">{formatDate(assignment.verified_at)}</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">{profession.description}</p>
                        </div>
                        <Select value={currentStatus} onValueChange={(value) => void handleProfessionStatusChange(selectedUser, profession.id, value as ProfessionStatusMode)} disabled={professionSavingKey === saveKey}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">{t('admin.users.professionStatuses.unassigned')}</SelectItem>
                            <SelectItem value="pending">{t('admin.users.professionStatuses.pending')}</SelectItem>
                            <SelectItem value="approved">{t('admin.users.professionStatuses.approved')}</SelectItem>
                            <SelectItem value="suspended">{t('admin.users.professionStatuses.suspended')}</SelectItem>
                            <SelectItem value="revoked">{t('admin.users.professionStatuses.revoked')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <UsersAdminGovernanceSanctionsCard
              selectedUser={selectedUser}
              selectedUserSanctions={selectedUserSanctions}
              selectedUserAppeals={selectedUserAppeals}
              sanctionSavingUserId={sanctionSavingUserId}
              appealSavingId={appealSavingId}
              t={t}
              formatDate={formatDate}
              handleIssueSanction={handleIssueSanction}
              handleLiftSanction={handleLiftSanction}
              handleSaveAppeal={handleSaveAppeal}
            />

            <Card className="rounded-3xl border-border/60 p-4 shadow-none">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t('admin.users.overrideLegendTitle')}</h3>
              <div className="mt-3 space-y-3 text-sm">
                <p><span className="font-medium text-foreground">{t('admin.users.overrideModes.inherit')}</span> · {t('admin.users.overrideLegendInherit')}</p>
                <p><span className="font-medium text-foreground">{t('admin.users.overrideModes.grant')}</span> · {t('admin.users.overrideLegendGrant')}</p>
                <p><span className="font-medium text-foreground">{t('admin.users.overrideModes.deny')}</span> · {t('admin.users.overrideLegendDeny')}</p>
              </div>
            </Card>

            <Card className="rounded-3xl border-border/60 p-4 shadow-none">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t('admin.users.effectivePermissionsTitle')}</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedUserEffectivePermissions.map((permission) => {
                  const entry = permissionMetadata.find((item) => item.permission === permission);
                  return <Badge key={permission} variant="secondary" className="rounded-full bg-primary/10 text-primary hover:bg-primary/10">{entry ? t(entry.titleKey) : permission}</Badge>;
                })}
              </div>
            </Card>

            {selectedUser.user_id !== profileUserId && (
              <div className="rounded-2xl border border-border/60 bg-card/80 px-4 py-3 text-sm text-muted-foreground">
                {overrideSavingUserId === selectedUser.id ? t('admin.users.autoSaving') : overrideSaveError ? t('admin.users.autoSaveFailed') : t('admin.users.autoSaveActive')}
              </div>
            )}
            {overrideSaveError && selectedUser.user_id !== profileUserId && (
              <Button className="w-full gap-2" onClick={() => void handleRetrySaveOverrides()} disabled={overrideSavingUserId === selectedUser.id}>
                {overrideSavingUserId === selectedUser.id && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('admin.users.saveOverrides')}
              </Button>
            )}
            {selectedUser.user_id === profileUserId && <p className="text-center text-xs text-muted-foreground">{t('admin.users.selfPermissionsHint')}</p>}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
