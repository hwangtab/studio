import i18n, { Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { defaultLocale, localeNames, locales, type Locale } from './i18n-config';

export { defaultLocale, localeNames, locales };
export type { Locale };

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

export const loadCommonResourceClient = async (locale: Locale): Promise<Record<string, unknown>> => {
  const cached = commonByLocaleCache[locale];
  if (cached) {
    return cached;
  }

  if (typeof window === 'undefined') {
    return {};
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

export const applyI18nResources = (resourceInput: unknown): void => {
  if (!resourceInput || typeof resourceInput !== 'object') {
    return;
  }

  Object.entries(resourceInput as Record<string, unknown>).forEach(([lng, namespaces]) => {
    if (!namespaces || typeof namespaces !== 'object') {
      return;
    }

    Object.entries(namespaces as Record<string, unknown>).forEach(([ns, data]) => {
      if (!data || typeof data !== 'object') {
        return;
      }
      i18n.addResourceBundle(lng, ns, data, true, true);
    });
  });
};

export const resources: Resource =
  typeof window === 'undefined' ? {} : getClientInitialResources();

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
