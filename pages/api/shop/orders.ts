import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { getClientIp } from '../../../lib/contracts/client-ip';
import { createShopOrder } from '../../../lib/shop/service';
import { SHOP_MIXED_KIND_MESSAGE, SHOP_MIXED_SHIPPER_MESSAGE } from '../../../lib/shop/shipper';
import { validateCreateShopOrderPayload } from '../../../lib/shop/validation';

const FAILURE: Record<'sales_closed' | 'unknown_item' | 'sold_out' | 'lookup_failed' | 'shipping_required' | 'mixed_shipper' | 'mixed_kind', { status: number; message: string }> = {
  sales_closed: { status: 409, message: '지금은 주문을 받지 않아요.' },
  unknown_item: { status: 400, message: '판매하지 않는 상품이 들어 있어요. 페이지를 새로고침해 주세요.' },
  lookup_failed: { status: 503, message: '상품 정보를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.' },
  shipping_required: { status: 400, message: '배송지를 입력해 주세요.' },
  mixed_shipper: { status: 400, message: SHOP_MIXED_SHIPPER_MESSAGE },
  mixed_kind: { status: 400, message: SHOP_MIXED_KIND_MESSAGE },
  sold_out: { status: 409, message: '남은 수량이 부족한 상품이 있어요. 수량을 줄이거나 다른 상품을 골라 주세요.' },
};

/**
 * 상점 주문 생성 — 결제 전 단계. 재고를 10분 잡고(`pending`) 서버가 계산한 금액을 돌려준다. 금액·상품명은 요청이
 * 아니라 카탈로그(data/shop/catalog.ts)에서만 읽는다. 결제수단은 전부 토스라 결제수단 칸을 받지 않는다(계좌 입금 없음).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`shop_order_create:ip:${ip}`, 10, 3600)))
    return res.status(429).json({ ok: false, message: '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.' });

  const validated = validateCreateShopOrderPayload(req.body);
  if (!validated.ok) return res.status(400).json({ ok: false, message: validated.message });

  try {
    const result = await createShopOrder(validated.value, new Date());
    if (!result.ok) return res.status(FAILURE[result.code].status).json({ ok: false, code: result.code, message: FAILURE[result.code].message });
    return res.status(201).json({ ok: true, orderNo: result.orderNo, totalAmount: result.totalAmount, orderName: result.orderName });
  } catch (error) {
    console.error('[api/shop/orders] 주문 생성 실패', error);
    return res.status(500).json({ ok: false, message: '주문을 만들지 못했어요. 잠시 후 다시 시도해 주세요.' });
  }
}
