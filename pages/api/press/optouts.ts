import type { NextApiRequest, NextApiResponse } from 'next';

import { isTokenMatch } from '../../../lib/booking/token';
import { listPressOptouts } from '../../../lib/press/optouts';

/**
 * music-promo가 수신거부를 당겨 가는 곳.
 *
 * 이 경로는 press.studionol.co.kr에 없다 — 그 호스트는 /u만 응답한다(middleware.ts).
 * 운영자 기계에서 본진으로 부른다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');

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
    const rows = await listPressOptouts(since);
    /**
     * now는 **서버 시각**이다. 호출부가 이 값을 다음 since로 쓴다.
     *
     * 호출부의 시계를 쓰면 기계 간 오차만큼의 구간이 통째로 건너뛰어지고, 그
     * 구간에 들어온 수신거부는 영영 반영되지 않는다.
     */
    return res.status(200).json({ ok: true, rows, now: Math.floor(Date.now() / 1000) });
  } catch (error) {
    console.error('[press-optouts] 조회 실패:', error);
    return res.status(500).json({ ok: false });
  }
}
