/** @jest-environment node */
jest.mock('../../../../../lib/contracts/admin-auth', () => ({ authenticateAdminApi: jest.fn() }));
jest.mock('../../../../../lib/funding/service', () => ({
  ...jest.requireActual('../../../../../lib/funding/service'),
  findFundingOrderById: jest.fn(),
}));
jest.mock('../../../../../lib/funding/bankTransfer', () => ({
  confirmBankDeposit: jest.fn(),
  cancelUnpaidBankDeposit: jest.fn(),
  deliverDepositGuide: jest.fn(),
}));
jest.mock('../../../../../lib/funding/refundAccount', () => ({ deleteRefundAccount: jest.fn() }));
jest.mock('../../../../../lib/funding/email', () => ({ sendFundingRefundRequestClearedEmails: jest.fn().mockResolvedValue(null) }));
jest.mock('../../../../../lib/funding/repository', () => ({ getFundingProjectAsync: jest.fn() }));
jest.mock('../../../../../db/client', () => ({
  getDb: jest.fn(() => ({
    update: jest.fn(() => ({ set: jest.fn(() => ({ where: jest.fn().mockResolvedValue({ rowsAffected: 1 }) })) })),
    run: jest.fn().mockResolvedValue({ rowsAffected: 1 }),
  })),
}));

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../../../pages/api/admin/funding/pledges/[id]';
import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';
import { findFundingOrderById } from '../../../../../lib/funding/service';
import { cancelUnpaidBankDeposit, confirmBankDeposit, deliverDepositGuide } from '../../../../../lib/funding/bankTransfer';
import { deleteRefundAccount } from '../../../../../lib/funding/refundAccount';

/** 관리자 후원 상세의 계좌 입금 조작 — 입금 확인·미입금 취소·입금 안내 재발송, 그리고 환불 요청 철회 시 계좌 삭제. */
const call = async (body: unknown) => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { setHeader: jest.fn(), status } as unknown as NextApiResponse;
  await handler({ method: 'PATCH', query: { id: 'order-1' }, body, headers: {}, socket: {} } as unknown as NextApiRequest, res);
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0][0] };
};

const ORDER = {
  id: 'order-1', orderNo: 'FND-1', status: 'pending', customerName: '김후원', customerEmail: 'a@example.com', totalAmount: 5000, payments: [],
  fundingPledge: { id: 'pledge-1', projectSlug: 'demo', paymentMethod: 'bank_transfer', entrySource: 'online', adminMemo: null, refundRequestedAt: null },
};

beforeEach(() => {
  jest.clearAllMocks();
  (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: true, actor: 'kyungha' });
  (findFundingOrderById as jest.Mock).mockResolvedValue(ORDER);
});

it('confirm_deposit — 성공은 200, 이미 처리됨은 409', async () => {
  (confirmBankDeposit as jest.Mock).mockResolvedValueOnce({ ok: true, emailSent: true });
  expect((await call({ action: 'confirm_deposit' })).status).toBe(200);
  expect(confirmBankDeposit).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'order-1' }));
  (confirmBankDeposit as jest.Mock).mockResolvedValueOnce({ ok: false, code: 'invalid_state', message: '이미 확인됐거나' });
  expect((await call({ action: 'confirm_deposit' })).status).toBe(409);
});

it('confirm_deposit — 확정 메일이 실패하면 성공 응답에 재발송 안내를 싣는다', async () => {
  (confirmBankDeposit as jest.Mock).mockResolvedValueOnce({ ok: true, emailSent: false });
  const r = await call({ action: 'confirm_deposit' });
  expect(r.status).toBe(200);
  expect(r.body.message).toContain('메일 재발송');
});

it('cancel_unpaid — 미입금 취소', async () => {
  (cancelUnpaidBankDeposit as jest.Mock).mockResolvedValueOnce({ ok: true });
  expect((await call({ action: 'cancel_unpaid' })).status).toBe(200);
  (cancelUnpaidBankDeposit as jest.Mock).mockResolvedValueOnce({ ok: false, code: 'invalid_state', message: 'x' });
  expect((await call({ action: 'cancel_unpaid' })).status).toBe(409);
});

it('resend_deposit_guide — 입금 대기 계좌 입금에만, 실패 사유는 502로', async () => {
  (deliverDepositGuide as jest.Mock).mockResolvedValueOnce(null);
  expect((await call({ action: 'resend_deposit_guide' })).status).toBe(200);
  (deliverDepositGuide as jest.Mock).mockResolvedValueOnce('customer:down');
  expect((await call({ action: 'resend_deposit_guide' })).status).toBe(502);
  (findFundingOrderById as jest.Mock).mockResolvedValueOnce({ ...ORDER, status: 'paid' });
  expect((await call({ action: 'resend_deposit_guide' })).status).toBe(409);
});

it('환불 요청을 철회 처리하면 접수된 환불 계좌를 지운다', async () => {
  (findFundingOrderById as jest.Mock).mockResolvedValue({
    ...ORDER, status: 'paid', fundingPledge: { ...ORDER.fundingPledge, refundRequestedAt: new Date() },
  });
  const r = await call({ action: 'clear_refund_request', reason: '후원자가 철회' });
  expect(r.status).toBe(200);
  expect(deleteRefundAccount).toHaveBeenCalledWith('order-1');
});
