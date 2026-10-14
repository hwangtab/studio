import { SHOP_ARTIST_SHARE_PERCENT } from '../../data/pricing';
import { VAT_RATE } from '../booking/amounts';
import { computeBusinessIncomeWithholding } from '../withholdingTax';

/**
 * 상점 아티스트 상품(위탁 판매) 정산 — 순수 계산. 판매자는 스튜디오이고 재고를 맡아 발송한다(운영자 결정 2026-10-14).
 *
 * 기준은 **상품 판매가(VAT 포함), 배송비 제외**다. 배송비는 발송하는 스튜디오 몫이다.
 *
 * netGross = max(0, sales − refund)
 * share    = round(netGross × 55%)                    ← SHOP_ARTIST_SHARE_PERCENT
 * 사업자(세금계산서):  shareAmount = share,              vatDeductionAmount = 0
 * 원천징수 아티스트:   shareAmount = round(share / 1.1), vatDeductionAmount = share − shareAmount
 * withholdingAmount = 원천징수면 소득세 3% + 지방소득세(소득세의 10%), 사업자면 0
 * netAmount = shareAmount − withholdingAmount        ← 실제 이체액
 *
 * **원천징수 아티스트만 부가세 상당액을 빼는 이유**는 펀딩 정산(lib/funding/payout.ts)과 같다. 판매가 전체의 부가세를
 * 스튜디오가 낸다. 사업자 아티스트는 받은 몫에 대한 세금계산서를 발행하므로 스튜디오가 그만큼 매입세액을 공제받지만,
 * 개인 아티스트에게서는 세금계산서가 없다. 부가세 상당액을 빼면 두 유형 모두 스튜디오에 남는 금액이 같다
 * (20,000원 CD 1장: 사업자 11,000원 이체 / 개인 10,000원에서 원천징수 330원 → 9,670원 이체, 스튜디오 몫은 둘 다
 * 부가세 정산 뒤 8,182원 — 여기서 결제 수수료·포장이 나간다). artistPayout.test.ts가 이 등식을 고정한다.
 *
 * ⚠ 개인 아티스트가 자기 음반·굿즈를 위탁해 받는 돈을 사업소득 원천징수로 처리하는 것은 펀딩 정산과 같은 판단을
 * 옮긴 것이다. 첫 정산 전에 세무 확인을 받는다(withholding-tax 스킬).
 */
export interface ShopArtistPayout {
  salesAmount: number;
  refundAmount: number;
  storeAmount: number;
  vatDeductionAmount: number;
  shareAmount: number;
  withholdingAmount: number;
  netAmount: number;
}

export const computeShopArtistPayout = (input: {
  salesAmount: number;
  refundAmount: number;
  taxType: 'withholding' | 'invoice';
}): ShopArtistPayout => {
  const netGross = Math.max(0, input.salesAmount - input.refundAmount);
  const share = Math.round((netGross * SHOP_ARTIST_SHARE_PERCENT) / 100);
  const shareAmount = input.taxType === 'withholding' ? Math.round(share / (1 + VAT_RATE)) : share;
  const vatDeductionAmount = share - shareAmount;
  const withholdingAmount = input.taxType === 'withholding' ? computeBusinessIncomeWithholding(shareAmount).total : 0;
  return {
    salesAmount: input.salesAmount,
    refundAmount: input.refundAmount,
    storeAmount: netGross - share,
    vatDeductionAmount,
    shareAmount,
    withholdingAmount,
    netAmount: shareAmount - withholdingAmount,
  };
};

/** 'YYYY-MM'(KST)의 시작·끝(초, 끝은 미포함). 형식이 틀리면 null. */
export const kstMonthRange = (month: string): { from: number; to: number } | null => {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!m) return null;
  const year = Number(m[1]);
  const mon = Number(m[2]);
  const KST_OFFSET = 9 * 3600;
  return {
    from: Date.UTC(year, mon - 1, 1) / 1000 - KST_OFFSET,
    to: Date.UTC(year, mon, 1) / 1000 - KST_OFFSET,
  };
};
