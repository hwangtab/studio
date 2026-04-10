import type { Locale } from '../lib/i18n';

/**
 * Frontmatter interface for Story markdown files
 * Extracted from gray-matter parsing of content/stories/*.md files
 */
export interface StoryFAQItem {
  q: string;
  a: string;
}

export interface StoryFrontmatter {
  title: string;
  date: string | Date;
  author?: string;
  category?: string;
  tags?: string[];
  summary?: string;
  thumbnail?: string;
  images?: string[];
  faq?: StoryFAQItem[];
}

export const STORY_CATEGORY_KEYS = [
  'news',
  'lesson',
  'feedback',
  'region',
  'instrument',
  'music-guide',
] as const;

export type StoryCategoryKey = typeof STORY_CATEGORY_KEYS[number];

export interface StoryListItem {
  id: string;
  slug: string;
  title: string;
  date: string; // ISO 8601 format
  createdAt: string; // ISO 8601 format
  category: string;
  categoryKey: StoryCategoryKey;
  summary: string;
  thumbnail: string | null;
  tags: string[];
  readingTime: number; // Estimated minutes to read
}

/**
 * Processed story object with computed fields
 * Returned by getAllStories() and getStoryDetail()
 */
export interface Story extends StoryListItem {
  author: string;
  tags: string[];
  thumbnailDerived: boolean;
  images: string[];
  content?: string;
}

/**
 * Extended story with rendered HTML content
 * Returned by getStoryDetail()
 */
export interface StoryDetail extends Story {
  content: string; // Raw markdown content
  sourceLocale: Locale;
  isFallbackTranslation: boolean;
  modifiedDate?: string; // ISO 8601 from file mtime
  faq?: StoryFAQItem[];
}

/**
 * Static path params for Next.js getStaticPaths
 */
export interface StoryPath {
  params: {
    id: string;
    locale?: string;
  };
}
