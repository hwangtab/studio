import type { NextApiRequest, NextApiResponse } from 'next';

import { getClientIp } from '../../../lib/contracts/client-ip';
import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { createBookingOrder } from '../../../lib/booking/service';
import { validateCreateBookingPayload } from '../../../lib/booking/validation';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`booking_create:ip:${ip}`, 10, 3600)))
    return res.status(429).json({ ok: false, message: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });

  const now = new Date();
  const validated = validateCreateBookingPayload(req.body, now);
  if (!validated.ok) return res.status(400).json({ ok: false, message: validated.message });

  const result = await createBookingOrder(validated.value, now);
  if (!result.ok) return res.status(409).json({ ok: false, code: result.code, message: '방금 다른 예약이 먼저 잡혔습니다. 다른 시간대를 선택해 주세요.' });
  return res.status(201).json({
    ok: true,
    orderNo: result.orderNo,
    itemAmount: result.itemAmount,
    vatAmount: result.vatAmount,
    totalAmount: result.totalAmount,
  });
}
