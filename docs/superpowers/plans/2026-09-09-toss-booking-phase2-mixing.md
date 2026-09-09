# Phase 2 — 믹싱·마스터링 주문형 결제 + pricing 예약 진입점

- 작성일: 2026-09-09
- 상위 설계: `docs/superpowers/specs/2026-08-25-toss-payments-booking-design.md` §2 Phase 2
- 확정된 사업 판단(2026-09-09, 황경하):
  - 환불: **작업 착수 전 전액, 착수 후 온라인 취소 불가**(관리자 임의 환불은 가능)
  - 주문 옵션: **곡 수 + 보컬 튜닝 옵션**(정교한 보컬 튜닝·박자 보정 +150,000원/곡, FAQ 정본)
  - 파일 수령: **확인 메일 회신 + 카톡 병행** 안내

## 0. 범위

1. pricing 페이지·mixing-mastering 페이지에 온라인 예약/주문 진입점
2. 믹싱·마스터링 주문형 결제 — 슬롯 없음, Phase 1 결제 코어(orders/payments/refunds, confirm, cancel, webhook, 관리자) 재사용

하지 않는 것: 연습실·레슨 자동결제(Phase 3), 파일 업로드 저장소(링크·메일로 받는다), 비-ko.

## 1. 데이터

`db/schema.ts`에 `work_orders` 추가(마이그레이션 `npm run db:generate`, 적용은 메인 세션이 수동).

```ts
export const workOrderStatusEnum = ['pending', 'received', 'in_progress', 'delivered', 'cancelled'] as const;
export const workOrders = sqliteTable('work_orders', {
  id, orderId FK orders.id,
  productId: text notNull,            // MIXING_PRODUCTS id
  serviceType: text notNull,          // 'mixing' | 'mastering'
  songCount: integer notNull,
  vocalTuning: integer({mode:'boolean'}) notNull default false,
  status: enum default 'pending',     // pending(결제 전) → received(결제 완료) → in_progress(착수) → delivered / cancelled
  customerNote: text,
  startedAt, deliveredAt, cancelledAt: timestamp nullable,
  createdAt, updatedAt
});
ordersRelations += workOrders: many(workOrders)
```

`orders.type = 'mixing'`(enum에 이미 있음). 세션 주문은 `bookings` 1건, 믹싱 주문은 `work_orders` 1건 — 한 주문에 둘 다 있지 않다.

## 2. 상품 SSOT — `lib/booking/mixing-products.ts`

```ts
export type MixingServiceType = 'mixing' | 'mastering';
export interface MixingProduct { id; serviceType; nameKo; unitAmount /*곡당, VAT 별도*/; minSongs; maxSongs; tuningEligible: boolean }
MIXING_PRODUCTS:
  mixing-level1  '믹싱 · 10트랙 이하'   MIXING_LEVEL1_PRICE  1..10 tuningEligible
  mixing-level2  '믹싱 · 11~30트랙'     MIXING_LEVEL2_PRICE  1..10 tuningEligible
  mixing-level3  '믹싱 · 31트랙 이상'   MIXING_LEVEL3_PRICE  1..10 tuningEligible
  mastering-single  '싱글 마스터링'       MASTERING_SINGLE_PRICE 1..3  (튜닝 불가)
  mastering-package 'EP·정규 마스터링'   MASTERING_PACKAGE_PRICE 4..20 (튜닝 불가)
VOCAL_TUNING_ADDON_PRICE = 150000 → data/pricing.ts에 상수로 추가(리터럴 금지)
computeMixingAmounts(product, songCount, vocalTuning): OrderAmounts
  itemAmount = unitAmount*songCount + (vocalTuning ? VOCAL_TUNING_ADDON_PRICE*songCount : 0); vat = 10%; total
```

오퍼 id는 `data/pricing.ts` mixingOffers/masteringOffers와 같은 문자열을 쓴다(허브·가이드가 이 id로 링크). 라우트: `/ko/booking/mixing-mastering?product=<id>`.

## 3. 환불 정책 — `lib/booking/refund-policy.ts`에 추가

```ts
export const MIXING_REFUND_POLICY_LINES = [
  '작업 착수 전 취소: 전액 환불',
  '작업 착수 후: 온라인 취소 불가 (환불 문의는 010-4255-7893)',
] as const;
```
고객 셀프 취소 가능 조건: `order.status in (paid)` && `work_order.status === 'received'` → 환불 100%. 관리자 임의 환불은 received/in_progress/delivered 어디서든 가능(선점: 해당 status에서 cancelled로 UPDATE, rowsAffected 1).

## 4. 서버

