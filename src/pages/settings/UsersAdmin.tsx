import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  APP_PERMISSIONS,
  APP_ROLES,
  resolveEffectivePermissions,
  type AppPermission,
  type AppRole,
} from '@/lib/access-control';
import {
  coerceCitizenshipStatus,
  deriveProjectedCitizenshipStatus,
  getCitizenStatusLabelKey,
} from '@/lib/civic-status';
import { permissionMetadata } from '@/lib/permission-metadata';
import {
  getAdminVerificationDecision,
} from '@/lib/verification-workflow';
import {
  buildGovernanceSanctionScopeFlags,
  type GovernanceSanctionAppealStatus,
  type GovernanceSanctionScopeOption,
} from '@/lib/governance-sanctions';
import { pageRegistry, type PageId, type SectionId } from '@/lib/feature-registry';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  getEffectiveCitizenshipStatus,
  getNextUserExperienceLevel,
  type OverrideMode,
  type ProfessionRow,
  type ProfessionStatusMode,
  type ProfileProfessionRow,
  type ProfileRow,
  type RolePermissionRow,
  userExperienceLevelLabelMap,
  type VerificationCaseRow,
  type GovernanceSanctionAppealRow,
  type GovernanceSanctionRow,
} from '@/lib/users-admin';
import { UsersAdminOverview } from '@/components/admin/UsersAdminOverview';

const UsersAdminSelectedPanel = lazy(() =>
  import('@/components/admin/UsersAdminSelectedPanel').then((module) => ({ default: module.UsersAdminSelectedPanel })),
);

const UsersAdminCreateUserDialog = lazy(() =>
  import('@/components/admin/UsersAdminCreateUserDialog').then((module) => ({ default: module.UsersAdminCreateUserDialog })),
);

const UsersAdminMobileList = lazy(() =>
  import('@/components/admin/UsersAdminMobileList').then((module) => ({ default: module.UsersAdminMobileList })),
);

const UsersAdminDesktopTable = lazy(() =>
  import('@/components/admin/UsersAdminDesktopTable').then((module) => ({ default: module.UsersAdminDesktopTable })),
);

const sectionOrder: SectionId[] = ['home', 'discovery', 'knowledge', 'identity', 'contribution', 'marketplace', 'preferences', 'administration'];
const pageOrder: PageId[] = ['home', 'messaging', 'features', 'law', 'profile', 'editProfile', 'endorse', 'market', 'settings', 'adminUsers', 'adminPermissions'];

const emptyCreateUserForm = {
  fullName: '',
  username: '',
  email: '',
  password: '',
  role: 'member' as AppRole,
};

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

