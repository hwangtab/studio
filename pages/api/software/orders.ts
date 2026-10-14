import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { getClientIp } from '../../../lib/contracts/client-ip';
import { createSoftwareOrder } from '../../../lib/software/order';

const FAILURE = {
  sales_closed: { status: 409, message: '지금은 판매하지 않아요.' },
  unknown_item: { status: 400, message: '판매하지 않는 상품이에요. 페이지를 새로고침해 주세요.' },
  withdrawal_ack_required: { status: 400, message: '환불 규정을 확인하고 동의해 주세요.' },
} as const;

/**
 * 소프트웨어 주문 생성 — 결제 전 단계. 금액·상품명은 요청이 아니라 카탈로그(data/software/catalog.ts)에서만 읽는다.
 * 결제수단은 전부 토스(카드·간편결제·계좌이체)라 결제수단 칸을 받지 않는다 — 계좌 입금은 키 즉시 발급과 맞지 않는다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`software_order_create:ip:${ip}`, 10, 3600)))
    return res.status(429).json({ ok: false, message: '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.' });

  const body = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as Record<string, unknown>;
  try {
    const result = await createSoftwareOrder(body, new Date());
    if (!result.ok) {
      if (result.code === 'invalid_contact') return res.status(400).json({ ok: false, code: result.code, message: result.message });
      return res.status(FAILURE[result.code].status).json({ ok: false, code: result.code, message: FAILURE[result.code].message });
    }
    return res.status(201).json({ ok: true, orderNo: result.orderNo, totalAmount: result.totalAmount, orderName: result.orderName });
  } catch (error) {
    console.error('[api/software/orders] 주문 생성 실패', error);
    return res.status(500).json({ ok: false, message: '주문을 만들지 못했어요. 잠시 후 다시 시도해 주세요.' });
  }
}
