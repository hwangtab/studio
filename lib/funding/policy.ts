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

/**
 * 후원자가 동의한 약관·처리방침 묶음의 버전. `funding_pledges.terms_version`에 그대로 들어간다.
 *
 * 같은 체크박스(PledgeWizard)가 **펀딩 약관과 개인정보 처리방침 두 문서**를 함께 동의받으므로,
 * 둘 중 하나라도 내용이 바뀌면 날짜를 올려야 한다. 페이지가 아니라 여기 두는 이유: 이 값을
 * 쓰는 곳이 INSERT 경로(lib/funding/service.ts)라, 페이지 모듈에 두면 서버 함수가 React 페이지를
 * 끌고 들어온다. terms.tsx가 이 상수를 import해 화면에 표시한다.
 */
export const FUNDING_TERMS_VERSION = 'funding-terms-2026-09-11';

/**
 * 전자상거래법 제6조·시행령 제6조의 거래기록 보존 의무 — 위 PRIVACY_RETENTION_TEXT의 예외다.
 * 약관 제13조와 처리방침 펀딩 절이 같은 문장을 본다(문자열 복제 금지).
 */
export const PRIVACY_LEGAL_RETENTION_TEXT =
  '전자상거래 등에서의 소비자보호에 관한 법률에 따라 계약·청약철회 기록과 대금 결제·재화 공급 기록은 5년, 소비자 불만·분쟁 처리 기록은 3년 동안 보관합니다.';

/** 후원 시 수집하는 항목 — PledgeWizard가 실제로 전송하고 funding_pledges·orders에 저장되는 필드와 1:1이다. */
export const FUNDING_COLLECTED_ITEMS: readonly string[] = [
  '필수 — 후원자 이름, 연락처(휴대전화), 이메일 주소',
  '배송 리워드를 선택한 경우 — 받는 분, 연락처, 우편번호, 주소, 상세주소, 배송 메모',
  '선택 — 응원 메시지, 후원자 명단 이름 공개 동의 여부',
  '자동 생성 — 주문번호, 후원 리워드·수량·금액, 결제수단, 결제·환불 처리 기록',
];

/** 후원 처리 목적 — 수집한 항목을 쓰는 범위. */
export const FUNDING_COLLECTION_PURPOSES: readonly string[] = [
  '후원(리워드 선주문) 계약의 성립·결제·취소·환불 처리',
  '후원 확정·입금·환불 안내 메일 발송과 리워드 제작·배송 진행 상황 고지',
  '배송 리워드의 발송과 배송 문의 응대',
  '후원자 명단 공개에 동의한 경우 프로젝트 페이지에 이름 표시',
];

/**
 * 처리위탁 현황. 실제 구성에서 온다 — 토스 결제 위젯(components TossPaymentWidget),
 * Resend REST API(lib/email/resend.ts), Vercel 호스팅, Turso(libsql, db/client.ts).
 */
export const FUNDING_DATA_PROCESSORS: ReadonlyArray<{ name: string; purpose: string; items: string }> = [
  { name: '토스페이먼츠', purpose: '결제 승인·취소·환불 처리', items: '후원자 이름, 이메일, 주문번호, 결제 금액·결제수단 정보' },
  { name: 'Resend', purpose: '후원 확정·무통장입금·취소 안내 메일 발송', items: '이메일 주소, 메일 본문에 담기는 후원 내역' },
  { name: 'Vercel', purpose: '웹사이트·주문 처리 서버 호스팅', items: '서비스 이용 과정에서 전송되는 위 항목 전부' },
  { name: 'Turso', purpose: '후원 기록 데이터베이스 보관', items: '위 수집 항목 전부' },
];
