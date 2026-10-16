/**
 * 공연 정산 지급 뒤 환불로 생긴 초과 지급(회수 필요) — **순수**(db 없음, 화면도 가져간다).
 *
 * 상점은 기록 뒤 환불을 다음 정산에서 `late_refund`로 상계하지만, 공연은 정산이 공연당 한 번(period 'all')이라 다음 정산이 없다.
 * 새 표·컬럼 없이 `partner_payouts.memo`에 한 줄씩 적는 것으로 "운영자가 회수 요청을 처리했다"를 남기고,
 * 점검(healthCheck)은 그 줄의 금액 합이 지금 초과 지급액을 덮는지로 처리 여부를 판정한다 — 나중에 환불이 더 생기면 다시 울린다.
 *
 * 줄 형식: `[회수 처리 N원 · <처리자> · YYYY-MM-DD] 메모` — 파싱은 앞 `[회수 처리 N원`만 본다.
 */

const ACK_PATTERN = /\[회수 처리 ([\d,]+)원/g;

/** 메모 안의 `[회수 처리 N원` 줄들의 금액 합. */
export const parseAcknowledgedAmount = (memo: string | null | undefined): number => {
  if (!memo) return 0;
  let sum = 0;
  for (const m of memo.matchAll(ACK_PATTERN)) sum += Number(m[1].replace(/,/g, ''));
  return sum;
};

/** 운영자가 적은 자유 메모가 처리 줄을 흉내 내지 못하게 대괄호를 괄호로 바꾼다. */
export const sanitizeAckMemo = (memo: string): string => memo.replace(/\[/g, '(').replace(/\]/g, ')').replace(/\s+/g, ' ').trim();

export const formatAckLine = (amount: number, actor: string, dateKst: string, memo: string): string =>
  `[회수 처리 ${amount}원 · ${sanitizeAckMemo(actor)} · ${dateKst}] ${sanitizeAckMemo(memo)}`;

/** 지금 초과 지급액 중 아직 처리 줄로 덮이지 않은 몫(0 이상). */
export const remainingOverpaid = (overpaidAmount: number, memo: string | null | undefined): number =>
  Math.max(0, overpaidAmount - parseAcknowledgedAmount(memo));
