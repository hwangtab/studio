/** @jest-environment node */
jest.mock('../../../../../lib/contracts/admin-auth', () => ({ authenticateAdminApi: jest.fn() }));
jest.mock('../../../../../lib/funding/service', () => ({ findFundingOrderById: jest.fn() }));
jest.mock('../../../../../lib/funding/bank-transfer', () => ({ confirmBankDeposit: jest.fn() }));
jest.mock('../../../../../lib/funding/cancel', () => ({ cancelFundingPledge: jest.fn() }));
jest.mock('../../../../../lib/funding/email', () => ({ sendFundingConfirmedEmails: jest.fn(), sendFundingBankDepositEmails: jest.fn() }));
jest.mock('../../../../../lib/funding/projects', () => ({ getFundingProject: jest.fn() }));
const mockUpdate = jest.fn(() => ({ set: jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) })) }));
jest.mock('../../../../../db/client', () => ({
  getDb: jest.fn(() => ({ update: mockUpdate })),
}));

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../../../pages/api/admin/funding/pledges/[id]';
import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';
import { findFundingOrderById } from '../../../../../lib/funding/service';
import { confirmBankDeposit } from '../../../../../lib/funding/bank-transfer';
import { cancelFundingPledge } from '../../../../../lib/funding/cancel';
import { sendFundingConfirmedEmails, sendFundingBankDepositEmails } from '../../../../../lib/funding/email';

const call = async (method: string, query: unknown, body: unknown) => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { setHeader: jest.fn(), status } as unknown as NextApiResponse;
  await handler({ method, query, body, headers: {}, socket: {} } as unknown as NextApiRequest, res);
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0][0] };
};

const BASE_ORDER = {
  id: 'order-1',
  orderNo: 'FND-1',
  status: 'paid',
  fundingPledge: {
    id: 'pledge-1',
    projectSlug: 'demo',
    paymentMethod: 'bank_transfer',
    trackingCompany: null,
    trackingNumber: null,
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: true });
  (findFundingOrderById as jest.Mock).mockResolvedValue(BASE_ORDER);
});

it('인증 실패 → 401', async () => {
  (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: false });
  const r = await call('PATCH', { id: 'order-1' }, { action: 'confirm_deposit' });
  expect(r.status).toBe(401);
});

it('confirm_deposit → confirmBankDeposit 호출', async () => {
  (confirmBankDeposit as jest.Mock).mockResolvedValue({ ok: true });
  const r = await call('PATCH', { id: 'order-1' }, { action: 'confirm_deposit' });
  expect(confirmBankDeposit).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'order-1', now: expect.any(Date) }));
  expect(r.status).toBe(200);
  expect(r.body).toEqual({ ok: true });
});

it('refund → cancelFundingPledge를 requestedBy admin으로 호출', async () => {
  (cancelFundingPledge as jest.Mock).mockResolvedValue({ ok: true, mode: 'refunded' });
  const r = await call('PATCH', { id: 'order-1' }, { action: 'refund', reason: '고객 요청' });
  expect(cancelFundingPledge).toHaveBeenCalledWith(
    expect.objectContaining({ orderNo: 'FND-1', requestedBy: 'admin', reason: '고객 요청', now: expect.any(Date) }),
  );
  expect(r.status).toBe(200);
  expect(r.body).toEqual({ ok: true, mode: 'refunded' });
});

it('set_fulfillment 잘못된 값 → 400', async () => {
  const r = await call('PATCH', { id: 'order-1' }, { action: 'set_fulfillment', fulfillmentStatus: 'bogus' });
  expect(r.status).toBe(400);
});

it('set_fulfillment은 paid가 아닌 주문에서 409', async () => {
  (findFundingOrderById as jest.Mock).mockResolvedValue({ ...BASE_ORDER, status: 'pending' });
  const r = await call('PATCH', { id: 'order-1' }, { action: 'set_fulfillment', fulfillmentStatus: 'preparing' });
  expect(r.status).toBe(409);
});

