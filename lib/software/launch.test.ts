import { SOFTWARE_FIXTURE_PRODUCTS } from '../../tests/helpers/softwareFixtures';
import { renderSoftwareLlmsSection } from './llms';
import { buildSoftwareSitemapPaths } from './sitemap';

describe('소프트웨어 사이트맵', () => {
  it('닫혀 있거나 공개 상품이 없으면 비운다', () => {
    expect(buildSoftwareSitemapPaths({ open: false, productSlugs: ['a'] })).toEqual([]);
    expect(buildSoftwareSitemapPaths({ open: true, productSlugs: [] })).toEqual([]);
  });

  it('열리면 ko·en 목록과 상세', () => {
    expect(buildSoftwareSitemapPaths({ open: true, productSlugs: ['a'] })).toEqual(['/ko/software', '/ko/software/a', '/en/software', '/en/software/a']);
  });
});

describe('소프트웨어 llms 절', () => {
  const published = SOFTWARE_FIXTURE_PRODUCTS.filter((p) => p.published);

  it('닫혀 있으면 빈 문자열', () => {
    expect(renderSoftwareLlmsSection({ open: false, siteUrl: 'https://x', products: published })).toBe('');
  });

  it('지금 가격(맨 앞)·체험판·주소를 싣는다', () => {
    const out = renderSoftwareLlmsSection({ open: true, siteUrl: 'https://x', products: published });
    expect(out).toContain('Test Plugin');
    expect(out).toContain('69,000 KRW');
    expect(out).not.toContain('59,000');
    expect(out).toContain('30-day');
    expect(out).toContain('https://x/en/software/test-plugin');
  });
});
