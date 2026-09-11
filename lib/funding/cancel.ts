import { eq, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { orders, refunds } from '../../db/schema';
import { cancelPayment } from '../booking/toss';
import { sendFundingCancelledEmails } from './email';
import { assessSelfCancel, CANCEL_BLOCK_MESSAGES } from './policy';
import { computeProjectState, getFundingProject } from './projects';
import { remainingRefundable } from './refundable';
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
  refundAmount: number,
): Promise<void> => {
  let emailError: string | null = null;
  try {
    emailError = await sendFundingCancelledEmails(order, project, mode, refundAmount);
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
  // 부분환불 건은 관리자만 다룰 수 있다 — 남은 금액 계산이 걸려 있어 고객 셀프 취소에 맡기지 않는다.
  if (order.status === 'partially_refunded' && input.requestedBy !== 'admin') {
    return { ok: false, code: 'invalid_state', message: '일부 환불된 후원은 문의해 주세요.' };
  }
  if (order.status !== 'paid' && !(order.status === 'partially_refunded' && input.requestedBy === 'admin')) {
    return { ok: false, code: 'invalid_state', message: CANCEL_BLOCK_MESSAGES.not_paid };
  }
  if (input.requestedBy === 'customer') {
    const verdict = assessSelfCancel({
      orderStatus: order.status,
      projectState: project ? computeProjectState(project, input.now) : 'closed',
      fulfillmentStatus: pledge.fulfillmentStatus,
    });
    if (!verdict.ok) return { ok: false, code: 'invalid_state', message: CANCEL_BLOCK_MESSAGES[verdict.code] };
  }
  const db = getDb();
  // 토스 취소를 걸 결제 행 — 여러 행이 있을 수 있으므로(재승인·분할) done 환불이 아직
  // 잔액을 다 덮지 않은 행을 고른다. 그런 행이 없으면 가장 마지막 결제 행을 쓴다
  // (syncFundingCancelledFromToss도 paymentKey로 행을 고르므로 payments[0] 고정은 위험하다).
  const doneRefundedOn = (p: (typeof order.payments)[number]): number =>
    (p.refunds ?? []).filter((r) => r.status === 'done').reduce((sum, r) => sum + r.amount, 0);
  const payment =
    order.payments.find((p) => doneRefundedOn(p) < order.totalAmount) ?? order.payments[order.payments.length - 1];

  // 이미 done으로 기록된 환불을 **모든 결제 행에서** 뺀 잔액만 취소한다 — payments[0]만 보면
  // 웹훅이 다른 행에 기록한 환불이 빠져 이중 환불이 되고, 잔액이 0인데도 토스를 부르게 된다.
  const refundAmount = remainingRefundable(order);

  if (pledge.paymentMethod === 'toss' && !payment) {
    return { ok: false, code: 'invalid_state', message: '결제 기록이 없는 후원입니다. 관리자에게 문의해 주세요.' };
  }

  // 무통장: 토스가 없으니 돈이 자동으로 나가지 않는다.
  if (pledge.paymentMethod === 'bank_transfer') {
    if (input.requestedBy === 'customer') {
      // 이미 접수된 취소 요청을 다시 눌러도 새 요청처럼 처리하지 않는다 — 운영자에게 같은
      // 건의 메일이 반복해서 쌓인다.
      //
      // 가드를 **UPDATE의 WHERE로** 옮긴 이유: 위에서 읽은 스냅샷으로 if를 돌면 동시 요청
      // 두 건이 둘 다 "아직 요청 없음"을 보고 통과해 요청 메일이 2통 나간다. 발송 준비
      // 시작(fulfillment_status)·결제 상태도 같은 이유로 함께 건다 — assessSelfCancel은 읽기
      // 시점만 보므로, 판정과 기록 사이에 관리자가 발송 준비로 넘기면 "발송 준비 중인데
      // 취소 요청 접수됨"이 성립한다. 토스 경로가 이미 쓰는 선점 패턴과 같은 형태다.
      const claim = await db.run(sql`
        UPDATE funding_pledges
        SET refund_requested_at = ${Math.floor(input.now.getTime() / 1000)}, updated_at = unixepoch()
        WHERE id = ${pledge.id}
          AND refund_requested_at IS NULL
          AND fulfillment_status = 'none'
          AND EXISTS (SELECT 1 FROM orders WHERE id = ${order.id} AND status = 'paid')`);
      if (Number(claim.rowsAffected) === 0) {
        return { ok: false, code: 'invalid_state', message: '이미 취소 요청이 접수되었습니다.' };
      }
      await notifyCancelled(db, order, project, 'refund_requested', order.totalAmount);
      return { ok: true, mode: 'refund_requested', refundAmount: order.totalAmount };
    }
    if (refundAmount <= 0) return { ok: false, code: 'invalid_state', message: '환불할 잔액이 없습니다.' };
    const claim = await db.run(
      sql`UPDATE orders SET status = 'refunded', updated_at = unixepoch() WHERE id = ${order.id} AND status IN ('paid', 'partially_refunded')`,
    );
    if (Number(claim.rowsAffected) === 0) return { ok: false, code: 'invalid_state', message: '이미 처리된 후원입니다.' };
    await notifyCancelled(db, order, project, 'recorded', refundAmount);
    // 무통장도 부분환불 이력이 있을 수 있다(관리자가 일부만 돌려준 뒤 나머지를 정리하는 경우) —
    // 잔액만 알린다. 토스 경로와 같은 계산이다.
    return { ok: true, mode: 'recorded', refundAmount };
  }

  // 잔액이 0이면 토스를 아예 부르지 않는다 — 부르면 취소 금액 0(또는 초과)으로 거절되거나,
  // 잔액이 남은 것처럼 계산된 금액이 이중으로 나간다.
  if (refundAmount <= 0) return { ok: false, code: 'invalid_state', message: '환불할 잔액이 없습니다.' };

  // 토스: 선점 → 취소 API → 기록. 실패 시 되돌림(예약 cancel.ts와 같은 순서).
  //
  // 셀프 취소는 "발송 준비 전"이라는 조건을 선점 WHERE에 함께 건다 — assessSelfCancel이 읽기
  // 시점에만 보므로, 판정과 선점 사이에 관리자가 발송 준비로 넘기면 환불과 발송이 둘 다
  // 성립한다(돈은 나가고 리워드도 나간다). 관리자 취소는 발송 중에도 허용해야 하므로 제외한다.
  const selfCancelGuard =
    input.requestedBy === 'customer'
      ? sql` AND EXISTS (SELECT 1 FROM funding_pledges WHERE order_id = ${order.id} AND fulfillment_status = 'none')`
      : sql.empty();
  const claim = await db.run(
    sql`UPDATE orders SET status = 'refunded', updated_at = unixepoch() WHERE id = ${order.id} AND status = ${order.status}${selfCancelGuard}`,
  );
  if (Number(claim.rowsAffected) === 0) return { ok: false, code: 'invalid_state', message: '이미 처리 중이거나 취소된 후원입니다.' };
  const toss = await cancelPayment({
    paymentKey: payment!.paymentKey, cancelReason: input.reason, cancelAmount: refundAmount,
    idempotencyKey: refundIdempotencyKey(order.orderNo, refundAmount),
  });
  if (!toss.ok) {
    try {
      await db.run(sql`UPDATE orders SET status = ${order.status}, updated_at = unixepoch() WHERE id = ${order.id} AND status = 'refunded'`);
    } catch (revertError) {
      console.error('[funding-cancel] 선점 revert 실패 — 수동 복구 필요', { orderNo: order.orderNo, error: revertError });
    }
    await db.insert(refunds).values({ paymentId: payment!.id, amount: refundAmount, reason: input.reason, requestedBy: input.requestedBy, status: 'failed' });
    const internal = toss.code === 'CONFIG_ERROR' || toss.code === 'NETWORK_ERROR';
    console.error('[funding-cancel] 토스 취소 실패', { orderNo: order.orderNo, code: toss.code, message: toss.message });
    return { ok: false, code: 'toss_failed', message: internal ? GENERIC : toss.message };
  }
  try {
    await db.insert(refunds).values({
      paymentId: payment!.id, amount: refundAmount, reason: input.reason, requestedBy: input.requestedBy,
      tossTransactionKey: toss.payment.cancels?.[toss.payment.cancels.length - 1]?.transactionKey ?? null, status: 'done',
    });
  } catch (error) {
    console.error('[funding-cancel] 환불 완료, 기록 실패 — 웹훅 CANCELED 동기화가 보정', { orderNo: order.orderNo, error });
    return { ok: false, code: 'recording_failed', message: '환불은 완료되었으나 기록이 지연되고 있습니다. 010-4255-7893으로 확인 부탁드립니다.' };
  }
  await notifyCancelled(db, order, project, 'refunded', refundAmount);
  return { ok: true, mode: 'refunded', refundAmount };
};
