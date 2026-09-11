import type { ProjectState } from './projects';

export const TOSS_HOLD_SECONDS = 900;
export const MAX_QUANTITY = 10;
export const MAX_ADDITIONAL_AMOUNT = 5_000_000;
export const ADDITIONAL_AMOUNT_STEP = 1000;
export const PRIVACY_RETENTION_TEXT = '리워드 전달 완료 후 1년';

/**
 * "후원자가 취소를 요청했는데 아직 돈이 안 나간" 상태로 볼 orders.status 집합.
 *
 * **지금은 새로 만들어지지 않는다.** 이 상태를 만들던 것은 무통장입금 셀프 취소뿐이었고,
 * 그 결제수단은 2026-09-11에 중단했다. 중단 전에 만들어진 행을 위해 판정·알람은 남겨 둔다.
 * partially_refunded도 포함하는 이유: 잔액이 남은 건은 여전히 환불이 덜 끝난 것이라
 * 알람이 꺼지면 안 되고, 그 잔액을 정리하는 경로(관리자 환불)도 열려 있어야 한다.
 * refunded로 넘어가면 refundRequestedAt은 그대로 남지만(cancel.ts는 지우지 않는다)
 * 처리가 끝난 것이므로 여기서 빠진다 — 이 집합을 안 쓰면 첫 환불을 처리한 다음 날부터
 * 배너·배지·헬스체크가 영구히 켜져 신호가 죽는다.
 *
 * 관리자 목록 배지·배너(admin-serialize), 헬스체크, clear_refund_request가 모두 이
 * 하나를 본다. 셋이 갈리면 화면·메일·API가 서로 다른 사실을 말하게 된다.
 */
export const REFUND_PENDING_ORDER_STATUSES = ['paid', 'partially_refunded'] as const;

export const isRefundPendingStatus = (status: string): boolean =>
  (REFUND_PENDING_ORDER_STATUSES as readonly string[]).includes(status);

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
 *
 * **이 규칙은 주석이 아니라 테스트가 강제한다** — `content/fundingTerms.baseline.test.ts`가
 * 약관 조항 + ko 처리방침 + 아래 공유 상수들을 직렬화해 해시하고,
 * `content/funding-terms.baseline.json`의 해시와 대조한다. 내용이 바뀌었는데 이 문자열이
 * 그대로면 CI가 선다. 갱신 절차는 그 테스트의 실패 메시지에 적혀 있다. 갱신 **경로 자체도**
 * 같은 규칙을 지킨다 — 내용이 바뀌었는데 이 문자열이 그대로면 기준선을 쓰지 않고 던진다
 * (`assertBaselineUpdateAllowed`). 검사 모드만 막으면 자물쇠 옆에 열쇠를 걸어 두는 셈이다.
 *
 * 형식은 `funding-terms-YYYY-MM-DD`이고, **같은 날 두 번째 개정부터 `-r2`·`-r3` 접미사**를 붙인다.
 * 날짜만으로는 하루에 두 번 고친 것을 구분할 수 없어 게이트를 통과시킬 방법이 없어진다 —
 * r2가 실제로 그 경우였다(#63이 처리방침에 언론 홍보 3개 항을 더한 날 이 게이트가 도입됐다).
 */
export const FUNDING_TERMS_VERSION = 'funding-terms-2026-09-11-r5';

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

/**
 * 펀딩 약관 §13이 가리키는 처리방침 항 제목 — ko 처리방침의 정본 문구를 그대로 옮긴 것.
 *
 * 왜 베껴 두는가: 약관 페이지가 처리방침 정본에서 직접 골라 쓰면 동기화는 공짜로 얻지만,
 * 약관 페이지 번들에 **7개 로케일 처리방침 본문 전체**가 딸려 온다(실측으로 확인했다 —
 * uz 문구까지 약관 청크에 들어 있었다). 트리셰이킹은 파생값의 원본을 떨어내지 못한다.
 *
 * 그래서 목록은 여기(양쪽이 이미 가져다 쓰는 작은 모듈)에 두고, 동기화는 주석이 아니라
 * 테스트로 강제한다 — content/fundingTermsHash.test.ts가 이 배열이 ko 처리방침에서 실제로
 * 뽑히는 항 제목과 정확히 같은지 대조한다. 처리방침에서 항을 추가·개명·재번호하면 그
 * 테스트가 CI에서 먼저 선다.
 *
 * **이 값은 약관 §13 본문에 보간되므로 해시 대상이다.** 바꾸면 FUNDING_TERMS_VERSION을
 * 먼저 올린 뒤 기준선을 다시 쓴다.
 */
export const FUNDING_PRIVACY_SECTION_HEADINGS: readonly string[] = [
  '6. 펀딩(리워드 선주문) 수집 항목',
  '7. 펀딩 개인정보의 이용 목적',
  '8. 펀딩 개인정보의 보유·이용 기간',
  '9. 펀딩 개인정보의 처리위탁',
];
