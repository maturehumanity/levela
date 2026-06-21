import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Mail, ArrowRight, CheckCircle } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { PublicPageShell } from '@/components/public/PublicPageShell';

export default function ForgotPassword() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <PublicPageShell contentClassName="flex flex-col items-center justify-center px-6 py-12" maxWidthClass="max-w-sm">
        <motion.div
          className="w-full max-w-sm text-center"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle className="h-10 w-10 text-primary" />
          </div>
          <h1 className="mb-2 font-display text-2xl font-bold text-foreground">{t('auth.checkEmailTitle')}</h1>
          <p className="mb-6 text-muted-foreground">{t('auth.passwordRecoveryMessage', { email })}</p>
          <Button asChild variant="outline">
            <Link to="/login">{t('auth.backToLogin')}</Link>
          </Button>
        </motion.div>
      </PublicPageShell>
    );
  }

  return (
    <PublicPageShell contentClassName="flex flex-col justify-center px-6 py-12" maxWidthClass="max-w-sm">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-sm"
      >
          <div className="text-center mb-8">
            <motion.h1
              className="text-4xl font-display font-bold text-primary mb-2"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
            >
              {t('auth.forgotTitle')}
            </motion.h1>
            <p className="text-muted-foreground">{t('auth.forgotSubtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder={t('auth.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-destructive"
              >
                {error}
              </motion.p>
            )}

            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? t('auth.sending') : t('auth.sendResetLink')}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          <p className="text-center mt-6 text-sm text-muted-foreground">
            {t('auth.rememberedIt')}{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">
              {t('auth.backToLogin')}
            </Link>
          </p>
        </motion.div>
    </PublicPageShell>
  );
}
