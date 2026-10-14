import { eq } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingCreators, shopArtists } from '../../db/schema';
import { getSupportedArtist } from '../../data/artists';

/**
 * 상점 아티스트 — 서버 전용. 로그인 계정 정본은 `funding_creators`(이름·소개·링크), 상점 공개 정체성(slug·등재·프로필 사진)은
 * `shop_artists`다. 이 표는 관리자만 만든다(PR 2). 새 표를 기존 relations()에 잇지 않으므로 select + join으로 읽는다.
 */

export interface ShopArtistRecord {
  creatorId: string;
  slug: string;
  /** data/artists와 같은 slug를 쓰도록 관리자가 연결을 확인했는가. */
  curatedSlugLinked: boolean;
  profileImageUrl: string | null;
  name: string;
  bio: string | null;
  links: string[];
}

const parseLinks = (raw: string | null): string[] => {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
};

const selectArtist = () =>
  getDb()
    .select({
      creatorId: shopArtists.creatorId,
      slug: shopArtists.slug,
      curatedSlugLinked: shopArtists.curatedSlugLinked,
      profileImageUrl: shopArtists.profileImageUrl,
      name: fundingCreators.name,
      bio: fundingCreators.bio,
      links: fundingCreators.links,
    })
    .from(shopArtists)
    .innerJoin(fundingCreators, eq(fundingCreators.id, shopArtists.creatorId));

type ArtistRow = Awaited<ReturnType<typeof selectArtist>>[number];

const toRecord = (r: ArtistRow): ShopArtistRecord => ({ ...r, links: parseLinks(r.links) });

export const getShopArtistBySlug = async (slug: string): Promise<ShopArtistRecord | null> => {
  const rows = await selectArtist().where(eq(shopArtists.slug, slug)).limit(1);
  return rows[0] ? toRecord(rows[0]) : null;
};

export const getShopArtistByCreator = async (creatorId: string): Promise<ShopArtistRecord | null> => {
  const rows = await selectArtist().where(eq(shopArtists.creatorId, creatorId)).limit(1);
  return rows[0] ? toRecord(rows[0]) : null;
};

/** 화면용 아티스트 — 이메일·연락처·세금 유형 등 공개하지 않을 값은 애초에 싣지 않는다. */
export interface ResolvedShopArtist {
  slug: string;
  name: string;
  bio: string | null;
  links: string[];
  image: string | null;
  source: 'file' | 'db';
}

/**
 * slug로 아티스트를 찾는다 — `data/artists`(후원 멤버십·큐레이션)가 먼저, 없으면 `shop_artists` + `funding_creators`.
 * DB 오류는 삼키고 null(공개 화면은 DB가 흔들려도 파일 아티스트로 열려 있어야 한다).
 */
export const resolveShopArtist = async (slug: string): Promise<ResolvedShopArtist | null> => {
  const curated = getSupportedArtist(slug);
  if (curated) {
    return { slug: curated.slug, name: curated.name, bio: curated.bio, links: Object.values(curated.links).filter((v): v is string => Boolean(v)), image: curated.image, source: 'file' };
  }
  try {
    const row = await getShopArtistBySlug(slug);
    if (!row) return null;
    return { slug: row.slug, name: row.name, bio: row.bio, links: row.links, image: row.profileImageUrl, source: 'db' };
  } catch (error: unknown) {
    console.error(`[shop] 아티스트 조회 실패(slug=${slug}) — 파일 기준으로만 응답합니다:`, error);
    return null;
  }
};
