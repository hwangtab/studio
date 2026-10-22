import React from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import { AdminShell } from '../../components/admin/AdminShell';
import { FilterPill } from '../../components/admin/FilterPill';
import { ManualRevenuePanel, type ManualRevenueView } from '../../components/admin/ManualRevenuePanel';
import { Disclosure } from '../../components/ui/Disclosure';
import { Notice } from '../../components/ui/Notice';
import { kstDateString } from '../../lib/booking/kst';
import { loadManualRevenueRows, MANUAL_METHODS, MANUAL_TYPES } from '../../lib/ops/manualRevenue';
import { formatKstDateTimeFull } from '../../lib/booking/format';
import { authenticateAdminRequest } from '../../lib/contracts/admin-auth';
import {
  loadRevenueRows,
  loadWindow,
  periodRange,
  kstYearMonth,
  REVENUE_TYPE_LABELS,
  summarizeRevenue,
  ENTRY_LIMIT,
  type BreakdownLine,
  type RevenueSummary,
} from '../../lib/ops/revenueReport';
import { loadProductionRevenueRows } from '../../lib/ops/productionRevenue';
import { loadTenancyRevenueRows } from '../../lib/ops/tenancyRevenue';
import { loadLessonRevenueRows } from '../../lib/ops/lessonRevenue';
import { loadExpenseOccurrences, type ExpenseOccurrence } from '../../lib/ops/expenses';
import { BUSINESS_LINE_LABELS, lineOfRow, parseBusinessLine, type BusinessLine } from '../../lib/ops/businessLine';
import { computeBusinessPnl, type BusinessPnl } from '../../lib/ops/businessLinePnl';
import { describeDuplicateMatches, listManualRevenueDuplicates } from '../../lib/ops/manualRevenueDuplicates';

/**
 * 매출 현황 — 월·연 단위 순매출, 전기 대비, 월별 추이, 유형·펀딩 프로젝트·결제수단별 구성.
 *
 * 모집단·환불 규칙은 lib/ops/revenueReport.ts 머리 주석. 이름·연락처는 읽지 않으므로 접속기록
 * 대상이 아니다. 세무용 원장은 기존 토스 결제 장부 CSV(대시보드)가 그대로 정본이다.
 */

interface RevenuePageProps {
  summary: RevenueSummary | null;
  type: string | null;
  /** 분야 필터(`?line=`). */
  line?: BusinessLine | null;
  years: number[];
  /** 지금(KST) 년·월 — 진행 중인 기간 표시용. */
  nowYear: number;
  nowMonth: number;
  /** 페이지 서버가 만든 행 표기(Date를 직렬화하지 않으려고 문자열로 바꾼다). */
  entryDates: string[];
  today: string;
  manualEntries: ManualRevenueView[];
  /** 수기 매출 표를 못 읽은 사유(마이그레이션 0063 전). 있으면 숫자에 직접 입금분이 빠져 있다. */
  manualError: string | null;
  /** 분야별 매출·지출·수익(lib/ops/businessLinePnl.ts). 지출 표를 못 읽으면 지출·수익 칸이 null. */
  pnl?: BusinessPnl | null;
  /** 월 입주 수입·지출을 못 읽은 사유(월 입주 표 0066·지출 표 0080 전 등). */
  pnlNotice?: string | null;
  lessonError?: string | null;
  error?: string;
}

const FIRST_YEAR = 2025;

const single = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);

