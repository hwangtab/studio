import i18n, { applyI18nResources, defaultLocale, locales, type Locale } from './i18n';
import { getLocaleI18nResourcesServer } from './i18n.server';

const initializeServerI18n = (locale: Locale) => {
  if (typeof window !== 'undefined') return;

  const resources = getLocaleI18nResourcesServer(locale);
  applyI18nResources(resources);

  if (i18n.language !== locale && i18n.hasResourceBundle(locale, 'common')) {
    void i18n.changeLanguage(locale);
  }

  return resources;
};

interface BuildPageStaticPropsOptions {
  revalidate?: number;
}

export const getCommonStaticPaths = async () => {
  return {
    paths: locales.map((locale) => ({ params: { locale } })),
    fallback: false,
  };
};

export const resolveLocaleParam = (localeParam: unknown): Locale => {
  if (typeof localeParam !== 'string') {
    return defaultLocale;
  }

  return locales.includes(localeParam as Locale)
    ? (localeParam as Locale)
    : defaultLocale;
};

export const getI18nStaticProps = (localeParam: unknown) => {
  const locale = resolveLocaleParam(localeParam);
  const i18nResources = initializeServerI18n(locale) || getLocaleI18nResourcesServer(locale);

  return {
    locale,
    i18nResources,
  };
};

export const buildPageStaticProps = <TProps extends object>(
  localeParam: unknown,
  extraProps: TProps = {} as TProps,
  options: BuildPageStaticPropsOptions = {}
) => {
  const baseProps = getI18nStaticProps(localeParam);

  return {
    props: {
      ...baseProps,
      ...extraProps,
    },
    ...(typeof options.revalidate === 'number' ? { revalidate: options.revalidate } : {}),
  };
};
