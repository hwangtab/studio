import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit } from '../../../../lib/booking/rate-limit';
import { isAllowedContactRequestOrigin } from '../../../../lib/contact/origin';
import { loginCreatorSession } from '../../../../lib/funding/creatorAuth';
import { consumeCreatorLoginToken } from '../../../../lib/funding/creatorToken';
import { sendCreatorSessionFailureAlert } from '../../../../lib/funding/email';

/**
 * 세션 생성 실패 알림의 창. login.ts의 전역 캡 알림과 같은 이유로 레이트리밋을 태운다 —
 * 이 경로가 계속 실패하는 동안 알림이 실패 횟수만큼 쏟아지면 그것이 두 번째 사고다.
 * 원인(Turso 순간 장애 등)이 오래가도 운영자는 한 시간에 한 통이면 충분히 알아챈다.
 */
const SESSION_FAILURE_ALERT_WINDOW_SECONDS = 3600;

/**
 * 매직링크 토큰을 소진해 개설자 세션을 심는다.
 *
 * **POST만 받는다.** 예전에는 `pages/[locale]/funding/creator/auth.tsx`의
 * getServerSideProps(GET)가 여기서 하는 소진을 대신했는데, 회사 메일의 링크 검사기
 * (Safe Links·Proofpoint)나 카카오톡·슬랙 미리보기 봇이 배달 시점에 그 GET 주소를 한 번
 * 긁으면 개설자가 실제로 링크를 누르기도 전에 토큰이 죽었다. pages/api/funding/download.ts
 * 32~40번째 줄과 같은 함정, 같은 해법이다 — 상태를 바꾸는 소진은 사람이 누른 폼 제출
 * (fetch POST)에서만 일어나야 한다.
 *
 * login.ts·logout.ts와 같은 이유(SameSite=lax 개설자 세션)로 Origin을 검사한다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  if (!isAllowedContactRequestOrigin(req)) {
    return res.status(403).json({ ok: false, message: 'Forbidden' });
  }

  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  if (!token) return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않습니다.' });

  const consumed = await consumeCreatorLoginToken(token);
  if (!consumed) {
    // 이미 링크를 가진 사람만 오는 자리라 열거 위험이 없다 — 실패 이유는 사용자에게
    // 보여도 되지만, 만료와 이미 사용됨은 여기서도 구분하지 않는다(consumeCreatorLoginToken과
    // 같은 이유: 구분해 주면 토큰의 상태를 밖에서 캐물을 수 있게 된다).
    return res.status(401).json({ ok: false, message: '링크가 만료됐거나 이미 사용되었습니다.' });
  }

  try {
    await loginCreatorSession(req, res, consumed.creatorId, consumed.sessionVersion);
  } catch (error: unknown) {
    // 토큰은 이미 소진됐다 — 되돌릴 수 없다(위 주석 참조). 화면에는 401과 다른 응답을
    // 줘서 "만료됐거나 이미 사용됨"이라는, 여기서는 사실이 아닌 문구를 반복하지 않게 한다.
    console.error('[funding] 개설자 세션 생성 실패:', error);
    if (await consumeRateLimit('creator_session_failure:alert', 1, SESSION_FAILURE_ALERT_WINDOW_SECONDS)) {
      const alertError = await sendCreatorSessionFailureAlert();
      if (alertError) console.error('[funding] 개설자 세션 실패 알림 오류:', alertError);
    }
    return res.status(500).json({
      ok: false,
      message: '일시적인 오류로 로그인하지 못했습니다. 잠시 후 새 링크로 다시 시도해 주세요.',
    });
  }
  return res.status(200).json({ ok: true });
}
