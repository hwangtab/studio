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
