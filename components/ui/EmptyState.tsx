import React from 'react';
import { cn } from '../../lib/utils';
import { Inbox, type LucideIcon } from '@/lib/lucide-icons';

/**
 * 빈 상태 — 글이 없다, 프로젝트가 없다, 검색 결과가 없다.
 *
 * 2026-10-04 조사: 📭 이모지 + 회색 글자 두 곳, 맨 텍스트 두 곳, `typo-card-title` 한 곳.
 * 이모지는 플랫폼마다 다르게 그려지고 다크에서 떠 보여 lucide로 바꾼다(§4 아이콘 규칙).
 *
 * 점선 테두리는 "여기 무언가 올 자리"라는 뜻이다 — 콘텐츠 카드와 구분된다.
 */
export interface EmptyStateProps {
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** 다음 행동(링크·버튼). */
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState = ({ icon: Icon = Inbox, title, description, action, className }: EmptyStateProps) => (
  <div className={cn('rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-gray-600', className)}>
    <span aria-hidden="true" className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
      <Icon size={24} />
    </span>
    <p className="typo-card-subtitle text-gray-900 dark:text-white">{title}</p>
    {description && <p className="mx-auto mt-1 max-w-prose typo-card-meta">{description}</p>}
    {action && <div className="mt-5 flex justify-center">{action}</div>}
  </div>
);
