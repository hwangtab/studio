import { LESSON_MONTHLY_PRICE, PRACTICE_ROOM_MONTHLY_PRICE } from '../../data/pricing';
import { subscriptionAmounts, subscriptionOrderName } from './amounts';

describe('subscriptionAmounts', () => {
  it('연습실은 상수 + VAT 10%', () => {
    expect(subscriptionAmounts('practice-room')).toEqual({
      itemAmount: PRACTICE_ROOM_MONTHLY_PRICE,
      vatAmount: Math.round(PRACTICE_ROOM_MONTHLY_PRICE * 0.1),
      totalAmount: PRACTICE_ROOM_MONTHLY_PRICE + Math.round(PRACTICE_ROOM_MONTHLY_PRICE * 0.1),
    });
  });

  it('레슨도 같은 규칙', () => {
    expect(subscriptionAmounts('lesson')).toEqual({
      itemAmount: LESSON_MONTHLY_PRICE,
      vatAmount: Math.round(LESSON_MONTHLY_PRICE * 0.1),
      totalAmount: LESSON_MONTHLY_PRICE + Math.round(LESSON_MONTHLY_PRICE * 0.1),
    });
  });

  it('상수가 바뀌면 청구액도 따라온다 — 리터럴을 박아 두지 않았다는 확인', () => {
    expect(subscriptionAmounts('practice-room').itemAmount).toBe(PRACTICE_ROOM_MONTHLY_PRICE);
  });

  it('주문명은 상품을 구분한다', () => {
    expect(subscriptionOrderName('practice-room')).toContain('연습실');
    expect(subscriptionOrderName('lesson')).toContain('레슨');
  });
});
