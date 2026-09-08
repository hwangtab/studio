# 아티스트 후원 멤버십 설계

- 작성일: 2026-09-08
- 상태: **초안 — 운영자 검토 대기.** 자율 세션에서 작성했으므로 질문 대신 §4에 가정을 적었다.
  가정이 틀리면 그 항목만 고치면 된다.
- 범위: 1차(아티스트 허브·헤더, 결제 없음) + 2차(월 정기결제) + 3차(정산 관리자)

## 1. 배경과 목표

스튜디오와 함께 작업한 아티스트가 **매월 소액의 활동비**를 모을 수 있게 한다.
방식은 Patreon과 같다 — 후원자가 월 정액 등급을 고르고, 카드가 매월 자동 결제되며,
아티스트 페이지에 후원자 명단이 붙는다. 헤더에 진입점을 둔다.

규모 가정: 아티스트 3~10팀, 후원자 수십 명, 월 거래 수백만원 이하. 이 가정이 설계의
단순함(수동 정산, 계정 없음)을 정당화한다. 규모가 커지면 §3의 접근 C로 넘어간다.

이미 있는 것:

| 자산 | 위치 | 재사용 |
|---|---|---|
| 토스 일반결제 라이브(2026-08-26, MID studkol3wd) | `lib/booking/toss.ts`(REST 래퍼·멱등키), `lib/booking/webhook.ts`(재조회 기반 멱등 웹훅) | 빌링 API 3개를 같은 래퍼에 추가 |
| Turso + Drizzle | `db/schema.ts` — `orders`(type enum에 `subscription` 예약됨)·`payments`·`refunds`·`webhook_events`·`rate_limits` | 돈의 SSOT는 그대로 `orders`/`payments` |
| 게스트 관리 토큰 | `lib/booking/token.ts`(manageToken, timing-safe 비교) | 후원 관리 링크 |
| 관리자 | `pages/admin/*`, iron-session, `lib/contracts/admin-auth.ts` | 후원 탭 추가 |
| 크론 | `vercel.json` 4개, `lib/cron/auth.ts`(CRON_SECRET, fail-closed) | 월 과금 크론 |
| 메일 | `lib/email/resend.ts`, `lib/booking/email.ts`(텍스트 메일, notificationError 패턴) | 후원 메일 5종 |
| 포트폴리오 | `data/portfolio/items.ts` 34건·29팀, `PortfolioMiniCard` | 아티스트 페이지의 작업 사례 |

없는 것: 빌링키 코드 전부, 아티스트 프로필 데이터(`artist`는 문자열 하나), 통신판매업
신고번호(`data/siteConfig.ts` `mailOrderSalesNumber` 빈 값).

## 2. 사실 확인 (설계 근거, 2026-09-08 조회)

