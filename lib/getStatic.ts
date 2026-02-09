import type { GetStaticProps } from 'next';
import { defaultLocale, getLocaleI18nResources, locales, type Locale } from './i18n';

export const getCommonStaticPaths = async () => {
  return {
    paths: locales.map((locale) => ({ params: { locale } })),
    fallback: false,
  };
};

export const getCommonStaticProps: GetStaticProps = async ({ params }) => {
  const locale = (params?.locale as Locale) || defaultLocale;
  return {
    props: {
      locale,
      i18nResources: getLocaleI18nResources(locale),
    },
  };
};

export const getI18nStaticProps = (localeParam: unknown) => {
  const locale = (localeParam as Locale) || defaultLocale;

  return {
    locale,
    i18nResources: getLocaleI18nResources(locale),
  };
};
