import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { ARTIST_SHIPPING_MASK_AFTER_DELIVERED_DAYS, ARTIST_SHIPPING_MASK_AFTER_SHIPPED_DAYS } from './artistTerms';
import { shopLineName } from './catalog';
import { isMissingTableError } from '../dbErrors';
import { latestPendingShipsOn } from './preorder';
import { loadShipsOnBySku } from './repository';
import { formatSerials, type OrderSerial } from './serials';

/**
 * 아티스트가 직접 발송하는 상품의 주문 — 서버 전용.
 *
 * **creatorId를 인자로 요구하는 것이 이 모듈의 전부다**(`lib/funding/creatorShipping.ts`와 같은 규칙). "전체를 가져와 화면에서
 * 거른다"는 모양의 함수를 두지 않는다. 조회 SQL의 EXISTS가 `p.creator_id = ? AND f.mode = 'artist'`를 직접 건다 —
 * 다른 아티스트·스튜디오 발송 주문은 어떤 경로로도 이 목록에 들어오지 않는다.
 *
 * 필드를 하나씩 골라 담는다(스프레드 없음). 이 화면의 props는 `__NEXT_DATA__`로 페이지 소스에 실리므로 발송에 필요 없는 값 —
 * 주문자 이메일·결제 금액·결제수단·관리 토큰(`manage_token`) — 은 아예 읽지 않는다. 그 주문의 **다른 발송 주체 줄**(새 주문은 섞일 수
 * 없고 실물·디지털도 따로 주문한다 — 옛 주문에는 디지털 줄이 섞여 있을 수 있다)도 싣지 않는다: 줄 조회가 이 아티스트의 아티스트 발송 실물로 좁혀져 있다.
 *
 * ── 받는 분 정보를 가리는 시점 ──
 * 배송 완료 표시(`delivered_at`) 30일 뒤. 배송 완료를 표시하지 않았으면 발송(`shipped_at`) 60일 뒤. 가려진 행은 이름·연락처·주소·메모를
 * 서버에서 비워 props에 싣지 않는다(화면에서 숨기는 것이 아니다). 오배송·민원은 보통 배송 직후 한 달 안에 나오고, 스튜디오는 주문 원본을
 * 5년 보관하므로(전자상거래법) 그 뒤 문의는 스튜디오가 받는다.
 */

// 가림 기간은 위탁 약관 제9조가 약속하는 값이라 약관 모듈이 정본이다(그 해시 게이트가 함께 지킨다).
export { ARTIST_SHIPPING_MASK_AFTER_DELIVERED_DAYS, ARTIST_SHIPPING_MASK_AFTER_SHIPPED_DAYS };
/** 발송 끝난 주문을 목록에 두는 기간(일). 발송 전 주문은 오래돼도 계속 보인다. */
export const ARTIST_SHIPPING_LIST_DAYS = 180;
const DAY = 86400;

/** 받는 분 정보를 가릴 때인가. 초 단위 시각을 받는다. */
export const isArtistShippingMasked = (
  o: { deliveredAt: number | null; shippedAt: number | null },
  nowSec: number,
): boolean => {
  if (o.deliveredAt !== null) return nowSec >= o.deliveredAt + ARTIST_SHIPPING_MASK_AFTER_DELIVERED_DAYS * DAY;
  if (o.shippedAt !== null) return nowSec >= o.shippedAt + ARTIST_SHIPPING_MASK_AFTER_SHIPPED_DAYS * DAY;
  return false;
};

export interface ArtistShippingItem {
  label: string;
  quantity: number;
  /** 한정판 번호("7/100, 8/100"). 번호가 있는 줄만. */
  serials: string | null;
}

