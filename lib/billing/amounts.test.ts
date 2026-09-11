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

  // 레슨은 연습실과 규칙이 다르다. 35만원이 최종 청구액이고 사이트도 VAT를 따로 말하지
  // 않는다("회당 약 87,500원" = 35만÷4) — 여기에 10%를 더 붙이면 약속한 금액보다 더 걷는다.
  it('레슨은 표기액이 총액 — VAT를 역산한다', () => {
    const amounts = subscriptionAmounts('lesson');
    expect(amounts.totalAmount).toBe(LESSON_MONTHLY_PRICE);
    expect(amounts.itemAmount + amounts.vatAmount).toBe(LESSON_MONTHLY_PRICE);
    expect(amounts.itemAmount).toBe(Math.round(LESSON_MONTHLY_PRICE / 1.1));
  });

  it('레슨 표기액에 10%를 더 붙이지 않는다 — 사이트가 약속한 금액이 곧 청구액', () => {
    expect(subscriptionAmounts('lesson').totalAmount).not.toBe(
      LESSON_MONTHLY_PRICE + Math.round(LESSON_MONTHLY_PRICE * 0.1),
    );
  });

  it('상수가 바뀌면 청구액도 따라온다 — 리터럴을 박아 두지 않았다는 확인', () => {
    expect(subscriptionAmounts('practice-room').itemAmount).toBe(PRACTICE_ROOM_MONTHLY_PRICE);
  });

  it('주문명은 상품을 구분한다', () => {
    expect(subscriptionOrderName('practice-room')).toContain('연습실');
    expect(subscriptionOrderName('lesson')).toContain('레슨');
  });
});
