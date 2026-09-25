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
    'crowdfunding-design': ['pages/[locale]/crowdfunding-design.tsx'],
    funding: ['pages/[locale]/funding/index.tsx', 'pages/[locale]/funding/[slug]/index.tsx'],
    guides: ['pages/[locale]/guides/[slug].tsx'],
  };

  it('규칙의 모든 세그먼트에 대응하는 페이지 파일이 존재한다', () => {
    for (const rule of KO_ONLY_ROUTE_RULES) {
      expect(KO_ONLY_STATIC_PAGE_FILES[rule.segment]).toBeDefined();
    }
  });

  it.each(KO_ONLY_ROUTE_RULES.map((r) => r.segment))(
    '%s: ko 전용 정적 페이지가 전부 ko 단일 + (fallback:false 또는 blocking+로케일 notFound 가드)다',
    (segment) => {
      const files = KO_ONLY_STATIC_PAGE_FILES[segment];
      expect(files).toBeDefined();
      for (const relPath of files) {
        const source = fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8');
        const staticPathsMatch = source.match(/getStaticPaths[\s\S]*?fallback:\s*(true|false|'blocking')/);
        expect(staticPathsMatch).not.toBeNull();
        const fallbackValue = staticPathsMatch![1];
        if (fallbackValue === "'blocking'") {
          // blocking은 paths에 없는 로케일 요청도 렌더를 시도한다 — getStaticProps가
          // params.locale을 직접 확인해 notFound로 막아야 fallback:false와 같은 보장이
          // 유지된다(funding [slug]/index.tsx, 2026-09-17 ISR 전환에서 처음 생김).
          expect(source).toMatch(/params\?\.locale\s*!==\s*defaultLocale[\s\S]*?notFound:\s*true/);
        } else {
          expect(fallbackValue).toBe('false');
        }

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
    'pages/[locale]/funding/creator/index.tsx',
    'pages/[locale]/funding/creator/auth.tsx',
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

  // 회귀 방지: funding의 리터럴 형제 라우트(terms·success·fail·manage·creator)는
  // 슬러그가 아니라 실제 파일명이라, [slug]/index.tsx가 아니라 자기 자신의 SSR
  // 페이지로 라우팅된다(Next.js는 정적 파일명을 동적 세그먼트보다 우선한다) — 즉
  // 404가 아니므로 ko 전용 취급해 홈으로 탈출시키면 오히려 회귀다(예: 주문 확인
  // 쿼리를 지닌 success 경로가 맥락 없이 홈으로 튕긴다).
  it('funding의 리터럴 형제 라우트는 ko 전용이 아니다(SSR + 런타임 리다이렉트)', () => {
    expect(isKoOnlyRoutePath('/funding/terms')).toBe(false);
    expect(isKoOnlyRoutePath('/funding/success')).toBe(false);
    expect(isKoOnlyRoutePath('/funding/fail')).toBe(false);
    expect(isKoOnlyRoutePath('/funding/manage')).toBe(false);
    expect(isKoOnlyRoutePath('/funding/creator')).toBe(false);
  });

  // /funding/apply는 리터럴 형제가 아니라 진짜 ko 전용 정적 페이지다(getStaticPaths가
  // ko 하나만 등록, fallback:false) — [slug]/index.tsx와 같은 자리에서 true가 나와야 한다.
  it('funding/apply는 ko 전용 정적 페이지다', () => {
    expect(isKoOnlyRoutePath('/funding/apply')).toBe(true);
  });

  // 회귀 방지: /funding/<slug>/pledge는 SSR 페이지(getServerSideProps)라 404가
  // 아니다. 세그먼트 깊이 3은 이 저장소에 ko 전용 정적 라우트가 없다.
  it('funding 슬러그의 하위 라우트(pledge 등)는 ko 전용이 아니다(깊이 3)', () => {
    expect(isKoOnlyRoutePath('/funding/some-project/pledge')).toBe(false);
  });
});

/**
 * 위 describe는 KO_ONLY_ROUTE_RULES가 가리키는 파일들"만" 대조한다 — 하드코딩된
 * 목록을 도는 것이라, 규칙표 자체가 실태에서 갈리는 세 가지를 못 잡는다(적대적
 * 재검토, 2026-09-14 확인):
 *   1. 이미 ko 전용인 페이지의 getStaticPaths에 다른 로케일을 한 줄 추가해도
 *      (예: '번역이 추가되면 해당 locale을 합류'라는 guides의 주석대로) green.
 *   2. funding에 새 SSR 형제 페이지(예: faq.tsx)가 생겨도 literalSiblings를
 *      안 넣으면 green — 그 순간부터 전환기가 그 경로를 홈으로 잘못 탈출시킨다.
 *   3. 완전히 새로운 ko 전용 세그먼트(예: events/index.tsx)가 생겨도 규칙표에
 *      없으면 green — 새 404 구멍이 조용히 열린다.
 *
 * 아래는 pages/[locale] 트리를 직접 walk해서 각 페이지의 실제 데이터 페칭 전략
 * (ko 전용 정적 vs 다국어 정적 vs SSR)을 소스에서 도출한 뒤, 그 결과와
 * isKoOnlyRoutePath()의 판정을 파일 단위로 전수 대조한다 — 이미 정규식으로
 * 소스를 읽던 방식을 디렉터리 전체로 넓힌 것뿐, 새 기계를 들이지 않는다.
 */
describe('isKoOnlyRoutePath ↔ pages/[locale] 실태 전수 대조 (디렉터리 walk)', () => {
  const PAGES_LOCALE_DIR = path.join(process.cwd(), 'pages', '[locale]');
  const SAMPLE_SLUG = 'sample-slug-for-discovery-check';

  type RouteKind = 'ko-only-fallback-false' | 'multi-locale-static' | 'other-static' | 'ssr' | 'unclassified';

  interface DiscoveredRoute {
    filePath: string;
    segments: string[];
    kind: RouteKind;
  }

  const walk = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...walk(full));
      else if (entry.isFile() && entry.name.endsWith('.tsx')) out.push(full);
    }
    return out;
  };

  const toSegments = (absFile: string): string[] => {
    const rel = path.relative(PAGES_LOCALE_DIR, absFile).replace(/\.tsx$/, '');
    let parts = rel.split(path.sep);
    if (parts[parts.length - 1] === 'index') parts = parts.slice(0, -1);
    return parts.map((seg) => (/^\[.+\]$/.test(seg) ? ':param' : seg));
  };

  // getCommonStaticPaths(lib/getStatic.ts)를 참조하는 페이지는 locales.map으로
  // 7개 로케일을 전부 등록한다 — 추론이 아니라 그 소스를 직접 읽어 근거를 둔다.
  // 이 결합이 깨지면(누군가 getCommonStaticPaths를 ko 전용으로 바꾸면) 아래
  // discoverRoutes()의 전제가 조용히 틀려지므로 여기서 먼저 잡는다.
  const commonStaticPathsSource = fs.readFileSync(path.join(process.cwd(), 'lib/getStatic.ts'), 'utf-8');
  it('getCommonStaticPaths는 여전히 locales.map으로 전 로케일을 등록한다(전제 검증)', () => {
    const block = commonStaticPathsSource.slice(commonStaticPathsSource.indexOf('export const getCommonStaticPaths'));
    expect(block).toMatch(/locales\.map\(/);
  });

  const classify = (absFile: string): RouteKind => {
    const source = fs.readFileSync(absFile, 'utf-8');

    // 다국어 공용 헬퍼를 그대로 참조하는 페이지(직접 대입 또는 async () => 호출
    // 양쪽 형태 모두) — 위에서 검증한 대로 항상 전 로케일을 등록한다.
    if (source.includes('getCommonStaticPaths')) return 'multi-locale-static';

    const gspIdx = source.indexOf('getStaticPaths');
    if (gspIdx === -1) {
      return /getServerSideProps/.test(source) ? 'ssr' : 'unclassified';
    }

    // getStaticPaths 선언부만 잘라서 본다(다음 최상위 export 전까지). 이 저장소의
    // 페이지 파일은 컴포넌트 → getStaticPaths → getStaticProps/export default
    // 순서를 지키므로 이 경계로 충분하다.
    const rest = source.slice(gspIdx);
    const boundary = rest.search(/\n\s*export const getStaticProps|\n\s*export default/);
    const block = boundary === -1 ? rest : rest.slice(0, boundary);

    const hasLocalesIterator = /\blocales\.(map|flatMap|forEach)\(/.test(block);
    const hasNonKoLocaleLiteral = /locale:\s*['"](?!ko['"])[a-z]{2}['"]/.test(block);
    if (hasLocalesIterator || hasNonKoLocaleLiteral) return 'multi-locale-static';

    const hasFallbackFalse = /fallback:\s*false/.test(block);
    // blocking은 paths에 없는 로케일도 렌더를 시도하므로, getStaticProps가 params.locale을
    // 직접 확인해 notFound로 막는 경우에만 fallback:false와 같은 보장으로 본다
    // (funding [slug]/index.tsx, 2026-09-17 ISR 전환).
    const hasFallbackBlockingWithLocaleGuard =
      /fallback:\s*'blocking'/.test(block) && /params\?\.locale\s*!==\s*defaultLocale[\s\S]*?notFound:\s*true/.test(source);
    const hasKoOrDefaultLocaleOnly = /locale:\s*(defaultLocale|'ko')/.test(block);
    if ((hasFallbackFalse || hasFallbackBlockingWithLocaleGuard) && hasKoOrDefaultLocaleOnly) return 'ko-only-fallback-false';

    return 'other-static';
  };

  const discoverRoutes = (): DiscoveredRoute[] =>
    walk(PAGES_LOCALE_DIR).map((absFile) => ({
      filePath: path.relative(process.cwd(), absFile),
      segments: toSegments(absFile),
      kind: classify(absFile),
    }));

  const routes = discoverRoutes();

  it('pages/[locale] 아래 모든 페이지가 분류된다(getStaticPaths 또는 getServerSideProps)', () => {
    const unclassified = routes.filter((r) => r.kind === 'unclassified').map((r) => r.filePath);
    expect(unclassified).toEqual([]);
  });

  it.each(routes.map((r) => [r.filePath, r] as const))(
    '%s',
    (_label, route) => {
      const urlPath = '/' + route.segments.map((s) => (s === ':param' ? SAMPLE_SLUG : s)).join('/');
      const expectedKoOnly = route.kind === 'ko-only-fallback-false';
      expect(isKoOnlyRoutePath(urlPath)).toBe(expectedKoOnly);
    }
  );
});
