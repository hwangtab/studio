import { and, gte, isNotNull, lt } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingPledges, payments } from '../../db/schema';
import { BUSINESS_LINE_LABELS, BUSINESS_LINES, lineOfRow, lineOfSessionService, parseBusinessLine, type BusinessLine } from './businessLine';
import { assignDepositLines } from './businessLineStore';
import { reclassifyLessonSubscriptions } from './lessonRevenue';
import { applyPlatformFees } from './platformFee';

/**
 * 관리자 매출 현황의 집계 — 결제 장부(`salesLedger.ts`)와 **같은 모집단·같은 환불 규칙**에,
 * 장부가 싣지 못하는 계좌 입금·수기 펀딩을 더한다.
 *
 * ## 모집단
 * 1. **승인 기록이 있는 결제**(`payments.approvedAt`) — 토스 결제와, 입금 확인으로 결제 행을 남기는
 *    예약·믹싱·공연·상점의 계좌 입금. 기준 시각은 승인 시각이다(주문 생성 시각이 아니다).
 * 2. **결제 행이 없는 펀딩** — 계좌 입금 후원과 관리자 수기 등록. 이 둘은 `payments`를 남기지 않아
 *    장부 CSV에서 빠진다(CLAUDE.md "펀딩 CSV에 있다"). 기준 시각은 `funding_pledges.paid_at`.
 *    환불 행(`refunds`)이 결제 행에 매달려 있어 이 돈의 환불은 **상태가 `refunded`일 때만** 전액으로
 *    친다 — 부분 환불은 기록이 없어 반영하지 못한다(화면에 그렇게 적는다).
 *
 * ## 금액
 * 환불은 done만, 기간 밖 환불도 같은 결제에 합산한다(장부와 같다). 순액을 원래 비율로 부가세·공급가액에
 * 나눈다 — 합이 순액과 정확히 맞는다.
 *
 * 개인정보는 읽지도 싣지도 않는다(이름·연락처 없음) — 그래서 접속기록 대상이 아니다.
 */

export const REVENUE_TYPE_LABELS: Record<string, string> = {
  session: '세션 예약',
  mixing: '믹싱·마스터링',
  // 제작 계약(싱글·EP·정규, production_contracts) — 입금 기록으로 집계한다(productionRevenue.ts).
  production: '음원 제작',
  subscription: '구독',
  // 프로듀싱 레슨 — 카드 구독 결제(레슨 구독의 주문)와 계좌·현금 수납(lesson_payments)을 한 유형으로(lessonRevenue.ts).
  lesson: '프로듀싱 레슨',
  deposit: '예약금',
  software: '소프트웨어',
  // 연습실 월 입주(room_tenancies, 발생 기준) — 결제 행이 없어 tenancyRevenue.ts가 따로 읽는다.
  tenancy: '연습실 월 입주',
  // 펀딩·공연·상점은 **플랫폼 수수료 몫**만 매출이다(platformFee.ts).
  funding: '펀딩 수수료',
  ticket: '공연 수수료',
  merch: '상점 수수료',
  other: '기타',
};

export type RevenueGroup = 'direct' | 'brokered';

/**
 * 직접 서비스 = 스튜디오가 제공한 용역의 대가. 판매·중개 = 개설자·주최자·아티스트에게 정산하는 돈이 섞인 결제 중
 * **스튜디오 몫(플랫폼 수수료)** 만 매출로 센다(platformFee.ts) — 정산해 줄 돈까지 올리면 매출이 부풀어 보인다.
 */
export const REVENUE_GROUP_OF: Record<string, RevenueGroup> = {
  session: 'direct',
  mixing: 'direct',
  production: 'direct',
  subscription: 'direct',
  lesson: 'direct',
  deposit: 'direct',
  software: 'direct',
  tenancy: 'direct',
  funding: 'brokered',
  ticket: 'brokered',
  merch: 'brokered',
  other: 'direct',
};

export const REVENUE_GROUP_LABELS: Record<RevenueGroup, string> = {
  direct: '스튜디오 직접 서비스',
  brokered: '판매·중개 수수료 (정산 몫 제외)',
};

