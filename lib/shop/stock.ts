import { sql, type SQL } from 'drizzle-orm';

import { isDbSkuId } from './productRules';

/**
 * 상점 재고 판정 — **재고는 계산값이다.** `shop_skus.stock`(지금까지 내놓은 총수량)에서 아래 "점유" 수량을 뺀다.
 * 재고를 차감·복원하는 쓰기가 없으므로, 환불·만료·자동 취소가 같은 주문에 겹쳐도 재고가 두 번 돌아오지 않는다
 * (설계 문서 §8-6이 걱정한 사고가 구조적으로 생기지 않는다).
 *
 * 점유로 세는 주문:
 * - `paid`·`partially_refunded` — 팔린 것.
 * - `auto_cancel_pending` — 승인 뒤 자동 취소 중. 끝나면 `refunded`가 되어 풀린다. 그 사이 다른 사람에게 팔지 않는다.
 * - `awaiting_deposit` — 계좌로 직접 입금을 신청하고 운영자가 입금을 확인하기 전(2026-10-14 도입). **기한 없이** 점유한다(자동 취소가
 *   없다 — 입금한 사람에게 "취소됨"이 가는 사고를 막으려는 규칙, lib/payments/bankDeposit.ts). 닫는 길은 운영자 "미입금 취소"와
 *   고객 "입금 전 신청 취소"(`deposit_cancelled`)뿐이고, 그러면 점유에서 빠진다.
 * - `pending`이고 홀드가 아직 안 끝난 것 — 결제창을 연 사람. 홀드가 지나면 상태와 무관하게 풀린다(공연 좌석과 같은 규칙).
 *
 * 세지 않는 것: `refunded`(취소·환불 — 재고로 돌아온다), `expired`·`failed`. **발송 뒤 반품 환불도 재고로 돌아온다** —
 * 되팔 수 없는 상태면 운영자가 관리자 화면에서 총수량을 줄인다.
 *
 * ── 한정판(`edition_size`가 있는 DB 상품)의 상한 ──
 * 발송 뒤 반품 환불은 재고로 돌아오지만 **번호는 반납하지 않는다**(이미 나간 물건의 번호다). 그래서 재고 계산만으로 팔면 번호 없는
 * 확정이 생긴다. 판매 가능 수량을 상품 단위로 한 번 더 자른다:
 *   남은 번호 = edition_size − 이미 부여된 번호 수 − 점유 중인 줄이 아직 받지 못한 번호 수(수량 − 그 줄에 붙은 번호)
 * 화면(`remainingStockSql`)·생성 게이트(`editionGateSql`)·확정 게이트(같은 함수 + excludeOrderNo)가 같은 식을 쓴다.
 * `db-` SKU가 있을 때만 이 식이 붙는다(파일 상품만 다루는 문장은 새 표를 읽지 않는다 — 0053 전 DB에서도 돈다).
 */

/** "이 주문 줄이 재고를 점유하는가" — 아래 두 집계가 같은 판정을 쓴다(한쪽만 고치면 화면과 결제가 갈린다). */
const occupyingCondition = (now: Date): SQL => sql`(
  o.status IN ('paid', 'partially_refunded', 'auto_cancel_pending', 'awaiting_deposit')
  OR (o.status = 'pending' AND so.hold_expires_at > ${Math.floor(now.getTime() / 1000)})
)`;

const occupiedSum = (skuRef: SQL, now: Date, excludeOrderNo?: string): SQL => sql`COALESCE((
  SELECT SUM(i.quantity) FROM shop_order_items i
  JOIN orders o ON o.order_no = i.order_no
  JOIN shop_orders so ON so.order_no = i.order_no
  WHERE i.sku_id = ${skuRef} AND ${occupyingCondition(now)}
  ${excludeOrderNo ? sql`AND i.order_no <> ${excludeOrderNo}` : sql``}
), 0)`;

/**
 * 재고 게이트 — 남은 수량이 요청 수량 이상일 때만 참. `shop_skus` 행이 없으면(재고를 아직 안 넣은 SKU) NULL이라
 * 거짓이다(품절). INSERT … SELECT … WHERE에 그대로 끼워 쓴다(사전 SELECT 후 INSERT는 경합에서 초과 판매한다).
 * excludeOrderNo는 확정 단계에서 "나를 뺀 나머지"를 셀 때 쓴다.
 */
