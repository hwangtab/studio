# 펀딩(리워드형 크라우드펀딩) 시스템 설계

- 작성일: 2026-09-08
- 상태: 승인된 설계 (구현 계획 수립 전)
- 범위: 1차 전체 — 프로젝트 파일 · 후원 · 토스 결제 · 무통장입금 · 관리자 · 약관 · 헤더
- 관련 문서: [2026-08-25-toss-payments-booking-design.md](2026-08-25-toss-payments-booking-design.md)(결제 코어),
  [2026-09-08-artist-support-design.md](2026-09-08-artist-support-design.md)(별개 상품, §13)

> **개정 (2026-09-11): 무통장입금 제거.** 운영자가 입금자명을 손으로 대조하고 청약철회 시
> 계좌로 직접 송금해야 하는 부담 때문에 결제수단에서 뺐다. 토스 결제위젯의 계좌이체가
> 대체한다. 이 문서에서 무통장입금·입금 안내 페이지(`/ko/funding/deposit/[orderNo]`)·
> 관리자 입금 확인(§4.5)·12시간 홀드·동명동액 중복 경고·홀드 남용 상한을 기술한 부분은
> **더 이상 정본이 아니다.** 중단 전에 만들어진 행과 관리자 수기 등록 건은 여전히
> `payment_method='bank_transfer'`로 남으며, 그 건들은 셀프 취소가 불가하고 문의로
> 접수해 계좌로 환불한다(약관 제8조). 자세한 경위는 PR #77.

## 1. 배경과 목표

음반을 제작할 때 텀블벅에서 열던 펀딩을 studionol.co.kr 안에서 연다. 스튜디오 놀은 이미
"펀딩 설계 대행"(`FUNDING_DESIGN_PRICE` 40만원 + 성공 수수료 10%)을 상품으로 팔고 음반 펀딩
수십 건·누적 약 3억원을 진행한 경력이 있다. 자체 펀딩 기능의 목적은 세 가지다.

1. 플랫폼 수수료(텀블벅 5% + VAT) 절감
2. 후원자 데이터(연락처·배송지·응원 메시지)를 스튜디오가 보유
3. "발매 프로젝트" 플래그십과 같은 사이트 안에서 제작비 조달까지 잇기

확정된 방향:

| 결정 | 선택 |
|---|---|
| 개설 주체 | 운영자가 저장소 파일로 등록. 판매자(자금 수취·통신판매업자)는 항상 스튜디오 놀 |
| 모금 방식 | Keep-it-All + 즉시 결제. 목표 미달이어도 모금액으로 제작을 진행한다 |
| 결제수단 | 토스 결제위젯(카드·계좌이체·간편결제) + 무통장입금 |
| 헤더 | '음원 발매' 드롭다운 안에 '펀딩' 항목. 진행 중일 때의 승격 노출은 하지 않는다 |
| 로케일 | ko 전용. 비-ko 로케일은 내비에 항목을 넣지 않는다 |
| 고객 계정 | 없음. 게스트 후원 + 이메일 토큰 링크로 관리(예약 `manageToken` 패턴) |
| 프로젝트 저장 | `content/funding/<slug>.md` (frontmatter + 마크다운 본문). DB에는 후원·결제·배송만 |

saf-2026의 펀딩 시스템은 **규칙과 UX만** 가져온다 — Keep-it-All, 무통장 12시간 홀드와
한정 수량 리워드 차단, 청약철회 중심 약관 구조, 셀프 취소 조건(결제 완료 + 발송 준비 전),
리워드 카드·진행률·후원자 명단 UI. 코드는 Supabase RPC·RLS와 App Router 서버 액션에 묶여
있어 이식하지 않는다. 크리에이터 셀프 개설·정산·세금계산서·PayPal·SMS는 범위 밖(§14).

## 2. 전제 조건 (코드 밖 준비물)

1. **통신판매업 신고** — `data/siteConfig.ts`의 `mailOrderSalesNumber`가 아직 빈 값이다.
   리워드 선주문 판매는 통신판매이므로 첫 프로젝트를 열기 전에 신고번호를 기입한다.
   약관·푸터·신뢰 고지가 이 값을 렌더한다.
2. **토스 카드사 심사 완료** — 2026-09-08 현재 진행 중(계약 후 최대 10~14영업일). 끝나기
   전에는 계좌이체·간편결제·무통장만 열린다. 코드는 결제수단을 가정하지 않는다(위젯이 개통된
   수단만 보여준다).
3. **리워드 물류** — CD·굿즈 제작과 발송은 운영 영역이다. 시스템은 배송지 수집·발송 상태·CSV
   내보내기까지만 맡는다.
