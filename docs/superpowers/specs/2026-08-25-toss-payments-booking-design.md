# 토스페이먼츠 예약·결제 시스템 설계

- 작성일: 2026-08-25
- 상태: 승인된 설계 (구현 계획 수립 전)
- 범위: Phase 1 상세 + Phase 2/3 방향 확정

## 1. 배경과 목표

Studio NOL은 토스페이먼츠와 가맹 계약을 맺고 온라인 예약·결제를 도입한다.
현재 전환 경로는 카카오톡 상담(검증된 유일 전환 채널)이며, 온라인 결제는 이를
**대체하지 않고 병행**하는 추가 경로다.

확정된 방향:

| 결정 | 선택 |
|---|---|
| 예약 성격 | 실시간 슬롯 예약 + 결제 (가용성 캘린더, 중복 방지 포함) |
| 대상 서비스 | 세션 4종(녹음·성우·축가·커버영상) + 믹싱/마스터링 주문형 + 연습실 월세·레슨 월정액 자동결제 |
| 결제 금액 | 전액 선결제, VAT 포함액 표기·청구 |
| 일정 관리 | 구글 캘린더 양방향 연동 (구현 방식은 §6) |
| 취소/환불 | 기한별 차등 환불 + 고객 셀프 취소 |
| 로케일 | ko 전용. 비-ko 6개 로케일은 기존 /contact 폼 유지 |
| 고객 계정 | 없음. 게스트 예약 + 이메일 토큰 링크로 관리 (전자계약 signToken 패턴) |

## 2. 단계 분할 (접근 A)

- **Phase 1 — 결제 코어 + 세션 슬롯 예약** (이 문서의 상세 범위)
  - 주문·결제·환불·예약 테이블, 토스 결제위젯 v2, 서버 승인, 웹훅, 환불 엔진
  - 세션 4종 슬롯 예약 페이지, 구글 캘린더 연동, 관리자 예약 탭, 알림
- **Phase 2 — 믹싱/마스터링 주문형**
  - 슬롯 없이 레벨 선택 → 결제 → 파일 전달 안내. Phase 1 결제 코어 재사용
- **Phase 3 — 자동결제(빌링키)**
  - 연습실 월 36만·레슨 월 35만. 토스 **자동결제 계약(별도 심사) 완료가 전제조건**
  - 연습실은 기존 전자계약과 연결: 계약 서명 완료 → 빌링키 등록 유도
  - `billing_keys`·`subscriptions`·`subscription_payments` 테이블 추가는 이 단계에서

각 Phase는 독립 배포·검증 단위다. Phase 1이 검증되기 전에 Phase 2/3 코드를
합치지 않는다.

## 3. 전제 조건 (코드 밖 준비물)

1. 토스페이먼츠 일반결제 계약 + 테스트/라이브 API 키 (Phase 3은 자동결제 계약 별도)
2. **통신판매업 신고** — 온라인 선결제의 법적 요건이자 가맹 심사 요구사항.
   미신고 상태면 개발과 병행해서 신고 진행
3. 구글 클라우드 프로젝트 + Calendar API 활성화 + 서비스 계정 생성,
   사장님 캘린더를 서비스 계정 이메일에 공유(쓰기 권한)

## 4. 데이터 모델

기존 Turso(libSQL) + Drizzle에 테이블을 추가한다. `db/schema.ts` 확장.
새 DB·새 ORM 도입 없음.

| 테이블 | 역할 | 핵심 컬럼 |
|---|---|---|
| `orders` | 결제 단위 SSOT | id, orderNo(토스 orderId로 사용, 유니크), type(`session`/`mixing`/`subscription`), customerName/Phone/Email, itemAmount, vatAmount, totalAmount, status, manageToken(유니크), createdAt/updatedAt |
| `payments` | 토스 결제 기록 | orderId FK, paymentKey(유니크), method, approvedAt, receiptUrl, rawResponse(JSON), status |
| `refunds` | 환불 이력 | paymentId FK, amount, reason, requestedBy(`customer`/`admin`), tossTransactionKey, status, createdAt |
| `bookings` | 세션 예약 | id, orderId FK, serviceType, startAt, endAt, durationHours, status, gcalEventId, customerNote, cancelledAt |
| `availability_blocks` | 관리자 수동 예약 불가 블록 | id, startAt, endAt, memo, createdAt |
| `webhook_events` | 토스 웹훅 멱등 기록 | eventKey(유니크 — 이벤트 식별자), payload, processedAt |

상태 전이:

- `orders.status`: `pending` → `paid` → (`partially_refunded` | `refunded`) / `pending` → `expired`(15분 미결제) / 승인 실패 → `failed`
- `bookings.status`: `pending`(슬롯 선점) → `confirmed`(결제 승인) → `completed` | `no_show` | `cancelled`

금액은 `data/pricing.ts` SSOT 상수에서만 계산한다. VAT는 상품가의 10%를
분리 저장한다(itemAmount + vatAmount = totalAmount). 서버가 주문 생성 시점에
계산·저장하고, 클라이언트가 보낸 금액은 절대 신뢰하지 않는다.

