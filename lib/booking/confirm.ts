import { and, eq, inArray, sql } from 'drizzle-orm';

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

/**
 * "이 주문의 결제가 실제로 거절됐다"고 단정할 수 있는 토스 코드 — **allowlist**다
 * (lib/funding/confirm.ts와 같은 판단·같은 패턴. 두 모듈의 import 그래프를 섞지 않으려고
 * ALREADY_PROCESSED_CODE처럼 의도적으로 복제해 둔다).
 *
 * 예전에는 denylist였다 — NOT_FOUND_PAYMENT 계열만 빼고 나머지 전부를 failed로 낙인했다.
 * 그러면 목록 밖 코드(INVALID_REQUEST·UNAUTHORIZED_KEY·FORBIDDEN_REQUEST…)로도 낙인이 되고,
 * 주문번호는 비밀이 아니므로 제3자가 `?paymentKey=아무거나&orderId=<주문번호>`로 남의 주문을
 * failed로 만들 수 있었다. allowlist면 모르는 코드는 주문을 건드리지 않고 pending으로 남아
 * 선점 만료 또는 웹훅이 결론을 낸다 — 과소 낙인은 스스로 치유되지만 과대 낙인은 아니다.
 *
 * 접두사로 보는 이유: 거절 코드는 카드사·계좌 사유별로 계속 늘어나는 계열이라
 * (REJECT_CARD_COMPANY·INVALID_CARD_EXPIRATION·EXCEED_MAX_DAILY_PAYMENT_COUNT…)
 * 개별 열거는 금세 낡는다.
 */
const DECLINE_CODE_PATTERN =
  /^(REJECT_|INVALID_REJECT_CARD|EXCEED_MAX_|INVALID_CARD|INVALID_STOPPED_CARD$|INVALID_ACCOUNT_INFO|NOT_ENOUGH_BALANCE$|NOT_AVAILABLE_BANK$|CARD_PROCESSING_ERROR$|PAY_PROCESS_(CANCELED|ABORTED)$)/;

/** 고객 결제수단이 실제로 거절된 경우인가 — 참일 때만 orders.status를 failed로 낙인한다. */
const isCustomerDecline = (code: string): boolean => DECLINE_CODE_PATTERN.test(code);

/**
 * "확정은 됐는데 확정 메일을 아직 못 보냈다"는 센티널 (lib/funding/confirm.ts와 같은 장치).
 *
 * batch(주문 pending→paid 전이)와 같은 트랜잭션에 써 넣고 메일 발송이 끝나야 지운다. 예전엔
 * batch 직후 메일 단계에서 프로세스가 죽으면(타임아웃·배포 중 종료) 확정 메일이 영영 나가지
 * 않았다 — 뒤이어 오는 웹훅 재시도는 status가 이미 paid라 조기 반환했고, notificationError가
 * null이라 healthCheck의 '메일 실패' 목록에도 안 잡혔다. 이제 웹훅은 센티널이 남아 있으면
 * 메일만 다시 보내고, 그전까지는 healthCheck가 이 주문을 들고 있다.
 */
