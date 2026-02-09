import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { extractFirstImageUrl } from '../utils/localDataUtils';
import { summarizeText } from '../utils/textUtils';
import type { Story, StoryDetail, StoryPath } from '../types/story';
import { locales, defaultLocale, type Locale, loadCommonResource } from './i18n';

const storiesDirectory: string = path.join(process.cwd(), 'content/stories');

const getStoryFilePath = (slug: string, locale: string = defaultLocale): string => {
  // Try locale specific file: slug.en.md
  const localeFilePath = path.join(storiesDirectory, `${slug}.${locale}.md`);
  if (fs.existsSync(localeFilePath)) {
    return localeFilePath;
  }
  // Fallback to English for non-default locales when available
  if (locale !== defaultLocale) {
    const englishFallbackPath = path.join(storiesDirectory, `${slug}.en.md`);
    if (fs.existsSync(englishFallbackPath)) {
      return englishFallbackPath;
    }
  }
  // Fallback to base file: slug.md
  return path.join(storiesDirectory, `${slug}.md`);
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
  if (!fs.existsSync(storiesDirectory)) {
    return [];
  }
  const files = fs.readdirSync(storiesDirectory);
  const slugs = new Set<string>();

  files.forEach(file => {
    if (file.endsWith('.md')) {
      // Remove .md
      let name = file.replace(/\.md$/, '');
      // If it has locale suffix (e.g. slug.en), remove it
      locales.forEach(locale => {
        if (name.endsWith(`.${locale}`)) {
          name = name.replace(new RegExp(`\\.${locale}$`), '');
        }
      });
      slugs.add(name);
    }
  });

  return Array.from(slugs);
};

const normalizeDate = (value: string | Date | undefined): string => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
};

const storyCategoryKeyMap: Record<string, string> = {
  공지: 'notice',
  이벤트: 'event',
  강좌: 'lesson',
  인터뷰: 'interview',
  장비: 'equipment',
  리뷰: 'review',
};

const storyCategoryKeys = new Set<string>([
  'notice',
  'event',
  'lesson',
  'interview',
  'equipment',
  'review',
  'other',
]);

const normalizeStoryCategoryKey = (category?: string): string => {
  if (!category) return 'other';
  const trimmed = category.trim();
  if (storyCategoryKeyMap[trimmed]) return storyCategoryKeyMap[trimmed];
  if (storyCategoryKeys.has(trimmed)) return trimmed;
  return 'other';
};

const getStoryCategoryLabel = (categoryKey: string, locale: Locale): string => {
  const localeCommon = loadCommonResource(locale);
  const fallbackCommon = loadCommonResource(defaultLocale);
  const localizedCategories = (localeCommon?.stories as Record<string, Record<string, string>> | undefined)?.categories;
  const fallbackCategories = (fallbackCommon?.stories as Record<string, Record<string, string>> | undefined)?.categories;
  return localizedCategories?.[categoryKey] || fallbackCategories?.[categoryKey] || categoryKey;
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

export const getAllStories = (locale: string = defaultLocale): Story[] => {
  return getAllStorySlugs()
    .map((slug: string) => {
      const filePath = getStoryFilePath(slug, locale);
      if (!fs.existsSync(filePath)) return null;
      const fileContents = fs.readFileSync(filePath, 'utf8');
      const normalized = stripCodeFenceWrapper(fileContents);
      const { data, content } = matter(normalized);
      return mapStoryFrontmatter(slug, data, content, locale as Locale);
    })
    .filter((story): story is Story => story !== null)
    .sort((a: Story, b: Story) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const getStoryDetail = async (slug: string, locale: string = defaultLocale): Promise<StoryDetail> => {
  const filePath = getStoryFilePath(slug, locale);
  const fileContents = fs.readFileSync(filePath, 'utf8');
  const normalized = stripCodeFenceWrapper(fileContents);
  const { data, content } = matter(normalized);
  const baseStory = mapStoryFrontmatter(slug, data, content, locale as Locale);
  let contentToProcess = content;

  if (baseStory.thumbnailDerived && baseStory.thumbnail) {
    const imageRegex = /!.*\]\(([^)]+)\)/;
    const match = contentToProcess.match(imageRegex);
    if (match && match[1] === baseStory.thumbnail) {
      contentToProcess = contentToProcess.replace(match[0], '');
    }
  }

  return {
    ...baseStory,
    content: contentToProcess,
  };
};

export const getStoryPaths = (): StoryPath[] => {
  const slugs = getAllStorySlugs();
  const paths: StoryPath[] = [];

  slugs.forEach(slug => {
    locales.forEach(locale => {
      paths.push({ params: { locale, id: slug } });
    });
  });

  return paths;
};