it('알 수 없는 action → 400', async () => {
  const r = await call('PATCH', { id: 'order-1' }, { action: 'nope' });
  expect(r.status).toBe(400);
});

it('resend_email: refunded 주문은 재발송할 메일이 없어 409, DB 기록도 안 한다', async () => {
  (findFundingOrderById as jest.Mock).mockResolvedValue({ ...BASE_ORDER, status: 'refunded' });
  const r = await call('PATCH', { id: 'order-1' }, { action: 'resend_email' });
  expect(r.status).toBe(409);
  expect(r.body).toEqual({ ok: false, message: '재발송할 메일이 없는 상태입니다.' });
  expect(sendFundingConfirmedEmails).not.toHaveBeenCalled();
  expect(sendFundingBankDepositEmails).not.toHaveBeenCalled();
  expect(mockUpdate).not.toHaveBeenCalled();
});

it('resend_email: paid면 확정 메일을 재발송한다', async () => {
  (findFundingOrderById as jest.Mock).mockResolvedValue({ ...BASE_ORDER, status: 'paid' });
  (sendFundingConfirmedEmails as jest.Mock).mockResolvedValue(null);
  const r = await call('PATCH', { id: 'order-1' }, { action: 'resend_email' });
  expect(sendFundingConfirmedEmails).toHaveBeenCalled();
  expect(r.status).toBe(200);
});

it('resend_email: pending + 무통장이면 안내 메일을 재발송한다', async () => {
  (findFundingOrderById as jest.Mock).mockResolvedValue({ ...BASE_ORDER, status: 'pending' });
  (sendFundingBankDepositEmails as jest.Mock).mockResolvedValue(null);
  const r = await call('PATCH', { id: 'order-1' }, { action: 'resend_email' });
  expect(sendFundingBankDepositEmails).toHaveBeenCalled();
  expect(r.status).toBe(200);
});

it('resend_email: pending이어도 토스면 재발송할 메일이 없어 409', async () => {
  (findFundingOrderById as jest.Mock).mockResolvedValue({ ...BASE_ORDER, status: 'pending', fundingPledge: { ...BASE_ORDER.fundingPledge, paymentMethod: 'toss' } });
  const r = await call('PATCH', { id: 'order-1' }, { action: 'resend_email' });
  expect(r.status).toBe(409);
  expect(mockUpdate).not.toHaveBeenCalled();
});

it('resend_email: 수기 등록 + 플레이스홀더 이메일이면 409 — 발송하지 않는다', async () => {
  // 수기 등록 건에는 실제 고객 주소가 없다(manual@studionol.co.kr) — 재발송해 봐야
  // 우리 도메인으로 되돌아온다.
  (findFundingOrderById as jest.Mock).mockResolvedValue({
    ...BASE_ORDER, status: 'paid', customerEmail: 'manual@studionol.co.kr',
    fundingPledge: { ...BASE_ORDER.fundingPledge, entrySource: 'manual' },
  });
  const r = await call('PATCH', { id: 'order-1' }, { action: 'resend_email' });
  expect(r.status).toBe(409);
  expect(r.body).toEqual({ ok: false, message: '수기 등록 건은 메일을 보내지 않습니다.' });
  expect(sendFundingConfirmedEmails).not.toHaveBeenCalled();
});

it('resend_email: 수기 등록이어도 실제 고객 이메일이면 발송한다', async () => {
  (findFundingOrderById as jest.Mock).mockResolvedValue({
    ...BASE_ORDER, status: 'paid', customerEmail: 'real@example.com',
    fundingPledge: { ...BASE_ORDER.fundingPledge, entrySource: 'manual' },
  });
  (sendFundingConfirmedEmails as jest.Mock).mockResolvedValue(null);
  expect((await call('PATCH', { id: 'order-1' }, { action: 'resend_email' })).status).toBe(200);
});

