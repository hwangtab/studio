import BaseCard from './BaseCard';

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
}) => {
  const isLarge = size === 'lg';
  const baseVariant = variant === 'highlight' ? 'highlight' : 'default';

  return (
    <BaseCard
      href={href}
      delay={delay}
      variant={baseVariant}
      className={`p-6 h-full flex flex-col ${variant === 'highlight' ? 'pt-8' : ''} ${className}`}
    >
      {variant === 'highlight' && (
        <span className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-secondary" aria-hidden />
      )}
      {badge && (
        <span className="inline-block text-xs font-semibold text-primary dark:text-primary-light bg-primary/10 dark:bg-primary/20 px-3 py-1 rounded-full mb-3">
          {badge}
        </span>
      )}
      {(Icon || title) && (
        <div className="flex items-center mb-4">
          {Icon && (
            <div className="flex-shrink-0 bg-primary/10 dark:bg-primary/20 p-3 rounded-full mr-4">
              <Icon className="text-2xl text-primary dark:text-primary-light" />
            </div>
          )}
          <h3 className={`${isLarge ? 'typo-card-title' : 'typo-card-subtitle'} text-gray-600 dark:text-gray-200`}>
            {title}
          </h3>
        </div>
      )}
      {description && <p className="typo-card-body flex-grow text-gray-600 dark:text-gray-300">{description}</p>}
      {children}
      {cta && <div className="mt-auto pt-4">{cta}</div>}
    </BaseCard>
  );
};

export default FeatureCard;
