/**
 * 확정 거절로 간주하는 토스 코드. lib/booking/confirm.ts의 정의를 의도적으로 복제한다
 * (import-graph 결합을 피하는 이 저장소의 기존 관행 — lib/funding/service.ts의 rowsAffectedOf와 동일 이유).
 */
export const DECLINE_CODE_PATTERN =
  /^(REJECT_|INVALID_REJECT_CARD|EXCEED_MAX_|INVALID_CARD|INVALID_STOPPED_CARD$|INVALID_ACCOUNT_INFO|NOT_ENOUGH_BALANCE$|NOT_AVAILABLE_BANK$|CARD_PROCESSING_ERROR$|PAY_PROCESS_(CANCELED|ABORTED)$)/;

/** cancelReason 앞에 붙인 `[#<key>] ...` 형식에서 key를 추출한다. */
export function parseLeadingTag(cancelReason: string | undefined | null): string | null {
  if (!cancelReason) return null;
  const match = /^\[#([^\]]+)\]/.exec(cancelReason);
  return match ? match[1] : null;
}
