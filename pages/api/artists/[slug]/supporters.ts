import type { NextApiRequest, NextApiResponse } from 'next';

import { getSupportedArtist } from '../../../../data/artists';
import { countSupporters, listPublicSupporters } from '../../../../lib/artistSupport/supporters';

/**
 * 아티스트 페이지의 후원자 명단 — 페이지는 정적 생성이라 DB를 못 읽으므로 브라우저가 여기서
 * 가져온다. 이름은 동의한 사람만, 금액·등급은 절대 싣지 않는다(스펙 §11.3). 수(count)는
 * 동의 여부와 무관하다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false });
  }
  const slug = typeof req.query.slug === 'string' ? req.query.slug : '';
  if (!slug || !getSupportedArtist(slug)) return res.status(404).json({ ok: false });

  try {
    const [count, supporters] = await Promise.all([countSupporters(slug), listPublicSupporters(slug)]);
    // 1분 캐시 — 명단은 분 단위로 바뀌지 않고, 페이지 조회마다 DB를 치지 않게 한다.
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({ ok: true, count, supporters });
  } catch (error: unknown) {
    console.error('[API/artists/supporters] 조회 실패:', error);
    return res.status(500).json({ ok: false });
  }
}
