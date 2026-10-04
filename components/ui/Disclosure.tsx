import React from 'react';
import { cn } from '../../lib/utils';
import { ChevronDown } from '@/lib/lucide-icons';
import { FOCUS_RING } from './focusRing';

/**
 * 접기·펼치기 한 줄 — "먼저 믹싱 전·후 들어 보기", 목차, 관련 안내.
 *
 * 2026-10-04 조사: `<details>` 세 벌(마커 보임 `rounded-md` / 채운 `rounded-lg` / 마커 숨김
 * + 포커스 링 없음)과 버튼 아코디언 한 벌. 네이티브 `<details>`를 그대로 쓴다 — JS 없이
 * 열리고 닫히며 SSR HTML에 상태가 남는다. FAQ처럼 한 번에 하나만 열리는 목록은 범위 밖.
 *
 * 마커는 숨기고 오른쪽 chevron이 돈다. summary에 `focus-visible` 링과 44px 높이.
 */
export interface DisclosureProps extends Omit<React.DetailsHTMLAttributes<HTMLDetailsElement>, 'title'> {
  summary: React.ReactNode;
  /** `card`는 테두리 박스, `plain`은 선 없이 글만. */
  variant?: 'card' | 'plain';
  children: React.ReactNode;
  summaryClassName?: string;
  bodyClassName?: string;
}

export const Disclosure = ({ summary, variant = 'card', className, summaryClassName, bodyClassName, children, ...rest }: DisclosureProps) => (
  <details
    className={cn('group', variant === 'card' && 'rounded-xl border border-gray-200 dark:border-gray-700', className)}
    {...rest}
  >
    <summary
      className={cn(
        'flex min-h-[44px] cursor-pointer select-none list-none items-center justify-between gap-3 text-sm font-semibold text-gray-900 dark:text-white [&::-webkit-details-marker]:hidden',
        variant === 'card' ? 'rounded-xl px-4 py-3' : 'rounded-md py-2',
        FOCUS_RING,
        summaryClassName,
      )}
    >
      <span className="min-w-0">{summary}</span>
      <ChevronDown size={16} aria-hidden="true" className="shrink-0 text-gray-500 transition-transform duration-base group-open:rotate-180 dark:text-gray-400" />
    </summary>
    <div className={cn('text-sm text-gray-700 dark:text-gray-300', variant === 'card' ? 'px-4 pb-4' : 'pb-2', bodyClassName)}>{children}</div>
  </details>
);
