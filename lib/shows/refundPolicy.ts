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

/**
 * 고객에게 보여 줄 취소환불표 한 줄씩. TIERS에서 직접 만들어 표와 계산이 갈라지지 않는다.
 * 예: '공연 10일 전까지 — 100%', '공연 7~9일 전 — 90%', '공연 당일(시작 전) — 10%'.
 */
export function refundTierLines(): string[] {
  return TIERS.map((tier, i) => {
    const higher = i > 0 ? TIERS[i - 1].minDaysBefore : null;
    let when: string;
    if (higher === null) when = `공연 ${tier.minDaysBefore}일 전까지`;
    else if (tier.minDaysBefore === 0) when = '공연 당일(시작 전)';
    else if (higher - tier.minDaysBefore === 1) when = `공연 ${tier.minDaysBefore}일 전`;
    else when = `공연 ${tier.minDaysBefore}~${higher - 1}일 전`;
    return `${when} — ${tier.pct}%`;
  });
}

/** refundTierLines()의 영어판 — 같은 TIERS에서 만든다. 예: 'Up to 10 days before the show — 100%'. */
export function refundTierLinesEn(): string[] {
  return TIERS.map((tier, i) => {
    const higher = i > 0 ? TIERS[i - 1].minDaysBefore : null;
    let when: string;
    if (higher === null) when = `Up to ${tier.minDaysBefore} days before the show`;
    else if (tier.minDaysBefore === 0) when = 'On the day of the show (before it starts)';
    else if (higher - tier.minDaysBefore === 1) when = `${tier.minDaysBefore} day${tier.minDaysBefore === 1 ? '' : 's'} before the show`;
    else when = `${tier.minDaysBefore}–${higher - 1} days before the show`;
    return `${when} — ${tier.pct}%`;
  });
}

/** 환불표 아래에 붙이는 공통 안내. */
export const REFUND_POLICY_FOOTNOTES: readonly string[] = [
  '공연 시작 이후, 그리고 입장 처리된 티켓은 환불할 수 없습니다.',
  '환불 금액은 신청 시점 기준으로 계산하며 원 단위 미만은 버립니다.',
  '계좌로 입금하신 예매는 환불을 신청하실 때 환불받을 계좌를 적어 주시면, 접수일부터 3영업일 이내에 그 계좌로 보내 드립니다. 회차가 취소되면 전액을 돌려드립니다.',
];

/** REFUND_POLICY_FOOTNOTES의 영어판 — 같은 내용을 같은 순서로. 한쪽을 고치면 다른 쪽도 고친다. */
export const REFUND_POLICY_FOOTNOTES_EN: readonly string[] = [
  'Tickets cannot be refunded once the show has started or after they have been checked in.',
  'Refund amounts are calculated at the time you request the refund, rounded down to the nearest won.',
  'If you paid by bank transfer, enter the account you want the refund sent to when you request it; we send it within 3 business days of the request. If a showtime is cancelled, you get a full refund.',
];
