import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { useState } from 'react';

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
}

export function StarRating({
  value,
  onChange,
  readonly = false,
  size = 'md',
  showValue = false,
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const displayValue = hoverValue ?? value;

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <motion.button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && setHoverValue(star)}
          onMouseLeave={() => !readonly && setHoverValue(null)}
          className={`
            ${readonly ? 'cursor-default' : 'cursor-pointer touch-target'}
            transition-colors duration-150
          `}
          whileTap={!readonly ? { scale: 0.85 } : undefined}
          animate={!readonly && star <= displayValue ? { scale: [1, 1.2, 1] } : undefined}
          transition={{ duration: 0.2 }}
        >
          <Star
            className={`
              ${sizeClasses[size]}
              transition-colors duration-150
              ${star <= displayValue
                ? 'fill-accent text-accent'
                : 'fill-transparent text-muted-foreground/30'
              }
            `}
          />
        </motion.button>
      ))}
      {showValue && (
        <span className="ml-2 font-display font-bold text-accent">
          {value}/5
        </span>
      )}
    </div>
  );
}
