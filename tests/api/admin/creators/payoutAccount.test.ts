/** @jest-environment node */
jest.mock('../../../../lib/contracts/admin-auth', () => ({ authenticateAdminApi: jest.fn() }));
jest.mock('../../../../lib/funding/payoutAccount', () => ({
  PAYOUT_ACCOUNT_CRYPTO_ERROR_MESSAGE: jest.requireActual('../../../../lib/funding/payoutAccount').PAYOUT_ACCOUNT_CRYPTO_ERROR_MESSAGE,
  loadCreatorPayoutAccount: jest.fn(),
}));
jest.mock('../../../../lib/funding/creatorEligibility', () => ({ hasApprovedEngagement: jest.fn() }));
jest.mock('../../../../lib/privacy/accessLog', () => ({ recordAdminPrivacyAccess: jest.fn() }));

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../../pages/api/admin/creators/[creatorId]/payout-account';
import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { hasApprovedEngagement } from '../../../../lib/funding/creatorEligibility';
import { loadCreatorPayoutAccount } from '../../../../lib/funding/payoutAccount';
import { recordAdminPrivacyAccess } from '../../../../lib/privacy/accessLog';
import { FieldCryptoError } from '../../../../lib/crypto/fieldCrypto';

const ACTION = 'creator_payout_account_view';

const call = async (method = 'GET', creatorId: unknown = 'creator-1') => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const setHeader = jest.fn();
  const res = { setHeader, status } as unknown as NextApiResponse;
  await handler({ method, query: { creatorId }, headers: {}, socket: {} } as unknown as NextApiRequest, res);
  return {
    status: status.mock.calls[0][0] as number,
    body: json.mock.calls[0][0] as Record<string, unknown>,
    setHeader,
  };
};

const ACCOUNT = { bankName: '국민은행', account: '123-456-789012', holder: '주최자', taxType: 'withholding' };

let warn: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: true, actor: 'kyungha', name: '황경하' });
  (hasApprovedEngagement as jest.Mock).mockResolvedValue(true);
  (loadCreatorPayoutAccount as jest.Mock).mockResolvedValue(ACCOUNT);
  (recordAdminPrivacyAccess as jest.Mock).mockResolvedValue(undefined);
});

afterEach(() => jest.restoreAllMocks());

it('인증 없으면 401이고 계좌를 읽지도 기록하지도 않는다', async () => {
  (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: false });
  const r = await call();
  expect(r.status).toBe(401);
  expect(loadCreatorPayoutAccount).not.toHaveBeenCalled();
  expect(recordAdminPrivacyAccess).not.toHaveBeenCalled();
});

it('GET이 아니면 405', async () => {
  expect((await call('POST')).status).toBe(405);
});

it('creatorId가 문자열이 아니면 400', async () => {
  expect((await call('GET', null)).status).toBe(400);
  expect(loadCreatorPayoutAccount).not.toHaveBeenCalled();
});

it('Cache-Control: no-store', async () => {
  const r = await call();
  expect(r.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
});

it('승인된 펀딩·공연·상점 등록이 없으면 404이고 복호화하지 않는다 — 기록은 남긴다', async () => {
  (hasApprovedEngagement as jest.Mock).mockResolvedValue(false);
  const r = await call();
  expect(r.status).toBe(404);
  expect(loadCreatorPayoutAccount).not.toHaveBeenCalled();
  expect(recordAdminPrivacyAccess).toHaveBeenCalledWith(expect.anything(), 'kyungha', ACTION, 'creator-1', 'not_found');
});

it('등록된 계좌가 없으면 404이고 not_found로 남긴다', async () => {
  (loadCreatorPayoutAccount as jest.Mock).mockResolvedValue(null);
  const r = await call();
  expect(r.status).toBe(404);
  expect(recordAdminPrivacyAccess).toHaveBeenCalledWith(expect.anything(), 'kyungha', ACTION, 'creator-1', 'not_found');
});

it('계좌를 응답으로 돌려주고 성공을 기록한다 — 기록·로그에 계좌번호는 없다', async () => {
  const r = await call();
  expect(r.status).toBe(200);
  expect(r.body).toEqual({ ok: true, account: ACCOUNT });
  expect(loadCreatorPayoutAccount).toHaveBeenCalledWith('creator-1');
  expect(recordAdminPrivacyAccess).toHaveBeenCalledWith(expect.anything(), 'kyungha', ACTION, 'creator-1', 'success');
  expect(JSON.stringify((recordAdminPrivacyAccess as jest.Mock).mock.calls)).not.toContain('123-456-789012');
  expect(JSON.stringify(warn.mock.calls)).not.toContain('123-456-789012');
});

it('복호화 실패는 사유 코드·안내와 함께 500, decrypt_failed로 남긴다', async () => {
  (loadCreatorPayoutAccount as jest.Mock).mockRejectedValue(new FieldCryptoError('key_mismatch', '테스트'));
  const r = await call();
  expect(r.status).toBe(500);
  expect(r.body).toMatchObject({ ok: false, code: 'key_mismatch' });
  expect(String(r.body.message)).toContain('재등록을 요청하지 마세요');
  expect(recordAdminPrivacyAccess).toHaveBeenCalledWith(expect.anything(), 'kyungha', ACTION, 'creator-1', 'decrypt_failed');
});

it('그 밖의 실패는 500, error로 남긴다', async () => {
  (loadCreatorPayoutAccount as jest.Mock).mockRejectedValue(new Error('DB 장애'));
  const r = await call();
  expect(r.status).toBe(500);
  expect(recordAdminPrivacyAccess).toHaveBeenCalledWith(expect.anything(), 'kyungha', ACTION, 'creator-1', 'error');
});

it('기록이 실패해도 조회 응답은 정상이다', async () => {
  (recordAdminPrivacyAccess as jest.Mock).mockRejectedValue(new Error('기록 실패'));
  const r = await call();
  expect(r.status).toBe(200);
  expect(r.body).toEqual({ ok: true, account: ACCOUNT });
});
