/** @jest-environment node */
jest.mock('../../../../lib/contracts/admin-auth', () => ({ authenticateAdminApi: jest.fn() }));
jest.mock('../../../../lib/funding/residentNumber', () => ({ loadFundingResidentNumber: jest.fn() }));

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../../pages/api/admin/funding/projects/[id]/resident-number';
import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { loadFundingResidentNumber } from '../../../../lib/funding/residentNumber';
import { FieldCryptoError } from '../../../../lib/crypto/fieldCrypto';

const call = async (method = 'GET', id: unknown = 'proj-1') => {
  // payoutAccount.test.ts와 같은 호출 껍데기 — 기본값 인자라 비문자열 검증은 null로 한다.
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

/** 테스트에도 실제 주민등록번호를 쓰지 않는다 — 형식만 같은 가짜다. */
const RESIDENT_NUMBER = '9001011234567';

let warn: jest.SpyInstance;
let error: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  error = jest.spyOn(console, 'error').mockImplementation(() => {});
  (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: true });
  (loadFundingResidentNumber as jest.Mock).mockResolvedValue(RESIDENT_NUMBER);
});

afterEach(() => jest.restoreAllMocks());

it('인증 없으면 401이고 복호화를 시도조차 하지 않는다', async () => {
  (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: false });
  const r = await call();
  expect(r.status).toBe(401);
  expect(loadFundingResidentNumber).not.toHaveBeenCalled();
});

it('GET이 아니면 405', async () => {
  expect((await call('POST')).status).toBe(405);
});

it('id가 문자열이 아니면 400', async () => {
  expect((await call('GET', null)).status).toBe(400);
  expect(loadFundingResidentNumber).not.toHaveBeenCalled();
});

/** 복호화된 값이 담긴 응답이 중간 캐시·브라우저 캐시에 남으면 안 된다. */
it('Cache-Control: no-store', async () => {
  expect((await call()).setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
});

it('등록된 번호가 없으면 404', async () => {
  (loadFundingResidentNumber as jest.Mock).mockResolvedValue(null);
  expect((await call()).status).toBe(404);
});

it('번호를 응답으로 돌려주고, 조회 사실을 남기되 값은 로그에 적지 않는다', async () => {
  const r = await call();
  expect(r.status).toBe(200);
  expect(r.body).toEqual({ ok: true, residentNumber: RESIDENT_NUMBER });
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('주민등록번호 조회'));
  expect(JSON.stringify(warn.mock.calls)).not.toContain(RESIDENT_NUMBER);
  expect(JSON.stringify(warn.mock.calls)).not.toContain('1234567');
});

/**
 * 복호화 실패는 사유마다 운영자가 할 일이 다르다 — 키가 없으면 환경 변수를 등록해야 하고,
 * 인증 태그가 안 맞으면 키가 바뀐 것인지 값이 깨진 것인지부터 가려야 한다.
 */
describe('복호화 오류별 응답', () => {
  const cases: Array<[FieldCryptoError['code'], string]> = [
    ['missing_key', 'FUNDING_FIELD_KEY'],
    ['invalid_key', 'base64'],
    ['malformed', '다시 등록'],
    ['unsupported_version', '판본'],
    ['auth_failed', '저장 당시와 다르거나'],
  ];

  it.each(cases)('%s는 그 사유에 맞는 문장을 돌려준다', async (code, phrase) => {
    (loadFundingResidentNumber as jest.Mock).mockRejectedValue(new FieldCryptoError(code, '내부 메시지'));
    const r = await call();
    expect(r.status).toBe(500);
    expect(r.body.code).toBe(code);
    expect(String(r.body.message)).toContain(phrase);
  });

  it('실패 로그에도 값이 없다 — 코드만 남긴다', async () => {
    (loadFundingResidentNumber as jest.Mock).mockRejectedValue(new FieldCryptoError('auth_failed', '내부 메시지'));
    await call();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('code=auth_failed'));
    expect(JSON.stringify(error.mock.calls)).not.toContain(RESIDENT_NUMBER);
  });
});

it('복호화 외의 실패도 500으로 접는다', async () => {
  (loadFundingResidentNumber as jest.Mock).mockRejectedValue(new Error('DB 장애'));
  expect((await call()).status).toBe(500);
});