- `lib/booking/validation.ts`: `validateCreateMixingOrderPayload` — productId(MIXING_PRODUCTS), songCount 정수·범위, vocalTuning boolean(비대상 상품이면 false 강제 아님 → 400), 고객 정보 검증은 기존 함수 재사용(이름·전화 normalize·이메일·note 500자·refundPolicyAgreed).
- `lib/booking/service.ts`: `createMixingOrder(payload, now)` — 같은 고객(email+phone) pending 자가 해제(세션과 동일, work_orders도 cancelled), orders INSERT(type 'mixing') + work_orders INSERT(pending). 겹침 검사 없음. `findOrderByOrderNo`에 `with: { workOrders: true }` 추가. `expireStaleOrders`: work_orders pending도 900초 지나면 cancelled.
- `pages/api/orders/mixing.ts`: POST, rate limit `booking_create:ip:` 동일 키 공유, 201 `{orderNo, itemAmount, vatAmount, totalAmount}`.
- `lib/booking/confirm.ts`: 승인 후 batch — `order.type === 'mixing'`이면 bookings 대신 `work_orders pending→received`. 후처리: 캘린더 없음, `sendMixingOrderConfirmedEmails(order, workOrder)`. 반환에 `orderType` 추가(success 화면 분기용).
- `lib/booking/cancel.ts`: 믹싱 분기 — cancellable 조건·선점 UPDATE 대상이 work_orders, refundAmount = 고객이면 totalAmount(전액), 관리자면 overrideAmount ?? totalAmount. 캘린더 삭제 없음. `sendMixingOrderCancelledEmails`.
- `lib/booking/webhook.ts`: CANCELED 동기화에서 `order.bookings[0]`이 없으면 `order.workOrders[0]`로 같은 처리(received/in_progress → cancelled). DONE 복구 경로는 confirm 재사용이라 변경 없음.
- `lib/booking/email.ts`: 믹싱 확정 메일 본문 —
  - 고객: 주문 내용(상품·곡 수·튜닝 여부·금액), **파일 보내는 법**: "이 메일에 회신으로 구글 드라이브·WeTransfer 링크를 보내주세요. 카카오톡(오픈채팅 링크)으로 보내셔도 됩니다." + 보낼 파일 요약(드라이 보컬 WAV, MR 또는 스템 WAV, 레퍼런스 1~2곡, 24bit/44.1·48kHz 권장) + 납기 "파일 확인 후 3~7영업일" + 관리 링크 + 환불 규정 2줄
  - 운영자: 새 믹싱 주문, 고객 정보, 상품·곡 수·튜닝, 요청사항, 관리자 링크
- 관리자: `lib/booking/admin-serialize.ts` 목록·상세에 `orderType`, `workOrder {id,status,songCount,vocalTuning,startedAt,deliveredAt}`; `pages/api/admin/bookings/[id].ts`에 액션 `start_work`(received→in_progress, startedAt), `deliver`(in_progress→delivered, deliveredAt); 기존 refund 액션은 믹싱에도 동작. `pages/admin/bookings/*`에 유형 배지·믹싱 상태·두 버튼.

## 5. 화면

- `pages/[locale]/booking/[service].tsx`: `service === 'mixing-mastering'`이면 `MixingOrderWizard` 렌더(products = MIXING_PRODUCTS, `?product=` 쿼리로 초기 선택). 그 외는 기존 세션 위저드. title '온라인 주문 — 믹싱·마스터링'.
- `components/booking/MixingOrderWizard.tsx`: 3단계 — (1) 상품·곡 수·튜닝 옵션 + PriceBreakdown, (2) 주문자 정보 + 요청사항(placeholder: "파일 링크가 이미 있으면 여기 적어주셔도 됩니다") + MIXING_REFUND_POLICY_LINES 동의, (3) 결제(TossPaymentWidget, orderName `믹싱 · 10트랙 이하 × 3곡`). 결제 대기 900초 카운트다운은 세션과 같은 컴포넌트 패턴 재사용. 상단 링크 '← 서비스 소개로 돌아가기' → `/ko/mixing-mastering`.
- `pages/[locale]/booking/success.tsx`: `orderType === 'mixing'`이면 제목 '주문이 접수되었습니다', 본문에 파일 보내는 법(메일 회신 + 카톡 버튼, 카카오 배색 규칙: 카톡 링크는 옐로 `bg-kakao text-kakao-ink`) 과 납기.
- `pages/[locale]/booking/manage/[orderNo].tsx`: 믹싱 주문이면 이용 일시 대신 상품·곡 수·튜닝·상태(접수됨/작업 중/납품 완료/취소됨), 취소 섹션은 status received일 때만, 환불 예정액 전액.
- `pages/[locale]/terms.tsx`: 환불 조항에 "믹싱·마스터링 주문" 소절로 MIXING_REFUND_POLICY_LINES.
- pricing 페이지(`pages/[locale]/pricing.tsx`) + `components/ui/PricingCard.tsx`: ko에서 온라인 결제 가능한 오퍼 카드에 **보조 CTA** `secondaryCtaLabel/secondaryCtaHref`("온라인 예약" / "온라인 주문", outline 스타일, 옐로 금지) 추가. 매핑: recordingOffers → `/ko/booking/recording`, 축가 → `/ko/booking/wedding-song`, 커버 영상 → `/ko/booking/cover-video`, 성우 → `/ko/booking/voice-acting`, mixingOffers·masteringOffers → `/ko/booking/mixing-mastering?product=<id>`. 발매 패키지·연습실·레슨은 없음. 카카오 1차 CTA는 그대로.
- `pages/[locale]/mixing-mastering.tsx` 카드 5장: 같은 보조 CTA. 계측 `lead_click_booking_entry`(기존 BookingEntryButton이 쓰는 이벤트명을 확인해 통일).

## 6. 테스트·게이트

- `lib/booking/mixing-products.test.ts`: 금액 계산(튜닝 포함/비포함, 범위 밖 null), 오퍼 id가 `data/pricing.ts` mixingOffers/masteringOffers id와 1:1.
- `lib/booking/validation.test.ts` 확장: 믹싱 페이로드.
- 기존 `amounts.test.ts`(smoke-test 격리)·`ctaRouting`·`check:facts`·`pricing.test.ts` 통과.
- `npm run type-check && npm run lint && npm test && npm run build`.

## 7. 배포 순서

1. 코드 머지 전 마이그레이션 SQL 검토 → 프로덕션 Turso 적용(메인 세션이 직접, 거부되면 중단)
2. PR 자동머지 → 배포
3. 라이브 검증: 220원 smoke-test와 별개로 믹싱은 실상품이라 **테스트 결제 없음** — 관리자 화면에서 주문 없는 상태 확인, 위저드 결제 직전 단계까지 브라우저 확인
