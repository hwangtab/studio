import i18n, { applyI18nResources, defaultLocale, locales, type Locale } from './i18n';
import { getLocaleI18nResourcesServer, getLocaleI18nSectionsServer } from './i18n.server';

const initializeServerI18n = (locale: Locale, sections?: readonly string[]) => {
  if (typeof window !== 'undefined') return;

  const resources = sections
    ? getLocaleI18nSectionsServer(locale, sections)
    : getLocaleI18nResourcesServer(locale);
  applyI18nResources(resources);

  if (i18n.language !== locale && i18n.hasResourceBundle(locale, 'common')) {
    void i18n.changeLanguage(locale);
  }

  return resources;
};

interface BuildPageStaticPropsOptions {
  revalidate?: number;
  /** 페이지 전용 i18n 섹션 (common.json의 top-level key). CORE는 자동 포함.
   *  생략 시 기존 동작(전체 common.json 직렬화) 유지 — 호환성 위해. */
  i18nSections?: readonly string[];
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

export const getI18nStaticProps = (localeParam: unknown, sections?: readonly string[]) => {
  const locale = resolveLocaleParam(localeParam);
  const i18nResources = initializeServerI18n(locale, sections)
    || (sections ? getLocaleI18nSectionsServer(locale, sections) : getLocaleI18nResourcesServer(locale));

  return {
    locale,
    i18nResources,
  };
};

// extraProps는 빈 페이지의 경우에도 호출자가 `{}`를 명시 전달하므로 필수 인자.
// 옵셔널로 두면 TS가 호출 사이트에서 TProps 추론을 default(Record<string, never>)로
// 잡아 props에 누락이 생긴다. 필수로 두면 spread만으로 안전하게 합쳐진다.
export const buildPageStaticProps = <TProps extends Record<string, unknown>>(
  localeParam: unknown,
  extraProps: TProps,
  options: BuildPageStaticPropsOptions = {}
) => {
  const baseProps = getI18nStaticProps(localeParam, options.i18nSections);

  return {
    props: {
      ...baseProps,
      ...extraProps,
    },
    ...(typeof options.revalidate === 'number' ? { revalidate: options.revalidate } : {}),
  };
};
