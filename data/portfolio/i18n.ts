import type { Locale } from '../../lib/i18n';

export type LocaleDict = {
  ko: string;
  en: string;
  zh?: string;
  es?: string;
  vi?: string;
  th?: string;
  uz?: string;
};

// Translation helper.
// 폴백 순서: 요청 locale → en → ko. lib/stories.ts의 resolveStoryFile과 동일한
// 컨벤션이며, es/vi/th/uz 등 비-한국어 사용자에게는 한국어보다 영어가 더 가까운
// 폴백이라는 표준 i18n 관행에 따른 것. ko-as-default는 "기본 라우트"를
// 가리키지 사이트 콘텐츠의 폴백 우선순위가 아니다.
export const translate = (locale: Locale, dict: LocaleDict): string => {
  return dict[locale] || dict.en || dict.ko;
};
