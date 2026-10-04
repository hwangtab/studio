import { eq, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { showTicketTypes, showZones } from '../../db/schema';
import { AWAITING_DEPOSIT, bankDepositStateOf, type BankDepositState } from '../payments/bankDeposit';
import { showDepositDeadline } from './bankDeposit';
import { formatEntryNumber, formatShowtimeLabel } from './format';

/**
 * 관리자 공연 화면의 조회 — 읽기 전용. 쓰기는 pages/api/admin/shows/[id].ts가 lib/shows/*의 도메인 함수만 부른다.
 *
 * 집계는 SQL 한 번으로 한다. 티켓 상태별 개수를 TS에서 전 행을 읽어 세지 않는다.
 */

export interface AdminShowtimeStat {
  id: string;
  startsAt: number;
  label: string;
  status: string;
  salesCloseAt: number;
  /** 구역 정원 합계. */
  capacity: number;
  issued: number;
  held: number;
  /** 계좌 입금 대기 주문 수(`orders.status = 'awaiting_deposit'`) — 목록 배지용. held에는 이 주문의 티켓도 들어 있다. */
  awaitingDeposit: number;
  comp: number;
  checkedIn: number;
  /** 결제 확정 매출(환불 반영 전 단가 합 — 정산 정본이 아니라 현황 참고용). */
  grossAmount: number;
}

export interface AdminShowListItem {
  id: string;
  slug: string;
  title: string;
  status: string;
  showtimes: AdminShowtimeStat[];
}

export async function listAdminShows(): Promise<AdminShowListItem[]> {
  const db = getDb();
  const showRows = await db.query.shows.findMany({ orderBy: (s, { desc }) => desc(s.createdAt) });
  if (showRows.length === 0) return [];
  const stats = await showtimeStats();
  return showRows.map((s) => ({
    id: s.id,
    slug: s.slug,
    title: s.title,
    status: s.status,
    showtimes: stats.filter((t) => t.showId === s.id).sort((a, b) => a.startsAt - b.startsAt),
  }));
}

async function showtimeStats(showId?: string): Promise<Array<AdminShowtimeStat & { showId: string }>> {
  const db = getDb();
  const rows = (await db.all(sql`
    SELECT st.id as id, st.show_id as showId, st.starts_at as startsAt, st.status as status, st.sales_close_at as salesCloseAt,
      (SELECT COALESCE(SUM(z.capacity), 0) FROM show_zones z WHERE z.show_id = st.show_id) as capacity,
      (SELECT COUNT(*) FROM show_tickets t WHERE t.showtime_id = st.id AND t.status = 'issued') as issued,
      (SELECT COUNT(*) FROM show_tickets t WHERE t.showtime_id = st.id AND t.status = 'held') as held,
      (SELECT COUNT(*) FROM show_orders so JOIN orders o ON o.order_no = so.order_no WHERE so.showtime_id = st.id AND o.status = ${AWAITING_DEPOSIT}) as awaitingDeposit,
      (SELECT COUNT(*) FROM show_tickets t WHERE t.showtime_id = st.id AND t.status = 'issued' AND t.issued_by = 'organizer_comp') as comp,
      (SELECT COUNT(*) FROM show_tickets t WHERE t.showtime_id = st.id AND t.status = 'issued' AND t.checked_in_at IS NOT NULL) as checkedIn,
      (SELECT COALESCE(SUM(t.unit_amount), 0) FROM show_tickets t WHERE t.showtime_id = st.id AND t.status = 'issued') as grossAmount
    FROM showtimes st
    ${showId ? sql`WHERE st.show_id = ${showId}` : sql``}
  `)) as Array<Record<string, number | string>>;
  return rows.map((r) => ({
    id: String(r.id),
    showId: String(r.showId),
    startsAt: Number(r.startsAt),
    label: formatShowtimeLabel(Number(r.startsAt)),
    status: String(r.status),
    salesCloseAt: Number(r.salesCloseAt),
    capacity: Number(r.capacity),
    issued: Number(r.issued),
    held: Number(r.held),
    awaitingDeposit: Number(r.awaitingDeposit),
    comp: Number(r.comp),
    checkedIn: Number(r.checkedIn),
    grossAmount: Number(r.grossAmount),
  }));
}

export interface AdminTicketRow {
  id: string;
  code: string;
  entryNumber: string | null;
  status: string;
  issuedBy: string;
  ticketTypeName: string;
  unitAmount: number;
  checkedInAt: number | null;
  checkedInBy: string | null;
}

export interface AdminOrderRow {
  /** orders.id — 환불 계좌 조회 API가 이 값을 쓴다. */
  orderId: string;
  orderNo: string;
  /** 온라인 계좌 입금 주문의 단계 — 토스·초대권은 null. */
  bankDeposit: BankDepositState | null;
  /** 입금 안내 기한(ISO) — 입금 대기일 때만. 안내용이며 자동 취소는 없다. */
  depositDeadline: string | null;
  /** 고객 이름(orders.customer_name) — 환불 계좌 예금주 대조·동명 후보 조회에 쓴다. */
  customerName: string;
  isComp: boolean;
  orderStatus: string;
  /** 초대권이면 발급 사유(note)가 들어 있다 — lib/shows/service.ts issueCompTickets가 그 칸에 적는다. */
  buyerName: string;
  buyerContact: string;
  totalAmount: number;
  createdAt: number;
  tickets: AdminTicketRow[];
}

export interface AdminShowtimeDetail extends AdminShowtimeStat {
  orders: AdminOrderRow[];
  scanLinks: Array<{ id: string; label: string; expiresAt: number; revokedAt: number | null }>;
}

export interface AdminShowDetail {
  id: string;
  slug: string;
  title: string;
  status: string;
  venueName: string;
  zones: Array<{ id: string; code: string; label: string; capacity: number }>;
  ticketTypes: Array<{ id: string; name: string; price: number; quota: number | null; compQuota: number; zoneCode: string }>;
  showtimes: AdminShowtimeDetail[];
}

export async function loadAdminShowDetail(showId: string): Promise<AdminShowDetail | null> {
  const db = getDb();
  const showRow = await db.query.shows.findFirst({ where: (s, { eq }) => eq(s.id, showId) });
  if (!showRow) return null;
  // 관계 조회(with)를 쓰지 않는다 — shows의 zones·ticketTypes 관계는 반대편 one()이 없어 drizzle이 추론하지 못한다.
  const [zones, ticketTypes] = await Promise.all([
    db.select().from(showZones).where(eq(showZones.showId, showId)),
    db.select().from(showTicketTypes).where(eq(showTicketTypes.showId, showId)),
  ]);
  const show = { ...showRow, zones, ticketTypes };
  const stats = await showtimeStats(showId);
  const typeById = new Map(show.ticketTypes.map((t) => [t.id, t]));

  const showtimes: AdminShowtimeDetail[] = [];
  for (const st of stats.sort((a, b) => a.startsAt - b.startsAt)) {
    const [orders, scanLinks] = await Promise.all([
      db.query.showOrders.findMany({
        where: (o, { eq }) => eq(o.showtimeId, st.id),
        with: { order: { with: { payments: true } }, tickets: true },
        orderBy: (o, { desc }) => desc(o.createdAt),
      }),
      db.query.showScanLinks.findMany({ where: (l, { eq }) => eq(l.showtimeId, st.id), orderBy: (l, { desc }) => desc(l.createdAt) }),
    ]);
    showtimes.push({
      ...st,
      scanLinks: scanLinks.map((l) => ({ id: l.id, label: l.label, expiresAt: l.expiresAt, revokedAt: l.revokedAt })),
      orders: orders.map((o) => {
        const bankDeposit = bankDepositStateOf({ status: o.order.status, payments: o.order.payments });
        return {
        orderId: o.order.id,
        orderNo: o.orderNo,
        bankDeposit,
        depositDeadline: bankDeposit === 'awaiting' ? showDepositDeadline(o.order.createdAt.getTime() / 1000, st.startsAt).toISOString() : null,
        customerName: o.order.customerName,
        isComp: o.buyerContact === 'comp',
        orderStatus: o.order.status,
        buyerName: o.buyerName,
        buyerContact: o.buyerContact,
        totalAmount: o.order.totalAmount,
        createdAt: o.createdAt,
        tickets: o.tickets.map((t) => ({
          id: t.id,
          code: t.code,
          entryNumber: t.entryNumber != null ? formatEntryNumber(t.entryNumber) : null,
          status: t.status,
          issuedBy: t.issuedBy,
          ticketTypeName: typeById.get(t.ticketTypeId)?.name ?? '-',
          unitAmount: t.unitAmount,
          checkedInAt: t.checkedInAt,
          checkedInBy: t.checkedInBy,
        })),
        };
      }),
    });
  }

  const zoneCode = new Map(show.zones.map((z) => [z.id, z.code]));
  return {
    id: show.id,
    slug: show.slug,
    title: show.title,
    status: show.status,
    venueName: show.venueName,
    zones: show.zones.map((z) => ({ id: z.id, code: z.code, label: z.label, capacity: z.capacity })),
    ticketTypes: show.ticketTypes.map((t) => ({
      id: t.id, name: t.name, price: t.price, quota: t.quota, compQuota: t.compQuota, zoneCode: zoneCode.get(t.zoneId) ?? '-',
    })),
    showtimes,
  };
}

/** 명단 CSV 한 줄 — 회차의 살아 있는(환불·무효가 아닌) 티켓만. 입장 확인용이라 개인정보는 이름·연락처뿐이다. */
export interface RosterRow {
  entryNumber: string;
  code: string;
  ticketType: string;
  kind: string;
  buyerName: string;
  buyerContact: string;
  orderNo: string;
  status: string;
  checkedIn: string;
}

export const ROSTER_COLUMNS = ['entryNumber', 'code', 'ticketType', 'kind', 'buyerName', 'buyerContact', 'orderNo', 'status', 'checkedIn'];

export async function listRosterRows(showtimeId: string): Promise<RosterRow[]> {
  const db = getDb();
  const rows = (await db.all(sql`
    SELECT t.entry_number as entryNumber, t.code as code, tt.name as ticketType, t.issued_by as issuedBy,
           so.buyer_name as buyerName, so.buyer_contact as buyerContact, t.order_no as orderNo, t.status as status,
           t.checked_in_at as checkedInAt
    FROM show_tickets t
    JOIN show_orders so ON so.order_no = t.order_no
    JOIN show_ticket_types tt ON tt.id = t.ticket_type_id
    WHERE t.showtime_id = ${showtimeId} AND t.status = 'issued'
    ORDER BY t.entry_number IS NULL, t.entry_number, so.created_at, t.created_at
  `)) as Array<Record<string, string | number | null>>;
  return rows.map((r) => ({
    entryNumber: r.entryNumber != null ? formatEntryNumber(Number(r.entryNumber)) : '',
    code: String(r.code),
    ticketType: String(r.ticketType),
    kind: r.issuedBy === 'organizer_comp' ? '초대' : '일반',
    // 초대권은 buyer_name 칸에 발급 사유가 들어 있고 buyer_contact는 'comp' 표식이다.
    buyerName: String(r.buyerName),
    buyerContact: r.buyerContact === 'comp' ? '' : String(r.buyerContact),
    orderNo: String(r.orderNo),
    status: String(r.status),
    checkedIn: r.checkedInAt != null ? 'Y' : '',
  }));
}
