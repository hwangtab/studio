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

/** 헤더·푸터 메뉴 이름(ko 전용 — 상점은 ko에만 있다). `SHOP_SALES_OPEN`일 때만 메뉴에 뜬다. */
export const SHOP_NAV_LABEL = '음반·굿즈';