| 항목 | 확인된 사실 | 출처 |
|---|---|---|
| 토스 자동결제 계약 | "리스크 검토 및 추가 계약 후 사용", "정기 구독형 서비스가 아니면 정책적으로 제한". 심사 1~3영업일 | docs.tosspayments.com/guides/v2/billing |
| 빌링키 발급 | 결제창 방식(카드·계좌) `payment.requestBillingAuth({ method:'CARD', successUrl, failUrl, customerEmail, customerName })` → successUrl에 `authKey`·`customerKey` → `POST /v1/billing/authorizations/issue` → `billingKey` | 같은 문서 + SDK `types/index.d.ts` |
| 자동결제 승인 | `POST /v1/billing/{billingKey}` — `amount, orderId, orderName, customerKey, customerEmail, customerName` | 같은 문서 |
| 빌링키 삭제 | `DELETE /v1/billing/{billingKey}`. 카드 재발급·만료 시 빌링키 재발급 필요 | 같은 문서 |
| 전자지급결제대행업(PG) 등록 | 타인의 재화·용역 대가 **정산을 대행·매개**하면 등록 대상(자본금 10억 등, 2025-03 유예 종료). **정산을 외부 PG사가 대행하면 등록 불필요** | 금융위 정책브리핑 148930669, 토스 블로그 amendment |
| 토스 지급대행 | 셀러 등록(개인은 SMS 본인인증) 후 토스 정산계좌에서 직접 지급. 주 1천만원 이상 KYC. 연관리비·건당 수수료는 계약 시 확정(공개 수수료표에는 계좌 유효성 인증 건당 50원만 명시). 요청 본문 JWE 암호화 | docs.tosspayments.com/guides/v2/payouts, /about/fee |
| 기부금품법 | "공익을 실현하기 위하여 반대급부 없이" 출연하는 기부에 적용, 1천만원 이상 모집 시 등록 | 1365 기부포털, easylaw |
| 계속거래 | 1개월 이상 계속 공급 계약은 방문판매법 계속거래 — 소비자는 언제든 해지, 미이용분 환급 거부 조항은 강행규정 위반(2026-09-01 계약 감사에서 이미 교정한 유형) | memory `project_contract_system_audit` |
| 국내 유사 서비스 수수료 | 팬딩 10~15%+결제수수료, 포스타입 10%, 투네이션 5.3~35%, Patreon 5%+결제수수료(달러 정산·영어 CS) | 각 서비스 공개 자료 |
| 토스 수수료 | 카드 일반 3.4%, 계좌이체 2.0%(최저 200원) | tosspayments.com/about/fee |

## 3. 접근 비교와 선택

| | A. 링크 아웃 | **B. 스튜디오 멤버십 + 아티스트 지정** | C. 지급대행 마켓플레이스 |
|---|---|---|---|
| 돈의 흐름 | 아티스트가 각자 Patreon·팬딩 등에 가입, 우리는 링크만 | 후원자 → 스튜디오(토스 자동결제) → 스튜디오가 아티스트에게 월 1회 지급 | 후원자 → 토스 정산계좌 → 토스가 아티스트에게 직접 지급 |
| 후원자의 계약 상대 | 외부 플랫폼 | **스튜디오 놀** | 아티스트(우리는 중개) |
| 토스 계약 | 없음 | 자동결제 1건 | 자동결제 + 지급대행 2건 |
| 법적 지위 | 위험 없음 | 자기 용역(멤버십) 판매 + 콘텐츠 제공자(아티스트)에게 대가 지급. PG 등록 대상 아님으로 본다(§5 세무·법률 확인 항목) | PG 등록 면제 요건을 정공법으로 충족 |
| 구현량 | 1~2일 | 2~3주 | 3~5주(JWE·셀러 KYC·잔액 관리) |
| 단점 | "사이트 안에서 매월 후원"이 안 됨. 아티스트마다 외부 가입, 수수료 10~15%, Patreon은 달러 | 매출이 스튜디오 장부에 총액으로 잡힘(VAT·종합소득 영향). 지급이 수동 | 과잉 설계. 연관리비·건당 수수료, 아티스트 전원 셀러 등록 |

**B를 택한다.** 요구("매월, 사이트 안에서, 헤더에서 진입")를 채우는 가장 단순한 구조이고,
기존 토스·DB·관리자 자산 위에 그대로 얹힌다. 규모가 커져 수동 지급이 부담되면 지급
단계만 C(지급대행)로 바꾸면 되고, 그때도 후원자 쪽 흐름은 바뀌지 않는다.

B의 핵심 구조를 한 문장으로: **후원자는 스튜디오 놀의 "아티스트 후원 멤버십"을 사고,
아티스트는 그 멤버십에 소식·비하인드를 제공하는 콘텐츠 제공자로서 스튜디오와 계약하며,
스튜디오는 지정 후원금 공급가의 90%를 아티스트에게 지급한다.** 후원자와 아티스트
사이에 직접 계약이 없어야 "타인 거래의 정산 대행"이 아니라 "자기 용역 판매 + 자기
비용 지급"이 된다. 카피는 "○○를 매월 후원"이라고 써도 되지만 약관의 판매자는 스튜디오다.

## 4. 가정 (운영자 확인 필요)

