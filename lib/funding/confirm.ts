import { and, eq, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingPledges, orders, payments, refunds } from '../../db/schema';
import { confirmPayment, fetchPayment, type TossPayment } from '../booking/toss';
import { sendFundingConfirmedEmails } from './email';
import { getFundingProject } from './projects';
import { findFundingOrderByOrderNo, type FundingOrder } from './service';

export type FundingConfirmOutcome =
  | { ok: true; orderNo: string; manageToken: string; projectSlug: string; emailSent?: boolean }
  | { ok: false; code: 'not_found' | 'amount_mismatch' | 'invalid_state' | 'toss_rejected' | 'recording_failed'; message: string };

/** 토스가 "이미 승인된 결제"에 재승인을 요청받았을 때 돌려주는 코드. 실패가 아니라 지연 신호다. */
const ALREADY_PROCESSED_CODE = 'ALREADY_PROCESSED_PAYMENT';

const GENERIC = '결제 승인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
const EXPIRED = '결제 대기 시간이 만료된 후원입니다. 다시 후원해 주세요.';
const RECORDING_FAILED = '결제는 완료되었으나 후원 확정 처리가 지연되고 있습니다. 몇 분 내 자동 확정되며, 지속되면 010-4255-7893으로 연락 주세요.';

const success = (order: FundingOrder, emailSent?: boolean): FundingConfirmOutcome => ({
  ok: true,
  orderNo: order.orderNo,
  manageToken: order.manageToken,
  projectSlug: order.fundingPledge?.projectSlug ?? '',
  ...(emailSent === undefined ? {} : { emailSent }),
});

