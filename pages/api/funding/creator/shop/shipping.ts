import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit } from '../../../../../lib/booking/rate-limit';
import { isAllowedContactRequestOrigin } from '../../../../../lib/contact/origin';
import { authenticateCreatorApi } from '../../../../../lib/funding/creatorAuth';
import { markShopOrderDelivered, markShopOrderShipped } from '../../../../../lib/shop/fulfillment';
import { normalizeShopOrderNo } from '../../../../../lib/shop/shape';

/**
 * 아티스트가 직접 보내는 주문의 발송 처리 — `ship`(택배사·운송장, 고쳐 적기 포함) · `deliver`.
 *
 * 소유 판정은 이 라우트가 아니라 `markShopOrderShipped`·`markShopOrderDelivered`가 `actor`로 한다(관리자 경로와 같은 함수를
 * 지난다 — 상태 전이·고객 발송 메일이 한 벌). 남의 주문·스튜디오 주문·없는 주문은 같은 404 문구라 존재 여부가 새지 않는다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  if (!isAllowedContactRequestOrigin(req)) return res.status(403).json({ ok: false, message: 'Forbidden' });

  const auth = await authenticateCreatorApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: '로그인이 필요해요.' });

  // 발송 처리는 주문 건마다 연속으로 부르는 작업이다 — 구획 저장 키와 따로 둔다(creator_fulfillment와 같은 이유).
  if (!(await consumeRateLimit(`creator_shop_shipping:${auth.creatorId}`, 300, 600))) {
    return res.status(429).json({ ok: false, message: '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.' });
  }

  const b = ((typeof req.body === 'object' && req.body) || {}) as Record<string, unknown>;
  const orderNo = normalizeShopOrderNo(b.orderNo);
  if (!orderNo) return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않아요.' });
  const actor = { kind: 'artist' as const, creatorId: auth.creatorId };

  try {
    if (b.action === 'ship') {
      const result = await markShopOrderShipped({
        orderNo,
        courier: typeof b.courier === 'string' ? b.courier : '',
        trackingNumber: typeof b.trackingNumber === 'string' ? b.trackingNumber : '',
        actor,
      });
      if (result.ok) return res.status(200).json({ ok: true });
      return res.status(result.message === '주문을 찾을 수 없어요.' ? 404 : 409).json(result);
    }
    if (b.action === 'deliver') {
      const result = await markShopOrderDelivered(orderNo, actor);
      if (result.ok) return res.status(200).json({ ok: true });
      return res.status(result.message === '주문을 찾을 수 없어요.' ? 404 : 409).json(result);
    }
    return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않아요.' });
  } catch (error: unknown) {
    console.error('[funding/creator/shop/shipping] 실패:', error);
    return res.status(500).json({ ok: false, message: '처리하지 못했어요. 잠시 후 다시 시도해 주세요.' });
  }
}
