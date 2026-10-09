import { and, eq, inArray, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { orders, payments, refunds, type Order } from '../../db/schema';
import { formatPriceAmount } from '../../data/pricing';
import { adminUrl, buildEmailLayout } from '../email/layout';
import { sendEmail } from '../email/resend';
import { OPERATOR_EMAIL } from '../operatorContact';
import { refundIdempotencyKey } from './cancel';
import { rowsAffectedOf } from './confirm';
import { findOrderByOrderNo } from './service';
import { cancelPayment, confirmPayment, fetchPayment, type TossKeyChannel, type TossPayment } from './toss';

/**
 * 예약금 결제 링크(orders.type = 'deposit')의 결제 승인.
 *
 * confirmBookingPayment(세션·믹싱 전용)를 건드리지 않고, 같은 안전장치만 옮겼다 — 서버가 저장한 금액과
 * 일치할 때만 토스를 부르고, 이미 승인된 결제의 재호출은 성공으로 멱등 처리하고, payments.payment_key
 * unique가 동시 확정을 막는다. 하위 테이블(bookings·work_orders)이 없어 batch는 payments INSERT +
 * orders pending→paid 둘뿐이다. notificationError는 건드리지 않는다(헬스체크가 영구 경고를 내지 않게).
 */

export type DepositConfirmOutcome =
  | {
      ok: true;
      orderNo: string;
      totalAmount: number;
      /** 토스 영수증 주소. 멱등 재생에서도 저장된 payments 행에서 돌려준다. */
      receiptUrl: string | null;
    }
  | {
      ok: false;
      code: 'not_found' | 'amount_mismatch' | 'invalid_state' | 'toss_rejected' | 'recording_failed';
      message: string;
    };

const ALREADY_PROCESSED_CODE = 'ALREADY_PROCESSED_PAYMENT';
// lib/booking/confirm.ts의 DECLINE_CODE_PATTERN과 같은 allowlist — 모르는 코드로는 주문을 failed로 낙인하지 않는다.
const DECLINE_CODE_PATTERN =
  /^(REJECT_|INVALID_REJECT_CARD|EXCEED_MAX_|INVALID_CARD|INVALID_STOPPED_CARD$|INVALID_ACCOUNT_INFO|NOT_ENOUGH_BALANCE$|NOT_AVAILABLE_BANK$|CARD_PROCESSING_ERROR$|PAY_PROCESS_(CANCELED|ABORTED)$)/;

const GENERIC_TOSS_ERROR_MESSAGE = '결제 승인 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
const INVALID_STATE_MESSAGE = '이미 처리되었거나 만료된 주문이에요.';
const RECORDING_FAILED_MESSAGE =
  '결제는 완료되었으나 확정 처리가 지연되고 있어요. 몇 분 내 자동 확정되며, 지속되면 010-4255-7893으로 연락 주세요.';
const STALE_APPROVAL_MESSAGE = '주문이 처리된 뒤 결제가 승인되어 자동으로 취소됐어요. 결제 금액은 취소 처리되었으니 다시 결제해 주세요.';
const AUTO_CANCEL_FAILED_MESSAGE =
  '결제 확인 중 문제가 발생했어요. 결제가 이뤄졌다면 확인 후 환불해 드려요. 문의: 010-4255-7893';
const AUTO_CANCEL_REASON = '주문 상태 변경 후 승인 — 자동 전액 취소';

const receiptOf = (order: { payments: { paymentKey: string; receiptUrl: string | null }[] }, paymentKey?: string): string | null =>
  (order.payments.find((p) => p.paymentKey === paymentKey) ?? order.payments[0])?.receiptUrl ?? null;

/** 승인은 끝났는데 orders 전이가 0행 — 돈만 들어온 주문을 만들지 않도록 전액 되돌린다. */
const autoCancelStaleApproval = async (order: Order, approved: TossPayment): Promise<DepositConfirmOutcome> => {
  console.error('[deposit-confirm] 승인 후 orders 전이 0행 — 전액 자동 취소', {
    orderNo: order.orderNo,
    paymentKey: approved.paymentKey,
    orderStatus: order.status,
  });
  const cancelled = await cancelPayment({
    paymentKey: approved.paymentKey,
    cancelReason: AUTO_CANCEL_REASON,
    cancelAmount: order.totalAmount,
    idempotencyKey: refundIdempotencyKey(order.orderNo, order.totalAmount, 'autocancel'),
  });

  try {
    const row = await getDb().query.payments.findFirst({
      where: (t, { eq: equals }) => equals(t.paymentKey, approved.paymentKey),
    });
    if (row) {
      await getDb().insert(refunds).values({
        paymentId: row.id,
        amount: order.totalAmount,
        reason: AUTO_CANCEL_REASON,
        requestedBy: 'admin',
        tossTransactionKey: cancelled.ok
          ? (cancelled.payment.cancels?.[cancelled.payment.cancels.length - 1]?.transactionKey ?? null)
          : null,
        status: cancelled.ok ? 'done' : 'failed',
      });
    }
  } catch (error) {
    console.error('[deposit-confirm] 자동 취소 환불 기록 실패', { orderNo: order.orderNo, error });
  }

  if (!cancelled.ok) {
    console.error('[deposit-confirm] 자동 전액 취소 실패 — 수동 대사 필요', {
      orderNo: order.orderNo,
      paymentKey: approved.paymentKey,
      code: cancelled.code,
    });
    return { ok: false, code: 'invalid_state', message: AUTO_CANCEL_FAILED_MESSAGE };
  }
  return { ok: false, code: 'invalid_state', message: STALE_APPROVAL_MESSAGE };
};

/** 운영자에게 가는 결제 알림 한 통. 실패해도 결제 확정은 그대로 — 로그만 남긴다. */
const notifyOperator = async (order: Order, approved: TossPayment): Promise<void> => {
  try {
    const result = await sendEmail({
      to: OPERATOR_EMAIL,
      subject: `[예약금 결제] ${formatPriceAmount(order.totalAmount)}원 — ${order.customerName}`,
      text: [
        '예약금 결제가 완료됐어요.',
        `금액: ${formatPriceAmount(order.totalAmount)}원 (VAT 포함)`,
        `고객: ${order.customerName} / ${order.customerPhone} / ${order.customerEmail}`,
        `주문번호: ${order.orderNo}`,
        `결제수단: ${approved.method ?? '-'}`,
        approved.receipt?.url ? `영수증: ${approved.receipt.url}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      html: buildEmailLayout({
        audience: 'operator',
        preheader: `${order.customerName} · ${formatPriceAmount(order.totalAmount)}원`,
        heading: '예약금 결제가 완료됐어요',
        rows: [
          { label: '고객', value: order.customerName },
          { label: '연락처', value: order.customerPhone, href: `tel:${order.customerPhone.replace(/[^0-9+]/g, '')}` },
          { label: '이메일', value: order.customerEmail, href: `mailto:${order.customerEmail}` },
          { label: '금액', value: `${formatPriceAmount(order.totalAmount)}원 (VAT 포함)`, emphasis: true },
          { label: '결제수단', value: approved.method ?? '-' },
          { label: '주문번호', value: order.orderNo },
          ...(approved.receipt?.url ? [{ label: '영수증', value: '토스 영수증 열기', href: approved.receipt.url }] : []),
        ],
        cta: { label: '관리자에서 보기', url: adminUrl(`/admin/bookings/${order.id}`) },
      }),
    });
    if (!result.ok) console.error('[deposit-confirm] 운영자 알림 메일 실패', { orderNo: order.orderNo, code: result.errorCode });
  } catch (error) {
    console.error('[deposit-confirm] 운영자 알림 메일 예외', { orderNo: order.orderNo, error });
  }
};

export const confirmDepositPayment = async (
  input: { orderNo: string; paymentKey: string; amount: number; channel?: TossKeyChannel },
  /** 웹훅 신뢰 모드 — 토스 재조회로 DONE + 금액이 이미 검증된 뒤에 온다. failed·expired도 받는다. */
  options: { trustedByWebhook?: boolean } = {},
): Promise<DepositConfirmOutcome> => {
  const order = await findOrderByOrderNo(input.orderNo);
  if (!order) return { ok: false, code: 'not_found', message: '주문을 찾을 수 없어요.' };
  if (order.type !== 'deposit') return { ok: false, code: 'invalid_state', message: INVALID_STATE_MESSAGE };

  const replay = (): DepositConfirmOutcome => ({
    ok: true,
    orderNo: order.orderNo,
    totalAmount: order.totalAmount,
    receiptUrl: receiptOf(order, input.paymentKey),
  });

  // 새로고침·웹훅 중복 — 소유 증명(이 주문의 실제 paymentKey + 금액)이 있을 때만 성공으로 돌려준다.
  if (order.status === 'paid') {
    if (options.trustedByWebhook) return replay();
    const provesOwnership =
      input.amount === order.totalAmount && order.payments.some((p) => p.paymentKey === input.paymentKey);
    if (!provesOwnership) {
      console.error('[deposit-confirm] 확정된 주문에 소유 증명 없는 접근', { orderNo: order.orderNo });
      return { ok: false, code: 'invalid_state', message: INVALID_STATE_MESSAGE };
    }
    return replay();
  }

  const acceptableStatuses: Order['status'][] = options.trustedByWebhook ? ['pending', 'expired', 'failed'] : ['pending'];
  if (!acceptableStatuses.includes(order.status)) {
    if (options.trustedByWebhook) {
      console.error('[deposit-confirm] 웹훅이 확정 불가 상태의 주문을 만남 — 수동 대사 필요', {
        orderNo: order.orderNo,
        paymentKey: input.paymentKey,
        status: order.status,
      });
    }
    return { ok: false, code: 'invalid_state', message: INVALID_STATE_MESSAGE };
  }

  // 서버가 저장한 금액이 유일한 진실 — 다르면 토스를 부르지도 않는다.
  if (input.amount !== order.totalAmount)
    return { ok: false, code: 'amount_mismatch', message: '결제 금액이 주문과 일치하지 않아요.' };

  const db = getDb();
  const toss = await confirmPayment({
    paymentKey: input.paymentKey,
    orderId: order.orderNo,
    amount: input.amount,
    channel: input.channel,
  });

  let approved: TossPayment;
  if (toss.ok) {
    if (toss.payment.status !== 'DONE') {
      console.error('[deposit-confirm] 승인 응답이 DONE이 아님 — 확정하지 않는다', {
        orderNo: order.orderNo,
        status: toss.payment.status,
      });
      return { ok: false, code: 'toss_rejected', message: GENERIC_TOSS_ERROR_MESSAGE };
    }
    approved = toss.payment;
  } else if (toss.code === ALREADY_PROCESSED_CODE) {
    // 우리 DB만 뒤처진 경우 — 실패로 낙인하지 않고 재조회로 사실을 확인한 뒤 같은 경로로 기록한다.
    const refetched = await fetchPayment(input.paymentKey);
    if (!refetched.ok) {
      console.error('[deposit-confirm] 이미 처리된 결제의 재조회 실패', { orderNo: order.orderNo, code: refetched.code });
      return { ok: false, code: 'toss_rejected', message: GENERIC_TOSS_ERROR_MESSAGE };
    }
    const payment = refetched.payment;
    if (payment.status !== 'DONE' || payment.orderId !== order.orderNo || payment.totalAmount !== order.totalAmount) {
      console.error('[deposit-confirm] 재조회 검증 불일치 — 기록하지 않는다', {
        orderNo: order.orderNo,
        status: payment.status,
        orderId: payment.orderId,
        totalAmount: payment.totalAmount,
      });
      return { ok: false, code: 'toss_rejected', message: GENERIC_TOSS_ERROR_MESSAGE };
    }
    approved = payment;
  } else {
    const isInternalError = toss.code === 'CONFIG_ERROR' || toss.code === 'NETWORK_ERROR';
    const isDeclined = !isInternalError && DECLINE_CODE_PATTERN.test(toss.code);
    if (isDeclined) {
      await db.run(
        sql`UPDATE orders SET status = 'failed', updated_at = unixepoch() WHERE id = ${order.id} AND status = 'pending'`,
      );
    }
    console.error('[deposit-confirm] 토스 승인 거부', {
      orderNo: order.orderNo,
      amount: input.amount,
      tossCode: toss.code,
      tossMessage: toss.message,
    });
    return { ok: false, code: 'toss_rejected', message: isDeclined ? toss.message : GENERIC_TOSS_ERROR_MESSAGE };
  }

  let batchResults: unknown[] = [];
  try {
    // payments INSERT가 앞 — paymentKey unique 위반이 동시 확정의 두 번째 시도를 batch 전체 실패로 만든다.
    batchResults = await db.batch([
      db.insert(payments).values({
        orderId: order.id,
        paymentKey: approved.paymentKey,
        method: approved.method ?? null,
        approvedAt: approved.approvedAt ? new Date(approved.approvedAt) : null,
        receiptUrl: approved.receipt?.url ?? null,
        rawResponse: JSON.stringify(approved),
      }),
      db
        .update(orders)
        .set({ status: 'paid', updatedAt: new Date() })
        .where(and(eq(orders.id, order.id), inArray(orders.status, acceptableStatuses))),
    ]);
  } catch (error) {
    // 동시 확정에서 다른 쪽이 이겼는지(이 paymentKey가 이미 기록됨) 진짜 DB 장애인지 가른다.
    let existing: unknown;
    try {
      existing = await db.query.payments.findFirst({ where: (t, { eq: equals }) => equals(t.paymentKey, approved.paymentKey) });
    } catch (lookupError) {
      console.error('[deposit-confirm] 멱등 판정 조회 실패', { orderNo: order.orderNo, error: lookupError });
    }
    if (existing) {
      return {
        ok: true,
        orderNo: order.orderNo,
        totalAmount: order.totalAmount,
        receiptUrl: approved.receipt?.url ?? null,
      };
    }
    console.error('[deposit-confirm] 결제 승인됨, DB 기록 실패 — 웹훅 복구 대기', {
      orderNo: order.orderNo,
      paymentKey: approved.paymentKey,
      error,
    });
    return { ok: false, code: 'recording_failed', message: RECORDING_FAILED_MESSAGE };
  }

  if (rowsAffectedOf(batchResults[1]) === 0) return autoCancelStaleApproval(order, approved);

  await notifyOperator(order, approved);

  return {
    ok: true,
    orderNo: order.orderNo,
    totalAmount: order.totalAmount,
    receiptUrl: approved.receipt?.url ?? null,
  };
};
