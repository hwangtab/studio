import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '../../lib/utils';
import GradientOrb, { type OrbColor } from './GradientOrb';

interface HeroOrb {
  color: OrbColor;
  size: number;
  top?: string; left?: string; right?: string; bottom?: string;
  opacity?: number;
}

interface HeroProps {
  variant: 'darkCinematic' | 'lightEditorial';
  eyebrow?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  image?: { src: string; alt: string; width: number; height: number };
  orbs?: HeroOrb[];
  className?: string;
}

const Hero: React.FC<HeroProps> = ({
  variant,
  eyebrow, title, lead,
  primaryCta, secondaryCta, image, orbs,
  className,
}) => {
  const isDark = variant === 'darkCinematic';

  return (
    <section
      className={cn(
        'relative overflow-hidden',
        isDark ? 'bg-canvas-deep text-on-dark' : 'bg-canvas text-ink',
        'py-20 md:py-28 lg:py-32',
        className
      )}
    >
      {orbs?.map((o, i) => (
        <GradientOrb key={`${o.color}-${i}`} color={o.color} size={o.size} opacity={o.opacity ?? (isDark ? 0.55 : 0.4)}
          style={{ top: o.top, left: o.left, right: o.right, bottom: o.bottom }} />
      ))}
      <div className="relative z-10 mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-12 grid gap-10 lg:gap-16 lg:grid-cols-12 items-center">
        <div className={cn('lg:col-span-7', !image && 'lg:col-span-12 max-w-3xl mx-auto text-center')}>
          {eyebrow && (
            <p className={cn('text-caption-upper uppercase mb-4', isDark ? 'text-on-dark-soft' : 'text-ink-muted-60')}>
              {eyebrow}
            </p>
          )}
          <h1 className={cn(
            'font-display font-light text-display-mega',
            isDark ? 'text-on-dark' : 'text-ink'
          )}>
            {title}
          </h1>
          {lead && (
            <p className={cn('mt-6 text-lead', isDark ? 'text-on-dark-soft' : 'text-ink-muted-80')}>
              {lead}
            </p>
          )}
          {(primaryCta || secondaryCta) && (
            <div className="mt-8 flex flex-wrap gap-3">
              {primaryCta && (
                <Link
                  href={primaryCta.href}
                  prefetch={false}
                  className={cn(
                    'inline-flex items-center justify-center font-medium rounded-pill transition-all h-14 px-7 text-[17px] active:scale-[0.97] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                    isDark
                      ? 'bg-white text-ink hover:bg-on-dark-soft focus-visible:ring-white/70 focus-visible:ring-offset-canvas-deep'
                      : 'bg-ink text-white hover:bg-canvas-deep focus-visible:ring-ink/40 focus-visible:ring-offset-canvas'
                  )}
                >
                  {primaryCta.label}
                </Link>
              )}
              {secondaryCta && (
                <Link
                  href={secondaryCta.href}
                  prefetch={false}
                  className={cn(
                    'inline-flex items-center justify-center font-medium rounded-pill transition-all h-14 px-7 text-[17px] border touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                    isDark
                      ? 'border-white/20 text-on-dark hover:bg-white/[0.06] focus-visible:ring-white/50 focus-visible:ring-offset-canvas-deep'
                      : 'border-hairline-strong text-ink hover:bg-ink/[0.04] focus-visible:ring-ink/30 focus-visible:ring-offset-canvas'
                  )}
                >
                  {secondaryCta.label}
                </Link>
              )}
            </div>
          )}
        </div>
        {image && (
          <div className="lg:col-span-5">
            <div className={cn('overflow-hidden rounded-hero border', isDark ? 'border-white/10' : 'border-hairline')}>
              <Image src={image.src} alt={image.alt} width={image.width} height={image.height} className="w-full h-auto" priority />
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default Hero;
