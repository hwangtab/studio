import { and, desc, eq, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { partnerPayouts, type PartnerPayout } from '../../db/schema';
import type { PartnerPayoutKind } from './adjustments';

/**
 * 정산 기록 표(`partner_payouts`)의 종류와 무관한 읽기·상태 전이 — 상점(P1)과 공연(P2)이 같이 쓴다.
 * 표가 없으면(마이그레이션 전) 전부 던진다. 화면·API는 `isMissingTableError`로 "표 미적용" 안내를 띄우고, 대시보드는 0으로 삼킨다.
 */

export const findPartnerPayout = async (kind: PartnerPayoutKind, subjectKey: string, period: string): Promise<PartnerPayout | null> => {
  const [row] = await getDb()
    .select()
    .from(partnerPayouts)
    .where(and(eq(partnerPayouts.kind, kind), eq(partnerPayouts.subjectKey, subjectKey), eq(partnerPayouts.period, period)))
    .limit(1);
  return row ?? null;
};

export const getPartnerPayoutById = async (id: string): Promise<PartnerPayout | null> => {
  const [row] = await getDb().select().from(partnerPayouts).where(eq(partnerPayouts.id, id)).limit(1);
  return row ?? null;
};

/** 한 종류의 기록들 — 기간(상점은 달)을 주면 그 기간만. */
export const listPartnerPayouts = async (kind: PartnerPayoutKind, period?: string): Promise<PartnerPayout[]> =>
  getDb()
    .select()
    .from(partnerPayouts)
    .where(period ? and(eq(partnerPayouts.kind, kind), eq(partnerPayouts.period, period)) : eq(partnerPayouts.kind, kind))
    .orderBy(desc(partnerPayouts.period), desc(partnerPayouts.createdAt));

/** 기록됐지만 아직 이체하지 않은 정산 건수 — 대시보드 "이체 대기". */
export const countPendingPartnerPayouts = async (kind: PartnerPayoutKind): Promise<number> => {
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(partnerPayouts)
    .where(and(eq(partnerPayouts.kind, kind), eq(partnerPayouts.status, 'pending')));
  return Number(row?.count ?? 0);
};

/** 운영자가 이체를 마친 뒤 누른다. pending → paid 한 방향이고 되돌리지 않는다(조건부 UPDATE — 두 번 눌러도 한 번만). */
export const markPartnerPayoutPaid = async (id: string, memo: string | null, now: Date): Promise<boolean> => {
  const result = await getDb()
    .update(partnerPayouts)
    .set({ status: 'paid', paidAt: now, memo, updatedAt: now })
    .where(and(eq(partnerPayouts.id, id), eq(partnerPayouts.status, 'pending')))
    .returning({ id: partnerPayouts.id });
  return result.length > 0;
};

/**
 * 지급을 마친(paid) 기록의 메모 끝에 한 줄을 덧붙인다(조건부 UPDATE — 한 문장이라 동시에 눌러도 서로의 줄을 덮지 않는다).
 * 금액·상태는 건드리지 않는다. 공연 정산의 「회수 처리」 줄이 쓴다(`showOverpayment.ts`). pending이면 false.
 */
export const appendPartnerPayoutMemoIfPaid = async (id: string, line: string, now: Date): Promise<boolean> => {
  const result = await getDb()
    .update(partnerPayouts)
    .set({ memo: sql`CASE WHEN ${partnerPayouts.memo} IS NULL OR ${partnerPayouts.memo} = '' THEN ${line} ELSE ${partnerPayouts.memo} || char(10) || ${line} END`, updatedAt: now })
    .where(and(eq(partnerPayouts.id, id), eq(partnerPayouts.status, 'paid')))
    .returning({ id: partnerPayouts.id });
  return result.length > 0;
};

export type DeletePartnerPayoutResult = 'ok' | 'not_found' | 'already_paid' | 'adjustment_applied';

/**
 * 이체 전(pending) 기록을 지워 다시 기록할 길을 연다 — 기록 뒤 뒤늦은 환불로 숫자가 달라졌을 때. 한 batch(= 한 트랜잭션)에서:
 *  1. 이 정산에 실렸던 조정을 풀어 준다(`applied_payout_id` → NULL) — 다시 기록하면 그대로 다시 실린다.
 *  2. 이 정산이 만든 이월 조정(`carryover:<id>`)을 지운다 — 다시 기록하면 새로 계산해 만든다.
 *  3. 이 정산을 바로잡던 조정(`origin_payout_id`, 정산 뒤 환불)을 지운다 — 다시 기록하는 스냅샷이 그 환불을 이미 반영하므로 남기면 이중 공제다.
 *  4. 기록을 지운다.
 * 모든 문장이 같은 가드를 건다: 기록이 아직 pending이고, 3·2의 조정이 **다른 정산에 이미 실리지 않았다**. 실렸으면 지우면 그 정산의
 * 숫자와 어긋나므로 통째로 거부한다(`adjustment_applied` — 그 뒤 정산을 먼저 취소해야 한다). 같은 순간 "지급 완료"가 먼저 들어가면 가드가 거짓이라 아무것도 안 바뀐다.
 * 지운 기록의 이력은 남기지 않는다(아티스트 후원 정산과 같다).
 */
export const deletePartnerPayoutIfPending = async (id: string): Promise<DeletePartnerPayoutResult> => {
  const db = getDb();
  const carryRef = `carryover:${id}`;
  const guard = sql`EXISTS (SELECT 1 FROM partner_payouts WHERE id = ${id} AND status = 'pending')
    AND NOT EXISTS (SELECT 1 FROM partner_payout_adjustments WHERE applied_payout_id IS NOT NULL AND (origin_payout_id = ${id} OR source_ref = ${carryRef}))`;
  const results = await db.batch([
    db.run(sql`UPDATE partner_payout_adjustments SET applied_payout_id = NULL WHERE applied_payout_id = ${id} AND ${guard}`),
    db.run(sql`DELETE FROM partner_payout_adjustments WHERE source_ref = ${carryRef} AND applied_payout_id IS NULL AND ${guard}`),
    db.run(sql`DELETE FROM partner_payout_adjustments WHERE origin_payout_id = ${id} AND applied_payout_id IS NULL AND ${guard}`),
    db.run(sql`DELETE FROM partner_payouts WHERE id = ${id} AND status = 'pending' AND ${guard}`),
  ]);
  if ((results[3].rowsAffected ?? 0) > 0) return 'ok';
  const row = await getPartnerPayoutById(id);
  if (!row) return 'not_found';
  return row.status === 'paid' ? 'already_paid' : 'adjustment_applied';
};
