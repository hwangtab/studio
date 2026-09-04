/** @jest-environment node */

/**
 * 서명 완료 페이지가 무엇을 HTML에 실어 보내는지 검증한다.
 *
 * 이 페이지는 서명 페이지와 같은 토큰으로 열린다. 서명 페이지는 본인 확인을 위해
 * 연락처 뒷자리를 가리는데(maskIdentityDigits), 이 페이지가 원본을 그대로 넘기면
 * 링크만 아는 제3자가 경로 한 단어를 바꿔 정답을 읽어 낼 수 있다 — 실제로 그런
 * 상태였고, 화면 분기로는 막히지 않는다. getServerSideProps가 돌려주는 props는
 * 렌더 결과와 무관하게 __NEXT_DATA__로 직렬화되기 때문이다.
 *
 * 그래서 검증 대상은 "화면에 무엇이 보이는가"가 아니라 "props에 무엇이 담기는가"다.
 */

jest.mock('../../db/client', () => ({ getDb: jest.fn() }));

import { getDb } from '../../db/client';
import { getServerSideProps } from '../../pages/[locale]/contracts/[id]/complete';
import type { Contract } from '../../db/schema';

const PHONE = '010-1234-5678';
/** 연락처 뒷자리와 우연히 겹치지 않는 토큰 — 겹치면 유출 검사가 자기 자신을 잡는다. */
const TOKEN = 'tok_qwertyuiopasdfgh';

const contractFixture = (overrides: Partial<Contract> = {}): Contract =>
  ({
    id: 'c1',
    title: '홍길동 302호 이용계약',
    description: null,
    customerName: '홍길동',
    customerBirthdate: '1990-01-02',
    customerEmail: 'customer@studionol.co.kr',
    customerPhone: PHONE,
    customerAddress: '서울시 은평구 대조동 84-3',
    roomNumber: '302',
    roomArea: '3m × 2m',
    startDate: new Date('2026-09-01T00:00:00Z'),
    endDate: new Date('2027-03-01T00:00:00Z'),
    monthlyRent: 300000,
    depositAmount: 300000,
    paymentDay: 1,
    paymentBank: '카카오뱅크',
    paymentAccount: '3333-12-5480849',
    paymentAccountHolder: '황경하 / 스튜디오 놀',
    content: `| 연락처 | ${PHONE} |\n| 주소 | 서울시 은평구 대조동 84-3 |`,
    status: 'signed',
    rulesAgreed: true,
    rulesAgreedAt: new Date('2026-08-20T00:00:00Z'),
    specialTerms: null,
    sentAt: new Date('2026-08-19T00:00:00Z'),
    signedAt: new Date('2026-08-20T00:00:00Z'),
    identityVerifiedAt: new Date('2026-08-20T00:00:00Z'),
    contentHash: 'v2:deadbeef',
    expiresAt: new Date('2026-08-26T00:00:00Z'),
    signToken: TOKEN,
    signTokenUsedAt: new Date('2026-08-20T00:00:00Z'),
    pdfUrl: 'https://blob.example/contract.pdf',
    pdfGeneratedAt: new Date('2026-08-20T00:00:00Z'),
    notificationError: null,
    notifiedAt: new Date('2026-08-20T00:00:00Z'),
    purgedAt: null,
    createdAt: new Date('2026-08-19T00:00:00Z'),
    updatedAt: new Date('2026-08-20T00:00:00Z'),
    ...overrides,
  }) as Contract;

const mockFound = (contract: Contract | undefined) => {
  (getDb as jest.Mock).mockReturnValue({
    query: { contracts: { findFirst: jest.fn().mockResolvedValue(contract) } },
  });
};

