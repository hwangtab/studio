import { daysUntilKst } from './kst';

/** 큰 것부터 검사한다. 비율 변경은 이 표만 고치면 화면·계산·약관이 함께 바뀐다. */
export const REFUND_TIERS = [
  { minDaysBefore: 3, rate: 1 },
  { minDaysBefore: 1, rate: 0.5 },
  { minDaysBefore: 0, rate: 0 },
] as const;

export const REFUND_POLICY_LINES = [
  '이용일 3일 전까지 취소: 전액 환불',
  '이용일 1~2일 전 취소: 50% 환불',
  '이용일 당일 취소: 환불 불가',
] as const;

export interface RefundQuote {
  daysBefore: number;
  rate: number;
  refundAmount: number;
}

export const computeRefund = (totalAmount: number, startAt: Date, now: Date): RefundQuote => {
  const daysBefore = daysUntilKst(now, startAt);
  const tier = REFUND_TIERS.find((t) => daysBefore >= t.minDaysBefore);
  const rate = tier ? tier.rate : 0; // 음수(지난 예약) 포함 — 환불 없음
  return { daysBefore, rate, refundAmount: Math.floor(totalAmount * rate) };
};
