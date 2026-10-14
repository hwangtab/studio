import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { getSupportedArtist } from '../../data/artists';
import { SHOP_PRODUCTS } from '../../data/shop/catalog';
import { listDbSkusForAdmin } from './dbProducts';
import { isDbSkuId } from './productRules';
import { listAllSkusForAdmin } from './repository';
import { computeShopArtistPayout, kstMonthRange, type ShopArtistPayout } from './artistPayout';
import { getRemainingStock } from './service';

/** 관리자 상점 화면 — 주문 목록·재고 표·아티스트별 정산 예정액. */

export interface AdminShopOrderRow {
  orderNo: string;
  status: string;
  fulfillmentStatus: string;
  customerName: string;
  totalAmount: number;
  itemSummary: string;
  createdAt: number;
}

/** 최근 주문(결제 대기·만료는 뺀다 — 관리자가 할 일이 없는 주문). */
export const listAdminShopOrders = async (limit = 200): Promise<AdminShopOrderRow[]> => {
  const rows = await getDb().all<{
    order_no: string; status: string; fulfillment_status: string; customer_name: string; total_amount: number;
    item_summary: string | null; created_at: number;
  }>(sql`
    SELECT o.order_no, o.status, so.fulfillment_status, o.customer_name, o.total_amount, o.created_at,
           (SELECT GROUP_CONCAT(i.product_title || COALESCE(' · ' || i.option_label, '') || ' ×' || i.quantity, ', ')
            FROM shop_order_items i WHERE i.order_no = o.order_no) AS item_summary
    FROM orders o JOIN shop_orders so ON so.order_no = o.order_no
    WHERE o.type = 'merch' AND o.status NOT IN ('pending', 'expired', 'failed')
    ORDER BY o.created_at DESC
    LIMIT ${limit}
  `);
  return rows.map((r) => ({
    orderNo: r.order_no, status: r.status, fulfillmentStatus: r.fulfillment_status, customerName: r.customer_name,
    totalAmount: Number(r.total_amount), itemSummary: r.item_summary ?? '', createdAt: Number(r.created_at),
  }));
};

export interface AdminSkuStockRow {
  skuId: string;
  productTitle: string;
  optionLabel: string | null;
  price: number;
  published: boolean;
  retired: boolean;
  stock: number | null;
  remaining: number;
}

/** 카탈로그(파일 + DB의 잠긴 SKU)의 모든 SKU와 DB 재고. 재고 행이 없으면 stock null(= 0, 아직 안 넣음). */
export const listAdminSkuStock = async (now: Date): Promise<AdminSkuStockRow[]> => {
  const skus = await listAllSkusForAdmin();
  if (skus.length === 0) return [];
  const ids = skus.map((x) => x.sku.id);
  const stockRows = await getDb().all<{ id: string; stock: number }>(
    sql`SELECT id, stock FROM shop_skus WHERE id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`,
  );
  const stockById = new Map(stockRows.map((r) => [r.id, Number(r.stock)]));
  const remaining = await getRemainingStock(ids, now);
  return skus.map(({ product, sku }) => ({
    skuId: sku.id, productTitle: product.title, optionLabel: sku.optionLabel ?? null, price: sku.price,
    published: product.published, retired: Boolean(sku.retired),
    stock: stockById.get(sku.id) ?? null, remaining: remaining[sku.id] ?? 0,
  }));
};

/**
 * 총 재고를 정한다(없으면 만든다). 카탈로그에 없는 SKU는 거절한다. DB 상품 SKU(`db-`)는 **잠긴 것만** 받는다 —
 * 승인 전·새로 더한 SKU의 재고를 먼저 넣어 두면 잠그는 순간 바로 팔리기 때문이다.
 */
