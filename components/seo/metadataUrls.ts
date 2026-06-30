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

  const indexableAlternateLocales: Locale[] = locales
    .filter((candidateLocale) => candidateLocale === defaultLocale)
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
    effectiveRobots: (robots) => (currentLocale === defaultLocale ? robots : 'noindex, follow'),
    toAbsoluteUrl,
  };
};
