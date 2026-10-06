import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { isTokenMatch } from '../booking/token';
import {
  computeTicketTypeRemaining,
  nextShowtimeOf,
  showtimeSaleState,
  type ShowtimeSaleState,
} from './availability';
import { formatShowtimeLabel } from './format';
import { calcRefundAmount, refundRateForNotice } from './refundPolicy';
import { parseMapLinksJson, type MapLinkOverrides } from './maps';
import { parseNoticesJson, parsePerformersJson, type ShowPerformer } from './structured';
import { BANK_DEPOSIT_GUIDE_DAYS } from '../payments/bankAccount';
import { bankDepositDeadlineOf, bankDepositStateOf, type BankDepositState } from '../payments/bankDeposit';

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
  subtitle: string | null;
  presenterName: string;
  performers: ShowPerformer[];
  ageRating: string;
  runningMinutes: number;
  venueName: string;
  venueAddress: string;
  description: string;
  coverImage: string | null;
  ogImage: string | null;
  scheduleNote: string | null;
  onSitePriceNote: string | null;
  notices: string[];
  /** 제공자별 정확한 장소 주소(없으면 비어 있고 검색 링크를 쓴다) — lib/shows/maps.ts. */
  mapLinks: MapLinkOverrides;
  /**
   * 지도 검색에 쓸 원래(한국어) 장소명·주소. 영어 화면은 venueName·venueAddress가 영어로 바뀌는데, 지도 검색은
   * 한국어 주소라야 잡힌다(lib/shows/localize.ts가 채운다). 없으면 venueName·venueAddress를 쓴다.
   */
  mapSource?: { venueName: string; venueAddress: string };
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
    subtitle: show.subtitle ?? null,
    presenterName: show.presenterName,
    // JSON 칸이 비어 있으면(0047 전 행) 이름 나열로 폴백 — 소개·사진 없이 이름만 나온다.
    performers: show.performersJson
      ? parsePerformersJson(show.performersJson)
      : show.performers.split(',').map((n) => n.trim()).filter(Boolean).map((name) => ({ name })),
    ageRating: show.ageRating,
    runningMinutes: show.runningMinutes,
    venueName: show.venueName,
    venueAddress: show.venueAddress,
    description: show.description,
    coverImage: show.coverImage ?? null,
    ogImage: show.ogImage ?? null,
    scheduleNote: show.scheduleNote ?? null,
    onSitePriceNote: show.onSitePriceNote ?? null,
    notices: parseNoticesJson(show.noticesJson),
    mapLinks: parseMapLinksJson(show.mapLinksJson),
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
  /** 지금 시점 환불율(0이면 환불 불가). 회차가 취소됐으면 100(주최 측 취소는 취소환불표를 쓰지 않는다). */
  refundPctNow: number;
  tickets: ManageTicketView[];
  /**
   * 온라인 계좌 입금 주문의 단계(입금 대기·입금 전 취소·입금 확인됨), 아니면 null. 서버(환불·신청 취소 API)와
   * 같은 bankDepositStateOf로 판정한다. `paid`면 환불 신청에 **환불 계좌**를 함께 받는다.
   */
  bankDeposit: BankDepositState | null;
  /** 입금 대기일 때만 — 안내 화면(BankDepositGuide)에 그릴 금액·기한(서버가 다시 읽은 값). */
  depositGuide: { amount: number; deadline: string; customerName: string } | null;
}

/**
 * 관리 링크 조회. 주문 부재·토큰 불일치·티켓 주문 아님을 전부 null로 돌려준다 —
 * 어느 쪽인지 구분해 알려 주면 orderNo 존재 여부를 토큰 없이 확인하는 창구가 된다.
 */
export async function getShowOrderForManage(rawOrderNo: string, token: string, now: Date): Promise<ManageOrderView | null> {
  const db = getDb();
  // middleware.ts가 대문자 포함 경로를 소문자로 308 리다이렉트하므로, URL에서 온 orderNo는 소문자로
  // 도착한다(generateShowOrderNo는 항상 대문자만 생성) — 대문자로 정규화해 비교한다. SQLite `=`는
  // 대소문자 구분. booking·funding의 findXxxOrderByOrderNo와 같은 처리. 이게 없던 동안 티켓 메일의
  // "내 티켓" 링크가 전부 404였다(2026-10-03).
  const orderNo = rawOrderNo.toUpperCase();
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
  // refundShowTickets와 같은 판정 — 회차가 취소됐으면 전액(계좌 입금 주문은 이 경로로 환불 계좌를 적는다).
  const refundPctNow = showOrder.showtime.status === 'cancelled' ? 100 : refundRateForNotice(new Date(startsAt * 1000), now);
  const refundableOrder = order.status === 'paid' || order.status === 'partially_refunded';
  const payments = await db.query.payments.findMany({ where: (p, { eq }) => eq(p.orderId, order.id) });
  const bankDeposit = bankDepositStateOf({ status: order.status, payments });
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
    bankDeposit,
    depositGuide: bankDeposit === 'awaiting'
      ? {
          amount: order.totalAmount,
          deadline: bankDepositDeadlineOf({ createdAt: order.createdAt, startsAt: new Date(startsAt * 1000), guideDays: BANK_DEPOSIT_GUIDE_DAYS }).toISOString(),
          customerName: showOrder.buyerName,
        }
      : null,
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

// ─── 목록 ───────────────────────────────────────────────────────────────────────

export interface PublicShowList {
  /** 아직 열리지 않았거나 진행 전인 공연 — 가장 가까운 회차 순. */
  upcoming: PublicShow[];
  /** 모든 회차가 지났거나 취소된 공연 — 최근 순. */
  past: PublicShow[];
}

/**
 * 공개 공연 목록. draft는 빼고, 취소된 공연은 지난 공연 쪽으로 보낸다(주소는 그대로 열린다).
 * 회차·잔여석은 상세와 같은 getPublicShowBySlug를 거쳐 두 화면의 숫자가 갈리지 않게 한다 —
 * 공연 수가 한 자릿수라 N+1이 문제 되지 않는다.
 */
export async function listPublicShows(now: Date): Promise<PublicShowList> {
  const rows = await getDb().query.shows.findMany({
    where: (s, { ne }) => ne(s.status, 'draft'),
  });
  const loaded = await Promise.all(rows.map((r) => getPublicShowBySlug(r.slug, now)));
  const shows = loaded.filter((s): s is PublicShow => s !== null);
  const nowSec = Math.floor(now.getTime() / 1000);

  const upcoming = shows
    .filter((s) => !s.cancelled && nextShowtimeOf(s, nowSec) !== null)
    .sort((a, b) => nextShowtimeOf(a, nowSec)!.startsAt - nextShowtimeOf(b, nowSec)!.startsAt);
  const past = shows
    .filter((s) => !upcoming.includes(s))
    .sort((a, b) => Math.max(0, ...b.showtimes.map((t) => t.startsAt)) - Math.max(0, ...a.showtimes.map((t) => t.startsAt)));
  return { upcoming, past };
}
