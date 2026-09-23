import { FUNDING_PLATFORM_FEE_PERCENT, FUNDING_PAYMENT_FEE_PERCENT, FUNDING_WITHHOLDING_PERCENT } from '../../data/pricing';
import { VAT_RATE } from '../booking/amounts';
import type { fundingCreatorTaxTypeEnum } from '../../db/schema';

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
 * 100만원 모금·환불 0·원천징수 개설자: platformFee 55,000 · paymentFee 34,000 →
 * feeAmount 89,000 → shareAmount 911,000 → withholdingAmount 30,063 → netAmount 880,937.
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
