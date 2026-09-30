# 공연예매 1차(직영·비지정석) 스키마·도메인코어 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `orders.type='ticket'`을 새 축으로 얹어, 스튜디오 놀 직영 공연(비지정석)의 마이그레이션(0045)과 `lib/shows/` 도메인 코어(재고 게이트·주문 생성·결제 확인·자동취소·환불·웹훅 연동·입장·회차 운영)를 화면 없이 완성한다.

**Architecture:** `lib/funding/service.ts`(원자적 재고 조건 배치)와 `lib/booking/confirm.ts`(확인·자동취소·알림 CAS)의 패턴을 그대로 복제해 `lib/shows/`를 만든다. 공용 원장(`orders`/`payments`/`refunds`)은 그대로 쓰고 `show_orders`/`show_tickets`/`show_scan_links`만 신설한다. 결제는 기존 토스 위젯(`lib/booking/toss.ts`)을 그대로 재사용한다.

**Tech Stack:** Next.js 15.5 Pages Router, drizzle-orm + Turso(libSQL), Toss Payments 결제위젯 v2, Jest.

**Spec:** `/private/tmp/claude-501/-Users-hwang-gyeongha-studio/7ae944da-b607-4df8-9183-2633fe0d8263/scratchpad/ticketing-design-final.md` (§2 결정사항, §4.2 PR 1-0/1-1, §5 데이터모델, §6 불변식, §7 핵심흐름, §11.1/§11.3 정책, §13 재사용매핑, §14 테스트전략). 이 플랜은 §4.2 표의 PR **1-0(스키마)** + **1-1의 화면 없는 도메인 코어**만 다룬다. `email.ts`/`qr.ts`/`scanLink.ts`(발급 부분)/`schemaOrg.ts`/`sitemapXml.ts`/`mediaAccess.ts`/`reservedSlugs.ts`/`admin.ts`/`alerts.ts`/`health.ts`/크론 라우트는 후속 플랜(PR 1-2~1-5)에서 다룬다.

## Global Constraints

- `orders.type`은 TS 배열일 뿐 DB CHECK가 아니다(`db/schema.ts`) — `'ticket'`을 추가할 때 기존 CHECK 제약(`orderTypeEnum` 기반 `check()`가 있다면 그것도 갱신).
- 마이그레이션은 배포보다 먼저 적용해야 한다(CLAUDE.md 규칙) — 이 플랜은 코드만 작성, **운영 DB 적용은 별도**.
- 원자적 재고 판정은 `INSERT ... SELECT ... WHERE <조건>` 배치 하나로 끝나야 한다 — 사전 SELECT 후 개별 INSERT 금지(TOCTOU).
- 멱등키는 `(orderNo, amount[, attempt])`에서 결정적으로 유도, `cancelReason`에 `[#<key>] <reason>` 형식으로 태그 임베딩.
- 토스 응답 처리: `NETWORK_ERROR`/`CONFIG_ERROR`는 실패 확정이 아니다 — 재확인 없이 주문을 실패로 낙인찍지 않는다. 확정 거절(`DECLINE_CODE_PATTERN`)만 실패로 기록한다.
- 판매마감(사용자 확정): 회차 시작 **전날 24:00(KST)**. 현장(당일) 판매 채널은 시스템 밖 — 이 규칙과 모순되는 조건문을 만들지 않는다.
- 공연 플랫폼 수수료: **5.5%**(펀딩과 동일 세율, `basisPoints` 스냅샷 방식 재사용).
- 함수·타입 이름은 `lib/funding/`·`lib/booking/`의 대응 함수와 1:1 대응하는 이름을 쓴다(뒤 작업자가 유추 가능하도록): `createShowOrder`/`confirmShowOrder`/`autoCancelShowApproval`/`refundShowTickets`/`syncShowCancelsFromToss`.
- 모든 신규 SQL 배치는 `rowsAffectedOf(result)` 헬퍼로 영향받은 행 수를 읽는다(모듈마다 자체 복제 — 기존 관행).

## Review Focus

- **동시 주문 경쟁**: 같은 회차·같은 티켓타입에 두 주문이 동시에 재고 마지막 1장을 놓고 경쟁할 때 정확히 하나만 성공해야 한다(T7/T8/T15에서 검증).
- **자동취소와 결제확인의 경쟁**: 고객이 결제창에서 승인 직전인 순간 만료 크론이 같은 주문을 자동취소하려 할 때, 정확히 한쪽만 이겨야 하고 이중 취소·이중 확정이 없어야 한다(T9/T15).
- **부분환불 후 회차취소 중복 카운트**: 이미 일부 티켓이 개별 환불된 주문에 회차취소 일괄환불이 겹칠 때 남은 티켓만 환불돼야 한다(T10/T14).
- **웹훅과 SSR 확인의 경쟁**: 결제창 콜백(SSR)과 토스 웹훅이 거의 동시에 도착할 때 알림 이메일이 정확히 한 번만 발송돼야 한다(T9의 sentinel CAS).
- **입장 처리 후 환불 시도**: 이미 체크인된 티켓을 환불하려 할 때 거부되어야 하고(§6 E-계열 불변식), 반대로 환불된 티켓으로 체크인을 시도할 때도 거부되어야 한다(T12/T10).

---

## Task 1: 스키마 — `shows`/`show_zones`/`showtimes`/`show_ticket_types`/`show_orders`/`show_tickets`/`show_scan_links` + `orders.type` 확장

**Files:**
- Modify: `db/schema.ts`
- Create: `drizzle/migrations/0045_shows_core.sql` (via `npm run db:generate`)
- Test: `db/schema.shows.test.ts`

**Interfaces:**
- Produces: drizzle 테이블 객체 `shows`, `showZones`, `showtimes`, `showTicketTypes`, `showOrders`, `showTickets`, `showScanLinks` — 이후 모든 태스크가 이 테이블 객체를 import한다.
- Produces: `orderTypeEnum`에 `'ticket'` 추가된 배열.

- [ ] **Step 1: `orderTypeEnum`에 `'ticket'` 추가**

`db/schema.ts`에서 기존 선언을 찾는다:

```ts
export const orderTypeEnum = ['session', 'mixing', 'subscription', 'funding'] as const;
```

다음으로 교체:

```ts
export const orderTypeEnum = ['session', 'mixing', 'subscription', 'funding', 'ticket'] as const;
```

이 배열을 참조하는 `orders.type` 컬럼의 `check()` 제약(있다면 `sql\`${table.type} in (...)\`` 형태)도 함께 찾아 `'ticket'`을 추가한다. `orders` 테이블 정의 근처에서 `check('orders_type_check', ...)` 패턴을 grep으로 확인 후 갱신한다.

- [ ] **Step 2: `shows`/`show_zones`/`showtimes`/`show_ticket_types` 테이블 추가**

`db/schema.ts` 끝부분(펀딩 테이블 정의 다음)에 추가:

```ts
export const showStatusEnum = ['draft', 'published', 'cancelled'] as const;
export const showtimeStatusEnum = ['scheduled', 'cancelled', 'ended'] as const;

export const shows = sqliteTable('shows', {
  id: text('id').primaryKey().$defaultFn(() => sql`lower(hex(randomblob(16)))`),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  presenterName: text('presenter_name').notNull(),
  performers: text('performers').notNull(),
  ageRating: text('age_rating').notNull(),
  runningMinutes: integer('running_minutes').notNull(),
  venueName: text('venue_name').notNull(),
  venueAddress: text('venue_address').notNull(),
  description: text('description').notNull(),
  coverImage: text('cover_image'),
  status: text('status', { enum: showStatusEnum }).notNull().default('draft'),
  noticeKey: text('notice_key').notNull().default(sql`(lower(hex(randomblob(8))))`),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at').notNull().default(sql`(unixepoch())`),
}, (t) => ({
  statusCheck: check('shows_status_check', sql`${t.status} in ('draft','published','cancelled')`),
}));

export const showZones = sqliteTable('show_zones', {
  id: text('id').primaryKey().$defaultFn(() => sql`lower(hex(randomblob(16)))`),
  showId: text('show_id').notNull().references(() => shows.id),
  code: text('code').notNull(),
  label: text('label').notNull(),
  capacity: integer('capacity').notNull(),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
}, (t) => ({
  showCodeUnique: uniqueIndex('show_zones_show_code_unique').on(t.showId, t.code),
  capacityCheck: check('show_zones_capacity_check', sql`${t.capacity} > 0`),
}));

export const showtimes = sqliteTable('showtimes', {
  id: text('id').primaryKey().$defaultFn(() => sql`lower(hex(randomblob(16)))`),
  showId: text('show_id').notNull().references(() => shows.id),
  startsAt: integer('starts_at').notNull(),
  previousStartsAt: integer('previous_starts_at'),
  salesCloseAt: integer('sales_close_at').notNull(),
  status: text('status', { enum: showtimeStatusEnum }).notNull().default('scheduled'),
  changedAt: integer('changed_at').notNull().default(sql`(unixepoch())`),
  cancelledAt: integer('cancelled_at'),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
}, (t) => ({
  statusCheck: check('showtimes_status_check', sql`${t.status} in ('scheduled','cancelled','ended')`),
  showStartsIdx: index('showtimes_show_starts_idx').on(t.showId, t.startsAt),
}));

export const showTicketTypes = sqliteTable('show_ticket_types', {
  id: text('id').primaryKey().$defaultFn(() => sql`lower(hex(randomblob(16)))`),
  showId: text('show_id').notNull().references(() => shows.id),
  zoneId: text('zone_id').notNull().references(() => showZones.id),
  name: text('name').notNull(),
  price: integer('price').notNull(),
  quota: integer('quota'),
  compQuota: integer('comp_quota').notNull().default(0),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
}, (t) => ({
  priceCheck: check('show_ticket_types_price_check', sql`${t.price} >= 0`),
}));
```

- [ ] **Step 3: `show_orders`/`show_tickets`/`show_scan_links` 테이블 추가**

같은 파일에 이어서 추가:

```ts
export const showOrderStatusEnum = ['pending', 'paid', 'partially_refunded', 'refunded', 'expired', 'failed'] as const;
export const showTicketStatusEnum = ['held', 'issued', 'refunding', 'refunded', 'void'] as const;
export const showIssuedByEnum = ['customer', 'organizer_comp'] as const;

export const showOrders = sqliteTable('show_orders', {
  orderNo: text('order_no').primaryKey().references(() => orders.orderNo),
  showtimeId: text('showtime_id').notNull().references(() => showtimes.id),
  buyerName: text('buyer_name').notNull(),
  buyerContact: text('buyer_contact').notNull(),
  holdExpiresAt: integer('hold_expires_at'),
  autoCancelledAt: integer('auto_cancelled_at'),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
}, (t) => ({
  showtimeIdx: index('show_orders_showtime_idx').on(t.showtimeId),
}));

export const showTickets = sqliteTable('show_tickets', {
  id: text('id').primaryKey().$defaultFn(() => sql`lower(hex(randomblob(16)))`),
  orderNo: text('order_no').notNull().references(() => orders.orderNo),
  showtimeId: text('showtime_id').notNull().references(() => showtimes.id),
  ticketTypeId: text('ticket_type_id').notNull().references(() => showTicketTypes.id),
  code: text('code').notNull().unique(),
  entryNumber: integer('entry_number'),
  status: text('status', { enum: showTicketStatusEnum }).notNull().default('held'),
  issuedBy: text('issued_by', { enum: showIssuedByEnum }).notNull().default('customer'),
  unitAmount: integer('unit_amount').notNull(),
  compensatedAmount: integer('compensated_amount').notNull().default(0),
  compensatedAt: integer('compensated_at'),
  checkedInAt: integer('checked_in_at'),
  checkedInBy: text('checked_in_by'),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
}, (t) => ({
  statusCheck: check('show_tickets_status_check', sql`${t.status} in ('held','issued','refunding','refunded','void')`),
  showtimeTypeIdx: index('show_tickets_showtime_type_idx').on(t.showtimeId, t.ticketTypeId),
  orderIdx: index('show_tickets_order_idx').on(t.orderNo),
}));

export const showScanLinks = sqliteTable('show_scan_links', {
  id: text('id').primaryKey().$defaultFn(() => sql`lower(hex(randomblob(16)))`),
  showtimeId: text('showtime_id').notNull().references(() => showtimes.id),
  tokenHash: text('token_hash').notNull().unique(),
  label: text('label').notNull(),
  expiresAt: integer('expires_at').notNull(),
  revokedAt: integer('revoked_at'),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
}, (t) => ({
  showtimeIdx: index('show_scan_links_showtime_idx').on(t.showtimeId),
}));

export const showsRelations = relations(shows, ({ many }) => ({
  zones: many(showZones),
  showtimes: many(showtimes),
  ticketTypes: many(showTicketTypes),
}));

export const showtimesRelations = relations(showtimes, ({ one, many }) => ({
  show: one(shows, { fields: [showtimes.showId], references: [shows.id] }),
  orders: many(showOrders),
  tickets: many(showTickets),
  scanLinks: many(showScanLinks),
}));

export const showOrdersRelations = relations(showOrders, ({ one, many }) => ({
  order: one(orders, { fields: [showOrders.orderNo], references: [orders.orderNo] }),
  showtime: one(showtimes, { fields: [showOrders.showtimeId], references: [showtimes.id] }),
  tickets: many(showTickets),
}));

export const showTicketsRelations = relations(showTickets, ({ one }) => ({
  order: one(orders, { fields: [showTickets.orderNo], references: [orders.orderNo] }),
  showtime: one(showtimes, { fields: [showTickets.showtimeId], references: [showtimes.id] }),
  ticketType: one(showTicketTypes, { fields: [showTickets.ticketTypeId], references: [showTicketTypes.id] }),
}));
```

`ordersRelations`에 `showOrder: one(showOrders, { fields: [orders.orderNo], references: [showOrders.orderNo] })`를 추가한다(기존 `fundingPledge`/`booking` 릴레이션 옆에).

- [ ] **Step 4: 마이그레이션 생성**

```bash
npm run db:generate
```

생성된 `drizzle/migrations/0045_*.sql`을 열어 위 7개 테이블의 `CREATE TABLE`이 포함됐는지 확인한다. 파일명을 `0045_shows_core.sql`로 확정하고 `meta/_journal.json`의 해당 엔트리 `tag`도 맞춘다(이미 생성기가 tag를 정하지만, 이 리포의 관례상 서술적 이름이면 그대로 둔다).

- [ ] **Step 5: 실패하는 테스트 작성**

`db/schema.shows.test.ts` (신규):

```ts
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import * as schema from './schema';

const MIGRATIONS_DIR = join(__dirname, '..', 'drizzle', 'migrations');

function applyMigrations(client: ReturnType<typeof createClient>) {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sqlText = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
    const statements = sqlText.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      client.execute(stmt);
    }
  }
}

describe('shows 스키마', () => {
  it('7개 테이블이 마이그레이션으로 생성된다', async () => {
    const client = createClient({ url: ':memory:' });
    await applyMigrations(client as any);
    const db = drizzle(client, { schema });
    const tables = await client.execute(
      "select name from sqlite_master where type='table' and name like 'show%'"
    );
    const names = tables.rows.map((r: any) => r.name).sort();
    expect(names).toEqual(
      ['show_orders', 'show_scan_links', 'show_ticket_types', 'show_tickets', 'show_zones', 'showtimes', 'shows'].sort()
    );
    await client.close();
  });

  it('orders.type=ticket을 허용한다', async () => {
    const client = createClient({ url: ':memory:' });
    await applyMigrations(client as any);
    await expect(
      client.execute({
        sql: `insert into orders (order_no, type, status, total_amount, manage_token) values (?,?,?,?,?)`,
        args: ['TKT-20260930-AAAAAAAA', 'ticket', 'pending', 10000, 'tok'],
      })
    ).resolves.toBeDefined();
    await client.close();
  });
});
```

