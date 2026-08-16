import { AI_CITED_SLUGS, sortStoriesForLlms } from './llmsPriority';

const input = {
  curatedSlugs: ['curated-a', 'curated-b'],
  regionSlugs: ['region-a', 'region-b'],
};

const story = (slug: string) => ({ slug });

describe('sortStoriesForLlms', () => {
  it('AI 인용 실적이 있는 글을 선언 순서 그대로 맨 앞에 놓는다', () => {
    // 입력은 일부러 역순 — 발행일 정렬이 어떻든 밴드 순서가 이긴다.
    const stories = [...AI_CITED_SLUGS].reverse().map(story);
    const sorted = sortStoriesForLlms(stories, input);
    expect(sorted.map((s) => s.slug)).toEqual([...AI_CITED_SLUGS]);
  });

  it('밴드 우선순위는 AI 인용 → 큐레이션 → 지역 LP → 나머지 순이다', () => {
    const stories = [
      story('plain-1'),
      story('region-b'),
      story('curated-b'),
      story(AI_CITED_SLUGS[1]),
      story('curated-a'),
      story('region-a'),
      story(AI_CITED_SLUGS[0]),
      story('plain-2'),
    ];
    expect(sortStoriesForLlms(stories, input).map((s) => s.slug)).toEqual([
      AI_CITED_SLUGS[0],
      AI_CITED_SLUGS[1],
      'curated-a',
      'curated-b',
      'region-a',
      'region-b',
      'plain-1',
      'plain-2',
    ]);
  });

  it('꼬리(나머지)는 입력 순서 = 발행일 역순을 그대로 보존한다', () => {
    // 전부 동점이므로 sort의 안정성에 의존한다. 이게 깨지면 llms-full의 꼬리가
    // 매 빌드마다 뒤섞여 크롤러가 보는 순서가 불안정해진다.
    const stories = ['z', 'm', 'a', 'q'].map(story);
    expect(sortStoriesForLlms(stories, input).map((s) => s.slug)).toEqual(['z', 'm', 'a', 'q']);
  });

  it('입력 배열을 변형하지 않는다 (getAllStories 캐시 공유 배열이라 필수)', () => {
    const stories = [story('plain-1'), story(AI_CITED_SLUGS[0])];
    const snapshot = stories.map((s) => s.slug);
    sortStoriesForLlms(stories, input);
    expect(stories.map((s) => s.slug)).toEqual(snapshot);
  });

  it('AI 인용 목록에 중복이 없다 (중복 시 밴드 내 순위가 모호해짐)', () => {
    expect(new Set(AI_CITED_SLUGS).size).toBe(AI_CITED_SLUGS.length);
  });
});
