import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublishedSoftware, latestReleaseOf } from '../../../lib/software/catalog';

/** 플러그인의 업데이트 확인(하루 한 번). 개인정보를 받지 않고, 카탈로그 값만 돌려준다 — CDN이 1시간 캐시한다. */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }
  const product = getPublishedSoftware(req.query.product);
  const release = product ? latestReleaseOf(product) : null;
  if (!release) {
    res.setHeader('Cache-Control', 'public, s-maxage=300');
    return res.status(404).json({ ok: false, error: 'not_found' });
  }
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).json({ ok: true, version: release.version, date: release.date, notes: release.notes, notesEn: release.notesEn });
}
