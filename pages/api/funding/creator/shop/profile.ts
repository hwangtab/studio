import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit } from '../../../../../lib/booking/rate-limit';
import { isAllowedContactRequestOrigin } from '../../../../../lib/contact/origin';
import { authenticateCreatorApi } from '../../../../../lib/funding/creatorAuth';
import { saveCreatorSection } from '../../../../../lib/funding/creatorProjectWrite';
import { isOwnUploadedMedia, validateCreatorSection } from '../../../../../lib/funding/creatorValidation';
import { respondWriteResult } from '../../../../../lib/funding/creatorWriteHttp';
import { getShopArtistByCreator, setShopArtistProfileImage } from '../../../../../lib/shop/artists';

/**
 * 상점 아티스트 프로필 저장 — 두 구획.
 *  - `section: 'profile'`: 이름·소개·링크 등. 기존 개설자 프로필 저장(`saveCreatorSection`, 이름 잠금 포함)을 그대로 쓴다.
 *  - `section: 'image'`: 프로필 사진 주소. 이 개설자가 올린 업로드만 받는다(`isOwnUploadedMedia`).
 * `shop_artists` 행이 없는 계정은 404 — 상점이 열리지 않은 사람에게 존재를 알리지 않는다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  if (!isAllowedContactRequestOrigin(req)) return res.status(403).json({ ok: false, message: 'Forbidden' });

  const auth = await authenticateCreatorApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: '로그인이 필요해요.' });

  try {
    if (!(await getShopArtistByCreator(auth.creatorId))) return res.status(404).json({ ok: false, message: '상점을 찾을 수 없어요.' });
  } catch (error: unknown) {
    console.error('[shop/profile] 아티스트 조회 실패:', error);
    return res.status(500).json({ ok: false, message: '잠시 후 다시 시도해 주세요.' });
  }

  if (!(await consumeRateLimit(`creator_save:${auth.creatorId}`, 30, 60))) {
    return res.status(429).json({ ok: false, message: '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.' });
  }

  const section = req.body?.section;
  try {
    if (section === 'profile') {
      const validated = validateCreatorSection(req.body?.value);
      if (!validated.ok) return res.status(400).json({ ok: false, message: validated.message });
      return respondWriteResult(res, await saveCreatorSection(auth.creatorId, validated.value));
    }
    if (section === 'image') {
      const url = typeof req.body?.url === 'string' ? req.body.url : '';
      if (!url || !isOwnUploadedMedia(url, { creatorId: auth.creatorId })) {
        return res.status(400).json({ ok: false, message: '사진을 다시 올려 주세요.' });
      }
      await setShopArtistProfileImage(auth.creatorId, url);
      return res.status(200).json({ ok: true });
    }
  } catch (error: unknown) {
    console.error('[shop/profile] 저장 실패:', error);
    return res.status(500).json({ ok: false, message: '저장하지 못했어요. 잠시 후 다시 시도해 주세요.' });
  }
  return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않아요.' });
}
