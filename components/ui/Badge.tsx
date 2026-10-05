import React from 'react';
import { cn } from '../../lib/utils';

/**
 * 배지·칩 — 상태(진행 중·마감·품절), 분류(카테고리), 짧은 라벨.
 *
 * 2026-10-04 조사: 정본이 적어 둔 `rounded-full px-2 py-0.5 typo-caption`을 쓰는 곳이
 * **0곳**이었다. 패딩 4종, 글꼴 5종, 같은 포트폴리오 카테고리 배지가 세 화면에서 세 모양.
 *
 * 규칙: `rounded-full` + 12px 600. 크기는 둘(sm `px-2 py-0.5`, md `px-2.5 py-1`), 색은 tone
 * 표에서만. 정본의 `typo-caption`(굵기 300)은 배지에 너무 가늘어 **이 컴포넌트가 정본을
 * 대신한다**(design-system.md §4 개정).
 */
export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'error' | 'info' | 'outline' | 'onImage';
export type BadgeSize = 'sm' | 'md';

const TONE: Record<BadgeTone, string> = {
  neutral: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  brand: 'bg-primary/10 text-primary-dark dark:bg-primary-lighter/10 dark:text-primary-lighter',
  success: 'bg-green-50 text-green-800 dark:bg-green-950/50 dark:text-green-300',
  warning: 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  error: 'bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-300',
  info: 'bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
  outline: 'border border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300',
  /** 히어로 사진 위. 테마와 무관하게 어두운 스크림 + 흰 글씨. */
  onImage: 'border border-white/40 bg-black/30 text-white',
};

const SIZE: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5',
  md: 'px-2.5 py-1',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: BadgeSize;
  /** 왼쪽 작은 아이콘(16px 권장). */
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const Badge = ({ tone = 'neutral', size = 'sm', icon, className, children, ...rest }: BadgeProps) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 whitespace-nowrap rounded-full text-xs font-semibold leading-tight',
      TONE[tone],
      SIZE[size],
      className,
    )}
    {...rest}
  >
    {icon}
    {children}
  </span>
);
