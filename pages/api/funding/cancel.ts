import type { NextApiRequest, NextApiResponse } from 'next';

import { getClientIp } from '../../../lib/contracts/client-ip';
import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { isTokenMatch } from '../../../lib/booking/token';
import { cancelFundingPledge } from '../../../lib/funding/cancel';
import { findFundingOrderByOrderNo } from '../../../lib/funding/service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`funding_cancel:ip:${ip}`, 10, 3600)))
    return res.status(429).json({ ok: false, message: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });
  const { orderNo, token } = (typeof req.body === 'object' && req.body) || {};
  if (typeof orderNo !== 'string' || typeof token !== 'string' || !orderNo || !token)
    return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않습니다.' });
  const order = await findFundingOrderByOrderNo(orderNo);
  if (!order || !isTokenMatch(order.manageToken, token)) return res.status(404).json({ ok: false, message: '펀딩 내역을 찾을 수 없습니다.' });

  const result = await cancelFundingPledge({ orderNo, requestedBy: 'customer', reason: '고객 셀프 취소', now: new Date() });
  // 일시 오류는 409(이미 처리됨)가 아니라 503이다 — 클라이언트가 재시도할 수 있는 상태다.
  if (!result.ok)
    return res
      .status(result.code === 'temporarily_unavailable' ? 503 : 409)
      .json({ ok: false, code: result.code, message: result.message });
  return res.status(200).json({ ok: true, mode: result.mode, refundAmount: result.refundAmount });
}
