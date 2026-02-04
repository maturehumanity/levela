import { motion } from 'framer-motion';
import { GraduationCap, Heart, Shield, Users, TrendingUp, LucideIcon } from 'lucide-react';
import { PILLARS, type PillarId, getPillarShortName } from '@/lib/constants';

const iconMap: Record<string, LucideIcon> = {
  GraduationCap,
  Heart,
  Shield,
  Users,
  TrendingUp,
};

interface PillarBadgeProps {
  pillarId: PillarId;
  score?: number;
  endorsementCount?: number;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  onClick?: () => void;
}

export function PillarBadge({
  pillarId,
  score,
  endorsementCount,
  size = 'md',
  showDetails = true,
  onClick,
}: PillarBadgeProps) {
  const pillar = PILLARS.find(p => p.id === pillarId);
  if (!pillar) return null;

  const Icon = iconMap[pillar.icon];

  const sizeClasses = {
    sm: {
      container: 'p-2',
      icon: 'w-4 h-4',
      text: 'text-xs',
    },
    md: {
      container: 'p-3',
      icon: 'w-5 h-5',
      text: 'text-sm',
    },
    lg: {
      container: 'p-4',
      icon: 'w-6 h-6',
      text: 'text-base',
    },
  };

  const classes = sizeClasses[size];

  return (
    <motion.button
      onClick={onClick}
      className={`
        flex flex-col items-center gap-1.5 rounded-xl
        ${classes.container}
        bg-card shadow-soft border border-border/50
        transition-all duration-200
        ${onClick ? 'hover:shadow-elevated hover:scale-105 cursor-pointer touch-target' : ''}
      `}
      whileTap={onClick ? { scale: 0.95 } : undefined}
      disabled={!onClick}
    >
      <div className={`${pillar.bgColorClass} text-white rounded-lg p-2`}>
        <Icon className={classes.icon} />
      </div>
      
      {showDetails && (
        <div className="text-center">
          <p className={`font-medium ${classes.text} text-foreground`}>
            {getPillarShortName(pillarId)}
          </p>
          {score !== undefined && (
            <p className={`font-display font-bold ${classes.text} ${pillar.colorClass}`}>
              {score.toFixed(1)}
            </p>
          )}
          {endorsementCount !== undefined && endorsementCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {endorsementCount} {endorsementCount === 1 ? 'endorsement' : 'endorsements'}
            </p>
          )}
        </div>
      )}
    </motion.button>
  );
}
