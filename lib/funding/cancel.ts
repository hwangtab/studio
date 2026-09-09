import { eq, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingPledges, orders, refunds } from '../../db/schema';
import { cancelPayment } from '../booking/toss';
import { sendFundingCancelledEmails } from './email';
import { assessSelfCancel, CANCEL_BLOCK_MESSAGES } from './policy';
import { computeProjectState, getFundingProject } from './projects';
import { findFundingOrderByOrderNo, type FundingOrder } from './service';
import type { FundingProject } from './projects';

export type FundingCancelOutcome =
  | { ok: true; mode: 'refunded' | 'refund_requested' | 'recorded'; refundAmount: number }
  | { ok: false; code: 'not_found' | 'invalid_state' | 'toss_failed' | 'recording_failed'; message: string };

const GENERIC = '취소 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
const refundIdempotencyKey = (orderNo: string, amount: number): string => `refund:${orderNo}:${amount}`;

/**
 * 취소 메일 발송 + notificationError 기록. 돈은 이미 나갔으므로(또는 확정 취소됨) 메일 예외나
 * 기록 실패가 outcome을 바꿔서는 안 된다 — confirm.ts의 notificationError 패턴과 동일하게
 * 둘 다 try/catch로 감싼다.
 */
const notifyCancelled = async (
  db: ReturnType<typeof getDb>,
  order: FundingOrder,
  project: FundingProject | null,
  mode: 'refunded' | 'refund_requested' | 'recorded',
): Promise<void> => {
  let emailError: string | null = null;
  try {
    emailError = await sendFundingCancelledEmails(order, project, mode);
  } catch (error) {
    console.error('[funding-cancel] 취소 메일 발송 중 예외', { orderNo: order.orderNo, error });
    emailError = error instanceof Error ? error.message : String(error);
  }
  try {
    await db.update(orders).set({ notificationError: emailError }).where(eq(orders.id, order.id));
  } catch (error) {
    console.error('[funding-cancel] notificationError 기록 실패', { orderNo: order.orderNo, emailError, error });
  }
};

export const cancelFundingPledge = async (input: { orderNo: string; requestedBy: 'customer' | 'admin'; reason: string; now: Date }): Promise<FundingCancelOutcome> => {
  const order = await findFundingOrderByOrderNo(input.orderNo);
  if (!order || !order.fundingPledge) return { ok: false, code: 'not_found', message: '후원을 찾을 수 없습니다.' };
  const pledge = order.fundingPledge;
  const project = getFundingProject(pledge.projectSlug);
  if (order.status !== 'paid') return { ok: false, code: 'invalid_state', message: CANCEL_BLOCK_MESSAGES.not_paid };
  if (input.requestedBy === 'customer') {
    const verdict = assessSelfCancel({
      orderStatus: order.status,
      projectState: project ? computeProjectState(project, input.now) : 'closed',
      fulfillmentStatus: pledge.fulfillmentStatus,
    });
    if (!verdict.ok) return { ok: false, code: 'invalid_state', message: CANCEL_BLOCK_MESSAGES[verdict.code] };
  }
  const db = getDb();
  const payment = order.payments[0];

  if (pledge.paymentMethod === 'toss' && !payment) {
    return { ok: false, code: 'invalid_state', message: '결제 기록이 없는 후원입니다. 관리자에게 문의해 주세요.' };
  }

  // 무통장: 토스가 없으니 돈이 자동으로 나가지 않는다.
  if (pledge.paymentMethod === 'bank_transfer') {
    if (input.requestedBy === 'customer') {
      await db.update(fundingPledges).set({ refundRequestedAt: input.now, updatedAt: input.now }).where(eq(fundingPledges.id, pledge.id));
      await notifyCancelled(db, order, project, 'refund_requested');
      return { ok: true, mode: 'refund_requested', refundAmount: order.totalAmount };
    }
    const claim = await db.run(sql`UPDATE orders SET status = 'refunded', updated_at = unixepoch() WHERE id = ${order.id} AND status = 'paid'`);
    if (Number(claim.rowsAffected) === 0) return { ok: false, code: 'invalid_state', message: '이미 처리된 후원입니다.' };
    await notifyCancelled(db, order, project, 'recorded');
    return { ok: true, mode: 'recorded', refundAmount: order.totalAmount };
  }

  // 토스: 선점 → 취소 API → 기록. 실패 시 되돌림(예약 cancel.ts와 같은 순서).
  const claim = await db.run(sql`UPDATE orders SET status = 'refunded', updated_at = unixepoch() WHERE id = ${order.id} AND status = 'paid'`);
  if (Number(claim.rowsAffected) === 0) return { ok: false, code: 'invalid_state', message: '이미 처리 중이거나 취소된 후원입니다.' };
  const toss = await cancelPayment({
    paymentKey: payment!.paymentKey, cancelReason: input.reason, cancelAmount: order.totalAmount,
    idempotencyKey: refundIdempotencyKey(order.orderNo, order.totalAmount),
  });
  if (!toss.ok) {
    try {
      await db.run(sql`UPDATE orders SET status = 'paid', updated_at = unixepoch() WHERE id = ${order.id} AND status = 'refunded'`);
    } catch (revertError) {
      console.error('[funding-cancel] 선점 revert 실패 — 수동 복구 필요', { orderNo: order.orderNo, error: revertError });
    }
    await db.insert(refunds).values({ paymentId: payment!.id, amount: order.totalAmount, reason: input.reason, requestedBy: input.requestedBy, status: 'failed' });
    const internal = toss.code === 'CONFIG_ERROR' || toss.code === 'NETWORK_ERROR';
    console.error('[funding-cancel] 토스 취소 실패', { orderNo: order.orderNo, code: toss.code, message: toss.message });
    return { ok: false, code: 'toss_failed', message: internal ? GENERIC : toss.message };
  }
  try {
    await db.insert(refunds).values({
      paymentId: payment!.id, amount: order.totalAmount, reason: input.reason, requestedBy: input.requestedBy,
      tossTransactionKey: toss.payment.cancels?.[toss.payment.cancels.length - 1]?.transactionKey ?? null, status: 'done',
    });
  } catch (error) {
    console.error('[funding-cancel] 환불 완료, 기록 실패 — 웹훅 CANCELED 동기화가 보정', { orderNo: order.orderNo, error });
    return { ok: false, code: 'recording_failed', message: '환불은 완료되었으나 기록이 지연되고 있습니다. 010-4255-7893으로 확인 부탁드립니다.' };
  }
  await notifyCancelled(db, order, project, 'refunded');
  return { ok: true, mode: 'refunded', refundAmount: order.totalAmount };
};
