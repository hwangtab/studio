import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { kstDateString } from '../booking/kst';
import type { RevenueRow } from './revenueReport';

/**
 * 프로듀싱 레슨 매출 — 두 갈래를 한 유형(`lesson`)으로 모은다.
 *
 * ① **계좌·현금 수납**(`lesson_payments`) — 결제 행이 없어 매출에서 통째로 빠져 있었다(수기 매출에 유형을 골라 적던 것). 수납일(KST 0시) 기준,
 *    부가세는 적은 값 그대로(현금·계좌는 부가세를 받지 않으면 0 — 기존 안내와 같다). 이름은 싣지 않고 기간 표기만.
 * ② **카드 정기결제**(구독 결제의 `orders`) — 이미 결제 행으로 매출에 잡히지만 유형이 `구독`이라 연습실·아티스트 후원과 섞인다.
 *    레슨 구독의 주문만 `lesson`으로 옮긴다(`reclassifyLessonSubscriptions`) — 금액은 그대로라 합계는 변하지 않는다.
 * 표가 없는 DB에서는 ①의 읽기가 던진다(호출부가 알린다), ②는 못 읽으면 그대로 둔다(숫자를 지어내지 않는다).
 */
export const loadLessonRevenueRows = async (range: { from: Date; toExclusive: Date }): Promise<RevenueRow[]> => {
  const from = kstDateString(range.from);
  const to = kstDateString(range.toExclusive);
  const rows = await getDb().all<{ id: string; paid_on: string; amount: number; vat_amount: number; period_label: string; method: string }>(sql`
    SELECT id, paid_on, amount, vat_amount, period_label, method FROM lesson_payments
    WHERE deleted_at IS NULL AND paid_on >= ${from} AND paid_on < ${to} AND amount > 0
    ORDER BY paid_on
  `);
  return rows.map((r) => ({
    at: new Date(new Date(`${r.paid_on}T00:00:00Z`).getTime() - 9 * 60 * 60 * 1000),
    orderNo: `레슨 ${r.period_label}`,
    type: 'lesson',
    projectSlug: null,
    method: r.method,
    gross: Number(r.amount),
    vat: Number(r.vat_amount),
    refunded: 0,
    offline: true,
  }));
};

export const reclassifyLessonSubscriptions = async (rows: RevenueRow[]): Promise<RevenueRow[]> => {
  const subscriptionNos = rows.filter((r) => r.type === 'subscription').map((r) => r.orderNo);
  if (subscriptionNos.length === 0) return rows;
  try {
    const found = await getDb().all<{ order_no: string }>(sql`
      SELECT DISTINCT o.order_no AS order_no
      FROM subscription_payments sp
      JOIN orders o ON o.id = sp.order_id
      JOIN subscriptions s ON s.id = sp.subscription_id
      WHERE s.kind = 'lesson' AND o.order_no IN (${sql.join(subscriptionNos.map((n) => sql`${n}`), sql`, `)})
    `);
    const lessonNos = new Set(found.map((f) => f.order_no));
    return rows.map((r) => (r.type === 'subscription' && lessonNos.has(r.orderNo) ? { ...r, type: 'lesson' } : r));
  } catch (error) {
    console.error('[revenue] 레슨 구독 분류 조회 실패 — 구독으로 둡니다:', error instanceof Error ? error.message : String(error));
    return rows;
  }
};
