import React from 'react';
import { cn } from '../../lib/utils';

type SectionHeadingMarginBottom = 'none' | 'tight' | 'default' | 'loose';

interface SectionHeadingProps {
  eyebrow?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  align?: 'left' | 'center';
  className?: string;
  as?: 'h1' | 'h2' | 'h3';
  /**
   * SectionHeading과 다음 컨텐츠 사이의 간격 (DESIGN.md §5 vertical rhythm).
   * className으로 mb-X를 직접 지정하지 말고 이 prop을 사용할 것.
   * - none:    제목만 단독으로 쓸 때
   * - tight:   카드 그리드 등 밀도 높은 컨텐츠 위
   * - default: 일반 컨텐츠 (대부분의 케이스, 권장)
   * - loose:   히어로 직후 강조 섹션
   */
  marginBottom?: SectionHeadingMarginBottom;
}

const MARGIN_BOTTOM: Record<SectionHeadingMarginBottom, string> = {
  none: '',
  tight: 'mb-6 md:mb-8',
  default: 'mb-10 md:mb-14',
  loose: 'mb-14 md:mb-20',
};

// DESIGN.md §3 Display weight 300, eyebrow는 caption-upper (영문 권장)
const SectionHeading: React.FC<SectionHeadingProps> = ({
  eyebrow,
  title,
  lead,
  align = 'left',
  className,
  as: Tag = 'h2',
  marginBottom = 'default',
}) => (
  <header
    className={cn(
      align === 'center' ? 'text-center mx-auto max-w-3xl' : 'max-w-3xl',
      MARGIN_BOTTOM[marginBottom],
      className
    )}
  >
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
