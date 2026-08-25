# 토스페이먼츠 예약·결제 Phase 1 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 세션 4종(녹음·성우·축가·커버영상)의 실시간 슬롯 예약 + 토스페이먼츠 전액 선결제 + 구글 캘린더 연동 + 셀프 취소·환불 + 관리자 화면을 구축한다.

**Architecture:** 기존 Turso(libSQL)+Drizzle 스키마에 6개 테이블을 추가하고, 결제 로직은 `lib/booking/` 모듈군(전자계약 `lib/contracts/` 미러 구조)에 둔다. 결제위젯 v2로 클라이언트 결제, 승인은 success 페이지 SSR에서 서버 실행, 웹훅은 재조회 기반 백업 경로. 캘린더는 미러 동기화 없이 FreeBusy 실시간 조회(fail-closed) + 확정 시 이벤트 생성.

**Tech Stack:** Next.js 15 Pages Router, Drizzle ORM + @libsql/client(기존), `@tosspayments/tosspayments-sdk`(신규, 클라이언트 위젯), 토스/구글 REST 직접 호출(서버 SDK 미도입 — Resend와 같은 관례), jest(기존), Resend(기존), iron-session 관리자(기존).

**Spec:** `docs/superpowers/specs/2026-08-25-toss-payments-booking-design.md`

## Global Constraints

- **ko 전용**: 예약 퍼널·CTA는 `locale === 'ko'`에서만. 비-ko는 기존 /contact 유지
- **카카오 배색 규칙**: 옐로(`#FEE500`)는 카카오톡 목적지 전용. 예약 CTA는 `bg-primary` 계열, 카카오 CTA를 대체·이동·변색하지 않는다
- **가격 리터럴 금지**: 금액은 전부 `data/pricing.ts` 상수 + `formatPriceAmount`에서 파생. 클라이언트가 보낸 금액은 서버가 신뢰하지 않는다
- **noindex**: `/ko/booking/*`·`/ko/terms`는 noindex + `next-sitemap.config.js` exclude + robots disallow (contracts 패턴)
- **의존성 정책**: `next`·`react`·`react-dom` 버전 고정 유지. 신규 의존성은 `@tosspayments/tosspayments-sdk` 단 하나
- **DB 마이그레이션**: `npm run db:generate` → 생성 SQL 육안 검토 → `npm run db:migrate`. `.env.local`의 Turso가 운영 DB이므로 추가(additive) 변경만 허용
- **시간 저장**: DB는 UTC unix seconds(`integer mode:'timestamp'`), 업무 규칙(영업시간·환불 기산)은 KST 고정 오프셋(+9, DST 없음)
- **테스트**: jest, 로직 파일 옆 `*.test.ts` 코로케이션. 커밋 전 해당 테스트 통과
- **검증 순서**(의존성 정책 준수): `type-check` → `lint` → `test` → `build`

## 실행 전 확인 입력 (기본값으로 진행 가능, 사용자 확인 권장)

| 항목 | 코드 기본값 | 위치 |
|---|---|---|
| 세션 영업시간 | 10:00–22:00 KST | `lib/booking/slots.ts` `OPEN_HOUR`/`CLOSE_HOUR` |
| 축가/커버영상 세션 길이 | 2h / 3h | `lib/booking/products.ts` |
| 시간제 최소·최대 | 2h–8h | `lib/booking/products.ts` |
| 예약 리드타임·창 | 24시간 후~60일 | `lib/booking/slots.ts` |
| 환불 규정 | 3일 전 100% / 1–2일 전 50% / 당일 0% | `lib/booking/refund-policy.ts` |
| 통신판매업 신고번호 | 값 필요 — 신고 전이면 Task 15의 푸터 표기만 보류 | `data/siteConfig.ts` |
| 환경변수 | `TOSS_SECRET_KEY`, `NEXT_PUBLIC_TOSS_CLIENT_KEY`(테스트 키로 시작), `GOOGLE_SA_EMAIL`, `GOOGLE_SA_PRIVATE_KEY`, `BOOKING_GCAL_ID` | `.env.local` + Vercel |

---

### Task 1: DB 스키마 확장 + 마이그레이션

**Files:**
- Modify: `db/schema.ts` (파일 끝에 추가)
- Create: `drizzle/migrations/` (생성기 산출물)

**Interfaces:**
- Produces: 테이블 `orders`·`payments`·`refunds`·`bookings`·`availabilityBlocks`·`webhookEvents`, enum 상수 `orderStatusEnum`·`bookingStatusEnum` 등, 타입 `Order`·`NewOrder`·`Booking`·`NewBooking`·`Payment`·`Refund`·`AvailabilityBlock` (전부 `$inferSelect`/`$inferInsert`)

- [ ] **Step 1: 스키마 추가**

`db/schema.ts` 끝(기존 `rateLimits` 위)에 추가:

```ts
// ─── 예약·결제 (Phase 1: 세션 예약) ───────────────────────────────────────────

export const orderStatusEnum = [
  'pending', // 주문 생성, 결제 대기 (15분 슬롯 선점)
  'paid',
  'partially_refunded',
  'refunded',
  'failed', // 승인 실패
  'expired', // 15분 내 미결제
] as const;
export const orderTypeEnum = ['session', 'mixing', 'subscription'] as const;
export const bookingStatusEnum = ['pending', 'confirmed', 'completed', 'no_show', 'cancelled'] as const;
export const refundStatusEnum = ['done', 'failed'] as const;
export const refundRequesterEnum = ['customer', 'admin', 'webhook'] as const;

export const orders = sqliteTable('orders', {
  id: text('id').primaryKey().$defaultFn(() => sql`lower(hex(randomblob(16)))`),
  /** 토스 orderId로 그대로 쓰는 외부 노출 주문번호 (SNB-YYYYMMDD-XXXXXX). */
  orderNo: text('order_no').notNull().unique(),
  type: text('type', { enum: orderTypeEnum }).notNull().default('session'),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone').notNull(),
  customerEmail: text('customer_email').notNull(),
  /** 상품가(VAT 별도) + VAT = 합계. 서버가 pricing SSOT에서 계산해 저장한다. */
  itemAmount: integer('item_amount').notNull(),
  vatAmount: integer('vat_amount').notNull(),
  totalAmount: integer('total_amount').notNull(),
  status: text('status', { enum: orderStatusEnum }).notNull().default('pending'),
  /** 예약 확인·셀프 취소 링크 토큰 (계정 없는 게스트의 인증 수단 — contracts signToken 패턴). */
  manageToken: text('manage_token').notNull().unique(),
  /** 마지막 알림 발송 실패 사유. 성공 시 비움 (contracts notificationError 패턴). */
  notificationError: text('notification_error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const payments = sqliteTable('payments', {
  id: text('id').primaryKey().$defaultFn(() => sql`lower(hex(randomblob(16)))`),
  orderId: text('order_id').notNull().references(() => orders.id),
  /** 토스 paymentKey. unique가 이중 승인 기록을 DB 층에서 차단한다. */
  paymentKey: text('payment_key').notNull().unique(),
  method: text('method'),
  approvedAt: integer('approved_at', { mode: 'timestamp' }),
  receiptUrl: text('receipt_url'),
  /** 토스 응답 원본 JSON — 분쟁·대사(reconciliation) 근거. */
  rawResponse: text('raw_response'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const refunds = sqliteTable('refunds', {
  id: text('id').primaryKey().$defaultFn(() => sql`lower(hex(randomblob(16)))`),
  paymentId: text('payment_id').notNull().references(() => payments.id),
  amount: integer('amount').notNull(),
  reason: text('reason').notNull(),
  requestedBy: text('requested_by', { enum: refundRequesterEnum }).notNull(),
  tossTransactionKey: text('toss_transaction_key'),
  status: text('status', { enum: refundStatusEnum }).notNull().default('done'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const bookings = sqliteTable('bookings', {
  id: text('id').primaryKey().$defaultFn(() => sql`lower(hex(randomblob(16)))`),
  orderId: text('order_id').notNull().references(() => orders.id),
  /** lib/booking/products.ts SESSION_PRODUCTS의 id. */
  productId: text('product_id').notNull(),
  /** 서비스 그룹 (recording | voice-acting | wedding-song | cover-video). */
  serviceType: text('service_type').notNull(),
  startAt: integer('start_at', { mode: 'timestamp' }).notNull(),
  endAt: integer('end_at', { mode: 'timestamp' }).notNull(),
  durationHours: integer('duration_hours').notNull(),
  status: text('status', { enum: bookingStatusEnum }).notNull().default('pending'),
  /** 확정 시 생성한 구글 캘린더 이벤트 id. 취소 시 삭제에 쓴다. */
  gcalEventId: text('gcal_event_id'),
  /** 캘린더 이벤트 생성/삭제 실패 사유 — 결제는 성공했으므로 실패를 삼키되 기록한다. */
  gcalError: text('gcal_error'),
  customerNote: text('customer_note'),
  cancelledAt: integer('cancelled_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const availabilityBlocks = sqliteTable('availability_blocks', {
  id: text('id').primaryKey().$defaultFn(() => sql`lower(hex(randomblob(16)))`),
  startAt: integer('start_at', { mode: 'timestamp' }).notNull(),
  endAt: integer('end_at', { mode: 'timestamp' }).notNull(),
  memo: text('memo'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

/**
 * 토스 웹훅 멱등 기록. eventKey가 PK라 같은 이벤트의 두 번째 INSERT는 실패하고,
 * 그 실패가 "이미 처리했다"는 신호다 (처리보다 기록을 먼저 한다).
 */
export const webhookEvents = sqliteTable('webhook_events', {
  eventKey: text('event_key').primaryKey(),
  payload: text('payload').notNull(),
  processedAt: integer('processed_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const ordersRelations = relations(orders, ({ many }) => ({
  payments: many(payments),
  bookings: many(bookings),
}));
export const paymentsRelations = relations(payments, ({ one, many }) => ({
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
  refunds: many(refunds),
}));
export const refundsRelations = relations(refunds, ({ one }) => ({
  payment: one(payments, { fields: [refunds.paymentId], references: [payments.id] }),
}));
export const bookingsRelations = relations(bookings, ({ one }) => ({
  order: one(orders, { fields: [bookings.orderId], references: [orders.id] }),
}));

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type Refund = typeof refunds.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
export type AvailabilityBlock = typeof availabilityBlocks.$inferSelect;
```

- [ ] **Step 2: 마이그레이션 생성·검토·적용**

Run: `npm run db:generate`
생성된 `drizzle/migrations/0007_*.sql`을 열어 **CREATE TABLE 6개 외의 문장(ALTER/DROP)이 없는지 확인**한 뒤:
Run: `npm run db:migrate`
Expected: 에러 없이 종료. `npm run db:studio`로 테이블 6개 생성 확인(선택).

- [ ] **Step 3: 타입 검증 후 커밋**

Run: `npm run type-check`
```bash
git add db/schema.ts drizzle/migrations
git commit -m "feat(booking): 예약·결제 스키마 6개 테이블 추가"
```

---

### Task 2: 상품 정의 + 금액 계산

**Files:**
- Create: `lib/booking/products.ts`, `lib/booking/amounts.ts`
- Test: `lib/booking/amounts.test.ts`

**Interfaces:**
- Consumes: `data/pricing.ts`의 `VOCAL_PACKAGE_PRICE`·`RECORDING_HOURLY_PRICE`·`VOICEOVER_HOURLY_PRICE`·`WEDDING_PACKAGE_PRICE`·`COVER_VIDEO_PACKAGE_PRICE`
- Produces:
  - `type BookingService = 'recording' | 'voice-acting' | 'wedding-song' | 'cover-video'`
  - `interface SessionProduct { id: string; service: BookingService; nameKo: string; kind: 'package' | 'hourly'; unitAmount: number; sessionHours?: number; minHours?: number; maxHours?: number }`
  - `SESSION_PRODUCTS: readonly SessionProduct[]`, `getProduct(id: string): SessionProduct | undefined`, `resolveHours(product: SessionProduct, requested?: number): number | null`
  - `interface OrderAmounts { itemAmount: number; vatAmount: number; totalAmount: number }`, `computeAmounts(product: SessionProduct, hours: number): OrderAmounts`, `VAT_RATE = 0.1`

- [ ] **Step 1: 실패하는 테스트 작성** (`lib/booking/amounts.test.ts`)

