import { randomUUID } from 'crypto';
import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { refunds, type Order } from '../../db/schema';
import { refundIdempotencyKey } from '../booking/cancel';
import { cancelPayment, confirmPayment, fetchPayment, type TossKeyChannel, type TossPayment } from '../booking/toss';
import { DECLINE_CODE_PATTERN } from '../shows/tossCodes';
import { getAnySoftware, maxActivationsOf } from './catalog';
import { sendSoftwareOrderConfirmedEmails } from './email';
import { generateLicenseKey } from './key';
import { findSoftwareOrder, type SoftwareOrderWithDetails } from './order';

/**
 * 소프트웨어 주문 결제 승인 — 상점 승인(lib/shop/confirm.ts)의 안전장치를 그대로 옮기고, 재고 대신 **라이선스 발급**을
 * 같은 batch에 넣었다: 결제 행 INSERT(payment_key UNIQUE가 동시 확정을 막는다) → `paid` UPDATE → 라이선스 INSERT
 * (`paid`인 주문에만, 그 주문에 라이선스가 없을 때만). 돈과 키가 한 트랜잭션이라 "결제됐는데 키가 없는" 주문이 생기지 않는다.
 */

export type SoftwareConfirmOutcome =
  | { ok: true; orderNo: string; totalAmount: number; receiptUrl: string | null; manageToken: string }
  | { ok: false; code: 'not_found' | 'amount_mismatch' | 'invalid_state' | 'toss_rejected' | 'recording_failed'; message: string };

const ALREADY_PROCESSED_CODE = 'ALREADY_PROCESSED_PAYMENT';
const GENERIC_TOSS_ERROR_MESSAGE = '결제 승인 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
const INVALID_STATE_MESSAGE = '이미 처리되었거나 만료된 주문이에요.';
const RECORDING_FAILED_MESSAGE =
  '결제는 완료되었으나 확정 처리가 지연되고 있어요. 몇 분 안에 자동으로 확정되며, 계속되면 010-4255-7893으로 연락 주세요.';
const AUTO_CANCEL_FAILED_MESSAGE = '결제 확인 중 문제가 생겼어요. 결제가 됐다면 확인 후 환불해 드려요. 문의: 010-4255-7893';
const AUTO_CANCEL_REASON = '주문 확정 불가(상태) — 자동 전액 취소';

const rowsAffectedOf = (result: unknown): number => (result as { rowsAffected?: number } | undefined)?.rowsAffected ?? 0;

const receiptOf = (order: SoftwareOrderWithDetails, paymentKey?: string): string | null =>
  (order.payments.find((p) => p.paymentKey === paymentKey) ?? order.payments[0])?.receiptUrl ?? null;

/** 승인은 끝났는데 확정 UPDATE가 0행 — 돈만 들어온 주문을 남기지 않도록 전액 되돌린다. */
const autoCancelApproval = async (order: Order, approved: TossPayment): Promise<SoftwareConfirmOutcome> => {
  console.error('[software-confirm] 승인 후 확정 0행 — 전액 자동 취소', { orderNo: order.orderNo, paymentKey: approved.paymentKey });
  const cancelled = await cancelPayment({
    paymentKey: approved.paymentKey,
    cancelReason: AUTO_CANCEL_REASON,
    cancelAmount: order.totalAmount,
    idempotencyKey: refundIdempotencyKey(order.orderNo, order.totalAmount, 'autocancel'),
    paymentMethod: approved.method,
  });
  const db = getDb();
  try {
    const row = await db.query.payments.findFirst({ where: (t, { eq }) => eq(t.paymentKey, approved.paymentKey) });
    if (row) {
      await db.insert(refunds).values({
        paymentId: row.id,
        amount: order.totalAmount,
        reason: AUTO_CANCEL_REASON,
        requestedBy: 'admin',
        tossTransactionKey: cancelled.ok ? (cancelled.payment.cancels?.at(-1)?.transactionKey ?? null) : null,
        status: cancelled.ok ? 'done' : 'failed',
      });
    }
    if (cancelled.ok) {
      await db.run(sql`UPDATE orders SET status = 'refunded', updated_at = unixepoch() WHERE id = ${order.id} AND status IN ('pending', 'expired', 'failed')`);
    }
  } catch (error) {
    console.error('[software-confirm] 자동 취소 기록 실패 — 수동 대사 필요', { orderNo: order.orderNo, error });
  }
  if (!cancelled.ok) console.error('[software-confirm] 자동 전액 취소 실패 — 수동 대사 필요', { orderNo: order.orderNo, code: cancelled.code });
  return { ok: false, code: 'invalid_state', message: cancelled.ok ? INVALID_STATE_MESSAGE : AUTO_CANCEL_FAILED_MESSAGE };
};

