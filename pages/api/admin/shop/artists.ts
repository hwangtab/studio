import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { createShopArtist, updateShopArtistSlug } from '../../../../lib/shop/artists';

/** 관리자 — 상점 아티스트 등재(POST)와 slug 변경(PATCH). 승인된 상품이 있으면 slug는 못 바꾼다. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  if (req.method !== 'POST' && req.method !== 'PATCH') {
    res.setHeader('Allow', 'POST, PATCH');
    return res.status(405).json({ ok: false });
  }
  const b = ((typeof req.body === 'object' && req.body) || {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');

  try {
    if (req.method === 'POST') {
      const result = await createShopArtist({ email: str(b.email), name: str(b.name), slug: str(b.slug), linkCurated: b.linkCurated === true });
      return result.ok ? res.status(200).json({ ok: true, creatorId: result.creatorId }) : res.status(result.code === 'slug_taken' || result.code === 'already_registered' ? 409 : 400).json(result);
    }
    const result = await updateShopArtistSlug({ creatorId: str(b.creatorId), slug: str(b.slug), linkCurated: b.linkCurated === true });
    return result.ok ? res.status(200).json({ ok: true }) : res.status(result.code === 'locked' || result.code === 'slug_taken' ? 409 : result.code === 'not_found' ? 404 : 400).json(result);
  } catch (error: unknown) {
    console.error('[admin/shop/artists] 실패:', error);
    return res.status(500).json({ ok: false, message: '저장하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
  }
}
