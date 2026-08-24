/** @jest-environment node */

/**
 * 서명 페이지의 getServerSideProps가 공유 캐시 지시자를 걷어내는지 검증한다.
 *
 * next.config.mjs의 `/:locale(ko|en|zh|es|vi|th|uz)/:path*` 규칙이
 * `public, s-maxage=3600, stale-while-revalidate=86400`을 붙이는데 이 패턴이
 * `/ko/contracts/{id}/sign`까지 매칭한다. Next는 config 헤더를 렌더 전에 세팅하고
 * 페이지 핸들러는 Cache-Control이 비어 있을 때만 SSR 기본 no-store를 넣으므로,
 * 아무것도 하지 않으면 이름·호실·금액·마스킹 전 본문이 공용 프록시에 남는다.
 *
 * 재발송·취소로 링크를 무효화해도 캐시 수명 동안 옛 계약이 서빙되므로,
 * 조회 이전에 — notFound로 빠지는 경로까지 포함해 — 헤더를 세워야 한다.
 */

jest.mock('../../db/client', () => ({ getDb: jest.fn() }));
jest.mock('../../lib/contracts/service', () => ({
  expireOverdueContracts: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../lib/contracts/template', () => ({
  resolveRulesContent: jest.fn().mockResolvedValue(''),
}));

import { getDb } from '../../db/client';
import { getServerSideProps } from '../../pages/[locale]/contracts/[id]/sign';

const TOKEN = 'tok_qwertyuiopasdfgh';

const makeRes = () => ({ setHeader: jest.fn() });

const mockFound = (contract: unknown) => {
  (getDb as jest.Mock).mockReturnValue({
    query: { contracts: { findFirst: jest.fn().mockResolvedValue(contract) } },
  });
};

const run = (query: Record<string, unknown>, res: { setHeader: jest.Mock }) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (getServerSideProps as any)({ params: { locale: 'ko', id: 'c1' }, query, res });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('서명 페이지 공유 캐시 차단', () => {
  it('토큰이 없어 404로 빠지는 경로에서도 no-store를 세운다', async () => {
    mockFound(undefined);
    const res = makeRes();

    await expect(run({}, res)).resolves.toEqual({ notFound: true });
    expect(res.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      expect.stringContaining('no-store'),
    );
  });

  it('없는 계약을 조회한 경우에도 private으로 내려간다', async () => {
    mockFound(undefined);
    const res = makeRes();

    await run({ token: TOKEN }, res);
    expect(res.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      expect.stringContaining('private'),
    );
  });
});
