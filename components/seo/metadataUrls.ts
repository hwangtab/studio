import { defaultLocale, locales, type Locale } from '../../lib/i18n-config';
import enIndexablePaths from '../../lib/enIndexablePaths.json';

// 라우트 단위 비-ko 색인 예외의 단일 소스. 여기 등재된 경로(로케일 제외)의 en 버전은
// 실제로 완전 번역된 상업 페이지라 색인을 열고 ko↔en reciprocal hreflang을 emit한다.
// 사이트맵(lib/sitemap/routes.js·next-sitemap.config.js)도 동일 JSON을 참조해
// "사이트맵 등재 ⇔ 색인가능" 불변식을 구조적으로 유지한다.
//
// ⚠️ 엔트리 계약: **self-canonical 상업 라우트만** 등재할 것. 런타임(여기)은 canonical
// 파생 경로로, 사이트맵은 routePath로 키를 잡는다 — 두 키는 페이지가 self-canonical일
// 때만 일치한다. stories/portfolio 폴백처럼 cross-locale canonical을 쓰는 경로를
// 추가하면 런타임과 사이트맵이 발산한다(런타임 색인·사이트맵 누락 등).
// metadataUrls.test.ts의 'enIndexablePaths 계약' 테스트가 모든 엔트리를 자동 검증한다.
const EN_INDEXABLE_PATHS = new Set<string>(enIndexablePaths as string[]);

interface ResolveSeoPathStateOptions {
  asPath: string;
  locale?: Locale;
}

export interface SeoPathState {
  currentPath: string;
  currentLocale: Locale;
  pathWithoutLocale: string;
}

interface ResolveSeoUrlStateOptions extends ResolveSeoPathStateOptions {
  siteUrl: string;
  canonical?: string;
  disableUrlMetaAndAlternates?: boolean;
  disableAlternates?: boolean;
  availableLocales?: readonly Locale[];
  /**
   * site-wide 비-ko noindex 정책의 예외 스위치. ko 원본 없는 native-only 스토리의
   * native locale 페이지처럼 "이 locale이 콘텐츠의 원본"인 페이지에서만 true.
   * true면 effectiveRobots가 robots를 그대로 통과시키고, hreflang에 현재 locale의
   * self-reference가 추가된다(사이트맵 lib/sitemap/routes.js 등재 정책과 대칭).
   */
  allowNonDefaultLocaleIndexing?: boolean;
  pathState?: SeoPathState;
}

export interface SeoUrlState extends SeoPathState {
  normalizedCanonical: string;
  alternatePath: string;
  shouldRenderAlternates: boolean;
  indexableAlternateLocales: Locale[];
  xDefaultHref: string | null;
  effectiveRobots: (robots: string) => string;
  toAbsoluteUrl: (value?: string) => string;
  alternateHrefFor: (locale: Locale) => string | null;
}

const trimTrailingSlash = (url: string, siteUrl: string) => {
  if (url.endsWith('/') && url !== `${siteUrl}/`) {
    return url.slice(0, -1);
  }
  return url;
};

export const resolveSeoPathState = ({
  asPath,
  locale,
}: ResolveSeoPathStateOptions): SeoPathState => {
  const currentPath = asPath.split('?')[0].split('#')[0];
  const segments = currentPath.split('/');
  let pathWithoutLocale = currentPath;
  let currentLocale: Locale = locale ?? defaultLocale;

  if (locales.includes(segments[1] as Locale)) {
    if (!locale) {
      currentLocale = segments[1] as Locale;
    }
    pathWithoutLocale = `/${segments.slice(2).join('/')}`;
  }

  if (pathWithoutLocale === '//') pathWithoutLocale = '/';

  return {
    currentPath,
    currentLocale,
    pathWithoutLocale,
  };
};

