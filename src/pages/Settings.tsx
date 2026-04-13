import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { type LanguageCode } from '@/lib/i18n';
import { permissionListHasAny, type AppPermission } from '@/lib/access-control';
import { APP_VERSION_TAG, ANDROID_VERSION_CODE } from '@/lib/app-release';
import { getAppUpdateChannel, onAppUpdateChannelChange, setAppUpdateChannel, toggleAppUpdateChannel } from '@/lib/update-channel';
import {
  User,
  Shield,
  Bell,
  HelpCircle,
  LogOut,
  ChevronRight,
  FileText,
  Lock,
  Settings as SettingsIcon,
  Globe,
  Palette,
  Users,
  KeyRound,
  ShieldCheck,
  Fingerprint,
  Landmark,
  LayoutGrid,
} from 'lucide-react';

const settingsItems = [
  {
    icon: User,
    labelKey: 'settings.editProfile',
    descriptionKey: 'settings.editProfileDescription',
    path: '/settings/profile',
    requiredPermissions: ['profile.update_self'] as AppPermission[],
  },
  {
    icon: Bell,
    labelKey: 'settings.notifications',
    descriptionKey: 'settings.notificationsDescription',
    path: '/settings/notifications',
  },
  {
    icon: Lock,
    labelKey: 'settings.privacy',
    descriptionKey: 'settings.privacyDescription',
    path: '/settings/privacy',
  },
  {
    icon: Shield,
    labelKey: 'settings.safety',
    descriptionKey: 'settings.safetyDescription',
    path: '/settings/safety',
  },
  {
    icon: FileText,
    labelKey: 'settings.termsPrivacy',
    descriptionKey: 'settings.termsPrivacyDescription',
    path: '/settings/legal',
  },
  {
    icon: HelpCircle,
    labelKey: 'settings.helpSupport',
    descriptionKey: 'settings.helpSupportDescription',
    path: '/settings/help',
  },
  {
    icon: SettingsIcon,
    labelKey: 'settings.pillars',
    descriptionKey: 'settings.pillarsDescription',
    path: '/settings/pillars',
    requiredPermissions: ['profile.update_self'] as AppPermission[],
  },
];

