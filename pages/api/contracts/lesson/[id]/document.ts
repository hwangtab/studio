import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../../../db/client';
import { checkIdentityAttempt, resetIdentityAttempts } from '../../../../../lib/contracts/admin-rate-limit';
import { IDENTITY_DIGITS, verifyIdentityDigits } from '../../../../../lib/contracts/identity';
import { lessonRateLimitKey } from '../../../../../lib/contracts/lesson/links';

/**
 * 서명본 전문 — 생년월일·주소·연락처가 든 본문이라 **연락처 뒷자리를 확인한 뒤에만** 준다(완료 화면 props에는 싣지 않는다).
 * 시도 제한은 서명과 같은 키를 쓴다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }
  const { id } = req.query;
  const body = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as Record<string, unknown>;
  if (typeof id !== 'string' || typeof body.token !== 'string' || body.token === '') return res.status(400).json({ ok: false, message: '요청이 올바르지 않습니다.' });
  try {
    const contract = await getDb().query.lessonContracts.findFirst({ where: (t, { eq }) => eq(t.id, id) });
    if (!contract || contract.signToken !== body.token || contract.status !== 'signed' || contract.purgedAt) return res.status(404).json({ ok: false, message: '계약을 찾을 수 없습니다.' });
    const identity = verifyIdentityDigits(body.identityDigits, contract.studentPhone);
    if (!identity.ok && identity.reason === 'malformed') return res.status(400).json({ ok: false, message: `연락처 뒤 ${IDENTITY_DIGITS}자리를 정확히 입력해 주세요.` });
    const key = lessonRateLimitKey(contract.id);
    const attempt = await checkIdentityAttempt(key);
    if (attempt === 'locked' || attempt === 'throttled') return res.status(429).json({ ok: false, message: '본인 확인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.' });
    if (!identity.ok) return res.status(400).json({ ok: false, message: `연락처 뒤 ${IDENTITY_DIGITS}자리를 정확히 입력해 주세요.` });
    await resetIdentityAttempts(key);
    return res.status(200).json({ ok: true, content: contract.content, signedAt: contract.signedAt?.toISOString() ?? null, fingerprint: contract.contentHash });
  } catch (error: unknown) {
    console.error('[API/contracts/lesson/document] 실패:', error);
    return res.status(500).json({ ok: false, message: '서명본을 불러오지 못했습니다.' });
  }
}
