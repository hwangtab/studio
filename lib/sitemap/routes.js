const path = require('node:path');
const { storiesDir, toIsoMtime, getStoryLastmod, getStoryCategory } = require('./storyMeta');

// 라우트별 alternateRefs(hreflang)와 lastmod 계산 헬퍼.
// 페이지 라우트는 pageRouteMap에 등록된 .tsx의 mtime을 사용해 buildTimestamp
// 고정으로 인한 freshness 신호 왜곡을 방지한다.

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://studionol.co.kr').replace(/\/+$/, '');
const LOCALES = ['ko', 'en', 'zh', 'es', 'vi', 'th', 'uz'];
// Google 공식 hreflang 코드 매핑 — lib/hreflang.json 단일 소스
const hreflangByLocale = require('../hreflang.json');

const portfolioDataFile = path.join(process.cwd(), 'data', 'portfolio.ts');
const localePageDir = path.join(process.cwd(), 'pages', '[locale]');

const pageRouteMap = {
  '/about': 'about.tsx',
  '/contact': 'contact.tsx',
  '/index': 'index.tsx',
  '/lesson': 'lesson.tsx',
  '/portfolio': 'portfolio.tsx',
  '/practice-room': 'practice-room.tsx',
  '/pricing': 'pricing.tsx',
  '/privacy-policy': 'privacy-policy.tsx',
  '/stories': path.join('stories', 'index.tsx'),
  '/studio-info': 'studio-info.tsx',
  '/wedding-song': 'wedding-song.tsx',
  '/voice-acting': 'voice-acting.tsx',
};

// 308 redirect 대상 슬러그는 sitemap에서도 제외 (next.config.mjs와 동기화).
const REDIRECTED_SLUGS = new Set(Object.keys(require('../regionRedirectMap.json')));

// /guides/ buyer-intent hub은 ko에서만 SSG된다. ko 외 locale에 hreflang을 발행하면
// 404 페이지를 가리키게 되므로 ko + x-default(=ko)만 반환.
const KO_ONLY_PATH_PREFIXES = ['/guides/'];

const getAlternateRefs = (routePath) => {
  const segments = routePath.split('/').filter(Boolean);
  if (segments.length === 0) return [];
  const firstSegment = segments[0];
  if (!LOCALES.includes(firstSegment)) return [];
  const restPath = segments.slice(1).join('/');
  const pathWithoutLocale = `/${restPath}`;
  const isKoOnly = KO_ONLY_PATH_PREFIXES.some((prefix) =>
    pathWithoutLocale.startsWith(prefix)
  );
  const localesForRefs = isKoOnly ? ['ko'] : LOCALES;

  const refs = localesForRefs.map((locale) => ({
    href: `${SITE_URL}/${locale}${restPath ? `/${restPath}` : ''}`,
    hreflang: hreflangByLocale[locale],
    hrefIsAbsolute: true,
  }));
  refs.push({
    href: `${SITE_URL}/ko${restPath ? `/${restPath}` : ''}`,
    hreflang: 'x-default',
    hrefIsAbsolute: true,
  });
  return refs;
};

const getRouteLastmod = (routePath, buildTimestamp) => {
  const segments = routePath.split('/').filter(Boolean);
  if (segments.length === 0) {
    return toIsoMtime(path.join(localePageDir, 'index.tsx')) || buildTimestamp;
  }

  const maybeLocale = segments[0];
  const pathWithoutLocale = LOCALES.includes(maybeLocale)
    ? `/${segments.slice(1).join('/') || 'index'}`
    : routePath;

  if (pathWithoutLocale.startsWith('/stories/')) {
    const slug = pathWithoutLocale.split('/')[2];
    if (slug) {
      const locale = LOCALES.includes(maybeLocale) ? maybeLocale : 'ko';
      return getStoryLastmod(slug, locale) || buildTimestamp;
    }
  }

  if (pathWithoutLocale.startsWith('/portfolio/')) {
    return toIsoMtime(portfolioDataFile) || buildTimestamp;
  }

  const pageFile = pageRouteMap[pathWithoutLocale];
  if (pageFile) {
    return toIsoMtime(path.join(localePageDir, pageFile)) || buildTimestamp;
  }

  return buildTimestamp;
};

// 카테고리별 최신 스토리 mtime — buildTimestamp 고정으로 인한 freshness 왜곡 방지.
const getCategoryLastmod = (categoryKey, slugs, locale) => {
  const mtimes = [];
  for (const slug of slugs) {
    if (getStoryCategory(slug, locale) === categoryKey) {
      const mtime = getStoryLastmod(slug, locale);
      if (mtime) mtimes.push(mtime);
    }
  }
  if (mtimes.length === 0) return null;
  return mtimes.sort().at(-1);
};

module.exports = {
  SITE_URL,
  LOCALES,
  hreflangByLocale,
  pageRouteMap,
  REDIRECTED_SLUGS,
  storiesDir,
  getAlternateRefs,
  getRouteLastmod,
  getCategoryLastmod,
};
