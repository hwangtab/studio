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
 * 월 청구액 — 두 구독 상품 모두 **표기액은 VAT 별도**이고 청구는 포함액이다
 * (연습실 360,000 → 396,000 / 레슨 350,000 → 385,000). 녹음·믹싱 등 다른 상품과
 * 같은 규칙이라 booking/amounts.ts의 computeAmounts와 계산이 동일하다.
 *
 * 사이트 표기(연습실 "월 36만원" · 레슨 "월 35만원")에는 VAT를 적지 않는다 —
 * 현금 납부가 주된 경로이고, 카드 정기결제 금액은 상담에서 안내한다(2026-09-11 결정).
 */
export const subscriptionAmounts = (kind: SubscriptionKind): OrderAmounts => {
  const itemAmount = MONTHLY_ITEM_AMOUNT[kind];
  const vatAmount = Math.round(itemAmount * VAT_RATE);
  return { itemAmount, vatAmount, totalAmount: itemAmount + vatAmount };
};

export const subscriptionOrderName = (kind: SubscriptionKind): string =>
  kind === 'practice-room' ? '연습실 월 이용료' : '프로듀싱 레슨 월정액';
