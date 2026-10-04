import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../db/client';
import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { getClientIp } from '../../../lib/contracts/client-ip';
import { isShowtimeOnPublishedShow } from '../../../lib/shows/queries';
import { createShowOrder } from '../../../lib/shows/service';
import { validateCreateShowOrderPayload } from '../../../lib/shows/validation';
import { deliverShowDepositGuide } from '../../../lib/shows/bankDeposit';
import { BANK_DEPOSIT_BLOCK_MESSAGES, isCheckoutPaymentMethod } from '../../../lib/payments/bankDeposit';

const FAILURE_MESSAGES = {
  sold_out: '선택하신 티켓의 잔여석이 부족합니다. 매수를 줄이거나 다른 티켓을 선택해 주세요.',
  sales_closed: '이 회차는 예매가 마감되었습니다.',
  invalid_quantity: '매수를 확인해 주세요.',
  ticket_type_mismatch: '선택하신 회차와 티켓 종류가 맞지 않습니다. 페이지를 새로고침해 주세요.',
  starts_too_soon: BANK_DEPOSIT_BLOCK_MESSAGES.starts_too_soon,
} as const;

/**
 * 공연 티켓 주문 생성 — 결제 전 단계다. 재고는 이 호출이 10분간 보류(held)로 잡고,
 * 결제 승인(confirmShowOrder)이 발권(issued)으로 바꾼다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  // booking_create와 키를 갈라 둔다 — 공연 예매가 몰려도 녹음 예약 한도를 갉아먹지 않는다.
  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`show_order_create:ip:${ip}`, 10, 3600)))
    return res.status(429).json({ ok: false, message: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });

  const validated = validateCreateShowOrderPayload(req.body);
  if (!validated.ok) return res.status(400).json({ ok: false, message: validated.message });

  if (!(await isShowtimeOnPublishedShow(validated.value.showtimeId)))
    return res.status(409).json({ ok: false, code: 'sales_closed', message: FAILURE_MESSAGES.sales_closed });

  // 결제수단 — 없으면 토스. "계좌로 직접 입금"이면 계좌 입금 대기(좌석을 기한 없이 잡는다, lib/payments/bankDeposit.ts).
  const rawMethod = (req.body as Record<string, unknown>).paymentMethod;
  if (rawMethod !== undefined && !isCheckoutPaymentMethod(rawMethod))
    return res.status(400).json({ ok: false, message: '결제 방법을 다시 골라 주세요.' });
  const paymentMethod = rawMethod ?? 'toss';
  const result = await createShowOrder({ ...validated.value, paymentMethod }, new Date());
  if (!result.ok) {
    const status = result.code === 'invalid_quantity' || result.code === 'ticket_type_mismatch' ? 400 : 409;
    return res.status(status).json({ ok: false, code: result.code, message: FAILURE_MESSAGES[result.code] });
  }

  // 금액은 서버가 저장한 값이 유일한 진실이다 — 화면의 추정치를 되돌려 주지 않는다.
  const order = await getDb().query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, result.orderNo) });
  if (!order) return res.status(500).json({ ok: false, message: '주문을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.' });
  if (paymentMethod === 'bank_transfer') {
    // 안내 메일(고객+운영자). 실패해도 신청은 성립한다 — 계좌는 이동하는 안내 화면(내 티켓)에 나오고 실패는
    // notification_error로 관리자 화면에 남는다.
    await deliverShowDepositGuide(result.orderNo, { throttleCustomer: true });
    return res.status(201).json({
      ok: true, orderNo: result.orderNo, totalAmount: order.totalAmount, paymentMethod: 'bank_transfer',
      manageUrl: `/ko/shows/manage/${result.orderNo}?token=${order.manageToken}`,
    });
  }
  return res.status(201).json({ ok: true, orderNo: result.orderNo, totalAmount: order.totalAmount });
}
