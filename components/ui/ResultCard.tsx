import React from 'react';
import { cn } from '../../lib/utils';
import { AlertCircle, CheckCircle2, Clock, Info, type LucideIcon } from '@/lib/lucide-icons';

/**
 * 결과 화면 카드 — 결제 완료·실패·확인 중·취소됨.
 *
 * 2026-10-04 조사: 예약·구독 결과는 맨바닥 가운데 정렬 텍스트, 펀딩 결과는 글래스 카드,
 * 아이콘은 어디에도 없고, 1차 CTA는 전부 손으로 짠 `<a>`였다(높이·굵기 제각각).
 *
 * 규칙: `glass-card rounded-2xl p-6 sm:p-8`, 가운데 정렬, tone 아이콘 원(48px, 아이콘 24),
 * 제목은 `typo-page-title`. CTA는 `actions`에 **`Button`으로** 넣는다.
 */
export type ResultTone = 'success' | 'error' | 'pending' | 'neutral';

const TONE: Record<ResultTone, { icon: LucideIcon; circle: string }> = {
  success: { icon: CheckCircle2, circle: 'bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300' },
  error: { icon: AlertCircle, circle: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300' },
  pending: { icon: Clock, circle: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' },
  neutral: { icon: Info, circle: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
};

export interface ResultCardProps {
  tone?: ResultTone;
  icon?: LucideIcon;
  title: React.ReactNode;
  as?: 'h1' | 'h2';
  description?: React.ReactNode;
  /** 세부(주문번호 `dl` 등). 왼쪽 정렬로 들어간다. */
  children?: React.ReactNode;
  /** 1차·2차 행동. 모바일 세로, sm부터 가로 가운데. */
  actions?: React.ReactNode;
  className?: string;
}

export const ResultCard = ({ tone = 'neutral', icon, title, as: Heading = 'h1', description, children, actions, className }: ResultCardProps) => {
  const Icon = icon ?? TONE[tone].icon;
  return (
    <section className={cn('glass-card rounded-2xl p-6 text-center sm:p-8', className)}>
      <span aria-hidden="true" className={cn('mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full', TONE[tone].circle)}>
        <Icon size={24} />
      </span>
      <Heading className="typo-page-title">{title}</Heading>
      {description && <p className="mx-auto mt-2 max-w-prose typo-body text-gray-600 dark:text-gray-400">{description}</p>}
      {children && <div className="mt-6 text-left">{children}</div>}
      {actions && <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">{actions}</div>}
    </section>
  );
};
