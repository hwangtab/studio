import { and, eq, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { FUNDING_PLATFORM_FEE_PERCENT, FUNDING_PAYMENT_FEE_PERCENT } from '../../data/pricing';
import { VAT_RATE } from '../booking/amounts';
import { computeBusinessIncomeWithholding } from '../withholdingTax';
import {
  fundingCreators, fundingProjectPayouts, fundingProjects,
  type FundingProjectPayout, type fundingCreatorTaxTypeEnum,
} from '../../db/schema';
import { decryptField, FieldCryptoError, type FieldCryptoErrorCode } from '../crypto/fieldCrypto';
import { PRIVACY_ACTOR_ADMIN, recordPrivacyAccess } from '../privacy/accessLog';
import { decryptPayoutAccount } from './payoutAccountCrypto';
import { computeProjectState } from './projectState';
import { loadProjectService } from './projectServices';
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
 * supplyAmount = round(netGross / 1.1)                ← 부가세 제외 표시값(장부용) — 정산액 계산에는 쓰이지 않는다
 * afterFees    = netGross − feeAmount                 ← 수수료를 뗀 금액(부가세 포함)
 * 사업자(세금계산서): shareAmount = afterFees,              vatDeductionAmount = 0
 * 원천징수 개설자:    shareAmount = round(afterFees / 1.1), vatDeductionAmount = afterFees − shareAmount
 * withholdingAmount = 원천징수 개설자면 round(shareAmount × 3.3%), 사업자면 0
 * netAmount    = shareAmount − withholdingAmount      ← 실제 이체액
 * 불변식: shareAmount + vatDeductionAmount + feeAmount === netGross
 *
 * **원천징수 개설자만 부가세 상당액을 빼는 이유**(2026-09-29 수정). 판매자가 스튜디오라서
 * 후원금 전체의 부가가치세(10/110)를 스튜디오가 낸다. 사업자 개설자는 받은 정산금(afterFees)에
 * 대한 세금계산서를 스튜디오 앞으로 발행하므로 스튜디오가 그만큼을 매입세액으로 공제받는다.
 * 원천징수 대상 개설자에게서는 그 세금계산서가 없다. afterFees를 그대로 보내면 그 안에 든
 * 부가세를 스튜디오가 대신 내게 되어, 100만원 모금마다 스튜디오에 남는 금액(부가세 정산 뒤,
 * PG 비용 전)이 사업자 개설자일 때 80,000원인데 원천징수 개설자일 때는 −2,909원이었다.
 * 부가세 상당액을 빼면 두 유형 모두 80,000원이다(payout.test.ts가 이 등식을 고정한다).
 *
 * 100만원 모금·환불 0: platformFee 55,000 · paymentFee 33,000 → feeAmount 88,000 →
 *   사업자   — shareAmount 912,000(세금계산서 대상) → netAmount 912,000
 *   원천징수 — vatDeductionAmount 82,909 → shareAmount 829,091 → withholdingAmount 27,359(소득세 24,872 + 지방소득세 2,487) → netAmount 801,732
 *
 * **설계비·제작비 공제**(2026-09-28 운영자 결정, 개설자 약관 제6조) — 스튜디오에 설계·제작을
 * 맡기고 정산 때 받기로 한 대금(부가세 포함)은 **원천징수까지 뺀 금액에서** 뺀다. 개설자가
 * 스튜디오에 치르는 비용이라 수수료·원천징수의 계산 기준(shareAmount)에는 들어가지 않는다.
 * 뺄 수 있는 한도는 그 금액까지이고, 넘는 부분은 shortfallAmount(차액 청구나 규모 조정을
 * 개설자와 협의할 금액)로 남긴다 — 실지급액이 음수가 되는 일은 없다.
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
  /**
   * 원천징수 개설자의 정산금에서 뺀 부가가치세 상당액(수수료를 뗀 금액의 10/110). 사업자는 0.
   * `funding_project_payouts`에는 컬럼이 없다 — 기록된 행에서는 `recordedVatDeduction`으로
   * 되살린다(나머지 금액 칸에서 원 단위까지 정확히 유도된다).
   */
  vatDeductionAmount: number;
  shareAmount: number;
  withholdingAmount: number;
  /** 정산금에서 뺀 설계비(부가세 포함). */
  designFeeOffsetAmount: number;
  /** 정산금에서 뺀 제작비(부가세 포함). */
  productionFeeOffsetAmount: number;
  /** 대금이 정산금을 넘어 빼지 못한 금액 — 개설자와 협의할 차액. */
  shortfallAmount: number;
  netAmount: number;
}

