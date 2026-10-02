import { buildFundingSitemapXml, selectDbSitemapEntries } from './sitemapXml';

describe('buildFundingSitemapXml', () => {
  it('항목을 urlset으로 감싸고 ko 주소를 만든다', () => {
    const xml = buildFundingSitemapXml(
      [{ slug: 'demo', lastmod: '2026-10-01' }],
      'https://studionol.co.kr',
    );
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<loc>https://studionol.co.kr/ko/funding/demo</loc>');
    expect(xml).toContain('<lastmod>2026-10-01</lastmod>');
  });

  it('항목이 없어도 빈 urlset을 돌려준다', () => {
    expect(buildFundingSitemapXml([], 'https://studionol.co.kr')).toContain('<urlset');
  });

  it('slug에 든 특수문자를 이스케이프한다', () => {
    const xml = buildFundingSitemapXml([{ slug: 'a&b', lastmod: '2026-10-01' }], 'https://x.kr');
    expect(xml).toContain('a&amp;b');
    expect(xml).not.toContain('<loc>https://x.kr/ko/funding/a&b</loc>');
  });
});

describe('selectDbSitemapEntries', () => {
  const mk = (slug: string, over: Partial<{ hidden: boolean; status: string }> = {}) =>
    ({ slug, lastmod: '2026-10-01', status: 'auto', ...over });

  it('md에 같은 slug가 있으면 DB 프로젝트는 뺀다 — md가 hidden이어도', () => {
    const files = new Set(['both']);
    const out = selectDbSitemapEntries([mk('both'), mk('only-db')], (s) => files.has(s));
    expect(out).toEqual([{ slug: 'only-db', lastmod: '2026-10-01' }]);
  });

  it('hidden·draft는 여전히 뺀다', () => {
    const out = selectDbSitemapEntries(
      [mk('a', { hidden: true }), mk('b', { status: 'draft' }), mk('c')],
      () => false,
    );
    expect(out.map((e) => e.slug)).toEqual(['c']);
  });
});