export default function UsersAdmin() {
  const navigate = useNavigate();
  const { profile, refreshProfile, signInWithOtp } = useAuth();
  const { t, language } = useLanguage();
  const isMobile = useIsMobile();
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Record<AppRole, AppPermission[]>>(
    Object.fromEntries(APP_ROLES.map((role) => [role, []])) as Record<AppRole, AppPermission[]>,
  );
  const [professions, setProfessions] = useState<ProfessionRow[]>([]);
  const [userProfessions, setUserProfessions] = useState<Record<string, ProfileProfessionRow[]>>({});
  const [verificationCasesByProfile, setVerificationCasesByProfile] = useState<Record<string, VerificationCaseRow>>({});
  const [sanctionsByProfile, setSanctionsByProfile] = useState<Record<string, GovernanceSanctionRow[]>>({});
  const [appealsByProfile, setAppealsByProfile] = useState<Record<string, GovernanceSanctionAppealRow[]>>({});
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
  const [sanctionSavingUserId, setSanctionSavingUserId] = useState<string | null>(null);
  const [appealSavingId, setAppealSavingId] = useState<string | null>(null);
  const [switchingUserId, setSwitchingUserId] = useState<string | null>(null);
  const latestOverrideSignatureRef = useRef<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);

    const [
      { data: usersData, error: usersError },
      { data: matrixData, error: matrixError },
      { data: professionsData, error: professionsError },
      { data: profileProfessionsData, error: profileProfessionsError },
      { data: verificationCasesData, error: verificationCasesError },
      { data: sanctionsData, error: sanctionsError },
      { data: appealsData, error: appealsError },
    ] = await Promise.all([
      supabase.from('profiles').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('role_permissions').select('role,permission'),
      supabase.from('professions').select('*').order('label', { ascending: true }),
      supabase.from('profile_professions').select('*'),
      supabase.from('identity_verification_cases').select('*'),
      supabase.from('governance_sanctions').select('*').order('created_at', { ascending: false }),
      supabase.from('governance_sanction_appeals').select('*').order('created_at', { ascending: false }),
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

    if (verificationCasesError) {
      console.error('Error loading identity verification cases:', verificationCasesError);
      toast.error(t('admin.users.verificationCasesLoadFailed'));
    }

    if (sanctionsError) {
      console.error('Error loading governance sanctions:', sanctionsError);
      toast.error(t('admin.users.sanctionsLoadFailed'));
    }

    if (appealsError) {
      console.error('Error loading governance sanction appeals:', appealsError);
      toast.error(t('admin.users.appealsLoadFailed'));
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
    const verificationCaseMap = ((verificationCasesData || []) as VerificationCaseRow[]).reduce<Record<string, VerificationCaseRow>>(
      (accumulator, verificationCase) => {
        accumulator[verificationCase.profile_id] = verificationCase;
        return accumulator;
      },
      {},
    );
    const sanctionsMap = ((sanctionsData || []) as GovernanceSanctionRow[]).reduce<Record<string, GovernanceSanctionRow[]>>(
      (accumulator, sanction) => {
        if (!accumulator[sanction.profile_id]) {
          accumulator[sanction.profile_id] = [];
        }
        accumulator[sanction.profile_id].push(sanction);
        return accumulator;
      },
      {},
    );
    const appealsMap = ((appealsData || []) as GovernanceSanctionAppealRow[]).reduce<Record<string, GovernanceSanctionAppealRow[]>>(
      (accumulator, appeal) => {
        if (!accumulator[appeal.profile_id]) {
          accumulator[appeal.profile_id] = [];
        }
        accumulator[appeal.profile_id].push(appeal);
        return accumulator;
      },
      {},
    );

    setUsers(nextUsers);
    setRolePermissions(groupedRolePermissions);
    setProfessions((professionsData || []) as ProfessionRow[]);
    setUserProfessions(groupedProfessions);
    setVerificationCasesByProfile(verificationCaseMap);
    setSanctionsByProfile(sanctionsMap);
    setAppealsByProfile(appealsMap);
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
      [
        user.full_name,
        user.username,
        user.country,
        user.role,
        user.citizenship_status,
        verificationCasesByProfile[user.id]?.status,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [search, users, verificationCasesByProfile]);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) || null,
    [selectedUserId, users],
  );

  const selectedUserProfessions = useMemo(
    () => (selectedUser ? userProfessions[selectedUser.id] || [] : []),
    [selectedUser, userProfessions],
  );
  const selectedUserCitizenshipStatus = useMemo(
    () => (selectedUser ? getEffectiveCitizenshipStatus(selectedUser) : null),
    [selectedUser],
  );
  const selectedUserVerificationCase = useMemo(
    () => (selectedUser ? verificationCasesByProfile[selectedUser.id] || null : null),
    [selectedUser, verificationCasesByProfile],
  );
  const selectedUserSanctions = useMemo(
    () => (selectedUser ? sanctionsByProfile[selectedUser.id] || [] : []),
    [sanctionsByProfile, selectedUser],
  );
  const selectedUserAppeals = useMemo(
    () => (selectedUser ? appealsByProfile[selectedUser.id] || [] : []),
    [appealsByProfile, selectedUser],
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
      admins: users.filter((user) => ['admin', 'system'].includes(user.role)).length,
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

    const now = new Date().toISOString();
    const previousRole = target.role;
    const previousCitizenshipStatus = target.citizenship_status;
    const previousAcceptedAt = target.citizenship_accepted_at;
    const previousAcceptanceMode = target.citizenship_acceptance_mode;
    const previousIsActiveCitizen = target.is_active_citizen;
    const previousActiveCitizenSince = target.active_citizen_since;
    const nextProjectedCitizenshipStatus = deriveProjectedCitizenshipStatus(nextRole, Boolean(target.is_verified));
    const nextCitizenshipStatus = coerceCitizenshipStatus(target.citizenship_status, nextProjectedCitizenshipStatus);
    const nextIsActiveCitizen = target.is_active_citizen || nextRole === 'founder';
    const rolePatch: Database['public']['Tables']['profiles']['Update'] = {
      role: nextRole,
      citizenship_status: nextCitizenshipStatus,
      citizenship_accepted_at:
        nextCitizenshipStatus === 'citizen' ? target.citizenship_accepted_at ?? now : target.citizenship_accepted_at,
      citizenship_acceptance_mode:
        nextCitizenshipStatus === 'citizen'
          ? target.citizenship_acceptance_mode ?? (nextRole === 'founder' ? 'bootstrap' : 'system_projection')
          : target.citizenship_acceptance_mode,
      is_active_citizen: nextIsActiveCitizen,
      active_citizen_since: nextIsActiveCitizen ? target.active_citizen_since ?? now : target.active_citizen_since,
    };

    setRoleSavingUserId(target.id);
    setUsers((current) =>
      current.map((user) =>
        user.id === target.id
          ? {
              ...user,
              role: nextRole,
              is_admin: nextRole === 'admin' || nextRole === 'system',
              citizenship_status: nextCitizenshipStatus,
              citizenship_accepted_at:
                nextCitizenshipStatus === 'citizen'
                  ? user.citizenship_accepted_at ?? now
                  : user.citizenship_accepted_at,
              citizenship_acceptance_mode:
                nextCitizenshipStatus === 'citizen'
                  ? user.citizenship_acceptance_mode ?? (nextRole === 'founder' ? 'bootstrap' : 'system_projection')
                  : user.citizenship_acceptance_mode,
              is_active_citizen: nextIsActiveCitizen,
              active_citizen_since: nextIsActiveCitizen ? user.active_citizen_since ?? now : user.active_citizen_since,
            }
          : user,
      ),
    );

    const { error } = await supabase.from('profiles').update(rolePatch).eq('id', target.id);

    if (error) {
      console.error('Error updating role:', error);
      setUsers((current) =>
        current.map((user) =>
          user.id === target.id
            ? {
                ...user,
                role: previousRole,
                is_admin: previousRole === 'admin' || previousRole === 'system',
                citizenship_status: previousCitizenshipStatus,
                citizenship_accepted_at: previousAcceptedAt,
                citizenship_acceptance_mode: previousAcceptanceMode,
                is_active_citizen: previousIsActiveCitizen,
                active_citizen_since: previousActiveCitizenSince,
              }
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
    const now = new Date().toISOString();
    setRoleSavingUserId(target.id);

    const existingCase = verificationCasesByProfile[target.id] || null;
    const caseUpsert: Database['public']['Tables']['identity_verification_cases']['Insert'] = {
      profile_id: target.id,
      status: nextVerified ? 'in_review' : 'revoked',
      verification_method: existingCase?.verification_method || 'admin_review',
      personal_info_completed:
        existingCase?.personal_info_completed
        ?? Boolean(target.full_name && target.country && target.official_id),
      contact_info_completed:
        existingCase?.contact_info_completed
        ?? Boolean(target.username || target.language_code),
      live_verification_completed: nextVerified ? true : existingCase?.live_verification_completed ?? false,
      submitted_at: existingCase?.submitted_at ?? now,
      notes: nextVerified
        ? t('admin.users.verificationApprovedNote')
        : t('admin.users.verificationRevokedNote'),
    };

    const caseResponse = await supabase
      .from('identity_verification_cases')
      .upsert(caseUpsert, { onConflict: 'profile_id' })
      .select('*')
      .single();

    if (caseResponse.error || !caseResponse.data) {
      console.error('Error upserting verification case:', caseResponse.error);
      toast.error(t('admin.users.verificationCaseUpdateFailed'));
      setRoleSavingUserId(null);
      return;
    }

    const reviewResponse = await supabase
      .from('identity_verification_reviews')
      .insert({
        case_id: caseResponse.data.id,
        reviewer_id: profile?.id ?? null,
        decision: getAdminVerificationDecision(nextVerified),
        notes: nextVerified
          ? t('admin.users.verificationApprovedNote')
          : t('admin.users.verificationRevokedNote'),
      });

    if (reviewResponse.error) {
      console.error('Error recording verification review:', reviewResponse.error);
      toast.error(t('admin.users.verificationReviewFailed'));
      setRoleSavingUserId(null);
      return;
    }

    await loadData();
    if (target.user_id === profile?.user_id) {
      await refreshProfile();
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

  const handleIssueSanction = async (args: {
    targetUser: ProfileRow;
    scope: GovernanceSanctionScopeOption;
    reason: string;
    notes: string;
    durationDays: number | null;
  }) => {
    if (!profile?.id) return false;

    const reason = args.reason.trim();
    if (!reason) return false;

    setSanctionSavingUserId(args.targetUser.id);

    const endsAt = args.durationDays && args.durationDays > 0
      ? new Date(Date.now() + args.durationDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { error } = await supabase
      .from('governance_sanctions')
      .insert({
        profile_id: args.targetUser.id,
        issued_by: profile.id,
        reason,
        notes: args.notes.trim() || null,
        ends_at: endsAt,
        ...buildGovernanceSanctionScopeFlags(args.scope),
      });

    if (error) {
      console.error('Error issuing governance sanction:', error);
      toast.error(t('admin.users.sanctionIssueFailed'));
      setSanctionSavingUserId(null);
      return false;
    }

    toast.success(t('admin.users.sanctionIssued'));
    setSanctionSavingUserId(null);
    await loadData();
    return true;
  };

  const handleLiftSanction = async (sanction: GovernanceSanctionRow) => {
    if (!profile?.id) return false;

    setSanctionSavingUserId(sanction.profile_id);

    const { error } = await supabase
      .from('governance_sanctions')
      .update({
        is_active: false,
        lifted_by: profile.id,
        lifted_at: new Date().toISOString(),
      })
      .eq('id', sanction.id)
      .eq('is_active', true);

    if (error) {
      console.error('Error lifting governance sanction:', error);
      toast.error(t('admin.users.sanctionLiftFailed'));
      setSanctionSavingUserId(null);
      return false;
    }

    toast.success(t('admin.users.sanctionLifted'));
    setSanctionSavingUserId(null);
    await loadData();
    return true;
  };

  const handleSaveAppeal = async (args: {
    appeal: GovernanceSanctionAppealRow;
    status: GovernanceSanctionAppealStatus;
    resolutionNotes: string;
  }) => {
    if (!profile?.id) return false;

    setAppealSavingId(args.appeal.id);

    const now = new Date().toISOString();
    const shouldSetReviewTimestamp = args.status === 'under_review'
      || args.status === 'accepted'
      || args.status === 'rejected';

    const { error } = await supabase
      .from('governance_sanction_appeals')
      .update({
        status: args.status,
        reviewed_by: shouldSetReviewTimestamp ? profile.id : null,
        reviewed_at: shouldSetReviewTimestamp ? now : null,
        resolution_notes: args.resolutionNotes.trim() || null,
      })
      .eq('id', args.appeal.id);

    if (error) {
      console.error('Error saving governance sanction appeal:', error);
      toast.error(t('admin.users.appealSaveFailed'));
      setAppealSavingId(null);
      return false;
    }

    toast.success(t('admin.users.appealSaved'));
    setAppealSavingId(null);
    await loadData();
    return true;
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
        <UsersAdminOverview
          search={search}
          stats={stats}
          t={t}
          onBack={() => navigate('/settings')}
          onOpenCreateUser={() => setCreateUserOpen(true)}
          onSearchChange={setSearch}
        />

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
              <Suspense
                fallback={
                  <div className="flex items-center justify-center gap-2 px-6 py-20 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{t('common.loading')}</span>
                  </div>
                }
              >
                {isMobile ? (
                  <UsersAdminMobileList
                    canLoginAsFromAdmin={canLoginAsFromAdmin}
                    levelSavingUserId={levelSavingUserId}
                    overrideSavingUserId={overrideSavingUserId}
                    profileUserId={profile?.user_id}
                    roleSavingUserId={roleSavingUserId}
                    selectedUserId={selectedUserId}
                    switchingUserId={switchingUserId}
                    t={t}
                    verificationCasesByProfile={verificationCasesByProfile}
                    visibleUsers={visibleUsers}
                    formatDate={formatDate}
                    formatRelativeTime={formatRelativeTime}
                    getActivityTimestamp={getActivityTimestamp}
                    isUserOnline={isUserOnline}
                    onCycleExperienceLevel={(user) => void handleCycleExperienceLevel(user)}
                    onLoginAsUser={(user) => void handleLoginAsUser(user)}
                    onRoleChange={(user, nextRole) => void handleRoleChange(user, nextRole)}
                    onSelectUser={setSelectedUserId}
                    onToggleSelectedUser={(userId) => setSelectedUserId((current) => (current === userId ? null : userId))}
                    onVerificationToggle={(user) => void handleVerificationToggle(user)}
                  />
                ) : (
                  <UsersAdminDesktopTable
                    canLoginAsFromAdmin={canLoginAsFromAdmin}
                    levelSavingUserId={levelSavingUserId}
                    overrideSavingUserId={overrideSavingUserId}
                    profileUserId={profile?.user_id}
                    roleSavingUserId={roleSavingUserId}
                    selectedUserId={selectedUserId}
                    switchingUserId={switchingUserId}
                    t={t}
                    verificationCasesByProfile={verificationCasesByProfile}
                    visibleUsers={visibleUsers}
                    formatDate={formatDate}
                    formatRelativeTime={formatRelativeTime}
                    getActivityTimestamp={getActivityTimestamp}
                    isUserOnline={isUserOnline}
                    onCycleExperienceLevel={(user) => void handleCycleExperienceLevel(user)}
                    onLoginAsUser={(user) => void handleLoginAsUser(user)}
                    onRoleChange={(user, nextRole) => void handleRoleChange(user, nextRole)}
                    onSelectUser={setSelectedUserId}
                    onVerificationToggle={(user) => void handleVerificationToggle(user)}
                  />
                )}
              </Suspense>
            )}
          </Card>
        </motion.div>

        {selectedUser && overrideModes && (
          <Suspense fallback={<Card className="rounded-3xl border-border/60 p-5 shadow-sm" />}>
            <UsersAdminSelectedPanel
              groupedPermissions={groupedPermissions}
              overrideModes={overrideModes}
              overrideSaveError={overrideSaveError}
              overrideSavingUserId={overrideSavingUserId}
              professionSavingKey={professionSavingKey}
              professions={professions}
              profileUserId={profile?.user_id}
              rolePermissions={rolePermissions}
              selectedUser={selectedUser}
              selectedUserCitizenshipStatus={selectedUserCitizenshipStatus}
              selectedUserSanctions={selectedUserSanctions}
              selectedUserAppeals={selectedUserAppeals}
              selectedUserEffectivePermissions={selectedUserEffectivePermissions}
              selectedUserVerificationCase={selectedUserVerificationCase}
              sanctionSavingUserId={sanctionSavingUserId}
              appealSavingId={appealSavingId}
              t={t}
              formatDate={formatDate}
              getPageLabel={getPageLabel}
              getProfessionAssignment={getProfessionAssignment}
              handleOverrideChange={handleOverrideChange}
              handleProfessionStatusChange={handleProfessionStatusChange}
              handleIssueSanction={handleIssueSanction}
              handleLiftSanction={handleLiftSanction}
              handleSaveAppeal={handleSaveAppeal}
              handleRetrySaveOverrides={handleRetrySaveOverrides}
            />
          </Suspense>
        )}

        <Suspense fallback={null}>
          <UsersAdminCreateUserDialog
            creatingUser={creatingUser}
            form={createUserForm}
            manageableRoles={manageableRoles}
            open={createUserOpen}
            t={t}
            onCreate={handleCreateUser}
            onOpenChange={setCreateUserOpen}
            onUpdateForm={(updater) => setCreateUserForm((current) => updater(current))}
          />
        </Suspense>
      </div>
    </AppLayout>
  );
}