/** 정산 때 받기로 한 대금(부가세 포함). 없으면 둘 다 0. */
export interface FundingServiceCharges {
  designFee: number;
  productionFee: number;
}

const NO_CHARGES: FundingServiceCharges = { designFee: 0, productionFee: 0 };

/** 원천징수까지 뺀 금액(available)에서 설계비 → 제작비 순으로 빼고, 넘는 부분을 차액으로 남긴다. */
export const applyServiceCharges = (available: number, charges: FundingServiceCharges) => {
  const room = Math.max(0, available);
  const designFeeOffsetAmount = Math.min(charges.designFee, room);
  const productionFeeOffsetAmount = Math.min(charges.productionFee, room - designFeeOffsetAmount);
  const shortfallAmount = charges.designFee + charges.productionFee - designFeeOffsetAmount - productionFeeOffsetAmount;
  return {
    designFeeOffsetAmount,
    productionFeeOffsetAmount,
    shortfallAmount,
    netAmount: room - designFeeOffsetAmount - productionFeeOffsetAmount,
  };
};

/**
 * 수수료를 뗀 금액(부가세 포함)에서 개설자 몫·부가세 상당액·원천징수를 정한다. 두 정산 계산
 * (`computeFundingPayout`, `computeFundingPayoutForProject`)이 같은 뒷부분을 쓰도록 한 곳에 둔다 —
 * 한쪽만 고치면 수기 등록이 있는 프로젝트만 옛 식으로 정산된다.
 */
const splitCreatorShare = (afterFees: number, taxType: FundingCreatorTaxType, charges: FundingServiceCharges) => {
  const shareAmount = taxType === 'withholding' ? Math.round(afterFees / (1 + VAT_RATE)) : afterFees;
  // 소득세 3%·지방소득세 10%를 각각 절사한다(lib/withholdingTax.ts) — 신고·납부하는 금액과 같아야 한다.
  const withholdingAmount = taxType === 'withholding' ? computeBusinessIncomeWithholding(shareAmount).total : 0;
  return {
    vatDeductionAmount: afterFees - shareAmount,
    shareAmount,
    withholdingAmount,
    ...applyServiceCharges(shareAmount - withholdingAmount, charges),
  };
};

/**
 * 기록된 정산 행에서 부가세 상당액을 되살린다. 컬럼이 없어도 나머지 칸이 원 단위로 정해 준다
 * (불변식 shareAmount + vatDeductionAmount + feeAmount === max(0, gross − refund)). 이 식을
 * 도입하기 전에 기록된 행은 0이 나온다 — 그때는 빼지 않았으므로 그게 사실이다.
 */
export const recordedVatDeduction = (row: Pick<FundingProjectPayout, 'grossAmount' | 'refundAmount' | 'feeAmount' | 'shareAmount'>): number =>
  Math.max(0, Math.max(0, row.grossAmount - row.refundAmount) - row.feeAmount - row.shareAmount);

export const computeFundingPayout = (input: {
  grossAmount: number;
  refundAmount: number;
  taxType: FundingCreatorTaxType;
  charges?: FundingServiceCharges;
}): FundingPayoutBreakdown => {
  const netGross = Math.max(0, input.grossAmount - input.refundAmount);
  const platformFeeAmount = Math.round((netGross * FUNDING_PLATFORM_FEE_PERCENT) / 100);
  const paymentFeeAmount = Math.round((netGross * FUNDING_PAYMENT_FEE_PERCENT) / 100);
  const feeAmount = platformFeeAmount + paymentFeeAmount;
  const supplyAmount = Math.round(netGross / (1 + VAT_RATE));

  return {
    grossAmount: input.grossAmount,
    refundAmount: input.refundAmount,
    supplyAmount,
    feeAmount,
    platformFeeAmount,
    paymentFeeAmount,
    ...splitCreatorShare(netGross - feeAmount, input.taxType, input.charges ?? NO_CHARGES),
  };
};

