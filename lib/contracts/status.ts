import type { Contract } from '../../db/schema';
import { kstDateKey } from './format';

export type ContractStatus = Contract['status'];

/**
 * 계약 상태 전이 규칙.
 *
 *   draft ──발송──▶ sent ──서명──▶ signed ──종료──▶ terminated
 *     │              │ ▲
 *     │취소          │ │재발송(토큰·만료 갱신)
 *     ▼              ▼ │
 *   cancelled      expired
 *
 * 서명된 계약의 문서 자체는 손댈 수 없다(법적 보존). 다만 이용 관계는 언젠가 끝나므로,
 * 그 사실만 terminated로 적는다 — 본문·서명·지문은 그대로 두고 "언제 끝났는지"만 남긴다.
 */
export type ContractAction =
  | 'send'
  | 'resend'
  | 'resend-signed'
  | 'cancel'
  | 'update'
  | 'delete'
  | 'sign'
  | 'terminate';

const ALLOWED_STATUSES: Record<ContractAction, readonly ContractStatus[]> = {
  send: ['draft'],
  resend: ['sent', 'expired', 'cancelled'],
  /**
   * 서명 완료 메일·PDF 재발송. resend와 나눈 이유는 목적이 다르기 때문이다 —
   * resend는 서명 링크를 새로 보내며 토큰을 회전시키는데, 이미 서명된 계약에 그걸
   * 하면 확정된 문서의 접근 토큰이 바뀐다. 이쪽은 상태·토큰을 건드리지 않고
   * 완료 알림만 다시 만든다(PDF 생성 실패도 함께 복구된다).
   *
   * 없던 시절엔 서명 완료 메일이 실패해도 관리자에게 손이 없었다. 화면은 "재발송하거나
   * 서명 링크를 전달하라"고 안내했지만 signed 상태에는 두 버튼이 다 렌더되지 않았다.
   */
  'resend-signed': ['signed'],
  cancel: ['draft', 'sent', 'expired'],
  // 서명 대상 문서의 무결성을 위해 발송 후에는 본문을 고칠 수 없다.
  // 내용을 바꿔야 하면 취소하고 새 계약을 만든다.
  update: ['draft'],
  delete: ['draft', 'cancelled'],
  sign: ['sent'],
  terminate: ['signed'],
};

const ACTION_LABEL: Record<ContractAction, string> = {
  send: '발송',
  resend: '재발송',
  'resend-signed': '완료 메일 재발송',
  cancel: '취소',
  update: '수정',
  delete: '삭제',
  sign: '서명',
  terminate: '종료 처리',
};

const STATUS_LABEL: Record<ContractStatus, string> = {
  draft: '작성중',
  sent: '발송완료',
  signed: '서명완료',
  cancelled: '취소됨',
  expired: '만료됨',
  terminated: '이용종료',
};

/**
 * 이용이 끝났다고 적어야 하는 계약.
 *
 * 서명된 계약의 종료일이 지났는데 종료 처리가 없으면, 그 호실은 계속 점유로 남아 새 계약을
 * 만들 수 없다. 제3조의 자동 갱신 때문에 기간이 지났다는 사실만으로 방이 비었다고 볼 수는
 * 없으므로, 시스템이 임의로 끝내지 않고 운영자에게 확인을 요청한다.
 */
export const needsTermination = (
  // 서버(Date)와 화면(직렬화된 문자열) 양쪽에서 같은 판정을 써야 표시가 어긋나지 않는다.
  contract: {
    status: ContractStatus;
    endDate: Date | string;
    terminatedAt: Date | string | null;
  },
  now: Date | string = new Date(),
): boolean => {
  if (contract.status !== 'signed' || contract.terminatedAt !== null) return false;

  /**
   * 종료일 당일은 아직 이용 기간이다 — 종료 처리는 그 날이 지나야 필요하다.
   *
   * endDate는 UTC 자정(=KST 달력 날짜)으로 저장되므로 2026-09-30은 KST 9/30 09:00이다.
   * getTime() 단순 비교로는 KST 9/30 09:01(아직 마지막 날 오전)에 이미 "종료 처리 필요"가
   * 떠서, 그때 종료하면 terminatedAt이 마지막 날 오전으로 찍히고 그 호실로 하루 겹친 새
   * 계약을 만들 수 있게 된다. service.ts의 호실 충돌 검사는 종료일 당일을 포함(gte)으로
   * 보므로, 이 판정도 KST 달력 날짜로 맞춘다 — now의 KST 날짜가 종료일보다 엄밀히 뒤일 때만 참.
   */
  const endKey = kstDateKey(contract.endDate);
  const nowKey = kstDateKey(now);
  if (endKey === null || nowKey === null) return false;
  return nowKey > endKey;
};

export const getStatusLabel = (status: ContractStatus): string => STATUS_LABEL[status] ?? status;

export const isActionAllowed = (status: ContractStatus, action: ContractAction): boolean =>
  ALLOWED_STATUSES[action].includes(status);

export interface ActionCheckResult {
  ok: boolean;
  message?: string;
}

export const checkAction = (status: ContractStatus, action: ContractAction): ActionCheckResult => {
  if (isActionAllowed(status, action)) {
    return { ok: true };
  }
  return {
    ok: false,
    message: `${STATUS_LABEL[status]} 상태의 계약은 ${ACTION_LABEL[action]}할 수 없습니다.`,
  };
};

/** 서명 링크 유효 기간. 발송·재발송 시점으로부터 이 기간이 지나면 링크가 무효화된다. */
export const SIGN_TOKEN_TTL_DAYS = 7;

export const computeExpiresAt = (sentAt: Date): Date =>
  new Date(sentAt.getTime() + SIGN_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

/**
 * 만료 여부는 별도 크론 없이 접근 시점에 판정한다(lazy). 계약 건수가 적고, 만료 판정이
 * 필요한 시점이 곧 링크·목록에 접근하는 시점이기 때문이다.
 */
export const isExpired = (
  contract: Pick<Contract, 'status' | 'expiresAt'>,
  now: Date = new Date(),
): boolean => {
  if (contract.status !== 'sent') return false;
  if (!contract.expiresAt) return false;
  return contract.expiresAt.getTime() <= now.getTime();
};

/** 만료가 반영된 실효 상태. DB를 쓰지 않고 표시·검증에 쓴다. */
export const getEffectiveStatus = (
  contract: Pick<Contract, 'status' | 'expiresAt'>,
  now: Date = new Date(),
): ContractStatus => (isExpired(contract, now) ? 'expired' : contract.status);
