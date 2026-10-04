import { randomUUID } from 'node:crypto';

import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { SEND_PENDING } from '../ops/notificationSentinel';
import { BANK_DEPOSIT_GUIDE_DAYS } from '../payments/bankAccount';
import {
  AWAITING_DEPOSIT,
  BANK_DEPOSIT_PAYMENT_METHOD,
  DEPOSIT_CANCELLED,
  bankDepositDeadlineOf,
  bankDepositPaymentKey,
} from '../payments/bankDeposit';
import { recordDepositGuideResult, rowsOf, sendDepositGuideEmails } from '../payments/bankDepositOrders';
import { safeDbErrorSummary } from '../payments/refundAccount';
import { deliverPostConfirmation, ensureBookingEvent, type BookingOrder } from './confirm';
import { calendarForService, deleteBookingEvent } from './gcal';
import { kstDateString } from './kst';
import { getMixingProduct } from './mixing-products';
import { getProduct } from './products';
import { findOrderByOrderNo } from './service';

/**
 * 연습실/녹음 예약·믹싱 주문의 **계좌 입금** 운영 전이 — 입금 확인 · 미입금 취소(입금 전 신청 취소) ·
 * 입금 안내 발송 · 대기 중 캘린더 표시. 생성은 `createBookingOrder`/`createMixingOrder`의
 * `paymentMethod: 'bank_transfer'`이다. 규칙의 근거는 lib/payments/bankDeposit.ts 머리 주석.
 */

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://studionol.co.kr').replace(/\/+$/, '');

export type BookingDepositOutcome =
  | { ok: true; emailSent?: boolean; warnings?: string[] }
  | { ok: false; code: 'not_found' | 'invalid_state'; message: string };

const kstHourLabel = (d: Date): string => {
  const t = new Date(d.getTime() + 9 * 3600 * 1000);
  return `${kstDateString(d)} ${String(t.getUTCHours()).padStart(2, '0')}:00`;
};

/** 입금 안내 기한 — 신청 + 3일, 이용 시작이 더 빠르면 시작 시각까지(믹싱은 시작이 없다). */
export const bookingDepositDeadline = (order: { createdAt: Date }, booking: { startAt: Date } | null | undefined): Date =>
  bankDepositDeadlineOf({ createdAt: order.createdAt, startsAt: booking?.startAt ?? null, guideDays: BANK_DEPOSIT_GUIDE_DAYS });

const manageUrlOf = (order: { orderNo: string; manageToken: string }): string =>
  `${SITE_URL}/ko/booking/manage/${order.orderNo}?token=${order.manageToken}`;

const summaryOf = (order: BookingOrder): { kindLabel: string; applicantLabel: string; lines: string[] } => {
  if (order.type === 'mixing') {
    const w = order.workOrders[0];
    const name = (w && getMixingProduct(w.productId)?.nameKo) ?? w?.serviceType ?? '믹싱·마스터링';
    return {
      kindLabel: '믹싱·마스터링 주문', applicantLabel: '주문하신 분',
      lines: [`상품: ${name}${w ? ` × ${w.songCount}곡${w.vocalTuning ? ' (보컬 튜닝 포함)' : ''}` : ''}`],
    };
  }
  const b = order.bookings[0];
  const name = (b && getProduct(b.productId)?.nameKo) ?? b?.serviceType ?? '예약';
  return {
    kindLabel: b?.serviceType === 'practice-room' ? '연습실 예약' : '스튜디오 예약', applicantLabel: '예약하신 분',
    lines: b
      ? [`상품: ${name}${b.roomNumber ? ` (${b.roomNumber})` : ''}`, `이용 일시: ${kstHourLabel(b.startAt)}부터 ${b.durationHours}시간`,
        '입금을 확인할 때까지 이 시간대는 다른 분이 예약할 수 없게 잡아 둡니다.']
      : [`상품: ${name}`],
  };
};

/**
 * **입금 안내 메일**(고객 + 운영자)을 보내고 결과를 `notification_error`에 남긴다. 신청 직후와 관리자
 * "입금 안내 재발송"이 같은 함수를 쓴다. 입금 대기가 아니면 보내지 않는다. 예외는 삼킨다 — 신청은 이미
 * 만들어졌고 계좌는 안내 화면에도 나온다.
 */
export const deliverBookingDepositGuide = async (orderNo: string): Promise<string | null> => {
  const order = await findOrderByOrderNo(orderNo);
  if (!order || order.status !== AWAITING_DEPOSIT) return 'invalid_state';
  const s = summaryOf(order);
  let failure: string | null;
  try {
    failure = await sendDepositGuideEmails({
      orderNo: order.orderNo, customerName: order.customerName, customerEmail: order.customerEmail,
      customerPhone: order.customerPhone, totalAmount: order.totalAmount,
      deadline: bookingDepositDeadline(order, order.bookings[0]),
      kindLabel: s.kindLabel, applicantLabel: s.applicantLabel, summaryLines: s.lines,
      manageUrl: manageUrlOf(order), adminUrl: `${SITE_URL}/admin/bookings/${order.id}`,
    });
  } catch (error) {
    console.error('[booking-bank-deposit] 입금 안내 메일 발송 중 예외', { orderNo, error: safeDbErrorSummary(error) });
    failure = error instanceof Error ? error.message : String(error);
  }
  await recordDepositGuideResult(order.id, failure);
  return failure;
};