/**
 * 토스를 지나지 않은 몫(수기 등록과 계좌 입금 — `payment_method = 'bank_transfer'`)을 결제 수수료
 * 대상에서 뺀 판. 아래는 수기 등록 기준으로 적힌 설명이고, 계좌 입금도 같은 이유(결제 대행 없음)다.
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
  charges?: FundingServiceCharges;
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

  return {
    ...base,
    paymentFeeAmount,
    feeAmount,
    ...splitCreatorShare(netGross - feeAmount, input.taxType, input.charges ?? NO_CHARGES),
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
  /**
   * grossAmount 중 **토스를 지나지 않은 몫**(수기 등록 + 계좌 입금, payment_method='bank_transfer') —
   * 결제 수수료에서 빠진 금액이라 화면이 이유를 적을 수 있어야 한다. 이름은 옛 그대로 둔다(화면·테스트가 읽는다).
   */
  manualGrossAmount: number;
  /**
   * 확정 후원 **건수**. `aggregateProjectStatus`의 backerCount와 같은 것을 센다(사람 수가
   * 아니다) — 정산 기록의 숫자가 공개 페이지의 'N건 후원'과 달라 보이면 안 된다.
   */
  backerCount: number;
  /** 모금이 끝났는가(`computeProjectState`가 'closed'). 기록 버튼의 전제다. */
  closed: boolean;
  /**
   * 개설자의 정산 계좌가 등록돼 있는가 — **암호문이 있는가만 본다.** 은행명·계좌번호·예금주는
   * 한 암호문 안에 한 벌로 들어 있으므로(`payoutAccountCrypto.ts`) 셋 중 일부만 있는 상태는
   * 생기지 않는다. 이 함수는 복호화하지 않는다 — 값은 싣지 않는다(props가 __NEXT_DATA__로
   * 나간다). 열 수 있는지는 기록 직전에 `payoutAccountReadable`이 따로 본다.
   */
  hasPayoutAccount: boolean;
  /**
   * 개설자의 주민등록번호가 등록돼 있는가. **암호문이 있는가만 본다** — 이 함수는 복호화하지
   * 않는다(키 없이도 미리보기가 떠야 하고, 값이 여기서 나가면 props로 새어 나간다).
   * 원천징수 대상인데 이 값이 없으면 기록이 `no_resident_number`로 거부된다.
   */
  hasResidentNumber: boolean;
  /** 이미 기록된 정산. 있으면 그 값이 정본이고 미리보기는 참고용이다. */
  recorded: FundingProjectPayout | null;
  /**
   * 설계·제작 대금 기록(funding_project_services)을 읽지 못했다. 그러면 공제 없이 계산한
   * 참고값이고, 기록은 `services_unavailable`로 거부된다 — 합의한 대금을 모른 채 전액을
   * 불변으로 기록하면 되돌릴 경로가 없다.
   */
  serviceChargesUnavailable: boolean;
}