4. **세무** — 리워드 판매는 VAT 과세 매출이다. 기부가 아니므로 기부금영수증은 발급하지 않고
   약관에 명시한다(saf-2026과 같은 판단).

## 3. 데이터 모델

### 3.1 프로젝트 = 저장소 파일

`content/funding/<slug>.md`. 파일명이 slug다. 본문은 마크다운이며 스토리와 같은
`MarkdownRenderer`로 렌더한다(숏코드·자동링크는 쓰지 않는다 — `currentSlug`를 넘기지 않는다).

```yaml
---
slug: example-2nd-album
title: 〈앨범명〉 2집 제작 펀딩
summary: 한 줄 요약 (목록 카드·OG description)
cover: /images/funding/example-2nd-album/cover.webp
ogImage: /images/funding/example-2nd-album/og.jpg
goalAmount: 3000000
startAt: 2026-10-01T10:00:00+09:00
endAt: 2026-10-31T23:59:59+09:00
status: auto          # auto | draft | closed
hidden: false         # true면 목록·사이트맵·llms에서 제외. URL 직접 접근만 (스모크 테스트용)
lastmod: 2026-09-20   # 사이트맵 lastmod
rewards:
  - id: cd
    title: CD + 감사 엽서
    description: 리워드 설명 (마크다운 아님, 줄바꿈 허용)
    amount: 30000              # VAT 포함가
    totalQuantity: 100         # 생략 = 무제한
    requiresShipping: true
    estimatedDelivery: 2026-12
    image: /images/funding/example-2nd-album/reward-cd.webp
---
본문(마크다운)
```

규칙:

- `rewards[].id`는 파일 안에서 유일하다. **오픈 뒤에는 리워드 id 삭제·개명과 금액 변경을 하지
  않는다.** 둘의 파급이 다르다.
  - **id 변경 → 재고 집계가 깨진다.** 이 문서는 한동안 "데이터는 깨지지 않고 표시만
    어긋난다"고 적었으나 사실이 아니다(2026-09-11 감사에서 정정). `lib/funding/service.ts`의
    재고 조건은 `fp.reward_id = <파일의 id>`로 기존 후원을 세므로, id가 바뀐 순간 그 후원들이
    안 세어져 **한정 100개짜리가 200개 팔린다.**
  - **금액 변경 →** 후원 행이 결제 당시 단가를 스스로 저장하므로 기록 자체는 남지만, DB의
    단가와 상세 페이지·관리자 화면·CSV의 표시가 어긋나 환불 금액과 모금액 설명이 맞지 않게
    된다. 가격을 바꿔야 하면 기존 리워드는 두고 새 id로 티어를 추가한다.

  이 규칙은 예전엔 "코드로 막을 수 없어 이 절이 정본"이었으나, 지금은
  `content/funding.baseline.json` + `content/funding.baseline.test.ts`가 slug × 리워드 id ×
  **단가** × 한정 여부를 고정해 CI에서 막는다(`npm run check:funding-baseline`).
- **리워드 없는 순수 후원 티어를 두지 않는다.** 반대급부 없는 모금은 기부금품법 대상이 될 수
  있다. 최소 티어는 "감사 메일 + 디지털 음원"처럼 반드시 무언가를 준다.
- 이미지는 `public/images/funding/<slug>/`에 두고 기존 `optimizeImages` 파이프라인을 탄다.
- 시각은 오프셋이 붙은 ISO 문자열이며 그대로 파싱한다. 경계는 테스트로 고정한다.

상태 판정(`lib/funding/projects.ts`, 순수 함수):

| 조건 | 상태 | 공개 | 후원 |
|---|---|---|---|
| `status: draft` | `draft` | 404 | 불가 |
| `status: closed` | `closed` | 공개 | 불가 |
| `now < startAt` | `upcoming` | 공개 | 불가 |
| `startAt ≤ now < endAt` | `live` | 공개 | 가능 |
| `now ≥ endAt` | `closed` | 공개 | 불가 |

### 3.2 DB — `db/schema.ts` 확장

기존 Turso(libSQL) + Drizzle에 추가한다. 새 DB·새 ORM 없음.

- `orders.type` enum에 `'funding'` 추가. `orders`·`payments`·`refunds`·`webhook_events`·
  `rate_limits`는 그대로 재사용한다. 돈의 SSOT는 계속 `orders`/`payments`다.
- 새 테이블 하나 — `funding_pledges`:

