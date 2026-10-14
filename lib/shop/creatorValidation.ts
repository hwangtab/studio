import { isOwnUploadedMedia } from '../funding/creatorValidation';
import { SHOP_RESERVED_SLUGS, SHOP_SLUG_PATTERN } from './catalog';
import { DB_SKU_ID_PATTERN, DRAFT_SLUG_PREFIX, SHOP_CREATOR_LIMITS as L } from './productRules';

/**
 * 아티스트 상품 입력 검증 — 순수 모듈(DB·서버 의존 없음). 설계 `docs/shop-artist-platform-design-2026-10.md` §4.
 *
 * 여기는 **모양**만 본다(길이·형식·정수·상한). 상태별로 어느 칸이 잠겼는지는 `creatorProductWrite.ts`가 `productRules.ts`
 * 표로 판정하고, 제출·승인에 필요한 "다 채워졌는가"는 아래 `findMissingShopProductFields`가 본다 — 임시 저장은 빈 칸을 허용한다.
 */

export interface ShopSkuInput {
  /** 이미 있는 SKU면 그 id(서버가 만든 `db-…`). 새 행이면 없다 — id는 서버가 만든다. */
  id?: string;
  optionLabel: string | null;
  price: number;
  /** 판매 종료. */
  retired: boolean;
}

export interface ShopProductInput {
  title: string;
  subtitle: string | null;
  /** 빈 줄로 나눈 문단. */
  description: string;
  images: string[];
  category: 'album' | 'goods';
  kind: 'physical' | 'digital';
  /** 소문자로 정규화한 주소. 빈 문자열이면 "아직 안 정했다"(저장된 임시 주소를 유지한다). */
  slug: string;
  /** YYYY-MM-DD(KST). */
  shipsOn: string | null;
  editionSize: number | null;
  skus: ShopSkuInput[];
}

type Result<T> = { ok: true; value: T } | { ok: false; message: string };
const fail = (message: string): { ok: false; message: string } => ({ ok: false, message });

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** 줄바꿈을 `\n`으로 맞추고, 문단 사이 빈 줄은 하나로, 앞뒤 공백은 지운다. */
export const normalizeShopDescription = (raw: string): string =>
  raw.replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/[ \t]+$/g, '')).join('\n').replace(/\n{3,}/g, '\n\n').trim();

/** 빈 줄로 나눈 문단 배열. */
export const splitShopDescription = (description: string): string[] =>
  description.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

/** 주소 규칙: 소문자·숫자·하이픈, 3~60자, 예약어·임시 접두사 금지. 통과하면 null. */
export const shopSlugRejection = (slug: string): string | null => {
  if (slug.length < L.slugMin || slug.length > L.slugMax || !SHOP_SLUG_PATTERN.test(slug)) {
    return `주소는 영문 소문자·숫자·하이픈만 쓸 수 있고 ${L.slugMin}~${L.slugMax}자여야 해요.`;
  }
  if ((SHOP_RESERVED_SLUGS as readonly string[]).includes(slug)) return '쓸 수 없는 주소예요. 다른 주소를 적어 주세요.';
  if (slug.startsWith(DRAFT_SLUG_PREFIX)) return `주소는 ${DRAFT_SLUG_PREFIX}로 시작할 수 없어요.`;
  return null;
};

/** 달력에 있는 YYYY-MM-DD인가. */
export const isValidDateOnly = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
};

/** 가격 규칙: 정수, 1,000원~1,000,000원, 10원 단위. 통과하면 null. */
export const shopPriceRejection = (price: unknown): string | null => {
  if (typeof price !== 'number' || !Number.isInteger(price)) return '가격은 정수(원)로 적어 주세요.';
  if (price < L.priceMin || price > L.priceMax) {
    return `가격은 ${L.priceMin.toLocaleString('ko-KR')}원~${L.priceMax.toLocaleString('ko-KR')}원이어야 해요.`;
  }
  if (price % L.priceStep !== 0) return `가격은 ${L.priceStep}원 단위로 적어 주세요.`;
  return null;
};

const validateSkus = (raw: unknown): Result<ShopSkuInput[]> => {
  if (!Array.isArray(raw)) return fail('옵션 형식이 올바르지 않아요.');
  if (raw.length > L.skusMax) return fail(`옵션은 최대 ${L.skusMax}개까지 만들 수 있어요.`);
  const out: ShopSkuInput[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!isRecord(item)) return fail('옵션 형식이 올바르지 않아요.');
    let id: string | undefined;
    if (item.id !== undefined && item.id !== null && item.id !== '') {
      if (typeof item.id !== 'string' || !DB_SKU_ID_PATTERN.test(item.id)) return fail('옵션 정보가 올바르지 않아요. 새로고침해 주세요.');
      if (seen.has(item.id)) return fail('같은 옵션이 두 번 들어 있어요.');
      seen.add(item.id);
      id = item.id;
    }
    const label = typeof item.optionLabel === 'string' ? item.optionLabel.trim() : '';
    if (item.optionLabel !== undefined && item.optionLabel !== null && typeof item.optionLabel !== 'string') return fail('옵션 이름 형식이 올바르지 않아요.');
    if (label.length > L.optionLabelMax) return fail(`옵션 이름은 ${L.optionLabelMax}자 이내로 적어 주세요.`);
    const priceProblem = shopPriceRejection(item.price);
    if (priceProblem) return fail(priceProblem);
    if (item.retired !== undefined && typeof item.retired !== 'boolean') return fail('옵션 정보가 올바르지 않아요.');
    out.push({ ...(id ? { id } : {}), optionLabel: label || null, price: item.price as number, retired: item.retired === true });
  }
  return { ok: true, value: out };
};

