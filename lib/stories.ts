import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { extractFirstImageUrl } from '../utils/localDataUtils';
import { summarizeText } from '../utils/textUtils';
import type { Story, StoryDetail, StoryPath } from '../types/story';
import { locales, defaultLocale, type Locale } from './i18n';
import { loadCommonResourceServer } from './i18n.server';
import { applyFactTokens } from './factTokens';
import { isRegionHub } from './regionHubSlugs';
import regionRedirectMap from './regionRedirectMap.json';
import { parseInlineDirectives, decideAutoFallback, type AutoFallbackDecision } from './inlineDirectives';
import {
  matchPricingForStory,
  matchReviewForCategory,
  matchServiceForStory,
  injectAutoFallbackMarker,
} from './storyAutoFallback';
import {
  computeThinContentStatus,
  extractAutoExpandBlock,
} from './storyContentPolicy';
import { rankRelatedStories } from './storyRelatedScoring';
import {
  normalizeStoryCTAOverride,
  normalizeStoryFaq,
  normalizeStoryHowTo,
  stripCodeFenceWrapper,
} from './storyFrontmatter';
import { getStoryWordCount } from './storySeoData';
export {
  computeThinContentStatus,
  extractAutoExpandBlock,
  SHORTCODE_CHAR_ESTIMATES,
  SHORTCODE_DEFAULT_CHAR_ESTIMATE,
  THIN_CONTENT_THRESHOLD,
} from './storyContentPolicy';

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
    case 'service':
      return `%%service:${fb.serviceType}%%`;
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
      const raw = applyFactTokens(fs.readFileSync(filePath, 'utf8'));
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
    // 잘못된 frontmatter date('미정'·오타 등)는 조용히 오늘로 대체하면 매 빌드마다
    // datePublished가 바뀌고 정렬이 오염되므로, 추적할 수 있게 경고를 남긴다.
    console.warn(`[stories] invalid date value, falling back to today: ${String(value)}`);
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

  const fileContents = applyFactTokens(fs.readFileSync(filePath, 'utf8'));
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

  const { sourceLocale, data, content } = getParsedStoryFile(slug, requestedLocale);
  const baseStory = mapStoryFrontmatter(slug, data, content, requestedLocale);

  // dateModified는 frontmatter lastmod에서만 온다. 파일 mtime을 쓰면 git이 mtime을
  // 보존하지 않는 탓에 Vercel이 배포할 때마다 전 글이 "방금 수정됨"으로 찍혀,
  // 사실과 다른 데다 균일한 가짜 최신성이라 검색·AI 엔진에서 신호 가치도 없다.
  // lastmod이 없으면 발행일이 곧 최종 수정일이다.
  const rawLastmod = data?.lastmod as string | Date | undefined;
  const modifiedDate = rawLastmod ? normalizeDate(rawLastmod) : baseStory.date;

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
    const imageRegex = /!\[.*?\]\(([^)]+)\)/;
    const match = contentToProcess.match(imageRegex);
    if (match && match[1] === baseStory.thumbnail) {
      contentToProcess = contentToProcess.replace(match[0], '');
    }
  }

  const faq = normalizeStoryFaq(data?.faq);
  const howTo = normalizeStoryHowTo(data?.howTo);

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
      : matchPricingForStory(baseStory.categoryKey, slug);
    const matchedReviewId = hasFrontmatterFallback
      ? (frontmatterFallback?.review ?? null)
      : matchReviewForCategory(baseStory.categoryKey);
    const bookingMessage = frontmatterFallback?.booking ?? null;
    const reviewSourcedFromFrontmatter = hasFrontmatterFallback && Boolean(frontmatterFallback?.review);
    // inlineFallback 정의 시 카테고리 매핑 전체 우회 (service도 동일 규칙)
    const matchedServiceType = hasFrontmatterFallback ? null : matchServiceForStory(baseStory.categoryKey, slug);

    const fallback = decideAutoFallback({
      authorBoxes: parsed.authorBoxes,
      presentTypes: parsed.presentTypes,
      storyCategoryKey: baseStory.categoryKey,
      wordCount: getStoryWordCount(contentToProcess, requestedLocale) ?? 0,
      matchedPriceId,
      matchedReviewId,
      bookingMessage,
      reviewSourcedFromFrontmatter,
      matchedServiceType,
    });

    if (fallback) {
      finalContent = injectAutoFallbackMarker(contentToProcess, buildAutoFallbackMarker(fallback));
    }
  }

  // thin 판정은 사이트맵 isStoryThin(lib/sitemap/thinContent.js)·audit scoreContent와
  // 반드시 동일 입력이어야 "사이트맵 제외 ↔ 페이지 noindex"가 일치한다(핵심 불변식).
  // finalContent는 fallback 마커(가격·리뷰 카드 등)가 삽입된 상태인데, 이 마커는 여러
  // 페이지에 공통으로 박히는 boilerplate라 unique 분량이 아니며 사이트맵/audit 입력에는
  // 없다. 마커 삽입 전 contentToProcess로 계산해 세 경로의 판정을 통일한다. (finalContent로
  // 계산하면 마커가 char count를 부풀려 사이트맵은 thin으로 제외했는데 페이지는 noindex
  // 없이 색인되는 도시명 치환 pSEO 페이지가 생긴다.)
  const isThinContent = computeThinContentStatus(contentToProcess, slug).isThinContent;

  // ko 원본(slug.md)이 없는 native-only 스토리 여부. site-wide 비-ko noindex 정책의
  // 예외 판단에 쓰인다 — native-only 스토리는 native locale에서 색인 가능(사이트맵
  // lib/sitemap/routes.js isLocaleStoryIndexable의 동일 정책과 대칭). 번역본(ko 원본
  // 존재) 스토리는 ko가 thin/noindex여도 이 예외에 해당하지 않는다.
  const isNativeOnly = !fs.existsSync(path.join(storiesDirectory, `${slug}.md`));

  const storyDetail: StoryDetail = {
    ...baseStory,
    content: finalContent,
    sourceLocale,
    isFallbackTranslation: sourceLocale !== requestedLocale,
    isThinContent,
    isNativeOnly,
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
      if (locale === defaultLocale && !fs.existsSync(path.join(storiesDirectory, `${slug}.md`))) {
        return;
      }
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

export const isBrowsableStoryForLocale = (
  story: Pick<Story, 'slug' | 'categoryKey'>,
  locale: string = defaultLocale
): boolean => {
  const targetLocale = locales.includes(locale as Locale) ? (locale as Locale) : defaultLocale;
  return isListableStory(story) && getStoryAvailableLocales(story.slug).includes(targetLocale);
};

export const getRelatedStories = (locale: string, slug: string, limit = 6): Story[] => {
  const targetLocale = locales.includes(locale as Locale) ? (locale as Locale) : defaultLocale;
  const all = getAllStories(targetLocale);
  const current = all.find((item) => item.slug === slug);
  // Related 카드가 noindex/thin 페이지로 새면 indexable 페이지의 내부 링크 품질이
  // 떨어진다. Listing 정책과 sitemap/hreflang의 indexable locale 정책을 함께 적용한다.
  const candidates = all.filter((item) =>
    item.slug !== slug
    && isBrowsableStoryForLocale(item, targetLocale),
  );

  return rankRelatedStories(current, candidates, limit);
};
