import React from 'react';
import { cn } from '../../lib/utils';
import GradientOrb, { type OrbColor } from './GradientOrb';

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  tone?: 'canvas' | 'warm' | 'deep';
  orbs?: Array<{ color: OrbColor; size: number; top?: string; left?: string; right?: string; bottom?: string; opacity?: number }>;
  containerSize?: 'default' | 'wide' | 'narrow';
}

const TONE_BG = {
  canvas: 'bg-canvas text-ink dark:bg-canvas-deep dark:text-on-dark',
  warm: 'bg-canvas-warm text-ink dark:bg-surface-dark-elevated dark:text-on-dark',
  deep: 'bg-canvas-deep text-on-dark', // 다크 시네마틱 — 라이트모드에서도 다크 유지
};

const CONTAINER = {
  default: 'max-w-[1200px]',
  wide: 'max-w-[1400px]',
  narrow: 'max-w-[820px]',
};

// DESIGN.md §5 Layout: 96~120px vertical rhythm, alternation, atmospheric orb
const Section = React.forwardRef<HTMLElement, SectionProps>(
  ({ className, tone = 'canvas', orbs, containerSize = 'default', children, ...props }, ref) => (
    <section
      ref={ref}
      className={cn('relative overflow-hidden py-14 md:py-20 lg:py-24', TONE_BG[tone], className)}
      {...props}
    >
      {orbs?.map((o, i) => (
        <GradientOrb
          key={i}
          color={o.color}
          size={o.size}
          opacity={o.opacity ?? 0.4}
          style={{ top: o.top, left: o.left, right: o.right, bottom: o.bottom }}
        />
      ))}
      <div className={cn('relative z-10 mx-auto px-4 sm:px-6 lg:px-12', CONTAINER[containerSize])}>
        {children}
      </div>
    </section>
  )
);
Section.displayName = 'Section';

export default Section;
