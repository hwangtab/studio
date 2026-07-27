import type { Contract } from '../../db/schema';

export type ContractStatus = Contract['status'];

/**
 * 계약 상태 전이 규칙.
 *
 *   draft ──발송──▶ sent ──서명──▶ signed
 *     │              │ ▲
 *     │취소          │ │재발송(토큰·만료 갱신)
 *     ▼              ▼ │
 *   cancelled      expired
 *
 * signed는 종착 상태다. 서명된 계약은 수정·취소·삭제할 수 없다(법적 보존).
 */
export type ContractAction = 'send' | 'resend' | 'cancel' | 'update' | 'delete' | 'sign';

const ALLOWED_STATUSES: Record<ContractAction, readonly ContractStatus[]> = {
  send: ['draft'],
  resend: ['sent', 'expired', 'cancelled'],
  cancel: ['draft', 'sent', 'expired'],
  // 서명 대상 문서의 무결성을 위해 발송 후에는 본문을 고칠 수 없다.
  // 내용을 바꿔야 하면 취소하고 새 계약을 만든다.
  update: ['draft'],
  delete: ['draft', 'cancelled'],
  sign: ['sent'],
};

const ACTION_LABEL: Record<ContractAction, string> = {
  send: '발송',
  resend: '재발송',
  cancel: '취소',
  update: '수정',
  delete: '삭제',
  sign: '서명',
};

const STATUS_LABEL: Record<ContractStatus, string> = {
  draft: '작성중',
  sent: '발송완료',
  signed: '서명완료',
  cancelled: '취소됨',
  expired: '만료됨',
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
