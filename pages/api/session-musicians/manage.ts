import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { isAllowedContactRequestOrigin } from '../../../lib/contact/origin';
import { getClientIp } from '../../../lib/contracts/client-ip';
import { isSessionMusicianTableMissing } from '../../../lib/sessionMusicians/repository';
import { confirmByToken, deleteByToken, lookupByToken, updateByToken } from '../../../lib/sessionMusicians/service';
import { SessionMusicianConfigError } from '../../../lib/sessionMusicians/tokens';

/**
 * GET/PATCH/POST(confirm)/DELETE — 본인 관리(로그인 없음). 설계 3장.
 *
 * 관리 토큰은 **헤더(`x-manage-token`)로만** 받는다. 쿼리로 받으면 서버·CDN 접근 로그와 Referer에 원문이 남는다.
 * 페이지는 경로에서 토큰을 읽어 이 API를 부른다. 토큰은 256비트라 추측이 불가능하지만 IP당 시간당 한도를 둔다.
 * 토큰이 틀렸든 지워졌든 응답은 같은 404다.
 *
 * - GET: 등록 정보(본인 정보라 연락처 포함)
 * - PATCH: 수정(이메일은 못 바꾼다) — 보유 기간 기산점 갱신
 * - POST `{action:'confirm'}`: "계속 활동 중이에요" — 보유 기간 기산점만 갱신
 * - DELETE: 즉시 삭제(행 삭제)
 */

export const config = { api: { bodyParser: { sizeLimit: '64kb' } } };

const IP_LIMIT = 60;
const IP_WINDOW_SECONDS = 3_600;

const NOT_FOUND = { ok: false, code: 'not_found', message: '이 링크는 더 이상 쓸 수 없어요. 이미 삭제했거나 새 링크가 발급됐을 수 있어요.' };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Vary', 'Origin');

  const method = req.method ?? '';
  if (!['GET', 'PATCH', 'POST', 'DELETE'].includes(method)) {
    res.setHeader('Allow', 'GET, PATCH, POST, DELETE');
    return res.status(405).json({ ok: false });
  }
  // 상태를 바꾸는 요청은 우리 사이트에서 온 것만 받는다(관리 링크는 쿠키가 아니라 헤더 토큰이라 CSRF 면은 좁지만 한 겹 더).
  if (method !== 'GET' && !isAllowedContactRequestOrigin(req)) return res.status(403).json({ ok: false, message: 'Forbidden' });

  const headerToken = req.headers['x-manage-token'];
  const token = Array.isArray(headerToken) ? headerToken[0] : headerToken;

  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`session_musician_manage:ip:${ip}`, IP_LIMIT, IP_WINDOW_SECONDS))) {
    return res.status(429).json({ ok: false, code: 'rate_limited', message: '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.' });
  }

  try {
    if (method === 'GET') {
      const found = await lookupByToken(token);
      if (!found.ok) return res.status(404).json(NOT_FOUND);
      return res.status(200).json({ ok: true, profile: found.view });
    }

    if (method === 'DELETE') {
      const result = await deleteByToken(token);
      return result.ok ? res.status(200).json({ ok: true }) : res.status(404).json(NOT_FOUND);
    }

    if (method === 'POST') {
      const action = (req.body as { action?: unknown } | null)?.action;
      if (action !== 'confirm') return res.status(400).json({ ok: false, code: 'invalid_action', message: '요청 형식이 올바르지 않아요.' });
      const result = await confirmByToken(token);
      return result.ok ? res.status(200).json({ ok: true }) : res.status(404).json(NOT_FOUND);
    }

    // PATCH
    const result = await updateByToken(token, req.body);
    if (result.ok) return res.status(200).json({ ok: true });
    if (result.reason === 'invalid') {
      const { field, code, message } = result.validation;
      return res.status(400).json({ ok: false, field, code, message });
    }
    return res.status(404).json(NOT_FOUND);
  } catch (error: unknown) {
    if (isSessionMusicianTableMissing(error)) {
      return res.status(503).json({ ok: false, code: 'migration_needed', message: '지금은 처리할 수 없어요. 잠시 후 다시 시도해 주세요.' });
    }
    if (error instanceof SessionMusicianConfigError) console.error('[session-musicians] 설정 오류:', error.message);
    else console.error('[session-musicians] 관리 요청 실패', error instanceof Error ? error.name : 'unknown');
    return res.status(500).json({ ok: false, message: '처리하지 못했어요. 잠시 후 다시 시도해 주세요.' });
  }
}
