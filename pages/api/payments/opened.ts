import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { isAllowedContactRequestOrigin } from '../../../lib/contact/origin';
import { getClientIp } from '../../../lib/contracts/client-ip';
import { recordPaymentWindowOpen } from '../../../lib/payments/windowOpen';

/**
 * 결제창을 열었다는 비콘(lib/payments/windowOpen.ts). `/api/payments/failed`와 같은 방어를
 * 건다 — 우리 화면에서 온 요청만(Origin), IP당 분당 20회. 응답은 언제나 204라 주문번호를
 * 넣어 보며 상태를 떠볼 수 없다. 브라우저 종류는 요청 본문이 아니라 요청 헤더에서 서버가 정한다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }
  if (!isAllowedContactRequestOrigin(req)) return res.status(204).end();

  const orderNo = typeof req.body?.orderNo === 'string' ? req.body.orderNo : '';
  // x-forwarded-for는 클라이언트가 직접 넣을 수 있어, 그 값을 키로 쓰면 헤더만 바꿔 제한을 피한다.
  const ip = getClientIp(req) ?? 'unknown';
  const allowed = await consumeRateLimit(`payopen:${ip}`, 20, 60).catch(() => true);
  if (!allowed) return res.status(204).end();

  await recordPaymentWindowOpen({ orderNo, userAgent: req.headers['user-agent'] });
  return res.status(204).end();
}