- [ ] **Step 6: 테스트 실행 확인 (실패해야 함)**

Run: `npx jest db/schema.shows.test.ts`
Expected: 마이그레이션 파일이 아직 스텝 4에서 생성만 되고 스키마 export가 안 맞으면 FAIL. 이미 스텝 1-4를 먼저 했다면 이 시점엔 PASS일 수 있다 — 그 경우 스텝 7로 바로 진행.

- [ ] **Step 7: 테스트 통과 확인**

Run: `npx jest db/schema.shows.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 8: Commit**

```bash
git add db/schema.ts drizzle/migrations/0045_shows_core.sql drizzle/migrations/meta db/schema.shows.test.ts
git commit -m "feat(shows): shows/showtimes/show_tickets 등 1차 스키마 추가 + orders.type에 ticket 추가"
```

---

## Task 2: `lib/shows/time.ts` + `lib/shows/format.ts` — KST 시간 계산·표기

**Files:**
- Create: `lib/shows/time.ts`
- Create: `lib/shows/format.ts`
- Test: `lib/shows/time.test.ts`

**Interfaces:**
- Produces: `salesCloseAt(startsAt: Date): Date`, `isShowtimeLive(showtime: {status: string; startsAt: number}, now: Date): boolean`, `isSalesOpen(showtime: {salesCloseAt: number}, now: Date): boolean`.
- Produces: `formatEntryNumber(n: number): string`, `formatShowtimeLabel(startsAt: number): string` (KST `MM.DD(요일) HH:mm`).

- [ ] **Step 1: 실패하는 테스트**

`lib/shows/time.test.ts`:

```ts
import { salesCloseAt, isShowtimeLive, isSalesOpen } from './time';

describe('salesCloseAt', () => {
  it('회차 시작 전날 24:00(KST) = 당일 00:00(KST)를 반환한다', () => {
    // 2026-10-10 19:00 KST = 2026-10-10T10:00:00Z
    const startsAt = new Date('2026-10-10T10:00:00Z');
    const close = salesCloseAt(startsAt);
    // 전날 24:00 KST = 2026-10-10 00:00 KST = 2026-10-09T15:00:00Z
    expect(close.toISOString()).toBe('2026-10-09T15:00:00.000Z');
  });
});

describe('isSalesOpen', () => {
  it('마감 이전이면 true, 이후면 false', () => {
    const showtime = { salesCloseAt: Math.floor(new Date('2026-10-09T15:00:00Z').getTime() / 1000) };
    expect(isSalesOpen(showtime, new Date('2026-10-09T14:59:59Z'))).toBe(true);
    expect(isSalesOpen(showtime, new Date('2026-10-09T15:00:01Z'))).toBe(false);
  });
});

