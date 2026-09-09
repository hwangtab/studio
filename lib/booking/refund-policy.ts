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

/**
 * 믹싱·마스터링 주문형 결제 환불 정책. 세션 예약과 달리 날짜 기준 단계별 환불이 아니라
 * "작업 착수" 시점 하나로 나뉜다 — 슬롯이 없어 날짜 개념이 없고, 파일을 받아 작업을
 * 시작하면 이미 엔지니어 시간이 들어간다. 착수 후 온라인 취소는 불가하되 관리자 임의
 * 환불은 남겨 둔다(work_orders.status가 received일 때만 고객 셀프 취소 가능 — service.ts).
 */
export const MIXING_REFUND_POLICY_LINES = [
  '작업 착수 전 취소: 전액 환불',
  '작업 착수 후: 온라인 취소 불가 (환불 문의는 010-4255-7893)',
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