```ts
import { computeAmounts } from './amounts';
import { getProduct, resolveHours } from './products';

describe('SESSION_PRODUCTS', () => {
  it('세션 4서비스의 상품이 전부 있다', () => {
    for (const id of ['recording-pro', 'recording-hourly', 'voice-acting-hourly', 'wedding-song', 'cover-video']) {
      expect(getProduct(id)).toBeDefined();
    }
  });
});

describe('resolveHours', () => {
  it('패키지는 요청 시간과 무관하게 고정 시간', () => {
    expect(resolveHours(getProduct('recording-pro')!, undefined)).toBe(3);
  });
  it('시간제는 min~max 밖이면 null', () => {
    const hourly = getProduct('recording-hourly')!;
    expect(resolveHours(hourly, 1)).toBeNull();
    expect(resolveHours(hourly, 9)).toBeNull();
    expect(resolveHours(hourly, 4)).toBe(4);
    expect(resolveHours(hourly, undefined)).toBeNull();
  });
});

describe('computeAmounts', () => {
  it('1프로 25만원 → VAT 포함 275,000', () => {
    expect(computeAmounts(getProduct('recording-pro')!, 3)).toEqual({
      itemAmount: 250000, vatAmount: 25000, totalAmount: 275000,
    });
  });
  it('시간제 4시간 = 40만 + VAT 4만', () => {
    expect(computeAmounts(getProduct('recording-hourly')!, 4)).toEqual({
      itemAmount: 400000, vatAmount: 40000, totalAmount: 440000,
    });
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx jest lib/booking/amounts.test.ts` → FAIL (모듈 없음)

- [ ] **Step 3: 구현**

`lib/booking/products.ts`:

```ts
import {
  COVER_VIDEO_PACKAGE_PRICE,
  RECORDING_HOURLY_PRICE,
  VOCAL_PACKAGE_PRICE,
  VOICEOVER_HOURLY_PRICE,
  WEDDING_PACKAGE_PRICE,
} from '../../data/pricing';

export type BookingService = 'recording' | 'voice-acting' | 'wedding-song' | 'cover-video';

export interface SessionProduct {
  id: string;
  service: BookingService;
  nameKo: string;
  kind: 'package' | 'hourly';
  /** 패키지: 상품 전체가, 시간제: 시간당가. 전부 VAT 별도 — data/pricing.ts SSOT. */
  unitAmount: number;
  sessionHours?: number;
  minHours?: number;
  maxHours?: number;
}

export const SESSION_PRODUCTS: readonly SessionProduct[] = [
  { id: 'recording-pro', service: 'recording', nameKo: '보컬 녹음 1프로', kind: 'package', unitAmount: VOCAL_PACKAGE_PRICE, sessionHours: 3 },
  { id: 'recording-hourly', service: 'recording', nameKo: '시간당 레코딩', kind: 'hourly', unitAmount: RECORDING_HOURLY_PRICE, minHours: 2, maxHours: 8 },
  { id: 'voice-acting-hourly', service: 'voice-acting', nameKo: '성우 녹음', kind: 'hourly', unitAmount: VOICEOVER_HOURLY_PRICE, minHours: 2, maxHours: 8 },
  { id: 'wedding-song', service: 'wedding-song', nameKo: '축가 녹음 패키지', kind: 'package', unitAmount: WEDDING_PACKAGE_PRICE, sessionHours: 2 },
  { id: 'cover-video', service: 'cover-video', nameKo: '커버 영상 패키지', kind: 'package', unitAmount: COVER_VIDEO_PACKAGE_PRICE, sessionHours: 3 },
] as const;

export const getProduct = (id: string): SessionProduct | undefined =>
  SESSION_PRODUCTS.find((p) => p.id === id);

export const productsForService = (service: string): SessionProduct[] =>
  SESSION_PRODUCTS.filter((p) => p.service === service);

/** 유효하지 않은 시간 요청은 null — 호출부가 400으로 바꾼다. */
export const resolveHours = (product: SessionProduct, requested?: number): number | null => {
  if (product.kind === 'package') return product.sessionHours ?? null;
  if (typeof requested !== 'number' || !Number.isInteger(requested)) return null;
  if (requested < (product.minHours ?? 1) || requested > (product.maxHours ?? 12)) return null;
  return requested;
};
```

`lib/booking/amounts.ts`:

```ts
import type { SessionProduct } from './products';

export const VAT_RATE = 0.1;

export interface OrderAmounts {
  itemAmount: number;
  vatAmount: number;
  totalAmount: number;
}

/** 사이트 표기는 VAT 별도 — 온라인 청구는 포함액. 상품가가 만원 단위라 VAT는 항상 정수. */
export const computeAmounts = (product: SessionProduct, hours: number): OrderAmounts => {
  const itemAmount = product.kind === 'package' ? product.unitAmount : product.unitAmount * hours;
  const vatAmount = Math.round(itemAmount * VAT_RATE);
  return { itemAmount, vatAmount, totalAmount: itemAmount + vatAmount };
};
```

- [ ] **Step 4: 통과 확인** — Run: `npx jest lib/booking/amounts.test.ts` → PASS

- [ ] **Step 5: 커밋** — `git add lib/booking && git commit -m "feat(booking): 세션 상품 정의와 VAT 포함 금액 계산"`

---

### Task 3: KST 시간 헬퍼 + 환불 정책 엔진

**Files:**
- Create: `lib/booking/kst.ts`, `lib/booking/refund-policy.ts`
- Test: `lib/booking/refund-policy.test.ts`

**Interfaces:**
- Produces:
  - `kstDateString(d: Date): string` ('YYYY-MM-DD'), `kstDateTime(dateStr: string, hour: number): Date` (KST 벽시계 → UTC Date), `daysUntilKst(now: Date, target: Date): number` (KST 달력일 차)
  - `REFUND_TIERS: readonly { minDaysBefore: number; rate: number }[]`
  - `interface RefundQuote { daysBefore: number; rate: number; refundAmount: number }`
  - `computeRefund(totalAmount: number, startAt: Date, now: Date): RefundQuote`
  - `REFUND_POLICY_LINES: readonly string[]` (UI·약관 공용 문구)

- [ ] **Step 1: 실패하는 테스트** (`lib/booking/refund-policy.test.ts`)

```ts
import { computeRefund } from './refund-policy';
import { daysUntilKst, kstDateString, kstDateTime } from './kst';

describe('kst helpers', () => {
  it('KST 벽시계 14시는 UTC 05시', () => {
    expect(kstDateTime('2026-09-10', 14).toISOString()).toBe('2026-09-10T05:00:00.000Z');
  });
  it('UTC 자정 직전은 KST 다음 날', () => {
    expect(kstDateString(new Date('2026-09-10T15:30:00Z'))).toBe('2026-09-11');
  });
  it('daysUntilKst는 달력일 차이 (시각 무관)', () => {
    const now = new Date('2026-09-07T13:00:00Z'); // KST 9/7 22:00
    const start = kstDateTime('2026-09-10', 10);
    expect(daysUntilKst(now, start)).toBe(3);
  });
});

describe('computeRefund — 기산은 KST 달력일, 계약서 시간대 분쟁(258e8e41cc) 재발 방지', () => {
  const start = kstDateTime('2026-09-10', 14);
  const total = 275000;
  it('3일 전 100%', () => {
    expect(computeRefund(total, start, kstDateTime('2026-09-07', 23)).refundAmount).toBe(275000);
  });
  it('전일 50% (원 단위 내림)', () => {
    expect(computeRefund(total, start, kstDateTime('2026-09-09', 1)).refundAmount).toBe(137500);
  });
  it('당일 0%', () => {
    expect(computeRefund(total, start, kstDateTime('2026-09-10', 0)).refundAmount).toBe(0);
  });
  it('지난 예약도 0%', () => {
    expect(computeRefund(total, start, kstDateTime('2026-09-11', 10)).refundAmount).toBe(0);
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx jest lib/booking/refund-policy.test.ts` → FAIL

- [ ] **Step 3: 구현**

`lib/booking/kst.ts`:

```ts
/** 한국은 DST가 없어 고정 오프셋으로 충분하다. Intl 왕복보다 단순하고 서버·클라 동일 결과. */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export const kstDateString = (d: Date): string =>
  new Date(d.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);

/** 'YYYY-MM-DD' + KST 시(hour) → 그 벽시계 시각의 UTC Date. */
export const kstDateTime = (dateStr: string, hour: number): Date =>
  new Date(new Date(`${dateStr}T00:00:00Z`).getTime() + (hour * 60 * 60 * 1000) - KST_OFFSET_MS);

const kstEpochDay = (d: Date): number =>
  Math.floor((d.getTime() + KST_OFFSET_MS) / (24 * 60 * 60 * 1000));

/** target이 now보다 KST 달력으로 며칠 뒤인지. 같은 날 0, 지난 날 음수. */
export const daysUntilKst = (now: Date, target: Date): number =>
  kstEpochDay(target) - kstEpochDay(now);
```

`lib/booking/refund-policy.ts`:

```ts
import { daysUntilKst } from './kst';

/** 큰 것부터 검사한다. 비율 변경은 이 표만 고치면 화면·계산·약관이 함께 바뀐다. */
export const REFUND_TIERS = [
  { minDaysBefore: 3, rate: 1 },
  { minDaysBefore: 1, rate: 0.5 },
  { minDaysBefore: 0, rate: 0 },
] as const;

export const REFUND_POLICY_LINES = [
  '이용일 3일 전까지 취소: 전액 환불',
  '이용일 1~2일 전 취소: 50% 환불',
  '이용일 당일 취소: 환불 불가',
] as const;

export interface RefundQuote {
  daysBefore: number;
  rate: number;
  refundAmount: number;
}

export const computeRefund = (totalAmount: number, startAt: Date, now: Date): RefundQuote => {
  const daysBefore = daysUntilKst(now, startAt);
  const tier = REFUND_TIERS.find((t) => daysBefore >= t.minDaysBefore);
  const rate = tier ? tier.rate : 0; // 음수(지난 예약) 포함 — 환불 없음
  return { daysBefore, rate, refundAmount: Math.floor(totalAmount * rate) };
};
```

- [ ] **Step 4: 통과 확인** — `npx jest lib/booking/refund-policy.test.ts` → PASS
- [ ] **Step 5: 커밋** — `git commit -m "feat(booking): KST 헬퍼와 기한별 차등 환불 엔진"`

---

### Task 4: 토큰·주문번호 + 입력 검증

**Files:**
- Create: `lib/booking/token.ts`, `lib/booking/validation.ts`
- Test: `lib/booking/validation.test.ts`

**Interfaces:**
- Consumes: Task 2 `getProduct`/`resolveHours`, Task 3 `kstDateTime`/`daysUntilKst`
- Produces:
  - `generateManageToken(): string`, `generateOrderNo(now: Date): string`, `isTokenMatch(expected: string, given: string): boolean` (timingSafeEqual)
  - `interface CreateBookingPayload { productId: string; hours?: number; date: string; startHour: number; customerName: string; customerPhone: string; customerEmail: string; customerNote?: string; refundPolicyAgreed: true }`
  - `validateCreateBookingPayload(body: unknown, now: Date): { ok: true; value: CreateBookingPayload } | { ok: false; message: string }`

- [ ] **Step 1: 실패하는 테스트** (`lib/booking/validation.test.ts`)

```ts
import { validateCreateBookingPayload } from './validation';

const base = {
  productId: 'recording-pro', date: '2026-09-10', startHour: 14,
  customerName: '김보컬', customerPhone: '010-1234-5678',
  customerEmail: 'singer@example.com', refundPolicyAgreed: true,
};
const now = new Date('2026-09-01T00:00:00Z');

describe('validateCreateBookingPayload', () => {
  it('정상 입력 통과', () => {
    expect(validateCreateBookingPayload(base, now).ok).toBe(true);
  });
  it('없는 상품 거부', () => {
    expect(validateCreateBookingPayload({ ...base, productId: 'nope' }, now).ok).toBe(false);
  });
  it('시간제인데 hours 없으면 거부', () => {
    expect(validateCreateBookingPayload({ ...base, productId: 'recording-hourly' }, now).ok).toBe(false);
  });
  it('환불 규정 미동의 거부', () => {
    expect(validateCreateBookingPayload({ ...base, refundPolicyAgreed: false }, now).ok).toBe(false);
  });
  it('전화번호 형식 거부', () => {
    expect(validateCreateBookingPayload({ ...base, customerPhone: '02-123' }, now).ok).toBe(false);
  });
  it('리드타임(24h) 미만 날짜 거부', () => {
    expect(validateCreateBookingPayload({ ...base, date: '2026-09-01' }, now).ok).toBe(false);
  });
  it('60일 밖 날짜 거부', () => {
    expect(validateCreateBookingPayload({ ...base, date: '2026-12-25' }, now).ok).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx jest lib/booking/validation.test.ts` → FAIL