export const getServerSideProps: GetServerSideProps<RevenuePageProps> = async (context) => {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return { redirect: { destination: '/admin/login', permanent: false } };

  const now = kstYearMonth(new Date());
  const yearParam = Number(single(context.query.year));
  const year = Number.isInteger(yearParam) && yearParam >= FIRST_YEAR && yearParam <= now.year ? yearParam : now.year;
  const monthRaw = single(context.query.month);
  const monthParam = Number(monthRaw);
  const month: number | 'all' = monthRaw === 'all' ? 'all' : Number.isInteger(monthParam) && monthParam >= 1 && monthParam <= 12 ? monthParam : now.month;
  const typeParam = single(context.query.type);
  const type = typeParam && typeParam in REVENUE_TYPE_LABELS ? typeParam : null;
  const line = parseBusinessLine(single(context.query.line));
  const years = Array.from({ length: now.year - FIRST_YEAR + 1 }, (_, i) => now.year - i);
  const today = kstDateString(new Date());
  const base = { type, line, years, nowYear: now.year, nowMonth: now.month, today };

  try {
    const window = loadWindow(year);
    const rows = await loadRevenueRows(window);
    // 제작·믹싱 계약의 입금 기록 — 결제 행이 없어 위 조회에 안 잡힌다(productionRevenue.ts).
    rows.push(...(await loadProductionRevenueRows(window)));
    // 수기 매출은 따로 읽는다 — 표가 없는 DB(0063 전)에서도 나머지 매출은 보여야 한다. 대신 빠졌다는 사실을 화면에 올린다.
    let manualError: string | null = null;
    try {
      rows.push(...(await loadManualRevenueRows(window)));
    } catch (manualFailure: unknown) {
      console.error('[admin/revenue] 수기 매출 조회 실패:', manualFailure);
      manualError = '직접 받은 매출 표를 읽지 못했습니다(마이그레이션 0063·0065 적용 전이거나 조회 오류). 아래 숫자에는 직접 입금분이 빠져 있습니다.';
    }
    // 연습실 월 입주 수납 — 결제 행이 없어 위 조회에 안 잡힌다(tenancyRevenue.ts). 못 읽으면 손익 칸에 알린다.
    let tenancyFailed = false;
    try {
      rows.push(...(await loadTenancyRevenueRows(window)));
    } catch (tenancyFailure: unknown) {
      console.error('[admin/revenue] 월 입주 수입 조회 실패:', tenancyFailure);
      tenancyFailed = true;
    }
    let lessonError: string | null = null;
    // 레슨 계좌·현금 수납(lesson_payments) — 카드 레슨은 위 결제 행에 이미 있다. 못 읽으면 알린다(마이그레이션 0081 전).
    try {
      rows.push(...(await loadLessonRevenueRows(window)));
    } catch (lessonFailure: unknown) {
      console.error('[admin/revenue] 레슨 수납 조회 실패:', lessonFailure);
      lessonError = '레슨 계좌·현금 수납 표를 읽지 못했습니다(마이그레이션 0081 적용 전이거나 조회 오류). 그 금액이 아래 숫자에 빠져 있습니다.';
    }
    const summary = summarizeRevenue(rows, { year, month, type, line });
    const range = periodRange(year, month);
    const notices: string[] = [];
    if (tenancyFailed) notices.push('월 입주 수입을 읽지 못했습니다(마이그레이션 0066 확인). 연습실 매출에 월 입주 수입이 빠져 있습니다.');
    let expenses: ExpenseOccurrence[] | null = null;
    try {
      expenses = await loadExpenseOccurrences(range);
    } catch (expenseFailure: unknown) {
      console.error('[admin/revenue] 지출 조회 실패:', expenseFailure);
      notices.push('지출 표를 읽지 못했습니다(마이그레이션 0080 적용 전이거나 조회 오류). 수익(매출 − 지출)을 낼 수 없어 지출·수익 칸을 비웠습니다.');
    }
    const pnl = computeBusinessPnl(summary.byLine, expenses);
    const pnlNotice = notices.length > 0 ? notices.join(' ') : null;
    // 중복 의심(같은 금액의 사이트 주문·같은 날 수기 매출) — 목록에 표시하고 "중복 아님"을 받는다. 조회가 실패해도 화면은 연다.
    const duplicates = new Map<string, string>();
    if (!manualError) {
      try {
        const found = await listManualRevenueDuplicates({ from: kstDateString(range.from), to: kstDateString(new Date(range.toExclusive.getTime() - 1)) });
        for (const d of found) duplicates.set(d.manualId, describeDuplicateMatches(d));
      } catch (duplicateFailure: unknown) {
        console.error('[admin/revenue] 중복 의심 조회 실패 — 표시 없이 엽니다:', duplicateFailure instanceof Error ? duplicateFailure.name : 'unknown');
      }
    }
    // 분야 필터(`?line=`)는 직접 받은 매출 목록에도 건다 — 위 숫자와 아래 목록이 같은 분야를 말하게.
    const manualEntries: ManualRevenueView[] = rows
      .filter((row) => row.manualId && row.at >= range.from && row.at < range.toExclusive && (!line || lineOfRow(row) === line))
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .map((row) => ({
        id: row.manualId as string,
        receivedOn: kstDateString(row.at),
        typeLabel: REVENUE_TYPE_LABELS[row.type] ?? row.type,
        lineLabel: BUSINESS_LINE_LABELS[lineOfRow(row)],
        typeKey: row.type,
        assignedLine: row.line ?? null,
        duplicateOf: duplicates.get(row.manualId as string) ?? null,
        description: row.note ?? '',
        method: row.method,
        memo: row.memo ?? null,
        totalAmount: row.gross,
        refundedAmount: row.refunded,
      }));
    return {
      props: {
        ...base,
        summary: JSON.parse(JSON.stringify(summary)) as RevenueSummary,
        entryDates: summary.entries.map((row) => formatKstDateTimeFull(row.at.toISOString())),
        manualEntries,
        manualError,
        pnl,
        pnlNotice,
        lessonError,
      },
    };
  } catch (error: unknown) {
    console.error('[admin/revenue] 집계 실패:', error);
    return { props: { ...base, summary: null, entryDates: [], manualEntries: [], manualError: null, pnl: null, pnlNotice: null, error: '매출을 불러오지 못했습니다. 잠시 뒤 다시 열어 주세요.' } };
  }
};

