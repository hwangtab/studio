import {
  buildStoryDynamicOgImage,
  buildStoryExtraSchemas,
  buildStoryMetaDescription,
  getStoryWordCount,
} from './storySeoData';
import type { StoryDetail } from '../types/story';

const baseStory: Pick<StoryDetail, 'slug' | 'title' | 'summary' | 'faq' | 'howTo'> = {
  slug: 'mixing-guide',
  title: 'Mixing Guide',
  summary: 'Short summary',
};

describe('storySeoData', () => {
  describe('getStoryWordCount', () => {
    it('counts CJK and Thai locales by non-space characters after markdown stripping', () => {
      expect(getStoryWordCount('안녕 **세계**', 'ko')).toBe(4);
      expect(getStoryWordCount('สวัสดี **โลก**', 'th')).toBe(9);
    });

    it('counts space-delimited locales by words after markdown stripping', () => {
      expect(getStoryWordCount('Hello **wide** world', 'en')).toBe(3);
    });
  });

  it('builds a markdown-stripped meta description with the existing 160-character cap', () => {
    expect(buildStoryMetaDescription('# Hello **wide** world')).toBe('Hello wide world');
    expect(buildStoryMetaDescription('a'.repeat(170))).toHaveLength(160);
  });

  it('builds an encoded dynamic OG image URL for social scrapers', () => {
    expect(buildStoryDynamicOgImage({
      title: 'A&B mix',
      category: 'Mixing Tips',
      date: '2026-06-30',
      locale: 'en',
    })).toBe('/api/og/story?title=A%26B%20mix&category=Mixing%20Tips&date=2026-06-30&locale=en');
  });

  it('includes FAQ, HowTo, and Korean practice-room offer schemas when eligible', () => {
    const schemas = buildStoryExtraSchemas({
      story: {
        ...baseStory,
        slug: 'practice-room-hongdae',
        faq: [{ q: 'Question?', a: 'Answer.' }],
        howTo: {
          steps: [{ name: 'Step one', text: 'Do the thing.' }],
        },
      },
      locale: 'ko',
      siteUrl: 'https://example.com',
    });

    expect(schemas?.map((schema) => schema['@type'])).toEqual(['FAQPage', 'HowTo', 'Service']);
  });

  it('omits extra schemas when story metadata has no eligible schema sources', () => {
    expect(buildStoryExtraSchemas({
      story: baseStory,
      locale: 'en',
      siteUrl: 'https://example.com',
    })).toBeUndefined();
  });
});
