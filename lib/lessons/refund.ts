/**
 * 수강생이 중도에 그만둘 때의 환불 기준 — 「학원의 설립·운영 및 과외교습에 관한 법률 시행령」 별표 4(교습비등 반환 기준)를 따른다.
 * 수강 계약서 제9조가 같은 문장을 말한다 — 한쪽을 바꾸면 다른 쪽도(refund.test.ts가 표를 고정한다).
 *
 * - 월 4회를 한 달로 센다(`arrearsOf`와 같다). 진행한 회차를 4회씩 묶어 달로 세고, **진행한 마지막 회차가 속한 달이 "해지한 달"**이다.
 * - 진행한 회차 = 완료 + 결석(결석은 보강 없이 소화, 제4조 — 수업 시간이 지났으므로 시간이 경과한 것으로 본다).
 * - 첫 수업 전: 낸 수강료 전액. 해지한 달: 그 달 4회 중 1회 진행(1/3 경과 전) 2/3, 2회 진행(1/2) 1/2, 3회 이상 0.
 *   정확히 1/2에 이른 2회째는 "1/2 경과 전"으로 본다(수강생에게 유리하게). 해지한 달 이후의 달은 전액.
 * - 수강료는 월 수강료(공급가). 카드 결제는 부가세 10%를 같은 비율로 포함해 취소한다(호출부가 gross로 환산).
 */

export const SESSIONS_PER_MONTH = 4;

export interface RefundInput {
  /** 진행한 회차 수(완료 + 결석). */
  consumed: number;
  /** 과정 개월 수(12주 3, 24주 6). */
  courseMonths: number;
  /** 월 수강료(공급가). */
  monthlyAmount: number;
  /** 지금까지 받은 수강료(부가세를 뺀 값, 환불된 것은 뺀다). */
  paidNet: number;
}

export interface RefundResult {
  /** 해지한 달(1부터). 첫 수업 전이면 0. */
  currentMonth: number;
  /** 그 달에서 진행한 회차(1~4). 첫 수업 전이면 0. */
  sessionsInMonth: number;
  /** 해지한 달 수강료 중 수강생에게 돌려줄 몫의 분수(분자/분모). */
  refundShare: { numerator: number; denominator: number };
  /** 돌려주지 않고 스튜디오가 가지는 수강료(원 단위 미만은 수강생에게 유리하게 버린다). */
  retained: number;
  /** 낸 돈에서 retained를 뺀 환불액. */
  refund: number;
  /** 낸 돈이 retained보다 적을 때 모자란 수강료. */
  shortfall: number;
  /** 사람이 읽는 계산 근거. */
  note: string;
}

export const refundOf = (input: RefundInput): RefundResult => {
  const consumed = Math.max(0, Math.floor(input.consumed));
  const month = input.monthlyAmount;
  if (consumed === 0) {
    return { currentMonth: 0, sessionsInMonth: 0, refundShare: { numerator: 1, denominator: 1 }, retained: 0, refund: Math.max(0, input.paidNet), shortfall: 0, note: '첫 수업 전 — 낸 수강료 전액' };
  }
  const maxConsumed = input.courseMonths * SESSIONS_PER_MONTH;
  const capped = Math.min(consumed, maxConsumed);
  const currentMonth = Math.ceil(capped / SESSIONS_PER_MONTH);
  const sessionsInMonth = capped - (currentMonth - 1) * SESSIONS_PER_MONTH;
  // 1회(1/4 < 1/3) → 2/3, 2회(1/2) → 1/2, 3회 이상 → 0. 돌려주지 않을 몫이 스튜디오가 가지는 몫이다.
  const share = sessionsInMonth === 1 ? { numerator: 2, denominator: 3 } : sessionsInMonth === 2 ? { numerator: 1, denominator: 2 } : { numerator: 0, denominator: 1 };
  const currentMonthKept = Math.floor((month * (share.denominator - share.numerator)) / share.denominator);
  const retained = (currentMonth - 1) * month + currentMonthKept;
  const refund = Math.max(0, input.paidNet - retained);
  const shortfall = Math.max(0, retained - input.paidNet);
  const shareText = share.numerator === 0 ? '돌려주지 않음' : `${share.denominator === 3 ? '3분의 2' : '2분의 1'} 돌려줌`;
  return { currentMonth, sessionsInMonth, refundShare: share, retained, refund, shortfall, note: `${currentMonth}번째 달 ${sessionsInMonth}회 진행 — 그 달 수강료 ${shareText}, 이후 달은 전액` };
};
