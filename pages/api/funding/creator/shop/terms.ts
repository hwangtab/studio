import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit } from '../../../../../lib/booking/rate-limit';
import { isAllowedContactRequestOrigin } from '../../../../../lib/contact/origin';
import { authenticateCreatorApi } from '../../../../../lib/funding/creatorAuth';
import { recordShopArtistTermsAgreement } from '../../../../../lib/shop/artistTermsAgreement';

/**
 * 상점 위탁 약관 동의(POST `{ version, agreed: true }`). `version`은 화면이 보여 준 판본 — 지금 판본과 다르면 409(읽지 않은 판본에
 * 동의시키지 않는다). 등재(`shop_artists`)가 없는 계정은 403. 표가 없으면(0059 전) 503.
 */
const STATUS = { no_shop: 403, stale_version: 409, unavailable: 503 } as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }
  if (!isAllowedContactRequestOrigin(req)) return res.status(403).json({ ok: false, message: 'Forbidden' });

  const auth = await authenticateCreatorApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: '로그인이 필요해요.' });
  if (!(await consumeRateLimit(`creator_shop_terms:${auth.creatorId}`, 10, 600))) {
    return res.status(429).json({ ok: false, message: '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.' });
  }

  const b = ((typeof req.body === 'object' && req.body) || {}) as Record<string, unknown>;
  if (b.agreed !== true || typeof b.version !== 'string') {
    return res.status(400).json({ ok: false, message: '약관에 동의해 주세요.' });
  }
  try {
    const result = await recordShopArtistTermsAgreement(auth.creatorId, b.version);
    if (!result.ok) return res.status(STATUS[result.code]).json({ ok: false, message: result.message });
    return res.status(200).json({ ok: true, agreedAt: result.agreedAt });
  } catch (error: unknown) {
    console.error('[funding/creator/shop/terms] 실패:', error);
    return res.status(500).json({ ok: false, message: '저장하지 못했어요. 잠시 후 다시 시도해 주세요.' });
  }
}
