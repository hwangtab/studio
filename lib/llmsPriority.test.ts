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

describe('AI_CITED_SLUGS 데이터 무결성', () => {
  // 이 목록은 llms 색인 파일의 최상단을 결정한다. 리다이렉트 출발지가 섞이면
  // 죽은 URL을 AI에게 "대표 문서"라고 내미는 꼴이 된다.
  // 실제로 한 번 헛디뎠다: next.config를 슬러그로만 grep하면 destination 줄까지 걸려
  // 생존자인 songstructure1이 리다이렉트로 오판된다. 판정은 source만 봐야 한다.
  const redirectSources = (): Set<string> => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const regionMap = require('./regionRedirectMap.json') as Record<string, string>;
    const sources = new Set(Object.keys(regionMap));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs') as typeof import('node:fs');
    const cfg = fs.readFileSync('next.config.mjs', 'utf8');
    for (const m of cfg.matchAll(/source:\s*'[^']*?\/stories\/([a-z0-9-]+)'/g)) {
      sources.add(m[1]);
    }
    return sources;
  };

  it('리다이렉트 출발지를 포함하지 않는다', () => {
    const sources = redirectSources();
    expect(AI_CITED_SLUGS.filter((slug) => sources.has(slug))).toEqual([]);
  });

  it('전부 실재하는 ko 스토리다', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs') as typeof import('node:fs');
    const missing = AI_CITED_SLUGS.filter(
      (slug) => !fs.existsSync(`content/stories/${slug}.md`)
    );
    expect(missing).toEqual([]);
  });
});
