import type { NextApiRequest, NextApiResponse } from 'next';
import { eq, sql } from 'drizzle-orm';

import { getDb } from '../../../../db/client';
import { showTicketTypes, showtimes, showZones } from '../../../../db/schema';
import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { cancelPayment, fetchPayment } from '../../../../lib/booking/toss';
import { isPublishable, revalidateShow, sqlUpdateStatus } from '../../../../lib/shows/revalidate';
import { SCAN_LINK_MAX_TTL_HOURS, revokeScanLink } from '../../../../lib/shows/scanLink';
import { createScanLinkToken } from '../../../../lib/shows/scanAccess';
import { issueReportLink, REPORT_LINK_MAX_TTL_DAYS, revokeReportLink } from '../../../../lib/shows/reportLink';
import { undoCheckIn } from '../../../../lib/shows/checkin';
import { sendShowRefundEmail, sendShowtimeCancelledEmail } from '../../../../lib/shows/email';
import { reconcileShowRefund, refundShowTickets } from '../../../../lib/shows/refund';
import { issueCompTickets, revokeCompTicket } from '../../../../lib/shows/service';
import { cancelShowtime, changeShowtime } from '../../../../lib/shows/showtimeOps';
import { SHOWTIME_CANCEL_REFUND_REASON } from '../../../../lib/shows/refundReasons';
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

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

