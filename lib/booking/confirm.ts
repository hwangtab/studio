import { and, eq, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { bookings, orders, payments } from '../../db/schema';
import { sendBookingConfirmedEmails } from './email';
import { createBookingEvent } from './gcal';
import { findOrderByOrderNo, PENDING_HOLD_SECONDS } from './service';
import { confirmPayment, fetchPayment, type TossPayment } from './toss';
import { kstDateString } from './kst';

export type ConfirmOutcome =
  | { ok: true; orderNo: string }
  | {
      ok: false;
      code: 'not_found' | 'amount_mismatch' | 'invalid_state' | 'toss_rejected' | 'recording_failed';
      message: string;
    };

/** 토스가 "이미 승인된 결제"에 재승인을 요청받았을 때 돌려주는 코드. 실패가 아니라 지연 신호다. */
const ALREADY_PROCESSED_CODE = 'ALREADY_PROCESSED_PAYMENT';

const GENERIC_TOSS_ERROR_MESSAGE = '결제 승인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
const EXPIRED_MESSAGE = '결제 대기 시간이 만료된 주문입니다. 슬롯이 해제되었으니 다시 예약해 주세요.';
const RECORDING_FAILED_MESSAGE =
  '결제는 완료되었으나 예약 확정 처리가 지연되고 있습니다. 몇 분 내 자동 확정되며, 지속되면 010-4255-7893으로 연락 주세요.';

export const confirmBookingPayment = async (input: {
  orderNo: string;
  paymentKey: string;
  amount: number;
}): Promise<ConfirmOutcome> => {
  const order = await findOrderByOrderNo(input.orderNo);
  if (!order) return { ok: false, code: 'not_found', message: '주문을 찾을 수 없습니다.' };

  // success 페이지 새로고침·웹훅 중복 도착 멱등성 — 이미 확정이면 성공으로 답한다.
  if (order.status === 'paid') return { ok: true, orderNo: order.orderNo };
  if (order.status !== 'pending')
    return { ok: false, code: 'invalid_state', message: '이미 처리되었거나 만료된 주문입니다.' };

  // 서버가 저장한 금액이 유일한 진실 — 다르면 토스를 부르지도 않는다(위변조 차단).
  if (input.amount !== order.totalAmount)
    return { ok: false, code: 'amount_mismatch', message: '결제 금액이 주문과 일치하지 않습니다.' };

  // 선점 만료를 confirm이 스스로 적용한다 — expireStaleOrders는 슬롯 조회·관리자 목록에서만
  // lazy 호출되므로, 결제창을 900초 넘게 방치한 주문이 status='pending'인 채로 남아 있을 수
  // 있다. 그 사이 createBookingOrder의 겹침 검사는 900초 지난 pending을 무시하므로 다른 고객이
  // 같은 슬롯을 예약·결제·확정할 수 있다. 만료 확인 없이 여기서 승인을 부르면 같은 시간대에
  // confirmed 예약 2건이 생긴다 — 아직 승인 전이라 이 시점의 거부는 과금 없이 끝난다
  // (토스 결제는 confirm API 호출로 확정되고, 미승인 건은 그대로 만료된다).
  if (
    order.createdAt instanceof Date &&
    Date.now() - order.createdAt.getTime() > PENDING_HOLD_SECONDS * 1000
  ) {
    console.error('[booking-confirm] 선점 만료 주문의 승인 요청 — 토스를 부르지 않고 거부', {
      orderNo: order.orderNo,
      createdAt: order.createdAt.toISOString(),
    });
    return { ok: false, code: 'invalid_state', message: EXPIRED_MESSAGE };
  }

  const db = getDb();
  const toss = await confirmPayment({ paymentKey: input.paymentKey, orderId: order.orderNo, amount: input.amount });

  let approved: TossPayment;
  if (toss.ok) {
    approved = toss.payment;
  } else if (toss.code === ALREADY_PROCESSED_CODE) {
    // 토스는 이미 승인된 결제의 재승인을 거절한다 — 그런데 이 상황은 "실패"가 아니라 "우리 DB만
    // 뒤처졌다"는 신호다. 웹훅 DONE 복구(승인은 됐는데 기록이 실패한 주문)와 success 페이지
    // 이중 새로고침이 정확히 여기로 온다. 여기서 failed를 찍으면 돈이 들어온 주문을 실패로
    // 확정해 버리므로(그 뒤 웹훅 재도착도 invalid_state에 막힌다) 절대 마킹하지 않고,
    // 토스에 재조회해 실제 승인 사실을 확인한 뒤 정상 승인과 같은 경로로 기록한다.
    const refetched = await fetchPayment(input.paymentKey);
    if (!refetched.ok) {
      console.error('[booking-confirm] 이미 처리된 결제의 재조회 실패 — 상태 판정 보류', {
        orderNo: order.orderNo,
        paymentKey: input.paymentKey,
        code: refetched.code,
        message: refetched.message,
      });
      return { ok: false, code: 'toss_rejected', message: GENERIC_TOSS_ERROR_MESSAGE };
    }
    // 페이로드가 아니라 재조회 결과만 믿는다 — 주문번호·금액·상태 셋 다 우리 주문과 맞아야 한다.
    const payment = refetched.payment;
    if (payment.status !== 'DONE' || payment.orderId !== order.orderNo || payment.totalAmount !== order.totalAmount) {
      console.error('[booking-confirm] 이미 처리된 결제의 재조회 검증 불일치 — 기록하지 않는다', {
        orderNo: order.orderNo,
        paymentKey: input.paymentKey,
        status: payment.status,
        orderId: payment.orderId,
        totalAmount: payment.totalAmount,
      });
      return { ok: false, code: 'toss_rejected', message: GENERIC_TOSS_ERROR_MESSAGE };
    }
    approved = payment;
  } else {
    await db.run(sql`UPDATE orders SET status = 'failed', updated_at = unixepoch() WHERE id = ${order.id} AND status = 'pending'`);
    // CONFIG_ERROR·NETWORK_ERROR는 우리 쪽 설정·네트워크 문제라 원문을 그대로 보이면
    // 내부 구성(비밀키 누락 등)이 새어나간다 — 고객에겐 일반 문구, 원문은 서버 로그에만.
    const isInternalError = toss.code === 'CONFIG_ERROR' || toss.code === 'NETWORK_ERROR';
    if (isInternalError) {
      console.error('[booking-confirm] 토스 승인 내부 오류', {
        orderNo: order.orderNo,
        code: toss.code,
        message: toss.message,
      });
    }
    return { ok: false, code: 'toss_rejected', message: isInternalError ? GENERIC_TOSS_ERROR_MESSAGE : toss.message };
  }

  const booking = order.bookings[0];
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
      db.update(orders)
        .set({ status: 'paid', updatedAt: new Date() })
        .where(and(eq(orders.id, order.id), eq(orders.status, 'pending'))),
      db.update(bookings)
        .set({ status: 'confirmed', updatedAt: new Date() })
        .where(and(eq(bookings.orderId, order.id), eq(bookings.status, 'pending'))),
    ]);
  } catch (error) {
    // 토스 승인은 이미 끝났다 — 이 실패가 "동시 확정에서 다른 쪽이 이겼다"(멱등, paymentKey
    // unique 위반)인지 "진짜 DB 장애"인지는 payments에 이 paymentKey가 이미 있는지로 가른다.
    let existing: unknown;
    try {
      existing = await db.query.payments.findFirst({
        where: (t, { eq }) => eq(t.paymentKey, approved.paymentKey),
      });
    } catch (lookupError) {
      // 멱등 판정 조회 자체가 실패 — batch와 같은 연결이 죽었을 공산이 크다(rethrow 금지).
      // "판정 불가"로 간주해 무기록 500 대신 아래 recording_failed 경로로 떨어뜨린다.
      console.error('[booking-confirm] 멱등 판정 조회 실패', {
        orderNo: order.orderNo,
        paymentKey: approved.paymentKey,
        error: lookupError,
      });
    }
    if (existing) return { ok: true, orderNo: order.orderNo };
    console.error('[booking-confirm] 결제 승인됨, DB 기록 실패 — 웹훅 복구 대기', {
      orderNo: order.orderNo,
      paymentKey: approved.paymentKey,
      error,
    });
    return { ok: false, code: 'recording_failed', message: RECORDING_FAILED_MESSAGE };
  }

  // 후처리 — 결제는 이미 성공했으므로 실패를 삼키되 반드시 기록한다 (스펙 §10).
  if (booking) {
    try {
      const eventId = await createBookingEvent({
        summary: `[예약] ${booking.serviceType} — ${order.customerName}`,
        description: [
          `상품: ${booking.productId} (${booking.durationHours}시간)`,
          `고객: ${order.customerName} / ${order.customerPhone} / ${order.customerEmail}`,
          `주문번호: ${order.orderNo}`,
          `요청사항: ${booking.customerNote ?? '없음'}`,
        ].join('\n'),
        start: booking.startAt,
        end: booking.endAt,
      });
      await db.update(bookings).set({ gcalEventId: eventId }).where(eq(bookings.id, booking.id));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      try {
        await db
          .update(bookings)
          .set({ gcalError: `create(${kstDateString(new Date())}): ${detail}` })
          .where(eq(bookings.id, booking.id));
      } catch (writeError) {
        console.error('[booking-confirm] gcalError 기록 실패', {
          orderNo: order.orderNo,
          bookingId: booking.id,
          error: writeError,
        });
      }
    }

    const notifyError = await sendBookingConfirmedEmails({ ...order, status: 'paid' }, booking);
    try {
      await db.update(orders).set({ notificationError: notifyError }).where(eq(orders.id, order.id));
    } catch (error) {
      console.error('[booking-confirm] notificationError 기록 실패', {
        orderNo: order.orderNo,
        notifyError,
        error,
      });
    }
  } else {
    // Phase 1에선 발생 불가(주문 생성이 항상 bookings 1건을 동반) — 상태 불변식이 깨졌을 때의 방어 로그.
    console.error('[booking-confirm] bookings 없는 주문 — 후처리 생략', { orderNo: order.orderNo });
  }

  return { ok: true, orderNo: order.orderNo };
};
