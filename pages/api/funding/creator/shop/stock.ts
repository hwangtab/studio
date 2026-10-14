import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit } from '../../../../../lib/booking/rate-limit';
import { isAllowedContactRequestOrigin } from '../../../../../lib/contact/origin';
import { authenticateCreatorApi } from '../../../../../lib/funding/creatorAuth';
import { setOwnSkuStock } from '../../../../../lib/shop/creatorStock';
import { rejectUnlessShopArtistTermsAgreed } from '../../../../../lib/shop/creatorWriteHttp';

/** 아티스트가 직접 보내는 상품의 옵션별 총 재고 정하기. 소유·발송 주체 판정은 `setOwnSkuStock`. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  if (!isAllowedContactRequestOrigin(req)) return res.status(403).json({ ok: false, message: 'Forbidden' });

  const auth = await authenticateCreatorApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: '로그인이 필요해요.' });
  if (!(await rejectUnlessShopArtistTermsAgreed(res, auth.creatorId, 'funding/creator/shop/stock'))) return;
  if (!(await consumeRateLimit(`creator_shop_stock:${auth.creatorId}`, 60, 600))) {
    return res.status(429).json({ ok: false, message: '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.' });
  }

  const b = ((typeof req.body === 'object' && req.body) || {}) as Record<string, unknown>;
  if (typeof b.skuId !== 'string' || typeof b.stock !== 'number') return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않아요.' });
  try {
    const result = await setOwnSkuStock(auth.creatorId, b.skuId, b.stock);
    return result.ok ? res.status(200).json({ ok: true }) : res.status(400).json(result);
  } catch (error: unknown) {
    console.error('[funding/creator/shop/stock] 실패:', error);
    return res.status(500).json({ ok: false, message: '저장하지 못했어요. 잠시 후 다시 시도해 주세요.' });
  }
}
