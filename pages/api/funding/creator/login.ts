import { createHash } from 'node:crypto';

import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit } from '../../../../lib/booking/rate-limit';
import { isAllowedContactRequestOrigin } from '../../../../lib/contact/origin';
import { getClientIp } from '../../../../lib/contracts/client-ip';
import { sendCreatorLoginEmail } from '../../../../lib/funding/creatorEmail';
import { issueCreatorLoginToken, normalizeCreatorEmail } from '../../../../lib/funding/creatorToken';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://studionol.co.kr').replace(/\/+$/, '');

/** IP당 10분에 5회. 같은 이메일로는 10분에 3회. */
const IP_LIMIT = 5;
const EMAIL_LIMIT = 3;
const WINDOW_SECONDS = 600;

/**
 * 응답은 언제나 같다.
 *
 * "등록되지 않은 이메일입니다"라고 답하면 이 화면이 **누가 개설자인지 알려 주는 조회기**가
 * 된다. 보낸 척과 실제로 보낸 것을 밖에서 구분할 수 없어야 한다.
 */
const OK = { ok: true, message: '로그인 링크를 보냈습니다. 메일함을 확인해 주세요.' };

/**
 * rate_limits.key에 평문 이메일을 남기지 않는다. 이 테이블은 10분 창이 지나도 즉시
 * 지워지지 않고(만료 스윕은 다음 호출에서 lazy하게 일어난다) 개설자 이메일 주소가
 * 그대로 남는 걸 막기 위해 해시로 키를 만든다. 같은 주소는 항상 같은 해시로 가므로
 * 한도 판정 동작은 그대로다.
 */
const emailRateLimitKey = (email: string): string =>
  `creator_login:email:${createHash('sha256').update(email).digest('hex').slice(0, 16)}`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  // 개설자 세션은 매직링크(메일 GET 이동)를 받아야 해서 SameSite=lax다(관리자 strict보다
  // CSRF 방어가 한 겹 얇다). 상태를 바꾸는 이 엔드포인트는 요청 Origin이 우리 사이트인
  // 경우만 받아 그 틈을 좁힌다. isAllowedContactRequestOrigin은 이름과 달리 문의 폼
  // 전용 도메인 목록을 갖지 않고 사이트 자체 오리진(NEXT_PUBLIC_SITE_URL·프로덕션
  // 도메인·개발 localhost)만 비교하므로 그대로 재사용한다.
  if (!isAllowedContactRequestOrigin(req)) {
    return res.status(403).json({ ok: false, message: 'Forbidden' });
  }

  const email = normalizeCreatorEmail(typeof req.body?.email === 'string' ? req.body.email : '');
  if (!email) return res.status(400).json({ ok: false, message: '이메일 주소를 확인해 주세요.' });

  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`creator_login:ip:${ip}`, IP_LIMIT, WINDOW_SECONDS))) {
    return res.status(429).json({ ok: false, message: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });
  }
  if (!(await consumeRateLimit(emailRateLimitKey(email), EMAIL_LIMIT, WINDOW_SECONDS))) {
    // 한 주소로 링크를 퍼붓는 것을 막는다. 여기서도 같은 200을 돌려준다 — 429를 주면
    // "그 주소는 존재한다"를 알려 주는 셈이다.
    return res.status(200).json(OK);
  }

  const issued = await issueCreatorLoginToken(email);
  if (issued) {
    const url = `${SITE_URL}/ko/funding/creator/auth?token=${encodeURIComponent(issued.rawToken)}`;
    const error = await sendCreatorLoginEmail(email, url);
    // 메일 실패는 사용자에게 드러내지 않는다(위와 같은 이유). 기록만 남긴다.
    if (error) console.error('[funding] 개설자 로그인 메일 실패:', error);
  }
  return res.status(200).json(OK);
}