it('set_fulfillment: 빈 문자열 운송장은 null로 저장한다(비우기)', async () => {
  // 예전엔 빈 문자열이 그대로 저장돼 잘못 입력한 운송장을 지울 방법이 없었다.
  const set = jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) }));
  mockUpdate.mockReturnValueOnce({ set } as never);
  (findFundingOrderById as jest.Mock).mockResolvedValue({
    ...BASE_ORDER, status: 'paid',
    fundingPledge: { ...BASE_ORDER.fundingPledge, trackingCompany: 'CJ', trackingNumber: '123' },
  });
  const r = await call('PATCH', { id: 'order-1' }, {
    action: 'set_fulfillment', fulfillmentStatus: 'preparing', trackingCompany: '', trackingNumber: '',
  });
  expect(r.status).toBe(200);
  expect(set).toHaveBeenCalledWith(expect.objectContaining({ trackingCompany: null, trackingNumber: null }));
});

/**
 * 무통장 청약철회는 refundRequestedAt만 찍고 주문은 paid로 남긴다. 예전엔 그 건도
 * '발송 완료'로 바꿀 수 있어서, 취소를 요청한 사람에게 실물이 나간 뒤 시스템 안에서는
 * 정상 발송으로 굳었다.
 */
it('set_fulfillment: 환불 요청된 후원은 409이고 DB를 건드리지 않는다', async () => {
  (findFundingOrderById as jest.Mock).mockResolvedValue({
    ...BASE_ORDER, status: 'paid',
    fundingPledge: { ...BASE_ORDER.fundingPledge, refundRequestedAt: new Date('2026-10-16T02:00:00Z') },
  });
  const r = await call('PATCH', { id: 'order-1' }, { action: 'set_fulfillment', fulfillmentStatus: 'shipped' });
  expect(r.status).toBe(409);
  expect(r.body).toEqual({
    ok: false,
    message: '환불 요청된 후원입니다. 환불을 처리하거나 요청을 취소한 뒤에 발송 상태를 바꿔 주세요.',
  });
  expect(mockUpdate).not.toHaveBeenCalled();
});

it('set_fulfillment: 환불 요청이 없으면 그대로 저장된다', async () => {
  const r = await call('PATCH', { id: 'order-1' }, { action: 'set_fulfillment', fulfillmentStatus: 'shipped' });
  expect(r.status).toBe(200);
  expect(mockUpdate).toHaveBeenCalled();
});

// 이게 없으면 발송 차단이 영구 잠금이 된다 — refundRequestedAt을 지우는 코드가 없었다.
it('clear_refund_request: 확정 건의 요청을 지운다', async () => {
  const set = jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) }));
  mockUpdate.mockReturnValueOnce({ set } as never);
  (findFundingOrderById as jest.Mock).mockResolvedValue({
    ...BASE_ORDER, status: 'paid',
    fundingPledge: { ...BASE_ORDER.fundingPledge, refundRequestedAt: new Date('2026-10-16T02:00:00Z') },
  });
  const r = await call('PATCH', { id: 'order-1' }, { action: 'clear_refund_request' });
  expect(r.status).toBe(200);
  expect(set).toHaveBeenCalledWith(expect.objectContaining({ refundRequestedAt: null }));
});

it('clear_refund_request: 요청이 없으면 409, 이미 환불된 건도 409', async () => {
  expect((await call('PATCH', { id: 'order-1' }, { action: 'clear_refund_request' })).status).toBe(409);
  (findFundingOrderById as jest.Mock).mockResolvedValue({
    ...BASE_ORDER, status: 'refunded',
    fundingPledge: { ...BASE_ORDER.fundingPledge, refundRequestedAt: new Date('2026-10-16T02:00:00Z') },
  });
  expect((await call('PATCH', { id: 'order-1' }, { action: 'clear_refund_request' })).status).toBe(409);
  expect(mockUpdate).not.toHaveBeenCalled();
});
