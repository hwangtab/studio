/**
 * 상점 운영 상수 — 배송비·주문 한도·판매 개시. 화면·FAQ·서버가 이 값만 읽는다(카피에 금액을 직접 쓰지 않는다).
 *
 * **이 모듈은 아무것도 import하지 않는다** — 상품 화면(클라이언트 번들)과 서버가 같은 값을 쓴다.
 */

/** 배송비(VAT 포함, 원). 주문당 한 번. 운영자 결정 2026-10-12. */
export const SHOP_SHIPPING_FEE = 4000;

/** 상품 합계(배송비 제외)가 이 금액 이상이면 배송비 0원. 운영자 결정 2026-10-12. */
export const SHOP_FREE_SHIPPING_FROM = 200000;

/** 한 줄(SKU)당 최대 수량. */
export const SHOP_MAX_QTY_PER_LINE = 10;

/** 한 주문에 담을 수 있는 줄 수. */
export const SHOP_MAX_LINES = 20;

/** 입력 칸 maxLength와 서버 검증(lib/shop/validation.ts)이 같은 값을 본다 — 서버가 몰래 자르지 않는다(펀딩 PLEDGE_TEXT_LIMITS와 같다). */
export const SHOP_TEXT_LIMITS = {
  recipientName: 40,
  recipientPhone: 20,
  postcode: 10,
  address1: 200,
  address2: 200,
  shippingMemo: 200,
} as const;

/**
 * 상품을 보낼 때 쓸 수 있는 택배사 — **닫힌 목록이다.** 개인정보 처리방침 4항의 수탁자 표가 이 목록에서 만들어지고
 * (data/privacyPolicy.ts), 관리자 발송 화면은 이 중에서만 고르며 서버도 목록 밖 이름을 거절한다(lib/shop/fulfillment.ts).
 * 택배사는 발송할 때마다 달라질 수 있어(운영자 2026-10-13) 한 곳을 정하지 않고 쓸 수 있는 곳을 모두 적는다.
 *
 * **새 택배사를 쓰려면 여기 한 줄을 더한다** — 그러면 처리방침 본문이 바뀌어 펀딩 약관 판본 게이트가
 * `FUNDING_TERMS_VERSION`을 올리라고 CI를 세운다. 고지하지 않은 수탁자에게 배송지가 넘어가는 길이 없다.
 */
export const SHOP_COURIERS = ['우체국택배', 'CJ대한통운', '한진택배', '롯데택배', '로젠택배'] as const;
export type ShopCourier = (typeof SHOP_COURIERS)[number];
export const isShopCourier = (v: unknown): v is ShopCourier => typeof v === 'string' && (SHOP_COURIERS as readonly string[]).includes(v);

/** 결제창을 여는 동안 재고를 잡아 두는 시간(초). 공연 예매와 같은 10분. */
export const SHOP_HOLD_SECONDS = 600;

/**
 * **판매 개시 스위치.** false면 주문 API가 주문을 받지 않고 상품 화면의 주문 폼이 "준비 중"으로 바뀐다.
 *
 * 켜기 전에 할 것(lib/shop/CLAUDE.md "판매 개시 체크리스트"): 개인정보 처리방침에 상품 주문의 수집 항목·목적·
 * 택배사 위탁을 더하고 판본(FUNDING_TERMS_VERSION)을 올린다, 운영 DB에 마이그레이션 0052를 적용한다, 재고를 넣는다.
 * 처리방침이 고지하지 않은 배송지를 받으면 안 되므로 이 값이 그 순서를 막는다.
 */
export const SHOP_SALES_OPEN = false;

/** 상품 합계로 배송비를 정한다. 0원 주문은 없다(상품 합계는 항상 0보다 크다). */
export const shopShippingFeeFor = (subtotal: number): number =>
  subtotal >= SHOP_FREE_SHIPPING_FROM ? 0 : SHOP_SHIPPING_FEE;
