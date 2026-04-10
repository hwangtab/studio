import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { extractFirstImageUrl } from '../utils/localDataUtils';
import { summarizeText } from '../utils/textUtils';
import {
  STORY_CATEGORY_KEYS,
  type Story,
  type StoryCategoryKey,
  type StoryDetail,
  type StoryListItem,
  type StoryPath,
} from '../types/story';
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
const allStoryListCache = new Map<Locale, StoryListItem[]>();
const storyDetailCache = new Map<string, StoryDetail>();

export const STORIES_PAGE_SIZE = 12;

export interface StoriesPageData {
  stories: StoryListItem[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  activeCategory: StoryCategoryKey | null;
  availableCategories: StoryCategoryKey[];
}

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

const storyCategoryKeyMap: Record<string, StoryCategoryKey> = {
  news: 'news',
  lesson: 'lesson',
  feedback: 'feedback',
  region: 'region',
  instrument: 'instrument',
  'music-guide': 'music-guide',
};

const storyCategoryKeys = new Set<string>(STORY_CATEGORY_KEYS);

export const isStoryCategoryKey = (value?: string | null): value is StoryCategoryKey =>
  Boolean(value && storyCategoryKeys.has(value));

const normalizeStoryCategoryKey = (category?: string): StoryCategoryKey => {
  if (!category) return 'music-guide';
  const trimmed = category.trim();
  if (storyCategoryKeyMap[trimmed]) return storyCategoryKeyMap[trimmed];
  if (isStoryCategoryKey(trimmed)) return trimmed;
  return 'music-guide';
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

const mapStoryListItemFrontmatter = (
  slug: string,
  frontmatter: Record<string, unknown>,
  content: string,
  locale: Locale
): StoryListItem => {
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
    category: categoryLabel,
    categoryKey,
    summary: (frontmatter?.summary as string) || summarizeText(content, 150, { stripMarkdown: true }),
    thumbnail: derivedThumbnail || null,
  };
};

const mapStoryFrontmatter = (
  slug: string,
  frontmatter: Record<string, unknown>,
  content: string,
  locale: Locale
): Story => {
  const baseStory = mapStoryListItemFrontmatter(slug, frontmatter, content, locale);
  const derivedThumbnail = (frontmatter?.thumbnail as string | undefined) || extractFirstImageUrl(content);

  return {
    ...baseStory,
    author: (frontmatter?.author as string) || '스튜디오 놀',
    tags: Array.isArray(frontmatter?.tags) ? (frontmatter.tags as string[]) : ['기본'],
    thumbnailDerived: !(frontmatter?.thumbnail) && Boolean(derivedThumbnail),
    images: Array.isArray(frontmatter?.images) ? (frontmatter.images as string[]) : [],
  };
};

const toStoryListItem = (story: Story): StoryListItem => ({
  id: story.id,
  slug: story.slug,
  title: story.title,
  date: story.date,
  createdAt: story.createdAt,
  category: story.category,
  categoryKey: story.categoryKey,
  summary: story.summary,
  thumbnail: story.thumbnail,
});

export const getAllStoryListItems = (locale: string = defaultLocale): StoryListItem[] => {
  const normalizedLocale = (locale as Locale) || defaultLocale;
  const cached = enableCache ? allStoryListCache.get(normalizedLocale) : undefined;
  if (cached && enableCache) {
    return cached;
  }

  const stories = getAllStorySlugs()
    .map((slug: string) => {
      try {
        const { data, content } = getParsedStoryFile(slug, normalizedLocale);
        return mapStoryListItemFrontmatter(slug, data, content, normalizedLocale);
      } catch {
        return null;
      }
    })
    .filter((story): story is StoryListItem => story !== null)
    .sort((a: StoryListItem, b: StoryListItem) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (enableCache) {
    allStoryListCache.set(normalizedLocale, stories);
  }
  return stories;
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

export const getStoriesPage = (
  locale: string = defaultLocale,
  categoryKey: string | null = null,
  page = 1,
  pageSize = STORIES_PAGE_SIZE
): StoriesPageData | null => {
  if (!Number.isInteger(page) || page < 1) {
    return null;
  }

  if (!Number.isInteger(pageSize) || pageSize < 1) {
    return null;
  }

  const allStories = getAllStoryListItems(locale);
  const availableCategories = STORY_CATEGORY_KEYS.filter((key) =>
    allStories.some((story) => story.categoryKey === key)
  );

  const activeCategory = categoryKey
    ? (isStoryCategoryKey(categoryKey) ? categoryKey : null)
    : null;

  if (categoryKey && !activeCategory) {
    return null;
  }

  const filteredStories = activeCategory
    ? allStories.filter((story) => story.categoryKey === activeCategory)
    : allStories;

  if (filteredStories.length === 0) {
    return null;
  }

  const totalItems = filteredStories.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  if (page > totalPages) {
    return null;
  }

  const stories = filteredStories.slice((page - 1) * pageSize, page * pageSize);

  return {
    stories,
    currentPage: page,
    totalPages,
    totalItems,
    activeCategory,
    availableCategories,
  };
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
  let modifiedDate: string;
  try {
    modifiedDate = fs.statSync(filePath).mtime.toISOString();
  } catch {
    modifiedDate = new Date().toISOString();
  }
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

export const getRelatedStories = (locale: string, slug: string, limit = 3): StoryListItem[] => {
  const all = getAllStories(locale);
  const current = all.find((item) => item.slug === slug);
  const candidates = all.filter((item) => item.slug !== slug);

  if (!current) return candidates.slice(0, limit).map(toStoryListItem);

  const currentTags = new Set(current.tags ?? []);

  return candidates
    .map((item) => {
      const tagOverlap = (item.tags ?? []).filter((t) => currentTags.has(t)).length;
      const categoryMatch = item.categoryKey === current.categoryKey ? 2 : 0;
      return { item, score: categoryMatch + tagOverlap };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => toStoryListItem(item))
    .slice(0, limit);
};
