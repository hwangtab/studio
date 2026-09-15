/** @jest-environment node */

type MiddlewareModule = typeof import('./middleware');
type NextServerModule = typeof import('next/server');

/**
 * press.studionol.co.kr은 수신거부 링크 하나만 응답한다.
 *
 * 두 가지를 동시에 지켜야 한다.
 *
 *   1. /u/<token>이 canonical host 강제(studionol.co.kr로의 308)에 걸리지 않을 것.
 *      걸리면 기자가 누른 링크가 404로 끝나고, 그건 배포 후에야 드러난다.
 *   2. 그 밖의 경로는 전부 404일 것. 안 막으면 사이트 전체가 두 주소로 살면서
 *      색인이 갈리고 canonical·hreflang 정리가 무너진다.
 *
 * 반드시 **프로덕션 env로** 불러온다. middleware.ts는 모듈 평가 시점에 env를 읽어
 * shouldEnforceCanonicalHost를 const로 고정하므로, 기본 테스트 환경에서는 canonical
 * 강제가 꺼진 채 돈다 — 그 상태로는 조기 반환을 지워도 이 테스트가 통과한다.
 */
const loadProdMiddleware = async (): Promise<{
  middleware: MiddlewareModule['middleware'];
  NextRequest: NextServerModule['NextRequest'];
}> => {
  jest.resetModules();
  process.env.NEXT_PUBLIC_SITE_URL = 'https://studionol.co.kr';
  process.env.VERCEL_ENV = 'production';
  // NODE_ENV는 읽기 전용 취급이라 defineProperty로 덮는다.
  Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true });
  const [{ middleware }, { NextRequest }] = await Promise.all([
    import('./middleware'),
    import('next/server'),
  ]);
  return { middleware, NextRequest };
};

describe('press.studionol.co.kr (프로덕션 env)', () => {
  const originalEnv = process.env;
  let middleware: MiddlewareModule['middleware'];
  let NextRequest: NextServerModule['NextRequest'];

  beforeAll(async () => {
    ({ middleware, NextRequest } = await loadProdMiddleware());
  });

  afterAll(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  const req = (url: string) =>
    new NextRequest(new URL(url), { headers: { host: new URL(url).host } });

  /**
   * 이 테스트가 이 과제의 이유다. 조기 반환이 canonical 강제보다 뒤에 있으면
   * 308이 나온다.
   */
  it('/u/<token>을 수신거부 API로 rewrite한다 (308이 아니다)', () => {
    const res = middleware(req('https://press.studionol.co.kr/u/abc.def'));
    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-rewrite')).toContain('/api/press/unsubscribe/abc.def');
  });

  /**
   * 리라이트가 토큰을 **헤더로** 넘겨야 한다.
   *
   * 경로만 바꾸면 Next가 목적지의 동적 세그먼트를 채우지 않고 쿼리도 전달하지 않는다 —
   * 핸들러에서 req.query가 통째로 {}였다. 프로덕션에서 유효한 토큰이 전부 400을 받았고
   * 로컬에서 핸들러 로그로 재현했다(2026-09-15). 경로 rewrite만 확인하는 단언은
   * 이 결함을 통과시킨다.
   */
  it('리라이트가 토큰을 요청 헤더로 넘긴다', () => {
    const token = 'eyJhIjoxfQ.abc-DEF_123';
    const res = middleware(req(`https://press.studionol.co.kr/u/${token}`));
    expect(res.headers.get('x-middleware-rewrite')).toContain(
      `/api/press/unsubscribe/${token}`,
    );
    // 미들웨어가 덧붙인 요청 헤더는 x-middleware-request-* 로 실려 나간다.
    const forwarded = res.headers.get('x-middleware-request-x-press-unsub-token');
    expect(forwarded).toBe(token);
  });

  it('루트는 404다', () => {
    expect(middleware(req('https://press.studionol.co.kr/')).status).toBe(404);
  });

  /**
   * 목록이 `/ko`·`/ko/pricing`뿐인 것은 빠뜨린 것이 아니다.
   *
   * 이 테스트는 middleware를 **직접 부른다** — config.matcher를 거치지 않는다.
   * 그래서 matcher의 negative lookahead가 제외하는 경로(`/sitemap.xml`·`/robots.txt`·
   * `/llms.txt`·`/api/*`·`/images/*` 등)를 여기에 적으면, 프로덕션에서는 미들웨어가
   * 아예 안 도는데 테스트만 404를 받아 "막혀 있다"고 통과한다. 지키는 것이 없는
   * 단언은 없느니만 못하다 — 다음 사람이 그 줄을 보고 안심한다.
   *
   * 실제로 press 호스트에서도 그 정적 경로들은 응답한다. 색인이 갈리는 것은
   * robots·canonical 쪽 문제이고, **당겨가기 엔드포인트(/api/press/optouts)만은**
   * 핸들러 초입에서 직접 호스트를 보고 404를 낸다(pages/api/press/optouts.ts).
   *
   * 여기 남기는 것은 matcher를 실제로 통과하는 경로뿐이다.
   */
  it('본진 경로를 이 호스트로 요청해도 404다', () => {
    for (const path of ['/ko', '/ko/pricing']) {
      expect(middleware(req(`https://press.studionol.co.kr${path}`)).status).toBe(404);
    }
  });

  it('토큰이 없는 /u는 404다', () => {
    expect(middleware(req('https://press.studionol.co.kr/u')).status).toBe(404);
    expect(middleware(req('https://press.studionol.co.kr/u/')).status).toBe(404);
  });

  /** 본진 호스트는 이 규칙과 무관하다 — /u는 본진에 없는 경로일 뿐이다. */
  it('본진 호스트의 /u는 rewrite되지 않는다', () => {
    const res = middleware(req('https://studionol.co.kr/u/abc.def'));
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
  });
});

// 파일에 top-level import/export가 없으면 스크립트로 취급돼 middleware.test.ts와
// 같은 이름의 타입 별칭(MiddlewareModule·NextServerModule)이 전역에서 충돌한다
// (tsconfig의 isolatedModules와 무관하게 tsc가 duplicate identifier로 잡는다).
// export {}로 이 파일을 모듈 스코프로 만들어 분리한다 — 테스트 로직은 그대로다.
export {};