### 동시성 — 중복 예약 방지

예약 생성은 단일 트랜잭션에서: 겹침 검사(confirmed·pending 예약 + 수동 블록)
→ 통과 시 `pending`으로 INSERT. 겹침 검사와 INSERT 사이에 다른 요청이 끼지
못하게 트랜잭션으로 묶는다(전자계약 `lib/contracts/conflict.ts`,
`sign-transaction.ts`와 같은 패턴). `pending`은 15분간 슬롯을 점유하고,
만료는 크론이 아니라 **lazy 방식**으로 처리한다 — 겹침 검사가 15분 지난
pending을 점유로 치지 않고, 슬롯 조회·관리자 목록이 열릴 때 상태를 정리한다
(`expireOverdueContracts`와 같은 패턴, Vercel 크론 빈도 제약 회피).

## 5. 결제 흐름 (토스 결제위젯 v2)

의존성 추가: `@tosspayments/tosspayments-sdk` (클라이언트 위젯).
서버는 REST 직접 호출(별도 서버 SDK 불필요) — Basic auth(secretKey).

1. **주문 생성** — `POST /api/bookings` : 입력 검증 → 트랜잭션으로
   `orders`(pending) + `bookings`(pending, 슬롯 선점) 생성 → orderNo 반환
2. **위젯 결제** — 클라이언트에서 결제위젯 렌더, `requestPayment({ orderId: orderNo,
   amount: totalAmount, successUrl, failUrl })`
3. **서버 승인** — `POST /api/payments/confirm` :
   - 우리 DB 주문의 totalAmount와 리다이렉트 파라미터 amount 일치 검증(위변조 차단)
   - 토스 `POST /v1/payments/confirm` 호출
   - 성공 시 트랜잭션: `orders`→paid, `bookings`→confirmed, `payments` INSERT
   - 이후 후처리(§6 캘린더 이벤트 생성, §9 알림)는 응답 뒤 실행하고 실패를 DB에 기록
4. **웹훅(백업 경로)** — `POST /api/payments/webhook` :
   - 페이로드를 신뢰하지 않고 paymentKey로 토스 API 재조회 후 상태 동기화(위조 방어)
   - `webhook_events`로 멱등 처리. 승인 API가 이미 처리한 이벤트는 no-op
5. **환불** — 토스 `POST /v1/payments/{paymentKey}/cancel` (부분취소 지원)

보안:
- secretKey는 서버 환경변수 전용(`TOSS_SECRET_KEY`), 클라이언트에는
  clientKey(`NEXT_PUBLIC_TOSS_CLIENT_KEY`)만
- 주문 생성·승인·취소 API는 기존 `rate_limits` 테이블로 속도 제한
- 관리 페이지 접근은 manageToken(충분한 엔트로피, 유니크) 필수

## 6. 구글 캘린더 연동

미러 동기화 대신 기능적 양방향:

- **나가는 방향**: 예약 confirmed 시 캘린더 이벤트 자동 생성(제목: 서비스·고객명,
  설명: 연락처·요청사항·관리자 링크). 취소 시 이벤트 삭제. `bookings.gcalEventId`로 연결
- **들어오는 방향**: 슬롯 조회 API가 캘린더 **FreeBusy를 실시간 조회**(60초 캐시).
  사장님이 캘린더에 직접 넣은 일정이 즉시 예약 불가로 반영된다

동기화 테이블·워처 채널·폴링 크론이 없으므로 "동기화 지연으로 이중 예약"
경로가 구조적으로 없다. FreeBusy 조회 실패 시 **해당 시간대를 예약 불가로
처리**(fail-closed) — 캘린더를 못 읽는 상태에서 예약을 받지 않는다.

인증: 서비스 계정 JSON 키를 환경변수로 주입, 사장님 캘린더를 서비스 계정에
공유. OAuth 리프레시 토큰의 만료·재동의 문제를 회피한다.

가용 슬롯 계산: 영업시간 상수(코드 설정) − FreeBusy 바쁨 구간 −
confirmed/pending 예약 − 수동 블록. 슬롯 단위는 1시간, 상품별 최소 시간
(시간제 녹음 2시간, 1프로 3시간 등)은 상품 정의에 둔다.

## 7. 환불 엔진

정책 상수를 한 모듈에 두고(`lib/booking/refund-policy.ts`) 셀프 취소·관리자
취소가 같은 계산 함수를 쓴다.

기본 규정(설계 승인 시 채택, 비율 변경은 상수 수정만으로 가능):
**이용일 3일 전까지 100% / 2일 전~전일 50% / 당일 0%**. 경계는 이용일 기준 자정(KST) — 전자계약에서 시간대 분쟁을 겪었으므로
(`258e8e41cc`) 기산점·시간대를 테스트로 고정한다.

- 셀프 취소: 관리 페이지에서 "지금 취소하면 N원 환불"을 결제 화면과 동일한
  VAT 분해 표기로 보여주고, 동의 시 자동 부분환불 실행
