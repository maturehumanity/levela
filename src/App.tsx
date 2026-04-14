import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import { AppUpdatePrompt } from "@/components/app/AppUpdatePrompt";
import { ThemeStorageSync } from "@/components/app/ThemeStorageSync";
import { AppCrashBoundary } from "@/components/app/AppCrashBoundary";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { BuildOverlay } from "@/components/layout/BuildOverlay";

// Pages (lazy-loaded to keep bundle sizes small)
const Onboarding = lazy(() => import('@/pages/Onboarding'));
const Login = lazy(() => import('@/pages/auth/Login'));
const SignUp = lazy(() => import('@/pages/auth/SignUp'));
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'));
const Contribute = lazy(() => import('@/pages/Contribute'));
const DownloadPage = lazy(() => import('@/pages/Download'));
const Features = lazy(() => import('@/pages/Features'));
const Study = lazy(() => import('@/pages/Study'));
const Home = lazy(() => import('@/pages/Home'));
const Law = lazy(() => import('@/pages/Law'));
const Market = lazy(() => import('@/pages/Market'));
const TermsOfUse = lazy(() => import('@/pages/TermsOfUse'));
const Search = lazy(() => import('@/pages/Search'));
const Profile = lazy(() => import('@/pages/Profile'));
const UserProfile = lazy(() => import('@/pages/UserProfile'));
const EndorseSelect = lazy(() => import('@/pages/EndorseSelect'));
const EndorseFlow = lazy(() => import('@/pages/EndorseFlow'));
const Settings = lazy(() => import('@/pages/Settings'));
const EditProfile = lazy(() => import('@/pages/settings/EditProfile'));
const Pillars = lazy(() => import('@/pages/settings/Pillars'));
const Professions = lazy(() => import('@/pages/settings/Professions'));
const RolesAdmin = lazy(() => import('@/pages/settings/RolesAdmin'));
const UsersAdmin = lazy(() => import('@/pages/settings/UsersAdmin'));
const PermissionsAdmin = lazy(() => import('@/pages/settings/PermissionsAdmin'));
const GovernanceAdmin = lazy(() => import('@/pages/settings/GovernanceAdmin'));
const NotFound = lazy(() => import('@/pages/NotFound'));

const queryClient = new QueryClient();

function AuthRedirect({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { t } = useLanguage();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse-soft text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function RouteFallback() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-pulse-soft text-muted-foreground">{t('common.loading')}</div>
    </div>
  );
}

const App = () => (
  <AppCrashBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem storageKey="levela-theme-v1">
        <ThemeStorageSync />
        <TooltipProvider>
          <AuthProvider>
            <LanguageProvider>
              <Toaster />
              <Sonner />
              <AppUpdatePrompt />
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                  {/* Public routes */}
                  <Route path="/onboarding" element={<AuthRedirect><Onboarding /></AuthRedirect>} />
                  <Route path="/login" element={<AuthRedirect><Login /></AuthRedirect>} />
                  <Route path="/signup" element={<AuthRedirect><SignUp /></AuthRedirect>} />
                  <Route path="/download" element={<DownloadPage />} />
                  <Route path="/terms" element={<TermsOfUse />} />
                  <Route path="/forgot-password" element={<AuthRedirect><ForgotPassword /></AuthRedirect>} />
                  {/* Do NOT wrap recovery route with AuthRedirect (recovery link may create a session) */}
                  <Route path="/reset-password" element={<ResetPassword />} />

                  {/* Protected routes */}
                  <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                  <Route path="/contribute" element={<ProtectedRoute><Contribute /></ProtectedRoute>} />
                  <Route path="/study" element={<ProtectedRoute><Study /></ProtectedRoute>} />
                  <Route path="/features" element={<ProtectedRoute><Navigate to="/study" replace /></ProtectedRoute>} />
                  <Route
                    path="/law"
                    element={
                      <ProtectedRoute requiredPermissions={['law.read']}>
                        <Law />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/search"
                    element={
                      <ProtectedRoute requiredPermissions={['profile.read']}>
                        <Search />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/market" element={<ProtectedRoute><Market /></ProtectedRoute>} />
                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute requiredPermissions={['profile.read']}>
                        <Profile />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/user/:userId"
                    element={
                      <ProtectedRoute requiredPermissions={['profile.read']}>
                        <UserProfile />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/endorse"
                    element={
                      <ProtectedRoute requiredPermissions={['endorsement.create']}>
                        <EndorseSelect />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/endorse/:userId"
                    element={
                      <ProtectedRoute requiredPermissions={['endorsement.create']}>
                        <EndorseFlow />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                  <Route path="/settings/legal" element={<ProtectedRoute><TermsOfUse /></ProtectedRoute>} />
                  <Route
                    path="/settings/profile"
                    element={
                      <ProtectedRoute requiredPermissions={['profile.update_self']}>
                        <EditProfile />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/settings/professions"
                    element={
                      <ProtectedRoute>
                        <Professions />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/settings/pillars"
                    element={
                      <ProtectedRoute requiredPermissions={['profile.update_self']}>
                        <Pillars />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/settings/admin/roles"
                    element={
                      <ProtectedRoute requiredPermissions={['role.assign', 'settings.manage']}>
                        <RolesAdmin />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/settings/admin/users"
                    element={
                      <ProtectedRoute requiredPermissions={['role.assign', 'settings.manage']}>
                        <UsersAdmin />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/settings/admin/governance"
                    element={
                      <ProtectedRoute requiredPermissions={['role.assign', 'settings.manage']}>
                        <GovernanceAdmin />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/settings/admin/modules"
                    element={
                      <ProtectedRoute requiredPermissions={['role.assign', 'settings.manage']}>
                        <Features />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/settings/admin/permissions"
                    element={
                      <ProtectedRoute requiredPermissions={['role.assign', 'settings.manage']}>
                        <PermissionsAdmin />
                      </ProtectedRoute>
                    }
                  />

                  {/* Fallback */}
                  <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
                <BuildOverlay />
              </BrowserRouter>
            </LanguageProvider>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </AppCrashBoundary>
);

export default App;
