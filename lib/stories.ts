import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { extractFirstImageUrl } from '../utils/localDataUtils';
import { summarizeText } from '../utils/textUtils';
import type { Story, StoryDetail, StoryPath } from '../types/story';
import { locales, defaultLocale, type Locale } from './i18n';
import { loadCommonResourceServer } from './i18n.server';

const storiesDirectory: string = path.join(process.cwd(), 'content/stories');
const enableCache = process.env.NODE_ENV === 'production';
const storySlugsCache: { value: string[] | null } = { value: null };
const storyPathsCache: { value: StoryPath[] | null } = { value: null };
const storyFileResolutionCache = new Map<string, { filePath: string; sourceLocale: Locale }>();
const parsedStoryFileCache = new Map<string, { data: Record<string, unknown>; content: string }>();
const storyCategoryLabelCache = new Map<string, string>();
const allStoriesCache = new Map<Locale, Story[]>();
const storyDetailCache = new Map<string, StoryDetail>();

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
  // 공지
  공지: 'notice',
  // 이벤트
  이벤트: 'event',
  // 강좌
  강좌: 'lesson',
  // 인터뷰
  인터뷰: 'interview',
  // 후기·리뷰
  리뷰: 'review',
  후기: 'review',
  // 지역 가이드
  '지역 가이드': 'region',
  // 보컬 가이드
  '보컬 가이드': 'vocal',
  '발성 가이드': 'vocal',
  '보컬 테크닉 가이드': 'vocal',
  '보컬 트레이닝 가이드': 'vocal',
  // 녹음 가이드
  '녹음 가이드': 'recording',
  '녹음 기초': 'recording',
  '홈 레코딩 가이드': 'recording',
  // 음반 제작
  '음반 제작 가이드': 'production',
  '음악 제작 가이드': 'production',
  '음악 프로덕션 가이드': 'production',
  '음악 제작': 'production',
  '작곡 가이드': 'production',
  // 믹싱·마스터링
  '믹싱 가이드': 'mixing',
  '마스터링 가이드': 'mixing',
  // 음악 비즈니스
  '음악 비즈니스 가이드': 'business',
  '음악 비즈니스': 'business',
  '음악 마케팅': 'business',
  '음악 마케팅 가이드': 'business',
  '음악 커리어 가이드': 'business',
  '음원 배포 가이드': 'business',
  'SNS 마케팅': 'business',
  'SNS 가이드': 'business',
  // 가이드 (일반)
  가이드: 'guide',
  '서비스 안내': 'guide',
  '음악 가이드': 'guide',
  '음악 이론 가이드': 'guide',
  '저작권 가이드': 'guide',
  '장비 가이드': 'guide',
  장비: 'guide',
};

const storyCategoryKeys = new Set<string>([
  'notice',
  'event',
  'lesson',
  'interview',
  'review',
  'region',
  'vocal',
  'recording',
  'production',
  'mixing',
  'business',
  'guide',
]);

const normalizeStoryCategoryKey = (category?: string): string => {
  if (!category) return 'guide';
  const trimmed = category.trim();
  if (storyCategoryKeyMap[trimmed]) return storyCategoryKeyMap[trimmed];
  if (storyCategoryKeys.has(trimmed)) return trimmed;
  return 'guide';
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
  let contentToProcess = content;

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

  const storyDetail: StoryDetail = {
    ...baseStory,
    content: contentToProcess,
    sourceLocale,
    isFallbackTranslation: sourceLocale !== requestedLocale,
    modifiedDate,
    ...(faq && faq.length > 0 && { faq }),
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

export const getRelatedStories = (locale: string, slug: string, limit = 3): Story[] => {
  const all = getAllStories(locale);
  const current = all.find((item) => item.slug === slug);
  const candidates = all.filter((item) => item.slug !== slug);

  if (!current) return candidates.slice(0, limit);

  const currentTags = new Set(current.tags ?? []);

  return candidates
    .map((item) => {
      const tagOverlap = (item.tags ?? []).filter((t) => currentTags.has(t)).length;
      const categoryMatch = item.categoryKey === current.categoryKey ? 2 : 0;
      return { item, score: categoryMatch + tagOverlap };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item)
    .slice(0, limit);
};