const SEND_PENDING = 'send_pending';

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
export const rowsAffectedOf = (result: unknown): number | undefined => {
  if (!result || typeof result !== 'object' || !('rowsAffected' in result)) return undefined;
  const value = (result as { rowsAffected: unknown }).rowsAffected;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * 승인은 끝났는데 orders pending→paid 전이가 0행인 경우의 자동 복구.
 *
 * 0행이 되는 경우는 두 가지다.
 *  ① 승인 요청과 승인 응답 사이에 그 주문이 확정 대상 상태를 벗어났다 — expireStaleOrders가
 *     만료시켰거나(세션은 900초, 믹싱은 24시간), 같은 고객의 재제출이 자가 선점 해제로
 *     expired를 찍었거나.
 *  ② 웹훅 신뢰 경로가 **선점이 이미 풀린 세션 주문**을 들고 왔다. 이때 order.status는
 *     여전히 'pending'일 수 있다 — batch WHERE의 sessionHoldGuard(created_at 기준)가
 *     상태와 무관하게 매치를 막기 때문이다. 즉 "0행 = 주문이 pending이 아니다"는 더 이상
 *     성립하지 않는다. 이 경로를 만든 이유는 그 주문을 확정하면 다른 고객이 이미 확정한
 *     슬롯에 confirmed 예약이 하나 더 생기기 때문이다.
 * 어느 쪽이든 이대로 두면 돈만 들어오고 주문은 확정되지 않은 채 남는다(관리자 화면 mismatch).
 * 전액을 즉시 되돌려 그 상태를 만들지 않는다.
 *
 * 멱등키는 cancel.ts의 refundIdempotencyKey를 쓰되 접두사를 'autocancel'로 분리한다. 같은 접두사를
 * 쓰면 이 자동 취소가 실패한 뒤 관리자가 같은 주문·같은 금액(전액)으로 수동 환불을 넣을 때
 * 토스가 15일 안의 **실패 응답**을 replay해 영영 환불되지 않는다. 접두사만 다르면 이 경로의
 * 재시도(웹훅 DONE 복구)는 여전히 서로 replay되어 이중 환불을 막는다.
 *
 * orders는 건드리지 않는다 — ①이면 이미 expired/failed이고, ②면 pending인 채로 홀드가
 * 지났을 뿐이라 곧 expireStaleOrders가 정리한다. 여기서 다른 상태를 덮어쓰면 어떤 경로가
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

/**
 * 확정 메일 발송 — 예외를 삼켜 실패 사유 문자열로 바꾼다.
 *
 * 결제는 이미 승인·기록이 끝난 뒤라, 메일 라이브러리가 던진 예외가 confirmBookingPayment
 * 밖으로 새면 완료 화면은 "결제를 확정하지 못했습니다"를 띄운다 — 돈은 빠져나갔고 주문은
 * paid인데 고객은 실패로 읽는다. 실패는 notificationError로만 남긴다(스펙 §10).
 */
const deliverConfirmedEmails = async (send: () => Promise<string | null>): Promise<string | null> => {
  try {
    return await send();
  } catch (error) {
    console.error('[booking-confirm] 확정 메일 발송 중 예외', { error });
    return error instanceof Error ? error.message : String(error);
  }
};

type BookingOrder = NonNullable<Awaited<ReturnType<typeof findOrderByOrderNo>>>;

/** 멱등 재생(새로고침·웹훅 재도착)에서 돌려주는 성공 결과 — 이번 호출이 메일을 보내지 않았으므로 emailSent는 없다. */
const replay = (order: BookingOrder): ConfirmOutcome => ({
  ok: true,
  orderNo: order.orderNo,
  orderType: order.type === 'mixing' ? 'mixing' : 'session',
  manageToken: order.manageToken,
});

/** notificationError 확정 기록 — 실패해도 확정 결과를 뒤집지 않는다(스펙 §10). */
const recordNotification = async (orderId: string, orderNo: string, notifyError: string | null): Promise<void> => {
  try {
    await getDb().update(orders).set({ notificationError: notifyError }).where(eq(orders.id, orderId));
  } catch (error) {
    console.error('[booking-confirm] notificationError 기록 실패', { orderNo, notifyError, error });
  }
};

/** 하위 행이 없어 후처리를 못 한 주문에 남기는 사유 — 센티널이 아니라 사람이 읽을 실패다. */
const MISSING_ROW_NOTICE = '확정 후처리 대상 행 없음(bookings·work_orders 부재) — 수동 확인 필요';

/** 캘린더 등록. 실패는 확정을 뒤집지 않고 bookings.gcalError에만 남는다. */
const ensureBookingEvent = async (
  order: BookingOrder,
  booking: BookingOrder['bookings'][number],
): Promise<void> => {
  const db = getDb();
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
};

/**
 * 확정 후처리 — 캘린더 등록 + 확정 메일 + notificationError 기록. 확정 경로와 웹훅 센티널
 * 복구 경로가 **같은 함수**를 쓴다.
 *
 * 소유권은 센티널 선점으로 정한다(취소 가드와 같은 패턴 — 읽어서 검사하지 않고
 * `UPDATE … WHERE notification_error = 'send_pending'`으로 하나만 이기게 한다). 이게 없으면
 * SSR 확정이 gcal(0.2~0.8초)+메일(0.3~1.5초)을 처리하는 동안 **바로 그 승인이 유발한**
 * 토스 DONE 웹훅이 1~3초 안에 도착해 status='paid' + 센티널을 보고 같은 일을 한 번 더 한다 —
 * 확정 메일 2통, 캘린더 이벤트 2건. rowsAffected 1을 받은 쪽만 후처리를 수행한다.
 *
 * 반환값은 ConfirmOutcome.emailSent의 의미 그대로다 — undefined는 "이번 호출이 보내지 않았다".
 */
const deliverPostConfirmation = async (order: BookingOrder): Promise<boolean | undefined> => {
  const isMixing = order.type === 'mixing';
  const booking = order.bookings[0];
  const workOrder = order.workOrders[0];

  const claim = await getDb().run(
    sql`UPDATE orders SET notification_error = NULL WHERE id = ${order.id} AND notification_error = ${SEND_PENDING}`,
  );
  if (Number(claim.rowsAffected) !== 1) {
    console.error('[booking-confirm] 확정 후처리를 다른 경로가 이미 선점 — 중복 발송하지 않는다', {
      orderNo: order.orderNo,
    });
    return undefined;
  }

  if (isMixing ? !workOrder : !booking) {
    // Phase 1에선 발생 불가(주문 생성이 항상 하위 1건을 동반) — 상태 불변식이 깨졌을 때의 방어.
    // 센티널은 위 선점에서 이미 지워졌다. 그대로 두면 healthCheck의 '메일 실패' 목록에
    // send_pending으로 영구 잔류하므로, 사람이 읽을 수 있는 사유로 바꿔 남긴다.
    console.error('[booking-confirm] bookings 없는 주문 — 후처리 생략', { orderNo: order.orderNo, isMixing });
    await recordNotification(order.id, order.orderNo, MISSING_ROW_NOTICE);
    return false;
  }

  // 세션만 캘린더를 쓴다(믹싱은 점유할 슬롯이 없다). gcalEventId·gcalError가 **둘 다 null**이면
  // 등록을 시도조차 못 한 것이다 — batch 직후 프로세스가 죽어 센티널만 남은 복구 건이 정확히
  // 그 상태다. 여기서 만들지 않으면 운영자 캘린더가 빈 채 confirmed 예약이 남고, healthCheck는
  // gcalError가 null이라 이 주문을 잡지 못해 전화 이중예약으로 간다.
  // 값이 하나라도 있으면 다시 만들지 않는다 — 복구 경로가 중복 이벤트를 만들지 않게 하는 조건이다.
  if (!isMixing && booking && !booking.gcalEventId && !booking.gcalError) {
    await ensureBookingEvent(order, booking);
  }

  const notifyError = await deliverConfirmedEmails(() =>
    isMixing
      ? sendMixingOrderConfirmedEmails({ ...order, status: 'paid' }, workOrder)
      : sendBookingConfirmedEmails({ ...order, status: 'paid' }, booking),
  );
  await recordNotification(order.id, order.orderNo, notifyError);
  return !notifyError;
};

export const confirmBookingPayment = async (
  input: {
    orderNo: string;
    paymentKey: string;
    amount: number;
  },
  /**
   * 웹훅 경로 표식 — 펀딩(lib/funding/confirm.ts)과 같은 형태.
   *
   * 이 옵션이 켜진 호출은 토스 재조회로 status DONE + 금액이 이미 검증된 뒤에 온다. 그래서
   * 과거에 찍힌 failed·expired를 이유로 거절하지 않는다 — 거절하면 이미 승인된 돈이 영구
   * 미기록으로 남고, 그 사실은 고객이 먼저 발견한다. 금액 검증·DONE 검증은 그대로 유지된다.
   */
  options: { trustedByWebhook?: boolean } = {},
): Promise<ConfirmOutcome> => {
  const order = await findOrderByOrderNo(input.orderNo);
  if (!order) return { ok: false, code: 'not_found', message: '주문을 찾을 수 없습니다.' };

  // success 페이지 새로고침·웹훅 중복 도착 멱등성 — 단, 소유 증명이 있을 때만이다.
  //
  // 이 분기는 manageToken을 그대로 돌려주고, success.tsx는 그 토큰으로 manage URL을 만들어
  // props(=HTML)에 박는다. 주문번호는 비밀이 아니다(확인 메일·화면·토스 영수증·fail URL에
  // 평문) — 여기서 paymentKey를 보지 않으면 `?paymentKey=아무거나&orderId=<주문번호>&amount=1`
  // 한 번으로 남의 관리 토큰이 발급되고, 그 토큰이면 개인정보 열람과 전액 환불이 가능하다.
  // 진짜 고객의 새로고침·웹훅 재도착은 둘 다 그 주문의 실제 paymentKey를 갖고 온다.
  if (order.status === 'paid') {
    if (options.trustedByWebhook) {
      // 웹훅은 fetchPayment로 DONE + 금액을 이미 재검증하고 온 신뢰 경로다. 다만 확정 메일
      // 센티널이 남아 있으면 "확정은 됐는데 메일이 안 나간" 주문이므로, 조기 반환하지 않고
      // 메일만 다시 보낸다(펀딩 confirm과 같은 복구 경로).
      if (order.notificationError !== SEND_PENDING) return replay(order);
      // 복구 대상은 "batch는 커밋됐는데 후처리 직전에 죽은" 주문이다 — 메일만이 아니라
      // 캘린더 등록도 건너뛴 상태다. deliverPostConfirmation이 둘 다 본다.
      console.error('[booking-confirm] 확정 후처리 미완 센티널 발견 — 웹훅 경로에서 복구', {
        orderNo: order.orderNo,
      });
      const emailSent = await deliverPostConfirmation(order);
      return { ...(replay(order) as Extract<ConfirmOutcome, { ok: true }>), emailSent };
    }
    const provesOwnership =
      input.amount === order.totalAmount && order.payments.some((p) => p.paymentKey === input.paymentKey);
    if (!provesOwnership) {
      console.error('[booking-confirm] 확정된 주문에 소유 증명 없는 접근 — 관리 토큰을 발급하지 않는다', {
        orderNo: order.orderNo,
        paymentKey: input.paymentKey,
      });
      return { ok: false, code: 'invalid_state', message: '이미 처리되었거나 만료된 주문입니다.' };
    }
    return replay(order);
  }
  // 웹훅 경로는 expired·failed도 받는다 — 펀딩(lib/funding/confirm.ts)과 같은 집합이다.
  // 네트워크·설정 오류로 failed가 찍힌 과거 주문, expireStaleOrders가 먼저 돌아 expired가 된
  // 주문이라도 웹훅은 재조회로 DONE + 금액을 확인한 뒤에 온다. 여기서 거절하면 승인된 돈이
  // 영구 미기록으로 남는다.
  // **되살릴지 되돌릴지는 아래 batch가 정한다** — 세션은 슬롯이 걸려 있어 선점이 이미 풀린
  // 주문은 batch가 0행이 되고 autoCancelStaleApproval이 전액을 자동 환불한다(이중 예약 방지).
  // refunded·partially_refunded·cancelled는 웹훅이라도 거부한다 — 이미 결론이 난 주문이다.
  const acceptableStatuses: Order['status'][] = options.trustedByWebhook
    ? ['pending', 'expired', 'failed']
    : ['pending'];
  if (!acceptableStatuses.includes(order.status)) {
    if (options.trustedByWebhook) {
      console.error('[booking-confirm] 웹훅이 확정 불가 상태의 주문을 만남 — 수동 대사 필요', {
        orderNo: order.orderNo,
        paymentKey: input.paymentKey,
        status: order.status,
      });
    }
    return { ok: false, code: 'invalid_state', message: '이미 처리되었거나 만료된 주문입니다.' };
  }

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
  //
  // 웹훅 경로는 여기서 거절하지 않는다 — 그 결제는 이미 승인된 돈이라, 거절하면 기록도 환불도
  // 없이 사라진다. 대신 같은 조건을 아래 batch의 WHERE(sessionHoldGuard)에 걸어 두어 0행 →
  // autoCancelStaleApproval(전액 자동 환불)로 보낸다. 이중 예약은 여전히 만들지 않으면서,
  // 고객에게 돈은 돌아간다. 조건을 SQL에 두면 읽기와 batch 사이에 홀드가 지나는 경합도 막힌다.
  const sessionHoldExpired =
    order.type === 'session' &&
    order.createdAt instanceof Date &&
    Date.now() - order.createdAt.getTime() > PENDING_HOLD_SECONDS * 1000;
  if (sessionHoldExpired && !options.trustedByWebhook) {
    console.error('[booking-confirm] 선점 만료 주문의 승인 요청 — 토스를 부르지 않고 거부', {
      orderNo: order.orderNo,
      createdAt: (order.createdAt as Date).toISOString(),
    });
    return { ok: false, code: 'invalid_state', message: EXPIRED_MESSAGE };
  }

  const db = getDb();
  const toss = await confirmPayment({ paymentKey: input.paymentKey, orderId: order.orderNo, amount: input.amount });

  let approved: TossPayment;
  if (toss.ok) {
    // 200이 곧 DONE은 아니다 — 가상계좌 승인 응답은 입금 0원인 WAITING_FOR_DEPOSIT으로 온다.
    // 그대로 확정하면 돈이 안 들어온 주문이 paid + 확정 메일 + 슬롯 점유가 되고, 뒤따르는
    // EXPIRED 웹훅에는 처리 경로가 없어 영구 paid로 남는다. 아래 ALREADY_PROCESSED 재조회
    // 분기가 이미 DONE을 요구하고 있었으니(비대칭) 여기서도 같은 기준을 적용한다.
    // 주문은 pending으로 남겨 둔다 — 실제 입금되면 DONE 웹훅이 정상 경로로 확정한다.
    if (toss.payment.status !== 'DONE') {
      console.error('[booking-confirm] 승인 응답이 DONE이 아님 — 확정하지 않는다', {
        orderNo: order.orderNo,
        paymentKey: input.paymentKey,
        status: toss.payment.status,
      });
      return { ok: false, code: 'toss_rejected', message: GENERIC_TOSS_ERROR_MESSAGE };
    }
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
    // CONFIG_ERROR·NETWORK_ERROR는 우리 쪽 설정·네트워크 문제라 원문을 그대로 보이면
    // 내부 구성(비밀키 누락 등)이 새어나간다 — 고객에겐 일반 문구, 원문은 서버 로그에만.
    const isInternalError = toss.code === 'CONFIG_ERROR' || toss.code === 'NETWORK_ERROR';
    // CONFIG_ERROR·NETWORK_ERROR는 "토스가 거절했다"가 아니라 "물어보지도 못했다"이다 —
    // 실제로는 승인이 성사됐을 수 있으므로 failed로 확정하지 않는다.
    // 그 밖의 코드는 **거절 계열(allowlist)일 때만** 낙인한다. 모르는 코드까지 낙인하면
    // 제3자가 주문번호만으로 남의 주문을 망가뜨릴 수 있다(위 DECLINE_CODE_PATTERN 주석).
    const isDeclined = !isInternalError && isCustomerDecline(toss.code);
    if (isDeclined) {
      await db.run(sql`UPDATE orders SET status = 'failed', updated_at = unixepoch() WHERE id = ${order.id} AND status = 'pending'`);
    }
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
    return {
      ok: false,
      code: 'toss_rejected',
      message: isDeclined ? toss.message : GENERIC_TOSS_ERROR_MESSAGE,
    };
  }

  const isMixing = order.type === 'mixing';
  // 선점이 풀린 세션 주문은 status가 무엇이든 이 batch에 매치되면 안 된다 — 매치되면 이미
  // 다른 고객이 확정한 슬롯에 confirmed 예약이 하나 더 생긴다. 0행이 되면 아래
  // autoCancelStaleApproval이 전액을 자동으로 되돌린다. 믹싱은 점유할 슬롯이 없어 제외한다.
  const sessionHoldGuard =
    order.type === 'session' ? sql`${orders.createdAt} > unixepoch() - ${PENDING_HOLD_SECONDS}` : undefined;
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
      // notificationError에 센티널을 함께 쓴다 — 아래 메일 단계에서 프로세스가 죽어도(타임아웃·
      // 배포 중 종료) 웹훅 재시도가 "메일이 아직 안 나갔다"를 읽고 재발송할 수 있어야 하고,
      // 그전까지는 healthCheck가 이 주문을 '메일 실패'로 들고 있어야 한다(펀딩과 같은 장치).
      db.update(orders)
        .set({ status: 'paid', updatedAt: new Date(), notificationError: SEND_PENDING })
        .where(and(eq(orders.id, order.id), inArray(orders.status, acceptableStatuses), sessionHoldGuard)),
      // 하위 전이는 **주문이 실제로 paid가 됐을 때만** 한다. 같은 batch = 같은 트랜잭션이라
      // 바로 위 UPDATE의 결과를 읽는다. 예전엔 이 조건이 없어서, orders 전이가 0행이라
      // autoCancelStaleApproval이 전액을 되돌리는 경우에도 bookings만 confirmed로 남았다 —
      // 취소된 결제로 슬롯이 점유된 유령 예약이다.
      isMixing
        ? db.update(workOrders)
            .set({ status: 'received', updatedAt: new Date() })
            .where(
              and(
                eq(workOrders.orderId, order.id),
                eq(workOrders.status, 'pending'),
                sql`EXISTS (SELECT 1 FROM orders WHERE id = ${order.id} AND status = 'paid')`,
              ),
            )
        : db.update(bookings)
            .set({ status: 'confirmed', updatedAt: new Date() })
            .where(
              and(
                eq(bookings.orderId, order.id),
                eq(bookings.status, 'pending'),
                sql`EXISTS (SELECT 1 FROM orders WHERE id = ${order.id} AND status = 'paid')`,
              ),
            ),
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
  // 센티널 선점이 이 안에 있다: 같은 승인이 유발한 토스 DONE 웹훅이 후처리 중에 도착해도
  // 확정 메일·캘린더 이벤트가 두 번 만들어지지 않는다.
  const emailSent = await deliverPostConfirmation(order);

  return {
    ok: true,
    orderNo: order.orderNo,
    orderType: isMixing ? 'mixing' : 'session',
    manageToken: order.manageToken,
    emailSent,
  };
};
