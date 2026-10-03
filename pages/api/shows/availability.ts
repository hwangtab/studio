import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicShowBySlug } from '../../../lib/shows/queries';

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,80}$/i;

/**
 * 공개 상세 화면이 마운트 뒤 잔여석을 다시 읽는 GET. 개인정보가 없고 CDN이 짧게 캐시한다
 * (페이지 자체도 SSR 캐시라 그 사이 팔린 표가 있을 수 있다). 숫자는 안내용이고 판매 여부는
 * 주문 생성의 원자적 게이트가 정한다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false });
  const slug = typeof req.query.slug === 'string' ? req.query.slug : '';
  if (!SLUG_PATTERN.test(slug)) return res.status(400).json({ ok: false });

  const show = await getPublicShowBySlug(slug, new Date());
  if (!show) {
    res.setHeader('Cache-Control', 'public, s-maxage=10');
    return res.status(404).json({ ok: false });
  }
  res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=20');
  return res.status(200).json({
    ok: true,
    showtimes: show.showtimes.map((s) => ({ id: s.id, saleState: s.saleState, remaining: s.remaining })),
  });
}
