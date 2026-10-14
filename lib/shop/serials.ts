import { sql, type SQL } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { buildOperatorAlertHtml } from '../email/operatorAlert';
import { adminUrl } from '../email/layout';
import { sendEmail } from '../email/resend';
import { OPERATOR_EMAIL } from '../operatorContact';
import { isDbSkuId } from './productRules';

/**
 * 한정판 일련번호 — 설계 docs/shop-artist-platform-design-2026-10.md §6.
 *
 * 확정 배치(lib/shop/confirm.ts)에서 `orders.status = 'paid'` UPDATE **뒤에** 줄 수량만큼 INSERT한다(같은 트랜잭션 —
 * 재고 게이트가 0행이면 `EXISTS(paid)`도 거짓이라 번호도 0행). 결번 중 가장 작은 번호를 붙인다.
 * **`db-` SKU 줄에만** 만든다 — 파일 상품 주문은 새 표(shop_serials)를 건드리지 않는다(마이그레이션 0053 전 DB에서도 확정이 된다).
 *
 * 빈 번호가 없으면 INSERT는 0행으로 끝나고 확정은 성공한다 — NOT NULL 위반으로 배치가 실패하면 돈만 들어온 주문이 된다.
 * 대신 확정 뒤 개수를 세어 모자라면 운영자에게 알린다.
 */

export interface SerialOrderLine { id: string; skuId: string; quantity: number }

export const hasDbSkuLine = (items: ReadonlyArray<{ skuId: string }>): boolean => items.some((i) => isDbSkuId(i.skuId));

/** 한 줄에 번호 하나를 붙이는 INSERT. 수량만큼 반복해서 넣는다 — 문장마다 "아직 수량보다 적을 때만" 한 개씩 붙인다. */
const serialInsertSql = (order: { id: string; orderNo: string }, line: SerialOrderLine): SQL => sql`
  WITH RECURSIVE seq(n) AS (
    SELECT 1 UNION ALL SELECT n + 1 FROM seq
    WHERE n < (SELECT p.edition_size FROM shop_products p JOIN shop_product_skus k ON k.product_id = p.id WHERE k.id = ${line.skuId}))
  INSERT INTO shop_serials (product_id, serial, order_no, order_item_id)
  SELECT k.product_id,
         (SELECT MIN(n) FROM seq WHERE n NOT IN (SELECT serial FROM shop_serials WHERE product_id = k.product_id)),
         ${order.orderNo}, ${line.id}
  FROM shop_product_skus k JOIN shop_products p ON p.id = k.product_id
  WHERE k.id = ${line.skuId} AND p.edition_size IS NOT NULL
    AND EXISTS (SELECT 1 FROM orders WHERE id = ${order.id} AND status = 'paid')
    AND (SELECT COUNT(*) FROM shop_serials WHERE order_item_id = ${line.id}) < ${line.quantity}
    AND (SELECT MIN(n) FROM seq WHERE n NOT IN (SELECT serial FROM shop_serials WHERE product_id = k.product_id)) IS NOT NULL
`;

/** 확정 배치 뒤에 붙일 문장들. `db-` 줄이 없으면 빈 배열이다. */
export const serialInsertStatements = (order: { id: string; orderNo: string }, items: readonly SerialOrderLine[]): SQL[] =>
  items.filter((i) => isDbSkuId(i.skuId)).flatMap((line) => Array.from({ length: line.quantity }, () => serialInsertSql(order, line)));

export interface OrderSerial { itemId: string; serial: number; editionSize: number }