export const confirmFundingPledge = async (input: { orderNo: string; paymentKey: string; amount: number }): Promise<FundingConfirmOutcome> => {
  const order = await findFundingOrderByOrderNo(input.orderNo);
  if (!order || !order.fundingPledge) return { ok: false, code: 'not_found', message: '후원을 찾을 수 없습니다.' };

  // success 페이지 새로고침·웹훅 중복 도착 멱등성 — 이미 확정이면 성공으로 답한다(토스 미호출).
  if (order.status === 'paid') return success(order);
  if (order.status !== 'pending') return { ok: false, code: 'invalid_state', message: '이미 처리되었거나 만료된 후원입니다.' };

  // 서버가 저장한 금액이 유일한 진실 — 다르면 토스를 부르지도 않는다(위변조 차단).
  if (input.amount !== order.totalAmount) return { ok: false, code: 'amount_mismatch', message: '결제 금액이 후원 내용과 일치하지 않습니다.' };

  // 홀드 만료도 스스로 적용한다 — expireStalePledges는 lazy 호출이라 만료 후에도 pending으로
  // 남아 있을 수 있다. 만료 확인 없이 승인을 부르면 이미 다른 후원자가 같은 재고를 가져간
  // 뒤에도 이 결제가 확정될 수 있다.
  if (order.fundingPledge.holdExpiresAt.getTime() < Date.now()) {
    console.error('[funding-confirm] 홀드 만료 주문의 승인 요청 — 토스를 부르지 않고 거부', { orderNo: order.orderNo });
    return { ok: false, code: 'invalid_state', message: EXPIRED };
  }

  const db = getDb();
  const toss = await confirmPayment({ paymentKey: input.paymentKey, orderId: order.orderNo, amount: input.amount });

  let approved: TossPayment;
  if (toss.ok) {
    approved = toss.payment;
  } else if (toss.code === ALREADY_PROCESSED_CODE) {
    // 토스는 이미 승인된 결제의 재승인을 거절한다 — "우리 DB만 뒤처졌다"는 신호다. 페이로드가
    // 아니라 재조회 결과만 믿는다.
    const refetched = await fetchPayment(input.paymentKey);
    if (!refetched.ok || refetched.payment.status !== 'DONE' || refetched.payment.orderId !== order.orderNo || refetched.payment.totalAmount !== order.totalAmount) {
      console.error('[funding-confirm] 이미 처리된 결제의 재조회 검증 실패', { orderNo: order.orderNo, paymentKey: input.paymentKey });
      return { ok: false, code: 'toss_rejected', message: GENERIC };
    }
    approved = refetched.payment;
  } else {
    await db.run(sql`UPDATE orders SET status = 'failed', updated_at = unixepoch() WHERE id = ${order.id} AND status = 'pending'`);
    const internal = toss.code === 'CONFIG_ERROR' || toss.code === 'NETWORK_ERROR';
    console.error('[funding-confirm] 토스 승인 거부', { orderNo: order.orderNo, tossCode: toss.code, tossMessage: toss.message });
    return { ok: false, code: 'toss_rejected', message: internal ? GENERIC : toss.message };
  }

  const now = new Date();
  try {
    // payments INSERT가 맨 앞 — paymentKey unique 위반이 동시 확정의 두 번째 시도를
    // batch 전체 실패로 만든다(절반만 쓰인 상태가 남지 않는다).
    await db.batch([
      db.insert(payments).values({
        orderId: order.id,
        paymentKey: approved.paymentKey,
        method: approved.method ?? null,
        approvedAt: approved.approvedAt ? new Date(approved.approvedAt) : null,
        receiptUrl: approved.receipt?.url ?? null,
        rawResponse: JSON.stringify(approved),
      }),
      db.update(orders).set({ status: 'paid', updatedAt: now }).where(and(eq(orders.id, order.id), eq(orders.status, 'pending'))),
      db.update(fundingPledges).set({ paidAt: now, updatedAt: now }).where(eq(fundingPledges.orderId, order.id)),
    ]);
  } catch (error) {
    // 토스 승인은 이미 끝났다 — 이 실패가 멱등(paymentKey unique 위반)인지 진짜 DB 장애인지는
    // payments에 이 paymentKey가 이미 있는지로 가른다.
    let existing: unknown;
    try {
      existing = await db.query.payments.findFirst({ where: (t, { eq: e }) => e(t.paymentKey, approved.paymentKey) });
    } catch (lookupError) {
      console.error('[funding-confirm] 멱등 판정 조회 실패', { orderNo: order.orderNo, paymentKey: approved.paymentKey, error: lookupError });
    }
    if (existing) return success(order);
    console.error('[funding-confirm] 결제 승인됨, DB 기록 실패 — 웹훅 복구 대기', { orderNo: order.orderNo, paymentKey: approved.paymentKey, error });
    return { ok: false, code: 'recording_failed', message: RECORDING_FAILED };
  }

  const fresh = (await findFundingOrderByOrderNo(order.orderNo)) ?? order;
  const emailError = await sendFundingConfirmedEmails(fresh, getFundingProject(fresh.fundingPledge?.projectSlug ?? ''));
  if (emailError) {
    await db.update(orders).set({ notificationError: emailError }).where(eq(orders.id, order.id));
  }
  return success(fresh, emailError === null);
};

/** 토스 콘솔 등 외부에서 이미 취소된 펀딩 결제를 DB에 반영만 한다(취소 API 재호출 없음). */
export const syncFundingCancelledFromToss = async (payment: TossPayment): Promise<void> => {
  const order = await findFundingOrderByOrderNo(payment.orderId);
  if (!order) return;
  const paymentRow = order.payments.find((p) => p.paymentKey === payment.paymentKey) ?? order.payments[0];
  if (!paymentRow) return;

  const db = getDb();
  const claim = await db.run(sql`UPDATE orders SET status = 'refunded', updated_at = unixepoch() WHERE id = ${order.id} AND status = 'paid'`);
  if (Number(claim.rowsAffected) === 0) return;

  const cancelled = payment.cancels?.reduce((sum, c) => sum + c.cancelAmount, 0) ?? order.totalAmount;
  await db.insert(refunds).values({
    paymentId: paymentRow.id,
    amount: cancelled,
    reason: '토스 외부 취소 동기화',
    requestedBy: 'webhook',
    tossTransactionKey: payment.cancels?.[payment.cancels.length - 1]?.transactionKey ?? null,
    status: 'done',
  });
};
