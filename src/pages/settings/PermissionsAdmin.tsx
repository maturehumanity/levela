import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Loader2,
  X,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { APP_ROLES, type AppPermission, type AppRole } from '@/lib/access-control';
import { pageRegistry, type PageId, type SectionId } from '@/lib/feature-registry';
import { permissionMetadata, permissionMetadataMap } from '@/lib/permission-metadata';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type RolePermissionRow = {
  role: AppRole;
  permission: AppPermission;
};

const sectionOrder: SectionId[] = ['home', 'discovery', 'knowledge', 'identity', 'contribution', 'marketplace', 'preferences', 'administration'];
const pageOrder: PageId[] = ['home', 'messaging', 'features', 'law', 'profile', 'editProfile', 'endorse', 'market', 'settings', 'admin', 'adminRoles', 'adminUsers', 'adminPermissions'];
function getPageLabel(pageId: PageId, t: (key: string, params?: Record<string, string | number>) => string) {
  if (pageId === 'editProfile') return t('settings.editProfile');
  if (pageId === 'admin') return t('features.pages.admin');
  if (pageId === 'adminRoles') return t('settings.adminRoles');
  if (pageId === 'adminUsers') return t('common.users');
  if (pageId === 'adminPermissions') return t('common.permissions');
  return t(pageRegistry[pageId].labelKey);
}