| 컬럼 | 설명 |
|---|---|
| `id` | PK |
| `orderId` | `orders.id` FK, unique(주문 1건 = 후원 1건) |
| `projectSlug` | 프로젝트 파일 slug |
| `rewardId` · `rewardTitle` · `unitAmount` · `quantity` | 후원 시점의 리워드 스냅샷. 파일이 바뀌어도 기록은 유지된다 |
| `additionalAmount` | 추가 후원금. 0 이상 5,000,000 이하, 1,000원 단위 |
| `paymentMethod` | `'toss'` \| `'bank_transfer'` |
| `holdExpiresAt` | 결제 대기 만료. 토스 +15분, 무통장 +12시간 |
| `paidAt` | 확정 시각(토스 승인 또는 관리자 입금 확인) |
| `supporterMessage` · `displayNamePublic` | 응원 메시지(관리자·운영자만 열람), 후원자 명단 이름 공개 동의 |
| `shippingName` · `shippingPhone` · `shippingPostcode` · `shippingAddress1` · `shippingAddress2` · `shippingMemo` | `requiresShipping` 리워드일 때만 |
| `fulfillmentStatus` | `'none'` → `'preparing'` → `'shipped'` → `'delivered'` |
| `trackingCompany` · `trackingNumber` | 발송 정보 |
| `entrySource` | `'online'` \| `'manual'`(관리자 수기 등록) |
| `refundRequestedAt` | 무통장 후원자의 셀프 취소 요청 시각(§4.7) |
| `adminMemo` | 관리자 메모 |
| `createdAt` · `updatedAt` | 감사 |

- 무통장 후원은 `payments` 행을 만들지 않는다. 확정은 `orders.status='paid'` + `paidAt`으로
  표현한다. 매출 집계는 `orders.status` 기준이라 결제수단과 무관하다.
- 상태 전이: `orders.status` `pending` → `paid` → `refunded` / `pending` → `expired`(대기 만료) /
  승인 실패 → `failed`. 펀딩에서 부분환불은 없으므로 `partially_refunded`는 쓰지 않는다.
  `fulfillmentStatus`는 `paid`인 후원에서만 의미가 있다.

금액(`lib/funding/amounts.ts`): 리워드 `amount`는 VAT 포함가다.
`totalAmount = unitAmount × quantity + additionalAmount`,
`itemAmount = Math.round(totalAmount / 1.1)`, `vatAmount = totalAmount − itemAmount`.
예약이 "공급가 + 10%"로 올라가는 것과 방향이 반대이지만 `orders`의 세 컬럼 규약
(`itemAmount + vatAmount = totalAmount`)은 같다. 클라이언트가 보낸 금액은 신뢰하지 않는다.

재고(`lib/funding/service.ts`):
`remaining = totalQuantity − Σquantity(paid) − Σquantity(pending ∧ holdExpiresAt > now)`.
`totalQuantity`가 없으면 `null`(무제한).

### 3.3 마이그레이션

`npm run db:generate`로 `drizzle/migrations/`에 SQL을 만든다. 통합 테스트는 이 폴더를 순서대로
in-memory libSQL에 적용하므로 SQL 파일만 있으면 된다. 번호는 생성 시점 기준이며 아티스트 후원
설계도 다음 번호를 예정하고 있다 — 먼저 병합되는 쪽이 그 번호를 가져가고 나중 쪽이 재생성한다(§13).

## 4. 후원 흐름

### 4.1 페이지 (전부 `/ko/` 전용)

| 라우트 | 렌더 | 역할 | 색인 |
|---|---|---|---|
| `/ko/funding` | `getStaticProps`(SSG) | 목록. live → upcoming → closed 순, hidden 제외 | 색인 |
| `/ko/funding/[slug]` | `getStaticPaths`(ko만, `fallback: false`) + `getStaticProps`(SSG) | 상세. DB를 읽지 않는다 | 색인 |

목록·상세의 내용은 저장소 파일에서만 오므로 배포가 곧 갱신이다. ISR을 두지 않는다. 다만
목록·상세의 **상태 배지·D-day·후원 버튼 활성 여부는 시각에 따라 바뀌므로** 빌드 시각이 아니라
§4.8 API 응답의 `state`를 우선한다(첫 렌더는 파일 기준, 응답이 오면 교체).
| `/ko/funding/[slug]/pledge` | `getServerSideProps` | 후원 위저드. `live`가 아니면 상세로 redirect | noindex |
| `/ko/funding/success` · `/ko/funding/fail` | `getServerSideProps` | 토스 리다이렉트 수신. success SSR에서 승인 | noindex |
| `/ko/funding/deposit/[orderNo]?token=` | `getServerSideProps` | 무통장 계좌·기한 안내 | noindex |
| `/ko/funding/manage/[orderNo]?token=` | `getServerSideProps` | 후원 확인 · 셀프 취소 · 배송지 확인 | noindex |
| `/ko/funding/terms` | `getServerSideProps` | 펀딩 약관(§9) | 색인 제외 |