/**
 * 한 프로젝트의 정산 미리보기.
 *
 * **집계 기준은 공개 상세(`aggregateProjectStatus`)와 같다** — 같은
 * `LIVE_FUNDING_ORDER_STATUSES`(paid·partially_refunded) 집합, 같은
 * `orders ⋈ funding_pledges` 조인. 기준이 갈리면 공개 모금액과 정산액이 어긋나고, 그건
 * 개설자가 즉시 알아채는 종류의 사고다.
 *
 * 표시만 다르다: 공개 모금액은 부분환불 주문의 done 환불을 이미 뺀 한 숫자이고, 정산은
 * `grossAmount`(Σ total_amount)와 `refundAmount`를 따로 드러낸다 — 실제로 나갈 돈을 정하는
 * 자리라 차이를 나란히 보여 준다. 그래서 공개 모금액 = `grossAmount − refundAmount`다
 * (살아 있는 주문의 done 환불이 전부 부분환불 주문에 붙어 있는 한).
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

  const rows = await db.all<{ amount: number; payment_method: string; refunded: number }>(sql`
    SELECT o.total_amount AS amount,
           fp.payment_method AS payment_method,
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
  /**
   * 토스를 지나지 않은 몫 — `payment_method = 'bank_transfer'`. 관리자 수기 등록(늘 bank_transfer)과
   * 후원자가 폼에서 고른 계좌 입금(2026-10-04 재도입)이 둘 다 여기다. 예전엔 `entry_source = 'manual'`로
   * 골라서, 계좌 입금이 돌아오자 PG를 거치지 않은 돈에 결제 수수료가 붙는 길이 생겼다 — 아래
   * computeFundingPayoutForProject 주석이 "근거 없는 공제"라 부르는 바로 그것이다.
   */
  const manualGrossAmount = rows.filter((r) => r.payment_method === 'bank_transfer').reduce((s, r) => s + Number(r.amount), 0);

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

  /**
   * 정산 때 받기로 한 설계비·제작비(개설자 약관 제6조). 부가세 포함으로 뺀다 — 약정은 공급가다.
   * 설계비를 정산 밖에서 이미 받았으면(design_fee_paid_at) 다시 빼지 않는다. 직접 개설로 되돌린
   * 행(`none`)은 옛 약정 보존용이라 빼지 않는다.
   */
  const serviceResult = await loadProjectService(projectId);
  const service = serviceResult.available ? serviceResult.service : null;
  const withVat = (supply: number) => Math.round(supply * (1 + VAT_RATE));
  const charges: FundingServiceCharges = service && service.kind !== 'none'
    ? {
      designFee: service.designFeePaidAt ? 0 : withVat(service.designFee),
      productionFee: withVat(service.productionFee),
    }
    : { designFee: 0, productionFee: 0 };

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
    hasPayoutAccount: Boolean(creator.payoutAccountEnc?.trim()),
    hasResidentNumber: Boolean(creator.residentNumberEnc?.trim()),
    recorded,
    serviceChargesUnavailable: !serviceResult.available,
    ...computeFundingPayoutForProject({ grossAmount, refundAmount, manualGrossAmount, taxType: assumedTaxType, charges }),
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
        | 'no_resident_number'
        | 'services_unavailable';
    }
  /**
   * 계좌 암호문을 지금 이 서버가 열지 못했다. **왜 못 열었는지를 함께 돌려준다.**
   *
   * 사유마다 운영자가 할 일이 정반대다: 키 문제(`missing_key`·`key_mismatch` 등)면 값은
   * 멀쩡하니 키를 되찾아야 하고, 봉투가 깨진 `malformed`이면 그 값은 되살릴 수 없어
   * 개설자에게 재등록을 요청해야 한다. 코드를 안 돌려주면 화면이 둘 중 하나로 단정하게 되고,
   * 그 단정이 틀린 절반에서는 멀쩡한 값을 덮어쓰거나 못 고칠 값을 기다리게 만든다.
   */
  | { ok: false; code: 'payout_account_unreadable'; cryptoCode: FieldCryptoErrorCode | 'unknown' }
  /** 주민등록번호 쪽 같은 일. 계좌와 **같은 구조**여야 다음 사람이 한쪽만 고치지 않는다. */
  | { ok: false; code: 'resident_number_unreadable'; cryptoCode: FieldCryptoErrorCode | 'unknown' }
  /**
   * 화면이 보여 준 금액(실이체액·설계비/제작비 공제액·차액)과 지금 다시 계산한 값이 하나라도
   * 다르다. 실이체액 두 값을 함께 돌려준다 — 둘이 같으면 공제액이나 차액만 바뀐 것이다.
   */
  | { ok: false; code: 'amount_changed'; expectedNetAmount: number; netAmount: number };

