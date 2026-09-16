import {
  ARTIST_SUPPORT_TIERS,
  getArtistSupportTier,
  LESSON_MONTHLY_PRICE,
  PRACTICE_ROOM_MONTHLY_PRICE,
} from '../../data/pricing';
import { getSupportedArtist } from '../../data/artists';
import type { Subscription, subscriptionKindEnum } from '../../db/schema';
import { splitInclusiveAmount, VAT_RATE, type OrderAmounts } from '../booking/amounts';

export type SubscriptionKind = (typeof subscriptionKindEnum)[number];

/**
 * 사이트에 적힌 월 금액(고정가 상품). 금액은 언제나 data/pricing.ts 상수에서 온다 — 리터럴을 쓰면
 * 상수가 움직여도 청구액이 따라오지 않는다(CLAUDE.md 가격 드리프트 가드).
 *
 * 아티스트 구독은 여기 없다 — 고정가가 아니라 후원자가 고른 등급에서 오기 때문이다(아래).
 */
export const MONTHLY_ITEM_AMOUNT: Record<Exclude<SubscriptionKind, 'artist-support'>, number> = {
  'practice-room': PRACTICE_ROOM_MONTHLY_PRICE,
  lesson: LESSON_MONTHLY_PRICE,
};

/**
 * 월 청구액.
 *
 * 연습실·레슨은 **표기액이 VAT 별도**이고 청구는 포함액이다(연습실 360,000 → 396,000 /
 * 레슨 350,000 → 385,000). 녹음·믹싱 등 다른 상품과 같은 규칙이라 booking/amounts.ts의
 * computeAmounts와 계산이 동일하다. 사이트 표기(연습실 "월 36만원" · 레슨 "월 35만원")에는
 * VAT를 적지 않는다 — 현금 납부가 주된 경로이고, 카드 정기결제 금액은 상담에서 안내한다
 * (2026-09-11 결정).
 *
 * 아티스트 구독은 반대로 **표기액이 VAT 포함**이다("월 1만원"이 곧 청구액). 등급 id가 없거나
 * 모르는 값이면 null — 호출자가 거절해야 한다. 여기서 기본 등급으로 떨어뜨리면 후원자가
 * 고른 적 없는 금액이 청구된다.
 */
export const subscriptionAmounts = (kind: SubscriptionKind, tierId?: string | null): OrderAmounts | null => {
  if (kind === 'artist-support') {
    const tier = tierId ? getArtistSupportTier(tierId) : null;
    return tier ? splitInclusiveAmount(tier.monthlyTotal) : null;
  }
  const itemAmount = MONTHLY_ITEM_AMOUNT[kind];
  const vatAmount = Math.round(itemAmount * VAT_RATE);
  return { itemAmount, vatAmount, totalAmount: itemAmount + vatAmount };
};

/** 고정가 상품 전용 — 등급이 없는 종류라 null이 나올 수 없다. 관리자 폼 안내 문구용. */
export const fixedSubscriptionAmounts = (kind: Exclude<SubscriptionKind, 'artist-support'>): OrderAmounts =>
  subscriptionAmounts(kind)!;

const KIND_NAMES: Record<SubscriptionKind, string> = {
  'practice-room': '연습실 월 이용료',
  lesson: '프로듀싱 레슨 월정액',
  'artist-support': '아티스트 구독',
};

/**
 * 토스 주문명·메일 제목·화면에 쓰는 상품명.
 *
 * 종류 문자열만 넘겨도 되고(옛 호출부), 구독 행을 넘기면 아티스트 구독은 "○○ 아티스트 구독"처럼
 * 누구를 후원하는지까지 붙는다 — 카드 명세서에 "아티스트 구독"만 찍히면 후원자가 무슨
 * 결제인지 못 알아본다.
 */
export const subscriptionOrderName = (
  subject: SubscriptionKind | Pick<Subscription, 'kind' | 'artistSlug'>,
): string => {
  if (typeof subject === 'string') return KIND_NAMES[subject];
  if (subject.kind === 'artist-support' && subject.artistSlug) {
    const artist = getSupportedArtist(subject.artistSlug);
    if (artist) return `${artist.name} 아티스트 구독`;
  }
  return KIND_NAMES[subject.kind];
};

/** 등급 라벨 — 관리자·메일에서 "월 10,000원 (꾸준히)"처럼 붙인다. */
export const artistSupportTierLabel = (tierId: string | null | undefined): string | null =>
  (tierId && getArtistSupportTier(tierId)?.label) || null;

export { ARTIST_SUPPORT_TIERS };