- 목록·상세는 콘텐츠만 정적 생성한다. 진행률·후원자 수·남은 수량은 클라이언트가 §4.8 API로
  채운다. 빌드가 DB 환경변수에 묶이지 않고 숫자는 실시간이다. 진행률 영역은 높이를 예약해
  레이아웃 이동을 막는다.
- 비-ko 로케일: 목록·상세는 ko 경로만 생성되므로 404다(가이드 허브와 같은 처리). 트랜잭셔널
  페이지는 `terms.tsx`처럼 `getServerSideProps`에서 `/ko/...`로 redirect한다.
- 개인정보를 담는 페이지(success·deposit·manage)는 `denyContractPageCaching`으로 공유 캐시를
  막는다(예약 manage와 동일).

### 4.2 후원 생성 — `POST /api/funding/pledges`

입력: `projectSlug, rewardId, quantity, additionalAmount, paymentMethod, customerName,
customerPhone, customerEmail, supporterMessage?, displayNamePublic, shipping?{...}, termsAgreed: true`.

1. `Cache-Control: no-store`, IP당 10회/시간 속도 제한(`rate_limits`, 예약과 동일 한도)
2. 검증(`lib/funding/validation.ts`): 프로젝트가 `live`, 리워드 존재, 수량 1~10, 추가 후원금
   범위, 이메일 형식, `requiresShipping`이면 배송지 필수, 한정 수량 리워드에 무통장 불가,
   약관 동의
3. 같은 고객(이메일+연락처)의 기존 `pending` 펀딩 주문을 `expired`로 정리한다 — 위저드에서
   되돌아가 재제출할 때 자기 홀드에 막히지 않도록(예약 `createBookingOrder`와 같은 이유)
4. `orders`(pending, type funding) INSERT 후 `funding_pledges`를 **재고 조건이 붙은 단일
   `INSERT ... SELECT ... WHERE`** 로 넣는다. 조건은 §3.2의 `remaining ≥ quantity`
   (무제한이면 조건 없음). 동시 요청은 한쪽만 `rowsAffected = 1`이고, 0이면 주문을 `failed`로
   바꾸고 409 `sold_out`을 돌려준다.
5. 응답: `orderNo, itemAmount, vatAmount, totalAmount, paymentMethod, holdExpiresAt`,
   무통장이면 `depositUrl`(토큰 포함)

주문번호는 예약과 같은 생성기(`generateOrderNo`)를 쓰되 접두사를 `FND`로 한다. 토스
`orderId`로 그대로 쓴다.

### 4.3 토스 결제

- 클라이언트는 기존 `components/booking/TossPaymentWidget`을 그대로 쓴다. `orderName`은
  `[펀딩] {프로젝트 제목} · {리워드 제목}`을 100자에서 자른다. `successUrl`/`failUrl`은
  `/ko/funding/success`·`/ko/funding/fail`.
- success SSR → `confirmFundingPledge({ orderNo, paymentKey, amount })`
  (`lib/funding/confirm.ts`, 예약 `confirm.ts`와 같은 순서):
  1. 주문 조회, `type === 'funding'` 확인
  2. 이미 `paid`면 멱등 성공(새로고침·웹훅 중복)
  3. `pending`이 아니면 거부, 금액 불일치면 토스를 부르지 않고 거부
  4. `holdExpiresAt`이 지났으면 토스를 부르지 않고 거부(과금 없이 끝난다)
  5. 토스 `confirm` → 트랜잭션: `orders`→paid, `payments` INSERT, `paidAt` 기록
  6. 응답 뒤 메일 발송(§7). 실패는 `orders.notificationError`에 기록
- fail 페이지는 안내만 한다. pending 주문은 §4.6의 lazy 만료가 15분 뒤 정리한다.
- **마감 경계**: confirm은 `endAt`을 다시 보지 않는다. pending 생성 시점에 `live`였고 홀드
  안이면 승인한다 — 23:59에 결제창을 연 후원자를 거부하지 않는다.

### 4.4 웹훅 분기 — `lib/booking/webhook.ts`

