import type { GetStaticProps } from 'next';
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

export const getCommonStaticPaths = async () => {
  return {
    paths: locales.map((locale) => ({ params: { locale } })),
    fallback: false,
  };
};

export const getCommonStaticProps: GetStaticProps = async ({ params }) => {
  const locale = (params?.locale as Locale) || defaultLocale;
  const i18nResources = initializeServerI18n(locale) || getLocaleI18nResourcesServer(locale);
  return {
    props: {
      locale,
      i18nResources,
    },
  };
};

export const getI18nStaticProps = (localeParam: unknown) => {
  const locale = (localeParam as Locale) || defaultLocale;
  const i18nResources = initializeServerI18n(locale) || getLocaleI18nResourcesServer(locale);

  return {
    locale,
    i18nResources,
  };
};
