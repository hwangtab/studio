import { fetchBusyRanges, isCalendarActive, type BookingCalendar } from './gcal';

/**
 * [start, end)가 자원 캘린더의 바쁨과 겹치는가. 예약 **생성** 직전 가드다 — 슬롯 화면은
 * 표시일 뿐이라 화면을 미리 열어 두었거나 API를 직접 부르면 캘린더에만 적힌 일정을
 * 뚫고 예약이 성립했다(2026-09-25 감사). 캘린더가 비활성이면 검사하지 않는다.
 * 조회 실패는 throw — 호출부가 fail-closed로 거절한다.
 */
export const hasCalendarConflict = async (calendar: BookingCalendar, start: Date, end: Date): Promise<boolean> => {
  if (!isCalendarActive(calendar)) return false;
  const busy = await fetchBusyRanges(start, end, calendar);
  return busy.some((b) => b.start < end && b.end > start);
};