| # | 가정 | 기본값 | 바꾸면 영향 |
|---|---|---|---|
| 1 | 상품명·URL | "아티스트 후원" / `/ko/artists`, `/ko/artists/[slug]` | 내비 라벨·i18n 키 |
| 2 | 등급 | 월 5,000 / 10,000 / 30,000원 (VAT 포함, 전 아티스트 공통) | `data/pricing.ts` 상수만 |
| 3 | 아티스트 지급률 | 공급가(VAT 제외)의 **90%** | 상수 + 약관 문구 + 페이지 공개 문구 |
| 4 | 아티스트 소득 처리 | 사업소득 3.3% 원천징수. 사업자인 아티스트는 세금계산서 | `data/artists` `taxType` |
| 5 | 후원 혜택(반대급부) | 아티스트 페이지 후원자 명단(동의 시) + 월 1회 아티스트 소식 메일(스튜디오가 발송) | 혜택이 없으면 기부금품법·VAT 판단이 달라진다 |
| 6 | 지급 방식 | 월 1회 운영자가 직접 이체, 관리자 정산표 기준 | 자동화는 접근 C |
| 7 | 로케일·결제수단 | ko 전용, 국내 카드만(예약 퍼널과 같은 정책) | 비-ko는 내비 숨김 |
| 8 | 헤더 위치 | 데스크톱 직결 링크(가격 오른쪽), 모바일 퀵링크, 푸터 콘텐츠 열 | `Header.tsx`·`Footer.tsx` |
| 9 | 첫 아티스트 | 운영자가 3~5팀 섭외. 포트폴리오 featured 13건이 후보 풀 | 데이터 파일만 |
| 10 | 1회성 후원(팁) | 2차 이후. `orders`가 이미 단건을 지원하므로 추가 비용 작음 | 없음 |
| 11 | 결제일 | 가입일의 일(日)을 매월 결제일로. 29~31일 가입은 28일로 고정 | 크론 로직 |

## 5. 코드 밖 준비물

1. **토스 자동결제 추가 계약** — 카드사 심사(계약 후 최대 10~14영업일, 2026-09-08 현재 진행 중)가
   끝나야 라이브 카드 결제 자체가 열린다. 신청 시 "정기 구독형 멤버십, 월 5천~3만원, 월 수십 건"으로
   설명한다. 이게 2차의 전제조건이며, 1차는 이것 없이 배포한다.
2. **통신판매업 신고** — `mailOrderSalesNumber`가 아직 빈 값. 정기결제 상품을 팔기 전에 마친다.
3. **세무 확인 2건** — (a) 멤버십 매출 VAT 신고와 아티스트 지급의 비용·원천징수 처리,
   (b) §3의 구조가 PG 정산 대행으로 읽히지 않는지. 확인 전에는 2차를 배포하지 않는다.
4. **아티스트 참여 동의서** — 콘텐츠 제공(월 1회 소식), 지급률·지급일, 후원자 명단 게시,
   세금 처리, 사진·음원 사용 권리. 기존 계약 시스템 템플릿(`docs/contracts`)을 줄여 쓴다.
5. **아티스트 자료** — 프로필 사진(권리 확인 필수. 포트폴리오 이미지 대부분이 외부 CDN
   URL이라 그대로 못 쓴다), 소개 3~5문단, SNS·스트리밍 링크.

## 6. 단계 분할

| 단계 | 내용 | 배포 조건 |
|---|---|---|
| **1차 허브** | `data/artists` + `/ko/artists`·`/ko/artists/[slug]` + 헤더·푸터·사이트맵. 후원 CTA는 "곧 열림 + 카톡 문의" | 아티스트 3팀 자료 확보 |
| **2차 결제** | 빌링키 발급·첫 결제·월 과금 크론·해지·환급·웹훅 분기·메일 | §5 1~4 완료 |
| **3차 정산** | 관리자 후원 탭·월 정산표·지급 기록 | 2차와 같은 릴리스여도 됨 |

