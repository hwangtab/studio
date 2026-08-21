/**
 * LLM 색인 파일(/llms.txt · /llms-full*.txt)의 방출 우선순위 단일 소스.
 *
 * 왜 필요한가 — /llms-full-ko.txt는 ko 스토리 1,500+편을 담아 약 765KB(≈19만 토큰)다.
 * 어떤 브라우징 에이전트도 한 번에 못 읽고 앞에서부터 자른다. 그런데 정렬이 발행일
 * 역순이고 ko 스토리의 95%가 2026-04 한 달에 백필돼 있어, 사실상 무작위 순서로
 * 방출되고 있었다. 그 결과 GA4가 "실제로 AI가 인용해서 유입을 만든다"고 지목한 글들이
 * 전부 430~730KB 구간, 즉 잘려나가는 꼬리에 위치했다.
 *
 * AI_CITED_SLUGS는 추측이 아니라 실측이다. docs/ga4-raw/llm_referrers.csv(2026-08-18
 * 갱신, 90일)에서 ChatGPT·Gemini·Perplexity 유입 세션 상위 스토리를 세션 순으로 옮겼다.
 * 갱신 주기: GA4 raw 재수집 때마다 함께 검토(현 순서의 근거 세션 수를 주석에 병기).
 * ⚠️ 308 리다이렉트 출발지는 넣지 말 것 — 죽은 URL을 색인 파일 최상단에 올리는 꼴이 된다.
 *   판정은 lib/regionRedirectMap.json 키 + next.config.mjs의 source(destination 아님)로 한다.
 *   lib/llmsPriority.test.ts가 이 불변식을 강제한다.
 */

/**
 * AI 어시스턴트가 실제로 인용해 유입을 만든 스토리 슬러그 — 세션 내림차순.
 * 괄호 안은 근거 세션 수(90일, 2026-08-18 기준).
 */
export const AI_CITED_SLUGS: readonly string[] = [
  'distribution1', // ChatGPT+Gemini 24 — AI 유입 1위
  'mr-guide1', // 21, 체류 최상위권
  'recording-price1', // 19 — 상업 의도
  'copyright-cover1', // 15
  'royalty1', // 12
  'voiceactor1', // 11
  'streaming-platforms1', // 10
  'songstructure1', // 9 — pre-chorus1·song-structure1 통합 정본
  'eq1', // 8
  'practice-room-monthly1', // 7
  'practice-room-price1', // 7 — buyer-intent
  'singapp1', // 7
  'falsetto1', // 6
  'album-cost1', // 5
  'ep-making1', // 5
  'music-distribution1', // 5
  'music-pr1', // 5
  'store-bgm1', // 5
  'music-business1', // 5
  'commission1', // 4
];

const AI_CITED_RANK = new Map(AI_CITED_SLUGS.map((slug, index) => [slug, index]));

/** 우선순위 밴드 — 낮을수록 파일 앞쪽. 밴드 간 간격은 밴드 내 순서와 겹치지 않게 넉넉히 둔다. */
const BAND = {
  aiCited: 0,
  curated: 10_000,
  region: 20_000,
  rest: 30_000,
} as const;

export interface LlmsPriorityInput {
  /** llms.txt 큐레이션 상록 가이드 슬러그 — 순서 유지 */
  curatedSlugs: readonly string[];
  /** 21개 지역 랜딩페이지 슬러그 */
  regionSlugs: readonly string[];
}

/**
 * 슬러그 → 정렬 키. 같은 밴드 안에서는 원본 배열 순서(=발행일 역순)가 유지되도록
 * Array.prototype.sort의 안정성에 의존한다(ES2019부터 스펙상 보장).
 */
export const createLlmsPriorityRanker = ({ curatedSlugs, regionSlugs }: LlmsPriorityInput) => {
  const curatedRank = new Map<string, number>();
  curatedSlugs.forEach((slug, index) => {
    if (!curatedRank.has(slug)) curatedRank.set(slug, index);
  });
  const regionRank = new Map<string, number>();
  regionSlugs.forEach((slug, index) => {
    if (!regionRank.has(slug)) regionRank.set(slug, index);
  });

  return (slug: string): number => {
    const cited = AI_CITED_RANK.get(slug);
    if (cited !== undefined) return BAND.aiCited + cited;
    const curated = curatedRank.get(slug);
    if (curated !== undefined) return BAND.curated + curated;
    const region = regionRank.get(slug);
    if (region !== undefined) return BAND.region + region;
    return BAND.rest;
  };
};

/**
 * 스토리 배열을 우선순위 밴드로 재정렬한다. 입력 배열은 변경하지 않는다.
 * 꼬리(rest 밴드)는 전부 동점이라 입력 순서 = 발행일 역순이 그대로 남는다.
 */
export const sortStoriesForLlms = <T extends { slug: string }>(
  stories: readonly T[],
  input: LlmsPriorityInput
): T[] => {
  const rankOf = createLlmsPriorityRanker(input);
  return [...stories].sort((a, b) => rankOf(a.slug) - rankOf(b.slug));
};
