import {
  computeNextBillingAt,
  cycleYmOf,
  daysInMonth,
  MAX_CHARGE_ATTEMPTS,
  periodFor,
  RETRY_OFFSETS_DAYS,
  retryAtFor,
} from './schedule';

/** KST 벽시계 문자열 — 검증을 UTC 오프셋 암산 없이 읽히게 한다. */
const kst = (d: Date): string => new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().replace('.000Z', ' KST');

describe('computeNextBillingAt', () => {
  it('다음 달 같은 날 09:00 KST', () => {
    expect(kst(computeNextBillingAt(new Date('2026-03-05T00:00:00Z'), 5))).toBe('2026-04-05T09:00:00 KST');
  });

  it('31일 구독은 그 달에 31일이 없으면 말일로 당긴다', () => {
    expect(kst(computeNextBillingAt(new Date('2026-03-31T00:00:00Z'), 31))).toBe('2026-04-30T09:00:00 KST');
    expect(kst(computeNextBillingAt(new Date('2026-01-31T00:00:00Z'), 31))).toBe('2026-02-28T09:00:00 KST');
  });

  it('말일로 당겨도 그 다음 달엔 다시 31일로 돌아온다 (billingDay가 정본)', () => {
    const feb = computeNextBillingAt(new Date('2026-01-31T00:00:00Z'), 31);
    expect(kst(computeNextBillingAt(feb, 31))).toBe('2026-03-31T09:00:00 KST');
  });

  it('윤년 2월은 29일까지 있다', () => {
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2100, 2)).toBe(28); // 100년 예외
    expect(kst(computeNextBillingAt(new Date('2028-01-31T00:00:00Z'), 31))).toBe('2028-02-29T09:00:00 KST');
  });

  it('12월 → 다음 해 1월로 넘어간다', () => {
    expect(kst(computeNextBillingAt(new Date('2026-12-10T00:00:00Z'), 10))).toBe('2027-01-10T09:00:00 KST');
  });

  it('KST 기준으로 달을 센다 — UTC로는 전달인 시각도 KST 달을 따른다', () => {
    // 2026-03-31T20:00Z = KST 4월 1일. 다음 청구는 5월이어야 한다.
    expect(kst(computeNextBillingAt(new Date('2026-03-31T20:00:00Z'), 1))).toBe('2026-05-01T09:00:00 KST');
  });
});

describe('cycleYmOf', () => {
  it('KST 달력으로 자른다', () => {
    expect(cycleYmOf(new Date('2026-03-31T20:00:00Z'))).toBe('2026-04');
    expect(cycleYmOf(new Date('2026-04-01T00:00:00Z'))).toBe('2026-04');
  });
});

describe('periodFor', () => {
  it('기간 끝과 다음 청구 시각이 같다 — 어긋나면 결제한 하루가 사라진다', () => {
    const now = new Date('2026-03-05T00:00:00Z');
    const period = periodFor(now, 5);
    expect(period.start).toEqual(now);
    expect(period.end).toEqual(computeNextBillingAt(now, 5));
  });
});

describe('retryAtFor', () => {
  it('D+1, D+3 두 번만 재시도하고 그 뒤는 없다', () => {
    expect(RETRY_OFFSETS_DAYS).toEqual([1, 3]);
    expect(MAX_CHARGE_ATTEMPTS).toBe(3);
    const failedAt = new Date('2026-03-05T00:00:00Z');
    expect(retryAtFor(failedAt, 1)?.toISOString()).toBe('2026-03-06T00:00:00.000Z');
    expect(retryAtFor(failedAt, 2)?.toISOString()).toBe('2026-03-08T00:00:00.000Z');
    expect(retryAtFor(failedAt, 3)).toBeNull();
  });
});
