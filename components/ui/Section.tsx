import React from 'react';
import { cn } from '../../lib/utils';
import GradientOrb, { type OrbColor } from './GradientOrb';

type SectionTone = 'canvas' | 'warm' | 'deep';
type SectionContainer = 'default' | 'wide' | 'narrow';
type SectionPaddingY = 'sm' | 'default' | 'lg' | 'hero' | 'none';

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  tone?: SectionTone;
  orbs?: Array<{ color: OrbColor; size: number; top?: string; left?: string; right?: string; bottom?: string; opacity?: number }>;
  containerSize?: SectionContainer;
  /**
   * 수직 패딩 토큰 (DESIGN.md §5 vertical rhythm).
   * - sm:      간이 섹션 (서비스 바로가기 등 보조 영역)
   * - default: 일반 컨텐츠 섹션 (대부분의 케이스)
   * - lg:      hero 직후 강조 섹션 / CTA 섹션
   * - hero:    Hero 컴포넌트 내부 사용 (외부 호출 금지)
   * - none:    패딩 없음 (래퍼로만 사용)
   */
  paddingY?: SectionPaddingY;
}

const TONE_BG: Record<SectionTone, string> = {
  canvas: 'bg-canvas text-ink dark:bg-canvas-deep dark:text-on-dark',
  warm: 'bg-canvas-warm text-ink dark:bg-surface-dark-elevated dark:text-on-dark',
  deep: 'bg-canvas-deep text-on-dark', // 다크 시네마틱 — 라이트모드에서도 다크 유지
};

const CONTAINER: Record<SectionContainer, string> = {
  default: 'max-w-[1200px]',
  wide: 'max-w-[1400px]',
  narrow: 'max-w-[820px]',
};

// 단일 vertical rhythm 시스템 — 이 토큰 외 임의의 py-X override 금지.
const PADDING_Y: Record<SectionPaddingY, string> = {
  sm: 'py-10 md:py-12 lg:py-14',
  default: 'py-14 md:py-20 lg:py-24',
  lg: 'py-20 md:py-28 lg:py-32',
  hero: 'py-20 md:py-28 lg:py-32',
  none: '',
};

// DESIGN.md §5 Layout: 96~120px vertical rhythm, alternation, atmospheric orb
const Section = React.forwardRef<HTMLElement, SectionProps>(
  ({ className, tone = 'canvas', orbs, containerSize = 'default', paddingY = 'default', children, ...props }, ref) => (
    <section
      ref={ref}
      className={cn('relative overflow-hidden', PADDING_Y[paddingY], TONE_BG[tone], className)}
      {...props}
    >
      {orbs?.map((o, i) => (
        <GradientOrb
          key={`${o.color}-${i}`}
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
