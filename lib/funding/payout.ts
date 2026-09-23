import { and, eq, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { FUNDING_PLATFORM_FEE_PERCENT, FUNDING_PAYMENT_FEE_PERCENT, FUNDING_WITHHOLDING_PERCENT } from '../../data/pricing';
import { VAT_RATE } from '../booking/amounts';
import { fundingProjectPayouts, type FundingProjectPayout, type fundingCreatorTaxTypeEnum } from '../../db/schema';
import { computeProjectState } from './projectState';
import { liveFundingOrderStatusList } from './refundable';

export type FundingCreatorTaxType = (typeof fundingCreatorTaxTypeEnum)[number];

/**
 * 펀딩 프로젝트 정산(텀블벅 방식, 운영자 결정 2026-09-23) — 아티스트 구독 정산
 * (lib/artistSupport/payout.ts의 computeArtistPayout)과 같은 모양이지만 **계산 축이
 * 다르다**: 아티스트는 공급가(VAT 제외) 기준으로 수수료를 떼지만, 펀딩은 결제액
 * (gross − refund, VAT 포함) 기준으로 플랫폼 수수료와 결제 수수료를 각각 떼고
 * 둘 다 개설자가 부담한다.
 *
 * netGross  = max(0, gross − refund)
 * platformFee = round(netGross × 5.5%)               ← 부가세 포함
 * paymentFee  = round(netGross × 결제 수수료 계약 요율)
 * feeAmount   = platformFee + paymentFee              ← db/schema.ts fee_amount
 * supplyAmount = round(netGross / 1.1)                ← 부가세 제외 표시값(장부용) — shareAmount 계산에는 쓰이지 않는다
 * shareAmount  = netGross − feeAmount                 ← 개설자 몫(세전)
 * withholdingAmount = 원천징수 개설자면 round(shareAmount × 3.3%), 사업자(세금계산서)면 0
 * netAmount    = shareAmount − withholdingAmount      ← 실제 이체액
 *
 * 100만원 모금·환불 0·원천징수 개설자: platformFee 55,000 · paymentFee 33,000 →
 * feeAmount 88,000 → shareAmount 912,000 → withholdingAmount 30,096 → netAmount 881,904.
 */
export interface FundingPayoutBreakdown {
  grossAmount: number;
  refundAmount: number;
  supplyAmount: number;
  /** 플랫폼 수수료 + 결제 수수료. db/schema.ts fundingProjectPayouts.feeAmount에 대응. */
  feeAmount: number;
  /** feeAmount의 항목별 내역 — 관리자 화면·개설자 메일이 항목별로 보여줘야 한다. */
  platformFeeAmount: number;
  paymentFeeAmount: number;
  shareAmount: number;
  withholdingAmount: number;
  netAmount: number;
}

export const computeFundingPayout = (input: {
  grossAmount: number;
  refundAmount: number;
  taxType: FundingCreatorTaxType;
}): FundingPayoutBreakdown => {
  const netGross = Math.max(0, input.grossAmount - input.refundAmount);
  const platformFeeAmount = Math.round((netGross * FUNDING_PLATFORM_FEE_PERCENT) / 100);
  const paymentFeeAmount = Math.round((netGross * FUNDING_PAYMENT_FEE_PERCENT) / 100);
  const feeAmount = platformFeeAmount + paymentFeeAmount;
  const supplyAmount = Math.round(netGross / (1 + VAT_RATE));
  const shareAmount = netGross - feeAmount;
  const withholdingAmount = input.taxType === 'withholding' ? Math.round((shareAmount * FUNDING_WITHHOLDING_PERCENT) / 100) : 0;

  return {
    grossAmount: input.grossAmount,
    refundAmount: input.refundAmount,
    supplyAmount,
    feeAmount,
    platformFeeAmount,
    paymentFeeAmount,
    shareAmount,
    withholdingAmount,
    netAmount: shareAmount - withholdingAmount,
  };
};

/**
 * 수기 등록(`funding_pledges.entry_source = 'manual'`) 몫을 결제 수수료 대상에서 뺀 판.
 *
 * 수기 등록은 `pages/api/admin/funding/pledges/index.ts`가 orders + funding_pledges만
 * INSERT한다 — `payments` 행을 만들지 않고 `payment_method`도 'bank_transfer'다. 즉 그 돈은
 * 토스 결제창을 지나지 않았고 PG 수수료가 발생한 적이 없다. 결제 수수료는 결제 대행에
 * 대한 청구이므로, 결제가 없었던 금액에 그 요율을 매기면 개설자에게 근거 없는 공제가 된다.
 * 플랫폼 수수료는 그대로 뗀다 — 그쪽은 결제 경로가 아니라 모금 운영에 대한 몫이다.
 *
 * 환불은 따로 뺄 것이 없다. 환불 행(`refunds`)은 `payments`를 거쳐서만 달리므로 payments가
 * 없는 수기 등록에는 환불 기록이 생길 수 없다(운영자가 현금으로 돌려준 건은 주문 상태를
 * 바꿔 살아 있는 후원 집합에서 통째로 빠진다).
 */
export const computeFundingPayoutForProject = (input: {
  grossAmount: number;
  refundAmount: number;
  /** grossAmount 중 수기 등록 몫. */
  manualGrossAmount: number;
  taxType: FundingCreatorTaxType;
}): FundingPayoutBreakdown => {
  const base = computeFundingPayout(input);
  if (input.manualGrossAmount <= 0) return base;

  const netGross = Math.max(0, input.grossAmount - input.refundAmount);
  // 같은 식을 다시 적지 않는다 — 결제 수수료의 과세표준만 바꿔 computeFundingPayout에 태운다.
  const { paymentFeeAmount } = computeFundingPayout({
    grossAmount: Math.max(0, netGross - input.manualGrossAmount),
    refundAmount: 0,
    taxType: input.taxType,
  });
  const feeAmount = base.platformFeeAmount + paymentFeeAmount;
  const shareAmount = netGross - feeAmount;
  const withholdingAmount =
    input.taxType === 'withholding' ? Math.round((shareAmount * FUNDING_WITHHOLDING_PERCENT) / 100) : 0;

  return {
    ...base,
    paymentFeeAmount,
    feeAmount,
    shareAmount,
    withholdingAmount,
    netAmount: shareAmount - withholdingAmount,
  };
};

export interface FundingPayoutPreview extends FundingPayoutBreakdown {
  projectId: string;
  projectSlug: string;
  projectTitle: string;
  /**
   * 개설자의 세금 처리 구분. 아직 없으면(승인 전에는 비어 있다 — 스펙 §6.2) null이고,
   * 그 상태에서는 기록이 `no_tax_type`으로 거부된다. 위 금액들은 null일 때 **원천징수로
   * 가정해** 계산한 참고값이다 — 그 가정이 기록으로 남는 경로는 없다.
   */
  taxType: FundingCreatorTaxType | null;
  /** grossAmount 중 수기 등록 몫 — 결제 수수료에서 빠진 금액이라 화면이 이유를 적을 수 있어야 한다. */
  manualGrossAmount: number;
  /**
   * 확정 후원 **건수**. `aggregateProjectStatus`의 backerCount와 같은 것을 센다(사람 수가
   * 아니다) — 정산 기록의 숫자가 공개 페이지의 'N건 후원'과 달라 보이면 안 된다.
   */
  backerCount: number;
  /** 모금이 끝났는가(`computeProjectState`가 'closed'). 기록 버튼의 전제다. */
  closed: boolean;
  /** 개설자의 은행·계좌·예금주가 모두 있는가. **값은 싣지 않는다**(props가 __NEXT_DATA__로 나간다). */
  hasPayoutAccount: boolean;
  /**
   * 개설자의 주민등록번호가 등록돼 있는가. **암호문이 있는가만 본다** — 이 함수는 복호화하지
   * 않는다(키 없이도 미리보기가 떠야 하고, 값이 여기서 나가면 props로 새어 나간다).
   * 원천징수 대상인데 이 값이 없으면 기록이 `no_resident_number`로 거부된다.
   */
  hasResidentNumber: boolean;
  /** 이미 기록된 정산. 있으면 그 값이 정본이고 미리보기는 참고용이다. */
  recorded: FundingProjectPayout | null;
}

/**
 * 한 프로젝트의 정산 미리보기.
 *
 * **집계 기준은 공개 상세(`aggregateProjectStatus`)와 같다** — 같은
 * `LIVE_FUNDING_ORDER_STATUSES`(paid·partially_refunded) 집합, 같은
 * `orders ⋈ funding_pledges` 조인, 같은 `SUM(o.total_amount)`. 기준이 갈리면 공개 모금액과
 * 정산액이 어긋나고, 그건 개설자가 즉시 알아채는 종류의 사고다.
 *
 * 한 가지만 다르다: 환불을 **별도 항목으로 뺀다.** `aggregateProjectStatus`는 부분환불을
 * 차감하지 않는데(폴링 핫 경로라 payments·refunds 조인을 피한다 — 그 함수의 주석이 그렇게
 * 적고 있고, 오차가 상향이라 감수한다), 정산은 실제로 나갈 돈을 정하는 자리라 감수할 수
 * 없다. 그래서 `grossAmount`는 공개 모금액과 같은 수이고 환불은 `refundAmount`로 따로
 * 드러난다 — 두 숫자를 나란히 보여 주면 차이가 설명된다.
 *
 * 기록(`funding_project_payouts`)이 이미 있으면 함께 돌려준다. 있으면 그 값이 정본이고
 * 미리보기는 참고용이다(기록 뒤 환불이 들어오면 둘이 갈린다 — 화면이 그 차이를 보여준다).
 */
export const buildFundingPayoutPreview = async (projectId: string): Promise<FundingPayoutPreview | null> => {
  const db = getDb();
  const project = await db.query.fundingProjects.findFirst({
    where: (t, { eq: is }) => is(t.id, projectId),
  });
  if (!project) return null;
  const creator = await db.query.fundingCreators.findFirst({
    where: (t, { eq: is }) => is(t.id, project.creatorId),
  });
  if (!creator) return null;

  const rows = await db.all<{ amount: number; entry_source: string; refunded: number }>(sql`
    SELECT o.total_amount AS amount,
           fp.entry_source AS entry_source,
           COALESCE((
             SELECT SUM(r.amount) FROM refunds r
             JOIN payments p ON p.id = r.payment_id
             WHERE p.order_id = o.id AND r.status = 'done'
           ), 0) AS refunded
    FROM orders o JOIN funding_pledges fp ON fp.order_id = o.id
    WHERE fp.project_slug = ${project.slug} AND o.status IN (${liveFundingOrderStatusList()})
  `);

  const grossAmount = rows.reduce((s, r) => s + Number(r.amount), 0);
  const refundAmount = rows.reduce((s, r) => s + Number(r.refunded), 0);
  const manualGrossAmount = rows.filter((r) => r.entry_source === 'manual').reduce((s, r) => s + Number(r.amount), 0);

  const recorded =
    (await db.query.fundingProjectPayouts.findFirst({
      where: (t, { eq: is }) => is(t.projectId, projectId),
    })) ?? null;

  const taxType: FundingCreatorTaxType | null = creator.taxType ?? null;
  /**
   * 구분이 아직 없으면(승인 전에는 비어 있다 — 스펙 §6.2) **미리보기만** 원천징수로 가정해
   * 계산한다. 개인이 기본값이고 그쪽이 실이체액을 적게 잡는다 — 화면에 숫자를 아예 못
   * 띄우는 것보다 낫다. 기록은 `no_tax_type`으로 거부되므로 이 가정이
   * `funding_project_payouts`에 남을 수는 없다. 기록은 `preview.taxType`(null 가능)만 본다.
   */
  const assumedTaxType: FundingCreatorTaxType = taxType ?? 'withholding';

  return {
    projectId,
    projectSlug: project.slug,
    projectTitle: project.title,
    taxType,
    manualGrossAmount,
    backerCount: rows.length,
    closed:
      computeProjectState(
        { status: project.status, startAt: project.startAt.toISOString(), endAt: project.endAt.toISOString() },
        new Date(),
      ) === 'closed',
    hasPayoutAccount: Boolean(
      creator.payoutBankName?.trim() && creator.payoutAccount?.trim() && creator.payoutHolder?.trim(),
    ),
    hasResidentNumber: Boolean(creator.residentNumberEnc?.trim()),
    recorded,
    ...computeFundingPayoutForProject({ grossAmount, refundAmount, manualGrossAmount, taxType: assumedTaxType }),
  };
};

export type RecordFundingPayoutResult =
  | { ok: true; payout: FundingProjectPayout }
  | {
      ok: false;
      code:
        | 'not_found'
        | 'already_recorded'
        | 'nothing_to_pay'
        | 'not_closed'
        | 'no_payout_account'
        | 'no_tax_type'
        | 'no_resident_number';
    }
  /** 화면이 보여 준 실이체액과 지금 다시 계산한 값이 다르다. 두 금액을 함께 돌려준다. */
  | { ok: false; code: 'amount_changed'; expectedNetAmount: number; netAmount: number };

/**
 * 미리보기 숫자를 그 시점에 고정해 기록한다. 프로젝트당 한 번 — `project_id` UNIQUE가 두 번째
 * INSERT를 막고, 그 실패를 already_recorded로 돌려준다(경합에서도 안전).
 *
 * 거부 사유를 넷으로 가른다. 넷은 운영자가 할 일이 서로 다르다:
 * - `not_closed` — **모금이 아직 안 끝났다.** 진행 중에 기록하면 그 뒤 들어온 후원이 정산에서
 *   통째로 빠진다. 기다렸다 다시 누르면 된다.
 * - `no_payout_account` — 개설자의 계좌 정보가 없다. 보낼 곳 없는 정산을 기록하면 "기록은
 *   됐는데 돈은 안 갔다"가 영영 남는다. 개설자에게 계좌 등록을 요청해야 한다.
 * - `no_tax_type` — 개설자의 세금 처리 구분이 없다. 계좌만 있고 이 값이 비는 행이 실제로
 *   생긴다(운영자 직접 입력·이관). 추측해서 기록하면 사업자에게 원천징수를 떼고 보내게 되고,
 *   이 표는 불변이라 되돌릴 경로가 없다.
 * - `no_resident_number` — 원천징수 대상(`withholding`)인데 주민등록번호가 없다. 세액을 떼고
 *   보내 놓고 신고는 못 하는 상태가 된다 — 간이지급명세서가 소득자별 주민등록번호를 요구하기
 *   때문이다. 사업자(`invoice`)는 원천징수 자체를 하지 않으므로 이 조건에 걸리지 않는다.
 * - `nothing_to_pay` — 받은 돈이 없다. 할 일이 없다.
 * - `amount_changed` — 화면이 보여 준 실이체액과 지금 계산한 값이 다르다. 아래 `expectedNetAmount` 설명 참고.
 *
 * `expectedNetAmount`는 호출부(관리자 화면)가 **운영자에게 보여 주고 확인받은** 실이체액이다.
 * 이 함수는 미리보기를 다시 돌려 그 결과를 INSERT하므로, 페이지를 띄운 순간과 버튼을
 * 누른 순간 사이에 환불이 한 건 `done`이 되면 확인창과 기록이 갈라버린다 — 마감 뒤 정산까지
 * 영업일로 여러 날을 기다렸다 기록하는 설계(`lib/funding/policy.ts`)라 흔한 경로다. 이 표는 불변이라
 * 그렇게 굳은 숫자를 되돌릴 경로가 없으므로, 다르면 INSERT 없이 `amount_changed`로 거부한다
 * (`publicStatusDecision.ts`의 낙관적 잠금과 같은 축).
 */
export const recordFundingPayout = async (
  projectId: string,
  now: Date,
  expectedNetAmount: number,
): Promise<RecordFundingPayoutResult> => {
  const preview = await buildFundingPayoutPreview(projectId);
  if (!preview) return { ok: false, code: 'not_found' };
  if (preview.recorded) return { ok: false, code: 'already_recorded' };
  if (!preview.closed) return { ok: false, code: 'not_closed' };
  if (!preview.hasPayoutAccount) return { ok: false, code: 'no_payout_account' };
  if (!preview.taxType) return { ok: false, code: 'no_tax_type' };
  if (preview.taxType === 'withholding' && !preview.hasResidentNumber) {
    return { ok: false, code: 'no_resident_number' };
  }
  if (preview.grossAmount <= 0) return { ok: false, code: 'nothing_to_pay' };
  if (preview.netAmount !== expectedNetAmount) {
    return { ok: false, code: 'amount_changed', expectedNetAmount, netAmount: preview.netAmount };
  }

  try {
    const [payout] = await getDb()
      .insert(fundingProjectPayouts)
      .values({
        projectId,
        grossAmount: preview.grossAmount,
        refundAmount: preview.refundAmount,
        supplyAmount: preview.supplyAmount,
        feeAmount: preview.feeAmount,
        platformFeeAmount: preview.platformFeeAmount,
        paymentFeeAmount: preview.paymentFeeAmount,
        shareAmount: preview.shareAmount,
        withholdingAmount: preview.withholdingAmount,
        netAmount: preview.netAmount,
        backerCount: preview.backerCount,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return { ok: true, payout };
  } catch (error) {
    // 유니크 위반 = 동시에 두 번 눌렀다. 다른 오류면 그대로 올린다.
    if (String(error).includes('UNIQUE')) return { ok: false, code: 'already_recorded' };
    throw error;
  }
};

/** 운영자가 이체를 마친 뒤 누른다. pending → paid 한 방향, 되돌리지 않는다. */
export const markFundingPayoutPaid = async (id: string, memo: string | null, now: Date): Promise<boolean> => {
  const result = await getDb()
    .update(fundingProjectPayouts)
    .set({ status: 'paid', paidAt: now, memo, updatedAt: now })
    .where(and(eq(fundingProjectPayouts.id, id), eq(fundingProjectPayouts.status, 'pending')))
    .returning({ id: fundingProjectPayouts.id });
  return result.length > 0;
};

/** 기록된 정산 중 아직 이체 안 한 것 — 관리자 대시보드 대기열용. */
export const countPendingFundingPayouts = async (): Promise<number> => {
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(fundingProjectPayouts)
    .where(eq(fundingProjectPayouts.status, 'pending'));
  return Number(row?.count ?? 0);
};
