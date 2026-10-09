import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../db/client';
import { orders } from '../../../db/schema';
import { getPaymentLink } from '../../../data/paymentLinks';
import { splitInclusiveAmount } from '../../../lib/booking/amounts';
import { deliverBookingDepositGuide } from '../../../lib/booking/bankDeposit';
import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { generateManageToken, generateOrderNo } from '../../../lib/booking/token';
import { validateCustomerContact } from '../../../lib/booking/validation';
import { getClientIp } from '../../../lib/contracts/client-ip';
import { BANK_DEPOSIT_GUIDE_DAYS } from '../../../lib/payments/bankAccount';
import { AWAITING_DEPOSIT, bankDepositDeadlineOf, isCheckoutPaymentMethod } from '../../../lib/payments/bankDeposit';

/**
 * 예약금 결제 링크의 주문 생성. 금액·품목명은 요청 본문을 보지 않고 **data/paymentLinks.ts에서만** 읽는다.
 *
 * `paymentMethod: 'bank_transfer'`면 토스 홀드(`pending`) 없이 `awaiting_deposit`으로 바로 만들고 입금 안내
 * 메일을 보낸다(lib/payments/bankDeposit.ts — 믹싱 주문 API와 같은 방식). 없으면 토스.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`payment_link:ip:${ip}`, 10, 3600)))
    return res.status(429).json({ ok: false, message: '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.' });

  const body = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as Record<string, unknown>;
  const now = new Date();
  const link = getPaymentLink(body.slug, now);
  if (!link) return res.status(404).json({ ok: false, message: '결제 링크를 찾을 수 없어요.' });

  const customer = validateCustomerContact(body);
  if (!customer.ok) return res.status(400).json({ ok: false, message: customer.message });

  if (body.paymentMethod !== undefined && !isCheckoutPaymentMethod(body.paymentMethod))
    return res.status(400).json({ ok: false, message: '결제 방법을 다시 골라 주세요.' });
  const paymentMethod = body.paymentMethod ?? 'toss';

  const amounts = splitInclusiveAmount(link.totalAmount);
  const orderNo = generateOrderNo(now);
  const [created] = await getDb()
    .insert(orders)
    .values({
      orderNo,
      type: 'deposit',
      customerName: customer.value.customerName,
      customerPhone: customer.value.customerPhone,
      customerEmail: customer.value.customerEmail,
      itemAmount: amounts.itemAmount,
      vatAmount: amounts.vatAmount,
      totalAmount: amounts.totalAmount,
      manageToken: generateManageToken(),
      status: paymentMethod === 'bank_transfer' ? AWAITING_DEPOSIT : 'pending',
    })
    .returning({ createdAt: orders.createdAt });

  if (paymentMethod === 'bank_transfer') {
    await deliverBookingDepositGuide(orderNo, { throttleCustomer: true });
    const deadline = bankDepositDeadlineOf({
      createdAt: created?.createdAt ?? now,
      startsAt: null,
      guideDays: BANK_DEPOSIT_GUIDE_DAYS,
    });
    return res.status(201).json({
      ok: true,
      orderNo,
      paymentMethod: 'bank_transfer',
      totalAmount: amounts.totalAmount,
      orderName: link.itemName,
      deposit: { deadline: deadline.toISOString() },
    });
  }

  return res.status(201).json({ ok: true, orderNo, totalAmount: amounts.totalAmount, orderName: link.itemName });
}
