import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { consumeRateLimit } from '../booking/rate-limit';
import { adminUrl, buildEmailLayout } from '../email/layout';
import { sendEmail } from '../email/resend';
import { OPERATOR_EMAIL } from '../operatorContact';
import { parseDigitalFiles, salesDigitalFiles } from './adminProducts';
import { DB_SKU_PREFIX, isDbSkuId } from './productRules';
import { rowsAffectedOf } from './service';

/**
 * 디지털 상품 내려받기 — 목록과 **첫 기록**.
 *
 * 목록은 주문 줄의 SKU → DB 상품의 `digital_files`다. 화면에는 `label`과 순번(`index`)만 나가고 R2 키는 서버만 안다.
 * 기록(`shop_order_downloads`)은 청약철회 제한의 근거다 — 고객 취소(lib/shop/cancel.ts)가 이 행이 있으면 막는다.
 * 설계: docs/shop-artist-platform-design-2026-10.md §6.
 */

export interface OrderDownloadFile {
  /** 주문 안의 순번(0부터). 상품 순서(주문 줄 순) × 파일 순서. */
  index: number;
  label: string;
  /** R2 키 — 서버 전용. 화면 props에 싣지 않는다. */
  key: string;
}

/** 그 주문 줄에 든 디지털 상품(`kind='digital'`)의 내려받기 파일. 표가 없거나 `db-` 줄이 없으면 빈 목록. */
export const loadOrderDownloadFiles = async (orderNo: string, items: ReadonlyArray<{ skuId: string }>): Promise<OrderDownloadFile[]> => {
  if (!items.some((i) => isDbSkuId(i.skuId))) return [];
  const rows = await getDb().all<{ product_id: string; digital_files: string | null }>(sql`
    SELECT p.id AS product_id, p.digital_files AS digital_files
    FROM shop_order_items i
    JOIN shop_product_skus k ON k.id = i.sku_id
    JOIN shop_products p ON p.id = k.product_id
    WHERE i.order_no = ${orderNo} AND i.sku_id LIKE ${`${DB_SKU_PREFIX}%`} AND p.kind = 'digital' AND p.digital_files IS NOT NULL
    ORDER BY i.id
  `);
  const seen = new Set<string>();
  const out: OrderDownloadFile[] = [];
  for (const r of rows) {
    if (seen.has(r.product_id)) continue;
    seen.add(r.product_id);
    // 미리듣기 파일은 판매 파일이 아니다 — 구매자 내려받기 목록에 넣지 않는다.
    for (const f of salesDigitalFiles(parseDigitalFiles(r.digital_files))) out.push({ index: out.length, label: f.label, key: f.key });
  }
  return out;
};

/** 이 주문에 디지털 상품 줄이 있는가(파일이 아직 없어도 true). 표가 없으면 던진다 — 호출부가 삼킨다. */
export const orderHasDigitalLines = async (orderNo: string, items: ReadonlyArray<{ skuId: string }>): Promise<boolean> => {
  if (!items.some((i) => isDbSkuId(i.skuId))) return false;
  const [row] = await getDb().all<{ n: number }>(sql`
    SELECT COUNT(*) AS n
    FROM shop_order_items i
    JOIN shop_product_skus k ON k.id = i.sku_id
    JOIN shop_products p ON p.id = k.product_id
    WHERE i.order_no = ${orderNo} AND i.sku_id LIKE ${`${DB_SKU_PREFIX}%`} AND p.kind = 'digital'
  `);
  return Number(row?.n ?? 0) > 0;
};

/** 첫 내려받기 시각(초). 기록이 없으면 null. 표가 없으면 던진다. */
export const getFirstDownloadedAt = async (orderNo: string): Promise<number | null> => {
  const [row] = await getDb().all<{ t: number }>(sql`SELECT first_downloaded_at AS t FROM shop_order_downloads WHERE order_no = ${orderNo}`);
  return row ? Number(row.t) : null;
};