/**
 * 관리자 화면이 운영자에게 보여 주고 확인받은 금액. 서버는 이 값을 기록하지 않고 다시 계산한
 * 값과 대조만 한다. 실이체액만 대조하면, 화면을 본 뒤 다른 운영자가 약정 제작비를 바꿔도
 * 실이체액이 0원으로 같을 때 확인하지 않은 공제액·차액이 불변 행으로 굳는다.
 */
export interface ExpectedPayoutAmounts {
  netAmount: number;
  designFeeOffsetAmount: number;
  productionFeeOffsetAmount: number;
  shortfallAmount: number;
}

/**
 * 저장된 주민등록번호를 **지금 이 서버가 열 수 있는가.**
 *
 * 미리보기(`buildFundingPayoutPreview`)는 일부러 복호화하지 않는다 — 그 결과는 관리자 화면
 * props로 나가고, 그 자리가 평문이 샐 자리다. 대신 기록 직전에 여기서 한 번만 열어 보고
 * **성공 여부만** 돌려준다. 평문은 반환하지도 담지도 않고, 실패해도 로그에는 오류 코드만
 * 남긴다(`FieldCryptoError.code`는 missing_key·key_mismatch·auth_failed 같은 분류값이다 —
 * 키가 회전 중이라 아직 옛 키인 값은 `key_mismatch`로, 손상된 값은 `auth_failed`로 갈린다).
 *
 * **여기서도 접속기록을 남긴다.** 평문을 화면에 내보내지 않을 뿐 복호화는 실제로 일어나므로,
 * 관리자 화면의 조회 버튼과 같은 무게의 처리다. 이 경로가 기록되지 않던 동안 "조회 버튼을
 * 누른 그 순간에만 복호화한다"는 처리방침 설명이 사실과 달랐다.
 */
const residentNumberReadable = async (
  projectId: string,
  actor: string,
  ip: string | null,
): Promise<DecryptCheckResult> => {
  const log = (result: 'success' | 'not_found' | 'decrypt_failed' | 'error') =>
    recordPrivacyAccess({
      actor,
      action: 'funding_resident_number_decrypt_check',
      targetId: projectId,
      result,
      ip,
    }).catch((error: unknown) => {
      // 기록 실패가 정산 기록 자체를 막지 않는다(recordPrivacyAccess도 삼키지만,
      // 이 경로의 보증은 여기가 진다).
      console.error('[privacy] 접속기록 호출 실패 — 정산 기록은 계속됩니다', error);
    });

  /**
   * 조회 자체가 실패하는 갈래도 **기록한다.** 처리방침 19항이 이 점검을 "성공·실패를
   * 가리지 않고" 남긴다고 적었는데, 예전엔 이 select가 던지면 `log()`가 한 번도 불리지
   * 않고 예외가 그대로 위로 올라갔다 — 호출하는 라우트 둘은 catch에서 `'error'`를 남기지만
   * 이 경로만 비어 있었다. 기록한 뒤 예외는 그대로 다시 던진다(정산 기록은 실패해야 한다 —
   * 번호를 열 수 있는지 확인하지 못한 채 원천징수를 기록할 수는 없다).
   */
  let row: { enc: string | null } | undefined;
  try {
    [row] = await getDb()
      .select({ enc: fundingCreators.residentNumberEnc })
      .from(fundingProjects)
      .innerJoin(fundingCreators, eq(fundingCreators.id, fundingProjects.creatorId))
      .where(eq(fundingProjects.id, projectId))
      .limit(1);
  } catch (error: unknown) {
    await log('error');
    throw error;
  }
  const enc = row?.enc?.trim();
  if (!enc) {
    // 여기까지 오면 미리보기가 이미 hasResidentNumber로 걸렀어야 한다. 그래도 기록은 남긴다.
    await log('not_found');
    return { ok: false, cryptoCode: 'unknown' };
  }
  try {
    decryptField(enc);
    await log('success');
    return { ok: true };
  } catch (error: unknown) {
    await log('decrypt_failed');
    const cryptoCode = error instanceof FieldCryptoError ? error.code : 'unknown';
    console.error('[funding] 주민등록번호 복호화 점검 실패', { projectId, code: cryptoCode });
    return { ok: false, cryptoCode };
  }
};

