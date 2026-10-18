import type { ProductionContract, ProductionContractStatus } from '../../../db/schema';

/**
 * 제작 계약 상태 전이. 연습실(lib/contracts/status.ts)과 같은 뼈대에 completed가 더해졌다.
 *
 *   draft ──발송(=운영자 서명)──▶ sent ──의뢰인 서명──▶ signed ──최종 인도──▶ completed
 *     │                            │ ▲                    │
 *     │취소                        │ │재발송               └──해지──▶ terminated
 *     ▼                            ▼ │
 *   cancelled                    expired
 *
 * 서명된 계약의 문서(본문·서명·지문)는 손댈 수 없다. 끝난 사실과 그 날짜만 적는다 — 그 날짜가
 * 개인정보 보관 기간(3년)의 기산점이다.
 */
export type ProductionContractAction =
  | 'send'
  | 'resend'
  | 'resend-signed'
  | 'cancel'
  | 'update'
  | 'delete'
  | 'sign'
  | 'complete'
  | 'terminate';

const ALLOWED_STATUSES: Record<ProductionContractAction, readonly ProductionContractStatus[]> = {
  send: ['draft'],
  /**
   * 연습실과 달리 cancelled는 재발송하지 않는다. 운영자 서명은 "이 문서를 보낸다"는 의사표시인데,
   * 취소한 계약을 되살리는 것은 새 의사표시라 새 계약으로 만드는 편이 기록이 깨끗하다.
   */
  resend: ['sent', 'expired'],
  'resend-signed': ['signed', 'completed', 'terminated'],
  cancel: ['draft', 'sent', 'expired'],
  // 발송 후에는 본문을 고칠 수 없다. 바꿔야 하면 취소하고 새로 만든다.
  update: ['draft'],
  delete: ['draft', 'cancelled'],
  sign: ['sent'],
  complete: ['signed'],
  terminate: ['signed'],
};

const ACTION_LABEL: Record<ProductionContractAction, string> = {
  send: '발송',
  resend: '재발송',
  'resend-signed': '완료 메일 재발송',
  cancel: '취소',
  update: '수정',
  delete: '삭제',
  sign: '서명',
  complete: '완료 처리',
  terminate: '해지 처리',
};

const STATUS_LABEL: Record<ProductionContractStatus, string> = {
  draft: '작성중',
  sent: '서명 대기',
  signed: '진행중',
  cancelled: '취소됨',
  expired: '만료됨',
  completed: '완료',
  terminated: '해지됨',
};

export const getProductionStatusLabel = (status: ProductionContractStatus): string =>
  STATUS_LABEL[status] ?? status;

export const isProductionActionAllowed = (
  status: ProductionContractStatus,
  action: ProductionContractAction,
): boolean => ALLOWED_STATUSES[action].includes(status);

export const checkProductionAction = (
  status: ProductionContractStatus,
  action: ProductionContractAction,
): { ok: true } | { ok: false; message: string } =>
  isProductionActionAllowed(status, action)
    ? { ok: true }
    : { ok: false, message: `${STATUS_LABEL[status]} 상태의 계약은 ${ACTION_LABEL[action]}할 수 없습니다.` };

/** 서명이 끝난 문서가 있는 상태 — 완료 화면·PDF 내려받기가 열리는 상태다. */
export const SIGNED_DOCUMENT_STATUSES: readonly ProductionContractStatus[] = ['signed', 'completed', 'terminated'];

export const hasSignedDocument = (status: ProductionContractStatus): boolean =>
  SIGNED_DOCUMENT_STATUSES.includes(status);

/** 만료는 연습실과 같이 접근 시점에 판정한다(lazy). 기한은 연습실 서명 링크와 같은 7일이다. */
export const isProductionExpired = (
  contract: Pick<ProductionContract, 'status' | 'expiresAt'>,
  now: Date = new Date(),
): boolean =>
  contract.status === 'sent' && contract.expiresAt !== null && contract.expiresAt.getTime() <= now.getTime();

export const getEffectiveProductionStatus = (
  contract: Pick<ProductionContract, 'status' | 'expiresAt'>,
  now: Date = new Date(),
): ProductionContractStatus => (isProductionExpired(contract, now) ? 'expired' : contract.status);
