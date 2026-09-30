import { DECLINE_CODE_PATTERN, parseLeadingTag } from './tossCodes';

test('확정 거절 코드는 매칭된다', () => {
  expect(DECLINE_CODE_PATTERN.test('REJECT_CARD_COMPANY')).toBe(true);
  expect(DECLINE_CODE_PATTERN.test('EXCEED_MAX_DAILY_PAYMENT_COUNT')).toBe(true);
});

test('NETWORK_ERROR는 매칭되지 않는다', () => {
  expect(DECLINE_CODE_PATTERN.test('NETWORK_ERROR')).toBe(false);
});

describe('parseLeadingTag', () => {
  it('[#key] 형식에서 key를 뽑는다', () => {
    expect(parseLeadingTag('[#autocancel:TKT-20260930-AAAAAAAA:1] 자동취소')).toBe(
      'autocancel:TKT-20260930-AAAAAAAA:1'
    );
  });
  it('태그가 없으면 null', () => {
    expect(parseLeadingTag('그냥 사유')).toBeNull();
  });
});
