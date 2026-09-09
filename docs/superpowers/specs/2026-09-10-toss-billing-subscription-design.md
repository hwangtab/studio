# Phase 3 — 자동결제(빌링키) 구독: 연습실 월 이용료 · 프로듀싱 레슨 월정액

- 작성일: 2026-09-10
- 상위 설계: `docs/superpowers/specs/2026-08-25-toss-payments-booking-design.md` §2 Phase 3
- 상태: 승인된 사업 판단 반영, 구현 계획 수립 전
- 사업 판단(2026-09-10, 황경하):
  - **시작 방식: 관리자가 링크 발송.** 셀프 가입 페이지 없음. 연습실은 서명 완료된 전자계약에서 구독을 만들고, 레슨은 관리자가 고객 정보를 넣어 만든다.
  - **첫 결제: 카드 등록 즉시 첫 달치 결제.** 이후 매월 같은 날(연습실은 계약서의 `paymentDay`).
  - **VAT 별도(+10%).** 연습실 396,000원 · 레슨 385,000원 청구. 계약서 템플릿에 "부가세 별도" 명시 필요.
  - 전제: 토스 **API 개별 연동 키(ck/sk)** — 빌링은 결제위젯 키(gck/gsk)로 불가. 테스트 키로 개발·검증하고, 빌링 심사 통과 후 라이브 키 교체.

## 1. 배경

토스 빌링(자동결제) 심사는 "빌링을 쓰는 서비스가 실제로 있어야" 통과된다. 연습실 월 36만·레슨 월 35만이 그 서비스다. 이 문서는 심사에 제출할 실물이자 운영 기능을 정의한다.

## 2. 범위

포함:
- 빌링키 발급(카드 등록) 페이지 — 관리자가 보낸 토큰 링크로만 진입
- 첫 결제(즉시) + 정기결제(Vercel Cron, 매일 KST 09:00)
- 결제 실패 재시도·정지·재개, 고객 셀프 해지(다음 결제일부터)
- 관리자: 구독 생성(연습실 계약 연결 / 레슨 직접), 목록·상세, 수동 결제, 해지, 카드 재등록 링크 재발송
- 메일: 카드 등록 안내, 결제 완료(매월), 결제 실패, 해지 확인

제외:
- 셀프 가입, 일할 계산·중도 환불 자동화(계약 제2조·제4조의 일할 반환은 관리자가 기존 환불 도구로 수동 처리), 카드 외 결제수단, 비-ko.

## 3. 토스 연동 (빌링)

- SDK: `@tosspayments/tosspayments-sdk` v2 `loadTossPayments(clientKey).payment({ customerKey })` → `requestBillingAuth({ method: 'CARD', successUrl, failUrl, customerEmail, customerName })`. clientKey는 **API 개별 연동 클라이언트 키**(`NEXT_PUBLIC_TOSS_BILLING_CLIENT_KEY`).
- successUrl 쿼리 `customerKey`, `authKey` → 서버 `POST /v1/billing/authorizations/issue` `{ authKey, customerKey }` → `billingKey`, 카드 정보(`card.number` 마스킹, `card.company`) 수신. 시크릿은 `TOSS_BILLING_SECRET_KEY`.
- 결제: `POST /v1/billing/{billingKey}` `{ customerKey, amount, orderId, orderName, customerEmail, customerName }`. `Idempotency-Key`는 `billing:{subscriptionId}:{cycleYm}` — 같은 달 재시도가 이중 청구되지 않게.
- customerKey: 구독마다 고유(`sub_{subscriptionId}`), 예측 불가여야 한다는 토스 규격 → 랜덤 uuid 기반.
- 웹훅: 빌링 결제도 `PAYMENT_STATUS_CHANGED`로 온다. 기존 `pages/api/payments/webhook.ts`가 `orderId`로 주문을 찾으므로, 구독 결제도 `orders`에 행을 만든다(type `subscription`).

## 4. 데이터 모델 (`db/schema.ts`, 마이그레이션 1건)