const won = (value: number) => `${value.toLocaleString('ko-KR')}원`;

/** 차트 축·막대 밑 표기 — 만원 단위로 줄인다(백만 단위 이상은 소수 한 자리). */
const compactWon = (value: number): string => {
  if (value === 0) return '0';
  const man = value / 10000;
  return man >= 1000 ? `${(man / 10000).toFixed(1)}억` : `${Math.round(man).toLocaleString('ko-KR')}만`;
};

const href = (year: number, month: number | 'all', type: string | null, line: BusinessLine | null = null) => {
  const params = new URLSearchParams({ year: String(year), month: String(month) });
  if (line) params.set('line', line);
  if (type) params.set('type', type);
  return `/admin/revenue?${params.toString()}`;
};

const csvHref = (summary: RevenueSummary) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const { year, month } = summary;
  const from = month === 'all' ? `${year}-01-01` : `${year}-${pad(month)}-01`;
  const lastDay = month === 'all' ? 31 : new Date(Date.UTC(year, month, 0)).getUTCDate();
  const to = month === 'all' ? `${year}-12-31` : `${year}-${pad(month)}-${pad(lastDay)}`;
  return `/api/admin/orders/export?from=${from}&to=${to}`;
};

/** 세무사용 상점·공연 정산 CSV — 같은 기간을 달 단위로(연 전체면 1~12월). 수취인 이름·금액만 실린다. */
const payoutCsvHref = (summary: RevenueSummary) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const { year, month } = summary;
  const from = month === 'all' ? `${year}-01` : `${year}-${pad(month)}`;
  const to = month === 'all' ? `${year}-12` : from;
  return `/api/admin/partner-payouts/export?kind=all&from=${from}&to=${to}`;
};

const Delta = ({ rate, label }: { rate: number | null; label: string }) => {
  if (rate === null) return <p className="mt-1 text-xs text-gray-500">{label}: 비교할 매출 없음</p>;
  const up = rate >= 0;
  return (
    <p className={`mt-1 text-xs font-medium ${up ? 'text-green-700' : 'text-red-700'}`}>
      {up ? '▲' : '▼'} {Math.abs(rate).toFixed(1)}% <span className="font-normal text-gray-500">{label}</span>
    </p>
  );
};

