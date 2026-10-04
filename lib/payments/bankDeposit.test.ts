import {
  BANK_DEPOSIT_MIN_LEAD_HOURS,
  bankDepositBlockReason,
  bankDepositDeadlineOf,
  bankDepositPaymentKey,
  bankDepositStateOf,
  isBankDepositPayment,
  refundAccountKindOf,
} from './bankDeposit';

const HOUR = 60 * 60 * 1000;
const NOW = new Date('2026-10-04T03:00:00Z');

describe('bankDepositStateOf — 온라인 계좌 입금과 다른 기록을 가른다(화면·서버 공통)', () => {
  it('입금 대기·입금 전 취소는 상태로', () => {
    expect(bankDepositStateOf({ status: 'awaiting_deposit', payments: [] })).toBe('awaiting');
    expect(bankDepositStateOf({ status: 'deposit_cancelled', payments: [] })).toBe('cancelled');
  });
  it('입금 확인된 주문은 계좌 입금 결제 행으로', () => {
    expect(bankDepositStateOf({ status: 'paid', payments: [{ paymentKey: bankDepositPaymentKey('SNB-1') }] })).toBe('paid');
    expect(bankDepositStateOf({ status: 'refunded', payments: [{ paymentKey: bankDepositPaymentKey('SNB-1') }] })).toBe('paid');
  });
  it('토스 결제·초대권(결제 행 없음)은 null', () => {
    expect(bankDepositStateOf({ status: 'paid', payments: [{ paymentKey: 'tgen_2026_abc' }] })).toBeNull();
    expect(bankDepositStateOf({ status: 'paid', payments: [] })).toBeNull();
    expect(bankDepositStateOf({ status: 'pending', payments: [] })).toBeNull();
  });
  it('계좌 입금 결제 키는 토스 키와 겹치지 않는 접두사다', () => {
    expect(isBankDepositPayment({ paymentKey: bankDepositPaymentKey('TKT-20261004-AB12CD34') })).toBe(true);
    expect(isBankDepositPayment({ paymentKey: 'tviva20261004abc' })).toBe(false);
  });
});

describe('bankDepositBlockReason — 시작 임박이면 계좌 입금을 받지 않는다', () => {
  it(`시작까지 ${BANK_DEPOSIT_MIN_LEAD_HOURS}시간 미만이면 막는다`, () => {
    expect(bankDepositBlockReason({ startsAt: new Date(NOW.getTime() + 1.9 * HOUR), now: NOW })).toBe('starts_too_soon');
    expect(bankDepositBlockReason({ startsAt: new Date(NOW.getTime() - HOUR), now: NOW })).toBe('starts_too_soon');
  });
  it('그 이상이거나 시작이 없으면(믹싱) 받는다', () => {
    expect(bankDepositBlockReason({ startsAt: new Date(NOW.getTime() + 2 * HOUR), now: NOW })).toBeNull();
    expect(bankDepositBlockReason({ startsAt: null, now: NOW })).toBeNull();
  });
});

describe('bankDepositDeadlineOf — 신청 + 3일, 시작이 더 빠르면 시작 시각까지', () => {
  it('시작이 멀면 3일 뒤', () => {
    expect(bankDepositDeadlineOf({ createdAt: NOW, startsAt: new Date(NOW.getTime() + 10 * 24 * HOUR), guideDays: 3 }).getTime())
      .toBe(NOW.getTime() + 72 * HOUR);
  });
  it('시작이 3일 안이면 시작 시각', () => {
    const startsAt = new Date(NOW.getTime() + 30 * HOUR);
    expect(bankDepositDeadlineOf({ createdAt: NOW, startsAt, guideDays: 3 })).toEqual(startsAt);
  });
  it('시작이 없으면(믹싱) 3일 뒤', () => {
    expect(bankDepositDeadlineOf({ createdAt: NOW, startsAt: null, guideDays: 3 }).getTime()).toBe(NOW.getTime() + 72 * HOUR);
  });
});

it('refundAccountKindOf — 공연 주문(ticket)은 환불 계좌 표에서 show', () => {
  expect(refundAccountKindOf('ticket')).toBe('show');
  expect(refundAccountKindOf('session')).toBe('session');
  expect(refundAccountKindOf('subscription')).toBeNull();
});
