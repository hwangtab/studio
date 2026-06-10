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

// 광역 허브 슬러그는 thin gate에서 제외. 단일 소스는 lib/regionHubSlugs.json —
// lib/regionHubSlugs.ts(런타임)도 동일 JSON을 import한다.
const REGION_HUB_SLUGS = new Set(require('../regionHubSlugs.json'));

const isStoryThin = (slug, locale) => {
  const fm = getStoryFrontmatter(slug, locale);
  if (!fm) return true; // no file found → exclude
  // robots: noindex 명시는 허브 예외보다 우선 — 명시적 noindex는 항상 sitemap에서 제외.
  // (런타임 hreflang 게이트 lib/stories.ts:isLocaleIndexable과 동일 순서. 이 순서가
  // 어긋나면 광역 허브 슬러그가 noindex인데도 sitemap에 남아 GSC "Submitted URL
  // marked noindex" 충돌이 발생한다.)
  if (typeof fm.data.robots === 'string' && /noindex/i.test(fm.data.robots)) return true;
  // 광역 허브는 thin 분량 게이트만 면제(색인 유지). noindex는 위에서 이미 처리됨.
  if (REGION_HUB_SLUGS.has(slug)) return false;
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