`processTossWebhook`은 재조회한 결제의 `orderId`로 주문을 찾은 뒤 `order.type`으로 갈라진다.
`'session'`은 기존 경로 그대로, `'funding'`은 `confirmFundingPledge`(DONE)와
`syncFundingCancelledFromToss`(CANCELED — 토스 콘솔에서 취소한 경우 `orders`→refunded,
`refunds` 기록)로 넘긴다. 멱등 기록·키 회수·500 재시도 유도는 공통이다. 아티스트 후원
설계도 같은 지점에 `'subscription'` 분기를 예정하므로 **type 스위치 한 곳**으로 만든다(§13).

### 4.5 무통장입금

- 생성 시 `paymentMethod='bank_transfer'`, `holdExpiresAt = now + 12h`. 응답의 `depositUrl`로
  이동하고 같은 내용을 메일로 보낸다: 계좌(`lib/funding/policy.ts` 상수 — 전자계약 기본 계좌와
  동일: 카카오뱅크 3333-12-5480849 황경하 / 스튜디오 놀), 금액, 기한, **입금자명은 후원자
  이름과 같게**, manage 링크.
- **한정 수량 리워드는 무통장을 막는다**(폼에서 숨기고 서버가 거부). 12시간 홀드가 재고를 묶기
  때문이며 saf-2026과 같은 결정이다. 따라서 무통장 후원은 항상 무제한 리워드다.
- 관리자 "입금 확인": `pending ∧ bank_transfer`이면 `paid` + `paidAt`. 기한이 지나 `expired`가
  된 뒤 입금이 들어온 경우를 위해 "만료 건 되살리기"를 같은 액션으로 허용한다(`expired ∧
  bank_transfer` → `paid`). 무제한 리워드뿐이라 재고 재검증은 필요 없다.
- 대기 목록에 이름과 금액이 같은 건이 둘 이상이면 관리자 화면에 경고를 띄운다. saf-2026이
  이 매칭 실수로 이중 계상·미배송 사고를 겪었다.

### 4.6 대기 만료 (lazy)

`expireStalePledges(now)`: `pending ∧ holdExpiresAt < now`인 펀딩 주문을 `expired`로 바꾼다.
크론 없이 §4.8 상태 API, §4.2 생성, 관리자 목록, confirm 진입에서 호출한다(예약
`expireStaleOrders`와 같은 관례).

### 4.7 셀프 취소 — `/ko/funding/manage/[orderNo]?token=`

토큰 없음·불일치·주문 부재는 모두 같은 404다(주문번호 존재 여부를 흘리지 않는다).

취소 가능 조건(`lib/funding/policy.ts`의 순수 함수 하나가 셀프·관리자 양쪽에 쓰인다):
`orders.status = 'paid'` ∧ 프로젝트가 `live` ∧ `fulfillmentStatus = 'none'`.

- 토스: 전액 취소(`cancelPayment`, 멱등키 `refund:{orderNo}:{amount}`) → `refunds` INSERT →
  `orders`→refunded → 메일. 예약 `cancelBookingWithRefund`와 같은 골격이다.
- 무통장: 즉시 환불할 수 없다. `refundRequestedAt`을 기록하고 후원자·운영자에게 메일을 보낸다.
  운영자가 계좌로 환불한 뒤 관리자 화면에서 `refunded`로 바꾼다.
- 마감 후: 화면에 "청약철회 규정에 따라 문의" 안내와 카카오톡·메일 링크를 보여준다. 처리는
  관리자가 §9 약관대로 한다.

### 4.8 진행률 API — `GET /api/funding/[slug]/status`

응답 `{ state, goalAmount, raisedAmount, backerCount, percent, endAt, remaining: { [rewardId]: number | null }, publicBackers: string[] }`.
`paid`만 집계한다(무통장 대기는 포함하지 않는다). `publicBackers`는 이름 공개에 동의한 `paid`
후원자의 이름을 최신순 100명까지 담으며 §5 `BackerNameRoll`이 읽는다. 금액·연락처는 절대
싣지 않는다. `Cache-Control: public, s-maxage=60`.
호출 시 §4.6 만료를 먼저 적용한다. 클라이언트는 마운트 시 1회, `live`일 때만 5분 폴링.
실패하면 진행률 자리에 "집계 중"을 보이고 후원 버튼은 유지한다(최종 검증은 서버가 한다).

## 5. 페이지 구성 · 컴포넌트

`components/funding/` 아래에 둔다. 디자인은 기존 시스템(BaseCard glass variant, Button
primary)을 따른다. **후원 버튼은 `bg-primary`다. 옐로는 카카오 전용 규칙을 지킨다.**
상세 페이지의 카카오 문의 링크는 기존 규칙대로 옐로로 병행한다.

