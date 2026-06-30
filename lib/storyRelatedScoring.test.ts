/** @jest-environment node */

import { rankRelatedStories } from './storyRelatedScoring';
import type { Story } from '../types/story';

const story = (overrides: Partial<Story> & Pick<Story, 'slug' | 'title' | 'categoryKey' | 'date'>): Story => ({
  ...overrides,
  id: overrides.slug,
  slug: overrides.slug,
  title: overrides.title,
  date: overrides.date,
  createdAt: overrides.date,
  author: '스튜디오 놀',
  category: overrides.categoryKey,
  categoryKey: overrides.categoryKey,
  tags: overrides.tags ?? [],
  summary: '',
  thumbnail: null,
  thumbnailDerived: false,
  images: [],
});

describe('rankRelatedStories', () => {
  it('prefers category, tag, title, and recency matches before newest fallback stories', () => {
    const now = new Date('2026-06-30T00:00:00Z').getTime();
    const current = story({
      slug: 'current',
      title: '보컬 녹음 마이크 선택',
      categoryKey: 'recording',
      tags: ['vocal', 'microphone'],
      date: '2026-06-01T00:00:00.000Z',
    });
    const candidates = [
      story({
        slug: 'newest-fallback',
        title: '작곡 노트',
        categoryKey: 'production',
        tags: [],
        date: '2026-06-29T00:00:00.000Z',
      }),
      story({
        slug: 'category-and-tag',
        title: '보컬 녹음 준비',
        categoryKey: 'recording',
        tags: ['vocal'],
        date: '2026-04-01T00:00:00.000Z',
      }),
      story({
        slug: 'tag-only',
        title: '마이크 보관',
        categoryKey: 'instrument',
        tags: ['microphone'],
        date: '2026-06-28T00:00:00.000Z',
      }),
    ];

    expect(rankRelatedStories(current, candidates, 3, now).map((item) => item.slug)).toEqual([
      'category-and-tag',
      'tag-only',
      'newest-fallback',
    ]);
  });

  it('returns newest candidates when the current story is missing', () => {
    const candidates = [
      story({ slug: 'old', title: 'old', categoryKey: 'recording', date: '2026-01-01T00:00:00.000Z' }),
      story({ slug: 'new', title: 'new', categoryKey: 'recording', date: '2026-06-01T00:00:00.000Z' }),
    ];

    expect(rankRelatedStories(undefined, candidates, 1).map((item) => item.slug)).toEqual(['new']);
  });
});