| 테이블 | 역할 | 핵심 컬럼 |
|---|---|---|
| `subscriptions` | 구독 SSOT | id, kind(`practice-room`\|`lesson`), contractId(FK contracts, 연습실만), customerName/Phone/Email, customerKey(유니크), itemAmount(월, VAT 별도), vatAmount, totalAmount, billingDay(1~31, 연습실=contract.paymentDay), status(`pending_card`\|`active`\|`past_due`\|`paused`\|`cancelled`\|`ended`), billingKeyId(FK), nextBillingAt, currentPeriodStart/End, setupToken(유니크 — 카드 등록 링크), manageToken(유니크 — 고객 해지·조회), cancelledAt, cancelReason, endsAt(해지 예정일), notificationError, createdAt/updatedAt |
| `billing_keys` | 카드 | id, subscriptionId, billingKey(토스, 유니크), cardCompany, cardNumberMasked, cardType, issuedAt, revokedAt, rawResponse |
| `subscription_payments` | 회차 결제 | id, subscriptionId, orderId(FK orders), cycleYm(`YYYY-MM`), attempt, amount, status(`pending`\|`paid`\|`failed`), tossCode/tossMessage, paymentKey, attemptedAt, paidAt. (subscriptionId, cycleYm, attempt) 유니크 |

`orders.type = 'subscription'`(enum에 이미 있음). 회차마다 orders 1건 + payments 1건 — 기존 관리자·웹훅·환불 도구가 그대로 쓰인다. 구독 회차 환불은 기존 `cancelBookingWithRefund` 관리자 경로에 `subscription` 분기(하위 엔티티 없음, 잔액 캡만).

## 5. 상태 기계

```
pending_card ──카드 등록+첫 결제 성공──▶ active
active ──결제일 실패──▶ past_due ──재시도 성공──▶ active
past_due ──3회 실패(D+0, D+1, D+3)──▶ paused (관리자 알림, 고객 메일 "카드 재등록")
paused ──카드 재등록+미납 결제──▶ active
active|past_due|paused ──고객 해지──▶ cancelled (endsAt = currentPeriodEnd, 그때까지 이용)
cancelled ──endsAt 도달──▶ ended
연습실: contract terminated ──▶ 구독 cancelled(관리자 확인)
```

- 재시도 스케줄: 실패 당일·+1일·+3일 (총 3회). 각 시도는 `subscription_payments` 행 하나.
- `nextBillingAt` 계산: 다음 달 `billingDay` KST 09:00. 그 달에 그 날이 없으면 말일(계약 제2조 ①과 동일).
- 결제 성공 시 `currentPeriodStart/End` 갱신, `nextBillingAt` 전진.

## 6. 흐름

**관리자 → 구독 생성**
- 연습실: 관리자 계약 상세(`/admin/contracts/[id]`)에 "정기결제 링크 만들기" — 계약이 `signed`일 때만. 고객 정보·월 이용료·billingDay를 계약에서 복사. 이미 활성 구독이 있으면 거부.
- 레슨: `/admin/subscriptions/new` — 이름·전화·이메일·billingDay 입력. 금액은 `LESSON_MONTHLY_PRICE` 고정.
- 생성 즉시 고객에게 **카드 등록 안내 메일**(setupToken 링크 `/ko/subscribe/{id}?token=`). 관리자 화면에도 링크 표시(복사해 카톡으로 보내는 용도 — 카톡이 주 채널).

**고객 → 카드 등록 페이지** `/ko/subscribe/[id]`
- 토큰 검증(timing-safe, 기존 `isTokenMatch`). 상품·월 금액(VAT 포함 표기)·결제일·해지 규정 표시 → 동의 체크 → `requestBillingAuth`.
- success `/ko/subscribe/[id]/success?authKey&customerKey` → 서버: authKey로 빌링키 발급 → `billing_keys` 저장 → **첫 결제 즉시**(orders+payments+subscription_payments) → `active` → 확정 메일(관리 링크 포함). 첫 결제 실패 시 빌링키는 저장하되 `pending_card` 유지 + 실패 안내(다른 카드로 다시).
- fail → 안내 + 다시 시도 링크.

**정기결제** `pages/api/cron/billing-charge.ts` (매일 KST 09:00 = UTC 00:00)
- `nextBillingAt <= now`인 `active`·`past_due` 구독을 순회. 각 건: orders 생성 → 토스 빌링 결제(멱등키) → 성공: payments·subscription_payments paid, 기간 전진, 결제 완료 메일 / 실패: subscription_payments failed, past_due, 다음 재시도 시각 설정(`nextBillingAt`을 +1일/+3일로), 실패 메일. 3회째 실패면 paused + 운영자 메일.
- Cron 인증: 기존 cron 라우트의 `CRON_SECRET` 패턴 그대로.
- 한 건 실패가 다음 건을 막지 않게 per-건 try/catch, 결과 요약 로그.

