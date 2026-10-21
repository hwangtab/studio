import { loadProductionRevenueRows } from './productionRevenue';
import { kstYearMonth, loadRevenueRows, periodRange, previousPeriod, summarizeRevenue } from './revenueReport';
import { loadManualRevenueRows } from './manualRevenue';
import { loadTenancyRevenueRows } from './tenancyRevenue';
import { loadLessonRevenueRows } from './lessonRevenue';
import { loadExpenseOccurrences, summarizeExpenses } from './expenses';

/**
 * 관리자 첫 화면의 이번 달 매출 요약 — 매출 현황(`/admin/revenue`)과 **같은 집계**(summarizeRevenue)를 쓴다.
 * 숫자가 두 벌이면 첫 화면과 상세가 다른 매출을 말하게 된다. 전월 대비를 위해 지난달부터 이번 달 끝까지만 읽는다.
 *
 * 수기 매출 표(마이그레이션 0063·소프트 삭제 칸 0065)를 못 읽으면 `manualMissing`으로 알린다 — 그 숫자에는 직접 받은 돈이 빠져 있다.
 */
export interface RevenueSnapshot {
  year: number;
  month: number;
  /** 이번 달 순매출(환불 제외, 부가세 포함). */
  net: number;
  gross: number;
  refunded: number;
  count: number;
  previousNet: number;
  /** 전월 대비 증감(%). 전월 매출이 0이면 null. */
  changeRate: number | null;
  directNet: number;
  brokeredNet: number;
  manualMissing: boolean;
  /** 이번 달 연습실 월 입주 수입(순). 월 입주 표를 못 읽었으면 null. */
  practiceIncome: number | null;
  /** 이번 달 연습실 지출. 지출 표를 못 읽었으면(마이그레이션 0080 전) null. */
  practiceExpense: number | null;
  tenancyMissing: boolean;
}

export const loadRevenueSnapshot = async (now: Date): Promise<RevenueSnapshot> => {
  const { year, month } = kstYearMonth(now);
  const prev = previousPeriod(year, month) as { year: number; month: number };
  const range = { from: periodRange(prev.year, prev.month).from, toExclusive: periodRange(year, month).toExclusive };

  const rows = await loadRevenueRows(range);
  // 제작·믹싱 계약의 입금 기록(결제 행이 없다 — productionRevenue.ts).
  rows.push(...(await loadProductionRevenueRows(range, now)));
  let manualMissing = false;
  try {
    rows.push(...(await loadManualRevenueRows(range)));
  } catch (error: unknown) {
    console.error('[admin/dashboard] 수기 매출 조회 실패:', error);
    manualMissing = true;
  }

  // 연습실 월 입주 수납 — 결제 행이 없어 위 조회에 안 잡힌다(tenancyRevenue.ts). 못 읽으면 그 사실을 알린다.
  let tenancyMissing = false;
  try {
    rows.push(...(await loadTenancyRevenueRows(range)));
  } catch (error: unknown) {
    console.error('[admin/dashboard] 월 입주 수입 조회 실패:', error);
    tenancyMissing = true;
  }

  // 레슨 계좌·현금 수납(lesson_payments). 못 읽으면(마이그레이션 0081 전) 그 금액이 빠진다 — 카드 레슨은 위 결제 행에 이미 있다.
  try {
    rows.push(...(await loadLessonRevenueRows(range)));
  } catch (error: unknown) {
    console.error('[admin/dashboard] 레슨 수납 조회 실패(마이그레이션 0081 전일 수 있음):', error);
  }

  const summary = summarizeRevenue(rows, { year, month });
  const thisMonth = periodRange(year, month);
  let practiceExpense: number | null = null;
  try {
    practiceExpense = summarizeExpenses(await loadExpenseOccurrences(thisMonth), 'practice').total;
  } catch (error: unknown) {
    console.error('[admin/dashboard] 지출 조회 실패(마이그레이션 0080 전일 수 있음):', error);
  }
  const practiceIncome = tenancyMissing
    ? null
    : summarizeRevenue(rows, { year, month, type: 'tenancy' }).totals.net;
  const group = (key: 'direct' | 'brokered') => summary.byGroup.find((g) => g.group === key)?.totals.net ?? 0;
  return {
    year,
    month,
    net: summary.totals.net,
    gross: summary.totals.gross,
    refunded: summary.totals.refunded,
    count: summary.totals.count,
    previousNet: summary.previous.net,
    changeRate: summary.changeRate,
    directNet: group('direct'),
    brokeredNet: group('brokered'),
    manualMissing,
    practiceIncome,
    practiceExpense,
    tenancyMissing,
  };
};
