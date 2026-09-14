import { generateArticleSchema } from './article';
import { getSiteConfig, studioOperator } from '../../data/siteConfig';

// 스토리 author 계약.
//
// 2026-09-08 감사 #4: frontmatter author가 없거나 '스튜디오 놀'인 글(전체의 97%)에서
// 화면 바이라인은 "스튜디오 놀"인데 JSON-LD author는 Person "황경하"로 승격돼 있었다.
// 구조화 데이터는 페이지에 보이는 내용을 반영해야 하고, Perplexity처럼 출처 카드에 저자를
// 노출하는 엔진에는 두 값이 갈리는 것이 오히려 신호를 흐린다.
//
// 이 사이트의 스토리는 스튜디오 명의다. 운영자 개인 명의는 frontmatter에 명시한 글뿐이다.

const SITE = 'https://studionol.co.kr';
const CANONICAL = `${SITE}/ko/stories/eq1`;

type Node = Record<string, unknown>;

const authorOf = (articleAuthor?: string): Node => {
  const schema = generateArticleSchema(
    '제목',
    '설명',
    SITE,
    `${SITE}/images/og-default.jpg`,
    CANONICAL,
    '2026-01-01T00:00:00.000Z',
    '2026-02-01T00:00:00.000Z',
    articleAuthor,
    'ko',
    'BlogPosting'
  ) as Node;
  return schema.author as Node;
};

describe('스토리 author — 화면 바이라인과 같은 주체를 가리킨다', () => {
  const config = getSiteConfig('ko');

  it('frontmatter author가 없으면 조직(스튜디오 놀)이 저자다', () => {
    const author = authorOf(undefined);
    expect(author['@type']).toBe('Organization');
    expect(author['@id']).toBe(`${SITE}/#organization`);
    expect(author.name).toBe(config.name);
  });

  it("author가 '스튜디오 놀'이어도 조직이다 — Person으로 승격하지 않는다", () => {
    const author = authorOf(config.name);
    expect(author['@type']).toBe('Organization');
    expect(author['@id']).toBe(`${SITE}/#organization`);
    // 운영자 개인 신호(수상·권위 프로필)가 조직 명의 글에 섞이면 안 된다.
    expect(author.award).toBeUndefined();
    expect(author.sameAs).toBeUndefined();
    expect(author.jobTitle).toBeUndefined();
  });

  it('명시적 운영자 바이라인만 Person으로 나간다', () => {
    const author = authorOf(studioOperator.name);
    expect(author['@type']).toBe('Person');
    expect(author['@id']).toBe(`${SITE}/#person-hwang`);
    expect(author.name).toBe(studioOperator.name);
    expect(author.url).toBe(`${SITE}/ko/author`);
    expect(Array.isArray(author.award)).toBe(true);
    expect(author.worksFor['@id']).toBe(`${SITE}/#organization`);
  });

  it('외부 기고자는 단순 Person이다 — 잘못된 affiliation 신호를 만들지 않는다', () => {
    const author = authorOf('외부 기고자');
    expect(author['@type']).toBe('Person');
    expect(author.name).toBe('외부 기고자');
    expect(author['@id']).toBeUndefined();
    expect(author.worksFor).toBeUndefined();
    expect(author.award).toBeUndefined();
  });

  it('조직 저자는 @id 참조 + name뿐이다 — 같은 @id에 값을 두 벌 만들지 않는다', () => {
    const author = authorOf(undefined);
    expect(Object.keys(author).sort()).toEqual(['@id', '@type', 'name']);
  });
});
