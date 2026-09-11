import { LESSON_MONTHLY_PRICE, PRACTICE_ROOM_MONTHLY_PRICE } from '../../data/pricing';
import type { subscriptionKindEnum } from '../../db/schema';
import { VAT_RATE, type OrderAmounts } from '../booking/amounts';

export type SubscriptionKind = (typeof subscriptionKindEnum)[number];

/**
 * 사이트에 적힌 월 금액. 금액은 언제나 data/pricing.ts 상수에서 온다 — 리터럴을 쓰면
 * 상수가 움직여도 청구액이 따라오지 않는다(CLAUDE.md 가격 드리프트 가드).
 */
export const MONTHLY_ITEM_AMOUNT: Record<SubscriptionKind, number> = {
  'practice-room': PRACTICE_ROOM_MONTHLY_PRICE,
  lesson: LESSON_MONTHLY_PRICE,
};

/**
 * 표기 금액에 VAT가 포함돼 있는가. 두 상품이 다르다.
 *
 * - 레슨 35만원은 **최종 청구액**이다. 사이트도 VAT를 따로 말하지 않고 "회당 약 87,500원"
 *   (35만÷4)으로 안내한다 — 여기에 10%를 더 붙이면 사이트가 약속한 금액보다 더 걷는다.
 * - 연습실 36만원은 VAT 별도이고 카드 결제는 39.6만원으로 청구한다(2026-09-10 결정).
 */
const VAT_INCLUDED: Record<SubscriptionKind, boolean> = {
  'practice-room': false,
  lesson: true,
};

/**
 * 월 청구액.
 *
 * VAT 포함 상품은 표기액을 총액으로 두고 공급가·세액을 역산한다(세금계산서와 같은 방식).
 * 반올림은 공급가 쪽에서만 하고 세액은 차액으로 구해, 두 값의 합이 총액과 항상 정확히
 * 맞게 한다 — 각각 반올림하면 1원이 어긋나 토스 승인 금액과 불일치할 수 있다.
 */
export const subscriptionAmounts = (kind: SubscriptionKind): OrderAmounts => {
  const listed = MONTHLY_ITEM_AMOUNT[kind];
  if (VAT_INCLUDED[kind]) {
    const itemAmount = Math.round(listed / (1 + VAT_RATE));
    return { itemAmount, vatAmount: listed - itemAmount, totalAmount: listed };
  }
  const vatAmount = Math.round(listed * VAT_RATE);
  return { itemAmount: listed, vatAmount, totalAmount: listed + vatAmount };
};

export const subscriptionOrderName = (kind: SubscriptionKind): string =>
  kind === 'practice-room' ? '연습실 월 이용료' : '프로듀싱 레슨 월정액';
