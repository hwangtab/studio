import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { isTokenMatch } from '../../../lib/booking/token';
import { getClientIp } from '../../../lib/contracts/client-ip';
import { findSoftwareOrder, normalizeSoftwareOrderNo } from '../../../lib/software/order';
import { adminDeactivate } from '../../../lib/software/service';

/**
 * 구매자가 구매 내역 화면에서 기기를 해제한다(컴퓨터를 바꿨는데 옛 기기에서 해제하지 못했을 때). 인증은 관리 토큰.
 * 그 주문의 라이선스에 붙은 기기만 해제된다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`software_manage_device:ip:${ip}`, 30, 3600)))
    return res.status(429).json({ ok: false, message: '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.' });

  const b = ((typeof req.body === 'object' && req.body) || {}) as Record<string, unknown>;
  const orderNo = normalizeSoftwareOrderNo(b.orderNo);
  if (!orderNo || typeof b.token !== 'string' || typeof b.activationId !== 'string') return res.status(400).json({ ok: false, message: '잘못된 요청이에요.' });
  const order = await findSoftwareOrder(orderNo);
  if (!order || !isTokenMatch(order.manageToken, b.token)) return res.status(404).json({ ok: false, message: '주문을 찾을 수 없어요.' });

  let count = 0;
  for (const license of order.licenses) count += await adminDeactivate(license.id, b.activationId);
  return count > 0 ? res.status(200).json({ ok: true }) : res.status(404).json({ ok: false, message: '이미 해제된 기기예요.' });
}
