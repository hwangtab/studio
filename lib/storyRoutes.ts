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

export const buildTagPath = (locale: string, tag: string, page = 1): string => {
  const normalizedLocale = (locale as Locale) || defaultLocale;
  const encodedTag = encodeURIComponent(tag);
  return page > 1
    ? `/${normalizedLocale}/stories/tag/${encodedTag}/page/${page}`
    : `/${normalizedLocale}/stories/tag/${encodedTag}`;
};
