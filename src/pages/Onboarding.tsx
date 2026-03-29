import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Shield, Star, Users, TrendingUp, GraduationCap } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { AppDownloadCard } from '@/components/download/AppDownloadCard';

const features = [
  {
    icon: Shield,
    titleKey: 'onboarding.featureEvidenceTitle',
    descriptionKey: 'onboarding.featureEvidenceDescription',
  },
  {
    icon: Star,
    titleKey: 'onboarding.featurePillarsTitle',
    descriptionKey: 'onboarding.featurePillarsDescription',
  },
  {
    icon: Users,
    titleKey: 'onboarding.featureCommunityTitle',
    descriptionKey: 'onboarding.featureCommunityDescription',
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background flex flex-col safe-top safe-bottom">
      <div className="flex-1 flex flex-col justify-between px-6 py-12">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center pt-8"
        >
          <motion.div
            className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6"
            initial={{ scale: 0.8, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: 'spring' }}
          >
            <TrendingUp className="w-10 h-10 text-primary" />
          </motion.div>
          <h1 className="text-4xl font-display font-bold text-foreground mb-3">
            {t('onboarding.title')}
          </h1>
          <p className="text-lg text-muted-foreground max-w-xs mx-auto">
            {t('onboarding.subtitle')}
          </p>
        </motion.div>

        {/* Features */}
        <div className="space-y-4 my-12">
          {features.map((feature, index) => (
            <motion.div
              key={feature.titleKey}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className="flex items-start gap-4 p-4 bg-card rounded-xl shadow-soft"
            >
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{t(feature.titleKey)}</h3>
                <p className="text-sm text-muted-foreground">{t(feature.descriptionKey)}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Pillars preview */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex justify-center gap-2 mb-8"
        >
          {[
            { color: 'bg-pillar-education', icon: GraduationCap },
            { color: 'bg-pillar-culture', icon: Shield },
            { color: 'bg-pillar-responsibility', icon: Shield },
            { color: 'bg-pillar-environment', icon: Users },
            { color: 'bg-pillar-economy', icon: TrendingUp },
          ].map((pillar, i) => (
            <motion.div
              key={i}
              className={`w-10 h-10 ${pillar.color} rounded-lg flex items-center justify-center`}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.7 + i * 0.05, type: 'spring' }}
            >
              <pillar.icon className="w-5 h-5 text-white" />
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.72 }}
          className="mb-8"
        >
          <AppDownloadCard variant="stacked" />
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="space-y-3"
        >
          <Button
            onClick={() => navigate('/signup')}
            className="w-full gap-2"
            size="lg"
          >
            {t('onboarding.getStarted')}
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => navigate('/login')}
            variant="outline"
            className="w-full"
            size="lg"
          >
            {t('onboarding.existingAccount')}
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
