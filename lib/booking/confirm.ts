import { and, eq, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { bookings, orders, payments, refunds, workOrders, type Order } from '../../db/schema';
import { refundIdempotencyKey } from './cancel';
import { sendBookingConfirmedEmails, sendMixingOrderConfirmedEmails } from './email';
import { createBookingEvent } from './gcal';
import { findOrderByOrderNo, PENDING_HOLD_SECONDS } from './service';
import { cancelPayment, confirmPayment, fetchPayment, type TossPayment } from './toss';
import { kstDateString } from './kst';

export type ConfirmOutcome =
  | {
      ok: true;
      orderNo: string;
      /** 성공 화면이 세션 완료 문구와 믹싱 접수 문구를 분기하는 데 쓴다. */
      orderType: 'session' | 'mixing';
      /**
       * 예약 확인·취소에 필요한 토큰. 예전엔 이 값이 **확인 메일에만** 실려서, 메일 발송이
       * 실패하면 고객이 스스로 취소할 방법이 사라졌다(화면은 "보내드렸습니다"라고 단언했다).
       * 완료 화면이 관리 링크를 직접 띄울 수 있도록 함께 돌려준다.
       */
      manageToken: string;
      /**
       * 확인 메일이 실제로 나갔는가. false면 완료 화면이 "메일을 보냈다"고 말하지 않는다.
       * 멱등 재생 경로(새로고침·웹훅 중복)에서는 이번 호출이 보낸 게 아니므로 undefined.
       */
      emailSent?: boolean;
    }
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

/** 승인 뒤 주문이 이미 pending을 벗어나 있어 자동 전액 취소한 경우의 고객 문구. */
const STALE_APPROVAL_MESSAGE =
  '주문이 만료된 뒤 결제가 승인되어 자동으로 취소되었습니다. 결제 금액은 취소 처리되었으니 다시 주문해 주세요.';
const AUTO_CANCEL_REASON = '주문 만료 후 승인 — 자동 전액 취소';

/**
 * 자동 전액 취소마저 실패했을 때의 고객 문구.
 *
 * 예전엔 recording_failed를 돌려줬는데, 그건 "일시 실패이니 재시도하면 된다"는 뜻이라
 * 웹훅(webhook.ts isTransientConfirmFailure)이 계속 재시도하게 만든다. 그런데 이 시점의
 * 주문은 이미 pending이 아니라서 재시도는 전부 `status !== 'pending'`에 막힌다 — 아무것도
 * 고치지 못하는 재시도 루프다. 영구 실패(invalid_state)로 끝내고 수동 대사로 넘긴다.
 * 위 console.error가 그 대사의 단서이며, 관리자 미정합 목록도 이 주문을 잡는다.
 */
const AUTO_CANCEL_FAILED_MESSAGE =
  '결제 확인 중 문제가 발생했습니다. 결제가 이뤄졌다면 확인 후 환불해 드립니다. 문의: 010-4255-7893';

/**
 * libSQL batch 결과 한 항목의 rowsAffected.
 *
 * drizzle의 LibSQLSession.batch는 Promise<unknown[]>를 돌려주고(node_modules/drizzle-orm/
 * libsql/session.d.ts), returning 없는 INSERT/UPDATE 항목은 @libsql/client의 ResultSet
 * ({ rowsAffected, rows, columns, ... })으로 그대로 실린다. 인덱스는 batch에 넘긴 순서와 같다.
 * 판정 불가(모킹된 빈 배열 등)는 undefined로 돌려 "정상"으로 흘려보낸다 — 없는 실패를
 * 지어내 결제를 취소하는 쪽이 훨씬 위험하다.
 */
const rowsAffectedOf = (result: unknown): number | undefined => {
  if (!result || typeof result !== 'object' || !('rowsAffected' in result)) return undefined;
  const value = (result as { rowsAffected: unknown }).rowsAffected;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * 승인은 끝났는데 orders pending→paid 전이가 0행인 경우의 자동 복구.
 *
 * 승인 요청과 승인 응답 사이에 그 주문이 pending을 벗어난 것이다 — expireStaleOrders가
 * 만료시켰거나(세션은 900초, 믹싱은 24시간), 같은 고객의 재제출이 자가 선점 해제로 expired를
 * 찍었거나. 이대로 두면 돈만 들어오고 주문은 만료된 채 남는다(관리자 화면 mismatch).
 * 전액을 즉시 되돌려 그 상태를 만들지 않는다.
 *
 * 멱등키는 cancel.ts의 refundIdempotencyKey를 쓰되 접두사를 'autocancel'로 분리한다. 같은 접두사를
 * 쓰면 이 자동 취소가 실패한 뒤 관리자가 같은 주문·같은 금액(전액)으로 수동 환불을 넣을 때
 * 토스가 15일 안의 **실패 응답**을 replay해 영영 환불되지 않는다. 접두사만 다르면 이 경로의
 * 재시도(웹훅 DONE 복구)는 여전히 서로 replay되어 이중 환불을 막는다.
 *
 * orders는 건드리지 않는다 — 이미 expired/failed이고, 여기서 다른 상태를 덮어쓰면 어떤 경로가
 * 주문을 끝냈는지 알 수 없게 된다.
 */
const autoCancelStaleApproval = async (order: Order, approved: TossPayment): Promise<ConfirmOutcome> => {
  const db = getDb();
  console.error('[booking-confirm] 승인 후 orders 전이 0행 — 만료된 주문의 지연 승인으로 판단, 전액 자동 취소', {
    orderNo: order.orderNo,
    paymentKey: approved.paymentKey,
    orderStatus: order.status,
    totalAmount: order.totalAmount,
  });

  const cancelled = await cancelPayment({
    paymentKey: approved.paymentKey,
    cancelReason: AUTO_CANCEL_REASON,
    cancelAmount: order.totalAmount,
    idempotencyKey: refundIdempotencyKey(order.orderNo, order.totalAmount, 'autocancel'),
  });

  // refunds.payment_id는 FK라 방금 batch가 넣은 payments 행의 id가 필요하다(INSERT에
  // returning이 없어 paymentKey로 되찾는다). 못 찾으면 기록만 포기하고 로그를 남긴다.
  let paymentId: string | undefined;
  try {
    const row = await db.query.payments.findFirst({
      where: (t, { eq: equals }) => equals(t.paymentKey, approved.paymentKey),
    });
    paymentId = row?.id;
  } catch (error) {
    console.error('[booking-confirm] 자동 취소 기록용 payments 조회 실패', {
      orderNo: order.orderNo,
      paymentKey: approved.paymentKey,
      error,
    });
  }

  if (paymentId) {
    try {
      await db.insert(refunds).values({
        paymentId,
        amount: order.totalAmount,
        reason: AUTO_CANCEL_REASON,
        // refundRequesterEnum은 customer|admin|webhook뿐이다. 고객이 요청한 환불이 아니고
        // 'webhook'은 토스 웹훅 대사 경로의 표식이라, 시스템이 스스로 낸 환불은 'admin'으로 남긴다.
        requestedBy: 'admin',
        tossTransactionKey: cancelled.ok
          ? (cancelled.payment.cancels?.[cancelled.payment.cancels.length - 1]?.transactionKey ?? null)
          : null,
        status: cancelled.ok ? 'done' : 'failed',
      });
    } catch (error) {
      console.error('[booking-confirm] 자동 취소 환불 기록 실패', {
        orderNo: order.orderNo,
        paymentKey: approved.paymentKey,
        error,
      });
    }
  } else {
    console.error('[booking-confirm] 자동 취소 환불 기록 생략 — payments 행을 찾지 못함', {
      orderNo: order.orderNo,
      paymentKey: approved.paymentKey,
    });
  }

  if (!cancelled.ok) {
    // 돈은 들어왔고 되돌리지도 못했다 — 관리자 미정합 목록(admin-serialize mismatch: 미결제
    // 주문에 payments 행이 있음)이 잡도록 로그를 남기고 수동 대사로 넘긴다.
    console.error('[booking-confirm] 만료 주문 자동 전액 취소 실패 — 수동 대사 필요', {
      orderNo: order.orderNo,
      paymentKey: approved.paymentKey,
      code: cancelled.code,
      message: cancelled.message,
    });
    return { ok: false, code: 'invalid_state', message: AUTO_CANCEL_FAILED_MESSAGE };
  }

  return { ok: false, code: 'invalid_state', message: STALE_APPROVAL_MESSAGE };
};

export const confirmBookingPayment = async (input: {
  orderNo: string;
  paymentKey: string;
  amount: number;
}): Promise<ConfirmOutcome> => {
  const order = await findOrderByOrderNo(input.orderNo);
  if (!order) return { ok: false, code: 'not_found', message: '주문을 찾을 수 없습니다.' };

  // success 페이지 새로고침·웹훅 중복 도착 멱등성 — 이미 확정이면 성공으로 답한다.
  if (order.status === 'paid')
    return { ok: true, orderNo: order.orderNo, orderType: order.type === 'mixing' ? 'mixing' : 'session', manageToken: order.manageToken };
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
  //
  // 세션에만 적용한다. 믹싱은 점유할 슬롯이 없어 이 검사가 지킬 대상 자체가 없고, 반대로
  // 해를 끼친다 — 기록이 실패한 승인을 되살리는 웹훅 DONE 복구가 900초 뒤에 도착하면
  // (토스 재시도 간격상 흔하다) 여기서 막혀 돈만 들어온 주문으로 남는다.
  // expireStaleOrders도 같은 이유로 믹싱 pending은 MIXING_PENDING_TTL_SECONDS(24시간)까지
  // 살려 둔다 — 예전엔 여기와 달리 900초에 expire해서, 15분을 넘겨 도착한 웹훅 재시도가
  // 위의 `status !== 'pending'`에 영구히 막혔다(자동 취소는 batch 앞이라 타지도 않는다).
  // 24시간을 넘긴 뒤 오는 늦은 승인은 아래 batch의 orders 전이가 0행이 되고,
  // autoCancelStaleApproval이 전액을 자동으로 되돌린다.
  if (
    order.type === 'session' &&
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
    // 토스가 거부한 모든 승인은 코드와 함께 남긴다 — 고객 화면엔 메시지만 나가서, 로그가 없으면
    // '업체 사정으로 결제가 중지되었습니다' 같은 문구만 보고 원인(계약 미개통·한도·카드사 거절)을
    // 추적할 길이 없다(2026-09-07 라이브 첫 결제에서 실제로 겪음).
    console.error('[booking-confirm] 토스 승인 거부', {
      orderNo: order.orderNo,
      paymentKey: input.paymentKey,
      amount: input.amount,
      tossCode: toss.code,
      tossMessage: toss.message,
    });
    if (isInternalError) {
      console.error('[booking-confirm] 토스 승인 내부 오류', {
        orderNo: order.orderNo,
        code: toss.code,
        message: toss.message,
      });
    }
    return { ok: false, code: 'toss_rejected', message: isInternalError ? GENERIC_TOSS_ERROR_MESSAGE : toss.message };
  }

  const isMixing = order.type === 'mixing';
  const booking = order.bookings[0];
  const workOrder = order.workOrders[0];
  let batchResults: unknown[] = [];
  try {
    // payments INSERT가 맨 앞 — paymentKey unique 위반이 동시 확정의 두 번째 시도를
    // batch 전체 실패로 만든다(절반만 쓰인 상태가 남지 않는다).
    // 세션은 bookings pending→confirmed, 믹싱은 work_orders pending→received — 한 주문이
    // 둘 중 하나만 갖는다(db/schema.ts workOrders 주석)는 불변식을 그대로 따른다.
    batchResults = await db.batch([
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
      isMixing
        ? db.update(workOrders)
            .set({ status: 'received', updatedAt: new Date() })
            .where(and(eq(workOrders.orderId, order.id), eq(workOrders.status, 'pending')))
        : db.update(bookings)
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
    if (existing)
      return { ok: true, orderNo: order.orderNo, orderType: order.type === 'mixing' ? 'mixing' : 'session', manageToken: order.manageToken };
    console.error('[booking-confirm] 결제 승인됨, DB 기록 실패 — 웹훅 복구 대기', {
      orderNo: order.orderNo,
      paymentKey: approved.paymentKey,
      error,
    });
    return { ok: false, code: 'recording_failed', message: RECORDING_FAILED_MESSAGE };
  }

  // batch는 성공했지만 orders UPDATE가 0행일 수 있다 — WHERE status='pending'이 걸려 있고,
  // 승인 왕복 사이에 만료·자가 해제·expireStaleOrders가 주문을 pending에서 빼낼 수 있다.
  // 인덱스 1 = 위 batch의 두 번째 항목(orders UPDATE).
  const orderRowsAffected = rowsAffectedOf(batchResults[1]);
  if (orderRowsAffected === 0) return autoCancelStaleApproval(order, approved);

  // 하위 테이블(bookings/work_orders, 인덱스 2)만 0행인 경우는 정상으로 본다 — 이미 confirmed·
  // received로 넘어간 멱등 재생이 대표적이다. 다만 조용히 지나가지는 않는다.
  if (rowsAffectedOf(batchResults[2]) === 0) {
    console.error('[booking-confirm] 하위 테이블 전이 0행 — orders는 전이됨(멱등 재생 등)', {
      orderNo: order.orderNo,
      paymentKey: approved.paymentKey,
      table: isMixing ? 'work_orders' : 'bookings',
    });
  }

  // 후처리 — 결제는 이미 성공했으므로 실패를 삼키되 반드시 기록한다 (스펙 §10).
  let emailSent: boolean | undefined;
  if (isMixing && workOrder) {
    // 믹싱은 슬롯이 없어 캘린더 등록이 없다 — 확정 메일만 보낸다.
    const notifyError = await sendMixingOrderConfirmedEmails({ ...order, status: 'paid' }, workOrder);
    emailSent = !notifyError;
    try {
      await db.update(orders).set({ notificationError: notifyError }).where(eq(orders.id, order.id));
    } catch (error) {
      console.error('[booking-confirm] notificationError 기록 실패', {
        orderNo: order.orderNo,
        notifyError,
        error,
      });
    }
  } else if (!isMixing && booking) {
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
    emailSent = !notifyError;
    try {
      await db.update(orders).set({ notificationError: notifyError }).where(eq(orders.id, order.id));
    } catch (error) {
      console.error('[booking-confirm] notificationError 기록 실패', {
        orderNo: order.orderNo,
        notifyError,
        error,
      });
    }
  } else if (!isMixing) {
    // Phase 1에선 발생 불가(주문 생성이 항상 bookings 1건을 동반) — 상태 불변식이 깨졌을 때의 방어 로그.
    // 믹싱 쪽 방어는 필요 없다 — createMixingOrder가 겹침 검사 없이 항상 work_orders 1건을 만든다.
    console.error('[booking-confirm] bookings 없는 주문 — 후처리 생략', { orderNo: order.orderNo });
  }

  return {
    ok: true,
    orderNo: order.orderNo,
    orderType: isMixing ? 'mixing' : 'session',
    manageToken: order.manageToken,
    emailSent,
  };
};
