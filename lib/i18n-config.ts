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

// Google 공식 hreflang 코드 매핑
// 'zh' 단독 코드는 Google이 무시하므로 'zh-Hans'(간체) 사용
export const hreflangByLocale: Record<Locale, string> = {
  ko: 'ko',
  en: 'en',
  zh: 'zh-Hans',
  es: 'es',
  vi: 'vi',
  th: 'th',
  uz: 'uz',
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