export interface ArtistShippingRow {
  orderNo: string;
  /** 주문 시각(초). */
  orderedAt: number;
  items: ArtistShippingItem[];
  /** 아직 오지 않은 예약 발송일 가운데 가장 늦은 날(YYYY-MM-DD). 없으면 null. */
  shipsOn: string | null;
  fulfillmentStatus: 'preparing' | 'shipped' | 'delivered';
  courier: string | null;
  trackingNumber: string | null;
  /** 일부 환불된 주문 — 어느 줄이 환불됐는지 원장이 모른다. 아티스트는 발송하지 않고 스튜디오가 확인한다. */
  partialRefund: boolean;
  /** 받는 분 정보를 가렸는가. 가려지면 아래 다섯 칸은 비어 있다. */
  masked: boolean;
  recipientName: string;
  recipientPhone: string;
  postcode: string;
  address1: string;
  address2: string;
  shippingMemo: string;
}

interface OrderRaw {
  order_no: string;
  status: string;
  created_at: number;
  recipient_name: string;
  recipient_phone: string;
  postcode: string;
  address1: string;
  address2: string | null;
  shipping_memo: string | null;
  fulfillment_status: string;
  courier: string | null;
  tracking_number: string | null;
  shipped_at: number | null;
  delivered_at: number | null;
}

interface ItemRaw {
  order_no: string;
  id: string;
  sku_id: string;
  product_title: string;
  option_label: string | null;
  quantity: number;
  product_id: string;
  edition_size: number | null;
}

/**
 * 이 아티스트의 아티스트 발송 상품 줄 — 조회의 EXISTS와 줄 조회가 같은 조건을 쓴다. 디지털 상품은 발송이 없으므로 발송 주체 행이
 * 'artist'로 남아 있어도 빼낸다(`resolveOrderShipper`와 같은 기준 — 빼지 않으면 그 주문의 받는 분 정보가 아티스트에게 열린다).
 */
const ownArtistShippedLine = (creatorId: string) => sql`p.creator_id = ${creatorId} AND f.mode = 'artist' AND p.kind <> 'digital'`;

/**
 * 이 아티스트가 보낼 주문 목록(발송 전 → 발송함 → 배송 완료 순, 같은 상태는 최근 주문이 먼저).
 * 표가 없는 DB(0053·0057 전)에서는 빈 목록이다.
 */
