import { fetchBusyRanges, isCalendarActive, type BookingCalendar } from './gcal';
import { resourceKindOf, STUDIO_SHARED_ROOMS, type SessionProduct } from './products';

/**
 * [start, end)가 캘린더의 바쁨과 겹치는가. 캘린더가 비활성이면 검사하지 않는다.
 * 조회 실패는 throw — 호출부가 fail-closed로 거절한다.
 */
export const hasCalendarConflict = async (
  calendar: BookingCalendar, start: Date, end: Date, room?: string | null,
): Promise<boolean> => {
  if (!isCalendarActive(calendar, room)) return false;
  const busy = await fetchBusyRanges(start, end, calendar, room);
  return busy.some((b) => b.start < end && b.end > start);
};

/**
 * 이 자원(null = 녹음실)을 점유하는 일정이 적힐 수 있는 캘린더 전부. R02처럼 녹음실과 같은 방이면
 * 녹음실 캘린더와 연습실 캘린더를 둘 다 본다(products.ts STUDIO_SHARED_ROOMS). 비활성 캘린더는
 * hasCalendarConflict가 알아서 건너뛴다.
 */
export const occupancyCalendars = (room: string | null): Array<[BookingCalendar, string | null]> => {
  if (room === null) return [['studio', null], ...STUDIO_SHARED_ROOMS.map((r): [BookingCalendar, string | null] => ['practice-room', r])];
  return STUDIO_SHARED_ROOMS.includes(room) ? [['practice-room', room], ['studio', null]] : [['practice-room', room]];
};

/** 그 자원을 점유하는 캘린더 중 하나라도 [start, end)와 겹치는가. 조회 실패는 throw. */
export const hasOccupancyCalendarConflict = async (room: string | null, start: Date, end: Date): Promise<boolean> => {
  const flags = await Promise.all(occupancyCalendars(room).map(([cal, r]) => hasCalendarConflict(cal, start, end, r)));
  return flags.some(Boolean);
};

/**
 * 예약 **생성** 직전 가드 — 슬롯 화면은 표시일 뿐이라 화면을 미리 열어 두었거나 API를
 * 직접 부르면 캘린더에만 적힌 일정을 뚫고 예약이 성립했다(2026-09-25 감사).
 *
 * 녹음실: 캘린더가 바쁘면 `{ blocked: true }`.
 * 연습실: 방마다 자기 캘린더를 봐서 **바쁜 방 목록**을 돌려준다. 전부 바쁘면 blocked,
 * 일부만 바쁘면 그 방들을 배정에서 빼고(createBookingOrder excludeRooms) 나머지로 진행한다.
 */
export const calendarBlockedRooms = async (
  product: SessionProduct, start: Date, end: Date,
): Promise<{ blocked: boolean; excludeRooms: string[] }> => {
  if (resourceKindOf(product) !== 'rooms') {
    return { blocked: await hasOccupancyCalendarConflict(null, start, end), excludeRooms: [] };
  }
  const rooms = product.rooms ?? [];
  const flags = await Promise.all(rooms.map((room) => hasOccupancyCalendarConflict(room, start, end)));
  const excludeRooms = rooms.filter((_, i) => flags[i]);
  return { blocked: rooms.length > 0 && excludeRooms.length === rooms.length, excludeRooms };
};