export const resolveSeoUrlState = ({
  asPath,
  siteUrl,
  canonical,
  disableUrlMetaAndAlternates = false,
  disableAlternates = false,
  availableLocales,
  allowNonDefaultLocaleIndexing = false,
  locale,
  pathState,
}: ResolveSeoUrlStateOptions): SeoUrlState => {
  const {
    currentPath,
    currentLocale,
    pathWithoutLocale,
  } = pathState ?? resolveSeoPathState({ asPath, locale });

  const toAbsoluteUrl = (value = '') => {
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) {
      return value;
    }
    const sanitized = value.startsWith('/') ? value : `/${value.replace(/^\/+/, '')}`;
    return `${siteUrl}${sanitized}`;
  };

  const derivedCanonical = canonical || `${siteUrl}${currentPath}`;
  const canonicalUrl = toAbsoluteUrl(derivedCanonical);
  const normalizedCanonical = trimTrailingSlash(canonicalUrl, siteUrl);

  const alternatePath = (() => {
    try {
      const url = new URL(normalizedCanonical);
      if (url.origin !== siteUrl) {
        return pathWithoutLocale;
      }

      const urlSegments = url.pathname.split('/');
      const path = locales.includes(urlSegments[1] as Locale)
        ? `/${urlSegments.slice(2).join('/')}`
        : url.pathname;

      const normalizedPath = path === '//' || path === '' ? '/' : path;
      return `${normalizedPath}${url.search}`;
    } catch {
      return pathWithoutLocale;
    }
  })();

  // 색인 가능 locale 집합:
  //  - 항상 defaultLocale(ko)
  //  - 라우트가 EN_INDEXABLE_PATHS에 있으면 en (currentLocale과 무관하게 추가 → ko·en
  //    양쪽 렌더가 reciprocal hreflang을 emit하고, zh 등 나머지는 noindex인 채 두 색인본을 가리킴)
  //  - native-only 예외 페이지는 현재 locale(allowNonDefaultLocaleIndexing)
  //
  // 화이트리스트 판정은 canonical 파생 경로(alternatePath)로 한다. pathWithoutLocale은
  // asPath 파생이라 SSG 중 asPath가 ''/'/ko'로 폴백되면(이 파일이 locale prop을 두는 이유)
  // '/'로 계산돼 화이트리스트를 못 맞추고 /en/pricing에 잘못된 noindex를 굽는다. canonical은
  // 상업 페이지가 명시적으로 넘기므로 신뢰 가능.
  const canonicalPathWithoutLocale = alternatePath.split('?')[0] || '/';
  const routeIndexableLocales: Locale[] = EN_INDEXABLE_PATHS.has(canonicalPathWithoutLocale) ? ['en'] : [];
  const indexableLocaleSet = new Set<Locale>([
    defaultLocale,
    ...routeIndexableLocales,
    ...(allowNonDefaultLocaleIndexing ? [currentLocale] : []),
  ]);

  const indexableAlternateLocales: Locale[] = locales
    .filter((candidateLocale) => indexableLocaleSet.has(candidateLocale))
    .filter((candidateLocale) => !availableLocales || availableLocales.includes(candidateLocale));

  const shouldRenderAlternates = !disableUrlMetaAndAlternates && !disableAlternates;

  const alternateHrefFor = (alternateLocale: Locale) => {
    if (!shouldRenderAlternates || !indexableAlternateLocales.includes(alternateLocale)) {
      return null;
    }
    return `${siteUrl}/${alternateLocale}${alternatePath === '/' ? '' : alternatePath}`;
  };

  return {
    currentPath,
    currentLocale,
    pathWithoutLocale,
    normalizedCanonical,
    alternatePath,
    shouldRenderAlternates,
    indexableAlternateLocales,
    alternateHrefFor,
    xDefaultHref: alternateHrefFor(defaultLocale),
    // 비-ko는 site-wide noindex. 단 native-only 예외 페이지(ko 원본 없는 스토리의
    // native locale)는 robots를 그대로 통과 — 페이지 단 robots(thin/frontmatter noindex)는
    // 호출부 인자로 이미 반영돼 있으므로 사이트맵 등재 ⇔ 색인가능 불변식이 유지된다.
    effectiveRobots: (robots) =>
      (indexableLocaleSet.has(currentLocale) ? robots : 'noindex, follow'),
    toAbsoluteUrl,
  };
};
