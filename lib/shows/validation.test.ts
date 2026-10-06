import { SHOW_MAX_PER_ORDER_CAP } from './limits';
import { validateCreateShowOrderPayload } from './validation';

const valid = {
  showtimeId: 'st-1',
  ticketTypeId: 'tt-1',
  quantity: 2,
  buyerName: ' 홍길동 ',
  buyerContact: '01012345678',
  buyerEmail: 'a@b.co',
  refundPolicyAgreed: true,
};

describe('validateCreateShowOrderPayload', () => {
  it('정상 입력을 정규화한다(이름 trim·휴대폰 하이픈)', () => {
    const r = validateCreateShowOrderPayload(valid);
    expect(r).toEqual({
      ok: true,
      value: { showtimeId: 'st-1', ticketTypeId: 'tt-1', quantity: 2, buyerName: '홍길동', buyerContact: '010-1234-5678', buyerEmail: 'a@b.co' },
    });
  });

  it('이메일은 필수이고 형식이 맞아야 한다 — 티켓이 메일로 전달된다', () => {
    expect(validateCreateShowOrderPayload({ ...valid, buyerEmail: '' })).toEqual({ ok: false, message: '이메일을 확인해 주세요.' });
    expect(validateCreateShowOrderPayload({ ...valid, buyerEmail: undefined })).toEqual({ ok: false, message: '이메일을 확인해 주세요.' });
    expect(validateCreateShowOrderPayload({ ...valid, buyerEmail: 'not-an-email' })).toEqual({ ok: false, message: '이메일을 확인해 주세요.' });
  });

  it.each([0, -1, 1.5, SHOW_MAX_PER_ORDER_CAP + 1, '2', null])('매수 %p는 거절한다', (quantity) => {
    expect(validateCreateShowOrderPayload({ ...valid, quantity }).ok).toBe(false);
  });

  it('상한 매수는 통과한다', () => {
    expect(validateCreateShowOrderPayload({ ...valid, quantity: SHOW_MAX_PER_ORDER_CAP }).ok).toBe(true);
  });

  it('환불 규정 동의 없이는 거절한다', () => {
    expect(validateCreateShowOrderPayload({ ...valid, refundPolicyAgreed: false })).toEqual({ ok: false, message: '환불 규정에 동의해 주세요.' });
    expect(validateCreateShowOrderPayload({ ...valid, refundPolicyAgreed: 'true' }).ok).toBe(false);
  });

  it('이름·연락처·id 형식을 거른다', () => {
    expect(validateCreateShowOrderPayload({ ...valid, buyerName: 'a' }).ok).toBe(false);
    expect(validateCreateShowOrderPayload({ ...valid, buyerContact: '123' }).ok).toBe(false);
    expect(validateCreateShowOrderPayload({ ...valid, showtimeId: "x'; DROP" }).ok).toBe(false);
    expect(validateCreateShowOrderPayload({ ...valid, ticketTypeId: '' }).ok).toBe(false);
  });

  it('객체가 아니면 거절한다', () => {
    expect(validateCreateShowOrderPayload(null).ok).toBe(false);
    expect(validateCreateShowOrderPayload([]).ok).toBe(false);
    expect(validateCreateShowOrderPayload('x').ok).toBe(false);
  });
});

describe('normalizeShowContact', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { normalizeShowContact } = require('./validation');
  it('한국 휴대폰은 기존 형식, +82도 한국 휴대폰으로 맞춘다', () => {
    expect(normalizeShowContact('010 1234 5678')).toBe('010-1234-5678');
    expect(normalizeShowContact('+82 10-1234-5678')).toBe('010-1234-5678');
  });
  it('해외 번호는 + 국가번호가 있어야 하고 +숫자로 저장한다', () => {
    expect(normalizeShowContact('+1 (415) 555-0123')).toBe('+14155550123');
    expect(normalizeShowContact('+44 20 7946 0958')).toBe('+442079460958');
    expect(normalizeShowContact('415-555-0123')).toBeNull();
    expect(normalizeShowContact('+12')).toBeNull();
    expect(normalizeShowContact('+1 415 abc')).toBeNull();
  });
});

it('영어 화면 요청이면 영어 오류 문구를 돌려준다', () => {
  const r = validateCreateShowOrderPayload({ ...valid, buyerContact: '123' }, 'en');
  expect(r).toEqual({ ok: false, message: expect.stringContaining('phone number') });
});
