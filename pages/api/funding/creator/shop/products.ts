import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit } from '../../../../../lib/booking/rate-limit';
import { isAllowedContactRequestOrigin } from '../../../../../lib/contact/origin';
import { getClientIp } from '../../../../../lib/contracts/client-ip';
import { authenticateCreatorApi } from '../../../../../lib/funding/creatorAuth';
import { createDraftProduct, listProductsForCreator } from '../../../../../lib/shop/creatorProductWrite';
import { rejectUnlessShopArtistTermsAgreed, respondProductFailure } from '../../../../../lib/shop/creatorWriteHttp';

/**
 * 아티스트 상품 목록(GET)과 초안 생성(POST). 응답에 내부 메모·내려받기 키는 없다.
 * 초안은 입력 없이 만든다 — 임시 주소(`draft-<uuid>`)로 행을 만들고 편집 화면이 채운다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false });
  }
  if (req.method === 'POST' && !isAllowedContactRequestOrigin(req)) return res.status(403).json({ ok: false, message: 'Forbidden' });

  const auth = await authenticateCreatorApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: '로그인이 필요해요.' });

  try {
    if (req.method === 'GET') {
      return res.status(200).json({ ok: true, products: await listProductsForCreator(auth.creatorId) });
    }

    if (!(await rejectUnlessShopArtistTermsAgreed(res, auth.creatorId, 'funding/creator/shop/products'))) return;
    // 로그인이 "처음 보는 이메일이면 계정 자동 생성"이라 계정 하나만 보면 메일함 N개로 N배가 된다 — IP 한 겹을 더한다.
    const ip = getClientIp(req) ?? 'unknown';
    if (!(await consumeRateLimit(`creator_save:ip:${ip}`, 30, 60)) || !(await consumeRateLimit(`creator_save:${auth.creatorId}`, 30, 60))) {
      return res.status(429).json({ ok: false, message: '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.' });
    }
    const result = await createDraftProduct(auth.creatorId);
    if (!result.ok) return respondProductFailure(res, result);
    return res.status(200).json({ ok: true, id: result.id });
  } catch (error: unknown) {
    console.error('[funding/creator/shop/products] 실패:', error);
    return res.status(500).json({ ok: false, message: '잠시 후 다시 시도해 주세요.' });
  }
}
