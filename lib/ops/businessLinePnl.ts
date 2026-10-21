import { BUSINESS_LINE_LABELS, BUSINESS_LINES, expenseBucketOfScope, type BusinessLine } from './businessLine';
import { EXPENSE_CATEGORY_LABELS, isNonOperatingCategory, type ExpenseOccurrence } from './expenses';
import type { Totals } from './revenueReport';

/**
 * 분야별 **매출 · 지출 · 수익**(매출 − 지출). 순수 함수 — 매출 현황 화면과 대시보드 카드가 같은 계산을 쓴다.
 *
 * - 매출 = 분야의 순매출(환불 제외, 부가세 포함 — summarizeRevenue의 byLine).
 * - 지출 = 구분이 그 분야인 지출(expenseBucketOfScope). **공통**(저장값 'studio') 지출은 어느 분야에도 나누지 않고 전체 수익에서만 뺀다.
 * - 대출 원금 상환처럼 손익 밖 지출(isNonOperatingCategory)은 어디에도 빼지 않고 `nonOperatingTotal`로만 모은다 —
 *   `cashFlow`(전체 수익 − 그 지출)는 현금이 실제로 얼마 남았는지의 참고값이다.
 * - 지출 표를 못 읽으면(`expenses = null`) 지출·수익 칸은 전부 null — 지출이 0인 것처럼 수익을 보이지 않는다.
 */
export interface LinePnl {
  line: BusinessLine;
  label: string;
  revenue: number;
  count: number;
  expense: number | null;
  profit: number | null;
  expenseByCategory: Array<{ category: string; label: string; amount: number }>;
}

export interface BusinessPnl {
  lines: LinePnl[];
  revenueTotal: number;
  commonExpense: number | null;
  commonExpenseByCategory: Array<{ category: string; label: string; amount: number }>;
  /** 분야 지출 + 공통 지출(손익 밖 지출 제외). */
  expenseTotal: number | null;
  /** Σ매출 − Σ(분야 지출 + 공통 지출). */
  totalProfit: number | null;
  nonOperatingTotal: number | null;
  nonOperatingByCategory: Array<{ category: string; label: string; amount: number }>;
  /** 전체 수익 − 손익 밖 지출. */
  cashFlow: number | null;
}

const byCategoryOf = (items: readonly ExpenseOccurrence[]) => {
  const map = new Map<string, number>();
  for (const o of items) map.set(o.category, (map.get(o.category) ?? 0) + o.amount);
  return [...map.entries()]
    .map(([category, amount]) => ({ category, label: EXPENSE_CATEGORY_LABELS[category] ?? category, amount }))
    .sort((a, b) => b.amount - a.amount);
};

const sum = (items: readonly ExpenseOccurrence[]) => items.reduce((acc, o) => acc + o.amount, 0);

export const computeBusinessPnl = (
  byLine: ReadonlyArray<{ line: BusinessLine; totals: Pick<Totals, 'net' | 'count'> }>,
  expenses: readonly ExpenseOccurrence[] | null,
): BusinessPnl => {
  const revenueOf = new Map(byLine.map((l) => [l.line, l.totals]));
  const operating = expenses?.filter((o) => !isNonOperatingCategory(o.category)) ?? null;
  const nonOperating = expenses?.filter((o) => isNonOperatingCategory(o.category)) ?? null;

  const lines: LinePnl[] = BUSINESS_LINES.map((line) => {
    const totals = revenueOf.get(line) ?? { net: 0, count: 0 };
    const mine = operating?.filter((o) => expenseBucketOfScope(o.scope) === line) ?? null;
    const expense = mine ? sum(mine) : null;
    return {
      line,
      label: BUSINESS_LINE_LABELS[line],
      revenue: totals.net,
      count: totals.count,
      expense,
      profit: expense === null ? null : totals.net - expense,
      expenseByCategory: mine ? byCategoryOf(mine) : [],
    };
  });

  const common = operating?.filter((o) => expenseBucketOfScope(o.scope) === 'common') ?? null;
  const revenueTotal = lines.reduce((acc, l) => acc + l.revenue, 0);
  const expenseTotal = operating ? sum(operating) : null;
  const totalProfit = expenseTotal === null ? null : revenueTotal - expenseTotal;
  const nonOperatingTotal = nonOperating ? sum(nonOperating) : null;
  return {
    lines,
    revenueTotal,
    commonExpense: common ? sum(common) : null,
    commonExpenseByCategory: common ? byCategoryOf(common) : [],
    expenseTotal,
    totalProfit,
    nonOperatingTotal,
    nonOperatingByCategory: nonOperating ? byCategoryOf(nonOperating) : [],
    cashFlow: totalProfit === null || nonOperatingTotal === null ? null : totalProfit - nonOperatingTotal,
  };
};
