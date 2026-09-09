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
import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { TOSS_HOLD_SECONDS } from '../../../lib/funding/policy';

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

/** 수량 제한이 있는 리워드가 있어야 홀드 카운터 분기를 탈 수 있다. */
const limitedProject = parseFundingProject(`---
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
  - id: cd
    title: CD
    description: d
    amount: 30000
    totalQuantity: 10
    requiresShipping: true
    estimatedDelivery: 2026-12
---
`, 'demo');

/** cd 리워드는 배송이 필요하다 — 검증을 통과해야 홀드 카운터 분기까지 도달한다. */
const cdBodyExtra = { rewardId: 'cd', shipping: { name: '김', phone: '010', postcode: '12345', address1: '어딘가', address2: '', memo: '' } };

const call = async (body: unknown) => {
  const json = jest.fn(); const status = jest.fn().mockReturnValue({ json });
  const res = { setHeader: jest.fn(), status } as unknown as NextApiResponse;
  await handler({ method: 'POST', body, headers: {}, socket: {} } as unknown as NextApiRequest, res);
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0][0] };
};
const body = { projectSlug: 'demo', rewardId: 'mail', quantity: 1, additionalAmount: 0, paymentMethod: 'bank_transfer',
  customerName: '김', customerPhone: '010', customerEmail: 'a@b.com', displayNamePublic: true, termsAgreed: true };

beforeEach(() => {
  jest.clearAllMocks();
  (consumeRateLimit as jest.Mock).mockResolvedValue(true);
});

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

describe('속도 제한 · 홀드 상한', () => {
  it('검증 실패(400)는 속도 제한 카운터를 소비하지 않는다', async () => {
    // 예전엔 rate limit을 먼저 소비해서, 폼 오류만 반복해도 시간당 한도가 닳아
    // 정작 제대로 채운 제출이 429로 막혔다.
    (getFundingProject as jest.Mock).mockReturnValue(project);
    const r = await call({ ...body, quantity: 0 });
    expect(r.status).toBe(400);
    expect(consumeRateLimit).not.toHaveBeenCalled();
  });

  it('검증을 통과하면 funding_create를 시간당 20회로 소비한다', async () => {
    (getFundingProject as jest.Mock).mockReturnValue(project);
    (createFundingPledge as jest.Mock).mockResolvedValue({ ok: false, code: 'sold_out' });
    await call(body);
    expect(consumeRateLimit).toHaveBeenCalledWith(expect.stringContaining('funding_create:ip:'), 20, 3600);
  });

  it('한정 리워드 + 토스면 IP 홀드 카운터를 홀드 창 길이로 함께 소비한다', async () => {
    (getFundingProject as jest.Mock).mockReturnValue(limitedProject);
    (createFundingPledge as jest.Mock).mockResolvedValue({ ok: false, code: 'sold_out' });
    await call({ ...body, ...cdBodyExtra, paymentMethod: 'toss' });
    expect(consumeRateLimit).toHaveBeenCalledWith(expect.stringContaining('funding_hold:ip:'), 3, TOSS_HOLD_SECONDS);
  });

  it('무제한 리워드나 무통장에는 홀드 카운터를 쓰지 않는다', async () => {
    (getFundingProject as jest.Mock).mockReturnValue(limitedProject);
    (createFundingPledge as jest.Mock).mockResolvedValue({ ok: false, code: 'sold_out' });
    await call({ ...body, rewardId: 'mail', paymentMethod: 'toss' });
    await call({ ...body, ...cdBodyExtra, paymentMethod: 'bank_transfer' });
    expect((consumeRateLimit as jest.Mock).mock.calls.filter(([k]) => String(k).startsWith('funding_hold:'))).toHaveLength(0);
  });

  it('IP 홀드 카운터가 초과되면 429 + 안내 문구', async () => {
    (getFundingProject as jest.Mock).mockReturnValue(limitedProject);
    (consumeRateLimit as jest.Mock).mockImplementation(async (key: string) => !key.startsWith('funding_hold:'));
    const r = await call({ ...body, ...cdBodyExtra, paymentMethod: 'toss' });
    expect(r.status).toBe(429);
    expect(r.body.message).toBe('결제 대기 중인 후원이 너무 많습니다. 15분 뒤 다시 시도해 주세요.');
    expect(createFundingPledge).not.toHaveBeenCalled();
  });

  it('고객 단위 홀드 상한(too_many_holds)도 409가 아니라 429다', async () => {
    (getFundingProject as jest.Mock).mockReturnValue(project);
    (createFundingPledge as jest.Mock).mockResolvedValue({ ok: false, code: 'too_many_holds' });
    const r = await call(body);
    expect(r.status).toBe(429);
    expect(r.body.message).toBe('결제 대기 중인 후원이 너무 많습니다. 15분 뒤 다시 시도해 주세요.');
  });
});
