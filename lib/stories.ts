import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { extractFirstImageUrl } from '../utils/localDataUtils';
import { summarizeText, stripMarkdown } from '../utils/textUtils';
import type { Story, StoryCTAOverride, StoryDetail, StoryPath } from '../types/story';
import { STORY_CTA_OVERRIDES } from '../types/story';
import { locales, defaultLocale, type Locale } from './i18n';
import { loadCommonResourceServer } from './i18n.server';
import { isRegionHub } from './regionHubSlugs';
import regionRedirectMap from './regionRedirectMap.json';
import { parseInlineDirectives, decideAutoFallback, type AutoFallbackDecision } from './inlineDirectives';
import {
  matchPricingForCategory,
  matchReviewForCategory,
  injectAutoFallbackMarker,
} from './storyAutoFallback';

// next.config.mjs의 redirects()로 308 처리되는 슬러그. 빌드·listing에서 모두 제외.
const REDIRECTED_SLUGS = new Set<string>(Object.keys(regionRedirectMap));

const storiesDirectory: string = path.join(process.cwd(), 'content/stories');
const enableCache = process.env.NODE_ENV === 'production';
const storySlugsCache: { value: string[] | null } = { value: null };
const storyPathsCache: { value: StoryPath[] | null } = { value: null };
const storyFileResolutionCache = new Map<string, { filePath: string; sourceLocale: Locale }>();
const parsedStoryFileCache = new Map<string, { data: Record<string, unknown>; content: string }>();
const storyCategoryLabelCache = new Map<string, string>();
const allStoriesCache = new Map<Locale, Story[]>();
const storyDetailCache = new Map<string, StoryDetail>();

const storyAvailableLocalesCache = new Map<string, Locale[]>();

/**
 * AutoFallbackDecision을 inline marker 문자열로 변환.
 * Helper로 추출하여 switch exhaustiveness를 컴파일러가 보장 (return-only).
 */
const buildAutoFallbackMarker = (fb: AutoFallbackDecision): string => {
  switch (fb.type) {
    case 'price':
    case 'review':
      return `%%${fb.type}:${fb.id}%%`;
    case 'booking':
      return `%%booking:${fb.message}%%`;
  }
};

// 한 슬러그의 native 번역 locale을 thin/noindex 필터까지 적용해 반환한다.
// 파일 존재만 보면 sitemap exclude(thin gate 통과)와 HTML hreflang(파일 존재만 봄) 정책이
// 어긋나 dangling alternate가 생긴다(예: bulgwang-mixing-club-2nd ko가 thin이라
// sitemap에서 빠졌는데 외국어 파일들이 ko alternate를 가리킴). 여기서 동일 정책을 적용해
// 양방향성을 맞춘다.
export const getStoryAvailableLocales = (slug: string): Locale[] => {
  if (enableCache) {
    const cached = storyAvailableLocalesCache.get(slug);
    if (cached) return cached;
  }

  const isLocaleIndexable = (locale: Locale): boolean => {
    const filePath = locale === defaultLocale
      ? path.join(storiesDirectory, `${slug}.md`)
      : path.join(storiesDirectory, `${slug}.${locale}.md`);
    if (!fs.existsSync(filePath)) return false;
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const fm = matter(raw);
      // robots: noindex 명시 → 색인 제외 → hreflang에서도 제외
      if (typeof fm.data.robots === 'string' && /noindex/i.test(fm.data.robots)) return false;
      // thin gate (AUTO-EXPAND 블록 제거 후 분량) — sitemap thinContent.js와 동일 로직
      const { stripped } = extractAutoExpandBlock(fm.content);
      const { isThinContent } = computeThinContentStatus(stripped, slug);
      return !isThinContent;
    } catch {
      return false;
    }
  };

  const available: Locale[] = [];
  for (const locale of locales) {
    if (isLocaleIndexable(locale)) available.push(locale);
  }
  if (enableCache) storyAvailableLocalesCache.set(slug, available);
  return available;
};

