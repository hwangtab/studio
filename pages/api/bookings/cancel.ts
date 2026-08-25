import type { NextApiRequest, NextApiResponse } from 'next';

import { getClientIp } from '../../../lib/contracts/client-ip';
import { cancelBookingWithRefund } from '../../../lib/booking/cancel';
import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { findOrderByOrderNo } from '../../../lib/booking/service';
import { isTokenMatch } from '../../../lib/booking/token';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`booking_cancel:ip:${ip}`, 10, 3600)))
    return res.status(429).json({ ok: false, message: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });

  if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body))
    return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않습니다.' });

  const { orderNo, token } = req.body as Record<string, unknown>;
  if (typeof orderNo !== 'string' || orderNo.trim() === '' || typeof token !== 'string' || token.trim() === '')
    return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않습니다.' });

  // 주문 부재와 토큰 불일치를 같은 응답으로 답한다 — 어느 쪽인지 구분해 주면 orderNo
  // 존재 여부를 토큰 없이도 확인하는 창구가 된다.
  const order = await findOrderByOrderNo(orderNo);
  if (!order || !isTokenMatch(order.manageToken, token))
    return res.status(404).json({ ok: false, message: '주문을 찾을 수 없습니다.' });

  const result = await cancelBookingWithRefund({
    orderNo, requestedBy: 'customer', reason: '고객 셀프 취소', now: new Date(),
  });
  if (!result.ok) return res.status(409).json({ ok: false, code: result.code, message: result.message });
  return res.status(200).json({ ok: true, refundAmount: result.refundAmount });
}
