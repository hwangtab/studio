import { bankTransferBlockReason, isOnlineBankTransfer } from './bankAccount';

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
