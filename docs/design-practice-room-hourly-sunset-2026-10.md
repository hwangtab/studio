# 연습실 시간제 판매 중지 설계 (2026-10-24)

> **결정 배경(운영자, 2026-10-24)**: 연습실 문의는 전부 월세를 보고 온다. 시간제를 보고 온 적은 없다. 시간제는 수익이 거의 없고,
> GEO·SEO에서 "연습실 = 시간당 6,600원"으로 읽히게 해 월세 36만원의 가치를 낮춰 보이게 한다. 판매를 닫는다.
> **근거(2026-10-24 Turso)**: 9/27 판매 시작 이후 시간제 연습실 주문이 결제·만료·실패 전부 **0건**이다(`bookings.service_type = 'practice-room'` 행 없음).
> 매출 0원. R02는 녹음실(레코딩룸)과 같은 방이라 시간제는 녹음 슬롯과 서로 막는 구조적 비용만 있었다.
> **상위 문서**: `docs/proposals/geo-ai-mention-revenue-strategy-2026-10-24.md` §1-2·P0-4.

---

## 0. 원칙

1. **끄고 지우지 않는다.** 1단계는 스위치 하나로 판매와 모든 공개 노출을 닫는다. 되돌릴 때는 스위치만 켠다. 코드 삭제는 2단계.
2. **공개 면은 한 번에 닫는다.** 예약만 닫고 카피·스키마·llms.txt·네이버에 가격이 남으면 죽은 링크가 되고 AI가 계속 "시간당 6,600원"을 말한다.
3. **월세 36만원이 연습실의 유일한 가격으로 보이게 한다.** 이것이 GEO 목적이다.
4. 월 입주(구독·입주 기록·월세 계약)는 건드리지 않는다. 이름이 같은 `practice-room`이 둘이다 — 예약 서비스 `practice-room`(시간제)과 구독 종류 `practice-room`(월세, `lib/billing`·`lib/tenancy`). **예약 쪽만** 닫는다.

## 1. 스위치

`data/practiceRoomAvailability.ts`에 상수 하나를 둔다(기존 `PRACTICE_ROOM_HAS_VACANCY`와 같은 파일, 같은 운영 방식).

```ts
/** 연습실 시간제(R02, 시간당 6,600원) 판매 여부. false면 예약·안내·스키마·llms 전부 닫는다. 2026-10-24 닫음 — 수요 0건. */
export const PRACTICE_ROOM_HOURLY_OPEN = false;
```

가격 상수 `PRACTICE_ROOM_HOURLY_PRICE_INCL`은 **남긴다**(되돌릴 때·관리자 수기 예약·과거 기록 계산용). 공개 면이 이 상수를 직접 쓰지 않고
스위치를 먼저 보게 한다.

## 2. 1단계 — 판매 중지 (한 PR, 되돌릴 수 있음)

### 2-1. 예약·결제

| 곳 | 변경 |
|---|---|
| `lib/booking/service.ts` 예약 생성 | 상품 `practice-room-hourly`이고 스위치가 꺼져 있으면 `sales_closed`로 거절. 이미 만든 주문의 결제 확정·환불 경로는 그대로(진행 중 예약이 있으면 끝까지 돌아야 한다) |
| `pages/api/bookings/slots.ts` | 시간제 슬롯 요청에 닫힘 응답 |
| `pages/[locale]/booking/[service].tsx` | `practice-room` 서비스 주소는 `/ko/practice-room`으로 307. 이미 `Disallow: /ko/booking/`이라 색인 영향 없음 |
| `lib/booking/hub.ts` | 예약 허브의 연습실 카드를 뺀다 |
| 관리자 수기 예약(`ManualBookingPanel`, `manualEntry.ts`) | **남긴다.** 운영자가 예외로 받는 경우를 막지 않는다 |
| `lib/ops/healthCheck.ts` R02 캘린더 점검 | 그대로(녹음이 같은 캘린더를 쓴다) |

`STUDIO_SHARED_ROOMS`·`calendarGuard`는 건드리지 않는다 — 시간제 예약이 0건이면 막을 게 없을 뿐 해가 없고, 되돌릴 때 필요하다.

### 2-2. 공개 카피·기계층 (같은 PR에서 스위치를 보게 한다)