**고객 → 해지** `/ko/subscribe/manage/[id]?token=`(manageToken)
- 현재 상태·다음 결제일·카드 끝자리·결제 이력. "해지" → `cancelled`, `endsAt = currentPeriodEnd`, 해지 확인 메일. 즉시 환불 없음(선불 월 이용은 기간 끝까지). 연습실은 계약 제3조 자동갱신 이후의 해지와 동형이며, 약정 기간 내 중도 해지의 위약금·일할 반환은 관리자가 계약 절차로 처리한다는 안내.
- "카드 변경" → 새 setupToken 발급 → 등록 페이지(결제 없이 키만 교체, 기존 키 revoke).

**관리자** `/admin/subscriptions`
- 목록(상태·다음 결제일·미납 회차), 상세(회차 이력, 카드, 링크 재발송, 수동 결제 시도, 일시정지/재개, 해지, 회차 환불은 기존 주문 환불 도구로).

## 7. 금액·표기

- `data/pricing.ts` 상수 그대로: `PRACTICE_ROOM_MONTHLY_PRICE`, `LESSON_MONTHLY_PRICE`. 청구 = 상품가 + VAT 10%(`computeAmounts`의 VAT 규칙 재사용).
- 계약서 템플릿(`lib/contracts/contract-template.md`) 월 이용료 표기에 "(부가세 별도)" 추가 — **이미 서명된 계약은 그대로**(content 스냅샷이라 자동 변경되지 않는다). 기존 계약자에게 VAT를 새로 청구할지는 사업 판단이며 코드는 관여하지 않는다.
- 연습실·레슨 페이지·pricing 카드의 표기는 현행 "VAT 별도" 안내를 유지.

## 8. 환불 규정 (약관 소절)

- 정기결제는 매월 결제일에 한 달치 선불. 해지는 언제든 가능하며 **다음 결제일부터 청구가 멈춘다**(이미 결제된 달은 기간 끝까지 이용).
- 연습실은 임대차 계약 제2조·제4조·제9조가 우선한다(일할 반환·위약금은 계약 절차).
- 레슨: 결제 후 첫 수업 전 취소 시 전액, 수업 시작 후 잔여 회차 환불은 상담.

## 9. 보안·운영

- 빌링키·authKey는 서버에서만 다루고 클라이언트·로그·메일에 싣지 않는다. `rawResponse`는 DB에만.
- setupToken은 1회성(빌링키 발급 성공 시 무효화), 7일 만료. manageToken은 기존 예약과 같은 상시 토큰.
- 키 분리: `NEXT_PUBLIC_TOSS_BILLING_CLIENT_KEY` / `TOSS_BILLING_SECRET_KEY` — 위젯 키와 별개 env. 테스트 키로 배포해 심사 제출, 통과 후 라이브 키로 교체 + `vercel redeploy`.
- Cron이 KST 09:00 한 번이라 당일 재시도는 다음날 09:00 — 스펙의 D+0 재시도는 "cron 당일 두 번째 실행" 대신 관리자 수동 결제로 대체 가능. **재시도 일정은 D+1, D+3 두 번 + 관리자 수동**으로 확정(단순화).

## 10. 테스트·검증

- 단위: 상태 전이, nextBillingAt(말일 규칙·윤년), 금액, 토큰 만료, 멱등키.
- 통합(libsql 인메모리): 생성 → 발급 → 첫 결제 → cron 결제 → 실패 → 재시도 → 해지 → ended.
- 실검증: 테스트 키로 프로덕션에서 카드 등록·첫 결제(테스트 카드) → cron 수동 호출 → 해지. 심사 제출 캡처.

## 11. 단계

1. 데이터·토스 빌링 클라이언트·금액·토큰 (서버 기반)
2. 관리자 생성·목록·상세 + 메일
3. 고객 등록·성공·실패·관리 페이지 + 약관 소절
4. Cron 결제·재시도·정지
5. 계약서 템플릿 VAT 문구, 연습실·레슨 페이지 안내 한 줄("정기결제는 상담 후 링크로 안내")