const resolveStoryFile = (slug: string, locale: Locale = defaultLocale): { filePath: string; sourceLocale: Locale } => {
  const cacheKey = `${locale}:${slug}`;
  if (enableCache) {
    const cached = storyFileResolutionCache.get(cacheKey);
    if (cached) return cached;
  }

  let resolved: { filePath: string; sourceLocale: Locale };

  const localeFilePath = path.join(storiesDirectory, `${slug}.${locale}.md`);
  if (fs.existsSync(localeFilePath)) {
    resolved = { filePath: localeFilePath, sourceLocale: locale };
    if (enableCache) {
      storyFileResolutionCache.set(cacheKey, resolved);
    }
    return resolved;
  }

  if (locale !== defaultLocale) {
    // Priority 1: 영어 fallback (lingua franca — 외국인 사용자가 가장 무난하게 읽음)
    const englishFallbackPath = path.join(storiesDirectory, `${slug}.en.md`);
    if (fs.existsSync(englishFallbackPath)) {
      resolved = { filePath: englishFallbackPath, sourceLocale: 'en' };
      if (enableCache) {
        storyFileResolutionCache.set(cacheKey, resolved);
      }
      return resolved;
    }
    // Priority 2: 그 외 native locale 중 존재하는 첫 번째 (locales 순서 따름)
    // ko 원본도 en도 없는 native(예: zh-only 가이드)가 다른 locale 라우트에서
    // dangling 404로 떨어지지 않도록 fallback chain 확장. sourceLocale 기반 canonical
    // fix(pages/[locale]/stories/[id].tsx:209)와 함께 동작해 noindex + canonical →
    // sourceLocale URL로 정합화.
    for (const fb of locales) {
      if (fb === locale || fb === defaultLocale || fb === 'en') continue;
      const fbPath = path.join(storiesDirectory, `${slug}.${fb}.md`);
      if (fs.existsSync(fbPath)) {
        resolved = { filePath: fbPath, sourceLocale: fb };
        if (enableCache) {
          storyFileResolutionCache.set(cacheKey, resolved);
        }
        return resolved;
      }
    }
  }

  resolved = { filePath: path.join(storiesDirectory, `${slug}.md`), sourceLocale: defaultLocale };
  if (enableCache) {
    storyFileResolutionCache.set(cacheKey, resolved);
  }
  return resolved;
};

// AUTO-EXPAND-V1 블록은 지역 가이드 페이지 등에 자동 삽입된 보일러플레이트 섹션이다.
// 본문에 그대로 포함되면 도시명만 치환된 동일 텍스트가 1,400+개 페이지에 중복되어
// Google "doorway page" 신호가 된다. 본문에서 분리해 별도 영역으로 노출하면
// (1) thin-content 게이트가 정상 동작하고 (2) Googlebot이 사이트 boilerplate로 인식한다.
// next-sitemap.config.js의 isStoryThin과 sentinel 형식이 동기화되어야 한다.
const AUTO_EXPAND_BLOCK_REGEX = /<!--\s*AUTO-EXPAND-V1\s*-->[\s\S]*?<!--\s*\/AUTO-EXPAND-V1\s*-->/g;

export const extractAutoExpandBlock = (source: string): { stripped: string; block: string | null } => {
  if (!source || !source.includes('AUTO-EXPAND-V1')) {
    return { stripped: source, block: null };
  }
  const matches = source.match(AUTO_EXPAND_BLOCK_REGEX);
  if (!matches || matches.length === 0) {
    return { stripped: source, block: null };
  }
  const block = matches
    .map((m) => m.replace(/^<!--\s*AUTO-EXPAND-V1\s*-->\s*/, '').replace(/\s*<!--\s*\/AUTO-EXPAND-V1\s*-->$/, ''))
    .join('\n\n')
    .trim();
  const stripped = source.replace(AUTO_EXPAND_BLOCK_REGEX, '').replace(/\n{3,}/g, '\n\n');
  return { stripped, block: block.length > 0 ? block : null };
};

/**
 * AUTO-EXPAND 보일러플레이트 분리 후 본문 분량(글자 수 + 쇼트코드 보너스)으로
 * thin-content 여부를 판정한다. next-sitemap.config.js의 isStoryThin과 동일한
 * 임계·로직을 공유하며, 광역 허브는 사이트 정보 구조상 색인이 필요해 제외.
 *
 * @param contentAfterAutoExpandStrip AUTO-EXPAND 블록을 분리한 본문 (extractAutoExpandBlock의 stripped)
 * @param slug 광역 허브 게이트 적용을 위한 슬러그
 */
export const THIN_CONTENT_THRESHOLD = 1500;
export const SHORTCODE_CHAR_ESTIMATES: Record<string, number> = {
  'online-fallback': 120,
  'session-checklist': 420,
};
export const SHORTCODE_DEFAULT_CHAR_ESTIMATE = 80;

