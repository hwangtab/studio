import React from 'react';
import { cn } from '../../lib/utils';

interface BaseCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'featured' | 'orb';
  hover?: boolean;
  as?: 'div' | 'article' | 'section';
}

// DESIGN.md §4 Cards: whisper border + shadow-card + 12/16/24 radius
const BaseCard = React.forwardRef<HTMLDivElement, BaseCardProps>(
  ({ className, variant = 'default', hover = false, as: Tag = 'div', ...props }, ref) => {
    const radius = variant === 'orb' ? 'rounded-orb' : variant === 'featured' ? 'rounded-hero' : 'rounded-card';
    const padding = variant === 'orb' ? 'p-8' : variant === 'featured' ? 'p-8' : 'p-6';
    return (
      <Tag
        ref={ref as React.Ref<HTMLDivElement>}
        className={cn(
          'bg-canvas-soft border border-hairline shadow-card',
          radius,
          padding,
          'dark:bg-surface-dark-elevated dark:border-white/10',
          hover && 'transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5',
          className
        )}
        {...props}
      />
    );
  }
);
BaseCard.displayName = 'BaseCard';

export default BaseCard;