/** 그 주문에 붙은 번호(줄 id별). 오류는 삼키고 빈 맵 — 화면·메일이 번호 때문에 깨지지 않게. */
export const loadOrderSerials = async (orderNo: string, items: ReadonlyArray<{ skuId: string }>): Promise<Map<string, OrderSerial[]>> => {
  const out = new Map<string, OrderSerial[]>();
  if (!hasDbSkuLine(items)) return out;
  try {
    const rows = await getDb().all<{ order_item_id: string; serial: number; edition_size: number | null }>(sql`
      SELECT s.order_item_id, s.serial, p.edition_size
      FROM shop_serials s JOIN shop_products p ON p.id = s.product_id
      WHERE s.order_no = ${orderNo}
      ORDER BY s.serial
    `);
    for (const r of rows) {
      const list = out.get(r.order_item_id) ?? [];
      list.push({ itemId: r.order_item_id, serial: Number(r.serial), editionSize: Number(r.edition_size ?? 0) });
      out.set(r.order_item_id, list);
    }
  } catch (error) {
    console.error('[shop-serials] 번호 조회 실패', { orderNo, error });
  }
  return out;
};

/** "7/100, 8/100" */
export const formatSerials = (serials: readonly OrderSerial[] | undefined): string | null =>
  serials && serials.length > 0 ? serials.map((s) => `${s.serial}/${s.editionSize}`).join(', ') : null;

/** 번호를 반납한다(발송 전 전액 취소). `db-` 줄이 있을 때만, 실패는 로그 — 환불은 성공을 유지한다. */
export const releaseOrderSerials = async (orderNo: string, items: ReadonlyArray<{ skuId: string }>): Promise<void> => {
  if (!hasDbSkuLine(items)) return;
  await deleteOrderSerials(orderNo);
};

/** 호출부가 이미 `db-` 줄이 있음을 확인했을 때(웹훅 — 주문 줄을 따로 읽는다). */
export const deleteOrderSerials = async (orderNo: string): Promise<void> => {
  try {
    await getDb().run(sql`DELETE FROM shop_serials WHERE order_no = ${orderNo}`);
  } catch (error) {
    console.error('[shop-serials] 번호 반납 실패 — 수동 확인 필요', { orderNo, error });
  }
};

/** 확정 뒤 — 번호 수가 기대 수량보다 적으면 운영자에게 알린다. 확정 결과는 바꾸지 않는다. */
export const alertIfSerialsMissing = async (orderNo: string, items: ReadonlyArray<{ skuId: string }>): Promise<void> => {
  if (!hasDbSkuLine(items)) return;
  try {
    const [row] = await getDb().all<{ expected: number | null; actual: number }>(sql`
      SELECT
        (SELECT COALESCE(SUM(i.quantity), 0) FROM shop_order_items i
           JOIN shop_product_skus k ON k.id = i.sku_id JOIN shop_products p ON p.id = k.product_id
           WHERE i.order_no = ${orderNo} AND p.edition_size IS NOT NULL) AS expected,
        (SELECT COUNT(*) FROM shop_serials WHERE order_no = ${orderNo}) AS actual
    `);
    const expected = Number(row?.expected ?? 0);
    const actual = Number(row?.actual ?? 0);
    if (actual >= expected) return;
    console.error('[shop-serials] 한정판 번호 부족 — 운영자 확인 필요', { orderNo, expected, actual });
    const title = '한정판 번호가 모자라요';
    const html = buildOperatorAlertHtml({
      title,
      cron: 'shop/confirm',
      summary: `주문 ${orderNo}은 결제가 확정됐지만 한정판 번호가 ${expected}개 중 ${actual}개만 붙었어요. 한정 수량이 이미 다 나간 상태예요.`,
      hints: ['재고 합계가 한정 수량을 넘지 않았는지 확인하고, 모자란 번호는 고객에게 직접 안내해 주세요.'],
      rows: [{ label: '주문번호', value: orderNo }, { label: '번호', value: `${actual} / ${expected}` }],
      ctaLabel: '관리자에서 보기',
      ctaUrl: adminUrl(`/admin/shop/${orderNo}`),
    });
    await sendEmail({
      to: OPERATOR_EMAIL,
      subject: `[상점] ${title} — ${orderNo}`,
      text: `${title}\n주문 ${orderNo}: 번호 ${actual}/${expected}\n${adminUrl(`/admin/shop/${orderNo}`)}`,
      html,
    });
  } catch (error) {
    console.error('[shop-serials] 번호 점검 실패', { orderNo, error });
  }
};
