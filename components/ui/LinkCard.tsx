import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { m } from 'framer-motion';
import { cn } from '../../lib/utils';

interface LinkCardProps {
  href: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** 좌상단 카테고리/타입 배지 (예: "Portfolio", "Story"). */
  badge?: string;
  prefetch?: boolean;
  /**
   * In-view 등장 애니메이션 적용 여부 + delay (초). 미지정 시 애니메이션 없음.
   * useMemo/모듈 상수로 처리하지 않고 매 렌더 새 객체가 되도록 두는 이유:
   * 호출처가 .map() 안에서 동적으로 delay를 계산해야 하기 때문.
   */
  animateInView?: { delay?: number };
  className?: string;
}

/**
 * featured/discover 류의 클릭 가능한 카드 단일 primitive.
 * - bg-canvas + hairline border + shadow-card (DESIGN.md §4 Card)
 * - hover 시 lift (translate-y -0.5) + shadow-card-hover
 * - 우상단 화살표가 hover에 슬라이드 인
 *
 * 디자인 시스템 일관성을 위해 인라인으로 같은 카드 마크업을 다시 작성하지 말 것.
 */
const LinkCard: React.FC<LinkCardProps> = ({
  href,
  title,
  description,
  badge,
  prefetch = false,
  animateInView,
  className,
}) => {
  const card = (
    <Link href={href} prefetch={prefetch} className="group block focus-visible:outline-none">
      <div
        className={cn(
          'bg-canvas border border-hairline rounded-card p-6 shadow-card transition-all duration-200',
          'hover:shadow-card-hover hover:-translate-y-0.5',
          'dark:bg-surface-dark-elevated dark:border-white/10',
          'group-focus-visible:ring-2 group-focus-visible:ring-link-focus group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-canvas dark:group-focus-visible:ring-offset-canvas-deep',
          className
        )}
      >
        {(badge || true) && (
          <div className="flex items-center justify-between mb-2 min-h-[24px]">
            {badge && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-pill text-xs font-medium bg-ink/[0.07] text-ink-muted-60 dark:bg-white/[0.07] dark:text-on-dark-soft">
                {badge}
              </span>
            )}
            <ArrowRight
              size={16}
              className="text-ink-muted-40 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 ml-auto"
              aria-hidden="true"
            />
          </div>
        )}
        <h3 className="font-display font-light text-title-md mb-2 text-ink dark:text-on-dark group-hover:text-ink-muted-80 dark:group-hover:text-on-dark-soft transition-colors duration-300">
          {title}
        </h3>
        {description && (
          <p className="text-[15px] leading-[1.6] text-ink-muted-60 dark:text-on-dark-soft">{description}</p>
        )}
      </div>
    </Link>
  );

  if (!animateInView) return card;

  return (
    <m.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.4, delay: animateInView.delay ?? 0 }}
    >
      {card}
    </m.div>
  );
};

export default LinkCard;
