import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit } from '../../booking/rate-limit';
import { isAllowedContactRequestOrigin } from '../../contact/origin';
import { getClientIp } from '../../contracts/client-ip';
import { authenticateCreatorApi } from '../../funding/creatorAuth';
import type { WriteResult } from './submissions';

/**
 * 주최자 공연 API 공통 입구 — 펀딩 개설자 라우트와 같은 순서:
 * no-store → 메서드 → origin → 로그인. 통과하면 creatorId, 아니면 응답을 이미 보냈고 null.
 */
export async function guardOrganizerRequest(
  req: NextApiRequest,
  res: NextApiResponse,
  methods: readonly string[],
): Promise<string | null> {
  res.setHeader('Cache-Control', 'no-store');
  if (!req.method || !methods.includes(req.method)) {
    res.setHeader('Allow', methods.join(', '));
    res.status(405).json({ ok: false });
    return null;
  }
  // 읽기는 origin을 보지 않는다(펀딩 개설자 GET 라우트와 같다). 쓰기만 본다.
  if (req.method !== 'GET' && !isAllowedContactRequestOrigin(req)) {
    res.status(403).json({ ok: false, message: 'Forbidden' });
    return null;
  }
  const auth = await authenticateCreatorApi(req, res);
  if (!auth.ok) {
    res.status(401).json({ ok: false, message: '로그인이 필요해요.' });
    return null;
  }
  return auth.creatorId;
}

/** 쓰기 요청 속도 제한 — IP와 계정 두 겹(계정 자동 생성 때문에 계정 하나만 보면 N배가 된다). */
export async function limitOrganizerWrites(req: NextApiRequest, res: NextApiResponse, creatorId: string): Promise<boolean> {
  const ip = getClientIp(req) ?? 'unknown';
  if (
    !(await consumeRateLimit(`creator_save:ip:${ip}`, 30, 60))
    || !(await consumeRateLimit(`creator_save:${creatorId}`, 30, 60))
  ) {
    res.status(429).json({ ok: false, message: '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.' });
    return false;
  }
  return true;
}

export const queryId = (req: NextApiRequest): string => (typeof req.query.id === 'string' ? req.query.id : '');

export function respondWrite(res: NextApiResponse, result: WriteResult) {
  if (result.ok) return res.status(200).json(result.warnings ? { ok: true, warnings: result.warnings } : { ok: true });
  return res.status(result.status).json({
    ok: false,
    message: result.message,
    ...(result.problems ? { problems: result.problems } : {}),
  });
}
