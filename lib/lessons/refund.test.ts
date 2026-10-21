import { refundOf } from './refund';

const M = 350000;
const r = (consumed: number, paidNet: number, courseMonths = 3) => refundOf({ consumed, courseMonths, monthlyAmount: M, paidNet });

describe('중도 해지 환불 기준 (시행령 별표 4)', () => {
  it('첫 수업 전에는 낸 돈 전액', () => {
    expect(r(0, 350000)).toMatchObject({ refund: 350000, retained: 0, currentMonth: 0 });
    expect(r(0, 1050000).refund).toBe(1050000);
  });

  it('첫 달: 1회 진행 2/3, 2회 진행 1/2, 3회 이상 0 (한 달씩 낸 경우)', () => {
    expect(r(1, M)).toMatchObject({ refund: 233334, retained: 116666, currentMonth: 1, sessionsInMonth: 1 }); // 수강생에게 유리하게 보유분을 내림
    expect(r(2, M)).toMatchObject({ refund: 175000, retained: 175000 });
    expect(r(3, M).refund).toBe(0);
    expect(r(4, M).refund).toBe(0);
  });

  it('과정을 한꺼번에 선납했으면 해지한 달 이후의 달은 전액 돌려준다', () => {
    expect(r(1, 3 * M).refund).toBe(233334 + 2 * M);
    expect(r(2, 3 * M).refund).toBe(175000 + 2 * M);
    expect(r(3, 3 * M).refund).toBe(2 * M);
    expect(r(4, 3 * M)).toMatchObject({ refund: 2 * M, currentMonth: 1 }); // 한 달을 다 채웠으면 그 달은 0, 다음 달부터 전액
  });

  it('둘째 달 이후는 그 달의 진행 회차로 센다', () => {
    expect(r(5, 3 * M)).toMatchObject({ currentMonth: 2, sessionsInMonth: 1, refund: 233334 + M });
    expect(r(6, 3 * M).refund).toBe(175000 + M);
    expect(r(7, 3 * M).refund).toBe(M);
    expect(r(8, 3 * M).refund).toBe(M);
    expect(r(12, 3 * M).refund).toBe(0);
  });

  it('낸 돈이 모자라면 환불은 0, 모자란 수강료를 알려 준다', () => {
    expect(r(6, M)).toMatchObject({ refund: 0, shortfall: M + 175000 - M });
  });

  it('과정을 넘은 회차는 과정 끝으로 센다', () => {
    expect(r(20, 3 * M)).toMatchObject({ currentMonth: 3, refund: 0 });
  });
});
