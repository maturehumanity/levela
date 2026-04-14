import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Award, BadgeCheck, BadgeX, Compass, GraduationCap, Loader2, LogIn, Plus, Search, Settings2, Shield, ShieldCheck, Sprout, Users } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Database } from '@/integrations/supabase/types';
import {
  APP_PERMISSIONS,
  APP_ROLES,
  resolveEffectivePermissions,
  type AppPermission,
  type AppRole,
} from '@/lib/access-control';
import { permissionMetadata } from '@/lib/permission-metadata';
import { pageRegistry, type PageId, type SectionId } from '@/lib/feature-registry';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type ProfileRow = {
  id: string;
  user_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  country: string | null;
  country_code: string | null;
  language_code: string | null;
  official_id: string | null;
  social_security_number: string | null;
  last_active_at?: string | null;
  is_verified: boolean | null;
  is_admin: boolean | null;
  experience_level: UserExperienceLevel;
  role: AppRole;
  custom_permissions: AppPermission[] | null;
  granted_permissions: AppPermission[] | null;
  denied_permissions: AppPermission[] | null;
  created_at: string;
  updated_at: string;
};

type RolePermissionRow = {
  role: AppRole;
  permission: AppPermission;
};

type ProfessionRow = Database['public']['Tables']['professions']['Row'];
type ProfileProfessionRow = Database['public']['Tables']['profile_professions']['Row'];
type ProfessionVerificationStatus = Database['public']['Enums']['profession_verification_status'];
type ProfessionStatusMode = ProfessionVerificationStatus | 'unassigned';

type OverrideMode = 'inherit' | 'grant' | 'deny';
type UserExperienceLevel = 'entry' | 'junior' | 'mid' | 'senior' | 'professional';

const roleBadgeClassName: Record<AppRole, string> = {
  guest: 'border-border bg-muted text-muted-foreground',
  member: 'border-primary/20 bg-primary/10 text-primary',
  citizen: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
  verified_member: 'border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-300',
  certified: 'border-teal-500/20 bg-teal-500/10 text-teal-700 dark:text-teal-300',
  moderator: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  market_manager: 'border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300',
  founder: 'border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  admin: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  system: 'border-destructive/20 bg-destructive/10 text-destructive',
};

const manageableRoles = APP_ROLES.filter((role) => role !== 'system');
const userExperienceLevels: UserExperienceLevel[] = ['entry', 'junior', 'mid', 'senior', 'professional'];
const userExperienceLevelLabelMap: Record<UserExperienceLevel, string> = {
  entry: 'Entry',
  junior: 'Junior',
  mid: 'Mid',
  senior: 'Senior',
  professional: 'Pro',
};
const userExperienceLevelClassMap: Record<UserExperienceLevel, string> = {
  entry: 'border-border bg-muted/70 text-muted-foreground',
  junior: 'border-lime-500/20 bg-lime-500/10 text-lime-700 dark:text-lime-300',
  mid: 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  senior: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
  professional: 'border-teal-500/20 bg-teal-500/10 text-teal-700 dark:text-teal-300',
};

const userExperienceLevelIconMap = {
  entry: GraduationCap,
  junior: Sprout,
  mid: Compass,
  senior: ShieldCheck,
  professional: Award,
} satisfies Record<UserExperienceLevel, ComponentType<{ className?: string }>>;
const sectionOrder: SectionId[] = ['home', 'discovery', 'knowledge', 'identity', 'contribution', 'marketplace', 'preferences', 'administration'];
const pageOrder: PageId[] = ['home', 'messaging', 'features', 'law', 'profile', 'editProfile', 'endorse', 'market', 'settings', 'adminUsers', 'adminPermissions'];

const emptyCreateUserForm = {
  fullName: '',
  username: '',
  email: '',
  password: '',
  role: 'member' as AppRole,
};

