import type { NextApiRequest, NextApiResponse } from 'next';
import { eq, sql } from 'drizzle-orm';

import { getDb } from '../../../../db/client';
import { showTicketTypes, showtimes, showZones } from '../../../../db/schema';
import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { cancelPayment } from '../../../../lib/booking/toss';
import { SCAN_LINK_MAX_TTL_HOURS } from '../../../../lib/shows/scanLink';
import { createScanLinkToken } from '../../../../lib/shows/scanAccess';
import { issueReportLink, REPORT_LINK_MAX_TTL_DAYS, revokeReportLink } from '../../../../lib/shows/reportLink';
import { undoCheckIn } from '../../../../lib/shows/checkin';
import { sendShowRefundEmail, sendShowtimeCancelledEmail } from '../../../../lib/shows/email';
import { refundShowTickets } from '../../../../lib/shows/refund';
import { issueCompTickets, revokeCompTicket } from '../../../../lib/shows/service';
import { cancelShowtime, changeShowtime } from '../../../../lib/shows/showtimeOps';
import { cancelAwaitingShowDeposit, confirmShowBankDeposit, deliverShowDepositGuide } from '../../../../lib/shows/bankDeposit';
import { AWAITING_DEPOSIT, bankDepositStateOf } from '../../../../lib/payments/bankDeposit';
import { markRefundAccountRefunded } from '../../../../lib/payments/refundAccount';

/**
 * 관리자 공연 운영 액션 — 한 라우트에 action으로 갈린다(pages/api/admin/funding/pledges/[id].ts와 같은 형태).
 * `id`는 공연(shows.id)이고, 본문의 회차·티켓·주문은 **이 공연에 속하는지** 매번 확인한다 — 다른 공연의 id를
 * 넣어 이 경로로 조작하는 것을 막는다.
 *
 * 돈이 움직이는 액션(refund_tickets·cancel_showtime)은 lib/shows의 도메인 함수가 멱등키·잔액·체크인 제외를 처리한다.
 * 여기서는 입력 검증과 소속 확인만 한다.
 */

const ISSUE_CODE_STATUS: Record<string, number> = {
  invalid_quantity: 400, ticket_type_mismatch: 400, sales_closed: 409, sold_out: 409,
};
const REFUND_REASON_MESSAGE: Record<string, string> = {
  no_tickets: '환불할 티켓을 선택해 주세요.',
  not_found: '주문을 찾을 수 없습니다.',
  invalid_order_status: '환불할 수 없는 주문 상태입니다.',
  ticket_not_found: '이 주문에 없는 티켓이 포함돼 있습니다.',
  checked_in: '이미 입장한 티켓은 환불할 수 없습니다.',
  not_issued: '발권된 티켓만 환불할 수 있습니다.',
  after_showtime_start: '공연이 시작된 뒤라 환불표상 환불액이 없습니다.',
  refund_account_unavailable: '환불 계좌 표를 읽거나 쓸 수 없습니다(마이그레이션 0048·키 확인).',
};

const sqlUpdateStatus = (showId: string, status: 'draft' | 'published', now: Date) =>
  sql`UPDATE shows SET status = ${status}, updated_at = ${Math.floor(now.getTime() / 1000)} WHERE id = ${showId} AND status != 'cancelled'`;

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

