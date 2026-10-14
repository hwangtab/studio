import { randomUUID } from 'node:crypto';

import { put } from '@vercel/blob';
import type { NextApiRequest, NextApiResponse } from 'next';

import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { buildFundingMediaUrl, processCreatorImage, UPLOAD_LIMITS } from '../../../../lib/funding/creatorUpload';
import { FUNDING_MEDIA_PREFIX } from '../../../../lib/funding/mediaPath';
import { readBodyWithLimit } from '../../../../lib/funding/uploadBody';
import { loadShopProductForAdmin } from '../../../../lib/shop/adminProducts';
import { canAdminEditShopField, SHOP_CREATOR_LIMITS } from '../../../../lib/shop/productRules';

/**
 * 관리자 — 상품 사진 업로드(`?productId=`). 아티스트 업로드(`/api/funding/creator/upload`)와 같은 재인코딩·private Blob이고,
 * **키 앞부분은 상품 소유자(`creator_id`)다** — 소유 판정(`isOwnUploadedMedia`)·공개 판정(`isApprovedShopMedia`)·미디어 청소
 * (`mediaRetention`)가 그대로 통하고, 아티스트가 자기 콘솔에서도 이 사진을 본다. 원문 바이트를 받으므로 JSON 파서를 끈다.
 */
export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });

  const productId = typeof req.query.productId === 'string' ? req.query.productId : '';
  if (!productId) return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않아요.' });

  let product: Awaited<ReturnType<typeof loadShopProductForAdmin>>;
  try {
    product = await loadShopProductForAdmin(productId);
  } catch (error: unknown) {
    console.error('[admin/shop/upload] 상품 조회 실패:', error);
    return res.status(500).json({ ok: false, message: '잠시 후 다시 시도해 주세요.' });
  }
  if (!product) return res.status(404).json({ ok: false, message: '상품을 찾을 수 없어요.' });
  if (!canAdminEditShopField(product.reviewStatus, 'images')) {
    return res.status(409).json({ ok: false, message: '지금 상태에서는 사진을 올릴 수 없어요.' });
  }
  if (product.images.length >= SHOP_CREATOR_LIMITS.imagesMax) {
    return res.status(400).json({ ok: false, message: `사진은 상품당 최대 ${SHOP_CREATOR_LIMITS.imagesMax}장까지 올릴 수 있어요.` });
  }

  const body = await readBodyWithLimit(req, UPLOAD_LIMITS.maxBytes);
  if (body === null) return res.status(413).json({ ok: false, message: '파일이 너무 커요.' });
  if (body.length === 0) return res.status(400).json({ ok: false, message: '파일이 비어 있어요.' });

  let processed: { buffer: Buffer; width: number; height: number };
  try {
    processed = await processCreatorImage(body, 'body');
  } catch (error: unknown) {
    console.error('[admin/shop/upload] 이미지 처리 실패:', error);
    return res.status(400).json({ ok: false, message: '이미지 파일이 아니에요.' });
  }

  const filename = `${product.creatorId}-${randomUUID()}.webp`;
  try {
    await put(`${FUNDING_MEDIA_PREFIX}${filename}`, processed.buffer, { access: 'private', contentType: 'image/webp' });
  } catch (error: unknown) {
    console.error('[admin/shop/upload] Blob 저장 실패:', error);
    return res.status(500).json({ ok: false, message: '이미지를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.' });
  }
  return res.status(200).json({ ok: true, url: buildFundingMediaUrl(filename, processed.width, processed.height) });
}
