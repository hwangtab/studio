# 제작 용역 전자계약 시스템 — 설계 (2026-10-18)

배경·조항 분석은 `docs/production-contract-plan-2026-10.md`(검토). 이 문서는 그 검토를 구현 가능한 수준으로 내린 설계다.
첫 계약 종류는 `음원제작용역계약서_20261018.pdf`(싱글 1곡)이고, EP·정규는 같은 엔진에 종류(kind)만 더한다.

## 구현 현황 (2026-10-18)

**1단계(온라인 체결) 구현됨** — 이 문서와 다른 점:

- 표 이름은 `production_contracts`·`production_contract_signers`(마이그레이션 0070). 템플릿 사본은 별도 표가 아니라
  `production_contracts.template` 컬럼이다 — 표와 함께 생기므로 사본 없는 계약이 처음부터 없다.
- 동의 항목은 `clauses_json`으로 계약마다 떠 둔다. 진행 기록 표(`service_contract_events`)는 2단계에서 만든다.
- 코드는 `lib/contracts/production/`, 주소는 `/ko/contracts/production/[id]/sign`·`/complete`,
  관리자 `/admin/contracts/production`. `/contracts/` 아래에 둔 이유는 연습실 경로의 보호(no-store·측정 제외·
  사이트맵 제외)를 그대로 받기 위해서다.
- 운영자 서명은 직인 이미지 + 발송 행위 기록(관리자 계정·시각·IP).
- 만 19세 미만은 막는다(연습실 `validateSignerDetails` 재사용). 법정대리인 행은 스키마에만 있다.
- 9.4의 환불 경계 중 편곡(1차 시안 전달 = 완료)은 템플릿 제10조 3항에 들어갔다. 나머지는 2단계 계산 때 정한다.

**2단계(진행 기록) 구현됨** — `production_contract_events`(0071), `ledger.ts`(순수 계산), `events.ts`·`event-spec.ts`(기록 규칙),
`progress.ts`(기록·통지·기한 크론), 의뢰인 진행 페이지 `/ko/contracts/production/[id]/progress`, 관리자 상세의 "진행" 영역,
크론 `/api/cron/production-contract-deadlines`(매일 10:00 KST). 이 문서와 다른 점:

- 해지 정산 경계는 계약마다 `terms.refundSchedule[].milestones`로 굳고, 제10조 3항 문장도 같은 데이터로 만든다(운영자 결정
  2026-10-18: 편곡 1차 시안·믹싱 1차·보정 전달·녹음 세션 마침 = 전액, 기획·유통·홍보 = 착수 30% / 유통 등록 전액).
- 입금은 `payment_received` 하나(계약금·잔금은 누계로 판정). 기한 안내 발송도 `reminder_sent` 기록으로 남긴다.
- 진행 페이지는 연락처 뒷자리 확인 뒤 30일 쿠키(HMAC, `ADMIN_SESSION_SECRET`에서 용도 분리).
- 완료 처리는 최종 인도 기록이 있어야 한다.

**3단계 A 구현됨**(0072):
- 법정대리인 서명 — 운영자가 계약을 만들 때 대리인(이름·관계·이메일·연락처)을 지정하면 대리인에게 따로 링크가 가고,
  대리인은 자기 연락처 뒷자리로 본인 확인한다(운영자 증빙 확인 없음 — 운영자 결정 2026-10-18). 대리인이 지정된 계약만
  미성년 의뢰인을 받는다. 성립은 마지막 서명 뒤 **다시 읽은 상태로** 본문을 완성하고 지문(p2 — 서명자 연락처·관계 포함)을
  계산한다(`finalizeProductionContractIfComplete`). 계약일 = 마지막 서명일.
- 해지 환불 계좌 — 결제 공용 `refund_accounts`에 (production, 계약 id)로. 의뢰인이 진행 페이지에 적고, 관리자가
  "계좌번호 보기"로 연다(공용 handleRefundAccountView — 접속기록·예금주 불일치 경고).
- 견적 요약 붙여 넣기 — 견적 번호를 계약 제목에 남기고 계약과 어긋나는 답(EP·정규, 아이디어 단계, 펀딩)을 경고.

**3단계 B 구현됨**(0073, 계약서 문안 운영자 검토 대기):
- 계약 종류 `single`·`ep`(2~7곡)·`album`(6~20곡). terms v2가 음반 제목·수록곡 목록을 갖고, v1(싱글) 행은 읽을 때 v2로 올린다.
- EP·정규 계약서는 `release-template.md` — 싱글 문안에서 곡 수가 들어가는 문장만 바꿨다(머리말·요약/수록곡 표, 제2조,
  제4조 1항, 제5조 1·5항, 제6조 2항, 제7조 1항, 제11조 2항). 나머지 조항이 싱글과 같은지는 template.test.ts가 본다.
- 편곡·믹싱은 곡마다 단계(`production_contract_events.song`), 마스터링은 음반 한 번. 해지 환불의 경계 비율은
  "경계를 넘은 곡 수 / 전체 곡 수"만큼 적용한다(제10조 3항 "곡마다 … 그 곡의 몫").
- 기본 작업 기간 EP 12주·정규 20주는 운영자 확인 전 값이다.

## 0. 이 설계가 정해 둔 기본값

