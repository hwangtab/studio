import type { Story } from '../types/story';

const titleTokenize = (raw: string | undefined): string[] =>
  (raw || '')
    .toLowerCase()
    .split(/[\s·,—\-/|]+/)
    .filter((word) => word.length >= 2);

const toTime = (story: Story) => new Date(story.date).getTime() || 0;

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export const rankRelatedStories = (
  current: Story | undefined,
  candidates: Story[],
  limit = 6,
  now = Date.now(),
): Story[] => {
  if (!current) {
    return [...candidates]
      .sort((a, b) => toTime(b) - toTime(a))
      .slice(0, limit);
  }

  const currentTags = new Set(current.tags ?? []);
  const currentTitleWords = new Set(titleTokenize(current.title));

  const scored = candidates
    .map((item) => {
      const categoryMatch = item.categoryKey === current.categoryKey ? 3 : 0;
      const tagOverlap = (item.tags ?? []).filter((tag) => currentTags.has(tag)).length;
      const titleOverlap = titleTokenize(item.title).filter((word) => currentTitleWords.has(word)).length * 0.5;
      const recencyBoost = (now - toTime(item)) < NINETY_DAYS_MS ? 1 : 0;
      return { item, score: categoryMatch + tagOverlap + titleOverlap + recencyBoost };
    })
    .sort((a, b) => b.score - a.score || toTime(b.item) - toTime(a.item));

  const relevant = scored.filter(({ score }) => score > 0).map(({ item }) => item);
  if (relevant.length >= limit) return relevant.slice(0, limit);

  const seen = new Set(relevant.map((story) => story.slug));
  const fallback = candidates
    .filter((story) => !seen.has(story.slug))
    .sort((a, b) => toTime(b) - toTime(a));

  return [...relevant, ...fallback].slice(0, limit);
};
