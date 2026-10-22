import { validateCustomerContact } from './validation';
import { validateCustomerFields } from './customerFields';

const ok = { customerName: '김보컬', customerPhone: '010-1234-5678', customerEmail: 'a@b.co' };

describe('validateCustomerFields — 주문자 칸 한국어 오류', () => {
  it('정상 값은 오류가 없다', () => {
    expect(validateCustomerFields(ok)).toEqual({});
    expect(validateCustomerFields({ ...ok, customerPhone: '+82 10 4255 7893' })).toEqual({});
  });

  it('빈 칸은 칸마다 "입력해 주세요"', () => {
    const e = validateCustomerFields({ customerName: ' ', customerPhone: '', customerEmail: '' });
    expect(e.customerName).toMatch(/입력해 주세요/);
    expect(e.customerPhone).toMatch(/입력해 주세요/);
    expect(e.customerEmail).toMatch(/입력해 주세요/);
  });

  it('형식이 틀리면 그 칸만', () => {
    expect(Object.keys(validateCustomerFields({ ...ok, customerPhone: '02-123' }))).toEqual(['customerPhone']);
    expect(Object.keys(validateCustomerFields({ ...ok, customerName: '김' }))).toEqual(['customerName']);
    expect(Object.keys(validateCustomerFields({ ...ok, customerEmail: 'a@b' }))).toEqual(['customerEmail']);
  });

  // 서버가 거절하는 값은 화면에서도 막고, 서버가 받는 값은 화면에서도 통과시킨다.
  it.each([
    ok,
    { ...ok, customerName: '김' },
    { ...ok, customerName: '가'.repeat(41) },
    { ...ok, customerPhone: '02-123' },
    { ...ok, customerPhone: '01012345678' },
    { ...ok, customerEmail: 'a@b' },
    { ...ok, customerEmail: ' a@b.co ' },
  ])('서버 검증과 같은 판정: %o', (v) => {
    const clientOk = Object.keys(validateCustomerFields(v)).length === 0;
    expect(clientOk).toBe(validateCustomerContact(v).ok);
  });
});