검토 문서 8장의 열린 질문에 아래 기본값을 넣고 설계했다. 바꾸면 해당 절만 고치면 된다.

| 질문 | 기본값 | 바꾸면 영향 |
|---|---|---|
| 미성년 의뢰인 | 1단계는 만 19세 미만 서명 차단(연습실과 같음). 표에는 `guardian` 역할을 미리 둔다 | 서명 흐름 6.3만 열면 됨 |
| 개인정보 보유 | 계약이 끝난 날(완료·해지) 부터 3년 후 파기 — 연습실 ⑫와 같은 기준 | `RETENTION_YEARS` 상수 하나 + 처리방침 문구 |
| 관할 | 템플릿은 연습실과 같이 "민사소송법에 따른다" + 1372·소비자원 안내로 맞춘다 | 템플릿 문구만 |
| 진행 중 항목의 환불 비율 | 편곡은 **1차 시안 전달 = 완료(100%)** — 운영자 결정 2026-10-18. 나머지 항목의 경계는 9.4 기본값, 확인 필요 | `terms.partialCredit`·완료 기준 값만 |
| 결과물 전달 | 파일은 지금처럼 드라이브 링크, 전달 사실·시각·메일 발송 결과를 시스템이 남긴다 | — |

## 1. 원칙

1. **기존 `contracts` 표와 연습실 코드는 건드리지 않는다.** 새 표 4개만 더한다. 기존 조회가 새 컬럼을 요구하지 않으므로
   마이그레이션 전에 배포해도 연습실 계약·결제 경로는 깨지지 않는다(0022·0035류 함정 없음). 새 화면만 표가 없다는 오류를 낸다.
2. **연습실 코드는 옮기지 않고 import한다.** `lib/contracts/`의 순수 모듈(본인 확인·서명 검증·이스케이프·KST 표기·IP·
   관리자 인증·PDF 렌더러·Blob 저장)을 그대로 불러 쓴다. 파일을 공용 폴더로 옮기는 정리는 두 시스템이 다 돌아간 뒤에 한다.
   예외 하나: 서명 캔버스는 `sign.tsx` 안에 직접 짜여 있어 `components/contracts/SignaturePad.tsx`로 먼저 뽑는다.
3. **계약 조건은 계약마다 굳힌다.** 작성 폼은 `data/pricing.ts` 상수로 미리 채우지만, 저장되는 값은 계약별 `terms_json`이다.
   기한 계산(7일·14일·30일·8주·4주)도 코드 상수가 아니라 **그 계약의 terms**에서 읽는다. 템플릿을 고쳐도 이미 맺은 계약의
   기한 계산은 바뀌지 않는다.
4. **진행 기록은 추가만 한다.** 고치지 않고 지우지 않는다. 잘못 적었으면 "앞 기록 무효" 이벤트를 새로 남긴다. 분쟁 때
   내놓을 수 있는 것은 고쳐지지 않은 기록뿐이다.
5. **기록한 시각과 일어난 시각을 나눈다.** 입금을 다음 날 확인해 적으면 `occurred_at`은 어제, `recorded_at`은 오늘이다.
   소급 기록은 화면과 감사추적에 "소급"으로 드러난다.
6. **증명할 수 없는 날짜로 자동 판정하지 않는다.** 전달 메일이 실패한 단계는 7일이 지나도 간주 승인을 자동으로 기록하지
   않고 운영자에게 알린다. 해지 통지도 자동으로 보내지 않는다.

## 2. 모듈 구조

```
lib/serviceContracts/
  kinds/
    index.ts                 종류 레지스트리 — kind → 정의
    productionSingle.ts      싱글 제작: terms 타입·검증·기본값(pricing 상수)·필수 동의·메일 요약 행
  templates/
    production-single.md     계약서 템플릿 (lib 아래 — 배포 파일 트레이싱, next.config.mjs에 경로 추가)
  render.ts                  템플릿 + terms + 서명자 정보 → 본문 (escapeTableCell, 함수형 치환)
  service.ts                 생성·초안 수정·발송(=운영자 서명)·취소·삭제·완료·해지
  status.ts                  계약 상태 전이 표
  signers.ts                 서명자 행 생성·토큰 회전·서명 순서 판정
  sign-transaction.ts        서명 확정 batch (조건부 UPDATE)
  integrity.ts               지문 'p1:' — 본문·terms·서명자 전원
  events.ts                  이벤트 추가·무효화·알림 결과 기록
  ledger.ts                  이벤트 → 현재 상태 계산 (순수 함수, DB 없음)
  deadlines.ts               기한 크론이 할 일 목록 계산 (순수) + 실행
  pdf-html.ts                계약서 HTML (lib/contracts/pdf.ts 렌더러 사용)
  email.ts                   메일 6종 (lib/email/resend)
  retention.ts               3년 파기
  portal-session.ts          의뢰인 진행 페이지 접근 (토큰 + 연락처 뒷자리 → 쿠키)

components/contracts/SignaturePad.tsx      sign.tsx에서 추출, 두 서명 화면 공용
components/serviceContracts/               진행 타임라인, 단계 카드, 금액·기한 요약
pages/admin/service-contracts/             목록·작성·상세(진행 기록)·수정
pages/[locale]/service-contracts/[id]/     sign · complete · index(진행 페이지)
pages/api/service-contracts/               아래 7장
pages/api/cron/service-contract-deadlines.ts
```

