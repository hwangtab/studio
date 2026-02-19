export const defaultLocale = 'ko';
export const locales = ['ko', 'en', 'zh', 'es', 'vi', 'th', 'uz'] as const;
export type Locale = typeof locales[number];

export const ogLocaleByLocale: Record<Locale, string> = {
  ko: 'ko_KR',
  en: 'en_US',
  zh: 'zh_CN',
  es: 'es_ES',
  vi: 'vi_VN',
  th: 'th_TH',
  uz: 'uz_UZ',
};

export const localeNames: Record<Locale, string> = {
  ko: '한국어',
  en: 'English',
  zh: '中文',
  es: 'Español',
  vi: 'Tiếng Việt',
  th: 'ไทย',
  uz: "O‘zbekcha",
};