export const setSkuStock = async (skuId: string, stock: number): Promise<{ ok: true } | { ok: false; message: string }> => {
  let product = SHOP_PRODUCTS.find((p) => p.skus.some((s) => s.id === skuId));
  if (!product && isDbSkuId(skuId)) {
    try {
      product = (await listDbSkusForAdmin()).find((x) => x.sku.id === skuId)?.product;
    } catch (error) {
      console.error('[shop] DB SKU 조회 실패(재고 설정)', error);
      return { ok: false, message: 'DB 상품 정보를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.' };
    }
  }
  if (!product) return { ok: false, message: '카탈로그에 없는 SKU예요.' };
  if (!Number.isInteger(stock) || stock < 0 || stock > 100000) return { ok: false, message: '재고는 0 이상의 정수로 적어 주세요.' };
  // 한정판(edition_size): 그 상품 SKU 총 재고 합이 한정 수량을 넘으면 번호가 모자란다.
  if (isDbSkuId(skuId)) {
    try {
      const [cap] = await getDb().all<{ edition_size: number | null; others: number }>(sql`
        SELECT p.edition_size AS edition_size,
               COALESCE((SELECT SUM(k.stock) FROM shop_skus k JOIN shop_product_skus o ON o.id = k.id
                         WHERE o.product_id = p.id AND k.id <> ${skuId}), 0) AS others
        FROM shop_product_skus s JOIN shop_products p ON p.id = s.product_id
        WHERE s.id = ${skuId}
      `);
      if (cap && cap.edition_size !== null) {
        const edition = Number(cap.edition_size);
        const others = Number(cap.others);
        if (others + stock > edition) {
          return { ok: false, message: `한정판 ${edition}장이에요. 다른 옵션 재고가 ${others}장이라 이 옵션은 ${Math.max(0, edition - others)}장까지만 넣을 수 있어요.` };
        }
      }
    } catch (error) {
      console.error('[shop] 한정 수량 확인 실패(재고 설정)', error);
      return { ok: false, message: '한정 수량을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.' };
    }
  }
  await getDb().run(sql`
    INSERT INTO shop_skus (id, product_slug, stock) VALUES (${skuId}, ${product.slug}, ${stock})
    ON CONFLICT(id) DO UPDATE SET stock = excluded.stock, updated_at = unixepoch()
  `);
  return { ok: true };
};

export interface AdminShopArtistSalesRow {
  artistSlug: string;
  artistName: string;
  taxType: 'withholding' | 'invoice' | null;
  quantity: number;
  /** 상품 판매가 합계(VAT 포함, 배송비 제외). */
  salesAmount: number;
  /** 등재 정보가 없으면(세금 유형을 모르면) null. */
  payout: ShopArtistPayout | null;
  /** 부분 환불된 주문 — 어느 줄이 환불됐는지 원장이 모르므로 운영자가 직접 본다. 정산액에 넣지 않았다. */
  needsReviewOrderNos: string[];
  /** 배송 없는 디지털 주문 중 아직 내려받지 않은(고객이 철회할 수 있는) 주문 수. 정산액에 넣지 않았다. */
  withdrawableOrderCount: number;
}

/**
 * 아티스트별 월 판매·정산 예정액(위탁 판매, 1단계는 운영자가 이 표를 보고 손으로 이체한다).
 *
 * 세는 것: 그 달(KST)에 **발송한** 결제 완료 주문의 아티스트 상품 줄. 발송 전 주문은 고객이 셀프 취소할 수 있어 세지 않는다.
 * **배송 없는 디지털 주문**(우편번호 `''`)은 발송이 없으므로 결제 승인 월(`payments.approved_at`)로 센다. 내려받기 전 주문은 고객이 철회할
 * 수 있어 정산에 넣지 않고 `withdrawableOrderCount`로만 알린다(정산 기록은 아직 없다).
 * 발송 뒤 반품 환불은 주문이 `refunded`가 되어 다음 조회부터 빠진다 — 이미 정산한 달이면 다음 정산에서 빼야 한다.
 * 아티스트는 SKU → 카탈로그 상품의 `artist`로 찾는다(판매 시작 뒤 바뀌지 않게 catalog.baseline이 막는다).
 */
