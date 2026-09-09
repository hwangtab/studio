import { normalizeKoreanMobile, validateCreateBookingPayload, validateCreateMixingOrderPayload } from './validation';

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

const mixingBase = {
  productId: 'mixing-level1', songCount: 3, vocalTuning: false,
  customerName: '김보컬', customerPhone: '010-1234-5678',
  customerEmail: 'singer@example.com', refundPolicyAgreed: true,
};

describe('validateCreateMixingOrderPayload', () => {
  it('정상 입력 통과', () => {
    expect(validateCreateMixingOrderPayload(mixingBase, now).ok).toBe(true);
  });
  it('보컬 튜닝 옵션 포함 통과', () => {
    const r = validateCreateMixingOrderPayload({ ...mixingBase, vocalTuning: true }, now);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.vocalTuning).toBe(true);
  });
  it('없는 상품 거부', () => {
    expect(validateCreateMixingOrderPayload({ ...mixingBase, productId: 'nope' }, now).ok).toBe(false);
  });
  it('곡 수 범위 밖 거부', () => {
    expect(validateCreateMixingOrderPayload({ ...mixingBase, songCount: 0 }, now).ok).toBe(false);
    expect(validateCreateMixingOrderPayload({ ...mixingBase, songCount: 11 }, now).ok).toBe(false);
  });
  it('곡 수가 정수가 아니면 거부', () => {
    expect(validateCreateMixingOrderPayload({ ...mixingBase, songCount: 1.5 }, now).ok).toBe(false);
  });
  it('튜닝 불가 상품(마스터링)에 vocalTuning true면 거부', () => {
    const r = validateCreateMixingOrderPayload(
      { ...mixingBase, productId: 'mastering-single', songCount: 1, vocalTuning: true },
      now,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe('이 상품은 보컬 튜닝 옵션을 선택할 수 없습니다.');
  });
  it('마스터링 패키지는 4곡 미만이면 거부(minSongs)', () => {
    expect(
      validateCreateMixingOrderPayload({ ...mixingBase, productId: 'mastering-package', songCount: 3, vocalTuning: false }, now).ok,
    ).toBe(false);
  });
  it('환불 규정 미동의 거부', () => {
    expect(validateCreateMixingOrderPayload({ ...mixingBase, refundPolicyAgreed: false }, now).ok).toBe(false);
  });
  it('전화번호 형식 거부(세션과 공유하는 고객 검증)', () => {
    expect(validateCreateMixingOrderPayload({ ...mixingBase, customerPhone: '02-123' }, now).ok).toBe(false);
  });
});
