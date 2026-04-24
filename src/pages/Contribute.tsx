import { motion } from 'framer-motion';
import { Award, Edit3, MessageCircle, PlusCircle, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';

const actionMeta = [
  { key: 'endorse', icon: Award, path: '/endorse', iconClassName: 'text-accent' },
  { key: 'profile', icon: Edit3, path: '/settings/profile', iconClassName: 'text-primary' },
  { key: 'share', icon: MessageCircle, path: '/messaging', iconClassName: 'text-primary' },
  { key: 'score', icon: TrendingUp, path: '/profile', iconClassName: 'text-accent' },
] as const;

export default function Contribute() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <AppLayout>
      <div className="space-y-6 px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-4"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <PlusCircle className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              {t('contribute.title')}
            </h1>
            <p className="text-base text-muted-foreground">
              {t('contribute.subtitle')}
            </p>
          </div>
        </motion.div>

        <motion.div
          className="grid gap-3 sm:grid-cols-2"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          {actionMeta.map((action, index) => {
            const Icon = action.icon;
            return (
              <motion.div
                key={action.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + index * 0.04 }}
              >
                <Card
                  className="cursor-pointer border-border/70 bg-card/95 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-md"
                  onClick={() => navigate(action.path)}
                >
                  <Icon className={`mb-3 h-8 w-8 ${action.iconClassName}`} />
                  <h2 className="font-semibold text-foreground">
                    {t(`contribute.actions.${action.key}.title`)}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t(`contribute.actions.${action.key}.description`)}
                  </p>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </AppLayout>
  );
}
