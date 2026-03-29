import { motion } from 'framer-motion';
import { Apple, Download, ExternalLink, Smartphone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ANDROID_DOWNLOAD_PATH } from '@/lib/downloads';

export default function DownloadPage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-3xl space-y-8"
      >
        <div className="space-y-3 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
            <Download className="h-4 w-4" />
            {t('downloads.badge')}
          </div>
          <h1 className="text-4xl font-display font-bold text-foreground">{t('downloads.title')}</h1>
          <p className="mx-auto max-w-2xl text-muted-foreground">{t('downloads.subtitle')}</p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Card className="rounded-3xl border-border/60 bg-card/80 shadow-sm">
            <CardContent className="space-y-5 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                  <Smartphone className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">{t('downloads.android.title')}</h2>
                  <p className="text-sm text-muted-foreground">{t('downloads.android.subtitle')}</p>
                </div>
              </div>

              <p className="text-sm leading-6 text-muted-foreground">{t('downloads.android.description')}</p>

              <div className="rounded-2xl border border-border/60 bg-background/80 p-4 text-sm text-muted-foreground">
                {t('downloads.android.installHint')}
              </div>

              <Button asChild className="w-full gap-2">
                <a href={ANDROID_DOWNLOAD_PATH} download>
                  {t('downloads.android.button')}
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border/60 bg-card/80 shadow-sm">
            <CardContent className="space-y-5 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <Apple className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">{t('downloads.ios.title')}</h2>
                  <p className="text-sm text-muted-foreground">{t('downloads.ios.subtitle')}</p>
                </div>
              </div>

              <p className="text-sm leading-6 text-muted-foreground">{t('downloads.ios.description')}</p>

              <div className="rounded-2xl border border-border/60 bg-background/80 p-4 text-sm text-muted-foreground">
                {t('downloads.ios.installHint')}
              </div>

              <Button disabled className="w-full">
                {t('downloads.ios.button')}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-center">
          <Button asChild variant="ghost">
            <Link to="/login">{t('downloads.backToApp')}</Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
