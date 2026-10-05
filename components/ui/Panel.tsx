import React from 'react';
import { cn } from '../../lib/utils';

/**
 * 중립 패널 — 금액 요약·규정 안내·"선택" 구획처럼 본문 안에서 한 덩어리로 묶는 회색 박스.
 * 상태(오류·성공·주의)를 말하는 박스는 `Notice`, 클릭 가능한 카드는 `BaseCard`.
 *
 * 2026-10-04 조사: 같은 회색 박스가 `rounded-md`(예약)·`lg`(개설자)·`xl`(펀딩)·`2xl`(마케팅)
 * 네 반경, 다크 배경 다섯 값(`gray-800/50`·`800/40`·`900/50`·`900/40`·`900`)이었다.
 *
 * 규칙: `rounded-xl`, 테두리 gray-200/700, 배경 gray-50 / gray-800/50. 패딩은 세 단만.
 */
export type PanelVariant = 'filled' | 'outline' | 'inset';
export type PanelPadding = 'compact' | 'default' | 'roomy';

const VARIANT: Record<PanelVariant, string> = {
  filled: 'border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50',
  outline: 'border border-gray-200 dark:border-gray-700',
  /** 카드 **안**에 놓는 한 단계 낮은 면 — 테두리 없이 틴트만. */
  inset: 'bg-gray-50/70 dark:bg-gray-800/40',
};

export const PANEL_PADDING: Record<PanelPadding, string> = {
  compact: 'p-4',
  default: 'p-6',
  roomy: 'p-6 sm:p-8',
};

export interface PanelProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  as?: 'div' | 'section' | 'aside';
  variant?: PanelVariant;
  padding?: PanelPadding;
  /** 패널 첫 줄 작은 제목. */
  title?: React.ReactNode;
  children: React.ReactNode;
}

export const Panel = ({ as: Tag = 'div', variant = 'filled', padding = 'compact', title, className, children, ...rest }: PanelProps) => (
  <Tag className={cn('rounded-xl text-gray-700 dark:text-gray-300', VARIANT[variant], PANEL_PADDING[padding], className)} {...rest}>
    {title && <p className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</p>}
    {children}
  </Tag>
);