export const loadArtistShippingOrders = async (creatorId: string, now: Date = new Date()): Promise<ArtistShippingRow[]> => {
  const nowSec = Math.floor(now.getTime() / 1000);
  const db = getDb();
  let orders: OrderRaw[];
  try {
    orders = await db.all<OrderRaw>(sql`
      SELECT o.order_no AS order_no, o.status AS status, CAST(o.created_at AS INTEGER) AS created_at,
             so.recipient_name AS recipient_name, so.recipient_phone AS recipient_phone,
             so.postcode AS postcode, so.address1 AS address1, so.address2 AS address2, so.shipping_memo AS shipping_memo,
             so.fulfillment_status AS fulfillment_status, so.courier AS courier, so.tracking_number AS tracking_number,
             so.shipped_at AS shipped_at, so.delivered_at AS delivered_at
      FROM orders o
      JOIN shop_orders so ON so.order_no = o.order_no
      WHERE o.type = 'merch'
        AND o.status IN ('paid', 'partially_refunded')
        AND so.fulfillment_status IN ('preparing', 'shipped', 'delivered')
        AND so.postcode <> ''
        AND (so.fulfillment_status = 'preparing' OR COALESCE(so.shipped_at, so.created_at) >= ${nowSec - ARTIST_SHIPPING_LIST_DAYS * DAY})
        AND EXISTS (
          SELECT 1 FROM shop_order_items i
          JOIN shop_product_skus ps ON ps.id = i.sku_id
          JOIN shop_products p ON p.id = ps.product_id
          JOIN shop_product_fulfillment f ON f.product_id = p.id
          WHERE i.order_no = o.order_no AND ${ownArtistShippedLine(creatorId)}
        )
      ORDER BY CASE so.fulfillment_status WHEN 'preparing' THEN 0 WHEN 'shipped' THEN 1 ELSE 2 END, o.created_at DESC
      LIMIT 300
    `);
  } catch (error: unknown) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
  if (orders.length === 0) return [];
  const nos = orders.map((o) => o.order_no);
  const inNos = sql.join(nos.map((n) => sql`${n}`), sql`, `);

  const items = await db.all<ItemRaw>(sql`
    SELECT i.order_no AS order_no, i.id AS id, i.sku_id AS sku_id, i.product_title AS product_title,
           i.option_label AS option_label, i.quantity AS quantity, p.id AS product_id, p.edition_size AS edition_size
    FROM shop_order_items i
    JOIN shop_product_skus ps ON ps.id = i.sku_id
    JOIN shop_products p ON p.id = ps.product_id
    JOIN shop_product_fulfillment f ON f.product_id = p.id
    WHERE i.order_no IN (${inNos}) AND ${ownArtistShippedLine(creatorId)}
    ORDER BY i.created_at ASC, i.id ASC
  `);
  const itemsByOrder = new Map<string, ItemRaw[]>();
  for (const it of items) itemsByOrder.set(it.order_no, [...(itemsByOrder.get(it.order_no) ?? []), it]);

  // 한정판 번호·예약 발송일은 덧붙이는 정보다 — 실패해도 발송 목록은 나온다.
  const serialsByItem = new Map<string, OrderSerial[]>();
  try {
    const rows = await db.all<{ order_item_id: string; serial: number; edition_size: number | null }>(sql`
      SELECT s.order_item_id AS order_item_id, s.serial AS serial, p.edition_size AS edition_size
      FROM shop_serials s JOIN shop_products p ON p.id = s.product_id
      WHERE s.order_no IN (${inNos}) ORDER BY s.serial
    `);
    for (const r of rows) {
      serialsByItem.set(r.order_item_id, [...(serialsByItem.get(r.order_item_id) ?? []), { itemId: r.order_item_id, serial: Number(r.serial), editionSize: Number(r.edition_size ?? 0) }]);
    }
  } catch (error: unknown) {
    console.error('[shop] 아티스트 발송 목록의 한정판 번호 조회 실패:', error);
  }
  const shipsOnBySku = await loadShipsOnBySku(items.map((i) => i.sku_id));

  return orders.map((o): ArtistShippingRow => {
    const masked = isArtistShippingMasked({ deliveredAt: o.delivered_at, shippedAt: o.shipped_at }, nowSec);
    const lines = itemsByOrder.get(o.order_no) ?? [];
    return {
      orderNo: o.order_no,
      orderedAt: Number(o.created_at),
      items: lines.map((l) => ({ label: shopLineName(l.product_title, l.option_label), quantity: Number(l.quantity), serials: formatSerials(serialsByItem.get(l.id)) })),
      shipsOn: latestPendingShipsOn(lines.map((l) => shipsOnBySku.get(l.sku_id)), now),
      fulfillmentStatus: o.fulfillment_status as ArtistShippingRow['fulfillmentStatus'],
      courier: o.courier,
      trackingNumber: o.tracking_number,
      partialRefund: o.status === 'partially_refunded',
      masked,
      recipientName: masked ? '' : o.recipient_name,
      recipientPhone: masked ? '' : o.recipient_phone,
      postcode: masked ? '' : o.postcode,
      address1: masked ? '' : o.address1,
      address2: masked ? '' : (o.address2 ?? ''),
      shippingMemo: masked ? '' : (o.shipping_memo ?? ''),
    };
  });
};

/** 콘솔 상점 탭의 한 줄 — 아티스트 발송 상품이 있는지, 발송 전 주문이 몇 건인지. 개인정보는 읽지 않는다. 표가 없으면 null. */
export const countArtistShipments = async (creatorId: string): Promise<{ hasProducts: boolean; pending: number } | null> => {
  try {
    const [row] = await getDb().all<{ products: number; pending: number }>(sql`
      SELECT
        (SELECT COUNT(*) FROM shop_products p JOIN shop_product_fulfillment f ON f.product_id = p.id
          WHERE ${ownArtistShippedLine(creatorId)} AND p.review_status = 'approved') AS products,
        (SELECT COUNT(*) FROM orders o JOIN shop_orders so ON so.order_no = o.order_no
          WHERE o.type = 'merch' AND o.status = 'paid' AND so.fulfillment_status = 'preparing' AND so.postcode <> ''
            AND EXISTS (
              SELECT 1 FROM shop_order_items i
              JOIN shop_product_skus ps ON ps.id = i.sku_id
              JOIN shop_products p ON p.id = ps.product_id
              JOIN shop_product_fulfillment f ON f.product_id = p.id
              WHERE i.order_no = o.order_no AND ${ownArtistShippedLine(creatorId)}
            )) AS pending
    `);
    return { hasProducts: Number(row?.products ?? 0) > 0, pending: Number(row?.pending ?? 0) };
  } catch (error: unknown) {
    if (!isMissingTableError(error)) console.error('[shop] 아티스트 발송 건수 조회 실패:', error);
    return null;
  }
};

