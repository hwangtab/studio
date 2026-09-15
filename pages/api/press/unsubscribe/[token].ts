import type { NextApiRequest, NextApiResponse } from 'next';

import { getClientIp } from '../../../../lib/contracts/client-ip';
import { consumeRateLimit } from '../../../../lib/booking/rate-limit';
import { recordPressOptout } from '../../../../lib/press/optouts';
import { renderUnsubPage } from '../../../../lib/press/page';
import { PRESS_UNSUB_TOKEN_HEADER } from '../../../../lib/press/host';
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

  /**
   * 토큰은 두 경로로 들어온다.
   *
   * press.studionol.co.kr/u/<token>은 미들웨어가 여기로 rewrite하는데, 그때 Next가
   * 동적 세그먼트를 채우지 않아 `req.query`가 비어 있다 — 그래서 미들웨어가 헤더로
   * 넘긴다. 본진에서 이 경로를 직접 부르면 세그먼트가 정상적으로 채워진다.
   */
  const fromHeader = req.headers[PRESS_UNSUB_TOKEN_HEADER];
  const token =
    (Array.isArray(req.query.token) ? req.query.token[0] : req.query.token) ??
    (Array.isArray(fromHeader) ? fromHeader[0] : fromHeader);
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

  /**
   * 사람이 확인 화면을 거쳐 눌렀는지, 메일 클라이언트가 원클릭으로 보냈는지는
   * Referer가 아니라 **우리 폼이 실어 보낸 필드**로 가른다.
   *
   * Referer는 브라우저·확장(Brave 엄격 모드 등)이 전면 차단할 수 있어, 사람이
   * 확인 화면의 버튼을 눌러도 비어 있을 수 있다 — 그러면 거부는 기록되는데
   * 화면 없이 204만 돌아가 기자는 처리됐는지 알 길이 없다. RFC 8058 원클릭은
   * List-Unsubscribe=One-Click 본문만 보내고 `via` 같은 필드를 절대 싣지 않으므로,
   * 이 값의 유무는 브라우저 설정과 무관하게 결정적이다.
   *
   * Next.js는 application/x-www-form-urlencoded를 자동으로 객체로 파싱하지만,
   * 다른 Content-Type(원클릭이 보낼 수 있는 text/plain 등)에서는 req.body가
   * 문자열이거나 undefined일 수 있어 방어한다.
   */
  const body = req.body;
  const via = body && typeof body === 'object' ? (body as Record<string, unknown>).via : undefined;
  const fromPage = via === 'page';

  try {
    await recordPressOptout({
      emailHash: payload.h,
      campaignSlug: payload.c,
      // 이 구분은 나중에 "어느 경로가 실제로 쓰이는가"를 볼 때만 의미가 있고,
      // 처리 자체는 같다.
      source: fromPage ? 'page' : 'one-click',
    });
  } catch (error) {
    console.error('[press-unsubscribe] 기록 실패:', error);
    return res.status(500).json({ ok: false });
  }

  /**
   * 원클릭 POST는 메일 클라이언트가 보내고 사람은 응답 본문을 보지 않는다.
   * 확인 화면에서 온 POST는 사람이 결과를 봐야 한다.
   */
  if (fromPage) {
    return sendPage(res, 200, renderUnsubPage('done', payload.l, ''));
  }
  return res.status(204).end();
}
