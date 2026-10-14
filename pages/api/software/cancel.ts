import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { isTokenMatch } from '../../../lib/booking/token';
import { getClientIp } from '../../../lib/contracts/client-ip';
import { cancelSoftwareOrder } from '../../../lib/software/cancel';
import { findSoftwareOrder, normalizeSoftwareOrderNo } from '../../../lib/software/order';

/** 고객 셀프 환불 — 활성화 전·기간 안에만, 전액. 인증은 관리 토큰(확정 메일·결제 완료 화면의 주소). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`software_cancel:ip:${ip}`, 10, 3600)))
    return res.status(429).json({ ok: false, message: '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.' });

  const b = ((typeof req.body === 'object' && req.body) || {}) as Record<string, unknown>;
  const orderNo = normalizeSoftwareOrderNo(b.orderNo);
  if (!orderNo || typeof b.token !== 'string') return res.status(400).json({ ok: false, message: '잘못된 요청이에요.' });
  const order = await findSoftwareOrder(orderNo);
  if (!order || !isTokenMatch(order.manageToken, b.token)) return res.status(404).json({ ok: false, message: '주문을 찾을 수 없어요.' });

  const result = await cancelSoftwareOrder({ orderNo, requestedBy: 'customer', reason: '고객 셀프 환불(활성화 전)', now: new Date() });
  if (!result.ok) {
    const status = result.code === 'recording_failed' ? 202 : result.code === 'toss_failed' ? 502 : 409;
    return res.status(status).json({ ok: false, code: result.code, message: result.message });
  }
  return res.status(200).json({ ok: true, refundAmount: result.refundAmount });
}