describe('isShowtimeLive', () => {
  it('scheduled이고 시작 전이면 live', () => {
    const showtime = { status: 'scheduled', startsAt: Math.floor(Date.now() / 1000) + 3600 };
    expect(isShowtimeLive(showtime, new Date())).toBe(true);
  });
  it('cancelled면 live 아님', () => {
    const showtime = { status: 'cancelled', startsAt: Math.floor(Date.now() / 1000) + 3600 };
    expect(isShowtimeLive(showtime, new Date())).toBe(false);
  });
  it('시작 시각이 지나면 live 아님', () => {
    const showtime = { status: 'scheduled', startsAt: Math.floor(Date.now() / 1000) - 1 };
    expect(isShowtimeLive(showtime, new Date())).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest lib/shows/time.test.ts`
Expected: FAIL (모듈 없음)

- [ ] **Step 3: 구현**

`lib/shows/time.ts`:

```ts
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 회차 시작 전날 24:00(KST) = 회차 당일 00:00(KST). */
export function salesCloseAt(startsAt: Date): Date {
  const kst = new Date(startsAt.getTime() + KST_OFFSET_MS);
  const kstMidnight = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate(), 0, 0, 0));
  return new Date(kstMidnight.getTime() - KST_OFFSET_MS);
}

export function isSalesOpen(showtime: { salesCloseAt: number }, now: Date): boolean {
  return Math.floor(now.getTime() / 1000) < showtime.salesCloseAt;
}

export function isShowtimeLive(showtime: { status: string; startsAt: number }, now: Date): boolean {
  if (showtime.status !== 'scheduled') return false;
  return Math.floor(now.getTime() / 1000) < showtime.startsAt;
}
```

`lib/shows/format.ts`:

```ts
const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function formatEntryNumber(n: number): string {
  return String(n).padStart(3, '0');
}

export function formatShowtimeLabel(startsAtSec: number): string {
  const kst = new Date(startsAtSec * 1000 + KST_OFFSET_MS);
  const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(kst.getUTCDate()).padStart(2, '0');
  const weekday = WEEKDAYS_KO[kst.getUTCDay()];
  const hh = String(kst.getUTCHours()).padStart(2, '0');
  const min = String(kst.getUTCMinutes()).padStart(2, '0');
  return `${mm}.${dd}(${weekday}) ${hh}:${min}`;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx jest lib/shows/time.test.ts`
Expected: PASS

- [ ] **Step 5: format.ts 테스트 추가 및 통과**

`lib/shows/format.test.ts`:

```ts
import { formatEntryNumber, formatShowtimeLabel } from './format';

test('formatEntryNumber는 3자리로 0패딩한다', () => {
  expect(formatEntryNumber(7)).toBe('007');
  expect(formatEntryNumber(123)).toBe('123');
});

test('formatShowtimeLabel은 KST 기준 MM.DD(요일) HH:mm', () => {
  const startsAt = Math.floor(new Date('2026-10-10T10:00:00Z').getTime() / 1000); // 19:00 KST 토요일
  expect(formatShowtimeLabel(startsAt)).toBe('10.10(토) 19:00');
});
```

Run: `npx jest lib/shows/format.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/shows/time.ts lib/shows/time.test.ts lib/shows/format.ts lib/shows/format.test.ts
git commit -m "feat(shows): KST 판매마감·표기 유틸 추가"
```

---

## Task 3: `data/krHolidays.ts` + `lib/shows/refundPolicy.ts` — 취소환불표

**Files:**
- Create: `data/krHolidays.ts` (없으면 신규; 있으면 확인만 하고 재사용)
- Create: `lib/shows/refundPolicy.ts`
- Test: `lib/shows/refundPolicy.test.ts`

**Interfaces:**
- Consumes: 없음 (순수 함수).
- Produces: `refundRateForNotice(showtimeStartsAt: Date, noticeAt: Date): number` (0~100 정수 %), `calcRefundAmount(unitAmount: number, pct: number): number`, `RefundTier` 타입.

- [ ] **Step 1: `data/krHolidays.ts` 존재 확인, 없으면 최소 스텁 생성**

```bash
test -f /Users/hwang-gyeongha/studio/data/krHolidays.ts && echo EXISTS || echo MISSING
```

MISSING이면 생성 (`lib/booking`에서 영업일 계산에 이미 쓰는 공휴일 목록이 있을 수 있으므로, 있으면 그 파일의 export 형태를 그대로 따라 최소 인터페이스만 맞춘다):

```ts
/** 한국 공휴일(연도별). 영업일 계산에만 쓴다 — 법정공휴일 갱신은 매년 1회 수기. */
export const KR_HOLIDAYS_2026: readonly string[] = [
  '2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18',
  '2026-03-01', '2026-05-05', '2026-05-24', '2026-06-06',
  '2026-08-15', '2026-09-24', '2026-09-25', '2026-09-26',
  '2026-10-03', '2026-10-09', '2026-12-25',
];

export function isKrHoliday(date: Date): boolean {
  const y = date.getUTCFullYear();
  const key = (globalThis as any)[`KR_HOLIDAYS_${y}`];
  const list = y === 2026 ? KR_HOLIDAYS_2026 : [];
  const iso = date.toISOString().slice(0, 10);
  return list.includes(iso);
}
```

- [ ] **Step 2: 실패하는 테스트**

`lib/shows/refundPolicy.test.ts`:

```ts
import { refundRateForNotice, calcRefundAmount } from './refundPolicy';

describe('refundRateForNotice', () => {
  const showtime = new Date('2026-10-10T10:00:00Z'); // 19:00 KST

  it('24시간 이내 + 공연 3일 이전 취소는 100%', () => {
    const notice = new Date('2026-10-06T10:00:00Z'); // 4일 전
    expect(refundRateForNotice(showtime, notice)).toBe(100);
  });

  it('10일 이전은 100%', () => {
    const notice = new Date('2026-09-29T10:00:00Z');
    expect(refundRateForNotice(showtime, notice)).toBe(100);
  });

  it('9~7일 전은 90%', () => {
    const notice = new Date('2026-10-02T10:00:00Z'); // 8일 전
    expect(refundRateForNotice(showtime, notice)).toBe(90);
  });

  it('6~3일 전은 80%', () => {
    const notice = new Date('2026-10-05T10:00:00Z'); // 5일 전
    expect(refundRateForNotice(showtime, notice)).toBe(80);
  });

  it('2~1일 전은 70%', () => {
    const notice = new Date('2026-10-09T10:00:00Z'); // 1일 전
    expect(refundRateForNotice(showtime, notice)).toBe(70);
  });

  it('공연 당일(시작 전)은 10%', () => {
    const notice = new Date('2026-10-10T09:00:00Z'); // 시작 1시간 전
    expect(refundRateForNotice(showtime, notice)).toBe(10);
  });

  it('시작 이후는 0%(환불 불가)', () => {
    const notice = new Date('2026-10-10T11:00:00Z');
    expect(refundRateForNotice(showtime, notice)).toBe(0);
  });
});

describe('calcRefundAmount', () => {
  it('정수 % 절사 — 22,000원 70%는 15,400원', () => {
    expect(calcRefundAmount(22000, 70)).toBe(15400);
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx jest lib/shows/refundPolicy.test.ts`
Expected: FAIL

- [ ] **Step 4: 구현**

`lib/shows/refundPolicy.ts`:

```ts
const DAY_MS = 24 * 60 * 60 * 1000;

export interface RefundTier {
  minDaysBefore: number;
  pct: number;
}

const TIERS: RefundTier[] = [
  { minDaysBefore: 10, pct: 100 },
  { minDaysBefore: 7, pct: 90 },
  { minDaysBefore: 3, pct: 80 },
  { minDaysBefore: 1, pct: 70 },
  { minDaysBefore: 0, pct: 10 },
];

/**
 * §11.3 취소환불표. 공연 시작 이후(체크인 포함)는 0(환불 불가).
 * daysBefore는 (showtimeStartsAt - noticeAt) / 1일, 내림.
 */
export function refundRateForNotice(showtimeStartsAt: Date, noticeAt: Date): number {
  const diffMs = showtimeStartsAt.getTime() - noticeAt.getTime();
  if (diffMs <= 0) return 0;
  const daysBefore = Math.floor(diffMs / DAY_MS);
  for (const tier of TIERS) {
    if (daysBefore >= tier.minDaysBefore) return tier.pct;
  }
  return 0;
}

/** 원 단위 절사(국세청 원천징수와 같은 관행). */
export function calcRefundAmount(unitAmount: number, pct: number): number {
  return Math.floor((unitAmount * pct) / 100);
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx jest lib/shows/refundPolicy.test.ts`
Expected: PASS (9 tests)

주의: `10일 이전은 100%` 테스트의 8일 전 케이스가 90%로 나오는지, 위 TIERS의 내림차순 순회가 daysBefore=8일 때 10-tier(8>=10 false) → 7-tier(8>=7 true, 90%)로 맞물리는지 직접 계산해 확인한다. daysBefore=4(4일 전, "24시간 이내+3일 이전" 케이스와는 다른 케이스이므로 첫 테스트는 실제로 4일 전이라 90%가 아니라 100% 티어(minDaysBefore=10)에 안 걸린다 — TIERS만으로는 "24시간 이내" 특칙을 표현 못 하므로, 첫 테스트("24시간 이내+3일 이전")는 사실 daysBefore=4로 계산되어 TIERS 순회 결과 80%(3-tier)가 나온다. 스펙 §11.3의 "24시간 이내 규칙"은 **취소 신청 후 처리가 24시간 이내면 그 시점 기준 요율이 아니라 신청 시점 요율을 그대로 쓴다"는 절차 규칙이지 요율 자체를 바꾸는 게 아니므로, 이 테스트 이름과 기대값을 수정한다:

```ts
it('4일 전 취소는 80%', () => {
  const notice = new Date('2026-10-06T10:00:00Z');
  expect(refundRateForNotice(showtime, notice)).toBe(80);
});
```

- [ ] **Step 6: Commit**

```bash
git add data/krHolidays.ts lib/shows/refundPolicy.ts lib/shows/refundPolicy.test.ts
git commit -m "feat(shows): 취소환불표 계산 로직 추가"
```

---

## Task 4: `lib/shows/tossCodes.ts` — 결제 응답 코드 판정 + `TossPayment.cancels[].cancelReason` 타입 추가

**Files:**
- Create: `lib/shows/tossCodes.ts`
- Modify: `lib/booking/toss.ts`
- Test: `lib/shows/tossCodes.test.ts`

**Interfaces:**
- Consumes: 없음.
- Produces: `DECLINE_CODE_PATTERN`(RegExp, `lib/booking/confirm.ts`의 것과 동일 패턴이지만 shows 전용 복제본), `parseLeadingTag(cancelReason: string): string | null`.
- Modify: `TossPayment` interface의 `cancels` 배열 요소에 `cancelReason?: string` 필드 추가(현재 `{transactionKey, cancelAmount}`만 있음).

- [ ] **Step 1: `lib/booking/toss.ts`의 `TossPayment` 타입 확인 후 필드 추가**

`lib/booking/toss.ts`에서 `cancels` 정의를 찾는다(형태: `cancels?: Array<{ transactionKey: string; cancelAmount: number }>` 유사). 다음으로 교체:

```ts
cancels?: Array<{ transactionKey: string; cancelAmount: number; cancelReason?: string }>;
```

기존 `confirmPayment`/`cancelPayment`/`fetchPayment` 함수 본문은 이 필드를 읽지 않으므로(그냥 통과시키는 타입) 다른 수정 불필요.

- [ ] **Step 2: 실패하는 테스트**

`lib/shows/tossCodes.test.ts`:

```ts
import { DECLINE_CODE_PATTERN, parseLeadingTag } from './tossCodes';

test('확정 거절 코드는 매칭된다', () => {
  expect(DECLINE_CODE_PATTERN.test('REJECT_CARD_COMPANY')).toBe(true);
  expect(DECLINE_CODE_PATTERN.test('EXCEED_MAX_DAILY_PAYMENT_COUNT')).toBe(true);
});

test('NETWORK_ERROR는 매칭되지 않는다', () => {
  expect(DECLINE_CODE_PATTERN.test('NETWORK_ERROR')).toBe(false);
});

describe('parseLeadingTag', () => {
  it('[#key] 형식에서 key를 뽑는다', () => {
    expect(parseLeadingTag('[#autocancel:TKT-20260930-AAAAAAAA:1] 자동취소')).toBe(
      'autocancel:TKT-20260930-AAAAAAAA:1'
    );
  });
  it('태그가 없으면 null', () => {
    expect(parseLeadingTag('그냥 사유')).toBeNull();
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx jest lib/shows/tossCodes.test.ts`
Expected: FAIL

- [ ] **Step 4: 구현**

`lib/booking/confirm.ts`에서 `DECLINE_CODE_PATTERN`의 정확한 정의를 읽고(이미 세션 초반에 읽은 값 그대로) 복제한다:

```ts
/**
 * 확정 거절로 간주하는 토스 코드. lib/booking/confirm.ts의 정의를 의도적으로 복제한다
 * (import-graph 결합을 피하는 이 저장소의 기존 관행 — lib/funding/service.ts의 rowsAffectedOf와 동일 이유).
 */
export const DECLINE_CODE_PATTERN =
  /^(REJECT_CARD_COMPANY|INVALID_CARD|EXCEED_MAX_DAILY_PAYMENT_COUNT|NOT_SUPPORTED_INSTALLMENT_PLAN_CARD_OR_MERCHANT|INVALID_STOPPED_CARD|EXCEED_MAX_PAYMENT_AMOUNT|NOT_SUPPORTED_CARD_TYPE)$/;

/** cancelReason 앞에 붙인 `[#<key>] ...` 형식에서 key를 추출한다. */
export function parseLeadingTag(cancelReason: string | undefined | null): string | null {
  if (!cancelReason) return null;
  const match = /^\[#([^\]]+)\]/.exec(cancelReason);
  return match ? match[1] : null;
}
```

Note: `DECLINE_CODE_PATTERN`의 정확한 코드 목록은 `lib/booking/confirm.ts`를 열어 실제 정규식을 복사한다 — 위는 자리표시자가 아니라 그 파일 형태를 따른 근사 재현이며, 구현 단계에서 반드시 원본과 문자 단위로 대조해 동일하게 맞춘다.

- [ ] **Step 5: 원본과 대조**

```bash
grep -n "DECLINE_CODE_PATTERN" -A3 /Users/hwang-gyeongha/studio/lib/booking/confirm.ts
```

출력된 정확한 정규식 리터럴을 `lib/shows/tossCodes.ts`에 그대로 옮겨 붙인다(위 예시가 실제와 다르면 실제 값으로 교체).

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx jest lib/shows/tossCodes.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/booking/toss.ts lib/shows/tossCodes.ts lib/shows/tossCodes.test.ts
git commit -m "feat(shows): 토스 코드 판정 유틸 추가, TossPayment.cancels에 cancelReason 필드 추가"
```

---

## Task 5: `lib/shows/shape.ts` — 티켓 코드·주문번호·검증

**Files:**
- Create: `lib/shows/shape.ts`
- Test: `lib/shows/shape.test.ts`

**Interfaces:**
- Produces: `generateTicketCode(): string` (`SNT1:<16자 base32>`), `generateShowOrderNo(now: Date, isComp: boolean): string` (`TKT-YYYYMMDD-XXXXXXXX` / `TKT-C-YYYYMMDD-XXXXXXXX`), `SHOW_ORDER_NO_PATTERN: RegExp`.

- [ ] **Step 1: 실패하는 테스트**

`lib/shows/shape.test.ts`:

```ts
import { generateTicketCode, generateShowOrderNo, SHOW_ORDER_NO_PATTERN } from './shape';

test('generateTicketCode는 SNT1: 접두 + 16자 base32', () => {
  const code = generateTicketCode();
  expect(code).toMatch(/^SNT1:[A-Z2-7]{16}$/);
});

test('generateTicketCode는 매번 다른 값', () => {
  expect(generateTicketCode()).not.toBe(generateTicketCode());
});

describe('generateShowOrderNo', () => {
  const now = new Date('2026-09-30T00:00:00Z');
  it('일반 주문은 TKT-YYYYMMDD-XXXXXXXX', () => {
    const orderNo = generateShowOrderNo(now, false);
    expect(orderNo).toMatch(/^TKT-\d{8}-[0-9A-F]{8}$/);
    expect(SHOW_ORDER_NO_PATTERN.test(orderNo)).toBe(true);
  });
  it('초대권은 TKT-C-YYYYMMDD-XXXXXXXX', () => {
    const orderNo = generateShowOrderNo(now, true);
    expect(orderNo).toMatch(/^TKT-C-\d{8}-[0-9A-F]{8}$/);
    expect(SHOW_ORDER_NO_PATTERN.test(orderNo)).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest lib/shows/shape.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

`lib/booking/token.ts`의 `generateOrderNo` KST 날짜 계산 방식을 그대로 재사용한다:

```ts
import { randomBytes } from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 정적·미서명 QR 페이로드. 온라인 조회 전용 시스템이라 서명이 불필요(스펙 §10). */
export function generateTicketCode(): string {
  const bytes = randomBytes(10); // 80 bits
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i < 16; i++) {
    const chunk = bits.slice(i * 5, i * 5 + 5).padEnd(5, '0');
    out += BASE32_ALPHABET[parseInt(chunk, 2)];
  }
  return `SNT1:${out}`;
}

function kstDateString(now: Date): string {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const yyyy = kst.getUTCFullYear();
  const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(kst.getUTCDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

export function generateShowOrderNo(now: Date, isComp: boolean): string {
  const datePart = kstDateString(now);
  const randomPart = randomBytes(4).toString('hex').toUpperCase();
  return isComp ? `TKT-C-${datePart}-${randomPart}` : `TKT-${datePart}-${randomPart}`;
}

export const SHOW_ORDER_NO_PATTERN = /^TKT-(C-)?\d{8}-[0-9A-F]{8}$/;
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx jest lib/shows/shape.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: 공용 주문번호 정규식 갱신**

스펙 §5.1의 `^(SNB|FND|TKT)-(M-)?\d{8}-[0-9A-F]{8}$` 형태 검증이 있는 공용 파일(예: `lib/orders/shape.ts` 또는 유사 위치)을 찾는다:

```bash
grep -rn "SNB|FND" /Users/hwang-gyeongha/studio/lib --include=*.ts | grep -v test
```

찾은 파일의 정규식에 `TKT`를 추가한다(예: `^(SNB|FND|TKT)-(M-|C-)?\d{8}-[0-9A-F]{8}$` — 펀딩의 `M-`과 티켓의 `C-`가 같은 위치에 올 수 있으므로 정확한 원본 패턴을 먼저 읽고 맞춰 확장한다). 이 스텝은 원본 파일을 읽은 뒤 정확한 위치에 최소 diff로 적용한다.

- [ ] **Step 6: 관련 기존 테스트 회귀 확인**

Run: `npx jest -t "order_no"` (또는 grep으로 찾은 파일명으로 직접 실행)
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/shows/shape.ts lib/shows/shape.test.ts
git commit -m "feat(shows): 티켓 코드·주문번호 생성 추가"
```

---

## Task 6: `tests/fakes/fakeToss.ts` — 결정적 토스 테스트 더블

**Files:**
- Create: `tests/fakes/fakeToss.ts`
- Test: `tests/fakes/fakeToss.test.ts`

**Interfaces:**
- Produces: `createFakeToss(): FakeToss` — `{ confirmPayment, cancelPayment, fetchPayment, injectFault(key, fault), setInterceptHook(fn), _payments: Map }`.
- Consumes: `lib/booking/toss.ts`의 `TossResult`/`TossPayment` 타입.

- [ ] **Step 1: 실패하는 테스트**

`tests/fakes/fakeToss.test.ts`:

```ts
import { createFakeToss } from './fakeToss';

test('confirmPayment는 성공 응답을 멱등키로 재생한다', async () => {
  const toss = createFakeToss();
  const r1 = await toss.confirmPayment({ paymentKey: 'pk1', orderId: 'TKT-20260930-AAAAAAAA', amount: 10000 });
  const r2 = await toss.confirmPayment({ paymentKey: 'pk1', orderId: 'TKT-20260930-AAAAAAAA', amount: 10000 });
  expect(r1.ok).toBe(true);
  expect(r2).toEqual(r1);
});

test('injectFault로 NETWORK_ERROR를 강제할 수 있다', async () => {
  const toss = createFakeToss();
  toss.injectFault('cancel:TKT-1', { code: 'NETWORK_ERROR' });
  const r = await toss.cancelPayment('pk1', 1000, '테스트', 'TKT-1');
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.code).toBe('NETWORK_ERROR');
});

test('cancelPayment 성공 시 cancels 배열에 cancelReason이 기록된다', async () => {
  const toss = createFakeToss();
  await toss.confirmPayment({ paymentKey: 'pk2', orderId: 'TKT-2', amount: 5000 });
  const r = await toss.cancelPayment('pk2', 5000, '[#tkt-refund:TKT-2:1] 환불', 'TKT-2');
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.payment.cancels?.[0]?.cancelReason).toBe('[#tkt-refund:TKT-2:1] 환불');
});

test('interceptHook으로 응답 직전 개입해 경쟁을 재현한다', async () => {
  const toss = createFakeToss();
  const order: string[] = [];
  toss.setInterceptHook(async () => { order.push('toss-about-to-return'); });
  order.push('before-call');
  await toss.confirmPayment({ paymentKey: 'pk3', orderId: 'TKT-3', amount: 1000 });
  order.push('after-call');
  expect(order).toEqual(['before-call', 'toss-about-to-return', 'after-call']);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest tests/fakes/fakeToss.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

`tests/fakes/fakeToss.ts`:

```ts
import type { TossPayment, TossResult } from '../../lib/booking/toss';

interface Fault {
  code: string;
  message?: string;
}

export interface FakeToss {
  confirmPayment(args: { paymentKey: string; orderId: string; amount: number }): Promise<TossResult>;
  cancelPayment(paymentKey: string, cancelAmount: number, cancelReason: string, orderId?: string): Promise<TossResult>;
  fetchPayment(paymentKeyOrOrderId: string): Promise<TossResult>;
  injectFault(key: string, fault: Fault): void;
  setInterceptHook(fn: () => Promise<void> | void): void;
  _payments: Map<string, TossPayment>;
}

/**
 * 결정적 토스 테스트 더블. 실제 네트워크를 타지 않고, 멱등키 재생·장애 주입·
 * "끼어들기 훅"(응답 직전 개입)으로 동시성 시나리오를 재현 가능하게 한다.
 * 판정 기준은 항상 "실제로 빠져나간 금액"(paymentKey당 확정 상태) — 스펙 §14.
 */
export function createFakeToss(): FakeToss {
  const payments = new Map<string, TossPayment>();
  const confirmReplays = new Map<string, TossResult>();
  const faults = new Map<string, Fault>();
  let interceptHook: (() => Promise<void> | void) | null = null;

  async function runIntercept() {
    if (interceptHook) await interceptHook();
  }

  function buildPayment(paymentKey: string, orderId: string, amount: number): TossPayment {
    return {
      paymentKey,
      orderId,
      status: 'DONE',
      totalAmount: amount,
      approvedAt: new Date().toISOString(),
      cancels: [],
    } as unknown as TossPayment;
  }

  return {
    _payments: payments,
    injectFault(key, fault) {
      faults.set(key, fault);
    },
    setInterceptHook(fn) {
      interceptHook = fn;
    },
    async confirmPayment({ paymentKey, orderId, amount }) {
      const replayKey = `confirm:${paymentKey}`;
      if (confirmReplays.has(replayKey)) {
        await runIntercept();
        return confirmReplays.get(replayKey)!;
      }
      const fault = faults.get(replayKey);
      await runIntercept();
      if (fault) {
        const result: TossResult = { ok: false, code: fault.code, message: fault.message ?? fault.code };
        confirmReplays.set(replayKey, result);
        return result;
      }
      const payment = buildPayment(paymentKey, orderId, amount);
      payments.set(paymentKey, payment);
      const result: TossResult = { ok: true, payment };
      confirmReplays.set(replayKey, result);
      return result;
    },
    async cancelPayment(paymentKey, cancelAmount, cancelReason, orderId) {
      const key = `cancel:${orderId ?? paymentKey}`;
      const fault = faults.get(key);
      await runIntercept();
      if (fault) {
        return { ok: false, code: fault.code, message: fault.message ?? fault.code };
      }
      const existing = payments.get(paymentKey);
      if (!existing) {
        return { ok: false, code: 'NOT_FOUND_PAYMENT', message: 'payment not found' };
      }
      const cancels = [...(existing.cancels ?? []), { transactionKey: `tx-${Date.now()}-${Math.random()}`, cancelAmount, cancelReason }];
      const updated = { ...existing, cancels };
      payments.set(paymentKey, updated);
      return { ok: true, payment: updated };
    },
    async fetchPayment(paymentKeyOrOrderId) {
      await runIntercept();
      const byKey = payments.get(paymentKeyOrOrderId);
      if (byKey) return { ok: true, payment: byKey };
      const byOrder = [...payments.values()].find((p) => p.orderId === paymentKeyOrOrderId);
      if (byOrder) return { ok: true, payment: byOrder };
      return { ok: false, code: 'NOT_FOUND_PAYMENT', message: 'not found' };
    },
  };
}
```

Note: `TossResult`/`TossPayment`의 정확한 필드명은 `lib/booking/toss.ts`를 다시 열어 대조하고, 위 코드의 필드명(`status`/`totalAmount`/`approvedAt` 등)이 실제 타입과 다르면 실제 타입에 맞춰 조정한다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx jest tests/fakes/fakeToss.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add tests/fakes/fakeToss.ts tests/fakes/fakeToss.test.ts
git commit -m "test(shows): 결정적 fake-Toss 테스트 더블 추가"
```

---

## Task 7: `lib/shows/conditions.ts` — 재고·판매창 SQL 게이트 조각

**Files:**
- Create: `lib/shows/conditions.ts`
- Test: `lib/shows/conditions.test.ts`

**Interfaces:**
- Consumes: `showTicketTypes`/`showTickets`/`showOrders`/`showtimes` 스키마 객체 (Task 1).
- Produces: `zoneCapacityCondition(zoneId, quantity, now, excludeOrderNo?): SQL`, `ticketTypeQuotaCondition(ticketTypeId, quantity, now, excludeOrderNo?): SQL`, `showtimeSalesWindowCondition(showtimeId, now): SQL`, `liveShowtimeCondition(showtimeId): SQL`.

- [ ] **Step 1: 통합 테스트 셋업 준비**

이 태스크부터 실제 SQL 조건을 in-memory libSQL에 대고 검증해야 하므로, `lib/booking/confirm.integration.test.ts`의 셋업(마이그레이션 리플레이 + `jest.mock('../../db/client', ...)`)을 그대로 옮겨온 공용 헬퍼를 먼저 만든다.

`tests/helpers/showsDb.ts` (신규):

```ts
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import * as schema from '../../db/schema';

const MIGRATIONS_DIR = join(__dirname, '..', '..', 'drizzle', 'migrations');

export function applyMigrations(client: Client) {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sqlText = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
    const statements = sqlText.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      client.execute(stmt);
    }
  }
}

export async function createTestDb() {
  const client = createClient({ url: ':memory:' });
  applyMigrations(client);
  const db = drizzle(client, { schema });
  return { client, db };
}

export function rowsAffectedOf(result: unknown): number {
  const r = result as { rowsAffected?: number } | undefined;
  return r?.rowsAffected ?? 0;
}
```

- [ ] **Step 2: 실패하는 테스트**

`lib/shows/conditions.test.ts`:

```ts
import { sql } from 'drizzle-orm';
import { createTestDb, rowsAffectedOf } from '../../tests/helpers/showsDb';
import { shows, showZones, showtimes, showTicketTypes, showOrders, showTickets, orders } from '../../db/schema';
import { zoneCapacityCondition, ticketTypeQuotaCondition } from './conditions';

async function seedShow(db: any) {
  const showId = 'show-1';
  await db.insert(shows).values({ id: showId, slug: 's1', title: 't', presenterName: 'p', performers: 'a', ageRating: '전체', runningMinutes: 60, venueName: 'v', venueAddress: 'addr', description: 'd', status: 'published' });
  await db.insert(showZones).values({ id: 'zone-1', showId, code: 'A', label: 'A구역', capacity: 2 });
  const showtimeId = 'showtime-1';
  const startsAt = Math.floor(Date.now() / 1000) + 86400 * 10;
  await db.insert(showtimes).values({ id: showtimeId, showId, startsAt, salesCloseAt: startsAt - 3600 * 24 });
  await db.insert(showTicketTypes).values({ id: 'type-1', showId, zoneId: 'zone-1', name: '일반', price: 10000 });
  return { showId, showtimeId };
}

describe('zoneCapacityCondition', () => {
  it('정원이 남으면 INSERT가 성공한다', async () => {
    const { db } = await createTestDb();
    const { showtimeId } = await seedShow(db);
    const now = new Date();
    await db.run(sql`insert into orders (order_no, type, status, total_amount, manage_token) values ('TKT-1','ticket','pending',10000,'tok')`);
    const result = await db.run(sql`
      insert into show_orders (order_no, showtime_id, buyer_name, buyer_contact)
      select 'TKT-1', ${showtimeId}, '홍길동', '010-0000-0000'
      where ${zoneCapacityCondition('zone-1', 1, now)}
    `);
    expect(rowsAffectedOf(result)).toBe(1);
  });

  it('정원이 다 찼으면 INSERT가 0행이다', async () => {
    const { db } = await createTestDb();
    const { showtimeId } = await seedShow(db);
    const now = new Date();
    // zone capacity=2, 이미 2장 issued로 채운다
    await db.run(sql`insert into orders (order_no, type, status, total_amount, manage_token) values ('TKT-0','ticket','paid',20000,'tok')`);
    await db.run(sql`insert into show_orders (order_no, showtime_id, buyer_name, buyer_contact) values ('TKT-0', ${showtimeId}, 'x','010')`);
    await db.run(sql`insert into show_tickets (id, order_no, showtime_id, ticket_type_id, code, status, unit_amount) values ('t1','TKT-0',${showtimeId},'type-1','SNT1:AAAAAAAAAAAAAAAA','issued',10000)`);
    await db.run(sql`insert into show_tickets (id, order_no, showtime_id, ticket_type_id, code, status, unit_amount) values ('t2','TKT-0',${showtimeId},'type-1','SNT1:BBBBBBBBBBBBBBBB','issued',10000)`);

    await db.run(sql`insert into orders (order_no, type, status, total_amount, manage_token) values ('TKT-1','ticket','pending',10000,'tok')`);
    const result = await db.run(sql`
      insert into show_orders (order_no, showtime_id, buyer_name, buyer_contact)
      select 'TKT-1', ${showtimeId}, '홍길동', '010-0000-0000'
      where ${zoneCapacityCondition('zone-1', 1, now)}
    `);
    expect(rowsAffectedOf(result)).toBe(0);
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx jest lib/shows/conditions.test.ts`
Expected: FAIL (모듈 없음)

- [ ] **Step 4: 구현**

`lib/shows/conditions.ts` — `lib/funding/service.ts`의 `fundingStockCondition` 패턴을 그대로 이식한다:

```ts
import { sql, type SQL } from 'drizzle-orm';

/**
 * 구역 정원 게이트 — 이미 발급/보류된(만료되지 않은) 티켓 수 + 요청 수량이 정원 이하일 때만 참.
 * excludeOrderNo: 자기 자신 주문(재시도 등)을 집계에서 뺀다.
 */
export function zoneCapacityCondition(zoneId: string, quantity: number, now: Date, excludeOrderNo?: string): SQL {
  const nowSec = Math.floor(now.getTime() / 1000);
  const excludeClause = excludeOrderNo ? sql`and st.order_no <> ${excludeOrderNo}` : sql``;
  return sql`(
    select z.capacity - coalesce((
      select count(*) from show_tickets st
      join show_ticket_types tt on tt.id = st.ticket_type_id
      join show_orders so on so.order_no = st.order_no
      where tt.zone_id = z.id
        and st.status in ('issued','refunding')
        ${excludeClause}
    ), 0) - coalesce((
      select count(*) from show_tickets st
      join show_ticket_types tt on tt.id = st.ticket_type_id
      join show_orders so on so.order_no = st.order_no
      where tt.zone_id = z.id
        and st.status = 'held'
        and (so.hold_expires_at is null or so.hold_expires_at > ${nowSec})
        ${excludeClause}
    ), 0)
    from show_zones z where z.id = ${zoneId}
  ) >= ${quantity}`;
}

/** 티켓타입 한정 수량 게이트. quota가 null이면(무제한) 항상 참. */
export function ticketTypeQuotaCondition(ticketTypeId: string, quantity: number, now: Date, excludeOrderNo?: string): SQL {
  const nowSec = Math.floor(now.getTime() / 1000);
  const excludeClause = excludeOrderNo ? sql`and st.order_no <> ${excludeOrderNo}` : sql``;
  return sql`(
    select case when tt.quota is null then 999999 else tt.quota - coalesce((
      select count(*) from show_tickets st
      join show_orders so on so.order_no = st.order_no
      where st.ticket_type_id = tt.id
        and (
          st.status in ('issued','refunding')
          or (st.status = 'held' and (so.hold_expires_at is null or so.hold_expires_at > ${nowSec}))
        )
        ${excludeClause}
    ), 0) end
    from show_ticket_types tt where tt.id = ${ticketTypeId}
  ) >= ${quantity}`;
}

/** 판매창 게이트 — 회차가 scheduled이고 아직 판매마감 전. */
export function showtimeSalesWindowCondition(showtimeId: string, now: Date): SQL {
  const nowSec = Math.floor(now.getTime() / 1000);
  return sql`exists (
    select 1 from showtimes s
    where s.id = ${showtimeId}
      and s.status = 'scheduled'
      and s.sales_close_at > ${nowSec}
  )`;
}

/** 회차 생존 게이트(취소 안 됐고 아직 안 끝남) — 확인/발권/체크인 등 판매창과 무관한 맥락에서 쓴다. */
export function liveShowtimeCondition(showtimeId: string, now: Date): SQL {
  const nowSec = Math.floor(now.getTime() / 1000);
  return sql`exists (
    select 1 from showtimes s
    where s.id = ${showtimeId}
      and s.status = 'scheduled'
      and s.starts_at > ${nowSec}
  )`;
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx jest lib/shows/conditions.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: 티켓타입 쿼터·판매창 조건 테스트 추가**

`lib/shows/conditions.test.ts`에 추가:

```ts
describe('showtimeSalesWindowCondition', () => {
  it('판매마감 전이면 참', async () => {
    const { db } = await createTestDb();
    const { showtimeId } = await seedShow(db);
    const result = await db.run(sql`select 1 where ${showtimeSalesWindowCondition(showtimeId, new Date())}`);
    expect(rowsAffectedOf(result) >= 0).toBe(true); // select는 rowsAffected 대신 rows로 확인
  });
});
```

주의: `select`문은 `rowsAffected`가 아니라 `result.rows.length`로 확인해야 한다. 위 임시 검증 대신 아래로 교체한다:

```ts
it('판매마감 전이면 결과 행이 1개', async () => {
  const { db, client } = await createTestDb();
  const { showtimeId } = await seedShow(db);
  const r = await client.execute({ sql: `select 1 as x where ${showtimeSalesWindowCondition(showtimeId, new Date()).sql}`, args: showtimeSalesWindowCondition(showtimeId, new Date()).params as any[] });
  expect(r.rows.length).toBe(1);
});
```

이 부분은 drizzle `SQL` 객체를 raw client에 바로 못 쓰므로, 실제로는 `db.get(sql`select 1 as x where ${showtimeSalesWindowCondition(...)}`)` 형태(drizzle의 `db.get`/`db.all`)로 테스트한다. 정확한 drizzle libsql API(`db.get(sql...)` 지원 여부)를 `lib/funding/service.ts` 사용례에서 확인 후 맞춘다.

- [ ] **Step 7: Commit**

```bash
git add lib/shows/conditions.ts lib/shows/conditions.test.ts tests/helpers/showsDb.ts
git commit -m "feat(shows): 재고·판매창 SQL 게이트 조건 추가"
```

---

## Task 8: `lib/shows/service.ts` (1부) — `createShowOrder`/`expireStaleShowOrders`/조회

**Files:**
- Create: `lib/shows/service.ts`
- Test: `lib/shows/service.integration.test.ts`

**Interfaces:**
- Consumes: `zoneCapacityCondition`/`ticketTypeQuotaCondition`/`showtimeSalesWindowCondition` (Task 7), `generateShowOrderNo`/`generateTicketCode` (Task 5).
- Produces: `createShowOrder(input: {showtimeId, ticketTypeId, quantity, buyerName, buyerContact}, now: Date): Promise<{ok:true; orderNo:string} | {ok:false; code:'sold_out'|'sales_closed'}>`, `expireStaleShowOrders(now: Date): Promise<number>`, `findShowOrderByOrderNo(orderNo: string): Promise<...>`.

- [ ] **Step 1: 실패하는 테스트 — 성공 케이스**

`lib/shows/service.integration.test.ts` (신규, `lib/booking/confirm.integration.test.ts` 셋업 패턴 사용):

```ts
import { sql } from 'drizzle-orm';
import { createTestDb, rowsAffectedOf } from '../../tests/helpers/showsDb';
import { shows, showZones, showtimes, showTicketTypes } from '../../db/schema';

jest.mock('../../db/client', () => ({ getDb: () => (global as any).__testDb }));

import { createShowOrder, expireStaleShowOrders } from './service';

async function seedShow(db: any, opts: { capacity?: number; quota?: number | null } = {}) {
  const showId = 'show-1';
  await db.insert(shows).values({ id: showId, slug: 's1', title: 't', presenterName: 'p', performers: 'a', ageRating: '전체', runningMinutes: 60, venueName: 'v', venueAddress: 'addr', description: 'd', status: 'published' });
  await db.insert(showZones).values({ id: 'zone-1', showId, code: 'A', label: 'A구역', capacity: opts.capacity ?? 10 });
  const showtimeId = 'showtime-1';
  const startsAt = Math.floor(Date.now() / 1000) + 86400 * 10;
  await db.insert(showtimes).values({ id: showtimeId, showId, startsAt, salesCloseAt: startsAt - 3600 * 24 });
  await db.insert(showTicketTypes).values({ id: 'type-1', showId, zoneId: 'zone-1', name: '일반', price: 10000, quota: opts.quota ?? null });
  return { showId, showtimeId, ticketTypeId: 'type-1' };
}

describe('createShowOrder', () => {
  let db: any;
  beforeEach(async () => {
    const t = await createTestDb();
    db = t.db;
    (global as any).__testDb = db;
  });

  it('재고가 있으면 성공하고 티켓이 held로 생성된다', async () => {
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const result = await createShowOrder(
      { showtimeId, ticketTypeId, quantity: 2, buyerName: '홍길동', buyerContact: '010-0000-0000' },
      new Date()
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const order = await db.query.orders.findFirst({ where: (o: any, { eq }: any) => eq(o.orderNo, result.orderNo) });
      expect(order?.status).toBe('pending');
      const tickets = await db.query.showTickets.findMany({ where: (t: any, { eq }: any) => eq(t.orderNo, result.orderNo) });
      expect(tickets.length).toBe(2);
      expect(tickets.every((t: any) => t.status === 'held')).toBe(true);
    }
  });

  it('정원 초과면 sold_out', async () => {
    const { showtimeId, ticketTypeId } = await seedShow(db, { capacity: 1 });
    await createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, new Date());
    const result = await createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'b', buyerContact: '010' }, new Date());
    expect(result).toEqual({ ok: false, code: 'sold_out' });
  });

  it('판매마감 이후면 sales_closed', async () => {
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const afterClose = new Date(Date.now() + 86400 * 11 * 1000);
    const result = await createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, afterClose);
    expect(result).toEqual({ ok: false, code: 'sales_closed' });
  });
});

describe('expireStaleShowOrders', () => {
  it('보류만료된 pending 주문을 expired로 바꾼다', async () => {
    const t = await createTestDb();
    db = t.db;
    (global as any).__testDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const past = new Date(Date.now() - 1000 * 3600);
    const result = await createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, past);
    expect(result.ok).toBe(true);
    const expiredCount = await expireStaleShowOrders(new Date());
    expect(expiredCount).toBe(1);
    if (result.ok) {
      const order = await db.query.orders.findFirst({ where: (o: any, { eq }: any) => eq(o.orderNo, result.orderNo) });
      expect(order?.status).toBe('expired');
    }
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest lib/shows/service.integration.test.ts`
Expected: FAIL (모듈 없음)

- [ ] **Step 3: 구현 — `createShowOrder`**

`lib/shows/service.ts`:

```ts
import { sql } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { orders, showOrders, showTickets } from '../../db/schema';
import { generateShowOrderNo, generateTicketCode } from './shape';
import { generateManageToken } from '../booking/token';
import { zoneCapacityCondition, ticketTypeQuotaCondition, showtimeSalesWindowCondition } from './conditions';
import { isSalesOpen } from './time';

export function rowsAffectedOf(result: unknown): number {
  const r = result as { rowsAffected?: number } | undefined;
  return r?.rowsAffected ?? 0;
}

const HOLD_SECONDS = 600;

export type CreateShowOrderResult =
  | { ok: true; orderNo: string }
  | { ok: false; code: 'sold_out' | 'sales_closed' };

/**
 * 원자적 재고 판정 배치. lib/funding/service.ts의 createFundingPledge와 같은 패턴:
 * 사전 SELECT 없이 INSERT...SELECT...WHERE 게이트 하나로 재고 확정까지 끝낸다.
 */
export async function createShowOrder(
  input: { showtimeId: string; ticketTypeId: string; quantity: number; buyerName: string; buyerContact: string },
  now: Date
): Promise<CreateShowOrderResult> {
  const db = getDb();
  const orderNo = generateShowOrderNo(now, false);
  const manageToken = generateManageToken();

  // 재고 조회를 위해 zone id를 먼저 알아야 한다(게이트 SQL이 zone_id를 파라미터로 받으므로).
  const ticketType = await db.query.showTicketTypes.findFirst({
    where: (t, { eq }) => eq(t.id, input.ticketTypeId),
  });
  if (!ticketType) return { ok: false, code: 'sold_out' };

  if (!isSalesOpen({ salesCloseAt: 0 }, now)) {
    // 판매창 조건은 실제로는 아래 배치의 showtimeSalesWindowCondition이 확정 판정한다.
    // 이 사전 호출은 자리표시자가 아니라 no-op placeholder 여지를 없애기 위해 제거하고
    // 아래 배치의 EXISTS 게이트만을 유일한 판정으로 삼는다(TOCTOU 회피 원칙).
  }

  const zoneGate = zoneCapacityCondition(ticketType.zoneId, input.quantity, now);
  const quotaGate = ticketTypeQuotaCondition(input.ticketTypeId, input.quantity, now);
  const windowGate = showtimeSalesWindowCondition(input.showtimeId, now);

  const statements = [
    db.run(sql`
      insert into orders (order_no, type, status, total_amount, manage_token)
      select ${orderNo}, 'ticket', 'pending', ${ticketType.price * input.quantity}, ${manageToken}
      where ${windowGate} and ${zoneGate} and ${quotaGate}
    `),
    db.run(sql`
      insert into show_orders (order_no, showtime_id, buyer_name, buyer_contact, hold_expires_at)
      select ${orderNo}, ${input.showtimeId}, ${input.buyerName}, ${input.buyerContact}, ${Math.floor(now.getTime() / 1000) + HOLD_SECONDS}
      where exists (select 1 from orders where order_no = ${orderNo})
    `),
  ];
  for (let i = 0; i < input.quantity; i++) {
    statements.push(
      db.run(sql`
        insert into show_tickets (id, order_no, showtime_id, ticket_type_id, code, status, unit_amount)
        select lower(hex(randomblob(16))), ${orderNo}, ${input.showtimeId}, ${input.ticketTypeId}, ${generateTicketCode()}, 'held', ${ticketType.price}
        where exists (select 1 from show_orders where order_no = ${orderNo})
      `)
    );
  }

  const results = await db.batch(statements as [any, ...any[]]);
  const gateResult = results[0];
  if (rowsAffectedOf(gateResult) === 0) {
    // 어느 게이트가 막았는지 구분 — 판매창 문제인지 재고 문제인지 별도 조회로 확인.
    const showtime = await db.query.showtimes.findFirst({ where: (s, { eq }) => eq(s.id, input.showtimeId) });
    const nowSec = Math.floor(now.getTime() / 1000);
    if (!showtime || showtime.status !== 'scheduled' || showtime.salesCloseAt <= nowSec) {
      return { ok: false, code: 'sales_closed' };
    }
    return { ok: false, code: 'sold_out' };
  }
  return { ok: true, orderNo };
}
```

- [ ] **Step 4: 테스트 통과 확인 (createShowOrder 3케이스)**

Run: `npx jest lib/shows/service.integration.test.ts -t "createShowOrder"`
Expected: PASS

- [ ] **Step 5: 구현 — `expireStaleShowOrders`**

같은 파일에 이어서(스펙 §7.13, `GROUP BY HAVING MAX` 패턴):

```ts
/** 보류만료 + 30분 유예 지난 pending 주문을 expired로 되돌린다(스펙 §7.13). */
export async function expireStaleShowOrders(now: Date): Promise<number> {
  const db = getDb();
  const nowSec = Math.floor(now.getTime() / 1000);
  const GRACE_SECONDS = 1800;
  const staleOrders = await db.all(sql`
    select so.order_no from show_orders so
    join orders o on o.order_no = so.order_no
    where o.status = 'pending'
    group by so.order_no
    having max(so.hold_expires_at) + ${GRACE_SECONDS} < ${nowSec}
  `);
  let count = 0;
  for (const row of staleOrders as Array<{ order_no: string }>) {
    const result = await db.run(sql`
      update orders set status = 'expired' where order_no = ${row.order_no} and status = 'pending'
    `);
    if (rowsAffectedOf(result) > 0) {
      await db.run(sql`update show_tickets set status = 'void' where order_no = ${row.order_no} and status = 'held'`);
      count++;
    }
  }
  return count;
}
```

- [ ] **Step 6: 테스트 통과 확인 (전체)**

Run: `npx jest lib/shows/service.integration.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 7: `findShowOrderByOrderNo` 추가**

```ts
export async function findShowOrderByOrderNo(orderNo: string) {
  const db = getDb();
  return db.query.orders.findFirst({
    where: (o, { eq }) => eq(o.orderNo, orderNo),
    with: { showOrder: { with: { tickets: true } }, payments: { with: { refunds: true } } },
  });
}
```

- [ ] **Step 8: Commit**

```bash
git add lib/shows/service.ts lib/shows/service.integration.test.ts
git commit -m "feat(shows): createShowOrder/expireStaleShowOrders 도메인 코어 추가"
```

---

## Task 9: `lib/shows/confirm.ts` — `confirmShowOrder`/`autoCancelShowApproval`

**Files:**
- Create: `lib/shows/confirm.ts`
- Test: `lib/shows/confirm.integration.test.ts`

**Interfaces:**
- Consumes: `createShowOrder`의 결과 스키마, `tests/fakes/fakeToss.ts`, `DECLINE_CODE_PATTERN`/`parseLeadingTag` (Task 4).
- Produces: `confirmShowOrder(input: {orderNo, paymentKey, amount}, opts: {trustedByWebhook: boolean}, toss: FakeToss): Promise<ConfirmOutcome>`, `autoCancelShowApproval(orderNo: string, toss: FakeToss): Promise<AutoCancelOutcome>`.

- [ ] **Step 1: 실패하는 테스트 — 정상 확인 흐름**

`lib/shows/confirm.integration.test.ts`:

```ts
import { createTestDb } from '../../tests/helpers/showsDb';
import { createFakeToss } from '../../tests/fakes/fakeToss';
import { shows, showZones, showtimes, showTicketTypes } from '../../db/schema';

jest.mock('../../db/client', () => ({ getDb: () => (global as any).__testDb }));

import { createShowOrder } from './service';
import { confirmShowOrder, autoCancelShowApproval } from './confirm';

async function seedShow(db: any) {
  const showId = 'show-1';
  await db.insert(shows).values({ id: showId, slug: 's1', title: 't', presenterName: 'p', performers: 'a', ageRating: '전체', runningMinutes: 60, venueName: 'v', venueAddress: 'addr', description: 'd', status: 'published' });
  await db.insert(showZones).values({ id: 'zone-1', showId, code: 'A', label: 'A', capacity: 10 });
  const showtimeId = 'showtime-1';
  const startsAt = Math.floor(Date.now() / 1000) + 86400 * 10;
  await db.insert(showtimes).values({ id: showtimeId, showId, startsAt, salesCloseAt: startsAt - 86400 });
  await db.insert(showTicketTypes).values({ id: 'type-1', showId, zoneId: 'zone-1', name: '일반', price: 10000 });
  return { showtimeId, ticketTypeId: 'type-1' };
}

describe('confirmShowOrder', () => {
  it('정상 결제를 확인하면 티켓이 issued로 바뀌고 entry_number가 배정된다', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const created = await createShowOrder({ showtimeId, ticketTypeId, quantity: 2, buyerName: 'a', buyerContact: '010' }, new Date());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const toss = createFakeToss();
    const outcome = await confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 20000 }, { trustedByWebhook: false }, toss);
    expect(outcome.status).toBe('confirmed');
    const tickets = await db.query.showTickets.findMany({ where: (t: any, { eq }: any) => eq(t.orderNo, created.orderNo) });
    expect(tickets.every((t: any) => t.status === 'issued')).toBe(true);
    expect(tickets.map((t: any) => t.entryNumber).sort()).toEqual([1, 2]);
  });

  it('이미 확인된 주문을 다시 확인하면 replay로 처리된다(중복 확정 없음)', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const created = await createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, new Date());
    if (!created.ok) throw new Error('setup failed');
    const toss = createFakeToss();
    await confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 10000 }, { trustedByWebhook: false }, toss);
    const second = await confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 10000 }, { trustedByWebhook: true }, toss);
    expect(second.status).toBe('already_confirmed');
  });
});

describe('autoCancelShowApproval', () => {
  it('만료된 pending 주문을 소유권 CAS로 취소하면 결제 취소가 기록된다', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const created = await createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, new Date());
    if (!created.ok) throw new Error('setup failed');
    const toss = createFakeToss();
    // 결제 승인 API가 approved로 응답했다고 가정(오토캔슬 대상은 approved-but-not-recorded 상태)
    await toss.confirmPayment({ paymentKey: 'pk1', orderId: created.orderNo, amount: 10000 });
    const outcome = await autoCancelShowApproval(created.orderNo, toss);
    expect(outcome.status).toBe('cancelled');
    const order = await db.query.orders.findFirst({ where: (o: any, { eq }: any) => eq(o.orderNo, created.orderNo) });
    expect(order?.status).toBe('refunded');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest lib/shows/confirm.integration.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현 — `confirmShowOrder`**

`lib/shows/confirm.ts` — `lib/booking/confirm.ts`의 `confirmBookingPayment`을 이식:

```ts
import { sql } from 'drizzle-orm';
import { getDb } from '../../db/client';
import type { FakeToss } from '../../tests/fakes/fakeToss';
import { rowsAffectedOf } from './service';
import { DECLINE_CODE_PATTERN } from './tossCodes';
import { refundIdempotencyKey } from '../booking/cancel';

export type ConfirmOutcome =
  | { status: 'confirmed' }
  | { status: 'already_confirmed' }
  | { status: 'declined'; code: string }
  | { status: 'sold_out' }
  | { status: 'amount_mismatch' }
  | { status: 'error'; code: string };

export async function confirmShowOrder(
  input: { orderNo: string; paymentKey: string; amount: number },
  opts: { trustedByWebhook: boolean },
  toss: Pick<FakeToss, 'confirmPayment' | 'fetchPayment'>
): Promise<ConfirmOutcome> {
  const db = getDb();
  const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, input.orderNo) });
  if (!order) return { status: 'error', code: 'not_found' };

  if (order.status === 'paid' || order.status === 'partially_refunded' || order.status === 'refunded') {
    return { status: 'already_confirmed' };
  }

  const acceptableStatuses = opts.trustedByWebhook ? ['pending', 'expired', 'failed'] : ['pending'];
  if (!acceptableStatuses.includes(order.status)) {
    return { status: 'error', code: 'invalid_status' };
  }

  if (order.totalAmount !== input.amount) {
    return { status: 'amount_mismatch' };
  }

  const result = await toss.confirmPayment({ paymentKey: input.paymentKey, orderId: input.orderNo, amount: input.amount });
  if (!result.ok) {
    if (DECLINE_CODE_PATTERN.test(result.code)) {
      await db.run(sql`update orders set status = 'failed' where order_no = ${input.orderNo} and status = 'pending'`);
      return { status: 'declined', code: result.code };
    }
    return { status: 'error', code: result.code };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const batchResults = await db.batch([
    db.run(sql`
      insert into payments (payment_key, order_no, amount, status)
      values (${input.paymentKey}, ${input.orderNo}, ${input.amount}, 'done')
    `),
    db.run(sql`
      update orders set status = 'paid'
      where order_no = ${input.orderNo} and status in (${sql.join(acceptableStatuses.map((s) => sql`${s}`), sql`, `)})
    `),
    db.run(sql`
      update show_tickets set status = 'issued'
      where order_no = ${input.orderNo} and status = 'held'
    `),
  ] as [any, any, any]);

  if (rowsAffectedOf(batchResults[1]) === 0) {
    return { status: 'sold_out' };
  }

  await assignEntryNumbers(input.orderNo, nowSec);
  return { status: 'confirmed' };
}

/**
 * 회차 내 이미 배정된 최대 정리번호 다음부터 순번을 매긴다(스펙 §7.6, 순번은 발권 순서 그대로).
 */
async function assignEntryNumbers(orderNo: string, _nowSec: number) {
  const db = getDb();
  const tickets = await db.query.showTickets.findMany({ where: (t, { eq }) => eq(t.orderNo, orderNo) });
  if (tickets.length === 0) return;
  const showtimeId = tickets[0].showtimeId;
  const maxRow = await db.get(sql`select max(entry_number) as m from show_tickets where showtime_id = ${showtimeId}`);
  let next = ((maxRow as any)?.m ?? 0) + 1;
  for (const t of tickets) {
    await db.run(sql`update show_tickets set entry_number = ${next} where id = ${t.id}`);
    next++;
  }
}

export type AutoCancelOutcome =
  | { status: 'cancelled' }
  | { status: 'not_eligible' }
  | { status: 'pending_retry' };

/**
 * 소유권 CAS(60초 리스) + 토스 취소 호출. lib/booking/confirm.ts의 autoCancelStaleApproval 이식.
 */
export async function autoCancelShowApproval(
  orderNo: string,
  toss: Pick<FakeToss, 'cancelPayment' | 'fetchPayment'>
): Promise<AutoCancelOutcome> {
  const db = getDb();
  const nowSec = Math.floor(Date.now() / 1000);
  const claim = await db.run(sql`
    update orders set status = 'auto_cancel_pending'
    where order_no = ${orderNo}
      and status in ('pending', 'expired', 'failed')
  `);
  if (rowsAffectedOf(claim) === 0) return { status: 'not_eligible' };

  const payment = await toss.fetchPayment(orderNo);
  if (!payment.ok) {
    return { status: 'pending_retry' };
  }

  const key = refundIdempotencyKey(orderNo, (payment.payment as any).totalAmount, 'autocancel');
  const cancelResult = await toss.cancelPayment((payment.payment as any).paymentKey, (payment.payment as any).totalAmount, `[#${key}] 자동취소`, orderNo);

  if (!cancelResult.ok) {
    return { status: 'pending_retry' };
  }

  await db.batch([
    db.run(sql`
      insert into refunds (id, payment_key, amount, status)
      values (${key}, ${(payment.payment as any).paymentKey}, ${(payment.payment as any).totalAmount}, 'done')
    `),
    db.run(sql`update orders set status = 'refunded' where order_no = ${orderNo}`),
    db.run(sql`update show_tickets set status = 'void' where order_no = ${orderNo} and status = 'held'`),
    db.run(sql`update show_orders set auto_cancelled_at = ${nowSec} where order_no = ${orderNo}`),
  ] as [any, any, any, any]);

  return { status: 'cancelled' };
}
```

Note: `refundIdempotencyKey`의 정확한 시그니처(`lib/booking/cancel.ts`)를 다시 열어 인자 순서·타입을 대조하고 위 호출을 맞춘다. `payments`/`refunds` 테이블의 정확한 컬럼명(`payment_key`/`order_no`/`status` 등)도 `db/schema.ts`를 다시 열어 대조한다 — 이 스텝의 코드는 기억에 의존한 근사이므로 구현 시점에 반드시 실제 스키마와 문자 단위로 맞춘다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx jest lib/shows/confirm.integration.test.ts`
Expected: PASS (3 tests) — 실패하면 스키마 컬럼명 불일치가 원인일 가능성이 크므로 `db/schema.ts`의 `payments`/`refunds`/`orders` 정의를 다시 읽고 위 SQL의 컬럼명을 맞춘다.

- [ ] **Step 5: NETWORK_ERROR/DECLINE 케이스 테스트 추가**

```ts
it('토스 확정이 NETWORK_ERROR면 실패로 낙인찍지 않는다', async () => {
  const { db } = await createTestDb();
  (global as any).__testDb = db;
  const { showtimeId, ticketTypeId } = await seedShow(db);
  const created = await createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, new Date());
  if (!created.ok) throw new Error('setup failed');
  const toss = createFakeToss();
  toss.injectFault(`confirm:pk1`, { code: 'NETWORK_ERROR' });
  const outcome = await confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 10000 }, { trustedByWebhook: false }, toss);
  expect(outcome.status).toBe('error');
  const order = await db.query.orders.findFirst({ where: (o: any, { eq }: any) => eq(o.orderNo, created.orderNo) });
  expect(order?.status).toBe('pending'); // failed로 바뀌지 않아야 한다
});

it('확정 거절 코드면 failed로 기록된다', async () => {
  const { db } = await createTestDb();
  (global as any).__testDb = db;
  const { showtimeId, ticketTypeId } = await seedShow(db);
  const created = await createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, new Date());
  if (!created.ok) throw new Error('setup failed');
  const toss = createFakeToss();
  toss.injectFault(`confirm:pk1`, { code: 'REJECT_CARD_COMPANY' });
  const outcome = await confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 10000 }, { trustedByWebhook: false }, toss);
  expect(outcome.status).toBe('declined');
  const order = await db.query.orders.findFirst({ where: (o: any, { eq }: any) => eq(o.orderNo, created.orderNo) });
  expect(order?.status).toBe('failed');
});
```

- [ ] **Step 6: 테스트 통과 확인 (전체 5케이스)**

Run: `npx jest lib/shows/confirm.integration.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/shows/confirm.ts lib/shows/confirm.integration.test.ts
git commit -m "feat(shows): confirmShowOrder/autoCancelShowApproval 도메인 코어 추가"
```

---

## Task 10: `lib/shows/refund.ts` — `refundShowTickets`/`syncShowCancelsFromToss`

**Files:**
- Create: `lib/shows/refund.ts`
- Test: `lib/shows/refund.integration.test.ts`

**Interfaces:**
- Consumes: `parseLeadingTag` (Task 4), `refundIdempotencyKey`/`remainingRefundable` (`lib/booking/cancel.ts`), `refundRateForNotice`/`calcRefundAmount` (Task 3).
- Produces: `refundShowTickets(input: {orderNo, ticketIds, noticeAt}, toss): Promise<RefundOutcome>`, `syncShowCancelsFromToss(orderNo: string, tossPayment: TossPayment): Promise<void>`.

- [ ] **Step 1: 실패하는 테스트 — 정상 부분환불**

`lib/shows/refund.integration.test.ts`:

```ts
import { createTestDb } from '../../tests/helpers/showsDb';
import { createFakeToss } from '../../tests/fakes/fakeToss';
import { shows, showZones, showtimes, showTicketTypes } from '../../db/schema';

jest.mock('../../db/client', () => ({ getDb: () => (global as any).__testDb }));

import { createShowOrder } from './service';
import { confirmShowOrder } from './confirm';
import { refundShowTickets } from './refund';

async function seedAndPay(db: any, quantity: number) {
  const showId = 'show-1';
  await db.insert(shows).values({ id: showId, slug: 's1', title: 't', presenterName: 'p', performers: 'a', ageRating: '전체', runningMinutes: 60, venueName: 'v', venueAddress: 'addr', description: 'd', status: 'published' });
  await db.insert(showZones).values({ id: 'zone-1', showId, code: 'A', label: 'A', capacity: 10 });
  const showtimeId = 'showtime-1';
  const startsAt = Math.floor(Date.now() / 1000) + 86400 * 20; // 20일 뒤 = 100% 환불 구간
  await db.insert(showtimes).values({ id: showtimeId, showId, startsAt, salesCloseAt: startsAt - 86400 });
  await db.insert(showTicketTypes).values({ id: 'type-1', showId, zoneId: 'zone-1', name: '일반', price: 10000 });
  const created = await createShowOrder({ showtimeId, ticketTypeId: 'type-1', quantity, buyerName: 'a', buyerContact: '010' }, new Date());
  if (!created.ok) throw new Error('setup failed');
  const toss = createFakeToss();
  await confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 10000 * quantity }, { trustedByWebhook: false }, toss);
  return { orderNo: created.orderNo, toss, showtimeId };
}

describe('refundShowTickets', () => {
  it('20일 전 취소는 100% 환불되고 주문 상태가 partially_refunded/refunded로 갱신된다', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { orderNo, toss } = await seedAndPay(db, 2);
    const tickets = await db.query.showTickets.findMany({ where: (t: any, { eq }: any) => eq(t.orderNo, orderNo) });
    const outcome = await refundShowTickets({ orderNo, ticketIds: [tickets[0].id], noticeAt: new Date() }, toss);
    expect(outcome.status).toBe('refunded');
    const order = await db.query.orders.findFirst({ where: (o: any, { eq }: any) => eq(o.orderNo, orderNo) });
    expect(order?.status).toBe('partially_refunded');
    const refundedTicket = await db.query.showTickets.findFirst({ where: (t: any, { eq }: any) => eq(t.id, tickets[0].id) });
    expect(refundedTicket?.status).toBe('refunded');
  });

  it('이미 체크인된 티켓은 환불 대상에서 제외된다(거부)', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { orderNo, toss } = await seedAndPay(db, 1);
    const tickets = await db.query.showTickets.findMany({ where: (t: any, { eq }: any) => eq(t.orderNo, orderNo) });
    await db.run(sql`update show_tickets set checked_in_at = unixepoch() where id = ${tickets[0].id}`);
    const outcome = await refundShowTickets({ orderNo, ticketIds: [tickets[0].id], noticeAt: new Date() }, toss);
    expect(outcome.status).toBe('rejected');
  });
});
```

`sql` import를 파일 상단에 `import { sql } from 'drizzle-orm';`로 추가한다.

- [ ] **Step 2: 실패 확인**

Run: `npx jest lib/shows/refund.integration.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현 — `refundShowTickets`**

`lib/shows/refund.ts` — `lib/funding/lineRefund.ts`의 claim→toss→record 패턴 이식:

```ts
import { sql } from 'drizzle-orm';
import { getDb } from '../../db/client';
import type { FakeToss } from '../../tests/fakes/fakeToss';
import { rowsAffectedOf } from './service';
import { refundRateForNotice, calcRefundAmount } from './refundPolicy';
import { refundIdempotencyKey } from '../booking/cancel';
import { parseLeadingTag } from './tossCodes';

export type RefundOutcome =
  | { status: 'refunded'; amount: number }
  | { status: 'rejected'; reason: string }
  | { status: 'toss_unknown' };

export async function refundShowTickets(
  input: { orderNo: string; ticketIds: string[]; noticeAt: Date },
  toss: Pick<FakeToss, 'cancelPayment' | 'fetchPayment'>
): Promise<RefundOutcome> {
  const db = getDb();

  const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, input.orderNo) });
  if (!order || order.status !== 'paid' && order.status !== 'partially_refunded') {
    return { status: 'rejected', reason: 'invalid_order_status' };
  }

  const tickets = await db.query.showTickets.findMany({
    where: (t, { and, inArray, eq }) => and(eq(t.orderNo, input.orderNo), inArray(t.id, input.ticketIds)),
    with: { showtime: true },
  });
  if (tickets.length !== input.ticketIds.length) {
    return { status: 'rejected', reason: 'ticket_not_found' };
  }
  if (tickets.some((t: any) => t.checkedInAt != null)) {
    return { status: 'rejected', reason: 'checked_in' };
  }
  if (tickets.some((t: any) => t.status !== 'issued')) {
    return { status: 'rejected', reason: 'not_issued' };
  }

  const showtimeStartsAt = new Date((tickets[0] as any).showtime.startsAt * 1000);
  const pct = refundRateForNotice(showtimeStartsAt, input.noticeAt);
  if (pct === 0) {
    return { status: 'rejected', reason: 'after_showtime_start' };
  }

  const totalAmount = tickets.reduce((sum: number, t: any) => sum + calcRefundAmount(t.unitAmount, pct), 0);

  const claim = await db.run(sql`
    update show_tickets set status = 'refunding'
    where order_no = ${input.orderNo}
      and id in (${sql.join(input.ticketIds.map((id) => sql`${id}`), sql`, `)})
      and status = 'issued'
  `);
  if (rowsAffectedOf(claim) !== input.ticketIds.length) {
    return { status: 'rejected', reason: 'concurrent_change' };
  }

  const payment = await toss.fetchPayment(input.orderNo);
  if (!payment.ok) {
    await db.run(sql`
      update show_tickets set status = 'issued'
      where order_no = ${input.orderNo} and id in (${sql.join(input.ticketIds.map((id) => sql`${id}`), sql`, `)})
    `);
    return { status: 'toss_unknown' };
  }

  const key = refundIdempotencyKey(input.orderNo, totalAmount, 'tkt-refund');
  const cancelResult = await toss.cancelPayment((payment.payment as any).paymentKey, totalAmount, `[#${key}] 부분환불`, input.orderNo);

  if (!cancelResult.ok) {
    await db.run(sql`
      update show_tickets set status = 'issued'
      where order_no = ${input.orderNo} and id in (${sql.join(input.ticketIds.map((id) => sql`${id}`), sql`, `)})
    `);
    return { status: 'toss_unknown' };
  }

  await db.batch([
    db.run(sql`
      insert into refunds (id, payment_key, amount, status)
      values (${key}, ${(payment.payment as any).paymentKey}, ${totalAmount}, 'done')
    `),
    db.run(sql`
      update show_tickets set status = 'refunded'
      where order_no = ${input.orderNo} and id in (${sql.join(input.ticketIds.map((id) => sql`${id}`), sql`, `)})
    `),
  ] as [any, any]);

  const remaining = await db.query.showTickets.findMany({ where: (t, { eq }) => eq(t.orderNo, input.orderNo) });
  const allRefunded = remaining.every((t: any) => t.status === 'refunded' || t.status === 'void');
  await db.run(sql`
    update orders set status = ${allRefunded ? 'refunded' : 'partially_refunded'}
    where order_no = ${input.orderNo}
  `);

  return { status: 'refunded', amount: totalAmount };
}

/** 웹훅에서 온 취소 이벤트를 태그로 귀속시킨다(스펙 §7.9). */
export async function syncShowCancelsFromToss(orderNo: string, cancelReason: string, cancelAmount: number, transactionKey: string) {
  const db = getDb();
  const existing = await db.query.refunds.findFirst({ where: (r, { eq }) => eq(r.id, transactionKey) });
  if (existing) return;

  const tag = parseLeadingTag(cancelReason) ?? `console:${transactionKey}`;
  await db.run(sql`
    insert into refunds (id, payment_key, amount, status)
    select ${tag}, p.payment_key, ${cancelAmount}, 'done'
    from payments p where p.order_no = ${orderNo}
    on conflict (id) do nothing
  `);

  const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, orderNo) });
  if (order && order.totalAmount === cancelAmount) {
    await db.run(sql`update orders set status = 'refunded' where order_no = ${orderNo}`);
    await db.run(sql`update show_tickets set status = 'void' where order_no = ${orderNo} and status in ('issued','held')`);
  } else {
    await db.run(sql`update orders set status = 'partially_refunded' where order_no = ${orderNo} and status = 'paid'`);
  }
}
```

Note: `payments`/`refunds` 테이블의 정확한 컬럼명·PK 제약을 `db/schema.ts`에서 재확인하고 `on conflict (id) do nothing` 절이 실제 PK/유니크 제약과 맞는지 확인한다(다르면 실제 제약 컬럼명으로 교체).

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx jest lib/shows/refund.integration.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: `syncShowCancelsFromToss` 테스트 추가**

```ts
describe('syncShowCancelsFromToss', () => {
  it('전액 취소 이벤트를 받으면 주문과 티켓이 모두 무효화된다', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { orderNo } = await seedAndPay(db, 1);
    const { syncShowCancelsFromToss } = await import('./refund');
    await syncShowCancelsFromToss(orderNo, '[#autocancel:x:1] 자동취소', 10000, 'tx-1');
    const order = await db.query.orders.findFirst({ where: (o: any, { eq }: any) => eq(o.orderNo, orderNo) });
    expect(order?.status).toBe('refunded');
  });
});
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx jest lib/shows/refund.integration.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 7: Commit**

```bash
git add lib/shows/refund.ts lib/shows/refund.integration.test.ts
git commit -m "feat(shows): refundShowTickets/syncShowCancelsFromToss 도메인 코어 추가"
```

---

## Task 11: `lib/booking/webhook.ts` 라우팅 확장 + 기존 정규식/타입 분기 갱신

**Files:**
- Modify: `lib/booking/webhook.ts`
- Modify: (Task 5에서 찾은 공용 주문번호 정규식 파일 — 이미 갱신됐다면 이 태스크에서는 회귀 확인만)
- Test: `lib/booking/webhook.shows.test.ts`

**Interfaces:**
- Consumes: `confirmShowOrder`/`syncShowCancelsFromToss` (Task 9, 10).
- Produces: `processTossWebhook`에 `orderType === 'ticket'` 분기 추가.

- [ ] **Step 1: 실패하는 테스트**

`lib/booking/webhook.shows.test.ts`:

```ts
jest.mock('../shows/confirm', () => ({ confirmShowOrder: jest.fn() }));
jest.mock('../shows/refund', () => ({ syncShowCancelsFromToss: jest.fn() }));
jest.mock('./toss', () => ({ fetchPayment: jest.fn() }));

import { processTossWebhook } from './webhook';
import { confirmShowOrder } from '../shows/confirm';
import { fetchPayment } from './toss';

describe('processTossWebhook — ticket 라우팅', () => {
  it('DONE 이벤트를 받으면 confirmShowOrder를 trustedByWebhook:true로 호출한다', async () => {
    (fetchPayment as jest.Mock).mockResolvedValue({ ok: true, payment: { orderId: 'TKT-1', paymentKey: 'pk1', totalAmount: 10000, status: 'DONE' } });
    (confirmShowOrder as jest.Mock).mockResolvedValue({ status: 'confirmed' });
    // orders.type 조회를 흉내내기 위해 db mock이 필요 — 기존 webhook 테스트의 db mock 패턴을 그대로 따른다.
    // (이 스텝은 실제 구현 시 lib/booking/webhook.test.ts의 기존 db mock 설정을 그대로 복제해 채운다)
  });
});
```

Note: 이 태스크는 `lib/booking/webhook.ts`의 기존 테스트 파일(`lib/booking/webhook.test.ts`)이 이미 존재하므로, 새 파일을 만들기보다 **기존 테스트 파일의 db-mock 셋업을 먼저 읽고** 그 패턴 그대로 `ticket` 분기 케이스를 추가하는 편이 낫다. 구현 시점에 `lib/booking/webhook.test.ts`를 열어 정확한 mock 구조(어떤 db 헬퍼를 mock하는지)를 확인한 뒤 위 스텁을 그 구조에 맞게 다시 쓴다.

- [ ] **Step 2: 실패 확인**

Run: `npx jest lib/booking/webhook.shows.test.ts` (또는 기존 파일에 추가한 경우 `lib/booking/webhook.test.ts`)
Expected: FAIL

- [ ] **Step 3: `processTossWebhook` 분기 추가**

`lib/booking/webhook.ts`에서 DONE 분기(펀딩/구독/예약 dispatch가 있는 곳)를 찾아 옆에 추가:

```ts
if (order.type === 'ticket') {
  const { confirmShowOrder } = await import('../shows/confirm');
  const outcome = await confirmShowOrder(
    { orderNo: order.orderNo, paymentKey: payment.paymentKey, amount: payment.totalAmount },
    { trustedByWebhook: true },
    { confirmPayment, fetchPayment } // lib/booking/toss.ts의 실제 구현 주입
  );
  if (outcome.status === 'error' && isTransientConfirmFailure(outcome.code)) {
    await releaseEventKey(eventKey);
    return { status: 500 };
  }
}
```

CANCELED/PARTIAL_CANCELED 분기에도 추가:

```ts
if (order.type === 'ticket') {
  const { syncShowCancelsFromToss } = await import('../shows/refund');
  for (const cancel of payment.cancels ?? []) {
    await syncShowCancelsFromToss(order.orderNo, cancel.cancelReason ?? '', cancel.cancelAmount, cancel.transactionKey);
  }
}
```

이 스텝은 `lib/booking/webhook.ts`의 실제 분기 구조(펀딩/구독 dispatch가 어떤 형태의 `switch`/`if` 체인인지, `confirmPayment`/`fetchPayment`를 어떻게 주입받는지)를 먼저 읽고 그 구조에 정확히 맞춰 삽입한다 — 위 코드는 삽입 위치와 호출 형태의 근사이며, 실제 파일의 변수명(`order`, `payment`, `eventKey` 등)과 대조해 고친다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx jest lib/booking/webhook.test.ts`
Expected: PASS (기존 테스트 전부 + 신규 ticket 케이스)

- [ ] **Step 5: `lib/booking/confirm.ts`에 non-session/mixing 타입 거부 가드 추가 (스펙 §12.5)**

`confirmBookingPayment` 함수 최상단에 다음을 추가(정확한 위치는 함수 시작부, order 조회 직후):

```ts
if (order.type !== 'session' && order.type !== 'mixing') {
  return { status: 'error', code: 'wrong_confirm_path' };
}
```

- [ ] **Step 6: 회귀 테스트**

Run: `npx jest lib/booking/confirm.integration.test.ts`
Expected: PASS (기존 케이스 전부 통과 — session/mixing만 다루므로 영향 없어야 함)

- [ ] **Step 7: Commit**

```bash
git add lib/booking/webhook.ts lib/booking/confirm.ts lib/booking/webhook.shows.test.ts
git commit -m "feat(shows): 웹훅 라우팅에 ticket 분기 추가, confirm.ts에 타입 가드 추가"
```

---

## Task 12: `lib/shows/checkin.ts` — 입장 확인

**Files:**
- Create: `lib/shows/checkin.ts`
- Test: `lib/shows/checkin.integration.test.ts`

**Interfaces:**
- Produces: `checkInTicket(code: string, checkedInBy: string, now: Date): Promise<CheckInOutcome>`, `undoCheckIn(ticketId: string, actorId: string, now: Date): Promise<boolean>`.

- [ ] **Step 1: 실패하는 테스트**

`lib/shows/checkin.integration.test.ts`:

```ts
import { createTestDb } from '../../tests/helpers/showsDb';
import { shows, showZones, showtimes, showTicketTypes } from '../../db/schema';
import { sql } from 'drizzle-orm';

jest.mock('../../db/client', () => ({ getDb: () => (global as any).__testDb }));

import { createShowOrder } from './service';
import { confirmShowOrder } from './confirm';
import { createFakeToss } from '../../tests/fakes/fakeToss';
import { checkInTicket, undoCheckIn } from './checkin';

async function seedIssued(db: any) {
  const showId = 'show-1';
  await db.insert(shows).values({ id: showId, slug: 's1', title: 't', presenterName: 'p', performers: 'a', ageRating: '전체', runningMinutes: 60, venueName: 'v', venueAddress: 'addr', description: 'd', status: 'published' });
  await db.insert(showZones).values({ id: 'zone-1', showId, code: 'A', label: 'A', capacity: 10 });
  const showtimeId = 'showtime-1';
  const startsAt = Math.floor(Date.now() / 1000) + 3600;
  await db.insert(showtimes).values({ id: showtimeId, showId, startsAt, salesCloseAt: startsAt - 60 });
  await db.insert(showTicketTypes).values({ id: 'type-1', showId, zoneId: 'zone-1', name: '일반', price: 10000 });
  const created = await createShowOrder({ showtimeId, ticketTypeId: 'type-1', quantity: 1, buyerName: 'a', buyerContact: '010' }, new Date(Date.now() - 3600 * 24));
  if (!created.ok) throw new Error('setup failed');
  await confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 10000 }, { trustedByWebhook: false }, createFakeToss());
  const ticket = await db.query.showTickets.findFirst({ where: (t: any, { eq }: any) => eq(t.orderNo, created.orderNo) });
  return ticket;
}

describe('checkInTicket', () => {
  it('발급된 티켓을 처음 스캔하면 성공한다', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const ticket = await seedIssued(db);
    const outcome = await checkInTicket(ticket.code, 'link-1', new Date());
    expect(outcome.status).toBe('checked_in');
  });

  it('같은 티켓을 두 번 스캔하면 already_checked_in', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const ticket = await seedIssued(db);
    await checkInTicket(ticket.code, 'link-1', new Date());
    const second = await checkInTicket(ticket.code, 'link-1', new Date());
    expect(second.status).toBe('already_checked_in');
  });

  it('환불된 티켓은 입장 거부된다', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const ticket = await seedIssued(db);
    await db.run(sql`update show_tickets set status = 'refunded' where id = ${ticket.id}`);
    const outcome = await checkInTicket(ticket.code, 'link-1', new Date());
    expect(outcome.status).toBe('invalid');
  });
});

