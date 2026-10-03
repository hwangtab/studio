import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { isTokenMatch } from '../booking/token';
import {
  computeTicketTypeRemaining,
  showtimeSaleState,
  type ShowtimeSaleState,
} from './availability';
import { formatShowtimeLabel } from './format';
import { calcRefundAmount, refundRateForNotice } from './refundPolicy';

/**
 * 고객 화면용 조회. 모든 값은 JSON 직렬화 가능(Date·undefined 없음)해서 getServerSideProps
 * props로 그대로 내려갈 수 있다.
 */

export interface PublicTicketType {
  id: string;
  name: string;
  price: number;
  zoneLabel: string;
}

export interface PublicShowtime {
  id: string;
  startsAt: number;
  label: string;
  saleState: ShowtimeSaleState;
  /** ticketTypeId → 잔여석. 안내용 숫자다(실제 판매는 주문 생성의 원자적 게이트가 정한다). */
  remaining: Record<string, number>;
}

export interface PublicShow {
  slug: string;
  title: string;
  presenterName: string;
  performers: string;
  ageRating: string;
  runningMinutes: number;
  venueName: string;
  venueAddress: string;
  description: string;
  coverImage: string | null;
  cancelled: boolean;
  ticketTypes: PublicTicketType[];
  showtimes: PublicShowtime[];
}

/**
 * 회차별·티켓타입별 사용분. lib/shows/conditions.ts의 두 게이트와 같은 집합이다 —
 * issued·refunding, 그리고 홀드가 만료되지 않은 held. 한쪽만 고치면 화면 숫자와 판매 결과가 갈린다.
 */
async function loadUsedBy(showId: string, nowSec: number): Promise<Record<string, Record<string, number>>> {
  const db = getDb();
  const rows = (await db.all(sql`
    SELECT st.showtime_id AS showtimeId, st.ticket_type_id AS ticketTypeId, COUNT(*) AS n
    FROM show_tickets st
    JOIN show_orders so ON so.order_no = st.order_no
    JOIN showtimes s ON s.id = st.showtime_id
    WHERE s.show_id = ${showId}
      AND (
        st.status IN ('issued','refunding')
        OR (st.status = 'held' AND (so.hold_expires_at IS NULL OR so.hold_expires_at > ${nowSec}))
      )
    GROUP BY st.showtime_id, st.ticket_type_id
  `)) as Array<{ showtimeId: string; ticketTypeId: string; n: number }>;
  const out: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    (out[r.showtimeId] ??= {})[r.ticketTypeId] = Number(r.n);
  }
  return out;
}

/** slug로 공개 공연을 읽는다. draft이거나 없으면 null. 취소된 공연은 cancelled로 돌려준다. */
export async function getPublicShowBySlug(slug: string, now: Date): Promise<PublicShow | null> {
  const db = getDb();
  const show = await db.query.shows.findFirst({ where: (s, { eq }) => eq(s.slug, slug) });
  if (!show || show.status === 'draft') return null;

  const [zones, ticketTypes, showtimeRows] = await Promise.all([
    db.query.showZones.findMany({ where: (z, { eq }) => eq(z.showId, show.id) }),
    db.query.showTicketTypes.findMany({
      where: (t, { eq }) => eq(t.showId, show.id),
      orderBy: (t, { asc }) => [asc(t.price), asc(t.createdAt)],
    }),
    db.query.showtimes.findMany({
      where: (s, { eq }) => eq(s.showId, show.id),
      orderBy: (s, { asc }) => [asc(s.startsAt)],
    }),
  ]);
  const nowSec = Math.floor(now.getTime() / 1000);
  const usedBy = await loadUsedBy(show.id, nowSec);
  const zoneLabel = new Map(zones.map((z) => [z.id, z.label]));

  const showtimes: PublicShowtime[] = showtimeRows.map((st) => {
    const remaining = computeTicketTypeRemaining(
      zones.map((z) => ({ id: z.id, capacity: z.capacity })),
      ticketTypes.map((t) => ({ id: t.id, zoneId: t.zoneId, quota: t.quota })),
      usedBy[st.id] ?? {}
    );
    const total = Object.values(remaining).reduce((a, b) => a + b, 0);
    return {
      id: st.id,
      startsAt: st.startsAt,
      label: formatShowtimeLabel(st.startsAt),
      saleState: show.status === 'cancelled' ? 'cancelled' : showtimeSaleState(st, total, nowSec),
      remaining,
    };
  });

  return {
    slug: show.slug,
    title: show.title,
    presenterName: show.presenterName,
    performers: show.performers,
    ageRating: show.ageRating,
    runningMinutes: show.runningMinutes,
    venueName: show.venueName,
    venueAddress: show.venueAddress,
    description: show.description,
    coverImage: show.coverImage ?? null,
    cancelled: show.status === 'cancelled',
    ticketTypes: ticketTypes.map((t) => ({
      id: t.id,
      name: t.name,
      price: t.price,
      zoneLabel: zoneLabel.get(t.zoneId) ?? '',
    })),
    showtimes,
  };
}

