import { parseFundingProject } from './projects';
import { validateCreatePledgePayload } from './validation';

const project = parseFundingProject(`---
slug: demo
title: 데모
summary: 요약
cover: /c.webp
goalAmount: 1000000
startAt: 2026-10-01T10:00:00+09:00
endAt: 2026-10-31T23:59:59+09:00
rewards:
  - id: cd
    title: CD
    description: d
    amount: 30000
    totalQuantity: 10
    requiresShipping: true
    estimatedDelivery: 2026-12
  - id: mail
    title: 감사 메일
    description: d
    amount: 5000
    requiresShipping: false
    estimatedDelivery: 2026-11
---
`, 'demo');
const NOW = new Date('2026-10-15T00:00:00Z');
const base = {
  projectSlug: 'demo', rewardId: 'mail', quantity: 1, additionalAmount: 0, paymentMethod: 'toss',
  customerName: '김후원', customerPhone: '010-1234-5678', customerEmail: 'a@b.com', displayNamePublic: true, termsAgreed: true,
};

describe('validateCreatePledgePayload', () => {
  it('정상 입력', () => {
    const r = validateCreatePledgePayload(base, project, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.reward.id).toBe('mail');
  });
  it('프로젝트 없음·live 아님', () => {
    expect(validateCreatePledgePayload(base, null, NOW).ok).toBe(false);
    expect(validateCreatePledgePayload(base, project, new Date('2026-11-05T00:00:00Z')).ok).toBe(false);
  });
  it('한정 수량 리워드는 무통장 불가', () => {
    const r = validateCreatePledgePayload({ ...base, rewardId: 'cd', paymentMethod: 'bank_transfer', shipping: { name: 'a', phone: '010', postcode: '1', address1: 'x' } }, project, NOW);
    expect(r).toMatchObject({ ok: false, message: expect.stringContaining('무통장') });
  });
  it('배송 리워드는 배송지 필수', () => {
    expect(validateCreatePledgePayload({ ...base, rewardId: 'cd' }, project, NOW).ok).toBe(false);
  });
  it('수량·추가 후원금 범위·약관·이메일', () => {
    expect(validateCreatePledgePayload({ ...base, quantity: 11 }, project, NOW).ok).toBe(false);
    expect(validateCreatePledgePayload({ ...base, additionalAmount: 1500 }, project, NOW).ok).toBe(false);
    expect(validateCreatePledgePayload({ ...base, additionalAmount: 6_000_000 }, project, NOW).ok).toBe(false);
    expect(validateCreatePledgePayload({ ...base, termsAgreed: false }, project, NOW).ok).toBe(false);
    expect(validateCreatePledgePayload({ ...base, customerEmail: 'nope' }, project, NOW).ok).toBe(false);
  });
});
