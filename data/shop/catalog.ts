/**
 * 상점(음반·굿즈) 상품 정본 — 이름·옵션·가격은 **여기서만** 읽는다. 재고는 DB(`shop_skus`)가 들고, 관리자
 * `/admin/shop`에서 넣는다. 주문 API는 클라이언트가 보낸 금액·상품명을 받지 않는다.
 *
 * **이 모듈은 아무것도 import하지 않는다** — 상품 화면(클라이언트 번들)과 서버가 같은 값을 쓴다.
 *
 * ## 지켜야 할 것 (lib/shop/CLAUDE.md에 이유가 있다)
 *
 * - **판매를 시작한 SKU의 id·가격은 바꾸지 않는다.** 주문 기록이 `sku_id` 문자열로 재고를 세므로 id를 바꾸면 그
 *   SKU의 판매 수량이 0으로 보여 재고가 부풀고, 가격을 바꾸면 화면과 결제 기록이 어긋난다. 가격을 바꾸려면 새 id로
 *   SKU를 더하고 옛 SKU는 `retired: true`로 내린다. `data/shop/catalog.baseline.test.ts`가 지킨다.
 * - 이미지는 `public/images/shop/`에 **날짜 박힌 파일명**으로 올린다(`/images/**`는 1년 immutable 캐시). webp는
 *   `.gitignore` 대상이라 `git add -f`.
 * - slug는 소문자·숫자·하이픈. `success`·`fail`·`manage`는 페이지 이름이라 쓸 수 없다.
 *
 * ## 상품 예시 (복사해서 SHOP_PRODUCTS에 넣는다)
 *
 * ```ts
 * {
 *   slug: 'example-cd',
 *   category: 'album',
 *   title: '앨범 제목',
 *   subtitle: '아티스트 이름 · CD',
 *   description: ['첫 문단은 평문 — 검색 요약·공유 카드 설명이 여기서 나온다.', '두 번째 문단.'],
 *   images: ['/images/shop/example-cd-20261101.webp'],
 *   skus: [{ id: 'example-cd-std', price: 20000 }],
 *   published: true,
 * }
 * ```
 * 아티스트 상품(위탁 판매)이면 `artist: '<data/artists의 slug>'`를 붙인다 — 그 아티스트 페이지에 상품이 모이고,
 * 관리자 화면이 아티스트별 정산 예정액을 계산한다(SHOP_ARTIST_SHARE_PERCENT). 스튜디오 상품은 비운다.
 * 옷처럼 옵션이 있으면 `skus: [{ id: 'tee-s', optionLabel: 'S', price: 30000 }, { id: 'tee-m', optionLabel: 'M', price: 30000 }]`.
 */

export type ShopCategory = 'album' | 'goods';

export const SHOP_CATEGORY_LABELS: Record<ShopCategory, string> = {
  album: '음반',
  goods: '굿즈',
};

export interface ShopSku {
  /** 전역에서 겹치지 않는 id(소문자·숫자·하이픈). 판매 시작 뒤 바꾸지 않는다. */
  id: string;
  /** 옵션 이름(사이즈·색 등). 옵션이 하나뿐인 상품은 비운다. */
  optionLabel?: string;
  /** VAT 포함 판매가(원). 판매 시작 뒤 바꾸지 않는다 — 새 SKU를 더한다. */
  price: number;
  /** true면 더 팔지 않는다(가격을 바꿔 새 SKU로 옮긴 옛 SKU 등). 기존 주문 기록 때문에 지우지 않는다. */
  retired?: boolean;
}

export interface ShopProduct {
  slug: string;
  category: ShopCategory;
  title: string;
  subtitle?: string;
  /** 문단 배열. 첫 문단은 평문이어야 한다(검색 요약·OG 설명). */
  description: string[];
  /** 첫 장이 대표 이미지. `/images/shop/…` */
  images: string[];
  skus: ShopSku[];
  /**
   * 위탁 판매 아티스트(`data/artists`의 slug). 비우면 스튜디오 상품. 판매를 시작한 뒤 바꾸지 않는다 —
   * 정산이 주문 줄의 SKU → 이 값으로 아티스트를 찾으므로, 바꾸면 지난 판매가 다른 아티스트에게 정산된다.
   */
  artist?: string;
  /** false면 목록·상세에 나오지 않고 주문도 받지 않는다. */
  published: boolean;
  /**
   * 아래 다섯은 **DB 상품(source: 'db') 전용**이다 — 파일 상품은 쓰지 않는다
   * (`validateShopCatalog`가 파일 상품의 kind: 'digital'·editionSize를 거부). 전부 선택이라 파일 정의는 그대로다.
   */
  /** 실물/디지털. 비우면 실물. */
  kind?: 'physical' | 'digital';
  /** 예약 발송일(YYYY-MM-DD, KST). */
  shipsOn?: string;
  /** 한정판 수량(일련번호를 붙인다). */
  editionSize?: number;
  /** 내려받기 파일이 있는가. 파일 키(R2)는 공개 객체에 싣지 않는다. */
  hasDownloads?: boolean;
  /** 미리듣기 파일 이름 목록(디지털 DB 상품). 키는 싣지 않는다 — 재생은 `/api/shop/preview?product=<slug>&i=<순번>`. */
  previews?: string[];
  /** 정본 출처. 비우면 'file'. */
  source?: 'file' | 'db';
  /**
   * 아티스트가 직접 발송하는 DB 상품이면 그 아티스트의 상점 slug(`/ko/shop/artist/<slug>`). 비우면 스튜디오가 발송한다.
   * **DB 상품 전용** — 파일 상품은 항상 스튜디오 발송이다. 한 주문은 한 발송 주체만 담을 수 있어(lib/shop/shipper.ts)
   * 주문 폼이 이 값으로 함께 담을 상품을 거른다. 아티스트 id(creatorId)는 싣지 않는다.
   */
  shippedByArtist?: string;
}

export const SHOP_PRODUCTS: readonly ShopProduct[] = [];
