import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserRound, Lock, ArrowRight } from 'lucide-react';
import TestUserSwitcher, { type TestUserFixture } from '@/components/dev/TestUserSwitcher';

export default function Login() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const { t } = useLanguage();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyTestUser = (user: TestUserFixture) => {
    setIdentifier(user.email || user.username);
    setPassword(user.password);
    setError(null);
  };

  const signInTestUser = async (user: TestUserFixture) => {
    setIdentifier(user.email || user.username);
    setPassword(user.password);
    setLoading(true);
    setError(null);

    const { error } = await signIn(user.email || user.username, user.password);

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    navigate('/');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await signIn(identifier, password);

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate('/');
    }
  };

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
              {t('auth.loginTitle')}
            </motion.h1>
            <p className="text-muted-foreground">{t('auth.loginSubtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">{t('auth.loginIdentifier')}</Label>
              <div className="relative">
                <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="identifier"
                  type="text"
                  placeholder={t('auth.loginIdentifierPlaceholder')}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.password')}</Label>
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
                />
              </div>
              <div className="flex justify-end">
                <Link to="/forgot-password" className="text-xs text-primary hover:underline font-medium">
                  {t('auth.forgotPassword')}
                </Link>
              </div>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-destructive"
              >
                {error}
                {error.toLowerCase().includes('invalid login credentials') && (
                  <span className="block mt-1 text-muted-foreground">
                    {t('auth.invalidCredentialsPrefix')}{' '}
                    <Link to="/forgot-password" className="text-primary hover:underline font-medium">
                      {t('auth.forgotPassword')}
                    </Link>
                    .
                  </span>
                )}
              </motion.p>
            )}

            <Button
              type="submit"
              className="w-full gap-2"
              disabled={loading}
            >
              {loading ? t('auth.signingIn') : t('auth.signIn')}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          <TestUserSwitcher onApply={applyTestUser} onSignIn={signInTestUser} disabled={loading} />

          <p className="text-center mt-6 text-sm text-muted-foreground">
            {t('auth.dontHaveAccount')}{' '}
            <Link to="/signup" className="text-primary hover:underline font-medium">
              {t('auth.signUpLink')}
            </Link>
          </p>
          <p className="text-center mt-3 text-sm text-muted-foreground">
            <Link to="/download" className="text-primary hover:underline font-medium">
              {t('auth.downloadAndroid')}
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
