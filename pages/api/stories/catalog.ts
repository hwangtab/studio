import type { NextApiRequest, NextApiResponse } from 'next';
import { getAllStories, isBrowsableStoryForLocale } from '../../../lib/stories';
import { locales, defaultLocale, type Locale } from '../../../lib/i18n';
import { STORY_CATEGORY_KEYS, type StoryCategoryKey } from '../../../lib/storyCategories';
import type { StoryCardData } from '../../../types/story';

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 24;

const resolveLocale = (value: unknown): Locale => {
  if (typeof value !== 'string') return defaultLocale;
  return locales.includes(value as Locale) ? (value as Locale) : defaultLocale;
};

const resolvePageNumber = (value: unknown): number => {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.floor(parsed));
};

const resolvePageSize = (value: unknown): number => {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(parsed)));
};

const toStoryCardData = (story: ReturnType<typeof getAllStories>[number]): StoryCardData => ({
  slug: story.slug,
  id: story.id,
  title: story.title,
  date: story.date,
  categoryKey: story.categoryKey,
  thumbnail: story.thumbnail,
  ...(story.summary ? { summary: story.summary } : {}),
});

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const locale = resolveLocale(req.query.locale);
  const rawCategory = Array.isArray(req.query.category) ? req.query.category[0] : req.query.category;
  const category = rawCategory && rawCategory !== 'all' ? rawCategory : 'all';
  const page = resolvePageNumber(req.query.page);
  const pageSize = resolvePageSize(req.query.pageSize);

  if (category !== 'all' && !STORY_CATEGORY_KEYS.includes(category as StoryCategoryKey)) {
    res.status(400).json({ error: 'Invalid category' });
    return;
  }

  const allStories = getAllStories(locale).filter((story) =>
    isBrowsableStoryForLocale(story, locale)
  );
  const stories = category === 'all'
    ? allStories
    : allStories.filter((story) => story.categoryKey === category);

  const totalItems = stories.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageStories = stories.slice(start, start + pageSize).map(toStoryCardData);

  res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
  res.status(200).json({
    stories: pageStories,
    page: currentPage,
    pageSize,
    totalItems,
    totalPages,
  });
}