export const listShopArtistSales = async (month: string): Promise<AdminShopArtistSalesRow[]> => {
  const range = kstMonthRange(month);
  if (!range) return [];
  const byArtist = new Map<string, { quantity: number; salesAmount: number; review: Set<string>; withdrawable: Set<string> }>();
  const add = (key: string, r: { order_no: string; status: string; unit_price: number; quantity: number }) => {
    const acc = byArtist.get(key) ?? { quantity: 0, salesAmount: 0, review: new Set<string>(), withdrawable: new Set<string>() };
    if (r.status === 'partially_refunded') acc.review.add(r.order_no);
    else {
      acc.quantity += Number(r.quantity);
      acc.salesAmount += Number(r.unit_price) * Number(r.quantity);
    }
    byArtist.set(key, acc);
  };

  // 파일 갈래 — 카탈로그 상품의 artist(data/artists slug). 키는 `file:<slug>`.
  const artistBySku = new Map(
    SHOP_PRODUCTS.flatMap((p) => (p.artist ? p.skus.map((s) => [s.id, p.artist as string] as const) : [])),
  );
  if (artistBySku.size > 0) {
    const rows = await getDb().all<{ order_no: string; status: string; sku_id: string; unit_price: number; quantity: number }>(sql`
      SELECT o.order_no, o.status, i.sku_id, i.unit_price, i.quantity
      FROM orders o
      JOIN shop_orders so ON so.order_no = o.order_no
      JOIN shop_order_items i ON i.order_no = o.order_no
      WHERE o.type = 'merch' AND o.status IN ('paid', 'partially_refunded')
        AND so.fulfillment_status IN ('shipped', 'delivered') AND so.postcode <> ''
        AND so.shipped_at >= ${range.from} AND so.shipped_at < ${range.to}
    `);
    for (const r of rows) {
      const slug = artistBySku.get(r.sku_id);
      if (slug) add(`file:${slug}`, r);
    }
  }

  // DB 갈래 — sku_id → shop_product_skus → shop_products.creator_id. 키는 `creator:<id>`. **별도 try**: 표가 없는 DB에서도
  // 파일 상품 정산 표는 그대로 나와야 한다. 실패는 로그만 남기고 그 갈래를 건너뛴다(운영자는 /admin/shop 오류 안내로 안다).
  const creatorInfo = new Map<string, { name: string; taxType: 'withholding' | 'invoice' | null }>();
  try {
    const rows = await getDb().all<{
      order_no: string; status: string; unit_price: number; quantity: number; creator_id: string; name: string; tax_type: string | null;
    }>(sql`
      SELECT o.order_no, o.status, i.unit_price, i.quantity, p.creator_id AS creator_id, c.name AS name, c.tax_type AS tax_type
      FROM orders o
      JOIN shop_orders so ON so.order_no = o.order_no
      JOIN shop_order_items i ON i.order_no = o.order_no
      JOIN shop_product_skus ps ON ps.id = i.sku_id
      JOIN shop_products p ON p.id = ps.product_id
      JOIN funding_creators c ON c.id = p.creator_id
      WHERE i.sku_id LIKE 'db-%'
        AND o.type = 'merch' AND o.status IN ('paid', 'partially_refunded')
        AND so.fulfillment_status IN ('shipped', 'delivered') AND so.postcode <> ''
        AND so.shipped_at >= ${range.from} AND so.shipped_at < ${range.to}
    `);
    const note = (r: { creator_id: string; name: string; tax_type: string | null }): string => {
      const key = `creator:${r.creator_id}`;
      creatorInfo.set(key, { name: r.name, taxType: r.tax_type === 'withholding' || r.tax_type === 'invoice' ? r.tax_type : null });
      return key;
    };
    for (const r of rows) add(note(r), r);

    // 배송 없는 디지털 주문 — 결제 승인 월로 센다. 내려받은 주문만 판매로 세고, 아직인 주문은 "철회 가능"으로만 알린다.
    const digitalRows = await getDb().all<{
      order_no: string; status: string; unit_price: number; quantity: number; creator_id: string; name: string; tax_type: string | null; downloaded: number;
    }>(sql`
      SELECT o.order_no, o.status, i.unit_price, i.quantity, p.creator_id AS creator_id, c.name AS name, c.tax_type AS tax_type,
             EXISTS (SELECT 1 FROM shop_order_downloads d WHERE d.order_no = o.order_no) AS downloaded
      FROM orders o
      JOIN shop_orders so ON so.order_no = o.order_no
      JOIN shop_order_items i ON i.order_no = o.order_no
      JOIN shop_product_skus ps ON ps.id = i.sku_id
      JOIN shop_products p ON p.id = ps.product_id
      JOIN funding_creators c ON c.id = p.creator_id
      WHERE i.sku_id LIKE 'db-%'
        AND o.type = 'merch' AND o.status IN ('paid', 'partially_refunded')
        AND so.fulfillment_status <> 'cancelled' AND so.postcode = ''
        AND (SELECT MIN(pay.approved_at) FROM payments pay WHERE pay.order_id = o.id) >= ${range.from}
        AND (SELECT MIN(pay.approved_at) FROM payments pay WHERE pay.order_id = o.id) < ${range.to}
    `);
    for (const r of digitalRows) {
      const key = note(r);
      if (Number(r.downloaded) > 0) add(key, r);
      else {
        const acc = byArtist.get(key) ?? { quantity: 0, salesAmount: 0, review: new Set<string>(), withdrawable: new Set<string>() };
        acc.withdrawable.add(r.order_no);
        byArtist.set(key, acc);
      }
    }
  } catch (error) {
    console.error('[shop] 아티스트 정산(DB 상품) 조회 실패 — 파일 상품만 표시합니다:', error);
  }

  return [...byArtist.entries()]
    .map(([key, acc]) => {
      const creator = creatorInfo.get(key);
      const artist = key.startsWith('file:') ? getSupportedArtist(key.slice('file:'.length)) : null;
      const taxType = creator ? creator.taxType : (artist?.taxType ?? null);
      return {
        artistSlug: key,
        artistName: creator?.name ?? artist?.name ?? key.slice(key.indexOf(':') + 1),
        taxType,
        quantity: acc.quantity,
        salesAmount: acc.salesAmount,
        payout: taxType ? computeShopArtistPayout({ salesAmount: acc.salesAmount, refundAmount: 0, taxType }) : null,
        needsReviewOrderNos: [...acc.review].sort(),
        withdrawableOrderCount: acc.withdrawable.size,
      };
    })
    .sort((a, b) => a.artistName.localeCompare(b.artistName, 'ko'));
};
