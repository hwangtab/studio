import { computeBusinessPnl } from './businessLinePnl';
import type { ExpenseOccurrence } from './expenses';

jest.mock('../../db/client', () => ({ getDb: () => { throw new Error('DB를 쓰지 않는다'); } }));

const byLine = [
  { line: 'practice' as const, totals: { net: 5_000_000, count: 14 } },
  { line: 'recording' as const, totals: { net: 1_200_000, count: 4 } },
  { line: 'platform' as const, totals: { net: 300_000, count: 40 } },
  { line: 'other' as const, totals: { net: 0, count: 0 } },
];
const occ = (scope: string, category: string, amount: number): ExpenseOccurrence => ({ expenseId: `${scope}-${category}`, on: '2026-10-01', category, scope, description: '', amount, repeat: false });

describe('computeBusinessPnl', () => {
  it('분야 지출은 그 분야에서, 공통은 전체에서만, 대출 원금은 손익 밖으로', () => {
    const pnl = computeBusinessPnl(byLine, [
      occ('practice', 'cleaning', 100_000),
      occ('recording', 'supplies', 50_000),
      occ('studio', 'rent', 2_000_000),
      occ('studio', 'loan_principal', 400_000),
      occ('practice', 'loan_principal', 60_000),
    ]);
    expect(pnl.lines.map((l) => [l.line, l.revenue, l.expense, l.profit])).toEqual([
      ['practice', 5_000_000, 100_000, 4_900_000],
      ['recording', 1_200_000, 50_000, 1_150_000],
      ['platform', 300_000, 0, 300_000],
      ['other', 0, 0, 0],
    ]);
    expect(pnl.commonExpense).toBe(2_000_000);
    expect(pnl.revenueTotal).toBe(6_500_000);
    expect(pnl.expenseTotal).toBe(2_150_000);
    expect(pnl.totalProfit).toBe(4_350_000);
    expect(pnl.nonOperatingTotal).toBe(460_000);
    expect(pnl.cashFlow).toBe(3_890_000);
    // 분야 수익의 합 − 공통 지출 = 전체 수익
    expect(pnl.lines.reduce((a, l) => a + (l.profit ?? 0), 0) - (pnl.commonExpense ?? 0)).toBe(pnl.totalProfit);
    expect(pnl.nonOperatingByCategory).toEqual([{ category: 'loan_principal', label: '대출 원금 상환', amount: 460_000 }]);
    expect(pnl.commonExpenseByCategory.map((c) => c.category)).toEqual(['rent']);
  });

  it('지출 표를 못 읽으면 지출·수익 칸이 비고(null) 매출은 그대로', () => {
    const pnl = computeBusinessPnl(byLine, null);
    expect(pnl.lines.every((l) => l.expense === null && l.profit === null)).toBe(true);
    expect(pnl).toMatchObject({ revenueTotal: 6_500_000, commonExpense: null, expenseTotal: null, totalProfit: null, nonOperatingTotal: null, cashFlow: null });
  });

  it('지출이 모두 공통이면 분야 수익 = 매출이고 공통이 전체에서만 빠진다', () => {
    const pnl = computeBusinessPnl(byLine, [occ('studio', 'rent', 3_075_000)]);
    expect(pnl.lines.map((l) => l.profit)).toEqual([5_000_000, 1_200_000, 300_000, 0]);
    expect(pnl.totalProfit).toBe(6_500_000 - 3_075_000);
  });
});
