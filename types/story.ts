import type { Locale } from '../lib/i18n';

/**
 * Frontmatter interface for Story markdown files
 * Extracted from gray-matter parsing of content/stories/*.md files
 */
export interface StoryFAQItem {
  q: string;
  a: string;
}

/**
 * Frontmatter `howTo` 필드 — schema.org HowTo 구조화 데이터로 발행되는 step list.
 * 명시적으로 적용된 글에만 발행하므로 false-positive HowTo schema가 생기지 않는다.
 */
export interface StoryHowToStep {
  name: string;
  text: string;
  image?: string;
}

export interface StoryHowTo {
  /** HowTo schema의 name. 미지정 시 글 title이 사용된다. */
  name?: string;
  /** HowTo schema의 description. 미지정 시 글 summary가 사용된다. */
  description?: string;
  /** ISO 8601 duration (예: "PT30M"). schema.org HowTo.totalTime 호환. */
  totalTime?: string;
  /** 단계 목록 — schema.org HowToStep로 매핑된다. */
  steps: StoryHowToStep[];
}

/**
 * 스토리 본문 끝 CTA 카드 종류. 슬러그·카테고리 기반 자동 매칭이 기본이고,
 * frontmatter `cta:` 필드로 글 단위 명시적 override가 가능하다.
 */
export type StoryCTAOverride = 'recording' | 'lesson' | 'practice' | 'production';

export const STORY_CTA_OVERRIDES: readonly StoryCTAOverride[] = [
  'recording',
  'lesson',
  'practice',
  'production',
] as const;

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
  howTo?: StoryHowTo;
  cta?: StoryCTAOverride;
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
  cta?: StoryCTAOverride; // frontmatter 명시 시에만 채워짐 — getCTAType 자동 룰보다 우선
}

/**
 * Extended story with rendered HTML content
 * Returned by getStoryDetail()
 */
export interface StoryDetail extends Story {
  content: string; // Raw markdown content (AUTO-EXPAND 블록은 boilerplateSection으로 분리됨)
  sourceLocale: Locale;
  isFallbackTranslation: boolean;
  isThinContent?: boolean;
  robots?: string;
  modifiedDate?: string; // ISO 8601 from file mtime
  faq?: StoryFAQItem[];
  // 본문에서 분리된 보일러플레이트(AUTO-EXPAND-V1) 섹션. 사용자에게는 별도 영역으로 노출되지만
  // SEO 본문 분량 계산에는 포함되지 않는다.
  boilerplateSection?: string;
  availableLocales: Locale[]; // Locales with a native translation file — used to gate hreflang alternates
  howTo?: StoryHowTo; // frontmatter `howTo`가 있는 글만 채워진다 — HowTo schema 발행 트리거
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
