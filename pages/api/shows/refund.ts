import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../db/client';
import { cancelPayment } from '../../../lib/booking/toss';
import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { isTokenMatch } from '../../../lib/booking/token';
import { getClientIp } from '../../../lib/contracts/client-ip';
import { sendShowRefundEmail } from '../../../lib/shows/email';
import { refundShowTickets } from '../../../lib/shows/refund';
import { SHOW_REFUND_REJECT_MESSAGES, SHOW_REFUND_REJECT_MESSAGES_EN } from '../../../lib/shows/refundMessages';
import { cancelAwaitingShowDeposit } from '../../../lib/shows/bankDeposit';
import { AWAITING_DEPOSIT } from '../../../lib/payments/bankDeposit';

/**
 * 고객 셀프 환불 — 관리 토큰으로 인증하고 취소환불표(lib/shows/refundPolicy.ts)를 적용한다.
 * 입장 처리된 티켓·시작 이후는 refundShowTickets가 거절한다. 주문 부재와 토큰 불일치는
 * 같은 응답이다(orderNo 존재 여부를 토큰 없이 확인하는 창구가 되지 않게).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  // 영어 화면(/en/shows/manage)이 locale: 'en'을 보낸다 — 문구만 바뀌고 판정은 같다.
  const en = (req.body as Record<string, unknown> | null)?.locale === 'en';
  const msg = (key: string, ko: string): string => (en ? SHOW_REFUND_REJECT_MESSAGES_EN[key] ?? SHOW_REFUND_REJECT_MESSAGES_EN.default : ko);

  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`show_refund:ip:${ip}`, 10, 3600)))
    return res.status(429).json({ ok: false, message: msg('rate_limited', '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.') });

  if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body))
    return res.status(400).json({ ok: false, message: msg('bad_request', '요청 형식이 올바르지 않습니다.') });
  const { orderNo: rawOrderNo, token, ticketIds, action, refundAccount } = req.body as Record<string, unknown>;
  // 화면은 DB 값(대문자)을 보내지만, 손으로 적은 소문자도 같은 주문이다 — 조회와 같은 정규화.
  const orderNo = typeof rawOrderNo === 'string' ? rawOrderNo.toUpperCase() : rawOrderNo;

  /**
   * 계좌 입금 **대기** 신청 거두기 — 돈이 오가지 않았으니 환불이 아니라 신청 취소다. 좌석을 바로 풀고 메일은
   * 없다. 티켓을 고르지 않는 요청이라 아래 티켓 검증보다 먼저 가른다.
   */
  if (action === 'withdraw') {
    if (typeof orderNo !== 'string' || orderNo.trim() === '' || typeof token !== 'string' || token.trim() === '')
      return res.status(400).json({ ok: false, message: msg('bad_request', '요청 형식이 올바르지 않습니다.') });
    const target = await getDb().query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, orderNo) });
    if (!target || target.type !== 'ticket' || !isTokenMatch(target.manageToken, token))
      return res.status(404).json({ ok: false, message: msg('not_found', '주문을 찾을 수 없습니다.') });
    if (target.status !== AWAITING_DEPOSIT)
      return res.status(409).json({ ok: false, message: msg('withdraw_not_awaiting', '입금을 기다리는 신청이 아닙니다. 새로고침해 주세요.') });
    const r = await cancelAwaitingShowDeposit({ orderId: target.id });
    if (!r.ok) return res.status(409).json({ ok: false, code: r.code, message: msg('withdraw_failed', r.message) });
    return res.status(200).json({ ok: true, withdrawn: true });
  }
  if (
    typeof orderNo !== 'string' || orderNo.trim() === '' ||
    typeof token !== 'string' || token.trim() === '' ||
    !Array.isArray(ticketIds) || ticketIds.length === 0 || ticketIds.length > 50 ||
    !ticketIds.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 64)
  )
    return res.status(400).json({ ok: false, message: msg('no_tickets', '환불할 티켓을 선택해 주세요.') });
  const ids = Array.from(new Set(ticketIds as string[]));

  const order = await getDb().query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, orderNo) });
  if (!order || order.type !== 'ticket' || !isTokenMatch(order.manageToken, token))
    return res.status(404).json({ ok: false, message: msg('not_found', '주문을 찾을 수 없습니다.') });

  // 초대권은 환불 대상이 아니다(결제가 없다) — 화면에서도 숨기지만 서버가 한 번 더 막는다.
  const comp = await getDb().query.showTickets.findMany({
    where: (t, { and, eq, inArray }) => and(eq(t.orderNo, orderNo), inArray(t.id, ids), eq(t.issuedBy, 'organizer_comp')),
  });
  if (comp.length > 0) return res.status(409).json({ ok: false, code: 'comp_ticket', message: msg('comp_ticket', SHOW_REFUND_REJECT_MESSAGES.comp_ticket) });

  const outcome = await refundShowTickets({ orderNo, ticketIds: ids, noticeAt: new Date(), actor: 'customer', refundAccount }, { cancelPayment });
  if (outcome.status === 'refunded') {
    // 메일 실패는 환불 결과를 바꾸지 않는다 — 화면이 결과를 이미 보여 준다.
    try {
      await sendShowRefundEmail(orderNo, { refundedAmount: outcome.amount, fullyRefunded: outcome.orderStatus === 'refunded', refundVia: outcome.refundVia });
    } catch (error) {
      console.error('[shows-refund] 환불 메일 실패', { orderNo, error });
    }
    return res.status(200).json({ ok: true, refundAmount: outcome.amount, orderStatus: outcome.orderStatus, refundVia: outcome.refundVia });
  }
  if (outcome.status === 'toss_unknown') {
    return res.status(202).json({
      ok: false,
      code: 'toss_unknown',
      message: msg('toss_unknown', SHOW_REFUND_REJECT_MESSAGES.toss_unknown),
    });
  }
  // 영어 화면에서는 refund.ts의 한국어 상세 문구(outcome.message) 대신 사유별 영어 문구를 쓴다.
  const message = en
    ? msg(outcome.reason, '')
    : outcome.message ?? SHOW_REFUND_REJECT_MESSAGES[outcome.reason] ?? SHOW_REFUND_REJECT_MESSAGES.default;
  return res.status(409).json({ ok: false, code: outcome.reason, message });
}
