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

  describe('buildStoryMetaDescription', () => {
    it('returns markdown-stripped text unchanged when it is under the 160-character cap', () => {
      expect(buildStoryMetaDescription('# Hello **wide** world')).toBe('Hello wide world');
    });

    it('truncates at the last sentence boundary within the limit and appends an ellipsis', () => {
      const sentence = '이 문장은 충분히 깁니다. '.repeat(1) + '두 번째 문장도 이어집니다.';
      const content = sentence.repeat(6);
      const result = buildStoryMetaDescription(content);

      expect(result.length).toBeLessThanOrEqual(160);
      expect(result.endsWith('…')).toBe(true);
      expect(result).toBe(`${result.slice(0, -1)}…`);
      // 말줄임표 앞은 문장부호로 끝나야 한다(하드 절단이 아니라 경계에서 잘렸다는 증거).
      expect(/[.!?]…$/.test(result) || /(다|요)\.…$/.test(result)).toBe(true);
    });

    it('does not treat a numbered-list marker like "1." as a sentence boundary', () => {
      const content = '부산에서 출발해 연신내 스튜디오까지 이동하는 경로는 다음과 같습니다. '
        + '1. 부산역에서 KTX를 타고 서울역으로 이동합니다. '
        + '2. 서울역에서 3호선으로 환승해 연신내역까지 갑니다. '
        + '3. 연신내역 2번 출구로 나오면 도보 5분 거리에 스튜디오가 있습니다. '
        + '전체 소요 시간은 약 세 시간에서 네 시간 정도입니다.';
      const result = buildStoryMetaDescription(content);

      expect(result.length).toBeLessThanOrEqual(160);
      expect(result.endsWith('…')).toBe(true);
      // 잘린 지점이 "1." 처럼 번호 직후가 아니라 실제 문장 종결이어야 한다.
      expect(/\d\.…$/.test(result)).toBe(false);
    });

    it('falls back to the last space boundary when no sentence punctuation is found', () => {
      const words = Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ');
      const result = buildStoryMetaDescription(words);

      expect(result.length).toBeLessThanOrEqual(160);
      expect(result.endsWith('…')).toBe(true);
      expect(result.slice(0, -1).endsWith(' ')).toBe(false);
    });

    it('hard-truncates and appends an ellipsis when there is no space or sentence boundary', () => {
      const result = buildStoryMetaDescription('a'.repeat(170));

      expect(result).toHaveLength(160);
      expect(result.endsWith('…')).toBe(true);
      expect(result).toBe(`${'a'.repeat(159)}…`);
    });

    it('handles empty/whitespace-only content without throwing', () => {
      expect(buildStoryMetaDescription('   ')).toBe('');
      expect(buildStoryMetaDescription(null)).toBe('');
      expect(buildStoryMetaDescription(undefined)).toBe('');
    });
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
