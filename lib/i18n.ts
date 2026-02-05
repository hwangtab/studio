import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import koCommon from '../public/locales/ko/common.json';
import enCommon from '../public/locales/en/common.json';
import zhCommon from '../public/locales/zh/common.json';
import esCommon from '../public/locales/es/common.json';
import viCommon from '../public/locales/vi/common.json';
import thCommon from '../public/locales/th/common.json';
import uzCommon from '../public/locales/uz/common.json';

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

export const resources = {
  ko: { common: koCommon },
  en: { common: enCommon },
  zh: { common: zhCommon },
  es: { common: esCommon },
  vi: { common: viCommon },
  th: { common: thCommon },
  uz: { common: uzCommon },
} as const;

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
