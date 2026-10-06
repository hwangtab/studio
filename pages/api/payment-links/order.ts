import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../db/client';
import { orders } from '../../../db/schema';
import { getPaymentLink } from '../../../data/paymentLinks';
import { splitInclusiveAmount } from '../../../lib/booking/amounts';
import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { generateManageToken, generateOrderNo } from '../../../lib/booking/token';
import { validateCustomerContact } from '../../../lib/booking/validation';
import { getClientIp } from '../../../lib/contracts/client-ip';

/**
 * 예약금 결제 링크의 주문 생성. 금액·품목명은 요청 본문을 보지 않고 **data/paymentLinks.ts에서만** 읽는다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`payment_link:ip:${ip}`, 10, 3600)))
    return res.status(429).json({ ok: false, message: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });

  const body = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as Record<string, unknown>;
  const now = new Date();
  const link = getPaymentLink(body.slug, now);
  if (!link) return res.status(404).json({ ok: false, message: '결제 링크를 찾을 수 없습니다.' });

  const customer = validateCustomerContact(body);
  if (!customer.ok) return res.status(400).json({ ok: false, message: customer.message });

  const amounts = splitInclusiveAmount(link.totalAmount);
  const orderNo = generateOrderNo(now);
  await getDb().insert(orders).values({
    orderNo,
    type: 'deposit',
    customerName: customer.value.customerName,
    customerPhone: customer.value.customerPhone,
    customerEmail: customer.value.customerEmail,
    itemAmount: amounts.itemAmount,
    vatAmount: amounts.vatAmount,
    totalAmount: amounts.totalAmount,
    manageToken: generateManageToken(),
  });

  return res.status(201).json({ ok: true, orderNo, totalAmount: amounts.totalAmount, orderName: link.itemName });
}
