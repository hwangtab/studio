import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { getClientIp } from '../../../lib/contracts/client-ip';
import { isSafeObjectKey } from '../../../lib/funding/objectKey';
import { presignFundingDownload } from '../../../lib/funding/r2';
import { findDbPreviewKey } from '../../../lib/shop/dbProducts';
import { DIGITAL_KEY_PREFIX } from '../../../lib/shop/reviewDecision';

/**
 * 디지털 상품 미리듣기 — 상품 화면의 `<audio src>`가 부르는 공개 경로.
 *
 * 내려받기를 시작하면 청약철회가 제한되므로(전자상거래법 제17조 제2항 제5호) 구매 전에 일부를 들어 볼 수 있어야 한다(같은 조 제6항).
 * 승인·공개된 디지털 상품의 **`preview: true` 파일만** 5분짜리 서명 주소로 302한다. 판매 파일 순번으로는 닿지 않고,
 * R2 키는 화면·props 어디에도 싣지 않는다. 내려받기 기록(`shop_order_downloads`)과 무관하다 — 누구나 들을 수 있다.
 */

const PREVIEW_TTL_SECONDS = 5 * 60;
const NOT_FOUND = { ok: false, message: '미리듣기를 찾을 수 없어요.' } as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ ok: false, message: '허용되지 않는 요청이에요.' });
  }

  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`shop_preview:ip:${ip}`, 120, 3600)))
    return res.status(429).json({ ok: false, message: '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.' });

  const { product, i } = req.query;
  if (typeof product !== 'string' || !/^[a-z0-9-]{1,80}$/.test(product) || typeof i !== 'string' || !/^\d{1,2}$/.test(i))
    return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않아요.' });

  try {
    const key = await findDbPreviewKey(product, Number(i));
    if (!key) return res.status(404).json(NOT_FOUND);
    if (!isSafeObjectKey(key) || !key.startsWith(DIGITAL_KEY_PREFIX)) {
      console.error('[shop-preview] 허용되지 않는 키', { product });
      return res.status(503).json({ ok: false, message: '지금은 들을 수 없어요.' });
    }
    const url = await presignFundingDownload(key, { inline: true, ttlSeconds: PREVIEW_TTL_SECONDS });
    return res.redirect(302, url);
  } catch (error) {
    console.error('[api/shop/preview] 실패', error);
    return res.status(503).json({ ok: false, message: '지금은 들을 수 없어요.' });
  }
}