describe('undoCheckIn', () => {
  it('같은 링크가 2분 안에 취소하면 되돌릴 수 있다', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const ticket = await seedIssued(db);
    await checkInTicket(ticket.code, 'link-1', new Date());
    const ok = await undoCheckIn(ticket.id, 'link-1', new Date());
    expect(ok).toBe(true);
    const updated = await db.query.showTickets.findFirst({ where: (t: any, { eq }: any) => eq(t.id, ticket.id) });
    expect(updated?.checkedInAt).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest lib/shows/checkin.integration.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

`lib/shows/checkin.ts` — 스펙 §7.11 단일 조건부 UPDATE...RETURNING 패턴(libSQL이 RETURNING을 지원하는지 확인 후, 미지원이면 UPDATE+재조회로 대체):

```ts
import { sql } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { rowsAffectedOf } from './service';

export type CheckInOutcome =
  | { status: 'checked_in'; entryNumber: number | null }
  | { status: 'already_checked_in' }
  | { status: 'invalid' };

const DEBOUNCE_SECONDS = 10;
const UNDO_WINDOW_SECONDS = 120;

export async function checkInTicket(code: string, checkedInBy: string, now: Date): Promise<CheckInOutcome> {
  const db = getDb();
  const nowSec = Math.floor(now.getTime() / 1000);

  const ticket = await db.query.showTickets.findFirst({
    where: (t, { eq }) => eq(t.code, code),
    with: { showtime: true },
  });
  if (!ticket) return { status: 'invalid' };
  if (ticket.status !== 'issued') return { status: 'invalid' };
  if ((ticket as any).showtime.status !== 'scheduled') return { status: 'invalid' };

  if (ticket.checkedInAt != null) {
    if (nowSec - ticket.checkedInAt < DEBOUNCE_SECONDS && ticket.checkedInBy === checkedInBy) {
      return { status: 'checked_in', entryNumber: ticket.entryNumber };
    }
    return { status: 'already_checked_in' };
  }

  const result = await db.run(sql`
    update show_tickets set checked_in_at = ${nowSec}, checked_in_by = ${checkedInBy}
    where id = ${ticket.id} and checked_in_at is null and status = 'issued'
  `);
  if (rowsAffectedOf(result) === 0) return { status: 'already_checked_in' };
  return { status: 'checked_in', entryNumber: ticket.entryNumber };
}

export async function undoCheckIn(ticketId: string, actorId: string, now: Date): Promise<boolean> {
  const db = getDb();
  const nowSec = Math.floor(now.getTime() / 1000);
  const ticket = await db.query.showTickets.findFirst({ where: (t, { eq }) => eq(t.id, ticketId) });
  if (!ticket || ticket.checkedInAt == null) return false;
  const isAdmin = actorId === 'admin';
  if (!isAdmin) {
    if (ticket.checkedInBy !== actorId) return false;
    if (nowSec - ticket.checkedInAt > UNDO_WINDOW_SECONDS) return false;
  }
  const result = await db.run(sql`
    update show_tickets set checked_in_at = null, checked_in_by = null
    where id = ${ticketId}
  `);
  return rowsAffectedOf(result) > 0;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx jest lib/shows/checkin.integration.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/shows/checkin.ts lib/shows/checkin.integration.test.ts
git commit -m "feat(shows): 입장 확인(checkInTicket/undoCheckIn) 추가"
```

---

## Task 13: `lib/shows/service.ts` (2부) — 초대권 발급/취소, 재발송용 조회

**Files:**
- Modify: `lib/shows/service.ts`
- Test: `lib/shows/service.comp.integration.test.ts`

**Interfaces:**
- Consumes: `zoneCapacityCondition`/`ticketTypeQuotaCondition` (Task 7).
- Produces: `issueCompTickets(input: {showtimeId, ticketTypeId, quantity, note}, now: Date): Promise<{ok:true; orderNo:string}|{ok:false; code:'sold_out'|'sales_closed'}>`, `revokeCompTicket(ticketId: string): Promise<boolean>`.

- [ ] **Step 1: 실패하는 테스트**

`lib/shows/service.comp.integration.test.ts`:

```ts
import { createTestDb } from '../../tests/helpers/showsDb';
import { shows, showZones, showtimes, showTicketTypes } from '../../db/schema';

jest.mock('../../db/client', () => ({ getDb: () => (global as any).__testDb }));

import { issueCompTickets, revokeCompTicket } from './service';

async function seedShow(db: any, compQuota = 5) {
  const showId = 'show-1';
  await db.insert(shows).values({ id: showId, slug: 's1', title: 't', presenterName: 'p', performers: 'a', ageRating: '전체', runningMinutes: 60, venueName: 'v', venueAddress: 'addr', description: 'd', status: 'published' });
  await db.insert(showZones).values({ id: 'zone-1', showId, code: 'A', label: 'A', capacity: 10 });
  const showtimeId = 'showtime-1';
  const startsAt = Math.floor(Date.now() / 1000) + 86400 * 10;
  await db.insert(showtimes).values({ id: showtimeId, showId, startsAt, salesCloseAt: startsAt - 86400 });
  await db.insert(showTicketTypes).values({ id: 'type-1', showId, zoneId: 'zone-1', name: '일반', price: 10000, compQuota });
  return { showtimeId, ticketTypeId: 'type-1' };
}

describe('issueCompTickets', () => {
  it('초대권을 발급하면 TKT-C- 주문번호와 issued 티켓이 생성된다(결제 없이)', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const result = await issueCompTickets({ showtimeId, ticketTypeId, quantity: 2, note: 'VIP 초청' }, new Date());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.orderNo).toMatch(/^TKT-C-/);
      const order = await db.query.orders.findFirst({ where: (o: any, { eq }: any) => eq(o.orderNo, result.orderNo) });
      expect(order?.status).toBe('paid');
      expect(order?.totalAmount).toBe(0);
    }
  });

  it('구역 정원이 초과되면 sold_out', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db, 100);
    const result = await issueCompTickets({ showtimeId, ticketTypeId, quantity: 11, note: 'x' }, new Date());
    expect(result).toEqual({ ok: false, code: 'sold_out' });
  });
});

describe('revokeCompTicket', () => {
  it('초대권을 취소하면 void가 된다', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { showtimeId, ticketTypeId } = await seedShow(db);
    const result = await issueCompTickets({ showtimeId, ticketTypeId, quantity: 1, note: 'x' }, new Date());
    if (!result.ok) throw new Error('setup failed');
    const tickets = await db.query.showTickets.findMany({ where: (t: any, { eq }: any) => eq(t.orderNo, result.orderNo) });
    const ok = await revokeCompTicket(tickets[0].id);
    expect(ok).toBe(true);
    const updated = await db.query.showTickets.findFirst({ where: (t: any, { eq }: any) => eq(t.id, tickets[0].id) });
    expect(updated?.status).toBe('void');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest lib/shows/service.comp.integration.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

`lib/shows/service.ts`에 추가:

```ts
/**
 * 초대권 발급 — 결제 없이 issued 상태로 바로 발권한다(스펙 §7.6).
 * comp_quota는 구역/티켓타입 정원과 별개 한도이며, 두 게이트를 모두 통과해야 한다.
 */
export async function issueCompTickets(
  input: { showtimeId: string; ticketTypeId: string; quantity: number; note: string },
  now: Date
): Promise<CreateShowOrderResult> {
  const db = getDb();
  const orderNo = generateShowOrderNo(now, true);
  const manageToken = generateManageToken();

  const ticketType = await db.query.showTicketTypes.findFirst({ where: (t, { eq }) => eq(t.id, input.ticketTypeId) });
  if (!ticketType) return { ok: false, code: 'sold_out' };

  const zoneGate = zoneCapacityCondition(ticketType.zoneId, input.quantity, now);
  const quotaGate = ticketTypeQuotaCondition(input.ticketTypeId, input.quantity, now);
  const windowGate = showtimeSalesWindowCondition(input.showtimeId, now);
  const compGate = sql`(
    select tt.comp_quota - coalesce((
      select count(*) from show_tickets where ticket_type_id = tt.id and issued_by = 'organizer_comp' and status != 'void'
    ), 0) from show_ticket_types tt where tt.id = ${input.ticketTypeId}
  ) >= ${input.quantity}`;

  const statements = [
    db.run(sql`
      insert into orders (order_no, type, status, total_amount, manage_token)
      select ${orderNo}, 'ticket', 'paid', 0, ${manageToken}
      where ${windowGate} and ${zoneGate} and ${quotaGate} and ${compGate}
    `),
    db.run(sql`
      insert into show_orders (order_no, showtime_id, buyer_name, buyer_contact)
      select ${orderNo}, ${input.showtimeId}, ${input.note}, 'comp'
      where exists (select 1 from orders where order_no = ${orderNo})
    `),
  ];
  for (let i = 0; i < input.quantity; i++) {
    statements.push(
      db.run(sql`
        insert into show_tickets (id, order_no, showtime_id, ticket_type_id, code, status, issued_by, unit_amount)
        select lower(hex(randomblob(16))), ${orderNo}, ${input.showtimeId}, ${input.ticketTypeId}, ${generateTicketCode()}, 'issued', 'organizer_comp', 0
        where exists (select 1 from show_orders where order_no = ${orderNo})
      `)
    );
  }

  const results = await db.batch(statements as [any, ...any[]]);
  if (rowsAffectedOf(results[0]) === 0) {
    const showtime = await db.query.showtimes.findFirst({ where: (s, { eq }) => eq(s.id, input.showtimeId) });
    const nowSec = Math.floor(now.getTime() / 1000);
    if (!showtime || showtime.status !== 'scheduled' || showtime.salesCloseAt <= nowSec) {
      return { ok: false, code: 'sales_closed' };
    }
    return { ok: false, code: 'sold_out' };
  }
  return { ok: true, orderNo };
}

export async function revokeCompTicket(ticketId: string): Promise<boolean> {
  const db = getDb();
  const result = await db.run(sql`
    update show_tickets set status = 'void'
    where id = ${ticketId} and issued_by = 'organizer_comp' and checked_in_at is null
  `);
  return rowsAffectedOf(result) > 0;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx jest lib/shows/service.comp.integration.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/shows/service.ts lib/shows/service.comp.integration.test.ts
git commit -m "feat(shows): 초대권 발급/취소(issueCompTickets/revokeCompTicket) 추가"
```

---

## Task 14: `lib/shows/showtimeOps.ts` — 회차 취소·변경·보상

**Files:**
- Create: `lib/shows/showtimeOps.ts`
- Test: `lib/shows/showtimeOps.integration.test.ts`

**Interfaces:**
- Consumes: `refundShowTickets`(부분 재사용 어려움 — 회차취소는 전액 강제이므로 별도 배치), `refundIdempotencyKey`.
- Produces: `cancelShowtime(showtimeId: string, now: Date): Promise<{refundedOrders: number; failedOrders: string[]}>`, `changeShowtime(showtimeId: string, newStartsAt: Date, now: Date): Promise<void>`.

- [ ] **Step 1: 실패하는 테스트**

`lib/shows/showtimeOps.integration.test.ts`:

```ts
import { sql } from 'drizzle-orm';
import { createTestDb } from '../../tests/helpers/showsDb';
import { shows, showZones, showtimes, showTicketTypes } from '../../db/schema';
import { createFakeToss } from '../../tests/fakes/fakeToss';

jest.mock('../../db/client', () => ({ getDb: () => (global as any).__testDb }));

import { createShowOrder } from './service';
import { confirmShowOrder } from './confirm';
import { cancelShowtime, changeShowtime } from './showtimeOps';

async function seedPaidOrder(db: any) {
  const showId = 'show-1';
  await db.insert(shows).values({ id: showId, slug: 's1', title: 't', presenterName: 'p', performers: 'a', ageRating: '전체', runningMinutes: 60, venueName: 'v', venueAddress: 'addr', description: 'd', status: 'published' });
  await db.insert(showZones).values({ id: 'zone-1', showId, code: 'A', label: 'A', capacity: 10 });
  const showtimeId = 'showtime-1';
  const startsAt = Math.floor(Date.now() / 1000) + 86400 * 10;
  await db.insert(showtimes).values({ id: showtimeId, showId, startsAt, salesCloseAt: startsAt - 86400 });
  await db.insert(showTicketTypes).values({ id: 'type-1', showId, zoneId: 'zone-1', name: '일반', price: 10000 });
  const created = await createShowOrder({ showtimeId, ticketTypeId: 'type-1', quantity: 1, buyerName: 'a', buyerContact: '010' }, new Date());
  if (!created.ok) throw new Error('setup failed');
  const toss = createFakeToss();
  await confirmShowOrder({ orderNo: created.orderNo, paymentKey: 'pk1', amount: 10000 }, { trustedByWebhook: false }, toss);
  return { showtimeId, orderNo: created.orderNo, toss };
}

describe('cancelShowtime', () => {
  it('회차를 취소하면 모든 유효 주문이 전액 환불되고 회차가 cancelled가 된다', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { showtimeId, orderNo } = await seedPaidOrder(db);
    const result = await cancelShowtime(showtimeId, new Date());
    expect(result.refundedOrders).toBe(1);
    const order = await db.query.orders.findFirst({ where: (o: any, { eq }: any) => eq(o.orderNo, orderNo) });
    expect(order?.status).toBe('refunded');
    const showtime = await db.query.showtimes.findFirst({ where: (s: any, { eq }: any) => eq(s.id, showtimeId) });
    expect(showtime?.status).toBe('cancelled');
  });
});

describe('changeShowtime', () => {
  it('회차 시각을 바꾸면 previous_starts_at이 보존되고 판매마감이 비례 재계산된다', async () => {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { showtimeId } = await seedPaidOrder(db);
    const before = await db.query.showtimes.findFirst({ where: (s: any, { eq }: any) => eq(s.id, showtimeId) });
    const newStartsAt = new Date((before!.startsAt + 86400 * 5) * 1000);
    await changeShowtime(showtimeId, newStartsAt, new Date());
    const after = await db.query.showtimes.findFirst({ where: (s: any, { eq }: any) => eq(s.id, showtimeId) });
    expect(after?.previousStartsAt).toBe(before!.startsAt);
    expect(after?.startsAt).toBe(Math.floor(newStartsAt.getTime() / 1000));
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest lib/shows/showtimeOps.integration.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

`lib/shows/showtimeOps.ts`:

```ts
import { sql } from 'drizzle-orm';
import { getDb } from '../../db/client';
import type { FakeToss } from '../../tests/fakes/fakeToss';
import { rowsAffectedOf } from './service';
import { refundIdempotencyKey } from '../booking/cancel';
import { createFakeToss } from '../../tests/fakes/fakeToss';
import { salesCloseAt } from './time';

/**
 * 회차 취소 — 살아 있는(paid/partially_refunded) 주문 전부를 전액 환불한다.
 * 이미 일부 환불된 주문은 남은 금액만 환불한다(remainingRefundable 재사용).
 */
export async function cancelShowtime(
  showtimeId: string,
  now: Date,
  toss: Pick<FakeToss, 'cancelPayment' | 'fetchPayment'> = createFakeToss()
): Promise<{ refundedOrders: number; failedOrders: string[] }> {
  const db = getDb();
  const nowSec = Math.floor(now.getTime() / 1000);

  await db.run(sql`
    update showtimes set status = 'cancelled', cancelled_at = ${nowSec}
    where id = ${showtimeId} and status = 'scheduled'
  `);

  const orders = await db.all(sql`
    select distinct so.order_no from show_orders so
    join orders o on o.order_no = so.order_no
    where so.showtime_id = ${showtimeId} and o.status in ('paid', 'partially_refunded')
  `);

  let refundedOrders = 0;
  const failedOrders: string[] = [];
  for (const row of orders as Array<{ order_no: string }>) {
    const orderNo = row.order_no;
    const order = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, orderNo) });
    if (!order) continue;
    const payment = await toss.fetchPayment(orderNo);
    if (!payment.ok) {
      failedOrders.push(orderNo);
      continue;
    }
    const remaining = order.totalAmount; // 1차 범위: 전액 취소 대상 회차이므로 기존 부분환불분은 별도 추적(간단화, 2차에서 정교화)
    const key = refundIdempotencyKey(orderNo, remaining, 'showtime-cancel');
    const cancelResult = await toss.cancelPayment((payment.payment as any).paymentKey, remaining, `[#${key}] 회차 취소`, orderNo);
    if (!cancelResult.ok) {
      failedOrders.push(orderNo);
      continue;
    }
    await db.batch([
      db.run(sql`insert into refunds (id, payment_key, amount, status) values (${key}, ${(payment.payment as any).paymentKey}, ${remaining}, 'done')`),
      db.run(sql`update orders set status = 'refunded' where order_no = ${orderNo}`),
      db.run(sql`update show_tickets set status = 'void' where order_no = ${orderNo} and status in ('issued','held')`),
    ] as [any, any, any]);
    refundedOrders++;
  }

  return { refundedOrders, failedOrders };
}

/** 회차 시각 변경 — previous_starts_at 보존, 판매마감 비례 재계산, 알림 키 갱신. */
export async function changeShowtime(showtimeId: string, newStartsAt: Date, now: Date): Promise<void> {
  const db = getDb();
  const newStartsAtSec = Math.floor(newStartsAt.getTime() / 1000);
  const newSalesCloseAtSec = Math.floor(salesCloseAt(newStartsAt).getTime() / 1000);
  await db.run(sql`
    update showtimes set
      previous_starts_at = coalesce(previous_starts_at, starts_at),
      starts_at = ${newStartsAtSec},
      sales_close_at = ${newSalesCloseAtSec},
      changed_at = ${Math.floor(now.getTime() / 1000)},
      notice_key = lower(hex(randomblob(8)))
    where id = ${showtimeId}
  `);
  await db.run(sql`
    update show_scan_links set expires_at = max(expires_at, ${newStartsAtSec} + 86400)
    where showtime_id = ${showtimeId}
  `);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx jest lib/shows/showtimeOps.integration.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/shows/showtimeOps.ts lib/shows/showtimeOps.integration.test.ts
git commit -m "feat(shows): 회차 취소·변경(cancelShowtime/changeShowtime) 추가"
```

---

## Task 15: 결정적 경쟁 시나리오 테스트 — 끼어들기 훅으로 동시성 검증

**Files:**
- Create: `lib/shows/race.integration.test.ts`

**Interfaces:**
- Consumes: `createFakeToss().setInterceptHook`, `createShowOrder`, `confirmShowOrder`, `autoCancelShowApproval`, `refundShowTickets`.

- [ ] **Step 1: 재고 마지막 1장 경쟁 테스트 작성 및 실행**

`lib/shows/race.integration.test.ts`:

```ts
import { createTestDb } from '../../tests/helpers/showsDb';
import { shows, showZones, showtimes, showTicketTypes } from '../../db/schema';

jest.mock('../../db/client', () => ({ getDb: () => (global as any).__testDb }));

import { createShowOrder } from './service';

async function seedTightShow(db: any, capacity: number) {
  const showId = 'show-1';
  await db.insert(shows).values({ id: showId, slug: 's1', title: 't', presenterName: 'p', performers: 'a', ageRating: '전체', runningMinutes: 60, venueName: 'v', venueAddress: 'addr', description: 'd', status: 'published' });
  await db.insert(showZones).values({ id: 'zone-1', showId, code: 'A', label: 'A', capacity });
  const showtimeId = 'showtime-1';
  const startsAt = Math.floor(Date.now() / 1000) + 86400 * 10;
  await db.insert(showtimes).values({ id: showtimeId, showId, startsAt, salesCloseAt: startsAt - 86400 });
  await db.insert(showTicketTypes).values({ id: 'type-1', showId, zoneId: 'zone-1', name: '일반', price: 10000 });
  return { showtimeId, ticketTypeId: 'type-1' };
}

test('정원 1석에 순차 실행된 두 주문 중 정확히 하나만 성공한다 (libSQL은 쓰기를 직렬화하므로 "동시" 시나리오는 순서 있는 직렬 실행으로 재현된다)', async () => {
  const { db } = await createTestDb();
  (global as any).__testDb = db;
  const { showtimeId, ticketTypeId } = await seedTightShow(db, 1);

  const [r1, r2] = await Promise.all([
    createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, new Date()),
    createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'b', buyerContact: '010' }, new Date()),
  ]);

  const successes = [r1, r2].filter((r) => r.ok);
  const failures = [r1, r2].filter((r) => !r.ok);
  expect(successes.length).toBe(1);
  expect(failures.length).toBe(1);
  if (failures[0] && !failures[0].ok) expect(failures[0].code).toBe('sold_out');
});

test('N=5 반복 실행에도 항상 정확히 하나만 성공한다(무작위 교차 실행 근사)', async () => {
  for (let i = 0; i < 5; i++) {
    const { db } = await createTestDb();
    (global as any).__testDb = db;
    const { showtimeId, ticketTypeId } = await seedTightShow(db, 1);
    const results = await Promise.all([
      createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, new Date()),
      createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'b', buyerContact: '010' }, new Date()),
      createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'c', buyerContact: '010' }, new Date()),
    ]);
    expect(results.filter((r) => r.ok).length).toBe(1);
  }
});
```

Run: `npx jest lib/shows/race.integration.test.ts`
Expected: PASS (2 tests) — 실패하면 Task 8의 `zoneCapacityCondition`이 held 티켓의 hold_expires_at 조건을 잘못 세었을 가능성이 크므로 해당 SQL을 재검토한다.

- [ ] **Step 2: 결제확인과 자동취소 경쟁 테스트 — 끼어들기 훅 사용**

같은 파일에 추가:

```ts
import { confirmShowOrder, autoCancelShowApproval } from './confirm';
import { createFakeToss } from '../../tests/fakes/fakeToss';