1차를 먼저 내는 이유: 토스 계약·세무 확인이 코드보다 오래 걸린다. 아티스트 페이지는
결제 없이도 콘텐츠·SEO 가치가 있고(아티스트명 검색 → 스튜디오), 결제가 열리면 CTA만 바뀐다.

## 7. 데이터 모델

### 7.1 아티스트 — 정적 데이터 (`data/artists/index.ts`)

운영자가 섭외·계약한 소수만 싣고 코드로 관리한다(이 저장소의 상품·포트폴리오와 같은 방식).
관리자 UI로 아티스트를 등록하는 기능은 만들지 않는다.

```ts
export interface SupportedArtist {
  slug: string;                 // URL. [a-z0-9-]
  name: string;                 // 표기명
  portfolioArtist: string;      // data/portfolio/items.ts의 artist 문자열과 정확히 일치 → 작업 사례 자동 연결
  tagline: string;              // 한 줄
  bio: string;                  // ko 마크다운 3~5문단 (portfolio productionNotes와 같은 렌더러)
  image: string;                // /images/artists/<slug>.jpg (권리 확인된 파일만)
  links: Partial<Record<'instagram'|'youtube'|'spotify'|'melon'|'bandcamp'|'site', string>>;
  supportActive: boolean;       // false면 페이지는 있되 후원 CTA 없음
  taxType: 'withholding' | 'invoice';   // 3.3% 원천징수 | 사업자 세금계산서
  joinedOn: string;             // ISO
  updatedOn: string;            // 사이트맵 lastmod
}
```

`data/artists/artists.test.ts`: `portfolioArtist`가 실제 항목에 존재, 이미지 파일 존재,
slug 중복·형식, `supportActive`인 아티스트는 `taxType` 필수.

### 7.2 DB — `db/schema.ts` 추가 (마이그레이션 0009)

돈의 SSOT는 기존 `orders`/`payments`/`refunds`를 그대로 쓴다. `orders.type`에 이미
예약된 `'subscription'` 값을 이번에 처음 사용한다. 새 테이블 셋:

| 테이블 | 역할 | 핵심 컬럼 |
|---|---|---|
| `subscriptions` | 후원 계약 1건 | id, subscriptionNo(`SNS-YYYYMMDD-XXXXXXXX`, 유니크), artistSlug, tierId, totalAmount/itemAmount/vatAmount, supporterName/Email/Phone(선택), displayName, displayConsent, **customerKey**(유니크, uuid), **billingKey**, cardLabel("신한 ****1234"), status, billingDay(1~28), nextChargeAt, failedAttempts, manageToken(유니크), cancelledAt, cancelReason, notificationError, createdAt/updatedAt |
| `subscription_charges` | 월 청구 시도 1건 | id, subscriptionId FK, orderId FK(성공·실패 모두 order를 남긴다), periodStart/periodEnd, attempt, status(`paid`/`failed`), failureCode, createdAt |
| `artist_payouts` | 아티스트 월 지급 기록 | id, artistSlug, period(`YYYY-MM`), grossAmount, supplyAmount, shareAmount, withholdingAmount, netAmount, subscriberCount, status(`pending`/`paid`), paidAt, memo, createdAt |

`subscriptions.status` 전이:

- `pending`(카드 등록 전) → `active`(빌링키 발급 + 첫 결제 성공)
- `active` → `past_due`(월 과금 실패) → `active`(재시도 성공) | `paused`(3회 실패)
- `paused` → `active`(카드 갱신 + 즉시 과금 성공)
- 어느 상태에서든 → `cancelled`(후원자 해지·관리자 해지). 되돌리지 않는다 — 다시 후원하려면 새 가입
- `pending`이 24시간 지나면 lazy 만료(`expireStaleOrders` 패턴)

빌링키는 **서버 전용 컬럼**이다. 관리자 DTO(`admin-serialize` 패턴)와 관리 페이지 어디에도
내보내지 않는다. 그 자체로는 우리 시크릿 키 없이 쓸 수 없지만, 유출되면 카드 재등록을
강제해야 하므로 노출 경로를 처음부터 없앤다.

