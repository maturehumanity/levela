import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';
import { Suspense, lazy } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useLanguage } from '@/contexts/LanguageContext';

const ChatBar = lazy(() =>
  import('@/components/ui/chat-bar').then((module) => ({ default: module.ChatBar })),
);

export default function Messaging() {
  const { t } = useLanguage();

  return (
    <AppLayout>
      <div className="space-y-4 px-4 pb-6 pt-4">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-4"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <MessageCircle className="h-7 w-7" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              {t('features.pages.messaging')}
            </h1>
            <p className="text-base text-muted-foreground">{t('messaging.subtitle')}</p>
          </div>
        </motion.div>
      </div>
      <Suspense fallback={null}>
        <ChatBar initialExpanded />
      </Suspense>
    </AppLayout>
  );
}
