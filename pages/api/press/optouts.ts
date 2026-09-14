import type { NextApiRequest, NextApiResponse } from 'next';

import { isTokenMatch } from '../../../lib/booking/token';
import { PRESS_HOST } from '../../../lib/press/host';
import { PRESS_OPTOUT_PAGE_SIZE, listPressOptouts } from '../../../lib/press/optouts';

/**
 * music-promo가 수신거부를 당겨 가는 곳.
 *
 * 운영자 기계에서 본진(studionol.co.kr)으로 부른다.
 *
 * press.studionol.co.kr에서는 응답하지 않는다. 미들웨어의 호스트 분기가 /u 말고는
 * 전부 404로 끊지만, 그 분기는 **미들웨어를 타는 경로에만** 걸린다 — matcher의
 * negative lookahead가 `api`를 애초에 미들웨어에 태우지 않으므로 /api/*는 press
 * 호스트에서도 그대로 응답한다. 그래서 격리를 이 핸들러가 직접 한 번 더 건다.
 * 전용 호스트는 기자가 누르는 링크 하나만 사는 곳이고, 명단 전체를 돌려주는
 * 경로가 거기 함께 열려 있을 이유가 없다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');

  // 존재를 알리지 않는다 — 아래 토큰 불일치와 같은 판단이다.
  if (req.headers.host === PRESS_HOST) {
    return res.status(404).json({ ok: false });
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false });
  }

  const expected = process.env.PRESS_PULL_TOKEN;
  const given = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');

  /**
   * 키가 없거나 틀리면 404다. 401을 주면 "이 경로는 존재한다"를 알려 주는 셈이고,
   * 이 저장소는 같은 판단을 이미 하고 있다(pages/api/funding/display-name.ts:19-20).
   */
  if (!expected || !given || !isTokenMatch(expected, given)) {
    return res.status(404).json({ ok: false });
  }

  const raw = Array.isArray(req.query.since) ? req.query.since[0] : req.query.since;
  const since = Number.parseInt(raw ?? '0', 10);
  if (!Number.isFinite(since) || since < 0) {
    return res.status(400).json({ ok: false, message: 'since는 0 이상의 epoch 초입니다.' });
  }

  try {
    const rows = await listPressOptouts(since, PRESS_OPTOUT_PAGE_SIZE);

    /**
     * 한 창에 상한만큼 찼으면 그 뒤가 더 있을 수 있다.
     *
     * 예전에는 이때도 now(서버 시각)를 다음 since로 줬다. 그러면 상한을 넘은
     * 행들은 **그 구간이 통째로 지나가 버려 영영 다시 읽히지 않는다** — 거부한
     * 사람에게 다음 캠페인이 나가는 경로이고, 경고도 안 난다.
     *
     * 그래서 더 남았을 때는 마지막 행의 시각으로만 전진시킨다. 1초를 빼는 것은
     * 같은 초에 들어온 형제 행이 상한 밖으로 밀렸을 수 있기 때문이다 — 조회가
     * since **초과**라 빼지 않으면 그 형제들이 사라진다. 겹쳐 읽는 것은 완전히
     * 안전하다(삽입이 ON CONFLICT DO NOTHING이라 두 번 받아도 결과가 같다).
     * 덜 읽는 것만 위험하다.
     *
     * more가 true면 호출부는 한 번 더 당겨야 한다.
     */
    const more = rows.length >= PRESS_OPTOUT_PAGE_SIZE;
    const now = more
      ? (rows[rows.length - 1]?.createdAt ?? since) - 1
      : Math.floor(Date.now() / 1000);

    /**
     * more가 아닐 때의 now는 **서버 시각**이다. 호출부가 이 값을 다음 since로 쓴다.
     *
     * 호출부의 시계를 쓰면 기계 간 오차만큼의 구간이 통째로 건너뛰어지고, 그
     * 구간에 들어온 수신거부는 영영 반영되지 않는다.
     */
    return res.status(200).json({ ok: true, rows, now, more });
  } catch (error) {
    console.error('[press-optouts] 조회 실패:', error);
    return res.status(500).json({ ok: false });
  }
}
