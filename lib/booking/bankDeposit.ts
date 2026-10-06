import { randomUUID } from 'node:crypto';

import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { formatPriceAmount } from '../../data/pricing';
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
import { allowCustomerDepositGuideMail } from '../payments/depositGuideThrottle';
import { safeDbErrorSummary } from '../payments/refundAccount';
import { deliverPostConfirmation, ensureBookingEvent, type BookingOrder } from './confirm';
import { sendDepositLinkPaidEmail } from './email';
import { calendarForService, deleteBookingEvent, renameBookingEvent } from './gcal';
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

/** 예약금 결제 링크 주문(`orders.type = 'deposit'`) — 하위 표가 없고, 고객용 관리 화면(booking/manage)도 없다. */
const isDepositLink = (order: { type: string }): boolean => order.type === 'deposit';

const summaryOf = (order: BookingOrder): { kindLabel: string; applicantLabel: string; lines: string[] } => {
  if (isDepositLink(order)) {
    // 품목명은 DB에 저장하지 않는다(data/paymentLinks.ts) — 고정 문구만.
    return {
      kindLabel: '예약금', applicantLabel: '신청하신 분',
      lines: [`예약금 ${formatPriceAmount(order.totalAmount)}원 (VAT 포함)`],
    };
  }
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
export const deliverBookingDepositGuide = async (
  orderNo: string,
  opts: { throttleCustomer?: boolean } = {},
): Promise<string | null> => {
  const order = await findOrderByOrderNo(orderNo);
  if (!order || order.status !== AWAITING_DEPOSIT) return 'invalid_state';
  const s = summaryOf(order);
  let failure: string | null;
  try {
    const skipCustomer = opts.throttleCustomer ? !(await allowCustomerDepositGuideMail(order.customerEmail)) : false;
    failure = await sendDepositGuideEmails({
      skipCustomer,
      orderNo: order.orderNo, customerName: order.customerName, customerEmail: order.customerEmail,
      customerPhone: order.customerPhone, totalAmount: order.totalAmount,
      deadline: bookingDepositDeadline(order, order.bookings[0]),
      kindLabel: s.kindLabel, applicantLabel: s.applicantLabel, summaryLines: s.lines,
      manageUrl: isDepositLink(order) ? undefined : manageUrlOf(order), adminUrl: `${SITE_URL}/admin/bookings/${order.id}`,
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

/**
 * 미입금 취소된 예약의 **[입금 대기] 일정을 지운다**. 성공하면 `gcal_event_id`를 비우고, 실패하면 id를 남긴 채
 * `gcal_error`에 `waiting_delete:` 사유를 적는다 — 예약은 cancelled라 관리자 "캘린더 재등록"은 열리지 않고
 * (확정 일정을 지울 경로가 없다), 헬스체크가 "남은 입금 대기 일정"으로 보고하며 관리자 상세의 "대기 일정 지우기"
 * (`retryWaitingEventDelete`)로 다시 지운다. 남은 일정은 캘린더 바쁨으로 읽혀 웹 예약을 계속 막는다.
 */
export const removeWaitingCalendarEvent = async (
  booking: Pick<BookingOrder['bookings'][number], 'id' | 'serviceType' | 'roomNumber'>, eventId: string,
): Promise<boolean> => {
  try {
    await deleteBookingEvent(eventId, calendarForService(booking.serviceType), booking.roomNumber);
    await getDb().run(sql`UPDATE bookings SET gcal_event_id = NULL, gcal_error = NULL WHERE id = ${booking.id} AND gcal_event_id = ${eventId}`);
    return true;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[booking-bank-deposit] 입금 대기 일정 삭제 실패', { bookingId: booking.id, detail });
    await getDb().run(sql`UPDATE bookings SET gcal_error = ${`${WAITING_DELETE_ERROR_PREFIX}${detail}`} WHERE id = ${booking.id}`).catch(() => {});
    return false;
  }
};

/** `gcal_error`가 이 접두사면 "지우지 못한 입금 대기 일정"이다 — 헬스체크·관리자 화면이 확정 일정 오류와 가른다. */
export const WAITING_DELETE_ERROR_PREFIX = 'waiting_delete: ';

/** 관리자 "대기 일정 지우기" — 미입금 취소된 예약에 남은 [입금 대기] 일정을 다시 지운다. */
export const retryWaitingEventDelete = async (orderId: string): Promise<{ ok: boolean; message?: string }> => {
  const order = await findById(orderId);
  const booking = order?.bookings[0];
  if (!order || order.status !== DEPOSIT_CANCELLED || !booking?.gcalEventId) {
    return { ok: false, message: '지울 입금 대기 일정이 없습니다.' };
  }
  return (await removeWaitingCalendarEvent(booking, booking.gcalEventId))
    ? { ok: true }
    : { ok: false, message: '캘린더 일정을 지우지 못했습니다. 잠시 뒤 다시 누르거나 구글 캘린더에서 직접 지운 뒤 다시 눌러 주세요.' };
};

const findById = async (orderId: string): Promise<BookingOrder | undefined> =>
  getDb().query.orders.findFirst({
    where: (t, { eq }) => eq(t.id, orderId),
    with: { bookings: true, payments: { with: { refunds: true } }, workOrders: true },
  });

/**
 * 예약금 결제 링크 주문의 **입금 확인** — 하위 표(예약·믹싱)가 없고 캘린더·확정 후처리도 없다.
 * `awaiting_deposit` → `paid` + 결제 행(`bankDepositPaymentKey`)을 한 batch로, 낙관적 조건 한 문장이라
 * 두 번 눌러도 한쪽만 이긴다. 그다음 고객에게 "입금 확인" 메일 한 통 — 입금 안내 메일이 약속한 알림이다.
 * 메일 실패는 확정을 뒤집지 않고 `notification_error`에 사유를 남긴다(헬스체크가 본다).
 * `send_pending` 센티널은 쓰지 않는다 — 이어받아 처리할 후처리가 없다.
 */
const confirmDepositLinkBankDeposit = async (order: BookingOrder, now: Date): Promise<BookingDepositOutcome> => {
  const db = getDb();
  const paymentKey = bankDepositPaymentKey(order.orderNo);
  const isPaidNow = sql`EXISTS (SELECT 1 FROM orders WHERE id = ${order.id} AND status = 'paid')`;
  const [claim] = await db.batch([
    db.run(sql`
      UPDATE orders SET status = 'paid', notification_error = NULL, updated_at = unixepoch()
      WHERE id = ${order.id} AND status = ${AWAITING_DEPOSIT}
    `),
    db.run(sql`
      INSERT INTO payments (id, order_id, payment_key, method, approved_at, receipt_url, raw_response)
      SELECT ${randomUUID().replace(/-/g, '')}, ${order.id}, ${paymentKey}, ${BANK_DEPOSIT_PAYMENT_METHOD}, ${Math.floor(now.getTime() / 1000)}, NULL, NULL
      WHERE ${isPaidNow} AND NOT EXISTS (SELECT 1 FROM payments WHERE payment_key = ${paymentKey})
    `),
  ]);
  if (rowsOf(claim) === 0) {
    return { ok: false, code: 'invalid_state', message: '이미 확인됐거나 입금을 확인할 수 있는 상태가 아닙니다(미입금 취소된 신청은 확정할 수 없습니다). 새로고침해 주세요.' };
  }
  let failure: string | null = null;
  try {
    failure = await sendDepositLinkPaidEmail({ ...order, status: 'paid' });
  } catch (error) {
    console.error('[booking-bank-deposit] 예약금 입금 확인 메일 예외', { orderNo: order.orderNo, error: safeDbErrorSummary(error) });
    failure = error instanceof Error ? error.message : String(error);
  }
  if (failure) {
    await getDb().run(sql`UPDATE orders SET notification_error = ${failure} WHERE id = ${order.id}`).catch(() => {});
  }
  return { ok: true, emailSent: !failure };
};

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
  if (!order || (order.type !== 'session' && order.type !== 'mixing' && order.type !== 'deposit')) {
    return { ok: false, code: 'not_found', message: '주문을 찾을 수 없습니다.' };
  }
  if (isDepositLink(order)) return confirmDepositLinkBankDeposit(order, input.now);
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
      // 대기 일정 id는 그대로 둔다 — 아래에서 그 일정의 제목을 [예약]으로 바꾼다(새로 만들고 지우지 않는다).
      : db.run(sql`
          UPDATE bookings SET status = 'confirmed', updated_at = unixepoch()
          WHERE order_id = ${order.id} AND status = 'pending' AND ${isPaidNow}
        `),
  ]);
  if (rowsOf(claim) === 0) {
    return { ok: false, code: 'invalid_state', message: '이미 확인됐거나 입금을 확인할 수 있는 상태가 아닙니다(미입금 취소된 신청은 확정할 수 없습니다). 새로고침해 주세요.' };
  }

  // [입금 대기] 일정이 있으면 제목만 [예약]으로 바꾼다 — 같은 일정이 확정 일정이 된다. 실패하면 gcal_error에
  // rename 사유를 남긴다: 확정 예약의 캘린더 오류로 보여 관리자 "캘린더 재등록"이 새 [예약] 일정을 만들고 이
  // 일정을 지운다(그 경로가 지우는 것은 바로 이 대기 일정이라 안전하다).
  const waitingBooking = order.bookings[0];
  if (waitingBooking && waitingEventId) {
    const summary = `[예약] ${getProduct(waitingBooking.productId)?.nameKo ?? waitingBooking.serviceType}${waitingBooking.roomNumber ? ` ${waitingBooking.roomNumber}` : ''} — ${order.customerName}`;
    try {
      await renameBookingEvent(waitingEventId, calendarForService(waitingBooking.serviceType), waitingBooking.roomNumber, summary);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error('[booking-bank-deposit] 입금 대기 일정 제목 변경 실패', { orderNo: order.orderNo, detail });
      await db.run(sql`UPDATE bookings SET gcal_error = ${`rename: ${detail}`} WHERE id = ${waitingBooking.id}`).catch(() => {});
    }
  }

  const fresh = (await findById(order.id)) ?? order;
  const emailSent = await deliverPostConfirmation(fresh);
  const warnings: string[] = [];
  const booking = fresh.bookings[0];
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
  if (!order || (order.type !== 'session' && order.type !== 'mixing' && order.type !== 'deposit')) {
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
  if (booking?.gcalEventId) await removeWaitingCalendarEvent(booking, booking.gcalEventId);
  return { ok: true };
};

/** 고객 화면(예약 확인 페이지)이 입금 안내를 그릴 때 쓰는 값 — 금액·기한은 서버가 다시 읽은 것. */
export const bookingDepositGuideProps = (order: BookingOrder): { amount: number; deadline: string; customerName: string; applicantLabel: string } => ({
  amount: order.totalAmount,
  deadline: bookingDepositDeadline(order, order.bookings[0]).toISOString(),
  customerName: order.customerName,
  applicantLabel: order.type === 'mixing' ? '주문하신 분' : '예약하신 분',
});
