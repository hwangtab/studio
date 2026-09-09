import type { NextApiRequest, NextApiResponse } from 'next';

import { getClientIp } from '../../../lib/contracts/client-ip';
import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { sendSubscriptionCancelledEmail } from '../../../lib/billing/email';
import { cancelSubscription, findSubscriptionForManage } from '../../../lib/billing/service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`subscription_manage:ip:${ip}`, 10, 3600)))
    return res.status(429).json({ ok: false, message: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });

  if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body))
    return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않습니다.' });

  const { id, token } = req.body as Record<string, unknown>;
  if (typeof id !== 'string' || id.trim() === '' || typeof token !== 'string' || token.trim() === '')
    return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않습니다.' });

  // 구독 부재와 토큰 불일치를 같은 응답으로 답한다 — booking/cancel.ts와 동일 원칙
  // (구분해 알려주면 id 존재 여부를 토큰 없이도 확인하는 창구가 된다).
  const found = await findSubscriptionForManage(id, token);
  if (!found.ok) return res.status(404).json({ ok: false, message: '구독을 찾을 수 없습니다.' });

  const now = new Date();
  const result = await cancelSubscription(id, { requestedBy: 'customer', reason: '고객 셀프 해지' }, now);
  if (!result.ok) {
    return res.status(409).json({
      ok: false,
      code: result.code,
      message: result.code === 'invalid_state' ? '이미 해지되었거나 해지할 수 없는 상태입니다.' : '구독을 찾을 수 없습니다.',
    });
  }

  const endsAt = result.subscription.endsAt ?? now;
  const emailError = await sendSubscriptionCancelledEmail(result.subscription, { endsAt });
  if (emailError) console.error('[subscriptions/cancel] 해지 확인 메일 발송 실패', { id, emailError });

  return res.status(200).json({ ok: true, endsAt: endsAt.toISOString() });
}
