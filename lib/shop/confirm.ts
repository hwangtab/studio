import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { refunds, type Order } from '../../db/schema';
import { refundIdempotencyKey } from '../booking/cancel';
import { cancelPayment, confirmPayment, fetchPayment, type TossKeyChannel, type TossPayment } from '../booking/toss';
import { DECLINE_CODE_PATTERN } from '../shows/tossCodes';
import { sendShopOrderConfirmedEmails } from './email';
import { findShopOrderByOrderNo, rowsAffectedOf, type ShopOrderWithDetails } from './service';
import { alertIfSerialsMissing, serialInsertStatements } from './serials';
import { editionGates, stockGateSql } from './stock';

/**
 * 상점 주문 결제 승인 — 예약금 결제 링크(lib/booking/confirmDeposit.ts)의 안전장치를 그대로 옮기고 **재고 재판정**을
 * 더했다: 서버가 저장한 금액과 같을 때만 토스를 부르고, 이미 승인된 결제의 재호출은 재조회로 확인해 같은 길로
 * 기록하고, payments.payment_key UNIQUE가 동시 확정을 막는다.
 *
 * **재고 재판정이 필요한 이유** — 생성 때의 재고 게이트는 홀드가 끝난 주문을 점유로 세지 않는다(새 손님에게 자리를
 * 열어 주는 규칙). 그래서 홀드가 지난 뒤 결제를 마친 A와 그 사이 같은 재고를 잡은 B가 동시에 승인될 수 있다.
 * paid로 바꾸는 UPDATE의 WHERE에 "나를 뺀 나머지로 셌을 때도 남는가"를 걸어 그 이중 판매를 막는다(공연
 * confirmShowOrder의 excludeOrderNo와 같은 자리). 게이트에 걸리면 승인된 돈을 전액 자동 취소한다.
 */

export type ShopConfirmOutcome =
  | { ok: true; orderNo: string; totalAmount: number; receiptUrl: string | null; manageToken: string }
  | {
      ok: false;
      code: 'not_found' | 'amount_mismatch' | 'invalid_state' | 'toss_rejected' | 'recording_failed' | 'sold_out';
      message: string;
    };

const ALREADY_PROCESSED_CODE = 'ALREADY_PROCESSED_PAYMENT';

const GENERIC_TOSS_ERROR_MESSAGE = '결제 승인 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
const INVALID_STATE_MESSAGE = '이미 처리되었거나 만료된 주문이에요.';
const RECORDING_FAILED_MESSAGE =
  '결제는 완료되었으나 확정 처리가 지연되고 있어요. 몇 분 안에 자동으로 확정되며, 계속되면 010-4255-7893으로 연락 주세요.';
const SOLD_OUT_MESSAGE = '결제하시는 사이 상품이 다 팔렸어요. 결제 금액은 바로 취소해 드렸어요.';
const AUTO_CANCEL_FAILED_MESSAGE = '결제 확인 중 문제가 생겼어요. 결제가 됐다면 확인 후 환불해 드려요. 문의: 010-4255-7893';
const AUTO_CANCEL_REASON = '주문 확정 불가(재고·상태) — 자동 전액 취소';

const receiptOf = (order: ShopOrderWithDetails, paymentKey?: string): string | null =>
  (order.payments.find((p) => p.paymentKey === paymentKey) ?? order.payments[0])?.receiptUrl ?? null;

/** 승인은 끝났는데 확정 게이트가 0행 — 돈만 들어온 주문을 남기지 않도록 전액 되돌린다. */
const autoCancelApproval = async (order: Order, approved: TossPayment): Promise<ShopConfirmOutcome> => {
  console.error('[shop-confirm] 승인 후 확정 게이트 0행 — 전액 자동 취소', { orderNo: order.orderNo, paymentKey: approved.paymentKey });
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
      // 원장을 맞춘다 — 결제 행이 남았으니 주문도 환불로 닫아야 매출장부·재고(refunded는 점유가 아니다)가 맞는다.
      await db.run(sql`UPDATE orders SET status = 'refunded', updated_at = unixepoch() WHERE id = ${order.id} AND status IN ('pending', 'expired', 'failed')`);
      await db.run(sql`UPDATE shop_orders SET fulfillment_status = 'cancelled', cancelled_at = unixepoch(), updated_at = unixepoch() WHERE order_no = ${order.orderNo}`);
    }
  } catch (error) {
    console.error('[shop-confirm] 자동 취소 기록 실패 — 수동 대사 필요', { orderNo: order.orderNo, error });
  }
  if (!cancelled.ok) {
    console.error('[shop-confirm] 자동 전액 취소 실패 — 수동 대사 필요', { orderNo: order.orderNo, code: cancelled.code });
    return { ok: false, code: 'invalid_state', message: AUTO_CANCEL_FAILED_MESSAGE };
  }
  return { ok: false, code: 'sold_out', message: SOLD_OUT_MESSAGE };
};

