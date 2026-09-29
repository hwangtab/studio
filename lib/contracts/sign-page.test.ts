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
jest.mock('../../lib/contracts/view-log', () => ({
  recordContractView: jest.fn().mockResolvedValue(undefined),
}));

import { getDb } from '../../db/client';
import { getServerSideProps } from '../../pages/[locale]/contracts/[id]/sign';
import { recordContractView } from '../../lib/contracts/view-log';

const TOKEN = 'tok_qwertyuiopasdfgh';

const makeRes = () => ({ setHeader: jest.fn() });

const mockFound = (contract: unknown) => {
  (getDb as jest.Mock).mockReturnValue({
    query: { contracts: { findFirst: jest.fn().mockResolvedValue(contract) } },
  });
};

const run = (query: Record<string, unknown>, res: { setHeader: jest.Mock }) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (getServerSideProps as any)({ params: { locale: 'ko', id: 'c1' }, query, res, req: { headers: {}, socket: { remoteAddress: '127.0.0.1' } } });

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

/**
 * 어떤 상태의 계약이 서명 화면을 여는가, 그리고 그 화면이 무엇을 싣는가.
 *
 * 이 페이지의 props는 __NEXT_DATA__로 HTML에 그대로 실린다. 이용이 끝난(terminated) 계약이
 * 서명 화면으로 떨어지던 동안에는 링크만 가진 사람에게 서명자의 생년월일·주소·이메일이 연락처
 * 확인 없이 실렸다. 완료 화면은 같은 계약에 이름·호실·기간·월세만 싣는다(complete-page.test.ts).
 */
describe('서명 화면을 여는 상태', () => {
  const PHONE = '010-1234-5678';
  const contractRow = (status: string) => ({
    id: 'c1',
    title: '홍길동 302호 이용계약',
    customerName: '홍길동',
    customerEmail: 'customer@studionol.co.kr',
    customerPhone: PHONE,
    customerBirthdate: '1990-01-02',
    customerAddress: '서울시 은평구 대조동 84-3',
    content: `| 연락처 | ${PHONE} |\n| 주소 | 서울시 은평구 대조동 84-3 |`,
    status,
    expiresAt: new Date(Date.now() + 86_400_000),
    signToken: TOKEN,
    firstViewedIp: '203.0.113.7',
    notificationError: 'customer@studionol.co.kr 발송 실패',
    contractClauses: [],
    contractAttachments: [],
  });

  it.each(['signed', 'terminated'])('%s 계약은 완료 화면으로 보낸다', async (status) => {
    mockFound(contractRow(status));
    const result = await run({ token: TOKEN }, makeRes());

    expect(result.redirect?.destination).toBe(`/ko/contracts/c1/complete?token=${TOKEN}`);
    expect(result).not.toHaveProperty('props');
    expect(recordContractView).not.toHaveBeenCalled();
  });

  it('서명 대기 계약은 화면이 그리는 값만 싣는다', async () => {
    mockFound(contractRow('sent'));
    const result = await run({ token: TOKEN }, makeRes());

    expect(Object.keys(result.props.contract).sort()).toEqual(['content', 'customerName', 'id', 'title']);
    const serialized = JSON.stringify(result.props);
    for (const secret of ['customer@studionol.co.kr', '1990-01-02', '203.0.113.7', '5678']) {
      expect(serialized).not.toContain(secret);
    }
  });

  it.each(['expired', 'cancelled', 'draft', 'archived'])('%s 계약은 안내만 보여준다', async (status) => {
    mockFound(contractRow(status));
    const result = await run({ token: TOKEN }, makeRes());

    expect(result.props.contract).toBeNull();
    expect(result.props.unavailable).toBe(status === 'cancelled' ? 'cancelled' : 'expired');
    expect(recordContractView).not.toHaveBeenCalled();
  });
});
