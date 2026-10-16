import { randomBytes } from 'node:crypto';

import { inArray, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { getSupportedArtist } from '../../data/artists';
import {
  fundingCreators, partnerPayoutAdjustments,
  type PartnerPayout, type PartnerPayoutAdjustment,
} from '../../db/schema';
import { loadBusinessProfile } from '../funding/businessProfile';
import { kstDateString } from '../booking/kst';
import { kstMonthRange } from '../shop/artistPayout';
import { listShopArtistSales, type AdminShopArtistSalesRow } from '../shop/adminQueries';
import { loadShopArtistTermsStatuses } from '../shop/artistTermsAgreement';
import { isMissingTableError } from '../dbErrors';
import { listAllUnappliedAdjustments } from './adjustments';
import { computeShopPayoutCalc } from './shopCalc';
import { listPartnerPayouts } from './store';
import { syncShopLateRefundAdjustments } from './shopLateRefund';

/**
 * 상점 아티스트 월 정산 — 미리보기·기록(`docs/settlement-record-design-2026-10.md` §3·§5·§6).
 * 정산 단위는 **아티스트 × 달(KST)**. 집계는 `listShopArtistSales`(관리자 "아티스트 정산 예정" 표)를 그대로 쓰고,
 * 계산은 `computeShopArtistPayout`(+ 이월 조정, `shopCalc.ts`), 기록·지급·취소는 `partner_payouts`다.
 *
 * 펀딩 정산(`lib/funding/payout.ts`)과 같은 틀이다: 막는 조건(blockers)을 미리보기가 계산해 화면에 보이고, 기록은 같은 조건을 다시 본다.
 * 계좌·주민등록번호는 **존재 여부만** 읽는다 — 값은 props로 나가지 않는다(계좌는 개설자 단위 열람 라우트에서 버튼으로만).
 */

export type ShopPayoutTaxType = 'withholding' | 'invoice';

export type ShopPayoutBlocker =
  | 'no_tax_type'
  | 'no_payout_account'
  | 'business_profile_unavailable'
  | 'no_business_number'
  | 'terms_not_agreed'
  | 'already_recorded'
  | 'nothing_to_pay';

/** 막지는 않지만 운영자가 알아야 하는 것. 주민등록번호는 지급명세서 때 필요하지 송금에는 불필요해 경고다(설계 §6). */
export type ShopPayoutWarning = 'no_resident_number' | 'needs_review_orders' | 'withdrawable_orders' | 'creator_missing';

export interface ShopPayoutPreview {
  subjectKey: string;
  period: string;
  payeeName: string;
  /** DB 개설자면 그 id. `file:<slug>`는 null(계좌 열람 버튼이 없다). */
  creatorId: string | null;
  taxType: ShopPayoutTaxType | null;
  itemCount: number;
  salesAmount: number;
  shippingAmount: number;
  shippingOrderCount: number;
  storeAmount: number;
  vatDeductionAmount: number;
  shareAmount: number;
  withholdingAmount: number;
  /** 이번 기록에 실릴 조정(아직 어느 정산에도 안 실린 것). */
  adjustments: PartnerPayoutAdjustment[];
  /** 위 조정의 합(부호 있음, 아티스트 몫 기준). */
  adjustmentAmount: number;
  /** 몫이 모자라 다음 정산으로 넘길 음수(0 이하). */
  carryOverAmount: number;
  netAmount: number;
  needsReviewOrderNos: string[];
  withdrawableOrderCount: number;
  blockers: ShopPayoutBlocker[];
  warnings: ShopPayoutWarning[];
  /** 이미 기록된 정산. 있으면 그 값이 정본이고 위 숫자는 참고용이다(기록 뒤 환불이 들어오면 둘이 갈린다). */
  recorded: PartnerPayout | null;
  /** 기록된 정산에 실려 있는 조정. */
  appliedAdjustments: PartnerPayoutAdjustment[];
}

interface CreatorFacts {
  id: string;
  name: string;
  taxType: ShopPayoutTaxType | null;
  hasPayoutAccount: boolean;
  hasResidentNumber: boolean;
}

const isCreatorKey = (key: string): boolean => key.startsWith('creator:') && key.length > 'creator:'.length;
const isFileKey = (key: string): boolean => key.startsWith('file:') && key.length > 'file:'.length;
export const isValidShopSubjectKey = (key: string): boolean => isCreatorKey(key) || isFileKey(key);

const taxOrNull = (v: string | null | undefined): ShopPayoutTaxType | null => (v === 'withholding' || v === 'invoice' ? v : null);

const loadCreatorFacts = async (ids: readonly string[]): Promise<Map<string, CreatorFacts>> => {
  const out = new Map<string, CreatorFacts>();
  if (ids.length === 0) return out;
  const rows = await getDb()
    .select({
      id: fundingCreators.id, name: fundingCreators.name, taxType: fundingCreators.taxType,
      payoutAccountEnc: fundingCreators.payoutAccountEnc, residentNumberEnc: fundingCreators.residentNumberEnc,
    })
    .from(fundingCreators)
    .where(inArray(fundingCreators.id, [...ids]));
  for (const r of rows) {
    out.set(r.id, {
      id: r.id, name: r.name, taxType: taxOrNull(r.taxType),
      hasPayoutAccount: Boolean(r.payoutAccountEnc?.trim()), hasResidentNumber: Boolean(r.residentNumberEnc?.trim()),
    });
  }
  return out;
};

const groupBy = <T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T[]> => {
  const out = new Map<string, T[]>();
  for (const item of items) out.set(keyOf(item), [...(out.get(keyOf(item)) ?? []), item]);
  return out;
};

/**
 * 한 달의 정산 미리보기들. `keys`를 주면 그 대상만(없는 대상은 결과에서 빠진다), 비우면 **그 달에 판 아티스트 + 그 달 기록이 있는 아티스트** 전부.
 * 표(0066)가 없으면 던진다 — 호출부가 `isMissingTableError`로 "표 미적용" 안내를 띄운다.
 */
const assemblePreviews = async (period: string, keys?: readonly string[]): Promise<ShopPayoutPreview[]> => {
  if (!kstMonthRange(period)) return [];
  const [salesRows, recordedAll, adjustmentsAll] = await Promise.all([
    listShopArtistSales(period),
    listPartnerPayouts('shop', period),
    listAllUnappliedAdjustments('shop'),
  ]);
  const sales = new Map<string, AdminShopArtistSalesRow>(salesRows.map((r) => [r.artistSlug, r]));
  const recorded = new Map<string, PartnerPayout>(recordedAll.map((p) => [p.subjectKey, p]));
  const adjustments = groupBy(adjustmentsAll, (a) => a.payeeKey);

  const wanted = keys ? [...new Set(keys)] : [...new Set([...sales.keys(), ...recorded.keys()])];
  const creatorIds = wanted.filter(isCreatorKey).map((k) => k.slice('creator:'.length));
  const creators = await loadCreatorFacts(creatorIds);
  const terms = await loadShopArtistTermsStatuses(creatorIds);

  // 기록된 정산에 실린 조정 — 한 번에.
  const recordedIds = wanted.map((k) => recorded.get(k)?.id).filter((id): id is string => Boolean(id));
  const appliedRows = recordedIds.length > 0
    ? await getDb().select().from(partnerPayoutAdjustments).where(inArray(partnerPayoutAdjustments.appliedPayoutId, recordedIds))
    : [];
  const appliedByPayout = groupBy(appliedRows, (a) => a.appliedPayoutId ?? '');

  // 사업자 정보는 사업자(invoice) 개설자만 읽는다 — 원천징수 정산은 이 표(0058)가 없어도 영향이 없어야 한다.
  const businessByCreator = new Map<string, Awaited<ReturnType<typeof loadBusinessProfile>>>();
  await Promise.all(wanted.filter(isCreatorKey).map(async (key) => {
    const id = key.slice('creator:'.length);
    if (creators.get(id)?.taxType === 'invoice') businessByCreator.set(id, await loadBusinessProfile(id));
  }));

  const previews: ShopPayoutPreview[] = [];
  for (const key of wanted) {
    const row = sales.get(key) ?? null;
    const rec = recorded.get(key) ?? null;
    const creatorId = isCreatorKey(key) ? key.slice('creator:'.length) : null;
    const creator = creatorId ? creators.get(creatorId) ?? null : null;
    const artist = isFileKey(key) ? getSupportedArtist(key.slice('file:'.length)) : null;
    // 수취인을 아는 근거가 하나도 없는 키(없는 개설자·data/artists에 없는 slug)는 기록 행이 있을 때만 이름을 스냅샷에서 쓴다.
    if (!creator && !artist && !rec && !row) continue;
    const taxType = creator ? creator.taxType : (artist ? taxOrNull(artist.taxType) : null) ?? taxOrNull(row?.taxType);
    const payeeName = creator?.name ?? artist?.name ?? row?.artistName ?? rec?.payeeName ?? key;
    const unapplied = adjustments.get(key) ?? [];
    const adjustmentAmount = unapplied.reduce((s, a) => s + a.amount, 0);

    const salesAmount = row?.salesAmount ?? 0;
    const shippingAmount = row?.shippingAmount ?? 0;
    const calc = computeShopPayoutCalc({ salesAmount, shippingAmount, taxType: taxType ?? 'withholding', adjustmentAmount });

    const blockers: ShopPayoutBlocker[] = [];
    const warnings: ShopPayoutWarning[] = [];
    if (rec) blockers.push('already_recorded');
    if (!taxType) blockers.push('no_tax_type');
    if (creatorId) {
      if (!creator) warnings.push('creator_missing');
      if (creator && !creator.hasPayoutAccount) blockers.push('no_payout_account');
      if (creator && taxType === 'invoice') {
        const profile = businessByCreator.get(creator.id);
        if (profile === 'unavailable' || profile === undefined) blockers.push('business_profile_unavailable');
        else if (profile === null) blockers.push('no_business_number');
      }
      if (creator && terms.get(creator.id)?.state !== 'agreed') blockers.push('terms_not_agreed');
      if (creator && taxType === 'withholding' && !creator.hasResidentNumber) warnings.push('no_resident_number');
    }
    const hasSales = (row?.quantity ?? 0) > 0 || shippingAmount > 0;
    if (!hasSales && !rec) blockers.push('nothing_to_pay');
    if (row && row.needsReviewOrderNos.length > 0) warnings.push('needs_review_orders');
    if (row && row.withdrawableOrderCount > 0) warnings.push('withdrawable_orders');
    // 개설자 행이 없는 `creator:` 키는 계좌·약관을 확인할 수 없으니 막는다(없는 사람에게 기록하지 않는다).
    if (creatorId && !creator && !blockers.includes('no_payout_account')) blockers.push('no_payout_account');

    previews.push({
      subjectKey: key, period, payeeName, creatorId: creator ? creator.id : null, taxType,
      itemCount: row?.quantity ?? 0, salesAmount, shippingAmount, shippingOrderCount: row?.shippingOrderCount ?? 0,
      storeAmount: calc.storeAmount, vatDeductionAmount: calc.vatDeductionAmount, shareAmount: calc.shareAmount,
      withholdingAmount: calc.withholdingAmount,
      adjustments: unapplied, adjustmentAmount: calc.adjustmentAmount, carryOverAmount: calc.carryOverAmount, netAmount: calc.netAmount,
      needsReviewOrderNos: row?.needsReviewOrderNos ?? [], withdrawableOrderCount: row?.withdrawableOrderCount ?? 0,
      blockers, warnings, recorded: rec, appliedAdjustments: rec ? appliedByPayout.get(rec.id) ?? [] : [],
    });
  }
  return previews.sort((a, b) => a.payeeName.localeCompare(b.payeeName, 'ko'));
};

/** 한 달의 모든 상점 정산 미리보기 — `/admin/shop` 표. */
export const buildShopPayoutPreviews = (period: string): Promise<ShopPayoutPreview[]> => assemblePreviews(period);

/** 한 대상의 정산 미리보기. 형식이 틀리거나 수취인을 알 수 없으면 null. */
export const buildShopPayoutPreview = async (subjectKey: string, period: string): Promise<ShopPayoutPreview | null> => {
  if (!isValidShopSubjectKey(subjectKey) || !kstMonthRange(period)) return null;
  return (await assemblePreviews(period, [subjectKey]))[0] ?? null;
};

export type RecordShopPayoutResult =
  | { ok: true; payout: PartnerPayout }
  | { ok: false; code: 'invalid' | 'not_found' | ShopPayoutBlocker | 'amount_changed' | 'adjustments_changed'; blockers?: ShopPayoutBlocker[]; expectedNetAmount?: number; netAmount?: number };

/** 화면이 운영자에게 보여 주고 확인받은 금액. 서버는 이 값을 기록하지 않고 다시 계산한 값과 대조만 한다. */
export interface ExpectedShopPayoutAmounts {
  netAmount: number;
  adjustmentAmount: number;
}

const newId = (): string => randomBytes(16).toString('hex');

/**
 * 미리보기 숫자를 그 시점에 고정해 기록한다. (아티스트, 달)당 한 번 — UNIQUE가 두 번째 INSERT를 막는다(`already_recorded`).
 *
 * 한 batch(= 한 트랜잭션)에서 ① 기록 INSERT(미리보기가 본 미적용 조정의 개수·합이 그대로일 때만) ② 그 조정들을 이 기록에 싣기(`applied_payout_id`)
 * ③ 음수 이월이 있으면 새 조정(`carryover:<기록 id>`) 으로 남기기를 한다. 도중에 조정이 늘거나 다른 기록이 가져갔으면 ①이 0행이라 아무것도 안 바뀐다(`adjustments_changed`).
 *
 * 기록 직전에 이 대상의 정산 뒤 환불 조정을 한 번 더 만든다(`syncShopLateRefundAdjustments`) — 환불 직후 조정 INSERT가 실패했더라도 여기서 메워진다.
 * 거부 사유는 `blockers`와 같은 코드다. 계좌는 존재만 보고 열어 보지 않는다(펀딩 정산의 복호화 점검은 상점에는 넣지 않았다 — 열어 보는 것은 이체할 때다).
 */
export const recordShopPayout = async (
  subjectKey: string,
  period: string,
  now: Date,
  expected: ExpectedShopPayoutAmounts,
): Promise<RecordShopPayoutResult> => {
  if (!isValidShopSubjectKey(subjectKey) || !kstMonthRange(period)) return { ok: false, code: 'invalid' };
  // 조정 보충은 최선 노력이다 — 실패해도 기록 자체를 막지 않는다(표가 없으면 아래 미리보기가 던진다).
  await syncShopLateRefundAdjustments({ subjectKey }).catch((error: unknown) => {
    if (!isMissingTableError(error)) console.error('[partner-payouts] 기록 전 환불 조정 보충 실패', { subjectKey, error });
  });
  const preview = await buildShopPayoutPreview(subjectKey, period);
  if (!preview) return { ok: false, code: 'not_found' };
  if (preview.blockers.length > 0) {
    return { ok: false, code: preview.blockers[0], blockers: preview.blockers };
  }
  if (!preview.taxType) return { ok: false, code: 'no_tax_type' };
  if (preview.netAmount !== expected.netAmount || preview.adjustmentAmount !== expected.adjustmentAmount) {
    return { ok: false, code: 'amount_changed', expectedNetAmount: expected.netAmount, netAmount: preview.netAmount };
  }

  const db = getDb();
  const id = newId();
  const sec = Math.floor(now.getTime() / 1000);
  const picked = preview.adjustments.map((a) => a.id);
  const pickedSum = preview.adjustmentAmount;
  const carry = preview.carryOverAmount;
  const unappliedUnchanged = sql`(SELECT COUNT(*) FROM partner_payout_adjustments WHERE kind = 'shop' AND payee_key = ${subjectKey} AND applied_payout_id IS NULL) = ${picked.length}
    AND (SELECT COALESCE(SUM(amount), 0) FROM partner_payout_adjustments WHERE kind = 'shop' AND payee_key = ${subjectKey} AND applied_payout_id IS NULL) = ${pickedSum}`;
  const payoutExists = sql`EXISTS (SELECT 1 FROM partner_payouts WHERE id = ${id})`;

  const statements = [
    db.run(sql`
      INSERT INTO partner_payouts (
        id, kind, subject_key, period, creator_id, payee_name, tax_type,
        gross_amount, refund_amount, shipping_amount, platform_fee_amount, payment_fee_amount, studio_amount,
        vat_deduction_amount, share_amount, withholding_amount, adjustment_amount, shortfall_amount, net_amount, item_count,
        status, created_at, updated_at)
      SELECT ${id}, 'shop', ${subjectKey}, ${period}, ${preview.creatorId}, ${preview.payeeName}, ${preview.taxType},
        ${preview.salesAmount}, 0, ${preview.shippingAmount}, 0, 0, ${preview.storeAmount},
        ${preview.vatDeductionAmount}, ${preview.shareAmount}, ${preview.withholdingAmount}, ${pickedSum}, ${-carry}, ${preview.netAmount}, ${preview.itemCount},
        'pending', ${sec}, ${sec}
      WHERE ${unappliedUnchanged}
    `),
    ...(picked.length > 0
      ? [db.run(sql`
          UPDATE partner_payout_adjustments SET applied_payout_id = ${id}
          WHERE id IN (${sql.join(picked.map((p) => sql`${p}`), sql`, `)}) AND applied_payout_id IS NULL AND ${payoutExists}
        `)]
      : []),
    ...(carry < 0
      ? [db.run(sql`
          INSERT INTO partner_payout_adjustments (id, kind, payee_key, amount, reason, source_ref, memo, created_at)
          SELECT ${newId()}, 'shop', ${subjectKey}, ${carry}, 'manual', ${`carryover:${id}`}, ${`${period} 정산에서 몫이 모자라 넘어온 음수 이월`}, ${sec}
          WHERE ${payoutExists}
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
  const [saved] = await listPartnerPayouts('shop', period).then((rows) => rows.filter((p) => p.id === id));
  if (!saved) return { ok: false, code: 'adjustments_changed' };
  return { ok: true, payout: saved };
};

/** 달(KST 'YYYY-MM')을 한 칸 옮긴다. */
const shiftMonth = (month: string, delta: number): string => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

/**
 * 상점 정산을 기록하기 시작한 달. 이보다 앞선 달은 "기록 대기"로 세지 않는다 — 이 시스템 전에는 판매가 없었고(`SHOP_SALES_OPEN`),
 * 있었더라도 운영자가 손으로 이체한 달을 영원히 독촉하지 않으려는 하한이다.
 */
export const SHOP_PAYOUT_RECORD_FROM_MONTH = '2026-10';
/** 대시보드가 거슬러 보는 최대 달 수(달마다 판매 집계를 한 번 돈다). */
const AWAITING_RECORD_MAX_MONTHS = 12;

/**
 * **이번 달 이전**의 달 가운데 판매가 있었는데 정산이 기록되지 않은 (아티스트, 달) 쌍 — 대시보드 「정산 기록 대기(상점)」.
 * 이번 달은 아직 판매가 끝나지 않았으니 세지 않는다. 표(0066)가 없거나 조회가 실패하면 던진다(대시보드가 0으로 삼킨다).
 */
export const listShopPayoutsAwaitingRecord = async (now: Date): Promise<Array<{ subjectKey: string; payeeName: string; period: string }>> => {
  const current = kstDateString(now).slice(0, 7);
  const months: string[] = [];
  for (let m = shiftMonth(current, -1); m >= SHOP_PAYOUT_RECORD_FROM_MONTH && months.length < AWAITING_RECORD_MAX_MONTHS; m = shiftMonth(m, -1)) months.push(m);
  if (months.length === 0) return [];
  const recorded = await getDb().all<{ subject_key: string; period: string }>(sql`
    SELECT subject_key, period FROM partner_payouts WHERE kind = 'shop' AND period IN (${sql.join(months.map((m) => sql`${m}`), sql`, `)})
  `);
  const done = new Set(recorded.map((r) => `${r.period}|${r.subject_key}`));
  const perMonth = await Promise.all(months.map(async (period) => ({ period, rows: await listShopArtistSales(period) })));
  const out: Array<{ subjectKey: string; payeeName: string; period: string }> = [];
  for (const { period, rows } of perMonth) {
    for (const r of rows) {
      if (r.quantity <= 0 && r.shippingAmount <= 0) continue;
      if (done.has(`${period}|${r.artistSlug}`)) continue;
      out.push({ subjectKey: r.artistSlug, payeeName: r.artistName, period });
    }
  }
  return out;
};