/**
 * 입금 대기 중인 예약을 운영자 캘린더에 **`[입금 대기]`로 올린다.** 온라인 예약은 DB 점유
 * (occupiedBookingSql)가 막지만, 캘린더는 운영자가 보는 일정표이고 손으로 넣은 일정도 웹 예약을 막는
 * 자리라(pages/api/bookings/slots.ts) 그 시간이 비어 보이면 전화 예약이 그 위에 들어갈 수 있다.
 * 실패는 삼킨다(DB 점유가 정본이다). 확정 때 `[예약]` 일정을 새로 만들고 이 일정은 지운다.
 */
export const holdBookingOnCalendar = async (orderNo: string): Promise<void> => {
  try {
    const order = await findOrderByOrderNo(orderNo);
    const booking = order?.bookings[0];
    if (!order || order.type !== 'session' || order.status !== AWAITING_DEPOSIT || !booking || booking.gcalEventId) return;
    await ensureBookingEvent(order, booking, { label: '[입금 대기]', recordError: false });
  } catch (error) {
    console.error('[booking-bank-deposit] 입금 대기 캘린더 표시 실패', { orderNo, error: safeDbErrorSummary(error) });
  }
};

/** 캘린더 일정을 지운다(best-effort). 실패는 gcalError로 남겨 관리자 화면이 보이게 한다. */
const removeCalendarEvent = async (booking: BookingOrder['bookings'][number], eventId: string, context: string): Promise<void> => {
  try {
    await deleteBookingEvent(eventId, calendarForService(booking.serviceType), booking.roomNumber);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[booking-bank-deposit] 캘린더 일정 삭제 실패', { bookingId: booking.id, context, detail });
    await getDb().run(sql`UPDATE bookings SET gcal_error = ${`delete(${context}): ${detail}`} WHERE id = ${booking.id}`).catch(() => {});
  }
};

const findById = async (orderId: string): Promise<BookingOrder | undefined> =>
  getDb().query.orders.findFirst({
    where: (t, { eq }) => eq(t.id, orderId),
    with: { bookings: true, payments: { with: { refunds: true } }, workOrders: true },
  });

/**
 * **입금 확인** — 운영자가 통장에서 입금을 확인하고 누른다. `awaiting_deposit` → `paid`.
 *
 * - 낙관적 조건 한 문장: `UPDATE … WHERE status = 'awaiting_deposit'`. 두 번 눌러도(두 운영자가 동시에 눌러도)
 *   1행은 한쪽뿐이고 다른 쪽은 "이미 처리됨"을 받는다. 미입금 취소로 닫힌 건(`deposit_cancelled`)은 확정하지
 *   않는다 — 그 사이 시간대가 풀려 다른 사람이 잡았을 수 있다. 늦은 입금은 다시 신청받거나 돌려준다.
 * - 같은 batch에서 결제 행(`bankDepositPaymentKey`)을 남기고 예약 pending→confirmed / 믹싱 pending→received.
 *   결제 행이 있어야 매출장부·환불 기록·잔액 계산이 토스 결제와 같은 원장으로 돈다.
 * - 그다음은 토스 확정과 **같은 후처리**(`deliverPostConfirmation`) — `send_pending` 센티널 선점, 확정 일정
 *   캘린더 등록, 확정 메일. 대기 중 올려 둔 `[입금 대기]` 일정은 확정 일정을 만든 **뒤에** 지운다(반대 순서면
 *   생성이 실패했을 때 캘린더에서 이 예약이 사라진다 — retry-gcal과 같은 순서).
 */