- [ ] **Step 3: 구현**

`lib/booking/token.ts`:

```ts
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const generateManageToken = (): string => randomBytes(24).toString('base64url');

/** 토스 orderId 규격([A-Za-z0-9_-] 6~64자)에 맞는 사람이 읽을 수 있는 주문번호. */
export const generateOrderNo = (now: Date): string => {
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `SNB-${ymd}-${randomBytes(4).toString('hex').toUpperCase()}`;
};

/** 길이 차이가 실행 시간에 드러나지 않게 SHA-256 고정 길이 후 비교 (lib/cron/auth.ts와 동일). */
export const isTokenMatch = (expected: string, given: string): boolean => {
  const a = createHash('sha256').update(expected).digest();
  const b = createHash('sha256').update(given).digest();
  return timingSafeEqual(a, b);
};
```

`lib/booking/validation.ts`:

```ts
import isEmail from 'validator/lib/isEmail';

import { daysUntilKst, kstDateTime } from './kst';
import { getProduct, resolveHours } from './products';

export const MIN_LEAD_HOURS = 24;
export const MAX_BOOK_DAYS = 60;

export interface CreateBookingPayload {
  productId: string;
  hours?: number;
  date: string; // 'YYYY-MM-DD' (KST)
  startHour: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerNote?: string;
  refundPolicyAgreed: true;
}

type Result = { ok: true; value: CreateBookingPayload } | { ok: false; message: string };

const PHONE_RE = /^01[016789]-?\d{3,4}-?\d{4}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const validateCreateBookingPayload = (body: unknown, now: Date): Result => {
  if (typeof body !== 'object' || body === null) return { ok: false, message: '잘못된 요청입니다.' };
  const b = body as Record<string, unknown>;

  const product = typeof b.productId === 'string' ? getProduct(b.productId) : undefined;
  if (!product) return { ok: false, message: '알 수 없는 상품입니다.' };

  const hours = resolveHours(product, typeof b.hours === 'number' ? b.hours : undefined);
  if (hours === null) return { ok: false, message: '예약 시간 수가 올바르지 않습니다.' };

  if (typeof b.date !== 'string' || !DATE_RE.test(b.date)) return { ok: false, message: '날짜가 올바르지 않습니다.' };
  if (typeof b.startHour !== 'number' || !Number.isInteger(b.startHour)) return { ok: false, message: '시작 시간이 올바르지 않습니다.' };

  const startAt = kstDateTime(b.date, b.startHour);
  if (Number.isNaN(startAt.getTime())) return { ok: false, message: '날짜가 올바르지 않습니다.' };
  if (startAt.getTime() - now.getTime() < MIN_LEAD_HOURS * 3600 * 1000)
    return { ok: false, message: `예약은 ${MIN_LEAD_HOURS}시간 이후 시간대부터 가능합니다.` };
  if (daysUntilKst(now, startAt) > MAX_BOOK_DAYS)
    return { ok: false, message: `예약은 ${MAX_BOOK_DAYS}일 이내만 가능합니다.` };

  const name = typeof b.customerName === 'string' ? b.customerName.trim() : '';
  if (name.length < 2 || name.length > 40) return { ok: false, message: '이름을 확인해 주세요.' };
  const phone = typeof b.customerPhone === 'string' ? b.customerPhone.trim() : '';
  if (!PHONE_RE.test(phone)) return { ok: false, message: '휴대폰 번호를 확인해 주세요.' };
  const email = typeof b.customerEmail === 'string' ? b.customerEmail.trim() : '';
  if (!isEmail(email)) return { ok: false, message: '이메일을 확인해 주세요.' };
  const note = typeof b.customerNote === 'string' ? b.customerNote.trim().slice(0, 500) : undefined;

  if (b.refundPolicyAgreed !== true) return { ok: false, message: '환불 규정에 동의해 주세요.' };

  return {
    ok: true,
    value: {
      productId: product.id, hours, date: b.date, startHour: b.startHour,
      customerName: name, customerPhone: phone, customerEmail: email,
      customerNote: note, refundPolicyAgreed: true,
    },
  };
};
```

- [ ] **Step 4: 통과 확인** — `npx jest lib/booking/validation.test.ts` → PASS
- [ ] **Step 5: 커밋** — `git commit -m "feat(booking): 관리 토큰·주문번호·예약 입력 검증"`

---

### Task 5: 겹침 방지 주문·예약 생성 서비스

**Files:**
- Create: `lib/booking/service.ts`
- Test: `lib/booking/service.test.ts`

**Interfaces:**
- Consumes: Task 1 스키마, Task 2 `computeAmounts`, Task 3 `kstDateTime`, Task 4 토큰·검증 타입
- Produces:
  - `PENDING_HOLD_SECONDS = 900`
  - `createBookingOrder(payload: CreateBookingPayload, now: Date): Promise<{ ok: true; orderNo: string; totalAmount: number; bookingId: string } | { ok: false; code: 'slot_taken' }>`
  - `findOrderByOrderNo(orderNo: string): Promise<(Order & { bookings: Booking[]; payments: Payment[] }) | undefined>`
  - `expireStaleOrders(now: Date): Promise<void>` (pending 900초 초과 → orders expired / bookings cancelled)
  - `buildBookingInsertSql(...)` (테스트 대상 분리용 — 아래 참조)

핵심은 **겹침 검사와 INSERT를 한 문장으로** 묶는 것: `INSERT ... SELECT ... WHERE NOT EXISTS(겹침)`은 그 자체로 원자적이라 두 요청이 동시에 와도 한쪽만 성공한다(`rowsAffected === 0`이 충돌 신호 — sign-transaction.ts의 "조건부 문장" 철학과 동일). 겹침 판정 조건은 `b.start_at < :endAt AND b.end_at > :startAt` (경계 접촉은 겹침 아님)이고, `pending`은 900초 이내 것만 점유로 친다(만료 크론 없이 lazy expiry — `expireOverdueContracts` 패턴).

- [ ] **Step 1: 순수 로직 테스트 작성** (`lib/booking/service.test.ts`) — DB 없이 검증 가능한 겹침 술어를 분리해 테스트

```ts
import { rangesOverlap } from './service';

describe('rangesOverlap — 경계 접촉은 겹침이 아니다', () => {
  const s = (h: number) => new Date(Date.UTC(2026, 8, 10, h));
  it('완전 분리', () => expect(rangesOverlap(s(1), s(3), s(3), s(5))).toBe(false));
  it('경계 접촉', () => expect(rangesOverlap(s(1), s(3), s(3), s(4))).toBe(false));
  it('부분 겹침', () => expect(rangesOverlap(s(1), s(3), s(2), s(4))).toBe(true));
  it('포함', () => expect(rangesOverlap(s(1), s(5), s(2), s(3))).toBe(true));
});
```

- [ ] **Step 2: 실패 확인** — `npx jest lib/booking/service.test.ts` → FAIL

- [ ] **Step 3: 구현** (`lib/booking/service.ts`)

```ts
import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { bookings, orders, type Booking, type Order, type Payment } from '../../db/schema';
import { computeAmounts } from './amounts';
import { kstDateTime } from './kst';
import { getProduct } from './products';
import { generateManageToken, generateOrderNo } from './token';
import type { CreateBookingPayload } from './validation';

export const PENDING_HOLD_SECONDS = 900;

export const rangesOverlap = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean =>
  aStart < bEnd && bStart < aEnd;

const toEpoch = (d: Date): number => Math.floor(d.getTime() / 1000);

export const createBookingOrder = async (
  payload: CreateBookingPayload,
  now: Date,
): Promise<{ ok: true; orderNo: string; totalAmount: number; bookingId: string } | { ok: false; code: 'slot_taken' }> => {
  const db = getDb();
  const product = getProduct(payload.productId)!; // validation이 보장
  const hours = payload.hours!;
  const amounts = computeAmounts(product, hours);
  const startAt = kstDateTime(payload.date, payload.startHour);
  const endAt = kstDateTime(payload.date, payload.startHour + hours);
  const orderNo = generateOrderNo(now);
  const manageToken = generateManageToken();

  const [order] = await db
    .insert(orders)
    .values({
      orderNo, type: 'session',
      customerName: payload.customerName, customerPhone: payload.customerPhone,
      customerEmail: payload.customerEmail,
      itemAmount: amounts.itemAmount, vatAmount: amounts.vatAmount, totalAmount: amounts.totalAmount,
      manageToken,
    })
    .returning({ id: orders.id });

  // 겹침 검사 + INSERT를 한 문장으로 — 동시 요청은 한쪽만 rowsAffected 1.
  const bookingId = crypto.randomUUID().replace(/-/g, '');
  const result = await db.run(sql`
    INSERT INTO bookings (id, order_id, product_id, service_type, start_at, end_at, duration_hours, status, customer_note)
    SELECT ${bookingId}, ${order.id}, ${product.id}, ${product.service},
           ${toEpoch(startAt)}, ${toEpoch(endAt)}, ${hours}, 'pending', ${payload.customerNote ?? null}
    WHERE NOT EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.start_at < ${toEpoch(endAt)} AND b.end_at > ${toEpoch(startAt)}
        AND (b.status = 'confirmed'
             OR (b.status = 'pending' AND b.created_at > unixepoch() - ${PENDING_HOLD_SECONDS}))
    )
    AND NOT EXISTS (
      SELECT 1 FROM availability_blocks ab
      WHERE ab.start_at < ${toEpoch(endAt)} AND ab.end_at > ${toEpoch(startAt)}
    )
  `);

  if (Number(result.rowsAffected) === 0) {
    await db.run(sql`UPDATE orders SET status = 'failed' WHERE id = ${order.id} AND status = 'pending'`);
    return { ok: false, code: 'slot_taken' };
  }
  return { ok: true, orderNo, totalAmount: amounts.totalAmount, bookingId };
};

export const findOrderByOrderNo = async (
  orderNo: string,
): Promise<(Order & { bookings: Booking[]; payments: Payment[] }) | undefined> =>
  getDb().query.orders.findFirst({
    where: (t, { eq }) => eq(t.orderNo, orderNo),
    with: { bookings: true, payments: true },
  });

/**
 * 결제가 오지 않은 선점을 정리한다. 슬롯 조회·관리자 목록에서 lazy 호출
 * (expireOverdueContracts 패턴). 두 UPDATE는 원자성이 필요 없다 — 겹침 검사가
 * 어차피 900초 지난 pending을 무시하므로, 이 정리는 표시용 상태 정합일 뿐이다.
 */
export const expireStaleOrders = async (now: Date): Promise<void> => {
  const db = getDb();
  const cutoff = toEpoch(now) - PENDING_HOLD_SECONDS;
  await db.run(sql`
    UPDATE bookings SET status = 'cancelled', cancelled_at = unixepoch(), updated_at = unixepoch()
    WHERE status = 'pending' AND created_at < ${cutoff}
  `);
  await db.run(sql`
    UPDATE orders SET status = 'expired', updated_at = unixepoch()
    WHERE status = 'pending' AND created_at < ${cutoff}
  `);
};
```

주의: `crypto.randomUUID`는 Node 전역이므로 import 불필요. ESLint가 전역 crypto를 거부하면 `import { randomUUID } from 'node:crypto'`로 대체(contracts service.ts와 동일).

- [ ] **Step 4: 통과 확인** — `npx jest lib/booking/service.test.ts` → PASS, `npm run type-check`
- [ ] **Step 5: 커밋** — `git commit -m "feat(booking): 원자적 겹침 방지 주문·예약 생성과 lazy 만료"`

---

### Task 6: 토스 REST 클라이언트

**Files:**
- Create: `lib/booking/toss.ts`
- Test: `lib/booking/toss.test.ts`

**Interfaces:**
- Produces:
  - `interface TossPayment { paymentKey: string; orderId: string; status: string; totalAmount: number; method?: string; approvedAt?: string; receipt?: { url: string }; cancels?: Array<{ transactionKey: string; cancelAmount: number }> }`
  - `type TossResult = { ok: true; payment: TossPayment } | { ok: false; code: string; message: string }`
  - `confirmPayment(input: { paymentKey: string; orderId: string; amount: number }): Promise<TossResult>`
  - `cancelPayment(input: { paymentKey: string; cancelReason: string; cancelAmount: number }): Promise<TossResult>`
  - `fetchPayment(paymentKey: string): Promise<TossResult>`