## 3. 데이터 모델

마이그레이션 하나(번호는 머지 시점의 다음 번호 — 지금 기준 0050). **`when`이 저널 최댓값보다 커야 한다**(CLAUDE.md
"작은 when은 조용히 건너뛴다"). 새 표만 만들므로 순서 함정은 없다.

### 3.1 `service_contracts` — 계약 1건

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | text PK | randomUUID |
| `kind` | text, CHECK in (`production-single`) | 종류. 늘 때 CHECK도 늘린다(SQLite는 표 재생성 — 그래서 4.1의 다른 방법도 적어 둔다) |
| `status` | text, CHECK | 4장 |
| `title` | text | 관리자용 제목(파기 대상) |
| `client_name` / `client_stage_name` | text | 실명 / 활동명(활동명은 서명 때 본인이 채울 수 있음) |
| `client_email` / `client_phone` | text | 연락처 뒷자리 확인의 기준 |
| `client_birthdate` / `client_address` | text null | 서명 때 본인이 채운다 |
| `terms_json` | text | 종류별 조건(5장). 발송 후 불변 |
| `content` | text | 본문. 서명 때 서명자 정보로 다시 만들어 확정 |
| `content_hash` | text null | `p1:<sha256>` |
| `total_amount` | integer | 목록·정렬용 사본(= terms.amount.total). 지문이 둘의 일치를 덮는다 |
| `sent_at` / `signed_at` / `completed_at` | timestamp | |
| `terminated_at` / `termination_reason` / `terminated_by` | | `client` / `studio` / `mutual` |
| `pdf_url` / `pdf_generated_at` | | Blob |
| `notification_error` / `notified_at` | | 연습실과 같은 실패 기록 |
| `purged_at` | timestamp null | |
| `created_at` / `updated_at` | | |

인덱스: `(status)`, `(client_phone)`, `(created_at)`.

### 3.2 `service_contract_templates` — 템플릿 사본

0046과 같다. `contract_id` PK, `template`, `template_hash`. 생성·초안 수정 때 저장하고 서명 때 이 사본으로 본문을 완성한다.
연습실과 달리 **표가 새로 생기는 것과 함께 만들어지므로 "사본 없는 옛 계약"이 없다** — 사본 저장 실패는 생성 실패로 처리한다
(연습실은 표가 나중에 생겨 실패를 삼켰다).

### 3.3 `service_contract_signers` — 서명자

| 컬럼 | 설명 |
|---|---|
| `id`, `contract_id` FK cascade | |
| `role` | CHECK in (`operator`, `client`, `guardian`) |
| `sign_order` | 1=운영자, 2=의뢰인, 3=법정대리인 |
| `name`, `email`, `phone`, `relation` | 운영자는 관리자 계정 식별자를 `email` 자리에 |
| `status` | `pending` / `signed` |
| `sign_token` unique, `token_expires_at` | 서명자별 토큰. 운영자 행은 토큰 없음 |
| `identity_verified_at` | 연락처 뒷자리 확인 |
| `first_viewed_at`, `last_viewed_at`, `view_count`, `first_viewed_ip` | 열람 기록 |
| `signed_at`, `ip_address`, `user_agent`, `signature_data` | 서명 |
| `admin_actor` | 운영자 행: `lib/contracts/admin-accounts.ts`의 사람별 식별자 |

연습실의 `signatures` 표를 쓰지 않는 이유: `contract_id`가 `contracts.id`를 참조하는 FK다.

### 3.4 `service_contract_events` — 진행 기록

| 컬럼 | 설명 |
|---|---|
| `id`, `contract_id` FK | |
| `seq` | 계약 안 순번. `unique(contract_id, seq)` — 동시 기록이 같은 번호를 잡으면 하나가 실패하고 재시도 |
| `type` | 8장 |
| `stage` | `arrangement` / `recording` / `tuning` / `mixing` / `mastering` / null |
| `round` | 전달·수정 회차 |
| `amount` | 입금·추가 비용·정산 금액 |
| `data_json` | 종류별 부가 값(전달 링크, 메모, 정지 사유 등) |
| `occurred_at` | 일어난 시각 |
| `recorded_at` | 기록한 시각 |
| `actor` | `admin:<id>` / `client` / `system`(크론) |
| `actor_ip` | 의뢰인 행위면 IP |
| `voids_event_id` | 이 이벤트가 무효로 돌리는 앞 이벤트 |
| `notice_status` | `none` / `pending` / `sent` / `failed` |
| `notice_sent_at`, `notice_error`, `notice_message_id` | 의뢰인 통지 메일 결과 — **간주 승인의 근거** |

UPDATE는 `notice_*` 네 컬럼에만 허용한다(코드 규칙 + 테스트). 그 밖의 정정은 `voids_event_id`로.

### 3.5 손대지 않는 것

- `refund_accounts`(0048)는 `order_kind`에 CHECK가 걸려 있어 재사용하려면 표 재생성이 필요하다. 해지 정산은 드문 일이라
  1·2단계에서는 계좌를 메신저로 받아 송금하고, 송금 사실만 `settlement` 이벤트로 남긴다. 접수 화면은 3단계.
