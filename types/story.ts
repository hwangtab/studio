import type { Locale } from '../lib/i18n';

/**
 * Frontmatter interface for Story markdown files
 * Extracted from gray-matter parsing of content/stories/*.md files
 */
export interface StoryFrontmatter {
  title: string;
  date: string | Date;
  author?: string;
  category?: string;
  tags?: string[];
  summary?: string;
  thumbnail?: string;
  images?: string[];
}

/**
 * Processed story object with computed fields
 * Returned by getAllStories() and getStoryDetail()
 */
export interface Story {
  id: string;
  slug: string;
  title: string;
  date: string; // ISO 8601 format
  createdAt: string; // ISO 8601 format
  author: string;
  category: string;
  categoryKey: string;
  tags: string[];
  summary: string;
  thumbnail: string | null;
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
