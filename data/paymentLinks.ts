import { kstDateString } from '../lib/booking/kst';

/**
 * 운영자가 만든 비공개 예약금 결제 링크. 주소는 `/ko/pay/<slug>`.
 *
 * - slug는 추측할 수 없는 무작위 값이다(`node -e "console.log(require('crypto').randomBytes(12).toString('hex'))"`).
 *   링크를 아는 사람만 결제할 수 있다. 사이트맵·robots·llms에는 싣지 않는다.
 * - **금액·품목명은 여기서만 읽는다.** 주문 API는 클라이언트가 보낸 금액을 받지 않는다.
 * - totalAmount는 VAT 포함 총액이다(원 단위 정수). 공급가·VAT는 주문 생성 때 분리한다.
 * - expiresOn(KST 날짜)을 넣으면 그날 끝까지만 열린다. 새 링크를 만들 때는 새 slug를 추가한다
 *   — 이미 발급한 slug의 금액을 바꾸지 말 것(결제 기록과 어긋난다).
 */
export interface PaymentLink {
  itemName: string;
  /** VAT 포함 총액. */
  totalAmount: number;
  /** 'YYYY-MM-DD'(KST). 이 날 끝까지 유효. */
  expiresOn?: string;
}

export const PAYMENT_LINKS: Record<string, PaymentLink> = {
  '46fee6d8ffa1a69be20324a2': {
    itemName: '싱글 음원 제작 예약금',
    totalAmount: 400000,
  },
};

const SLUG_PATTERN = /^[0-9a-f]{24}$/;

/** 유효한 링크만 돌려준다 — 없는 slug·만료된 링크는 null. */
export const getPaymentLink = (slug: unknown, now: Date = new Date()): PaymentLink | null => {
  if (typeof slug !== 'string' || !SLUG_PATTERN.test(slug)) return null;
  if (!Object.prototype.hasOwnProperty.call(PAYMENT_LINKS, slug)) return null;
  const link = PAYMENT_LINKS[slug];
  // 'YYYY-MM-DD' 문자열 비교는 날짜 순서와 같다. 만료일 당일(KST)까지는 열려 있다.
  if (link.expiresOn && kstDateString(now) > link.expiresOn) return null;
  return link;
};
