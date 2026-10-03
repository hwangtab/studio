/**
 * 계약의 `notificationError`를 읽는 자리 — 관리자 상세 화면과 운영 점검 크론이 같은 판정을 쓴다.
 *
 * 이 칸에는 고객 메일 실패와 운영자 알림 실패가 ` / `로 이어 붙어 들어간다(service.ts의 발송,
 * finalize.ts의 서명 완료 후처리). 운영자 알림만 실패한 경우를 고객 메일 실패처럼 읽으면 화면이
 * "재발송하세요"라고 안내하고, 서명 대기 계약은 재발송 순간 고객이 이미 받은 서명 링크가 죽는다.
 *
 * 순수 함수만 둔다 — 클라이언트 컴포넌트(관리자 상세)가 값으로 가져간다.
 */

/** 문구 조각을 잇는 구분자. 쓰는 쪽과 읽는 쪽이 같은 값을 써야 한다. */
export const NOTIFICATION_ERROR_SEPARATOR = ' / ';

/** 운영자 알림 메일 실패 조각의 머리말. 이 머리말로 시작하는 조각은 고객과 무관하다. */
export const OPERATOR_ALERT_FAILURE_PREFIX = '운영자 알림 메일 발송 실패';

export const describeOperatorAlertFailure = (errorCode: string | undefined): string =>
  `${OPERATOR_ALERT_FAILURE_PREFIX} (${errorCode ?? 'UNKNOWN'})`;

export type ContractNotificationProblem =
  /** 기록된 문제가 없다. */
  | 'none'
  /** 운영자 알림만 실패했다 — 고객 메일은 정상 발송됐다. 재발송할 이유가 없다. */
  | 'operator_only'
  /** 고객이 메일(또는 PDF)을 받지 못했을 수 있다. */
  | 'customer';

export const classifyContractNotificationError = (
  value: string | null | undefined,
): ContractNotificationProblem => {
  if (!value || value.trim() === '') return 'none';
  const parts = value
    .split(NOTIFICATION_ERROR_SEPARATOR)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return 'none';
  return parts.every((part) => part.startsWith(OPERATOR_ALERT_FAILURE_PREFIX)) ? 'operator_only' : 'customer';
};

/**
 * 운영 점검에서 고객 쪽 알림 실패를 알릴 계약인가.
 *
 * 취소·만료된 계약과 개인정보가 파기된 계약은 이제 할 일이 없다 — 재발송도 서명도 없는 계약을
 * 매일 "알림이 나가지 않았다"고 세면 그 건수는 영영 줄지 않고 진짜 신호를 가린다.
 */
export const needsCustomerNotificationFollowUp = (contract: {
  status: string;
  purgedAt: Date | string | null;
  notificationError: string | null;
}): boolean =>
  contract.purgedAt === null &&
  contract.status !== 'cancelled' &&
  contract.status !== 'expired' &&
  classifyContractNotificationError(contract.notificationError) === 'customer';
