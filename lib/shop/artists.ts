import { and, eq, ne, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingCreators, shopArtists, shopProducts } from '../../db/schema';
import { getSupportedArtist } from '../../data/artists';
import { CREATOR_LIMITS, isDefaultCreatorName } from '../funding/creatorValidation';
import { normalizeCreatorEmail } from '../funding/creatorToken';
import { OPERATOR_EMAIL } from '../operatorContact';
import { SHOP_RESERVED_SLUGS, SHOP_SLUG_PATTERN } from './catalog';
import { isStudioShopArtistSlug, STUDIO_SHOP_ARTIST_NAME, STUDIO_SHOP_ARTIST_SLUG } from './studioArtist';
import { isUniqueConstraintError } from '../dbErrors';

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
  /** http(s) 주소만. */
  links: string[];
  /** 프로필 사진 주소(없으면 null). */
  profileImage: string | null;
  /** 연결된 `data/artists` slug — `/ko/artists/<slug>` 페이지가 있을 때만. */
  curatedSlug: string | null;
  /** 서버 전용 — props로 내보내지 않는다. `data/artists`만 있는 아티스트는 null. */
  creatorId: string | null;
}

const httpLinks = (links: readonly string[]): string[] => links.filter((l) => /^https?:\/\//i.test(l));

/** 스튜디오 자체 상품 계정의 로그인 주소 — 운영자 받은편지함의 plus 주소(운영자 본인의 개설자 계정과 겹치지 않게). */
export const studioShopArtistEmail = (operatorEmail: string = OPERATOR_EMAIL): string => {
  const at = operatorEmail.lastIndexOf('@');
  return at < 1 ? operatorEmail : `${operatorEmail.slice(0, at).split('+')[0]}+${STUDIO_SHOP_ARTIST_SLUG}${operatorEmail.slice(at)}`.toLowerCase();
};

/**
 * 스튜디오 상품 계정을 돌려준다 — 없으면 만든다(`funding_creators` + `shop_artists`). 여러 번·동시에 불러도 한 벌이다.
 * 관리자 쓰기 경로에서만 부른다(공개 읽기는 이 계정을 만들지 않는다).
 */
export const ensureStudioShopArtist = async (): Promise<{ creatorId: string; created: boolean }> => {
  const db = getDb();
  const find = async () => (await db.select({ creatorId: shopArtists.creatorId }).from(shopArtists).where(eq(shopArtists.slug, STUDIO_SHOP_ARTIST_SLUG)).limit(1))[0];
  const existing = await find();
  if (existing) return { creatorId: existing.creatorId, created: false };

  const email = studioShopArtistEmail();
  await db.insert(fundingCreators).values({ email, name: STUDIO_SHOP_ARTIST_NAME }).onConflictDoNothing({ target: fundingCreators.email });
  const [creator] = await db.select({ id: fundingCreators.id, name: fundingCreators.name }).from(fundingCreators).where(eq(fundingCreators.email, email)).limit(1);
  if (!creator) throw new Error('스튜디오 상품 계정을 만들지 못했습니다.');
  if (isDefaultCreatorName(creator.name, email) && creator.name !== STUDIO_SHOP_ARTIST_NAME) {
    await db.update(fundingCreators).set({ name: STUDIO_SHOP_ARTIST_NAME, updatedAt: new Date() }).where(eq(fundingCreators.id, creator.id));
  }
  // 동시에 두 요청이 들어오면 한쪽의 INSERT가 PK/slug 충돌로 던진다 — 던진 쪽은 이긴 쪽의 행을 읽는다.
  try {
    await db.insert(shopArtists).values({ creatorId: creator.id, slug: STUDIO_SHOP_ARTIST_SLUG, curatedSlugLinked: false });
  } catch (error: unknown) {
    const raced = await find();
    if (!raced) throw error;
    return { creatorId: raced.creatorId, created: false };
  }
  return { creatorId: creator.id, created: true };
};

/**
 * slug로 아티스트를 찾는다 — `data/artists`(후원 멤버십·큐레이션)가 먼저, 없으면 `shop_artists` + `funding_creators`.
 * DB 오류는 삼키고 null(공개 화면은 DB가 흔들려도 파일 아티스트로 열려 있어야 한다).
 */
export const resolveShopArtist = async (slug: string): Promise<ResolvedShopArtist | null> => {
  // 스튜디오 자체 상품 계정은 공개 아티스트가 아니다 — 아티스트 페이지·링크가 열리지 않는다.
  if (isStudioShopArtistSlug(slug)) return null;
  const curated = getSupportedArtist(slug);
  if (curated) {
    return {
      slug: curated.slug, name: curated.name, bio: curated.bio,
      links: httpLinks(Object.values(curated.links).filter((v): v is string => Boolean(v))),
      profileImage: curated.image, curatedSlug: curated.slug, creatorId: null,
    };
  }
  try {
    const row = await getShopArtistBySlug(slug);
    if (!row) return null;
    return {
      slug: row.slug, name: row.name, bio: row.bio, links: httpLinks(row.links), profileImage: row.profileImageUrl,
      curatedSlug: row.curatedSlugLinked && getSupportedArtist(row.slug) ? row.slug : null,
      creatorId: row.creatorId,
    };
  } catch (error: unknown) {
    console.error(`[shop] 아티스트 조회 실패(slug=${slug}) — 파일 기준으로만 응답합니다:`, error);
    return null;
  }
};

/** slug → 그 아티스트의 `shop_artists.creator_id`. 없으면 null. 오류는 던진다(호출부가 삼킨다). */
export const findShopArtistCreatorId = async (slug: string): Promise<string | null> => {
  const rows = await getDb().select({ creatorId: shopArtists.creatorId }).from(shopArtists).where(eq(shopArtists.slug, slug)).limit(1);
  return rows[0]?.creatorId ?? null;
};

/** DB 상품 slug → 그 상품을 올린 아티스트의 공개 정체성(slug·이름). 상점 등재가 없으면 null. 오류는 던진다. */
export const findShopArtistOfDbProduct = async (productSlug: string): Promise<{ slug: string; name: string } | null> => {
  const rows = await getDb()
    .select({ slug: shopArtists.slug, name: fundingCreators.name })
    .from(shopProducts)
    .innerJoin(shopArtists, eq(shopArtists.creatorId, shopProducts.creatorId))
    .innerJoin(fundingCreators, eq(fundingCreators.id, shopArtists.creatorId))
    .where(and(
      eq(shopProducts.slug, productSlug), eq(shopProducts.reviewStatus, 'approved'), eq(shopProducts.published, true),
      ne(shopArtists.slug, STUDIO_SHOP_ARTIST_SLUG),
    ))
    .limit(1);
  return rows[0] ?? null;
};

// ── 관리자: 등재 ──────────────────────────────────────────────────────────────

export const SHOP_ARTIST_SLUG_MAX = 40;

export type ShopArtistWriteResult =
  | { ok: true; creatorId: string }
  | { ok: false; code: 'invalid' | 'curated_not_linked' | 'slug_taken' | 'already_registered' | 'locked' | 'not_found'; message: string };

const deny = (code: Exclude<ShopArtistWriteResult, { ok: true }>['code'], message: string): ShopArtistWriteResult => ({ ok: false, code, message });

/** slug 형식·예약어·큐레이션 연결 확인. 문제가 있으면 거부 결과를 돌려준다. */
const checkSlug = (slug: string, linkCurated: boolean): ShopArtistWriteResult | null => {
  if (!slug || slug.length > SHOP_ARTIST_SLUG_MAX || !SHOP_SLUG_PATTERN.test(slug)) {
    return deny('invalid', `주소는 소문자·숫자·하이픈으로 ${SHOP_ARTIST_SLUG_MAX}자 이내로 적어 주세요.`);
  }
  if ((SHOP_RESERVED_SLUGS as readonly string[]).includes(slug) || isStudioShopArtistSlug(slug)) return deny('invalid', '쓸 수 없는 주소예요.');
  if (getSupportedArtist(slug) && !linkCurated) {
    return deny('curated_not_linked', '이 주소는 후원 아티스트 페이지와 같아요. 같은 사람이 맞으면 확인란을 체크해 주세요.');
  }
  return null;
};


/**
 * 아티스트 등재 — 이메일로 `funding_creators`를 찾거나 만들고 `shop_artists` 행을 만든다.
 * 이메일 정규화는 로그인(`creatorToken`)과 같다. 이미 있는 계정의 이름은 건드리지 않는다(기본 이름일 때만 채운다).
 */
export const createShopArtist = async (input: {
  email: string; name: string; slug: string; linkCurated: boolean;
}): Promise<ShopArtistWriteResult> => {
  const email = normalizeCreatorEmail(input.email);
  if (!email) return deny('invalid', '이메일을 확인해 주세요.');
  const name = input.name.trim();
  if (!name || name.length > CREATOR_LIMITS.nameMax) return deny('invalid', `이름은 1~${CREATOR_LIMITS.nameMax}자로 적어 주세요.`);
  const slug = input.slug.trim();
  const slugProblem = checkSlug(slug, input.linkCurated);
  if (slugProblem) return slugProblem;

  const db = getDb();
  const taken = await db.select({ creatorId: shopArtists.creatorId }).from(shopArtists).where(eq(shopArtists.slug, slug)).limit(1);
  if (taken[0]) return deny('slug_taken', '이미 쓰는 주소예요.');

  await db.insert(fundingCreators).values({ email, name }).onConflictDoNothing({ target: fundingCreators.email });
  const [creator] = await db.select({ id: fundingCreators.id, name: fundingCreators.name }).from(fundingCreators).where(eq(fundingCreators.email, email)).limit(1);
  if (!creator) return deny('not_found', '계정을 만들지 못했어요.');
  const existing = await db.select({ creatorId: shopArtists.creatorId }).from(shopArtists).where(eq(shopArtists.creatorId, creator.id)).limit(1);
  if (existing[0]) return deny('already_registered', '이미 등재된 아티스트예요.');
  if (isDefaultCreatorName(creator.name, email) && creator.name !== name) {
    await db.update(fundingCreators).set({ name, updatedAt: new Date() }).where(eq(fundingCreators.id, creator.id));
  }

  try {
    await db.insert(shopArtists).values({ creatorId: creator.id, slug, curatedSlugLinked: Boolean(getSupportedArtist(slug)) && input.linkCurated });
  } catch (error: unknown) {
    if (isUniqueConstraintError(error, 'shop_artists.slug')) return deny('slug_taken', '이미 쓰는 주소예요.');
    throw error;
  }
  return { ok: true, creatorId: creator.id };
};

/** 그 아티스트의 승인된 상품이 하나라도 있는가 — slug 잠금 판정. */
export const hasApprovedShopProduct = async (creatorId: string): Promise<boolean> => {
  const rows = await getDb().select({ id: shopProducts.id }).from(shopProducts)
    .where(and(eq(shopProducts.creatorId, creatorId), eq(shopProducts.reviewStatus, 'approved'))).limit(1);
  return rows.length > 0;
};

/** slug 변경 — 승인된 상품이 있으면 거부(주소가 이미 퍼졌다). */
export const updateShopArtistSlug = async (input: { creatorId: string; slug: string; linkCurated: boolean }): Promise<ShopArtistWriteResult> => {
  const slug = input.slug.trim();
  const slugProblem = checkSlug(slug, input.linkCurated);
  if (slugProblem) return slugProblem;
  const db = getDb();
  const current = await db.select({ slug: shopArtists.slug }).from(shopArtists).where(eq(shopArtists.creatorId, input.creatorId)).limit(1);
  if (!current[0]) return deny('not_found', '등재된 아티스트가 아니에요.');
  if (isStudioShopArtistSlug(current[0].slug)) return deny('locked', '스튜디오 상품 계정의 주소는 바꿀 수 없어요.');
  if (await hasApprovedShopProduct(input.creatorId)) return deny('locked', '승인된 상품이 있어 주소를 바꿀 수 없어요.');
  try {
    await db.update(shopArtists)
      .set({ slug, curatedSlugLinked: Boolean(getSupportedArtist(slug)) && input.linkCurated, updatedAt: sql`(unixepoch())` })
      .where(eq(shopArtists.creatorId, input.creatorId));
  } catch (error: unknown) {
    if (isUniqueConstraintError(error, 'shop_artists.slug')) return deny('slug_taken', '이미 쓰는 주소예요.');
    throw error;
  }
  return { ok: true, creatorId: input.creatorId };
};

export interface AdminShopArtistRow {
  creatorId: string;
  email: string;
  name: string;
  slug: string;
  curatedSlugLinked: boolean;
  approvedProducts: number;
  createdAt: number;
}

export const listShopArtistsForAdmin = async (): Promise<AdminShopArtistRow[]> => {
  const db = getDb();
  const rows = await db
    .select({
      creatorId: shopArtists.creatorId, email: fundingCreators.email, name: fundingCreators.name, slug: shopArtists.slug,
      curatedSlugLinked: shopArtists.curatedSlugLinked, createdAt: shopArtists.createdAt,
    })
    .from(shopArtists).innerJoin(fundingCreators, eq(fundingCreators.id, shopArtists.creatorId))
    .orderBy(shopArtists.createdAt);
  const counts = await db
    .select({ creatorId: shopProducts.creatorId, n: sql<number>`count(*)` })
    .from(shopProducts).where(eq(shopProducts.reviewStatus, 'approved')).groupBy(shopProducts.creatorId);
  const byCreator = new Map(counts.map((c) => [c.creatorId, Number(c.n)]));
  return rows.map((r) => ({ ...r, approvedProducts: byCreator.get(r.creatorId) ?? 0 }));
};

/** 프로필 사진 주소 저장. 행이 없으면 false. */
export const setShopArtistProfileImage = async (creatorId: string, url: string | null): Promise<boolean> => {
  const res = await getDb().update(shopArtists)
    .set({ profileImageUrl: url, updatedAt: sql`(unixepoch())` })
    .where(eq(shopArtists.creatorId, creatorId));
  return (res.rowsAffected ?? 0) > 0;
};

/** 공개 DB 상품이 하나라도 있는 아티스트 slug(사이트맵용 후보). 오류는 던진다(호출부가 삼킨다). */
export const listShopArtistSlugsWithDbProducts = async (): Promise<string[]> => {
  const rows = await getDb()
    .selectDistinct({ slug: shopArtists.slug })
    .from(shopProducts)
    .innerJoin(shopArtists, eq(shopArtists.creatorId, shopProducts.creatorId))
    .where(and(eq(shopProducts.reviewStatus, 'approved'), eq(shopProducts.published, true), ne(shopArtists.slug, STUDIO_SHOP_ARTIST_SLUG)));
  return rows.map((r) => r.slug);
};
