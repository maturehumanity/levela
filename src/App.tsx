import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import { AppUpdatePrompt } from "@/components/app/AppUpdatePrompt";
import { ThemeStorageSync } from "@/components/app/ThemeStorageSync";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { BuildOverlay } from "@/components/layout/BuildOverlay";

// Pages
import Onboarding from "@/pages/Onboarding";
import Login from "@/pages/auth/Login";
import SignUp from "@/pages/auth/SignUp";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import ResetPassword from "@/pages/auth/ResetPassword";
import Contribute from "@/pages/Contribute";
import DownloadPage from "@/pages/Download";
import Features from "@/pages/Features";
import Home from "@/pages/Home";
import Law from "@/pages/Law";
import Market from "@/pages/Market";
import TermsOfUse from "@/pages/TermsOfUse";
import Search from "@/pages/Search";
import Profile from "@/pages/Profile";
import UserProfile from "@/pages/UserProfile";
import EndorseSelect from "@/pages/EndorseSelect";
import EndorseFlow from "@/pages/EndorseFlow";
import Settings from "@/pages/Settings";
import EditProfile from "@/pages/settings/EditProfile";
import Pillars from "@/pages/settings/Pillars";
import RolesAdmin from "@/pages/settings/RolesAdmin";
import UsersAdmin from "@/pages/settings/UsersAdmin";
import PermissionsAdmin from "@/pages/settings/PermissionsAdmin";
import NotFound from "@/pages/NotFound";

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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem storageKey="levela-theme-v1">
      <ThemeStorageSync />
      <TooltipProvider>
        <AuthProvider>
          <LanguageProvider>
            <Toaster />
            <Sonner />
            <AppUpdatePrompt />
            <BrowserRouter>
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
                <Route path="/features" element={<ProtectedRoute><Features /></ProtectedRoute>} />
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
              <BuildOverlay />
            </BrowserRouter>
          </LanguageProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
