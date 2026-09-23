import type { ProjectState } from './projects';

export const TOSS_HOLD_SECONDS = 900;
export const MAX_QUANTITY = 10;
export const MAX_ADDITIONAL_AMOUNT = 5_000_000;
export const ADDITIONAL_AMOUNT_STEP = 1000;
export const PRIVACY_RETENTION_TEXT = '리워드 전달 완료 후 1년';
/**
 * 정산 시점 — 모금 마감으로부터 이 영업일 수 뒤. 운영자 결정(2026-09-23).
 *
 * 코드가 이 시점을 강제하지는 않는다(운영자가 관리자 화면에서 기록·지급을 누른다).
 * 개설자에게 안내하는 문구가 이 상수를 읽는다 — 신청 화면과 편집 화면 두 곳에 같은 숫자가
 * 나가므로 문자열로 박으면 갈라진다.
 */
export const FUNDING_PAYOUT_BUSINESS_DAYS = 14;

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

export type CancelEligibility =
  | { ok: true }
  | { ok: false; code: 'not_paid' | 'project_not_live' | 'fulfilling' | 'offline_payment' | 'downloaded' };

/**
 * 셀프 취소 가능 판정 — 스펙 §4.7. 셀프·관리자 화면이 같은 함수를 쓴다.
 *
 * `paymentMethod`를 함께 보는 이유: 토스 결제가 아닌 후원은 취소할 결제가 없어 환불이
 * 계좌 송금이다. 그걸 안 보면 화면이 "전액 환불" 버튼을 띄우는데 눌러도 cancel.ts가
 * 거절한다 — 죽은 버튼이다. 지금 이 경우는 운영자가 계좌로 받아 수기 등록한 건과
 * 무통장입금 중단(2026-09-11) 전에 만들어진 건 둘뿐이다.
 *
 * **필수 인자로 둔다.** 이 버그가 들어온 자리는 manage 페이지 getServerSideProps의 한
 * 줄이었고, 선택 인자면 그 줄에서 빼먹어도 컴파일도 테스트도 통과한다. 값은 두 호출부
 * 모두 손에 쥐고 있으므로 필수로 두는 비용이 없다 — 재발을 타입이 막게 한다.
 */
export const assessSelfCancel = (input: {
  orderStatus: string;
  projectState: ProjectState;
  fulfillmentStatus: string;
  paymentMethod: string;
  /**
   * 디지털 리워드를 처음 내려받은 시각. **필수 인자로 둔다** — 위 주석과 같은 이유다.
   * 선택 인자면 호출부에서 빼먹어도 컴파일이 통과하고, 그 순간 이 규칙이 조용히 사라진다.
   */
  downloadedAt: Date | null;
}): CancelEligibility => {
  if (input.orderStatus !== 'paid') return { ok: false, code: 'not_paid' };
  if (input.paymentMethod !== 'toss') return { ok: false, code: 'offline_payment' };
  if (input.projectState !== 'live') return { ok: false, code: 'project_not_live' };
  if (input.fulfillmentStatus !== 'none') return { ok: false, code: 'fulfilling' };
  // 약관 제8조 2항 — 내려받기가 시작된 뒤에는 청약철회가 제한된다(전자상거래법 제17조 2항 5호).
  // 배송 리워드의 `fulfilling`에 해당하는, 디지털 리워드의 '이미 건네준 상태'다.
  if (input.downloadedAt !== null) return { ok: false, code: 'downloaded' };
  return { ok: true };
};