export const confirmBookingBankDeposit = async (input: { orderId: string; now: Date }): Promise<BookingDepositOutcome> => {
  const order = await findById(input.orderId);
  if (!order || (order.type !== 'session' && order.type !== 'mixing')) {
    return { ok: false, code: 'not_found', message: '주문을 찾을 수 없습니다.' };
  }
  const db = getDb();
  const approvedAt = Math.floor(input.now.getTime() / 1000);
  const paymentKey = bankDepositPaymentKey(order.orderNo);
  const isPaidNow = sql`EXISTS (SELECT 1 FROM orders WHERE id = ${order.id} AND status = 'paid')`;
  const waitingEventId = order.type === 'session' ? order.bookings[0]?.gcalEventId ?? null : null;
  const [claim] = await db.batch([
    db.run(sql`
      UPDATE orders SET status = 'paid', notification_error = ${SEND_PENDING}, updated_at = unixepoch()
      WHERE id = ${order.id} AND status = ${AWAITING_DEPOSIT}
    `),
    db.run(sql`
      INSERT INTO payments (id, order_id, payment_key, method, approved_at, receipt_url, raw_response)
      SELECT ${randomUUID().replace(/-/g, '')}, ${order.id}, ${paymentKey}, ${BANK_DEPOSIT_PAYMENT_METHOD}, ${approvedAt}, NULL, NULL
      WHERE ${isPaidNow} AND NOT EXISTS (SELECT 1 FROM payments WHERE payment_key = ${paymentKey})
    `),
    order.type === 'mixing'
      ? db.run(sql`
          UPDATE work_orders SET status = 'received', updated_at = unixepoch()
          WHERE order_id = ${order.id} AND status = 'pending' AND ${isPaidNow}
        `)
      // 대기 일정 id는 비워 둔다 — 후처리가 "아직 확정 일정이 없다"로 읽고 [예약] 일정을 새로 만든다.
      : db.run(sql`
          UPDATE bookings SET status = 'confirmed', gcal_event_id = NULL, updated_at = unixepoch()
          WHERE order_id = ${order.id} AND status = 'pending' AND ${isPaidNow}
        `),
  ]);
  if (rowsOf(claim) === 0) {
    return { ok: false, code: 'invalid_state', message: '이미 확인됐거나 입금을 확인할 수 있는 상태가 아닙니다(미입금 취소된 신청은 확정할 수 없습니다). 새로고침해 주세요.' };
  }

  const fresh = (await findById(order.id)) ?? order;
  const emailSent = await deliverPostConfirmation(fresh);
  const warnings: string[] = [];
  const booking = fresh.bookings[0];
  if (booking && waitingEventId) await removeCalendarEvent(booking, waitingEventId, 'deposit-confirmed');
  if (booking && booking.startAt.getTime() <= input.now.getTime()) {
    warnings.push('이용 시작 시각이 이미 지난 예약입니다 — 고객과 이용 여부를 확인하고, 이용하지 못했다면 환불해 주세요.');
  }
  return { ok: true, emailSent, ...(warnings.length ? { warnings } : {}) };
};

/**
 * **입금 전 신청을 닫는다** — 관리자 "미입금 취소"와 고객 "입금 전 신청 취소"가 같은 전이다.
 * `awaiting_deposit` → `deposit_cancelled`, 같은 batch에서 예약·믹싱 행을 cancelled로(시간대가 바로 풀린다).
 * 받은 돈이 없으니 환불이 아니고 **메일도 없다**(SAF2026: 늦게 입금한 사람에게 "취소됨"이 갔다).
 * `notification_error`도 비운다 — 닫힌 신청에 보낼 메일이 없는데 입금 안내 실패가 남아 있으면 헬스체크
 * 경보를 끌 길이 없다(펀딩과 같은 판단).
 */
export const cancelAwaitingBookingDeposit = async (input: { orderId: string }): Promise<BookingDepositOutcome> => {
  const order = await findById(input.orderId);
  if (!order || (order.type !== 'session' && order.type !== 'mixing')) {
    return { ok: false, code: 'not_found', message: '주문을 찾을 수 없습니다.' };
  }
  const db = getDb();
  const isClosed = sql`EXISTS (SELECT 1 FROM orders WHERE id = ${order.id} AND status = ${DEPOSIT_CANCELLED})`;
  const [claim] = await db.batch([
    db.run(sql`
      UPDATE orders SET status = ${DEPOSIT_CANCELLED}, notification_error = NULL, updated_at = unixepoch()
      WHERE id = ${order.id} AND status = ${AWAITING_DEPOSIT}
    `),
    db.run(sql`
      UPDATE bookings SET status = 'cancelled', cancelled_at = unixepoch(), updated_at = unixepoch()
      WHERE order_id = ${order.id} AND status = 'pending' AND ${isClosed}
    `),
    db.run(sql`
      UPDATE work_orders SET status = 'cancelled', cancelled_at = unixepoch(), updated_at = unixepoch()
      WHERE order_id = ${order.id} AND status = 'pending' AND ${isClosed}
    `),
  ]);
  if (rowsOf(claim) === 0) {
    return { ok: false, code: 'invalid_state', message: '입금 대기 중인 계좌 입금 신청이 아닙니다. 새로고침해 주세요.' };
  }
  const booking = order.bookings[0];
  if (booking?.gcalEventId) await removeCalendarEvent(booking, booking.gcalEventId, 'deposit-cancelled');
  return { ok: true };
};

/** 고객 화면(예약 확인 페이지)이 입금 안내를 그릴 때 쓰는 값 — 금액·기한은 서버가 다시 읽은 것. */
export const bookingDepositGuideProps = (order: BookingOrder): { amount: number; deadline: string; customerName: string; applicantLabel: string } => ({
  amount: order.totalAmount,
  deadline: bookingDepositDeadline(order, order.bookings[0]).toISOString(),
  customerName: order.customerName,
  applicantLabel: order.type === 'mixing' ? '주문하신 분' : '예약하신 분',
});