export default function Settings() {
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();
  const { language, setLanguage, languageOptions, t } = useLanguage();
  const [appUpdateChannel, setLocalAppUpdateChannel] = useState(getAppUpdateChannel);
  const installedReleaseLabel = `${APP_VERSION_TAG} (${ANDROID_VERSION_CODE})`;
  const channelReleaseLabel = appUpdateChannel === 'testing'
    ? `Testing ${installedReleaseLabel}`
    : installedReleaseLabel;
  const canAccessAdmin = profile
    ? permissionListHasAny(profile.effective_permissions || [], ['role.assign', 'settings.manage'])
    : false;

  const visibleSettingsItems = settingsItems.filter(
    (item) =>
      !item.requiredPermissions ||
      permissionListHasAny(profile?.effective_permissions || [], item.requiredPermissions),
  );

  const adminItems = canAccessAdmin
    ? [
        {
          icon: Fingerprint,
          labelKey: 'settings.adminRoles',
          descriptionKey: 'settings.adminRolesDescription',
          path: '/settings/admin/roles',
        },
        {
          icon: Users,
          labelKey: 'settings.adminUsers',
          descriptionKey: 'settings.adminUsersDescription',
          path: '/settings/admin/users',
        },
        {
          icon: KeyRound,
          labelKey: 'settings.adminPermissions',
          descriptionKey: 'settings.adminPermissionsDescription',
          path: '/settings/admin/permissions',
        },
        {
          icon: Landmark,
          labelKey: 'settings.adminGovernance',
          descriptionKey: 'settings.adminGovernanceDescription',
          path: '/settings/admin/governance',
        },
        {
          icon: LayoutGrid,
          labelKey: 'settings.adminModules',
          descriptionKey: 'settings.adminModulesDescription',
          path: '/settings/admin/modules',
        },
      ]
    : [];

  const handleSignOut = async () => {
    await signOut();
    navigate('/onboarding');
  };

  const handleLanguageChange = async (nextLanguage: string) => {
    await setLanguage(nextLanguage as LanguageCode);
  };

  const handleToggleUpdateChannel = () => {
    const nextChannel = toggleAppUpdateChannel(appUpdateChannel);
    setLocalAppUpdateChannel(nextChannel);
    setAppUpdateChannel(nextChannel);
  };

  useEffect(() => onAppUpdateChannelChange(setLocalAppUpdateChannel), []);

  return (
    <AppLayout>
      <div className="px-4 py-6 flex flex-col gap-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-display font-bold text-foreground">
            {t('settings.title')}
          </h1>
        </motion.div>

        {/* Language & Theme Settings */}
        {/* Language Settings */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Card className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Globe className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground">{t('settings.languageTitle')}</h3>
                <p className="text-sm text-muted-foreground">{t('settings.languageDescription')}</p>
              </div>
              <Select value={language} onValueChange={handleLanguageChange}>
                <SelectTrigger className="w-auto">
                  <SelectValue placeholder={t('settings.languageTitle')} />
                </SelectTrigger>
                <SelectContent>
                  {languageOptions.map((option) => (
                    <SelectItem key={option.code} value={option.code}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Card>
        </motion.div>

        {/* Appearance Settings */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Card className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Palette className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground">{t('settings.appearanceTitle')}</h3>
                <p className="text-sm text-muted-foreground">{t('settings.appearanceDescription')}</p>
              </div>
              <div className="flex-shrink-0">
                <ThemeToggle />
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Settings items */}
        <div className="flex flex-col gap-4">
          {visibleSettingsItems.map((item, index) => (
            <motion.div
              key={item.path}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: (index + 2) * 0.05 }}
            >
              <Card
                className="p-4 cursor-pointer hover:shadow-elevated transition-shadow"
                onClick={() => navigate(item.path)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{t(item.labelKey)}</h3>
                    <p className="text-sm text-muted-foreground">{t(item.descriptionKey)}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {canAccessAdmin && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="flex flex-col gap-3"
          >
            <div className="space-y-1">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {t('settings.adminTitle')}
              </h2>
              <p className="text-sm text-muted-foreground">{t('settings.adminDescription')}</p>
            </div>

            <div className="flex flex-col gap-4">
              {adminItems.map((item, index) => (
                <motion.div
                  key={item.path}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.05 }}
                >
                  <Card
                    className="p-4 cursor-pointer hover:shadow-elevated transition-shadow"
                    onClick={() => navigate(item.path)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                        <item.icon className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">{t(item.labelKey)}</h3>
                        <p className="text-sm text-muted-foreground">{t(item.descriptionKey)}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Sign out */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: canAccessAdmin ? 0.65 : 0.55 }}
        >
          <Button
            variant="destructive"
            className="w-full gap-2"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4" />
            {t('settings.signOut')}
          </Button>
        </motion.div>

        {/* App info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: canAccessAdmin ? 0.75 : 0.65 }}
        >
          <Card className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-foreground">{t('settings.appInfoTitle')}</h3>
                  <button
                    type="button"
                    onClick={handleToggleUpdateChannel}
                    className={appUpdateChannel === 'testing' ? 'text-sm font-semibold text-emerald-400' : 'text-sm font-medium text-muted-foreground'}
                    aria-label="Toggle app update channel"
                    title="Tap to switch Release/Testing channel"
                  >
                    {channelReleaseLabel}
                  </button>
                </div>
                <p className="text-sm text-muted-foreground">{t('settings.appInfoDescription')}</p>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: canAccessAdmin ? 0.8 : 0.7 }}
          className="text-center text-sm text-muted-foreground"
        >
          <p>{t('settings.appInfoLine2')}</p>
        </motion.div>
      </div>
    </AppLayout>
  );
}
