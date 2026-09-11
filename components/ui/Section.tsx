import React from 'react';
import { cn } from '../../lib/utils';

export type SectionVariant = 'default' | 'alternate';
export type SectionSpacing = 'default' | 'tight' | 'loose';

const SPACING: Record<SectionSpacing, string> = {
  default: 'py-16 md:py-24',
  tight: 'py-10 md:py-12',
  loose: 'py-20 md:py-32',
};

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  variant?: SectionVariant;
  /** 세로 간격 variant. 기본은 `default`(py-16 md:py-24) —
   *  값은 docs/design-system.md §3 참고. */
  spacing?: SectionSpacing;
  container?: boolean; // If true, wraps children in a container
  /** true면 content-visibility: auto를 적용 — 스크롤로 뷰포트에 들어오기 전까지
   *  layout/paint 작업을 연기한다. 긴 페이지의 below-fold 섹션에 쓰면 초기
   *  Style & Layout 시간을 크게 줄일 수 있다 (practice-room 등). */
  defer?: boolean;
}

export const Section = React.forwardRef<HTMLElement, SectionProps>(
  ({ className, variant = 'default', spacing = 'default', container = true, defer = false, style, children, ...props }, ref) => {
    const bgClass =
      variant === 'alternate'
        ? 'bg-gray-50 dark:bg-gray-950/50' // Slightly distinctive from gray-900 but not pitch black
        : 'bg-white dark:bg-gray-900';

    // content-visibility: auto + contain-intrinsic-size로 뷰포트 밖 섹션의 render 생략.
    // 500px는 대략적 placeholder 높이(스크롤바 안정화용), 스크롤 도달 시 실제 크기로 교체.
    const deferStyle: React.CSSProperties | undefined = defer
      ? { contentVisibility: 'auto', containIntrinsicSize: 'auto 500px' }
      : undefined;

    return (
      <section
        ref={ref}
        className={cn(SPACING[spacing], bgClass, className)}
        style={deferStyle ? { ...deferStyle, ...style } : style}
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