| 컴포넌트 | 역할 |
|---|---|
| `FundingProjectCard` | 목록 카드 — cover·title·summary·진행률·D-day·상태 배지 |
| `FundingProgress` | 모금액·달성률·후원자 수·D-day. §4.8 API를 읽는다. 높이 예약 |
| `RewardCard` | 금액·제목·설명·남은 수량(품절 배지)·배송 여부·예상 전달·"이 리워드로 후원하기" |
| `PledgeWizard` | §4.2 입력을 단계로 받는다. 표시 금액은 서버 응답 SSOT만 쓴다. 토스 15분 카운트다운 |
| `BankDepositGuide` | 계좌·금액·기한·입금자명 안내(deposit 페이지) |
| `BackerNameRoll` | 이름 공개에 동의한 `paid` 후원자 최신 100명. 금액 없음 |
| `FundingTrustNotice` | 사업자 정보·통신판매업 신고번호·약관·환불규정 링크(폼 하단·상세 하단) |
| `FundingMobileCta` | 모바일 하단 고정 "후원하기" → 리워드 섹션으로 스크롤. `live`에서만 |

상세 페이지 순서: 히어로(cover, title, summary, `FundingProgress`) → 본문 → 리워드 → 후원자
명단 → 신뢰 고지. `upcoming`은 오픈 일시를, `closed`는 최종 모금액과 "마감" 배지를 보인다.

위저드 단계: ① 리워드·수량·추가 후원금 → ② 후원자 정보(이름·연락처·이메일), 배송지
(`requiresShipping`일 때만: 받는 분·연락처·우편번호·주소·상세주소·메모, 텍스트 입력 —
우편번호 검색 API는 1차 범위 밖), 응원 메시지·이름 공개 동의, 동의 체크 1개(펀딩 약관·환불규정·
개인정보 처리방침 링크) → ③ 결제수단(토스 / 무통장) → ④ 토스 위젯 또는 무통장 안내로 이동.

## 6. 관리자

기존 `/admin` (iron-session, `authenticateAdminRequest`·`authenticateAdminApi`, 얕은 fetch
래퍼 패턴)에 펀딩 탭을 추가한다. `/admin/index.tsx`에 카드 하나.

- `/admin/funding` — 프로젝트 필터, 후원 목록(상태·결제수단·리워드·수량·배송 필요·발송 상태·
  등록 경로), 합계(확정 금액·후원자 수·입금 대기 금액·건수). 200건 초과 시 잘림 안내(예약과 동일).
  §4.5의 동명·동액 경고. 목록을 열 때 §4.6 만료를 적용한다.
- `/admin/funding/[id]` — 상세와 액션.
- API:
  - `PATCH /api/admin/funding/pledges/[id]` — `action`: `confirm_deposit`(§4.5, 되살리기 포함) ·
    `refund`(토스는 자동 취소 + `refunds`, 무통장은 기록만) · `set_fulfillment`(상태·운송장) ·
    `set_memo` · `resend_email`
  - `POST /api/admin/funding/pledges` — 수기 등록(현금·현장 후원). `entrySource='manual'`,
    주문번호 접두사 `FND-M`, `paymentMethod='bank_transfer'`, 즉시 `paid`, `payments` 없음
  - `GET /api/admin/funding/export?slug=` — CSV(주문번호·이름·연락처·이메일·리워드·수량·금액·
    배송지·메모·발송 상태). 개인정보라 `no-store`, 세션 필수
- 미정합 표시: `payments`는 있는데 `orders`가 `pending`인 주문(승인 뒤 DB 실패, 웹훅도 실패)을
  목록 상단에 띄운다(예약 스펙 §10과 같은 원칙).

## 7. 알림 (Resend, 텍스트 메일)

| 시점 | 받는 사람 | 내용 |
|---|---|---|
| 토스 승인 · 입금 확인 | 후원자 | 후원 확정, 리워드·수량·금액, 예상 전달 시기, manage 링크 |
| 무통장 생성 | 후원자 | 계좌·금액·기한·입금자명 안내, manage 링크 |
| 셀프 취소(토스) | 후원자 | 환불 완료 금액·수단 |
| 셀프 취소 요청(무통장) | 후원자 · 운영자 | 환불 계좌 안내 요청 / 처리 요청 |
| 관리자 환불 | 후원자 | 환불 처리 안내 |
| 새 후원 확정 · 무통장 대기 생성 · 셀프 취소 | 운영자 | 요약 + 관리자 링크 |

발송 실패는 `orders.notificationError`에 기록하고 관리자 화면에서 재발송한다. 완료 화면은
메일과 무관하게 manage 링크를 직접 보여준다(예약과 동일 — 메일 실패가 후원자의 취소 경로를
없애지 않는다).

