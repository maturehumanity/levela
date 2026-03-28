import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle, Lock } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';

export default function ResetPassword() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let fallbackTimeout: ReturnType<typeof setTimeout>;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      console.log('[ResetPassword] auth event:', event, !!session);
      if (session) {
        setHasSession(true);
        setCheckingSession(false);
      }
    });

    const checkSession = async () => {
      await new Promise((r) => setTimeout(r, 500));
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      if (data.session) {
        setHasSession(true);
        setCheckingSession(false);
      } else {
        fallbackTimeout = setTimeout(() => {
          if (!isMounted) return;
          setCheckingSession(false);
        }, 2000);
      }
    };

    checkSession();

    return () => {
      isMounted = false;
      clearTimeout(fallbackTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!hasSession) {
      setError(t('auth.openRecoveryLink'));
      return;
    }

    if (password.length < 6) {
      setError(t('auth.passwordTooShort'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('auth.passwordsDoNotMatch'));
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess(true);

    await supabase.auth.signOut();
    setTimeout(() => navigate('/login'), 600);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <motion.div
          className="text-center w-full max-w-sm"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground mb-2">{t('auth.passwordUpdated')}</h1>
          <p className="text-muted-foreground mb-6">{t('auth.passwordUpdatedMessage')}</p>
          <Button asChild>
            <Link to="/login">{t('auth.signIn')}</Link>
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col safe-top">
      <div className="flex-1 flex flex-col justify-center px-6 py-12">
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
              {t('auth.resetTitle')}
            </motion.h1>
            <p className="text-muted-foreground">{t('auth.resetSubtitle')}</p>
          </div>

          {checkingSession ? (
            <div className="text-center text-sm text-muted-foreground">{t('common.loading')}</div>
          ) : (
            <>
              {!hasSession && (
                <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground mb-4">
                  {t('auth.recoveryOnlyWorks')}{' '}
                  <Link to="/forgot-password" className="text-primary hover:underline font-medium">
                    {t('auth.forgotPasswordLink')}
                  </Link>
                  .
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">{t('auth.newPassword')}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder={t('auth.passwordPlaceholder')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder={t('auth.passwordPlaceholder')}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10"
                      required
                      minLength={6}
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
                  {loading ? t('auth.updating') : t('auth.updatePassword')}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </form>

              <p className="text-center mt-6 text-sm text-muted-foreground">
                <Link to="/login" className="text-primary hover:underline font-medium">
                  {t('auth.backToLogin')}
                </Link>
              </p>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
