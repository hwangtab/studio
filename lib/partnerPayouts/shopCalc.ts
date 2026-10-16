import { computeShopArtistPayout, type ShopArtistPayout } from '../shop/artistPayout';

/**
 * 상점 정산 한 건의 계산 — **순수**. 정산 식은 `computeShopArtistPayout` 하나이고, 여기서는 그 위에 이월 조정만 얹는다.
 *
 * 조정(`partner_payout_adjustments.amount`, 부호 있음)은 **아티스트 몫(VAT 포함) 기준**이다. 정산 뒤 환불 1건은
 * 그 주문이 만든 몫(상품 판매가의 55% + 아티스트 직접 발송이면 배송비)만큼 음수로 쌓인다. 몫에 더한 다음 부가세 상당액·
 * 원천징수를 계산하므로 환불이 세액에도 같은 비율로 반영된다 — 이미 낸 원천징수는 신고가 끝난 돈이라 거꾸로 돌리지 않는다.
 *
 * 조정이 몫을 넘으면(몫 < 0) 실이체액은 0원이고, 남은 음수는 **다음 정산으로 이월**한다 — `carryOverAmount`(≤ 0).
 * 기록 쪽이 그 값을 새 조정 행으로 남기고, 기록의 `shortfall_amount`에는 그 크기를 적는다.
 */
export interface ShopPayoutCalc extends ShopArtistPayout {
  /** 이 정산에 싣는 조정의 합(부호 있음, 아티스트 몫 기준). */
  adjustmentAmount: number;
  /** 몫이 모자라 다음 정산으로 넘기는 음수(0 이하). 0이면 이월이 없다. */
  carryOverAmount: number;
}

export const computeShopPayoutCalc = (input: {
  salesAmount: number;
  shippingAmount: number;
  taxType: 'withholding' | 'invoice';
  adjustmentAmount: number;
}): ShopPayoutCalc => {
  const adjustmentAmount = Math.trunc(input.adjustmentAmount);
  const common = { salesAmount: input.salesAmount, refundAmount: 0, taxType: input.taxType, shippingAmount: input.shippingAmount };
  const unadjusted = computeShopArtistPayout(common);
  // 조정 전 몫(VAT 포함) = 부가세 상당액을 나누기 전 값. 두 칸의 합이 곧 그 값이다(불변식).
  const baseShare = unadjusted.shareAmount + unadjusted.vatDeductionAmount;
  const carryOverAmount = Math.min(0, baseShare + adjustmentAmount);
  return {
    ...computeShopArtistPayout({ ...common, adjustmentAmount }),
    adjustmentAmount,
    carryOverAmount,
  };
};
