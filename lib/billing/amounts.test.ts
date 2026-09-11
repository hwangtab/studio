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

  it('레슨도 같은 규칙 — 표기액 + VAT 10%', () => {
    expect(subscriptionAmounts('lesson')).toEqual({
      itemAmount: LESSON_MONTHLY_PRICE,
      vatAmount: Math.round(LESSON_MONTHLY_PRICE * 0.1),
      totalAmount: LESSON_MONTHLY_PRICE + Math.round(LESSON_MONTHLY_PRICE * 0.1),
    });
  });

  // 두 구독 상품이 갈라지지 않게 고정한다 — 한쪽만 VAT 포함으로 바꾸면 사이트 표기와
  // 청구액의 관계가 상품마다 달라져 운영에서 혼동이 생긴다(2026-09-10~11에 실제로 한 번 갈렸다).
  it('연습실과 레슨은 같은 VAT 규칙을 쓴다', () => {
    const room = subscriptionAmounts('practice-room');
    const lesson = subscriptionAmounts('lesson');
    expect(room.totalAmount).toBe(room.itemAmount + room.vatAmount);
    expect(lesson.totalAmount).toBe(lesson.itemAmount + lesson.vatAmount);
    expect(room.itemAmount).toBe(PRACTICE_ROOM_MONTHLY_PRICE);
    expect(lesson.itemAmount).toBe(LESSON_MONTHLY_PRICE);
  });

  it('상수가 바뀌면 청구액도 따라온다 — 리터럴을 박아 두지 않았다는 확인', () => {
    expect(subscriptionAmounts('practice-room').itemAmount).toBe(PRACTICE_ROOM_MONTHLY_PRICE);
  });

  it('주문명은 상품을 구분한다', () => {
    expect(subscriptionOrderName('practice-room')).toContain('연습실');
    expect(subscriptionOrderName('lesson')).toContain('레슨');
  });
});
