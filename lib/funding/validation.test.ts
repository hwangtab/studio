import { PLEDGE_TEXT_LIMITS } from './policy';
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
  // 무통장입금은 2026-09-11에 중단했다 — 예전 클라이언트나 손으로 만든 요청이
  // 'bank_transfer'를 보내도 결제수단 검증에서 곧바로 걸린다(한정 수량 여부와 무관).
  it('toss가 아닌 결제수단은 거부한다', () => {
    const r = validateCreatePledgePayload({ ...base, rewardId: 'cd', paymentMethod: 'bank_transfer', shipping: { name: 'a', phone: '010', postcode: '1', address1: 'x' } }, project, NOW);
    expect(r).toMatchObject({ ok: false, message: '결제수단을 선택해 주세요.' });
  });
  it('배송 리워드는 배송지 필수', () => {
    expect(validateCreatePledgePayload({ ...base, rewardId: 'cd' }, project, NOW).ok).toBe(false);
  });
  it('수량·추가 펀딩 금액 범위·약관·이메일', () => {
    expect(validateCreatePledgePayload({ ...base, quantity: 11 }, project, NOW).ok).toBe(false);
    expect(validateCreatePledgePayload({ ...base, additionalAmount: 1500 }, project, NOW).ok).toBe(false);
    expect(validateCreatePledgePayload({ ...base, additionalAmount: 6_000_000 }, project, NOW).ok).toBe(false);
    expect(validateCreatePledgePayload({ ...base, termsAgreed: false }, project, NOW).ok).toBe(false);
    expect(validateCreatePledgePayload({ ...base, customerEmail: 'nope' }, project, NOW).ok).toBe(false);
  });
});

/**
 * 감사가 돌린 경계값 24종을 그대로 옮긴 것이다. 절반은 **지금 올바르게 동작하는 것**인데,
 * 어느 것도 테스트로 고정돼 있지 않아 망가뜨려도 CI가 서지 않았다 — 거부해야 할 것을
 * 거부하는지와, 통과해야 할 것을 통과시키는지를 같은 자리에서 본다.
 */