export const computeThinContentStatus = (
  contentAfterAutoExpandStrip: string,
  slug: string,
): { isThinContent: boolean; charCount: number } => {
  const shortcodeBonus = [...contentAfterAutoExpandStrip.matchAll(/%%([a-z-]+)%%/g)]
    .reduce((sum, m) => sum + (SHORTCODE_CHAR_ESTIMATES[m[1]] ?? SHORTCODE_DEFAULT_CHAR_ESTIMATE), 0);
  const rawNonWhitespace = contentAfterAutoExpandStrip.replace(/\s+/g, '').length;
  const charCount = rawNonWhitespace + shortcodeBonus;
  const isThinContent = !isRegionHub(slug) && charCount < THIN_CONTENT_THRESHOLD;
  return { isThinContent, charCount };
};

const stripCodeFenceWrapper = (source: string): string => {
  if (!source) return '';
  const trimmed = source.trimStart();
  if (!trimmed.startsWith('```')) {
    return source;
  }

  const lines = trimmed.split(/\r?\n/);
  const opening = lines[0].trim();
  if (!opening.startsWith('```')) {
    return source;
  }

  let closingIndex = lines.length - 1;
  while (closingIndex > 0 && !lines[closingIndex].trim().startsWith('```')) {
    closingIndex -= 1;
  }

  if (closingIndex <= 0) {
    return source;
  }

  return lines.slice(1, closingIndex).join('\n');
};

const getAllStorySlugs = (): string[] => {
  if (enableCache && storySlugsCache.value) {
    return storySlugsCache.value;
  }

  if (!fs.existsSync(storiesDirectory)) {
    if (enableCache) {
      storySlugsCache.value = [];
      return storySlugsCache.value;
    }
    return [];
  }

  const files = fs.readdirSync(storiesDirectory);
  const slugs = new Set<string>();

  files.forEach((file) => {
    if (file.endsWith('.md')) {
      let name = file.replace(/\.md$/, '');
      locales.forEach((locale) => {
        if (name.endsWith(`.${locale}`)) {
          name = name.replace(new RegExp(`\\.${locale}$`), '');
        }
      });
      // 308 redirect 대상 슬러그는 페이지를 생성하지 않는다 (next.config.mjs가 처리).
      if (REDIRECTED_SLUGS.has(name)) return;
      slugs.add(name);
    }
  });

  const parsedSlugs = Array.from(slugs);
  if (enableCache) {
    storySlugsCache.value = parsedSlugs;
  }
  return parsedSlugs;
};

const normalizeDate = (value: string | Date | undefined): string => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
};

// 카테고리 키 단일 소스는 fs 의존성을 갖지 않는 lib/storyCategories.ts에 있다 —
// 페이지(client bundle)에서도 안전하게 import 가능. 여기선 server-only 사용처를
// 위해 re-export한다.
export {
  STORY_CATEGORY_KEYS,
  type StoryCategoryKey,
  normalizeStoryCategoryKey,
} from './storyCategories';
import { normalizeStoryCategoryKey } from './storyCategories';

const getStoryCategoryLabel = (categoryKey: string, locale: Locale): string => {
  const cacheKey = `${locale}:${categoryKey}`;
  if (enableCache) {
    const cached = storyCategoryLabelCache.get(cacheKey);
    if (cached) return cached;
  }

  const localeCommon = loadCommonResourceServer(locale);
  const fallbackCommon = loadCommonResourceServer(defaultLocale);
  const localizedCategories = (localeCommon?.stories as Record<string, Record<string, string>> | undefined)?.categories;
  const fallbackCategories = (fallbackCommon?.stories as Record<string, Record<string, string>> | undefined)?.categories;
  const label = localizedCategories?.[categoryKey] || fallbackCategories?.[categoryKey] || categoryKey;
  if (enableCache) {
    storyCategoryLabelCache.set(cacheKey, label);
  }
  return label;
};

// frontmatter cta 필드를 검증된 StoryCTAOverride로 좁힌다. 잘못된 값은 무시되고
// 자동 매칭 룰이 폴백된다.
const STORY_CTA_OVERRIDE_SET = new Set<string>(STORY_CTA_OVERRIDES);
const normalizeStoryCTAOverride = (raw: unknown): StoryCTAOverride | undefined => {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim().toLowerCase();
  return STORY_CTA_OVERRIDE_SET.has(trimmed) ? (trimmed as StoryCTAOverride) : undefined;
};

