import type { Contract } from '../../db/schema';
import { contractToFormValues } from './form-values';

const signed = {
  id: 'c1',
  title: '홍길동 302호',
  customerName: '홍길동',
  customerBirthdate: '1990-01-02',
  customerEmail: 'hong@example.com',
  customerPhone: '010-1234-5678',
  customerAddress: '서울시 은평구 대조동 1',
  roomNumber: '302',
  roomArea: '3m × 2m',
  startDate: new Date('2026-09-01T00:00:00.000Z'),
  endDate: new Date('2027-03-01T00:00:00.000Z'),
  monthlyRent: 360000,
  depositAmount: 360000,
  paymentDay: 1,
  specialTerms: null,
} as unknown as Contract;

describe('계약 → 폼 값', () => {
  /** 복제 화면은 이 값을 __NEXT_DATA__에 싣고 그대로 POST한다. 서명자가 채운 개인정보가 따라가면 안 된다. */
  it('서명본을 복제해도 생년월일·주소는 싣지 않는다', () => {
    const { values } = contractToFormValues(signed, { clearPeriod: true });

    expect(values.customerBirthdate).toBe('');
    expect(values.customerAddress).toBe('');
    expect(JSON.stringify(values)).not.toContain('1990-01-02');
    expect(JSON.stringify(values)).not.toContain('대조동');
  });

  it('나머지 항목은 옮기고, 복제는 기간을 비운다', () => {
    const { values } = contractToFormValues(signed, { clearPeriod: true });

    expect(values).toMatchObject({ customerName: '홍길동', customerPhone: '010-1234-5678', roomNumber: '302', monthlyRent: '360000' });
    expect(values.startDate).toBe('');
    expect(values.endDate).toBe('');
  });
});
