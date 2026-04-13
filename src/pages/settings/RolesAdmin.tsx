import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  Crown,
  Cpu,
  Loader2,
  ShieldCheck,
  Store,
  User,
  Users,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { APP_ROLES, type AppPermission, type AppRole } from '@/lib/access-control';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type RolePermissionRow = {
  role: AppRole;
  permission: AppPermission;
};

const roleIconMap = {
  guest: User,
  member: User,
  verified_member: BadgeCheck,
  certified: Award,
  moderator: ShieldCheck,
  market_manager: Store,
  founder: Crown,
  admin: Users,
  system: Cpu,
} as const;

export default function RolesAdmin() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [roleCounts, setRoleCounts] = useState<Record<AppRole, number>>(
    Object.fromEntries(APP_ROLES.map((role) => [role, 0])) as Record<AppRole, number>,
  );

  useEffect(() => {
    const loadRoleCounts = async () => {
      setLoading(true);
      const { data, error } = await supabase.from('role_permissions').select('role,permission');

      if (error) {
        console.error('Error loading role counts:', error);
        toast.error(t('admin.rolesPage.loadFailed'));
        setLoading(false);
        return;
      }

      const counts = Object.fromEntries(
        APP_ROLES.map((role) => [
          role,
          ((data || []) as RolePermissionRow[]).filter((entry) => entry.role === role).length,
        ]),
      ) as Record<AppRole, number>;

      setRoleCounts(counts);
      setLoading(false);
    };

    void loadRoleCounts();
  }, [t]);

  const orderedRoles = useMemo(
    () => (profile?.role === 'admin' ? APP_ROLES.filter((role) => role !== 'founder') : APP_ROLES),
    [profile?.role],
  );

  return (
    <AppLayout>
      <div className="space-y-6 px-4 py-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/settings')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </Button>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          <h1 className="text-2xl font-display font-bold text-foreground">{t('admin.rolesPage.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('admin.rolesPage.subtitle')}</p>
        </motion.div>

        {loading ? (
          <Card className="flex items-center justify-center gap-2 rounded-3xl border-border/60 px-6 py-20 text-muted-foreground shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{t('common.loading')}</span>
          </Card>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            {orderedRoles.map((role) => {
              const RoleIcon = roleIconMap[role];

              return (
                <Card key={role} className="rounded-3xl border-border/60 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="rounded-xl bg-primary/10 p-2 text-primary">
                          <RoleIcon className="h-4 w-4" />
                        </div>
                        <h2 className="truncate text-sm font-semibold text-foreground">{t(`admin.roles.${role}`)}</h2>
                      </div>

                      <p className="text-sm leading-6 text-muted-foreground">{t(`admin.roleDescriptions.${role}`)}</p>
                    </div>

                    <Badge
                      variant="secondary"
                      className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary hover:bg-primary/10"
                    >
                      {t('admin.permissions.permissionCount', { count: roleCounts[role] })}
                    </Badge>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/60 pt-3">
                    <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      {t('admin.rolesPage.scopeLabel')}
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {role === 'system' ? t('admin.permissions.readOnlyRole') : t('admin.rolesPage.manageInPermissions')}
                    </span>
                  </div>
                </Card>
              );
            })}
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}
