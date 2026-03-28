import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { permissionListHasAny, type AppPermission } from '@/lib/access-control';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermissions?: AppPermission[];
  redirectTo?: string;
}

export function ProtectedRoute({
  children,
  requiredPermissions,
  redirectTo = '/',
}: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();
  const { t } = useLanguage();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse-soft text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/onboarding" state={{ from: location }} replace />;
  }

  if (
    requiredPermissions?.length &&
    (!profile || !permissionListHasAny(profile.effective_permissions || [], requiredPermissions))
  ) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
