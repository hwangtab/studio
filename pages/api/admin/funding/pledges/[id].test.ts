/** @jest-environment node */
jest.mock('../../../../../lib/contracts/admin-auth', () => ({ authenticateAdminApi: jest.fn() }));
jest.mock('../../../../../lib/funding/service', () => ({ findFundingOrderById: jest.fn() }));
jest.mock('../../../../../lib/funding/bank-transfer', () => ({ confirmBankDeposit: jest.fn() }));
jest.mock('../../../../../lib/funding/cancel', () => ({ cancelFundingPledge: jest.fn() }));
jest.mock('../../../../../lib/funding/email', () => ({ sendFundingConfirmedEmails: jest.fn(), sendFundingBankDepositEmails: jest.fn() }));
jest.mock('../../../../../lib/funding/projects', () => ({ getFundingProject: jest.fn() }));
jest.mock('../../../../../db/client', () => ({
  getDb: jest.fn(() => ({
    update: jest.fn(() => ({ set: jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) })) })),
  })),
}));

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from './[id]';
import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';
import { findFundingOrderById } from '../../../../../lib/funding/service';
import { confirmBankDeposit } from '../../../../../lib/funding/bank-transfer';
import { cancelFundingPledge } from '../../../../../lib/funding/cancel';

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

it('알 수 없는 action → 400', async () => {
  const r = await call('PATCH', { id: 'order-1' }, { action: 'nope' });
  expect(r.status).toBe(400);
});
