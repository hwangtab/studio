import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { hasOccupancyCalendarConflict } from './calendarGuard';
import { calendarForService, isCalendarActive, rescheduleBookingEvent } from './gcal';
import { kstDateString, kstDateTime } from './kst';
import { occupiedBookingSql } from './service';
import { getProduct, occupancyConflictKeys, productHours } from './products';

/**
 * **예약 일정 변경**(관리자) — 이미 등록된 세션 예약의 날짜·시작 시각을 옮긴다. 이용 시간(길이)·금액·방은 그대로다.
 * (시간 길이를 바꾸면 금액이 달라지는 일이라 이 기능이 하지 않는다 — 취소 후 다시 등록.)
 *
 * 순서: ① 캘린더 충돌 검사(옮길 자리에 손으로 넣은 일정이 있는지, 자기 일정은 제외 — 조회 실패는 거절, fail-closed)
 * → ② DB를 **조건부 UPDATE 한 문장**으로 옮긴다(다른 예약·관리자 블록과 겹치면 0행 = 거절, 동시 요청 안전)
 * → ③ 캘린더 일정을 PATCH. ③이 실패해도 DB는 이미 옮겨졌으므로 되돌리지 않고 `gcal_error`에 적는다 — 관리자 상세의
 * "캘린더 재시도"가 새 일정을 만들고 옛 일정을 지운다. 고객 메일은 자동으로 보내지 않는다(운영자가 "알림 재발송"을 누른다).
 */

export type RescheduleResult =
  | { ok: true; startAt: Date; endAt: Date; warnings: string[] }
  | { ok: false; code: 'not_found' | 'invalid_state' | 'invalid_input' | 'no_change' | 'slot_taken' | 'calendar_busy' | 'calendar_unavailable'; message: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isRealDate = (date: string): boolean => {
  const t = kstDateTime(date, 0);
  return !Number.isNaN(t.getTime()) && kstDateString(t) === date;
};

const fail = (code: Extract<RescheduleResult, { ok: false }>['code'], message: string): RescheduleResult => ({ ok: false, code, message });

export const rescheduleBooking = async (input: { orderId: string; date: unknown; startHour: unknown }): Promise<RescheduleResult> => {
  if (typeof input.date !== 'string' || !DATE_RE.test(input.date) || !isRealDate(input.date)) {
    return fail('invalid_input', '날짜 형식이 올바르지 않아요.');
  }
  if (input.date < '2025-01-01' || input.date > kstDateString(new Date(Date.now() + 366 * 24 * 3600 * 1000))) {
    return fail('invalid_input', '날짜 범위를 확인해 주세요(2025년 이후, 1년 안).');
  }
  if (typeof input.startHour !== 'number' || !Number.isInteger(input.startHour)) return fail('invalid_input', '시작 시각이 올바르지 않아요.');

  const db = getDb();
  const order = await db.query.orders.findFirst({
    where: (t, { eq }) => eq(t.id, input.orderId),
    with: { bookings: true },
  });
  const booking = order?.bookings[0];
  if (!order || !booking) return fail('not_found', '예약을 찾을 수 없어요.');
  const waitingDeposit = order.status === 'awaiting_deposit' && booking.status === 'pending';
  if (order.type !== 'session' || !(booking.status === 'confirmed' || waitingDeposit)) {
    return fail('invalid_state', '확정됐거나 입금 대기 중인 세션 예약만 일정을 바꿀 수 있어요.');
  }
  const product = getProduct(booking.productId);
  if (!product) return fail('invalid_state', '상품 정보를 찾을 수 없어요.');

  const hours = booking.durationHours;
  const { openHour, closeHour } = productHours(product);
  if (input.startHour < openHour || input.startHour + hours > closeHour) {
    return fail('invalid_input', `이 상품은 ${openHour}시~${closeHour}시 안에서 ${hours}시간을 잡아야 해요.`);
  }
  const startAt = kstDateTime(input.date, input.startHour);
  const endAt = kstDateTime(input.date, input.startHour + hours);
  if (startAt.getTime() === booking.startAt.getTime()) return fail('no_change', '지금과 같은 일정이에요.');

  const room = booking.roomNumber;
  const calendar = calendarForService(booking.serviceType);

  try {
    if (await hasOccupancyCalendarConflict(room, startAt, endAt, booking.gcalEventId)) {
      return fail('calendar_busy', '그 시간에 구글 캘린더에 다른 일정이 있어요.');
    }
  } catch (error) {
    console.error('[booking-reschedule] 캘린더 충돌 검사 실패 — 거절', error instanceof Error ? error.message : String(error));
    return fail('calendar_unavailable', '구글 캘린더를 확인하지 못해 옮기지 않았어요. 잠시 뒤 다시 시도해 주세요.');
  }

  const epoch = (d: Date) => Math.floor(d.getTime() / 1000);
  const keys = occupancyConflictKeys(room);
  const roomMatch = sql.join(keys.map((k) => (k === null ? sql`b.room_number IS NULL` : sql`b.room_number = ${k}`)), sql` OR `);
  const result = await db.run(sql`
    UPDATE bookings SET start_at = ${epoch(startAt)}, end_at = ${epoch(endAt)}, updated_at = unixepoch()
    WHERE id = ${booking.id} AND start_at = ${epoch(booking.startAt)}
      AND NOT EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.id <> ${booking.id} AND (${roomMatch})
          AND b.start_at < ${epoch(endAt)} AND b.end_at > ${epoch(startAt)}
          AND ${occupiedBookingSql('b')}
      )
      AND NOT EXISTS (
        SELECT 1 FROM availability_blocks ab
        WHERE ab.room_number IS ${room}
          AND ab.start_at < ${epoch(endAt)} AND ab.end_at > ${epoch(startAt)}
      )
  `);
  if (Number(result.rowsAffected) === 0) return fail('slot_taken', '그 시간에 다른 예약이나 예약 불가 시간이 있어요.');

  const warnings: string[] = [];
  if (booking.gcalEventId && isCalendarActive(calendar, room)) {
    try {
      await rescheduleBookingEvent(booking.gcalEventId, calendar, room, startAt, endAt);
      await db.run(sql`UPDATE bookings SET gcal_error = NULL WHERE id = ${booking.id}`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error('[booking-reschedule] 캘린더 일정 변경 실패', { bookingId: booking.id, detail });
      await db.run(sql`UPDATE bookings SET gcal_error = ${`reschedule(${kstDateString(new Date())}): ${detail}`} WHERE id = ${booking.id}`).catch(() => {});
      warnings.push('예약은 옮겼지만 구글 캘린더 일정을 옮기지 못했어요. 아래 “캘린더 재시도”를 눌러 주세요.');
    }
  } else if (isCalendarActive(calendar, room)) {
    warnings.push(waitingDeposit ? '이 예약은 아직 구글 캘린더에 일정이 없어요. 입금 확인 때 올라가요.' : '이 예약은 구글 캘린더에 올라 있지 않아요. “캘린더 재시도”로 올려 주세요.');
  }
  return { ok: true, startAt, endAt, warnings };
};