/**
 * 저장된 정산 계좌를 **지금 이 서버가 열 수 있는가.**
 *
 * 주민등록번호 쪽(`residentNumberReadable`)과 같은 이유로 같은 모양이다: 미리보기는 암호문
 * 존재만 보므로, 키가 없거나 바뀐 상태에서도 기록 버튼이 살아 있다. 그대로 기록하면
 * `funding_project_payouts`는 불변이라 "기록은 됐는데 보낼 계좌를 읽지 못한다"가 영구히 남는다.
 *
 * 그래서 기록 직전에 한 번 열어 보고 **성공 여부만** 돌려준다 — 은행명·계좌번호·예금주는
 * 변수 밖으로 나가지 않고, 실패해도 로그에는 오류 코드만 남는다.
 *
 * **여기서도 접속기록을 남긴다.** 평문을 화면에 내보내지 않을 뿐 복호화는 실제로 일어난다 —
 * 운영자의 계좌 조회 버튼과 같은 무게의 처리다.
 */
/**
 * 복호화 점검 둘(계좌·주민등록번호)이 **같은 모양으로** 답한다. 열지 못했으면 왜 못 열었는지를
 * 함께 올린다 — 사유가 `malformed`인지 키 문제인지에 따라 운영자가 할 일이 정반대라,
 * 한쪽만 코드를 올려 보내면 그쪽 문구만 정확해지고 다른 쪽은 절반이 틀린 채로 남는다.
 */
type DecryptCheckResult = { ok: true } | { ok: false; cryptoCode: FieldCryptoErrorCode | 'unknown' };

const payoutAccountReadable = async (
  projectId: string,
  actor: string,
  ip: string | null,
): Promise<DecryptCheckResult> => {
  const log = (result: 'success' | 'not_found' | 'decrypt_failed' | 'error') =>
    recordPrivacyAccess({
      actor,
      action: 'funding_payout_account_decrypt_check',
      targetId: projectId,
      result,
      ip,
    }).catch((error: unknown) => {
      console.error('[privacy] 접속기록 호출 실패 — 정산 기록은 계속됩니다', error);
    });

  // 조회 자체가 실패하는 갈래도 기록한 뒤 예외를 그대로 올린다(주민등록번호 쪽과 같은 규약).
  let row: { enc: string | null } | undefined;
  try {
    [row] = await getDb()
      .select({ enc: fundingCreators.payoutAccountEnc })
      .from(fundingProjects)
      .innerJoin(fundingCreators, eq(fundingCreators.id, fundingProjects.creatorId))
      .where(eq(fundingProjects.id, projectId))
      .limit(1);
  } catch (error: unknown) {
    await log('error');
    throw error;
  }
  const enc = row?.enc?.trim();
  if (!enc) {
    // 여기까지 오면 미리보기가 이미 hasPayoutAccount로 걸렀어야 한다. 그래도 기록은 남긴다.
    await log('not_found');
    return { ok: false, cryptoCode: 'unknown' };
  }
  try {
    decryptPayoutAccount(enc);
    await log('success');
    return { ok: true };
  } catch (error: unknown) {
    await log('decrypt_failed');
    const cryptoCode = error instanceof FieldCryptoError ? error.code : 'unknown';
    console.error('[funding] 정산 계좌 복호화 점검 실패', { projectId, code: cryptoCode });
    return { ok: false, cryptoCode };
  }
};