### 7.3 가격 상수 (`data/pricing.ts`)

```ts
export const SUPPORT_TIERS = [
  { id: 'light',    monthlyTotal: 5000 },
  { id: 'standard', monthlyTotal: 10000 },
  { id: 'patron',   monthlyTotal: 30000 },
] as const;                                  // VAT 포함 표시가
export const SUPPORT_ARTIST_SHARE_PERCENT = 90;   // 공급가 기준
```

소비자 표기는 VAT 포함 정액("월 10,000원")이 자연스럽다. 기존 `computeAmounts`는
상품가→합계 방향이라, 역방향 `splitInclusiveAmount(total) → { itemAmount, vatAmount }`
(`item = round(total / 1.1)`, `vat = total − item`)를 `lib/booking/amounts.ts`에 추가하고
테스트로 고정한다. 카피의 금액은 전부 `formatPriceLabel`/상수에서 끌어온다 —
`data/pricing.test.ts` 리터럴 스캔이 그걸 강제한다.

## 8. 결제 흐름

### 8.1 가입 (아티스트 페이지 → 카드 등록 → 첫 결제)

1. 등급 선택 → 폼: 이름, 이메일(필수), 휴대폰(선택), 명단 표시명 + 표시 동의, 약관·환급규정 동의.
2. `POST /api/support/subscriptions` — IP당 10/h 제한(`consumeRateLimit`), 검증(`lib/support/validation.ts`),
   `subscriptions`(pending) INSERT. 서버가 customerKey(uuid v4)·manageToken·subscriptionNo를 만든다.
   금액은 상수에서 계산해 저장하고 클라이언트 값은 받지 않는다.
3. 클라이언트: `loadTossPayments(clientKey).payment({ customerKey })` →
   `requestBillingAuth({ method:'CARD', successUrl:'/ko/artists/support/success?no=…', failUrl:'/ko/artists/support/fail?no=…', customerEmail, customerName })`.
   기존 위젯은 `ANONYMOUS` customerKey를 쓰지만 빌링은 고유 키가 필수라 별도 컴포넌트(`SupportCardRegister`)를 둔다.
4. `/ko/artists/support/success` SSR(`getServerSideProps`, 예약 success 페이지와 같은 위치에서 승인):
   - `authKey`·`customerKey` 수신 → DB의 customerKey와 일치 검증
   - `POST /v1/billing/authorizations/issue` (Idempotency-Key `issue:{subscriptionNo}`) → billingKey·카드 라벨 저장
   - **첫 달 즉시 과금**: `orders`(type subscription, pending) → `POST /v1/billing/{billingKey}`
     (Idempotency-Key `charge:{subscriptionNo}:{YYYY-MM}`) → 성공 시 `db.batch([payments INSERT, orders→paid, charges INSERT, subscriptions→active, nextChargeAt])`.
     payments INSERT를 맨 앞에 둬 paymentKey unique가 이중 기록을 막는 기존 규칙 유지
   - 실패 시 subscription은 pending으로 남고 화면은 실패 안내 + 재시도 링크
5. 메일: 후원자(관리 링크·영수증 URL), 운영자(신규 후원). 실패는 `notificationError`.

### 8.2 월 과금 크론 — `/api/cron/charge-subscriptions`, 매일 01:00 UTC(10:00 KST)

```
대상: status ∈ {active, past_due} AND nextChargeAt <= now, 최대 50건/실행
각 건:
  claim  = UPDATE subscriptions SET nextChargeAt = now + 1d WHERE id=? AND nextChargeAt <= now  (rowsAffected 0이면 skip)
  order  = INSERT orders(type subscription, pending)
  result = POST /v1/billing/{billingKey}  Idempotency-Key charge:{subscriptionNo}:{period}
  성공 → batch: payments, orders paid, charges paid, subscriptions active·failedAttempts 0·nextChargeAt = 다음 달 billingDay 10:00 KST
  실패 → batch: orders failed, charges failed(failureCode), subscriptions past_due·failedAttempts+1·nextChargeAt = 재시도일
```

