import fs from 'fs';
import path from 'path';
import { KO_ONLY_ROUTE_RULES, isKoOnlyRoutePath } from './koOnlyRoutes';

/**
 * KO_ONLY_ROUTE_RULES가 실제 페이지 구현과 갈리지 않게 고정한다.
 *
 * LanguageSwitcher는 이 규칙에 걸리는 경로에서 로케일 전환 시 대상 로케일 홈으로
 * 탈출시킨다(404 방지, 2026-09-14). 페이지가 나중에 다국어로 열리는데 이 규칙만
 * 남아 있으면 정상 번역 페이지로 못 가고 억지로 홈으로 보내는 반대 방향 회귀가
 * 생긴다 — 그래서 각 규칙의 ko 전용 페이지 소스가 실제로 ko(또는 defaultLocale)
 * 하나만 getStaticPaths에 등록하고 fallback:false인지 매 테스트런마다 대조한다.
 */
describe('KO_ONLY_ROUTE_RULES ↔ 페이지 getStaticPaths 대조', () => {
  // 규칙별로 실제 ko 전용 정적 페이지 파일만 나열한다. funding의 형제 SSR
  // 페이지(terms·success·fail·manage/[orderNo]·[slug]/pledge)는 getServerSideProps로
  // 모든 로케일을 받아 런타임에 리다이렉트하므로 여기 포함하지 않는다 — 포함하면
  // "ko만 등록 + fallback:false" 단언이 당연히 실패해, 애초에 이 규칙 대상이
  // 아님을 스스로 증명한다.
  const KO_ONLY_STATIC_PAGE_FILES: Record<string, string[]> = {
    artists: ['pages/[locale]/artists/index.tsx', 'pages/[locale]/artists/[slug].tsx'],
    funding: ['pages/[locale]/funding/index.tsx', 'pages/[locale]/funding/[slug]/index.tsx'],
    guides: ['pages/[locale]/guides/[slug].tsx'],
  };

  it('규칙의 모든 세그먼트에 대응하는 페이지 파일이 존재한다', () => {
    for (const rule of KO_ONLY_ROUTE_RULES) {
      expect(KO_ONLY_STATIC_PAGE_FILES[rule.segment]).toBeDefined();
    }
  });

  it.each(KO_ONLY_ROUTE_RULES.map((r) => r.segment))(
    '%s: ko 전용 정적 페이지가 전부 ko 단일 + fallback:false다',
    (segment) => {
      const files = KO_ONLY_STATIC_PAGE_FILES[segment];
      expect(files).toBeDefined();
      for (const relPath of files) {
        const source = fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8');
        const staticPathsMatch = source.match(/getStaticPaths[\s\S]*?fallback:\s*(true|false|'blocking')/);
        expect(staticPathsMatch).not.toBeNull();
        expect(staticPathsMatch![1]).toBe('false');

        const staticPathsBlock = staticPathsMatch![0];
        // params에 로케일이 고정 리터럴('ko') 또는 defaultLocale 상수로만 등록돼야 한다.
        // locale이 variable(예: locales.map)로 여러 개 등록되면 이 페이지는 더 이상
        // ko 전용이 아니므로 이 대조가 실패해 규칙을 다시 확인하게 만든다.
        expect(staticPathsBlock).toMatch(/locale:\s*(defaultLocale|'ko')/);
        expect(staticPathsBlock).not.toMatch(/locales\.map/);
      }
    }
  );

  // funding의 SSR 형제 페이지가 실제로 getServerSideProps + 런타임 ko 리다이렉트를
  // 쓰는지 확인한다 — 이 페이지들이 ko 전용 규칙에 안 걸려도 404가 아님을 보증하는
  // 근거다. 이 전제가 깨지면(예: 누군가 getStaticPaths로 되돌리면) 위 함정을 다시
  // 만드는 것이므로 여기서 먼저 잡는다.
  it.each([
    'pages/[locale]/funding/terms.tsx',
    'pages/[locale]/funding/success.tsx',
    'pages/[locale]/funding/fail.tsx',
    'pages/[locale]/funding/manage/[orderNo].tsx',
    'pages/[locale]/funding/[slug]/pledge.tsx',
  ])('funding 형제 SSR 페이지 %s는 getServerSideProps를 쓰고 getStaticPaths가 없다', (relPath) => {
    const source = fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8');
    expect(source).toMatch(/getServerSideProps/);
    expect(source).not.toMatch(/getStaticPaths/);
  });

  it('ko 전용 경로를 정확히 판별한다', () => {
    expect(isKoOnlyRoutePath('/artists')).toBe(true);
    expect(isKoOnlyRoutePath('/artists/some-artist')).toBe(true);
    expect(isKoOnlyRoutePath('/funding')).toBe(true);
    expect(isKoOnlyRoutePath('/funding/some-project')).toBe(true);
    expect(isKoOnlyRoutePath('/guides/home-recording-survival')).toBe(true);
    expect(isKoOnlyRoutePath('/pricing')).toBe(false);
    expect(isKoOnlyRoutePath('/')).toBe(false);
  });

  // guides는 index 페이지 자체가 없다([slug].tsx 하나뿐) — 세그먼트만으로는 ko
  // 전용 "정적 페이지"가 없으므로 false다. 이 경로가 원래 있지도 않아 언어
  // 전환기가 404를 만들 일도 없다(있지도 않은 것을 홈으로 억지로 보낼 이유가 없다).
  it('guides는 슬러그 없이는 ko 전용으로 보지 않는다(index 페이지 없음)', () => {
    expect(isKoOnlyRoutePath('/guides')).toBe(false);
  });

  // 회귀 방지: funding의 리터럴 형제 라우트(terms·success·fail·manage)는 슬러그가
  // 아니라 실제 파일명이라, [slug]/index.tsx가 아니라 자기 자신의 SSR 페이지로
  // 라우팅된다(Next.js는 정적 파일명을 동적 세그먼트보다 우선한다) — 즉 404가
  // 아니므로 ko 전용 취급해 홈으로 탈출시키면 오히려 회귀다(예: 주문 확인
  // 쿼리를 지닌 success 경로가 맥락 없이 홈으로 튕긴다).
  it('funding의 리터럴 형제 라우트는 ko 전용이 아니다(SSR + 런타임 리다이렉트)', () => {
    expect(isKoOnlyRoutePath('/funding/terms')).toBe(false);
    expect(isKoOnlyRoutePath('/funding/success')).toBe(false);
    expect(isKoOnlyRoutePath('/funding/fail')).toBe(false);
    expect(isKoOnlyRoutePath('/funding/manage')).toBe(false);
  });

  // 회귀 방지: /funding/<slug>/pledge는 SSR 페이지(getServerSideProps)라 404가
  // 아니다. 세그먼트 깊이 3은 이 저장소에 ko 전용 정적 라우트가 없다.
  it('funding 슬러그의 하위 라우트(pledge 등)는 ko 전용이 아니다(깊이 3)', () => {
    expect(isKoOnlyRoutePath('/funding/some-project/pledge')).toBe(false);
  });
});