/**
 * 미리보기 숫자를 그 시점에 고정해 기록한다. 프로젝트당 한 번 — `project_id` UNIQUE가 두 번째
 * INSERT를 막고, 그 실패를 already_recorded로 돌려준다(경합에서도 안전).
 *
 * 거부 사유를 넷으로 가른다. 넷은 운영자가 할 일이 서로 다르다:
 * - `not_closed` — **모금이 아직 안 끝났다.** 진행 중에 기록하면 그 뒤 들어온 후원이 정산에서
 *   통째로 빠진다. 기다렸다 다시 누르면 된다.
 * - `no_payout_account` — 개설자의 계좌 정보가 없다. 보낼 곳 없는 정산을 기록하면 "기록은
 *   됐는데 돈은 안 갔다"가 영영 남는다. 개설자에게 계좌 등록을 요청해야 한다.
 * - `payout_account_unreadable` — 암호문은 있는데 **지금 이 서버가 열지 못한다.** 계좌가 없는
 *   것과 가르는 이유는 운영자가 할 일이 정반대이기 때문이다: 없으면 개설자에게 등록을
 *   요청해야 하고, 키 문제로 못 여는 것이면 **개설자는 아무 잘못이 없고 키를 되찾는 것이
 *   먼저다** — 그 상태에서 재등록을 요청하면 멀쩡한 값을 덮어쓴다. 다만 **봉투가 깨진
 *   `malformed`은 반대로 재등록이 정답이다**(그 값은 어떤 키로도 안 열린다). 그래서 이 코드는
 *   `cryptoCode`를 함께 돌려주고, 화면이 그 둘을 갈라 안내한다.
 * - `no_tax_type` — 개설자의 세금 처리 구분이 없다. 계좌만 있고 이 값이 비는 행이 실제로
 *   생긴다(운영자 직접 입력·이관). 추측해서 기록하면 사업자에게 원천징수를 떼고 보내게 되고,
 *   이 표는 불변이라 되돌릴 경로가 없다.
 * - `no_resident_number` — 원천징수 대상(`withholding`)인데 주민등록번호가 없다. 세액을 떼고
 *   보내 놓고 신고는 못 하는 상태가 된다 — 소득세법 시행령 제147조의7제1항제1호 가목이
 *   지급명세서에 소득자의 주민등록번호를 적도록 하기 때문이다. 사업자(`invoice`)는 원천징수 자체를 하지 않으므로 이 조건에 걸리지 않는다.
 * - `resident_number_unreadable` — 암호문은 있는데 **지금 이 서버가 열지 못한다.** 암호문
 *   존재만 보면 이 상태에서도 기록 버튼이 살아 있어, 세액을 떼고 불변으로 기록한 **뒤에야**
 *   조회에서 실패를 만난다. 그래서 기록 직전에 한 번 열어 보고 **성공 여부만** 본다 — 평문은
 *   변수에 담지도, 응답·로그·화면에 싣지도 않는다. 계좌와 마찬가지로 `cryptoCode`를 함께
 *   돌려준다: 키 문제면 값이 멀쩡하니 재등록을 요청하면 안 되고, 봉투가 아니라 값 자체가
 *   형식이 아닌 `malformed`이면 반대로 재등록이 유일한 복구 경로다.
 * - `nothing_to_pay` — **실이체액이 0 이하이고 뺀 대금도 없다**(받은 돈이 없거나, 환불이 모금액을
 *   다 덮었다). 할 일이 없다. 설계·제작 대금을 빼서 0이 된 정산은 기록한다(장부에 남아야 한다).
 * - `services_unavailable` — 설계·제작 대금 기록을 읽지 못했다(마이그레이션 0041 미적용이나 DB
 *   장애). 합의한 공제를 모른 채 전액을 불변으로 기록하지 않는다.
 * - `amount_changed` — 화면이 보여 준 금액과 지금 계산한 값이 다르다. 아래 `expected` 설명 참고.
 *
 * `expected`는 호출부(관리자 화면)가 **운영자에게 보여 주고 확인받은** 실이체액·설계비/제작비
 * 공제액·차액이다(`ExpectedPayoutAmounts`).
 * 이 함수는 미리보기를 다시 돌려 그 결과를 INSERT하므로, 페이지를 띄운 순간과 버튼을
 * 누른 순간 사이에 환불이 한 건 `done`이 되면 확인창과 기록이 갈라버린다 — 마감 뒤 정산까지
 * 영업일로 여러 날을 기다렸다 기록하는 설계(`lib/funding/policy.ts`)라 흔한 경로다. 이 표는 불변이라
 * 그렇게 굳은 숫자를 되돌릴 경로가 없으므로, 다르면 INSERT 없이 `amount_changed`로 거부한다
 * (`publicStatusDecision.ts`의 낙관적 잠금과 같은 축).
 */
