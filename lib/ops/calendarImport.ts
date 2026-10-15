import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { listCalendarEvents } from '../booking/gcal';

/**
 * **캘린더에만 있는 일정**(사이트에 등록되지 않은 일정) — 관리자 대시보드 "이번 주 세션" 아래에 보여 주고 "사이트에 등록"으로 가져온다.
 *
 * 녹음실 캘린더("스튜디오 놀 — 예약")에 운영자가 손으로 넣은 일정은 웹 예약 슬롯을 막지만(freeBusy) 사이트는 무슨 일정인지 몰랐다. 이 모듈이 그 일정을
 * 찾는다: 창 안의 일정 중 **사이트가 올린 일정이 아닌 것** — `bookings.gcal_event_id`·`payment_link_orders.gcal_event_id`에 없고, 설명에 사이트가 쓰는
 * "주문번호:" 줄도 없는 것. 시각이 없는 종일 일정은 "등록"으로 가져올 수 없어(시작 시간이 필요하다) `adoptable: false`로 알리기만 한다.
 *
 * 읽기 전용이다. 실패(캘린더·DB)는 던지지 않고 `error`를 돌려준다 — 대시보드가 이것 때문에 안 열리면 안 된다.
 */

export interface UnlinkedCalendarEvent {
  id: string;
  summary: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  /** "사이트에 등록"으로 가져올 수 있는가(시각이 있는 일정). */
  adoptable: boolean;
}

export const loadUnlinkedCalendarEvents = async (
  from: Date, to: Date,
): Promise<{ events: UnlinkedCalendarEvent[]; error: string | null }> => {
  try {
    const events = await listCalendarEvents(from, to, 'studio');
    if (events.length === 0) return { events: [], error: null };
    const db = getDb();
    const linkedRows = await Promise.all([
      db.all<{ id: string }>(sql`SELECT gcal_event_id AS id FROM bookings WHERE gcal_event_id IS NOT NULL`),
      // 표가 없는 DB(0064 전)에서는 이 조회만 실패한다 — 그때는 링크 일정을 못 거르므로 건너뛴다.
      db.all<{ id: string }>(sql`SELECT gcal_event_id AS id FROM payment_link_orders WHERE gcal_event_id IS NOT NULL`).catch(() => []),
    ]);
    const linked = new Set(linkedRows.flat().map((r) => r.id));
    return {
      events: events
        .filter((e) => !linked.has(e.id) && !/주문번호:/.test(e.description))
        .map((e) => ({
          id: e.id, summary: e.summary || '(제목 없음)', startAt: e.start.toISOString(), endAt: e.end.toISOString(),
          allDay: e.allDay, adoptable: !e.allDay,
        })),
      error: null,
    };
  } catch (error) {
    console.error('[calendar-import] 캘린더 일정 조회 실패 — 건너뜁니다', error instanceof Error ? error.message : String(error));
    return { events: [], error: '캘린더를 읽지 못했어요.' };
  }
};