이중 과금은 두 겹으로 막는다 — claim UPDATE(같은 실행이 겹쳐도 한쪽만 통과)와 결정적
멱등키(같은 기간은 토스가 최초 응답을 재사용). 인증은 `isCronAuthorized`(fail-closed).
Vercel Hobby의 크론 빈도 제한(일 1회) 안이다.

### 8.3 실패 처리

- 재시도: 첫 실패일 기준 D+1, D+3, D+7에 3회. 마지막 재시도까지 실패하면(총 4회) `paused`, 후원자에게 "카드 갱신" 메일(관리 링크).
- 카드 갱신: 관리 페이지에서 `requestBillingAuth`를 **같은 customerKey**로 재실행 → 새 billingKey 저장,
  옛 키는 `DELETE /v1/billing/{billingKey}` → `paused`였다면 즉시 과금 시도 후 `active`.
- 30일 이상 `paused`면 lazy로 `cancelled` 처리하고 메일 1통.

### 8.4 웹훅 분기

기존 `processTossWebhook`는 `findOrderByOrderNo` 후 `order.bookings[0]`을 전제한다.
재조회 직후에 `order.type === 'subscription'`이면 `lib/support/webhook.ts`로 넘기는 분기를
**bookings 접근보다 앞에** 둔다. 처리: DONE → 해당 charge/subscription이 아직 pending이면
승인 경로와 같은 batch로 보정(SSR이 죽은 경우 복구), CANCELED/PARTIAL_CANCELED →
`reconcileRefunds`와 같은 대사. 멱등키 규칙(`{paymentKey}:{status}`, 재조회 상태로 생성)은 그대로.

### 8.5 결제일 계산

`billingDay` = 가입일(KST)의 일. 29~31은 28. 다음 결제 시각 = 다음 달 `billingDay` 10:00 KST.
`lib/support/schedule.ts`의 순수 함수로 두고 월말·윤년·연말 경계를 테스트로 고정한다
(`lib/booking/kst.ts` 유틸 재사용).

## 9. 해지·환급 정책

계속거래 규칙을 처음부터 지킨다 — 환급을 거부하는 조항을 넣었다가 고친 전례(계약 감사)를
반복하지 않는다.

- **해지**: 관리 페이지에서 즉시. 다음 결제 없음. 이미 결제한 달의 혜택(명단·소식 메일)은 월말까지 유지.
- **환급**: (a) 첫 결제 후 7일 이내 해지 → 전액. (b) 그 외 해지 → 해지일부터 결제 기간 말까지
  **일할 환급**을 요청할 수 있다(요청 버튼, 자동 실행). 관리자는 규정과 무관하게 임의 금액 환불 가능.
- 구현: `lib/support/refund-policy.ts` `computeSupportRefund({ chargedAt, periodStart, periodEnd, amount, now })`.
  환불은 기존 `cancelPayment`(부분취소, 멱등키 `refund:{orderNo}:{amount}`) 재사용.
- 약관: `/ko/terms`에 "아티스트 후원 멤버십" 절 추가 — 판매자(스튜디오 놀), 혜택, 아티스트 지급률
  공개, 결제일·실패 처리, 해지·환급, 명단 게시 동의, 개인정보. 환급 규정 문구는 예약과 같이
  **상수를 렌더**해 코드와 약관이 어긋나지 않게 한다.

## 10. 정산·지급 (3차)

월 단위, 아티스트별. 관리자 "정산" 탭에서 기간을 고르면 아래를 계산해 `artist_payouts`(pending)를
만들고, 운영자가 이체한 뒤 "지급 완료"를 누른다.

```
gross    = 해당 월 paid charges 합계 − 그 charges에 대한 refunds 합계
supply   = gross − VAT(gross × 10/110)
share    = round(supply × 90%)
withhold = taxType=withholding ? round(share × 3.3%) : 0
net      = share − withhold
```

