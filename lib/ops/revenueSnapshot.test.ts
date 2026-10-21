/**
 * 대시보드 카드(buildRevenueSnapshot)와 매출 현황 화면(summarizeRevenue + computeBusinessPnl)이 **같은 달에 같은 숫자**를 말하는지 — 순수 함수 수준.
 * 대시보드는 지난달~이번 달만 읽고 매출 현황은 2년 창을 읽는다. 창이 달라도 그 달의 합계·분야별 매출·지출·수익이 같아야 한다.
 */
import { computeBusinessPnl } from './businessLinePnl';
import { buildRevenueSnapshot, snapshotRange } from './revenueSnapshot';
import { loadWindow, summarizeRevenue, type RevenueRow } from './revenueReport';
import type { ExpenseOccurrence } from './expenses';

jest.mock('../../db/client', () => ({ getDb: () => { throw new Error('DB를 쓰지 않는다'); } }));

const kst = (date: string) => new Date(new Date(`${date}T00:00:00Z`).getTime() - 9 * 3600 * 1000);
const row = (orderNo: string, date: string, type: string, gross: number, over: Partial<RevenueRow> = {}): RevenueRow => ({
  at: kst(date), orderNo, type, projectSlug: null, method: '카드', gross, vat: Math.round(gross / 11), refunded: 0, offline: false, ...over,
});

const ROWS: RevenueRow[] = [
  row('a', '2025-10-05', 'session', 110000), // 전년 같은 달 — 매출 현황 창에만 있다
  row('b', '2026-09-30', 'mixing', 300000), // 지난달
  row('c', '2026-10-01', 'session', 22000, { line: 'practice' }),
  row('d', '2026-10-02', 'session', 165000), // 예약 행 없는 세션 — 녹음·제작
  row('e', '2026-10-03', 'deposit', 200000, { line: 'practice' }),
  row('f', '2026-10-04', 'funding', 55000, { sourceGross: 1000000, feeRate: 0.055 }),
  row('g', '2026-10-05', 'subscription', 9900), // 모르는 구독 종류 — 기타
  row('h', '2026-10-06', 'tenancy', 360000, { offline: true }),
  row('i', '2026-10-07', 'mixing', 500000, { refunded: 100000 }),
  row('j', '2026-11-01', 'session', 77000), // 다음 달 — 어디에도 안 들어간다
];

const EXPENSES: ExpenseOccurrence[] = [
  { expenseId: 'x1', on: '2026-10-25', category: 'rent', scope: 'practice', description: '임대료', amount: 1_200_000, repeat: true },
  { expenseId: 'x2', on: '2026-10-10', category: 'utilities', scope: 'studio', description: '전기', amount: 150_000, repeat: false },
  { expenseId: 'x3', on: '2026-10-10', category: 'loan_principal', scope: 'studio', description: '대출', amount: 500_000, repeat: false },
];

it('대시보드 스냅샷과 매출 현황의 이번 달 합계·분야별 매출·지출·수익이 같다', () => {
  const now = new Date('2026-10-21T03:00:00Z');
  const snapRange = snapshotRange(now);
  const snapRows = ROWS.filter((r) => r.at >= snapRange.from && r.at < snapRange.toExclusive);
  const snapshot = buildRevenueSnapshot(snapRows, EXPENSES, { year: 2026, month: 10, manualMissing: false, tenancyMissing: false });

  const window = loadWindow(2026);
  const pageRows = ROWS.filter((r) => r.at >= window.from && r.at < window.toExclusive);
  const summary = summarizeRevenue(pageRows, { year: 2026, month: 10 });
  const pnl = computeBusinessPnl(summary.byLine, EXPENSES);

  expect(snapshot.net).toBe(summary.totals.net);
  expect(snapshot.count).toBe(summary.totals.count);
  expect(snapshot.previousNet).toBe(summary.previous.net);
  expect(snapshot.changeRate).toBe(summary.changeRate);
  expect(snapshot.lines).toEqual(pnl.lines.map((l) => ({ line: l.line, label: l.label, net: l.revenue, expense: l.expense, profit: l.profit })));
  expect(snapshot.commonExpense).toBe(pnl.commonExpense);
  expect(snapshot.totalProfit).toBe(pnl.totalProfit);

  // 숫자 자체도 고정한다 — 세션(예약 없음)은 녹음·제작, 모르는 구독은 기타, 대출 원금은 수익에서 빼지 않는다.
  expect(Object.fromEntries(snapshot.lines.map((l) => [l.line, [l.net, l.profit]]))).toEqual({
    practice: [22000 + 200000 + 360000, 22000 + 200000 + 360000 - 1_200_000],
    recording: [165000 + 400000, 565000],
    platform: [55000, 55000],
    other: [9900, 9900],
  });
  expect(snapshot.net).toBe(582000 + 565000 + 55000 + 9900);
  expect(snapshot.totalProfit).toBe(snapshot.net - 1_200_000 - 150_000);
});

it('지출 표를 못 읽으면(null) 지출·수익은 비우고 매출은 그대로다', () => {
  const snapshot = buildRevenueSnapshot(ROWS, null, { year: 2026, month: 10, manualMissing: true, tenancyMissing: false });
  expect(snapshot.totalProfit).toBeNull();
  expect(snapshot.lines.every((l) => l.expense === null && l.profit === null)).toBe(true);
  expect(snapshot.net).toBeGreaterThan(0);
  expect(snapshot.manualMissing).toBe(true);
});