export const confirmShopOrder = async (
  input: { orderNo: string; paymentKey: string; amount: number; channel?: TossKeyChannel },
  /** 웹훅 신뢰 모드 — 토스 재조회로 DONE + 금액이 이미 검증된 뒤에 온다. expired·failed도 받는다. */
  options: { trustedByWebhook?: boolean } = {},
): Promise<ShopConfirmOutcome> => {
  const order = await findShopOrderByOrderNo(input.orderNo);
  if (!order || !order.shopOrder) return { ok: false, code: 'not_found', message: '주문을 찾을 수 없어요.' };

  const replay = (): ShopConfirmOutcome => ({
    ok: true, orderNo: order.orderNo, totalAmount: order.totalAmount, receiptUrl: receiptOf(order, input.paymentKey), manageToken: order.manageToken,
  });

  // 새로고침·웹훅 중복 — 결과 화면이 관리 토큰을 싣는다. 결제창을 실제로 연 사람만 아는 paymentKey·금액이 맞을 때만
  // 재생을 허용한다(주문번호는 메일·영수증에 평문으로 나온다).
  if (order.status === 'paid' || order.status === 'partially_refunded' || order.status === 'refunded') {
    if (options.trustedByWebhook) return replay();
    const provesOwnership = input.amount === order.totalAmount && order.payments.some((p) => p.paymentKey === input.paymentKey);
    if (!provesOwnership || order.status === 'refunded') {
      if (!provesOwnership) console.error('[shop-confirm] 확정된 주문에 소유 증명 없는 접근', { orderNo: order.orderNo });
      return { ok: false, code: 'invalid_state', message: INVALID_STATE_MESSAGE };
    }
    return replay();
  }

  const acceptableStatuses: Order['status'][] = options.trustedByWebhook ? ['pending', 'expired', 'failed'] : ['pending'];
  if (!acceptableStatuses.includes(order.status)) {
    if (options.trustedByWebhook) {
      console.error('[shop-confirm] 웹훅이 확정 불가 상태의 주문을 만남 — 수동 대사 필요', { orderNo: order.orderNo, status: order.status });
    }
    return { ok: false, code: 'invalid_state', message: INVALID_STATE_MESSAGE };
  }

  if (input.amount !== order.totalAmount) return { ok: false, code: 'amount_mismatch', message: '결제 금액이 주문과 일치하지 않아요.' };

  const db = getDb();
  const toss = await confirmPayment({ paymentKey: input.paymentKey, orderId: order.orderNo, amount: input.amount, channel: input.channel });

  let approved: TossPayment;
  if (toss.ok) {
    if (toss.payment.status !== 'DONE') {
      // 가상계좌(WAITING_FOR_DEPOSIT) 등 — 상점은 즉시 결제 수단만 받는다. 확정하지 않는다.
      console.error('[shop-confirm] 승인 응답이 DONE이 아님 — 확정하지 않는다', { orderNo: order.orderNo, status: toss.payment.status });
      return { ok: false, code: 'toss_rejected', message: GENERIC_TOSS_ERROR_MESSAGE };
    }
    approved = toss.payment;
  } else if (toss.code === ALREADY_PROCESSED_CODE) {
    const refetched = await fetchPayment(input.paymentKey);
    if (!refetched.ok) return { ok: false, code: 'toss_rejected', message: GENERIC_TOSS_ERROR_MESSAGE };
    const p = refetched.payment;
    if (p.status !== 'DONE' || p.orderId !== order.orderNo || p.totalAmount !== order.totalAmount) {
      console.error('[shop-confirm] 재조회 검증 불일치 — 기록하지 않는다', { orderNo: order.orderNo, status: p.status, orderId: p.orderId });
      return { ok: false, code: 'toss_rejected', message: GENERIC_TOSS_ERROR_MESSAGE };
    }
    approved = p;
  } else {
    const isInternal = toss.code === 'CONFIG_ERROR' || toss.code === 'NETWORK_ERROR';
    const isDeclined = !isInternal && DECLINE_CODE_PATTERN.test(toss.code);
    if (isDeclined) {
      await db.run(sql`UPDATE orders SET status = 'failed', updated_at = unixepoch() WHERE id = ${order.id} AND status = 'pending'`);
    }
    console.error('[shop-confirm] 토스 승인 거부', { orderNo: order.orderNo, tossCode: toss.code });
    return { ok: false, code: 'toss_rejected', message: isDeclined ? toss.message : GENERIC_TOSS_ERROR_MESSAGE };
  }

  const now = new Date();
  const items = order.shopOrder.items;
  // 한정판은 남은 번호 수로도 판정한다 — 발송 뒤 반품으로 재고는 돌아와도 번호는 돌아오지 않는다. 걸리면 재고 부족과 같이 자동 전액 취소(번호 없는 확정 금지).
  const stockGates = items.length
    ? sql.join([
      ...items.map((i) => stockGateSql(i.skuId, i.quantity, now, order.orderNo)),
      ...editionGates(items.map((i) => ({ skuId: i.skuId, quantity: i.quantity, productKey: i.productSlug })), now, order.orderNo),
    ], sql` AND `)
    : sql`1 = 0`;
  const statusList = sql.join(acceptableStatuses.map((s) => sql`${s}`), sql`, `);
  const approvedAtSec = approved.approvedAt ? Math.floor(new Date(approved.approvedAt).getTime() / 1000) : null;

  let batchResults: unknown[];
  try {
    // payments INSERT가 앞 — payment_key UNIQUE 위반이 동시 확정의 두 번째 시도를 batch 전체 실패로 만든다.
    const statements = [
      db.run(sql`
        INSERT INTO payments (id, order_id, payment_key, method, approved_at, receipt_url, raw_response)
        VALUES (lower(hex(randomblob(16))), ${order.id}, ${approved.paymentKey}, ${approved.method ?? null},
                ${approvedAtSec}, ${approved.receipt?.url ?? null}, ${JSON.stringify(approved)})
      `),
      db.run(sql`
        UPDATE orders SET status = 'paid', updated_at = unixepoch()
        WHERE id = ${order.id} AND status IN (${statusList})
          AND NOT EXISTS (SELECT 1 FROM shop_orders WHERE order_no = ${order.orderNo} AND fulfillment_status = 'cancelled')
          AND ${stockGates}
      `),
      // 한정판 번호 — paid UPDATE 뒤, 같은 batch. `db-` 줄에만(없으면 빈 배열).
      ...serialInsertStatements({ id: order.id, orderNo: order.orderNo }, items).map((s) => db.run(s)),
    ];
    batchResults = await db.batch(statements as [typeof statements[number], ...typeof statements]);
  } catch (error) {
    let existing: unknown;
    try {
      existing = await db.query.payments.findFirst({ where: (t, { eq }) => eq(t.paymentKey, approved.paymentKey) });
    } catch (lookupError) {
      console.error('[shop-confirm] 멱등 판정 조회 실패', { orderNo: order.orderNo, error: lookupError });
    }
    if (existing) {
      const current = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.id, order.id) }).catch(() => undefined);
      if (current?.status === 'paid' || current?.status === 'partially_refunded') return replay();
      return { ok: false, code: 'invalid_state', message: INVALID_STATE_MESSAGE };
    }
    console.error('[shop-confirm] 결제 승인됨, DB 기록 실패 — 웹훅 복구 대기', { orderNo: order.orderNo, paymentKey: approved.paymentKey, error });
    return { ok: false, code: 'recording_failed', message: RECORDING_FAILED_MESSAGE };
  }

  if (rowsAffectedOf(batchResults[1]) === 0) {
    const current = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.id, order.id) }).catch(() => undefined);
    if (current?.status === 'paid' || current?.status === 'partially_refunded') return replay();
    return autoCancelApproval(order, approved);
  }

  await alertIfSerialsMissing(order.orderNo, items);

  // 신규 확정에서만 한 통 — 이 줄은 paid로 바꾼 batch를 이긴 실행만 지난다.
  await sendShopOrderConfirmedEmails(order.orderNo);
  return { ok: true, orderNo: order.orderNo, totalAmount: order.totalAmount, receiptUrl: approved.receipt?.url ?? null, manageToken: order.manageToken };
};