export const stockGateSql = (skuId: string, quantity: number, now: Date, excludeOrderNo?: string): SQL =>
  sql`((SELECT k.stock FROM shop_skus k WHERE k.id = ${skuId}) - ${occupiedSum(sql`${skuId}`, now, excludeOrderNo)}) >= ${quantity}`;

/**
 * 한정판 상품의 남은 번호 수(위 식). 한정판이 아니면 NULL. `skuRef`는 그 상품의 아무 SKU id.
 * excludeOrderNo는 확정 단계에서 "나를 뺀 나머지"를 셀 때 쓴다(내 주문 줄은 점유에서도, 번호 수에서도 뺀다).
 */
const editionRemainingSql = (skuRef: SQL, now: Date, excludeOrderNo?: string): SQL => sql`(
  SELECT p.edition_size
    - (SELECT COUNT(*) FROM shop_serials s WHERE s.product_id = p.id
       ${excludeOrderNo ? sql`AND s.order_no <> ${excludeOrderNo}` : sql``})
    - COALESCE((
        SELECT SUM(MAX(0, i.quantity - (SELECT COUNT(*) FROM shop_serials s2 WHERE s2.order_item_id = i.id)))
        FROM shop_order_items i
        JOIN orders o ON o.order_no = i.order_no
        JOIN shop_orders so ON so.order_no = i.order_no
        JOIN shop_product_skus x ON x.id = i.sku_id
        WHERE x.product_id = p.id AND ${occupyingCondition(now)}
        ${excludeOrderNo ? sql`AND i.order_no <> ${excludeOrderNo}` : sql``}
      ), 0)
  FROM shop_product_skus ps JOIN shop_products p ON p.id = ps.product_id
  WHERE ps.id = ${skuRef} AND p.edition_size IS NOT NULL
)`;

/**
 * 한정판 게이트 — 한 주문이 같은 한정판 상품에서 담은 수량(옵션 합) `quantity`가 남은 번호 수 이하일 때만 참. 한정판이 아니면 참.
 * 줄 묶음은 호출부가 상품별로 합쳐 넘긴다(`editionGates`). 재고 게이트(`stockGateSql`)와 AND로 같은 WHERE에 건다.
 */
export const editionGateSql = (skuId: string, quantity: number, now: Date, excludeOrderNo?: string): SQL =>
  sql`COALESCE(${editionRemainingSql(sql`${skuId}`, now, excludeOrderNo)}, ${quantity}) >= ${quantity}`;

/** 줄들을 상품별로 묶어 한정판 게이트를 만든다(`db-` 줄만). 없으면 빈 배열. `productKey`는 같은 상품이면 같은 값(상품 slug). */
export const editionGates = (
  lines: ReadonlyArray<{ skuId: string; quantity: number; productKey: string }>,
  now: Date,
  excludeOrderNo?: string,
): SQL[] => {
  const byProduct = new Map<string, { skuId: string; quantity: number }>();
  for (const l of lines) {
    if (!isDbSkuId(l.skuId)) continue;
    const cur = byProduct.get(l.productKey);
    byProduct.set(l.productKey, { skuId: cur?.skuId ?? l.skuId, quantity: (cur?.quantity ?? 0) + l.quantity });
  }
  return [...byProduct.values()].map((g) => editionGateSql(g.skuId, g.quantity, now, excludeOrderNo));
};

/** 화면용 남은 수량 조회 — 행마다 { id, remaining }. `shop_skus` 행이 없는 SKU는 결과에 없다(호출부가 0으로 본다). */
export const remainingStockSql = (skuIds: readonly string[], now: Date): SQL => {
  const stockLeft = sql`k.stock - ${occupiedSum(sql`k.id`, now)}`;
  // 한정판은 남은 번호 수로 한 번 더 자른다 — `db-` SKU가 있을 때만(파일 상품만이면 새 표를 읽지 않는다).
  const left = skuIds.some(isDbSkuId) ? sql`MIN(${stockLeft}, COALESCE(${editionRemainingSql(sql`k.id`, now)}, ${stockLeft}))` : stockLeft;
  return sql`SELECT k.id AS id, MAX(0, ${left}) AS remaining
    FROM shop_skus k
    WHERE k.id IN (${sql.join(skuIds.map((id) => sql`${id}`), sql`, `)})`;
};