## 8. 헤더 · 노출 · SEO

- `components/layout/Header.tsx`의 `navGroups` `release` 항목 끝에
  `{ label: t('nav.funding'), href: `/${locale}/funding` }`를 **`locale === 'ko'`일 때만**
  넣는다. `nav.funding` 키는 `localeKeyParity` 때문에 7로케일 `common.json`에 모두 추가한다.
  `Header.test.tsx` 스냅샷 갱신.
- 사이트맵: `/funding`은 `pageRouteMap`에 등록하고 `generate:page-lastmod`로 lastmod를 만든다.
  상세는 동적 라우트라 `next-sitemap.config.js`의 `additionalPaths`에서 `content/funding`을 읽어
  `draft`·`hidden`이 아닌 프로젝트를 ko URL로 싣는다(lastmod = frontmatter `lastmod`).
  `lib/sitemap/routes.js`의 `KO_ONLY_PATH_PREFIXES`에 `/funding/`을 넣어 hreflang을 내지 않는다.
- robots·사이트맵 제외: `/ko/funding/success`, `/ko/funding/fail`, `/ko/funding/deposit/`,
  `/ko/funding/manage/`, `/ko/funding/*/pledge`, `/ko/funding/terms`. `next-sitemap.config.js`의
  `disallow`·`exclude`에 넣고 생성된 `public/robots.txt`를 함께 커밋한다(`/ko/booking/` 선례).
- `pages/api/llms.ts`에 `/ko/funding` 한 줄(진행 중 프로젝트가 있으면 제목까지).
- JSON-LD는 1차에 넣지 않는다. OG 태그는 frontmatter `ogImage`·`summary`.
- GA4: `funding_pledge_start`(pledge 페이지 진입), `funding_pledge_paid`(success 확정)를
  `utils/analytics.ts`에 추가한다. **key event로 지정하지 않는다**(리드 지표 무결성 규칙).

## 9. 약관 — `/ko/funding/terms`

`pages/[locale]/terms.tsx`처럼 페이지 파일의 상수로 조항을 둔다. 사업자 정보·통신판매업
신고번호·계좌는 `siteConfig`와 `policy.ts` 상수를 렌더해 코드와 문서가 어긋나지 않게 한다.
saf-2026 `FUNDING_TERMS_DOCUMENT`의 조항 구조를 스튜디오 놀에 맞춰 다시 쓴다.

1. 목적 · 2. 정의(프로젝트·리워드·후원·후원자)
3. 후원의 법적 성격 — 통신판매 계약이며 기부가 아니다. 기부금영수증·세액공제 불가. "기부"
   표현을 쓰지 않는다
4. 사업자 정보(렌더)
5. 후원 신청과 결제 — 결제 완료 시 성립, 대기 만료 시 자동 해제
6. 후원금의 집행 — Keep-it-All 고지. 목표 미달이어도 제작을 진행하며, 제작이 불가능해지면
   전액 환불한다
7. 리워드 제공 — 예상 전달 시기는 계획이며 지연 시 후원자에게 고지한다
8. 청약철회 — 전자상거래법 제17조. 마감 전·발송 준비 전은 manage 페이지에서 전액 환불.
   리워드 수령 후 7일, 표시와 다른 경우 3개월/안 날부터 30일
9. 청약철회 제한 — 개별 제작(각인 등)은 사전 고지 + 개별 동의 시
10. 환불 — 3영업일 안, 결제수단별 경로(토스 취소 / 계좌 환불)
11. 후원자의 의무 · 12. 개인정보 — 배송·CS 목적, 리워드 전달 완료 후 1년 보관 뒤 파기
13. 면책 · 14. 분쟁 · 15. 준거법 · 16. 문의처

기존 `/ko/terms`에는 펀딩 약관 링크 한 줄만 추가한다(아티스트 후원 설계가 같은 파일에 절을
추가할 예정이라 충돌면을 최소화한다).

## 10. 에러 처리 원칙

- **승인 성공 후 DB 기록 실패**: 웹훅 재조회 경로가 복구한다. 웹훅도 실패하면 관리자 미정합 목록.
- **재고 경쟁**: 단일 INSERT 조건으로 한쪽만 성공. 실패 쪽은 409 + 위저드가 리워드 단계로 복귀.
- **대기 만료 후 결제**: confirm이 토스 호출 전에 거부한다(과금 없음).
- **상태 API 실패**: "집계 중" 표시. 후원은 막지 않는다.
- **무통장 기한 초과 입금**: 관리자 되살리기(§4.5). 관리자 판단이며 시스템은 막지 않는다.
- **메일 실패**: `notificationError` + 재발송. 화면은 발송 여부를 단언하지 않는다.
- **환불 API 실패**: `refunds.status='failed'` 기록, 관리자 재시도(예약과 동일).