/** 운영자 결제 검증용 프로젝트 — 건수·금액에 섞이지 않게 뺀다(content/funding/smoke-test.md). */
const EXCLUDED_FUNDING_SLUGS = ['smoke-test'];

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export interface RevenueRow {
  at: Date;
  orderNo: string;
  type: string;
  /** 펀딩 프로젝트 slug. 펀딩이 아니면 null. */
  projectSlug: string | null;
  method: string;
  /** 승인 당시 합계(부가세 포함). */
  gross: number;
  vat: number;
  /** done 환불 합. */
  refunded: number;
  /** true = 결제 행이 없는 계좌 입금·수기 펀딩·수기 매출. */
  offline: boolean;
  /** 판매·중개 행이 수수료 몫으로 바뀐 경우 원래 결제액(부가세 포함)과 적용 비율. 화면이 "결제액 → 수수료"를 보인다. */
  sourceGross?: number;
  feeRate?: number;
  /** 수기 매출(`manual_revenues`) 행의 id. 있으면 화면에서 환불·삭제를 할 수 있다. */
  manualId?: string;
  /** 수기 매출의 내용. */
  note?: string;
  memo?: string | null;
  /**
   * 사업 분야(lib/ops/businessLine.ts). 비어 있으면 유형의 기본 분야 — 연습실 예약·연습실/아티스트 구독·분야를 고른 결제 링크와
   * 수기 매출만 채운다.
   */
  line?: BusinessLine;
}

export interface Totals {
  count: number;
  /** 전액 환불되어 순액이 0인 건수. */
  fullyRefundedCount: number;
  gross: number;
  refunded: number;
  net: number;
  netVat: number;
  netSupply: number;
}

export interface BreakdownLine extends Totals {
  key: string;
  label: string;
  /** 순매출 중 비중(%). 전체 순매출이 0이면 null. */
  share: number | null;
}

export interface MonthPoint {
  month: number;
  net: number;
  previousYearNet: number;
  count: number;
}

export interface RevenueSummary {
  year: number;
  month: number | 'all';
  periodLabel: string;
  previousLabel: string;
  totals: Totals;
  previous: Totals;
  /** 전기 대비 순매출 증감(%). 전기가 0이면 null. */
  changeRate: number | null;
  monthly: MonthPoint[];
  byType: BreakdownLine[];
  byGroup: Array<{ group: RevenueGroup; label: string; totals: Totals }>;
  /** 사업 분야별(연습실·녹음·제작·플랫폼·기타) — 유형·분야 필터와 무관하게 그 기간 전체. 지출·수익은 businessLinePnl이 더한다. */
  byLine: Array<{ line: BusinessLine; label: string; totals: Totals }>;
  /** 보고 있는 분야 필터(없으면 null). */
  line: BusinessLine | null;
  byProject: BreakdownLine[];
  byMethod: BreakdownLine[];
  entries: RevenueRow[];
  entriesTotal: number;
}

export const ENTRY_LIMIT = 200;

const emptyTotals = (): Totals => ({ count: 0, fullyRefundedCount: 0, gross: 0, refunded: 0, net: 0, netVat: 0, netSupply: 0 });

/** 한 행의 순액·순부가세. 부가세는 반올림, 공급가액은 나머지(합이 순액과 정확히 맞는다). */
export const netOfRow = (row: Pick<RevenueRow, 'gross' | 'vat' | 'refunded'>) => {
  const net = Math.max(0, row.gross - row.refunded);
  const netVat = row.gross > 0 ? Math.round((row.vat * net) / row.gross) : 0;
  return { net, netVat, netSupply: net - netVat };
};

const addRow = (totals: Totals, row: RevenueRow): void => {
  const { net, netVat, netSupply } = netOfRow(row);
  totals.count += 1;
  if (net === 0) totals.fullyRefundedCount += 1;
  totals.gross += row.gross;
  totals.refunded += Math.min(row.refunded, row.gross);
  totals.net += net;
  totals.netVat += netVat;
  totals.netSupply += netSupply;
};

const sumRows = (rows: RevenueRow[]): Totals => {
  const totals = emptyTotals();
  for (const row of rows) addRow(totals, row);
  return totals;
};

/** KST 달력의 (년, 월, 일) 0시 → UTC Date. 월은 1~12(범위를 넘으면 Date.UTC가 이월한다). */
const kstDate = (year: number, month: number, day = 1): Date => new Date(Date.UTC(year, month - 1, day) - KST_OFFSET_MS);

export const kstYearMonth = (at: Date): { year: number; month: number } => {
  const shifted = new Date(at.getTime() + KST_OFFSET_MS);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1 };
};

