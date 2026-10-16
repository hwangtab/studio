/** @jest-environment node */
jest.mock('../../../../lib/contracts/admin-auth', () => ({ authenticateAdminApi: jest.fn() }));
jest.mock('../../../../lib/funding/residentNumber', () => ({
  RESIDENT_NUMBER_CRYPTO_ERROR_MESSAGE: jest.requireActual('../../../../lib/funding/residentNumber').RESIDENT_NUMBER_CRYPTO_ERROR_MESSAGE,
  loadCreatorResidentNumber: jest.fn(),
}));
jest.mock('../../../../lib/funding/creatorEligibility', () => ({ hasApprovedEngagement: jest.fn() }));
jest.mock('../../../../lib/privacy/accessLog', () => ({ recordAdminPrivacyAccess: jest.fn() }));

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../../pages/api/admin/creators/[creatorId]/resident-number';
import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { hasApprovedEngagement } from '../../../../lib/funding/creatorEligibility';
import { loadCreatorResidentNumber } from '../../../../lib/funding/residentNumber';
import { recordAdminPrivacyAccess } from '../../../../lib/privacy/accessLog';
import { FieldCryptoError } from '../../../../lib/crypto/fieldCrypto';

const ACTION = 'creator_resident_number_view';

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

/** 테스트에도 실제 주민등록번호를 쓰지 않는다 — 형식만 같은 가짜다. */
const RESIDENT_NUMBER = '9001011234567';

let warn: jest.SpyInstance;
let error: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  error = jest.spyOn(console, 'error').mockImplementation(() => {});
  (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: true, actor: 'kyungha', name: '황경하' });
  (hasApprovedEngagement as jest.Mock).mockResolvedValue(true);
  (loadCreatorResidentNumber as jest.Mock).mockResolvedValue(RESIDENT_NUMBER);
  (recordAdminPrivacyAccess as jest.Mock).mockResolvedValue(undefined);
});

afterEach(() => jest.restoreAllMocks());

it('인증 없으면 401이고 복호화도 기록도 하지 않으며 응답에 번호가 없다', async () => {
  (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: false });
  const r = await call();
  expect(r.status).toBe(401);
  expect(JSON.stringify(r.body)).not.toContain(RESIDENT_NUMBER);
  expect(loadCreatorResidentNumber).not.toHaveBeenCalled();
  expect(recordAdminPrivacyAccess).not.toHaveBeenCalled();
});

it('GET이 아니면 405, creatorId가 문자열이 아니면 400', async () => {
  expect((await call('POST')).status).toBe(405);
  expect((await call('GET', null)).status).toBe(400);
  expect(loadCreatorResidentNumber).not.toHaveBeenCalled();
});

it('Cache-Control: no-store', async () => {
  expect((await call()).setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
});

it('번호를 응답으로 돌려주고 성공을 남기되 값은 로그에 적지 않는다', async () => {
  const r = await call();
  expect(r.status).toBe(200);
  expect(r.body).toEqual({ ok: true, residentNumber: RESIDENT_NUMBER });
  expect(recordAdminPrivacyAccess).toHaveBeenCalledWith(expect.anything(), 'kyungha', ACTION, 'creator-1', 'success');
  expect(JSON.stringify(warn.mock.calls)).not.toContain('1234567');
  expect(JSON.stringify((recordAdminPrivacyAccess as jest.Mock).mock.calls)).not.toContain(RESIDENT_NUMBER);
});

it('승인된 등록이 없는 개설자면 404이고 복호화하지 않는다(시도는 남는다)', async () => {
  (hasApprovedEngagement as jest.Mock).mockResolvedValue(false);
  const r = await call();
  expect(r.status).toBe(404);
  expect(loadCreatorResidentNumber).not.toHaveBeenCalled();
  expect(recordAdminPrivacyAccess).toHaveBeenCalledWith(expect.anything(), 'kyungha', ACTION, 'creator-1', 'not_found');
});

it('저장된 번호가 없으면 404이고 그 시도도 남는다', async () => {
  (loadCreatorResidentNumber as jest.Mock).mockResolvedValue(null);
  expect((await call()).status).toBe(404);
  expect(recordAdminPrivacyAccess).toHaveBeenCalledWith(expect.anything(), 'kyungha', ACTION, 'creator-1', 'not_found');
});

it('복호화 실패는 사유별 문장과 함께 500이고 decrypt_failed로 남으며 로그에 값이 없다', async () => {
  (loadCreatorResidentNumber as jest.Mock).mockRejectedValue(new FieldCryptoError('key_mismatch', '내부 메시지'));
  const r = await call();
  expect(r.status).toBe(500);
  expect(r.body.code).toBe('key_mismatch');
  expect(String(r.body.message)).toContain('다른 키로 저장');
  expect(recordAdminPrivacyAccess).toHaveBeenCalledWith(expect.anything(), 'kyungha', ACTION, 'creator-1', 'decrypt_failed');
  expect(error).toHaveBeenCalledWith(expect.stringContaining('code=key_mismatch'));
  expect(JSON.stringify(error.mock.calls)).not.toContain(RESIDENT_NUMBER);
});

it('그 밖의 실패는 500이고 error로 남는다', async () => {
  (loadCreatorResidentNumber as jest.Mock).mockRejectedValue(new Error('DB 장애'));
  expect((await call()).status).toBe(500);
  expect(recordAdminPrivacyAccess).toHaveBeenCalledWith(expect.anything(), 'kyungha', ACTION, 'creator-1', 'error');
});

it('기록이 실패해도 조회 응답은 정상이다', async () => {
  (recordAdminPrivacyAccess as jest.Mock).mockRejectedValue(new Error('기록 실패'));
  const r = await call();
  expect(r.status).toBe(200);
  expect(r.body).toEqual({ ok: true, residentNumber: RESIDENT_NUMBER });
});
