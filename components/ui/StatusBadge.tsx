import type { ReactNode } from 'react';
import { Badge, type BadgeTone } from './Badge';

export type StatusTone = 'active' | 'neutral' | 'warning';

/** 공연 카드·티켓 카드의 상태 톤 → 공용 Badge tone. 색 값은 Badge에만 있다(design-system §4). */
const TONE: Record<StatusTone, BadgeTone> = {
  active: 'brand',
  neutral: 'neutral',
  warning: 'warning',
};

/** 상태 배지 — 공용 Badge의 얇은 별칭. 공연 카드·티켓 카드가 같은 모양을 쓴다. */
export default function StatusBadge({ tone = 'neutral', children, className = '' }: { tone?: StatusTone; children: ReactNode; className?: string }) {
  return (
    <Badge tone={TONE[tone]} size="md" className={`w-fit ${className}`.trim()}>
      {children}
    </Badge>
  );
}
