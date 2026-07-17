import { REDIRECTED_SLUGS, urlToRoutePath, urlToSlug } from './gscAudit';
// 사이트맵 측 마스터 정의(CJS)와의 동기 가드.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const routes = require('../sitemap/routes');

describe('gscAudit — REDIRECTED_SLUGS 동기', () => {
  it('lib/sitemap/routes.js의 마스터 집합과 완전히 일치한다 (한쪽만 고치면 실패)', () => {
    const sitemapSet = routes.REDIRECTED_SLUGS as Set<string>;
    expect([...REDIRECTED_SLUGS].sort()).toEqual([...sitemapSet].sort());
  });
});

describe('gscAudit — URL 분류', () => {
  const SITE = 'https://studionol.co.kr';

  it('스토리 상세만 슬러그로 캡처한다 (카테고리 허브 오캡처 회귀 방지)', () => {
    expect(urlToSlug(`${SITE}/ko/stories/daw-choice1`)).toBe('daw-choice1');
    expect(urlToSlug(`${SITE}/ko/stories/daw-choice1/`)).toBe('daw-choice1');
    expect(urlToSlug(`${SITE}/ko/stories/daw-choice1?utm=x`)).toBe('daw-choice1');
    // 구버전 버그: 아래가 'category'로 캡처돼 유령 슬러그로 새고 있었다.
    expect(urlToSlug(`${SITE}/ko/stories/category/vocal`)).toBeNull();
    expect(urlToSlug(`${SITE}/ko/pricing`)).toBeNull();
  });

  it('비-story URL은 정규화된 라우트 경로로 분류한다', () => {
    expect(urlToRoutePath(`${SITE}/ko/pricing`, SITE)).toBe('/ko/pricing');
    expect(urlToRoutePath(`${SITE}/en/release-project/`, SITE)).toBe('/en/release-project');
    expect(urlToRoutePath(`${SITE}/ko/stories/category/vocal?page=2`, SITE)).toBe(
      '/ko/stories/category/vocal'
    );
    expect(urlToRoutePath(`${SITE}/ko/guides/indie-release-guide`, SITE)).toBe(
      '/ko/guides/indie-release-guide'
    );
    // 외부 도메인·파싱 불가 URL은 집계 제외.
    expect(urlToRoutePath('https://evil.example.com/ko/pricing', SITE)).toBeNull();
    expect(urlToRoutePath('not-a-url', SITE)).toBeNull();
  });
});
