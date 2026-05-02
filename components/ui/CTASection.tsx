import React from 'react';
import Link from 'next/link';
import { cn } from '../../lib/utils';
import Section from './Section';
import SectionHeading from './SectionHeading';
import { type OrbColor } from './GradientOrb';

interface CTAOrb {
  color: OrbColor;
  size: number;
  top?: string; left?: string; right?: string; bottom?: string;
  opacity?: number;
}

interface CTASectionProps {
  title: React.ReactNode;
  lead?: React.ReactNode;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
  /** 배경 분위기 orb (최대 2~3개 권장). */
  orbs?: CTAOrb[];
  /**
   * CTA 톤 — 'deep'은 다크 시네마틱 배경, 'canvas'는 라이트 ink 배경.
   * 기본값 'deep'으로 페이지 하단 강조 CTA 패턴에 최적화.
   */
  tone?: 'deep' | 'canvas';
  className?: string;
}

/**
 * 페이지 하단 conversion CTA 섹션 단일 primitive.
 * - tone='deep': 다크 시네마틱 + 흰 pill primary, 흰 outline secondary
 * - tone='canvas': 라이트 + 검은 pill primary, 어두운 outline secondary
 *
 * 인라인 Section + SectionHeading + Link 조합으로 같은 패턴을 반복하지 말 것.
 */
const CTASection: React.FC<CTASectionProps> = ({
  title,
  lead,
  primary,
  secondary,
  orbs,
  tone = 'deep',
  className,
}) => {
  const isDark = tone === 'deep';
  return (
    <Section
      tone={tone}
      paddingY="lg"
      containerSize="narrow"
      orbs={orbs}
      className={className}
    >
      <div className="text-center">
        <SectionHeading
          title={title}
          lead={lead}
          align="center"
          marginBottom="default"
          as="h2"
        />
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            href={primary.href}
            prefetch={false}
            className={cn(
              'inline-flex items-center justify-center font-medium rounded-pill transition-all h-14 px-7 text-[17px] active:scale-[0.97] touch-manipulation',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              isDark
                ? 'bg-white text-ink hover:bg-on-dark-soft focus-visible:ring-white/70 focus-visible:ring-offset-canvas-deep'
                : 'bg-ink text-white hover:bg-canvas-deep focus-visible:ring-ink/40 focus-visible:ring-offset-canvas'
            )}
          >
            {primary.label}
          </Link>
          {secondary && (
            <Link
              href={secondary.href}
              prefetch={false}
              className={cn(
                'inline-flex items-center justify-center font-medium rounded-pill transition-all h-14 px-7 text-[17px] border touch-manipulation',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                isDark
                  ? 'border-white/20 text-on-dark hover:bg-white/[0.06] focus-visible:ring-white/50 focus-visible:ring-offset-canvas-deep'
                  : 'border-hairline-strong text-ink hover:bg-ink/[0.04] focus-visible:ring-ink/30 focus-visible:ring-offset-canvas'
              )}
            >
              {secondary.label}
            </Link>
          )}
        </div>
      </div>
    </Section>
  );
};

export default CTASection;
