import { Award, BadgeCheck, BadgeX, Loader2, LogIn, Settings2 } from 'lucide-react';
import type { AppRole } from '@/lib/access-control';
import { getCitizenStatusLabelKey } from '@/lib/civic-status';
import { getVerificationCaseBadgeClassName, getVerificationCaseStatusLabelKey } from '@/lib/verification-workflow';
import {
  citizenshipBadgeClassName,
  getDisplayNameParts,
  getEffectiveCitizenshipStatus,
  getEffectiveVerificationStatus,
  getInitials,
  manageableRoles,
  type ProfileRow,
  userExperienceLevelClassMap,
  userExperienceLevelIconMap,
  userExperienceLevelLabelMap,
  type VerificationCaseRow,
} from '@/lib/users-admin';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type UsersAdminMobileListProps = {
  canLoginAsFromAdmin: boolean;
  levelSavingUserId: string | null;
  overrideSavingUserId: string | null;
  profileUserId?: string | null;
  roleSavingUserId: string | null;
  selectedUserId: string | null;
  switchingUserId: string | null;
  t: (key: string) => string;
  verificationCasesByProfile: Record<string, VerificationCaseRow>;
  visibleUsers: ProfileRow[];
  formatDate: (value: string) => string;
  formatRelativeTime: (value?: string | null) => string;
  getActivityTimestamp: (user: ProfileRow) => string;
  isUserOnline: (user: ProfileRow) => boolean;
  onCycleExperienceLevel: (user: ProfileRow) => void;
  onLoginAsUser: (user: ProfileRow) => void;
  onRoleChange: (user: ProfileRow, nextRole: AppRole) => void;
  onSelectUser: (userId: string) => void;
  onToggleSelectedUser: (userId: string) => void;
  onVerificationToggle: (user: ProfileRow) => void;
};

