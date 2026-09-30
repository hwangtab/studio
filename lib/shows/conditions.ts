import { sql, type SQL } from 'drizzle-orm';

/**
 * 구역 정원 게이트 — 이미 발급/보류된(만료되지 않은) 티켓 수 + 요청 수량이 정원 이하일 때만 참.
 * excludeOrderNo: 자기 자신 주문(재시도 등)을 집계에서 뺀다.
 */
export function zoneCapacityCondition(zoneId: string, quantity: number, now: Date, excludeOrderNo?: string): SQL {
  const nowSec = Math.floor(now.getTime() / 1000);
  const excludeClause = excludeOrderNo ? sql`and st.order_no <> ${excludeOrderNo}` : sql``;
  return sql`(
    select z.capacity - coalesce((
      select count(*) from show_tickets st
      join show_ticket_types tt on tt.id = st.ticket_type_id
      join show_orders so on so.order_no = st.order_no
      where tt.zone_id = z.id
        and st.status in ('issued','refunding')
        ${excludeClause}
    ), 0) - coalesce((
      select count(*) from show_tickets st
      join show_ticket_types tt on tt.id = st.ticket_type_id
      join show_orders so on so.order_no = st.order_no
      where tt.zone_id = z.id
        and st.status = 'held'
        and (so.hold_expires_at is null or so.hold_expires_at > ${nowSec})
        ${excludeClause}
    ), 0)
    from show_zones z where z.id = ${zoneId}
  ) >= ${quantity}`;
}

/** 티켓타입 한정 수량 게이트. quota가 null이면(무제한) 항상 참. */
export function ticketTypeQuotaCondition(ticketTypeId: string, quantity: number, now: Date, excludeOrderNo?: string): SQL {
  const nowSec = Math.floor(now.getTime() / 1000);
  const excludeClause = excludeOrderNo ? sql`and st.order_no <> ${excludeOrderNo}` : sql``;
  return sql`(
    select case when tt.quota is null then 999999 else tt.quota - coalesce((
      select count(*) from show_tickets st
      join show_orders so on so.order_no = st.order_no
      where st.ticket_type_id = tt.id
        and (
          st.status in ('issued','refunding')
          or (st.status = 'held' and (so.hold_expires_at is null or so.hold_expires_at > ${nowSec}))
        )
        ${excludeClause}
    ), 0) end
    from show_ticket_types tt where tt.id = ${ticketTypeId}
  ) >= ${quantity}`;
}

/** 판매창 게이트 — 회차가 scheduled이고 아직 판매마감 전. */
export function showtimeSalesWindowCondition(showtimeId: string, now: Date): SQL {
  const nowSec = Math.floor(now.getTime() / 1000);
  return sql`exists (
    select 1 from showtimes s
    where s.id = ${showtimeId}
      and s.status = 'scheduled'
      and s.sales_close_at > ${nowSec}
  )`;
}

/** 회차 생존 게이트(취소 안 됐고 아직 안 끝남) — 확인/발권/체크인 등 판매창과 무관한 맥락에서 쓴다. */
export function liveShowtimeCondition(showtimeId: string, now: Date): SQL {
  const nowSec = Math.floor(now.getTime() / 1000);
  return sql`exists (
    select 1 from showtimes s
    where s.id = ${showtimeId}
      and s.status = 'scheduled'
      and s.starts_at > ${nowSec}
  )`;
}
