import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { getClientIp } from '../../../lib/contracts/client-ip';
import { normalizeLicenseKey } from '../../../lib/software/key';
import { loadLicenseSigner } from '../../../lib/software/licenseFile';
import { activateLicense, isSignerPublished, pluginRequestBody } from '../../../lib/software/service';

const STATUS = { bad_request: 400, invalid_key: 404, revoked: 403, activation_limit: 409 } as const;

/**
 * 플러그인·앱이 부르는 기기 활성화. 응답 형식은 `docs/software/license-integration.md` §3이 정본이다 — 이미 배포된
 * 플러그인이 이 코드값을 읽으므로 바꾸지 않는다.
 *
 * 레이트리밋은 IP(시간당 30회)와 키(시간당 20회) 두 겹. 키 추측은 100비트라 불가능하지만, 한 키로 기기를 계속
 * 돌려 가며 붙였다 떼는 것도 막는다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`software_activate:ip:${ip}`, 30, 3600))) return res.status(429).json({ ok: false, error: 'rate_limited' });

  const signer = loadLicenseSigner();
  if (!signer || !isSignerPublished(signer)) {
    console.error('[software/activate] 서명키가 없거나 공개키 목록(data/software/publicKeys.ts)에 없는 kid라 활성화를 닫았다', { kid: signer?.kid ?? null });
    return res.status(503).json({ ok: false, error: 'unavailable' });
  }

  const body = pluginRequestBody(req.body);
  const key = normalizeLicenseKey(body.key);
  if (key && !(await consumeRateLimit(`software_activate:key:${key}`, 20, 3600))) return res.status(429).json({ ok: false, error: 'rate_limited' });

  try {
    const result = await activateLicense(
      { key: body.key, product: body.product, machineId: body.machineId, label: body.label, appVersion: body.appVersion },
      signer,
    );
    if (!result.ok) return res.status(STATUS[result.code]).json({ ok: false, error: result.code });
    return res.status(200).json({ ok: true, licenseFile: result.licenseFile });
  } catch (error) {
    console.error('[software/activate] 처리 실패', error);
    return res.status(503).json({ ok: false, error: 'unavailable' });
  }
}