// 회차 취소는 주문당 Turso 왕복·토스 호출이 직렬이라 기본 함수 시간 한도에 걸릴 수 있다 — 다른 돈 경로 라우트와 같은 60초.
export const config = { maxDuration: 60 };

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
      // 취소된 공연(마지막 회차가 취소돼 자동으로 닫힌 것)도 되돌릴 수 있다 — 공개는 예정된 미래 회차가 있어야 하므로
      // 새 일정을 잡은 뒤에만 열리고, 초안으로 내리는 것은 언제든 된다.
      if (next === 'published') {
        if (!isPublishable(show, now)) {
          return res.status(409).json({ ok: false, message: '공개하려면 예정된 회차·구역·티켓타입이 모두 필요합니다.' });
        }
      }
      await db.run(sqlUpdateStatus(show.id, next, now, { fromCancelled: show.status === 'cancelled' }));
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
      // 취소 전에 안내 대상(결제가 살아 있는 주문)을 잡아 둔다 — 취소 뒤에는 refunded로 바뀌어 구분이 안 된다.
      const affected = await db.all(sql`
        SELECT DISTINCT so.order_no as orderNo FROM show_orders so
        JOIN orders o ON o.order_no = so.order_no
        WHERE so.showtime_id = ${showtime.id} AND o.status IN ('paid', 'partially_refunded')
      `) as Array<{ orderNo: string }>;
      // 이미 취소된 회차라도 환불이 남은 주문이 있으면 '이어서 처리'다 — 앞선 실행이 DB 오류·시간 한도로 끊긴 경우.
      // "환불이 남았다" = 입장 처리되지 않은 티켓이 아직 살아 있다(입장 티켓만 남은 partially_refunded는 정상 마감이다).
      // cancelShowtime은 다시 돌려도 안전하다(showtimes UPDATE는 scheduled에만, 멱등키는 주문·잔액 기준이라 토스가 재생).
      const pendingRefund = showtime.status === 'cancelled' && affected.length > 0
        ? (await db.all(sql`
            SELECT DISTINCT t.order_no as orderNo FROM show_tickets t
            JOIN orders o ON o.order_no = t.order_no
            WHERE t.showtime_id = ${showtime.id} AND o.status IN ('paid', 'partially_refunded')
              AND t.status IN ('held', 'issued') AND t.checked_in_at IS NULL
              -- 계좌 입금 주문은 토스로 돌려줄 수 없어 고객이 환불 계좌를 적을 때까지 issued로 남는 것이 정상이다 — 이어서 처리 대상이 아니다.
              AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id AND p.payment_key LIKE 'bank-deposit:%')
          `) as Array<{ orderNo: string }>)
        : [];
      const resume = pendingRefund.length > 0;
      // 안내 메일 전체 재발송 — 첫 실행이 시간 한도·500으로 끊겨 메일이 한 통도 안 나간 경우. 취소된 회차에서만, 운영자가 명시할 때만.
      const renotify = showtime.status === 'cancelled' && b.notifyAll === true;
      if (showtime.status !== 'scheduled' && !resume && !renotify) return res.status(409).json({ ok: false, message: '예정된 회차만 취소할 수 있습니다.' });
      let r: Awaited<ReturnType<typeof cancelShowtime>>;
      try {
        r = await cancelShowtime(showtime.id, now, { cancelPayment });
      } catch (error) {
        // 회차는 이미 cancelled로 넘어갔을 수 있다 — 운영자가 '환불 이어서 처리'로 잇게 500 대신 상태를 돌려준다.
        console.error('[admin-shows] 회차 취소 처리 중단', { showtimeId: showtime.id, error });
        await revalidateShow(res, show.slug);
        return res.status(500).json({ ok: false, message: '회차 취소 처리가 중단됐습니다. 환불이 남은 주문은 "환불 이어서 처리"로 다시 돌릴 수 있습니다.' });
      }
      // 안내 대상 — 첫 실행: 살아 있던 주문 전부(환불·실패·계좌 입금·입장 티켓만 남음). 이어서 처리: **이번 실행이 손댄
      // 주문만**(환불 성공·실패). 앞선 실행이 이미 안내한 주문에 다시 보내지 않는다 — 계좌 입금 주문은 고객이 환불 계좌를
      // 적을 때까지 paid로 남아 매번 '이어서 처리' 대상처럼 보이므로, 그 주문에 누를 때마다 메일이 가는 것을 막는다.
      const showtimeCancelRefundSum = async (orderNo: string): Promise<number> => {
        const [row] = await db.all(sql`
          SELECT COALESCE(SUM(rf.amount), 0) AS total FROM refunds rf
          JOIN payments p ON p.id = rf.payment_id JOIN orders o ON o.id = p.order_id
          WHERE o.order_no = ${orderNo} AND rf.status = 'done' AND rf.reason = ${SHOWTIME_CANCEL_REFUND_REASON}
        `) as Array<{ total: number }>;
        return Number(row?.total ?? 0);
      };
      // 이어서 처리: 이번에 환불이 끝난 주문만(토스 거절이 반복되는 주문에 '처리 중' 메일을 누를 때마다 보내지 않는다).
      // 전체 재발송(notifyAll): 이 회차의 살아 있던 주문 + 회차 취소로 환불된 주문 전부를 지금 상태로 다시 안내한다.
      let notifyTargets: Set<string>;
      if (renotify) {
        const everyone = await db.all(sql`
          SELECT DISTINCT so.order_no as orderNo FROM show_orders so
          JOIN orders o ON o.order_no = so.order_no
          LEFT JOIN payments p ON p.order_id = o.id
          LEFT JOIN refunds rf ON rf.payment_id = p.id AND rf.reason = ${SHOWTIME_CANCEL_REFUND_REASON} AND rf.status = 'done'
          WHERE so.showtime_id = ${showtime.id} AND (o.status IN ('paid', 'partially_refunded') OR rf.id IS NOT NULL)
        `) as Array<{ orderNo: string }>;
        notifyTargets = new Set(everyone.map((e) => e.orderNo));
      } else {
        notifyTargets = new Set<string>(resume ? r.refundedOrderNos : [...affected.map((a) => a.orderNo), ...r.refundedOrderNos]);
      }
      for (const orderNo of notifyTargets) {
        // 처리 상한에 걸려 이번에 손대지 않은 주문은 아직 안내하지 않는다 — 다음 실행이 보낸다(전체 재발송은 예외).
        const touched = renotify || orderNo in r.perOrder || r.failedOrders.includes(orderNo) || r.bankRefundOrders.includes(orderNo);
        if (!touched) continue;
        try {
          const per = r.perOrder[orderNo];
          // 이번 실행이 토스로 돌려준 금액이 곧 안내할 금액이다. 이번에 돌려줄 것이 없던 주문(입장 티켓만 남음·앞선 실행이
          // 이미 환불)은 이 회차 취소로 돌려준 합계로 말한다 — 0이면 "환불 대상 없음".
          const refundedAmount = per && per.skipped === null ? per.refunded : await showtimeCancelRefundSum(orderNo);
          await sendShowtimeCancelledEmail(orderNo, {
            refundCompleted: !r.failedOrders.includes(orderNo) && !r.bankRefundOrders.includes(orderNo),
            refundedAmount,
            checkedInExcluded: (per?.checkedInValue ?? 0) > 0,
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
        ok: true, resumed: resume, renotified: renotify ? notifyTargets.size : 0, refundedOrders: r.refundedOrders, failedOrders: r.failedOrders,
        bankRefundOrders: r.bankRefundOrders, closedDepositOrders: r.closedDepositOrders, remainingOrders: r.remainingOrders,
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

    /** 토스 응답 유실로 'refunding'에 멈춘 티켓 — 토스에 물어 확정하거나 되돌린다(재취소 아님, lib/shows/refund.ts reconcileShowRefund). */
    case 'reconcile_refund': {
      const orderNo = isNonEmptyString(b.orderNo) ? b.orderNo : '';
      const showtimeIds = new Set(show.showtimes.map((s) => s.id));
      const showOrder = orderNo ? await db.query.showOrders.findFirst({ where: (o, { eq }) => eq(o.orderNo, orderNo) }) : undefined;
      if (!showOrder || !showtimeIds.has(showOrder.showtimeId)) return res.status(404).json({ ok: false, message: '이 공연의 주문이 아닙니다.' });
      const r = await reconcileShowRefund(orderNo, { fetchPayment });
      if (r.status === 'toss_unknown') return res.status(504).json({ ok: false, message: `토스 재조회에 실패했습니다(${r.code}). 잠시 뒤 다시 시도해 주세요.` });
      if (r.status === 'rejected') return res.status(409).json({ ok: false, message: r.reason === 'bank_deposit' ? '계좌 입금 주문은 토스 재확인 대상이 아닙니다.' : '토스 결제 기록이 없는 주문입니다.' });
      const message = r.status === 'synced'
        ? `토스에 취소가 있었습니다 — 장부에 반영했습니다(토스 ${r.tossCancelled.toLocaleString('ko-KR')}원 / 기록 ${r.recorded.toLocaleString('ko-KR')}원).`
        : r.status === 'reverted'
          ? `토스에 취소가 없었습니다 — 환불중 티켓 ${r.tickets}장을 발권 상태로 되돌렸습니다. 고객이 다시 환불을 신청할 수 있습니다.`
          : '확인할 것이 없습니다 — 장부와 토스가 같고 환불중 티켓도 없습니다.';
      return res.status(200).json({ ok: true, result: r.status, message });
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

    case 'revoke_scan_link': {
      // 유출됐거나 담당자가 바뀐 입장 스캔 링크를 만료 전에 닫는다. 이 공연의 회차에 걸린 링크만 폐기할 수 있다.
      if (!isNonEmptyString(b.linkId)) return res.status(400).json({ ok: false, message: '링크를 찾을 수 없습니다.' });
      const link = await db.query.showScanLinks.findFirst({ where: (l, { eq }) => eq(l.id, b.linkId as string) });
      if (!link || !showtimeOf(link.showtimeId)) return res.status(409).json({ ok: false, message: '이미 폐기됐거나 이 공연의 링크가 아닙니다.' });
      const ok = await revokeScanLink(link.id, now);
      return ok ? res.status(200).json({ ok: true }) : res.status(409).json({ ok: false, message: '이미 폐기됐거나 이 공연의 링크가 아닙니다.' });
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