/**
 * 상품 입력 전체 검증. `media.existing`에 저장돼 있는 사진 주소를 넘기면 그대로 다시 온 값은 통과시킨다
 * (개설자 id를 키에 넣기 전 업로드가 저장 한 번으로 거부되지 않게 — `isOwnUploadedMedia`와 같은 이유).
 */
export const validateShopProductInput = (
  raw: unknown,
  media: { creatorId: string; existing?: readonly string[] },
): Result<ShopProductInput> => {
  if (!isRecord(raw)) return fail('요청 형식이 올바르지 않아요.');

  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title) return fail('제목을 적어 주세요.');
  if (title.length > L.titleMax) return fail(`제목은 ${L.titleMax}자 이내로 적어 주세요.`);

  const subtitleRaw = typeof raw.subtitle === 'string' ? raw.subtitle.trim() : '';
  if (subtitleRaw.length > L.subtitleMax) return fail(`부제는 ${L.subtitleMax}자 이내로 적어 주세요.`);

  if (typeof raw.description !== 'string' && raw.description !== undefined) return fail('소개 형식이 올바르지 않아요.');
  const description = normalizeShopDescription(typeof raw.description === 'string' ? raw.description : '');
  if (description.length > L.descriptionMax) return fail(`소개는 ${L.descriptionMax}자 이내로 적어 주세요.`);
  const firstParagraph = splitShopDescription(description)[0];
  // 첫 문단은 검색 요약·공유 카드 설명으로 나간다 — 평문이어야 한다(validateShopCatalog와 같은 규칙).
  if (firstParagraph && /^(##|>)/.test(firstParagraph)) return fail('소개의 첫 문단은 일반 문장으로 시작해 주세요.');

  if (raw.category !== 'album' && raw.category !== 'goods') return fail('분류를 골라 주세요.');
  if (raw.kind !== 'physical' && raw.kind !== 'digital') return fail('종류를 골라 주세요.');

  const slug = typeof raw.slug === 'string' ? raw.slug.trim().toLowerCase() : '';
  if (slug) {
    const problem = shopSlugRejection(slug);
    if (problem) return fail(problem);
  }

  if (!Array.isArray(raw.images)) return fail('사진 형식이 올바르지 않아요.');
  if (raw.images.length > L.imagesMax) return fail(`사진은 최대 ${L.imagesMax}장까지 올릴 수 있어요.`);
  const images: string[] = [];
  for (const img of raw.images) {
    if (typeof img !== 'string' || !isOwnUploadedMedia(img, { creatorId: media.creatorId, existing: media.existing })) {
      return fail('사진을 다시 올려 주세요.');
    }
    if (images.includes(img)) return fail('같은 사진이 두 번 들어 있어요.');
    images.push(img);
  }

  let shipsOn: string | null = null;
  if (raw.shipsOn !== undefined && raw.shipsOn !== null && raw.shipsOn !== '') {
    if (typeof raw.shipsOn !== 'string' || !isValidDateOnly(raw.shipsOn)) return fail('발송 예정일을 날짜로 적어 주세요.');
    shipsOn = raw.shipsOn;
  }

  let editionSize: number | null = null;
  if (raw.editionSize !== undefined && raw.editionSize !== null && raw.editionSize !== '') {
    if (typeof raw.editionSize !== 'number' || !Number.isInteger(raw.editionSize) || raw.editionSize < 1 || raw.editionSize > L.editionSizeMax) {
      return fail(`한정 수량은 1~${L.editionSizeMax.toLocaleString('ko-KR')} 사이 정수로 적어 주세요.`);
    }
    editionSize = raw.editionSize;
  }

  const skus = validateSkus(raw.skus);
  if (!skus.ok) return skus;

  return {
    ok: true,
    value: {
      title, subtitle: subtitleRaw || null, description, images, category: raw.category, kind: raw.kind,
      slug, shipsOn, editionSize, skus: skus.value,
    },
  };
};

/** 제출·승인이 함께 보는 "다 채워졌는가" 입력. */
export interface ShopProductCompletenessInput {
  title: string;
  slug: string;
  description: string;
  images: readonly string[];
  skus: ReadonlyArray<{ optionLabel: string | null; retired: boolean }>;
  creatorName: string;
  creatorEmail: string;
}

/**
 * 비어 있는 필수 항목 이름 목록(비면 통과). 개설자 제출과 운영자 승인이 같은 정의를 쓴다 — 각자 조건문을 쓰면
 * "제출은 통과했는데 승인 때 불완전"이 갈라진다(`findMissingRequiredSections`와 같은 이유).
 * 이름 기본값(이메일 앞부분) 판정은 호출부가 `isDefaultCreatorName`으로 한 결과를 `creatorNameSet`으로 넘긴다.
 */
export const findMissingShopProductFields = (p: ShopProductCompletenessInput, creatorNameSet: boolean): string[] => {
  const missing: string[] = [];
  if (!p.title.trim()) missing.push('제목');
  if (!p.slug || p.slug.startsWith(DRAFT_SLUG_PREFIX) || shopSlugRejection(p.slug)) missing.push('주소');
  if (splitShopDescription(p.description).length === 0) missing.push('소개');
  if (p.images.length === 0) missing.push('사진');
  const sellable = p.skus.filter((s) => !s.retired);
  if (sellable.length === 0) missing.push('옵션(가격)');
  else if (sellable.length > 1 && sellable.some((s) => !s.optionLabel?.trim())) missing.push('옵션 이름');
  if (!creatorNameSet) missing.push('아티스트 이름(내 상점에서 정해 주세요)');
  return missing;
};
