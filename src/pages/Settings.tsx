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
import { loadLanguageOptions, type LanguageCode, type LanguageOption } from '@/lib/i18n.runtime';
import { permissionListHasAny, type AppPermission } from '@/lib/access-control';
import { APP_VERSION_TAG, ANDROID_VERSION_CODE } from '@/lib/app-release';
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
  Award,
  Coins,
  Wallet,
  MessageCircle,
  Vote,
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
    icon: Wallet,
    labelKey: 'settings.lumaWallet',
    descriptionKey: 'settings.lumaWalletDescription',
    path: '/settings/luma-wallet',
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
    icon: MessageCircle,
    labelKey: 'settings.messaging',
    descriptionKey: 'settings.messagingDescription',
    path: '/settings/messaging',
    requiredPermissions: ['message.create'] as AppPermission[],
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
    icon: Award,
    labelKey: 'settings.professions',
    descriptionKey: 'settings.professionsDescription',
    path: '/settings/professions',
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
  const { language, setLanguage, t } = useLanguage();
  const [languageOptions, setLanguageOptions] = useState<readonly LanguageOption[]>([]);
  const installedReleaseLabel = `${APP_VERSION_TAG} (${ANDROID_VERSION_CODE})`;
  const canAccessAdmin = profile
    ? permissionListHasAny(profile.effective_permissions || [], ['role.assign', 'settings.manage'])
    : false;

  const canManageMarket = Boolean(
    profile && permissionListHasAny(profile.effective_permissions || [], ['market.manage']),
  );

  const showCivicGovernanceHub = Boolean(profile && profile.role !== 'guest');

  const civicGovernanceItems = showCivicGovernanceHub
    ? [
        {
          icon: Vote,
          labelKey: 'settings.governanceHub',
          descriptionKey: 'settings.governanceHubDescription',
          path: '/governance',
        },
      ]
    : [];

  const marketOpsItems = canManageMarket
    ? [
        {
          icon: Coins,
          labelKey: 'settings.lumaCreditsCardTitle',
          descriptionKey: 'settings.lumaCreditsCardDescription',
          path: '/settings/market/luma-credits',
        },
      ]
    : [];

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

  useEffect(() => {
    let active = true;

    const loadOptions = async () => {
      const options = await loadLanguageOptions();
      if (active) setLanguageOptions(options);
    };

    void loadOptions();

    return () => {
      active = false;
    };
  }, []);

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

        {civicGovernanceItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38 }}
            className="flex flex-col gap-3"
          >
            <div className="space-y-1">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {t('settings.civicGovernanceTitle')}
              </h2>
              <p className="text-sm text-muted-foreground">{t('settings.civicGovernanceDescription')}</p>
            </div>
            <div className="flex flex-col gap-4">
              {civicGovernanceItems.map((item, index) => (
                <motion.div
                  key={item.path}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + index * 0.05 }}
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

        {marketOpsItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42 }}
            className="flex flex-col gap-3"
          >
            <div className="space-y-1">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {t('settings.marketToolsTitle')}
              </h2>
              <p className="text-sm text-muted-foreground">{t('settings.marketToolsDescription')}</p>
            </div>
            <div className="flex flex-col gap-4">
              {marketOpsItems.map((item, index) => (
                <motion.div
                  key={item.path}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.44 + index * 0.05 }}
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
          transition={{
            delay:
              canAccessAdmin || marketOpsItems.length > 0 || civicGovernanceItems.length > 0 ? 0.65 : 0.55,
          }}
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
          transition={{ delay: canAccessAdmin || marketOpsItems.length > 0 ? 0.75 : 0.65 }}
        >
          <Card className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <h3 className="font-semibold text-foreground">{t('settings.appInfoTitle')}</h3>
                <p className="text-sm font-medium text-foreground">{installedReleaseLabel}</p>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: canAccessAdmin || marketOpsItems.length > 0 ? 0.8 : 0.7 }}
          className="text-center text-sm text-muted-foreground"
        >
          <p>{t('settings.appInfoLine2')}</p>
        </motion.div>
      </div>
    </AppLayout>
  );
}