- [ ] **Step 1: 실패하는 테스트** (`lib/booking/toss.test.ts`)

```ts
import { confirmPayment } from './toss';

const okPayment = { paymentKey: 'pk', orderId: 'SNB-1', status: 'DONE', totalAmount: 275000 };

describe('confirmPayment', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  it('시크릿 키를 Basic 헤더로 보내고 응답을 돌려준다', async () => {
    process.env.TOSS_SECRET_KEY = 'test_sk_abc';
    const mock = jest.fn().mockResolvedValue({ ok: true, json: async () => okPayment });
    global.fetch = mock as unknown as typeof fetch;
    const result = await confirmPayment({ paymentKey: 'pk', orderId: 'SNB-1', amount: 275000 });
    expect(result).toEqual({ ok: true, payment: okPayment });
    const [url, init] = mock.mock.calls[0];
    expect(url).toBe('https://api.tosspayments.com/v1/payments/confirm');
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from('test_sk_abc:').toString('base64')}`);
  });

  it('토스 에러 응답은 코드·메시지로 돌려준다', async () => {
    process.env.TOSS_SECRET_KEY = 'test_sk_abc';
    global.fetch = jest.fn().mockResolvedValue({
      ok: false, json: async () => ({ code: 'NOT_FOUND_PAYMENT', message: '없는 결제' }),
    }) as unknown as typeof fetch;
    const result = await confirmPayment({ paymentKey: 'x', orderId: 'y', amount: 1 });
    expect(result).toEqual({ ok: false, code: 'NOT_FOUND_PAYMENT', message: '없는 결제' });
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx jest lib/booking/toss.test.ts` → FAIL

- [ ] **Step 3: 구현** (`lib/booking/toss.ts`)

```ts
const TOSS_API = 'https://api.tosspayments.com/v1';
const REQUEST_TIMEOUT_MS = 12000; // resend.ts와 같은 기준

export interface TossPayment {
  paymentKey: string;
  orderId: string;
  status: string; // 'DONE' | 'CANCELED' | 'PARTIAL_CANCELED' | ...
  totalAmount: number;
  method?: string;
  approvedAt?: string;
  receipt?: { url: string };
  cancels?: Array<{ transactionKey: string; cancelAmount: number }>;
}

export type TossResult =
  | { ok: true; payment: TossPayment }
  | { ok: false; code: string; message: string };

const authHeader = (): string => {
  const secret = process.env.TOSS_SECRET_KEY;
  if (!secret) throw new Error('TOSS_SECRET_KEY가 설정되지 않았습니다.');
  return `Basic ${Buffer.from(`${secret}:`).toString('base64')}`;
};

const request = async (path: string, init?: { method?: string; body?: unknown }): Promise<TossResult> => {
  try {
    const res = await fetch(`${TOSS_API}${path}`, {
      method: init?.method ?? 'GET',
      headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const json = await res.json();
    if (!res.ok) {
      return { ok: false, code: String(json.code ?? 'UNKNOWN'), message: String(json.message ?? '결제사 오류') };
    }
    return { ok: true, payment: json as TossPayment };
  } catch (error) {
    return { ok: false, code: 'NETWORK_ERROR', message: error instanceof Error ? error.message : '네트워크 오류' };
  }
};

export const confirmPayment = (input: { paymentKey: string; orderId: string; amount: number }): Promise<TossResult> =>
  request('/payments/confirm', { method: 'POST', body: input });

export const cancelPayment = (input: { paymentKey: string; cancelReason: string; cancelAmount: number }): Promise<TossResult> =>
  request(`/payments/${encodeURIComponent(input.paymentKey)}/cancel`, {
    method: 'POST',
    body: { cancelReason: input.cancelReason, cancelAmount: input.cancelAmount },
  });

export const fetchPayment = (paymentKey: string): Promise<TossResult> =>
  request(`/payments/${encodeURIComponent(paymentKey)}`);
```

- [ ] **Step 4: 통과 확인** — `npx jest lib/booking/toss.test.ts` → PASS
- [ ] **Step 5: 커밋** — `git commit -m "feat(booking): 토스페이먼츠 REST 클라이언트 (승인·취소·조회)"`

---

### Task 7: 구글 캘린더 클라이언트 (서비스 계정)

**Files:**
- Create: `lib/booking/gcal.ts`
- Test: `lib/booking/gcal.test.ts`

**Interfaces:**
- Produces:
  - `interface BusyRange { start: Date; end: Date }`
  - `fetchBusyRanges(timeMin: Date, timeMax: Date): Promise<BusyRange[]>` — **실패 시 throw** (호출부 fail-closed)
  - `createBookingEvent(input: { summary: string; description: string; start: Date; end: Date }): Promise<string>` (eventId 반환)
  - `deleteBookingEvent(eventId: string): Promise<void>`
  - `buildServiceAccountJwt(now: Date): string` (테스트 대상)

새 의존성 없이 서비스 계정 JWT(RS256)를 `node:crypto`로 직접 서명한다(googleapis 패키지는 이 저장소 규모에 과함 — Resend를 REST로 부르는 관례와 동일). 환경변수: `GOOGLE_SA_EMAIL`, `GOOGLE_SA_PRIVATE_KEY`(PEM, `\n` 이스케이프 허용), `BOOKING_GCAL_ID`.

- [ ] **Step 1: 실패하는 테스트** (`lib/booking/gcal.test.ts`)

```ts
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { buildServiceAccountJwt } from './gcal';

describe('buildServiceAccountJwt', () => {
  it('RS256 서명이 검증되고 클레임이 올바르다', () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    process.env.GOOGLE_SA_EMAIL = 'bot@project.iam.gserviceaccount.com';
    process.env.GOOGLE_SA_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

    const jwt = buildServiceAccountJwt(new Date('2026-09-01T00:00:00Z'));
    const [h, p, s] = jwt.split('.');
    const verify = createVerify('RSA-SHA256').update(`${h}.${p}`);
    expect(verify.verify(publicKey, Buffer.from(s, 'base64url'))).toBe(true);

    const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
    expect(claims.iss).toBe('bot@project.iam.gserviceaccount.com');
    expect(claims.scope).toBe('https://www.googleapis.com/auth/calendar');
    expect(claims.aud).toBe('https://oauth2.googleapis.com/token');
    expect(claims.exp - claims.iat).toBe(3600);
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx jest lib/booking/gcal.test.ts` → FAIL

- [ ] **Step 3: 구현** (`lib/booking/gcal.ts`)

```ts
import { createSign } from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CAL_API = 'https://www.googleapis.com/calendar/v3';
const SCOPE = 'https://www.googleapis.com/auth/calendar';
const REQUEST_TIMEOUT_MS = 8000;

const b64url = (input: string | Buffer): string => Buffer.from(input).toString('base64url');

export const buildServiceAccountJwt = (now: Date): string => {
  const email = process.env.GOOGLE_SA_EMAIL;
  const key = process.env.GOOGLE_SA_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!email || !key) throw new Error('GOOGLE_SA_EMAIL / GOOGLE_SA_PRIVATE_KEY가 설정되지 않았습니다.');
  const iat = Math.floor(now.getTime() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ iss: email, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 }));
  const signature = createSign('RSA-SHA256').update(`${header}.${payload}`).sign(key);
  return `${header}.${payload}.${b64url(signature)}`;
};

/** 인스턴스 수명 동안의 토큰 캐시 — 만료 60초 전 갱신. */
let cachedToken: { value: string; expiresAt: number } | null = null;

const getAccessToken = async (): Promise<string> => {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) return cachedToken.value;
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: buildServiceAccountJwt(new Date(now)),
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`구글 토큰 발급 실패: ${res.status}`);
  const json = await res.json();
  cachedToken = { value: json.access_token, expiresAt: now + json.expires_in * 1000 };
  return cachedToken.value;
};

const calendarId = (): string => {
  const id = process.env.BOOKING_GCAL_ID;
  if (!id) throw new Error('BOOKING_GCAL_ID가 설정되지 않았습니다.');
  return id;
};

export interface BusyRange { start: Date; end: Date }

/** 실패는 throw — 호출부는 해당 시간대를 예약 불가로 처리한다(fail-closed, 스펙 §6). */
export const fetchBusyRanges = async (timeMin: Date, timeMax: Date): Promise<BusyRange[]> => {
  const token = await getAccessToken();
  const res = await fetch(`${CAL_API}/freeBusy`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), items: [{ id: calendarId() }] }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`freeBusy 조회 실패: ${res.status}`);
  const json = await res.json();
  const busy: Array<{ start: string; end: string }> = json.calendars?.[calendarId()]?.busy ?? [];
  return busy.map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
};

export const createBookingEvent = async (input: {
  summary: string; description: string; start: Date; end: Date;
}): Promise<string> => {
  const token = await getAccessToken();
  const res = await fetch(`${CAL_API}/calendars/${encodeURIComponent(calendarId())}/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: input.summary,
      description: input.description,
      start: { dateTime: input.start.toISOString() },
      end: { dateTime: input.end.toISOString() },
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`캘린더 이벤트 생성 실패: ${res.status}`);
  return (await res.json()).id as string;
};

export const deleteBookingEvent = async (eventId: string): Promise<void> => {
  const token = await getAccessToken();
  const res = await fetch(
    `${CAL_API}/calendars/${encodeURIComponent(calendarId())}/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
  );
  if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(`캘린더 이벤트 삭제 실패: ${res.status}`);
};
```

- [ ] **Step 4: 통과 확인** — `npx jest lib/booking/gcal.test.ts` → PASS
- [ ] **Step 5: 커밋** — `git commit -m "feat(booking): 서비스 계정 JWT 기반 구글 캘린더 클라이언트"`

---

### Task 8: 알림 이메일 모듈

**Files:**
- Create: `lib/booking/email.ts`
- Test: 없음 (템플릿 조립뿐 — 발송 로직은 기존 `lib/email/resend.ts`가 이미 테스트됨)

**Interfaces:**
- Consumes: `lib/email/resend.ts`의 `sendEmail`(default export 여부는 파일 확인 후 동일하게 import), `lib/operatorContact.ts`의 `OPERATOR_EMAIL`, Task 3 `REFUND_POLICY_LINES`
- Produces:
  - `sendBookingConfirmedEmails(order: Order, booking: Booking): Promise<string | null>` — 실패 요약 문자열 또는 null(성공). 호출부가 `orders.notificationError`에 기록
  - `sendBookingCancelledEmails(order: Order, booking: Booking, refundAmount: number): Promise<string | null>`

- [ ] **Step 1: 구현**

```ts
import { sendEmail } from '../email/resend'; // 실제 export 이름은 파일 상단에서 확인해 맞출 것
import { OPERATOR_EMAIL } from '../operatorContact';
import type { Booking, Order } from '../../db/schema';
import { formatPriceAmount } from '../../data/pricing';
import { kstDateString } from './kst';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://studionol.co.kr').replace(/\/+$/, '');

const kstTimeLabel = (d: Date): string => {
  const t = new Date(d.getTime() + 9 * 3600 * 1000);
  return `${kstDateString(d)} ${String(t.getUTCHours()).padStart(2, '0')}:00`;
};

const manageUrl = (order: Order): string =>
  `${SITE_URL}/ko/booking/manage/${order.orderNo}?token=${order.manageToken}`;

/** 두 통 중 하나라도 실패하면 요약을 돌려준다 — 성공 null (notificationError 패턴). */
export const sendBookingConfirmedEmails = async (order: Order, booking: Booking): Promise<string | null> => {
  const when = kstTimeLabel(booking.startAt);
  const failures: string[] = [];

  const customer = await sendEmail({
    to: order.customerEmail,
    subject: `[스튜디오 놀] 예약이 확정되었습니다 — ${when}`,
    text: [
      `${order.customerName}님, 예약이 확정되었습니다.`,
      `일시: ${when} (${booking.durationHours}시간)`,
      `결제 금액: ${formatPriceAmount(order.totalAmount)}원 (VAT 포함)`,
      `주문번호: ${order.orderNo}`,
      '',
      `예약 확인·취소: ${manageUrl(order)}`,
      '문의: 010-4255-7893',
    ].join('\n'),
  });
  if (!customer.ok) failures.push(`customer:${customer.errorCode}`);

  const operator = await sendEmail({
    to: OPERATOR_EMAIL,
    subject: `[예약] ${when} ${booking.serviceType} — ${order.customerName}`,
    text: [
      `새 예약이 결제 완료되었습니다.`,
      `일시: ${when} (${booking.durationHours}시간)`,
      `고객: ${order.customerName} / ${order.customerPhone} / ${order.customerEmail}`,
      `금액: ${formatPriceAmount(order.totalAmount)}원`,
      `요청사항: ${booking.customerNote ?? '없음'}`,
      `관리자: ${SITE_URL}/admin/bookings`,
    ].join('\n'),
  });
  if (!operator.ok) failures.push(`operator:${operator.errorCode}`);

  return failures.length ? failures.join(', ') : null;
};