const mapStoryFrontmatter = (
  slug: string,
  frontmatter: Record<string, unknown>,
  content: string,
  locale: Locale
): Story => {
  const isoDate = normalizeDate(frontmatter?.date as string | Date | undefined);
  const derivedThumbnail = (frontmatter?.thumbnail as string | undefined) || extractFirstImageUrl(content);
  const rawCategory = (frontmatter?.category as string | undefined) || '';
  const categoryKey = normalizeStoryCategoryKey(rawCategory);
  const categoryLabel = getStoryCategoryLabel(categoryKey, locale);
  const cta = normalizeStoryCTAOverride(frontmatter?.cta);

  return {
    id: slug,
    slug,
    title: (frontmatter?.title as string) || slug,
    date: isoDate,
    createdAt: isoDate,
    author: (frontmatter?.author as string) || '스튜디오 놀',
    category: categoryLabel,
    categoryKey,
    tags: Array.isArray(frontmatter?.tags) ? (frontmatter.tags as string[]) : ['기본'],
    summary: (frontmatter?.summary as string) || summarizeText(content, 150, { stripMarkdown: true }),
    thumbnail: derivedThumbnail || null,
    thumbnailDerived: !(frontmatter?.thumbnail) && Boolean(derivedThumbnail),
    images: Array.isArray(frontmatter?.images) ? (frontmatter.images as string[]) : [],
    ...(cta ? { cta } : {}),
  };
};

const getParsedStoryFile = (slug: string, locale: Locale): {
  filePath: string;
  sourceLocale: Locale;
  data: Record<string, unknown>;
  content: string;
} => {
  const { filePath, sourceLocale } = resolveStoryFile(slug, locale);
  if (enableCache) {
    const cached = parsedStoryFileCache.get(filePath);
    if (cached) {
      return { filePath, sourceLocale, data: cached.data, content: cached.content };
    }
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`Story file not found: ${filePath}`);
  }

  const fileContents = fs.readFileSync(filePath, 'utf8');
  const normalized = stripCodeFenceWrapper(fileContents);
  const { data, content } = matter(normalized);
  const parsed = { data, content };
  if (enableCache) {
    parsedStoryFileCache.set(filePath, parsed);
  }
  return { filePath, sourceLocale, ...parsed };
};

