import { defaultLocale, type Locale } from './i18n';
import type { StoryCategoryKey } from '../types/story';

export const buildStoriesPath = (
  locale: string,
  categoryKey: StoryCategoryKey | null = null,
  page = 1
): string => {
  const normalizedLocale = (locale as Locale) || defaultLocale;

  if (categoryKey) {
    return page > 1
      ? `/${normalizedLocale}/stories/category/${categoryKey}/page/${page}`
      : `/${normalizedLocale}/stories/category/${categoryKey}`;
  }

  return page > 1
    ? `/${normalizedLocale}/stories/page/${page}`
    : `/${normalizedLocale}/stories`;
};
