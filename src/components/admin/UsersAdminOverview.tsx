import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Search, Shield, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type UsersAdminOverviewProps = {
  search: string;
  stats: {
    total: number;
    admins: number;
    staff: number;
  };
  t: (key: string) => string;
  onBack: () => void;
  onOpenCreateUser: () => void;
  onSearchChange: (value: string) => void;
};

export function UsersAdminOverview({
  search,
  stats,
  t,
  onBack,
  onOpenCreateUser,
  onSearchChange,
}: UsersAdminOverviewProps) {
  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
        <div className="grid grid-cols-3 items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="col-span-1 w-fit gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t('common.back')}
          </Button>
          <h1 className="col-span-1 text-center text-2xl font-display font-bold text-foreground">{t('admin.users.title')}</h1>
          <div className="col-span-1 flex justify-end">
            <Button className="w-full max-w-[180px] gap-2 sm:w-auto" onClick={onOpenCreateUser}>
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
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={t('admin.users.searchPlaceholder')}
              className="pl-9"
            />
          </div>
        </Card>
      </motion.div>
    </>
  );
}