/** 공개 페이지를 다시 만든다 — best-effort. 이 앱이 ISR이 아닌 경로에서 던지는 오류는 무시한다. */
async function revalidateShow(res: NextApiResponse, slug: string) {
  for (const path of ['/ko/shows', `/ko/shows/${slug}`]) {
    try {
      await res.revalidate(path);
    } catch {
      /* 재검증 실패가 운영 액션을 실패시키지 않는다 */
    }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  const db = getDb();
  // 관계 조회(with)를 쓰지 않는다 — shows의 zones·ticketTypes 관계는 반대편 one()이 선언돼 있지 않아 drizzle이 추론하지 못한다.
  const showRow = id ? await db.query.shows.findFirst({ where: (s, { eq }) => eq(s.id, id) }) : undefined;
  if (!showRow) return res.status(404).json({ ok: false, message: '공연을 찾을 수 없습니다.' });
  const [zones, ticketTypes, showtimeRows] = await Promise.all([
    db.select().from(showZones).where(eq(showZones.showId, showRow.id)),
    db.select().from(showTicketTypes).where(eq(showTicketTypes.showId, showRow.id)),
    db.select().from(showtimes).where(eq(showtimes.showId, showRow.id)),
  ]);
  const show = { ...showRow, zones, ticketTypes, showtimes: showtimeRows };

  const b = (typeof req.body === 'object' && req.body) || {};
  const now = new Date();
  const showtimeOf = (v: unknown) => (isNonEmptyString(v) ? show.showtimes.find((s) => s.id === v) : undefined);

  switch (b.action) {
    case 'set_status': {
      const next = b.status;
      if (next !== 'draft' && next !== 'published') return res.status(400).json({ ok: false, message: '상태는 draft 또는 published만 바꿀 수 있습니다.' });
      if (show.status === 'cancelled') return res.status(409).json({ ok: false, message: '취소된 공연은 상태를 바꿀 수 없습니다.' });
      if (next === 'published') {
        const live = show.showtimes.some((s) => s.status === 'scheduled' && s.startsAt * 1000 > now.getTime());
        if (!live || show.zones.length === 0 || show.ticketTypes.length === 0) {
          return res.status(409).json({ ok: false, message: '공개하려면 예정된 회차·구역·티켓타입이 모두 필요합니다.' });
        }
      }
      await db.run(sqlUpdateStatus(show.id, next, now));
      await revalidateShow(res, show.slug);
      return res.status(200).json({ ok: true });
    }

    case 'issue_comp': {
      const showtime = showtimeOf(b.showtimeId);
      const ticketType = show.ticketTypes.find((t) => t.id === b.ticketTypeId);
      const quantity = typeof b.quantity === 'number' ? b.quantity : Number.NaN;
      if (!showtime || !ticketType) return res.status(400).json({ ok: false, message: '회차·티켓타입을 확인해 주세요.' });
      if (!isNonEmptyString(b.note)) return res.status(400).json({ ok: false, message: '발급 사유(받는 분)를 적어 주세요.' });
      const r = await issueCompTickets({ showtimeId: showtime.id, ticketTypeId: ticketType.id, quantity, note: b.note.trim().slice(0, 100) }, now);
      if (r.ok) return res.status(200).json({ ok: true, orderNo: r.orderNo });
      const message = r.code === 'sold_out'
        ? '정원 또는 초대권 한도(compQuota)를 넘습니다. 초대권을 발급하려면 티켓타입의 compQuota를 먼저 올려야 합니다.'
        : r.code === 'sales_closed' ? '판매가 마감된 회차입니다.' : '발급할 수 없습니다.';
      return res.status(ISSUE_CODE_STATUS[r.code] ?? 400).json({ ok: false, message });
    }

    case 'revoke_comp': {
      const ticket = await ownTicket(show.id, b.ticketId);
      if (!ticket) return res.status(404).json({ ok: false, message: '티켓을 찾을 수 없습니다.' });
      const ok = await revokeCompTicket(ticket.id);
      return ok ? res.status(200).json({ ok: true }) : res.status(409).json({ ok: false, message: '초대권이 아니거나 이미 입장한 티켓은 취소할 수 없습니다.' });
    }

    case 'undo_checkin': {
      const ticket = await ownTicket(show.id, b.ticketId);
      if (!ticket) return res.status(404).json({ ok: false, message: '티켓을 찾을 수 없습니다.' });
      const ok = await undoCheckIn(ticket.id, 'admin', now);
      return ok ? res.status(200).json({ ok: true }) : res.status(409).json({ ok: false, message: '입장 기록이 없습니다.' });
    }

    case 'cancel_showtime': {
      const showtime = showtimeOf(b.showtimeId);
      if (!showtime) return res.status(404).json({ ok: false, message: '회차를 찾을 수 없습니다.' });
      if (showtime.status !== 'scheduled') return res.status(409).json({ ok: false, message: '예정된 회차만 취소할 수 있습니다.' });
      // 취소 전에 안내 대상(결제가 살아 있는 주문)을 잡아 둔다 — 취소 뒤에는 refunded로 바뀌어 구분이 안 된다.
      const affected = await db.all(sql`
        SELECT DISTINCT so.order_no as orderNo FROM show_orders so
        JOIN orders o ON o.order_no = so.order_no
        WHERE so.showtime_id = ${showtime.id} AND o.status IN ('paid', 'partially_refunded')
      `) as Array<{ orderNo: string }>;
      const r = await cancelShowtime(showtime.id, now, { cancelPayment });
      for (const { orderNo } of affected) {
        try {
          await sendShowtimeCancelledEmail(orderNo, {
            refundCompleted: !r.failedOrders.includes(orderNo) && !r.bankRefundOrders.includes(orderNo),
            ...(r.bankRefundOrders.includes(orderNo) ? { bankNotice: 'refund_account_needed' as const } : {}),
          });
        } catch (error) {
          console.error('[admin-shows] 회차 취소 안내 메일 실패', { orderNo, error });
        }
      }
      // 입금 전이던 계좌 입금 신청 — 입금하지 말라고 알린다(받은 돈이 없어 환불 안내가 아니다).
      for (const orderNo of r.closedDepositOrders) {
        try {
          await sendShowtimeCancelledEmail(orderNo, { refundCompleted: false, bankNotice: 'not_deposited' });
        } catch (error) {
          console.error('[admin-shows] 회차 취소 안내 메일 실패(입금 전 신청)', { orderNo, error });
        }
      }
      await revalidateShow(res, show.slug);
      // 일부 주문의 환불이 실패해도 회차는 이미 취소됐다 — 실패 주문을 응답에 실어 운영자가 이어서 처리한다.
      // 계좌 입금 주문은 토스로 돌려줄 수 없어 고객이 환불 계좌를 적거나 운영자가 송금 뒤 "환불"로 기록한다.
      return res.status(200).json({
        ok: true, refundedOrders: r.refundedOrders, failedOrders: r.failedOrders,
        bankRefundOrders: r.bankRefundOrders, closedDepositOrders: r.closedDepositOrders,
      });
    }

    case 'change_showtime': {
      const showtime = showtimeOf(b.showtimeId);
      if (!showtime) return res.status(404).json({ ok: false, message: '회차를 찾을 수 없습니다.' });
      if (showtime.status !== 'scheduled') return res.status(409).json({ ok: false, message: '예정된 회차만 변경할 수 있습니다.' });
      const next = typeof b.startsAt === 'string' ? new Date(b.startsAt) : null;
      if (!next || Number.isNaN(next.getTime()) || next.getTime() <= now.getTime()) {
        return res.status(400).json({ ok: false, message: '새 시작 시각이 올바르지 않습니다(과거 불가).' });
      }
      await changeShowtime(showtime.id, next, now);
      await revalidateShow(res, show.slug);
      return res.status(200).json({ ok: true });
    }

    case 'refund_tickets': {
      const orderNo = isNonEmptyString(b.orderNo) ? b.orderNo : '';
      const ticketIds = Array.isArray(b.ticketIds) ? b.ticketIds.filter(isNonEmptyString) : [];
      const showtimeIds = new Set(show.showtimes.map((s) => s.id));
      const showOrder = orderNo ? await db.query.showOrders.findFirst({ where: (o, { eq }) => eq(o.orderNo, orderNo) }) : undefined;
      if (!showOrder || !showtimeIds.has(showOrder.showtimeId)) return res.status(404).json({ ok: false, message: '이 공연의 주문이 아닙니다.' });
      const r = await refundShowTickets({ orderNo, ticketIds, noticeAt: now }, { cancelPayment });
      if (r.status === 'refunded') {
        try {
          await sendShowRefundEmail(orderNo, { refundedAmount: r.amount, fullyRefunded: r.orderStatus === 'refunded', refundVia: r.refundVia });
        } catch (error) {
          console.error('[admin-shows] 환불 메일 실패', { orderNo, error });
        }
        return res.status(200).json({ ok: true, amount: r.amount, orderStatus: r.orderStatus });
      }
      if (r.status === 'toss_unknown') {
        return res.status(504).json({ ok: false, message: '토스 응답을 받지 못했습니다. 취소가 이미 됐을 수 있으니 토스 콘솔에서 확인해 주세요.' });
      }
      return res.status(409).json({ ok: false, message: REFUND_REASON_MESSAGE[r.reason] ?? `환불할 수 없습니다(${r.reason}).` });
    }

    /**
     * 계좌 입금(lib/shows/bankDeposit.ts) — 입금 확인(발권·티켓 메일) · 미입금 취소 · 입금 안내 재발송 ·
     * 환불 송금 완료. 판정은 고객 화면과 같은 bankDepositStateOf.
     */
    case 'confirm_deposit':
    case 'cancel_unpaid_deposit':
    case 'resend_deposit_guide':
    case 'mark_refund_sent': {
      const orderNo = isNonEmptyString(b.orderNo) ? b.orderNo : '';
      const showtimeIds = new Set(show.showtimes.map((s) => s.id));
      const showOrder = orderNo ? await db.query.showOrders.findFirst({ where: (o, { eq }) => eq(o.orderNo, orderNo) }) : undefined;
      if (!showOrder || !showtimeIds.has(showOrder.showtimeId)) return res.status(404).json({ ok: false, message: '이 공연의 주문이 아닙니다.' });
      const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, orderNo), with: { payments: true } });
      if (!order) return res.status(404).json({ ok: false, message: '주문을 찾을 수 없습니다.' });
      const state = bankDepositStateOf(order);
      if (b.action === 'mark_refund_sent') {
        if (state !== 'paid') return res.status(409).json({ ok: false, message: '계좌 입금 주문이 아닙니다.' });
        await markRefundAccountRefunded({ kind: 'show', orderNo }, now);
        return res.status(200).json({ ok: true });
      }
      if (order.status !== AWAITING_DEPOSIT) return res.status(409).json({ ok: false, message: '입금 대기 중인 계좌 입금 신청이 아닙니다. 새로고침해 주세요.' });
      if (b.action === 'confirm_deposit') {
        const r = await confirmShowBankDeposit({ orderId: order.id, now });
        if (!r.ok) return res.status(r.code === 'not_found' ? 404 : 409).json({ ok: false, message: r.message });
        await revalidateShow(res, show.slug);
        return res.status(200).json({ ok: true, emailSent: r.emailSent ?? null });
      }
      if (b.action === 'cancel_unpaid_deposit') {
        const r = await cancelAwaitingShowDeposit({ orderId: order.id });
        if (!r.ok) return res.status(r.code === 'not_found' ? 404 : 409).json({ ok: false, message: r.message });
        await revalidateShow(res, show.slug);
        return res.status(200).json({ ok: true });
      }
      const failure = await deliverShowDepositGuide(orderNo);
      return res.status(200).json({ ok: true, notificationError: failure });
    }

    case 'issue_scan_link': {
      const showtime = showtimeOf(b.showtimeId);
      if (!showtime) return res.status(404).json({ ok: false, message: '회차를 찾을 수 없습니다.' });
      const label = isNonEmptyString(b.label) ? b.label.trim().slice(0, 40) : '';
      const ttlHours = typeof b.ttlHours === 'number' ? b.ttlHours : Number.NaN;
      if (!label) return res.status(400).json({ ok: false, message: '스캔 링크 이름(담당자)을 적어 주세요.' });
      if (!Number.isFinite(ttlHours) || ttlHours < 1 || ttlHours > SCAN_LINK_MAX_TTL_HOURS) {
        return res.status(400).json({ ok: false, message: `유효 시간은 1~${SCAN_LINK_MAX_TTL_HOURS}시간입니다.` });
      }
      const token = await createScanLinkToken(showtime.id, label, ttlHours);
      // 토큰 원문은 지금 응답에서만 볼 수 있다(DB에는 해시만 있다) — 화면이 바로 보여 준다.
      return res.status(200).json({ ok: true, path: `/ko/shows/scan/${token}` });
    }

    case 'issue_report_link': {
      const label = isNonEmptyString(b.label) ? b.label.trim().slice(0, 40) : '';
      const ttlDays = typeof b.ttlDays === 'number' ? b.ttlDays : Number.NaN;
      if (!label) return res.status(400).json({ ok: false, message: '받는 분(기획자 이름·단체)을 적어 주세요.' });
      if (!Number.isFinite(ttlDays) || ttlDays < 1 || ttlDays > REPORT_LINK_MAX_TTL_DAYS) {
        return res.status(400).json({ ok: false, message: `유효 기간은 1~${REPORT_LINK_MAX_TTL_DAYS}일입니다.` });
      }
      try {
        const { token } = await issueReportLink(show.id, label, ttlDays, now);
        // 토큰 원문은 지금 응답에서만 볼 수 있다(DB에는 해시만 있다).
        return res.status(200).json({ ok: true, path: `/ko/shows/report/${token}` });
      } catch (error) {
        console.error('[admin-shows] 현황 링크 발급 실패', error);
        return res.status(500).json({ ok: false, message: '현황 링크 표를 쓸 수 없습니다(마이그레이션 0051 확인).' });
      }
    }

    case 'revoke_report_link': {
      if (!isNonEmptyString(b.linkId)) return res.status(400).json({ ok: false, message: '링크를 찾을 수 없습니다.' });
      const ok = await revokeReportLink(show.id, b.linkId, now);
      return ok ? res.status(200).json({ ok: true }) : res.status(409).json({ ok: false, message: '이미 폐기됐거나 이 공연의 링크가 아닙니다.' });
    }

    default:
      return res.status(400).json({ ok: false, message: '알 수 없는 요청입니다.' });
  }

  async function ownTicket(showId: string, ticketId: unknown) {
    if (!isNonEmptyString(ticketId)) return null;
    const ticket = await db.query.showTickets.findFirst({ where: (t, { eq }) => eq(t.id, ticketId), with: { showtime: true } });
    return ticket && ticket.showtime.showId === showId ? ticket : null;
  }
}
