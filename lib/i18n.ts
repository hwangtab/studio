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
const commonByLocalePending: Partial<Record<Locale, Promise<Record<string, unknown>>>> = {};

const getClientInitialResources = (): Resource => {
  if (typeof window === 'undefined') {
    return {};
  }

  const nextData = (window as typeof window & {
    __NEXT_DATA__?: { props?: { pageProps?: { i18nResources?: unknown } } };
  }).__NEXT_DATA__;

  const resources = nextData?.props?.pageProps?.i18nResources;
  if (!resources || typeof resources !== 'object') {
    return {};
  }

  return resources as Resource;
};

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
  const fs = nodeRequire('node:fs') as typeof import('node:fs');

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

  const loaded = readLocaleFile(locale) ?? readLocaleFile(defaultLocale) ?? {};
  commonByLocaleCache[locale] = loaded;
  return loaded;
};

export const loadCommonResourceClient = async (locale: Locale): Promise<Record<string, unknown>> => {
  const cached = commonByLocaleCache[locale];
  if (cached) {
    return cached;
  }

  if (typeof window === 'undefined') {
    return loadCommonResource(locale);
  }

  const pending = commonByLocalePending[locale];
  if (pending) {
    return pending;
  }

  const loader = fetch(`/locales/${locale}/common.json`)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load common resources for locale: ${locale}`);
      }
      const data = (await response.json()) as Record<string, unknown>;
      commonByLocaleCache[locale] = data;
      return data;
    })
    .finally(() => {
      delete commonByLocalePending[locale];
    });

  commonByLocalePending[locale] = loader;
  return loader;
};

// Initialize with empty resources on client, server-side props will merge actual translations.
// This prevents empty bundles from blocking real resource injection in _app.tsx.
export const resources: Resource =
  typeof window === 'undefined'
    ? locales.reduce<Resource>((acc, locale) => {
      acc[locale] = { common: loadCommonResource(locale) };
      return acc;
    }, {})
    : getClientInitialResources();

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