function getInitials(name?: string | null, username?: string | null) {
  const source = name?.trim() || username?.trim() || '?';
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function toOverrideMap(user: ProfileRow): Record<AppPermission, OverrideMode> {
  const granted = new Set([...(user.granted_permissions || []), ...(user.custom_permissions || [])]);
  const denied = new Set(user.denied_permissions || []);

  return Object.fromEntries(
    APP_PERMISSIONS.map((permission) => {
      if (denied.has(permission)) return [permission, 'deny' satisfies OverrideMode];
      if (granted.has(permission)) return [permission, 'grant' satisfies OverrideMode];
      return [permission, 'inherit' satisfies OverrideMode];
    }),
  ) as Record<AppPermission, OverrideMode>;
}

function getOverridePermissionSets(overrideModes: Record<AppPermission, OverrideMode>) {
  return {
    granted_permissions: APP_PERMISSIONS.filter((permission) => overrideModes[permission] === 'grant'),
    denied_permissions: APP_PERMISSIONS.filter((permission) => overrideModes[permission] === 'deny'),
  };
}

function serializeOverrideModes(overrideModes: Record<AppPermission, OverrideMode>) {
  const { granted_permissions, denied_permissions } = getOverridePermissionSets(overrideModes);
  return JSON.stringify({ granted_permissions, denied_permissions });
}

function getDisplayNameParts(user: Pick<ProfileRow, 'full_name' | 'username'>) {
  const fullName = user.full_name || '';
  if (/\s+professional$/i.test(fullName)) {
    return {
      name: fullName.replace(/\s+professional$/i, '').trim() || fullName,
      hasProfessionalSuffix: true,
    };
  }

  return {
    name: user.full_name || null,
    hasProfessionalSuffix: false,
  };
}

function getNextUserExperienceLevel(level: UserExperienceLevel | null | undefined): UserExperienceLevel {
  const current = level && userExperienceLevels.includes(level) ? level : 'entry';
  const index = userExperienceLevels.indexOf(current);
  return userExperienceLevels[(index + 1) % userExperienceLevels.length];
}

export default function UsersAdmin() {
  const navigate = useNavigate();
  const { profile, refreshProfile, signInWithOtp } = useAuth();
  const { t, language } = useLanguage();
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Record<AppRole, AppPermission[]>>(
    Object.fromEntries(APP_ROLES.map((role) => [role, []])) as Record<AppRole, AppPermission[]>,
  );
  const [professions, setProfessions] = useState<ProfessionRow[]>([]);
  const [userProfessions, setUserProfessions] = useState<Record<string, ProfileProfessionRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleSavingUserId, setRoleSavingUserId] = useState<string | null>(null);
  const [levelSavingUserId, setLevelSavingUserId] = useState<string | null>(null);
  const [overrideSavingUserId, setOverrideSavingUserId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [overrideModes, setOverrideModes] = useState<Record<AppPermission, OverrideMode> | null>(null);
  const [overrideSaveError, setOverrideSaveError] = useState<string | null>(null);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [createUserForm, setCreateUserForm] = useState(emptyCreateUserForm);
  const [professionSavingKey, setProfessionSavingKey] = useState<string | null>(null);
  const [switchingUserId, setSwitchingUserId] = useState<string | null>(null);
  const latestOverrideSignatureRef = useRef<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);

    const [
      { data: usersData, error: usersError },
      { data: matrixData, error: matrixError },
      { data: professionsData, error: professionsError },
      { data: profileProfessionsData, error: profileProfessionsError },
    ] = await Promise.all([
      supabase.from('profiles').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('role_permissions').select('role,permission'),
      supabase.from('professions').select('*').order('label', { ascending: true }),
      supabase.from('profile_professions').select('*'),
    ]);

    if (usersError) {
      console.error('Error loading users:', usersError);
      toast.error(t('admin.users.loadFailed'));
    }

    if (matrixError) {
      console.error('Error loading role permissions:', matrixError);
      toast.error(t('admin.users.permissionsLoadFailed'));
    }

    if (professionsError) {
      console.error('Error loading professions:', professionsError);
      toast.error(t('admin.users.professionsLoadFailed'));
    }

    if (profileProfessionsError) {
      console.error('Error loading user professions:', profileProfessionsError);
      toast.error(t('admin.users.professionAssignmentsLoadFailed'));
    }

    const groupedRolePermissions = Object.fromEntries(
      APP_ROLES.map((role) => [
        role,
        ((matrixData || []) as RolePermissionRow[])
          .filter((entry) => entry.role === role)
          .map((entry) => entry.permission),
      ]),
    ) as Record<AppRole, AppPermission[]>;

    const nextUsers = ((usersData || []) as ProfileRow[]).sort((a, b) => Number(b.is_admin) - Number(a.is_admin));
    const groupedProfessions = ((profileProfessionsData || []) as ProfileProfessionRow[]).reduce<Record<string, ProfileProfessionRow[]>>(
      (accumulator, assignment) => {
        if (!accumulator[assignment.profile_id]) {
          accumulator[assignment.profile_id] = [];
        }
        accumulator[assignment.profile_id].push(assignment);
        return accumulator;
      },
      {},
    );

    setUsers(nextUsers);
    setRolePermissions(groupedRolePermissions);
    setProfessions((professionsData || []) as ProfessionRow[]);
    setUserProfessions(groupedProfessions);
    setSelectedUserId((current) => {
      if (!current) return null;
      return nextUsers.some((user) => user.id === current) ? current : null;
    });
    setLoading(false);
  }, [t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const visibleUsers = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return users;

    return users.filter((user) =>
      [user.full_name, user.username, user.country, user.role]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [search, users]);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) || null,
    [selectedUserId, users],
  );

  const selectedUserProfessions = useMemo(
    () => (selectedUser ? userProfessions[selectedUser.id] || [] : []),
    [selectedUser, userProfessions],
  );

  useEffect(() => {
    if (!selectedUser) {
      setOverrideModes(null);
      setOverrideSaveError(null);
      latestOverrideSignatureRef.current = null;
      return;
    }

    const nextModes = toOverrideMap(selectedUser);
    setOverrideModes(nextModes);
    setOverrideSaveError(null);
    latestOverrideSignatureRef.current = serializeOverrideModes(nextModes);
  }, [selectedUser]);

  const stats = useMemo(() => {
    const staffCount = users.filter((user) => ['moderator', 'market_manager', 'founder', 'admin', 'system'].includes(user.role)).length;
    return {
      total: users.length,
      admins: users.filter((user) => ['founder', 'admin'].includes(user.role)).length,
      staff: staffCount,
    };
  }, [users]);

  const groupedMetadata = useMemo(
    () =>
      [...permissionMetadata].sort(
        (a, b) =>
          sectionOrder.indexOf(a.section) - sectionOrder.indexOf(b.section) ||
          pageOrder.indexOf(a.page) - pageOrder.indexOf(b.page) ||
          a.permission.localeCompare(b.permission),
      ),
    [],
  );

  const groupedPermissions = useMemo(() => {
    return sectionOrder
      .map((sectionId) => {
        const pages = pageOrder
          .map((pageId) => {
            const items = groupedMetadata.filter(
              (entry) => entry.section === sectionId && entry.page === pageId,
            );

            if (!items.length) return null;

            return {
              pageId,
              items,
            };
          })
          .filter(Boolean) as Array<{
          pageId: PageId;
          items: typeof permissionMetadata;
        }>;

        if (!pages.length) return null;

        return {
          sectionId,
          pages,
        };
      })
      .filter(Boolean) as Array<{
      sectionId: SectionId;
      pages: Array<{
        pageId: PageId;
        items: typeof permissionMetadata;
      }>;
    }>;
  }, [groupedMetadata]);

  const selectedUserEffectivePermissions = useMemo(() => {
    if (!selectedUser || !overrideModes) return [];

    const granted = APP_PERMISSIONS.filter((permission) => overrideModes[permission] === 'grant');
    const denied = APP_PERMISSIONS.filter((permission) => overrideModes[permission] === 'deny');

    return resolveEffectivePermissions(
      selectedUser.role,
      rolePermissions[selectedUser.role] || [],
      granted,
      denied,
      [],
    );
  }, [overrideModes, rolePermissions, selectedUser]);

  const formatDate = (value: string) => {
    try {
      return new Intl.DateTimeFormat(language, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
    } catch {
      return value;
    }
  };

  const formatRelativeTime = (value?: string | null) => {
    if (!value) return t('admin.users.noActivity');

    try {
      const timestamp = new Date(value).getTime();
      const diffMs = timestamp - Date.now();
      const minute = 60 * 1000;
      const hour = 60 * minute;
      const day = 24 * hour;
      const rtf = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });

      if (Math.abs(diffMs) < hour) {
        return rtf.format(Math.round(diffMs / minute), 'minute');
      }

      if (Math.abs(diffMs) < day) {
        return rtf.format(Math.round(diffMs / hour), 'hour');
      }

      return rtf.format(Math.round(diffMs / day), 'day');
    } catch {
      return value;
    }
  };

  const getActivityTimestamp = (user: ProfileRow) => user.last_active_at || user.updated_at || user.created_at;

  const isUserOnline = (user: ProfileRow) => {
    const timestamp = getActivityTimestamp(user);
    if (!timestamp) return false;
    return Date.now() - new Date(timestamp).getTime() <= 5 * 60 * 1000;
  };

  const getPageLabel = (pageId: PageId) => {
    if (pageId === 'editProfile') return t('settings.editProfile');
    if (pageId === 'adminUsers') return t('common.users');
    if (pageId === 'adminPermissions') return t('common.permissions');
    return t(pageRegistry[pageId].labelKey);
  };

  const canLoginAsFromAdmin = Boolean(profile?.effective_permissions?.includes('settings.manage'));

  const handleLoginAsUser = async (targetUser: ProfileRow) => {
    if (!canLoginAsFromAdmin) {
      toast.error(t('admin.users.loginAsUserUnavailable'));
      return;
    }

    setSwitchingUserId(targetUser.id);

    const { data, error } = await supabase.functions.invoke('admin-impersonate-user', {
      body: { profileId: targetUser.id },
    });

    if (error || !data?.email || !data?.token) {
      toast.error(t('admin.users.loginAsUserFailed'));
      setSwitchingUserId(null);
      return;
    }

    const { error: signInError } = await signInWithOtp(
      {
        email: data.email,
        token: data.token,
        type: 'magiclink',
      },
      { preserveCurrentSession: true },
    );

    if (signInError) {
      toast.error(t('admin.users.loginAsUserFailed'));
      setSwitchingUserId(null);
      return;
    }

    toast.success(
      t('admin.users.loginAsUserSuccess', {
        user: targetUser.full_name || targetUser.username || t('common.anonymousUser'),
      }),
    );
    navigate('/');
  };

  const handleRoleChange = async (target: ProfileRow, nextRole: AppRole) => {
    if (!profile) return;
    if (target.user_id === profile.user_id) {
      toast.error(t('admin.users.cannotEditSelf'));
      return;
    }

    const previousRole = target.role;
    setRoleSavingUserId(target.id);
    setUsers((current) =>
      current.map((user) =>
        user.id === target.id
          ? { ...user, role: nextRole, is_admin: nextRole === 'founder' || nextRole === 'admin' || nextRole === 'system' }
          : user,
      ),
    );

    const { error } = await supabase.from('profiles').update({ role: nextRole }).eq('id', target.id);

    if (error) {
      console.error('Error updating role:', error);
      setUsers((current) =>
        current.map((user) =>
          user.id === target.id
            ? { ...user, role: previousRole, is_admin: previousRole === 'founder' || previousRole === 'admin' || previousRole === 'system' }
            : user,
        ),
      );
      toast.error(t('admin.users.roleUpdateFailed'));
      setRoleSavingUserId(null);
      return;
    }

    if (target.user_id === profile.user_id) {
      await refreshProfile();
    }

    toast.success(
      t('admin.users.roleUpdated', {
        user: target.full_name || target.username || t('common.anonymousUser'),
        role: t(`admin.roles.${nextRole}`),
      }),
    );
    setRoleSavingUserId(null);
  };

  const handleVerificationToggle = async (target: ProfileRow) => {
    const nextVerified = !target.is_verified;
    setRoleSavingUserId(target.id);
    setUsers((current) => current.map((user) => (user.id === target.id ? { ...user, is_verified: nextVerified } : user)));

    const { error } = await supabase
      .from('profiles')
      .update({ is_verified: nextVerified })
      .eq('id', target.id);

    if (error) {
      console.error('Error updating verification:', error);
      setUsers((current) => current.map((user) => (user.id === target.id ? { ...user, is_verified: target.is_verified } : user)));
      toast.error(t('admin.users.verificationUpdateFailed'));
      setRoleSavingUserId(null);
      return;
    }

    toast.success(
      t(nextVerified ? 'admin.users.userVerified' : 'admin.users.userUnverified', {
        user: target.full_name || target.username || t('common.anonymousUser'),
      }),
    );
    setRoleSavingUserId(null);
  };

  const handleCycleExperienceLevel = async (target: ProfileRow) => {
    const nextLevel = getNextUserExperienceLevel(target.experience_level);
    const previousLevel = target.experience_level;

    setLevelSavingUserId(target.id);
    setUsers((current) => current.map((user) => (user.id === target.id ? { ...user, experience_level: nextLevel } : user)));

    const { error } = await supabase
      .from('profiles')
      .update({ experience_level: nextLevel })
      .eq('id', target.id);

    if (error) {
      console.error('Error updating experience level:', error);
      setUsers((current) => current.map((user) => (user.id === target.id ? { ...user, experience_level: previousLevel } : user)));
      toast.error(t('admin.users.levelUpdateFailed'));
      setLevelSavingUserId(null);
      return;
    }

    toast.success(
      t('admin.users.levelUpdated', {
        user: target.full_name || target.username || t('common.anonymousUser'),
        level: userExperienceLevelLabelMap[nextLevel],
      }),
    );
    setLevelSavingUserId(null);
  };

  const handleOverrideChange = (permission: AppPermission, mode: OverrideMode) => {
    setOverrideSaveError(null);
    setOverrideModes((current) => (current ? { ...current, [permission]: mode } : current));
  };

  const persistOverrideModes = useCallback(async (
    targetUser: ProfileRow,
    nextOverrideModes: Record<AppPermission, OverrideMode>,
    options?: { showSuccessToast?: boolean },
  ) => {
    const { showSuccessToast = false } = options || {};

    if (targetUser.user_id === profile?.user_id) {
      toast.error(t('admin.users.cannotEditOwnPermissions'));
      return false;
    }

    const { granted_permissions, denied_permissions } = getOverridePermissionSets(nextOverrideModes);
    setOverrideSavingUserId(targetUser.id);

    const { error } = await supabase
      .from('profiles')
      .update({
        granted_permissions,
        denied_permissions,
        custom_permissions: granted_permissions,
      })
      .eq('id', targetUser.id);

    if (error) {
      console.error('Error updating user permission overrides:', error);
      setOverrideSaveError(t('admin.users.autoSaveFailed'));
      toast.error(t('admin.users.overrideSaveFailed'));
      setOverrideSavingUserId(null);
      return false;
    }

    setUsers((current) =>
      current.map((user) =>
        user.id === targetUser.id
          ? { ...user, granted_permissions, denied_permissions, custom_permissions: granted_permissions }
          : user,
      ),
    );

    latestOverrideSignatureRef.current = JSON.stringify({ granted_permissions, denied_permissions });
    setOverrideSaveError(null);
    setOverrideSavingUserId(null);

    if (showSuccessToast) {
      toast.success(t('admin.users.overrideSaved'));
    }

    return true;
  }, [profile?.user_id, t]);

  useEffect(() => {
    if (!selectedUser || !overrideModes) return;
    if (selectedUser.user_id === profile?.user_id) return;

    const nextSignature = serializeOverrideModes(overrideModes);
    if (nextSignature === latestOverrideSignatureRef.current) return;

    const timer = window.setTimeout(() => {
      void persistOverrideModes(selectedUser, overrideModes);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [overrideModes, persistOverrideModes, profile?.user_id, selectedUser]);

  const handleRetrySaveOverrides = async () => {
    if (!selectedUser || !overrideModes) return;
    await persistOverrideModes(selectedUser, overrideModes, { showSuccessToast: true });
  };

  const getProfessionAssignment = (targetUserId: string, professionId: string) =>
    (userProfessions[targetUserId] || []).find((assignment) => assignment.profession_id === professionId) || null;

  const handleProfessionStatusChange = async (
    targetUser: ProfileRow,
    professionId: string,
    nextStatus: ProfessionStatusMode,
  ) => {
    if (!profile) return;

    const saveKey = `${targetUser.id}:${professionId}`;
    const previousAssignments = userProfessions[targetUser.id] || [];
    const previousAssignment = previousAssignments.find((assignment) => assignment.profession_id === professionId) || null;
    setProfessionSavingKey(saveKey);

    if (nextStatus === 'unassigned') {
      const { error } = await supabase
        .from('profile_professions')
        .delete()
        .eq('profile_id', targetUser.id)
        .eq('profession_id', professionId);

      if (error) {
        console.error('Error removing profession assignment:', error);
        toast.error(t('admin.users.professionSaveFailed'));
        setProfessionSavingKey(null);
        return;
      }

      setUserProfessions((current) => ({
        ...current,
        [targetUser.id]: (current[targetUser.id] || []).filter((assignment) => assignment.profession_id !== professionId),
      }));

      toast.success(
        t('admin.users.professionRemoved', {
          user: targetUser.full_name || targetUser.username || t('common.anonymousUser'),
        }),
      );
      setProfessionSavingKey(null);
      await loadData();
      return;
    }

    const verifiedAt = nextStatus === 'pending' ? null : new Date().toISOString();
    const verifiedBy = nextStatus === 'pending' ? null : profile.id;

    const payload: Database['public']['Tables']['profile_professions']['Insert'] = {
      profile_id: targetUser.id,
      profession_id: professionId,
      status: nextStatus,
      evidence_url: previousAssignment?.evidence_url || null,
      notes: previousAssignment?.notes || null,
      verified_at: verifiedAt,
      verified_by: verifiedBy,
    };

    const { data, error } = await supabase
      .from('profile_professions')
      .upsert(payload, { onConflict: 'profile_id,profession_id' })
      .select()
      .single();

    if (error || !data) {
      console.error('Error saving profession assignment:', error);
      toast.error(t('admin.users.professionSaveFailed'));
      setProfessionSavingKey(null);
      return;
    }

    setUserProfessions((current) => {
      const remaining = (current[targetUser.id] || []).filter((assignment) => assignment.profession_id !== professionId);
      return {
        ...current,
        [targetUser.id]: [...remaining, data as ProfileProfessionRow].sort((a, b) => a.profession_id.localeCompare(b.profession_id)),
      };
    });

    toast.success(
      t('admin.users.professionSaved', {
        user: targetUser.full_name || targetUser.username || t('common.anonymousUser'),
      }),
    );
    setProfessionSavingKey(null);
    await loadData();
  };

  const handleCreateUser = async () => {
    setCreatingUser(true);

    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: {
        email: createUserForm.email.trim(),
        password: createUserForm.password,
        full_name: createUserForm.fullName.trim() || null,
        username: createUserForm.username.trim() || null,
        role: createUserForm.role,
      },
    });

    if (error) {
      console.error('Error creating user:', error);
      toast.error(t('admin.users.createUserFailed'));
      setCreatingUser(false);
      return;
    }

    if (data?.error) {
      toast.error(String(data.error));
      setCreatingUser(false);
      return;
    }

    toast.success(t('admin.users.userCreated'));
    setCreateUserForm(emptyCreateUserForm);
    setCreateUserOpen(false);
    setCreatingUser(false);
    await loadData();
  };

  return (
    <AppLayout>
      <div className="space-y-6 px-4 py-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          <div className="grid grid-cols-3 items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/settings')} className="col-span-1 w-fit gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t('common.back')}
            </Button>
            <h1 className="col-span-1 text-center text-2xl font-display font-bold text-foreground">{t('admin.users.title')}</h1>
            <div className="col-span-1 flex justify-end">
              <Button className="w-full max-w-[180px] gap-2 sm:w-auto" onClick={() => setCreateUserOpen(true)}>
                <Plus className="h-4 w-4" />
                {t('admin.users.createUser')}
              </Button>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible"
        >
          <Card className="min-w-[220px] rounded-3xl border-border/60 p-4 shadow-sm sm:min-w-0">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-primary/10 p-3 text-primary"><Users className="h-5 w-5" /></div>
              <div>
                <p className="text-sm text-muted-foreground">{t('admin.users.totalUsers')}</p>
                <p className="text-2xl font-semibold text-foreground">{stats.total}</p>
              </div>
            </div>
          </Card>
          <Card className="min-w-[220px] rounded-3xl border-border/60 p-4 shadow-sm sm:min-w-0">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-600 dark:text-emerald-300"><Shield className="h-5 w-5" /></div>
              <div>
                <p className="text-sm text-muted-foreground">{t('admin.users.admins')}</p>
                <p className="text-2xl font-semibold text-foreground">{stats.admins}</p>
              </div>
            </div>
          </Card>
          <Card className="min-w-[220px] rounded-3xl border-border/60 p-4 shadow-sm sm:min-w-0">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-amber-500/10 p-3 text-amber-600 dark:text-amber-300"><Shield className="h-5 w-5" /></div>
              <div>
                <p className="text-sm text-muted-foreground">{t('admin.users.staffRoles')}</p>
                <p className="text-2xl font-semibold text-foreground">{stats.staff}</p>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="rounded-3xl border-border/60 p-4 shadow-sm">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('admin.users.searchPlaceholder')}
                className="pl-9"
              />
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="overflow-hidden rounded-3xl border-border/60 shadow-sm">
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-6 py-20 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t('common.loading')}</span>
              </div>
            ) : visibleUsers.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="text-lg font-semibold text-foreground">{t('admin.users.noResultsTitle')}</p>
                <p className="mt-2 text-sm text-muted-foreground">{t('admin.users.noResultsDescription')}</p>
              </div>
            ) : (
              <TooltipProvider>
                <div className="space-y-3 p-3 md:hidden">
                  {visibleUsers.map((user) => {
                    const isCurrentUser = user.user_id === profile?.user_id;
                    const isLevelSaving = levelSavingUserId === user.id;
                    const isSaving = roleSavingUserId === user.id || overrideSavingUserId === user.id || isLevelSaving;
                    const isSelected = selectedUserId === user.id;
                    const isOnline = isUserOnline(user);
                    const loginBusy = switchingUserId === user.id;
                    const displayName = getDisplayNameParts(user);
                    const userLevel = userExperienceLevels.includes(user.experience_level)
                      ? user.experience_level
                      : 'entry';
                    const LevelIcon = userExperienceLevelIconMap[userLevel];
                    const shouldShowProBadge = displayName.hasProfessionalSuffix || userLevel === 'professional';

                    return (
                      <div
                        key={user.id}
                        className={cn(
                          'space-y-4 rounded-2xl border border-border/70 bg-card/95 p-4 shadow-sm transition-all duration-200 hover:border-border hover:shadow-md',
                          isSelected && 'border-primary/40 bg-primary/5 shadow-md',
                        )}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedUserId((current) => (current === user.id ? null : user.id))}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedUserId((current) => (current === user.id ? null : user.id));
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
                                <p className="truncate text-sm text-muted-foreground">
                                  {user.username ? `@${user.username}` : t('admin.users.noUsername')}
                                </p>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleCycleExperienceLevel(user);
                                  }}
                                  disabled={isLevelSaving}
                                  className={cn(
                                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors',
                                    userExperienceLevelClassMap[userLevel],
                                    'hover:opacity-90',
                                  )}
                                  title={t('admin.users.levelCycleHint')}
                                >
                                  {isLevelSaving ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <>
                                      <LevelIcon className="h-3 w-3" />
                                      {userExperienceLevelLabelMap[userLevel]}
                                    </>
                                  )}
                                </button>
                                {shouldShowProBadge && (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-teal-500/20 bg-teal-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-teal-700 dark:text-teal-300">
                                    <Award className="h-3 w-3" />
                                    Pro
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleVerificationToggle(user);
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
                          <Select value={user.role} onValueChange={(value) => handleRoleChange(user, value as AppRole)} disabled={isCurrentUser || isSaving}>
                            <SelectTrigger className="w-full" onClick={(event) => event.stopPropagation()}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {manageableRoles.map((role) => (
                                <SelectItem key={role} value={role}>{t(`admin.roles.${role}`)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 border-border/70 bg-background/60 hover:border-border hover:bg-accent/70"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedUserId(user.id);
                              }}
                              aria-label={t('admin.users.manageAccess')}
                              title={t('admin.users.manageAccess')}
                            >
                              <Settings2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant={user.is_verified ? 'secondary' : 'outline'}
                              size="icon"
                              className="h-9 w-9 border-border/70 bg-background/60 hover:border-border hover:bg-accent/70"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleVerificationToggle(user);
                              }}
                              disabled={isSaving}
                              aria-label={user.is_verified ? t('admin.users.unverifyUser') : t('admin.users.verifyUser')}
                              title={user.is_verified ? t('admin.users.unverifyUser') : t('admin.users.verifyUser')}
                            >
                              {user.is_verified ? <BadgeX className="h-4 w-4" /> : <BadgeCheck className="h-4 w-4" />}
                            </Button>
                            {canLoginAsFromAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 border border-border/70 bg-background/60 hover:border-border hover:bg-accent/70"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleLoginAsUser(user);
                                }}
                                disabled={isCurrentUser || loginBusy}
                                aria-label={t('admin.users.loginAsUser')}
                                title={isCurrentUser ? t('admin.users.cannotEditSelf') : t('admin.users.loginAsUser')}
                              >
                                {loginBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                              </Button>
                            )}
                          </div>
                        </div>

                        {isSelected && (
                          <>
                            <div className="grid grid-cols-2 gap-3 border-t border-border/60 pt-4 text-xs">
                              <div className="space-y-1">
                                <p className="uppercase tracking-[0.12em] text-muted-foreground">{t('admin.users.officialIdLabel')}</p>
                                <p className="break-all font-mono text-muted-foreground">{user.official_id || '—'}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="uppercase tracking-[0.12em] text-muted-foreground">{t('admin.users.ssnLabel')}</p>
                                <p className="break-all font-mono text-muted-foreground">{user.social_security_number || '—'}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="uppercase tracking-[0.12em] text-muted-foreground">{t('common.country')}</p>
                                <p className="text-muted-foreground">{user.country || user.country_code || '—'}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="uppercase tracking-[0.12em] text-muted-foreground">{t('admin.users.joinedColumn')}</p>
                                <p className="text-muted-foreground">{formatDate(user.created_at)}</p>
                              </div>
                            </div>
                            {isCurrentUser && <p className="text-xs text-muted-foreground">{t('admin.users.selfRoleHint')}</p>}
                            <div className="grid gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full gap-2"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedUserId(user.id);
                                }}
                              >
                                <Settings2 className="h-4 w-4" />
                                {t('admin.users.manageAccess')}
                              </Button>
                              <Button
                                variant={user.is_verified ? 'secondary' : 'outline'}
                                size="sm"
                                className="w-full gap-2"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleVerificationToggle(user);
                                }}
                                disabled={isSaving}
                              >
                                {user.is_verified ? (
                                  <>
                                    <BadgeCheck className="h-4 w-4" />
                                    {t('admin.users.unverifyUser')}
                                  </>
                                ) : (
                                  <>
                                    <BadgeX className="h-4 w-4" />
                                    {t('admin.users.verifyUser')}
                                  </>
                                )}
                              </Button>
                              {canLoginAsFromAdmin && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="w-full gap-2"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleLoginAsUser(user);
                                  }}
                                  disabled={isCurrentUser || loginBusy}
                                >
                                  {loginBusy ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <LogIn className="h-4 w-4" />
                                  )}
                                  {t('admin.users.loginAsUser')}
                                </Button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

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
                        const isCurrentUser = user.user_id === profile?.user_id;
                        const isLevelSaving = levelSavingUserId === user.id;
                        const isSaving = roleSavingUserId === user.id || overrideSavingUserId === user.id || isLevelSaving;
                        const isSelected = selectedUserId === user.id;
                        const isOnline = isUserOnline(user);
                        const displayName = getDisplayNameParts(user);
                        const userLevel = userExperienceLevels.includes(user.experience_level)
                          ? user.experience_level
                          : 'entry';
                        const LevelIcon = userExperienceLevelIconMap[userLevel];
                        const shouldShowProBadge = displayName.hasProfessionalSuffix || userLevel === 'professional';

                        return (
                          <TableRow key={user.id} className={cn('group hover:bg-accent/40', isSelected && 'bg-primary/5 hover:bg-primary/5')}>
                            <TableCell>
                              <button type="button" className="flex items-center gap-3 text-left" onClick={() => setSelectedUserId(user.id)}>
                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary">
                                  {getInitials(user.full_name, user.username)}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-foreground">{displayName.name || t('common.anonymousUser')}</p>
                                  <div className="flex items-center gap-2">
                                    <p className="truncate text-sm text-muted-foreground">
                                      {user.username ? `@${user.username}` : t('admin.users.noUsername')}
                                    </p>
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        void handleCycleExperienceLevel(user);
                                      }}
                                      disabled={isLevelSaving}
                                      className={cn(
                                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors',
                                        userExperienceLevelClassMap[userLevel],
                                        'hover:opacity-90',
                                      )}
                                      title={t('admin.users.levelCycleHint')}
                                    >
                                      {isLevelSaving ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <>
                                          <LevelIcon className="h-3 w-3" />
                                          {userExperienceLevelLabelMap[userLevel]}
                                        </>
                                      )}
                                    </button>
                                    {shouldShowProBadge && (
                                      <span className="inline-flex items-center gap-1 rounded-full border border-teal-500/20 bg-teal-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-teal-700 dark:text-teal-300">
                                        <Award className="h-3 w-3" />
                                        Pro
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </button>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {user.official_id || '—'}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {user.social_security_number || '—'}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-2">
                                <Select value={user.role} onValueChange={(value) => handleRoleChange(user, value as AppRole)} disabled={isCurrentUser || isSaving}>
                                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {manageableRoles.map((role) => (
                                      <SelectItem key={role} value={role}>{t(`admin.roles.${role}`)}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {isCurrentUser && <p className="text-xs text-muted-foreground">{t('admin.users.selfRoleHint')}</p>}
                              </div>
                            </TableCell>
                            <TableCell>{user.country || user.country_code || '—'}</TableCell>
                            <TableCell>{formatDate(user.created_at)}</TableCell>
                            <TableCell>
                              <div className="flex flex-col items-start gap-2">
                                <Button variant="outline" size="sm" className="gap-2" onClick={() => setSelectedUserId(user.id)}>
                                  <Settings2 className="h-4 w-4" />
                                  {t('admin.users.manageAccess')}
                                </Button>
                                <Button
                                  variant={user.is_verified ? 'secondary' : 'outline'}
                                  size="sm"
                                  className="gap-2"
                                  onClick={() => void handleVerificationToggle(user)}
                                  disabled={isSaving}
                                >
                                  {user.is_verified ? (
                                    <>
                                      <BadgeCheck className="h-4 w-4" />
                                      {t('admin.users.unverifyUser')}
                                    </>
                                  ) : (
                                    <>
                                      <BadgeX className="h-4 w-4" />
                                      {t('admin.users.verifyUser')}
                                    </>
                                  )}
                                </Button>
                                {canLoginAsFromAdmin && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn('gap-2', isCurrentUser && 'opacity-40')}
                                    onClick={() => void handleLoginAsUser(user)}
                                    disabled={isCurrentUser || switchingUserId === user.id}
                                  >
                                    {switchingUserId === user.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <LogIn className="h-4 w-4" />
                                    )}
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
                                      onClick={() => void handleVerificationToggle(user)}
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
                                  <TooltipContent>
                                    {user.is_verified ? t('admin.users.userIsVerified') : t('admin.users.userIsUnverified')}
                                  </TooltipContent>
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
              </TooltipProvider>
            )}
          </Card>
        </motion.div>

        {selectedUser && overrideModes && (
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
                  <Badge className={cn('rounded-full border', roleBadgeClassName[selectedUser.role])} variant="outline">
                    {t(`admin.roles.${selectedUser.role}`)}
                  </Badge>
                  <Badge variant="secondary" className="rounded-full bg-primary/10 text-primary hover:bg-primary/10">
                    {t('admin.permissions.permissionCount', { count: selectedUserEffectivePermissions.length })}
                  </Badge>
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-4">
                  {groupedPermissions.map((sectionGroup) => (
                    <div key={sectionGroup.sectionId} className="space-y-3">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        {t(`admin.permissions.sectionNames.${sectionGroup.sectionId}`)}
                      </h3>

                      <div className="space-y-3">
                        {sectionGroup.pages.map((pageGroup) => (
                          <div
                            key={`${sectionGroup.sectionId}-${pageGroup.pageId}`}
                            className="rounded-3xl border border-border/60 bg-card/80 p-4"
                          >
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-foreground">{getPageLabel(pageGroup.pageId)}</p>
                              <Badge variant="outline" className="rounded-full text-[11px]">
                                {t('admin.permissions.featureColumn')}
                              </Badge>
                            </div>

                            <div className="space-y-3">
                              {pageGroup.items.map((entry) => {
                                const mode = overrideModes[entry.permission];
                                const inherited = (rolePermissions[selectedUser.role] || []).includes(entry.permission);

                                return (
                                  <div
                                    key={entry.permission}
                                    className="rounded-2xl border border-border/60 bg-background/70 p-4"
                                  >
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                      <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <p className="font-medium text-foreground">{t(entry.titleKey)}</p>
                                          {inherited && (
                                            <Badge
                                              variant="secondary"
                                              className="rounded-full bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
                                            >
                                              {t('admin.users.inheritedEnabled')}
                                            </Badge>
                                          )}
                                        </div>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                          {t(entry.descriptionKey)}
                                        </p>
                                      </div>
                                      <Select
                                        value={mode}
                                        onValueChange={(value) =>
                                          handleOverrideChange(entry.permission, value as OverrideMode)
                                        }
                                      >
                                        <SelectTrigger className="w-full lg:w-[170px]">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="inherit">
                                            {t('admin.users.overrideModes.inherit')}
                                          </SelectItem>
                                          <SelectItem value="grant">
                                            {t('admin.users.overrideModes.grant')}
                                          </SelectItem>
                                          <SelectItem value="deny">
                                            {t('admin.users.overrideModes.deny')}
                                          </SelectItem>
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
                                  {assignment?.verified_at && currentStatus !== 'pending' && (
                                    <Badge variant="outline" className="rounded-full text-[11px]">
                                      {formatDate(assignment.verified_at)}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">{profession.description}</p>
                              </div>
                              <Select
                                value={currentStatus}
                                onValueChange={(value) =>
                                  void handleProfessionStatusChange(selectedUser, profession.id, value as ProfessionStatusMode)
                                }
                                disabled={professionSavingKey === saveKey}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
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
                        return (
                          <Badge key={permission} variant="secondary" className="rounded-full bg-primary/10 text-primary hover:bg-primary/10">
                            {entry ? t(entry.titleKey) : permission}
                          </Badge>
                        );
                      })}
                    </div>
                  </Card>

                  {selectedUser.user_id !== profile?.user_id && (
                    <div className="rounded-2xl border border-border/60 bg-card/80 px-4 py-3 text-sm text-muted-foreground">
                      {overrideSavingUserId === selectedUser.id
                        ? t('admin.users.autoSaving')
                        : overrideSaveError
                          ? t('admin.users.autoSaveFailed')
                          : t('admin.users.autoSaveActive')}
                    </div>
                  )}
                  {overrideSaveError && selectedUser.user_id !== profile?.user_id && (
                    <Button
                      className="w-full gap-2"
                      onClick={handleRetrySaveOverrides}
                      disabled={overrideSavingUserId === selectedUser.id}
                    >
                      {overrideSavingUserId === selectedUser.id && <Loader2 className="h-4 w-4 animate-spin" />}
                      {t('admin.users.saveOverrides')}
                    </Button>
                  )}
                  {selectedUser.user_id === profile?.user_id && (
                    <p className="text-center text-xs text-muted-foreground">
                      {t('admin.users.selfPermissionsHint')}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
          <DialogContent className="rounded-3xl">
            <DialogHeader>
              <DialogTitle>{t('admin.users.createUserTitle')}</DialogTitle>
              <DialogDescription>{t('admin.users.createUserSubtitle')}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">{t('common.fullName')}</label>
                <Input
                  value={createUserForm.fullName}
                  onChange={(event) => setCreateUserForm((current) => ({ ...current, fullName: event.target.value }))}
                  placeholder={t('auth.fullNamePlaceholder')}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">{t('common.username')}</label>
                <Input
                  value={createUserForm.username}
                  onChange={(event) => setCreateUserForm((current) => ({ ...current, username: event.target.value }))}
                  placeholder={t('auth.usernamePlaceholder')}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">{t('common.email')}</label>
                <Input
                  type="email"
                  value={createUserForm.email}
                  onChange={(event) => setCreateUserForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder={t('auth.emailPlaceholder')}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">{t('admin.users.temporaryPassword')}</label>
                <Input
                  type="password"
                  value={createUserForm.password}
                  onChange={(event) => setCreateUserForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder={t('auth.passwordPlaceholder')}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground">{t('common.role')}</label>
                <Select
                  value={createUserForm.role}
                  onValueChange={(value) => setCreateUserForm((current) => ({ ...current, role: value as AppRole }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {manageableRoles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {t(`admin.roles.${role}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setCreateUserOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handleCreateUser}
                disabled={
                  creatingUser ||
                  !createUserForm.email.trim() ||
                  !createUserForm.password.trim()
                }
              >
                {creatingUser ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('admin.users.creatingUser')}
                  </>
                ) : (
                  t('admin.users.createUser')
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
