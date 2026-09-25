import { and, eq, gt, isNull, lt, or } from 'drizzle-orm';
import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../db/client';
import { availabilityBlocks, bookings } from '../../../db/schema';
import { calendarIdFor, fetchBusyRanges, isCalendarActive, type BookingCalendar, type BusyRange } from '../../../lib/booking/gcal';
import { daysUntilKst, kstDateTime } from '../../../lib/booking/kst';
import { getProduct, productHours, resolveHours, resourceKindOf } from '../../../lib/booking/products';
import { buildDaySlots, mergeRoomSlots, type DaySlot } from '../../../lib/booking/slots';
import { expireStaleOrders, PENDING_HOLD_SECONDS } from '../../../lib/booking/service';
import { MAX_BOOK_DAYS, MIN_LEAD_HOURS } from '../../../lib/booking/validation';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * FreeBusy 결과만 인스턴스 메모리에 60초 캐시한다(가용성 자체는 캐시하지 않는다 —
 * DB 조회는 매 요청 새로 한다). 서버리스는 인스턴스가 여러 개라 캐시 적중률은
 * 낮지만, 같은 인스턴스가 짧은 시간에 같은 날짜를 반복 조회하는 경우(사용자가
 * 인원 수·시간을 바꿔가며 같은 날짜를 다시 조회)의 캘린더 API 호출을 줄인다.
 * 실패(throw)는 캐시하지 않는다 — 다음 요청이 다시 시도해야 fail-closed가 유지된다.
 */
const FREEBUSY_TTL_MS = 60_000;
const freeBusyCache = new Map<string, { at: number; ranges: BusyRange[] }>();

