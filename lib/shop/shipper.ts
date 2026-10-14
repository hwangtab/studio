import type { ShopProduct } from '../../data/shop/catalog';

/**
 * 발송 주체 — 순수 모듈(클라이언트도 쓴다). 판매자·결제·환불·고객 응대는 언제나 스튜디오이고, 상품을 **포장해 보내는** 쪽만
 * 상품마다 다르다: 기본은 스튜디오, 아티스트가 직접 보내는 상품도 있다(`shop_product_fulfillment`, lib/shop/fulfillmentMode.ts).
 *
 * **한 주문은 한 발송 주체만 담는다.** 두 곳에서 따로 부쳐야 하는 주문은 운송장 하나·발송 처리 하나로 닫을 수 없다.
 * 디지털 상품은 발송이 없으니 판정에서 뺀다. 아티스트 직접 발송 실물과 다른 실물(스튜디오 발송 또는 다른 아티스트)이 섞이면 거절.
 */

export const SHOP_STUDIO_COURIER = '로젠택배';

/** 발송 주체 묶음 키. 디지털 상품은 null(어느 주문에나 들어간다), 스튜디오 발송 실물은 'studio', 아티스트 발송 실물은 'artist:<slug>'. */
export const shipperGroupOf = (p: Pick<ShopProduct, 'kind' | 'shippedByArtist'>): string | null => {
  if (p.kind === 'digital') return null;
  return p.shippedByArtist ? `artist:${p.shippedByArtist}` : 'studio';
};

/** 두 상품을 한 주문에 담을 수 있는가. */
export const canShareOrder = (a: Pick<ShopProduct, 'kind' | 'shippedByArtist'>, b: Pick<ShopProduct, 'kind' | 'shippedByArtist'>): boolean => {
  const ga = shipperGroupOf(a);
  const gb = shipperGroupOf(b);
  return ga === null || gb === null || ga === gb;
};

/** 담은 상품들이 둘 이상의 발송 주체를 섞었는가. */
export const hasMixedShippers = (products: ReadonlyArray<Pick<ShopProduct, 'kind' | 'shippedByArtist'>>): boolean =>
  new Set(products.map(shipperGroupOf).filter((g): g is string => g !== null)).size > 1;

export const SHOP_MIXED_SHIPPER_MESSAGE = '아티스트가 직접 보내는 상품은 같은 아티스트의 상품끼리만 한 주문에 담을 수 있어요. 따로 주문해 주세요.';

/** 상품 상세의 안내 한 줄. */
export const SHOP_ARTIST_SHIPS_NOTE = '아티스트가 직접 보내요. 판매·결제·환불·문의는 스튜디오 놀이 맡아요.';

/** 주문 폼의 배송지 아래 고지 — 받는 분 정보가 상품을 보내는 아티스트에게 전달된다는 사실(발송 목적에 한정). */
export const SHOP_ARTIST_SHARING_NOTICE = '아티스트가 직접 보내는 상품이 있어요. 받는 분 이름·연락처·주소·배송 메모는 발송을 위해 그 아티스트에게 전달되고, 아티스트 화면에서는 배송 완료 30일 뒤에 지워져요.';