export const sendBookingCancelledEmails = async (
  order: Order, booking: Booking, refundAmount: number,
): Promise<string | null> => {
  const when = kstTimeLabel(booking.startAt);
  const failures: string[] = [];
  const customer = await sendEmail({
    to: order.customerEmail,
    subject: `[스튜디오 놀] 예약이 취소되었습니다 — ${when}`,
    text: [
      `${order.customerName}님, 예약이 취소되었습니다.`,
      `환불 금액: ${formatPriceAmount(refundAmount)}원 (결제 수단으로 환불, 카드사에 따라 3~5영업일 소요)`,
      `주문번호: ${order.orderNo}`,
    ].join('\n'),
  });
  if (!customer.ok) failures.push(`customer:${customer.errorCode}`);
  const operator = await sendEmail({
    to: OPERATOR_EMAIL,
    subject: `[예약 취소] ${when} — ${order.customerName} (환불 ${formatPriceAmount(refundAmount)}원)`,
    text: `주문 ${order.orderNo} 취소. 관리자: ${SITE_URL}/admin/bookings`,
  });
  if (!operator.ok) failures.push(`operator:${operator.errorCode}`);
  return failures.length ? failures.join(', ') : null;
};
```

구현 시 `lib/email/resend.ts`의 실제 export 시그니처(`sendEmail(params): Promise<SendEmailResult>`)를 열어 확인하고 import를 맞춘다.

- [ ] **Step 2: 검증·커밋** — `npm run type-check` → `git commit -m "feat(booking): 예약 확정·취소 알림 이메일"`

---

### Task 9: 승인 확정 흐름 (confirm)

**Files:**
- Create: `lib/booking/confirm.ts`
- Test: `lib/booking/confirm.test.ts`

**Interfaces:**
- Consumes: Task 5 `findOrderByOrderNo`, Task 6 `confirmPayment`, Task 7 `createBookingEvent`, Task 8 `sendBookingConfirmedEmails`, Task 1 스키마
- Produces:
  - `type ConfirmOutcome = { ok: true; orderNo: string } | { ok: false; code: 'not_found' | 'amount_mismatch' | 'invalid_state' | 'toss_rejected'; message: string }`
  - `confirmBookingPayment(input: { orderNo: string; paymentKey: string; amount: number }): Promise<ConfirmOutcome>` — success 페이지 SSR과 웹훅이 공유

동작 순서 (한 곳에만 존재해야 하는 로직):

1. `findOrderByOrderNo` — 없으면 `not_found`
2. `status === 'paid'`면 **즉시 성공 반환** (success 페이지 새로고침 멱등성)
3. `status !== 'pending'`이면 `invalid_state`
4. `amount !== order.totalAmount`면 **토스 호출 없이** `amount_mismatch` (위변조 차단)
5. `confirmPayment` 호출, 실패 시 `toss_rejected` + `orders.status='failed'`
6. `db.batch`: ① `payments` INSERT(paymentKey unique — 동시 승인 시 두 번째 batch 전체 실패) ② `orders` → paid (`WHERE status='pending'` 가드) ③ `bookings` → confirmed (`WHERE status='pending'` 가드)
7. 후처리(실패해도 승인은 성공): `createBookingEvent` → `bookings.gcalEventId` 저장, 실패 시 `gcalError` 기록 / `sendBookingConfirmedEmails` → 실패 시 `orders.notificationError` 기록

- [ ] **Step 1: 실패하는 테스트** (`lib/booking/confirm.test.ts`) — 토스·DB·gcal·email 모듈 mock

```ts
jest.mock('./service', () => ({ findOrderByOrderNo: jest.fn() }));
jest.mock('./toss', () => ({ confirmPayment: jest.fn() }));
jest.mock('./gcal', () => ({ createBookingEvent: jest.fn().mockResolvedValue('evt1') }));
jest.mock('./email', () => ({ sendBookingConfirmedEmails: jest.fn().mockResolvedValue(null) }));
jest.mock('../../db/client', () => ({
  getDb: () => ({
    batch: jest.fn().mockResolvedValue([]),
    insert: jest.fn().mockReturnValue({ values: jest.fn().mockReturnValue({}) }),
    update: jest.fn().mockReturnValue({ set: jest.fn().mockReturnValue({ where: jest.fn().mockReturnValue({}) }) }),
    run: jest.fn().mockResolvedValue({ rowsAffected: 1 }),
  }),
}));

import { confirmBookingPayment } from './confirm';
import { findOrderByOrderNo } from './service';
import { confirmPayment } from './toss';

const order = (over: object = {}) => ({
  id: 'o1', orderNo: 'SNB-1', status: 'pending', totalAmount: 275000,
  customerName: '김보컬', customerPhone: '010-1234-5678', customerEmail: 'a@b.c',
  manageToken: 't', bookings: [{ id: 'b1', status: 'pending', startAt: new Date(), endAt: new Date(), durationHours: 3, serviceType: 'recording', customerNote: null }],
  payments: [], ...over,
});

describe('confirmBookingPayment', () => {
  it('금액 불일치면 토스를 부르지 않는다', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    const r = await confirmBookingPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 1000 });
    expect(r).toMatchObject({ ok: false, code: 'amount_mismatch' });
    expect(confirmPayment).not.toHaveBeenCalled();
  });
  it('이미 paid면 재승인 없이 성공 (새로고침 멱등)', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order({ status: 'paid' }));
    const r = await confirmBookingPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 275000 });
    expect(r).toMatchObject({ ok: true });
    expect(confirmPayment).not.toHaveBeenCalled();
  });
  it('정상 경로는 토스 승인 후 성공', async () => {
    (findOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    (confirmPayment as jest.Mock).mockResolvedValue({ ok: true, payment: { paymentKey: 'pk', orderId: 'SNB-1', status: 'DONE', totalAmount: 275000 } });
    const r = await confirmBookingPayment({ orderNo: 'SNB-1', paymentKey: 'pk', amount: 275000 });
    expect(r).toEqual({ ok: true, orderNo: 'SNB-1' });
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx jest lib/booking/confirm.test.ts` → FAIL

- [ ] **Step 3: 구현** (`lib/booking/confirm.ts`)

```ts
import { and, eq, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { bookings, orders, payments } from '../../db/schema';
import { sendBookingConfirmedEmails } from './email';
import { createBookingEvent } from './gcal';
import { findOrderByOrderNo } from './service';
import { confirmPayment } from './toss';
import { kstDateString } from './kst';

export type ConfirmOutcome =
  | { ok: true; orderNo: string }
  | { ok: false; code: 'not_found' | 'amount_mismatch' | 'invalid_state' | 'toss_rejected'; message: string };

export const confirmBookingPayment = async (input: {
  orderNo: string;
  paymentKey: string;
  amount: number;
}): Promise<ConfirmOutcome> => {
  const order = await findOrderByOrderNo(input.orderNo);
  if (!order) return { ok: false, code: 'not_found', message: '주문을 찾을 수 없습니다.' };

  // success 페이지 새로고침·웹훅 중복 도착 멱등성 — 이미 확정이면 성공으로 답한다.
  if (order.status === 'paid') return { ok: true, orderNo: order.orderNo };
  if (order.status !== 'pending')
    return { ok: false, code: 'invalid_state', message: '이미 처리되었거나 만료된 주문입니다.' };

  // 서버가 저장한 금액이 유일한 진실 — 다르면 토스를 부르지도 않는다(위변조 차단).
  if (input.amount !== order.totalAmount)
    return { ok: false, code: 'amount_mismatch', message: '결제 금액이 주문과 일치하지 않습니다.' };

  const toss = await confirmPayment({ paymentKey: input.paymentKey, orderId: order.orderNo, amount: input.amount });
  if (!toss.ok) {
    const db = getDb();
    await db.run(sql`UPDATE orders SET status = 'failed', updated_at = unixepoch() WHERE id = ${order.id} AND status = 'pending'`);
    return { ok: false, code: 'toss_rejected', message: toss.message };
  }

  const db = getDb();
  const booking = order.bookings[0];
  // payments INSERT가 맨 앞 — paymentKey unique 위반이 동시 확정의 두 번째 시도를
  // batch 전체 실패로 만든다(절반만 쓰인 상태가 남지 않는다).
  await db.batch([
    db.insert(payments).values({
      orderId: order.id,
      paymentKey: toss.payment.paymentKey,
      method: toss.payment.method ?? null,
      approvedAt: toss.payment.approvedAt ? new Date(toss.payment.approvedAt) : null,
      receiptUrl: toss.payment.receipt?.url ?? null,
      rawResponse: JSON.stringify(toss.payment),
    }),
    db.update(orders)
      .set({ status: 'paid', updatedAt: new Date() })
      .where(and(eq(orders.id, order.id), eq(orders.status, 'pending'))),
    db.update(bookings)
      .set({ status: 'confirmed', updatedAt: new Date() })
      .where(and(eq(bookings.orderId, order.id), eq(bookings.status, 'pending'))),
  ]);

  // 후처리 — 결제는 이미 성공했으므로 실패를 삼키되 반드시 기록한다 (스펙 §10).
  if (booking) {
    try {
      const eventId = await createBookingEvent({
        summary: `[예약] ${booking.serviceType} — ${order.customerName}`,
        description: [
          `상품: ${booking.productId} (${booking.durationHours}시간)`,
          `고객: ${order.customerName} / ${order.customerPhone} / ${order.customerEmail}`,
          `주문번호: ${order.orderNo}`,
          `요청사항: ${booking.customerNote ?? '없음'}`,
        ].join('\n'),
        start: booking.startAt,
        end: booking.endAt,
      });
      await db.update(bookings).set({ gcalEventId: eventId }).where(eq(bookings.id, booking.id));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      await db.update(bookings).set({ gcalError: `create(${kstDateString(new Date())}): ${detail}` }).where(eq(bookings.id, booking.id));
    }

    const notifyError = await sendBookingConfirmedEmails({ ...order, status: 'paid' }, booking);
    await db.update(orders).set({ notificationError: notifyError }).where(eq(orders.id, order.id));
  }

  return { ok: true, orderNo: order.orderNo };
};
```

- [ ] **Step 4: PASS 확인** — `npx jest lib/booking/confirm.test.ts`

- [ ] **Step 5: 커밋** — `git commit -m "feat(booking): 결제 승인 확정 흐름 — 금액 검증·멱등·후처리 기록"`

---

### Task 10: 결제 페이지 3종 (success / fail / booking API)

**Files:**
- Create: `pages/api/bookings/index.ts`, `pages/[locale]/booking/success.tsx`, `pages/[locale]/booking/fail.tsx`
- Create: `lib/booking/rate-limit.ts`
- Test: 로직은 Task 4·5·9에서 이미 커버 — 이 태스크는 배선. `npm run type-check`로 검증

**Interfaces:**
- Consumes: Task 4 `validateCreateBookingPayload`, Task 5 `createBookingOrder`, Task 9 `confirmBookingPayment`, `lib/contracts/client-ip.ts`의 클라이언트 IP 헬퍼
- Produces:
  - `POST /api/bookings` → `201 { ok: true, orderNo, totalAmount }` | `400 { ok: false, message }` | `409 { ok: false, code: 'slot_taken' }` | `429`
  - `consumeRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean>` (기존 `rate_limits` 테이블 사용 — `lib/contracts/admin-rate-limit.ts`의 카운터 로직을 일반화해 복제)
  - success 페이지: 쿼리 `paymentKey`·`orderId`·`amount`를 SSR에서 `confirmBookingPayment`에 전달, 결과별 화면

- [ ] **Step 1: rate-limit 헬퍼** (`lib/booking/rate-limit.ts`) — `lib/contracts/admin-rate-limit.ts`를 열어 rate_limits 테이블 증가·만료 로직을 그대로 따르되 키·한도를 인자화한 `consumeRateLimit`로 작성

- [ ] **Step 2: 주문 생성 API** (`pages/api/bookings/index.ts`)

```ts
import type { NextApiRequest, NextApiResponse } from 'next';

import { getClientIp } from '../../../lib/contracts/client-ip'; // 실제 export 이름 확인
import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { createBookingOrder } from '../../../lib/booking/service';
import { validateCreateBookingPayload } from '../../../lib/booking/validation';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`booking_create:ip:${ip}`, 10, 3600)))
    return res.status(429).json({ ok: false, message: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });

  const now = new Date();
  const validated = validateCreateBookingPayload(req.body, now);
  if (!validated.ok) return res.status(400).json({ ok: false, message: validated.message });

  const result = await createBookingOrder(validated.value, now);
  if (!result.ok) return res.status(409).json({ ok: false, code: result.code, message: '방금 다른 예약이 먼저 잡혔습니다. 다른 시간대를 선택해 주세요.' });
  return res.status(201).json({ ok: true, orderNo: result.orderNo, totalAmount: result.totalAmount });
}
```

- [ ] **Step 3: success 페이지** (`pages/[locale]/booking/success.tsx`) — contracts sign.tsx의 standalone SSR 패턴(Head + noindex, Layout 미사용):

```tsx
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import { confirmBookingPayment } from '../../../lib/booking/confirm';

