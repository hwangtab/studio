import React from 'react';
import { cn } from '../../lib/utils';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, type LucideIcon } from '@/lib/lucide-icons';

/**
 * 상태·안내 박스 — 오류·성공·주의·정보·중립·브랜드.
 *
 * 2026-10-04 조사: 같은 tone의 다크 틴트가 다섯 가지였다(amber만 `amber-500/10`·
 * `amber-950/40`·`amber-900/30`·`amber-950`·`amber-500/30`). 테두리 유무·패딩(p-3~p-8)·
 * 반경(md·lg·xl·2xl)도 흐름마다 달랐고 다크 짝이 아예 없는 곳이 다섯이었다.
 *
 * 규칙: `rounded-xl border p-4`, tone 값은 **여기에만** 있다. 손으로 `bg-amber-50`을
 * 조립하지 않는다(`components/ui/uiPatterns.baseline.test.ts`가 기준선으로 막는다).
 *
 * role은 tone을 따른다 — error는 `alert`(즉시 읽음), success는 `status`(차례가 오면 읽음),
 * 나머지는 없음. 레이아웃이 아니라 **지금 일어난 일**을 알릴 때만 role을 덮어쓸 것.
 */
export type NoticeTone = 'neutral' | 'info' | 'success' | 'warning' | 'error' | 'brand';

/**
 * tone 값의 정본. 구조가 Notice와 다른 상태 박스(스토리 인라인 콜아웃 `<aside>`·허브 링크 배너·
 * 고정 문의 바)는 이 표를 가져다 쓴다 — 같은 색을 손으로 다시 적으면 다크 틴트가 또 갈라진다.
 */
export const NOTICE_TONE_CLASS: Record<NoticeTone, string> = {
  neutral: 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300',
  info: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200',
  success: 'border-green-200 bg-green-50 text-green-900 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-200',
  warning: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200',
  error: 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200',
  brand: 'border-primary/20 bg-primary/5 text-gray-800 dark:border-primary-lighter/30 dark:bg-primary-lighter/10 dark:text-gray-100',
};

const TONE_ICON: Record<NoticeTone, LucideIcon> = {
  neutral: Info,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
  brand: Info,
};

const TONE_ROLE: Partial<Record<NoticeTone, 'alert' | 'status'>> = {
  error: 'alert',
  success: 'status',
};

export interface NoticeProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  tone?: NoticeTone;
  /** 첫 줄 굵은 제목. 본문만 있어도 된다. */
  title?: React.ReactNode;
  /** `false`면 아이콘 없음, 컴포넌트를 주면 교체. 기본은 tone별 아이콘. */
  icon?: LucideIcon | false;
  /** 본문 아래 행동(링크·버튼). 본문과 같은 색을 상속한다. */
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export const Notice = ({ tone = 'neutral', title, icon, actions, className, children, role, ...rest }: NoticeProps) => {
  const Icon = icon === false ? null : (icon ?? TONE_ICON[tone]);
  return (
    <div role={role ?? TONE_ROLE[tone]} className={cn('flex gap-3 rounded-xl border p-4', NOTICE_TONE_CLASS[tone], className)} {...rest}>
      {Icon && <Icon size={20} aria-hidden="true" className="mt-0.5 shrink-0" />}
      <div className="min-w-0 flex-1 text-sm leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-1', '[&_a]:underline [&_a]:underline-offset-2')}>{children}</div>}
        {actions && <div className="mt-3 flex flex-wrap gap-3">{actions}</div>}
      </div>
    </div>
  );
};