// ─── 주문(관리 링크) ───────────────────────────────────────────────────────────

export interface ManageTicketView {
  id: string;
  code: string;
  entryNumber: number | null;
  status: 'held' | 'issued' | 'refunding' | 'refunded' | 'void';
  ticketTypeName: string;
  unitAmount: number;
  checkedIn: boolean;
  isComp: boolean;
  /** 지금 환불 신청하면 돌려받는 금액. 환불할 수 없는 티켓은 null. */
  refundAmountNow: number | null;
}

export interface ManageOrderView {
  orderNo: string;
  orderStatus: string;
  totalAmount: number;
  buyerName: string;
  showTitle: string;
  showSlug: string;
  venueName: string;
  venueAddress: string;
  showtimeLabel: string;
  showtimeStartsAt: number;
  showtimeStatus: string;
  /** 지금 시점 환불율(0이면 환불 불가). */
  refundPctNow: number;
  tickets: ManageTicketView[];
}

/**
 * 관리 링크 조회. 주문 부재·토큰 불일치·티켓 주문 아님을 전부 null로 돌려준다 —
 * 어느 쪽인지 구분해 알려 주면 orderNo 존재 여부를 토큰 없이 확인하는 창구가 된다.
 */
export async function getShowOrderForManage(orderNo: string, token: string, now: Date): Promise<ManageOrderView | null> {
  const db = getDb();
  const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, orderNo) });
  if (!order || order.type !== 'ticket' || !isTokenMatch(order.manageToken, token)) return null;

  const showOrder = await db.query.showOrders.findFirst({
    where: (s, { eq }) => eq(s.orderNo, orderNo),
    with: { showtime: true },
  });
  if (!showOrder) return null;
  const show = await db.query.shows.findFirst({ where: (s, { eq }) => eq(s.id, showOrder.showtime.showId) });
  if (!show) return null;
  const tickets = await db.query.showTickets.findMany({
    where: (t, { eq }) => eq(t.orderNo, orderNo),
    with: { ticketType: true },
    orderBy: (t, { asc }) => [asc(t.createdAt), asc(t.id)],
  });

  const startsAt = showOrder.showtime.startsAt;
  const refundPctNow = refundRateForNotice(new Date(startsAt * 1000), now);
  const refundableOrder = order.status === 'paid' || order.status === 'partially_refunded';
  return {
    orderNo: order.orderNo,
    orderStatus: order.status,
    totalAmount: order.totalAmount,
    buyerName: showOrder.buyerName,
    showTitle: show.title,
    showSlug: show.slug,
    venueName: show.venueName,
    venueAddress: show.venueAddress,
    showtimeLabel: formatShowtimeLabel(startsAt),
    showtimeStartsAt: startsAt,
    showtimeStatus: showOrder.showtime.status,
    refundPctNow,
    tickets: tickets.map((t) => {
      const canRefund =
        refundableOrder && t.status === 'issued' && t.checkedInAt == null && t.issuedBy === 'customer' && refundPctNow > 0;
      return {
        id: t.id,
        code: t.code,
        entryNumber: t.entryNumber ?? null,
        status: t.status,
        ticketTypeName: t.ticketType.name,
        unitAmount: t.unitAmount,
        checkedIn: t.checkedInAt != null,
        isComp: t.issuedBy === 'organizer_comp',
        refundAmountNow: canRefund ? calcRefundAmount(t.unitAmount, refundPctNow) : null,
      };
    }),
  };
}

/** 회차가 속한 공연이 published인지 — draft·cancelled 공연의 회차로는 주문을 만들 수 없다. */
export async function isShowtimeOnPublishedShow(showtimeId: string): Promise<boolean> {
  const db = getDb();
  const st = await db.query.showtimes.findFirst({ where: (s, { eq }) => eq(s.id, showtimeId) });
  if (!st) return false;
  const show = await db.query.shows.findFirst({ where: (s, { eq }) => eq(s.id, st.showId) });
  return show?.status === 'published';
}