## 11. 테스트 전략

기존 관례대로 로직 옆 `*.test.ts`, TDD.

- **단위** `lib/funding/`: `projects`(상태 판정 경계·frontmatter 파싱·검증), `amounts`(VAT 분해·
  추가 후원금 범위·수량), `validation`, `policy`(취소 가능 판정 표), `csv`(따옴표·개행 이스케이프)
- **통합** (in-memory libSQL + `drizzle/migrations`, 예약 `*.integration.test.ts` 패턴):
  같은 리워드 `remaining = 1`에 동시 2요청 → 1건만 성공 / confirm 멱등·금액 불일치·만료 거부 /
  무통장 확인·만료·되살리기 / 웹훅 type 분기(펀딩 DONE → 확정, CANCELED → refunded 동기화,
  예약 주문은 기존 경로) / 셀프 취소 조건과 무통장 요청 경로
- **content** `content/funding.test.ts`: 파일마다 스키마, `slug` = 파일명, 리워드 id 유일,
  이미지 파일 존재, `startAt < endAt`, `goalAmount > 0`, 리워드 1개 이상
- **기존 게이트**: `localeKeyParity`(`nav.funding`), `routes.test.js` lastmod 커버리지(`/funding`),
  `Header.test.tsx` 스냅샷, `i18nKeys`
- **라이브 검증**: `hidden: true` 스모크 프로젝트에 1,000원 무제한 리워드를 두고 토스 실결제 →
  셀프 취소 전액 환불, 무통장 → 입금 확인 → 관리자 환불 기록. 검증 뒤 `status: draft`로 내린다.

## 12. 구현 순서 (구현 계획 문서에서 상세화)

1. 스키마·마이그레이션, `lib/funding` 도메인(프로젝트 로더·상태·금액·재고·정책) + 단위 테스트
2. 후원 생성 · 승인 · 웹훅 분기 · 만료 · 취소 + 통합 테스트
3. 공개 페이지 · 컴포넌트 · 위저드 · 토스 · 무통장 안내
4. 관리자 화면 · API · 메일 · CSV
5. 약관 · 헤더 · 사이트맵 · robots · llms · content 테스트
6. 스모크 프로젝트로 라이브 검증

각 단계는 독립 커밋 단위이며 3부터 화면이 생긴다. 1~2가 통합 테스트로 검증되기 전에 3을
시작하지 않는다.

## 13. 아티스트 후원 멤버십 설계와의 관계

같은 날 별개 세션에서 작성된 [2026-09-08-artist-support-design.md](2026-09-08-artist-support-design.md)는
**월 정기결제 멤버십**(Patreon형)이고 이 문서는 **프로젝트 단위 리워드 펀딩**(텀블벅형)이다.
상품이 다르므로 통합하지 않는다. 다만 접점이 있어 병합 순서를 정한다.

| 접점 | 규칙 |
|---|---|
| `orders.type` | 이쪽은 `'funding'` 추가. `'subscription'`은 이미 enum에 있다 |
| `processTossWebhook` 분기 | 먼저 병합되는 쪽이 `order.type` 스위치를 만들고, 나중 쪽은 case만 추가한다 |
| 마이그레이션 번호 | 먼저 병합되는 쪽이 다음 번호. 나중 쪽은 rebase 후 재생성 |
| 헤더 | 이쪽은 '음원 발매' 드롭다운 항목, 저쪽은 직결 링크 — 자리가 겹치지 않는다. 라벨은 '펀딩'과 '아티스트 후원'으로 구분한다 |
| `/ko/terms` | 이쪽은 링크 한 줄, 저쪽은 절 추가 — 충돌 시 저쪽 절 아래에 링크를 둔다 |
| 전제 | 통신판매업 신고·카드사 심사는 공통. 한 번 처리하면 둘 다 풀린다 |

## 14. 이번 범위에서 하지 않는 것

- 크리에이터 셀프 개설 · 심사 · 사이트 내 정산 · 세금계산서 자동화
- All-or-Nothing · 예약결제(빌링키) · 부분환불 UI
- 해외 결제(PayPal) · 비-ko 로케일 · SMS/알림톡
- 회원 계정 · 마이페이지
- 응원 메시지 공개 벽(데이터는 저장, 노출은 2차) · 우편번호 검색 API · 홈/발매 페이지 배너 ·
  프로젝트 JSON-LD
- 관리자 UI에서의 프로젝트·리워드 편집(파일이 정본)