월 10,000원 후원 1건의 예: gross 10,000 → supply 9,091 → share 8,182 → withhold 270 →
**아티스트 실수령 7,912**. 스튜디오 몫 909에서 카드수수료 340이 나간다. 지급률 90%는
이 셈을 운영자가 보고 정하라고 §4에 올려 둔 것이다.

아티스트 페이지에는 "후원금의 90%(VAT 제외)가 아티스트에게 지급됩니다"를 고정 문구로 싣는다 —
후원자 신뢰의 근거이자, 스튜디오가 얼마를 가져가는지 숨기지 않는 장치다.

## 11. 페이지·헤더·내비

### 11.1 라우트 (전부 ko 전용, 비-ko는 `terms.tsx`처럼 `/ko/...`로 redirect)

| 라우트 | 역할 | 색인 |
|---|---|---|
| `/ko/artists` | 취지 · 아티스트 카드 · 방식 · FAQ · 약관 링크 | 색인, `pageRouteMap` 등록 |
| `/ko/artists/[slug]` | 프로필 · 작업 사례(`PortfolioMiniCard`, `portfolioArtist`로 필터) · 등급 카드 · 후원자 명단 · 지급률 문구 | 색인, `lib/sitemap/artistsMeta.js`(portfolioMeta 패턴, lastmod = `updatedOn`) |
| `/ko/artists/support/success` · `/fail` | 카드 등록 리다이렉트 수신, success SSR에서 발급·첫 결제 | noindex · 사이트맵 제외 · robots disallow(예약 퍼널과 동일) |
| `/ko/artists/support/manage/[subscriptionNo]?token=` | 후원 확인 · 등급 변경 · 카드 갱신 · 해지 · 일할 환급 요청 | 위와 동일 |

### 11.2 헤더·푸터·JSON-LD

- `components/layout/Header.tsx` — `directLinks`에 `{ id:'artists', label:t('nav.short.artists'), href:/${locale}/artists }`를
  추가하고 `desktopNavItems`에서 가격 다음에 배치. `MobileNav`의 `quickLinks`에도 추가. **`locale === 'ko'`일 때만**
  (푸터의 발매 프로젝트 절과 같은 게이트).
- `components/layout/Footer.tsx` — "콘텐츠" 열에 링크 추가(ko 게이트).
- `lib/navLabels.ts` `NavKey`에 `artists` 추가 + `pages/_app.tsx` `siteNavSchema.hasPart`에 항목 추가.
  (조사 중 발견: `mixingMastering`이 `navLabels`에는 있는데 `hasPart`에는 빠져 있다 — 이번 커밋에서 같이 채운다.)
- `public/locales/*/common.json` 7개 로케일에 `nav.artists`·`nav.short.artists`·`artists.*` 키(패리티 테스트 때문에
  비-ko도 채운다). 페이지는 `i18nSections: ['artists']`.
- `lib/sitemap/routes.js` `pageRouteMap`에 `'/artists': path.join('artists','index.tsx')` 등록 후
  `npm run generate:page-lastmod` — **diff에서 이번에 실제 바뀐 라우트만 남긴다**(CLAUDE.md lastmod 절).
- `pages/api/llms.ts` 목록에 `/ko/artists` 추가.

### 11.3 UX·배색

- 후원 시작 버튼은 **`bg-primary`**. 목적지가 카카오가 아니므로 옐로 금지(배색 규칙). 카톡 문의는 보조 링크로 병행.
- 등급 카드는 `BaseCard glass` + `Button solid` 세 장. `PricingCard`는 `isKakaoCta` 분기와 서비스 가격 카피가
  붙어 있어 쓰지 않는다.
- 후원자 명단은 `displayConsent`인 후원자의 `displayName`만, 최신순, 금액 비공개.
- 1차(결제 전)에는 등급 카드 대신 "후원 오픈 준비 중 — 소식 받기"로 카톡 링크.
- GA4: `support_tier_select`·`support_subscribe` 이벤트. **key event로 올리지 않는다**(카톡 리드 기준선과 섞지 않기).

## 12. 관리자·알림

