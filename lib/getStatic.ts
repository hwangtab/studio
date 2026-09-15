import type { GetServerSideProps, GetServerSidePropsContext, GetServerSidePropsResult } from 'next';

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

/**
 * getServerSideProps에 locale·i18nResources를 자동으로 얹는다.
 *
 * _app.tsx는 pageProps.i18nResources에 현재 로케일 번들이 없으면 페이지 대신
 * "콘텐츠를 불러오는 중" 스피너 셸을 SSR한다(클라이언트가 번들을 받은 뒤에야 페이지가
 * 그려진다). getStaticProps 페이지는 buildPageStaticProps가 이걸 항상 채우는데,
 * getServerSideProps 페이지 7개(booking·subscribe·contracts)는 각자 props를 손으로
 * 돌려주면서 빠뜨렸다 — 2026-09-15 네이버 서치어드바이저가 /ko/booking/*를 "<title>
 * 없음·description 누락"으로 잡아 드러났다. 서버 HTML에 페이지의 <Head>(title·noindex)가
 * 통째로 없었고, JS 없는 클라이언트(카톡 미리보기 등)에는 빈 페이지가 갔다.
 *
 * redirect·notFound 결과는 그대로 통과시키고, props가 있을 때만 CORE 섹션(terms.tsx와
 * 같은 `[]`)을 합친다. 호출자가 locale을 이미 넣었다면 그쪽이 이긴다.
 */
export const withI18nServerProps = <TProps extends object>(
  inner: (context: GetServerSidePropsContext) => Promise<GetServerSidePropsResult<TProps>>,
  sections: readonly string[] = []
): GetServerSideProps<TProps & { locale: Locale; i18nResources: unknown }> => {
  return async (context) => {
    const result = await inner(context);
    if (!('props' in result)) return result;
    const base = getI18nStaticProps(context.params?.locale, sections);
    const props = await result.props;
    return { props: { ...base, ...props } as TProps & { locale: Locale; i18nResources: unknown } };
  };
};
