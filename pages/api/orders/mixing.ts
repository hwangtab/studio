import type { NextApiRequest, NextApiResponse } from 'next';

import { getClientIp } from '../../../lib/contracts/client-ip';
import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { createMixingOrder } from '../../../lib/booking/service';
import { readPreviousOrderNo } from '../../../lib/booking/token';
import { validateCreateMixingOrderPayload } from '../../../lib/booking/validation';
import { deliverBookingDepositGuide } from '../../../lib/booking/bankDeposit';
import { getDb } from '../../../db/client';
import { isCheckoutPaymentMethod } from '../../../lib/payments/bankDeposit';
import { checkBankDepositAbuse, recordBankDepositOrigin } from '../../../lib/payments/bankDepositOrders';

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

  // 결제수단 — 없으면 토스. 믹싱은 잡는 시간대가 없어 임박 차단이 없다(lib/payments/bankDeposit.ts).
  const rawMethod = (req.body as Record<string, unknown>).paymentMethod;
  if (rawMethod !== undefined && !isCheckoutPaymentMethod(rawMethod))
    return res.status(400).json({ ok: false, message: '결제 방법을 다시 골라 주세요.' });
  const paymentMethod = rawMethod ?? 'toss';
  if (paymentMethod === 'bank_transfer') {
    const abuse = await checkBankDepositAbuse(validated.value.customerEmail, ip);
    if (!abuse.ok) return res.status(abuse.status).json({ ok: false, code: abuse.code, message: abuse.message });
  }

  const result = await createMixingOrder(validated.value, now, { releaseOrderNo: readPreviousOrderNo(req.body), paymentMethod });
  if (paymentMethod === 'bank_transfer') {
    await recordBankDepositOrigin(ip, result.orderNo);
    await deliverBookingDepositGuide(result.orderNo);
    const created = await getDb().query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, result.orderNo) });
    return res.status(201).json({
      ok: true, orderNo: result.orderNo, paymentMethod: 'bank_transfer', totalAmount: result.totalAmount,
      manageUrl: `/ko/booking/manage/${result.orderNo}?token=${created?.manageToken ?? ''}`,
    });
  }
  return res.status(201).json({
    ok: true,
    orderNo: result.orderNo,
    itemAmount: result.itemAmount,
    vatAmount: result.vatAmount,
    totalAmount: result.totalAmount,
  });
}