- 관리자 취소: 규정과 무관하게 임의 금액 환불 가능(천재지변 등 예외 대응)
- 환불 완료 시 `bookings` 취소 + 캘린더 이벤트 삭제 + 고객·운영자 알림

> **주의(Phase 2)**: `computeRefund`는 `totalAmount` 전액 기준이다. 관리자 부분환불을
> booking 취소 없이 허용하는 순간 기환불액 차감이 필수가 된다 — refunds 합계 대사를
> 반드시 함께 설계할 것.

## 8. 페이지 / UX (전부 /ko/ 전용)

| 라우트 | 역할 |
|---|---|
| `/ko/booking/[service]` | 예약 페이지 4종. 단계: 상품/시간 선택 → 날짜·슬롯 → 정보 입력 + 환불규정 동의 → 결제위젯 |
| `/ko/booking/success` · `/ko/booking/fail` | 토스 리다이렉트 수신. success는 서버 승인 완료 후 확정 화면 |
| `/ko/booking/manage/[orderNo]` | 토큰 링크 예약 확인·셀프 취소 |
| `/ko/terms` + 환불규정 | 이용약관·환불규정 고지. 푸터에 사업자 정보 + 통신판매업 신고번호 |

- 시간제 상품은 시간 수 선택 → 금액·슬롯 길이 동시 계산
- 금액 표기는 항상 분해: "상품가 250,000 + VAT 25,000 = 275,000원".
  숫자는 `data/pricing.ts` 상수 + `formatPriceAmount`만 사용(리터럴 금지)
- 예약 퍼널(`/ko/booking/*`)은 전자계약과 같은 트랜잭셔널 페이지로 취급:
  **noindex + 사이트맵 제외 + robots disallow**. 색인 진입은 기존 서비스 LP가
  담당하므로 `pageRouteMap`/`pageLastmod` 절차는 해당 없음
- 디자인은 기존 디자인 시스템(BaseCard glass variant 등) 관례를 따르되,
  결제위젯 영역은 토스 위젯 스타일 그대로 둔다

### 기존 서비스 페이지 CTA 위계

옐로는 카카오 전용(배색 규칙 유지). "온라인 예약" 버튼은 `bg-primary` 계열로
추가하고 카카오 CTA와 **병행**한다. 카카오 CTA의 위치·색·문구는 건드리지
않는다. 히어로에서는 기존 위계 규칙(옐로 1차 + 스크림 2차)에 예약 버튼이
끼어들며 3버튼이 되지 않도록, 예약 진입은 히어로가 아니라 가격/CTA 섹션에
배치한다.

## 9. 관리자 · 알림

- **관리자**: 기존 contracts 관리자(iron-session, admin rate limit 재사용)에
  예약 탭 추가 — 예약 목록/상세, 수동 블록 CRUD, 임의 환불, 상태 변경(완료/노쇼)
- **알림(Resend)**:
  - 고객: 예약 확정(관리 링크 포함), 취소·환불 확인
  - 운영자: 신규 예약, 셀프 취소 발생
  - 발송 실패는 contracts의 `notificationError` 패턴대로 DB에 기록,
    관리자 화면에서 재발송
- 알림톡(Solapi)은 알림 발송을 인터페이스로 분리해 나중에 채널만 추가할 수
  있게 한다(이번 범위에서는 구현하지 않음)

## 10. 에러 처리 원칙

- 승인 성공 후 DB 기록 실패: 토스 결제는 성공했는데 우리 상태가 pending인
  상황 — 웹훅 재조회 경로가 복구한다. 웹훅도 실패하면 관리자 화면의
  "미정합 주문" 목록에 노출
- 슬롯 선점 후 결제 이탈: 15분 경과 시 겹침 검사에서 즉시 무시되고,
  다음 슬롯 조회·관리자 목록 접근 때 `orders`→expired로 정리(lazy)
- FreeBusy 조회 실패: fail-closed (§6)
- 환불 API 실패: `refunds.status`로 실패 기록, 관리자 재시도

## 11. 테스트 전략

기존 관례대로 로직 옆 `*.test.ts`. TDD로 진행. 핵심 커버리지:

- 슬롯 겹침 검사(경계 접촉·포함·부분 겹침)
- 환불 계산 함수(기한 경계일·KST 자정 기산·부분환불 금액)
- 금액 검증(주문 금액 ≠ 리다이렉트 금액 → 승인 거부)
- 웹훅 멱등성(같은 이벤트 2회 수신 → 1회 처리)
- pending 만료 해제
- 토스 API는 테스트 키로 전 구간 수동 검증 후 라이브 키 전환

## 12. 이번 범위에서 하지 않는 것

- 고객 계정·로그인
- 비-ko 로케일 예약·해외카드 결제
- 알림톡 발송(인터페이스만 분리)
- 캘린더 미러 동기화·워처 채널
- Phase 2(믹싱 주문형)·Phase 3(자동결제) 구현 — 방향만 확정, 각자 별도
  스펙·계획으로 진행