export const recordFundingPayout = async (
  projectId: string,
  now: Date,
  expected: ExpectedPayoutAmounts,
  /**
   * 이 기록을 요청한 쪽의 IP(`getClientIp`). 주민등록번호 복호화 점검이 남기는 접속기록에
   * 들어간다. 요청 밖에서 부르는 경로(테스트·스크립트)는 넘기지 않아도 되고, 그때는 IP가
   * null로 남는다 — 모르는 것을 지어내지 않는다.
   */
  ip: string | null = null,
  /**
   * 이 기록을 요청한 사람(가드가 돌려준 `auth.actor`). 복호화 점검이 남기는 접속기록의
   * 수행자다 — 여기서 고정값을 쓰면 정산 경로만 누가 열었는지 모르는 채 남는다.
   * 요청 밖에서 부르는 경로(테스트·스크립트)는 기본값 `admin`으로 떨어진다.
   *
   * **기존 인자 뒤에 둔다.** 앞에 끼우면 `ip`를 네 번째로 넘기던 코드가 조용히 IP를
   * 수행자로 적는다 — 타입이 둘 다 문자열이라 컴파일러도 못 잡는다.
   */
  actor: string = PRIVACY_ACTOR_ADMIN,
): Promise<RecordFundingPayoutResult> => {
  const preview = await buildFundingPayoutPreview(projectId);
  if (!preview) return { ok: false, code: 'not_found' };
  if (preview.recorded) return { ok: false, code: 'already_recorded' };
  if (!preview.closed) return { ok: false, code: 'not_closed' };
  if (!preview.hasPayoutAccount) return { ok: false, code: 'no_payout_account' };
  // 계좌는 세금 구분과 무관하게 필요하다 — 원천징수든 사업자든 돈은 계좌로 간다.
  const accountRead = await payoutAccountReadable(projectId, actor, ip);
  if (!accountRead.ok) {
    return { ok: false, code: 'payout_account_unreadable', cryptoCode: accountRead.cryptoCode };
  }
  if (!preview.taxType) return { ok: false, code: 'no_tax_type' };
  if (preview.taxType === 'withholding') {
    if (!preview.hasResidentNumber) return { ok: false, code: 'no_resident_number' };
    const residentRead = await residentNumberReadable(projectId, actor, ip);
    if (!residentRead.ok) {
      return { ok: false, code: 'resident_number_unreadable', cryptoCode: residentRead.cryptoCode };
    }
  }
  /**
   * 판정은 **실이체액**이다. `grossAmount`(환불 전 모금액)를 보면, 부분환불 합이 모금액에
   * 닿아 실지급액이 0인 프로젝트에 0원 정산이 **불변으로** INSERT되고 "실지급액 0원" 메일이
   * 나가며, 그 행은 project_id UNIQUE 탓에 영구 pending으로 "이체 대기" 카운터를 올린다.
   */
  if (preview.serviceChargesUnavailable) return { ok: false, code: 'services_unavailable' };
  /**
   * 대금을 빼서 실지급액이 0이 된 정산은 기록한다 — 모금액이 설계·제작 대금으로 전부 쓰였다는
   * 사실(과 남은 차액)이 장부에 남아야 한다. 받은 돈 자체가 없는 경우만 할 일이 없다.
   */
  const offsetTotal = preview.designFeeOffsetAmount + preview.productionFeeOffsetAmount;
  if (preview.netAmount <= 0 && offsetTotal <= 0) return { ok: false, code: 'nothing_to_pay' };
  if (
    preview.netAmount !== expected.netAmount ||
    preview.designFeeOffsetAmount !== expected.designFeeOffsetAmount ||
    preview.productionFeeOffsetAmount !== expected.productionFeeOffsetAmount ||
    preview.shortfallAmount !== expected.shortfallAmount
  ) {
    return { ok: false, code: 'amount_changed', expectedNetAmount: expected.netAmount, netAmount: preview.netAmount };
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
        designFeeOffsetAmount: preview.designFeeOffsetAmount,
        productionFeeOffsetAmount: preview.productionFeeOffsetAmount,
        shortfallAmount: preview.shortfallAmount,
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
