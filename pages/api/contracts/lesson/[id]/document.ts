import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../../../db/client';
import { getDownloadIdentityVerdict, reserveDownloadIdentityAttempt, resetDownloadIdentityAttempts } from '../../../../../lib/contracts/admin-rate-limit';
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
    // 서명용 카운터와 따로 센다(음원 제작 계약 download.ts와 같은 순서) — 체결 뒤 열람 시도가 서명 예산을 쓰거나, 체결 뒤에는 재발송으로 풀 수도 없는 잠금을 만들지 않게.
    // 잠김 여부만 먼저 읽고, 형식이 맞는 시도만 원자적으로 예약한다. 틀린 입력이 쌓여도 24시간 창이 지나면 저절로 풀린다.
    const key = lessonRateLimitKey(contract.id);
    const verdict = await getDownloadIdentityVerdict(key);
    if (verdict !== 'ok') return res.status(429).json({ ok: false, message: verdict === 'locked' ? '본인 확인 시도가 너무 많아 서명본 열람이 잠겼습니다. 24시간 뒤 다시 시도하거나 스튜디오에 문의해 주세요.' : '본인 확인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.' });
    if (identity.ok || identity.reason === 'mismatch') {
      const reserved = await reserveDownloadIdentityAttempt(key);
      if (reserved !== 'ok') return res.status(429).json({ ok: false, message: reserved === 'locked' ? '본인 확인 시도가 너무 많아 서명본 열람이 잠겼습니다. 24시간 뒤 다시 시도하거나 스튜디오에 문의해 주세요.' : '본인 확인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.' });
    }
    if (!identity.ok) return res.status(400).json({ ok: false, message: `연락처 뒤 ${IDENTITY_DIGITS}자리를 정확히 입력해 주세요.` });
    await resetDownloadIdentityAttempts(key);
    return res.status(200).json({ ok: true, content: contract.content, signedAt: contract.signedAt?.toISOString() ?? null, fingerprint: contract.contentHash });
  } catch (error: unknown) {
    console.error('[API/contracts/lesson/document] 실패:', error);
    return res.status(500).json({ ok: false, message: '서명본을 불러오지 못했습니다.' });
  }
}