export interface PeriodRange {
  from: Date;
  toExclusive: Date;
}

export const periodRange = (year: number, month: number | 'all'): PeriodRange =>
  month === 'all'
    ? { from: kstDate(year, 1), toExclusive: kstDate(year + 1, 1) }
    : { from: kstDate(year, month), toExclusive: kstDate(year, month + 1) };

/** 비교 기간 — 월이면 전월, 연 전체면 전년. */
export const previousPeriod = (year: number, month: number | 'all'): { year: number; month: number | 'all' } =>
  month === 'all' ? { year: year - 1, month: 'all' } : month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };

const labelOf = (year: number, month: number | 'all') => (month === 'all' ? `${year}년 전체` : `${year}년 ${month}월`);

/** 읽어야 하는 전체 범위 — 비교 기간이 전년이므로 (year-1)년 1월부터 year년 12월까지. */
export const loadWindow = (year: number): PeriodRange => ({ from: kstDate(year - 1, 1), toExclusive: kstDate(year + 1, 1) });

const inRange = (row: RevenueRow, range: PeriodRange) => row.at >= range.from && row.at < range.toExclusive;

const breakdown = (rows: RevenueRow[], keyOf: (row: RevenueRow) => string, labelFor: (key: string) => string): BreakdownLine[] => {
  const map = new Map<string, Totals>();
  for (const row of rows) {
    const key = keyOf(row);
    const totals = map.get(key) ?? emptyTotals();
    addRow(totals, row);
    map.set(key, totals);
  }
  const netSum = [...map.values()].reduce((sum, t) => sum + t.net, 0);
  return [...map.entries()]
    .map(([key, totals]) => ({ key, label: labelFor(key), share: netSum > 0 ? (totals.net / netSum) * 100 : null, ...totals }))
    .sort((a, b) => b.net - a.net || b.gross - a.gross || a.key.localeCompare(b.key));
};

export interface SummarizeOptions {
  year: number;
  month: number | 'all';
  /** 유형 필터(드릴다운). 유형별 표는 항상 (분야 안의) 전체 유형을 보여 주고, 나머지는 이 유형만 센다. */
  type?: string | null;
  /** 분야 필터(드릴다운). 분야별 표는 항상 전체 분야를 보여 주고, 나머지(유형별 표 포함)는 이 분야만 센다. */
  line?: string | null;
}

export const summarizeRevenue = (allRows: RevenueRow[], options: SummarizeOptions): RevenueSummary => {
  const { year, month } = options;
  const range = periodRange(year, month);
  const prev = previousPeriod(year, month);
  const prevRange = periodRange(prev.year, prev.month);

  const periodEvery = allRows.filter((row) => inRange(row, range));
  const lineFilter = parseBusinessLine(options.line);
  const inLine = (row: RevenueRow) => (lineFilter ? lineOfRow(row) === lineFilter : true);
  const periodAll = periodEvery.filter(inLine);
  const typeFilter = options.type && Object.hasOwn(REVENUE_TYPE_LABELS, options.type) ? options.type : null;
  const matches = (row: RevenueRow) => inLine(row) && (typeFilter ? row.type === typeFilter : true);

  const period = periodAll.filter(matches);
  const totals = sumRows(period);
  const previous = sumRows(allRows.filter((row) => inRange(row, prevRange) && matches(row)));

  const monthly: MonthPoint[] = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, net: 0, previousYearNet: 0, count: 0 }));
  for (const row of allRows) {
    if (!matches(row)) continue;
    const { year: y, month: m } = kstYearMonth(row.at);
    const slot = monthly[m - 1];
    if (y === year) {
      slot.net += netOfRow(row).net;
      slot.count += 1;
    } else if (y === year - 1) {
      slot.previousYearNet += netOfRow(row).net;
    }
  }

  const groupTotals = new Map<RevenueGroup, RevenueRow[]>();
  for (const row of period) {
    const group = REVENUE_GROUP_OF[row.type] ?? 'direct';
    groupTotals.set(group, [...(groupTotals.get(group) ?? []), row]);
  }

  const sorted = [...period].sort((a, b) => b.at.getTime() - a.at.getTime());

  return {
    year,
    month,
    periodLabel: labelOf(year, month),
    previousLabel: labelOf(prev.year, prev.month),
    totals,
    previous,
    changeRate: previous.net > 0 ? ((totals.net - previous.net) / previous.net) * 100 : null,
    monthly,
    byType: breakdown(periodAll, (row) => row.type, (key) => REVENUE_TYPE_LABELS[key] ?? key),
    byGroup: (['direct', 'brokered'] as const).map((group) => ({
      group,
      label: REVENUE_GROUP_LABELS[group],
      totals: sumRows(groupTotals.get(group) ?? []),
    })),
    byLine: BUSINESS_LINES.map((line) => ({
      line,
      label: BUSINESS_LINE_LABELS[line],
      totals: sumRows(periodEvery.filter((row) => lineOfRow(row) === line)),
    })),
    line: lineFilter,
    byProject: breakdown(period.filter((row) => row.projectSlug), (row) => row.projectSlug as string, (key) => key),
    byMethod: breakdown(period, (row) => row.method || '미상', (key) => key),
    entries: sorted.slice(0, ENTRY_LIMIT),
    entriesTotal: sorted.length,
  };
};

