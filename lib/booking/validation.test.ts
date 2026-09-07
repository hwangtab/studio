import { normalizeKoreanMobile, validateCreateBookingPayload } from './validation';

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
  it('개장 전 시작 시각 거부', () => {
    expect(validateCreateBookingPayload({ ...base, startHour: 9 }, now).ok).toBe(false);
  });
  it('폐장을 넘는 시작 시각 거부', () => {
    expect(validateCreateBookingPayload({ ...base, startHour: 20 }, now).ok).toBe(false);
  });
});

describe('normalizeKoreanMobile — 국제 형식·구분자 섞인 입력을 010-XXXX-XXXX로 모은다', () => {
  it.each([
    ['+821042557893', '010-4255-7893'],
    ['+82 10-4255-7893', '010-4255-7893'],
    ['+82 (10) 4255 7893', '010-4255-7893'],
    ['821042557893', '010-4255-7893'],
    ['010 4255 7893', '010-4255-7893'],
    ['01042557893', '010-4255-7893'],
    ['010-4255-7893', '010-4255-7893'],
    ['011-123-4567', '011-123-4567'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeKoreanMobile(input)).toBe(expected);
  });

  it.each([['02-123-4567'], ['+82 2 123 4567'], ['+8210'], ['010-1234'], ['abc'], ['']])('%s는 거부', (input) => {
    expect(normalizeKoreanMobile(input)).toBeNull();
  });

  it('검증 통과 시 저장 값이 정규화된 형태다', () => {
    const r = validateCreateBookingPayload({ ...base, customerPhone: '+82 10 4255 7893' }, now);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.customerPhone).toBe('010-4255-7893');
  });
});
