import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { PAGE_TITLE_ANIMATION } from '../../utils/animationUtils';

interface SectionHeadingProps {
  icon?: React.ElementType<{ className?: string }>;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  align?: 'center' | 'left';
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4';
  titleClassName?: string;
}

const SectionHeading = ({
  icon: Icon,
  title,
  subtitle,
  align = 'center',
  className,
  as: Component = 'h2',
  titleClassName
}: SectionHeadingProps) => {
  const alignmentClasses = {
    center: 'text-center',
    left: 'text-left',
  };

  return (
    <motion.div
      className={cn(
        alignmentClasses[align] ?? alignmentClasses.center,
        "mb-12",
        className
      )}
      initial="initial"
      whileInView="animate"
      viewport={{ once: true }}
      variants={PAGE_TITLE_ANIMATION}
    >
      {Icon && (
        <div className={cn(
          "inline-flex items-center justify-center p-3 bg-primary/10 dark:bg-primary/20 rounded-full mb-4",
          align === 'center' ? "mx-auto" : "" // Only center if alignment is center
        )} aria-hidden="true">
          {React.createElement(Icon, { className: "text-2xl text-primary dark:text-primary-light" })}
        </div>
      )}

      <Component
        className={cn(
          "typo-section-title text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent mb-3 break-words [overflow-wrap:anywhere]",
          titleClassName
        )}
      >
        {title}
      </Component>

      {subtitle && (
        <p className={cn("typo-section-lead max-w-2xl break-words [overflow-wrap:anywhere]", align === 'center' ? "mx-auto" : "")}>
          {subtitle}
        </p>
      )}
    </motion.div>
  );
};

export default SectionHeading;