- `privacy_access_logs.action`은 DB CHECK가 없어(0024) 값 추가에 마이그레이션이 필요 없다.

## 4. 계약 상태

```
draft ──발송(=운영자 서명)──▶ sent ──의뢰인 서명(+대리인)──▶ signed ──▶ completed
  │                           │ ▲                              │
  │취소                       │ │재발송(의뢰인 토큰 회전)       └─해지──▶ terminated
  ▼                           ▼ │
cancelled                   expired
```

| 행위 | 허용 상태 |
|---|---|
| 수정 | draft |
| 발송 | draft |
| 재발송 | sent, expired |
| 취소 | draft, sent, expired |
| 삭제 | draft, cancelled |
| 서명 | sent |
| 완료 메일 재발송 | signed, completed |
| 진행 기록 추가 | signed |
| 완료 처리 | signed (8장 `released` 또는 운영자 판단) |
| 해지 | signed |

- **발송 후 terms·본문 불변.** 바꿔야 하면 취소하고 새로 만든다(연습실과 같다).
- 재발송은 운영자 서명을 다시 받지 않는다. 운영자 서명은 문서에 대한 것이고, 문서가 그대로이기 때문이다.
- `completed`·`terminated`가 파기 기산점이 된다(3년).

## 5. 계약 조건(terms) — `production-single`

```ts
type StageKey = 'arrangement' | 'recording' | 'tuning' | 'mixing' | 'mastering';
type RefundItemKey = 'arrangement' | 'recording' | 'tuning' | 'mixmaster' | 'planning';

interface ProductionSingleTerms {
  version: 1;
  songTitle: string | null;                // 미정이면 null — 제2조 "제목이 바뀌어도 동일한 곡"
  scope: {
    arrangementTracks: number;             // 10
    arrangementInstruments: '가상악기';
    recordingHours: number;                // 3
    mixingTracks: number;                  // 10
  };
  amount: {
    total: number;                         // 1,150,000
    deposit: number;                       // 575,000
    balance: number;                       // 575,000
    depositDueDays: number;                // 3  (체결일부터)
    balanceDueDays: number;                // 7  (최종 마스터 승인일부터)
  };
  payment: { bank: string; account: string; holder: string };
  workWeeks: number;                       // 8
  revisions: Record<'arrangement' | 'mixing' | 'mastering', number>;            // 2·2·1
  extraRevisionFees: Record<'arrangement' | 'mixing' | 'mastering', number>;    // 100,000·50,000·30,000
  deemedApprovalDays: number;              // 7
  refundSchedule: { key: RefundItemKey; label: string; amount: number }[];     // 50·20·15·20·10만
  partialCredit: Partial<Record<RefundItemKey, { at: PartialMilestone; ratio: number }[]>>;  // 9.4
  clientUnresponsiveDays: number;          // 30
  paymentDelayDays: number;                // 14
  studioDelayWeeks: number;                // 4
  credits: string;                         // 'Arranged by 황경하 / Recorded · Mixed by 스튜디오 놀'
}
```

검증(`kinds/productionSingle.ts`, 생성·수정 API와 서명 API가 같은 함수를 쓴다):

- 모든 금액은 0 이상 정수, `deposit + balance === total`, `sum(refundSchedule.amount) === total`
- `refundSchedule`의 key는 다섯 개 모두 정확히 한 번
- `partialCredit` 비율은 0 초과 1 미만, 같은 항목 안에서 오름차순
- 일수·주수는 1 이상 정수, 상한(예: 90일)으로 오타 방지
- 문자열은 길이 상한, 제어문자 금지(연습실 `validation.ts`의 `CONTROL_CHARS`)
- `total_amount` 컬럼 = `terms.amount.total`

기본값은 정본 상수에서 만든다: `ARRANGEMENT_SMALL_PRICE + SINGLE_BUNDLE_PRICE + VOCAL_TUNING_ADDON_PRICE`.
환불표의 번들 분할(녹음 20·믹싱마스터링 20·기획유통홍보 10)과 초과 수정 요금은 지금 정본에 없다. 사이트에 쓰지 않는
계약 전용 값이면 `kinds/productionSingle.ts`에 이유와 함께 둔다. 사이트에도 쓰면 `data/pricing.ts`로 올린다 —
`data/**/*.ts` 가격 리터럴 스캔(`data/pricing.test.ts`)은 `lib/` 아래를 보지 않으므로 정본과 어긋나는 것을 잡지 못한다.
대신 `productionSingle.test.ts`가 기본 total이 세 상수의 합인지 확인한다.

## 6. 서명

### 6.1 발송 = 운영자 서명

관리자 상세 화면의 "서명하고 발송" 버튼. 서명 캔버스로 운영자 서명을 받거나, 직인 이미지(`CONTRACT_SEAL_BASE64`)를 운영자
서명 이미지로 쓴다. 하나의 batch에서:

1. 운영자 서명자 행 `signed` (시각·IP·UA·관리자 식별자)
2. 의뢰인 서명자 행에 토큰 발급, `token_expires_at = now + 7일`
3. 계약 `draft → sent`

조건은 모두 "계약이 아직 draft"에 건다. 응답 뒤(`waitUntil`) 의뢰인에게 서명 요청 메일.

### 6.2 의뢰인 서명

