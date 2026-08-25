import { and, eq, gt, lt, or } from 'drizzle-orm';
import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../db/client';
import { availabilityBlocks, bookings } from '../../../db/schema';
import { fetchBusyRanges, type BusyRange } from '../../../lib/booking/gcal';
import { daysUntilKst, kstDateTime } from '../../../lib/booking/kst';
import { getProduct, resolveHours } from '../../../lib/booking/products';
import { buildDaySlots, CLOSE_HOUR, OPEN_HOUR } from '../../../lib/booking/slots';
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

const getCachedBusyRanges = async (dateKey: string, dayStart: Date, dayEnd: Date): Promise<BusyRange[]> => {
  const cached = freeBusyCache.get(dateKey);
  const now = Date.now();
  if (cached && now - cached.at < FREEBUSY_TTL_MS) return cached.ranges;
  const ranges = await fetchBusyRanges(dayStart, dayEnd);
  freeBusyCache.set(dateKey, { at: now, ranges });
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

  const dayStart = kstDateTime(date, OPEN_HOUR);
  const dayEnd = kstDateTime(date, CLOSE_HOUR);
  if (Number.isNaN(dayStart.getTime())) return res.status(400).json({ ok: false, message: '날짜가 올바르지 않습니다.' });

  // 슬롯 조회는 날짜 단위 — 당일은 영업시간(12h) < 리드타임(24h)이라 모든 슬롯이
  // 항상 불가하므로 내일부터만 허용한다(Task 4 validateCreateBookingPayload와 같은 창).
  const daysUntil = daysUntilKst(now, dayStart);
  if (daysUntil < 1) return res.status(400).json({ ok: false, message: '오늘 이전이거나 당일은 조회할 수 없습니다.' });
  if (daysUntil > MAX_BOOK_DAYS)
    return res.status(400).json({ ok: false, message: `예약은 ${MAX_BOOK_DAYS}일 이내만 가능합니다.` });

  let calendarBusy: BusyRange[];
  try {
    calendarBusy = await getCachedBusyRanges(date, dayStart, dayEnd);
  } catch (error) {
    console.error('[booking-slots] FreeBusy 조회 실패 — fail-closed 503', { date, error });
    return res.status(503).json({ ok: false, code: 'calendar_unavailable' });
  }

  const db = getDb();
  const pendingCutoff = new Date(now.getTime() - PENDING_HOLD_SECONDS * 1000);
  const [busyBookings, busyBlocks] = await Promise.all([
    db
      .select({ start: bookings.startAt, end: bookings.endAt })
      .from(bookings)
      .where(
        and(
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
      .where(and(lt(availabilityBlocks.startAt, dayEnd), gt(availabilityBlocks.endAt, dayStart))),
  ]);

  const busy: BusyRange[] = [...calendarBusy, ...busyBookings, ...busyBlocks];
  const slots = buildDaySlots({ date, durationHours: hours, busy, now, minLeadHours: MIN_LEAD_HOURS });
  return res.status(200).json({ ok: true, slots });
}