| 면 | 파일 | 닫힌 모습 |
|---|---|---|
| 연습실 LP 시간제 절 | `pages/[locale]/practice-room.tsx`(248·269행 부근)와 `practiceRoom.hourly.*` 번역 키 | 절 전체를 렌더하지 않는다. 월세·입주 절이 첫 가격 |
| 가격 페이지 | `pages/[locale]/pricing.tsx`, `data/pricing.ts`(offer `practice-room-hourly`, 1069행) | 오퍼를 목록에서 뺀다 |
| FAQ | `data/faq.ts` 연습실 답변(7개 로케일) | "한두 시간만 필요하면 시간제…" 문장을 걷어내고 월세 중심으로 |
| 인라인 안내 | `components/inline/InlineServiceCallout.tsx` 170행 | 시간제 줄 제거 |
| 견적 | `lib/quote/estimate.ts` 301행 | 시간제 옵션 제거 |
| llms.txt | `pages/api/llms.ts`(113·209·424·442·455행), `lib/llms/priceFacts.ts` 71행 | 시간제 줄과 "시간제도 있습니다" 문장 제거. "이 사이트의 유일한 무인 셀프 대여" 문구(Practice Room Hourly 줄)도 함께 사라진다 |
| JSON-LD | `utils/schema/business.ts` 99행, `utils/schema/commerce.ts` 157~167행 | HUR 단위 오퍼 제거 |
| 네이버 가격표 생성 | `scripts/naver-price-card.ts` 63행 | 시간제 행 제거 |

번역 JSON 키(`practiceRoom.hourly.*`)는 1단계에서 **지우지 않는다**(렌더만 안 함). 키를 지우면 7개 로케일을 같이 건드려야 하고 되돌리기가 어렵다. 미사용 키 검사(`content/i18nKeys.test.ts`)가 걸리면 2단계로 미룬다.

### 2-3. 테스트

- 신규 `content/practiceRoomHourlyGate.test.ts`: 스위치를 `false`로 두고 **공개 면에 `6,600`·`6600`·`시간제`·`HUR`가 나오지 않음**을 확인(연습실·가격 페이지 렌더, `buildLlmsText`, JSON-LD 빌더, `getPricingData`). `true`일 때는 지금처럼 나옴.
- `content/practiceRoomHourly.test.ts`(스토리가 "시간 대여를 안 한다"고 말하면 실패하는 가드)는 **1단계에서는 그대로**다. 2단계에서 반대로 뒤집는다(스토리가 "시간제 6,600원 운영"을 말하면 실패).
- `lib/booking/products.test.ts`·`calendarGuard.test.ts` 등 상품을 쓰는 테스트는 상품 정의를 지우지 않으므로 그대로 통과해야 한다.
- 가격 SSOT 가드(`data/pricing.test.ts`)의 오퍼 id↔상수 매핑이 오퍼를 뺀 것과 충돌하면 가드를 스위치 조건으로 고친다(오퍼 목록이 아니라 상수 매핑을 확인).

### 2-4. 사이트 밖 (운영자 승인 후 Sonnet·aside, 배포 확인 뒤)

배포가 끝나 시간제가 사이트에서 사라진 것을 확인한 **다음에** 한다(순서를 뒤집으면 네이버에서 닫힌 상품으로 가는 링크가 생긴다).

| 곳 | 작업 |
|---|---|
| 네이버 스마트플레이스 가격 탭 | "음악연습실 시간제 (1시간) 6,600원" 항목 삭제. 월세 항목이 1위(이번 세션에서 순서 변경 진행 중) |
| 네이버 상세설명 | "시간제 1시간 6,600원(부가세 포함), studionol.co.kr에서 바로 예약" 줄 삭제. 월 36만원·보증금 0원 줄은 그대로 |
| 네이버 예약 상품 "음악연습실 대여 (1~5시간)" | 이미 예약받기 미노출 — 상품 삭제 |
| 구글 비즈니스 프로필 | 서비스 목록에 시간제가 있는지 확인(읽기), 있으면 삭제 |
| `docs/console-checklist-2026-09.md`, `docs/p3-external-channels-runbook.md` | 시간제 줄에 "2026-10-24 판매 중지" 표기 |

### 2-5. 배포 직후 점검 (코드 수정 없는 확인)

- `curl`로 `/ko/practice-room`, `/ko/pricing`, `/llms.txt`, 연습실 JSON-LD에 `6,600`·`시간제`가 없는지.
- `/ko/booking/practice-room`이 `/ko/practice-room`으로 넘어가는지.
- 월 입주 문의 경로(카톡 CTA·입주 안내)가 그대로인지.
- IndexNow: **`[skip-indexnow]`를 붙이지 않는다** — 본문·가격이 바뀐 변경이다. 영향 URL: practice-room, pricing, faq 계열, llms.
- GSC 색인 요청 `/ko/practice-room`·`/ko/pricing`(Sonnet이 aside로, 한 URL씩, "실제 URL 테스트" 금지).

## 3. 2단계 — 정리 (1단계 배포 후 약 1주, 되돌릴 일이 없다고 확인되면)

