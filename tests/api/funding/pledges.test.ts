/** @jest-environment node */
jest.mock('../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));
jest.mock('../../../lib/funding/service', () => ({
  createFundingPledge: jest.fn(), expireStalePledges: jest.fn().mockResolvedValue(undefined),
  findFundingOrderByOrderNo: jest.fn().mockResolvedValue({ id: 'order-1', orderNo: 'FND-1' }),
}));
jest.mock('../../../lib/funding/email', () => ({ sendFundingBankDepositEmails: jest.fn().mockResolvedValue(null) }));
jest.mock('../../../lib/funding/projects', () => ({
  ...jest.requireActual('../../../lib/funding/projects'),
  getFundingProject: jest.fn(),
}));
const mockWhere = jest.fn().mockResolvedValue(undefined);
const mockSet = jest.fn(() => ({ where: mockWhere }));
const mockUpdate = jest.fn(() => ({ set: mockSet }));
jest.mock('../../../db/client', () => ({ getDb: jest.fn(() => ({ update: mockUpdate })) }));

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../pages/api/funding/pledges';
import { createFundingPledge, findFundingOrderByOrderNo } from '../../../lib/funding/service';
import { sendFundingBankDepositEmails } from '../../../lib/funding/email';
import { getFundingProject, parseFundingProject } from '../../../lib/funding/projects';

const project = parseFundingProject(`---
slug: demo
title: 데모
summary: s
cover: /c.webp
goalAmount: 1000
startAt: 2026-01-01T00:00:00+09:00
endAt: 2036-01-01T00:00:00+09:00
rewards:
  - id: mail
    title: 감사 메일
    description: d
    amount: 5000
    requiresShipping: false
    estimatedDelivery: 2026-11
---
`, 'demo');

const call = async (body: unknown) => {
  const json = jest.fn(); const status = jest.fn().mockReturnValue({ json });
  const res = { setHeader: jest.fn(), status } as unknown as NextApiResponse;
  await handler({ method: 'POST', body, headers: {}, socket: {} } as unknown as NextApiRequest, res);
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0][0] };
};
const body = { projectSlug: 'demo', rewardId: 'mail', quantity: 1, additionalAmount: 0, paymentMethod: 'bank_transfer',
  customerName: '김', customerPhone: '010', customerEmail: 'a@b.com', displayNamePublic: true, termsAgreed: true };

beforeEach(() => jest.clearAllMocks());

it('무통장 후원 생성 → 201 + depositUrl, 메일 발송을 await하고 emailSent: true', async () => {
  (getFundingProject as jest.Mock).mockReturnValue(project);
  (findFundingOrderByOrderNo as jest.Mock).mockResolvedValue({ id: 'order-1', orderNo: 'FND-1' });
  (sendFundingBankDepositEmails as jest.Mock).mockResolvedValue(null);
  (createFundingPledge as jest.Mock).mockResolvedValue({ ok: true, orderNo: 'FND-1', manageToken: 't', holdExpiresAt: new Date(0), amounts: { itemAmount: 4545, vatAmount: 455, totalAmount: 5000 } });
  const r = await call(body);
  expect(r.status).toBe(201);
  expect(r.body.depositUrl).toBe('/ko/funding/deposit/FND-1?token=t');
  expect(r.body.emailSent).toBe(true);
  expect(sendFundingBankDepositEmails).toHaveBeenCalledTimes(1);
  // notificationError를 null로 orders에 기록한다(성공 케이스도 기록해 실패 이력이 안 남는다).
  expect(mockUpdate).toHaveBeenCalled();
  expect(mockSet).toHaveBeenCalledWith({ notificationError: null });
});

it('메일 발송 실패 문자열이 반환되면 orders.notificationError에 기록하고 emailSent: false', async () => {
  (getFundingProject as jest.Mock).mockReturnValue(project);
  (findFundingOrderByOrderNo as jest.Mock).mockResolvedValue({ id: 'order-1', orderNo: 'FND-1' });
  (sendFundingBankDepositEmails as jest.Mock).mockResolvedValue('customer:send_failed');
  (createFundingPledge as jest.Mock).mockResolvedValue({ ok: true, orderNo: 'FND-1', manageToken: 't', holdExpiresAt: new Date(0), amounts: { itemAmount: 4545, vatAmount: 455, totalAmount: 5000 } });
  const r = await call(body);
  expect(r.status).toBe(201);
  expect(r.body.emailSent).toBe(false);
  expect(mockSet).toHaveBeenCalledWith({ notificationError: 'customer:send_failed' });
});

it('검증 실패 400, 품절 409', async () => {
  (getFundingProject as jest.Mock).mockReturnValue(project);
  expect((await call({ ...body, quantity: 0 })).status).toBe(400);
  (createFundingPledge as jest.Mock).mockResolvedValue({ ok: false, code: 'sold_out' });
  const r = await call(body);
  expect(r.status).toBe(409);
  expect(r.body.message).toBe('남은 수량보다 많이 신청했거나 방금 마감되었습니다. 수량을 줄이거나 다른 리워드를 선택해 주세요.');
});
