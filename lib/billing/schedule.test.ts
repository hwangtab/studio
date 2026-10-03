import {
  computeNextBillingAt,
  cycleYmOf,
  daysInMonth,
  MAX_CHARGE_ATTEMPTS,
  parseKstDate,
  periodFor,
  RETRY_OFFSETS_DAYS,
  retryAtFor,
  scheduleForPaidCycle,
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

describe('parseKstDate', () => {
  it("'YYYY-MM-DD'를 그날 00:00 KST로 읽는다 — new Date()의 UTC 자정 해석은 하루가 밀린다", () => {
    expect(kst(parseKstDate('2026-10-01')!)).toBe('2026-10-01T00:00:00 KST');
    expect(parseKstDate('2026-10-01')!.toISOString()).toBe('2026-09-30T15:00:00.000Z');
  });

  it('형식이 다르거나 없는 날짜는 null', () => {
    expect(parseKstDate('2026-10-1')).toBeNull();
    expect(parseKstDate('20261001')).toBeNull();
    expect(parseKstDate('')).toBeNull();
    expect(parseKstDate('2026-13-01')).toBeNull();
    expect(parseKstDate('2026-02-30')).toBeNull();
  });

  it('윤년 2월 29일은 받는다', () => {
    expect(kst(parseKstDate('2028-02-29')!)).toBe('2028-02-29T00:00:00 KST');
  });
});

describe('scheduleForPaidCycle', () => {
  const at = (iso: string) => new Date(iso);

  it('지금 달 회차는 지금이 기준이다', () => {
    const r = scheduleForPaidCycle({ cycleYm: '2026-10', billingDay: 5, now: at('2026-10-05T00:00:00Z'), bindToCycle: true });
    expect(kst(r.period.start)).toBe('2026-10-05T09:00:00 KST');
    expect(kst(r.nextBillingAt)).toBe('2026-11-05T09:00:00 KST');
  });

  it('연습실·레슨의 지난달 회차는 그 달 청구일이 기준이다 — 9/30 실패분을 10/1에 걷으면 다음은 10/30', () => {
    const r = scheduleForPaidCycle({ cycleYm: '2026-09', billingDay: 30, now: at('2026-10-01T00:00:00Z'), bindToCycle: true });
    expect(kst(r.period.start)).toBe('2026-09-30T09:00:00 KST');
    expect(kst(r.period.end)).toBe('2026-10-30T09:00:00 KST');
    expect(kst(r.nextBillingAt)).toBe('2026-10-30T09:00:00 KST');
  });

  it('회차에 묶지 않는 상품(아티스트 후원)은 회차와 무관하게 지금이 기준이다', () => {
    const r = scheduleForPaidCycle({ cycleYm: '2026-09', billingDay: 30, now: at('2026-10-01T00:00:00Z'), bindToCycle: false });
    expect(kst(r.period.start)).toBe('2026-10-01T09:00:00 KST');
    expect(kst(r.nextBillingAt)).toBe('2026-11-30T09:00:00 KST');
  });

  it('앵커 기준 다음 청구일이 이미 지났으면 이번 달 회차를 간격(D+3) 뒤에 걷는다 — 이틀 연속 청구도, 10월 건너뛰기도 없다', () => {
    // 결제일 1일, 9월분을 10/1에 걷었다. 앵커 기준 다음 청구일(10/1)이 now 이하.
    const r = scheduleForPaidCycle({ cycleYm: '2026-09', billingDay: 1, now: at('2026-10-01T00:00:00Z'), bindToCycle: true });
    expect(kst(r.period.start)).toBe('2026-09-01T09:00:00 KST');
    expect(kst(r.period.end)).toBe('2026-10-01T09:00:00 KST');
    expect(kst(r.nextBillingAt)).toBe('2026-10-04T09:00:00 KST');
    expect(cycleYmOf(r.nextBillingAt)).toBe('2026-10');
  });

  it('이번 달 청구일이 아직 오지 않았으면(여러 달 밀린 뒤) 그 날짜가 먼저다', () => {
    const r = scheduleForPaidCycle({ cycleYm: '2026-07', billingDay: 20, now: at('2026-10-10T00:00:00Z'), bindToCycle: true });
    expect(kst(r.nextBillingAt)).toBe('2026-10-20T09:00:00 KST');
  });

  it('간격이 이번 달을 넘기면 말일 청구 시각에 이번 달 회차를 걷는다 — 다음 달로 넘겨 이번 달을 건너뛰지 않는다', () => {
    const r = scheduleForPaidCycle({ cycleYm: '2026-09', billingDay: 1, now: at('2026-10-30T00:00:00Z'), bindToCycle: true });
    expect(kst(r.nextBillingAt)).toBe('2026-10-31T09:00:00 KST');
  });

  it('말일 청구 시각도 지났으면 다음 정기 청구일로 가되 간격 안이면 간격 뒤로 민다', () => {
    const r = scheduleForPaidCycle({ cycleYm: '2026-09', billingDay: 1, now: at('2026-10-31T00:00:05Z'), bindToCycle: true });
    expect(kst(r.nextBillingAt)).toBe('2026-11-03T09:00:00 KST');
    expect(cycleYmOf(r.nextBillingAt)).toBe('2026-11');
  });

  it('cron이 09:00 몇 초 뒤에 돌아도 간격 끝 날의 09:00에 맞춘다 — 그날 cron이 놓치지 않게', () => {
    const r = scheduleForPaidCycle({ cycleYm: '2026-09', billingDay: 1, now: at('2026-10-01T00:00:07Z'), bindToCycle: true });
    expect(kst(r.nextBillingAt)).toBe('2026-10-04T09:00:00 KST');
  });

  it('어느 분기든 다음 청구는 now보다 뒤다', () => {
    const now = at('2026-10-01T00:00:00Z');
    for (const billingDay of [1, 2, 15, 28, 30, 31]) {
      for (const cycleYm of ['2026-06', '2026-08', '2026-09', '2026-10']) {
        const r = scheduleForPaidCycle({ cycleYm, billingDay, now, bindToCycle: true });
        expect(r.nextBillingAt.getTime()).toBeGreaterThan(now.getTime());
      }
    }
  });
});
