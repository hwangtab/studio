/** @jest-environment node */
/**
 * 계정 단위 정산 정보 저장 라우트(`/api/funding/creator/payout`)와, 옛 프로젝트 라우트의 정산 갈래가 닫혔는지.
 * 저장 함수·검증은 실제 것을 쓰지 않고 막는다 — 그쪽은 lib/funding 테스트가 본다. 여기서는 라우트의 문지기만 본다.
 */
jest.mock('../../../../lib/contact/origin', () => ({ isAllowedContactRequestOrigin: jest.fn() }));
jest.mock('../../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn() }));
jest.mock('../../../../lib/funding/creatorAuth', () => ({ authenticateCreatorApi: jest.fn() }));
jest.mock('../../../../lib/funding/creatorProjectWrite', () => ({
  savePayoutSection: jest.fn(),
  saveBasicSection: jest.fn(),
  saveStorySection: jest.fn(),
  saveCreatorSection: jest.fn(),
  loadProjectForCreator: jest.fn(),
}));
jest.mock('../../../../lib/funding/revalidate', () => ({ revalidateFundingPaths: jest.fn() }));
jest.mock('../../../../lib/funding/adminProjects', () => ({ loadProjectForAdmin: jest.fn() }));
jest.mock('../../../../lib/funding/reviewEmail', () => ({ sendCreatorEditedNotice: jest.fn() }));

import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit } from '../../../../lib/booking/rate-limit';
import { isAllowedContactRequestOrigin } from '../../../../lib/contact/origin';
import { authenticateCreatorApi } from '../../../../lib/funding/creatorAuth';
import { savePayoutSection } from '../../../../lib/funding/creatorProjectWrite';
import payoutHandler from '../../../../pages/api/funding/creator/payout';
import projectHandler from '../../../../pages/api/funding/creator/projects/[id]';

const CID = 'creator-a';

const VALID = {
  taxType: 'invoice',
  bankName: '국민은행',
  account: '123-456-789012',
  holder: '황경하',
  residentNumber: '',
  business: { businessNumber: '753-74-00653', businessName: '스튜디오 놀', representativeName: '황경하' },
};

type Handler = (req: NextApiRequest, res: NextApiResponse) => unknown;

const call = async (handler: Handler, body: unknown, { method = 'POST', query = {} as Record<string, string> } = {}) => {
  const out: { status: number; json: unknown } = { status: 0, json: null };
  const req = { method, headers: {}, query, body } as unknown as NextApiRequest;
  const res = {
    setHeader: jest.fn(),
    status(code: number) { out.status = code; return this; },
    json(v: unknown) { out.json = v; return this; },
  } as unknown as NextApiResponse;
  await handler(req, res);
  return out;
};

beforeEach(() => {
  jest.clearAllMocks();
  (isAllowedContactRequestOrigin as jest.Mock).mockReturnValue(true);
  (consumeRateLimit as jest.Mock).mockResolvedValue(true);
  (authenticateCreatorApi as jest.Mock).mockResolvedValue({ ok: true, creatorId: CID });
  (savePayoutSection as jest.Mock).mockResolvedValue({ ok: true });
});

describe('POST /api/funding/creator/payout', () => {
  it('POST가 아니면 405', async () => {
    expect((await call(payoutHandler, {}, { method: 'GET' })).status).toBe(405);
  });

  it('무인증 401', async () => {
    (authenticateCreatorApi as jest.Mock).mockResolvedValue({ ok: false });
    expect((await call(payoutHandler, { value: VALID })).status).toBe(401);
    expect(savePayoutSection).not.toHaveBeenCalled();
  });

  it('다른 Origin 403', async () => {
    (isAllowedContactRequestOrigin as jest.Mock).mockReturnValue(false);
    expect((await call(payoutHandler, { value: VALID })).status).toBe(403);
    expect(savePayoutSection).not.toHaveBeenCalled();
  });

  it('요청 제한을 넘으면 429', async () => {
    (consumeRateLimit as jest.Mock).mockResolvedValue(false);
    expect((await call(payoutHandler, { value: VALID })).status).toBe(429);
    expect(savePayoutSection).not.toHaveBeenCalled();
  });

  it('검증 실패 400 — 메시지에 입력값이 실리지 않는다', async () => {
    const r = await call(payoutHandler, { value: { ...VALID, account: '계좌-9988776655', holder: '' } });
    expect(r.status).toBe(400);
    const message = (r.json as { message: string }).message;
    expect(typeof message).toBe('string');
    expect(message).not.toContain('9988776655');
    expect(savePayoutSection).not.toHaveBeenCalled();
  });

  it('사업자등록번호 검증식이 틀리면 400이고 번호가 메시지에 없다', async () => {
    const r = await call(payoutHandler, { value: { ...VALID, business: { ...VALID.business, businessNumber: '7537400654' } } });
    expect(r.status).toBe(400);
    expect((r.json as { message: string }).message).not.toContain('7537400654');
  });

  it('성공 200 — 본인 id로 저장하고, 응답에는 불리언·안내 문구만 싣는다', async () => {
    (savePayoutSection as jest.Mock).mockResolvedValue({
      ok: true, businessWarnings: ['경고 문구'], businessProfileRetained: true,
    });
    const r = await call(payoutHandler, { value: VALID });
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ ok: true, businessWarnings: ['경고 문구'], businessProfileRetained: true });
    const [creatorId, value] = (savePayoutSection as jest.Mock).mock.calls[0];
    expect(creatorId).toBe(CID);
    expect(value.business).toEqual({ businessNumber: '7537400653', businessName: '스튜디오 놀', representativeName: '황경하' });
    expect(JSON.stringify(r.json)).not.toContain('789012');
  });

  it('저장 함수가 거부하면 그 코드의 상태로 답한다(사업자 표 없음 → 503)', async () => {
    (savePayoutSection as jest.Mock).mockResolvedValue({ ok: false, code: 'business_unavailable', message: '준비 중' });
    expect((await call(payoutHandler, { value: VALID })).status).toBe(503);
  });

  it('계좌 그대로 두기는 keepAccount만 넘기고, 등록된 계좌가 없다는 거부는 400이다', async () => {
    const rest = { taxType: VALID.taxType, residentNumber: VALID.residentNumber, business: VALID.business };
    expect((await call(payoutHandler, { value: { ...rest, keepAccount: true } })).status).toBe(200);
    const [, value] = (savePayoutSection as jest.Mock).mock.calls[0];
    expect(value).toMatchObject({ keepAccount: true });
    expect(value).not.toHaveProperty('account');

    (savePayoutSection as jest.Mock).mockResolvedValue({ ok: false, code: 'no_payout_account', message: '등록된 계좌가 없어요.' });
    expect((await call(payoutHandler, { value: { ...rest, keepAccount: true } })).status).toBe(400);
  });

  it('Cache-Control: no-store', async () => {
    const res = { setHeader: jest.fn(), status() { return this; }, json() { return this; } } as unknown as NextApiResponse;
    await payoutHandler({ method: 'POST', headers: {}, query: {}, body: { value: VALID } } as unknown as NextApiRequest, res);
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });
});

describe('옛 경로 — projects/[id]의 section: payout은 닫혔다', () => {
  it('section: payout을 보내면 400이고 저장 함수를 부르지 않는다', async () => {
    const r = await call(projectHandler, { section: 'payout', value: VALID }, { query: { id: 'p'.repeat(32) } });
    expect(r.status).toBe(400);
    expect(savePayoutSection).not.toHaveBeenCalled();
  });
});
