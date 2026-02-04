import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { 
  User, 
  Shield, 
  Bell, 
  HelpCircle, 
  LogOut, 
  ChevronRight,
  FileText,
  Lock,
  Settings as SettingsIcon
} from 'lucide-react';

const settingsItems = [
  {
    icon: User,
    label: 'Edit Profile',
    description: 'Update your name, bio, and avatar',
    path: '/settings/profile',
  },
  {
    icon: Bell,
    label: 'Notifications',
    description: 'Manage notification preferences',
    path: '/settings/notifications',
  },
  {
    icon: Lock,
    label: 'Privacy',
    description: 'Control who can see your profile',
    path: '/settings/privacy',
  },
  {
    icon: Shield,
    label: 'Safety',
    description: 'View your reports and blocked users',
    path: '/settings/safety',
  },
  {
    icon: FileText,
    label: 'Terms & Privacy',
    description: 'Review our policies',
    path: '/settings/legal',
  },
  {
    icon: HelpCircle,
    label: 'Help & Support',
    description: 'Get help with Levela',
    path: '/settings/help',
  },
  {
    icon: SettingsIcon,
    label: 'Pillars',
    description: 'Manage growth pillars and their names',
    path: '/settings/pillars',
  },
];

export default function Settings() {
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/onboarding');
  };

  return (
    <AppLayout>
      <div className="px-4 py-6 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-display font-bold text-foreground">
            Settings
          </h1>
        </motion.div>

        {/* Settings items */}
        <div className="space-y-3">
          {settingsItems.map((item, index) => (
            <motion.div
              key={item.path}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
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
                    <h3 className="font-semibold text-foreground">{item.label}</h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Sign out */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Button
            variant="destructive"
            className="w-full gap-2"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </motion.div>

        {/* App info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-sm text-muted-foreground"
        >
          <p>Levela v1.0.0</p>
          <p>Build your trust profile</p>
        </motion.div>
      </div>
    </AppLayout>
  );
}