export function UsersAdminMobileList({
  canLoginAsFromAdmin,
  formatDate,
  formatRelativeTime,
  getActivityTimestamp,
  isUserOnline,
  levelSavingUserId,
  onCycleExperienceLevel,
  onLoginAsUser,
  onRoleChange,
  onSelectUser,
  onToggleSelectedUser,
  onVerificationToggle,
  overrideSavingUserId,
  profileUserId,
  roleSavingUserId,
  selectedUserId,
  switchingUserId,
  t,
  verificationCasesByProfile,
  visibleUsers,
}: UsersAdminMobileListProps) {
  return (
    <div className="space-y-3 p-3 md:hidden">
      {visibleUsers.map((user) => {
        const isCurrentUser = user.user_id === profileUserId;
        const isLevelSaving = levelSavingUserId === user.id;
        const isSaving = roleSavingUserId === user.id || overrideSavingUserId === user.id || isLevelSaving;
        const isSelected = selectedUserId === user.id;
        const isOnline = isUserOnline(user);
        const loginBusy = switchingUserId === user.id;
        const displayName = getDisplayNameParts(user);
        const userLevel = user.experience_level in userExperienceLevelIconMap ? user.experience_level : 'entry';
        const LevelIcon = userExperienceLevelIconMap[userLevel];
        const shouldShowProBadge = displayName.hasProfessionalSuffix || userLevel === 'professional';
        const effectiveCitizenshipStatus = getEffectiveCitizenshipStatus(user);
        const verificationCase = verificationCasesByProfile[user.id] || null;
        const verificationStatus = getEffectiveVerificationStatus(user, verificationCase);

        return (
          <div
            key={user.id}
            className={cn(
              'space-y-4 rounded-2xl border border-border/70 bg-card/95 p-4 shadow-sm transition-all duration-200 hover:border-border hover:shadow-md',
              isSelected && 'border-primary/40 bg-primary/5 shadow-md',
            )}
            role="button"
            tabIndex={0}
            onClick={() => onToggleSelectedUser(user.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onToggleSelectedUser(user.id);
              }
            }}
          >
            <div className="flex w-full items-start justify-between gap-3 text-left">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary">
                  {getInitials(user.full_name, user.username)}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{displayName.name || t('common.anonymousUser')}</p>
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm text-muted-foreground">{user.username ? `@${user.username}` : t('admin.users.noUsername')}</p>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onCycleExperienceLevel(user);
                      }}
                      disabled={isLevelSaving}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors',
                        userExperienceLevelClassMap[userLevel],
                        'hover:opacity-90',
                      )}
                      title={t('admin.users.levelCycleHint')}
                    >
                      {isLevelSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <><LevelIcon className="h-3 w-3" />{userExperienceLevelLabelMap[userLevel]}</>}
                    </button>
                    {shouldShowProBadge && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-teal-500/20 bg-teal-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-teal-700 dark:text-teal-300">
                        <Award className="h-3 w-3" />
                        Pro
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge className={cn('rounded-full border', citizenshipBadgeClassName[effectiveCitizenshipStatus])} variant="outline">{t(getCitizenStatusLabelKey(effectiveCitizenshipStatus))}</Badge>
                    <Badge className={cn('rounded-full border', getVerificationCaseBadgeClassName(verificationStatus))} variant="outline">{t(getVerificationCaseStatusLabelKey(verificationStatus))}</Badge>
                    <Badge variant="outline">{t(`admin.roles.${user.role}`)}</Badge>
                    {user.is_active_citizen && <Badge variant="outline" className="rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">{t('admin.users.activeCitizenBadge')}</Badge>}
                    {user.is_governance_eligible && <Badge variant="outline" className="rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300">{t('admin.users.governanceEligibleBadge')}</Badge>}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onVerificationToggle(user);
                  }}
                  disabled={isSaving}
                  className={cn(
                    'inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors',
                    user.is_verified
                      ? 'border-sky-500/20 bg-sky-500/10 text-sky-700 hover:bg-sky-500/20 dark:text-sky-300'
                      : 'border-border bg-muted text-muted-foreground hover:bg-muted/80',
                    isSaving && 'opacity-70',
                  )}
                  title={user.is_verified ? t('admin.users.userIsVerified') : t('admin.users.userIsUnverified')}
                >
                  {user.is_verified ? <BadgeCheck className="h-3.5 w-3.5" /> : <BadgeX className="h-3.5 w-3.5" />}
                </button>
                <span className={cn('text-xs', isOnline && 'font-medium text-emerald-600 dark:text-emerald-300')}>
                  {isOnline ? t('admin.users.onlineNow') : formatRelativeTime(getActivityTimestamp(user))}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Select value={user.role} onValueChange={(value) => onRoleChange(user, value as AppRole)} disabled={isCurrentUser || isSaving}>
                <SelectTrigger className="w-full" onClick={(event) => event.stopPropagation()}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {manageableRoles.map((role) => <SelectItem key={role} value={role}>{t(`admin.roles.${role}`)}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="outline" size="icon" className="h-9 w-9 border-border/70 bg-background/60 hover:border-border hover:bg-accent/70" onClick={(event) => { event.stopPropagation(); onSelectUser(user.id); }} aria-label={t('admin.users.manageAccess')} title={t('admin.users.manageAccess')}>
                  <Settings2 className="h-4 w-4" />
                </Button>
                <Button variant={user.is_verified ? 'secondary' : 'outline'} size="icon" className="h-9 w-9 border-border/70 bg-background/60 hover:border-border hover:bg-accent/70" onClick={(event) => { event.stopPropagation(); onVerificationToggle(user); }} disabled={isSaving} aria-label={user.is_verified ? t('admin.users.unverifyUser') : t('admin.users.verifyUser')} title={user.is_verified ? t('admin.users.unverifyUser') : t('admin.users.verifyUser')}>
                  {user.is_verified ? <BadgeX className="h-4 w-4" /> : <BadgeCheck className="h-4 w-4" />}
                </Button>
                {canLoginAsFromAdmin && (
                  <Button variant="ghost" size="icon" className="h-9 w-9 border border-border/70 bg-background/60 hover:border-border hover:bg-accent/70" onClick={(event) => { event.stopPropagation(); onLoginAsUser(user); }} disabled={isCurrentUser || loginBusy} aria-label="Request emergency access" title={isCurrentUser ? t('admin.users.cannotEditSelf') : 'Request emergency access'}>
                    {loginBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            </div>

            {isSelected && (
              <>
                <div className="grid grid-cols-2 gap-3 border-t border-border/60 pt-4 text-xs">
                  <div className="space-y-1"><p className="uppercase tracking-[0.12em] text-muted-foreground">{t('admin.users.officialIdLabel')}</p><p className="break-all font-mono text-muted-foreground">{user.official_id || '—'}</p></div>
                  <div className="space-y-1"><p className="uppercase tracking-[0.12em] text-muted-foreground">{t('admin.users.ssnLabel')}</p><p className="break-all font-mono text-muted-foreground">{user.social_security_number || '—'}</p></div>
                  <div className="space-y-1"><p className="uppercase tracking-[0.12em] text-muted-foreground">{t('common.country')}</p><p className="text-muted-foreground">{user.country || user.country_code || '—'}</p></div>
                  <div className="space-y-1"><p className="uppercase tracking-[0.12em] text-muted-foreground">{t('admin.users.joinedColumn')}</p><p className="text-muted-foreground">{formatDate(user.created_at)}</p></div>
                  <div className="space-y-1"><p className="uppercase tracking-[0.12em] text-muted-foreground">{t('admin.users.citizenshipColumn')}</p><p className="text-muted-foreground">{t(getCitizenStatusLabelKey(effectiveCitizenshipStatus))}</p></div>
                  <div className="space-y-1"><p className="uppercase tracking-[0.12em] text-muted-foreground">{t('admin.users.governanceStatusColumn')}</p><p className="text-muted-foreground">{user.is_governance_eligible ? t('admin.users.governanceEligibleBadge') : user.is_active_citizen ? t('admin.users.activeCitizenBadge') : t('admin.users.governancePendingBadge')}</p></div>
                  <div className="space-y-1"><p className="uppercase tracking-[0.12em] text-muted-foreground">{t('admin.users.verificationWorkflowColumn')}</p><p className="text-muted-foreground">{t(getVerificationCaseStatusLabelKey(verificationStatus))}</p></div>
                </div>
                {isCurrentUser && <p className="text-xs text-muted-foreground">{t('admin.users.selfRoleHint')}</p>}
                <div className="grid gap-2">
                  <Button variant="outline" size="sm" className="w-full gap-2" onClick={(event) => { event.stopPropagation(); onSelectUser(user.id); }}><Settings2 className="h-4 w-4" />{t('admin.users.manageAccess')}</Button>
                  <Button variant={user.is_verified ? 'secondary' : 'outline'} size="sm" className="w-full gap-2" onClick={(event) => { event.stopPropagation(); onVerificationToggle(user); }} disabled={isSaving}>
                    {user.is_verified ? <><BadgeCheck className="h-4 w-4" />{t('admin.users.unverifyUser')}</> : <><BadgeX className="h-4 w-4" />{t('admin.users.verifyUser')}</>}
                  </Button>
                  {canLoginAsFromAdmin && (
                    <Button variant="ghost" size="sm" className="w-full gap-2" onClick={(event) => { event.stopPropagation(); onLoginAsUser(user); }} disabled={isCurrentUser || loginBusy}>
                      {loginBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                      Request emergency access
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
