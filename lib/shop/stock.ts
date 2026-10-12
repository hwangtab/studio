import { sql, type SQL } from 'drizzle-orm';

/**
 * 상점 재고 판정 — **재고는 계산값이다.** `shop_skus.stock`(지금까지 내놓은 총수량)에서 아래 "점유" 수량을 뺀다.
 * 재고를 차감·복원하는 쓰기가 없으므로, 환불·만료·자동 취소가 같은 주문에 겹쳐도 재고가 두 번 돌아오지 않는다
 * (설계 문서 §8-6이 걱정한 사고가 구조적으로 생기지 않는다).
 *
 * 점유로 세는 주문:
 * - `paid`·`partially_refunded` — 팔린 것.
 * - `auto_cancel_pending` — 승인 뒤 자동 취소 중. 끝나면 `refunded`가 되어 풀린다. 그 사이 다른 사람에게 팔지 않는다.
 * - `pending`이고 홀드가 아직 안 끝난 것 — 결제창을 연 사람. 홀드가 지나면 상태와 무관하게 풀린다(공연 좌석과 같은 규칙).
 *
 * 세지 않는 것: `refunded`(취소·환불 — 재고로 돌아온다), `expired`·`failed`. **발송 뒤 반품 환불도 재고로 돌아온다** —
 * 되팔 수 없는 상태면 운영자가 관리자 화면에서 총수량을 줄인다.
 *
 * 계좌 입금(`awaiting_deposit`)은 상점에 없다 — 결제수단은 전부 토스다(운영자 결정 2026-10-12).
 */

/** "이 주문 줄이 재고를 점유하는가" — 아래 두 집계가 같은 판정을 쓴다(한쪽만 고치면 화면과 결제가 갈린다). */
const occupyingCondition = (now: Date): SQL => sql`(
  o.status IN ('paid', 'partially_refunded', 'auto_cancel_pending')
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

/** 화면용 남은 수량 조회 — 행마다 { id, remaining }. `shop_skus` 행이 없는 SKU는 결과에 없다(호출부가 0으로 본다). */
export const remainingStockSql = (skuIds: readonly string[], now: Date): SQL =>
  sql`SELECT k.id AS id, MAX(0, k.stock - ${occupiedSum(sql`k.id`, now)}) AS remaining
    FROM shop_skus k
    WHERE k.id IN (${sql.join(skuIds.map((id) => sql`${id}`), sql`, `)})`;
