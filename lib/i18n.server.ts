import fs from 'fs';
import path from 'path';
import type { Resource } from 'i18next';
import { defaultLocale, type Locale } from './i18n-config';

const commonByLocaleCache: Partial<Record<Locale, Record<string, unknown>>> = {};
const enableCache = process.env.NODE_ENV === 'production';

const readLocaleFile = (targetLocale: Locale): Record<string, unknown> | null => {
  try {
    const localePath = path.join(process.cwd(), 'public', 'locales', targetLocale, 'common.json');
    if (!fs.existsSync(localePath)) {
      return null;
    }
    const raw = fs.readFileSync(localePath, 'utf8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
};

export const loadCommonResourceServer = (locale: Locale): Record<string, unknown> => {
  if (enableCache) {
    const cached = commonByLocaleCache[locale];
    if (cached) {
      return cached;
    }
  }

  const loaded = readLocaleFile(locale) ?? readLocaleFile(defaultLocale) ?? {};
  if (enableCache) {
    commonByLocaleCache[locale] = loaded;
  }
  return loaded;
};

export const getLocaleI18nResourcesServer = (locale: Locale): Resource => ({
  [locale]: {
    common: loadCommonResourceServer(locale),
  },
});

/**
 * 404/500 같이 locale를 모르는 상태로 정적 생성되는 페이지용.
 * 모든 locale의 CORE 섹션을 한 번에 번들해 클라이언트가 URL에서 locale 추론 후
 * 올바른 언어로 렌더할 수 있게 한다.
 */
export const getAllLocalesI18nResourcesServer = (): Resource => {
  const allLocales = ['ko', 'en', 'zh', 'es', 'vi', 'th', 'uz'] as const;
  const resource: Resource = {};
  for (const locale of allLocales) {
    resource[locale] = {
      common: loadCommonSectionsServer(locale as Locale, CORE_I18N_SECTIONS),
    };
  }
  return resource;
};

/**
 * 모든 페이지에서 공통으로 필요한 i18n 섹션.
 * Header/Footer/Layout/Error 경계 등 항상 렌더되는 요소에 쓰이는 키.
 */
export const CORE_I18N_SECTIONS = [
  'nav',
  'footer',
  'seo',
  'actions',
  'common',
  'theme',
  'reviewSection',
  'notFound',
  'serverError',
  'errors',
  'loading',
  'audioPlayer',
  'gallery',
  'pagination',
] as const;

/**
 * common.json의 top-level 키 중 지정된 것들만 반환.
 * __NEXT_DATA__ 직렬화 크기를 줄이는 데 사용한다. (common.json 77KB → 페이지별 3~10KB)
 */
export const loadCommonSectionsServer = (
  locale: Locale,
  sections: readonly string[]
): Record<string, unknown> => {
  const full = loadCommonResourceServer(locale);
  const result: Record<string, unknown> = {};
  for (const key of sections) {
    if (key in full) {
      result[key] = full[key];
    }
  }
  return result;
};

/**
 * 페이지 전용 섹션 + CORE를 합쳐 i18next Resource 형태로 반환.
 * 페이지의 getStaticProps에서 이 함수로 생성한 리소스만 직렬화.
 */
export const getLocaleI18nSectionsServer = (
  locale: Locale,
  pageSections: readonly string[]
): Resource => {
  const merged = Array.from(new Set([...CORE_I18N_SECTIONS, ...pageSections]));
  return {
    [locale]: {
      common: loadCommonSectionsServer(locale, merged),
    },
  };
};