/** 내려받기를 내줄 수 있는 주문의 조건 — 결제 살아 있음 + 발송 상태가 취소 아님. 기록 문장과 확인 문장이 같은 조건을 쓴다. */
const liveOrderSql = (orderNo: string) => sql`
  EXISTS (
    SELECT 1 FROM orders o JOIN shop_orders so ON so.order_no = o.order_no
    WHERE o.order_no = ${orderNo} AND o.type = 'merch' AND o.status IN ('paid', 'partially_refunded')
      AND so.fulfillment_status <> 'cancelled'
  )`;

/**
 * 첫 내려받기를 기록한다. 주문이 **그 순간** 살아 있을 때만 행이 생기고(`INSERT … SELECT … WHERE EXISTS`), 이미 있으면 그대로 둔다
 * (판정 기준은 "언제 시작했는가"이지 "마지막으로 언제 받았는가"가 아니다). 같은 묶음에서 디지털만 주문(우편번호 `''`)은 `delivered`로 닫는다.
 *
 * 돌려주는 값: true = 기록이 있고 주문이 아직 살아 있다(내줘도 된다), false = 주문이 살아 있지 않다(취소가 먼저였다).
 * 고객 취소의 선점 UPDATE가 `NOT EXISTS(shop_order_downloads)`를 걸어 두므로, 둘이 겹치면 어느 쪽이 먼저든 다른 쪽은 0행이다.
 */
export const recordFirstDownload = async (orderNo: string): Promise<boolean> => {
  const db = getDb();
  const results = await db.batch([
    db.run(sql`
      INSERT INTO shop_order_downloads (order_no, first_downloaded_at)
      SELECT ${orderNo}, unixepoch()
      WHERE ${liveOrderSql(orderNo)}
      ON CONFLICT(order_no) DO NOTHING
    `),
    db.run(sql`
      UPDATE shop_orders
      SET fulfillment_status = 'delivered', shipped_at = COALESCE(shipped_at, unixepoch()),
          delivered_at = COALESCE(delivered_at, unixepoch()), updated_at = unixepoch()
      WHERE order_no = ${orderNo} AND postcode = '' AND fulfillment_status = 'preparing'
        AND EXISTS (SELECT 1 FROM shop_order_downloads WHERE order_no = ${orderNo})
        AND ${liveOrderSql(orderNo)}
    `),
  ]);
  if (rowsAffectedOf(results[0]) > 0) return true;
  // 이미 기록된 주문(두 번째 내려받기) — 행이 있고 주문이 아직 살아 있어야 한다. 행만 보면 환불된 주문에도 통과한다.
  const [row] = await db.all<{ ok: number }>(sql`
    SELECT 1 AS ok FROM shop_order_downloads WHERE order_no = ${orderNo} AND ${liveOrderSql(orderNo)}
  `);
  return Boolean(row);
};

/** 저장소에 파일이 없을 때 운영자에게 — 같은 키 하루 한 번. 던지지 않는다. */
export const alertMissingShopFile = async (input: { key: string; orderNo: string }): Promise<void> => {
  try {
    console.error('[shop-download] 저장소에 객체가 없다', input);
    if (!(await consumeRateLimit(`shop_download_missing:${input.key}`, 1, 24 * 60 * 60))) return;
    const html = buildEmailLayout({
      audience: 'operator',
      noticeTone: 'alert',
      heading: '상점 내려받기 파일이 없어요',
      rows: [{ label: '키', value: input.key }, { label: '주문', value: input.orderNo }],
      notices: [
        'R2 버킷에 그 키로 파일이 올라가 있는지 확인하세요. 키가 바뀐 것이라면 상품 심사 화면에서 파일 키를 고치세요.',
        '고객에게는 안내 문구가 나갔고 내려받기 기록은 남기지 않았어요. 이 메일은 같은 키에 하루 한 번만 와요.',
      ],
      cta: { label: '관리자에서 보기', url: adminUrl(`/admin/shop/${input.orderNo}`) },
    });
    await sendEmail({
      to: OPERATOR_EMAIL,
      subject: `[Studio NOL] 상점 내려받기 파일 없음 — ${input.key}`,
      text: `상점 내려받기를 눌렀는데 저장소에 객체가 없어요.\n키: ${input.key}\n주문: ${input.orderNo}\n내려받기 기록은 남기지 않았어요.`,
      html,
    });
  } catch (error: unknown) {
    console.error('[shop-download] 파일 부재 알림 실패:', error);
  }
};
