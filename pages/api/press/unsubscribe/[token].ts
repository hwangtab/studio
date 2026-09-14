import type { NextApiRequest, NextApiResponse } from 'next';

import { getClientIp } from '../../../../lib/contracts/client-ip';
import { consumeRateLimit } from '../../../../lib/booking/rate-limit';
import { recordPressOptout } from '../../../../lib/press/optouts';
import { renderUnsubPage } from '../../../../lib/press/page';
import { verifyPressToken } from '../../../../lib/press/token';

/**
 * 보도자료 수신거부.
 *
 * 한 경로가 GET과 POST를 모두 받는다. RFC 8058 원클릭은 List-Unsubscribe에 적힌
 * **그 URL로 POST**를 보내는데, Pages Router의 페이지 컴포넌트는 POST를 받지 못한다.
 *
 * GET은 거부를 반영하지 않는다. 메일 본문의 링크는 스팸 필터와 보안 게이트웨이가
 * 미리 열어 보는 일이 흔해서, GET에서 반영하면 기자가 누른 적도 없는데 거부 처리된다.
 */
const sendPage = (res: NextApiResponse, status: number, html: string): void => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(status).send(html);
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false });
  }

  const token = Array.isArray(req.query.token) ? req.query.token[0] : req.query.token;
  const secret = process.env.PRESS_UNSUB_SECRET;

  /**
   * 비밀키가 없으면 어떤 토큰도 검증할 수 없다. 이때 "수신거부되었습니다"를 보여
   * 주면 안 된다 — 실제로는 아무것도 기록되지 않았는데 기자는 끝난 줄 안다.
   */
  if (!secret) {
    console.error('[press-unsubscribe] PRESS_UNSUB_SECRET이 없습니다');
    return sendPage(res, 500, renderUnsubPage('invalid', 'en', ''));
  }

  const payload = token ? verifyPressToken(token, secret) : null;

  /**
   * 검증을 rate limit보다 먼저 한다.
   *
   * 반대로 하면 잘못된 링크를 반복해서 여는 것만으로 한도가 소진되어, 정작 제대로
   * 된 수신거부가 막힌다(pages/api/funding/pledges.ts:31-38에 기록된 함정).
   */
  if (!payload) {
    return req.method === 'POST'
      ? res.status(400).json({ ok: false })
      : sendPage(res, 400, renderUnsubPage('invalid', 'en', ''));
  }

  const ip = getClientIp(req);
  const allowed = await consumeRateLimit(`press-unsub:${ip ?? 'unknown'}`, 30, 300);
  if (!allowed) {
    return req.method === 'POST'
      ? res.status(429).json({ ok: false })
      : sendPage(res, 429, renderUnsubPage('invalid', payload.l, ''));
  }

  if (req.method === 'GET') {
    return sendPage(res, 200, renderUnsubPage('confirm', payload.l, token as string));
  }

  try {
    await recordPressOptout({
      emailHash: payload.h,
      campaignSlug: payload.c,
      // 사람이 확인 화면을 거쳐 눌렀는지, 메일 클라이언트가 원클릭으로 보냈는지.
      // 후자는 Referer가 없다 — 이 구분은 나중에 "어느 경로가 실제로 쓰이는가"를
      // 볼 때만 의미가 있고, 처리 자체는 같다.
      source: req.headers.referer ? 'page' : 'one-click',
    });
  } catch (error) {
    console.error('[press-unsubscribe] 기록 실패:', error);
    return res.status(500).json({ ok: false });
  }

  /**
   * 원클릭 POST는 메일 클라이언트가 보내고 사람은 응답 본문을 보지 않는다.
   * 확인 화면에서 온 POST는 사람이 결과를 봐야 한다 — Referer로 갈린다.
   */
  if (req.headers.referer) {
    return sendPage(res, 200, renderUnsubPage('done', payload.l, ''));
  }
  return res.status(204).end();
}
