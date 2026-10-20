import React from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import { AdminShell } from '../../components/admin/AdminShell';
import { ManualRevenuePanel, type ManualRevenueView } from '../../components/admin/ManualRevenuePanel';
import { Notice } from '../../components/ui/Notice';
import { kstDateString } from '../../lib/booking/kst';
import { loadManualRevenueRows, MANUAL_METHODS } from '../../lib/ops/manualRevenue';
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
  type Totals,
} from '../../lib/ops/revenueReport';
import { loadProductionRevenueRows } from '../../lib/ops/productionRevenue';

/**
 * 매출 현황 — 월·연 단위 순매출, 전기 대비, 월별 추이, 유형·펀딩 프로젝트·결제수단별 구성.
 *
 * 모집단·환불 규칙은 lib/ops/revenueReport.ts 머리 주석. 이름·연락처는 읽지 않으므로 접속기록
 * 대상이 아니다. 세무용 원장은 기존 토스 결제 장부 CSV(대시보드)가 그대로 정본이다.
 */

interface RevenuePageProps {
  summary: RevenueSummary | null;
  type: string | null;
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
  const years = Array.from({ length: now.year - FIRST_YEAR + 1 }, (_, i) => now.year - i);
  const today = kstDateString(new Date());
  const base = { type, years, nowYear: now.year, nowMonth: now.month, today };

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
    const summary = summarizeRevenue(rows, { year, month, type });
    const range = periodRange(year, month);
    const manualEntries: ManualRevenueView[] = rows
      .filter((row) => row.manualId && row.at >= range.from && row.at < range.toExclusive)
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .map((row) => ({
        id: row.manualId as string,
        receivedOn: kstDateString(row.at),
        typeLabel: REVENUE_TYPE_LABELS[row.type] ?? row.type,
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
      },
    };
  } catch (error: unknown) {
    console.error('[admin/revenue] 집계 실패:', error);
    return { props: { ...base, summary: null, entryDates: [], manualEntries: [], manualError: null, error: '매출을 불러오지 못했습니다. 잠시 뒤 다시 열어 주세요.' } };
  }
};

const won = (value: number) => `${value.toLocaleString('ko-KR')}원`;

/** 차트 축·막대 밑 표기 — 만원 단위로 줄인다(백만 단위 이상은 소수 한 자리). */
const compactWon = (value: number): string => {
  if (value === 0) return '0';
  const man = value / 10000;
  return man >= 1000 ? `${(man / 10000).toFixed(1)}억` : `${Math.round(man).toLocaleString('ko-KR')}만`;
};

const href = (year: number, month: number | 'all', type: string | null) => {
  const params = new URLSearchParams({ year: String(year), month: String(month) });
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
    <p className="mt-1 text-xl font-bold text-gray-900 tabular-nums md:text-2xl">{value}</p>
    {sub}
  </div>
);

const MonthlyChart = ({ summary, type }: { summary: RevenueSummary; type: string | null }) => {
  const peak = Math.max(1, ...summary.monthly.flatMap((m) => [m.net, m.previousYearNet]));
  return (
    <div>
      <div className="flex h-44 items-end gap-1 md:gap-2" role="img" aria-label={`${summary.year}년 월별 순매출 막대 그래프`}>
        {summary.monthly.map((point) => {
          const selected = summary.month === point.month;
          return (
            <Link
              key={point.month}
              href={href(summary.year, point.month, type)}
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
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
              <th className="py-2 pr-3 font-medium">{firstColumn}</th>
              <th className="px-3 py-2 text-right font-medium">건수</th>
              <th className="px-3 py-2 text-right font-medium">결제</th>
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

const GroupCard = ({ label, totals }: { label: string; totals: Totals }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4">
    <p className="text-sm text-gray-500">{label}</p>
    <p className="mt-1 text-lg font-bold text-gray-900 tabular-nums">{won(totals.net)}</p>
    <p className="mt-0.5 text-xs text-gray-500">{totals.count}건</p>
  </div>
);

export default function AdminRevenuePage({ summary, type, years, nowYear, nowMonth, entryDates, today, manualEntries, manualError, error }: RevenuePageProps) {
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
                  <Link
                    key={y}
                    href={href(y, summary.month === 'all' ? 'all' : summary.month, type)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium ${y === summary.year ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    {y}년
                  </Link>
                ))}
                <span className="mx-1 hidden h-5 w-px bg-gray-200 md:inline-block" />
                <Link
                  href={href(summary.year, 'all', type)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ${summary.month === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  연 전체
                </Link>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <Link
                    key={m}
                    href={href(summary.year, m, type)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium ${summary.month === m ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    {m}월
                  </Link>
                ))}
              </div>
              {type && (
                <p className="mt-3 text-sm text-gray-700">
                  <strong>{REVENUE_TYPE_LABELS[type]}</strong>만 보는 중 ·{' '}
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

            {inProgress && (
              <Notice tone="info" light>
                {summary.periodLabel}은(는) 아직 진행 중입니다. 전기({summary.previousLabel}) 대비 증감은 전기 전체와 견준 값이라 기간이 끝나기 전에는 낮게 나옵니다.
              </Notice>
            )}

            <section>
              <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-gray-900">{summary.periodLabel}</h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                {summary.byGroup.map((g) => (
                  <GroupCard key={g.group} label={g.label} totals={g.totals} />
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                펀딩·공연·상점은 개설자·주최자·아티스트에게 정산하는 몫이 들어 있는 결제액입니다. 스튜디오가 가져가는 수수료가 아니므로 직접 서비스와 나눠 봅니다.
              </p>
            </section>

            <section className="rounded-2xl bg-white p-4 shadow-sm md:p-8">
              <h2 className="mb-1 text-lg font-bold text-gray-900 dark:text-gray-900">{summary.year}년 월별 순매출</h2>
              <p className="mb-4 text-xs text-gray-500">전년 같은 달과 나란히 봅니다.</p>
              <MonthlyChart summary={summary} type={type} />
            </section>

            <BreakdownTable
              title="유형별"
              note="유형 이름을 누르면 그 유형만 모아 봅니다."
              firstColumn="유형"
              lines={summary.byType}
              linkFor={(line) => href(summary.year, summary.month, type === line.key ? null : line.key)}
              activeKey={type}
            />

            {summary.byProject.length > 0 && (
              <BreakdownTable title="펀딩 프로젝트별" note="후원 총액(개설자 정산 전)입니다. 계좌 입금·수기 등록 후원을 포함합니다." firstColumn="프로젝트" lines={summary.byProject} />
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
                <div className="overflow-x-auto">
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
                        <tr key={row.orderNo}>
                          <td className="whitespace-nowrap py-2 pr-3 text-gray-700">{entryDates[index]}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-gray-900">{row.orderNo}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-gray-700">
                            {REVENUE_TYPE_LABELS[row.type] ?? row.type}
                            {row.projectSlug ? ` · ${row.projectSlug}` : ''}
                            {row.note ? ` · ${row.note}` : ''}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-gray-700">{row.method}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right text-gray-700">{won(row.gross)}</td>
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
              types={Object.entries(REVENUE_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
              methods={[...MANUAL_METHODS]}
              entries={manualEntries}
              periodLabel={summary.periodLabel}
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