export const CANCEL_BLOCK_MESSAGES: Record<Exclude<CancelEligibility, { ok: true }>['code'], string> = {
  not_paid: '결제가 확정된 펀딩만 취소할 수 있습니다.',
  project_not_live: '펀딩 마감 후에는 온라인 취소가 불가합니다. 청약철회는 약관에 따라 문의해 주세요.',
  fulfilling: '리워드 발송 준비가 시작되어 온라인 취소가 불가합니다. 문의해 주세요.',
  downloaded: '음원을 내려받은 뒤에는 청약철회가 제한됩니다(약관 제8조 2항). 문의해 주세요.',
  // 운영자가 계좌로 받아 수기 등록한 후원 — 토스에 취소할 결제가 없어 환불도 계좌 송금이다.
  // 화면에서 "전액 환불" 버튼을 띄우면 눌러도 실패하는 죽은 버튼이 된다.
  offline_payment: '계좌로 받은 펀딩은 화면에서 취소할 수 없습니다. 청약철회는 문의로 접수해 주시면 계좌로 환불해 드립니다.',
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
export const FUNDING_TERMS_VERSION = 'funding-terms-2026-09-23-r5';

/**
 * 전자상거래법 제6조·시행령 제6조의 거래기록 보존 의무 — 위 PRIVACY_RETENTION_TEXT의 예외다.
 * 약관 제13조와 처리방침 펀딩 절이 같은 문장을 본다(문자열 복제 금지).
 */
export const PRIVACY_LEGAL_RETENTION_TEXT =
  '전자상거래 등에서의 소비자보호에 관한 법률에 따라 계약·청약철회 기록과 대금 결제·재화 공급 기록은 5년, 소비자 불만·분쟁 처리 기록은 3년 동안 보관합니다.';

/**
 * 개설자 약관 판본. 후원자 쪽 `FUNDING_TERMS_VERSION`과 같은 취지지만 대상이 다르다 —
 * 이건 "펀딩을 개설하는" 아티스트가 동의하는 약관이다.
 *
 * 본문은 `pages/[locale]/funding/creator-terms.tsx`의 `FUNDING_CREATOR_TERMS_SECTIONS`다.
 * 이 값이 빈 문자열이 아니게 되는 순간부터 심사 신청 API(`projects/[id]/submit.ts`)가
 * `agreedTermsVersion`을 요구하고, 개설자 편집 화면도 동의 체크박스와 약관 링크를 렌더한다.
 * 본문 없는 동의는 "그때 이 내용에 동의했다"는 증거가 될 수 없으므로(FUNDING_TERMS_VERSION
 * 위 주석과 같은 이유), 본문이 붙기 전까지는 동의를 받지 않았다.
 *
 * **이 규칙도 후원자 쪽과 같은 방식으로 테스트가 강제한다** —
 * `content/creatorTerms.baseline.test.ts`가 조항 전체를 직렬화해 해시하고
 * `content/creator-terms.baseline.json`의 해시와 대조한다. 내용이 바뀌었는데 이 문자열이
 * 그대로면 CI가 선다. 갱신 경로도 같은 규칙을 지킨다(`assertCreatorTermsBaselineUpdateAllowed`).
 *
 * 형식은 `funding-creator-terms-YYYY-MM-DD`이고, 같은 날 두 번째 개정부터 `-r2`·`-r3` 접미사를 붙인다.
 *
 * `: string` 타입 주석을 명시로 둔다 — 이 값을 리터럴 타입으로 좁혀 두면 다음 개정에서
 * 판본 문자열을 갱신할 때마다 타입 에러가 난다.
 */
export const FUNDING_CREATOR_TERMS_VERSION: string = 'funding-creator-terms-2026-09-23-r5';

/** 후원 시 수집하는 항목 — PledgeWizard가 실제로 전송하고 funding_pledges·orders에 저장되는 필드와 1:1이다. */
export const FUNDING_COLLECTED_ITEMS: readonly string[] = [
  '필수 — 서포터 이름, 연락처(휴대전화), 이메일 주소',
  '배송 리워드를 선택한 경우 — 받는 분, 연락처, 우편번호, 주소, 상세주소, 배송 메모',
  '선택 — 응원 메시지, 서포터 명단 공개(이름·응원 메시지) 동의 여부',
  '자동 생성 — 주문번호, 펀딩 리워드·수량·금액, 결제수단, 결제·환불 처리 기록',
];

/** 후원 처리 목적 — 수집한 항목을 쓰는 범위. */
export const FUNDING_COLLECTION_PURPOSES: readonly string[] = [
  '펀딩(리워드 선주문) 계약의 성립·결제·취소·환불 처리',
  '펀딩 확정·환불 안내 메일 발송과 리워드 제작·배송 진행 상황 고지',
  '배송 리워드의 발송과 배송 문의 응대',
  '서포터 명단 공개에 동의한 경우 프로젝트 페이지에 이름과 응원 메시지 표시',
];

/**
 * 처리위탁 현황. 실제 구성에서 온다 — 토스 결제 위젯(components TossPaymentWidget),
 * Resend REST API(lib/email/resend.ts), Vercel 호스팅, Turso(libsql, db/client.ts).
 */
export const FUNDING_DATA_PROCESSORS: ReadonlyArray<{ name: string; purpose: string; items: string }> = [
  { name: '토스페이먼츠', purpose: '결제 승인·취소·환불 처리', items: '서포터 이름, 이메일, 주문번호, 결제 금액·결제수단 정보' },
  { name: 'Resend', purpose: '펀딩 확정·취소 안내 메일 발송', items: '이메일 주소, 메일 본문에 담기는 펀딩 내역' },
  { name: 'Vercel', purpose: '웹사이트·주문 처리 서버 호스팅', items: '서비스 이용 과정에서 전송되는 위 항목 전부' },
  { name: 'Turso', purpose: '펀딩 기록 데이터베이스 보관', items: '위 수집 항목 전부' },
  // 내려받기 게이트(pages/api/funding/download.ts)가 서명된 주소로 302 리디렉션을 보내므로,
  // 후원자의 브라우저가 Cloudflare에 직접 붙는다(lib/funding/r2.ts). 파일 자체에 개인정보는
  // 없지만 그 요청의 접속 정보가 Cloudflare를 지난다 — 그래서 수탁자 표에 싣는다.
  { name: 'Cloudflare', purpose: '디지털 리워드 파일 보관 및 내려받기 제공', items: '내려받기 요청 시 전송되는 접속 정보(IP 주소, 브라우저 정보)' },
  // 유형으로 적는다 — 개설자는 프로젝트마다 다른 개인·팀이라 회사 이름처럼 미리 열거할 수
  // 없다. 위탁 업무는 실제로 하는 일만 적는다: 배송 리워드의 발송과 그에 따른 문의 응대
  // (lib/funding/fulfillment.ts가 개설자에게 여는 쓰기는 발송 상태·택배사·운송장뿐이다).
  // 항목은 CreatorShippingRow(lib/funding/creatorShipping.ts)의 화이트리스트 그대로다 —
  // 이메일·결제 금액·결제수단·주문번호·응원 메시지는 그 행에 담기지 않으므로 여기에도 없다.
  // 제공 시점은 모금 마감 뒤다(같은 파일 loadCreatorShipping의 state !== 'closed' 분기).
  {
    name: '프로젝트 개설자(펀딩 프로젝트를 직접 등록한 아티스트)',
    purpose: '배송 리워드의 발송과 배송 문의 응대',
    items: '모금 마감 뒤, 배송 리워드를 선택한 후원 건의 받는 분 이름, 연락처, 우편번호, 주소, 상세주소, 배송 메모와 그 후원의 리워드 이름·수량·발송 상태·택배사·운송장번호',
  },
];

/**
 * 개설자(아티스트) 계정 정보의 처리위탁 현황 — 위 FUNDING_DATA_PROCESSORS(서포터)와 대상이
 * 다르다. 처리방침 4항이 "개설자 계정 정보는 아래 항들이 [처리위탁을] 따로 정합니다"라고
 * 가리키는데(지금은 13~15항이다), 그 항들이 신설됐을 때 수집 항목·이용 목적만 적고 이 표를 빠뜨려 참조가 빈 곳을
 * 가리키고 있었다(2026-09-21 문서·코드 대조).
 *
 * Resend로 나가는 개설자 대상 메일은 네 갈래다 — 로그인 링크(creatorEmail.ts), 계정 변경 알림
 * (같은 파일, 이름·로그인 이메일이 바뀌면 옛·새 주소 양쪽으로), 심사 결과와 공개 상태 변경
 * (reviewEmail.ts), 정산 기록·지급 알림(payoutEmail.ts). 목적을 좁게 적어 두면 실제로 나가는
 * 메일이 고지 범위를 넘어선다 — 정산 알림이 붙었을 때 실제로 그렇게 됐다(2026-09-23).
 * db/client.ts(Turso)에 개설자 계정·프로젝트·정산 기록 행이 저장되며, Vercel이 그 화면을 호스팅한다 —
 * 셋 다 서포터 쪽과 같은 수탁자이지만 다루는 개인정보가 다르므로 표를 따로 둔다.
 */
export const FUNDING_CREATOR_DATA_PROCESSORS: ReadonlyArray<{ name: string; purpose: string; items: string }> = [
  {
    name: 'Resend',
    purpose: '로그인 링크·심사 결과·공개 상태 변경·계정 변경·정산 안내 메일 발송',
    items:
      '이메일 주소, 메일 본문에 담기는 로그인 링크·심사 결과·공개 상태 변경 안내와 운영자 메모·바뀐 계정 정보(이름 또는 로그인 이메일)와 ' +
      '정산 금액 내역(모금액·환불액·수수료·원천징수액·실지급액·확정 후원 건수), 입금 계좌의 은행명·예금주·계좌번호 뒤 4자리',
  },
  { name: 'Turso', purpose: '개설자 계정·프로젝트·정산 기록 데이터베이스 보관', items: '위 13항 수집 항목 전부' },
  { name: 'Vercel', purpose: '개설자 화면 서버 호스팅', items: '개설자 화면 이용 과정에서 전송되는 위 항목 전부' },
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