const getCachedBusyRanges = async (
  calendar: BookingCalendar, dateKey: string, dayStart: Date, dayEnd: Date, room: string | null = null,
): Promise<BusyRange[]> => {
  // 조회 창(dayStart~dayEnd)이 상품 영업시간에서 오므로 키에 창을 넣는다 — 날짜만 키로 쓰면
  // 좁은 창으로 채운 항목이 넓은 창 요청에 재사용돼 창 밖 바쁨이 사라진다(fail-open).
  // 키는 해석된 캘린더 id — 방 여럿이 공용 캘린더를 볼 때 같은 freeBusy를 방 수만큼 부르지 않는다.
  const key = `${calendarIdFor(calendar, room) ?? calendar}:${dateKey}:${dayStart.getTime()}-${dayEnd.getTime()}`;
  const cached = freeBusyCache.get(key);
  const now = Date.now();
  if (cached && now - cached.at < FREEBUSY_TTL_MS) return cached.ranges;
  const ranges = await fetchBusyRanges(dayStart, dayEnd, calendar, room);
  freeBusyCache.set(key, { at: now, ranges });
  return ranges;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store'); // 가용성은 캐시하면 안 된다 — no-store를 GET에도 명시.
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false });
  }

  const now = new Date();
  await expireStaleOrders(now);

  const { productId, hours: hoursParam, date } = req.query;

  const product = typeof productId === 'string' ? getProduct(productId) : undefined;
  if (!product) return res.status(400).json({ ok: false, message: '알 수 없는 상품입니다.' });

  const requestedHours = typeof hoursParam === 'string' && hoursParam !== '' ? Number(hoursParam) : undefined;
  const hours = resolveHours(product, requestedHours);
  if (hours === null) return res.status(400).json({ ok: false, message: '예약 시간 수가 올바르지 않습니다.' });

  if (typeof date !== 'string' || !DATE_RE.test(date))
    return res.status(400).json({ ok: false, message: '날짜가 올바르지 않습니다.' });

  const { openHour, closeHour } = productHours(product);
  const dayStart = kstDateTime(date, openHour);
  const dayEnd = kstDateTime(date, closeHour);
  if (Number.isNaN(dayStart.getTime())) return res.status(400).json({ ok: false, message: '날짜가 올바르지 않습니다.' });

  // 슬롯 조회는 날짜 단위. **당일도 연다** — 지난 시각은 buildDaySlots가 leadOk로 거른다.
  // 2026-09-25까지 "당일은 조회 불가"로 막고 있었다(리드타임 24h 전제).
  const daysUntil = daysUntilKst(now, dayStart);
  if (daysUntil < 0) return res.status(400).json({ ok: false, message: '지난 날짜는 조회할 수 없습니다.' });
  if (daysUntil > MAX_BOOK_DAYS)
    return res.status(400).json({ ok: false, message: `예약은 ${MAX_BOOK_DAYS}일 이내만 가능합니다.` });

  const db = getDb();
  const pendingCutoff = new Date(now.getTime() - PENDING_HOLD_SECONDS * 1000);

  /** 한 자원(녹음실=null 또는 방 번호)의 DB 바쁨 — `room_number IS ?`로 같은 자원만. */
  const dbBusyFor = async (room: string | null): Promise<BusyRange[]> => {
    const roomCond = (col: typeof bookings.roomNumber | typeof availabilityBlocks.roomNumber) =>
      room === null ? isNull(col) : eq(col, room);
    const [busyBookings, busyBlocks] = await Promise.all([
      db
        .select({ start: bookings.startAt, end: bookings.endAt })
        .from(bookings)
        .where(
          and(
            roomCond(bookings.roomNumber),
            lt(bookings.startAt, dayEnd),
            gt(bookings.endAt, dayStart),
            or(
              eq(bookings.status, 'confirmed'),
              and(eq(bookings.status, 'pending'), gt(bookings.createdAt, pendingCutoff)),
            ),
          ),
        ),
      db
        .select({ start: availabilityBlocks.startAt, end: availabilityBlocks.endAt })
        .from(availabilityBlocks)
        .where(and(roomCond(availabilityBlocks.roomNumber), lt(availabilityBlocks.startAt, dayEnd), gt(availabilityBlocks.endAt, dayStart))),
    ]);
    return [...busyBookings, ...busyBlocks];
  };

  const slotArgs = { date, durationHours: hours, now, minLeadHours: MIN_LEAD_HOURS, openHour, closeHour };

  // 자원별 캘린더의 바쁨. 녹음실과 연습실이 같은 기준이다 — 자기 캘린더를 읽고(여기),
  // 자기 캘린더에 쓴다(confirm.ts). 캘린더에 손으로 넣은 일정도 웹 예약을 막는다.
  // 조회 실패는 fail-closed(503). 녹음실 캘린더(BOOKING_GCAL_ID)는 필수라 env가 없어도
  // 503이다(getCachedBusyRanges 안에서 throw). 연습실 캘린더만 env가 없으면 읽지 않는다 —
  // confirm.ts가 같은 조건으로 쓰기를 건너뛰므로 읽기도 같이 건너뛰어야 짝이 맞는다.
  const calendarBusyFor = async (calendar: BookingCalendar, room: string | null): Promise<BusyRange[]> =>
    isCalendarActive(calendar, room) ? getCachedBusyRanges(calendar, date, dayStart, dayEnd, room) : [];

  // 방 자원: 방마다 자기 캘린더(방별 env, 없으면 공용)의 바쁨 + DB 바쁨으로 슬롯을 계산해
  // 하나라도 비면 가능으로 합친다. 어느 방이 배정되는지는 결제 시점에 정한다(service.ts).
  // try는 캘린더 조회만 감싼다 — DB 오류를 "캘린더 503"으로 보고하면 운영자가 엉뚱한 곳을 본다.
  if (resourceKindOf(product) === 'rooms') {
    const rooms = product.rooms ?? [];
    let calendarBusyByRoom: BusyRange[][];
    try {
      calendarBusyByRoom = await Promise.all(rooms.map((room) => calendarBusyFor('practice-room', room)));
    } catch (error) {
      console.error('[booking-slots] FreeBusy 조회 실패 — fail-closed 503', { calendar: 'practice-room', date, error });
      return res.status(503).json({ ok: false, code: 'calendar_unavailable' });
    }
    const perRoom: DaySlot[][] = await Promise.all(
      rooms.map(async (room, i) => buildDaySlots({ ...slotArgs, busy: [...calendarBusyByRoom[i], ...(await dbBusyFor(room))] })),
    );
    return res.status(200).json({ ok: true, slots: mergeRoomSlots(perRoom) });
  }

  let calendarBusy: BusyRange[];
  try {
    calendarBusy = await calendarBusyFor('studio', null);
  } catch (error) {
    console.error('[booking-slots] FreeBusy 조회 실패 — fail-closed 503', { calendar: 'studio', date, error });
    return res.status(503).json({ ok: false, code: 'calendar_unavailable' });
  }

  const busy: BusyRange[] = [...calendarBusy, ...(await dbBusyFor(null))];
  const slots = buildDaySlots({ ...slotArgs, busy });
  return res.status(200).json({ ok: true, slots });
}
