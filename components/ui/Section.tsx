import React from 'react';
import { cn } from '../../lib/utils';

export type SectionVariant = 'default' | 'alternate';

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  variant?: SectionVariant;
  container?: boolean; // If true, wraps children in a container
}

export const Section = React.forwardRef<HTMLElement, SectionProps>(
  ({ className, variant = 'default', container = true, children, ...props }, ref) => {
    const bgClass =
      variant === 'alternate'
        ? 'bg-gray-50 dark:bg-gray-950/50' // Slightly distinctive from gray-900 but not pitch black
        : 'bg-white dark:bg-gray-900';

    return (
      <section
        ref={ref}
        className={cn('py-16 md:py-24', bgClass, className)}
        {...props}
      >
        {container ? (
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
            {children}
          </div>
        ) : (
          children
        )}
      </section>
    );
  }
);

Section.displayName = 'Section';