- `/admin/support` — 목록(아티스트·상태 필터), 상세(청구 이력·영수증·환불·해지·메일 재발송·미정합 표시),
  정산 탭(§10). API는 `pages/api/admin/support/*`, 인증은 기존 iron-session.
- 메일(Resend, 텍스트): 후원 시작 / 월 결제 완료(영수증 URL) / 결제 실패(카드 갱신 링크) / 해지 확인 /
  환급 완료. 운영자: 신규·실패·해지. 아티스트 소식 메일은 1차 범위 밖 — 관리자에서 후원자
  이메일을 아티스트별로 내보내면 운영자가 발송한다.

## 13. 보안·오류 처리

- 금액은 서버 상수에서만. authKey·customerKey는 DB 값과 대조 후에만 발급 호출.
- 관리 링크 토큰은 `isTokenMatch`(timing-safe). 관리 액션 IP당 20/h.
- 승인 성공 후 DB 실패 → 웹훅 재조회가 보정, 그래도 안 되면 관리자 "미정합" 목록(주문 paid인데 charge 없음 등).
- 크론 한 건 실패가 나머지를 막지 않는다(건별 try, 요약 로그). 크론 자체 실패는 다음 날 자연 재시도.
- 카드 실패 코드(`failureCode`)를 남겨 "한도 초과"와 "카드 정지"를 관리자가 구분한다.
- `payments.rawResponse` 5년 보관 정책은 기존과 동일. `subscriptions`의 카드 라벨은 마스킹 값만.

## 14. 테스트 전략

기존 관례대로 로직 옆 `*.test.ts`, TDD.

- `splitInclusiveAmount` — 5,000/10,000/30,000 분해가 정수이고 합이 맞는지
- `schedule.ts` — billingDay 28 고정, 다음 결제일 월말·윤년·연말 경계, KST
- `refund-policy.ts` — 7일 전액, 일할 계산 경계일, 관리자 임의 금액 범위
- 가입 API — 검증 실패, 레이트리밋, customerKey·subscriptionNo 유니크
- success 처리 — customerKey 불일치 거부, 발급·첫 결제 성공 batch, 결제 실패 시 pending 유지, 새로고침 멱등
- 크론 — claim이 한쪽만 통과, 실패 3회 후 paused, 재시도 일정, 50건 상한
- 웹훅 분기 — subscription 주문이 bookings 경로로 새지 않는지, DONE 보정, CANCELED 대사
- 정산 계산 — §10 예시 숫자 그대로, 환불 차감, taxType별 원천징수
- `artists.test.ts` — 7.1 규칙. 헤더 스냅샷·`localeKeyParity`·`routes.test.js` lastmod 커버리지는 기존 테스트가 잡는다
- 토스는 테스트 키로 전 구간 수동 검증(본인인증 `000000`) 후 라이브 전환. 라이브 첫 건은 운영자 본인 카드로 최소 등급 가입 → 셀프 해지·전액 환급까지 돌린다

## 15. 이번 범위에서 하지 않는 것

- 후원자 계정·로그인, 후원자 전용 콘텐츠 페이월
- 아티스트 셀프 관리 대시보드, 아티스트가 직접 글 올리기
- 자동 지급(토스 지급대행) — 접근 C, 규모가 커지면
- 비-ko 로케일 후원, 해외카드, 계좌 자동이체, 네이버페이·토스페이 빌링(별도 심사)
- 1회성 후원, 등급별 차등 혜택, 목표액·달성률 표시
- 알림톡

## 16. 구현 계획으로 넘길 때 확인할 것

이 문서가 승인되면 `writing-plans`로 계획을 쓴다. 계획은 1차·2차·3차를 각각 독립 PR로 나누고,
2차 PR은 §5의 1~4가 끝났다는 운영자 확인을 머지 조건으로 둔다. 토스 래퍼는 `lib/booking/toss.ts`의
`request` 헬퍼를 `lib/toss/client.ts`로 빼서 예약·후원이 함께 쓰게 한다 — 그 외 기존 예약 코드는
웹훅 분기 한 곳만 건드린다.