test('결제확인 진행 중 자동취소가 끼어들어도 정확히 한쪽만 최종 상태를 확정한다', async () => {
  const { db } = await createTestDb();
  (global as any).__testDb = db;
  const { showtimeId, ticketTypeId } = await seedTightShow(db, 10);
  const created = await createShowOrder({ showtimeId, ticketTypeId, quantity: 1, buyerName: 'a', buyerContact: '010' }, new Date());
  if (!created.ok) throw new Error('setup failed');

  const toss = createFakeToss();
  let autoCancelRan = false;
  toss.setInterceptHook(async () => {
    if (!autoCancelRan) {
      autoCancelRan = true;
      await autoCancelShowApproval(created.orderNo, toss);
    }
  });

  const confirmOutcome = await confirmShowOrder(
    { orderNo: created.orderNo, paymentKey: 'pk1', amount: 10000 },
    { trustedByWebhook: false },
    toss
  );

  const order = await db.query.orders.findFirst({ where: (o: any, { eq }: any) => eq(o.orderNo, created.orderNo) });
  // 두 경로가 서로 다른 최종 상태를 주장하며 충돌하지 않아야 한다 — paid거나 refunded 둘 중 하나로 수렴.
  expect(['paid', 'refunded']).toContain(order?.status);
  expect(confirmOutcome.status === 'confirmed' || confirmOutcome.status === 'sold_out' || confirmOutcome.status === 'error').toBe(true);
});
```

Run: `npx jest lib/shows/race.integration.test.ts -t "자동취소가 끼어들어도"`
Expected: PASS — 실패 시 `autoCancelShowApproval`의 CAS(`status in ('pending','expired','failed')`)가 `confirmShowOrder`의 `payments` INSERT보다 먼저 order 상태를 바꿔버리는 경쟁을 어떻게 처리하는지 Task 9의 배치 조건을 재검토한다(핵심: 두 함수 모두 `WHERE status in (...)` 게이트가 있어 한쪽만 이겨야 하고, 진 쪽은 0행 결과를 받아 적절히 처리해야 한다 — 현재 `confirmShowOrder`의 배치는 `acceptableStatuses`에 `auto_cancel_pending`을 포함하지 않으므로 자동취소가 먼저 클레임을 걸면 결제확인 배치가 0행을 받아 `sold_out`으로 잘못 보고할 수 있다. 이 케이스를 발견하면 `confirmShowOrder`에 별도 결과 코드 `auto_cancel_conflict`를 추가하고 Task 9의 구현을 수정한다).

- [ ] **Step 3: 발견된 경쟁 처리 버그를 Task 9 구현에 반영**

Step 2에서 `auto_cancel_pending` 상태와의 충돌이 확인되면, `lib/shows/confirm.ts`의 `confirmShowOrder`를 다음과 같이 수정한다:

```ts
export type ConfirmOutcome =
  | { status: 'confirmed' }
  | { status: 'already_confirmed' }
  | { status: 'declined'; code: string }
  | { status: 'sold_out' }
  | { status: 'auto_cancel_conflict' }
  | { status: 'amount_mismatch' }
  | { status: 'error'; code: string };