/**
 * 창 안의 결제를 한 행씩 읽는다. 한 주문에 결제 행이 둘 이상이면 **가장 이른 승인**을 기준으로 한 행만
 * 만들고 환불은 모든 결제 행에서 합친다(장부는 결제 행마다 주문 합계를 싣는다 — 여기서는 금액이 곱해지지 않게 한다).
 */
export const loadRevenueRows = async (range: PeriodRange): Promise<RevenueRow[]> => {
  const db = getDb();

  const paid = await db.query.payments.findMany({
    where: and(isNotNull(payments.approvedAt), gte(payments.approvedAt, range.from), lt(payments.approvedAt, range.toExclusive)),
    with: { refunds: true, order: { with: { fundingPledge: true, bookings: { columns: { serviceType: true } } } } },
  });

  const byOrder = new Map<string, RevenueRow>();
  for (const payment of paid) {
    const order = payment.order;
    if (order.totalAmount <= 0) continue;
    const slug = order.type === 'funding' ? (order.fundingPledge?.projectSlug ?? null) : null;
    if (slug && EXCLUDED_FUNDING_SLUGS.includes(slug)) continue;
    const refunded = payment.refunds.filter((r) => r.status === 'done').reduce((sum, r) => sum + r.amount, 0);
    const at = payment.approvedAt as Date;
    const existing = byOrder.get(order.id);
    if (existing) {
      existing.refunded += refunded;
      if (at < existing.at) existing.at = at;
      continue;
    }
    // 세션 예약은 예약의 서비스 종류로 연습실/녹음·제작을 가른다(lib/booking/line.ts와 같은 판정). 예약 행이 없으면 기본(녹음·제작).
    const sessionLine = order.type === 'session' ? lineOfSessionService(order.bookings[0]?.serviceType) : null;
    byOrder.set(order.id, {
      at,
      orderNo: order.orderNo,
      type: order.type,
      projectSlug: slug,
      method: payment.method ?? '미상',
      gross: order.totalAmount,
      vat: order.vatAmount,
      refunded,
      offline: false,
      ...(sessionLine ? { line: sessionLine } : {}),
    });
  }

  // 결제 행이 없는 펀딩(계좌 입금·수기 등록). 위에서 읽은 주문과 겹치지 않게 결제 행 유무로 가른다.
  const pledges = await db.query.fundingPledges.findMany({
    where: and(isNotNull(fundingPledges.paidAt), gte(fundingPledges.paidAt, range.from), lt(fundingPledges.paidAt, range.toExclusive)),
    with: { order: { with: { payments: true } } },
  });
  for (const pledge of pledges) {
    const order = pledge.order;
    if (order.payments.length > 0 || byOrder.has(order.id)) continue;
    if (!['paid', 'partially_refunded', 'refunded'].includes(order.status)) continue;
    if (order.totalAmount <= 0 || EXCLUDED_FUNDING_SLUGS.includes(pledge.projectSlug)) continue;
    byOrder.set(order.id, {
      at: pledge.paidAt as Date,
      orderNo: order.orderNo,
      type: 'funding',
      projectSlug: pledge.projectSlug,
      method: pledge.entrySource === 'manual' ? '수기 등록' : '계좌 입금',
      gross: order.totalAmount,
      vat: order.vatAmount,
      refunded: order.status === 'refunded' ? order.totalAmount : 0,
      offline: true,
    });
  }

  return applyPlatformFees(await assignDepositLines(await reclassifyLessonSubscriptions([...byOrder.values()])));
};
