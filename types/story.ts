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
  isThinContent?: boolean;
  robots?: string;
  modifiedDate?: string; // ISO 8601 from file mtime
  faq?: StoryFAQItem[];
}

/**
 * StoryCard 컴포넌트가 실제로 사용하는 최소 필드 집합.
 * 목록 페이지는 이 경량 타입만 직렬화해 __NEXT_DATA__ 크기를 줄인다.
 */
export type StoryCardData = Pick<Story, 'slug' | 'title' | 'date' | 'categoryKey' | 'thumbnail'> & {
  id?: string;
  content?: string;
  // summary/category는 선택적 — 페이로드 축소를 위해 일부 경로에서 생략될 수 있음.
  summary?: string;
  category?: string;
};

/**
 * Static path params for Next.js getStaticPaths
 */
export interface StoryPath {
  params: {
    id: string;
    locale?: string;
  };
}