화면 순서는 연습실과 같다. 열람 기록 → 연락처 뒷자리 확인(시도 제한 키는 `sign_identity:svc:<signerId>`) → 본문 읽기
(화면에서는 연락처 뒷자리 마스킹) → 생년월일·주소·활동명 입력 → 필수 동의 → 서명.

필수 동의(서명 때 각각 체크, 동의 시각을 이벤트가 아니라 서명 행 `data`에 남긴다):

| 조항 | 제목 |
|---|---|
| 제5조 | 수정 횟수와 7일 경과 시 승인 간주 |
| 제7조 | 권리 귀속(매절)과 크레딧 표기 |
| 제10조 | 해지와 환불 산정 |
| 제11조 | 발매 후 포트폴리오 게재 |
| 개인정보 | 수집 항목·목적·보유 기간 |

서명 확정 batch(`sign-transaction.ts`). 모든 문장을 "계약 `sent` + 이 서명자 토큰 일치 + 미만료 + 서명자 `pending`"에 건다.
연습실 #13의 교훈이다(재발송으로 토큰이 바뀐 뒤 옛 링크 서명이 커밋되는 것). 계약 UPDATE는 맨 뒤에 둔다.

1. 의뢰인 서명자 행 `signed`
2. 의뢰인 정보(생년월일·주소·활동명)와 **템플릿 사본으로 다시 만든 본문**, 계약일 = 서명 시각의 KST 날짜
3. 남은 필수 서명자가 없으면 계약 `signed`, `signed_at`, `content_hash`

응답 뒤 후처리: PDF 생성·Blob 보관, 의뢰인 서명 완료 메일(PDF 첨부 + 계약금 안내 + 진행 페이지 링크), 운영자 알림.
구조는 연습실 `finalize.ts`를 따르고, 실패는 `notification_error`에 남긴다.

### 6.3 법정대리인 (1단계에서는 닫혀 있음)

열 때는 의뢰인 서명 시 생년월일이 만 19세 미만이면 서명을 받되 계약은 `sent`로 두고, 대리인 행을 만들어 대리인 연락처로
별도 링크를 보낸다. 대리인 서명 때 관계 입력 + 별도 뒷자리 확인을 거친 뒤, 운영자가 가족관계 증빙을 확인하고 남기는
`guardian_verified` 이벤트가 있어야 착수할 수 있다. 1단계에서는 연습실 `validateSignerDetails`의 19세 차단을 그대로 쓴다.

### 6.4 지문 `p1`

`lib/contracts/integrity.ts`와 같은 구조로 새로 만든다(연습실 v3·v4 레지스트리와 섞지 않는다). 덮는 값:
계약 id·kind·본문·`terms_json`(키 정렬한 canonical JSON)·`total_amount`·의뢰인 이름·활동명·이메일·연락처·생년월일·주소,
서명자 전원의 역할·이름·이메일·서명 시각·IP·서명 이미지, 필수 동의 목록과 동의 시각. 열람 기록과 진행 이벤트는 넣지 않는다
(서명된 문서가 아니라 그 뒤의 일이다).

## 7. API

| 메서드·경로 | 누가 | 하는 일 |
|---|---|---|
| `GET/POST /api/service-contracts` | 관리자 | 목록 / 생성 |
| `GET/PATCH/DELETE /api/service-contracts/[id]` | 관리자 | 상세(개인정보 접근 로그 `service_contract_view`) / 초안 수정 / 삭제 |
| `POST /api/service-contracts/[id]/send` | 관리자 | 운영자 서명 + 발송, 재발송 |
| `POST /api/service-contracts/[id]/cancel` · `/complete` · `/terminate` | 관리자 | 상태 전이 |
| `POST /api/service-contracts/[id]/sign` | 서명자 토큰 | 6.2 |
| `GET /api/service-contracts/[id]/pdf` | 관리자 | 로그 `service_contract_pdf_download` |
| `POST /api/service-contracts/[id]/download` | 의뢰인 토큰 + 뒷자리 | 자기 계약서 PDF |
| `POST /api/service-contracts/[id]/events` | 관리자 | 진행 기록 추가·무효화 |
| `POST /api/service-contracts/[id]/portal` | 의뢰인 | 진행 페이지 입장(토큰 + 뒷자리 → httpOnly 쿠키 30일) |
| `POST /api/service-contracts/[id]/portal/approve` · `/revision` | 의뢰인 쿠키 | 승인 / 수정 요청 |

관리자 인증은 `authenticateAdminApi`, 크론은 `Authorization: Bearer ${CRON_SECRET}`, 모든 응답 `Cache-Control: no-store`,
서명·진행 페이지는 `noindex, nofollow` + `denyContractPageCaching`.

## 8. 진행 기록 — 이벤트 종류