export const getAllStories = (locale: string = defaultLocale): Story[] => {
  const normalizedLocale = (locale as Locale) || defaultLocale;
  if (enableCache) {
    const cached = allStoriesCache.get(normalizedLocale);
    if (cached) return cached;
  }

  const stories = getAllStorySlugs()
    .map((slug: string) => {
      try {
        const { data, content } = getParsedStoryFile(slug, normalizedLocale);
        return mapStoryFrontmatter(slug, data, content, normalizedLocale);
      } catch {
        return null;
      }
    })
    .filter((story): story is Story => story !== null)
    .sort((a: Story, b: Story) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (enableCache) {
    allStoriesCache.set(normalizedLocale, stories);
  }
  return stories;
};

export const getStoryDetail = async (slug: string, locale: string = defaultLocale): Promise<StoryDetail> => {
  const requestedLocale = locale as Locale;
  const cacheKey = `${requestedLocale}:${slug}`;
  if (enableCache) {
    const cached = storyDetailCache.get(cacheKey);
    if (cached) return cached;
  }

  const { filePath, sourceLocale, data, content } = getParsedStoryFile(slug, requestedLocale);
  const modifiedDate = fs.statSync(filePath).mtime.toISOString();
  const baseStory = mapStoryFrontmatter(slug, data, content, requestedLocale);

  // multilingual 일관성: cta는 사이트 전략 차원이므로 모든 locale에서 동일해야 한다.
  // 번역본 frontmatter에 cta가 없으면 default locale(ko) 원본 파일의 cta를 폴백 적용.
  // 이 폴백이 없으면 ko에만 cta 명시한 글이 영문/타 locale에서 자동 룰로 갈려 CTA가
  // 불일치하는 잔존 부정합이 생긴다.
  if (!baseStory.cta && sourceLocale !== defaultLocale) {
    try {
      const koParsed = getParsedStoryFile(slug, defaultLocale);
      const koCta = normalizeStoryCTAOverride(koParsed.data?.cta);
      if (koCta) baseStory.cta = koCta;
    } catch {
      // ko 원본이 없는 글(영문 전용 등)은 무시 — 자동 룰 폴백이 정답.
    }
  }

  // AUTO-EXPAND 보일러플레이트는 본문에서 분리한다. 분리 후 본문이 thin-content
  // 임계 미만이면 isThinContent가 자동으로 true가 되어 noindex 처리된다.
  const { stripped: contentWithoutAutoExpand, block: boilerplateSection } = extractAutoExpandBlock(content);
  let contentToProcess = contentWithoutAutoExpand;

  if (baseStory.thumbnailDerived && baseStory.thumbnail) {
    const imageRegex = /!.*\]\(([^)]+)\)/;
    const match = contentToProcess.match(imageRegex);
    if (match && match[1] === baseStory.thumbnail) {
      contentToProcess = contentToProcess.replace(match[0], '');
    }
  }

  const rawFaq = data?.faq;
  const faq = Array.isArray(rawFaq)
    ? (rawFaq as Array<{ q: string; a: string }>).filter(
        (item) => typeof item?.q === 'string' && typeof item?.a === 'string'
      )
    : undefined;

  // frontmatter `howTo` 검증 및 정규화 — steps 배열이 비거나 형식이 잘못된 경우는
  // 발행하지 않는다. HowTo schema를 잘못 발행하면 Search Console에서 경고가 발생.
  const howTo = (() => {
    const raw = data?.howTo as
      | { name?: unknown; description?: unknown; totalTime?: unknown; steps?: unknown }
      | undefined;
    if (!raw || typeof raw !== 'object') return undefined;
    const rawSteps = Array.isArray(raw.steps) ? raw.steps : [];
    const steps = rawSteps
      .filter((step): step is { name: unknown; text: unknown; image?: unknown } =>
        Boolean(step) && typeof step === 'object'
      )
      .map((step) => ({
        name: typeof step.name === 'string' ? step.name : '',
        text: typeof step.text === 'string' ? step.text : '',
        ...(typeof step.image === 'string' && { image: step.image }),
      }))
      .filter((step) => step.name.length > 0 && step.text.length > 0);
    if (steps.length === 0) return undefined;
    return {
      ...(typeof raw.name === 'string' && { name: raw.name }),
      ...(typeof raw.description === 'string' && { description: raw.description }),
      ...(typeof raw.totalTime === 'string' && { totalTime: raw.totalTime }),
      steps,
    };
  })();

  // Phase 2 자동 fallback wiring — frontmatter inlineFallback > categoryKey 매핑 우선순위
  // ko 외 locale의 fallback 페이지는 자동 fallback 비활성 (Phase 1 정책 일관)
  let finalContent = contentToProcess;
  if (sourceLocale === requestedLocale && requestedLocale === defaultLocale) {
    const parsed = parseInlineDirectives(contentToProcess);

    const frontmatterFallback = data?.inlineFallback as
      | { price?: string; review?: string; booking?: string }
      | undefined;

    // frontmatter inlineFallback 객체가 정의되면(빈 object 포함) 작가 명시 의도로 간주.
    // categoryKey 단순 매핑 우회 — 빈 object {}는 자동 fallback 완전 비활성을 의미.
    const hasFrontmatterFallback = frontmatterFallback !== undefined;
    const matchedPriceId = hasFrontmatterFallback
      ? (frontmatterFallback?.price ?? null)
      : matchPricingForCategory(baseStory.categoryKey);
    const matchedReviewId = hasFrontmatterFallback
      ? (frontmatterFallback?.review ?? null)
      : matchReviewForCategory(baseStory.categoryKey);
    const bookingMessage = frontmatterFallback?.booking ?? null;
    const reviewSourcedFromFrontmatter = hasFrontmatterFallback && Boolean(frontmatterFallback?.review);

    // wordCount 계산 — 한국어/일본어/태국어는 글자 수, 영문은 단어 수
    const plain = stripMarkdown(contentToProcess);
    const wordCount = (requestedLocale === 'ko' || requestedLocale === 'zh' || requestedLocale === 'th')
      ? plain.replace(/\s+/g, '').length
      : plain.split(/\s+/).filter(Boolean).length;

    const fallback = decideAutoFallback({
      authorBoxes: parsed.authorBoxes,
      presentTypes: parsed.presentTypes,
      storyCategoryKey: baseStory.categoryKey,
      wordCount,
      matchedPriceId,
      matchedReviewId,
      bookingMessage,
      reviewSourcedFromFrontmatter,
    });

    if (fallback) {
      finalContent = injectAutoFallbackMarker(contentToProcess, buildAutoFallbackMarker(fallback));
    }
  }

  const isThinContent = computeThinContentStatus(finalContent, slug).isThinContent;

  const storyDetail: StoryDetail = {
    ...baseStory,
    content: finalContent,
    sourceLocale,
    isFallbackTranslation: sourceLocale !== requestedLocale,
    isThinContent,
    ...(typeof data?.robots === 'string' && { robots: data.robots }),
    modifiedDate,
    ...(faq && faq.length > 0 && { faq }),
    ...(howTo && { howTo }),
    ...(boilerplateSection && { boilerplateSection }),
    availableLocales: getStoryAvailableLocales(slug),
  };

  if (enableCache) {
    storyDetailCache.set(cacheKey, storyDetail);
  }
  return storyDetail;
};

