import { isRegionHub } from './regionHubSlugs';

// AUTO-EXPAND-V1 블록은 지역 가이드 페이지 등에 자동 삽입된 보일러플레이트 섹션이다.
// 본문에 그대로 포함되면 도시명만 치환된 동일 텍스트가 1,400+개 페이지에 중복되어
// Google "doorway page" 신호가 된다. 본문에서 분리해 별도 영역으로 노출하면
// (1) thin-content 게이트가 정상 동작하고 (2) Googlebot이 사이트 boilerplate로 인식한다.
// next-sitemap.config.js의 isStoryThin과 sentinel 형식이 동기화되어야 한다.
const AUTO_EXPAND_BLOCK_REGEX = /<!--\s*AUTO-EXPAND-V1\s*-->[\s\S]*?<!--\s*\/AUTO-EXPAND-V1\s*-->/g;

export const extractAutoExpandBlock = (source: string): { stripped: string; block: string | null } => {
  if (!source || !source.includes('AUTO-EXPAND-V1')) {
    return { stripped: source, block: null };
  }
  const matches = source.match(AUTO_EXPAND_BLOCK_REGEX);
  if (!matches || matches.length === 0) {
    return { stripped: source, block: null };
  }
  const block = matches
    .map((m) => m.replace(/^<!--\s*AUTO-EXPAND-V1\s*-->\s*/, '').replace(/\s*<!--\s*\/AUTO-EXPAND-V1\s*-->$/, ''))
    .join('\n\n')
    .trim();
  const stripped = source.replace(AUTO_EXPAND_BLOCK_REGEX, '').replace(/\n{3,}/g, '\n\n');
  return { stripped, block: block.length > 0 ? block : null };
};

/**
 * AUTO-EXPAND 보일러플레이트 분리 후 본문 분량(글자 수 + 쇼트코드 보너스)으로
 * thin-content 여부를 판정한다. next-sitemap.config.js의 isStoryThin과 동일한
 * 임계·로직을 공유하며, 광역 허브는 사이트 정보 구조상 색인이 필요해 제외.
 *
 * @param contentAfterAutoExpandStrip AUTO-EXPAND 블록을 분리한 본문 (extractAutoExpandBlock의 stripped)
 * @param slug 광역 허브 게이트 적용을 위한 슬러그
 */
export const THIN_CONTENT_THRESHOLD = 1500;
// 숏코드가 렌더하는 실제 텍스트 분량(공백 제외). thin 판정에 직접 들어가므로
// 컴포넌트 문구를 고치면 여기도 같이 맞춰야 한다 — 추정이 실제보다 크면 thin 페이지가
// 색인 대상으로 잘못 분류된다. session-checklist는 실측 160자(컴포넌트 항목 7개 + 소제목 2개).
export const SHORTCODE_CHAR_ESTIMATES: Record<string, number> = {
  'online-fallback': 120,
  'session-checklist': 160,
  'studio-more': 204,
};
export const SHORTCODE_DEFAULT_CHAR_ESTIMATE = 80;

export const computeThinContentStatus = (
  contentAfterAutoExpandStrip: string,
  slug: string,
): { isThinContent: boolean; charCount: number } => {
  const shortcodeBonus = [...contentAfterAutoExpandStrip.matchAll(/%%([a-z-]+)%%/g)]
    .reduce((sum, m) => sum + (SHORTCODE_CHAR_ESTIMATES[m[1]] ?? SHORTCODE_DEFAULT_CHAR_ESTIMATE), 0);
  const rawNonWhitespace = contentAfterAutoExpandStrip.replace(/\s+/g, '').length;
  const charCount = rawNonWhitespace + shortcodeBonus;
  const isThinContent = !isRegionHub(slug) && charCount < THIN_CONTENT_THRESHOLD;
  return { isThinContent, charCount };
};