| 작업 | 이유 |
|---|---|
| **스토리 96편의 시간제 언급** 정리 | 스토리는 AI가 가장 자주 읽는 면이다. 사이트는 시간제를 닫았는데 스토리가 6,600원을 말하면 AI가 계속 말한다. 가격·시간제 문장을 월세 중심으로 고친다. `check:claims`·`check:facts`·`check:dup-sections`·CTA 라우팅 기준선을 통과시킨다. **잠긴 페이지 3편(loudness1·falsetto1·vocal-range-extension1)은 10/26 이후** |
| `content/practiceRoomHourly.test.ts` 뒤집기 | 스토리가 시간제 운영을 말하면 실패하게 |
| `practiceRoom.hourly.*` 번역 키 삭제 | 7개 로케일, 미사용 키 검사 통과 |
| 상품 정의·`PRACTICE_ROOM_HOURLY_ROOMS`·관련 테스트 삭제 여부 | 되돌릴 가능성이 없을 때만. 기본은 **남긴다**(관리자 수기 예약이 쓴다) |
| `docs/` 의 시간제 서술 | `CLAUDE.md`의 "연습실 공실 상태"·환불 절, 메모리 `practice-room-inventory` |

## 4. GEO 측정에 미치는 영향

- 쿼리 H01("연신내 근처 한두 시간 빌려 쓸 수 있는 개인 연습실")은 지금까지 **인용 목표**였다(ChatGPT가 "시간제 운영 안 한다"고 틀려 `facts_wrong`로 센 건이 있었다). 중지 후에는 **오추천 감시(L04 방식)**로 바꾼다 — 우리를 시간제 제공처로 추천하면 `facts_wrong`.
  `queries.md`에 바꾼 이유(2026-10-24 판매 중지)를 적고, 11월 회차 전에 한 번만 바꾼다.
- 기대: 네이버 AI탭 Q16("월세는요")이 월세 36만원을 말하는지, ChatGPT·Gemini가 "시간제 6,600원"을 더는 말하지 않는지. 둘을 11월 회차(11/2~11/6)에서 본다. 반영에는 크롤 시간이 걸리므로 12월 회차까지 두 번 본다.
- 연습실 LP는 AI 리드 1위(90일 9건)이자 GSC 생성형 AI 노출 1위 LP(973)다 — 이 페이지를 닫지 않고 **월세만 남기는** 설계다. 리드 감소는 없어야 한다. 배포 후 2주간 `/ko/practice-room` 리드(카톡·전화·지도 클릭)를 GA4로 이전 2주와 비교한다.

## 5. 위험과 확인할 것

| 위험 | 대응 |
|---|---|
| 시간제 결제 진행 중인 주문이 닫힘으로 깨진다 | 생성만 거절하고 확정·환불은 그대로. 배포 직전 `bookings`에 `practice-room` 행이 0인지 다시 확인(오늘 0건) |
| 시간제 문의를 하던 고객 | 월세 안내로 보낸다. 닫힌 이유를 고객 카피에 적지 않는다("일부러 닫았다"류 설명 금지 — CLAUDE.md 카피 규칙). 그냥 월 입주를 안내 |
| 월세 빈방이 1실뿐이라 연습실 문의가 만실 안내로 끝난다 | 그 경우 `PRACTICE_ROOM_HAS_VACANCY` 카피가 이미 대기·교차 오퍼(녹음·믹싱)를 한다. 시간제를 닫으면 "대안 상품"이 사라지는 점을 운영자가 인지할 것 |
| 번역 7개 로케일 누락 | 게이트 테스트가 `en/zh/es/vi/th/uz` 렌더까지 본다 |
| 구글·네이버가 옛 가격을 한동안 보여줌 | 정상. GSC 색인 요청, 네이버는 §2-4 즉시 수정 |

## 6. 운영자 결정이 필요한 것

1. 관리자 수기 예약에서 시간제를 **남길지**(권장: 남김).
2. 스토리 96편 정리를 1단계 직후 바로 할지, 1주 뒤 할지(권장: 1주 뒤. 단 GEO 효과는 스토리가 끝나야 완성).
3. 시간제 문의가 오면 안내할 대체 상품이 있는지(월 입주 외에 녹음 3시간 25만원이 있다).

## 7. 순서

```
(오늘)   이 설계 승인
1단계   스위치 + 공개 면 + 게이트 테스트 → PR → CI → 머지 → 배포 확인(§2-5)
         → 네이버·구글 수정(§2-4) → GSC 색인 요청
(+1주)  2단계: 스토리 → 테스트 뒤집기 → 번역 키
(11/2~6) GEO 11월 회차에서 Q16·H01 확인
```
