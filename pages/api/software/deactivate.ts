import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { getClientIp } from '../../../lib/contracts/client-ip';
import { normalizeLicenseKey } from '../../../lib/software/key';
import { deactivateMachine, pluginRequestBody } from '../../../lib/software/service';

const STATUS = { bad_request: 400, invalid_key: 404, deactivation_limit: 429 } as const;

/**
 * 플러그인의 "이 기기에서 해제". 이미 해제된 기기여도 200(멱등). 형식은 `docs/software/license-integration.md` §3.
 * 라이선스당 30일 해제 한도(`SOFTWARE_DEACTIVATIONS_PER_30_DAYS`)를 넘으면 429 `deactivation_limit` — 운영자는 관리자 화면에서 한도 없이 해제한다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`software_deactivate:ip:${ip}`, 30, 3600))) return res.status(429).json({ ok: false, error: 'rate_limited' });

  const body = pluginRequestBody(req.body);
  const key = normalizeLicenseKey(body.key);
  if (key && !(await consumeRateLimit(`software_deactivate:key:${key}`, 20, 3600))) return res.status(429).json({ ok: false, error: 'rate_limited' });
  try {
    const result = await deactivateMachine({ key: body.key, product: body.product, machineId: body.machineId });
    if (!result.ok) return res.status(STATUS[result.code]).json({ ok: false, error: result.code });
    return res.status(200).json({ ok: true, deactivated: result.deactivated });
  } catch (error) {
    console.error('[software/deactivate] 처리 실패', error);
    return res.status(503).json({ ok: false, error: 'unavailable' });
  }
}
