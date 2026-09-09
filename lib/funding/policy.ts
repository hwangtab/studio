import type { ProjectState } from './projects';

export const TOSS_HOLD_SECONDS = 900;
export const BANK_HOLD_SECONDS = 12 * 60 * 60;
export const MAX_QUANTITY = 10;
export const MAX_ADDITIONAL_AMOUNT = 5_000_000;
export const ADDITIONAL_AMOUNT_STEP = 1000;
/** 전자계약 기본 계좌와 동일(db/schema.ts contracts 기본값). */
export const BANK_ACCOUNT = { bank: '카카오뱅크', number: '3333-12-5480849', holder: '황경하 / 스튜디오 놀' } as const;
export const PRIVACY_RETENTION_TEXT = '리워드 전달 완료 후 1년';

export type CancelEligibility = { ok: true } | { ok: false; code: 'not_paid' | 'project_not_live' | 'fulfilling' };

/** 셀프 취소 가능 판정 — 스펙 §4.7. 셀프·관리자 화면이 같은 함수를 쓴다. */
export const assessSelfCancel = (input: { orderStatus: string; projectState: ProjectState; fulfillmentStatus: string }): CancelEligibility => {
  if (input.orderStatus !== 'paid') return { ok: false, code: 'not_paid' };
  if (input.projectState !== 'live') return { ok: false, code: 'project_not_live' };
  if (input.fulfillmentStatus !== 'none') return { ok: false, code: 'fulfilling' };
  return { ok: true };
};

export const CANCEL_BLOCK_MESSAGES: Record<Exclude<CancelEligibility, { ok: true }>['code'], string> = {
  not_paid: '결제가 확정된 후원만 취소할 수 있습니다.',
  project_not_live: '펀딩 마감 후에는 온라인 취소가 불가합니다. 청약철회는 약관에 따라 문의해 주세요.',
  fulfilling: '리워드 발송 준비가 시작되어 온라인 취소가 불가합니다. 문의해 주세요.',
};
