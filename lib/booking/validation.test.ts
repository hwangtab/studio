import { validateCreateBookingPayload } from './validation';

const base = {
  productId: 'recording-pro', date: '2026-09-10', startHour: 14,
  customerName: '김보컬', customerPhone: '010-1234-5678',
  customerEmail: 'singer@example.com', refundPolicyAgreed: true,
};
const now = new Date('2026-09-01T00:00:00Z');

describe('validateCreateBookingPayload', () => {
  it('정상 입력 통과', () => {
    expect(validateCreateBookingPayload(base, now).ok).toBe(true);
  });
  it('없는 상품 거부', () => {
    expect(validateCreateBookingPayload({ ...base, productId: 'nope' }, now).ok).toBe(false);
  });
  it('시간제인데 hours 없으면 거부', () => {
    expect(validateCreateBookingPayload({ ...base, productId: 'recording-hourly' }, now).ok).toBe(false);
  });
  it('환불 규정 미동의 거부', () => {
    expect(validateCreateBookingPayload({ ...base, refundPolicyAgreed: false }, now).ok).toBe(false);
  });
  it('전화번호 형식 거부', () => {
    expect(validateCreateBookingPayload({ ...base, customerPhone: '02-123' }, now).ok).toBe(false);
  });
  it('리드타임(24h) 미만 날짜 거부', () => {
    expect(validateCreateBookingPayload({ ...base, date: '2026-09-01' }, now).ok).toBe(false);
  });
  it('60일 밖 날짜 거부', () => {
    expect(validateCreateBookingPayload({ ...base, date: '2026-12-25' }, now).ok).toBe(false);
  });
});
