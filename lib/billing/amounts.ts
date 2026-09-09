import { LESSON_MONTHLY_PRICE, PRACTICE_ROOM_MONTHLY_PRICE } from '../../data/pricing';
import type { subscriptionKindEnum } from '../../db/schema';
import { VAT_RATE, type OrderAmounts } from '../booking/amounts';

export type SubscriptionKind = (typeof subscriptionKindEnum)[number];

/**
 * 월 청구액. 사이트 표기는 VAT 별도이고 실제 청구는 포함액이다(booking/amounts.ts와 같은 규칙).
 * 금액은 언제나 data/pricing.ts 상수에서 온다 — 리터럴을 쓰면 상수가 움직여도 청구액이
 * 따라오지 않는다(CLAUDE.md 가격 드리프트 가드).
 */
export const MONTHLY_ITEM_AMOUNT: Record<SubscriptionKind, number> = {
  'practice-room': PRACTICE_ROOM_MONTHLY_PRICE,
  lesson: LESSON_MONTHLY_PRICE,
};

export const subscriptionAmounts = (kind: SubscriptionKind): OrderAmounts => {
  const itemAmount = MONTHLY_ITEM_AMOUNT[kind];
  const vatAmount = Math.round(itemAmount * VAT_RATE);
  return { itemAmount, vatAmount, totalAmount: itemAmount + vatAmount };
};

export const subscriptionOrderName = (kind: SubscriptionKind): string =>
  kind === 'practice-room' ? '연습실 월 이용료' : '프로듀싱 레슨 월정액';
