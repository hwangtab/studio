import React from 'react';
import BaseCard from './BaseCard';
import { Badge } from './Badge';

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
  href,
  delay = 0,
  size = 'base',
  variant = 'solid',
  badge,
  cta,
  className = '',
  children,
}: FeatureCardProps) => {
  const isLarge = size === 'lg';
  const baseVariant = variant === 'highlight' ? 'glass-highlight' : 'glass';

  return (
    <BaseCard
      href={href}
      delay={delay}
      variant={baseVariant}
      padding="default"
      className={`h-full flex flex-col ${variant === 'highlight' ? 'pt-8' : ''} ${className}`}
    >
      {variant === 'highlight' && (
        <span className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-secondary" aria-hidden />
      )}
      {badge && (
        <Badge tone="brand" size="md" className="mb-3 self-start">
          {badge}
        </Badge>
      )}
      {(Icon || title) && (
        <div className="flex items-start gap-4 mb-4 min-w-0">
          {Icon && (
            <div className="flex-shrink-0 bg-primary/10 dark:bg-primary/20 p-3 rounded-full" aria-hidden="true">
              {React.createElement(Icon, { className: "text-2xl text-primary dark:text-primary-lighter" })}
            </div>
          )}
          <h3 className={`${isLarge ? 'typo-card-title' : 'typo-card-subtitle'} min-w-0 break-words leading-snug`}>
            {title}
          </h3>
        </div>
      )}
      {description && <p className="typo-card-body flex-grow">{description}</p>}
      {children}
      {cta && <div className="mt-auto pt-4">{cta}</div>}
    </BaseCard>
  );
};

export default FeatureCard;
