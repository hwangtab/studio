const DAY_MS = 24 * 60 * 60 * 1000;

export interface RefundTier {
  minDaysBefore: number;
  pct: number;
}

const TIERS: RefundTier[] = [
  { minDaysBefore: 10, pct: 100 },
  { minDaysBefore: 7, pct: 90 },
  { minDaysBefore: 3, pct: 80 },
  { minDaysBefore: 1, pct: 70 },
  { minDaysBefore: 0, pct: 10 },
];

/**
 * §11.3 취소환불표. 공연 시작 이후(체크인 포함)는 0(환불 불가).
 * daysBefore는 (showtimeStartsAt - noticeAt) / 1일, 내림.
 */
export function refundRateForNotice(showtimeStartsAt: Date, noticeAt: Date): number {
  const diffMs = showtimeStartsAt.getTime() - noticeAt.getTime();
  if (diffMs <= 0) return 0;
  const daysBefore = Math.floor(diffMs / DAY_MS);
  for (const tier of TIERS) {
    if (daysBefore >= tier.minDaysBefore) return tier.pct;
  }
  return 0;
}

/** 원 단위 절사(국세청 원천징수와 같은 관행). */
export function calcRefundAmount(unitAmount: number, pct: number): number {
  return Math.floor((unitAmount * pct) / 100);
}
