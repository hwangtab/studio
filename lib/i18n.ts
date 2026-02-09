import i18n, { Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';

export const defaultLocale = 'ko';
export const locales = ['ko', 'en', 'zh', 'es', 'vi', 'th', 'uz'] as const;
export type Locale = typeof locales[number];

export const localeNames: Record<Locale, string> = {
  ko: '한국어',
  en: 'English',
  zh: '中文',
  es: 'Español',
  vi: 'Tiếng Việt',
  th: 'ไทย',
  uz: "O‘zbekcha",
};

const commonByLocaleCache: Partial<Record<Locale, Record<string, unknown>>> = {};

export const loadCommonResource = (locale: Locale): Record<string, unknown> => {
  const cached = commonByLocaleCache[locale];
  if (cached) {
    return cached;
  }

  if (typeof window !== 'undefined') {
    return {};
  }

  const nodeRequire = eval('require') as NodeRequire;
  const path = nodeRequire('node:path') as typeof import('node:path');
  const localePath = path.join(process.cwd(), 'public', 'locales', locale, 'common.json');
  const common = nodeRequire(localePath) as Record<string, unknown>;
  commonByLocaleCache[locale] = common;

  return common;
};

// Initialize with empty resources on client, server-side props will merge actual translations.
// This prevents empty bundles from blocking real resource injection in _app.tsx.
export const resources: Resource =
  typeof window === 'undefined'
    ? { ko: { common: loadCommonResource(defaultLocale) } }
    : {};

export const getLocaleI18nResources = (locale: Locale): Resource => ({
  [locale]: {
    common: loadCommonResource(locale),
  },
});

if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: defaultLocale,
      fallbackLng: defaultLocale,
      supportedLngs: [...locales],
      ns: ['common'],
      defaultNS: 'common',
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
    });
}

export default i18n;
