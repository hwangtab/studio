import type { LessonContract } from '../../../db/schema';

/**
 * 수강 계약 상태 전이.
 *
 *   draft ──발송(=운영자 서명)──▶ sent ──수강생 서명──▶ signed
 *     │                            │ ▲
 *     │취소                        │ │재발송
 *     ▼                            ▼ │
 *   cancelled                    expired
 *
 * 서명된 계약의 문서(본문·서명·지문)는 손댈 수 없다. 바꿔야 하면 새 계약으로.
 */
export type LessonContractStatus = LessonContract['status'];
export type LessonContractAction = 'send' | 'resend' | 'cancel' | 'update' | 'sign';

const ALLOWED: Record<LessonContractAction, readonly LessonContractStatus[]> = {
  send: ['draft'],
  resend: ['sent', 'expired'],
  cancel: ['draft', 'sent', 'expired'],
  update: ['draft'],
  sign: ['sent'],
};

const ACTION_LABEL: Record<LessonContractAction, string> = { send: '발송', resend: '재발송', cancel: '취소', update: '수정', sign: '서명' };
export const LESSON_STATUS_LABEL: Record<LessonContractStatus, string> = { draft: '작성중', sent: '서명 대기', signed: '체결', cancelled: '취소됨', expired: '만료됨' };

export const checkLessonAction = (status: LessonContractStatus, action: LessonContractAction): { ok: true } | { ok: false; message: string } =>
  ALLOWED[action].includes(status) ? { ok: true } : { ok: false, message: `${LESSON_STATUS_LABEL[status]} 상태의 계약은 ${ACTION_LABEL[action]}할 수 없습니다.` };

/** 만료는 접근 시점에 판정한다(lazy). */
export const getEffectiveLessonStatus = (contract: Pick<LessonContract, 'status' | 'expiresAt'>, now: Date = new Date()): LessonContractStatus =>
  contract.status === 'sent' && contract.expiresAt !== null && contract.expiresAt.getTime() <= now.getTime() ? 'expired' : contract.status;
