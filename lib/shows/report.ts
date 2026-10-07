import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { showtimeStats } from './adminQueries';

/**
 * 기획자 현황 화면(pages/[locale]/shows/report/[token].tsx)의 조회 — 한 공연의 판매 집계.
 *
 * **개인정보·주문 식별자는 싣지 않는다**(이름·연락처·이메일·주문번호·티켓 코드). 이 화면은 외부 기획자에게 가는
 * 링크이고 처리방침 4항은 제3자 제공을 하지 않는다고 약속한다. 회차 집계는 관리자 화면과 같은 SQL
 * (adminQueries.showtimeStats)을 써서 두 화면의 숫자가 갈리지 않게 한다.
 */

export interface ShowReportTicketType {
  name: string;
  price: number;
  /** 판매(결제 확정된 일반 티켓) 매수. */
  sold: number;
  /** 초대권 매수. */
  comp: number;
  /** 판매 금액(살아 있는 일반 티켓의 단가 합). */
  amount: number;
}

export interface ShowReportShowtime {
  id: string;
  startsAt: number;
  label: string;
  status: string;
  salesCloseAt: number;
  capacity: number;
  sold: number;
  comp: number;
  /** 결제 대기·입금 대기로 잡혀 있는 좌석(아직 발권 전). */
  held: number;
  /** 계좌 입금 대기 신청 건수. */
  awaitingDeposit: number;
  refunded: number;
  checkedIn: number;
  /** 판매 금액 — 취소된 회차는 0(adminQueries의 grossAmount와 같은 정의). */
  amount: number;
  ticketTypes: ShowReportTicketType[];
}

export interface ShowReport {
  slug: string;
  title: string;
  venueName: string;
  showtimes: ShowReportShowtime[];
  totals: { capacity: number; sold: number; comp: number; held: number; refunded: number; checkedIn: number; amount: number };
}

export async function loadShowReport(showId: string): Promise<ShowReport | null> {
  const db = getDb();
  const show = await db.query.shows.findFirst({ where: (s, { eq }) => eq(s.id, showId) });
  if (!show) return null;

  const [stats, typeRows, refundRows] = await Promise.all([
    showtimeStats(showId),
    db.all(sql`
      SELECT st.id as showtimeId, st.status as showtimeStatus, tt.id as typeId, tt.name as name, tt.price as price, tt.created_at as createdAt,
        (SELECT COUNT(*) FROM show_tickets t WHERE t.showtime_id = st.id AND t.ticket_type_id = tt.id AND t.status = 'issued' AND t.issued_by = 'customer') as sold,
        (SELECT COUNT(*) FROM show_tickets t WHERE t.showtime_id = st.id AND t.ticket_type_id = tt.id AND t.status = 'issued' AND t.issued_by = 'organizer_comp') as comp,
        (SELECT COALESCE(SUM(t.unit_amount), 0) FROM show_tickets t WHERE t.showtime_id = st.id AND t.ticket_type_id = tt.id AND t.status = 'issued') as amount
      FROM showtimes st JOIN show_ticket_types tt ON tt.show_id = st.show_id
      WHERE st.show_id = ${showId}
    `) as Promise<Array<Record<string, string | number | null>>>,
    db.all(sql`
      SELECT t.showtime_id as showtimeId, COUNT(*) as refunded FROM show_tickets t
      JOIN showtimes st ON st.id = t.showtime_id
      WHERE st.show_id = ${showId} AND t.status = 'refunded'
      GROUP BY t.showtime_id
    `) as Promise<Array<Record<string, string | number>>>,
  ]);

  const refundedBy = new Map(refundRows.map((r) => [String(r.showtimeId), Number(r.refunded)]));
  const typesBy = new Map<string, Array<ShowReportTicketType & { createdAt: number }>>();
  for (const r of typeRows) {
    const key = String(r.showtimeId);
    const list = typesBy.get(key) ?? [];
    list.push({
      name: String(r.name),
      price: Number(r.price),
      sold: Number(r.sold),
      comp: Number(r.comp),
      // 취소된 회차의 판매 금액은 돌려줄 돈이다 — 회차 합계와 같은 정의로 0.
      amount: r.showtimeStatus === 'cancelled' ? 0 : Number(r.amount),
      createdAt: Number(r.createdAt),
    });
    typesBy.set(key, list);
  }

  const showtimes: ShowReportShowtime[] = stats
    .sort((a, b) => a.startsAt - b.startsAt)
    .map((s) => ({
      id: s.id,
      startsAt: s.startsAt,
      label: s.label,
      status: s.status,
      salesCloseAt: s.salesCloseAt,
      capacity: s.capacity,
      sold: s.issued - s.comp,
      comp: s.comp,
      held: s.held,
      awaitingDeposit: s.awaitingDeposit,
      refunded: refundedBy.get(s.id) ?? 0,
      checkedIn: s.checkedIn,
      amount: s.grossAmount,
      ticketTypes: (typesBy.get(s.id) ?? [])
        .sort((a, b) => b.price - a.price || a.createdAt - b.createdAt)
        .map(({ createdAt: _createdAt, ...t }) => t),
    }));

  const sum = (pick: (s: ShowReportShowtime) => number) =>
    showtimes.filter((s) => s.status !== 'cancelled').reduce((n, s) => n + pick(s), 0);
  return {
    slug: show.slug,
    title: show.title,
    venueName: show.venueName,
    showtimes,
    totals: {
      capacity: sum((s) => s.capacity),
      sold: sum((s) => s.sold),
      comp: sum((s) => s.comp),
      held: sum((s) => s.held),
      refunded: showtimes.reduce((n, s) => n + s.refunded, 0),
      checkedIn: sum((s) => s.checkedIn),
      amount: sum((s) => s.amount),
    },
  };
}
