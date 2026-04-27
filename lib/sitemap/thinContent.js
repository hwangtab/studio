const { getStoryFrontmatter } = require('./storyMeta');

/**
 * Thin-content quality gate for sitemap inclusion.
 * Mirrors the logic in lib/stories.ts (threshold 1500).
 * AUTO-EXPAND-V1 보일러플레이트 블록은 도시명만 치환된 동일 텍스트가 1,400+개
 * 페이지에 중복되므로 thin 판정에서 제외해야 진짜 unique 콘텐츠 분량으로 평가된다.
 * sentinel 형식은 lib/stories.ts의 AUTO_EXPAND_BLOCK_REGEX와 동기화 유지.
 */

const THIN_CONTENT_THRESHOLD = 1500;
const SHORTCODE_DEFAULT_CHAR_ESTIMATE = 80;
const SHORTCODE_CHAR_ESTIMATES = {
  'online-fallback': 120,
  'session-checklist': 420,
};
const AUTO_EXPAND_BLOCK_REGEX = /<!--\s*AUTO-EXPAND-V1\s*-->[\s\S]*?<!--\s*\/AUTO-EXPAND-V1\s*-->/g;

// 광역 허브 슬러그는 thin gate에서 제외. lib/regionHubSlugs.ts와 동기화 유지.
const REGION_HUB_SLUGS = new Set([
  'seoul1', 'incheon1', 'gwangju1', 'daegu1', 'busan1', 'ulsan1', 'daejeon1', 'sejong1',
  'gyeonggi1', 'gangwon1', 'chungbuk1', 'chungnam1', 'jeonbuk1', 'jeonnam1',
  'gyeongbuk1', 'gyeongnam1', 'jeju1', 'nationwide1',
]);

const isStoryThin = (slug, locale) => {
  // 광역 허브는 사이트 정보 구조상 색인되어야 하므로 게이트 제외.
  if (REGION_HUB_SLUGS.has(slug)) return false;
  const fm = getStoryFrontmatter(slug, locale);
  if (!fm) return true; // no file found → exclude
  // Exclude pages explicitly marked noindex (e.g., promotional event pages)
  if (typeof fm.data.robots === 'string' && /noindex/i.test(fm.data.robots)) return true;
  // AUTO-EXPAND 보일러플레이트 제거 후 unique 본문 분량으로 측정
  const uniqueContent = fm.content.replace(AUTO_EXPAND_BLOCK_REGEX, '');
  const rawNonWhitespace = uniqueContent.replace(/\s+/g, '').length;
  const shortcodeBonus = [...uniqueContent.matchAll(/%%([a-z-]+)%%/g)]
    .reduce((sum, m) => sum + (SHORTCODE_CHAR_ESTIMATES[m[1]] ?? SHORTCODE_DEFAULT_CHAR_ESTIMATE), 0);
  return (rawNonWhitespace + shortcodeBonus) < THIN_CONTENT_THRESHOLD;
};

module.exports = {
  THIN_CONTENT_THRESHOLD,
  SHORTCODE_CHAR_ESTIMATES,
  AUTO_EXPAND_BLOCK_REGEX,
  REGION_HUB_SLUGS,
  isStoryThin,
};