| type | stage/round | 누가 | 의뢰인 통지 | 의미 |
|---|---|---|---|---|
| `deposit_received` | — | 관리자 | ○ | 입금(부분 입금은 여러 번). amount 필수 |
| `source_received` | — | 관리자 | ○ | 1차 완성본 수령. data: 파일 링크 |
| `source_replaced` | — | 관리자 | ○ | 1차 완성본 교체(제4조 2항 — 기간 재기산 사유) |
| `kickoff` | — | 관리자 | ○ | 착수(제10조 1항). 이후 환불은 항목표 기준 |
| `stage_delivered` | 단계·회차 | 관리자 | ○ **필수** | 결과물 전달. data: 링크·메모. **간주 승인 시계가 여기서 시작** |
| `revision_requested` | 단계·회차 | 의뢰인 또는 관리자 대리 | 운영자 | 수정 요청 1묶음. 무료 횟수 초과면 `extra` 표시 |
| `stage_approved` | 단계 | 의뢰인(명시) / system(간주) / 관리자 대리 | ○ | data.mode: `explicit` / `deemed` / `proxy` |
| `recording_session` | recording | 관리자 | — | 녹음 시간 사용(시간). 누적이 `scope.recordingHours`를 넘으면 경고 |
| `stage_completed` | recording·tuning | 관리자 | ○ | 승인 절차가 없는 단계의 완료 |
| `pause_started` / `pause_ended` | — | 관리자 | ○ | data.cause: `client` / `studio`. 작업 기간 계산에 쓰임 |
| `extra_cost_agreed` | — | 관리자(의뢰인 동의 증빙 첨부) / 의뢰인 | ○ | 제6조 — 세션 실비·추가 녹음·범위 초과 |
| `client_contacted` | — | 관리자 | — | 스튜디오가 연락함(30일 무응답 판정의 시작점) |
| `client_responded` | — | 관리자 / 의뢰인 행위면 자동 | — | |
| `balance_received` | — | 관리자 | ○ | 잔금 |
| `final_delivered` | — | 관리자 | ○ | 최종 WAV·MP3 인도. **잔금 완납 전에는 막는다**(제5조 6항) |
| `distribution_submitted` | — | 관리자 | ○ | 유통 등록 |
| `released` | — | 관리자 | ○ | 발매(포트폴리오 게재 가능 시점 — 제11조 2항) |
| `termination_notice` | — | 관리자 | ○ **필수** | 제10조 5항의 서면 통지. 버튼으로만 |
| `settlement` | — | 관리자 | ○ | 해지 정산: 공제액·환불액·송금 일시 |
| `note` | — | 관리자 | — | 메모(파기 대상) |
| `void` | — | 관리자 | — | `voids_event_id`의 기록을 무효로 돌림. 사유 필수 |

"의뢰인 통지 ○"인 이벤트는 기록과 함께 메일이 나간다. 결과는 그 이벤트 행의 `notice_*`에 남는다.

## 9. 계산 (ledger.ts — 순수 함수)

입력은 terms와 무효 처리된 것을 뺀 이벤트 목록, 그리고 `now`다. 모든 날짜는 KST 날짜 단위로 센다(`lib/contracts/format.ts`의
`kstDateKey`). 후기 메일 크론과 같은 이유다 — 경과 시간으로 자르면 밤늦게 전달한 건이 하루 밀린다.

### 9.1 작업 기간 (제4조)

- 기산일 = `max(입금 누계가 계약금에 처음 닿은 날, 마지막 source_received)` — 둘 다 있어야 시작한다
- `source_replaced`가 있으면 그날로 다시 센다
- 예정일 = 기산일 + `workWeeks`×7일 + `cause=client` 정지 구간 일수 합
- 지연 일수 = (최종 인도 또는 오늘) − 예정일 − `cause=studio`가 아닌 정지 구간
- **스튜디오 사유 지연이 `studioDelayWeeks`×7일 이상이면** 운영자 화면에 "의뢰인 해지 가능(제12조 2항)" 경고

### 9.2 수정·승인 (제5조)

- 단계별 수정 횟수 = 그 단계의 `revision_requested` 수, 무료 잔여 = `revisions[stage] − 횟수`
- 초과분은 회당 `extraRevisionFees[stage]`로 청구 예정액에 더한다
- 간주 승인 예정일 = 마지막 `stage_delivered`의 KST 날짜 + `deemedApprovalDays`
  - 그 뒤 같은 단계에 `revision_requested`·`stage_approved`가 있으면 해당 없음
  - **그 전달 이벤트의 `notice_status`가 `sent`가 아니면 간주 승인 불가** → 운영자 할 일로 올린다

### 9.3 대금 (제3조·제10조 5항)

- 계약금 기한 = 서명일 + `depositDueDays`, 잔금 기한 = 마스터링 승인일 + `balanceDueDays`
- 연체 일수가 `paymentDelayDays` 이상이면 운영자 화면에 "해지 통지 가능" 표시(버튼은 운영자가 누른다)
- `final_delivered`는 입금 누계 + 승인된 추가 비용 ≥ 계약금액 + 추가 청구액일 때만 기록할 수 있다

### 9.4 환불 산정 (제10조)

- `kickoff` 전 해지: 받은 금액 전액
- 이후: 공제액 = Σ(완료 항목 금액) + Σ(진행 중 항목 금액 × 도달한 경계의 비율), 환불액 = max(0, 받은 금액 − 공제액).
  공제액이 받은 금액보다 커도 추가 청구는 하지 않는다 — 계약서가 "남은 금액이 있으면 환불"이라고만 하므로 근거가 없다

항목별 완료 기준과 진행 중 경계(편곡은 운영자 결정, 나머지는 기본값 — **확인 필요**):

