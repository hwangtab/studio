const fs = require('node:fs');
const path = require('node:path');
const { storiesDir, toIsoMtime, getStoryLastmod, getStoryCategory, getStoryFrontmatter } = require('./storyMeta');
const { isStoryThin } = require('./thinContent');
const { fundingDir, readFundingProjects } = require('./fundingMeta');

// 라우트별 alternateRefs(hreflang)와 lastmod 계산 헬퍼.
// 페이지 라우트의 lastmod은 pageRouteMap에 등록된 소스 파일을 키로 lib/sitemap/pageLastmod.json
// (git 이력에서 생성·커밋)에서 읽는다. mtime은 그 JSON에 항목이 없을 때의 폴백일 뿐이다 —
// git이 mtime을 보존하지 않아 Vercel 배포마다 전 파일이 "방금 수정됨"으로 찍히기 때문.

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://studionol.co.kr').replace(/\/+$/, '');
const LOCALES = ['ko', 'en', 'zh', 'es', 'vi', 'th', 'uz'];
// Google 공식 hreflang 코드 매핑 — lib/hreflang.json 단일 소스
const hreflangByLocale = require('../hreflang.json');

const pageRouteMap = {
  '/about': 'about.tsx',
  '/artists': path.join('artists', 'index.tsx'),
  '/author': 'author.tsx',
  '/contact': 'contact.tsx',
  '/index': 'index.tsx',
  '/lesson': 'lesson.tsx',
  '/portfolio': 'portfolio.tsx',
  '/practice-room': 'practice-room.tsx',
  '/pricing': 'pricing.tsx',
  // 상업 LP 2종 — 누락 시 lastmod가 buildTimestamp 폴백으로 떨어진다(아래 릴리즈
  // 4라우트와 동일한 이유). /mixing-mastering은 enIndexablePaths 등재 라우트라
  // en alternate까지 함께 나가므로 특히 중요.
  '/recording': 'recording.tsx',
  '/mixing-mastering': 'mixing-mastering.tsx',
  '/privacy-policy': 'privacy-policy.tsx',
  '/stories': path.join('stories', 'index.tsx'),
  '/studio-info': 'studio-info.tsx',
  '/wedding-song': 'wedding-song.tsx',
  '/voice-acting': 'voice-acting.tsx',
  '/cover-video': 'cover-video.tsx',
  // 릴리즈 4라우트 — 누락 시 lastmod가 buildTimestamp로 떨어져 빌드마다 갱신된
  // 것처럼 보이는 가짜 freshness 신호가 나간다(이 맵의 존재 이유와 정면 충돌).
  '/release-project': path.join('release-project', 'index.tsx'),
  '/release-project/single': path.join('release-project', 'single.tsx'),
  '/release-project/ep': path.join('release-project', 'ep.tsx'),
  '/release-project/album': path.join('release-project', 'album.tsx'),
  '/funding': path.join('funding', 'index.tsx'),
};

// /guides/[slug]·/portfolio/[id]는 동적 라우트라 pageRouteMap 방식이 안 맞는다 —
// 허브·포트폴리오 콘텐츠의 단일 소스인 data/buyerIntentHubs.ts · data/portfolio.ts의
// 커밋 시각을 lastmod로 쓴다(그 데이터가 실제로 바뀔 때만 갱신).

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
const KO_ONLY_PATH_PREFIXES = ['/guides/', '/funding/'];

// 라우트 단위 en 색인 개방 대상(단일 소스는 lib/enIndexablePaths.json). 런타임
// (components/seo/metadataUrls.ts)과 동일 JSON을 참조해 사이트맵 alternate가 페이지
// hreflang과 정확히 일치하도록 유지한다.
// ⚠️ 엔트리 계약: self-canonical 상업 라우트만. 런타임은 canonical 파생 경로,
// 여기는 routePath로 키를 잡으므로 cross-locale canonical 엔트리는 두 소비자를
// 발산시킨다. metadataUrls.test.ts 'enIndexablePaths 계약' 테스트가 강제한다.
const EN_INDEXABLE_PATHS = new Set(require('../enIndexablePaths.json'));

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
  // 상업 3페이지(/pricing·/contact·/release-project)는 en도 색인 개방 → ko+en reciprocal.
  let localesForRefs = EN_INDEXABLE_PATHS.has(pathWithoutLocale) ? ['ko', 'en'] : ['ko'];

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

// 정적 페이지 라우트의 lastmod 소스. mtime을 먼저 쓰면 안 되는 이유는
// scripts/generate-page-lastmod.mjs 헤더 주석 참고 — git이 mtime을 보존하지 않고
// Vercel은 얕은 클론이라 배포마다 전 파일이 "방금 수정됨"으로 찍힌다.
// 이 JSON은 로컬에서 git 이력으로 생성해 commit하며, routes.test.js가 커버리지를 강제한다.
const pageLastmodByFile = (() => {
  try {
    return require('./pageLastmod.json');
  } catch {
    // 생성 전이거나 파일이 없으면 mtime 폴백으로 조용히 내려간다(빌드는 막지 않는다).
    return {};
  }
})();

/** 저장소 상대 경로 → 커밋된 lastmod. 없으면 mtime, 그것도 없으면 null. */
const getSourceLastmod = (repoRelPath) =>
  pageLastmodByFile[repoRelPath] || toIsoMtime(path.join(process.cwd(), repoRelPath)) || null;

const getRouteLastmod = (routePath, buildTimestamp) => {
  const segments = routePath.split('/').filter(Boolean);
  if (segments.length === 0) {
    return getSourceLastmod('pages/[locale]/index.tsx') || buildTimestamp;
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
    return getSourceLastmod('data/portfolio.ts') || buildTimestamp;
  }

  if (pathWithoutLocale.startsWith('/guides/')) {
    return getSourceLastmod('data/buyerIntentHubs.ts') || buildTimestamp;
  }

  if (pathWithoutLocale.startsWith('/artists/')) {
    return getSourceLastmod('data/artists/index.ts') || buildTimestamp;
  }

  if (pathWithoutLocale.startsWith('/funding/')) {
    const slug = pathWithoutLocale.split('/')[2];
    const entry = slug && readFundingProjects().find((p) => p.slug === slug);
    return (entry && entry.lastmod) || buildTimestamp;
  }

  const pageFile = pageRouteMap[pathWithoutLocale];
  if (pageFile) {
    return getSourceLastmod(`pages/[locale]/${pageFile.split(path.sep).join('/')}`) || buildTimestamp;
  }

  return buildTimestamp;
};

// frontmatter category는 정규화 전 라벨('악기 연습' 등)로 저장돼 있어 key('instrument')
// 와의 직접 비교는 항상 0매치 → getCategoryLastmod가 null만 반환하며 사장돼 있었다.
// ko i18n의 stories.categories(key→ko 라벨)를 매칭 집합에 합쳐 라벨·key 양쪽을 잡는다.
const KO_CATEGORY_LABELS = require('../../public/locales/ko/common.json').stories.categories;

// 카테고리별 최신 스토리 mtime — buildTimestamp 고정으로 인한 freshness 왜곡 방지.
const getCategoryLastmod = (categoryKey, slugs, locale) => {
  const accepted = new Set([categoryKey, KO_CATEGORY_LABELS[categoryKey]].filter(Boolean));
  const mtimes = [];
  for (const slug of slugs) {
    const category = getStoryCategory(slug, locale);
    if (category && accepted.has(category)) {
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
  fundingDir,
};
