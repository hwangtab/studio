/** @jest-environment node */
jest.mock('../../../../lib/contracts/admin-auth', () => ({ authenticateAdminApi: jest.fn() }));
jest.mock('../../../../lib/payments/refundAccount', () => ({
  ...jest.requireActual('../../../../lib/payments/refundAccount'),
  loadRefundAccount: jest.fn(),
}));
jest.mock('../../../../lib/funding/service', () => ({ findFundingOrderById: jest.fn() }));
jest.mock('../../../../lib/privacy/accessLog', () => ({ recordAdminPrivacyAccess: jest.fn() }));

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../../pages/api/admin/funding/pledges/[id]/refund-account';
import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { loadRefundAccount } from '../../../../lib/payments/refundAccount';
import { findFundingOrderById } from '../../../../lib/funding/service';
import { recordAdminPrivacyAccess } from '../../../../lib/privacy/accessLog';
import { FieldCryptoError } from '../../../../lib/crypto/fieldCrypto';

/**
 * 계좌 입금 후원자의 환불 계좌 "계좌 보기"(마이그레이션 0048). 정산 계좌 조회와 같은 규칙 —
 * 응답으로만 내보내고(no-store), 성공·실패를 가리지 않고 접속기록을 남기되 값은 적지 않는다.
 */
const call = async (method = 'GET', id: unknown = 'order-1') => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const setHeader = jest.fn();
  const res = { setHeader, status } as unknown as NextApiResponse;
  await handler({ method, query: { id }, headers: {}, socket: {} } as unknown as NextApiRequest, res);
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0][0] as Record<string, unknown>, setHeader };
};

const ACCOUNT = { bankName: '국민은행', accountNumber: '123-456-7890123', accountHolder: '김후원' };
let errorSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: true, actor: 'kyungha', name: '황경하' });
  (findFundingOrderById as jest.Mock).mockResolvedValue({ id: 'order-1', orderNo: 'FND-1', customerName: '김후원', fundingPledge: { id: 'p1' } });
  (loadRefundAccount as jest.Mock).mockResolvedValue(ACCOUNT);
  (recordAdminPrivacyAccess as jest.Mock).mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());

it('인증 없으면 401이고 계좌를 읽지 않는다', async () => {
  (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: false });
  expect((await call()).status).toBe(401);
  expect(loadRefundAccount).not.toHaveBeenCalled();
});

it('GET이 아니면 405, id가 없으면 400', async () => {
  expect((await call('POST')).status).toBe(405);
  expect((await call('GET', null)).status).toBe(400);
});

it('Cache-Control: no-store', async () => {
  expect((await call()).setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
});

it('계좌를 응답으로 돌려주고 접속기록(funding_refund_account_view)을 남긴다', async () => {
  const r = await call();
  expect(r.status).toBe(200);
  expect(r.body).toEqual({ ok: true, account: ACCOUNT, holderMismatch: false });
  expect(recordAdminPrivacyAccess).toHaveBeenCalledWith(expect.anything(), 'kyungha', 'funding_refund_account_view', 'order-1', 'success');
  // 기록 인자에 계좌번호가 섞이지 않는다.
  expect(JSON.stringify((recordAdminPrivacyAccess as jest.Mock).mock.calls)).not.toContain('7890123');
});

it('예금주가 후원자 이름과 다르면 경고만 한다(막지 않는다)', async () => {
  (loadRefundAccount as jest.Mock).mockResolvedValue({ ...ACCOUNT, accountHolder: '김부모' });
  const r = await call();
  expect(r.status).toBe(200);
  expect(r.body.holderMismatch).toBe(true);
});

it('접수된 계좌가 없으면 404 + not_found 기록', async () => {
  (loadRefundAccount as jest.Mock).mockResolvedValue(null);
  const r = await call();
  expect(r.status).toBe(404);
  expect(recordAdminPrivacyAccess).toHaveBeenCalledWith(expect.anything(), 'kyungha', 'funding_refund_account_view', 'order-1', 'not_found');
});

it('복호화 실패는 decrypt_failed로 남기고 계좌번호를 로그에 적지 않는다', async () => {
  (loadRefundAccount as jest.Mock).mockRejectedValue(new FieldCryptoError('key_mismatch', 'x'));
  const r = await call();
  expect(r.status).toBe(500);
  expect(r.body.code).toBe('key_mismatch');
  expect(recordAdminPrivacyAccess).toHaveBeenCalledWith(expect.anything(), 'kyungha', 'funding_refund_account_view', 'order-1', 'decrypt_failed');
  expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('7890123');
});

it('결제 공용 표를 펀딩 주문 키로 읽는다', async () => {
  await call();
  expect(loadRefundAccount).toHaveBeenCalledWith({ kind: 'funding', orderNo: 'FND-1' });
});