export const getStoryPaths = (): StoryPath[] => {
  if (enableCache && storyPathsCache.value) {
    return storyPathsCache.value;
  }

  const slugs = getAllStorySlugs();
  const paths: StoryPath[] = [];

  slugs.forEach((slug) => {
    locales.forEach((locale) => {
      paths.push({ params: { locale, id: slug } });
    });
  });

  if (enableCache) {
    storyPathsCache.value = paths;
  }
  return paths;
};

/**
 * 카테고리 listing·전체 listing 노출 가부.
 *
 * 일반 시·군 지역 페이지는 thin/doorway 패턴으로 noindex 처리되어 있어 사이트 내
 * listing에서도 노출하지 않는다. 광역 허브 16개만 region 카테고리에서 노출.
 * URL 자체는 살아있어 직접 접근·북마크는 가능. getRelatedStories는 별도 정책.
 */
export const isListableStory = (story: Pick<Story, 'slug' | 'categoryKey'>): boolean => {
  if (story.categoryKey === 'region' && !isRegionHub(story.slug)) return false;
  return true;
};

export const getRelatedStories = (locale: string, slug: string, limit = 6): Story[] => {
  const all = getAllStories(locale);
  const current = all.find((item) => item.slug === slug);
  // PM 회의 #2 보강: doorway/thin 페이지를 related listing에서 제외해 related 슬롯이
  // 색인되지 않는 페이지로 낭비되지 않도록 차단. isListableStory(region doorway)
  // + isThinContent gate를 추가 적용.
  const candidates = all.filter((item) =>
    item.slug !== slug
    && isListableStory(item)
    && !item.isThinContent,
  );

  if (!current) return candidates.slice(0, limit);

  const currentTags = new Set(current.tags ?? []);
  const titleTokenize = (raw: string | undefined): string[] =>
    (raw || '')
      .toLowerCase()
      .split(/[\s·,—\-/|]+/)
      .filter((w) => w.length >= 2);
  const currentTitleWords = new Set(titleTokenize(current.title));
  const toTime = (s: Story) => new Date(s.date).getTime() || 0;
  const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const scored = candidates
    .map((item) => {
      // category 일치 weight 강화 (+2 → +3): 같은 인텐트 클러스터 우선 매칭.
      const categoryMatch = item.categoryKey === current.categoryKey ? 3 : 0;
      // tag overlap — 기존과 동일하게 각 일치 태그당 +1.
      const tagOverlap = (item.tags ?? []).filter((t) => currentTags.has(t)).length;
      // title 단어 overlap (가벼운 weight) — 같은 주제 단어가 제목에 들어간 글을
      // 추가로 끌어올린다. 단순 카테고리·태그가 둘 다 약할 때 fallback 신호.
      const titleOverlap = titleTokenize(item.title).filter((w) => currentTitleWords.has(w)).length * 0.5;
      // 최신 90일 boost — 새 commercial/decision-stage 콘텐츠가 자연스럽게 noted.
      const recencyBoost = (now - toTime(item)) < NINETY_DAYS_MS ? 1 : 0;
      return { item, score: categoryMatch + tagOverlap + titleOverlap + recencyBoost };
    })
    .sort((a, b) => b.score - a.score || toTime(b.item) - toTime(a.item));

  const relevant = scored.filter(({ score }) => score > 0).map(({ item }) => item);
  if (relevant.length >= limit) return relevant.slice(0, limit);

  const seen = new Set(relevant.map((s) => s.slug));
  const fallback = candidates
    .filter((s) => !seen.has(s.slug))
    .sort((a, b) => toTime(b) - toTime(a));

  return [...relevant, ...fallback].slice(0, limit);
};