describe('경계값 — 감사 probe 24종', () => {
  const shipBase = { name: '받는', phone: '010', postcode: '12345', address1: '주소' };
  const ok = (body: unknown) => validateCreatePledgePayload(body, project, NOW);

  describe('상한 초과는 거부한다 (조용히 버리지 않는다)', () => {
    it('응원 메시지 501자', () => {
      const r = ok({ ...base, supporterMessage: 'ㄱ'.repeat(PLEDGE_TEXT_LIMITS.supporterMessage + 1) });
      expect(r.ok).toBe(false);
      expect(r.ok === false && r.message).toContain('500자');
    });
    it('응원 메시지 500자는 통과하고 그대로 저장된다', () => {
      const msg = 'ㄱ'.repeat(PLEDGE_TEXT_LIMITS.supporterMessage);
      const r = ok({ ...base, supporterMessage: msg });
      expect(r.ok && r.value.supporterMessage).toBe(msg);
    });
    it('이름 51자', () => {
      const r = ok({ ...base, customerName: 'a'.repeat(51) });
      expect(r).toMatchObject({ ok: false });
      expect(r.ok === false && r.message).toContain('50자');
    });
    it('상세주소 201자 — 주문이 성공하고 값만 사라지면 안 된다', () => {
      const r = ok({ ...base, rewardId: 'cd', shipping: { ...shipBase, address2: 'b'.repeat(201) } });
      expect(r.ok).toBe(false);
      expect(r.ok === false && r.message).toContain('상세주소');
    });
    it('배송 메모 201자', () => {
      const r = ok({ ...base, rewardId: 'cd', shipping: { ...shipBase, memo: 'm'.repeat(201) } });
      expect(r.ok).toBe(false);
      expect(r.ok === false && r.message).toContain('배송 메모');
    });
    it('배송 메모 200자는 통과하고 그대로 저장된다', () => {
      const memo = 'm'.repeat(PLEDGE_TEXT_LIMITS.shippingMemo);
      const r = ok({ ...base, rewardId: 'cd', shipping: { ...shipBase, memo } });
      expect(r.ok && r.value.shipping?.memo).toBe(memo);
    });
    it('우편번호 11자', () => {
      const r = ok({ ...base, rewardId: 'cd', shipping: { ...shipBase, postcode: '1'.repeat(11) } });
      expect(r.ok).toBe(false);
      expect(r.ok === false && r.message).toContain('우편번호');
    });
  });

  describe('빈 값·공백은 지금처럼 다룬다', () => {
    it('응원 메시지를 안 보내면 undefined', () => {
      expect(ok(base)).toMatchObject({ ok: true, value: { supporterMessage: undefined } });
    });
    it('공백만 있는 응원 메시지는 저장하지 않는다', () => {
      const r = ok({ ...base, supporterMessage: '   ' });
      expect(r.ok && r.value.supporterMessage).toBeUndefined();
    });
    it('제로폭 문자만 있는 이름은 trim으로 지워지지 않아 통과한다 — 알려진 동작', () => {
      expect(ok({ ...base, customerName: '\u200b\u200b' }).ok).toBe(true);
    });
  });

  describe('타입 강제변환 — 문자열을 불리언·숫자로 읽지 않는다', () => {
    it("termsAgreed: 'true'는 거부한다", () => {
      expect(ok({ ...base, termsAgreed: 'true' })).toMatchObject({ ok: false, message: '약관에 동의해 주세요.' });
    });
    it('termsAgreed: 1도 거부한다', () => {
      expect(ok({ ...base, termsAgreed: 1 }).ok).toBe(false);
    });
    it("displayNamePublic: 'false' 문자열은 공개하지 않는다(엄격 비교)", () => {
      const r = ok({ ...base, displayNamePublic: 'false' });
      expect(r.ok && r.value.displayNamePublic).toBe(false);
    });
    it('공개하면 표시 방식대로 publicName을 만든다 — 방식이 없으면 실명(NULL)', () => {
      const real = ok({ ...base });
      expect(real.ok && real.value.publicName).toBeNull();
      const masked = ok({ ...base, publicNameStyle: 'masked' });
      expect(masked.ok && masked.value.publicName).toBe('김*원');
      const nick = ok({ ...base, publicNameStyle: 'nickname', publicNickname: ' 청취자 ' });
      expect(nick.ok && nick.value.publicName).toBe('청취자');
    });
    it('닉네임 방식인데 닉네임이 비었거나 방식을 모르면 거부한다', () => {
      expect(ok({ ...base, publicNameStyle: 'nickname', publicNickname: '' })).toMatchObject({ ok: false, message: '명단에 표시할 닉네임을 입력해 주세요.' });
      expect(ok({ ...base, publicNameStyle: 'anon' }).ok).toBe(false);
    });
    // 쓰일 곳이 없는 개인정보는 담지 않는다.
    it('공개하지 않으면 닉네임을 보내도 publicName은 NULL', () => {
      const r = ok({ ...base, displayNamePublic: false, publicNameStyle: 'nickname', publicNickname: '청취자' });
      expect(r.ok && r.value.publicName).toBeNull();
    });
    it('displayNamePublic: 1도 공개하지 않는다', () => {
      const r = ok({ ...base, displayNamePublic: 1 });
      expect(r.ok && r.value.displayNamePublic).toBe(false);
    });
    it("additionalAmount 문자열 '1000'은 거부한다", () => {
      expect(ok({ ...base, additionalAmount: '1000' }).ok).toBe(false);
    });
    it('additionalAmount undefined는 0으로 본다', () => {
      const r = ok({ ...base, additionalAmount: undefined });
      expect(r.ok && r.value.additionalAmount).toBe(0);
    });
    it('quantity 1.0은 정수라 통과한다', () => {
      expect(ok({ ...base, quantity: 1.0 }).ok).toBe(true);
    });
    it('quantity 1.5·0·-1·NaN·문자열은 거부한다', () => {
      for (const quantity of [1.5, 0, -1, NaN, Infinity, '1']) {
        expect(ok({ ...base, quantity }).ok).toBe(false);
      }
    });
  });

  describe('구조 — 배열·프로토타입 오염·형식', () => {
    it('본문이 배열이면 거부한다', () => {
      expect(ok([]).ok).toBe(false);
    });
    it("rewardId '__proto__'는 리워드로 찾지 않는다", () => {
      expect(ok({ ...base, rewardId: '__proto__' })).toMatchObject({ ok: false, message: '리워드를 찾을 수 없습니다.' });
    });
    it('shipping이 배열이면 배송지 미입력으로 거부한다', () => {
      expect(ok({ ...base, rewardId: 'cd', shipping: ['x'] })).toMatchObject({ ok: false, message: '배송지를 모두 입력해 주세요.' });
    });
    it('디지털 리워드에 배송지를 보내면 폐기한다', () => {
      const r = ok({ ...base, shipping: shipBase });
      expect(r.ok && r.value.shipping).toBeUndefined();
    });
    it('이메일 형식이 아니면 거부하고, 앞뒤 공백은 다듬는다', () => {
      expect(ok({ ...base, customerEmail: 'nope' }).ok).toBe(false);
      const r = ok({ ...base, customerEmail: '  a+tag@b.com ' });
      expect(r.ok && r.value.customerEmail).toBe('a+tag@b.com');
    });
    // 인원 집계의 신원 키가 이메일이라, 대소문자만 다른 표기가 같은 사람을 둘로 센다.
    it('이메일을 소문자로 저장한다', () => {
      const r = ok({ ...base, customerEmail: '  Mixed@Example.COM ' });
      expect(r.ok && r.value.customerEmail).toBe('mixed@example.com');
    });
  });
});