export default function PermissionsAdmin() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [collapsedPages, setCollapsedPages] = useState<Record<string, boolean>>({});
  const [rolePermissions, setRolePermissions] = useState<Record<AppRole, AppPermission[]>>(
    Object.fromEntries(APP_ROLES.map((role) => [role, []])) as Record<AppRole, AppPermission[]>,
  );
  const visibleRoles = useMemo(
    () => (profile?.role === 'admin' ? APP_ROLES.filter((role) => role !== 'founder') : APP_ROLES),
    [profile?.role],
  );
  const matrixGridTemplate = useMemo(
    () => `minmax(260px, 1.9fr) repeat(${visibleRoles.length}, minmax(72px, 0.65fr))`,
    [visibleRoles.length],
  );

  useEffect(() => {
    const loadMatrix = async () => {
      setLoading(true);
      const { data, error } = await supabase.from('role_permissions').select('role,permission');

      if (error) {
        console.error('Error loading permission matrix:', error);
        toast.error(t('admin.permissions.loadFailed'));
        setLoading(false);
        return;
      }

      setRolePermissions(
        Object.fromEntries(
          APP_ROLES.map((role) => [
            role,
            ((data || []) as RolePermissionRow[])
              .filter((entry) => entry.role === role)
              .map((entry) => entry.permission),
          ]),
        ) as Record<AppRole, AppPermission[]>,
      );
      setLoading(false);
    };

    void loadMatrix();
  }, [t]);

  const groupedPermissions = useMemo(() => {
    return sectionOrder
      .map((sectionId) => {
        const pages = pageOrder
          .map((pageId) => {
            const items = permissionMetadata.filter(
              (entry) => entry.section === sectionId && entry.page === pageId,
            );

            if (!items.length) return null;

            return {
              pageId,
              items,
            };
          })
          .filter(Boolean) as Array<{ pageId: PageId; items: typeof permissionMetadata }>;

        if (!pages.length) return null;

        return {
          sectionId,
          pages,
        };
      })
      .filter(Boolean) as Array<{
        sectionId: SectionId;
        pages: Array<{ pageId: PageId; items: typeof permissionMetadata }>;
      }>;
  }, []);

  const handleTogglePermission = async (role: AppRole, permission: AppPermission) => {
    if (role === 'system') return;

    const key = `${role}:${permission}`;
    const enabled = (rolePermissions[role] || []).includes(permission);
    setSavingKey(key);

    setRolePermissions((current) => ({
      ...current,
      [role]: enabled
        ? current[role].filter((item) => item !== permission)
        : [...current[role], permission].sort(),
    }));

    const operation = enabled
      ? supabase.from('role_permissions').delete().eq('role', role).eq('permission', permission)
      : supabase.from('role_permissions').insert({ role, permission });

    const { error } = await operation;

    if (error) {
      console.error('Error updating role permission:', error);
      setRolePermissions((current) => ({
        ...current,
        [role]: enabled
          ? [...current[role], permission].sort()
          : current[role].filter((item) => item !== permission),
      }));
      toast.error(t('admin.permissions.updateFailed'));
      setSavingKey(null);
      return;
    }

    toast.success(
      enabled
        ? t('admin.permissions.permissionDisabled', {
            role: t(`admin.roles.${role}`),
            permission: t(permissionMetadataMap[permission].titleKey),
          })
        : t('admin.permissions.permissionEnabled', {
            role: t(`admin.roles.${role}`),
            permission: t(permissionMetadataMap[permission].titleKey),
          }),
    );
    if (profile?.role === role) {
      await refreshProfile();
    }
    setSavingKey(null);
  };

  const togglePageVisibility = (pageKey: string) => {
    setCollapsedPages((current) => ({
      ...current,
      [pageKey]: !current[pageKey],
    }));
  };

  return (
    <AppLayout>
      <div className="space-y-6 px-4 py-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/settings')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </Button>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          <h1 className="text-2xl font-display font-bold text-foreground">{t('admin.permissions.title')}</h1>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="overflow-hidden rounded-3xl border-border/60 shadow-sm">
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-6 py-20 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t('common.loading')}</span>
              </div>
            ) : (
              <div className="max-h-[72vh] overflow-auto">
                <div
                  className="sticky top-0 z-20 grid items-center gap-3 border-b border-border/60 bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/80"
                  style={{ gridTemplateColumns: matrixGridTemplate }}
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {t('admin.permissions.featureColumn')}
                  </div>
                  {visibleRoles.map((role) => (
                    <div key={role} className="text-center text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {t(`admin.roles.${role}`)}
                    </div>
                  ))}
                </div>

                <div className="space-y-5 p-4">
                  {groupedPermissions.map((sectionGroup) => (
                    <div key={sectionGroup.sectionId} className="space-y-4">
                      <div className="space-y-1">
                        <h3 className="text-base font-semibold text-foreground">
                          {t(`admin.permissions.sectionNames.${sectionGroup.sectionId}`)}
                        </h3>
                      </div>

                      {sectionGroup.pages.map((pageGroup) => {
                        const sectionLabel = t(`admin.permissions.sectionNames.${sectionGroup.sectionId}`);
                        const pageLabel = getPageLabel(pageGroup.pageId, t);
                        const showPageLabel = pageLabel.trim().toLowerCase() !== sectionLabel.trim().toLowerCase();
                        const pageKey = `${sectionGroup.sectionId}:${pageGroup.pageId}`;
                        const isCollapsed = showPageLabel ? collapsedPages[pageKey] ?? false : false;

                        return (
                          <Card key={`${sectionGroup.sectionId}-${pageGroup.pageId}`} className="overflow-hidden rounded-3xl border-border/60 shadow-none">
                            {showPageLabel ? (
                              <div className="border-b border-border/60 px-4 py-3">
                                <button
                                  type="button"
                                  onClick={() => togglePageVisibility(pageKey)}
                                  className="flex w-full items-center gap-2 text-left"
                                >
                                  {isCollapsed ? (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  )}
                                  <h4 className="text-sm font-semibold text-foreground">{pageLabel}</h4>
                                </button>
                              </div>
                            ) : null}

                            {!isCollapsed ? (
                              <div className="divide-y divide-border/60">
                                {pageGroup.items.map((entry) => (
                                  <div
                                    key={entry.permission}
                                    className="grid items-center gap-2.5 rounded-2xl px-4 py-2 transition-[background-color,box-shadow] hover:bg-background/40 hover:ring-1 hover:ring-primary/20"
                                    style={{ gridTemplateColumns: matrixGridTemplate }}
                                  >
                                    <div className="min-w-0">
                                      <TooltipProvider delayDuration={120}>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              type="button"
                                              className="inline-flex max-w-full items-center gap-1 text-left font-medium text-foreground"
                                            >
                                              <span className="truncate">{t(entry.titleKey)}</span>
                                              <CircleHelp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" align="start" className="max-w-xs text-sm">
                                            {t(entry.descriptionKey)}
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </div>
                                    {visibleRoles.map((role) => {
                                      const enabled = (rolePermissions[role] || []).includes(entry.permission);
                                      const key = `${role}:${entry.permission}`;
                                      const isSaving = savingKey === key;
                                      const isReadOnly = role === 'system';
                                      return (
                                        <div key={key} className="flex justify-center">
                                          <button
                                            type="button"
                                            disabled={isReadOnly || isSaving}
                                            onClick={() => handleTogglePermission(role, entry.permission)}
                                            className={cn(
                                              'inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors',
                                              enabled
                                                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                                                : 'border-border bg-muted text-muted-foreground',
                                              !isReadOnly && 'hover:border-primary/30 hover:bg-primary/10 hover:text-primary',
                                              (isReadOnly || isSaving) && 'cursor-not-allowed opacity-70',
                                            )}
                                            aria-label={`${t(`admin.roles.${role}`)} ${t(entry.titleKey)}`}
                                          >
                                            {isSaving ? (
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : enabled ? (
                                              <Check className="h-4 w-4" />
                                            ) : (
                                              <X className="h-4 w-4" />
                                            )}
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </Card>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
}
