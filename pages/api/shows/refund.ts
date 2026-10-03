import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../db/client';
import { cancelPayment } from '../../../lib/booking/toss';
import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { isTokenMatch } from '../../../lib/booking/token';
import { getClientIp } from '../../../lib/contracts/client-ip';
import { sendShowRefundEmail } from '../../../lib/shows/email';
import { refundShowTickets } from '../../../lib/shows/refund';
import { SHOW_REFUND_REJECT_MESSAGES } from '../../../lib/shows/refundMessages';

/**
 * 고객 셀프 환불 — 관리 토큰으로 인증하고 취소환불표(lib/shows/refundPolicy.ts)를 적용한다.
 * 입장 처리된 티켓·시작 이후는 refundShowTickets가 거절한다. 주문 부재와 토큰 불일치는
 * 같은 응답이다(orderNo 존재 여부를 토큰 없이 확인하는 창구가 되지 않게).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`show_refund:ip:${ip}`, 10, 3600)))
    return res.status(429).json({ ok: false, message: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });

  if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body))
    return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않습니다.' });
  const { orderNo, token, ticketIds } = req.body as Record<string, unknown>;
  if (
    typeof orderNo !== 'string' || orderNo.trim() === '' ||
    typeof token !== 'string' || token.trim() === '' ||
    !Array.isArray(ticketIds) || ticketIds.length === 0 || ticketIds.length > 50 ||
    !ticketIds.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 64)
  )
    return res.status(400).json({ ok: false, message: '환불할 티켓을 선택해 주세요.' });
  const ids = Array.from(new Set(ticketIds as string[]));

  const order = await getDb().query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, orderNo) });
  if (!order || order.type !== 'ticket' || !isTokenMatch(order.manageToken, token))
    return res.status(404).json({ ok: false, message: '주문을 찾을 수 없습니다.' });

  // 초대권은 환불 대상이 아니다(결제가 없다) — 화면에서도 숨기지만 서버가 한 번 더 막는다.
  const comp = await getDb().query.showTickets.findMany({
    where: (t, { and, eq, inArray }) => and(eq(t.orderNo, orderNo), inArray(t.id, ids), eq(t.issuedBy, 'organizer_comp')),
  });
  if (comp.length > 0) return res.status(409).json({ ok: false, code: 'comp_ticket', message: SHOW_REFUND_REJECT_MESSAGES.comp_ticket });

  const outcome = await refundShowTickets({ orderNo, ticketIds: ids, noticeAt: new Date(), actor: 'customer' }, { cancelPayment });
  if (outcome.status === 'refunded') {
    // 메일 실패는 환불 결과를 바꾸지 않는다 — 화면이 결과를 이미 보여 준다.
    try {
      await sendShowRefundEmail(orderNo, { refundedAmount: outcome.amount, fullyRefunded: outcome.orderStatus === 'refunded' });
    } catch (error) {
      console.error('[shows-refund] 환불 메일 실패', { orderNo, error });
    }
    return res.status(200).json({ ok: true, refundAmount: outcome.amount, orderStatus: outcome.orderStatus });
  }
  if (outcome.status === 'toss_unknown') {
    return res.status(202).json({
      ok: false,
      code: 'toss_unknown',
      message: SHOW_REFUND_REJECT_MESSAGES.toss_unknown,
    });
  }
  const message = SHOW_REFUND_REJECT_MESSAGES[outcome.reason] ?? SHOW_REFUND_REJECT_MESSAGES.default;
  return res.status(409).json({ ok: false, code: outcome.reason, message });
}