| 항목 | 완료 | 진행 중 경계 → 비율 |
|---|---|---|
| 편곡 50만 | **1차 시안 전달**(`stage_delivered` 편곡 1회차) — 운영자 결정 2026-10-18 | — (전달 전은 0) |
| 보컬 녹음 20만 | 녹음 `stage_completed` | 녹음 세션 1회 이상 → 녹음 시간 비율 |
| 보정 15만 | 보정 `stage_completed` | — (완료 아니면 0) |
| 믹싱·마스터링 20만 | 마스터링 승인 | 믹싱 1차 전달 → 50%, 믹싱 승인 → 75% |
| 기획·유통·홍보 10만 | 유통 등록 | 착수 → 30% |

편곡을 1차 시안 전달 시점에 완료로 보는 이유: 시안이 나오면 편곡 작업의 대부분이 끝난 상태이고, 남은 것은 수정 2회다.
예를 들어 계약금 575,000원만 받은 상태에서 1차 시안 전달 뒤 의뢰인 사정으로 해지하면 공제 500,000원 + 기획·유통·홍보 착수분
30,000원, 환불 45,000원이다. 이 기준은 **계약서에 적혀 있어야 집행할 수 있다.** 지금 제10조 3항은 "진행 중인 항목은 진행
정도에 따라 비율로"라고만 해서, 의뢰인이 "승인도 안 한 시안"이라며 다투면 시스템 계산에 계약상 근거가 없다. 템플릿 제10조
3항에 "편곡은 스튜디오가 1차 시안을 전달한 때 완료된 것으로 본다"를 넣는다(다른 항목의 경계도 정해지면 같은 자리에).

해지 처리 화면은 이 계산을 보여 주고, 운영자가 금액을 고칠 수 있다(고친 값과 계산값을 `settlement`에 함께 남긴다).

## 10. 기한 크론

`/api/cron/service-contract-deadlines` 매일 01:00 UTC(10:00 KST). `deadlines.ts`가 `signed` 계약마다 ledger를 계산해
할 일을 낸다.

| 조건 | 하는 일 |
|---|---|
| 간주 승인 예정일 2일 전 | 의뢰인 안내 메일(한 번만 — 발송 여부는 `data_json`의 표식) |
| 간주 승인 예정일 지남 + 통지 증명 있음 | `stage_approved(deemed)`를 `actor=system`, `occurred_at=예정일`로 기록하고 의뢰인 통지 |
| 간주 승인 예정일 지남 + 통지 증명 없음 | 운영자 메일만 |
| 계약금·잔금 기한 하루 전 | 의뢰인 안내 |
| 계약금·잔금 기한 지남 | 운영자 메일(연체 일수 포함) |
| 스튜디오 사유 지연 3주·4주 | 운영자 메일 |
| 30일 무응답 | 운영자 메일 |

같은 크론이 같은 날 두 번 돌아도 한 번만 기록되게, 간주 승인은 `(contract, stage, 전달 이벤트 id)`로 이미 기록됐는지 먼저
보고 넣는다. 크론이 통째로 실패하면 운영자에게 메일(후기 크론과 같은 방식). 해지 통지는 크론이 보내지 않는다.

파기는 기존 `/api/cron/purge-contracts`(매월 1일)에 `purgeServiceContracts()`를 붙인다. 지우는 것: 의뢰인 이름·활동명·
생년월일·연락처·주소·이메일, 본문, 서명 이미지·IP·UA, 이벤트의 `data_json`(링크·메모), PDF. 남기는 것: kind·금액·날짜·
이벤트 종류와 시각. 백업 크론(`backup-contracts`)에도 새 표를 넣는다.

## 11. 화면

**관리자**

- 목록 `/admin/service-contracts`: 상태·의뢰인·금액·현재 단계·**오늘 할 일 배지**(간주 승인 대기, 연체, 통지 실패)
- 작성·수정: kind 선택 → terms 폼(정본 기본값, 바꾼 칸은 표시) → 본문 미리보기. 합계 불일치는 저장 전에 막는다
- 상세: 위쪽은 계약 요약·서명자·감사추적(연습실 `AuditTrail` 구성), 아래쪽은 진행 타임라인과 "기록 추가" 버튼들.
  단계 카드마다 남은 무료 수정, 간주 승인 예정일, 통지 결과가 보인다. 해지 화면은 9.4 계산을 보여 준다

**의뢰인** (ko 전용, 해요체)

- 서명 `/ko/service-contracts/[id]/sign?token=` — 연습실 서명 화면과 같은 흐름
- 완료 `/ko/service-contracts/[id]/complete?token=` — PDF 받기(뒷자리 확인)
- 진행 `/ko/service-contracts/[id]?token=` — 현재 단계, 전달된 결과물 링크, "승인" / "수정 요청"(남은 무료 횟수와 초과 시
  금액을 버튼 위에 표시), 입금 안내와 기한, 간주 승인 예정일. 개인정보는 보여 주지 않는다

UI는 `components/ui/`의 프리미티브(`Stepper`·`PriceSummary`·`Notice`·`Panel`·`Badge`)를 쓴다(uiPatterns 기준선).

## 12. 메일

