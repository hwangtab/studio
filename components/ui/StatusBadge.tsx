import type { ReactNode } from 'react';

export type StatusTone = 'active' | 'neutral' | 'warning';

const TONE: Record<StatusTone, string> = {
  // 진행·예매 중 — 보라 틴트. 다크 짝은 브랜드색 텍스트 규칙(design-system §1)대로 primary-lighter.
  active: 'bg-primary/10 text-primary dark:bg-primary-light/15 dark:text-primary-lighter',
  // 마감·종료·매진 등 지나간/막힌 상태.
  neutral: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  // 취소 등 주의. yellow-*는 카카오 전용이라 amber(design-system §1 상태색).
  warning: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100',
};

/** 상태 배지(design-system §4: 둥근 알약, 색만 의미에 따라). 공연 카드·티켓 카드가 같은 모양을 쓴다. */
export default function StatusBadge({ tone = 'neutral', children, className = '' }: { tone?: StatusTone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[tone]} ${className}`.trim()}>
      {children}
    </span>
  );
}
