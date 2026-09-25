/** @jest-environment node */
import {
  PAYMENT_FAIL_CODE_PATTERN,
  PAYMENT_ORDER_NO_PATTERN,
  isRecordablePaymentFailure,
} from './recordFailure';

/**
 * 이 가드가 있는 이유: 기록 경로에는 사람 인증이 없다. 지금 이 함수를 부르는 곳은
 * 비콘(`/api/payments/failed`, Origin 검사 + IP 분당 20회)과 예약 실패 화면의
 * getServerSideProps 둘이다 — 펀딩 실패 화면은 2026-09-25에 비콘으로 옮겼다(무인증 GET
 * 하나로 남의 주문 기록이 덮이던 경로였다). Origin 검사는 브라우저가 붙이는 헤더에
 * 기대는 것이라 형태 검증을 대신하지 못한다. 느슨하면 남의 주문번호를 넣어 보며 상태를
 * 떠보거나, 임의 문자열을 우리 DB에 심을 수 있다.
 */
describe('결제 실패 기록 — 형태 검증', () => {
  it('주문번호는 예약(SNB)·믹싱(SNB-M-)·펀딩(FND) 형태만 받는다', () => {
    for (const ok of ['FND-20260919-BAB88F67', 'SNB-20260910-1C1F6923', 'SNB-M-20260901-ABCDEF01']) {
      expect(PAYMENT_ORDER_NO_PATTERN.test(ok)).toBe(true);
    }
    for (const bad of [
      '',
      'FND-20260919-bab88f67', // 소문자 — 호출부가 대문자로 올린 뒤 검사한다
      'FND-2026091-BAB88F67',  // 날짜 자릿수
      'XXX-20260919-BAB88F67',
      "FND-20260919-BAB88F67' OR 1=1",
      'FND-20260919-BAB88F67\n두번째줄',
    ]) {
      expect(PAYMENT_ORDER_NO_PATTERN.test(bad)).toBe(false);
    }
  });

  it('실패 코드는 토스가 주는 형태만 받는다 (화면에도 그대로 뜨는 값이다)', () => {
    expect(PAYMENT_FAIL_CODE_PATTERN.test('INVALID_UNREGISTERED_SUBMALL')).toBe(true);
    expect(PAYMENT_FAIL_CODE_PATTERN.test('PAY_PROCESS_CANCELED')).toBe(true);
    for (const bad of ['', '<script>', '코드', 'a'.repeat(61), 'with space']) {
      expect(PAYMENT_FAIL_CODE_PATTERN.test(bad)).toBe(false);
    }
  });

  it('코드가 없으면 기록하지 않는다 — 남길 것이 없다', () => {
    expect(isRecordablePaymentFailure({ orderNo: 'FND-20260919-BAB88F67', code: null })).toBe(false);
  });

  it('주문번호와 코드가 모두 형태를 지킬 때만 기록 대상이다', () => {
    expect(
      isRecordablePaymentFailure({ orderNo: 'FND-20260919-BAB88F67', code: 'REJECT_CARD_COMPANY' }),
    ).toBe(true);
    expect(isRecordablePaymentFailure({ orderNo: 'nope', code: 'REJECT_CARD_COMPANY' })).toBe(false);
  });
});
