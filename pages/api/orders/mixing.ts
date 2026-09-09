import type { NextApiRequest, NextApiResponse } from 'next';

import { getClientIp } from '../../../lib/contracts/client-ip';
import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { createMixingOrder } from '../../../lib/booking/service';
import { validateCreateMixingOrderPayload } from '../../../lib/booking/validation';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const ip = getClientIp(req) ?? 'unknown';
  // bookings/index.ts와 같은 키 접두사를 공유 — 세션·믹싱 두 진입점이 합쳐 한 IP당 한도를 쓴다.
  if (!(await consumeRateLimit(`booking_create:ip:${ip}`, 10, 3600)))
    return res.status(429).json({ ok: false, message: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });

  const now = new Date();
  const validated = validateCreateMixingOrderPayload(req.body, now);
  if (!validated.ok) return res.status(400).json({ ok: false, message: validated.message });

  const result = await createMixingOrder(validated.value, now);
  return res.status(201).json({
    ok: true,
    orderNo: result.orderNo,
    itemAmount: result.itemAmount,
    vatAmount: result.vatAmount,
    totalAmount: result.totalAmount,
  });
}
