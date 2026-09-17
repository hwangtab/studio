/**
 * @jest-environment node
 *
 * jsdom 환경은 리졸버에 "browser" 조건을 걸어, iron-session이 의존하는 uncrypto가
 * ESM(.mjs)으로 풀린다. jest 기본 transform은 node_modules 안의 .mjs를 변환하지
 * 않아 `export` 구문에서 그대로 SyntaxError가 난다. 이 테스트는 DOM이 필요 없으므로
 * node 환경으로 돌려 "browser" 조건 자체를 피한다(uncrypto가 node 조건의 CJS를 반환).
 */
import { readCreatorId } from './creatorAuth';

describe('readCreatorId', () => {
  it('세션에 creatorId가 있으면 돌려준다', () => {
    expect(readCreatorId({ creatorId: 'abc' } as never)).toBe('abc');
  });
  it('없으면 null', () => {
    expect(readCreatorId({} as never)).toBeNull();
    expect(readCreatorId({ creatorId: '' } as never)).toBeNull();
  });
});

describe('세션 비밀 검증', () => {
  const OLD = process.env.CREATOR_SESSION_SECRET;
  afterEach(() => { process.env.CREATOR_SESSION_SECRET = OLD; jest.resetModules(); });

  it('32자 미만이면 세션을 만들지 않고 던진다', async () => {
    process.env.CREATOR_SESSION_SECRET = 'short';
    jest.resetModules();
    const { getCreatorSession } = await import('./creatorSession');
    await expect(getCreatorSession({} as never, {} as never)).rejects.toThrow(/CREATOR_SESSION_SECRET/);
  });
});
