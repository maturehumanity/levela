import { motion } from 'framer-motion';
import { getScoreColor, getScoreLabel } from '@/lib/constants';
import { formatScore } from '@/lib/scoring';

interface LevelaScoreProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  animate?: boolean;
}

export function LevelaScore({ score, size = 'md', showLabel = true, animate = true }: LevelaScoreProps) {
  const sizeClasses = {
    sm: 'w-16 h-16 text-lg',
    md: 'w-24 h-24 text-2xl',
    lg: 'w-32 h-32 text-4xl',
  };

  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const Component = animate ? motion.div : 'div';

  return (
    <div className="flex flex-col items-center gap-2">
      <Component
        className={`relative ${sizeClasses[size]} flex items-center justify-center`}
        initial={animate ? { scale: 0.8, opacity: 0 } : undefined}
        animate={animate ? { scale: 1, opacity: 1 } : undefined}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            strokeWidth="8"
            className="stroke-muted"
          />
          {/* Progress circle */}
          <motion.circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            className="stroke-primary"
            style={{
              strokeDasharray: circumference,
            }}
            initial={animate ? { strokeDashoffset: circumference } : { strokeDashoffset }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
          />
        </svg>
        <motion.span
          className={`font-display font-bold ${getScoreColor(score)}`}
          initial={animate ? { opacity: 0 } : undefined}
          animate={animate ? { opacity: 1 } : undefined}
          transition={{ delay: 0.5 }}
        >
          {formatScore(score)}
        </motion.span>
      </Component>
      {showLabel && (
        <motion.div
          className="text-center"
          initial={animate ? { opacity: 0, y: 10 } : undefined}
          animate={animate ? { opacity: 1, y: 0 } : undefined}
          transition={{ delay: 0.7 }}
        >
          <p className="text-sm font-medium text-foreground">Levela Score</p>
          <p className={`text-xs ${getScoreColor(score)}`}>{getScoreLabel(score)}</p>
        </motion.div>
      )}
    </div>
  );
}
