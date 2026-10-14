/**
 * 상점이 쓰는 업로드 이미지(`/api/funding/media/…`)를 **인증 없이** 내보내도 되는지 판정한다.
 * 펀딩 판정(`lib/funding/mediaAccess.ts`)과 **별도 문장·별도 try**다 — 펀딩 쿼리에 OR로 붙이면 상점 표가 없는 DB에서
 * 펀딩 공개 이미지까지 404가 된다. 호출 쪽(`pages/api/funding/media/[...path].ts`)은 펀딩 판정이 false일 때만 이어서 본다.
 *
 * 공개 = 승인·공개 상품의 `images`에 든 파일, 그리고 **승인된 상품이 하나라도 있는** 아티스트의 프로필 사진.
 * 오류면 false(fail-closed) — 공개 사진 하나를 잃는 쪽이 심사 전 자료가 새는 쪽보다 낫다.
 */
import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { FUNDING_MEDIA_URL_PREFIX } from '../funding/mediaPath';

export const isApprovedShopMedia = async (filename: string): Promise<boolean> => {
  const needle = `${FUNDING_MEDIA_URL_PREFIX}${filename}`;
  try {
    const rows = await getDb().all<{ one: number }>(sql`
      select 1 as one from shop_products p
      where p.review_status = 'approved' and p.published = 1
        and instr(p.images, ${needle}) > 0
      union all
      select 1 as one from shop_artists a
      where instr(coalesce(a.profile_image_url, ''), ${needle}) > 0
        and exists (select 1 from shop_products p where p.creator_id = a.creator_id and p.review_status = 'approved')
      limit 1
    `);
    return rows.length > 0;
  } catch (error) {
    console.error('[shop/media] 공개 여부 조회 실패 — 비공개로 본다:', error);
    return false;
  }
};