// ─── 주문의 발송 주체 ────────────────────────────────────────────────────────────

export type OrderShipper =
  | { kind: 'studio' }
  | { kind: 'artist'; creatorId: string; creatorName: string; artistSlug: string | null };

/**
 * 한 주문을 누가 보내는가. 실물 줄(파일 상품 포함)이 **전부** 한 아티스트의 아티스트 발송 상품일 때만 'artist'다.
 * 섞였거나(주문 생성이 막지만 방어) 줄을 못 읽으면 'studio' — 아티스트 권한은 열리지 않는 쪽이 안전한 방향이다.
 * 표가 없는 DB에서는 항상 'studio'.
 */
export const resolveOrderShipper = async (orderNo: string): Promise<OrderShipper> => {
  try {
    const rows = await getDb().all<{ kind: string | null; mode: string | null; creator_id: string | null; name: string | null; slug: string | null }>(sql`
      SELECT p.kind AS kind, f.mode AS mode, p.creator_id AS creator_id, c.name AS name,
             (SELECT a.slug FROM shop_artists a WHERE a.creator_id = p.creator_id) AS slug
      FROM shop_order_items i
      LEFT JOIN shop_product_skus ps ON ps.id = i.sku_id
      LEFT JOIN shop_products p ON p.id = ps.product_id
      LEFT JOIN shop_product_fulfillment f ON f.product_id = p.id
      LEFT JOIN funding_creators c ON c.id = p.creator_id
      WHERE i.order_no = ${orderNo}
    `);
    const physical = rows.filter((r) => r.kind !== 'digital');
    const artistLines = physical.filter((r) => r.mode === 'artist' && r.creator_id);
    if (physical.length === 0 || artistLines.length !== physical.length) return { kind: 'studio' };
    const creators = new Set(artistLines.map((r) => r.creator_id));
    if (creators.size !== 1) return { kind: 'studio' };
    const first = artistLines[0];
    return { kind: 'artist', creatorId: first.creator_id as string, creatorName: first.name ?? '', artistSlug: first.slug };
  } catch (error: unknown) {
    if (!isMissingTableError(error)) console.error('[shop] 주문 발송 주체 조회 실패 — 스튜디오 발송으로 봅니다:', error);
    return { kind: 'studio' };
  }
};

/** 주문 번호 → 아티스트 이름(그 주문에 아티스트 직접 발송 줄이 있는 것만). 관리자 목록의 표시용 — 오류는 삼킨다. */
export const loadArtistShippersByOrder = async (orderNos: readonly string[]): Promise<Map<string, string>> => {
  const out = new Map<string, string>();
  if (orderNos.length === 0) return out;
  try {
    const rows = await getDb().all<{ order_no: string; name: string }>(sql`
      SELECT DISTINCT i.order_no AS order_no, c.name AS name
      FROM shop_order_items i
      JOIN shop_product_skus ps ON ps.id = i.sku_id
      JOIN shop_products p ON p.id = ps.product_id
      JOIN shop_product_fulfillment f ON f.product_id = p.id AND f.mode = 'artist'
      JOIN funding_creators c ON c.id = p.creator_id
      WHERE p.kind <> 'digital' AND i.order_no IN (${sql.join(orderNos.map((n) => sql`${n}`), sql`, `)})
    `);
    for (const r of rows) out.set(r.order_no, r.name);
  } catch (error: unknown) {
    if (!isMissingTableError(error)) console.error('[shop] 주문 발송 주체(목록) 조회 실패:', error);
  }
  return out;
};
