import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { kstDateString } from '../booking/kst';
import { createBookingEvent, deleteBookingEvent, getCalendarEvent } from '../booking/gcal';
import { adminUrl } from '../email/layout';
import { safeDbErrorSummary } from './refundAccount';

/**
 * 결제 링크 이용 일정 ↔ 구글 캘린더(녹음실 "스튜디오 놀 — 예약", `BOOKING_GCAL_ID`) — 마이그레이션 0064.
 *
 * 링크 주문은 예약 시스템(`bookings`)에 행이 없어 확정돼도 캘린더에 일정이 안 생겼다. 이용 일시·시간이 있는 링크 주문이 **결제 확정**(카드)되거나
 * **입금 확인**되면 같은 캘린더에 일정을 올린다. 그 캘린더의 일정은 웹 예약 슬롯을 막는다(slots.ts의 freeBusy) — 그래서 링크가 만든
 * "예약 불가 블록"(lib/payments/paymentLinks.ts)과 같은 시간을 이중으로 막지만 해가 없다. 환불되면 일정을 지운다.
 *
 * **둘 다 throw하지 않는다** — 결제·입금 확정은 이미 끝났고, 실패는 `gcal_error`에 남겨 관리자 예약 상세가 "캘린더 다시 등록"을 보인다.
 * 이벤트 id는 `payment_link_orders.gcal_event_id`에 둔다(이미 id가 있으면 새로 만들지 않는다 — 멱등).
 */

interface LinkOrderRow {
  order_id: string;
  order_no: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  item_name: string;
  session_at: number | null;
  session_hours: number | null;
  gcal_event_id: string | null;
  memo: string | null;
}

const loadRow = async (orderNo: string): Promise<LinkOrderRow | null> => {
  const rows = await getDb().all<LinkOrderRow>(sql`
    SELECT o.id AS order_id, o.order_no, o.status, o.customer_name, o.customer_phone, o.customer_email,
           plo.item_name, plo.session_at, plo.session_hours, plo.gcal_event_id, l.memo AS memo
    FROM payment_link_orders plo
    JOIN orders o ON o.order_no = plo.order_no
    LEFT JOIN payment_links l ON l.slug = plo.slug
    WHERE plo.order_no = ${orderNo}
  `);
  return rows[0] ?? null;
};

const recordResult = async (orderNo: string, eventId: string | null | undefined, error: string | null): Promise<void> => {
  try {
    await getDb().run(sql`
      UPDATE payment_link_orders
      SET gcal_event_id = ${eventId === undefined ? sql`gcal_event_id` : eventId}, gcal_error = ${error}
      WHERE order_no = ${orderNo}
    `);
  } catch (writeError) {
    console.error('[link-calendar] 캘린더 결과 기록 실패', { orderNo, error: safeDbErrorSummary(writeError) });
  }
};

/** 결제 확정된 링크 주문의 이용 일정을 캘린더에 올린다. 일시 없는 링크·미확정 주문·이미 올린 주문은 아무것도 안 한다. 성공하면 이벤트 id. */
export const syncPaymentLinkCalendarEvent = async (orderNo: string): Promise<string | null> => {
  let row: LinkOrderRow | null;
  try {
    row = await loadRow(orderNo);
  } catch (error) {
    console.error('[link-calendar] 링크 주문 조회 실패 — 건너뜀(표가 없는 DB일 수 있다)', { orderNo, error: safeDbErrorSummary(error) });
    return null;
  }
  if (!row || row.session_at === null || row.session_hours === null) return null;
  if (row.status !== 'paid' && row.status !== 'partially_refunded') return null;
  if (row.gcal_event_id) return row.gcal_event_id;
  try {
    const start = new Date(Number(row.session_at) * 1000);
    const eventId = await createBookingEvent({
      calendar: 'studio',
      summary: `[예약] ${row.item_name} — ${row.customer_name}`,
      description: [
        `상품: ${row.item_name} (${row.session_hours}시간) · 결제 링크`,
        `고객: ${row.customer_name} / ${row.customer_phone} / ${row.customer_email}`,
        `주문번호: ${row.order_no}`,
        ...(row.memo ? [`링크 메모: ${row.memo}`] : []),
        `관리자: ${adminUrl(`/admin/bookings/${row.order_id}`)}`,
      ].join('\n'),
      start,
      end: new Date(start.getTime() + Number(row.session_hours) * 3600 * 1000),
    });
    await recordResult(orderNo, eventId, null);
    return eventId;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[link-calendar] 캘린더 등록 실패', { orderNo, detail });
    await recordResult(orderNo, undefined, `create(${kstDateString(new Date())}): ${detail}`);
    return null;
  }
};

/** 환불된 링크 주문의 일정을 캘린더에서 지운다. 올린 적 없으면 아무것도 안 한다. */
export const removePaymentLinkCalendarEvent = async (orderNo: string): Promise<void> => {
  let row: LinkOrderRow | null;
  try {
    row = await loadRow(orderNo);
  } catch (error) {
    console.error('[link-calendar] 링크 주문 조회 실패 — 건너뜀', { orderNo, error: safeDbErrorSummary(error) });
    return;
  }
  if (!row?.gcal_event_id) return;
  try {
    await deleteBookingEvent(row.gcal_event_id, 'studio');
    await recordResult(orderNo, null, null);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[link-calendar] 캘린더 삭제 실패', { orderNo, detail });
    await recordResult(orderNo, undefined, `delete(${kstDateString(new Date())}): ${detail}`);
  }
};