| 메일 | 받는 사람 | 시점 |
|---|---|---|
| 서명 요청 | 의뢰인 | 발송·재발송 |
| 서명 완료 + PDF + 계약금 안내 + 진행 페이지 링크 | 의뢰인 / 운영자 | 성립 |
| 진행 통지(전달·승인·입금 확인 등) | 의뢰인 | 8장 ○ 이벤트 |
| 기한 안내(승인·입금) | 의뢰인 | 크론 |
| 운영자 할 일 요약 | 운영자 | 크론 — 할 일이 있을 때만 |
| 해지 통지 | 의뢰인 | 운영자 버튼 |

전달 통지 메일에는 "이 날부터 7일 안에 수정 요청이 없으면 승인된 것으로 봐요(계약서 제5조 5항)"와 예정일을 반드시 적는다.
간주 승인의 효력은 의뢰인이 이 사실을 알 수 있었는지에 기대므로, 이 문장이 빠진 메일은 테스트로 막는다.

## 13. 개인정보·약관 게이트

- **처리방침을 고쳐야 한다.** 지금 `data/privacyPolicy.ts`는 "연습실 이용 계약"의 수집 항목과 파기 ⑫만 적고 있다. 제작 계약은
  활동명·결과물 전달 기록·(대리인을 열면) 대리인 정보가 더해지고 파기 기산점이 다르다. 접속기록 문단에도 제작 계약 상세 열람을
  더한다.
- 처리방침 ko를 고치면 **`FUNDING_TERMS_VERSION`을 함께 올려야 한다**(`content/fundingTerms.baseline.test.ts`가 ko 처리방침을
  해시한다). 절차는 CLAUDE.md "약관·처리방침을 고치면" 절.
- 계약서 템플릿에도 개인정보 조항(수집 항목·목적·보유 기간 3년·파기)을 넣는다. 처리방침 문구와 같은 약속이어야 한다.
- 관리자 상세 열람·PDF 내려받기는 `privacy_access_logs`에 `service_contract_view`·`service_contract_pdf_download`로 남긴다.

## 14. 테스트

| 파일 | 고정하는 것 |
|---|---|
| `kinds/productionSingle.test.ts` | 합계 불변식, 기본 total = 세 정본 상수 합, 환불표 키 5개, 경계 비율 범위 |
| `render.test.ts` | 표 셀 주입(파이프·개행·`$'`), 모든 `{{변수}}`가 치환됨, 계약일 KST |
| `sign-transaction.test.ts` | 토큰 회전 후 옛 토큰 서명 0행, 취소와 서명 경합, 계약 UPDATE가 맨 뒤 |
| `integrity.test.ts` | terms 키 순서가 바뀌어도 같은 지문, 서명자 하나만 바뀌어도 다른 지문 |
| `ledger.test.ts` | 기산일, 정지 구간, 수정 초과, 간주 승인(통지 실패면 불가), 환불 표 시나리오, `void` 반영 |
| `deadlines.test.ts` | 같은 날 두 번 실행해도 간주 승인 1건, 밤 23시 전달의 날짜 계산 |
| `events.test.ts` | `notice_*` 외 UPDATE 경로 없음, `final_delivered` 잔금 게이트 |
| `email.test.ts` | 전달 통지에 제5조 5항 문장과 예정일 포함 |
| `retention.test.ts` | 파기 범위(이벤트 data 포함), 남기는 값 |
| 연습실 `sign-page.test.ts` | `SignaturePad` 추출 후 동작 동일 |

## 15. 구현 순서 (PR 단위)

1. **`SignaturePad` 추출** — 연습실 화면만 바뀌는 리팩터. 기존 테스트 통과 확인 후 머지
2. **스키마·kind·렌더·검증** — 마이그레이션 + `kinds/` + `render.ts` + 템플릿 + 테스트. 화면 없음
3. **관리자 작성·발송(운영자 서명)·의뢰인 서명·PDF·메일** — 여기까지면 PDF 계약을 온라인으로 맺는다.
   처리방침 개정 + `FUNDING_TERMS_VERSION` 상향을 같은 PR에
4. **진행 기록** — 이벤트 표 사용, 관리자 타임라인, ledger, 진행 통지 메일
5. **의뢰인 진행 페이지 + 기한 크론** — 승인·수정 요청, 간주 승인 자동 기록
6. **파기·백업 크론 연결**
7. (3단계) 견적 요청서 → 초안, EP·정규 kind, 법정대리인, 환불 계좌 접수

각 PR의 마이그레이션은 배포 전에 Turso CLI로 적용한다(CLAUDE.md "운영 DB 마이그레이션 적용 방법"). 새 표뿐이라 순서가
뒤집혀도 기존 경로는 안 깨지지만, 새 화면이 500을 낸다.

## 16. 운영자 확인이 필요한 것

1. 9.4 환불 경계 — 편곡은 정해짐(1차 시안 전달 = 100%). 녹음·믹싱마스터링·기획유통홍보의 경계와, 이 기준들을 계약서 제10조 3항에 적는 문구
2. 운영자 서명 이미지: 직인을 쓸지, 서명을 매번 그릴지
3. 진행 페이지에서 의뢰인이 직접 수정 요청을 넣게 할지(권장), 카톡으로 받고 운영자가 대리 기록만 할지
4. 템플릿 관할 조항을 연습실과 같게 바꾸는 것(0장 기본값)에 동의하는지
