import { computeRefund } from './refund-policy';
import { daysUntilKst, kstDateString, kstDateTime } from './kst';

describe('kst helpers', () => {
  it('KST 벽시계 14시는 UTC 05시', () => {
    expect(kstDateTime('2026-09-10', 14).toISOString()).toBe('2026-09-10T05:00:00.000Z');
  });
  it('UTC 자정 직전은 KST 다음 날', () => {
    expect(kstDateString(new Date('2026-09-10T15:30:00Z'))).toBe('2026-09-11');
  });
  it('daysUntilKst는 달력일 차이 (시각 무관)', () => {
    const now = new Date('2026-09-07T13:00:00Z'); // KST 9/7 22:00
    const start = kstDateTime('2026-09-10', 10);
    expect(daysUntilKst(now, start)).toBe(3);
  });
});

describe('computeRefund — 기산은 KST 달력일, 계약서 시간대 분쟁(258e8e41cc) 재발 방지', () => {
  const start = kstDateTime('2026-09-10', 14);
  const total = 275000;
  it('3일 전 100%', () => {
    expect(computeRefund(total, start, kstDateTime('2026-09-07', 23)).refundAmount).toBe(275000);
  });
  it('전일 50% (원 단위 내림)', () => {
    expect(computeRefund(total, start, kstDateTime('2026-09-09', 1)).refundAmount).toBe(137500);
  });
  it('당일 0%', () => {
    expect(computeRefund(total, start, kstDateTime('2026-09-10', 0)).refundAmount).toBe(0);
  });
  it('지난 예약도 0%', () => {
    expect(computeRefund(total, start, kstDateTime('2026-09-11', 10)).refundAmount).toBe(0);
  });
});