/** 관리자 "캘린더 다시 등록" — 올린 일정이 있으면 지우고(옛 id가 없는 캘린더면 404도 성공) 새로 올린다. */
export const resyncPaymentLinkCalendarEvent = async (orderNo: string): Promise<{ ok: true; eventId: string } | { ok: false; message: string }> => {
  await removePaymentLinkCalendarEvent(orderNo);
  const eventId = await syncPaymentLinkCalendarEvent(orderNo);
  if (eventId) return { ok: true, eventId };
  const row = await loadRow(orderNo).catch(() => null);
  if (!row || row.session_at === null || row.session_hours === null) return { ok: false, message: '이용 일시가 없는 링크 주문이에요.' };
  if (row.status !== 'paid' && row.status !== 'partially_refunded') return { ok: false, message: '결제가 확정된 주문만 캘린더에 올려요.' };
  return { ok: false, message: '캘린더 등록에 실패했어요. 로그와 캘린더 설정(BOOKING_GCAL_ID)을 확인해 주세요.' };
};

/**
 * **캘린더 → 사이트**: 우리가 올린 링크 일정을 운영자가 캘린더에서 옮기거나 지웠는지 확인해 주문에 반영한다.
 * 관리자 대시보드를 열 때 부른다(실시간이 아니다 — 구글 푸시 알림은 쓰지 않는다).
 *
 * - **시작·끝이 바뀌었으면** 주문의 이용 일시·시간(`session_at`·`session_hours`)을 캘린더 값으로 맞춘다. 그 링크의 "예약 불가 블록"(`block_id`)도 같은 시간으로
 *   옮긴다(링크 하나에 주문이 여럿이어도 블록은 하나라, 가장 최근에 옮긴 값을 따른다).
 * - **일정이 지워졌으면**(404·취소) 환불로 보지 않는다 — `gcal_event_id`를 비우고 `gcal_error`에 "캘린더에서 삭제됨"을 적어 관리자 상세에 보인다(다시 올리거나 무시).
 * - 대상은 결제된 주문 중 이용 일시가 어제 이후인 것 최대 30건. 한 건이 실패해도 나머지는 본다. 던지지 않는다.
 * 종일 일정으로 바뀌었으면(시각 없음) 건드리지 않는다.
 */
export const syncLinkEventsFromCalendar = async (now: Date = new Date()): Promise<{ moved: number; deleted: number }> => {
  const result = { moved: 0, deleted: 0 };
  let rows: Array<{ order_no: string; slug: string; session_at: number; session_hours: number | null; gcal_event_id: string }> = [];
  try {
    rows = await getDb().all(sql`
      SELECT plo.order_no, plo.slug, plo.session_at, plo.session_hours, plo.gcal_event_id
      FROM payment_link_orders plo JOIN orders o ON o.order_no = plo.order_no
      WHERE plo.gcal_event_id IS NOT NULL AND plo.session_at IS NOT NULL AND o.status IN ('paid', 'partially_refunded')
        AND plo.session_at >= ${Math.floor(now.getTime() / 1000) - 24 * 3600}
      ORDER BY plo.session_at LIMIT 30
    `);
  } catch (error) {
    console.error('[link-calendar] 캘린더 변경 확인 대상 조회 실패 — 건너뜀', { error: safeDbErrorSummary(error) });
    return result;
  }
  // 조회는 한꺼번에(대시보드를 열 때마다 도므로 30건을 줄 세우면 느리다), 반영은 한 건씩.
  const events = await Promise.all(rows.map((row) => getCalendarEvent(row.gcal_event_id, 'studio').then((event) => ({ event }), (error: unknown) => ({ error }))));
  for (const [i, row] of rows.entries()) {
    try {
      const fetched = events[i];
      if ('error' in fetched) throw fetched.error;
      const event = fetched.event;
      if (!event) {
        await getDb().run(sql`UPDATE payment_link_orders SET gcal_event_id = NULL, gcal_error = ${`캘린더에서 삭제됨(${kstDateString(now)})`} WHERE order_no = ${row.order_no}`);
        result.deleted += 1;
        continue;
      }
      if (event.allDay) continue;
      const startSec = Math.floor(event.start.getTime() / 1000);
      const hours = Math.max(1, Math.round((event.end.getTime() - event.start.getTime()) / 3_600_000));
      if (startSec === Number(row.session_at) && hours === Number(row.session_hours ?? hours)) continue;
      await getDb().run(sql`UPDATE payment_link_orders SET session_at = ${startSec}, session_hours = ${hours} WHERE order_no = ${row.order_no}`);
      await getDb().run(sql`
        UPDATE availability_blocks SET start_at = ${startSec}, end_at = ${startSec + hours * 3600}
        WHERE id = (SELECT block_id FROM payment_links WHERE slug = ${row.slug} AND block_id IS NOT NULL)
      `);
      result.moved += 1;
    } catch (error) {
      console.error('[link-calendar] 캘린더 변경 확인 실패 — 이 건은 건너뜀', { orderNo: row.order_no, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return result;
};
