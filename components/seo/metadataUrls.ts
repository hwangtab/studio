import { defaultLocale, locales, type Locale } from '../../lib/i18n-config';

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

  // 기본은 site-wide indexable locale인 ko만. native-only 예외 페이지는 현재 locale의
  // self-reference hreflang을 추가한다(ko가 availableLocales에 없으면 자연히 native만 남음).
  const indexableAlternateLocales: Locale[] = locales
    .filter((candidateLocale) =>
      candidateLocale === defaultLocale
      || (allowNonDefaultLocaleIndexing && candidateLocale === currentLocale))
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
      (currentLocale === defaultLocale || allowNonDefaultLocaleIndexing ? robots : 'noindex, follow'),
    toAbsoluteUrl,
  };
};
