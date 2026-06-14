/** @jest-environment node */

import type { NextApiRequest, NextApiResponse } from 'next';

import { getStaticProps as getStoriesStaticProps } from './pages/[locale]/stories';
import { getStaticProps as getCategoryStaticProps } from './pages/[locale]/stories/category/[key]';
import catalogHandler from './pages/api/stories/catalog';
import { getAllStories, isBrowsableStoryForLocale, isListableStory } from './lib/stories';

const createCatalogRequest = (query: Record<string, string>): NextApiRequest =>
  ({
    method: 'GET',
    query,
  } as NextApiRequest);

const createCatalogResponse = () => {
  let jsonBody: unknown;

  const res = {
    setHeader() {
      return this;
    },
    status() {
      return this;
    },
    json(payload: unknown) {
      jsonBody = payload;
      return this;
    },
  } as unknown as NextApiResponse;

  return {
    res,
    getJson: () => jsonBody as { stories: Array<{ slug: string }>; totalItems: number },
  };
};

describe('stories category static props', () => {
  it('omits noindex stories from the main stories page props', async () => {
    const result = await getStoriesStaticProps({ params: { locale: 'ko' } });
    expect('props' in result).toBe(true);
    if (!('props' in result)) return;

    const allStories = getAllStories('ko');
    const browsableStories = allStories.filter((story) => isBrowsableStoryForLocale(story, 'ko'));
    const props = result.props as unknown as {
      totalStories: number;
      initialStories: Array<{ slug: string }>;
      recentStories: Array<{ slug: string }>;
    };
    const exposedSlugs = [
      ...props.initialStories.map((story) => story.slug),
      ...props.recentStories.map((story) => story.slug),
    ];

    expect(props.totalStories).toBe(browsableStories.length);
    expect(exposedSlugs).not.toEqual(
      expect.arrayContaining(['interview4', 'review7', 'review8', 'bulgwang-mixing-club-3rd'])
    );
  });

  it('uses the browsable story count for the browse-all total', async () => {
    const result = await getCategoryStaticProps({ params: { locale: 'ko', key: 'region' } });
    expect('props' in result).toBe(true);
    if (!('props' in result)) return;

    const allStories = getAllStories('ko');
    const listableStories = allStories.filter(isListableStory);
    const browsableStories = allStories.filter((story) => isBrowsableStoryForLocale(story, 'ko'));
    const props = result.props as unknown as Record<string, unknown>;

    expect(props.allStoriesCount).toBe(browsableStories.length);
    expect(props.allStoriesCount).toBeLessThan(listableStories.length);
    expect(props.allStoriesCount).toBeLessThan(allStories.length);
  });

  it('omits noindex stories from the category catalog API', () => {
    const { res, getJson } = createCatalogResponse();

    catalogHandler(createCatalogRequest({
      locale: 'ko',
      category: 'feedback',
      page: '1',
      pageSize: '24',
    }), res);

    const allFeedbackStories = getAllStories('ko').filter((story) => story.categoryKey === 'feedback');
    const browsableFeedbackStories = allFeedbackStories.filter((story) =>
      isBrowsableStoryForLocale(story, 'ko')
    );
    const payload = getJson();
    const slugs = payload.stories.map((story) => story.slug);

    expect(payload.totalItems).toBe(browsableFeedbackStories.length);
    expect(payload.totalItems).toBeLessThan(allFeedbackStories.length);
    expect(slugs).not.toEqual(
      expect.arrayContaining(['interview4', 'review7', 'review8', 'review9', 'review5'])
    );
  });
});