/** setHeader 호출을 들여다보기 위한 최소 res 스텁. */
const makeRes = () => ({ setHeader: jest.fn() });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const run = (
  query: Record<string, unknown> = { token: TOKEN },
  res: { setHeader: jest.Mock } = makeRes(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (getServerSideProps as any)({ params: { locale: 'ko', id: 'c1' }, query, res });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('서명 완료 페이지 props', () => {
  /**
   * next.config.mjs의 로케일 캐시 규칙이 `/ko/contracts/...`까지 매칭해
   * `public, s-maxage=3600`을 붙인다. 그대로 두면 계약 본문이 공유 캐시에 남는다.
   * 조회 전에 걷어내야 notFound로 빠지는 경로까지 덮인다.
   */
  describe('공유 캐시 차단', () => {
    it('계약을 조회하기 전에 no-store를 세운다', async () => {
      mockFound(contractFixture());
      const res = makeRes();
      await run({ token: TOKEN }, res);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        expect.stringContaining('no-store'),
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        expect.stringContaining('private'),
      );
    });

    it('토큰이 없어 404로 빠지는 경로에서도 세운다', async () => {
      mockFound(contractFixture());
      const res = makeRes();
      await run({}, res);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        expect.stringContaining('no-store'),
      );
    });
  });

  /**
   * 사이트 공용 404를 띄우지 않는다.
   *
   * 여기 오는 사람은 대부분 계약 당사자다 — 메일에 몇 년 남아 있던 링크를 이제 눌렀거나,
   * 하필 DB가 흔들렸을 뿐이다. 마케팅 톤의 "페이지를 찾을 수 없습니다"를 보면 서명이
   * 접수됐는지, PDF는 어디서 받는지, 어디로 연락하는지 알 길이 없다. 서명 페이지는
   * 같은 상황을 이미 안내 화면으로 처리하는데 이 페이지만 맨 404로 떨어뜨리고 있었다.
   */
  describe('문서를 보여줄 수 없을 때', () => {
    it('토큰이 없으면 계약을 조회조차 하지 않고 안내 화면을 준다', async () => {
      mockFound(contractFixture());
      const r = await run({});
      expect(r.props.unavailable).toBe('not-found');
      expect(r.props.contract).toBeNull();
      expect(r).not.toHaveProperty('notFound');
    });

    it('없는 계약·토큰 불일치는 같은 안내로 묶는다 (계약 존재 여부를 흘리지 않는다)', async () => {
      mockFound(undefined);
      const r = await run();
      expect(r.props.unavailable).toBe('not-found');
      expect(r.props.contract).toBeNull();
    });

    it('DB 장애는 "찾을 수 없다"가 아니라 오류로 구분해 알린다', async () => {
      (getDb as jest.Mock).mockReturnValue({
        query: { contracts: { findFirst: jest.fn().mockRejectedValue(new Error('turso down')) } },
      });
      const r = await run();
      // 서명은 이미 접수됐을 수 있다 — 고객이 할 일이 다르므로 사유를 나눈다.
      expect(r.props.unavailable).toBe('error');
    });

    it('어느 경우에도 계약 정보를 props에 싣지 않는다', async () => {
      mockFound(undefined);
      const r = await run();
      expect(JSON.stringify(r.props)).not.toContain('홍길동');
      expect(JSON.stringify(r.props)).not.toContain(PHONE);
    });
  });

  /**
   * 이용이 종료된 계약. 서명본은 법적 보존 대상이라 남는데, 예전엔 signed가 아니라는
   * 이유로 서명 페이지로 되돌렸고 sign.tsx의 상태 분기에 terminated가 없어 **이미 서명을
   * 마친 고객에게 빈 서명 패드**가 떴다. 고객 메일의 영구 링크가 이 페이지를 가리킨다.
   */
  describe('이용이 종료된 계약', () => {
    it('서명 페이지로 되돌리지 않고 완료 화면을 보여준다', async () => {
      mockFound(contractFixture({ status: 'terminated' }));
      const r = await run();
      expect(r).not.toHaveProperty('redirect');
      expect(r.props.terminated).toBe(true);
      expect(r.props.contract).not.toBeNull();
    });

    it('서명본을 내려받을 경로는 그대로 준다', async () => {
      mockFound(contractFixture({ status: 'terminated' }));
      const r = await run();
      expect(r.props.downloadUrl).toContain('/api/contracts/c1/download');
    });

    it('종료되지 않은 계약에는 terminated를 붙이지 않는다', async () => {
      mockFound(contractFixture());
      const r = await run();
      expect(r.props).not.toHaveProperty('terminated');
    });
  });

  describe('서명이 끝난 계약', () => {
    it('화면에 그리는 값만 넘긴다', async () => {
      mockFound(contractFixture());
      const result = await run();

      expect(Object.keys(result.props.contract).sort()).toEqual([
        'customerName',
        'endDate',
        'monthlyRent',
        'roomNumber',
        'signedAt',
        'startDate',
      ]);
    });

    it('연락처·생년월일·주소·계약 본문을 props에 담지 않는다', async () => {
      mockFound(contractFixture());
      const serialized = JSON.stringify(await run());

      // __NEXT_DATA__에 실릴 내용 그대로를 본다.
      expect(serialized).not.toContain(PHONE);
      expect(serialized).not.toContain('5678');
      expect(serialized).not.toContain('1990-01-02');
      expect(serialized).not.toContain('대조동 84-3');
      expect(serialized).not.toContain('customer@studionol.co.kr');
    });

    it('서명 토큰을 본문에 다시 싣지 않는다 (다운로드 주소에만 쓴다)', async () => {
      mockFound(contractFixture());
      const result = await run();

      expect(JSON.stringify(result.props.contract)).not.toContain(TOKEN);
      expect(result.props.downloadUrl).toContain(TOKEN);
    });

    it('파기된 계약은 내려받기를 제안하지 않는다', async () => {
      mockFound(contractFixture({ purgedAt: new Date('2030-01-01T00:00:00Z') }));
      const result = await run();

      expect(result.props.purged).toBe(true);
    });
  });

  /**
   * 서명 전에는 이 페이지가 아무것도 만들지 않아야 한다. 화면을 숨기는 것으로는 부족하다 —
   * props는 렌더 분기와 무관하게 이미 HTML에 직렬화된 뒤다.
   */
  describe('서명 전 계약', () => {
    it.each(['draft', 'sent', 'cancelled'] as const)(
      '%s 상태면 개인정보를 담지 않고 서명 페이지로 보낸다',
      async (status) => {
        mockFound(contractFixture({ status, signedAt: null }));
        const result = await run();

        expect(result.redirect.destination).toBe(
          `/ko/contracts/c1/sign?token=${encodeURIComponent(TOKEN)}`,
        );
        expect(result.props).toBeUndefined();
        expect(JSON.stringify(result)).not.toContain(PHONE);
      },
    );

    it('기한이 지난 계약도 마찬가지다', async () => {
      mockFound(
        contractFixture({
          status: 'sent',
          signedAt: null,
          expiresAt: new Date('2020-01-01T00:00:00Z'),
        }),
      );
      const result = await run();

      expect(result.redirect).toBeDefined();
      expect(JSON.stringify(result)).not.toContain(PHONE);
    });
  });
});
