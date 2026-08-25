import type { NextApiRequest, NextApiResponse } from 'next';

import { getClientIp } from '../../../lib/contracts/client-ip';
import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { processTossWebhook } from '../../../lib/booking/webhook';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  // 이 엔드포인트는 무인증이다(토스가 서명 없이 호출) — IP당 시간당 120회는 정상 웹훅
  // 볼륨을 한참 웃도는 한도라 실사용엔 영향이 없고, 남용 시 재조회(fetchPayment) 쿼터를
  // 지킨다. 토스는 비-2xx 응답에 재시도하므로 429도 재전송 대상이지만, 한도 자체가
  // 정상 트래픽보다 훨씬 커서 남용이 멈추면 곧바로 다시 통과한다.
  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`webhook:ip:${ip}`, 120, 3600))) return res.status(429).json({ ok: false });

  const { status } = await processTossWebhook(req.body);
  return res.status(status).json({ ok: status === 200 });
}
