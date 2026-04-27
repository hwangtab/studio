/**
 * 스토리 카테고리 키 단일 소스 — i18n `stories.categories.*` 및 카테고리 허브
 * 라우트(`/stories/category/[key]`)와 1:1 대응한다.
 *
 * fs/path 의존성을 가진 lib/stories.ts와 분리해 client bundle에서도 안전하게
 * import할 수 있도록 별도 모듈로 둔다 (페이지·StoryCard·sitemap 등 다중 소비처).
 */

export const STORY_CATEGORY_KEYS = [
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
] as const;

export type StoryCategoryKey = typeof STORY_CATEGORY_KEYS[number];

export const STORY_CATEGORY_KEY_SET = new Set<string>(STORY_CATEGORY_KEYS);

/**
 * YAML frontmatter `category` 값 → 표준 카테고리 키 정규화.
 * 콘텐츠는 한국어 표준 표기, 영문 키, 그리고 시기별 legacy 표기를 혼용해 작성되어
 * 있어 모든 형태를 흡수한다. 미매치는 'recording'으로 폴백.
 */
const STORY_CATEGORY_NORMALIZATION_MAP: Record<string, StoryCategoryKey> = {
  // === 한국어 표준 표기 (현재 새 콘텐츠가 사용하는 형태) ===
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
  // === 영문 표준 키 (정규화된 값을 다시 통과시킬 때 항등 매핑) ===
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
  // === Legacy 표기 (하위 호환) ===
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

export const normalizeStoryCategoryKey = (category?: string): StoryCategoryKey => {
  if (!category) return 'recording';
  const trimmed = category.trim();
  if (STORY_CATEGORY_NORMALIZATION_MAP[trimmed]) {
    return STORY_CATEGORY_NORMALIZATION_MAP[trimmed];
  }
  if (STORY_CATEGORY_KEY_SET.has(trimmed)) {
    return trimmed as StoryCategoryKey;
  }
  return 'recording';
};
