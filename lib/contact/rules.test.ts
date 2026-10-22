import { validateCustomerContact } from '../booking/validation';
import { validateCreateShowOrderPayload } from '../shows/validation';
import { contactFieldProblem, contactProblems, type ContactValues } from './rules';

const ok: ContactValues = { customerName: '김보컬', customerPhone: '010-1234-5678', customerEmail: 'a@b.co' };

describe('contactProblems — 주문자 연락처 규칙의 정본', () => {
  it('정상 값은 문제가 없다(국제 표기 한국 번호 포함)', () => {
    expect(contactProblems(ok)).toEqual([]);
    expect(contactProblems({ ...ok, customerPhone: '+82 10 4255 7893' })).toEqual([]);
  });

  it('빈 칸은 missing, 형식이 틀리면 invalid — 화면 순서대로', () => {
    expect(contactProblems({ customerName: ' ', customerPhone: '', customerEmail: 'a@b' })).toEqual([
      { field: 'customerName', reason: 'missing' },
      { field: 'customerPhone', reason: 'missing' },
      { field: 'customerEmail', reason: 'invalid' },
    ]);
    expect(contactFieldProblem('customerName', '김')).toBe('invalid');
    expect(contactFieldProblem('customerName', '가'.repeat(41))).toBe('invalid');
    expect(contactFieldProblem('customerPhone', '02-123')).toBe('invalid');
  });

  it('공연(kr-or-intl)만 해외 번호를 받는다', () => {
    expect(contactFieldProblem('customerPhone', '+1 415 555 0100')).toBe('invalid');
    expect(contactFieldProblem('customerPhone', '+1 415 555 0100', 'kr-or-intl')).toBeNull();
  });
});

/**
 * 서버는 같은 판정의 **첫 문제 칸**으로 문구를 고른다. 화면이 잡은 칸과 서버가 거절하는 칸이 어긋나지 않는지
 * 통과 여부만이 아니라 칸까지 대조한다(2026-10-22 리뷰 — 예전 대조는 참/거짓만 봤다).
 */
describe('서버 문구 ↔ 첫 문제 칸', () => {
  const bookingMessage = { customerName: '이름', customerPhone: '휴대폰', customerEmail: '이메일' } as const;
  const showMessage = { customerName: 'name', customerPhone: 'phone', customerEmail: 'email' } as const;
  const cases: ContactValues[] = [
    ok,
    { ...ok, customerName: '김' },
    { ...ok, customerName: '', customerEmail: '' },
    { ...ok, customerPhone: '02-123' },
    { ...ok, customerPhone: '+1 415 555 0100' },
    { ...ok, customerEmail: 'a@b' },
    { customerName: '', customerPhone: '', customerEmail: '' },
  ];

  it.each(cases)('예약·결제 링크·상점·소프트웨어: %o', (v) => {
    const [first] = contactProblems(v);
    const r = validateCustomerContact(v);
    if (!first) return expect(r.ok).toBe(true);
    expect(r).toEqual({ ok: false, message: expect.stringContaining(bookingMessage[first.field]) });
  });

  it.each(cases)('공연: %o', (v) => {
    const [first] = contactProblems(v, 'kr-or-intl');
    const r = validateCreateShowOrderPayload({
      showtimeId: 's1', ticketTypeId: 't1', quantity: 1, refundPolicyAgreed: true,
      buyerName: v.customerName, buyerContact: v.customerPhone, buyerEmail: v.customerEmail,
    }, 'en');
    if (!first) return expect(r.ok).toBe(true);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message.toLowerCase()).toContain(showMessage[first.field]);
  });
});
