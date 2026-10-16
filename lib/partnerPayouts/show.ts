import { randomBytes } from 'node:crypto';

import { and, eq, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { FUNDING_PAYOUT_BUSINESS_DAYS } from '../funding/policy';
import { businessDaysAfter } from '../funding/payout';
import { loadBusinessProfile } from '../funding/businessProfile';
import { fundingCreators, partnerPayoutAdjustments, type PartnerPayout, type PartnerPayoutAdjustment } from '../../db/schema';
import { isMissingTableError } from '../dbErrors';
import { computeShowPayoutCalc } from './showCalc';
import { SHOW_CANCEL_WAIVE_PREFIX, showCancelPayeeKey, syncShowtimeCancelFee } from './showCancelFee';
import { listAppliedAdjustments } from './adjustments';
import { findPartnerPayout } from './store';
import { parseAcknowledgedAmount } from './showOverpayment';

/**
 * 공연 주최자 정산 — 미리보기·기록(`docs/settlement-record-design-2026-10.md` §3·§5·§6).
 * 정산 단위는 **공연 1건 × 1회**(`partner_payouts`: kind 'show', subject_key = 공연 id, period 'all', creator_id = 주최자 — 보존·파기 코드가 보려면 필수).
 * 계산은 `computeShowPayoutCalc`(= 펀딩 정산 식), 기록·지급·취소는 `partner_payouts`(`store.ts`)다. 상점(`shop.ts`)과 같은 틀.
 *
 * - **주최자가 있는 공연만** 정산한다 — 승인된 제출물(`show_submissions.creator_id`)이 있는 공연. `data/shows/*.ts` 직영 공연은 `settleable = false`.
 * - 판매액 = 결제가 있는 공연 티켓 주문의 합계(초대권은 결제 행이 없고 0원이라 빠진다), 환불 = 그 주문들 결제의 완료(done) 환불 합.
 *   부분환불·회차 취소 전액 환불·계좌 입금 환불이 모두 같은 `refunds` 표에 기록되므로 그 합이 정본이다.
 * - 마지막 회차가 끝나야 기록할 수 있다(약관 제6조 "마지막 회차가 끝난 날부터 영업일 N일 이내"). 끝 = 시작 + 공연 길이, 전부 취소된 공연은 마지막 취소 시각.
 * - 계좌·주민등록번호는 **존재 여부만** 읽는다 — 값은 props로 나가지 않는다.
 */

export const SHOW_PAYOUT_PERIOD = 'all';

export type ShowPayoutTaxType = 'withholding' | 'invoice';

export type ShowPayoutBlocker =
  | 'no_tax_type'
  | 'no_payout_account'
  | 'business_profile_unavailable'
  | 'no_business_number'
  | 'terms_not_agreed'
  | 'not_ended'
  | 'already_recorded'
  | 'nothing_to_pay';

/** 막지는 않지만 운영자가 알아야 하는 것. */
export type ShowPayoutWarning =
  /** 주민등록번호 미등록 — 지급명세서 때 필요하지 송금에는 불필요(설계 §6). */
  | 'no_resident_number'
  /** 계좌 입금 환불을 받는 계좌는 접수됐는데 운영자가 아직 송금하지 않았다 — 돈은 안 나갔어도 환불 기록은 이미 판매액에서 빠져 있다. */
  | 'refund_account_pending'
  /** 취소된 회차인데 환불이 안 끝난 주문이 있다(계좌 입금 고객이 환불 계좌를 안 적음·토스 환불 실패) — 판매액에 아직 들어 있다. */
  | 'refund_due_cancelled'
  | 'creator_missing';

export interface ShowCancelFeeInfo {
  showtimeId: string;
  /** 주최자가 부담할 결제 수수료(양수). */
  amount: number;
  /** 스튜디오 귀책으로 면제했는가. */
  waived: boolean;
  /** 이미 어느 정산에 실렸는가 — 그러면 면제를 바꿀 수 없다. */
  applied: boolean;
}

export interface ShowPayoutPreview {
  showId: string;
  showTitle: string;
  /** 정산 대상인가. 직영 공연(주최자 없음)이면 false이고 아래 금액은 모두 0이다. */
  settleable: boolean;
  notSettleableReason: 'studio_direct' | null;
  creatorId: string | null;
  payeeName: string;
  taxType: ShowPayoutTaxType | null;
  /** 마지막 회차가 끝난 시각(epoch 초). 회차가 없으면 null. */
  lastEndAt: number | null;
  ended: boolean;
  /** 약관상 정산 기한 = 마지막 회차 종료 + 영업일 N일(epoch 초). */
  dueBy: number | null;
  itemCount: number;
  grossAmount: number;
  refundAmount: number;
  netSalesAmount: number;
  platformFeeAmount: number;
  paymentFeeAmount: number;
  vatDeductionAmount: number;
  shareAmount: number;
  withholdingAmount: number;
  /** 이번 기록에 실릴 조정(회차 취소 수수료·면제 상쇄) — 아직 어느 정산에도 안 실린 것. */
  adjustments: PartnerPayoutAdjustment[];
  /** 위 조정의 합(부호 있음). */
  adjustmentAmount: number;
  /** 정산금에서 뺀 조정(양수). */
  adjustmentOffsetAmount: number;
  /** 조정이 정산금을 넘어 못 뺀 금액 — 청구 협의(약관 제7조). */
  shortfallAmount: number;
  netAmount: number;
  cancelFees: ShowCancelFeeInfo[];
  refundAccountPendingCount: number;
  refundDueCancelledOrderCount: number;
  blockers: ShowPayoutBlocker[];
  warnings: ShowPayoutWarning[];
  /** 이미 기록된 정산. 있으면 그 값이 정본이고 위 숫자는 참고용이다. */
  recorded: PartnerPayout | null;
  appliedAdjustments: PartnerPayoutAdjustment[];
  /** 기록이 있을 때만: 기록 뒤 판매·환불이 바뀌어 지금 계산한 실지급액과의 차이. */
  recordedDelta: RecordedShowDelta | null;
}

/**
 * 기록된 정산(스냅샷) vs 지금 계산. 기록에 실린 조정과 세금 유형을 그대로 두고 판매·환불만 지금 값으로 다시 계산한다 —
 * 세금 유형 변경이나 새 조정이 섞이면 "환불 때문"이 아닌 차이가 초과 지급으로 읽힌다.
 * 초과 지급 = 기록 실지급 − 지금 실지급(양수일 때만; 지급 뒤 환불이 줄 몫을 줄였다). 부족 = 반대(지급 뒤 추가 판매 — 자동 처리하지 않고 보여만 준다).
 */
export interface RecordedShowDelta {
  currentNetAmount: number;
  overpaidAmount: number;
  underpaidAmount: number;
  /** 이미 처리 줄(`[회수 처리 N원`)로 덮인 합. */
  acknowledgedAmount: number;
  /** 기록 시각 이후 완료된 환불이 있는 주문(주문번호·환불 합). */
  lateRefundOrders: { orderNo: string; amount: number }[];
}

export const computeRecordedShowDelta = (
  recorded: Pick<PartnerPayout, 'taxType' | 'adjustmentAmount' | 'netAmount' | 'memo'>,
  sales: ShowSales,
): Omit<RecordedShowDelta, 'lateRefundOrders'> => {
  const calc = computeShowPayoutCalc({
    grossAmount: sales.grossAmount, refundAmount: sales.refundAmount,
    bankNetAmount: sales.bankGrossAmount - sales.bankRefundAmount,
    taxType: recorded.taxType === 'invoice' ? 'invoice' : 'withholding', adjustmentAmount: recorded.adjustmentAmount,
  });
  const diff = recorded.netAmount - calc.netAmount;
  return {
    currentNetAmount: calc.netAmount, overpaidAmount: Math.max(0, diff), underpaidAmount: Math.max(0, -diff),
    acknowledgedAmount: parseAcknowledgedAmount(recorded.memo),
  };
};

interface CreatorFacts {
  id: string;
  name: string;
  taxType: ShowPayoutTaxType | null;
  hasPayoutAccount: boolean;
  hasResidentNumber: boolean;
}

const taxOrNull = (v: string | null | undefined): ShowPayoutTaxType | null => (v === 'withholding' || v === 'invoice' ? v : null);

/** 공연 소속 주문(결제가 있는 티켓 주문) 조건 — 판매·환불 집계가 같은 문장을 쓴다. */
const paidShowOrderFilter = (showId: string) => sql`
  o.type = 'ticket' AND o.status IN ('paid', 'partially_refunded', 'refunded')
  AND EXISTS (SELECT 1 FROM show_orders so JOIN showtimes st ON st.id = so.showtime_id WHERE so.order_no = o.order_no AND st.show_id = ${showId})
  AND EXISTS (SELECT 1 FROM payments p0 WHERE p0.order_id = o.id)
`;

export interface ShowSales {
  grossAmount: number;
  refundAmount: number;
  bankGrossAmount: number;
  bankRefundAmount: number;
  itemCount: number;
}

export const loadShowSales = async (showId: string): Promise<ShowSales> => {
  const db = getDb();
  const [g] = await db.all<{ gross: number; bank_gross: number }>(sql`
    SELECT COALESCE(SUM(o.total_amount), 0) AS gross,
           COALESCE(SUM(CASE WHEN EXISTS (SELECT 1 FROM payments pb WHERE pb.order_id = o.id AND pb.payment_key LIKE 'bank-deposit:%') THEN o.total_amount ELSE 0 END), 0) AS bank_gross
    FROM orders o WHERE ${paidShowOrderFilter(showId)}
  `);
  const [r] = await db.all<{ refund: number; bank_refund: number }>(sql`
    SELECT COALESCE(SUM(rf.amount), 0) AS refund,
           COALESCE(SUM(CASE WHEN p.payment_key LIKE 'bank-deposit:%' THEN rf.amount ELSE 0 END), 0) AS bank_refund
    FROM refunds rf JOIN payments p ON p.id = rf.payment_id JOIN orders o ON o.id = p.order_id
    WHERE rf.status = 'done' AND ${paidShowOrderFilter(showId)}
  `);
  const [t] = await db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM show_tickets t JOIN orders o ON o.order_no = t.order_no
    WHERE t.issued_by = 'customer' AND t.unit_amount > 0 AND ${paidShowOrderFilter(showId)}
  `);
  return {
    grossAmount: Number(g?.gross ?? 0), refundAmount: Number(r?.refund ?? 0),
    bankGrossAmount: Number(g?.bank_gross ?? 0), bankRefundAmount: Number(r?.bank_refund ?? 0),
    itemCount: Number(t?.n ?? 0),
  };
};

/** 마지막 회차의 끝(epoch 초) — 취소되지 않은 회차 중 가장 늦은 시작 + 공연 길이. 전부 취소됐으면 마지막 취소(없으면 시작) 시각. 회차가 없으면 null. */
export const lastShowEndAt = (
  showtimes: ReadonlyArray<{ startsAt: number; status: string; cancelledAt: number | null }>,
  runningMinutes: number,
): number | null => {
  if (showtimes.length === 0) return null;
  const live = showtimes.filter((t) => t.status !== 'cancelled');
  if (live.length > 0) return Math.max(...live.map((t) => t.startsAt)) + Math.max(0, runningMinutes) * 60;
  return Math.max(...showtimes.map((t) => t.cancelledAt ?? t.startsAt));
};

const loadCreatorFacts = async (id: string): Promise<CreatorFacts | null> => {
  const [r] = await getDb()
    .select({
      id: fundingCreators.id, name: fundingCreators.name, taxType: fundingCreators.taxType,
      payoutAccountEnc: fundingCreators.payoutAccountEnc, residentNumberEnc: fundingCreators.residentNumberEnc,
    })
    .from(fundingCreators).where(eq(fundingCreators.id, id)).limit(1);
  if (!r) return null;
  return {
    id: r.id, name: r.name, taxType: taxOrNull(r.taxType),
    hasPayoutAccount: Boolean(r.payoutAccountEnc?.trim()), hasResidentNumber: Boolean(r.residentNumberEnc?.trim()),
  };
};

interface OrganizerFacts { creatorId: string; termsAgreed: boolean }

const loadOrganizer = async (showId: string): Promise<OrganizerFacts | null> => {
  try {
    const rows = await getDb().all<{ creator_id: string; terms_version: string | null }>(sql`
      SELECT creator_id, organizer_terms_version AS terms_version FROM show_submissions
      WHERE show_id = ${showId} AND review_status = 'approved' LIMIT 1
    `);
    if (!rows[0]) return null;
    // 승인 심사(review.ts)가 이미 "동의 기록 없음"을 거절한다 — 여기서는 방어선이다. 판본이 옛것이어도 동의한 계약은 유효하다(승인 때 굳는다).
    return { creatorId: rows[0].creator_id, termsAgreed: Boolean(rows[0].terms_version?.trim()) };
  } catch (error: unknown) {
    if (isMissingTableError(error, 'show_submissions')) return null;
    throw error;
  }
};

/** 이 공연이 싣는 조정의 키: 회차 취소 수수료(source_ref = 회차 id)와 면제 상쇄(`waive:<회차 id>`). 다른 공연의 조정은 같은 주최자여도 싣지 않는다. */
const relevantAdjustmentFilter = (creatorId: string, showtimeIds: readonly string[]) => {
  const waiveRefs = showtimeIds.map((id) => `${SHOW_CANCEL_WAIVE_PREFIX}${id}`);
  const list = (items: readonly string[]) => sql.join(items.map((i) => sql`${i}`), sql`, `);
  return sql`kind = 'show' AND payee_key = ${showCancelPayeeKey(creatorId)} AND (
    (reason = 'showtime_cancel_fee' AND source_ref IN (${list(showtimeIds.length > 0 ? showtimeIds : [''])}))
    OR (reason = 'manual' AND source_ref IN (${list(waiveRefs.length > 0 ? waiveRefs : [''])}))
  )`;
};

const countOf = async (query: ReturnType<typeof sql>, tableName?: string): Promise<number> => {
  try {
    const [row] = await getDb().all<{ n: number }>(query);
    return Number(row?.n ?? 0);
  } catch (error: unknown) {
    if (tableName && isMissingTableError(error, tableName)) return 0;
    throw error;
  }
};

/**
 * 한 공연의 정산 미리보기. 공연이 없으면 null. 표(0067)가 없으면 던진다 — 호출부가 `isMissingTableError`로 "표 미적용" 안내를 띄운다.
 * 이 함수는 **읽기만** 한다(조정 보충은 `syncShowCancelFees`가 따로).
 */
export const buildShowPayoutPreview = async (showId: string, now: Date = new Date()): Promise<ShowPayoutPreview | null> => {
  const db = getDb();
  const [show] = await db.all<{ id: string; title: string; running_minutes: number }>(sql`SELECT id, title, running_minutes FROM shows WHERE id = ${showId}`);
  if (!show) return null;
  const showtimeRows = await db.all<{ id: string; starts_at: number; status: string; cancelled_at: number | null }>(sql`
    SELECT id, starts_at, status, cancelled_at FROM showtimes WHERE show_id = ${showId}
  `);
  const showtimeIds = showtimeRows.map((s) => s.id);
  const lastEndAt = lastShowEndAt(
    showtimeRows.map((s) => ({ startsAt: Number(s.starts_at), status: s.status, cancelledAt: s.cancelled_at == null ? null : Number(s.cancelled_at) })),
    Number(show.running_minutes),
  );
  const nowSec = Math.floor(now.getTime() / 1000);
  const ended = lastEndAt !== null && nowSec >= lastEndAt;
  const dueBy = lastEndAt === null ? null : Math.floor(businessDaysAfter(new Date(lastEndAt * 1000), FUNDING_PAYOUT_BUSINESS_DAYS).getTime() / 1000);

  const base: ShowPayoutPreview = {
    showId, showTitle: show.title, settleable: false, notSettleableReason: null, creatorId: null, payeeName: '', taxType: null,
    lastEndAt, ended, dueBy, itemCount: 0, grossAmount: 0, refundAmount: 0, netSalesAmount: 0, platformFeeAmount: 0, paymentFeeAmount: 0,
    vatDeductionAmount: 0, shareAmount: 0, withholdingAmount: 0, adjustments: [], adjustmentAmount: 0, adjustmentOffsetAmount: 0,
    shortfallAmount: 0, netAmount: 0, cancelFees: [], refundAccountPendingCount: 0, refundDueCancelledOrderCount: 0,
    blockers: [], warnings: [], recorded: null, appliedAdjustments: [], recordedDelta: null,
  };

  const organizer = await loadOrganizer(showId);
  if (!organizer) return { ...base, notSettleableReason: 'studio_direct' };

  const creator = await loadCreatorFacts(organizer.creatorId);
  const taxType = creator?.taxType ?? null;
  const recorded = await findPartnerPayout('show', showId, SHOW_PAYOUT_PERIOD);
  const sales = await loadShowSales(showId);
  const payeeKey = showCancelPayeeKey(organizer.creatorId);

  // 조정 — 이 공연의 회차 것만. 미적용은 이번 기록에 실리고, 기록된 정산에 실린 것은 그 아래에 보인다.
  const allRelevant = await db.all<{ id: string }>(sql`SELECT id FROM partner_payout_adjustments WHERE ${relevantAdjustmentFilter(organizer.creatorId, showtimeIds)}`);
  const relevantIds = new Set(allRelevant.map((r) => r.id));
  const rows = relevantIds.size === 0 ? [] : await db.select().from(partnerPayoutAdjustments)
    .where(and(eq(partnerPayoutAdjustments.kind, 'show'), eq(partnerPayoutAdjustments.payeeKey, payeeKey)));
  const mine = rows.filter((a) => relevantIds.has(a.id));
  const unapplied = mine.filter((a) => a.appliedPayoutId === null).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  const adjustmentAmount = unapplied.reduce((s, a) => s + a.amount, 0);
  const appliedAdjustments = recorded ? await listAppliedAdjustments(recorded.id) : [];

  const cancelFees: ShowCancelFeeInfo[] = [];
  for (const id of showtimeIds) {
    const fee = mine.find((a) => a.reason === 'showtime_cancel_fee' && a.sourceRef === id);
    if (!fee) continue;
    cancelFees.push({
      showtimeId: id, amount: -fee.amount,
      waived: mine.some((a) => a.reason === 'manual' && a.sourceRef === `${SHOW_CANCEL_WAIVE_PREFIX}${id}`),
      applied: fee.appliedPayoutId !== null,
    });
  }

  const calc = computeShowPayoutCalc({
    grossAmount: sales.grossAmount, refundAmount: sales.refundAmount,
    bankNetAmount: sales.bankGrossAmount - sales.bankRefundAmount, taxType: taxType ?? 'withholding', adjustmentAmount,
  });

  const cancelledIds = showtimeRows.filter((s) => s.status === 'cancelled').map((s) => s.id);
  const refundAccountPendingCount = await countOf(sql`
    SELECT COUNT(*) AS n FROM refund_accounts ra
    WHERE ra.order_kind = 'show' AND ra.refunded_at IS NULL
      AND ra.order_no IN (SELECT so.order_no FROM show_orders so JOIN showtimes st ON st.id = so.showtime_id WHERE st.show_id = ${showId})
  `, 'refund_accounts');
  const refundDueCancelledOrderCount = cancelledIds.length === 0 ? 0 : await countOf(sql`
    SELECT COUNT(DISTINCT t.order_no) AS n FROM show_tickets t JOIN orders o ON o.order_no = t.order_no
    WHERE t.showtime_id IN (${sql.join(cancelledIds.map((i) => sql`${i}`), sql`, `)})
      AND t.issued_by = 'customer' AND t.status IN ('held', 'issued') AND t.checked_in_at IS NULL
      AND o.status IN ('paid', 'partially_refunded')
  `);

  const blockers: ShowPayoutBlocker[] = [];
  const warnings: ShowPayoutWarning[] = [];
  if (recorded) blockers.push('already_recorded');
  if (!ended) blockers.push('not_ended');
  if (!taxType) blockers.push('no_tax_type');
  if (!creator) {
    warnings.push('creator_missing');
    blockers.push('no_payout_account');
  } else {
    if (!creator.hasPayoutAccount) blockers.push('no_payout_account');
    if (taxType === 'invoice') {
      const profile = await loadBusinessProfile(creator.id);
      if (profile === 'unavailable') blockers.push('business_profile_unavailable');
      else if (profile === null) blockers.push('no_business_number');
    }
    if (taxType === 'withholding' && !creator.hasResidentNumber) warnings.push('no_resident_number');
  }
  if (!organizer.termsAgreed) blockers.push('terms_not_agreed');
  if (!recorded && calc.netAmount <= 0 && calc.adjustmentOffsetAmount <= 0 && calc.shortfallAmount <= 0) blockers.push('nothing_to_pay');
  if (refundAccountPendingCount > 0) warnings.push('refund_account_pending');
  if (refundDueCancelledOrderCount > 0) warnings.push('refund_due_cancelled');

  return {
    ...base,
    settleable: true, creatorId: creator?.id ?? null, payeeName: creator?.name ?? recorded?.payeeName ?? organizer.creatorId, taxType,
    itemCount: sales.itemCount,
    grossAmount: calc.grossAmount, refundAmount: calc.refundAmount, netSalesAmount: calc.netSalesAmount,
    platformFeeAmount: calc.platformFeeAmount, paymentFeeAmount: calc.paymentFeeAmount,
    vatDeductionAmount: calc.vatDeductionAmount, shareAmount: calc.shareAmount, withholdingAmount: calc.withholdingAmount,
    adjustments: unapplied, adjustmentAmount, adjustmentOffsetAmount: calc.adjustmentOffsetAmount, shortfallAmount: calc.shortfallAmount,
    netAmount: calc.netAmount, cancelFees, refundAccountPendingCount, refundDueCancelledOrderCount,
    blockers, warnings, recorded, appliedAdjustments,
    recordedDelta: recorded ? { ...computeRecordedShowDelta(recorded, sales), lateRefundOrders: await loadLateRefundOrders(showId, recorded.createdAt) } : null,
  };
};

/** 기록 시각 이후 완료된 환불이 있는 주문 — 회수 요청 때 어느 주문인지 보이게. 기록과 같은 초의 환불은 기록에 반영됐을 수 있어 뺀다(엄격히 이후). */
const loadLateRefundOrders = async (showId: string, recordedAt: Date): Promise<{ orderNo: string; amount: number }[]> => {
  const rows = await getDb().all<{ order_no: string; amount: number }>(sql`
    SELECT o.order_no AS order_no, SUM(rf.amount) AS amount
    FROM refunds rf JOIN payments p ON p.id = rf.payment_id JOIN orders o ON o.id = p.order_id
    WHERE rf.status = 'done' AND rf.created_at > ${Math.floor(recordedAt.getTime() / 1000)} AND ${paidShowOrderFilter(showId)}
    GROUP BY o.order_no ORDER BY MIN(rf.created_at), o.order_no
  `);
  return rows.map((r) => ({ orderNo: r.order_no, amount: Number(r.amount) }));
};

export interface OverpaidShowPayout { showId: string; slug: string; title: string; overpaidAmount: number; acknowledgedAmount: number; remainingAmount: number }

/**
 * **지급을 마친(paid) 공연 정산 가운데 지금 계산이 기록보다 작아 더 지급된 것** — 점검 메일의 소스. 처리 줄로 덮이지 않은 몫(`remainingAmount`)이 1원 이상인 것만.
 * 표(0067)가 없으면 던진다 — 호출부가 삼킨다.
 */
export const listOverpaidShowPayouts = async (): Promise<OverpaidShowPayout[]> => {
  const rows = await getDb().all<{ id: string }>(sql`SELECT subject_key AS id FROM partner_payouts WHERE kind = 'show' AND period = ${SHOW_PAYOUT_PERIOD} AND status = 'paid'`);
  const out: OverpaidShowPayout[] = [];
  for (const { id } of rows) {
    const recorded = await findPartnerPayout('show', id, SHOW_PAYOUT_PERIOD);
    if (!recorded) continue;
    const [show] = await getDb().all<{ slug: string; title: string }>(sql`SELECT slug, title FROM shows WHERE id = ${id}`);
    if (!show) continue;
    const d = computeRecordedShowDelta(recorded, await loadShowSales(id));
    const remainingAmount = Math.max(0, d.overpaidAmount - d.acknowledgedAmount);
    if (remainingAmount >= 1) out.push({ showId: id, slug: show.slug, title: show.title, overpaidAmount: d.overpaidAmount, acknowledgedAmount: d.acknowledgedAmount, remainingAmount });
  }
  return out;
};

/**
 * 이 공연의 취소된 회차마다 결제 수수료 조정을 맞춘다(없으면 만들고, 환불이 늘었으면 금액만 고친다). 최선 노력 — 한 회차의 실패가 나머지를 막지 않는다.
 * 표(0067)가 없으면 던진다.
 */
export const syncShowCancelFees = async (showId: string): Promise<void> => {
  const cancelled = await getDb().all<{ id: string }>(sql`SELECT id FROM showtimes WHERE show_id = ${showId} AND status = 'cancelled'`);
  for (const { id } of cancelled) {
    try {
      await syncShowtimeCancelFee(id);
    } catch (error: unknown) {
      if (isMissingTableError(error)) throw error;
      console.error('[partner-payouts] 회차 취소 결제 수수료 조정 보충 실패', { showId, showtimeId: id, error });
    }
  }
};

export type RecordShowPayoutResult =
  | { ok: true; payout: PartnerPayout }
  | { ok: false; code: 'not_found' | 'not_settleable' | 'amount_changed' | 'adjustments_changed' | ShowPayoutBlocker; blockers?: ShowPayoutBlocker[]; expectedNetAmount?: number; netAmount?: number };

/** 화면이 운영자에게 보여 주고 확인받은 금액. 서버는 이 값을 기록하지 않고 다시 계산한 값과 대조만 한다. */
export interface ExpectedShowPayoutAmounts {
  netAmount: number;
  adjustmentAmount: number;
}

const newId = (): string => randomBytes(16).toString('hex');

/**
 * 미리보기 숫자를 그 시점에 고정해 기록한다. 공연당 한 번 — UNIQUE(kind, subject_key, period)가 두 번째 INSERT를 막는다(`already_recorded`).
 * 한 batch(= 한 트랜잭션)에서 ① 기록 INSERT(미리보기가 본 이 공연의 미적용 조정 개수·합이 그대로일 때만) ② 그 조정들을 이 기록에 싣기.
 * 도중에 조정이 늘거나 다른 기록이 가져갔으면 ①이 0행이라 아무것도 안 바뀐다(`adjustments_changed`).
 * 기록 직전에 회차 취소 수수료 조정을 한 번 더 맞춘다(취소 직후 조정 생성이 실패했더라도 여기서 메워진다).
 * 거부 사유는 `blockers`와 같은 코드다. 계좌는 존재만 보고 열어 보지 않는다(열어 보는 것은 이체할 때다 — 상점과 같다).
 */
export const recordShowPayout = async (
  showId: string,
  now: Date,
  expected: ExpectedShowPayoutAmounts,
): Promise<RecordShowPayoutResult> => {
  await syncShowCancelFees(showId).catch((error: unknown) => {
    if (!isMissingTableError(error)) console.error('[partner-payouts] 기록 전 회차 취소 수수료 보충 실패', { showId, error });
  });
  const preview = await buildShowPayoutPreview(showId, now);
  if (!preview) return { ok: false, code: 'not_found' };
  if (!preview.settleable || !preview.creatorId) return { ok: false, code: 'not_settleable' };
  if (preview.blockers.length > 0) return { ok: false, code: preview.blockers[0], blockers: preview.blockers };
  if (!preview.taxType) return { ok: false, code: 'no_tax_type' };
  if (preview.netAmount !== expected.netAmount || preview.adjustmentAmount !== expected.adjustmentAmount) {
    return { ok: false, code: 'amount_changed', expectedNetAmount: expected.netAmount, netAmount: preview.netAmount };
  }

  const db = getDb();
  const id = newId();
  const sec = Math.floor(now.getTime() / 1000);
  const showtimeIds = (await db.all<{ id: string }>(sql`SELECT id FROM showtimes WHERE show_id = ${showId}`)).map((r) => r.id);
  const relevant = relevantAdjustmentFilter(preview.creatorId, showtimeIds);
  const picked = preview.adjustments.map((a) => a.id);
  const unappliedUnchanged = sql`(SELECT COUNT(*) FROM partner_payout_adjustments WHERE ${relevant} AND applied_payout_id IS NULL) = ${picked.length}
    AND (SELECT COALESCE(SUM(amount), 0) FROM partner_payout_adjustments WHERE ${relevant} AND applied_payout_id IS NULL) = ${preview.adjustmentAmount}`;
  const payoutExists = sql`EXISTS (SELECT 1 FROM partner_payouts WHERE id = ${id})`;

  const statements = [
    db.run(sql`
      INSERT INTO partner_payouts (
        id, kind, subject_key, period, creator_id, payee_name, tax_type,
        gross_amount, refund_amount, shipping_amount, platform_fee_amount, payment_fee_amount, studio_amount,
        vat_deduction_amount, share_amount, withholding_amount, adjustment_amount, shortfall_amount, net_amount, item_count,
        status, created_at, updated_at)
      SELECT ${id}, 'show', ${showId}, ${SHOW_PAYOUT_PERIOD}, ${preview.creatorId}, ${preview.payeeName}, ${preview.taxType},
        ${preview.grossAmount}, ${preview.refundAmount}, 0, ${preview.platformFeeAmount}, ${preview.paymentFeeAmount}, 0,
        ${preview.vatDeductionAmount}, ${preview.shareAmount}, ${preview.withholdingAmount}, ${preview.adjustmentAmount}, ${preview.shortfallAmount}, ${preview.netAmount}, ${preview.itemCount},
        'pending', ${sec}, ${sec}
      WHERE ${unappliedUnchanged}
    `),
    ...(picked.length > 0
      ? [db.run(sql`
          UPDATE partner_payout_adjustments SET applied_payout_id = ${id}
          WHERE id IN (${sql.join(picked.map((p) => sql`${p}`), sql`, `)}) AND applied_payout_id IS NULL AND ${payoutExists}
        `)]
      : []),
  ];
  try {
    await db.batch(statements as [typeof statements[number], ...typeof statements]);
  } catch (error) {
    // 유니크 위반 = 동시에 두 번 눌렀다(배치는 통째로 되돌아간다). 다른 오류면 그대로 올린다.
    if (String(error).includes('UNIQUE')) return { ok: false, code: 'already_recorded' };
    throw error;
  }
  const saved = await getDb().all<{ id: string }>(sql`SELECT id FROM partner_payouts WHERE id = ${id}`);
  if (saved.length === 0) return { ok: false, code: 'adjustments_changed' };
  const payout = await findPartnerPayout('show', showId, SHOW_PAYOUT_PERIOD);
  if (!payout) return { ok: false, code: 'adjustments_changed' };
  return { ok: true, payout };
};

export interface ShowAwaitingRecord { id: string; slug: string; title: string; endAt: Date }

/**
 * **마지막 회차가 끝났는데 정산이 아직 기록되지 않은 주최자 공연** — 대시보드 「정산 기록 대기(공연)」와 점검 메일의 기한 판정이 같은 목록을 쓴다.
 * 승인된 제출물이 있는 공연(직영 제외) 가운데 결제된 티켓 주문이 있고 `partner_payouts`(show) 행이 없는 것. 표(0067·0055)가 없으면 던진다 — 호출부가 0으로 삼킨다.
 * 끝 시각은 `lastShowEndAt`과 같은 규칙을 SQL로 적은 것이다(두 곳을 함께 바꿀 것).
 */
export const listShowPayoutsAwaitingRecord = async (now: Date): Promise<ShowAwaitingRecord[]> => {
  const nowSec = Math.floor(now.getTime() / 1000);
  const rows = await getDb().all<{ id: string; slug: string; title: string; end_at: number }>(sql`
    SELECT id, slug, title, end_at FROM (
      SELECT s.id AS id, s.slug AS slug, s.title AS title,
        COALESCE(
          (SELECT MAX(st.starts_at) FROM showtimes st WHERE st.show_id = s.id AND st.status <> 'cancelled') + s.running_minutes * 60,
          (SELECT MAX(COALESCE(st.cancelled_at, st.starts_at)) FROM showtimes st WHERE st.show_id = s.id)
        ) AS end_at
      FROM shows s
      WHERE EXISTS (SELECT 1 FROM show_submissions sub WHERE sub.show_id = s.id AND sub.review_status = 'approved')
        AND NOT EXISTS (SELECT 1 FROM partner_payouts pp WHERE pp.kind = 'show' AND pp.subject_key = s.id AND pp.period = ${SHOW_PAYOUT_PERIOD})
        AND EXISTS (
          SELECT 1 FROM orders o
          WHERE ${paidShowOrderFilterForShowRow()} AND o.total_amount > 0
        )
    ) WHERE end_at IS NOT NULL AND end_at <= ${nowSec}
    ORDER BY end_at
  `);
  return rows.map((r) => ({ id: r.id, slug: r.slug, title: r.title, endAt: new Date(Number(r.end_at) * 1000) }));
};

/** `paidShowOrderFilter`의 상관 서브쿼리 판(바깥 쿼리의 `s.id`를 본다). */
function paidShowOrderFilterForShowRow() {
  return sql`
    o.type = 'ticket' AND o.status IN ('paid', 'partially_refunded', 'refunded')
    AND EXISTS (SELECT 1 FROM show_orders so JOIN showtimes st2 ON st2.id = so.showtime_id WHERE so.order_no = o.order_no AND st2.show_id = s.id)
    AND EXISTS (SELECT 1 FROM payments p0 WHERE p0.order_id = o.id)
  `;
}
