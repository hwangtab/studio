/** @jest-environment node */
jest.mock('../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));
jest.mock('../../../lib/funding/service', () => ({
  createFundingPledge: jest.fn(), expireStalePledges: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../lib/funding/projects', () => ({
  ...jest.requireActual('../../../lib/funding/projects'),
  getFundingProject: jest.fn(),
}));

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../pages/api/funding/pledges';
import { createFundingPledge } from '../../../lib/funding/service';
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
const body = { projectSlug: 'demo', rewardId: 'mail', quantity: 1, additionalAmount: 0, paymentMethod: 'toss',
  customerName: '김', customerPhone: '010', customerEmail: 'a@b.com', displayNamePublic: true, termsAgreed: true };

beforeEach(() => {
  jest.clearAllMocks();
  (consumeRateLimit as jest.Mock).mockResolvedValue(true);
});

/**
 * 클라이언트는 남은 시간을 (holdExpiresAt − serverNow)로 재고, 경과분만 자기 시계로 센다
 * (components/funding/PledgeWizard.tsx holdDurationMs). serverNow가 빠지면 기기 시계가 빠른
 * 후원자에게 결제 위젯이 영영 안 뜨던 상태로 되돌아간다.
 */
it('응답에 holdExpiresAt과 같은 시계의 serverNow가 함께 실린다', async () => {
  (getFundingProject as jest.Mock).mockReturnValue(project);
  const holdExpiresAt = new Date('2026-10-15T03:15:00Z');
  (createFundingPledge as jest.Mock).mockResolvedValue({ ok: true, orderNo: 'FND-1', manageToken: 't', holdExpiresAt, amounts: { itemAmount: 4545, vatAmount: 455, totalAmount: 5000 } });
  const r = await call({ ...body, paymentMethod: 'toss' });
  expect(r.status).toBe(201);
  expect(typeof r.body.serverNow).toBe('string');
  expect(Number.isFinite(new Date(r.body.serverNow).getTime())).toBe(true);
  // 홀드는 아직 남아 있어야 한다 — 이 차이가 곧 클라이언트의 카운트다운 총량이다.
  expect(new Date(r.body.holdExpiresAt).getTime() - new Date(r.body.serverNow).getTime()).toBeGreaterThan(0);
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

  it('한정 리워드 + 토스면 IP 시도 카운터를 홀드 창 길이로 함께 소비한다', async () => {
    (getFundingProject as jest.Mock).mockReturnValue(limitedProject);
    (createFundingPledge as jest.Mock).mockResolvedValue({ ok: false, code: 'sold_out' });
    await call({ ...body, ...cdBodyExtra, paymentMethod: 'toss' });
    expect(consumeRateLimit).toHaveBeenCalledWith(expect.stringContaining('funding_hold:ip:'), 5, TOSS_HOLD_SECONDS);
  });

  it('무제한 리워드는 위저드 재제출을 4번 반복해도 전부 201 — IP 카운터를 쓰지 않는다', async () => {
    (getFundingProject as jest.Mock).mockReturnValue(limitedProject);
    (createFundingPledge as jest.Mock).mockResolvedValue({ ok: true, orderNo: 'FND-1', manageToken: 't', holdExpiresAt: new Date(0), amounts: { itemAmount: 4545, vatAmount: 455, totalAmount: 5000 } });
    for (let i = 0; i < 4; i += 1) {
      expect((await call({ ...body, rewardId: 'mail', paymentMethod: 'toss' })).status).toBe(201);
    }
    expect((consumeRateLimit as jest.Mock).mock.calls.filter(([k]) => String(k).startsWith('funding_hold:'))).toHaveLength(0);
  });

  it('무제한 리워드에는 홀드 카운터를 쓰지 않는다', async () => {
    (getFundingProject as jest.Mock).mockReturnValue(limitedProject);
    (createFundingPledge as jest.Mock).mockResolvedValue({ ok: false, code: 'sold_out' });
    await call({ ...body, rewardId: 'mail', paymentMethod: 'toss' });
    expect((consumeRateLimit as jest.Mock).mock.calls.filter(([k]) => String(k).startsWith('funding_hold:'))).toHaveLength(0);
  });

  it('IP 시도 카운터가 초과되면 429 + 안내 문구', async () => {
    (getFundingProject as jest.Mock).mockReturnValue(limitedProject);
    (consumeRateLimit as jest.Mock).mockImplementation(async (key: string) => !key.startsWith('funding_hold:'));
    const r = await call({ ...body, ...cdBodyExtra, paymentMethod: 'toss' });
    expect(r.status).toBe(429);
    expect(r.body.message).toBe('한정 리워드 결제 시도가 잦습니다. 15분 뒤 다시 시도해 주세요.');
    expect(createFundingPledge).not.toHaveBeenCalled();
  });
});
