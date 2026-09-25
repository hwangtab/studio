/**
 * 발송 상태 한국어 라벨 — 유일한 정본.
 *
 * 순수 상수 모듈이다. `db/schema`·`node:fs`를 물지 않는다 — 이 파일을 클라이언트 컴포넌트
 * (`components/funding/creator/ShippingTable.tsx`)가 값으로 import해도 서버 전용 모듈이
 * 번들에 끌려 들어가지 않는다(CLAUDE.md "개설자가 쓴 것은 우리가 쓴 것과 다르게 다룬다" 절과
 * 같은 함정 회피).
 *
 * 소비처: `components/funding/creator/ShippingTable.tsx`(개설자 화면),
 * `pages/api/funding/creator/projects/[id]/shipping.csv.ts`(CSV 내려받기),
 * `pages/admin/funding/[id].tsx`·`pages/admin/funding/index.tsx`(관리자 상세·목록).
 * 예전엔 이 넷이 같은 문자열을 각자 들고 있었다.
 *
 * ⚠️ **개설자 약관 제8조 5항(`pages/[locale]/funding/creator-terms.tsx`)도 같은 네 이름
 * (미발송·준비중·발송완료·수령완료)을 적고 있다.** 이 상수를 바꾸면 그 조항과 표기가
 * 갈라지고, 약관 내용이 바뀌는 것이므로 `FUNDING_CREATOR_TERMS_VERSION`을 올려야 한다 —
 * 여기만 고치고 약관을 그대로 두지 말 것.
 */
export const FULFILLMENT_STATUS_ORDER = ['none', 'preparing', 'shipped', 'delivered'] as const;

export type FulfillmentStatus = (typeof FULFILLMENT_STATUS_ORDER)[number];

/**
 * `Record<string, string>`으로 넓혀 둔다 — 소비처의 `fulfillmentStatus` 값은 DB 컬럼
 * (`db/schema.ts`의 `text('fulfillment_status')`)에서 온 평범한 `string`이라, 키 타입을
 * `FulfillmentStatus`로 좁히면 그 값으로 인덱싱할 때마다 타입 에러가 난다.
 */
export const FULFILLMENT_LABELS: Record<string, string> = {
  none: '미발송',
  preparing: '준비중',
  shipped: '발송완료',
  delivered: '수령완료',
};

/**
 * 후원 주문 상태(`orders.status`) 한국어 라벨 — 후원자가 보는 화면의 정본.
 *
 * 여기 두는 이유는 위 FULFILLMENT_LABELS와 같다. `lib/funding/refundable.ts`에 두면
 * 그 모듈이 drizzle을 물고 있어 클라이언트 번들로 끌려 들어간다. 이 파일은 순수 상수뿐이다.
 *
 * 소비처: `pages/[locale]/funding/manage/[orderNo].tsx`(후원 확인),
 * `pages/[locale]/funding/success.tsx`(확정 화면이 살아 있지 않은 건에 띄우는 안내).
 * 관리자 화면은 별도 라벨을 쓴다 — 보는 사람이 다르고 표기도 다르다(`취소/환불` 등).
 */
export const FUNDING_ORDER_STATUS_LABELS: Record<string, string> = {
  pending: '결제 대기',
  paid: '펀딩 확정',
  partially_refunded: '일부 환불',
  refunded: '환불 완료',
  expired: '만료',
  failed: '결제 실패',
};
