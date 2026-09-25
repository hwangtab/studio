import {
  FUNDING_PAYMENT_FEE_PERCENT,
  FUNDING_PLATFORM_FEE_PERCENT,
  FUNDING_WITHHOLDING_PERCENT,
} from '../../data/pricing';

/**
 * 펀딩 목표액 역산 — 발매 페이지 계산기(components/release/FundingGoalCalculator)가 쓴다.
 *
 * **클라이언트 번들에 들어가는 순수 모듈이다.** 정산 정본 lib/funding/payout.ts의
 * computeFundingPayout은 DB·암호화 모듈을 import하므로 클라이언트에서 부를 수 없다
 * (CLAUDE.md "클라이언트는 이 모듈에서 타입만"). 그래서 같은 식을 여기 한 번 더 적고,
 * lib/funding/goal.test.ts가 두 식이 원 단위까지 같은지 대조한다 — 한쪽만 고치면 CI가 선다.
 *
 * 정산 식(payout.ts와 같다): 결제액에서 플랫폼 수수료·결제 수수료(둘 다 부가세 포함)를
 * 각각 반올림해 떼고, 원천징수 개설자면 그 남은 몫의 3.3%를 반올림해 한 번 더 뗀다.
 */
export const netPayoutForGross = (grossAmount: number, withholding: boolean): number => {
  const gross = Math.max(0, grossAmount);
  const platformFee = Math.round((gross * FUNDING_PLATFORM_FEE_PERCENT) / 100);
  const paymentFee = Math.round((gross * FUNDING_PAYMENT_FEE_PERCENT) / 100);
  const share = gross - platformFee - paymentFee;
  const withheld = withholding ? Math.round((share * FUNDING_WITHHOLDING_PERCENT) / 100) : 0;
  return share - withheld;
};

export interface FundingGoalInput {
  /** 제작에 드는 돈 — 부가세 포함 금액으로 넣는다. */
  productionCost: number;
  /** 리워드 원가·배송·세션처럼 모금액으로 충당할 나머지 비용. */
  otherCost: number;
  /** 원천징수 대상(개인 개설자)인가. 사업자(세금계산서)면 false. */
  withholding: boolean;
  /** 목표액을 이 단위로 올림한다. 기본 1만원. */
  roundTo?: number;
}

export interface FundingGoalResult {
  goal: number;
  totalCost: number;
  platformFee: number;
  paymentFee: number;
  withheld: number;
  net: number;
}

/**
 * 정산 후 손에 남는 금액이 비용을 덮는 가장 작은 목표액(roundTo 단위 올림).
 * 해석해로 근사한 뒤 반올림 오차를 한 단위씩 올려 가며 확인한다.
 */
export const computeFundingGoal = ({ productionCost, otherCost, withholding, roundTo = 10000 }: FundingGoalInput): FundingGoalResult => {
  const totalCost = Math.max(0, productionCost) + Math.max(0, otherCost);
  const feeRate = (FUNDING_PLATFORM_FEE_PERCENT + FUNDING_PAYMENT_FEE_PERCENT) / 100;
  const keepRate = (1 - feeRate) * (withholding ? 1 - FUNDING_WITHHOLDING_PERCENT / 100 : 1);
  let goal = Math.ceil(totalCost / keepRate / roundTo) * roundTo;
  while (netPayoutForGross(goal, withholding) < totalCost) goal += roundTo;
  // 해석해가 한 단위 넘친 경우를 되돌린다.
  while (goal - roundTo >= 0 && netPayoutForGross(goal - roundTo, withholding) >= totalCost) goal -= roundTo;

  const platformFee = Math.round((goal * FUNDING_PLATFORM_FEE_PERCENT) / 100);
  const paymentFee = Math.round((goal * FUNDING_PAYMENT_FEE_PERCENT) / 100);
  const net = netPayoutForGross(goal, withholding);
  const withheld = goal - platformFee - paymentFee - net;
  return { goal, totalCost, platformFee, paymentFee, withheld, net };
};
