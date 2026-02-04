import { defaultLocale, locales, type Locale } from '../lib/i18n';

export const getClientLocale = (): Locale => {
  if (typeof navigator !== 'undefined') {
    const browserLang = navigator.language?.split('-')[0] as Locale | undefined;
    if (browserLang && locales.includes(browserLang)) {
      return browserLang;
    }
  }
  return defaultLocale;
};
