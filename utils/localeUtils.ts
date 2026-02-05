import { defaultLocale, locales, type Locale } from '../lib/i18n';

export const getClientLocale = (): Locale => {
  if (typeof navigator !== 'undefined') {
    const normalize = (value?: string) => value?.split('-')[0] as Locale | undefined;
    const preferred = Array.isArray(navigator.languages)
      ? navigator.languages.map(normalize).filter(Boolean) as Locale[]
      : [];
    for (const lang of preferred) {
      if (locales.includes(lang)) return lang;
    }
    const browserLang = normalize(navigator.language);
    if (browserLang && locales.includes(browserLang)) return browserLang;
  }
  return defaultLocale;
};
