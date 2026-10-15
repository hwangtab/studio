/** @jest-environment node */
import { kstYearMonth, netOfRow, periodRange, previousPeriod, summarizeRevenue, type RevenueRow } from './revenueReport';

const row = (over: Partial<Omit<RevenueRow, 'at'>> & { at: string }): RevenueRow => ({
  orderNo: `NO-${over.at}-${over.type ?? 'session'}`,
  type: 'session',
  projectSlug: null,
  method: '카드',
  gross: 110000,
  vat: 10000,
  refunded: 0,
  offline: false,
  ...over,
  at: new Date(over.at),
});

describe('netOfRow', () => {
  it('환불 비율로 부가세를 나누고 공급가액은 나머지로 맞춘다', () => {
    expect(netOfRow({ gross: 110000, vat: 10000, refunded: 0 })).toEqual({ net: 110000, netVat: 10000, netSupply: 100000 });
    expect(netOfRow({ gross: 110000, vat: 10000, refunded: 55000 })).toEqual({ net: 55000, netVat: 5000, netSupply: 50000 });
    expect(netOfRow({ gross: 110000, vat: 10000, refunded: 110000 })).toEqual({ net: 0, netVat: 0, netSupply: 0 });
  });
  it('환불이 결제를 넘어도 음수가 되지 않는다', () => {
    expect(netOfRow({ gross: 1000, vat: 0, refunded: 5000 }).net).toBe(0);
  });
});

describe('기간', () => {
  it('KST 달력으로 자른다 — 9/30 23:59 KST는 9월, 10/1 00:00 KST는 10월', () => {
    expect(kstYearMonth(new Date('2026-09-30T14:59:59Z'))).toEqual({ year: 2026, month: 9 });
    expect(kstYearMonth(new Date('2026-09-30T15:00:00Z'))).toEqual({ year: 2026, month: 10 });
    expect(periodRange(2026, 12).toExclusive.toISOString()).toBe('2026-12-31T15:00:00.000Z');
  });
  it('1월의 전기는 전년 12월, 연 전체의 전기는 전년', () => {
    expect(previousPeriod(2026, 1)).toEqual({ year: 2025, month: 12 });
    expect(previousPeriod(2026, 'all')).toEqual({ year: 2025, month: 'all' });
  });
});

describe('summarizeRevenue', () => {
  const rows = [
    row({ at: '2026-09-10T03:00:00Z', gross: 100000, vat: 9091 }),
    row({ at: '2026-09-11T03:00:00Z', type: 'funding', projectSlug: 'a', gross: 50000, vat: 0, refunded: 50000, method: '계좌 입금', offline: true }),
    row({ at: '2026-09-12T03:00:00Z', type: 'funding', projectSlug: 'a', gross: 30000, vat: 0 }),
    row({ at: '2026-08-31T14:59:00Z', gross: 200000, vat: 18182 }), // 8월 (KST 8/31 23:59)
    row({ at: '2025-09-10T03:00:00Z', gross: 40000, vat: 3636 }), // 전년 9월
  ];

  it('월 합계·전월 대비·전액 환불 건수를 센다', () => {
    const s = summarizeRevenue(rows, { year: 2026, month: 9 });
    expect(s.totals).toMatchObject({ count: 3, fullyRefundedCount: 1, gross: 180000, refunded: 50000, net: 130000 });
    expect(s.previous.net).toBe(200000);
    expect(s.changeRate).toBeCloseTo(-35, 5);
  });

  it('전기 매출이 0이면 증감률은 null', () => {
    expect(summarizeRevenue(rows, { year: 2025, month: 9 }).changeRate).toBeNull();
  });

  it('월별 추이는 해당 연도와 전년을 나란히 담는다', () => {
    const s = summarizeRevenue(rows, { year: 2026, month: 'all' });
    expect(s.monthly[8]).toMatchObject({ month: 9, net: 130000, previousYearNet: 40000, count: 3 });
    expect(s.monthly[7].net).toBe(200000);
    expect(s.totals.net).toBe(330000);
  });

  it('유형별 표는 필터와 무관하게 전체 유형을, 나머지는 필터된 유형만 센다', () => {
    const s = summarizeRevenue(rows, { year: 2026, month: 9, type: 'funding' });
    expect(s.byType.map((l) => l.key).sort()).toEqual(['funding', 'session']);
    expect(s.totals.net).toBe(30000);
    expect(s.byProject).toHaveLength(1);
    expect(s.byProject[0]).toMatchObject({ key: 'a', count: 2, net: 30000 });
  });

  it('직접 서비스와 판매·중개를 나눈다', () => {
    const s = summarizeRevenue(rows, { year: 2026, month: 9 });
    expect(s.byGroup.find((g) => g.group === 'direct')?.totals.net).toBe(100000);
    expect(s.byGroup.find((g) => g.group === 'brokered')?.totals.net).toBe(30000);
  });

  it('알 수 없는 유형 필터는 무시한다', () => {
    expect(summarizeRevenue(rows, { year: 2026, month: 9, type: 'nope' }).totals.count).toBe(3);
  });
});
