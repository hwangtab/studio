import React from 'react';
import BaseCard from './BaseCard';

interface FeatureCardProps {
  icon?: React.ElementType<{ className?: string }>;
  title?: string;
  description?: string;
  href?: string;
  delay?: number;
  size?: 'base' | 'lg';
  variant?: 'solid' | 'highlight';
  badge?: string;
  cta?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

const FeatureCard = ({
  icon: Icon,
  title,
  description,
  delay: _delay,
  size = 'base',
  variant = 'solid',
  badge,
  cta,
  className = '',
  children,
}: FeatureCardProps) => {
  const isLarge = size === 'lg';
  const baseVariant = variant === 'highlight' ? 'featured' : 'default';

  return (
    <BaseCard
      variant={baseVariant}
      hover
      className={`p-6 h-full flex flex-col ${variant === 'highlight' ? 'pt-8' : ''} ${className}`}
    >
      {variant === 'highlight' && (
        <span className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-secondary" aria-hidden />
      )}
      {badge && (
        <span className="inline-block text-xs font-semibold text-ink bg-canvas-warm px-3 py-1 rounded-pill mb-3">
          {badge}
        </span>
      )}
      {(Icon || title) && (
        <div className="flex items-start gap-4 mb-4 min-w-0">
          {Icon && (
            <div className="flex-shrink-0 bg-canvas-warm rounded-pill p-3 inline-flex" aria-hidden="true">
              {React.createElement(Icon, { className: 'text-ink' })}
            </div>
          )}
          <h3 className={`${isLarge ? 'text-title-md text-ink dark:text-on-dark' : 'text-title-sm text-ink dark:text-on-dark'} min-w-0 break-words leading-snug mb-2`}>
            {title}
          </h3>
        </div>
      )}
      {description && (
        <p className="text-[15px] text-ink-muted-60 dark:text-on-dark-soft leading-[1.6] flex-grow">
          {description}
        </p>
      )}
      {children}
      {cta && <div className="mt-auto pt-4">{cta}</div>}
    </BaseCard>
  );
};

export default FeatureCard;
