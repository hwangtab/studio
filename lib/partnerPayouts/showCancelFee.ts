import { and, eq, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { FUNDING_PAYMENT_FEE_PERCENT } from '../../data/pricing';
import { partnerPayoutAdjustments } from '../../db/schema';
import { isMissingTableError } from '../dbErrors';
import { insertAdjustmentIfAbsent } from './adjustments';

/**
 * 공연 회차 취소 결제 수수료 조정(`showtime_cancel_fee`) — 주최자 약관 제7조: 회차가 취소되면 그 회차 결제분은 전액 환불하지만 토스 결제 수수료는
 * 돌려받지 못한다. 스튜디오 귀책이 아니면 그 수수료(상수 `FUNDING_PAYMENT_FEE_PERCENT`, 제6조·제7조가 같은 상수를 보간한다)를 주최자가 부담하고,
 * 그 금액은 정산금에서 빼며 모자라면 청구한다(정산 기록의 `shortfall_amount`).
 *
 * 조정 한 건 = 회차 하나: payee_key `creator:<주최자 id>`, source_ref `<회차 id>`, 금액 **음수**. (kind, payee_key, reason, source_ref) UNIQUE라 멱등이다.
 * 면제(스튜디오 귀책)는 이 조정을 지우는 대신 **반대 부호의 `manual` 조정**(source_ref `waive:<회차 id>`)으로 상쇄한다 — 시스템이 만든 조정은 지우지 않는다는
 * 규칙(`deleteUnappliedManualAdjustment`)을 지키고, 면제를 되돌리는 것(상쇄 조정 삭제)도 같은 길이다. 취소 화면에 "스튜디오 귀책" 체크를 넣지 않은 이유: 회차 취소는
 * 되돌릴 수 없고 환불·메일을 한 번에 일으키는 화면이라, 귀책 판단은 정산 기록 직전(공연 화면의 정산 절)에 하는 편이 실수를 고칠 수 있다.
 */

import { SHOWTIME_CANCEL_REFUND_REASON } from '../shows/refundReasons';
export { SHOWTIME_CANCEL_REFUND_REASON };
export const SHOW_CANCEL_WAIVE_PREFIX = 'waive:';
export const showCancelPayeeKey = (creatorId: string): string => `creator:${creatorId}`;

/** 이 공연의 주최자(승인된 제출물의 개설자). 직영 공연(제출물 없음)이나 표(0055)가 없으면 null. */
export const findShowOrganizerCreatorId = async (showId: string): Promise<string | null> => {
  try {
    const rows = await getDb().all<{ creator_id: string }>(sql`
      SELECT creator_id FROM show_submissions WHERE show_id = ${showId} AND review_status = 'approved' LIMIT 1
    `);
    return rows[0]?.creator_id ?? null;
  } catch (error: unknown) {
    if (isMissingTableError(error, 'show_submissions')) return null;
    throw error;
  }
};

/** 그 회차의 취소 환불 중 **토스를 지난 몫**(계좌 입금은 결제 수수료가 없다)에 결제 수수료율을 곱한 금액. */
export const computeShowtimeCancelFee = async (showtimeId: string): Promise<number> => {
  const [row] = await getDb().all<{ total: number | null }>(sql`
    SELECT COALESCE(SUM(r.amount), 0) AS total
    FROM refunds r
    JOIN payments p ON p.id = r.payment_id
    JOIN orders o ON o.id = p.order_id
    JOIN show_orders so ON so.order_no = o.order_no
    WHERE so.showtime_id = ${showtimeId} AND r.status = 'done' AND r.reason = ${SHOWTIME_CANCEL_REFUND_REASON}
      AND p.payment_key NOT LIKE 'bank-deposit:%'
  `);
  return Math.round((Number(row?.total ?? 0) * FUNDING_PAYMENT_FEE_PERCENT) / 100);
};

export type SyncCancelFeeResult = 'inserted' | 'updated' | 'exists' | 'zero' | 'no_organizer' | 'not_cancelled';

/**
 * 취소된 회차의 결제 수수료 조정을 만들거나(없으면) 금액을 맞춘다(아직 정산에 안 실렸고 금액이 달라졌을 때 — 회차 취소 환불이 여러 번에 나눠 끝난 경우).
 * 표(0067)가 없으면 던진다. 호출부: 회차 취소 끝(`safeSyncShowtimeCancelFee`)과 정산 기록 직전.
 */
export const syncShowtimeCancelFee = async (showtimeId: string): Promise<SyncCancelFeeResult> => {
  const db = getDb();
  const [st] = await db.all<{ show_id: string; status: string }>(sql`SELECT show_id, status FROM showtimes WHERE id = ${showtimeId}`);
  if (!st || st.status !== 'cancelled') return 'not_cancelled';
  const creatorId = await findShowOrganizerCreatorId(st.show_id);
  if (!creatorId) return 'no_organizer';
  const fee = await computeShowtimeCancelFee(showtimeId);
  if (fee <= 0) return 'zero';
  const payeeKey = showCancelPayeeKey(creatorId);
  const result = await insertAdjustmentIfAbsent({
    kind: 'show', payeeKey, amount: -fee, reason: 'showtime_cancel_fee', sourceRef: showtimeId,
    memo: `회차 취소 — 환불한 토스 결제분의 결제 수수료 ${FUNDING_PAYMENT_FEE_PERCENT}%`,
  });
  if (result === 'inserted') return 'inserted';
  // 이미 있다 — 아직 정산에 안 실렸다면 금액을 현재 환불액에 맞춘다(면제 상쇄 조정도 같은 금액으로).
  const updated = await db.update(partnerPayoutAdjustments)
    .set({ amount: -fee })
    .where(and(
      eq(partnerPayoutAdjustments.kind, 'show'), eq(partnerPayoutAdjustments.payeeKey, payeeKey),
      eq(partnerPayoutAdjustments.reason, 'showtime_cancel_fee'), eq(partnerPayoutAdjustments.sourceRef, showtimeId),
      sql`${partnerPayoutAdjustments.appliedPayoutId} IS NULL AND ${partnerPayoutAdjustments.amount} <> ${-fee}`,
    ))
    .returning({ id: partnerPayoutAdjustments.id });
  if (updated.length > 0) {
    await db.update(partnerPayoutAdjustments)
      .set({ amount: fee })
      .where(and(
        eq(partnerPayoutAdjustments.kind, 'show'), eq(partnerPayoutAdjustments.payeeKey, payeeKey),
        eq(partnerPayoutAdjustments.reason, 'manual'), eq(partnerPayoutAdjustments.sourceRef, `${SHOW_CANCEL_WAIVE_PREFIX}${showtimeId}`),
        sql`${partnerPayoutAdjustments.appliedPayoutId} IS NULL`,
      ));
    return 'updated';
  }
  return 'exists';
};

/**
 * 회차 취소 경로용 — **절대 던지지 않는다.** 환불은 이미 끝났고 조정을 못 만든 것은 로그만 남긴다(`[partner-payouts]`).
 * 못 만든 조정은 정산 기록 직전 보충이 메운다. 표가 없는 DB(0067 전)는 조용히 건너뛴다.
 */
export const safeSyncShowtimeCancelFee = async (showtimeId: string): Promise<void> => {
  try {
    await syncShowtimeCancelFee(showtimeId);
  } catch (error: unknown) {
    if (isMissingTableError(error)) return;
    console.error('[partner-payouts] 회차 취소 결제 수수료 조정 생성 실패 — 정산 기록 때 보충됩니다', { showtimeId, error });
  }
};

export type SetWaivedResult = 'ok' | 'not_found' | 'no_fee' | 'already_applied' | 'no_organizer' | 'unchanged';

/**
 * 스튜디오 귀책 여부 토글 — `waived = true`면 상쇄 조정(+수수료)을 쌓고, false면 지운다. 수수료 조정이 이미 어느 정산에 실렸으면 거절한다
 * (그 정산을 먼저 이체 전 취소해야 한다). 이 공연의 회차가 아니면 `not_found`.
 */
export const setShowtimeCancelFeeWaived = async (showId: string, showtimeId: string, waived: boolean): Promise<SetWaivedResult> => {
  const db = getDb();
  const [st] = await db.all<{ status: string }>(sql`SELECT status FROM showtimes WHERE id = ${showtimeId} AND show_id = ${showId}`);
  if (!st || st.status !== 'cancelled') return 'not_found';
  const creatorId = await findShowOrganizerCreatorId(showId);
  if (!creatorId) return 'no_organizer';
  const payeeKey = showCancelPayeeKey(creatorId);
  await syncShowtimeCancelFee(showtimeId);
  const [fee] = await db.select().from(partnerPayoutAdjustments).where(and(
    eq(partnerPayoutAdjustments.kind, 'show'), eq(partnerPayoutAdjustments.payeeKey, payeeKey),
    eq(partnerPayoutAdjustments.reason, 'showtime_cancel_fee'), eq(partnerPayoutAdjustments.sourceRef, showtimeId),
  )).limit(1);
  if (!fee) return 'no_fee';
  if (fee.appliedPayoutId) return 'already_applied';
  const waiveRef = `${SHOW_CANCEL_WAIVE_PREFIX}${showtimeId}`;
  if (waived) {
    const r = await insertAdjustmentIfAbsent({
      kind: 'show', payeeKey, amount: -fee.amount, reason: 'manual', sourceRef: waiveRef,
      memo: '스튜디오 귀책 — 회차 취소 결제 수수료 면제',
    });
    return r === 'inserted' ? 'ok' : 'unchanged';
  }
  const deleted = await db.delete(partnerPayoutAdjustments).where(and(
    eq(partnerPayoutAdjustments.kind, 'show'), eq(partnerPayoutAdjustments.payeeKey, payeeKey),
    eq(partnerPayoutAdjustments.reason, 'manual'), eq(partnerPayoutAdjustments.sourceRef, waiveRef),
    sql`${partnerPayoutAdjustments.appliedPayoutId} IS NULL`,
  )).returning({ id: partnerPayoutAdjustments.id });
  return deleted.length > 0 ? 'ok' : 'unchanged';
};
