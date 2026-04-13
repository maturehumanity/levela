import { motion } from 'framer-motion';
import { Home, BookOpen, Store, Settings, PlusCircle } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/study', icon: BookOpen, label: 'Study' },
  { path: '/contribute', icon: PlusCircle, label: 'Contribute' },
  { path: '/market', icon: Store, label: 'Market' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass safe-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          const labelKey =
            item.label === 'Home'
              ? 'common.home'
              : item.label === 'Study'
                ? 'common.study'
                : item.label === 'Contribute'
                  ? 'common.contribute'
                  : item.label === 'Market'
                    ? 'common.market'
                    : 'common.settings';

          return (
            <motion.button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`
                flex flex-col items-center gap-0.5 py-2 px-4 rounded-xl
                touch-target transition-colors duration-200
                ${isActive 
                  ? 'text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
                }
              `}
              whileTap={{ scale: 0.9 }}
            >
              <div className="relative">
                <Icon className={`w-6 h-6 ${item.path === '/contribute' ? 'w-7 h-7' : ''}`} />
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute -bottom-1 left-1/2 w-1 h-1 rounded-full bg-primary"
                    style={{ x: '-50%' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </div>
              <span className="text-[10px] font-medium">{t(labelKey)}</span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
