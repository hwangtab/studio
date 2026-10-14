import type { NextApiResponse } from 'next';

import { getSupportedArtist } from '../../data/artists';
import { getDb } from '../../db/client';
import { shopArtists } from '../../db/schema';
import { eq } from 'drizzle-orm';

/**
 * 승인·공개 토글 뒤 `/ko/artists/<slug>`(ISR 하루)의 상품 그리드를 다시 만든다 — 그 아티스트가 `data/artists`와 연결돼 있을 때만.
 * 상점 쪽 페이지(`/ko/shop/**`)는 SSR(`s-maxage=30`)이라 재검증이 필요 없다. 실패는 판정을 실패시키지 않고 문자열로 돌려준다(warnings).
 */
export const revalidateShopArtistPages = async (
  res: Pick<NextApiResponse, 'revalidate'>,
  creatorId: string,
): Promise<string | null> => {
  let slug: string | null = null;
  try {
    const [row] = await getDb().select({ slug: shopArtists.slug, linked: shopArtists.curatedSlugLinked })
      .from(shopArtists).where(eq(shopArtists.creatorId, creatorId)).limit(1);
    if (row?.linked && getSupportedArtist(row.slug)) slug = row.slug;
  } catch (error: unknown) {
    console.error('[shop] 재검증 대상 아티스트 조회 실패:', error);
    return '재검증 대상을 확인하지 못했어요. 아티스트 페이지는 최대 하루 뒤 갱신돼요.';
  }
  if (!slug) return null;
  const path = `/ko/artists/${slug}`;
  try {
    await res.revalidate(path);
    return null;
  } catch (error: unknown) {
    console.error(`[shop] 재검증 실패 — ${path}:`, error);
    return `재검증 실패: ${path}`;
  }
};
