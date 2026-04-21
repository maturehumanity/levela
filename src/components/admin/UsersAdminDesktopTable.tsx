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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type UsersAdminDesktopTableProps = {
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
  onVerificationToggle: (user: ProfileRow) => void;
};

export function UsersAdminDesktopTable({
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
  onVerificationToggle,
  overrideSavingUserId,
  profileUserId,
  roleSavingUserId,
  selectedUserId,
  switchingUserId,
  t,
  verificationCasesByProfile,
  visibleUsers,
}: UsersAdminDesktopTableProps) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('admin.users.userColumn')}</TableHead>
            <TableHead>{t('admin.users.officialIdLabel')}</TableHead>
            <TableHead>{t('admin.users.ssnLabel')}</TableHead>
            <TableHead>{t('admin.users.roleColumn')}</TableHead>
            <TableHead>{t('common.country')}</TableHead>
            <TableHead>{t('admin.users.joinedColumn')}</TableHead>
            <TableHead>{t('admin.users.accessColumn')}</TableHead>
            <TableHead className="text-right">{t('admin.users.lastActiveColumn')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleUsers.map((user) => {
            const isCurrentUser = user.user_id === profileUserId;
            const isLevelSaving = levelSavingUserId === user.id;
            const isSaving = roleSavingUserId === user.id || overrideSavingUserId === user.id || isLevelSaving;
            const isSelected = selectedUserId === user.id;
            const isOnline = isUserOnline(user);
            const displayName = getDisplayNameParts(user);
            const userLevel = user.experience_level in userExperienceLevelIconMap ? user.experience_level : 'entry';
            const LevelIcon = userExperienceLevelIconMap[userLevel];
            const shouldShowProBadge = displayName.hasProfessionalSuffix || userLevel === 'professional';
            const effectiveCitizenshipStatus = getEffectiveCitizenshipStatus(user);
            const verificationCase = verificationCasesByProfile[user.id] || null;
            const verificationStatus = getEffectiveVerificationStatus(user, verificationCase);

            return (
              <TableRow key={user.id} className={cn('group hover:bg-accent/40', isSelected && 'bg-primary/5 hover:bg-primary/5')}>
                <TableCell>
                  <button type="button" className="flex items-center gap-3 text-left" onClick={() => onSelectUser(user.id)}>
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary">{getInitials(user.full_name, user.username)}</div>
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
                        {shouldShowProBadge && <span className="inline-flex items-center gap-1 rounded-full border border-teal-500/20 bg-teal-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-teal-700 dark:text-teal-300"><Award className="h-3 w-3" />Pro</span>}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge className={cn('rounded-full border', citizenshipBadgeClassName[effectiveCitizenshipStatus])} variant="outline">{t(getCitizenStatusLabelKey(effectiveCitizenshipStatus))}</Badge>
                        <Badge className={cn('rounded-full border', getVerificationCaseBadgeClassName(verificationStatus))} variant="outline">{t(getVerificationCaseStatusLabelKey(verificationStatus))}</Badge>
                        <Badge variant="outline">{t(`admin.roles.${user.role}`)}</Badge>
                        {user.is_active_citizen && <Badge variant="outline" className="rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">{t('admin.users.activeCitizenBadge')}</Badge>}
                        {user.is_governance_eligible && <Badge variant="outline" className="rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300">{t('admin.users.governanceEligibleBadge')}</Badge>}
                      </div>
                    </div>
                  </button>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{user.official_id || '—'}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{user.social_security_number || '—'}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-2">
                    <Select value={user.role} onValueChange={(value) => onRoleChange(user, value as AppRole)} disabled={isCurrentUser || isSaving}>
                      <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {manageableRoles.map((role) => <SelectItem key={role} value={role}>{t(`admin.roles.${role}`)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {isCurrentUser && <p className="text-xs text-muted-foreground">{t('admin.users.selfRoleHint')}</p>}
                  </div>
                </TableCell>
                <TableCell>{user.country || user.country_code || '—'}</TableCell>
                <TableCell>{formatDate(user.created_at)}</TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-2">
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => onSelectUser(user.id)}><Settings2 className="h-4 w-4" />{t('admin.users.manageAccess')}</Button>
                    <Button variant={user.is_verified ? 'secondary' : 'outline'} size="sm" className="gap-2" onClick={() => onVerificationToggle(user)} disabled={isSaving}>
                      {user.is_verified ? <><BadgeCheck className="h-4 w-4" />{t('admin.users.unverifyUser')}</> : <><BadgeX className="h-4 w-4" />{t('admin.users.verifyUser')}</>}
                    </Button>
                    {canLoginAsFromAdmin && (
                      <Button variant="ghost" size="sm" className={cn('gap-2', isCurrentUser && 'opacity-40')} onClick={() => onLoginAsUser(user)} disabled={isCurrentUser || switchingUserId === user.id}>
                        {switchingUserId === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                        {t('admin.users.loginAsUser')}
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => onVerificationToggle(user)}
                          disabled={isSaving}
                          className={cn(
                            'inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors',
                            user.is_verified
                              ? 'border-sky-500/20 bg-sky-500/10 text-sky-700 hover:bg-sky-500/20 dark:text-sky-300'
                              : 'border-border bg-muted text-muted-foreground hover:bg-muted/80',
                          )}
                        >
                          {user.is_verified ? <BadgeCheck className="h-3.5 w-3.5" /> : <BadgeX className="h-3.5 w-3.5" />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{user.is_verified ? t('admin.users.userIsVerified') : t('admin.users.userIsUnverified')}</TooltipContent>
                    </Tooltip>
                    <span className={cn('text-sm', isOnline && 'font-medium text-emerald-600 dark:text-emerald-300')}>
                      {isOnline ? t('admin.users.onlineNow') : formatRelativeTime(getActivityTimestamp(user))}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
