const fs = require('node:fs');
const path = require('node:path');
const { storiesDir, toIsoMtime, getStoryLastmod, getStoryCategory, getStoryFrontmatter } = require('./storyMeta');
const { isStoryThin } = require('./thinContent');

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
  '/cover-video': 'cover-video.tsx',
};

// 308 redirect 대상 슬러그는 sitemap에서도 제외 (next.config.mjs와 동기화).
// regionRedirectMap(=middleware 308)의 키 + next.config.mjs redirects()의 story 슬러그를 합친다.
// next.config 단독 리다이렉트(예: practice-room-drum1)는 regionRedirectMap 키가 아니라
// 누락되어 사이트맵에 리다이렉트 URL이 새던 버그를 보강.
const NEXT_CONFIG_REDIRECTED_SLUGS = [
  'practice-room-drum1',
  'song-structure1',
  'english-speaking-music-lessons-seoul',
  'chinese-music-lessons-seoul',
];
const REDIRECTED_SLUGS = new Set([
  ...Object.keys(require('../regionRedirectMap.json')),
  ...NEXT_CONFIG_REDIRECTED_SLUGS,
]);

// /guides/ buyer-intent hub은 ko에서만 SSG된다. ko 외 locale에 hreflang을 발행하면
// 404 페이지를 가리키게 되므로 ko + x-default(=ko)만 반환.
const KO_ONLY_PATH_PREFIXES = ['/guides/'];

// stories/{slug} 단일 글 라우트의 locale별 색인 가능성 — thin/noindex 필터.
// sitemap의 <loc> emit 정책과 일치시켜 dangling alternate(예: ko가 thin이라
// <loc>에 없는데 외국어 URL이 ko alternate를 가리키는 경우)을 차단한다.
const isLocaleStoryIndexable = (slug, locale) => {
  // site-wide 비-ko noindex 정책: ko 원본(slug.md)이 존재하는(=번역본) 스토리의 비-ko
  // 페이지는 항상 비색인 — ko가 thin/noindex라도 예외가 아니다. ko 원본이 없는
  // native-only 스토리만 native locale에서 색인 가능(런타임 예외
  // components/seo/metadataUrls.ts effectiveRobots의 allowNonDefaultLocaleIndexing와 대칭).
  if (locale !== 'ko' && fs.existsSync(path.join(storiesDir, `${slug}.md`))) return false;
  const filePath = locale === 'ko'
    ? path.join(storiesDir, `${slug}.md`)
    : path.join(storiesDir, `${slug}.${locale}.md`);
  if (!fs.existsSync(filePath)) return false;
  const fm = getStoryFrontmatter(slug, locale);
  if (!fm) return false;
  if (typeof fm.data.robots === 'string' && /noindex/i.test(fm.data.robots)) return false;
  if (isStoryThin(slug, locale)) return false;
  return true;
};

// 슬러그가 sitemap <loc>으로 등재될 locale 목록 — "등재 ⇔ 색인 가능" 불변식의
// sitemap측 단일 소스. 일반 스토리는 ['ko'](ko thin/noindex면 []), ko 원본 없는
// native-only 스토리는 native locale만 반환된다.
const getIndexableStoryLocales = (slug) =>
  LOCALES.filter((locale) => isLocaleStoryIndexable(slug, locale));

const getAlternateRefs = (routePath) => {
  const segments = routePath.split('/').filter(Boolean);
  if (segments.length === 0) return [];
  const firstSegment = segments[0];
  if (!LOCALES.includes(firstSegment)) return [];
  const restPath = segments.slice(1).join('/');
  const pathWithoutLocale = `/${restPath}`;
  // 비-ko locale은 site-wide noindex 정책이라(components/SEO.tsx effectiveRobots 참고)
  // hreflang/sitemap alternate에서도 ko만 emit. Google 가이드: alternate는 indexable URL만.
  // KO_ONLY_PATH_PREFIXES 분기는 비-ko 인덱싱 복원 시점에 다시 살릴 수 있도록 변수만 보존.
  void KO_ONLY_PATH_PREFIXES;
  let localesForRefs = ['ko'];

  // stories/{slug} 단일 글 라우트에 한해 locale별 thin/noindex + native-only 정책 게이트.
  // 일반 스토리는 결과가 ['ko']/[]로 종전과 동일하고, ko 원본 없는 native-only 스토리만
  // native locale self-reference가 남는다(x-default는 아래 ko 게이트로 자연 제외).
  // /stories/category/{key}는 정규식이 catch하지 않으므로 영향 없음.
  const storiesMatch = pathWithoutLocale.match(/^\/stories\/([^/]+)\/?$/);
  if (storiesMatch) {
    const slug = storiesMatch[1];
    localesForRefs = getIndexableStoryLocales(slug);
  }

  if (localesForRefs.length === 0) return [];

  const refs = localesForRefs.map((locale) => ({
    href: `${SITE_URL}/${locale}${restPath ? `/${restPath}` : ''}`,
    hreflang: hreflangByLocale[locale],
    hrefIsAbsolute: true,
  }));
  // x-default는 ko가 indexable일 때만. 그렇지 않으면 dangling.
  if (localesForRefs.includes('ko')) {
    refs.push({
      href: `${SITE_URL}/ko${restPath ? `/${restPath}` : ''}`,
      hreflang: 'x-default',
      hrefIsAbsolute: true,
    });
  }
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
  getIndexableStoryLocales,
  getRouteLastmod,
  getCategoryLastmod,
};
