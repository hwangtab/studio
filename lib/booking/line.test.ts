import { bookingLineOf, parseBookingLine } from './line';

it('주문을 사업 라인으로 가른다', () => {
  expect(bookingLineOf({ orderType: 'session', serviceType: 'practice-room' })).toBe('practice');
  expect(bookingLineOf({ orderType: 'session', serviceType: 'recording' })).toBe('studio');
  expect(bookingLineOf({ orderType: 'session', serviceType: 'wedding-song' })).toBe('studio');
  expect(bookingLineOf({ orderType: 'mixing', serviceType: 'mixing' })).toBe('mixing');
  // 예약금 결제 링크 주문은 어느 라인도 아니다.
  expect(bookingLineOf({ orderType: 'deposit', serviceType: '' })).toBeNull();
});

it('주소의 line 값은 알려진 것만 받는다', () => {
  expect(parseBookingLine('practice')).toBe('practice');
  expect(parseBookingLine(['studio', 'x'])).toBe('studio');
  expect(parseBookingLine('nope')).toBeNull();
  expect(parseBookingLine(undefined)).toBeNull();
});
