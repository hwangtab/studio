import type { NextApiRequest, NextApiResponse } from 'next';

import { getClientIp } from '../../../lib/contracts/client-ip';
import { cancelBookingWithRefund } from '../../../lib/booking/cancel';
import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { findOrderByOrderNo } from '../../../lib/booking/service';
import { isTokenMatch } from '../../../lib/booking/token';
import { cancelAwaitingBookingDeposit } from '../../../lib/booking/bankDeposit';
import { bankDepositStateOf } from '../../../lib/payments/bankDeposit';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`booking_cancel:ip:${ip}`, 10, 3600)))
    return res.status(429).json({ ok: false, message: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });

  if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body))
    return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않습니다.' });

  const { orderNo, token, refundAccount } = req.body as Record<string, unknown>;
  if (typeof orderNo !== 'string' || orderNo.trim() === '' || typeof token !== 'string' || token.trim() === '')
    return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않습니다.' });

  // 주문 부재와 토큰 불일치를 같은 응답으로 답한다 — 어느 쪽인지 구분해 주면 orderNo
  // 존재 여부를 토큰 없이도 확인하는 창구가 된다.
  const order = await findOrderByOrderNo(orderNo);
  if (!order || !isTokenMatch(order.manageToken, token))
    return res.status(404).json({ ok: false, message: '주문을 찾을 수 없습니다.' });

  /**
   * 계좌 입금 **대기** 중인 신청은 돈이 오가지 않았으니 환불이 아니라 신청 취소다 — 시간대를 바로 풀고 메일은
   * 보내지 않는다. 예약 확인 페이지(SSR)와 같은 판정(bankDepositStateOf)으로 가른다.
   */
  if (bankDepositStateOf(order) === 'awaiting') {
    const withdrawn = await cancelAwaitingBookingDeposit({ orderId: order.id });
    if (!withdrawn.ok) return res.status(409).json({ ok: false, code: withdrawn.code, message: withdrawn.message });
    return res.status(200).json({ ok: true, withdrawn: true, refundAmount: 0 });
  }

  const result = await cancelBookingWithRefund({
    orderNo, requestedBy: 'customer', reason: '고객 셀프 취소', now: new Date(), refundAccount,
  });
  if (!result.ok) {
    const status = result.code === 'temporarily_unavailable' ? 503 : 409;
    return res.status(status).json({ ok: false, code: result.code, message: result.message });
  }
  return res.status(200).json({ ok: true, refundAmount: result.refundAmount, refundVia: result.refundVia });
}
