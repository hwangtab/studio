import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { extractFirstImageUrl } from '../utils/localDataUtils';
import { summarizeText } from '../utils/textUtils';
import type { Story, StoryDetail, StoryPath } from '../types/story';
import { locales, defaultLocale, type Locale } from './i18n';
import { loadCommonResourceServer } from './i18n.server';
import { isRegionHub } from './regionHubSlugs';

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

export const getStoryAvailableLocales = (slug: string): Locale[] => {
  const cached = enableCache ? storyAvailableLocalesCache.get(slug) : undefined;
  if (cached && enableCache) return cached;

  const available: Locale[] = [];
  if (fs.existsSync(path.join(storiesDirectory, `${slug}.md`))) {
    available.push(defaultLocale);
  }
  for (const locale of locales) {
    if (locale === defaultLocale) continue;
    if (fs.existsSync(path.join(storiesDirectory, `${slug}.${locale}.md`))) {
      available.push(locale);
    }
  }
  if (enableCache) storyAvailableLocalesCache.set(slug, available);
  return available;
};

const resolveStoryFile = (slug: string, locale: Locale = defaultLocale): { filePath: string; sourceLocale: Locale } => {
  const cacheKey = `${locale}:${slug}`;
  const cached = enableCache ? storyFileResolutionCache.get(cacheKey) : undefined;
  if (cached && enableCache) {
    return cached;
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
    const englishFallbackPath = path.join(storiesDirectory, `${slug}.en.md`);
    if (fs.existsSync(englishFallbackPath)) {
      resolved = { filePath: englishFallbackPath, sourceLocale: 'en' };
      if (enableCache) {
        storyFileResolutionCache.set(cacheKey, resolved);
      }
      return resolved;
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

const extractAutoExpandBlock = (source: string): { stripped: string; block: string | null } => {
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

const storyCategoryKeyMap: Record<string, string> = {
  // Primary categories (10)
  '악기 연습': 'instrument',
  '지역 가이드': 'region',
  강좌: 'lesson',
  '음악 제작': 'production',
  '녹음 가이드': 'recording',
  '보컬 가이드': 'vocal',
  후기: 'feedback',
  '믹싱·마스터링': 'mixing',
  '음악 비즈니스': 'business',
  이벤트: 'event',
  // Legacy English keys
  instrument: 'instrument',
  region: 'region',
  lesson: 'lesson',
  production: 'production',
  recording: 'recording',
  vocal: 'vocal',
  feedback: 'feedback',
  mixing: 'mixing',
  business: 'business',
  event: 'event',
  // Legacy mappings for backward compatibility
  news: 'event',
  notice: 'event',
  공지: 'event',
  소식: 'event',
  interview: 'feedback',
  review: 'feedback',
  인터뷰: 'feedback',
  리뷰: 'feedback',
  '후기·인터뷰': 'feedback',
  practice: 'instrument',
  '음악연습실 가이드': 'instrument',
  '음악연습실': 'instrument',
  '음악 연습실 가이드': 'instrument',
  '연습실 가이드': 'instrument',
  'music-guide': 'recording',
  guide: 'recording',
  가이드: 'recording',
};

const storyCategoryKeys = new Set<string>([
  'instrument',
  'region',
  'lesson',
  'production',
  'recording',
  'vocal',
  'feedback',
  'mixing',
  'business',
  'event',
]);

const normalizeStoryCategoryKey = (category?: string): string => {
  if (!category) return 'recording';
  const trimmed = category.trim();
  if (storyCategoryKeyMap[trimmed]) return storyCategoryKeyMap[trimmed];
  if (storyCategoryKeys.has(trimmed)) return trimmed;
  return 'recording';
};

const getStoryCategoryLabel = (categoryKey: string, locale: Locale): string => {
  const cacheKey = `${locale}:${categoryKey}`;
  const cached = enableCache ? storyCategoryLabelCache.get(cacheKey) : undefined;
  if (cached && enableCache) {
    return cached;
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
  };
};

const getParsedStoryFile = (slug: string, locale: Locale): {
  sourceLocale: Locale;
  data: Record<string, unknown>;
  content: string;
} => {
  const { filePath, sourceLocale } = resolveStoryFile(slug, locale);
  const cached = enableCache ? parsedStoryFileCache.get(filePath) : undefined;
  if (cached && enableCache) {
    return { sourceLocale, data: cached.data, content: cached.content };
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
  return { sourceLocale, ...parsed };
};

export const getAllStories = (locale: string = defaultLocale): Story[] => {
  const normalizedLocale = (locale as Locale) || defaultLocale;
  const cached = enableCache ? allStoriesCache.get(normalizedLocale) : undefined;
  if (cached && enableCache) {
    return cached;
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
  const cached = enableCache ? storyDetailCache.get(cacheKey) : undefined;
  if (cached && enableCache) {
    return cached;
  }

  const { sourceLocale, data, content } = getParsedStoryFile(slug, requestedLocale);
  const { filePath } = resolveStoryFile(slug, requestedLocale);
  const modifiedDate = fs.statSync(filePath).mtime.toISOString();
  const baseStory = mapStoryFrontmatter(slug, data, content, requestedLocale);

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

  // Estimate rendered shortcode content length so boilerplate-replaced pages
  // are not unfairly penalized. Each shortcode token contributes an estimated
  // character count equivalent to its rendered output.
  const SHORTCODE_CHAR_ESTIMATES: Record<string, number> = {
    'online-fallback': 120,
    'session-checklist': 420,
  };
  const shortcodeBonus = [...contentToProcess.matchAll(/%%([a-z-]+)%%/g)]
    .reduce((sum, m) => sum + (SHORTCODE_CHAR_ESTIMATES[m[1]] ?? 80), 0);
  const rawNonWhitespace = contentToProcess.replace(/\s+/g, '').length;
  // Raise threshold from 1000 to 1500 to prevent thin pages from being indexed.
  // Pages like `bulgwang-mixing-club` (5,016B ≈ 1,700 chars) barely passed 1000
  // but were still rejected by Google. 1500 chars provides a safer buffer.
  // 단, 광역 허브 페이지는 사이트 정보 구조상 색인되어야 하므로 게이트에서 제외.
  // (광역 허브와 일반 지역 페이지의 본문 길이 분포가 동일해 임계값으로는 구분 불가)
  const isThinContent = !isRegionHub(slug) && (rawNonWhitespace + shortcodeBonus) < 1500;

  const storyDetail: StoryDetail = {
    ...baseStory,
    content: contentToProcess,
    sourceLocale,
    isFallbackTranslation: sourceLocale !== requestedLocale,
    isThinContent,
    ...(typeof data?.robots === 'string' && { robots: data.robots }),
    modifiedDate,
    ...(faq && faq.length > 0 && { faq }),
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
  const candidates = all.filter((item) => item.slug !== slug);

  if (!current) return candidates.slice(0, limit);

  const currentTags = new Set(current.tags ?? []);
  const toTime = (s: Story) => new Date(s.date).getTime() || 0;

  const scored = candidates
    .map((item) => {
      const tagOverlap = (item.tags ?? []).filter((t) => currentTags.has(t)).length;
      const categoryMatch = item.categoryKey === current.categoryKey ? 2 : 0;
      return { item, score: categoryMatch + tagOverlap };
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
