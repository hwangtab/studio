import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit, releaseRateLimit } from '../../../lib/booking/rate-limit';
import { isAllowedContactRequestOrigin } from '../../../lib/contact/origin';
import { isHoneypotSubmission, isTooFast } from '../../../lib/contact/payload';
import { getClientIp } from '../../../lib/contracts/client-ip';
import { isSessionMusicianTableMissing } from '../../../lib/sessionMusicians/repository';
import { submitRegistration } from '../../../lib/sessionMusicians/service';
import { hashSessionEmail, SessionMusicianConfigError } from '../../../lib/sessionMusicians/tokens';
import { validateSessionRegistration } from '../../../lib/sessionMusicians/validate';

/**
 * POST — 세션 연주자 등록(공개). 설계 3장.
 *
 * 응답은 **새 등록이든 이미 있는 이메일이든 똑같다**(`OK`) — 이메일 존재 여부를 화면으로 알려 주지 않는다.
 * 같은 이유로 이메일 단위 제한에 걸려도 같은 200을 준다. 봇 트랩(허니팟·너무 빠른 제출)도 가짜 200이다(문의 폼과 같다).
 *
 * 제한: IP당 3건/시간, 이메일당 2건/일, 전체 50건/일. 마지막 칸은 봇이 IP를 돌려도 접수 확인 메일이 대량으로
 * 나가지 않게 하는 상한이다 — 남의 주소를 적어 메일을 퍼붓는 경로가 이 폼에 있기 때문이다.
 */

export const config = { api: { bodyParser: { sizeLimit: '64kb' } } };

const OK = { ok: true };

const IP_LIMIT = 3;
const IP_WINDOW_SECONDS = 3_600;
const EMAIL_DAILY_LIMIT = 2;
const GLOBAL_DAILY_CAP = 50;
const DAY_SECONDS = 86_400;
const GLOBAL_KEY = 'session_musician:global';

/**
 * rate_limits.key에 평문 이메일을 남기지 않는다. 키 없는 sha256은 흔한 주소 목록으로 되짚을 수 있어
 * 중복 판정과 같은 키 있는 해시(`hashSessionEmail`)를 쓴다.
 */
const emailKey = (email: string): string => `session_musician:email:${hashSessionEmail(email).slice(0, 32)}`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Origin');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }
  const contentType = req.headers['content-type'];
  if (contentType && !String(contentType).toLowerCase().includes('application/json')) {
    return res.status(415).json({ ok: false, message: 'Content-Type must be application/json' });
  }
  if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
    return res.status(400).json({ ok: false, code: 'invalid_body', message: '요청 형식이 올바르지 않아요.' });
  }
  const body = req.body as Record<string, unknown>;

  // 봇에게는 실패를 알리지 않는다 — 성공으로 응답하고 저장·발송만 건너뛴다. 오탐이 드러나게 로그는 남긴다.
  const honeypotTripped = isHoneypotSubmission(body.company);
  const tooFast = isTooFast(body._formFillMs);
  if (honeypotTripped || tooFast) {
    console.warn(`[session-musicians] 봇 트랩으로 접수 생략 (honeypot=${honeypotTripped}, tooFast=${tooFast}, fillMs=${String(body._formFillMs)})`);
    return res.status(200).json(OK);
  }

  if (!isAllowedContactRequestOrigin(req)) return res.status(403).json({ ok: false, message: 'Forbidden' });

  // 검증을 먼저 한다 — 검증은 DB·메일을 건드리지 않으니 횟수를 세지 않는다. 입력을 고쳐 다시 내는 지원자가
  // 시간당 한도(3건)를 오타로 다 써 버리지 않게(2026-10-22 리뷰).
  const validation = validateSessionRegistration(body);
  if (!validation.ok) {
    return res.status(400).json({ ok: false, field: validation.field, code: validation.code, message: validation.message });
  }
  const input = validation.value;

  const ip = getClientIp(req) ?? 'unknown';
  const ipKey = `session_musician:ip:${ip}`;
  if (!(await consumeRateLimit(ipKey, IP_LIMIT, IP_WINDOW_SECONDS))) {
    return res.status(429).json({ ok: false, code: 'rate_limited', message: '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.' });
  }

  // 이 요청이 센 이메일·전체 한도. 등록이 우리 쪽 장애로 실패하면 되돌린다 — 안 그러면 장애 중에 다시 시도한 지원자가
  // 이메일 한도(하루 2건)에 걸려 저장되지 않았는데도 "등록을 받았어요"를 보게 된다(2026-10-22 리뷰).
  // IP 한도도 함께 되돌린다 — 장애 중 세 번 실패한 사람이 장애가 끝난 뒤 한 시간 막히지 않게.
  const consumed: string[] = [ipKey];
  try {
    // 이메일 단위·전체 상한은 메일을 실제로 보내기 직전에만 소비한다(검증에 걸린 요청이 예산을 태우지 않게).
    // emailKey는 비밀이 없으면 SessionMusicianConfigError를 던지므로 try 안에 둔다.
    const emailLimitKey = emailKey(input.email);
    consumed.push(emailLimitKey);
    if (!(await consumeRateLimit(emailLimitKey, EMAIL_DAILY_LIMIT, DAY_SECONDS))) {
      return res.status(200).json(OK);
    }
    consumed.push(GLOBAL_KEY);
    if (!(await consumeRateLimit(GLOBAL_KEY, GLOBAL_DAILY_CAP, DAY_SECONDS))) {
      console.error('[session-musicians] 일일 접수 한도 도달 — 접수를 건너뜁니다.');
      // 접수하지 않았으니 센 것을 되돌린다 — 안 그러면 내일 다시 오라는 말에 바로 재시도한 사람이 이메일 한도에 걸려
      // 저장 없이 가짜 200("등록을 받았어요")을 받는다(2026-10-23 리뷰).
      await Promise.all(consumed.map((key) => releaseRateLimit(key)));
      return res.status(429).json({ ok: false, code: 'daily_cap', message: '오늘은 접수가 많아요. 내일 다시 시도해 주세요.' });
    }

    await submitRegistration(input);
    return res.status(200).json(OK);
  } catch (error: unknown) {
    await Promise.all(consumed.map((key) => releaseRateLimit(key)));
    if (isSessionMusicianTableMissing(error)) {
      return res.status(503).json({ ok: false, code: 'migration_needed', message: '지금은 등록을 받을 수 없어요. 잠시 후 다시 시도해 주세요.' });
    }
    if (error instanceof SessionMusicianConfigError) {
      console.error('[session-musicians] 설정 오류:', error.message);
      return res.status(500).json({ ok: false, message: '지금은 등록을 받을 수 없어요.' });
    }
    console.error('[session-musicians] 접수 실패', error instanceof Error ? error.name : 'unknown');
    return res.status(500).json({ ok: false, message: '등록하지 못했어요. 잠시 후 다시 시도해 주세요.' });
  }
}
