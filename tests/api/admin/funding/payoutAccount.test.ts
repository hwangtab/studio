/** @jest-environment node */
jest.mock('../../../../lib/contracts/admin-auth', () => ({ authenticateAdminApi: jest.fn() }));
jest.mock('../../../../lib/funding/payoutAccount', () => ({ loadFundingPayoutAccount: jest.fn() }));
jest.mock('../../../../lib/privacy/accessLog', () => ({ recordAdminPrivacyAccess: jest.fn() }));

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../../pages/api/admin/funding/projects/[id]/payout-account';
import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { loadFundingPayoutAccount } from '../../../../lib/funding/payoutAccount';
import { recordAdminPrivacyAccess } from '../../../../lib/privacy/accessLog';
import { FieldCryptoError } from '../../../../lib/crypto/fieldCrypto';

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
  (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: true, actor: 'kyungha', name: '황경하' });
  (loadFundingPayoutAccount as jest.Mock).mockResolvedValue(ACCOUNT);
  (recordAdminPrivacyAccess as jest.Mock).mockResolvedValue(undefined);
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

/**
 * 계좌는 은행명·예금주까지 한 벌로 암호화돼 있어(`payoutAccountCrypto.ts`) 키가 없거나
 * 바뀌면 열리지 않는다. 그때 운영자가 할 일은 사유마다 다르다 — "없다"와 "못 연다"를
 * 섞으면 멀쩡한 값을 두고 개설자에게 재등록을 요청하게 된다.
 */
describe('복호화 실패', () => {
  const failWith = (code: FieldCryptoError['code']) => {
    (loadFundingPayoutAccount as jest.Mock).mockRejectedValue(new FieldCryptoError(code, '테스트'));
  };

  it('키가 없으면 사유 코드와 함께 500이고, 환경 변수를 확인하라고 적는다', async () => {
    failWith('missing_key');
    const r = await call();
    expect(r.status).toBe(500);
    expect(r.body).toMatchObject({ ok: false, code: 'missing_key' });
    expect(String(r.body.message)).toContain('FUNDING_FIELD_KEY');
  });

  it('키가 다르면 재등록을 요청하지 말라고 적는다 — 값은 멀쩡하다', async () => {
    failWith('key_mismatch');
    const r = await call();
    expect(r.body).toMatchObject({ code: 'key_mismatch' });
    expect(String(r.body.message)).toContain('재등록을 요청하지 마세요');
  });

  it('복호화 실패도 접속기록에 남는다 — decrypt_failed', async () => {
    failWith('auth_failed');
    await call();
    expect(recordAdminPrivacyAccess).toHaveBeenCalledWith(
      expect.anything(),
      'kyungha',
      'funding_payout_account_view',
      'proj-1',
      'decrypt_failed',
    );
  });
});


/**
 * 계좌번호는 고유식별정보가 아니지만 주민등록번호와 같은 개인정보처리시스템이라 같은 표에
 * 남고, 따라서 2년 보관 기준이 함께 걸린다.
 */
describe('접속기록', () => {
  it('성공한 조회를 남긴다 — 계좌번호는 넘기지 않는다', async () => {
    await call();
    expect(recordAdminPrivacyAccess).toHaveBeenCalledWith(
      expect.anything(),
      'kyungha',
      'funding_payout_account_view',
      'proj-1',
      'success',
    );
    expect(JSON.stringify((recordAdminPrivacyAccess as jest.Mock).mock.calls)).not.toContain('123-456-789012');
  });

  it('등록된 계좌가 없던 조회도 남는다', async () => {
    (loadFundingPayoutAccount as jest.Mock).mockResolvedValue(null);
    await call();
    expect(recordAdminPrivacyAccess).toHaveBeenCalledWith(expect.anything(), 'kyungha', 'funding_payout_account_view', 'proj-1', 'not_found');
  });


  /** 기록의 수행자는 **지금 로그인한 사람**이다 — 예전엔 고정값 하나였다. */
  it('지금 로그인한 사람이 기록된다 — 고정값이 아니다', async () => {
    (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: true, actor: 'jina', name: '지나' });
    await call();
    expect((recordAdminPrivacyAccess as jest.Mock).mock.calls[0][1]).toBe('jina');
  });

  it('실패한 조회도 남는다', async () => {
    (loadFundingPayoutAccount as jest.Mock).mockRejectedValue(new Error('DB 장애'));
    await call();
    expect(recordAdminPrivacyAccess).toHaveBeenCalledWith(expect.anything(), 'kyungha', 'funding_payout_account_view', 'proj-1', 'error');
  });

  it('인증 전에는 기록하지 않는다', async () => {
    (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: false });
    await call();
    expect(recordAdminPrivacyAccess).not.toHaveBeenCalled();
  });

  it('기록이 실패해도 조회 응답은 정상이다', async () => {
    (recordAdminPrivacyAccess as jest.Mock).mockRejectedValue(new Error('기록 실패'));
    const r = await call();
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, account: ACCOUNT });
  });
});