interface SuccessProps {
  outcome: 'confirmed' | 'error';
  message?: string;
  orderNo?: string;
}

export default function BookingSuccessPage({ outcome, message, orderNo }: SuccessProps) {
  return (
    <>
      <Head>
        <title>예약 결제 완료 | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className="mx-auto max-w-lg px-4 py-24 text-center">
        {outcome === 'confirmed' ? (
          <>
            <h1 className="text-2xl font-bold">예약이 확정되었습니다</h1>
            <p className="mt-4 text-gray-600 dark:text-gray-300">
              주문번호 {orderNo}. 예약 확인 메일을 보내드렸습니다 — 메일의 링크에서 예약을 확인·취소할 수 있습니다.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">결제를 확정하지 못했습니다</h1>
            <p className="mt-4 text-gray-600 dark:text-gray-300">{message}</p>
            <p className="mt-2 text-sm text-gray-500">결제가 이뤄졌다면 자동으로 취소되거나 확정됩니다. 문의: 010-4255-7893</p>
          </>
        )}
        <Link href="/ko" className="mt-8 inline-block underline">홈으로</Link>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<SuccessProps> = async ({ query, res, params }) => {
  res.setHeader('Cache-Control', 'no-store');
  if (params?.locale !== 'ko') return { redirect: { destination: '/ko', permanent: false } };
  const { paymentKey, orderId, amount } = query;
  if (typeof paymentKey !== 'string' || typeof orderId !== 'string' || typeof amount !== 'string')
    return { props: { outcome: 'error', message: '잘못된 접근입니다.' } };

  const result = await confirmBookingPayment({ orderNo: orderId, paymentKey, amount: Number(amount) });
  if (!result.ok) return { props: { outcome: 'error', message: result.message } };
  return { props: { outcome: 'confirmed', orderNo: result.orderNo } };
};
```

- [ ] **Step 4: fail 페이지** (`pages/[locale]/booking/fail.tsx`) — 쿼리 `code`·`message`(토스가 붙임)를 보여주고 예약 페이지로 되돌아가는 정적 화면. 같은 noindex·ko 가드. 결제 실패 시 주문은 pending으로 남아 15분 뒤 lazy 만료된다(별도 처리 불필요)

- [ ] **Step 5: 검증·커밋** — `npm run type-check && npm run lint` → `git commit -m "feat(booking): 주문 생성 API와 결제 success/fail 페이지"`

---

### Task 11: 슬롯 계산 + 슬롯 API

**Files:**
- Create: `lib/booking/slots.ts`, `pages/api/bookings/slots.ts`
- Test: `lib/booking/slots.test.ts`

**Interfaces:**
- Consumes: Task 2 `getProduct`·`resolveHours`, Task 3 `kstDateTime`, Task 5 `rangesOverlap`·`expireStaleOrders`·`PENDING_HOLD_SECONDS`, Task 7 `fetchBusyRanges`
- Produces:
  - `OPEN_HOUR = 10`, `CLOSE_HOUR = 22`
  - `interface DaySlot { startHour: number; available: boolean }`
  - `buildDaySlots(input: { date: string; durationHours: number; busy: Array<{start: Date; end: Date}>; now: Date; minLeadHours: number }): DaySlot[]` — 순수 함수
  - `GET /api/bookings/slots?productId=&hours=&date=YYYY-MM-DD` → `200 { ok: true, slots: DaySlot[] }` | `503 { ok: false, code: 'calendar_unavailable' }`

- [ ] **Step 1: 실패하는 테스트** (`lib/booking/slots.test.ts`)

```ts
import { buildDaySlots, CLOSE_HOUR, OPEN_HOUR } from './slots';
import { kstDateTime } from './kst';

const noBusy: Array<{ start: Date; end: Date }> = [];
const past = new Date('2026-01-01T00:00:00Z');

describe('buildDaySlots', () => {
  it('빈 날은 영업시간 내 duration이 들어가는 시작 시각이 전부 가능', () => {
    const slots = buildDaySlots({ date: '2026-09-10', durationHours: 3, busy: noBusy, now: past, minLeadHours: 24 });
    expect(slots[0]).toEqual({ startHour: OPEN_HOUR, available: true });
    expect(slots[slots.length - 1].startHour).toBe(CLOSE_HOUR - 3);
    expect(slots.every((s) => s.available)).toBe(true);
  });
  it('바쁨 구간과 겹치는 시작 시각은 불가', () => {
    const busy = [{ start: kstDateTime('2026-09-10', 13), end: kstDateTime('2026-09-10', 15) }];
    const slots = buildDaySlots({ date: '2026-09-10', durationHours: 2, busy, now: past, minLeadHours: 24 });
    const at = (h: number) => slots.find((s) => s.startHour === h)!.available;
    expect(at(10)).toBe(true);   // 10–12, 접촉 아님
    expect(at(12)).toBe(false);  // 12–14 겹침
    expect(at(14)).toBe(false);  // 14–16 겹침
    expect(at(15)).toBe(true);   // 15–17
  });
  it('리드타임 이내 시작 시각은 불가', () => {
    const now = kstDateTime('2026-09-09', 20); // 다음 날 10~19시는 24h 이내
    const slots = buildDaySlots({ date: '2026-09-10', durationHours: 2, busy: noBusy, now, minLeadHours: 24 });
    expect(slots.find((s) => s.startHour === 10)!.available).toBe(false);
    expect(slots.find((s) => s.startHour === 20)!.available).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인** → **Step 3: 구현**

`lib/booking/slots.ts`:

```ts
import { kstDateTime } from './kst';
import { rangesOverlap } from './service';

export const OPEN_HOUR = 10;
export const CLOSE_HOUR = 22;

export interface DaySlot { startHour: number; available: boolean }

export const buildDaySlots = (input: {
  date: string;
  durationHours: number;
  busy: Array<{ start: Date; end: Date }>;
  now: Date;
  minLeadHours: number;
}): DaySlot[] => {
  const slots: DaySlot[] = [];
  for (let h = OPEN_HOUR; h + input.durationHours <= CLOSE_HOUR; h += 1) {
    const start = kstDateTime(input.date, h);
    const end = kstDateTime(input.date, h + input.durationHours);
    const leadOk = start.getTime() - input.now.getTime() >= input.minLeadHours * 3600 * 1000;
    const free = !input.busy.some((b) => rangesOverlap(start, end, b.start, b.end));
    slots.push({ startHour: h, available: leadOk && free });
  }
  return slots;
};
```

`pages/api/bookings/slots.ts` — GET만 허용. 순서: ① `expireStaleOrders(now)` ② 파라미터 검증(productId·hours·date — Task 4와 같은 규칙, `MAX_BOOK_DAYS` 창 밖이면 400) ③ `fetchBusyRanges(dayStart, dayEnd)`를 try/catch — 실패 시 `503 { ok:false, code:'calendar_unavailable' }` (fail-closed) ④ DB에서 그날과 겹치는 `bookings`(confirmed 전부 + 900초 이내 pending)·`availability_blocks` 조회해 busy 배열에 합침 ⑤ `buildDaySlots` 결과 반환. 응답 헤더 `Cache-Control: no-store` (가용성은 캐시하면 안 됨 — FreeBusy 60초 캐시는 인스턴스 메모리의 `fetchBusyRanges` 결과를 Map<dateKey,{at,ranges}>로 감싸는 모듈 로컬 변수로 이 API 안에서만 구현).

- [ ] **Step 4: PASS 확인** — `npx jest lib/booking/slots.test.ts && npm run type-check`
- [ ] **Step 5: 커밋** — `git commit -m "feat(booking): 가용 슬롯 계산과 FreeBusy fail-closed 슬롯 API"`

---

### Task 12: 취소·환불 흐름 (셀프 + 관리자 공용)

**Files:**
- Create: `lib/booking/cancel.ts`, `pages/api/bookings/cancel.ts`
- Test: `lib/booking/cancel.test.ts`

**Interfaces:**
- Consumes: Task 3 `computeRefund`, Task 5 `findOrderByOrderNo`, Task 6 `cancelPayment`, Task 7 `deleteBookingEvent`, Task 8 `sendBookingCancelledEmails`, Task 4 `isTokenMatch`
- Produces:
  - `cancelBookingWithRefund(input: { orderNo: string; requestedBy: 'customer' | 'admin'; reason: string; overrideAmount?: number; now: Date }): Promise<{ ok: true; refundAmount: number } | { ok: false; code: 'not_found' | 'invalid_state' | 'toss_failed'; message: string }>`
  - `POST /api/bookings/cancel` body `{ orderNo, token }` — 토큰 검증 후 `requestedBy:'customer'`로 호출. `200 { ok: true, refundAmount }`

동작 순서:

1. 주문+예약 로드. `orders.status`가 `paid`/`partially_refunded`가 아니거나 booking이 `confirmed`가 아니면 `invalid_state`
2. 환불액: `overrideAmount`(관리자) 또는 `computeRefund(order.totalAmount, booking.startAt, now).refundAmount`(고객 — 이용 시작 후에는 셀프 취소 자체를 `invalid_state`로 거부)
3. 환불액 > 0이면 `cancelPayment({ paymentKey, cancelReason, cancelAmount })`. 실패 시 `refunds`에 `status:'failed'` 기록 후 `toss_failed` 반환 (관리자가 재시도)
4. `db.batch`: ① `refunds` INSERT(done) ② `bookings` → cancelled (`WHERE status='confirmed'` 가드) ③ `orders` → 환불액 == totalAmount ? `refunded` : (환불액 > 0 ? `partially_refunded` : 그대로 `paid`)
5. 후처리: `deleteBookingEvent(gcalEventId)` 실패는 `gcalError` 기록, `sendBookingCancelledEmails` 실패는 `notificationError` 기록

- [ ] **Step 1: 실패하는 테스트** — Task 9와 같은 mock 구성으로 ① confirmed 아닌 예약 거부 ② 당일 취소는 토스 호출 없이 환불 0원으로 성공 ③ 3일 전 취소는 전액 `cancelPayment` 호출 ④ 토스 실패 시 `toss_failed` — 4케이스 작성

- [ ] **Step 2: 실패 확인** — `npx jest lib/booking/cancel.test.ts` → FAIL

- [ ] **Step 3: 구현** (`lib/booking/cancel.ts`)

```ts
import { and, eq } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { bookings, orders, refunds } from '../../db/schema';
import { sendBookingCancelledEmails } from './email';
import { deleteBookingEvent } from './gcal';
import { computeRefund } from './refund-policy';
import { findOrderByOrderNo } from './service';
import { cancelPayment } from './toss';

export type CancelOutcome =
  | { ok: true; refundAmount: number }
  | { ok: false; code: 'not_found' | 'invalid_state' | 'toss_failed'; message: string };

export const cancelBookingWithRefund = async (input: {
  orderNo: string;
  requestedBy: 'customer' | 'admin';
  reason: string;
  overrideAmount?: number;
  now: Date;
}): Promise<CancelOutcome> => {
  const order = await findOrderByOrderNo(input.orderNo);
  if (!order) return { ok: false, code: 'not_found', message: '주문을 찾을 수 없습니다.' };

  const booking = order.bookings[0];
  const payment = order.payments[0];
  const cancellable = (order.status === 'paid' || order.status === 'partially_refunded') && booking?.status === 'confirmed';
  if (!cancellable || !payment)
    return { ok: false, code: 'invalid_state', message: '취소할 수 있는 상태가 아닙니다.' };

  // 고객 셀프 취소는 이용 시작 전에만 — 시작 후 처리는 관리자의 몫(노쇼/완료/임의 환불).
  if (input.requestedBy === 'customer' && booking.startAt.getTime() <= input.now.getTime())
    return { ok: false, code: 'invalid_state', message: '이용 시작 후에는 온라인 취소가 불가합니다.' };

  const refundAmount = input.requestedBy === 'admin' && typeof input.overrideAmount === 'number'
    ? input.overrideAmount
    : computeRefund(order.totalAmount, booking.startAt, input.now).refundAmount;

  const db = getDb();
  let tossTransactionKey: string | null = null;

  if (refundAmount > 0) {
    const toss = await cancelPayment({
      paymentKey: payment.paymentKey,
      cancelReason: input.reason,
      cancelAmount: refundAmount,
    });
    if (!toss.ok) {
      // 실패도 이력이다 — 관리자가 재시도할 근거를 남긴다.
      await db.insert(refunds).values({
        paymentId: payment.id, amount: refundAmount, reason: input.reason,
        requestedBy: input.requestedBy, status: 'failed',
      });
      return { ok: false, code: 'toss_failed', message: toss.message };
    }
    tossTransactionKey = toss.payment.cancels?.[toss.payment.cancels.length - 1]?.transactionKey ?? null;
  }

  const nextOrderStatus = refundAmount >= order.totalAmount ? 'refunded'
    : refundAmount > 0 ? 'partially_refunded' : order.status;

  await db.batch([
    db.insert(refunds).values({
      paymentId: payment.id, amount: refundAmount, reason: input.reason,
      requestedBy: input.requestedBy, tossTransactionKey, status: 'done',
    }),
    db.update(bookings)
      .set({ status: 'cancelled', cancelledAt: input.now, updatedAt: input.now })
      .where(and(eq(bookings.id, booking.id), eq(bookings.status, 'confirmed'))),
    db.update(orders)
      .set({ status: nextOrderStatus, updatedAt: input.now })
      .where(eq(orders.id, order.id)),
  ]);

  // 후처리 — 환불은 끝났으므로 실패를 삼키되 기록 (confirm.ts와 동일 원칙).
  if (booking.gcalEventId) {
    try {
      await deleteBookingEvent(booking.gcalEventId);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      await db.update(bookings).set({ gcalError: `delete: ${detail}` }).where(eq(bookings.id, booking.id));
    }
  }
  const notifyError = await sendBookingCancelledEmails(order, booking, refundAmount);
  await db.update(orders).set({ notificationError: notifyError }).where(eq(orders.id, order.id));

  return { ok: true, refundAmount };
};
```

- [ ] **Step 4: PASS 확인** — `npx jest lib/booking/cancel.test.ts`
- [ ] **Step 5: 취소 API** (`pages/api/bookings/cancel.ts`) — POST만, rate limit(`booking_cancel:ip:` 10회/시간), `findOrderByOrderNo` 후 `isTokenMatch(order.manageToken, token)` 실패면 404(토큰 존재 여부를 구분해 주지 않는다), 성공 시 `cancelBookingWithRefund` 호출
- [ ] **Step 6: 커밋** — `git commit -m "feat(booking): 기한별 차등 환불 취소 흐름 (셀프·관리자 공용)"`

---

### Task 13: 웹훅

**Files:**
- Create: `pages/api/payments/webhook.ts`, `lib/booking/webhook.ts`
- Test: `lib/booking/webhook.test.ts`

**Interfaces:**
- Consumes: Task 6 `fetchPayment`, Task 9 `confirmBookingPayment`, Task 12 `cancelBookingWithRefund`, Task 1 `webhookEvents`
- Produces:
  - `processTossWebhook(payload: unknown): Promise<{ status: number }>` — 라우트는 이 함수 결과의 status만 반환
  - `POST /api/payments/webhook` (토스 개발자센터에 등록할 URL)

처리 규칙 (스펙 §5 — 페이로드 불신·재조회·멱등):

1. 페이로드에서 `data.paymentKey`·`data.status`만 취한다(형식이 어긋나면 200으로 무시 — 재시도해도 소용없는 요청)
2. `eventKey = "${paymentKey}:${status}"`를 `webhookEvents`에 INSERT — unique 위반이면 이미 처리한 이벤트 → 200
3. `fetchPayment(paymentKey)`로 **토스에서 재조회** — 네트워크 실패는 500 (토스가 재시도하도록)
4. 재조회한 `payment.status`가:
   - `DONE` → 주문이 pending이면 `confirmBookingPayment({ orderNo: payment.orderId, paymentKey, amount: payment.totalAmount })` (승인 경로가 죽었을 때의 복구)
   - `CANCELED`·`PARTIAL_CANCELED` → booking이 아직 confirmed면 `cancelBookingWithRefund(requestedBy:'webhook'...)` 대신 **DB 상태만 동기화** (돈은 이미 토스 콘솔 등 외부에서 취소된 것 — 다시 취소 API를 부르면 안 된다): `refunds` INSERT(requestedBy:'webhook') + 상태 전이만 수행하는 `syncCancelledFromToss(payment)` 헬퍼를 `lib/booking/webhook.ts`에 구현
   - 그 외 상태 → 200 무시
5. 주문을 못 찾으면 200 (영구 실패 — 재시도 무의미)

- [ ] **Step 1: 실패하는 테스트** — mock으로 ① 같은 eventKey 2회 → fetchPayment 1회만 호출 ② 형식 불량 payload → 200 & 토스 미호출 ③ DONE + pending 주문 → confirmBookingPayment 호출 — 3케이스

- [ ] **Step 2: 실패 확인** — `npx jest lib/booking/webhook.test.ts` → FAIL

- [ ] **Step 3: 구현** (`lib/booking/webhook.ts`)

```ts
import { and, eq } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { bookings, orders, refunds, webhookEvents } from '../../db/schema';
import { confirmBookingPayment } from './confirm';
import { findOrderByOrderNo } from './service';
import { fetchPayment, type TossPayment } from './toss';

/** 외부(토스 콘솔 등)에서 이미 취소된 결제를 DB에 반영만 한다 — 취소 API를 다시 부르지 않는다. */
const syncCancelledFromToss = async (payment: TossPayment): Promise<void> => {
  const order = await findOrderByOrderNo(payment.orderId);
  if (!order) return;
  const booking = order.bookings[0];
  if (!booking || booking.status !== 'confirmed') return; // 이미 반영됨

  const db = getDb();
  const paymentRow = order.payments.find((p) => p.paymentKey === payment.paymentKey);
  const cancelled = payment.cancels?.reduce((sum, c) => sum + c.cancelAmount, 0) ?? 0;
  const now = new Date();
  await db.batch([
    db.insert(refunds).values({
      paymentId: paymentRow?.id ?? order.payments[0].id,
      amount: cancelled, reason: '토스 외부 취소 동기화', requestedBy: 'webhook',
      tossTransactionKey: payment.cancels?.[payment.cancels.length - 1]?.transactionKey ?? null,
      status: 'done',
    }),
    db.update(bookings)
      .set({ status: 'cancelled', cancelledAt: now, updatedAt: now })
      .where(and(eq(bookings.id, booking.id), eq(bookings.status, 'confirmed'))),
    db.update(orders)
      .set({ status: cancelled >= order.totalAmount ? 'refunded' : 'partially_refunded', updatedAt: now })
      .where(eq(orders.id, order.id)),
  ]);
};

export const processTossWebhook = async (payload: unknown): Promise<{ status: number }> => {
  const body = payload as { data?: { paymentKey?: unknown; status?: unknown } } | null;
  const paymentKey = body?.data?.paymentKey;
  const status = body?.data?.status;
  // 형식이 어긋난 요청은 재시도해도 소용없다 — 200으로 종료.
  if (typeof paymentKey !== 'string' || typeof status !== 'string') return { status: 200 };

  // 처리보다 기록을 먼저 — PK 충돌이 "이미 처리했다"는 신호다.
  const db = getDb();
  try {
    await db.insert(webhookEvents).values({ eventKey: `${paymentKey}:${status}`, payload: JSON.stringify(payload) });
  } catch {
    return { status: 200 }; // 중복 이벤트
  }

  // 페이로드는 신뢰하지 않는다 — 토스에 재조회한 상태만 쓴다 (스펙 §5).
  const result = await fetchPayment(paymentKey);
  if (!result.ok) return { status: 500 }; // 일시 실패 — 토스가 재시도하게 한다

  const payment = result.payment;
  if (payment.status === 'DONE') {
    // 승인 경로(success SSR)가 죽었을 때의 복구 — 금액은 토스 재조회값으로 검증된다.
    await confirmBookingPayment({ orderNo: payment.orderId, paymentKey, amount: payment.totalAmount });
  } else if (payment.status === 'CANCELED' || payment.status === 'PARTIAL_CANCELED') {
    await syncCancelledFromToss(payment);
  }
  return { status: 200 };
};
```

`pages/api/payments/webhook.ts`:

```ts
import type { NextApiRequest, NextApiResponse } from 'next';

import { processTossWebhook } from '../../../lib/booking/webhook';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const { status } = await processTossWebhook(req.body);
  return res.status(status).json({ ok: status === 200 });
}
```

- [ ] **Step 4: PASS 확인** — `npx jest lib/booking/webhook.test.ts`
- [ ] **Step 5: 커밋** — `git commit -m "feat(booking): 토스 웹훅 — 재조회 기반 상태 동기화와 멱등 처리"`

---

### Task 14: 예약 위저드 UI

**Files:**
- Create: `pages/[locale]/booking/[service].tsx`, `components/booking/BookingWizard.tsx`, `components/booking/TossPaymentWidget.tsx`, `components/booking/PriceBreakdown.tsx`
- Modify: `package.json` (`@tosspayments/tosspayments-sdk` 추가)

**Interfaces:**
- Consumes: Task 2 `productsForService`·`SessionProduct`, Task 3 `REFUND_POLICY_LINES`, `computeAmounts`, `GET /api/bookings/slots`, `POST /api/bookings`
- Produces: `/ko/booking/recording|voice-acting|wedding-song|cover-video` 4 라우트

- [ ] **Step 1: SDK 설치** — Run: `npm install @tosspayments/tosspayments-sdk` (캐럿 기본값 그대로 — 고정 정책은 next/react 3종에만 적용)

- [ ] **Step 2: 페이지 셸** (`pages/[locale]/booking/[service].tsx`)

```tsx
import type { GetServerSideProps } from 'next';
import Head from 'next/head';

import BookingWizard from '../../../components/booking/BookingWizard';
import { productsForService, type SessionProduct } from '../../../lib/booking/products';

interface BookingPageProps { service: string; products: SessionProduct[] }

export default function BookingPage({ service, products }: BookingPageProps) {
  return (
    <>
      <Head>
        <title>{`온라인 예약 — ${products[0].nameKo.split(' ')[0]} | 스튜디오 놀`}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <BookingWizard service={service} products={products} />
    </>
  );
}

export const getServerSideProps: GetServerSideProps<BookingPageProps> = async ({ params }) => {
  if (params?.locale !== 'ko') return { redirect: { destination: '/ko', permanent: false } };
  const service = typeof params?.service === 'string' ? params.service : '';
  const products = productsForService(service);
  if (products.length === 0) return { notFound: true };
  return { props: { service, products } };
};
```

- [ ] **Step 3: BookingWizard** (`components/booking/BookingWizard.tsx`) — 클라이언트 상태 머신 하나로 4단계:

  1. **상품/시간**: `products`가 복수(recording)면 라디오 선택, hourly면 시간 수 셀렉트(min~max). `computeAmounts`로 `PriceBreakdown`(상품가 + VAT = 합계, `formatPriceAmount` 사용) 즉시 표시
  2. **날짜/슬롯**: 날짜 input(min=내일, max=+60일) → 선택 시 `/api/bookings/slots?productId=&hours=&date=` fetch → 시간 버튼 그리드(`available: false`는 disabled). 503(`calendar_unavailable`) 응답이면 "일시적으로 예약 현황을 불러올 수 없습니다" 안내
  3. **정보 입력**: 이름·휴대폰·이메일·요청사항 + `REFUND_POLICY_LINES` 목록을 보여주고 동의 체크박스. 제출 → `POST /api/bookings` → 409면 슬롯 단계로 되돌리고 재조회
  4. **결제**: 응답의 `orderNo`·`totalAmount`로 `TossPaymentWidget` 렌더

  스타일은 기존 폼 관례(contact.tsx의 input 클래스)와 `Button` 컴포넌트 재사용. **카카오 옐로 금지** — 진행 버튼은 `bg-primary` 계열.

- [ ] **Step 4: TossPaymentWidget** (`components/booking/TossPaymentWidget.tsx`)

```tsx
import { useEffect, useRef, useState } from 'react';
import { loadTossPayments, ANONYMOUS } from '@tosspayments/tosspayments-sdk';

import { Button } from '../ui/Button';

interface Props {
  orderNo: string;
  amount: number;
  orderName: string; // 예: '보컬 녹음 1프로 (9/10 14:00)'
  customerName: string;
  customerEmail: string;
}

export default function TossPaymentWidget({ orderNo, amount, orderName, customerName, customerEmail }: Props) {
  const widgetsRef = useRef<Awaited<ReturnType<Awaited<ReturnType<typeof loadTossPayments>>['widgets']>> | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
        if (!clientKey) throw new Error('결제 설정이 없습니다.');
        const toss = await loadTossPayments(clientKey);
        const widgets = toss.widgets({ customerKey: ANONYMOUS });
        await widgets.setAmount({ currency: 'KRW', value: amount });
        await Promise.all([
          widgets.renderPaymentMethods({ selector: '#toss-payment-methods' }),
          widgets.renderAgreement({ selector: '#toss-agreement' }),
        ]);
        if (!cancelled) { widgetsRef.current = widgets; setReady(true); }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '결제 모듈을 불러오지 못했습니다.');
      }
    })();
    return () => { cancelled = true; };
  }, [amount]);

  const pay = async () => {
    const origin = window.location.origin;
    try {
      await widgetsRef.current?.requestPayment({
        orderId: orderNo,
        orderName,
        customerName,
        customerEmail,
        successUrl: `${origin}/ko/booking/success`,
        failUrl: `${origin}/ko/booking/fail`,
      });
    } catch {
      /* 사용자가 결제창을 닫은 경우 — 위젯이 자체 안내 */
    }
  };

  if (error) return <p className="text-red-600">{error}</p>;
  return (
    <div>
      <div id="toss-payment-methods" />
      <div id="toss-agreement" />
      <Button onClick={pay} disabled={!ready} fullWidth>결제하기</Button>
    </div>
  );
}
```

- [ ] **Step 5: 검증** — `npm run type-check && npm run lint && npm run build`. 이어 `npm run dev`로 `/ko/booking/recording` 열어 4단계 진행 + 토스 **테스트 클라이언트 키**로 결제창까지 뜨는지 수동 확인 (승인은 테스트 시크릿 키 설정 시 실제로 동작)
- [ ] **Step 6: 커밋** — `git commit -m "feat(booking): 4단계 예약 위저드와 토스 결제위젯"`

---

### Task 15: 예약 관리 페이지 (고객 셀프서비스)

**Files:**
- Create: `pages/[locale]/booking/manage/[orderNo].tsx`

**Interfaces:**
- Consumes: Task 5 `findOrderByOrderNo`, Task 4 `isTokenMatch`, Task 3 `computeRefund`, `POST /api/bookings/cancel`
- Produces: `/ko/booking/manage/[orderNo]?token=...`

- [ ] **Step 1: 구현** — SSR: 쿼리 token 없거나 `isTokenMatch` 실패 → `notFound: true` (토큰 유무를 구분해 알려주지 않는다). 성공 시 예약 요약(일시·상품·금액 분해·상태)과, booking이 confirmed이고 startAt이 미래면 `computeRefund(..., new Date())` 결과로 "지금 취소하면 N원 환불 (규정: 3일 전 100% · 1~2일 전 50% · 당일 0%)" 안내 + 취소 버튼(확인 다이얼로그 → `POST /api/bookings/cancel { orderNo, token }` → 성공 시 취소 완료 화면으로 리로드). noindex + `Cache-Control: no-store` (contracts `denyContractPageCaching` 참고)
- [ ] **Step 2: 검증·커밋** — `npm run type-check` → `git commit -m "feat(booking): 토큰 링크 예약 확인·셀프 취소 페이지"`

---

### Task 16: 관리자 — 예약 목록·상세·수동 블록·임의 환불

**Files:**
- Create: `pages/admin/bookings/index.tsx`, `pages/admin/bookings/[id].tsx`
- Create: `pages/api/admin/bookings/index.ts`, `pages/api/admin/bookings/[id].ts`, `pages/api/admin/blocks/index.ts`, `pages/api/admin/blocks/[id].ts`
- Modify: `pages/admin/index.tsx` (예약 탭 링크 추가)

**Interfaces:**
- Consumes: `lib/contracts/admin-auth.ts`의 `authenticateAdminApi`, `lib/contracts/admin-session.ts`의 `getAdminSessionFromContext`(contracts 관리자 페이지의 SSR 가드 패턴을 열어 그대로 따른다), Task 5 `expireStaleOrders`, Task 12 `cancelBookingWithRefund`
- Produces:
  - `GET /api/admin/bookings` → 최근 200건 (orders join bookings, 최신순) — 응답 전에 `expireStaleOrders` lazy 호출 (contracts index.ts의 `expireOverdueContracts` 자리와 동일)
  - `PATCH /api/admin/bookings/[id]` body `{ status: 'completed' | 'no_show' }` — confirmed에서만 전이 허용
  - `POST /api/admin/bookings/[id]` body `{ action: 'refund', amount, reason }` → `cancelBookingWithRefund({ requestedBy: 'admin', overrideAmount: amount, ... })`
  - `POST /api/admin/bookings/[id]` body `{ action: 'resend-notification' }` → 주문 상태에 따라 `sendBookingConfirmedEmails`/`sendBookingCancelledEmails` 재실행 후 `notificationError` 갱신 (스펙 §9 — 발송 실패 재발송)
  - `GET/POST /api/admin/blocks`, `DELETE /api/admin/blocks/[id]` — 수동 예약 불가 블록 CRUD (start/end는 date+hour 입력을 `kstDateTime`으로 변환)

- [ ] **Step 1: API 4개 구현** — 전부 `authenticateAdminApi` 가드 + `Cache-Control: no-store`. contracts의 `pages/api/contracts/index.ts` 구조(메서드 분기·직렬화)를 그대로 따른다. 예약 직렬화에는 `manageToken`을 **포함하지 않는다**(관리자 화면에 고객 인증 토큰이 보일 이유가 없다)
- [ ] **Step 2: 목록 페이지** — `pages/admin/contracts/index.tsx`의 SSR 인증 가드·테이블 마크업 관례를 따라 예약 목록(일시·고객·상품·금액·상태)과 수동 블록 목록+등록 폼을 한 화면에. 상세 페이지는 상태 변경 버튼(완료/노쇼)·임의 환불 폼(금액·사유)·gcalError/notificationError 표시(미정합 주문 발견 용도)
- [ ] **Step 3: 검증·커밋** — `npm run type-check && npm run lint` → `git commit -m "feat(booking): 관리자 예약 목록·상세·수동 블록·임의 환불"`

---

### Task 17: 약관·환불규정 페이지 + noindex 배선 + 푸터 표기

**Files:**
- Create: `pages/[locale]/terms.tsx`
- Modify: `next-sitemap.config.js` (exclude + robots disallow), `components/layout/Footer.tsx`, `data/siteConfig.ts`

- [ ] **Step 1: terms 페이지** — 정적 콘텐츠: 서비스 이용약관 요지(예약·이용·취소), 환불규정(`REFUND_POLICY_LINES`를 import해 렌더 — 규정 문구의 SSOT는 refund-policy.ts 한 곳), 사업자 정보. ko 외 로케일은 ko로 redirect. noindex
- [ ] **Step 2: 사이트맵·robots** — `next-sitemap.config.js`의 `exclude`에 `'/*/booking/*'`·`'/*/terms'` 추가, robots `disallow`에 `'/ko/booking/'` 추가 (기존 `/ko/contracts/` 항목 옆)
- [ ] **Step 3: 푸터** — `data/siteConfig.ts`에 `mailOrderSalesNumber`(통신판매업 신고번호) 필드 추가, `Footer.tsx`의 사업자 정보 블록에 표기 + `/ko/terms` 링크. **신고번호를 아직 못 받았으면 이 스텝만 보류하고 나머지는 진행** (빈 값이면 렌더하지 않는 조건부)
- [ ] **Step 4: 검증·커밋** — `npm run build` (postbuild가 sitemap 재생성 — `public/sitemap*.xml`에 booking URL이 없는지 grep으로 확인) → `git commit -m "feat(booking): 약관·환불규정 페이지와 noindex/사이트맵 제외 배선"`

---

### Task 18: 서비스 페이지 예약 진입 CTA (ko 전용)

**Files:**
- Create: `components/booking/BookingEntryButton.tsx`
- Modify: `pages/[locale]/recording.tsx`, `pages/[locale]/voice-acting.tsx`, `pages/[locale]/wedding-song.tsx`, `pages/[locale]/cover-video.tsx` (각 가격/CTA 섹션)

- [ ] **Step 1: 버튼 컴포넌트** — `locale !== 'ko'`면 null 반환. `bg-primary` 계열(기존 Button solid variant), 문구 "온라인 예약", href `/ko/booking/${service}`. **옐로 금지·카카오 CTA 병행 원칙**: 각 페이지의 기존 카카오/섹션 CTA 옆에 2차 버튼으로 추가하고 기존 CTA는 위치·색·문구 무변경. 히어로에는 넣지 않는다(스펙 §8 — 3버튼 위계 붕괴 방지)
- [ ] **Step 2: 4개 페이지 배선** — 각 페이지의 가격 또는 CTA 섹션에서 카카오 CTA를 렌더하는 지점을 찾아 바로 옆에 `<BookingEntryButton service="recording" locale={locale} />` 형태로 삽입
- [ ] **Step 3: 검증·커밋** — `npm run type-check && npm run build`, dev에서 ko/en 각각 열어 en에는 버튼이 없는 것 확인 → `git commit -m "feat(booking): 서비스 4페이지에 온라인 예약 진입 CTA (ko 전용)"`

---

### Task 19: 통합 검증 + 수동 E2E 체크리스트

- [ ] **Step 1: 전체 게이트** — Run: `npm run type-check && npm run lint && npm test && npm run build` 전부 통과. 의존성 정책에 따라 `npx jest middleware.test.ts`도 명시적으로 확인
- [ ] **Step 2: 토스 테스트 키 E2E** (dev 서버 + 테스트 키):
  1. `/ko/booking/recording` → 1프로 → 슬롯 → 정보 입력 → 테스트 카드 결제 → success에서 "예약 확정" + 관리자 목록에 confirmed + 구글 캘린더에 이벤트 + 확정 메일 2통
  2. 같은 슬롯 재예약 시도 → 슬롯 비활성 확인, API 직접 호출 시 409
  3. 관리 링크에서 셀프 취소(3일 전 슬롯) → 전액 환불 표시 → 토스 개발자센터에서 취소 확인 + 캘린더 이벤트 삭제 + 취소 메일
  4. 결제창에서 이탈 → 15분 후(로컬에선 `PENDING_HOLD_SECONDS` 임시 축소로 확인) 슬롯 재오픈
  5. 웹훅: 토스 개발자센터 웹훅 URL 등록(로컬은 터널) 후 테스트 발송 → `webhook_events`에 기록·중복 발송 시 1회만 처리
  6. 잘못된 금액으로 `/ko/booking/success?paymentKey=...&orderId=...&amount=1` 직접 접근 → "확정 실패" + 토스 미승인
- [ ] **Step 3: 배포 준비** — Vercel 환경변수 5종 등록(테스트 키), 배포 후 프로덕션 사이트맵에 booking URL 부재 확인. **라이브 키 전환은 실결제 1건 검증 후** (사용자가 결정)
- [ ] **Step 4: 커밋·마무리** — 잔여 변경 커밋, 스펙 문서에 "Phase 1 구현 완료" 상태 갱신
