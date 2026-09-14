import fs from 'fs';
import path from 'path';
import { KO_ONLY_ROUTE_SEGMENTS, isKoOnlyRoutePath } from './koOnlyRoutes';

/**
 * KO_ONLY_ROUTE_SEGMENTS가 실제 페이지 구현과 갈리지 않게 고정한다.
 *
 * LanguageSwitcher는 이 목록에 있는 경로에서 로케일 전환 시 대상 로케일 홈으로
 * 탈출시킨다(404 방지, 2026-09-14). 페이지가 나중에 다국어로 열리는데 이 목록만
 * 남아 있으면 정상 번역 페이지로 못 가고 억지로 홈으로 보내는 반대 방향 회귀가
 * 생긴다 — 그래서 각 세그먼트의 페이지 소스가 실제로 ko(또는 defaultLocale) 하나만
 * getStaticPaths에 등록하고 fallback:false인지 매 테스트런마다 대조한다.
 */
describe('KO_ONLY_ROUTE_SEGMENTS ↔ 페이지 getStaticPaths 대조', () => {
  const PAGE_FILES: Record<string, string[]> = {
    artists: ['pages/[locale]/artists/index.tsx', 'pages/[locale]/artists/[slug].tsx'],
    funding: ['pages/[locale]/funding/index.tsx', 'pages/[locale]/funding/[slug]/index.tsx'],
  };

  it('목록의 모든 세그먼트에 대응하는 페이지 파일이 존재한다', () => {
    for (const segment of KO_ONLY_ROUTE_SEGMENTS) {
      expect(PAGE_FILES[segment]).toBeDefined();
    }
  });

  it.each(KO_ONLY_ROUTE_SEGMENTS)('%s: 등록된 모든 페이지가 ko 단일 + fallback:false다', (segment) => {
    const files = PAGE_FILES[segment];
    expect(files).toBeDefined();
    for (const relPath of files) {
      const source = fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8');
      const staticPathsMatch = source.match(/getStaticPaths[\s\S]*?fallback:\s*(true|false|'blocking')/);
      expect(staticPathsMatch).not.toBeNull();
      expect(staticPathsMatch![1]).toBe('false');

      const staticPathsBlock = staticPathsMatch![0];
      // params에 로케일이 고정 리터럴('ko') 또는 defaultLocale 상수로만 등록돼야 한다.
      // locale이 variable(예: locales.map)로 여러 개 등록되면 이 페이지는 더 이상
      // ko 전용이 아니므로 이 대조가 실패해 목록을 다시 확인하게 만든다.
      expect(staticPathsBlock).toMatch(/locale:\s*(defaultLocale|'ko')/);
      expect(staticPathsBlock).not.toMatch(/locales\.map/);
    }
  });

  it('ko 전용 경로를 정확히 판별한다', () => {
    expect(isKoOnlyRoutePath('/artists')).toBe(true);
    expect(isKoOnlyRoutePath('/artists/some-artist')).toBe(true);
    expect(isKoOnlyRoutePath('/funding')).toBe(true);
    expect(isKoOnlyRoutePath('/funding/some-project')).toBe(true);
    expect(isKoOnlyRoutePath('/pricing')).toBe(false);
    expect(isKoOnlyRoutePath('/')).toBe(false);
  });
});
