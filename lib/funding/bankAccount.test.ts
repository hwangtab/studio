import { bankTransferBlockReason, isOnlineBankTransfer, normalizeEmailForLimit } from './bankAccount';

describe('normalizeEmailForLimit — 남용 상한용 이메일 정규화', () => {
  it.each([
    ['A@B.com', 'a@b.com'],
    ['hong+fund1@example.com', 'hong@example.com'],
    ['Ho.Gil.Dong@gmail.com', 'hogildong@gmail.com'],
    ['ho.gil+x@googlemail.com', 'hogil@gmail.com'],
    // gmail이 아니면 점은 의미가 있다(다른 수신함일 수 있다) — 지우지 않는다.
    ['ho.gil@naver.com', 'ho.gil@naver.com'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeEmailForLimit(input)).toBe(expected);
  });
});

describe('판정 함수', () => {
  it('한정 리워드가 하나라도 있으면 계좌 입금 불가', () => {
    expect(bankTransferBlockReason([{ totalQuantity: null }])).toBeNull();
    expect(bankTransferBlockReason([{ totalQuantity: null }, { totalQuantity: 5 }])).toBe('limited_reward');
  });
  it('온라인 계좌 입금은 결제수단과 등록 경로를 함께 본다', () => {
    expect(isOnlineBankTransfer({ paymentMethod: 'bank_transfer', entrySource: 'online' })).toBe(true);
    expect(isOnlineBankTransfer({ paymentMethod: 'bank_transfer', entrySource: 'manual' })).toBe(false);
    expect(isOnlineBankTransfer({ paymentMethod: 'toss', entrySource: 'online' })).toBe(false);
  });
});