const Kpi = ({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4">
    <p className="text-sm text-gray-500">{label}</p>
    <p className="mt-1 text-lg font-bold text-gray-900 tabular-nums [overflow-wrap:normal] sm:text-xl lg:text-2xl">{value}</p>
    {sub}
  </div>
);

const MonthlyChart = ({ summary, type }: { summary: RevenueSummary; type: string | null }) => {
  const line = summary.line;
  const peak = Math.max(1, ...summary.monthly.flatMap((m) => [m.net, m.previousYearNet]));
  return (
    <div>
      <div className="flex h-44 items-end gap-1 md:gap-2" role="img" aria-label={`${summary.year}년 월별 순매출 막대 그래프`}>
        {summary.monthly.map((point) => {
          const selected = summary.month === point.month;
          return (
            <Link
              key={point.month}
              href={href(summary.year, point.month, type, line)}
              title={`${point.month}월 순매출 ${won(point.net)} (${point.count}건) · 전년 ${won(point.previousYearNet)}`}
              className={`flex h-full flex-1 items-end justify-center gap-0.5 rounded-lg px-0.5 pb-0.5 hover:bg-gray-50 ${selected ? 'bg-blue-50' : ''}`}
            >
              <span className="w-1/2 max-w-[14px] rounded-t bg-gray-300" style={{ height: `${(point.previousYearNet / peak) * 100}%` }} />
              <span className="w-1/2 max-w-[14px] rounded-t bg-primary" style={{ height: `${(point.net / peak) * 100}%` }} />
            </Link>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1 md:gap-2">
        {summary.monthly.map((point) => (
          <div key={point.month} className="flex-1 text-center">
            <p className={`text-xs ${summary.month === point.month ? 'font-bold text-gray-900' : 'text-gray-500'}`}>{point.month}월</p>
            <p className="hidden text-[10px] text-gray-400 tabular-nums md:block">{compactWon(point.net)}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 flex items-center gap-4 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary" /> {summary.year}년
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-gray-300" /> {summary.year - 1}년
        </span>
        <span>막대를 누르면 그 달로 이동합니다.</span>
      </p>
    </div>
  );
};

const BreakdownTable = ({
  title,
  note,
  lines,
  firstColumn,
  linkFor,
  activeKey,
}: {
  title: string;
  note?: string;
  lines: BreakdownLine[];
  firstColumn: string;
  linkFor?: (line: BreakdownLine) => string;
  activeKey?: string | null;
}) => (
  <section className="rounded-2xl bg-white p-4 shadow-sm md:p-8">
    <h2 className="mb-1 text-lg font-bold text-gray-900 dark:text-gray-900">{title}</h2>
    {note && <p className="mb-4 text-xs text-gray-500">{note}</p>}
    {lines.length === 0 ? (
      <p className="mt-3 text-sm text-gray-600">이 기간에는 해당 매출이 없습니다.</p>
    ) : (
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <table className="w-full whitespace-nowrap text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
              <th className="py-2 pr-3 font-medium">{firstColumn}</th>
              <th className="px-3 py-2 text-right font-medium">건수</th>
              <th className="px-3 py-2 text-right font-medium">매출(결제)</th>
              <th className="px-3 py-2 text-right font-medium">환불</th>
              <th className="px-3 py-2 text-right font-medium">순매출</th>
              <th className="py-2 pl-3 text-right font-medium">비중</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 tabular-nums">
            {lines.map((line) => (
              <tr key={line.key} className={activeKey === line.key ? 'bg-blue-50' : ''}>
                <td className="py-2 pr-3 font-medium text-gray-900">
                  {linkFor ? (
                    <Link href={linkFor(line)} className="hover:underline">
                      {line.label}
                    </Link>
                  ) : (
                    line.label
                  )}
                </td>
                <td className="px-3 py-2 text-right text-gray-700">{line.count}</td>
                <td className="px-3 py-2 text-right text-gray-700">{won(line.gross)}</td>
                <td className="px-3 py-2 text-right text-gray-700">{line.refunded > 0 ? `-${won(line.refunded)}` : '-'}</td>
                <td className="px-3 py-2 text-right font-semibold text-gray-900">{won(line.net)}</td>
                <td className="py-2 pl-3 text-right text-gray-600">{line.share === null ? '-' : `${line.share.toFixed(1)}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

const signedWon = (value: number | null) => (value === null ? '-' : value > 0 ? `-${won(value)}` : '0원');
const profitClass = (value: number | null) => (value !== null && value < 0 ? 'text-red-700' : 'text-gray-900');

const ExpenseItems = ({ title, items }: { title: string; items: Array<{ category: string; label: string; amount: number }> }) =>
  items.length === 0 ? null : (
    <div>
      <p className="text-xs font-semibold text-gray-700">{title}</p>
      <ul className="mt-1 space-y-0.5">
        {items.map((c) => (
          <li key={c.category} className="flex justify-between gap-3 text-xs text-gray-600">
            <span>{c.label}</span>
            <span className="tabular-nums">{won(c.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );

/**
 * 분야별 매출 · 지출 · 수익. 숫자는 lib/ops/businessLinePnl.ts 하나에서 온다(대시보드 카드와 같다). 분야 이름을 누르면 아래 유형별 표·
 * 결제 내역이 그 분야만 보인다(`?line=`). 공통 지출은 어느 분야에도 나누지 않는다 — 나눌 기준(면적·시간)을 정하지 않았기 때문이다.
 */
const BusinessPnlSection = ({ pnl, summary }: { pnl: BusinessPnl; summary: RevenueSummary }) => {
  const expenseKnown = pnl.expenseTotal !== null;
  const lineExpenseTotal = pnl.lines.reduce((acc, l) => acc + (l.expense ?? 0), 0);
  const hasBreakdown = pnl.lines.some((l) => l.expenseByCategory.length > 0) || pnl.commonExpenseByCategory.length > 0 || pnl.nonOperatingByCategory.length > 0;
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm md:p-8">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900">분야별 매출·수익 · {summary.periodLabel}</h2>
        <Link href="/admin/expenses" className="text-sm font-medium text-primary hover:underline">지출 관리 →</Link>
      </div>
      <p className="mb-4 text-xs text-gray-500">수익 = 매출 − 지출. 분야 이름을 누르면 아래 유형별 표와 결제 내역이 그 분야만 보입니다.</p>
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <table className="w-full whitespace-nowrap text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
              <th className="py-2 pr-3 font-medium">분야</th>
              <th className="px-3 py-2 text-right font-medium">매출(순, 환불 제외)</th>
              <th className="px-3 py-2 text-right font-medium">지출</th>
              <th className="py-2 pl-3 text-right font-medium">수익</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 tabular-nums">
            {pnl.lines.map((l) => (
              <tr key={l.line} className={summary.line === l.line ? 'bg-blue-50' : ''}>
                <td className="py-2 pr-3 font-medium text-gray-900">
                  <Link href={href(summary.year, summary.month, null, summary.line === l.line ? null : l.line)} className="hover:underline">
                    {l.label}
                  </Link>
                  <span className="ml-1 text-xs font-normal text-gray-500">{l.count}건</span>
                </td>
                <td className="px-3 py-2 text-right text-gray-900">{won(l.revenue)}</td>
                <td className="px-3 py-2 text-right text-gray-700">{signedWon(l.expense)}</td>
                <td className={`py-2 pl-3 text-right font-semibold ${profitClass(l.profit)}`}>{l.profit === null ? '-' : won(l.profit)}</td>
              </tr>
            ))}
            <tr>
              <td className="py-2 pr-3 text-gray-700">
                공통 지출 <span className="text-xs text-gray-500">(분야에 나누지 않음)</span>
              </td>
              <td className="px-3 py-2 text-right text-gray-400">-</td>
              <td className="px-3 py-2 text-right text-gray-700">{signedWon(pnl.commonExpense)}</td>
              <td className="py-2 pl-3 text-right text-gray-700">{pnl.commonExpense === null ? '-' : pnl.commonExpense > 0 ? `-${won(pnl.commonExpense)}` : '0원'}</td>
            </tr>
            <tr className="border-t-2 border-gray-200">
              <td className="py-2 pr-3 font-bold text-gray-900">전체 수익</td>
              <td className="px-3 py-2 text-right font-semibold text-gray-900">{won(pnl.revenueTotal)}</td>
              <td className="px-3 py-2 text-right font-semibold text-gray-900">{signedWon(pnl.expenseTotal)}</td>
              <td className={`py-2 pl-3 text-right text-base font-bold ${profitClass(pnl.totalProfit)}`}>{pnl.totalProfit === null ? '-' : won(pnl.totalProfit)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {expenseKnown && (
        <dl className="mt-4 space-y-1.5 rounded-xl bg-gray-50 p-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-gray-600">손익에 넣지 않는 지출(대출 원금 등)</dt>
            <dd className="tabular-nums text-gray-900">{signedWon(pnl.nonOperatingTotal)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-gray-600">현금 흐름 참고 (전체 수익 − 그 지출)</dt>
            <dd className={`font-semibold tabular-nums ${profitClass(pnl.cashFlow)}`}>{pnl.cashFlow === null ? '-' : won(pnl.cashFlow)}</dd>
          </div>
        </dl>
      )}

      {expenseKnown && pnl.commonExpense !== null && pnl.commonExpense > 0 && (
        <p className="mt-3 text-xs text-gray-600">
          분야별 수익은 <strong>그 분야로 적은 지출만</strong> 뺀 값입니다
          {lineExpenseTotal === 0 ? '(이 기간에는 분야로 적은 지출이 없어 분야별 수익이 매출과 같습니다)' : ''}. 공통 지출 {won(pnl.commonExpense)}은 어느 분야에도 나누지 않고 전체 수익에서만 빼므로,
          분야별 수익을 더하면 전체 수익보다 큽니다. 분야별 수익을 “그 분야가 남긴 돈”으로 읽으려면 공통 지출 몫을 감안해 주세요.
        </p>
      )}

      {hasBreakdown && (
        <Disclosure summary="지출 항목 보기" variant="plain" className="mt-3" bodyClassName="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3">
          {pnl.lines.map((l) => (
            <ExpenseItems key={l.line} title={l.label} items={l.expenseByCategory} />
          ))}
          <ExpenseItems title="공통" items={pnl.commonExpenseByCategory} />
          <ExpenseItems title="손익에 넣지 않는 지출" items={pnl.nonOperatingByCategory} />
        </Disclosure>
      )}

      <p className="mt-3 text-xs text-gray-500">
        기준: 매출은 부가세 포함 순매출이고(월 입주 이용료는 부가세를 따로 나누지 않았습니다), 지출은 부가세 포함 금액으로 적습니다 — 둘 다 부가세를 빼지 않은 금액이라
        세무상 이익과는 다릅니다. 연습실 매출은 월 입주(입주해 있는 달마다 월 이용료) · 연습실 시간제 예약 · 연습실 월 이용료 카드 구독입니다.
        플랫폼 매출은 정산 몫을 뺀 수수료이고, <strong>결제 대행(PG) 수수료는 빼지 않은 금액</strong>입니다(수수료 기록이 DB에 없습니다).
        결제 링크는 링크에 고른 분야(없으면 녹음·제작, 결제 링크 목록에서 바꿀 수 있어요), 직접 받은 매출은 고른 분야(없으면 유형, 아래 목록에서 바꿀 수 있어요)로 셉니다. 지출은 이번 달까지만 셉니다(앞으로 올 달의 반복 지출은 아직 넣지 않아요).
      </p>
    </section>
  );
};

export default function AdminRevenuePage({ summary, type, line = null, years, nowYear, nowMonth, entryDates, today, manualEntries, manualError, pnl = null, pnlNotice = null, lessonError = null, error }: RevenuePageProps) {
  const inProgress = summary !== null && summary.year === nowYear && (summary.month === 'all' || summary.month === nowMonth);

  return (
    <>
      <Head>
        <title>매출 현황 | Studio NOL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <AdminShell title="매출 현황" description="결제 승인 기준 순매출(환불 제외)입니다. 세무 자료는 대시보드의 토스 결제 장부를 쓰세요." width="wide">
        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {summary && (
          <>
            <section className="rounded-2xl bg-white p-4 shadow-sm md:p-6">
              <div className="flex flex-wrap items-center gap-2">
                {years.map((y) => (
                  <FilterPill key={y} active={y === summary.year} href={href(y, summary.month === 'all' ? 'all' : summary.month, type, line)}>
                    {y}년
                  </FilterPill>
                ))}
                <span className="mx-1 hidden h-5 w-px bg-gray-200 md:inline-block" />
                <FilterPill active={summary.month === 'all'} href={href(summary.year, 'all', type, line)}>
                  연 전체
                </FilterPill>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <FilterPill key={m} active={summary.month === m} href={href(summary.year, m, type, line)}>
                    {m}월
                  </FilterPill>
                ))}
              </div>
              {(type || line) && (
                <p className="mt-3 text-sm text-gray-700">
                  <strong>{[line ? BUSINESS_LINE_LABELS[line] : null, type ? REVENUE_TYPE_LABELS[type] : null].filter(Boolean).join(' · ')}</strong>만 보는 중 ·{' '}
                  <Link href={href(summary.year, summary.month, null)} className="text-primary hover:underline">
                    전체 보기
                  </Link>
                </p>
              )}
            </section>

            {manualError && (
              <Notice tone="warning" light>
                {manualError}
              </Notice>
            )}

            {lessonError && (
              <Notice tone="warning" light>
                {lessonError}
              </Notice>
            )}

            {inProgress && (
              <Notice tone="info" light>
                {summary.periodLabel}은(는) 아직 진행 중입니다. 전기({summary.previousLabel}) 대비 증감은 전기 전체와 견준 값이라 기간이 끝나기 전에는 낮게 나옵니다.
              </Notice>
            )}

            {pnl && <BusinessPnlSection pnl={pnl} summary={summary} />}

            <section>
              <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-gray-900">{summary.periodLabel}</h2>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Kpi label="순매출 (부가세 포함)" value={won(summary.totals.net)} sub={<Delta rate={summary.changeRate} label={`${summary.previousLabel} 대비`} />} />
                <Kpi label="결제 총액" value={won(summary.totals.gross)} sub={<p className="mt-1 text-xs text-gray-500">{summary.totals.count}건</p>} />
                <Kpi
                  label="환불"
                  value={summary.totals.refunded > 0 ? `-${won(summary.totals.refunded)}` : '0원'}
                  sub={<p className="mt-1 text-xs text-gray-500">전액 환불 {summary.totals.fullyRefundedCount}건</p>}
                />
                <Kpi
                  label="객단가 (순매출 ÷ 유지된 건)"
                  value={won(summary.totals.count - summary.totals.fullyRefundedCount > 0 ? Math.round(summary.totals.net / (summary.totals.count - summary.totals.fullyRefundedCount)) : 0)}
                />
                <Kpi label="공급가액" value={won(summary.totals.netSupply)} />
                <Kpi label="부가세" value={won(summary.totals.netVat)} />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                펀딩·공연·상점은 개설자·주최자·아티스트에게 정산해 줄 몫을 뺀 <strong>플랫폼 수수료</strong>만 매출로 잡습니다(펀딩·공연 5.5%, 상점은 아티스트 상품 판매가의 45%·스튜디오 상품 전액).
                결제(PG) 수수료는 비용이라 매출에서 더하거나 빼지 않고, 정산 기록의 실제 금액과는 반올림·부분 환불에서 몇 원 다를 수 있습니다.
              </p>
            </section>

            {pnlNotice && (
              <Notice tone="warning" light>
                {pnlNotice}
              </Notice>
            )}

            <section className="rounded-2xl bg-white p-4 shadow-sm md:p-8">
              <h2 className="mb-1 text-lg font-bold text-gray-900 dark:text-gray-900">
                {summary.year}년 월별 순매출{[line ? BUSINESS_LINE_LABELS[line] : null, type ? REVENUE_TYPE_LABELS[type] : null].filter(Boolean).map((label) => ` · ${label}`).join('')}
              </h2>
              <p className="mb-4 text-xs text-gray-500">전년 같은 달과 나란히 봅니다.</p>
              <MonthlyChart summary={summary} type={type} />
            </section>

            <BreakdownTable
              title="유형별"
              note="유형 이름을 누르면 그 유형만 모아 봅니다."
              firstColumn="유형"
              lines={summary.byType}
              linkFor={(entry) => href(summary.year, summary.month, type === entry.key ? null : entry.key, line)}
              activeKey={type}
            />

            {summary.byProject.length > 0 && (
              <BreakdownTable title="펀딩 프로젝트별" note="플랫폼 수수료 몫입니다(개설자에게 정산할 몫은 뺐어요). 계좌 입금·수기 등록 후원을 포함합니다." firstColumn="프로젝트" lines={summary.byProject} />
            )}

            <BreakdownTable title="결제수단별" firstColumn="결제수단" lines={summary.byMethod} />

            <section className="rounded-2xl bg-white p-4 shadow-sm md:p-8">
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-900">결제 내역</h2>
                <a href={csvHref(summary)} className="text-sm font-medium text-primary hover:underline">
                  이 기간 장부 CSV 내려받기
                </a>
                <a href={payoutCsvHref(summary)} className="text-sm font-medium text-primary hover:underline">
                  이 기간 상점·공연 정산 CSV
                </a>
              </div>
              <p className="mb-4 text-xs text-gray-500">
                최근순 {Math.min(summary.entriesTotal, ENTRY_LIMIT)}건 / 전체 {summary.entriesTotal}건. 이름·연락처는 싣지 않습니다. CSV 장부는 계좌 입금·수기 펀딩을 담지 않으니 펀딩은 펀딩 CSV를 함께 받으세요.
              </p>
              {summary.entries.length === 0 ? (
                <p className="text-sm text-gray-600">이 기간에는 결제가 없습니다.</p>
              ) : (
                <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                        <th className="py-2 pr-3 font-medium">승인</th>
                        <th className="px-3 py-2 font-medium">주문번호</th>
                        <th className="px-3 py-2 font-medium">유형</th>
                        <th className="px-3 py-2 font-medium">수단</th>
                        <th className="px-3 py-2 text-right font-medium">결제</th>
                        <th className="px-3 py-2 text-right font-medium">환불</th>
                        <th className="py-2 pl-3 text-right font-medium">순액</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 tabular-nums">
                      {summary.entries.map((row, index) => (
                        <tr key={`${row.orderNo}-${index}`}>
                          <td className="whitespace-nowrap py-2 pr-3 text-gray-700">{entryDates[index]}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-gray-900">{row.orderNo}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-gray-700">
                            {REVENUE_TYPE_LABELS[row.type] ?? row.type}
                            {row.projectSlug ? ` · ${row.projectSlug}` : ''}
                            {row.note ? ` · ${row.note}` : ''}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-gray-700">{row.method}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right text-gray-700">
                            {won(row.gross)}
                            {row.sourceGross !== undefined && <div className="text-xs text-gray-400">결제 {won(row.sourceGross)}</div>}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right text-gray-700">{row.refunded > 0 ? `-${won(row.refunded)}` : '-'}</td>
                          <td className="whitespace-nowrap py-2 pl-3 text-right font-semibold text-gray-900">{won(Math.max(0, row.gross - row.refunded))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <ManualRevenuePanel
              today={today}
              types={Object.entries(MANUAL_TYPES).map(([value, label]) => ({ value, label }))}
              methods={[...MANUAL_METHODS]}
              entries={manualEntries}
              periodLabel={line ? `${summary.periodLabel} · ${BUSINESS_LINE_LABELS[line]}` : summary.periodLabel}
              unavailable={manualError ?? undefined}
            />

            <Notice tone="neutral" light title="집계 기준">
              결제 승인 시각(KST) 기준이고, 환불은 완료된 건만 같은 주문에 합산해 뺍니다(기간 밖에서 환불한 것도 포함). 직접 받은 매출 기록은 받은 날 0시(KST) 기준이고, 토스 결제 장부 CSV에는 들어가지 않습니다. 계좌 입금으로 확정된 예약·믹싱·공연·상점은 입금 확인 시각이 승인 시각입니다.
              결제 기록이 없는 계좌 입금·수기 펀딩은 후원 확정 시각 기준이고 환불은 전액 환불 상태일 때만 뺍니다(부분 환불은 기록이 없어 반영하지 못합니다). 운영자 결제 테스트(smoke-test)와 0원 주문은 뺍니다.
            </Notice>
          </>
        )}
      </AdminShell>
    </>
  );
}
