/** @jest-environment node */
jest.mock('../../../../lib/contracts/admin-auth', () => ({ authenticateAdminApi: jest.fn() }));
jest.mock('../../../../lib/funding/payoutAccount', () => ({ loadFundingPayoutAccount: jest.fn() }));

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../../pages/api/admin/funding/projects/[id]/payout-account';
import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { loadFundingPayoutAccount } from '../../../../lib/funding/payoutAccount';

const call = async (method = 'GET', id: unknown = 'proj-1') => {
  // 주의: 기본값 인자라 undefined를 넘기면 기본값이 살아난다 — 비문자열 검증은 null로 한다.
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const setHeader = jest.fn();
  const res = { setHeader, status } as unknown as NextApiResponse;
  await handler({ method, query: { id }, headers: {}, socket: {} } as unknown as NextApiRequest, res);
  return {
    status: status.mock.calls[0][0] as number,
    body: json.mock.calls[0][0] as Record<string, unknown>,
    setHeader,
  };
};

const ACCOUNT = { bankName: '국민은행', account: '123-456-789012', holder: '개설자', taxType: 'withholding' };

let warn: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: true });
  (loadFundingPayoutAccount as jest.Mock).mockResolvedValue(ACCOUNT);
});

afterEach(() => jest.restoreAllMocks());

it('인증 없으면 401이고 계좌를 읽지 않는다', async () => {
  (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: false });
  const r = await call();
  expect(r.status).toBe(401);
  expect(loadFundingPayoutAccount).not.toHaveBeenCalled();
});

it('GET이 아니면 405', async () => {
  expect((await call('POST')).status).toBe(405);
});

it('id가 문자열이 아니면 400', async () => {
  expect((await call('GET', null)).status).toBe(400);
  expect(loadFundingPayoutAccount).not.toHaveBeenCalled();
});

/** 계좌가 담긴 응답이 중간 캐시·브라우저 캐시에 남으면 안 된다. */
it('Cache-Control: no-store', async () => {
  const r = await call();
  expect(r.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
});

it('등록된 계좌가 없으면 404', async () => {
  (loadFundingPayoutAccount as jest.Mock).mockResolvedValue(null);
  const r = await call();
  expect(r.status).toBe(404);
});

it('계좌를 응답으로 돌려주고, 조회 사실을 서버 로그에 남긴다', async () => {
  const r = await call();
  expect(r.status).toBe(200);
  expect(r.body).toEqual({ ok: true, account: ACCOUNT });
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('정산 계좌 조회'));
  // 로그가 새면 같은 사고다 — 계좌번호 자체는 로그에 적지 않는다.
  expect(JSON.stringify(warn.mock.calls)).not.toContain('123-456-789012');
});

it('조회가 던지면 500', async () => {
  (loadFundingPayoutAccount as jest.Mock).mockRejectedValue(new Error('DB 장애'));
  expect((await call()).status).toBe(500);
});
