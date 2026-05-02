import React from 'react';
import { cn } from '../../lib/utils';

interface SectionHeadingProps {
  eyebrow?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  align?: 'left' | 'center';
  className?: string;
  as?: 'h1' | 'h2' | 'h3';
}

// DESIGN.md §3 Display weight 300, eyebrow는 caption-upper (영문 권장)
const SectionHeading: React.FC<SectionHeadingProps> = ({
  eyebrow,
  title,
  lead,
  align = 'left',
  className,
  as: Tag = 'h2',
}) => (
  <header className={cn(align === 'center' ? 'text-center mx-auto max-w-3xl' : 'max-w-3xl', 'mb-10 md:mb-14', className)}>
    {eyebrow && (
      <p className="text-caption-upper uppercase text-ink-muted-60 dark:text-on-dark-soft mb-3">{eyebrow}</p>
    )}
    <Tag className="font-display font-light text-display-xl text-ink dark:text-on-dark">
      {title}
    </Tag>
    {lead && <div className="mt-5 text-lead text-ink-muted-80 dark:text-on-dark-soft">{lead}</div>}
  </header>
);

export default SectionHeading;
