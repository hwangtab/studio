/**
 * 사업소득 원천징수세액 — 운영자가 홈택스·위택스에 실제로 신고하는 식과 같아야 한다
 * (세무 정본: withholding-tax 스킬의 "계산" 절).
 *
 *   소득세     = 지급액 × 3%   (원 단위 절사)
 *   지방소득세 = 소득세 × 10%  (원 단위 절사)
 *
 * 3.3%를 한 번에 곱해 반올림하면 딱 떨어지지 않는 금액에서 몇 원씩 어긋난다
 * (829,091원: 3.3% 반올림 27,360 vs 신고액 24,872 + 2,487 = 27,359). 정산이 뗀 금액과
 * 신고·납부한 금액이 다르면 그 차액은 누구의 돈도 아닌 채 남는다.
 *
 * 클라이언트 번들(펀딩 목표액 계산기, lib/funding/goal.ts)도 쓰는 순수 모듈이다 — 다른 모듈을
 * import하지 않는다. 화면 문구의 "3.3%"(FUNDING_WITHHOLDING_PERCENT 등)는 표시용이고 계산은 여기다.
 */
export const computeBusinessIncomeWithholding = (amount: number) => {
  const base = Math.max(0, amount);
  const incomeTax = Math.floor((base * 3) / 100);
  const localIncomeTax = Math.floor(incomeTax / 10);
  return { incomeTax, localIncomeTax, total: incomeTax + localIncomeTax };
};