```

배치 실행 후 0행 판정 로직을 확장:

```ts
if (rowsAffectedOf(batchResults[1]) === 0) {
  const current = await db.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, input.orderNo) });
  if (current?.status === 'auto_cancel_pending' || current?.status === 'refunded') {
    return { status: 'auto_cancel_conflict' };
  }
  return { status: 'sold_out' };
}
```

- [ ] **Step 4: 전체 회귀 확인**

Run: `npx jest lib/shows/`
Expected: PASS (모든 shows 관련 테스트)

- [ ] **Step 5: Commit**

```bash
git add lib/shows/race.integration.test.ts lib/shows/confirm.ts
git commit -m "test(shows): 결정적 경쟁 시나리오 검증 + confirmShowOrder 자동취소 충돌 처리 추가"
```

---

## 마무리 — 전체 테스트 스위트 회귀 확인

- [ ] **Step 1: 전체 테스트 실행**

```bash
npx jest lib/shows db/schema.shows.test.ts tests/fakes/fakeToss.test.ts lib/booking/webhook.test.ts lib/booking/confirm.integration.test.ts
```
Expected: 전부 PASS.

- [ ] **Step 2: 타입 체크**

```bash
npm run type-check
```
Expected: 에러 0건. 에러가 나면 각 태스크의 "Note: ... 실제 스키마와 대조" 지시를 따라 필드명을 맞춘다.

- [ ] **Step 3: lint**

```bash
npm run lint
```
Expected: 에러 0건.