export const confirmSoftwareOrder = async (
  input: { orderNo: string; paymentKey: string; amount: number; channel?: TossKeyChannel },
  /** 웹훅 신뢰 모드 — 토스 재조회로 DONE + 금액이 이미 검증된 뒤에 온다. expired·failed도 받는다. */
  options: { trustedByWebhook?: boolean } = {},
): Promise<SoftwareConfirmOutcome> => {
  const order = await findSoftwareOrder(input.orderNo);
  if (!order || !order.item) return { ok: false, code: 'not_found', message: '주문을 찾을 수 없어요.' };

  const replay = (): SoftwareConfirmOutcome => ({
    ok: true, orderNo: order.orderNo, totalAmount: order.totalAmount, receiptUrl: receiptOf(order, input.paymentKey), manageToken: order.manageToken,
  });

  // 새로고침·웹훅 중복. 결과 화면이 관리 토큰을 싣으므로 결제창을 실제로 연 사람만 아는 paymentKey·금액이 맞을 때만 재생한다.
  if (order.status === 'paid' || order.status === 'partially_refunded' || order.status === 'refunded') {
    if (options.trustedByWebhook) return replay();
    const provesOwnership = input.amount === order.totalAmount && order.payments.some((p) => p.paymentKey === input.paymentKey);
    if (!provesOwnership || order.status === 'refunded') {
      if (!provesOwnership) console.error('[software-confirm] 확정된 주문에 소유 증명 없는 접근', { orderNo: order.orderNo });
      return { ok: false, code: 'invalid_state', message: INVALID_STATE_MESSAGE };
    }
    return replay();
  }

  // 재고가 없어 만료는 정리용 표식일 뿐이다 — 승인 직전 크론이 expired로 바꿔도 결과 화면에서 확정한다(그 경합에 돈을 자동 취소하지 않게).
  const acceptableStatuses: Order['status'][] = options.trustedByWebhook ? ['pending', 'expired', 'failed'] : ['pending', 'expired'];
  if (!acceptableStatuses.includes(order.status)) {
    if (options.trustedByWebhook) console.error('[software-confirm] 웹훅이 확정 불가 상태의 주문을 만남 — 수동 대사 필요', { orderNo: order.orderNo, status: order.status });
    return { ok: false, code: 'invalid_state', message: INVALID_STATE_MESSAGE };
  }
  if (input.amount !== order.totalAmount) return { ok: false, code: 'amount_mismatch', message: '결제 금액이 주문과 일치하지 않아요.' };

  const db = getDb();
  const toss = await confirmPayment({ paymentKey: input.paymentKey, orderId: order.orderNo, amount: input.amount, channel: input.channel });

  let approved: TossPayment;
  if (toss.ok) {
    if (toss.payment.status !== 'DONE') {
      console.error('[software-confirm] 승인 응답이 DONE이 아님 — 확정하지 않는다', { orderNo: order.orderNo, status: toss.payment.status });
      return { ok: false, code: 'toss_rejected', message: GENERIC_TOSS_ERROR_MESSAGE };
    }
    approved = toss.payment;
  } else if (toss.code === ALREADY_PROCESSED_CODE) {
    const refetched = await fetchPayment(input.paymentKey);
    if (!refetched.ok) return { ok: false, code: 'toss_rejected', message: GENERIC_TOSS_ERROR_MESSAGE };
    const p = refetched.payment;
    if (p.status !== 'DONE' || p.orderId !== order.orderNo || p.totalAmount !== order.totalAmount) {
      console.error('[software-confirm] 재조회 검증 불일치 — 기록하지 않는다', { orderNo: order.orderNo, status: p.status, orderId: p.orderId });
      return { ok: false, code: 'toss_rejected', message: GENERIC_TOSS_ERROR_MESSAGE };
    }
    approved = p;
  } else {
    const isInternal = toss.code === 'CONFIG_ERROR' || toss.code === 'NETWORK_ERROR';
    const isDeclined = !isInternal && DECLINE_CODE_PATTERN.test(toss.code);
    if (isDeclined) await db.run(sql`UPDATE orders SET status = 'failed', updated_at = unixepoch() WHERE id = ${order.id} AND status = 'pending'`);
    console.error('[software-confirm] 토스 승인 거부', { orderNo: order.orderNo, tossCode: toss.code });
    return { ok: false, code: 'toss_rejected', message: isDeclined ? toss.message : GENERIC_TOSS_ERROR_MESSAGE };
  }

  const product = getAnySoftware(order.item.productSlug);
  const maxActivations = product ? maxActivationsOf(product) : 3;
  const statusList = sql.join(acceptableStatuses.map((s) => sql`${s}`), sql`, `);
  const approvedAtSec = approved.approvedAt ? Math.floor(new Date(approved.approvedAt).getTime() / 1000) : null;

  let batchResults: unknown[];
  try {
    batchResults = await db.batch([
      db.run(sql`
        INSERT INTO payments (id, order_id, payment_key, method, approved_at, receipt_url, raw_response)
        VALUES (lower(hex(randomblob(16))), ${order.id}, ${approved.paymentKey}, ${approved.method ?? null},
                ${approvedAtSec}, ${approved.receipt?.url ?? null}, ${JSON.stringify(approved)})
      `),
      db.run(sql`UPDATE orders SET status = 'paid', updated_at = unixepoch() WHERE id = ${order.id} AND status IN (${statusList})`),
      db.run(sql`
        INSERT INTO software_licenses (id, product_slug, license_key, email, customer_name, source, order_no, max_activations, status)
        SELECT ${randomUUID()}, ${order.item.productSlug}, ${generateLicenseKey()}, ${(order.customerEmail ?? '').toLowerCase()},
               ${order.customerName}, 'toss', ${order.orderNo}, ${maxActivations}, 'active'
        WHERE EXISTS (SELECT 1 FROM orders WHERE id = ${order.id} AND status = 'paid')
          AND NOT EXISTS (SELECT 1 FROM software_licenses WHERE order_no = ${order.orderNo})
      `),
    ]);
  } catch (error) {
    let existing: unknown;
    try {
      existing = await db.query.payments.findFirst({ where: (t, { eq }) => eq(t.paymentKey, approved.paymentKey) });
    } catch (lookupError) {
      console.error('[software-confirm] 멱등 판정 조회 실패', { orderNo: order.orderNo, error: lookupError });
    }
    if (existing) {
      const current = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.id, order.id) }).catch(() => undefined);
      if (current?.status === 'paid' || current?.status === 'partially_refunded') return replay();
      return { ok: false, code: 'invalid_state', message: INVALID_STATE_MESSAGE };
    }
    console.error('[software-confirm] 결제 승인됨, DB 기록 실패 — 웹훅 복구 대기', { orderNo: order.orderNo, paymentKey: approved.paymentKey, error });
    return { ok: false, code: 'recording_failed', message: RECORDING_FAILED_MESSAGE };
  }

  if (rowsAffectedOf(batchResults[1]) === 0) {
    const current = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.id, order.id) }).catch(() => undefined);
    if (current?.status === 'paid' || current?.status === 'partially_refunded') return replay();
    return autoCancelApproval(order, approved);
  }

  // 신규 확정에서만 한 통 — 이 줄은 paid로 바꾼 batch를 이긴 실행만 지난다.
  await sendSoftwareOrderConfirmedEmails(order.orderNo);
  return { ok: true, orderNo: order.orderNo, totalAmount: order.totalAmount, receiptUrl: approved.receipt?.url ?? null, manageToken: order.manageToken };
};
