# 펀딩(리워드형 크라우드펀딩) 1차 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 저장소 파일로 정의한 펀딩 프로젝트에 게스트가 리워드를 골라 토스 결제 또는 무통장으로 후원하고, 운영자가 관리자 화면에서 입금·환불·발송을 처리하는 기능을 studionol.co.kr에 추가한다.

**Architecture:** 프로젝트·리워드는 `content/funding/<slug>.md`(frontmatter + 마크다운)가 정본이고 DB에는 후원(`funding_pledges`) 하나만 추가한다. 돈은 기존 `orders`/`payments`/`refunds`가 SSOT이며 `orders.type='funding'`으로 구분한다. 결제·웹훅·관리자·메일은 예약 시스템(`lib/booking/*`)의 골격을 그대로 따른다.

**Tech Stack:** Next.js 15 Pages Router, React 19, Turso(libSQL) + Drizzle, `@tosspayments/tosspayments-sdk` v2(결제위젯), Resend, iron-session 관리자, Jest(단위 + in-memory libSQL 통합).

**Spec:** `docs/superpowers/specs/2026-09-08-funding-design.md`

## Global Constraints

- 작업 위치: worktree `/Users/hwang-gyeongha/studio-worktrees/feat-funding`, 브랜치 `feat/funding`. 공용 트리 `~/studio`는 건드리지 않는다. 모든 명령은 이 worktree에서 실행한다.
- 커밋 메시지 끝에 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- 금액 규약: 리워드 `amount`는 VAT 포함가. `itemAmount = Math.round(total / 1.1)`, `vatAmount = total − itemAmount`. 클라이언트가 보낸 금액은 절대 신뢰하지 않는다. 표시는 `formatPriceAmount`만 쓴다(리터럴 `toLocaleString` 금지).
- 홀드: 토스 900초, 무통장 12시간(43,200초). 추가 후원금 0~5,000,000원, 1,000원 단위. 수량 1~10.
- 한정 수량(`totalQuantity` 있음) 리워드는 무통장 불가. 리워드 없는 순수 후원 티어 없음.
- 후원 버튼은 `bg-primary`(Button `solid`). 옐로(`kakao`)는 카카오 링크 전용.
- 펀딩 페이지는 전부 `/ko/` 전용. 트랜잭셔널 페이지(pledge·success·fail·deposit·manage·terms)는 `noindex` + `Cache-Control: no-store`.
- `nav.funding` 키는 7로케일 `public/locales/*/common.json`에 모두 넣는다(`localeKeyParity` 테스트).
- 새 DB 테이블은 `npm run db:generate`로 마이그레이션을 만들고 SQL 파일을 커밋한다. 프로덕션 적용(`npm run db:migrate`)은 **운영자가 직접** 한다 — 계획의 어떤 태스크도 프로덕션 DB를 건드리지 않는다.
- 각 태스크 끝에 `npx jest <경로>`가 녹색, 마지막 태스크에서 `npm run type-check && npm run lint && npm test && npm run build`.
- 테스트 파일은 로직 옆 `*.test.ts`. 통합 테스트는 `/** @jest-environment node */` + in-memory libSQL + `drizzle/migrations` 순차 적용(`lib/booking/confirm.integration.test.ts` 패턴).

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `db/schema.ts` (수정) | `orders.type`에 `funding`, 새 `funding_pledges` 테이블·관계·타입 |
| `drizzle/migrations/0009_*.sql` (생성) | 위 변경의 SQL |
| `content/funding/smoke-test.md` (생성) | 스모크·테스트 픽스처 프로젝트(`hidden: true`, 초기 `status: draft`) |
| `lib/funding/projects.ts` | 파일 로더, frontmatter 검증, 상태 판정(순수) |
| `lib/funding/policy.ts` | 상수(홀드·계좌·추가 후원금 상한)와 취소 가능 판정(순수) |
| `lib/funding/amounts.ts` | VAT 분해·합계(순수) |
| `lib/funding/validation.ts` | `POST /api/funding/pledges` 입력 검증(순수) |
| `lib/funding/service.ts` | 후원 생성(재고 조건 INSERT), 조회, 만료, 집계 |
| `lib/funding/confirm.ts` | 토스 승인 → DB 확정(멱등) |
| `lib/funding/cancel.ts` | 셀프·관리자 취소(토스 자동 / 무통장 요청·기록) |
| `lib/funding/bank-transfer.ts` | 입금 확인·되살리기 |
| `lib/funding/email.ts` | 메일 6종 |
| `lib/funding/csv.ts` | CSV 직렬화(순수) |
| `lib/booking/webhook.ts` (수정) | `order.type` 스위치 |
| `pages/api/funding/pledges.ts`, `pages/api/funding/[slug]/status.ts`, `pages/api/funding/cancel.ts` | 공개 API |
| `pages/api/admin/funding/pledges/index.ts`, `[id].ts`, `export.ts` | 관리자 API |
| `pages/[locale]/funding/index.tsx`, `[slug]/index.tsx`, `[slug]/pledge.tsx`, `success.tsx`, `fail.tsx`, `deposit/[orderNo].tsx`, `manage/[orderNo].tsx`, `terms.tsx` | 페이지 |
| `pages/admin/funding/index.tsx`, `[id].tsx` | 관리자 화면 |
| `components/funding/*` | UI 컴포넌트 |
| `components/booking/TossPaymentWidget.tsx` (수정) | `successUrl`/`failUrl` prop 추가 |
| `components/layout/Header.tsx`, `public/locales/*/common.json`, `lib/sitemap/routes.js`, `next-sitemap.config.js`, `public/robots.txt`, `pages/api/llms.ts`, `utils/analytics.ts`, `content/funding.test.ts` | 노출·SEO·게이트 |

---

### Task 1: 스키마 — `orders.type` 확장 + `funding_pledges`

**Files:**
- Modify: `db/schema.ts` (`orderTypeEnum` 근처, 파일 끝 타입 export 근처)
- Create: `drizzle/migrations/0009_*.sql` (생성기)
- Test: `db/schema.funding.test.ts`

**Interfaces:**
- Produces: `fundingPledges` 테이블, 타입 `FundingPledge`, `NewFundingPledge`, enum 상수 `fundingPaymentMethodEnum = ['toss','bank_transfer']`, `fulfillmentStatusEnum = ['none','preparing','shipped','delivered']`, `fundingEntrySourceEnum = ['online','manual']`. `orders.type`에 `'funding'`.

- [ ] **Step 1: 실패하는 테스트**

`db/schema.funding.test.ts`:
```ts
/** @jest-environment node */
import { createClient } from '@libsql/client';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { fundingPledges, orderTypeEnum } from './schema';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');

describe('funding schema', () => {
  it('orders.type에 funding이 있다', () => {
    expect(orderTypeEnum).toContain('funding');
  });

  it('마이그레이션을 적용하면 funding_pledges 테이블이 생긴다', async () => {
    const client = createClient({ url: ':memory:' });
    for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
      for (const statement of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
        if (statement.trim()) await client.execute(statement.trim());
      }
    }
    const rows = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='funding_pledges'");
    expect(rows.rows).toHaveLength(1);
    const cols = await client.execute('PRAGMA table_info(funding_pledges)');
    const names = cols.rows.map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining(['order_id', 'project_slug', 'reward_id', 'hold_expires_at', 'fulfillment_status']));
    expect(fundingPledges).toBeDefined();
    client.close();
  });
});
```

- [ ] **Step 2: 실패 확인**

`npx jest db/schema.funding.test.ts` → FAIL (`fundingPledges` export 없음).

- [ ] **Step 3: 스키마 작성**

`db/schema.ts`에서 `orderTypeEnum`을 바꾸고, `rateLimits` 정의 앞에 아래를 추가한다.

```ts
export const orderTypeEnum = ['session', 'mixing', 'subscription', 'funding'] as const;
```

```ts
// ─── 펀딩 (리워드형 크라우드펀딩) ─────────────────────────────────────────────
// 프로젝트·리워드의 정본은 content/funding/<slug>.md다. 이 테이블은 후원 1건 = 주문 1건의
// 부속 정보(리워드 스냅샷·배송·발송)만 담는다. 돈은 orders/payments/refunds가 SSOT.

export const fundingPaymentMethodEnum = ['toss', 'bank_transfer'] as const;
export const fulfillmentStatusEnum = ['none', 'preparing', 'shipped', 'delivered'] as const;
export const fundingEntrySourceEnum = ['online', 'manual'] as const;

export const fundingPledges = sqliteTable('funding_pledges', {
  id: text('id').primaryKey().$defaultFn(() => sql`lower(hex(randomblob(16)))`),
  orderId: text('order_id').notNull().unique().references(() => orders.id),
  projectSlug: text('project_slug').notNull(),
  /** 후원 시점의 리워드 스냅샷 — 파일이 바뀌어도 기록은 그대로다. */
  rewardId: text('reward_id').notNull(),
  rewardTitle: text('reward_title').notNull(),
  unitAmount: integer('unit_amount').notNull(),
  quantity: integer('quantity').notNull(),
  additionalAmount: integer('additional_amount').notNull().default(0),
  paymentMethod: text('payment_method', { enum: fundingPaymentMethodEnum }).notNull(),
  /** 결제 대기 만료. 토스 +15분, 무통장 +12시간. 지나면 재고 계산에서 빠지고 lazy로 expired 처리. */
  holdExpiresAt: integer('hold_expires_at', { mode: 'timestamp' }).notNull(),
  paidAt: integer('paid_at', { mode: 'timestamp' }),
  supporterMessage: text('supporter_message'),
  displayNamePublic: integer('display_name_public', { mode: 'boolean' }).notNull().default(false),
  shippingName: text('shipping_name'),
  shippingPhone: text('shipping_phone'),
  shippingPostcode: text('shipping_postcode'),
  shippingAddress1: text('shipping_address1'),
  shippingAddress2: text('shipping_address2'),
  shippingMemo: text('shipping_memo'),
  fulfillmentStatus: text('fulfillment_status', { enum: fulfillmentStatusEnum }).notNull().default('none'),
  trackingCompany: text('tracking_company'),
  trackingNumber: text('tracking_number'),
  entrySource: text('entry_source', { enum: fundingEntrySourceEnum }).notNull().default('online'),
  /** 무통장 후원자의 셀프 취소 요청 시각. 운영자가 계좌 환불 후 orders를 refunded로 바꾼다. */
  refundRequestedAt: integer('refund_requested_at', { mode: 'timestamp' }),
  adminMemo: text('admin_memo'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const fundingPledgesRelations = relations(fundingPledges, ({ one }) => ({
  order: one(orders, { fields: [fundingPledges.orderId], references: [orders.id] }),
}));

export type FundingPledge = typeof fundingPledges.$inferSelect;
export type NewFundingPledge = typeof fundingPledges.$inferInsert;
```

`ordersRelations`에 `fundingPledge: one(fundingPledges, { fields: [orders.id], references: [fundingPledges.orderId] })`를 추가한다(one-to-one 조회용).

- [ ] **Step 4: 마이그레이션 생성**

`npm run db:generate` → `drizzle/migrations/0009_<name>.sql` 생성 확인. SQL을 열어 `CREATE TABLE funding_pledges`와 `funding_pledges_order_id_unique` 인덱스가 있는지 본다. `orders.type`은 SQLite `text`라 enum 변경은 SQL 변경이 없다(정상).

- [ ] **Step 5: 통과 확인**

`npx jest db/schema.funding.test.ts` → PASS. `npx jest lib/booking` → 기존 통합 테스트도 PASS(마이그레이션 추가로 깨지지 않는지).

- [ ] **Step 6: 커밋**

```bash
git add db/schema.ts db/schema.funding.test.ts drizzle/migrations
git commit -m "feat(funding): orders.type에 funding 추가 + funding_pledges 테이블"
```

---

### Task 2: 프로젝트 파일 로더·상태 판정 (`lib/funding/projects.ts`)

**Files:**
- Create: `lib/funding/projects.ts`, `lib/funding/projects.test.ts`, `content/funding/smoke-test.md`, `public/images/funding/smoke-test/cover.webp` (기존 `public/images/room1.webp`를 복사)

**Interfaces:**
- Produces:
```ts
export interface FundingReward { id: string; title: string; description: string; amount: number; totalQuantity: number | null; requiresShipping: boolean; estimatedDelivery: string; image: string | null }
export interface FundingProject { slug: string; title: string; summary: string; cover: string; ogImage: string | null; goalAmount: number; startAt: string; endAt: string; status: 'auto'|'draft'|'closed'; hidden: boolean; lastmod: string; rewards: FundingReward[]; content: string }
export type ProjectState = 'draft' | 'upcoming' | 'live' | 'closed';
export const FUNDING_DIR: string;
export const parseFundingProject = (raw: string, slug: string): FundingProject; // 검증 실패 시 throw Error(사유)
export const getFundingProject = (slug: string): FundingProject | null;
export const getAllFundingProjects = (): FundingProject[];  // hidden·draft 포함 전체
export const getListableFundingProjects = (): FundingProject[]; // hidden 제외·draft 제외, live→upcoming→closed 순
export const computeProjectState = (project: Pick<FundingProject,'status'|'startAt'|'endAt'>, now: Date): ProjectState;
export const findReward = (project: FundingProject, rewardId: string): FundingReward | undefined;
```

- [ ] **Step 1: 픽스처와 실패하는 테스트**

`content/funding/smoke-test.md`:
```md
---
slug: smoke-test
title: 결제 스모크 테스트 프로젝트
summary: 라이브 결제 검증용. 목록·사이트맵에 나오지 않는다.
cover: /images/funding/smoke-test/cover.webp
goalAmount: 10000
startAt: 2026-09-01T00:00:00+09:00
endAt: 2027-12-31T23:59:59+09:00
status: draft
hidden: true
lastmod: 2026-09-09
rewards:
  - id: thanks
    title: 감사 메일
    description: 검증용 1,000원 리워드. 결제 후 셀프 취소로 전액 환불된다.
    amount: 1000
    requiresShipping: false
    estimatedDelivery: 2026-10
---
운영자가 토스 실결제와 무통장 흐름을 검증할 때만 쓰는 프로젝트입니다.
```

`lib/funding/projects.test.ts`:
```ts
/** @jest-environment node */
import { computeProjectState, findReward, getFundingProject, getListableFundingProjects, parseFundingProject } from './projects';

const RAW = `---
slug: demo
title: 데모
summary: 요약
cover: /images/funding/demo/cover.webp
goalAmount: 1000000
startAt: 2026-10-01T10:00:00+09:00
endAt: 2026-10-31T23:59:59+09:00
rewards:
  - id: cd
    title: CD
    description: 설명
    amount: 30000
    totalQuantity: 10
    requiresShipping: true
    estimatedDelivery: 2026-12
---
본문`;

describe('parseFundingProject', () => {
  it('frontmatter를 파싱하고 기본값을 채운다', () => {
    const p = parseFundingProject(RAW, 'demo');
    expect(p.status).toBe('auto');
    expect(p.hidden).toBe(false);
    expect(p.rewards[0]).toMatchObject({ id: 'cd', totalQuantity: 10, requiresShipping: true, image: null });
    expect(p.content.trim()).toBe('본문');
  });
  it('slug가 파일명과 다르면 던진다', () => {
    expect(() => parseFundingProject(RAW, 'other')).toThrow(/slug/);
  });
  it('리워드 id가 중복이면 던진다', () => {
    const dup = RAW.replace('rewards:', 'rewards:\n  - id: cd\n    title: X\n    description: d\n    amount: 1000\n    requiresShipping: false\n    estimatedDelivery: 2026-12');
    expect(() => parseFundingProject(dup, 'demo')).toThrow(/중복/);
  });
  it('리워드가 없거나 startAt ≥ endAt이면 던진다', () => {
    expect(() => parseFundingProject(RAW.replace(/rewards:[\s\S]*---\n본문/, '---\n본문'), 'demo')).toThrow();
    expect(() => parseFundingProject(RAW.replace('2026-10-31', '2026-09-30'), 'demo')).toThrow(/endAt/);
  });
});

describe('computeProjectState', () => {
  const p = { status: 'auto' as const, startAt: '2026-10-01T10:00:00+09:00', endAt: '2026-10-31T23:59:59+09:00' };
  it('시작 전 upcoming, 기간 중 live, 종료 후 closed', () => {
    expect(computeProjectState(p, new Date('2026-10-01T00:59:59Z'))).toBe('upcoming'); // KST 09:59
    expect(computeProjectState(p, new Date('2026-10-01T01:00:00Z'))).toBe('live');     // KST 10:00
    expect(computeProjectState(p, new Date('2026-10-31T14:59:59Z'))).toBe('live');     // KST 23:59:59
    expect(computeProjectState(p, new Date('2026-10-31T15:00:00Z'))).toBe('closed');   // KST 24:00
  });
  it('status 덮어쓰기', () => {
    expect(computeProjectState({ ...p, status: 'draft' }, new Date('2026-10-15T00:00:00Z'))).toBe('draft');
    expect(computeProjectState({ ...p, status: 'closed' }, new Date('2026-10-15T00:00:00Z'))).toBe('closed');
  });
});

describe('파일 로더', () => {
  it('smoke-test 프로젝트를 읽고, 목록에서는 뺀다', () => {
    const p = getFundingProject('smoke-test');
    expect(p?.hidden).toBe(true);
    expect(findReward(p!, 'thanks')?.amount).toBe(1000);
    expect(getListableFundingProjects().some((x) => x.slug === 'smoke-test')).toBe(false);
    expect(getFundingProject('없는-슬러그')).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx jest lib/funding/projects.test.ts` → 모듈 없음.

- [ ] **Step 3: 구현**

`lib/funding/projects.ts`:
```ts
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

export interface FundingReward {
  id: string; title: string; description: string; amount: number;
  totalQuantity: number | null; requiresShipping: boolean; estimatedDelivery: string; image: string | null;
}
export interface FundingProject {
  slug: string; title: string; summary: string; cover: string; ogImage: string | null;
  goalAmount: number; startAt: string; endAt: string; status: 'auto' | 'draft' | 'closed';
  hidden: boolean; lastmod: string; rewards: FundingReward[]; content: string;
}
export type ProjectState = 'draft' | 'upcoming' | 'live' | 'closed';

export const FUNDING_DIR = path.join(process.cwd(), 'content', 'funding');

const str = (v: unknown, name: string): string => {
  if (typeof v !== 'string' || v.trim() === '') throw new Error(`funding frontmatter: ${name}은(는) 비어 있지 않은 문자열이어야 합니다`);
  return v;
};
const posInt = (v: unknown, name: string): number => {
  if (typeof v !== 'number' || !Number.isInteger(v) || v <= 0) throw new Error(`funding frontmatter: ${name}은(는) 양의 정수여야 합니다`);
  return v;
};
const isoDate = (v: unknown, name: string): string => {
  const s = v instanceof Date ? v.toISOString() : str(v, name);
  if (Number.isNaN(new Date(s).getTime())) throw new Error(`funding frontmatter: ${name}이(가) 날짜가 아닙니다`);
  return s;
};

const parseReward = (raw: unknown, index: number): FundingReward => {
  if (typeof raw !== 'object' || raw === null) throw new Error(`funding frontmatter: rewards[${index}] 형식 오류`);
  const r = raw as Record<string, unknown>;
  return {
    id: str(r.id, `rewards[${index}].id`),
    title: str(r.title, `rewards[${index}].title`),
    description: str(r.description, `rewards[${index}].description`),
    amount: posInt(r.amount, `rewards[${index}].amount`),
    totalQuantity: r.totalQuantity === undefined || r.totalQuantity === null ? null : posInt(r.totalQuantity, `rewards[${index}].totalQuantity`),
    requiresShipping: r.requiresShipping === true,
    estimatedDelivery: str(r.estimatedDelivery, `rewards[${index}].estimatedDelivery`),
    image: typeof r.image === 'string' && r.image !== '' ? r.image : null,
  };
};

export const parseFundingProject = (raw: string, slug: string): FundingProject => {
  const { data, content } = matter(raw);
  const d = data as Record<string, unknown>;
  if (str(d.slug, 'slug') !== slug) throw new Error(`funding frontmatter: slug(${d.slug})가 파일명(${slug})과 다릅니다`);
  const startAt = isoDate(d.startAt, 'startAt');
  const endAt = isoDate(d.endAt, 'endAt');
  if (new Date(startAt).getTime() >= new Date(endAt).getTime()) throw new Error('funding frontmatter: endAt은 startAt보다 뒤여야 합니다');
  const rewardsRaw = Array.isArray(d.rewards) ? d.rewards : [];
  if (rewardsRaw.length === 0) throw new Error('funding frontmatter: rewards가 1개 이상이어야 합니다');
  const rewards = rewardsRaw.map(parseReward);
  const ids = new Set<string>();
  for (const r of rewards) {
    if (ids.has(r.id)) throw new Error(`funding frontmatter: 리워드 id 중복 — ${r.id}`);
    ids.add(r.id);
  }
  const status = d.status === 'draft' || d.status === 'closed' ? d.status : 'auto';
  return {
    slug,
    title: str(d.title, 'title'),
    summary: str(d.summary, 'summary'),
    cover: str(d.cover, 'cover'),
    ogImage: typeof d.ogImage === 'string' && d.ogImage !== '' ? d.ogImage : null,
    goalAmount: posInt(d.goalAmount, 'goalAmount'),
    startAt, endAt, status,
    hidden: d.hidden === true,
    lastmod: d.lastmod instanceof Date ? d.lastmod.toISOString().slice(0, 10) : typeof d.lastmod === 'string' ? d.lastmod : startAt.slice(0, 10),
    rewards, content,
  };
};

export const computeProjectState = (
  project: Pick<FundingProject, 'status' | 'startAt' | 'endAt'>, now: Date,
): ProjectState => {
  if (project.status === 'draft') return 'draft';
  if (project.status === 'closed') return 'closed';
  const t = now.getTime();
  if (t < new Date(project.startAt).getTime()) return 'upcoming';
  if (t < new Date(project.endAt).getTime()) return 'live';
  return 'closed';
};

export const getFundingProject = (slug: string): FundingProject | null => {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  const file = path.join(FUNDING_DIR, `${slug}.md`);
  if (!fs.existsSync(file)) return null;
  return parseFundingProject(fs.readFileSync(file, 'utf-8'), slug);
};

export const getAllFundingProjects = (): FundingProject[] => {
  if (!fs.existsSync(FUNDING_DIR)) return [];
  return fs.readdirSync(FUNDING_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => parseFundingProject(fs.readFileSync(path.join(FUNDING_DIR, f), 'utf-8'), f.replace(/\.md$/, '')));
};

const STATE_ORDER: Record<ProjectState, number> = { live: 0, upcoming: 1, closed: 2, draft: 3 };

export const getListableFundingProjects = (now: Date = new Date()): FundingProject[] =>
  getAllFundingProjects()
    .filter((p) => !p.hidden && computeProjectState(p, now) !== 'draft')
    .sort((a, b) => STATE_ORDER[computeProjectState(a, now)] - STATE_ORDER[computeProjectState(b, now)]
      || new Date(b.startAt).getTime() - new Date(a.startAt).getTime());

export const findReward = (project: FundingProject, rewardId: string): FundingReward | undefined =>
  project.rewards.find((r) => r.id === rewardId);
```

`cp public/images/room1.webp public/images/funding/smoke-test/cover.webp` (디렉터리 생성 포함).

- [ ] **Step 4: 통과 확인** — `npx jest lib/funding/projects.test.ts` → PASS.

- [ ] **Step 5: 커밋**

```bash
git add lib/funding/projects.ts lib/funding/projects.test.ts content/funding/smoke-test.md public/images/funding/smoke-test/cover.webp
git commit -m "feat(funding): 프로젝트 파일 로더·frontmatter 검증·상태 판정 + 스모크 프로젝트"
```

---

### Task 3: 금액·정책·검증 (순수 모듈)

**Files:**
- Create: `lib/funding/amounts.ts`, `lib/funding/policy.ts`, `lib/funding/validation.ts` + 각 `.test.ts`

**Interfaces:**
- Produces:
```ts
// amounts.ts
export interface FundingAmounts { itemAmount: number; vatAmount: number; totalAmount: number }
export const computeFundingAmounts = (unitAmount: number, quantity: number, additionalAmount: number): FundingAmounts;
// policy.ts
export const TOSS_HOLD_SECONDS = 900; export const BANK_HOLD_SECONDS = 43200;
export const MAX_QUANTITY = 10; export const MAX_ADDITIONAL_AMOUNT = 5_000_000; export const ADDITIONAL_AMOUNT_STEP = 1000;
export const BANK_ACCOUNT = { bank: '카카오뱅크', number: '3333-12-5480849', holder: '황경하 / 스튜디오 놀' } as const;
export const PRIVACY_RETENTION_TEXT = '리워드 전달 완료 후 1년';
export type CancelEligibility = { ok: true } | { ok: false; code: 'not_paid' | 'project_not_live' | 'fulfilling' };
export const assessSelfCancel = (input: { orderStatus: string; projectState: ProjectState; fulfillmentStatus: string }): CancelEligibility;
// validation.ts
export interface CreatePledgePayload { projectSlug: string; rewardId: string; quantity: number; additionalAmount: number; paymentMethod: 'toss'|'bank_transfer'; customerName: string; customerPhone: string; customerEmail: string; supporterMessage?: string; displayNamePublic: boolean; shipping?: { name: string; phone: string; postcode: string; address1: string; address2?: string; memo?: string }; termsAgreed: true }
export const validateCreatePledgePayload = (body: unknown, project: FundingProject | null, now: Date): { ok: true; value: CreatePledgePayload; reward: FundingReward } | { ok: false; message: string };
```

- [ ] **Step 1: 실패하는 테스트**

`lib/funding/amounts.test.ts`:
```ts
import { computeFundingAmounts } from './amounts';
describe('computeFundingAmounts', () => {
  it('VAT 포함가를 공급가·VAT로 분해한다', () => {
    expect(computeFundingAmounts(30000, 2, 0)).toEqual({ itemAmount: 54545, vatAmount: 5455, totalAmount: 60000 });
    expect(computeFundingAmounts(1000, 1, 0)).toEqual({ itemAmount: 909, vatAmount: 91, totalAmount: 1000 });
  });
  it('추가 후원금을 합계에 더한다', () => {
    expect(computeFundingAmounts(30000, 1, 5000).totalAmount).toBe(35000);
  });
});
```

`lib/funding/policy.test.ts`:
```ts
import { assessSelfCancel } from './policy';
describe('assessSelfCancel', () => {
  it('paid + live + 발송 전이면 가능', () => {
    expect(assessSelfCancel({ orderStatus: 'paid', projectState: 'live', fulfillmentStatus: 'none' })).toEqual({ ok: true });
  });
  it.each([
    ['pending', 'live', 'none', 'not_paid'],
    ['paid', 'closed', 'none', 'project_not_live'],
    ['paid', 'live', 'preparing', 'fulfilling'],
  ])('%s/%s/%s → %s', (orderStatus, projectState, fulfillmentStatus, code) => {
    expect(assessSelfCancel({ orderStatus, projectState: projectState as never, fulfillmentStatus })).toEqual({ ok: false, code });
  });
});
```

`lib/funding/validation.test.ts`:
```ts
import { parseFundingProject } from './projects';
import { validateCreatePledgePayload } from './validation';

const project = parseFundingProject(`---
slug: demo
title: 데모
summary: 요약
cover: /c.webp
goalAmount: 1000000
startAt: 2026-10-01T10:00:00+09:00
endAt: 2026-10-31T23:59:59+09:00
rewards:
  - id: cd
    title: CD
    description: d
    amount: 30000
    totalQuantity: 10
    requiresShipping: true
    estimatedDelivery: 2026-12
  - id: mail
    title: 감사 메일
    description: d
    amount: 5000
    requiresShipping: false
    estimatedDelivery: 2026-11
---
`, 'demo');
const NOW = new Date('2026-10-15T00:00:00Z');
const base = {
  projectSlug: 'demo', rewardId: 'mail', quantity: 1, additionalAmount: 0, paymentMethod: 'toss',
  customerName: '김후원', customerPhone: '010-1234-5678', customerEmail: 'a@b.com', displayNamePublic: true, termsAgreed: true,
};

describe('validateCreatePledgePayload', () => {
  it('정상 입력', () => {
    const r = validateCreatePledgePayload(base, project, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.reward.id).toBe('mail');
  });
  it('프로젝트 없음·live 아님', () => {
    expect(validateCreatePledgePayload(base, null, NOW).ok).toBe(false);
    expect(validateCreatePledgePayload(base, project, new Date('2026-11-05T00:00:00Z')).ok).toBe(false);
  });
  it('한정 수량 리워드는 무통장 불가', () => {
    const r = validateCreatePledgePayload({ ...base, rewardId: 'cd', paymentMethod: 'bank_transfer', shipping: { name: 'a', phone: '010', postcode: '1', address1: 'x' } }, project, NOW);
    expect(r).toMatchObject({ ok: false, message: expect.stringContaining('무통장') });
  });
  it('배송 리워드는 배송지 필수', () => {
    expect(validateCreatePledgePayload({ ...base, rewardId: 'cd' }, project, NOW).ok).toBe(false);
  });
  it('수량·추가 후원금 범위·약관·이메일', () => {
    expect(validateCreatePledgePayload({ ...base, quantity: 11 }, project, NOW).ok).toBe(false);
    expect(validateCreatePledgePayload({ ...base, additionalAmount: 1500 }, project, NOW).ok).toBe(false);
    expect(validateCreatePledgePayload({ ...base, additionalAmount: 6_000_000 }, project, NOW).ok).toBe(false);
    expect(validateCreatePledgePayload({ ...base, termsAgreed: false }, project, NOW).ok).toBe(false);
    expect(validateCreatePledgePayload({ ...base, customerEmail: 'nope' }, project, NOW).ok).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx jest lib/funding` → 3개 파일 FAIL.

- [ ] **Step 3: 구현**

`lib/funding/amounts.ts`:
```ts
export interface FundingAmounts { itemAmount: number; vatAmount: number; totalAmount: number }

/** 리워드가는 VAT 포함가. orders 규약(item + vat = total)에 맞춰 분해한다. */
export const computeFundingAmounts = (unitAmount: number, quantity: number, additionalAmount: number): FundingAmounts => {
  const totalAmount = unitAmount * quantity + additionalAmount;
  const itemAmount = Math.round(totalAmount / 1.1);
  return { itemAmount, vatAmount: totalAmount - itemAmount, totalAmount };
};
```

`lib/funding/policy.ts`:
```ts
import type { ProjectState } from './projects';

export const TOSS_HOLD_SECONDS = 900;
export const BANK_HOLD_SECONDS = 12 * 60 * 60;
export const MAX_QUANTITY = 10;
export const MAX_ADDITIONAL_AMOUNT = 5_000_000;
export const ADDITIONAL_AMOUNT_STEP = 1000;
/** 전자계약 기본 계좌와 동일(db/schema.ts contracts 기본값). */
export const BANK_ACCOUNT = { bank: '카카오뱅크', number: '3333-12-5480849', holder: '황경하 / 스튜디오 놀' } as const;
export const PRIVACY_RETENTION_TEXT = '리워드 전달 완료 후 1년';

export type CancelEligibility = { ok: true } | { ok: false; code: 'not_paid' | 'project_not_live' | 'fulfilling' };

/** 셀프 취소 가능 판정 — 스펙 §4.7. 셀프·관리자 화면이 같은 함수를 쓴다. */
export const assessSelfCancel = (input: { orderStatus: string; projectState: ProjectState; fulfillmentStatus: string }): CancelEligibility => {
  if (input.orderStatus !== 'paid') return { ok: false, code: 'not_paid' };
  if (input.projectState !== 'live') return { ok: false, code: 'project_not_live' };
  if (input.fulfillmentStatus !== 'none') return { ok: false, code: 'fulfilling' };
  return { ok: true };
};

export const CANCEL_BLOCK_MESSAGES: Record<Exclude<CancelEligibility, { ok: true }>['code'], string> = {
  not_paid: '결제가 확정된 후원만 취소할 수 있습니다.',
  project_not_live: '펀딩 마감 후에는 온라인 취소가 불가합니다. 청약철회는 약관에 따라 문의해 주세요.',
  fulfilling: '리워드 발송 준비가 시작되어 온라인 취소가 불가합니다. 문의해 주세요.',
};
```

`lib/funding/validation.ts`:
```ts
import isEmail from 'validator/lib/isEmail';

import { ADDITIONAL_AMOUNT_STEP, MAX_ADDITIONAL_AMOUNT, MAX_QUANTITY } from './policy';
import { computeProjectState, findReward, type FundingProject, type FundingReward } from './projects';

export interface PledgeShipping { name: string; phone: string; postcode: string; address1: string; address2?: string; memo?: string }
export interface CreatePledgePayload {
  projectSlug: string; rewardId: string; quantity: number; additionalAmount: number;
  paymentMethod: 'toss' | 'bank_transfer';
  customerName: string; customerPhone: string; customerEmail: string;
  supporterMessage?: string; displayNamePublic: boolean; shipping?: PledgeShipping; termsAgreed: true;
}
type Result = { ok: true; value: CreatePledgePayload; reward: FundingReward } | { ok: false; message: string };

const text = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() !== '' && v.trim().length <= max ? v.trim() : null;

export const validateCreatePledgePayload = (body: unknown, project: FundingProject | null, now: Date): Result => {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return { ok: false, message: '요청 형식이 올바르지 않습니다.' };
  const b = body as Record<string, unknown>;
  if (!project) return { ok: false, message: '프로젝트를 찾을 수 없습니다.' };
  if (computeProjectState(project, now) !== 'live') return { ok: false, message: '지금은 후원을 받지 않는 프로젝트입니다.' };
  const reward = typeof b.rewardId === 'string' ? findReward(project, b.rewardId) : undefined;
  if (!reward) return { ok: false, message: '리워드를 찾을 수 없습니다.' };
  const quantity = b.quantity;
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY)
    return { ok: false, message: `수량은 1~${MAX_QUANTITY} 사이여야 합니다.` };
  const additionalAmount = b.additionalAmount ?? 0;
  if (typeof additionalAmount !== 'number' || !Number.isInteger(additionalAmount) || additionalAmount < 0
    || additionalAmount > MAX_ADDITIONAL_AMOUNT || additionalAmount % ADDITIONAL_AMOUNT_STEP !== 0)
    return { ok: false, message: '추가 후원금은 1,000원 단위로 500만원까지 가능합니다.' };
  if (b.paymentMethod !== 'toss' && b.paymentMethod !== 'bank_transfer') return { ok: false, message: '결제수단을 선택해 주세요.' };
  if (b.paymentMethod === 'bank_transfer' && reward.totalQuantity !== null)
    return { ok: false, message: '한정 수량 리워드는 무통장입금으로 후원할 수 없습니다.' };
  const customerName = text(b.customerName, 50);
  const customerPhone = text(b.customerPhone, 30);
  const customerEmail = typeof b.customerEmail === 'string' && isEmail(b.customerEmail.trim()) ? b.customerEmail.trim() : null;
  if (!customerName || !customerPhone || !customerEmail) return { ok: false, message: '이름·연락처·이메일을 확인해 주세요.' };
  if (b.termsAgreed !== true) return { ok: false, message: '약관에 동의해 주세요.' };
  let shipping: PledgeShipping | undefined;
  if (reward.requiresShipping) {
    const s = (typeof b.shipping === 'object' && b.shipping !== null ? b.shipping : {}) as Record<string, unknown>;
    const name = text(s.name, 50), phone = text(s.phone, 30), postcode = text(s.postcode, 10), address1 = text(s.address1, 200);
    if (!name || !phone || !postcode || !address1) return { ok: false, message: '배송지를 모두 입력해 주세요.' };
    shipping = { name, phone, postcode, address1, address2: text(s.address2, 200) ?? undefined, memo: text(s.memo, 200) ?? undefined };
  }
  const supporterMessage = text(b.supporterMessage, 500) ?? undefined;
  return {
    ok: true, reward,
    value: {
      projectSlug: project.slug, rewardId: reward.id, quantity, additionalAmount, paymentMethod: b.paymentMethod,
      customerName, customerPhone, customerEmail, supporterMessage, displayNamePublic: b.displayNamePublic === true,
      shipping, termsAgreed: true,
    },
  };
};
```

- [ ] **Step 4: 통과 확인** — `npx jest lib/funding` → PASS.

- [ ] **Step 5: 커밋**

```bash
git add lib/funding/amounts.ts lib/funding/amounts.test.ts lib/funding/policy.ts lib/funding/policy.test.ts lib/funding/validation.ts lib/funding/validation.test.ts
git commit -m "feat(funding): 금액 분해·정책 상수·후원 입력 검증"
```

---

### Task 4: 후원 생성·조회·만료·집계 (`lib/funding/service.ts`)

**Files:**
- Create: `lib/funding/service.ts`, `lib/funding/service.integration.test.ts`

**Interfaces:**
- Consumes: Task 1 `fundingPledges`, Task 2 `FundingProject`/`FundingReward`, Task 3 `computeFundingAmounts`·`CreatePledgePayload`·홀드 상수, 기존 `generateManageToken`(`lib/booking/token.ts`), `kstDateString`.
- Produces:
```ts
export const generateFundingOrderNo = (now: Date, manual?: boolean): string; // 'FND-YYYYMMDD-XXXXXXXX' / 'FND-M-YYYYMMDD-XXXXXXXX'
export type FundingOrder = Order & { fundingPledge: FundingPledge | null; payments: Payment[] };
export const findFundingOrderByOrderNo = (orderNo: string): Promise<FundingOrder | undefined>;
export const findFundingOrderById = (id: string): Promise<FundingOrder | undefined>;
export const createFundingPledge = (payload: CreatePledgePayload, project: FundingProject, reward: FundingReward, now: Date)
  : Promise<{ ok: true; orderNo: string; manageToken: string; holdExpiresAt: Date; amounts: FundingAmounts } | { ok: false; code: 'sold_out' }>;
export const expireStalePledges = (now: Date): Promise<void>;
export interface ProjectStatus { raisedAmount: number; backerCount: number; remaining: Record<string, number | null>; publicBackers: string[] }
export const aggregateProjectStatus = (project: FundingProject, now: Date): Promise<ProjectStatus>;
```

- [ ] **Step 1: 실패하는 통합 테스트**

`lib/funding/service.integration.test.ts`:
```ts
/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { aggregateProjectStatus, createFundingPledge, expireStalePledges, findFundingOrderByOrderNo } from './service';
// eslint-disable-next-line import/first
import { parseFundingProject } from './projects';
// eslint-disable-next-line import/first
import type { CreatePledgePayload } from './validation';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const NOW = new Date('2026-10-15T03:00:00Z');
let client: Client;

export const PROJECT = parseFundingProject(`---
slug: demo
title: 데모
summary: 요약
cover: /c.webp
goalAmount: 100000
startAt: 2026-10-01T10:00:00+09:00
endAt: 2026-10-31T23:59:59+09:00
rewards:
  - id: cd
    title: CD
    description: d
    amount: 30000
    totalQuantity: 1
    requiresShipping: true
    estimatedDelivery: 2026-12
  - id: mail
    title: 감사 메일
    description: d
    amount: 5000
    requiresShipping: false
    estimatedDelivery: 2026-11
---
`, 'demo');

export const payloadFor = (over: Partial<CreatePledgePayload> = {}): CreatePledgePayload => ({
  projectSlug: 'demo', rewardId: 'mail', quantity: 1, additionalAmount: 0, paymentMethod: 'toss',
  customerName: '김후원', customerPhone: '010-1111-2222', customerEmail: 'a@example.com',
  displayNamePublic: true, termsAgreed: true, ...over,
});

beforeAll(async () => {
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const s of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (s.trim()) await client.execute(s.trim());
    }
  }
});
beforeEach(async () => {
  await client.execute('DELETE FROM funding_pledges');
  await client.execute('DELETE FROM payments');
  await client.execute('DELETE FROM orders');
});
afterAll(() => client.close());

const reward = (id: string) => PROJECT.rewards.find((r) => r.id === id)!;

describe('createFundingPledge', () => {
  it('주문·후원을 만들고 금액을 서버가 계산한다', async () => {
    const r = await createFundingPledge(payloadFor({ additionalAmount: 1000 }), PROJECT, reward('mail'), NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.orderNo).toMatch(/^FND-20261015-[0-9A-F]{8}$/);
    expect(r.amounts.totalAmount).toBe(6000);
    expect(r.holdExpiresAt.getTime()).toBe(NOW.getTime() + 900 * 1000);
    const order = await findFundingOrderByOrderNo(r.orderNo);
    expect(order?.type).toBe('funding');
    expect(order?.fundingPledge?.rewardTitle).toBe('감사 메일');
  });

  it('한정 수량 1개에 두 번 후원하면 두 번째는 sold_out', async () => {
    const shipping = { name: '김후원', phone: '010', postcode: '03000', address1: '서울' };
    const first = await createFundingPledge(payloadFor({ rewardId: 'cd', shipping, customerEmail: 'x@example.com' }), PROJECT, reward('cd'), NOW);
    const second = await createFundingPledge(payloadFor({ rewardId: 'cd', shipping, customerEmail: 'y@example.com', customerPhone: '010-9' }), PROJECT, reward('cd'), NOW);
    expect(first.ok).toBe(true);
    expect(second).toEqual({ ok: false, code: 'sold_out' });
  });

  it('홀드가 지난 pending은 재고를 잡지 않는다', async () => {
    const shipping = { name: '김후원', phone: '010', postcode: '03000', address1: '서울' };
    await createFundingPledge(payloadFor({ rewardId: 'cd', shipping }), PROJECT, reward('cd'), new Date(NOW.getTime() - 1000 * 1000));
    const later = await createFundingPledge(payloadFor({ rewardId: 'cd', shipping, customerEmail: 'z@example.com', customerPhone: '010-8' }), PROJECT, reward('cd'), NOW);
    expect(later.ok).toBe(true);
  });

  it('같은 고객의 기존 pending을 만료시킨다(자기 홀드 해제)', async () => {
    const a = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    const prev = await findFundingOrderByOrderNo(a.ok ? a.orderNo : '');
    expect(prev?.status).toBe('expired');
  });
});

describe('expireStalePledges · aggregateProjectStatus', () => {
  it('만료 pending은 expired, 집계는 paid만 센다', async () => {
    const stale = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), new Date(NOW.getTime() - 2000 * 1000));
    const paid = await createFundingPledge(payloadFor({ customerEmail: 'p@example.com', customerPhone: '010-7', additionalAmount: 2000 }), PROJECT, reward('mail'), NOW);
    await client.execute({ sql: "UPDATE orders SET status='paid' WHERE order_no=?", args: [paid.ok ? paid.orderNo : ''] });
    await expireStalePledges(NOW);
    expect((await findFundingOrderByOrderNo(stale.ok ? stale.orderNo : ''))?.status).toBe('expired');
    const s = await aggregateProjectStatus(PROJECT, NOW);
    expect(s).toEqual({ raisedAmount: 7000, backerCount: 1, remaining: { cd: 1, mail: null }, publicBackers: ['김후원'] });
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx jest lib/funding/service.integration.test.ts` → 모듈 없음.

- [ ] **Step 3: 구현**

`lib/funding/service.ts`:
```ts
import { randomBytes, randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { orders, type FundingPledge, type Order, type Payment } from '../../db/schema';
import { kstDateString } from '../booking/kst';
import { generateManageToken } from '../booking/token';
import { computeFundingAmounts, type FundingAmounts } from './amounts';
import { BANK_HOLD_SECONDS, TOSS_HOLD_SECONDS } from './policy';
import type { FundingProject, FundingReward } from './projects';
import type { CreatePledgePayload } from './validation';

const toEpoch = (d: Date): number => Math.floor(d.getTime() / 1000);

export const generateFundingOrderNo = (now: Date, manual = false): string =>
  `FND-${manual ? 'M-' : ''}${kstDateString(now).replace(/-/g, '')}-${randomBytes(4).toString('hex').toUpperCase()}`;

export type FundingOrder = Order & { fundingPledge: FundingPledge | null; payments: Payment[] };

export const findFundingOrderByOrderNo = async (orderNo: string): Promise<FundingOrder | undefined> => {
  const row = await getDb().query.orders.findFirst({
    where: (t, { eq }) => eq(t.orderNo, orderNo),
    with: { fundingPledge: true, payments: true },
  });
  return row?.type === 'funding' ? (row as FundingOrder) : undefined;
};

export const findFundingOrderById = async (id: string): Promise<FundingOrder | undefined> => {
  const row = await getDb().query.orders.findFirst({
    where: (t, { eq }) => eq(t.id, id),
    with: { fundingPledge: true, payments: true },
  });
  return row?.type === 'funding' ? (row as FundingOrder) : undefined;
};

/**
 * 재고 조건이 붙은 단일 INSERT — 동시 요청은 한쪽만 rowsAffected 1.
 * remaining = totalQuantity − Σpaid − Σ(pending ∧ hold 미만료). 무제한이면 조건 없음.
 */
export const createFundingPledge = async (
  payload: CreatePledgePayload, project: FundingProject, reward: FundingReward, now: Date,
): Promise<{ ok: true; orderNo: string; manageToken: string; holdExpiresAt: Date; amounts: FundingAmounts } | { ok: false; code: 'sold_out' }> => {
  const db = getDb();
  const amounts = computeFundingAmounts(reward.amount, payload.quantity, payload.additionalAmount);
  const orderNo = generateFundingOrderNo(now);
  const manageToken = generateManageToken();
  const holdSeconds = payload.paymentMethod === 'toss' ? TOSS_HOLD_SECONDS : BANK_HOLD_SECONDS;
  const holdExpiresAt = new Date(now.getTime() + holdSeconds * 1000);

  // 자기 홀드 해제 — 위저드에서 되돌아가 재제출한 같은 고객의 pending 펀딩 주문을 만료시킨다.
  await db.run(sql`
    UPDATE orders SET status = 'expired', updated_at = unixepoch()
    WHERE type = 'funding' AND status = 'pending'
      AND customer_email = ${payload.customerEmail} AND customer_phone = ${payload.customerPhone}
  `);

  const [order] = await db.insert(orders).values({
    orderNo, type: 'funding',
    customerName: payload.customerName, customerPhone: payload.customerPhone, customerEmail: payload.customerEmail,
    itemAmount: amounts.itemAmount, vatAmount: amounts.vatAmount, totalAmount: amounts.totalAmount,
    manageToken,
  }).returning({ id: orders.id });

  const pledgeId = randomUUID().replace(/-/g, '');
  const s = payload.shipping;
  const stockCondition = reward.totalQuantity === null
    ? sql`1 = 1`
    : sql`(
        SELECT COALESCE(SUM(fp.quantity), 0) FROM funding_pledges fp
        JOIN orders o ON o.id = fp.order_id
        WHERE fp.project_slug = ${project.slug} AND fp.reward_id = ${reward.id}
          AND (o.status = 'paid' OR (o.status = 'pending' AND fp.hold_expires_at > ${toEpoch(now)}))
      ) + ${payload.quantity} <= ${reward.totalQuantity}`;

  const result = await db.run(sql`
    INSERT INTO funding_pledges (
      id, order_id, project_slug, reward_id, reward_title, unit_amount, quantity, additional_amount,
      payment_method, hold_expires_at, supporter_message, display_name_public,
      shipping_name, shipping_phone, shipping_postcode, shipping_address1, shipping_address2, shipping_memo
    )
    SELECT ${pledgeId}, ${order.id}, ${project.slug}, ${reward.id}, ${reward.title}, ${reward.amount},
           ${payload.quantity}, ${payload.additionalAmount}, ${payload.paymentMethod}, ${toEpoch(holdExpiresAt)},
           ${payload.supporterMessage ?? null}, ${payload.displayNamePublic ? 1 : 0},
           ${s?.name ?? null}, ${s?.phone ?? null}, ${s?.postcode ?? null}, ${s?.address1 ?? null}, ${s?.address2 ?? null}, ${s?.memo ?? null}
    WHERE ${stockCondition}
  `);

  if (Number(result.rowsAffected) === 0) {
    await db.run(sql`UPDATE orders SET status = 'failed', updated_at = unixepoch() WHERE id = ${order.id} AND status = 'pending'`);
    return { ok: false, code: 'sold_out' };
  }
  return { ok: true, orderNo, manageToken, holdExpiresAt, amounts };
};

/** 홀드가 지난 pending 펀딩 주문을 expired로. 상태 API·생성·관리자 목록·confirm 진입에서 lazy 호출. */
export const expireStalePledges = async (now: Date): Promise<void> => {
  await getDb().run(sql`
    UPDATE orders SET status = 'expired', updated_at = unixepoch()
    WHERE type = 'funding' AND status = 'pending'
      AND id IN (SELECT order_id FROM funding_pledges WHERE hold_expires_at < ${toEpoch(now)})
  `);
};

export interface ProjectStatus {
  raisedAmount: number; backerCount: number; remaining: Record<string, number | null>; publicBackers: string[];
}

export const aggregateProjectStatus = async (project: FundingProject, now: Date): Promise<ProjectStatus> => {
  const db = getDb();
  const totals = await db.all<{ raised: number | null; backers: number | null }>(sql`
    SELECT SUM(o.total_amount) AS raised, COUNT(*) AS backers
    FROM orders o JOIN funding_pledges fp ON fp.order_id = o.id
    WHERE fp.project_slug = ${project.slug} AND o.status = 'paid'
  `);
  const claimed = await db.all<{ reward_id: string; qty: number }>(sql`
    SELECT fp.reward_id, SUM(fp.quantity) AS qty
    FROM funding_pledges fp JOIN orders o ON o.id = fp.order_id
    WHERE fp.project_slug = ${project.slug}
      AND (o.status = 'paid' OR (o.status = 'pending' AND fp.hold_expires_at > ${toEpoch(now)}))
    GROUP BY fp.reward_id
  `);
  const claimedBy = new Map(claimed.map((r) => [r.reward_id, Number(r.qty)]));
  const remaining: Record<string, number | null> = {};
  for (const r of project.rewards) {
    remaining[r.id] = r.totalQuantity === null ? null : Math.max(0, r.totalQuantity - (claimedBy.get(r.id) ?? 0));
  }
  const names = await db.all<{ customer_name: string }>(sql`
    SELECT o.customer_name FROM orders o JOIN funding_pledges fp ON fp.order_id = o.id
    WHERE fp.project_slug = ${project.slug} AND o.status = 'paid' AND fp.display_name_public = 1
    ORDER BY fp.paid_at DESC, o.created_at DESC LIMIT 100
  `);
  return {
    raisedAmount: Number(totals[0]?.raised ?? 0),
    backerCount: Number(totals[0]?.backers ?? 0),
    remaining,
    publicBackers: names.map((n) => n.customer_name),
  };
};
```

- [ ] **Step 4: 통과 확인** — `npx jest lib/funding/service.integration.test.ts` → PASS.

- [ ] **Step 5: 커밋**

```bash
git add lib/funding/service.ts lib/funding/service.integration.test.ts
git commit -m "feat(funding): 후원 생성(재고 조건 INSERT)·조회·만료·집계"
```

---

### Task 5: 토스 승인 확정 + 웹훅 type 분기

**Files:**
- Create: `lib/funding/confirm.ts`, `lib/funding/confirm.integration.test.ts`
- Modify: `lib/booking/webhook.ts` (`processTossWebhook` DONE/CANCELED 처리부, `syncCancelledFromToss` 앞)
- Test: `lib/booking/webhook.test.ts`에 케이스 추가

**Interfaces:**
- Consumes: Task 4 `findFundingOrderByOrderNo`, `expireStalePledges`; 기존 `confirmPayment`·`fetchPayment`(`lib/booking/toss.ts`).
- Produces:
```ts
export type FundingConfirmOutcome =
  | { ok: true; orderNo: string; manageToken: string; projectSlug: string; emailSent?: boolean }
  | { ok: false; code: 'not_found' | 'amount_mismatch' | 'invalid_state' | 'toss_rejected' | 'recording_failed'; message: string };
export const confirmFundingPledge = (input: { orderNo: string; paymentKey: string; amount: number }): Promise<FundingConfirmOutcome>;
export const syncFundingCancelledFromToss = (payment: TossPayment): Promise<void>;
```
Task 7의 `sendFundingConfirmedEmails(order)`를 호출한다 — Task 5 단계에서는 `lib/funding/email.ts`에 아래 스텁을 먼저 만든다(Task 7이 본문을 채운다):
```ts
export const sendFundingConfirmedEmails = async (_order: FundingOrder, _project: FundingProject | null): Promise<string | null> => null;
```

- [ ] **Step 1: 실패하는 테스트**

`lib/funding/confirm.integration.test.ts` (셋업은 Task 4 테스트와 동일 — `jest.mock('../../db/client')`, 마이그레이션 적용, `beforeEach` DELETE 3개. 추가로):
```ts
jest.mock('../booking/toss', () => ({ confirmPayment: jest.fn(), fetchPayment: jest.fn() }));
jest.mock('./email', () => ({ sendFundingConfirmedEmails: jest.fn().mockResolvedValue(null) }));
// eslint-disable-next-line import/first
import { confirmFundingPledge } from './confirm';
// eslint-disable-next-line import/first
import { confirmPayment } from './toss-reexport-not-needed'; // ← 실제로는 '../booking/toss'
```
(위 두 줄은 설명용 — 실제 import는 `import { confirmPayment } from '../booking/toss';`)

```ts
const mockConfirm = confirmPayment as jest.Mock;
const approved = (orderNo: string, amount: number) => ({
  ok: true, payment: { paymentKey: 'pk_1', orderId: orderNo, status: 'DONE', totalAmount: amount, method: '카드', approvedAt: '2026-10-15T03:01:00Z' },
});

describe('confirmFundingPledge', () => {
  it('금액이 맞으면 승인하고 paid·payments·paidAt을 기록한다', async () => {
    const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    if (!c.ok) throw new Error();
    mockConfirm.mockResolvedValueOnce(approved(c.orderNo, 5000));
    const r = await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 });
    expect(r).toMatchObject({ ok: true, orderNo: c.orderNo, projectSlug: 'demo' });
    const o = await findFundingOrderByOrderNo(c.orderNo);
    expect(o?.status).toBe('paid');
    expect(o?.payments[0].paymentKey).toBe('pk_1');
    expect(o?.fundingPledge?.paidAt).toBeInstanceOf(Date);
  });
  it('이미 paid면 토스를 부르지 않고 성공(멱등)', async () => {
    const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    if (!c.ok) throw new Error();
    mockConfirm.mockResolvedValueOnce(approved(c.orderNo, 5000));
    await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 });
    mockConfirm.mockClear();
    const again = await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk_1', amount: 5000 });
    expect(again.ok).toBe(true);
    expect(mockConfirm).not.toHaveBeenCalled();
  });
  it('금액 불일치·홀드 만료는 토스를 부르지 않고 거부', async () => {
    const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW);
    if (!c.ok) throw new Error();
    expect((await confirmFundingPledge({ orderNo: c.orderNo, paymentKey: 'pk', amount: 4999 })).ok).toBe(false);
    const stale = await createFundingPledge(payloadFor({ customerEmail: 's@example.com', customerPhone: '010-0' }), PROJECT, reward('mail'), new Date(NOW.getTime() - 2000 * 1000));
    if (!stale.ok) throw new Error();
    const r = await confirmFundingPledge({ orderNo: stale.orderNo, paymentKey: 'pk', amount: 5000 });
    expect(r).toMatchObject({ ok: false, code: 'invalid_state' });
    expect(mockConfirm).not.toHaveBeenCalled();
  });
  it('예약 주문번호로 오면 not_found', async () => {
    expect((await confirmFundingPledge({ orderNo: 'SNB-20260101-ABCDEF12', paymentKey: 'pk', amount: 1 })).ok).toBe(false);
  });
});
```

`lib/booking/webhook.test.ts`에 추가(기존 파일의 mock 방식을 따른다 — `findOrderByOrderNo`·`fetchPayment`가 mock돼 있다):
```ts
jest.mock('../funding/confirm', () => ({
  confirmFundingPledge: jest.fn().mockResolvedValue({ ok: true, orderNo: 'FND-1', manageToken: 't', projectSlug: 'demo' }),
  syncFundingCancelledFromToss: jest.fn().mockResolvedValue(undefined),
}));
// ...
it('펀딩 주문의 DONE 웹훅은 confirmFundingPledge로 간다', async () => {
  (fetchPayment as jest.Mock).mockResolvedValueOnce({ ok: true, payment: { paymentKey: 'pk_f', orderId: 'FND-1', status: 'DONE', totalAmount: 5000 } });
  (findOrderByOrderNo as jest.Mock).mockResolvedValueOnce({ id: 'o', orderNo: 'FND-1', type: 'funding', status: 'pending', totalAmount: 5000, bookings: [], payments: [] });
  const { status } = await processTossWebhook({ data: { paymentKey: 'pk_f', status: 'DONE' } });
  expect(status).toBe(200);
  expect(confirmFundingPledge).toHaveBeenCalledWith({ orderNo: 'FND-1', paymentKey: 'pk_f', amount: 5000 });
  expect(confirmBookingPayment).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 실패 확인** — `npx jest lib/funding/confirm lib/booking/webhook` → FAIL.

- [ ] **Step 3: 구현**

`lib/funding/email.ts` 스텁(위 Interfaces 참고)을 먼저 만든다.

`lib/funding/confirm.ts`:
```ts
import { and, eq, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingPledges, orders, payments, refunds } from '../../db/schema';
import { confirmPayment, fetchPayment, type TossPayment } from '../booking/toss';
import { sendFundingConfirmedEmails } from './email';
import { getFundingProject } from './projects';
import { findFundingOrderByOrderNo, type FundingOrder } from './service';

export type FundingConfirmOutcome =
  | { ok: true; orderNo: string; manageToken: string; projectSlug: string; emailSent?: boolean }
  | { ok: false; code: 'not_found' | 'amount_mismatch' | 'invalid_state' | 'toss_rejected' | 'recording_failed'; message: string };

const ALREADY_PROCESSED_CODE = 'ALREADY_PROCESSED_PAYMENT';
const GENERIC = '결제 승인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
const EXPIRED = '결제 대기 시간이 만료된 후원입니다. 다시 후원해 주세요.';
const RECORDING_FAILED = '결제는 완료되었으나 후원 확정 처리가 지연되고 있습니다. 몇 분 내 자동 확정되며, 지속되면 010-4255-7893으로 연락 주세요.';

const success = (order: FundingOrder, emailSent?: boolean): FundingConfirmOutcome => ({
  ok: true, orderNo: order.orderNo, manageToken: order.manageToken, projectSlug: order.fundingPledge?.projectSlug ?? '',
  ...(emailSent === undefined ? {} : { emailSent }),
});

export const confirmFundingPledge = async (input: { orderNo: string; paymentKey: string; amount: number }): Promise<FundingConfirmOutcome> => {
  const order = await findFundingOrderByOrderNo(input.orderNo);
  if (!order || !order.fundingPledge) return { ok: false, code: 'not_found', message: '후원을 찾을 수 없습니다.' };
  if (order.status === 'paid') return success(order);
  if (order.status !== 'pending') return { ok: false, code: 'invalid_state', message: '이미 처리되었거나 만료된 후원입니다.' };
  if (input.amount !== order.totalAmount) return { ok: false, code: 'amount_mismatch', message: '결제 금액이 후원 내용과 일치하지 않습니다.' };
  if (order.fundingPledge.holdExpiresAt.getTime() < Date.now()) {
    console.error('[funding-confirm] 홀드 만료 주문의 승인 요청 — 토스를 부르지 않고 거부', { orderNo: order.orderNo });
    return { ok: false, code: 'invalid_state', message: EXPIRED };
  }

  const db = getDb();
  const toss = await confirmPayment({ paymentKey: input.paymentKey, orderId: order.orderNo, amount: input.amount });
  let approved: TossPayment;
  if (toss.ok) {
    approved = toss.payment;
  } else if (toss.code === ALREADY_PROCESSED_CODE) {
    const refetched = await fetchPayment(input.paymentKey);
    if (!refetched.ok || refetched.payment.status !== 'DONE' || refetched.payment.orderId !== order.orderNo || refetched.payment.totalAmount !== order.totalAmount) {
      console.error('[funding-confirm] 이미 처리된 결제의 재조회 검증 실패', { orderNo: order.orderNo, paymentKey: input.paymentKey });
      return { ok: false, code: 'toss_rejected', message: GENERIC };
    }
    approved = refetched.payment;
  } else {
    await db.run(sql`UPDATE orders SET status = 'failed', updated_at = unixepoch() WHERE id = ${order.id} AND status = 'pending'`);
    const internal = toss.code === 'CONFIG_ERROR' || toss.code === 'NETWORK_ERROR';
    console.error('[funding-confirm] 토스 승인 거부', { orderNo: order.orderNo, tossCode: toss.code, tossMessage: toss.message });
    return { ok: false, code: 'toss_rejected', message: internal ? GENERIC : toss.message };
  }

  const now = new Date();
  try {
    await db.batch([
      db.insert(payments).values({
        orderId: order.id, paymentKey: approved.paymentKey, method: approved.method ?? null,
        approvedAt: approved.approvedAt ? new Date(approved.approvedAt) : null,
        receiptUrl: approved.receipt?.url ?? null, rawResponse: JSON.stringify(approved),
      }),
      db.update(orders).set({ status: 'paid', updatedAt: now }).where(and(eq(orders.id, order.id), eq(orders.status, 'pending'))),
      db.update(fundingPledges).set({ paidAt: now, updatedAt: now }).where(eq(fundingPledges.orderId, order.id)),
    ]);
  } catch (error) {
    let existing: unknown;
    try {
      existing = await db.query.payments.findFirst({ where: (t, { eq: e }) => e(t.paymentKey, approved.paymentKey) });
    } catch (lookupError) {
      console.error('[funding-confirm] 멱등 판정 조회 실패', { orderNo: order.orderNo, error: lookupError });
    }
    if (existing) return success(order);
    console.error('[funding-confirm] 결제 승인됨, DB 기록 실패 — 웹훅 복구 대기', { orderNo: order.orderNo, paymentKey: approved.paymentKey, error });
    return { ok: false, code: 'recording_failed', message: RECORDING_FAILED };
  }

  const fresh = (await findFundingOrderByOrderNo(order.orderNo)) ?? order;
  const emailError = await sendFundingConfirmedEmails(fresh, getFundingProject(fresh.fundingPledge?.projectSlug ?? ''));
  if (emailError) {
    await db.update(orders).set({ notificationError: emailError }).where(eq(orders.id, order.id));
  }
  return success(fresh, emailError === null);
};

/** 토스 콘솔 등 외부에서 취소된 펀딩 결제를 DB에 반영만 한다(취소 API 재호출 없음). */
export const syncFundingCancelledFromToss = async (payment: TossPayment): Promise<void> => {
  const order = await findFundingOrderByOrderNo(payment.orderId);
  if (!order) return;
  const paymentRow = order.payments.find((p) => p.paymentKey === payment.paymentKey) ?? order.payments[0];
  if (!paymentRow) return;
  const db = getDb();
  const claim = await db.run(sql`UPDATE orders SET status = 'refunded', updated_at = unixepoch() WHERE id = ${order.id} AND status = 'paid'`);
  if (Number(claim.rowsAffected) === 0) return;
  const cancelled = payment.cancels?.reduce((sum, c) => sum + c.cancelAmount, 0) ?? order.totalAmount;
  await db.insert(refunds).values({
    paymentId: paymentRow.id, amount: cancelled, reason: '토스 외부 취소 동기화', requestedBy: 'webhook',
    tossTransactionKey: payment.cancels?.[payment.cancels.length - 1]?.transactionKey ?? null, status: 'done',
  });
};
```

`lib/booking/webhook.ts` 수정 — `processTossWebhook`의 처리 블록을 type 스위치로 바꾼다:
```ts
import { confirmFundingPledge, syncFundingCancelledFromToss } from '../funding/confirm';
// ...
  try {
    const order = await findOrderByOrderNo(payment.orderId);
    const orderType = order?.type ?? 'session';
    if (payment.status === 'DONE') {
      const outcome = orderType === 'funding'
        ? await confirmFundingPledge({ orderNo: payment.orderId, paymentKey, amount: payment.totalAmount })
        : await confirmBookingPayment({ orderNo: payment.orderId, paymentKey, amount: payment.totalAmount });
      if (!outcome.ok && isTransientConfirmFailure(outcome.code)) {
        console.error('[booking-webhook] 확정 처리 일시 실패 — 멱등 키 회수 후 재시도 유도', { eventKey, code: outcome.code });
        await releaseEventKey(eventKey);
        return { status: 500 };
      }
    } else if (payment.status === 'CANCELED' || payment.status === 'PARTIAL_CANCELED') {
      if (orderType === 'funding') await syncFundingCancelledFromToss(payment);
      else await syncCancelledFromToss(payment);
    }
  } catch (error) {
```
`isTransientConfirmFailure`의 인자 타입을 `'recording_failed' | 'toss_rejected' | 'not_found' | 'invalid_state' | 'amount_mismatch'` 문자열 유니온으로 넓힌다(두 Outcome이 같은 코드 집합을 쓴다).

- [ ] **Step 4: 통과 확인** — `npx jest lib/funding lib/booking/webhook` → PASS.

- [ ] **Step 5: 커밋**

```bash
git add lib/funding/confirm.ts lib/funding/confirm.integration.test.ts lib/funding/email.ts lib/booking/webhook.ts lib/booking/webhook.test.ts
git commit -m "feat(funding): 토스 승인 확정(멱등) + 웹훅 order.type 분기"
```

---

### Task 6: 취소·환불 + 무통장 입금 확인

**Files:**
- Create: `lib/funding/cancel.ts`, `lib/funding/bank-transfer.ts`, `lib/funding/cancel.integration.test.ts`

**Interfaces:**
- Consumes: Task 3 `assessSelfCancel`·`CANCEL_BLOCK_MESSAGES`, Task 4 `findFundingOrderByOrderNo`, Task 2 `getFundingProject`·`computeProjectState`, 기존 `cancelPayment`.
- Produces:
```ts
// cancel.ts
export type FundingCancelOutcome =
  | { ok: true; mode: 'refunded' | 'refund_requested' | 'recorded'; refundAmount: number }
  | { ok: false; code: 'not_found' | 'invalid_state' | 'toss_failed' | 'recording_failed'; message: string };
export const cancelFundingPledge = (input: { orderNo: string; requestedBy: 'customer' | 'admin'; reason: string; now: Date }): Promise<FundingCancelOutcome>;
// bank-transfer.ts
export const confirmBankDeposit = (input: { orderId: string; now: Date }): Promise<{ ok: true } | { ok: false; code: 'not_found' | 'invalid_state'; message: string }>;
```
규칙: 셀프(`customer`)는 `assessSelfCancel` 통과 필수. 관리자(`admin`)는 `paid`면 항상 가능. 토스 결제(payments 있음)는 전액 취소 → `refunds` + `refunded`(`mode:'refunded'`). 무통장: `customer`면 `refundRequestedAt` 기록(`mode:'refund_requested'`, 상태 유지), `admin`이면 `refunded`로 기록만(`mode:'recorded'`). 메일은 Task 7 스텁 `sendFundingCancelledEmails(order, project, mode)`를 호출.

- [ ] **Step 1: 실패하는 통합 테스트**

`lib/funding/cancel.integration.test.ts` (셋업 동일. `jest.mock('../booking/toss', () => ({ cancelPayment: jest.fn(), confirmPayment: jest.fn(), fetchPayment: jest.fn() }))`, `jest.mock('./email', ...)` 두 함수 모두 `null` 반환, `jest.mock('./projects', () => ({ ...jest.requireActual('./projects'), getFundingProject: () => PROJECT }))`):
```ts
const markPaidWithToss = async (orderNo: string) => {
  const o = await findFundingOrderByOrderNo(orderNo);
  await client.execute({ sql: "UPDATE orders SET status='paid' WHERE id=?", args: [o!.id] });
  await client.execute({ sql: "INSERT INTO payments (id,order_id,payment_key) VALUES ('p1',?, 'pk_c')", args: [o!.id] });
};

describe('cancelFundingPledge', () => {
  it('토스 결제 셀프 취소 → 전액 환불·refunded', async () => {
    const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW); if (!c.ok) throw new Error();
    await markPaidWithToss(c.orderNo);
    (cancelPayment as jest.Mock).mockResolvedValueOnce({ ok: true, payment: { paymentKey: 'pk_c', orderId: c.orderNo, status: 'CANCELED', totalAmount: 5000, cancels: [{ transactionKey: 'tx', cancelAmount: 5000 }] } });
    const r = await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'customer', reason: '고객 셀프 취소', now: NOW });
    expect(r).toEqual({ ok: true, mode: 'refunded', refundAmount: 5000 });
    expect(cancelPayment).toHaveBeenCalledWith(expect.objectContaining({ cancelAmount: 5000, idempotencyKey: `refund:${c.orderNo}:5000` }));
    expect((await findFundingOrderByOrderNo(c.orderNo))?.status).toBe('refunded');
  });
  it('토스가 거절하면 상태를 되돌리고 failed refund를 남긴다', async () => {
    const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW); if (!c.ok) throw new Error();
    await markPaidWithToss(c.orderNo);
    (cancelPayment as jest.Mock).mockResolvedValueOnce({ ok: false, code: 'X', message: '거절' });
    const r = await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'customer', reason: 'r', now: NOW });
    expect(r).toMatchObject({ ok: false, code: 'toss_failed' });
    expect((await findFundingOrderByOrderNo(c.orderNo))?.status).toBe('paid');
    const rows = await client.execute("SELECT status FROM refunds");
    expect(rows.rows[0].status).toBe('failed');
  });
  it('무통장 셀프 취소는 요청만 기록, 관리자는 refunded로 기록', async () => {
    const c = await createFundingPledge(payloadFor({ paymentMethod: 'bank_transfer' }), PROJECT, reward('mail'), NOW); if (!c.ok) throw new Error();
    await client.execute({ sql: "UPDATE orders SET status='paid' WHERE order_no=?", args: [c.orderNo] });
    expect(await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'customer', reason: 'r', now: NOW })).toEqual({ ok: true, mode: 'refund_requested', refundAmount: 5000 });
    expect((await findFundingOrderByOrderNo(c.orderNo))?.fundingPledge?.refundRequestedAt).toBeInstanceOf(Date);
    expect(await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'admin', reason: 'r', now: NOW })).toEqual({ ok: true, mode: 'recorded', refundAmount: 5000 });
    expect((await findFundingOrderByOrderNo(c.orderNo))?.status).toBe('refunded');
  });
  it('마감 후 셀프 취소는 거부, 관리자는 허용', async () => {
    const c = await createFundingPledge(payloadFor(), PROJECT, reward('mail'), NOW); if (!c.ok) throw new Error();
    await markPaidWithToss(c.orderNo);
    const after = new Date('2026-11-05T00:00:00Z');
    expect((await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'customer', reason: 'r', now: after })).ok).toBe(false);
    (cancelPayment as jest.Mock).mockResolvedValueOnce({ ok: true, payment: { paymentKey: 'pk_c', orderId: c.orderNo, status: 'CANCELED', totalAmount: 5000, cancels: [] } });
    expect((await cancelFundingPledge({ orderNo: c.orderNo, requestedBy: 'admin', reason: 'r', now: after })).ok).toBe(true);
  });
});

describe('confirmBankDeposit', () => {
  it('pending 무통장 → paid, expired도 되살린다, 토스 주문은 거부', async () => {
    const c = await createFundingPledge(payloadFor({ paymentMethod: 'bank_transfer' }), PROJECT, reward('mail'), NOW); if (!c.ok) throw new Error();
    const o = await findFundingOrderByOrderNo(c.orderNo);
    expect(await confirmBankDeposit({ orderId: o!.id, now: NOW })).toEqual({ ok: true });
    expect((await findFundingOrderByOrderNo(c.orderNo))?.status).toBe('paid');
    await client.execute({ sql: "UPDATE orders SET status='expired' WHERE id=?", args: [o!.id] });
    expect(await confirmBankDeposit({ orderId: o!.id, now: NOW })).toEqual({ ok: true });
    const t = await createFundingPledge(payloadFor({ customerEmail: 't@example.com', customerPhone: '010-5' }), PROJECT, reward('mail'), NOW); if (!t.ok) throw new Error();
    const to = await findFundingOrderByOrderNo(t.orderNo);
    expect((await confirmBankDeposit({ orderId: to!.id, now: NOW })).ok).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx jest lib/funding/cancel` → 모듈 없음.

- [ ] **Step 3: 구현**

`lib/funding/email.ts` 스텁에 추가:
```ts
export const sendFundingCancelledEmails = async (_order: FundingOrder, _project: FundingProject | null, _mode: 'refunded' | 'refund_requested' | 'recorded'): Promise<string | null> => null;
```

`lib/funding/cancel.ts`:
```ts
import { eq, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingPledges, orders, refunds } from '../../db/schema';
import { cancelPayment } from '../booking/toss';
import { sendFundingCancelledEmails } from './email';
import { assessSelfCancel, CANCEL_BLOCK_MESSAGES } from './policy';
import { computeProjectState, getFundingProject } from './projects';
import { findFundingOrderByOrderNo } from './service';

export type FundingCancelOutcome =
  | { ok: true; mode: 'refunded' | 'refund_requested' | 'recorded'; refundAmount: number }
  | { ok: false; code: 'not_found' | 'invalid_state' | 'toss_failed' | 'recording_failed'; message: string };

const GENERIC = '취소 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
const refundIdempotencyKey = (orderNo: string, amount: number): string => `refund:${orderNo}:${amount}`;

export const cancelFundingPledge = async (input: { orderNo: string; requestedBy: 'customer' | 'admin'; reason: string; now: Date }): Promise<FundingCancelOutcome> => {
  const order = await findFundingOrderByOrderNo(input.orderNo);
  if (!order || !order.fundingPledge) return { ok: false, code: 'not_found', message: '후원을 찾을 수 없습니다.' };
  const pledge = order.fundingPledge;
  const project = getFundingProject(pledge.projectSlug);
  if (order.status !== 'paid') return { ok: false, code: 'invalid_state', message: CANCEL_BLOCK_MESSAGES.not_paid };
  if (input.requestedBy === 'customer') {
    const verdict = assessSelfCancel({
      orderStatus: order.status,
      projectState: project ? computeProjectState(project, input.now) : 'closed',
      fulfillmentStatus: pledge.fulfillmentStatus,
    });
    if (!verdict.ok) return { ok: false, code: 'invalid_state', message: CANCEL_BLOCK_MESSAGES[verdict.code] };
  }
  const db = getDb();
  const payment = order.payments[0];

  // 무통장: 토스가 없으니 돈이 자동으로 나가지 않는다.
  if (pledge.paymentMethod === 'bank_transfer' || !payment) {
    if (input.requestedBy === 'customer') {
      await db.update(fundingPledges).set({ refundRequestedAt: input.now, updatedAt: input.now }).where(eq(fundingPledges.id, pledge.id));
      await sendFundingCancelledEmails(order, project, 'refund_requested');
      return { ok: true, mode: 'refund_requested', refundAmount: order.totalAmount };
    }
    const claim = await db.run(sql`UPDATE orders SET status = 'refunded', updated_at = unixepoch() WHERE id = ${order.id} AND status = 'paid'`);
    if (Number(claim.rowsAffected) === 0) return { ok: false, code: 'invalid_state', message: '이미 처리된 후원입니다.' };
    await sendFundingCancelledEmails(order, project, 'recorded');
    return { ok: true, mode: 'recorded', refundAmount: order.totalAmount };
  }

  // 토스: 선점 → 취소 API → 기록. 실패 시 되돌림(예약 cancel.ts와 같은 순서).
  const claim = await db.run(sql`UPDATE orders SET status = 'refunded', updated_at = unixepoch() WHERE id = ${order.id} AND status = 'paid'`);
  if (Number(claim.rowsAffected) === 0) return { ok: false, code: 'invalid_state', message: '이미 처리 중이거나 취소된 후원입니다.' };
  const toss = await cancelPayment({
    paymentKey: payment.paymentKey, cancelReason: input.reason, cancelAmount: order.totalAmount,
    idempotencyKey: refundIdempotencyKey(order.orderNo, order.totalAmount),
  });
  if (!toss.ok) {
    try {
      await db.run(sql`UPDATE orders SET status = 'paid', updated_at = unixepoch() WHERE id = ${order.id} AND status = 'refunded'`);
    } catch (revertError) {
      console.error('[funding-cancel] 선점 revert 실패 — 수동 복구 필요', { orderNo: order.orderNo, error: revertError });
    }
    await db.insert(refunds).values({ paymentId: payment.id, amount: order.totalAmount, reason: input.reason, requestedBy: input.requestedBy, status: 'failed' });
    const internal = toss.code === 'CONFIG_ERROR' || toss.code === 'NETWORK_ERROR';
    console.error('[funding-cancel] 토스 취소 실패', { orderNo: order.orderNo, code: toss.code, message: toss.message });
    return { ok: false, code: 'toss_failed', message: internal ? GENERIC : toss.message };
  }
  try {
    await db.insert(refunds).values({
      paymentId: payment.id, amount: order.totalAmount, reason: input.reason, requestedBy: input.requestedBy,
      tossTransactionKey: toss.payment.cancels?.[toss.payment.cancels.length - 1]?.transactionKey ?? null, status: 'done',
    });
  } catch (error) {
    console.error('[funding-cancel] 환불 완료, 기록 실패 — 웹훅 CANCELED 동기화가 보정', { orderNo: order.orderNo, error });
    return { ok: false, code: 'recording_failed', message: '환불은 완료되었으나 기록이 지연되고 있습니다. 010-4255-7893으로 확인 부탁드립니다.' };
  }
  await sendFundingCancelledEmails(order, project, 'refunded');
  return { ok: true, mode: 'refunded', refundAmount: order.totalAmount };
};
```

`lib/funding/bank-transfer.ts`:
```ts
import { eq, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingPledges, orders } from '../../db/schema';
import { sendFundingConfirmedEmails } from './email';
import { getFundingProject } from './projects';
import { findFundingOrderById } from './service';

/** 관리자 입금 확인. pending뿐 아니라 expired(기한 초과 입금)도 되살린다 — 무통장은 무제한 리워드뿐이라 재고 재검증이 필요 없다. */
export const confirmBankDeposit = async (input: { orderId: string; now: Date }): Promise<{ ok: true } | { ok: false; code: 'not_found' | 'invalid_state'; message: string }> => {
  const order = await findFundingOrderById(input.orderId);
  if (!order || !order.fundingPledge) return { ok: false, code: 'not_found', message: '후원을 찾을 수 없습니다.' };
  if (order.fundingPledge.paymentMethod !== 'bank_transfer') return { ok: false, code: 'invalid_state', message: '무통장 후원이 아닙니다.' };
  const db = getDb();
  const claim = await db.run(sql`
    UPDATE orders SET status = 'paid', updated_at = unixepoch()
    WHERE id = ${order.id} AND status IN ('pending', 'expired')
  `);
  if (Number(claim.rowsAffected) === 0) return { ok: false, code: 'invalid_state', message: '입금 확인할 수 있는 상태가 아닙니다.' };
  await db.update(fundingPledges).set({ paidAt: input.now, updatedAt: input.now }).where(eq(fundingPledges.id, order.fundingPledge.id));
  const fresh = (await findFundingOrderById(order.id)) ?? order;
  const emailError = await sendFundingConfirmedEmails(fresh, getFundingProject(fresh.fundingPledge?.projectSlug ?? ''));
  if (emailError) await db.update(orders).set({ notificationError: emailError }).where(eq(orders.id, order.id));
  return { ok: true };
};
```

- [ ] **Step 4: 통과 확인** — `npx jest lib/funding` → PASS.

- [ ] **Step 5: 커밋**

```bash
git add lib/funding/cancel.ts lib/funding/bank-transfer.ts lib/funding/cancel.integration.test.ts lib/funding/email.ts
git commit -m "feat(funding): 셀프·관리자 취소(토스 전액 환불 / 무통장 요청·기록) + 입금 확인·되살리기"
```

---

### Task 7: 메일 (`lib/funding/email.ts`)

**Files:**
- Modify: `lib/funding/email.ts` (Task 5·6의 스텁을 본문으로 교체)
- Test: `lib/funding/email.test.ts`

**Interfaces:**
- Consumes: 기존 `sendEmail`(`lib/email/resend.ts`), `OPERATOR_EMAIL`, `formatPriceAmount`, Task 3 `BANK_ACCOUNT`.
- Produces:
```ts
export const sendFundingConfirmedEmails = (order: FundingOrder, project: FundingProject | null): Promise<string | null>;
export const sendFundingBankDepositEmails = (order: FundingOrder, project: FundingProject | null): Promise<string | null>;
export const sendFundingCancelledEmails = (order: FundingOrder, project: FundingProject | null, mode: 'refunded'|'refund_requested'|'recorded'): Promise<string | null>;
```
반환은 실패 요약 문자열, 성공 `null`(예약 `notificationError` 패턴).

- [ ] **Step 1: 실패하는 테스트**

`lib/funding/email.test.ts`:
```ts
jest.mock('../email/resend', () => ({ sendEmail: jest.fn().mockResolvedValue({ ok: true }) }));
import { sendEmail } from '../email/resend';
import { sendFundingBankDepositEmails, sendFundingCancelledEmails, sendFundingConfirmedEmails } from './email';

const order = {
  id: 'o', orderNo: 'FND-20261015-ABCDEF12', type: 'funding', status: 'paid', manageToken: 'tok',
  customerName: '김후원', customerPhone: '010', customerEmail: 'a@b.com', itemAmount: 4545, vatAmount: 455, totalAmount: 5000,
  notificationError: null, createdAt: new Date(), updatedAt: new Date(), payments: [],
  fundingPledge: {
    id: 'p', orderId: 'o', projectSlug: 'demo', rewardId: 'mail', rewardTitle: '감사 메일', unitAmount: 5000, quantity: 1, additionalAmount: 0,
    paymentMethod: 'bank_transfer', holdExpiresAt: new Date('2026-10-15T15:00:00Z'), paidAt: null, supporterMessage: null, displayNamePublic: true,
    shippingName: null, shippingPhone: null, shippingPostcode: null, shippingAddress1: null, shippingAddress2: null, shippingMemo: null,
    fulfillmentStatus: 'none', trackingCompany: null, trackingNumber: null, entrySource: 'online', refundRequestedAt: null, adminMemo: null,
    createdAt: new Date(), updatedAt: new Date(),
  },
} as never;
const project = { title: '데모 앨범', rewards: [{ id: 'mail', estimatedDelivery: '2026-11' }] } as never;

beforeEach(() => (sendEmail as jest.Mock).mockClear());

it('확정 메일은 고객·운영자 두 통, manage 링크·리워드 포함', async () => {
  expect(await sendFundingConfirmedEmails(order, project)).toBeNull();
  expect(sendEmail).toHaveBeenCalledTimes(2);
  const customer = (sendEmail as jest.Mock).mock.calls[0][0];
  expect(customer.to).toBe('a@b.com');
  expect(customer.text).toContain('/ko/funding/manage/FND-20261015-ABCDEF12?token=tok');
  expect(customer.text).toContain('감사 메일');
});
it('무통장 안내는 계좌·기한·입금자명', async () => {
  await sendFundingBankDepositEmails(order, project);
  const text = (sendEmail as jest.Mock).mock.calls[0][0].text as string;
  expect(text).toContain('3333-12-5480849');
  expect(text).toContain('입금자명');
  expect(text).toContain('2026.10.16');
});
it('한 통이라도 실패하면 요약을 돌려준다', async () => {
  (sendEmail as jest.Mock).mockResolvedValueOnce({ ok: false, errorCode: 'API_ERROR' });
  expect(await sendFundingCancelledEmails(order, project, 'refunded')).toBe('customer:API_ERROR');
});
```

- [ ] **Step 2: 실패 확인** — `npx jest lib/funding/email.test.ts` → FAIL(스텁은 sendEmail을 안 부른다).

- [ ] **Step 3: 구현**

`lib/funding/email.ts` 전체 교체:
```ts
import { formatPriceAmount } from '../../data/pricing';
import { sendEmail } from '../email/resend';
import { OPERATOR_EMAIL } from '../operatorContact';
import { formatKstDateTimeFull } from '../booking/format';
import { BANK_ACCOUNT } from './policy';
import type { FundingProject } from './projects';
import type { FundingOrder } from './service';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://studionol.co.kr').replace(/\/+$/, '');
const manageUrl = (order: FundingOrder): string => `${SITE_URL}/ko/funding/manage/${order.orderNo}?token=${order.manageToken}`;
const PHONE = '문의: 010-4255-7893';

const summaryLines = (order: FundingOrder, project: FundingProject | null): string[] => {
  const p = order.fundingPledge!;
  const reward = project?.rewards.find((r) => r.id === p.rewardId);
  return [
    `프로젝트: ${project?.title ?? p.projectSlug}`,
    `리워드: ${p.rewardTitle} × ${p.quantity}${p.additionalAmount > 0 ? ` + 추가 후원 ${formatPriceAmount(p.additionalAmount)}원` : ''}`,
    `후원 금액: ${formatPriceAmount(order.totalAmount)}원 (VAT 포함)`,
    ...(reward ? [`예상 전달 시기: ${reward.estimatedDelivery}`] : []),
    `주문번호: ${order.orderNo}`,
  ];
};

const send = async (pairs: Array<{ key: string; params: Parameters<typeof sendEmail>[0] }>): Promise<string | null> => {
  const failures: string[] = [];
  for (const { key, params } of pairs) {
    const r = await sendEmail(params);
    if (!r.ok) failures.push(`${key}:${r.errorCode}`);
  }
  return failures.length ? failures.join(', ') : null;
};

export const sendFundingConfirmedEmails = (order: FundingOrder, project: FundingProject | null): Promise<string | null> =>
  send([
    { key: 'customer', params: {
      to: order.customerEmail,
      subject: `[스튜디오 놀] 후원이 확정되었습니다 — ${project?.title ?? ''}`,
      text: [`${order.customerName}님, 후원해 주셔서 고맙습니다.`, ...summaryLines(order, project), '', `후원 확인·취소: ${manageUrl(order)}`, PHONE].join('\n'),
    } },
    { key: 'operator', params: {
      to: OPERATOR_EMAIL,
      subject: `[펀딩] 후원 확정 ${formatPriceAmount(order.totalAmount)}원 — ${order.customerName}`,
      text: [...summaryLines(order, project), `고객: ${order.customerName} / ${order.customerPhone} / ${order.customerEmail}`,
        `결제수단: ${order.fundingPledge?.paymentMethod}`, `메시지: ${order.fundingPledge?.supporterMessage ?? '없음'}`, `관리자: ${SITE_URL}/admin/funding`].join('\n'),
    } },
  ]);

export const sendFundingBankDepositEmails = (order: FundingOrder, project: FundingProject | null): Promise<string | null> =>
  send([
    { key: 'customer', params: {
      to: order.customerEmail,
      subject: `[스튜디오 놀] 무통장입금 안내 — ${project?.title ?? ''}`,
      text: [
        `${order.customerName}님, 아래 계좌로 입금해 주시면 후원이 확정됩니다.`,
        `계좌: ${BANK_ACCOUNT.bank} ${BANK_ACCOUNT.number} (${BANK_ACCOUNT.holder})`,
        `금액: ${formatPriceAmount(order.totalAmount)}원`,
        `입금자명: ${order.customerName} (후원 신청 이름과 같게 해 주세요)`,
        `입금 기한: ${formatKstDateTimeFull(order.fundingPledge!.holdExpiresAt.toISOString())} — 기한이 지나면 자동 취소됩니다`,
        ...summaryLines(order, project), '', `후원 확인: ${manageUrl(order)}`, PHONE,
      ].join('\n'),
    } },
    { key: 'operator', params: {
      to: OPERATOR_EMAIL,
      subject: `[펀딩] 무통장 대기 ${formatPriceAmount(order.totalAmount)}원 — ${order.customerName}`,
      text: [...summaryLines(order, project), `입금자명(예정): ${order.customerName}`, `관리자: ${SITE_URL}/admin/funding`].join('\n'),
    } },
  ]);

const CANCEL_SUBJECT = { refunded: '환불이 완료되었습니다', refund_requested: '취소 요청을 접수했습니다', recorded: '환불 처리 안내' } as const;
const CANCEL_BODY = {
  refunded: (o: FundingOrder) => `결제하신 ${formatPriceAmount(o.totalAmount)}원이 결제 수단으로 환불됩니다(카드사에 따라 3~7일).`,
  refund_requested: () => '무통장 후원은 운영자가 확인 후 계좌로 환불합니다. 환불받을 계좌(은행·계좌번호·예금주)를 이 메일에 회신해 주세요.',
  recorded: (o: FundingOrder) => `${formatPriceAmount(o.totalAmount)}원 환불 처리가 완료되었습니다.`,
} as const;

export const sendFundingCancelledEmails = (order: FundingOrder, project: FundingProject | null, mode: 'refunded' | 'refund_requested' | 'recorded'): Promise<string | null> =>
  send([
    { key: 'customer', params: {
      to: order.customerEmail, replyTo: OPERATOR_EMAIL,
      subject: `[스튜디오 놀] ${CANCEL_SUBJECT[mode]} — ${project?.title ?? ''}`,
      text: [`${order.customerName}님,`, CANCEL_BODY[mode](order), ...summaryLines(order, project), PHONE].join('\n'),
    } },
    { key: 'operator', params: {
      to: OPERATOR_EMAIL,
      subject: `[펀딩] ${CANCEL_SUBJECT[mode]} — ${order.customerName} (${mode})`,
      text: [...summaryLines(order, project), `고객: ${order.customerName} / ${order.customerPhone} / ${order.customerEmail}`, `관리자: ${SITE_URL}/admin/funding`].join('\n'),
    } },
  ]);
```

- [ ] **Step 4: 통과 확인** — `npx jest lib/funding` → PASS.

- [ ] **Step 5: 커밋**

```bash
git add lib/funding/email.ts lib/funding/email.test.ts
git commit -m "feat(funding): 후원 확정·무통장 안내·취소 메일"
```

---

### Task 8: 공개 API 3종

**Files:**
- Create: `pages/api/funding/pledges.ts`, `pages/api/funding/[slug]/status.ts`, `pages/api/funding/cancel.ts`
- Test: `pages/api/funding/pledges.test.ts`

**Interfaces:**
- Consumes: Task 2·3·4·6·7 함수, 기존 `consumeRateLimit`·`getClientIp`·`isTokenMatch`.
- Produces(HTTP):
  - `POST /api/funding/pledges` → 201 `{ ok, orderNo, itemAmount, vatAmount, totalAmount, paymentMethod, holdExpiresAt, depositUrl? }` / 400 / 409 `{ code:'sold_out' }` / 429
  - `GET /api/funding/[slug]/status` → 200 `{ state, goalAmount, raisedAmount, backerCount, percent, endAt, remaining, publicBackers }` / 404
  - `POST /api/funding/cancel` `{ orderNo, token }` → 200 `{ ok, mode, refundAmount }` / 404 / 409

- [ ] **Step 1: 실패하는 테스트**

`pages/api/funding/pledges.test.ts`:
```ts
/** @jest-environment node */
jest.mock('../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));
jest.mock('../../../lib/funding/service', () => ({
  createFundingPledge: jest.fn(), expireStalePledges: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../lib/funding/email', () => ({ sendFundingBankDepositEmails: jest.fn().mockResolvedValue(null) }));
jest.mock('../../../lib/funding/projects', () => ({
  ...jest.requireActual('../../../lib/funding/projects'),
  getFundingProject: jest.fn(),
}));
import type { NextApiRequest, NextApiResponse } from 'next';
import handler from './pledges';
import { createFundingPledge } from '../../../lib/funding/service';
import { getFundingProject, parseFundingProject } from '../../../lib/funding/projects';

const project = parseFundingProject(`---
slug: demo
title: 데모
summary: s
cover: /c.webp
goalAmount: 1000
startAt: 2026-01-01T00:00:00+09:00
endAt: 2036-01-01T00:00:00+09:00
rewards:
  - id: mail
    title: 감사 메일
    description: d
    amount: 5000
    requiresShipping: false
    estimatedDelivery: 2026-11
---
`, 'demo');

const call = async (body: unknown) => {
  const json = jest.fn(); const status = jest.fn().mockReturnValue({ json });
  const res = { setHeader: jest.fn(), status } as unknown as NextApiResponse;
  await handler({ method: 'POST', body, headers: {}, socket: {} } as unknown as NextApiRequest, res);
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0][0] };
};
const body = { projectSlug: 'demo', rewardId: 'mail', quantity: 1, additionalAmount: 0, paymentMethod: 'bank_transfer',
  customerName: '김', customerPhone: '010', customerEmail: 'a@b.com', displayNamePublic: true, termsAgreed: true };

it('무통장 후원 생성 → 201 + depositUrl', async () => {
  (getFundingProject as jest.Mock).mockReturnValue(project);
  (createFundingPledge as jest.Mock).mockResolvedValue({ ok: true, orderNo: 'FND-1', manageToken: 't', holdExpiresAt: new Date(0), amounts: { itemAmount: 4545, vatAmount: 455, totalAmount: 5000 } });
  const r = await call(body);
  expect(r.status).toBe(201);
  expect(r.body.depositUrl).toBe('/ko/funding/deposit/FND-1?token=t');
});
it('검증 실패 400, 품절 409', async () => {
  (getFundingProject as jest.Mock).mockReturnValue(project);
  expect((await call({ ...body, quantity: 0 })).status).toBe(400);
  (createFundingPledge as jest.Mock).mockResolvedValue({ ok: false, code: 'sold_out' });
  expect((await call(body)).status).toBe(409);
});
```

- [ ] **Step 2: 실패 확인** — `npx jest pages/api/funding` → 모듈 없음.

- [ ] **Step 3: 구현**

`pages/api/funding/pledges.ts`:
```ts
import type { NextApiRequest, NextApiResponse } from 'next';

import { getClientIp } from '../../../lib/contracts/client-ip';
import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { sendFundingBankDepositEmails } from '../../../lib/funding/email';
import { getFundingProject } from '../../../lib/funding/projects';
import { createFundingPledge, expireStalePledges, findFundingOrderByOrderNo } from '../../../lib/funding/service';
import { validateCreatePledgePayload } from '../../../lib/funding/validation';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`funding_create:ip:${ip}`, 10, 3600)))
    return res.status(429).json({ ok: false, message: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });

  const now = new Date();
  const slug = typeof req.body?.projectSlug === 'string' ? req.body.projectSlug : '';
  const project = getFundingProject(slug);
  const validated = validateCreatePledgePayload(req.body, project, now);
  if (!validated.ok) return res.status(400).json({ ok: false, message: validated.message });

  await expireStalePledges(now);
  const result = await createFundingPledge(validated.value, project!, validated.reward, now);
  if (!result.ok) return res.status(409).json({ ok: false, code: result.code, message: '방금 이 리워드가 마감되었습니다. 다른 리워드를 선택해 주세요.' });

  let depositUrl: string | undefined;
  if (validated.value.paymentMethod === 'bank_transfer') {
    depositUrl = `/ko/funding/deposit/${result.orderNo}?token=${result.manageToken}`;
    const order = await findFundingOrderByOrderNo(result.orderNo);
    if (order) void sendFundingBankDepositEmails(order, project);
  }
  return res.status(201).json({
    ok: true, orderNo: result.orderNo, paymentMethod: validated.value.paymentMethod,
    holdExpiresAt: result.holdExpiresAt.toISOString(), ...result.amounts, ...(depositUrl ? { depositUrl } : {}),
  });
}
```
(테스트에서 `findFundingOrderByOrderNo`도 mock에 추가: `findFundingOrderByOrderNo: jest.fn().mockResolvedValue(undefined)`.)

`pages/api/funding/[slug]/status.ts`:
```ts
import type { NextApiRequest, NextApiResponse } from 'next';

import { computeProjectState, getFundingProject } from '../../../../lib/funding/projects';
import { aggregateProjectStatus, expireStalePledges } from '../../../../lib/funding/service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false });
  const slug = typeof req.query.slug === 'string' ? req.query.slug : '';
  const project = getFundingProject(slug);
  const now = new Date();
  if (!project || computeProjectState(project, now) === 'draft') return res.status(404).json({ ok: false });
  await expireStalePledges(now);
  const s = await aggregateProjectStatus(project, now);
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  return res.status(200).json({
    ok: true, state: computeProjectState(project, now), goalAmount: project.goalAmount, endAt: project.endAt,
    raisedAmount: s.raisedAmount, backerCount: s.backerCount,
    percent: Math.floor((s.raisedAmount / project.goalAmount) * 100),
    remaining: s.remaining, publicBackers: s.publicBackers,
  });
}
```

`pages/api/funding/cancel.ts` (예약 `pages/api/bookings/cancel.ts`와 같은 골격):
```ts
import type { NextApiRequest, NextApiResponse } from 'next';

import { getClientIp } from '../../../lib/contracts/client-ip';
import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { isTokenMatch } from '../../../lib/booking/token';
import { cancelFundingPledge } from '../../../lib/funding/cancel';
import { findFundingOrderByOrderNo } from '../../../lib/funding/service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`funding_cancel:ip:${ip}`, 10, 3600)))
    return res.status(429).json({ ok: false, message: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });
  const { orderNo, token } = (typeof req.body === 'object' && req.body) || {};
  if (typeof orderNo !== 'string' || typeof token !== 'string' || !orderNo || !token)
    return res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않습니다.' });
  const order = await findFundingOrderByOrderNo(orderNo);
  if (!order || !isTokenMatch(order.manageToken, token)) return res.status(404).json({ ok: false, message: '후원을 찾을 수 없습니다.' });
  const result = await cancelFundingPledge({ orderNo, requestedBy: 'customer', reason: '고객 셀프 취소', now: new Date() });
  if (!result.ok) return res.status(409).json({ ok: false, code: result.code, message: result.message });
  return res.status(200).json({ ok: true, mode: result.mode, refundAmount: result.refundAmount });
}
```

- [ ] **Step 4: 통과 확인** — `npx jest pages/api/funding` → PASS, `npm run type-check` → 0 errors.

- [ ] **Step 5: 커밋**

```bash
git add pages/api/funding
git commit -m "feat(funding): 공개 API — 후원 생성·진행률·셀프 취소"
```

---

### Task 9: 공개 페이지 — 목록·상세 + 컴포넌트

**Files:**
- Create: `components/funding/FundingProgress.tsx`, `FundingProjectCard.tsx`, `RewardCard.tsx`, `BackerNameRoll.tsx`, `FundingTrustNotice.tsx`, `FundingMobileCta.tsx`, `useFundingStatus.ts`
- Create: `pages/[locale]/funding/index.tsx`, `pages/[locale]/funding/[slug]/index.tsx`
- Test: `components/funding/RewardCard.test.tsx`, `components/funding/FundingProgress.test.tsx`

**Interfaces:**
- Consumes: Task 2 로더, Task 8 상태 API 응답 형태, 기존 `MarkdownRenderer`, `Section`, `BaseCard`, `Button`, `SEO`, `buildPageStaticProps`, `formatPriceAmount`, `getSiteConfig`.
- Produces:
```ts
// useFundingStatus.ts
export interface FundingStatusResponse { state: ProjectState; goalAmount: number; endAt: string; raisedAmount: number; backerCount: number; percent: number; remaining: Record<string, number|null>; publicBackers: string[] }
export const useFundingStatus = (slug: string, initialState: ProjectState): { data: FundingStatusResponse | null; error: boolean };
// 페이지 props에 넘기는 직렬화 프로젝트 (content 제외 목록용)
export type FundingProjectSummary = Omit<FundingProject, 'content'> & { state: ProjectState };
```

- [ ] **Step 1: 실패하는 컴포넌트 테스트**

`components/funding/RewardCard.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import RewardCard from './RewardCard';

const reward = { id: 'cd', title: 'CD + 엽서', description: '설명', amount: 30000, totalQuantity: 10, requiresShipping: true, estimatedDelivery: '2026-12', image: null };

it('금액·남은 수량·배송·전달 시기와 후원 링크를 보여준다', () => {
  render(<RewardCard reward={reward} remaining={3} pledgeHref="/ko/funding/demo/pledge?reward=cd" canPledge />);
  expect(screen.getByText('30,000원')).toBeInTheDocument();
  expect(screen.getByText(/3개 남음/)).toBeInTheDocument();
  expect(screen.getByText(/배송/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /이 리워드로 후원하기/ })).toHaveAttribute('href', '/ko/funding/demo/pledge?reward=cd');
});
it('품절이면 링크 대신 품절 배지', () => {
  render(<RewardCard reward={reward} remaining={0} pledgeHref="/x" canPledge />);
  expect(screen.getByText('품절')).toBeInTheDocument();
  expect(screen.queryByRole('link')).toBeNull();
});
it('후원 불가 상태면 링크가 없다', () => {
  render(<RewardCard reward={reward} remaining={null} pledgeHref="/x" canPledge={false} />);
  expect(screen.queryByRole('link')).toBeNull();
});
```

`components/funding/FundingProgress.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import FundingProgress from './FundingProgress';

it('모금액·달성률·후원자 수·D-day', () => {
  render(<FundingProgress goalAmount={1000000} endAt="2026-10-31T23:59:59+09:00" now={new Date('2026-10-20T00:00:00Z')}
    data={{ raisedAmount: 450000, backerCount: 12, percent: 45, state: 'live' }} />);
  expect(screen.getByText('450,000원')).toBeInTheDocument();
  expect(screen.getByText('45%')).toBeInTheDocument();
  expect(screen.getByText(/12명/)).toBeInTheDocument();
  expect(screen.getByText(/D-11/)).toBeInTheDocument();
});
it('데이터가 없으면 집계 중', () => {
  render(<FundingProgress goalAmount={1} endAt="2026-10-31T23:59:59+09:00" now={new Date()} data={null} />);
  expect(screen.getByText(/집계 중/)).toBeInTheDocument();
});
```

- [ ] **Step 2: 실패 확인** — `npx jest components/funding` → 모듈 없음.

- [ ] **Step 3: 컴포넌트 구현**

`components/funding/useFundingStatus.ts`:
```ts
import { useEffect, useState } from 'react';
import type { ProjectState } from '../../lib/funding/projects';

export interface FundingStatusResponse {
  state: ProjectState; goalAmount: number; endAt: string; raisedAmount: number; backerCount: number; percent: number;
  remaining: Record<string, number | null>; publicBackers: string[];
}

/** 마운트 시 1회 + live일 때 5분 폴링. 실패는 error로만 알린다(후원은 막지 않는다). */
export const useFundingStatus = (slug: string, initialState: ProjectState) => {
  const [data, setData] = useState<FundingStatusResponse | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/funding/${encodeURIComponent(slug)}/status`);
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as FundingStatusResponse;
        if (alive) { setData(json); setError(false); }
      } catch { if (alive) setError(true); }
    };
    void load();
    const timer = (data?.state ?? initialState) === 'live' ? setInterval(load, 5 * 60 * 1000) : undefined;
    return () => { alive = false; if (timer) clearInterval(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);
  return { data, error };
};
```

`components/funding/FundingProgress.tsx`:
```tsx
import { formatPriceAmount } from '../../data/pricing';
import { daysUntilKst } from '../../lib/booking/kst';
import type { ProjectState } from '../../lib/funding/projects';

interface Props {
  goalAmount: number; endAt: string; now: Date;
  data: { raisedAmount: number; backerCount: number; percent: number; state: ProjectState } | null;
}

export default function FundingProgress({ goalAmount, endAt, now, data }: Props) {
  const days = daysUntilKst(now, new Date(endAt));
  const state = data?.state;
  const dday = state === 'closed' ? '마감' : days <= 0 ? 'D-DAY' : `D-${days}`;
  const percent = data ? Math.min(100, data.percent) : 0;
  return (
    <div className="min-h-[120px]" aria-live="polite">
      {data ? (
        <>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{formatPriceAmount(data.raisedAmount)}원</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            목표 {formatPriceAmount(goalAmount)}원 · <span className="font-semibold text-primary dark:text-accent">{data.percent}%</span> · {data.backerCount}명 후원 · {dday}
          </p>
        </>
      ) : (
        <p className="text-sm text-gray-500">모금 현황 집계 중… · {dday}</p>
      )}
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
```

`components/funding/RewardCard.tsx`:
```tsx
import Link from 'next/link';
import { BaseCard } from '../ui/BaseCard';
import { formatPriceAmount } from '../../data/pricing';
import type { FundingReward } from '../../lib/funding/projects';

interface Props { reward: FundingReward; remaining: number | null; pledgeHref: string; canPledge: boolean }

export default function RewardCard({ reward, remaining, pledgeHref, canPledge }: Props) {
  const soldOut = remaining !== null && remaining <= 0;
  return (
    <BaseCard variant="glass" className="flex h-full flex-col p-6">
      {reward.image && <img src={reward.image} alt="" className="mb-4 aspect-[4/3] w-full rounded-lg object-cover" loading="lazy" />}
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatPriceAmount(reward.amount)}원</p>
      <h3 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{reward.title}</h3>
      <p className="mt-2 flex-1 whitespace-pre-line text-sm text-gray-600 dark:text-gray-300">{reward.description}</p>
      <ul className="mt-4 space-y-1 text-xs text-gray-500 dark:text-gray-400">
        <li>예상 전달: {reward.estimatedDelivery}</li>
        <li>{reward.requiresShipping ? '배송 리워드 (배송지 입력)' : '배송 없음'}</li>
        {remaining !== null && !soldOut && <li>{remaining}개 남음 / 한정 {reward.totalQuantity}개</li>}
      </ul>
      <div className="mt-5">
        {soldOut ? (
          <span className="inline-block rounded-full bg-gray-200 px-3 py-1 text-sm font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">품절</span>
        ) : canPledge ? (
          <Link href={pledgeHref} prefetch={false} className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-5 font-medium text-white hover:bg-primary-dark">
            이 리워드로 후원하기
          </Link>
        ) : null}
      </div>
    </BaseCard>
  );
}
```

`components/funding/BackerNameRoll.tsx`:
```tsx
export default function BackerNameRoll({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">함께한 후원자</h2>
      <p className="mt-3 text-sm leading-7 text-gray-600 dark:text-gray-300">{names.join(' · ')}</p>
    </div>
  );
}
```

`components/funding/FundingTrustNotice.tsx`:
```tsx
import Link from 'next/link';
import { getSiteConfig, studioOperator } from '../../data/siteConfig';

export default function FundingTrustNotice() {
  const cfg = getSiteConfig('ko');
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-xs leading-6 text-gray-600 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300">
      <p>판매자: 스튜디오 놀 (대표 {studioOperator.name}) · 사업자등록번호 {cfg.contact.businessNumber}
        {cfg.contact.mailOrderSalesNumber ? ` · 통신판매업 신고 ${cfg.contact.mailOrderSalesNumber}` : ''}</p>
      <p>후원은 리워드 선주문 형태의 통신판매 계약이며 기부가 아닙니다. 목표 미달 시에도 모금액으로 제작을 진행합니다(Keep-it-All).</p>
      <p>
        <Link href="/ko/funding/terms" className="underline">펀딩 약관·청약철회·환불 규정</Link> · <Link href="/ko/privacy-policy" className="underline">개인정보 처리방침</Link>
      </p>
    </div>
  );
}
```
(`cfg.contact.businessNumber`·`studioOperator.name`의 실제 필드명은 `data/siteConfig.ts`를 열어 맞춘다 — 사업자번호 753-74-00653이 들어 있는 필드.)

`components/funding/FundingMobileCta.tsx`:
```tsx
export default function FundingMobileCta({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 p-3 backdrop-blur lg:hidden dark:border-gray-800 dark:bg-gray-900/95">
      <a href="#rewards" className="flex h-12 w-full items-center justify-center rounded-xl bg-primary font-bold text-white">후원하기</a>
    </div>
  );
}
```

`components/funding/FundingProjectCard.tsx`:
```tsx
import Link from 'next/link';
import { BaseCard } from '../ui/BaseCard';
import { formatPriceAmount } from '../../data/pricing';
import type { ProjectState } from '../../lib/funding/projects';

const STATE_LABEL: Record<ProjectState, string> = { live: '진행 중', upcoming: '오픈 예정', closed: '마감', draft: '' };

interface Props { slug: string; title: string; summary: string; cover: string; goalAmount: number; state: ProjectState }

export default function FundingProjectCard({ slug, title, summary, cover, goalAmount, state }: Props) {
  return (
    <Link href={`/ko/funding/${slug}`} prefetch={false} className="block">
      <BaseCard variant="glass" className="overflow-hidden">
        <img src={cover} alt="" className="aspect-[16/9] w-full object-cover" loading="lazy" />
        <div className="p-5">
          <span className={`text-xs font-semibold ${state === 'live' ? 'text-primary dark:text-accent' : 'text-gray-500'}`}>{STATE_LABEL[state]}</span>
          <h2 className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{summary}</p>
          <p className="mt-3 text-xs text-gray-500">목표 {formatPriceAmount(goalAmount)}원</p>
        </div>
      </BaseCard>
    </Link>
  );
}
```

- [ ] **Step 4: 컴포넌트 테스트 통과** — `npx jest components/funding` → PASS.

- [ ] **Step 5: 페이지 구현**

`pages/[locale]/funding/index.tsx`:
```tsx
import type { GetStaticPaths, GetStaticProps } from 'next';
import SEO from '../../../components/SEO';
import { Section } from '../../../components/ui/Section';
import FundingProjectCard from '../../../components/funding/FundingProjectCard';
import { buildPageStaticProps } from '../../../lib/getStatic';
import { defaultLocale } from '../../../lib/i18n';
import { computeProjectState, getListableFundingProjects, type ProjectState } from '../../../lib/funding/projects';

interface Item { slug: string; title: string; summary: string; cover: string; goalAmount: number; state: ProjectState }
interface Props { items: Item[] }

export default function FundingIndexPage({ items }: Props) {
  return (
    <>
      <SEO title="펀딩 — 스튜디오 놀" description="스튜디오 놀이 제작하는 음반의 제작비를 리워드 후원으로 함께 만듭니다." canonical="/ko/funding" />
      <Section className="pt-28">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">펀딩</h1>
        <p className="mt-3 text-gray-600 dark:text-gray-300">음반 제작비를 후원자와 함께 만듭니다. 리워드를 고르면 CD·굿즈·음원으로 돌려드립니다.</p>
        {items.length === 0 ? (
          <p className="mt-12 text-gray-500">지금 진행 중인 펀딩이 없습니다. 새 프로젝트는 스토리와 SNS에서 먼저 알립니다.</p>
        ) : (
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {items.map((it) => <FundingProjectCard key={it.slug} {...it} />)}
          </div>
        )}
      </Section>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => ({ paths: [{ params: { locale: defaultLocale } }], fallback: false });

export const getStaticProps: GetStaticProps<Props> = async () => {
  const now = new Date();
  const items = getListableFundingProjects(now).map((p) => ({
    slug: p.slug, title: p.title, summary: p.summary, cover: p.cover, goalAmount: p.goalAmount, state: computeProjectState(p, now),
  }));
  return buildPageStaticProps(defaultLocale, { items }, { i18nSections: [] });
};
```
(`buildPageStaticProps`가 `i18nSections: []`를 허용하는지 `lib/getStatic.ts`를 확인 — 빈 배열이면 CORE만 실린다. 허용하지 않으면 옵션을 생략한다.)

`pages/[locale]/funding/[slug]/index.tsx`:
```tsx
import type { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import SEO from '../../../../components/SEO';
import MarkdownRenderer from '../../../../components/MarkdownRenderer';
import { Section } from '../../../../components/ui/Section';
import FundingProgress from '../../../../components/funding/FundingProgress';
import RewardCard from '../../../../components/funding/RewardCard';
import BackerNameRoll from '../../../../components/funding/BackerNameRoll';
import FundingTrustNotice from '../../../../components/funding/FundingTrustNotice';
import FundingMobileCta from '../../../../components/funding/FundingMobileCta';
import { useFundingStatus } from '../../../../components/funding/useFundingStatus';
import { buildPageStaticProps } from '../../../../lib/getStatic';
import { defaultLocale } from '../../../../lib/i18n';
import { computeProjectState, getAllFundingProjects, getFundingProject, type FundingProject, type ProjectState } from '../../../../lib/funding/projects';

interface Props { project: FundingProject; initialState: ProjectState }

export default function FundingProjectPage({ project, initialState }: Props) {
  const { data } = useFundingStatus(project.slug, initialState);
  const state = data?.state ?? initialState;
  const canPledge = state === 'live';
  const now = new Date();
  return (
    <>
      <SEO title={`${project.title} — 펀딩 | 스튜디오 놀`} description={project.summary} canonical={`/ko/funding/${project.slug}`}
        ogImage={project.ogImage ?? project.cover} />
      {project.hidden && <Head><meta name="robots" content="noindex, nofollow" /></Head>}
      <Section className="pt-28">
        <div className="grid gap-10 lg:grid-cols-[3fr_2fr]">
          <img src={project.cover} alt="" className="aspect-[16/9] w-full rounded-2xl object-cover" />
          <div>
            <p className="text-sm font-semibold text-primary dark:text-accent">{state === 'upcoming' ? '오픈 예정' : state === 'closed' ? '마감' : '진행 중'}</p>
            <h1 className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{project.title}</h1>
            <p className="mt-3 text-gray-600 dark:text-gray-300">{project.summary}</p>
            <div className="mt-6">
              <FundingProgress goalAmount={project.goalAmount} endAt={project.endAt} now={now}
                data={data ? { raisedAmount: data.raisedAmount, backerCount: data.backerCount, percent: data.percent, state } : null} />
            </div>
            {canPledge && <a href="#rewards" className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-primary px-8 font-bold text-white hover:bg-primary-dark">후원하기</a>}
          </div>
        </div>
      </Section>
      <Section>
        <article className="prose prose-lg max-w-3xl dark:prose-invert">
          <MarkdownRenderer content={project.content} locale="ko" />
        </article>
      </Section>
      <Section id="rewards" variant="alternate">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">리워드</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {project.rewards.map((r) => (
            <RewardCard key={r.id} reward={r} remaining={data?.remaining[r.id] ?? (r.totalQuantity === null ? null : r.totalQuantity)}
              pledgeHref={`/ko/funding/${project.slug}/pledge?reward=${encodeURIComponent(r.id)}`} canPledge={canPledge} />
          ))}
        </div>
      </Section>
      <Section>
        <BackerNameRoll names={data?.publicBackers ?? []} />
        <div className="mt-10"><FundingTrustNotice /></div>
      </Section>
      <FundingMobileCta visible={canPledge} />
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: getAllFundingProjects().filter((p) => p.status !== 'draft').map((p) => ({ params: { locale: defaultLocale, slug: p.slug } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const project = getFundingProject(String(params?.slug ?? ''));
  if (!project || project.status === 'draft') return { notFound: true };
  return buildPageStaticProps(defaultLocale, { project, initialState: computeProjectState(project, new Date()) }, { i18nSections: ['stories'] });
};
```
`MarkdownRenderer`의 실제 props 이름(`content`, `locale`)은 `components/MarkdownRenderer.tsx:286`의 인터페이스로 확인한다. `Section`이 `id`를 그대로 넘기는지도 확인(HTMLAttributes 확장이므로 넘긴다).

- [ ] **Step 6: 확인**

`npm run type-check` → 0 errors. `npm run dev` 후 `http://localhost:3000/ko/funding/smoke-test`를 연다 — `status: draft`라 404가 정상. 임시로 `content/funding/smoke-test.md`의 `status`를 `auto`로 바꿔 상세 페이지·리워드 카드·진행률("집계 중" → DB 있으면 숫자)이 뜨는지 본 뒤 **다시 `draft`로 되돌린다**.

- [ ] **Step 7: 커밋**

```bash
git add components/funding 'pages/[locale]/funding'
git commit -m "feat(funding): 목록·상세 페이지 + 진행률·리워드·후원자 명단·신뢰 고지 컴포넌트"
```

---

### Task 10: 후원 위저드 + 토스 위젯 일반화 + success/fail/deposit/manage

**Files:**
- Modify: `components/booking/TossPaymentWidget.tsx` (props에 `successUrl?`·`failUrl?` 추가)
- Create: `components/funding/PledgeWizard.tsx`, `components/funding/BankDepositGuide.tsx`
- Create: `pages/[locale]/funding/[slug]/pledge.tsx`, `pages/[locale]/funding/success.tsx`, `pages/[locale]/funding/fail.tsx`, `pages/[locale]/funding/deposit/[orderNo].tsx`, `pages/[locale]/funding/manage/[orderNo].tsx`
- Test: `components/booking/TossPaymentWidget.test.tsx`(케이스 추가), `components/funding/PledgeWizard.test.tsx`

**Interfaces:**
- Consumes: Task 8 API 계약, Task 5 `confirmFundingPledge`, Task 3 정책·`assessSelfCancel`, Task 4 `findFundingOrderByOrderNo`, 기존 `isTokenMatch`·`denyContractPageCaching`·`PriceBreakdown`.
- Produces: `TossPaymentWidget` props `successUrl?: string; failUrl?: string`(없으면 기존 예약 URL). `PledgeWizard` props `{ project: FundingProject; initialRewardId: string | null; remaining: Record<string, number|null> }`.

- [ ] **Step 1: TossPaymentWidget 실패 테스트**

`components/booking/TossPaymentWidget.test.tsx`에 추가(기존 파일이 `loadTossPayments`를 mock하는 방식을 따른다):
```tsx
it('successUrl/failUrl prop이 있으면 그대로 requestPayment에 싣는다', async () => {
  render(<TossPaymentWidget orderNo="FND-1" amount={5000} orderName="[펀딩] 데모 · 감사 메일" customerName="김" customerEmail="a@b.com" service="funding"
    successUrl="/ko/funding/success" failUrl="/ko/funding/fail?orderNo=FND-1" />);
  await screen.findByRole('button', { name: '결제하기' });
  await userEvent.click(screen.getByRole('button', { name: '결제하기' }));
  expect(requestPaymentMock).toHaveBeenCalledWith(expect.objectContaining({
    successUrl: `${window.location.origin}/ko/funding/success`,
    failUrl: `${window.location.origin}/ko/funding/fail?orderNo=FND-1`,
  }));
});
```

- [ ] **Step 2: 실패 확인** — `npx jest components/booking/TossPaymentWidget` → FAIL.

- [ ] **Step 3: 위젯 수정**

`components/booking/TossPaymentWidget.tsx`:
```ts
interface Props {
  orderNo: string; amount: number; orderName: string; customerName: string; customerEmail: string; service: string;
  /** 없으면 예약 퍼널 URL. 펀딩 등 다른 퍼널은 자기 경로를 넘긴다(origin 없이 경로만). */
  successUrl?: string;
  failUrl?: string;
}
// pay() 안:
successUrl: `${origin}${successUrl ?? '/ko/booking/success'}`,
failUrl: `${origin}${failUrl ?? `/ko/booking/fail?service=${encodeURIComponent(service)}`}`,
```

- [ ] **Step 4: 위젯 테스트 통과** — `npx jest components/booking/TossPaymentWidget` → PASS.

- [ ] **Step 5: 위저드 실패 테스트**

`components/funding/PledgeWizard.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PledgeWizard from './PledgeWizard';
import { parseFundingProject } from '../../lib/funding/projects';

jest.mock('../booking/TossPaymentWidget', () => () => <div data-testid="toss-widget" />);

const project = parseFundingProject(`---
slug: demo
title: 데모
summary: s
cover: /c.webp
goalAmount: 1000
startAt: 2026-01-01T00:00:00+09:00
endAt: 2036-01-01T00:00:00+09:00
rewards:
  - id: cd
    title: CD
    description: d
    amount: 30000
    totalQuantity: 5
    requiresShipping: true
    estimatedDelivery: 2026-12
  - id: mail
    title: 감사 메일
    description: d
    amount: 5000
    requiresShipping: false
    estimatedDelivery: 2026-11
---
`, 'demo');

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({
    ok: true, orderNo: 'FND-1', paymentMethod: 'toss', holdExpiresAt: new Date(Date.now() + 900000).toISOString(),
    itemAmount: 27273, vatAmount: 2727, totalAmount: 30000,
  }) }) as never;
});

it('배송 리워드는 배송지 입력이 보이고, 한정 수량이면 무통장 선택지가 없다', async () => {
  render(<PledgeWizard project={project} initialRewardId="cd" remaining={{ cd: 5, mail: null }} />);
  expect(screen.getByLabelText(/받는 분/)).toBeInTheDocument();
  expect(screen.queryByLabelText(/무통장/)).toBeNull();
});
it('무제한 리워드는 무통장 선택지가 있고, 제출하면 서버 금액으로 결제 단계가 뜬다', async () => {
  render(<PledgeWizard project={project} initialRewardId="mail" remaining={{ cd: 5, mail: null }} />);
  expect(screen.getByLabelText(/무통장/)).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('이름'), '김후원');
  await userEvent.type(screen.getByLabelText('연락처'), '010-1111-2222');
  await userEvent.type(screen.getByLabelText('이메일'), 'a@b.com');
  await userEvent.click(screen.getByLabelText(/약관/));
  await userEvent.click(screen.getByRole('button', { name: /결제로 이동/ }));
  expect(await screen.findByTestId('toss-widget')).toBeInTheDocument();
  expect(screen.getByText(/합계 30,000원/)).toBeInTheDocument();
});
```

- [ ] **Step 6: 실패 확인** — `npx jest components/funding/PledgeWizard` → 모듈 없음.

- [ ] **Step 7: 위저드·안내 컴포넌트 구현**

`components/funding/PledgeWizard.tsx`:
```tsx
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

import TossPaymentWidget from '../booking/TossPaymentWidget';
import PriceBreakdown from '../booking/PriceBreakdown';
import { Button } from '../ui/Button';
import { formatPriceAmount } from '../../data/pricing';
import { computeFundingAmounts } from '../../lib/funding/amounts';
import { ADDITIONAL_AMOUNT_STEP, MAX_ADDITIONAL_AMOUNT, MAX_QUANTITY } from '../../lib/funding/policy';
import type { FundingProject } from '../../lib/funding/projects';
import { trackMicroEvent } from '../../utils/analytics';

interface Props { project: FundingProject; initialRewardId: string | null; remaining: Record<string, number | null> }
interface Created { orderNo: string; totalAmount: number; itemAmount: number; vatAmount: number; holdExpiresAt: string }

const field = 'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800';

export default function PledgeWizard({ project, initialRewardId, remaining }: Props) {
  const router = useRouter();
  const [rewardId, setRewardId] = useState(initialRewardId ?? project.rewards[0].id);
  const reward = project.rewards.find((r) => r.id === rewardId) ?? project.rewards[0];
  const [quantity, setQuantity] = useState(1);
  const [additional, setAdditional] = useState(0);
  const [method, setMethod] = useState<'toss' | 'bank_transfer'>('toss');
  const [form, setForm] = useState({ customerName: '', customerPhone: '', customerEmail: '', supporterMessage: '', displayNamePublic: true, termsAgreed: false });
  const [ship, setShip] = useState({ name: '', phone: '', postcode: '', address1: '', address2: '', memo: '' });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  const limited = reward.totalQuantity !== null;
  useEffect(() => { if (limited && method === 'bank_transfer') setMethod('toss'); }, [limited, method]);
  const preview = useMemo(() => computeFundingAmounts(reward.amount, quantity, additional), [reward.amount, quantity, additional]);

  useEffect(() => {
    if (!created) return;
    const end = new Date(created.holdExpiresAt).getTime();
    const tick = () => setRemainingMs(Math.max(0, end - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [created]);

  const submit = async () => {
    setError(null);
    if (!form.termsAgreed) { setError('약관에 동의해 주세요.'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/funding/pledges', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectSlug: project.slug, rewardId: reward.id, quantity, additionalAmount: additional, paymentMethod: method,
          ...form, supporterMessage: form.supporterMessage || undefined,
          shipping: reward.requiresShipping ? ship : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.message ?? '후원 신청에 실패했습니다.'); return; }
      trackMicroEvent('micro_click_service', { location: 'funding_pledge', service: project.slug });
      if (json.depositUrl) { await router.push(json.depositUrl); return; }
      setCreated(json);
    } catch { setError('네트워크 오류가 발생했습니다.'); }
    finally { setSubmitting(false); }
  };

  if (created) {
    const expired = remainingMs !== null && remainingMs <= 0;
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold">결제</h2>
        <PriceBreakdown amounts={{ itemAmount: created.itemAmount, vatAmount: created.vatAmount, totalAmount: created.totalAmount }} />
        {remainingMs !== null && !expired && <p className="text-sm text-gray-500">결제 대기 {Math.floor(remainingMs / 60000)}:{String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, '0')}</p>}
        {expired ? (
          <p role="alert" className="text-red-600">결제 대기 시간이 지났습니다. <button type="button" className="underline" onClick={() => setCreated(null)}>다시 신청</button></p>
        ) : (
          <TossPaymentWidget orderNo={created.orderNo} amount={created.totalAmount}
            orderName={`[펀딩] ${project.title} · ${reward.title}`.slice(0, 100)}
            customerName={form.customerName} customerEmail={form.customerEmail} service="funding"
            successUrl="/ko/funding/success" failUrl={`/ko/funding/fail?slug=${encodeURIComponent(project.slug)}`} />
        )}
      </div>
    );
  }

  return (
    <form className="space-y-8" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <fieldset>
        <legend className="text-xl font-bold">1. 리워드</legend>
        <div className="mt-3 space-y-2">
          {project.rewards.map((r) => {
            const left = remaining[r.id];
            const soldOut = left !== null && left !== undefined && left <= 0;
            return (
              <label key={r.id} className={`flex items-start gap-3 rounded-lg border p-3 ${soldOut ? 'opacity-50' : ''}`}>
                <input type="radio" name="reward" value={r.id} checked={rewardId === r.id} disabled={soldOut} onChange={() => setRewardId(r.id)} />
                <span><strong>{formatPriceAmount(r.amount)}원</strong> {r.title}{soldOut ? ' (품절)' : left != null ? ` · ${left}개 남음` : ''}</span>
              </label>
            );
          })}
        </div>
        <label className="mt-4 block text-sm">수량
          <input type="number" min={1} max={Math.min(MAX_QUANTITY, remaining[reward.id] ?? MAX_QUANTITY)} value={quantity} className={field}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} />
        </label>
        <label className="mt-4 block text-sm">추가 후원금 (선택, 1,000원 단위)
          <input type="number" min={0} max={MAX_ADDITIONAL_AMOUNT} step={ADDITIONAL_AMOUNT_STEP} value={additional} className={field}
            onChange={(e) => setAdditional(Math.max(0, Math.floor((Number(e.target.value) || 0) / ADDITIONAL_AMOUNT_STEP) * ADDITIONAL_AMOUNT_STEP))} />
        </label>
        <p className="mt-3 text-sm text-gray-600">예상 합계 {formatPriceAmount(preview.totalAmount)}원 (VAT 포함) — 실제 청구액은 다음 단계에서 서버가 확정합니다.</p>
      </fieldset>

      <fieldset>
        <legend className="text-xl font-bold">2. 후원자 정보</legend>
        <label className="mt-3 block text-sm">이름<input required className={field} value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} /></label>
        <label className="mt-3 block text-sm">연락처<input required className={field} value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} /></label>
        <label className="mt-3 block text-sm">이메일<input required type="email" className={field} value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} /></label>
        {reward.requiresShipping && (
          <div className="mt-4 space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
            <p className="text-sm font-semibold">배송지</p>
            <label className="block text-sm">받는 분<input required className={field} value={ship.name} onChange={(e) => setShip({ ...ship, name: e.target.value })} /></label>
            <label className="block text-sm">받는 분 연락처<input required className={field} value={ship.phone} onChange={(e) => setShip({ ...ship, phone: e.target.value })} /></label>
            <label className="block text-sm">우편번호<input required className={field} value={ship.postcode} onChange={(e) => setShip({ ...ship, postcode: e.target.value })} /></label>
            <label className="block text-sm">주소<input required className={field} value={ship.address1} onChange={(e) => setShip({ ...ship, address1: e.target.value })} /></label>
            <label className="block text-sm">상세주소<input className={field} value={ship.address2} onChange={(e) => setShip({ ...ship, address2: e.target.value })} /></label>
            <label className="block text-sm">배송 메모<input className={field} value={ship.memo} onChange={(e) => setShip({ ...ship, memo: e.target.value })} /></label>
          </div>
        )}
        <label className="mt-3 block text-sm">응원 메시지 (선택, 운영자에게만 보입니다)
          <textarea className={field} maxLength={500} value={form.supporterMessage} onChange={(e) => setForm({ ...form, supporterMessage: e.target.value })} />
        </label>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.displayNamePublic} onChange={(e) => setForm({ ...form, displayNamePublic: e.target.checked })} />
          후원자 명단에 이름 공개
        </label>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.termsAgreed} onChange={(e) => setForm({ ...form, termsAgreed: e.target.checked })} />
          <span><Link href="/ko/funding/terms" target="_blank" className="underline">펀딩 약관·청약철회·환불 규정</Link>과 <Link href="/ko/privacy-policy" target="_blank" className="underline">개인정보 처리방침</Link>에 동의합니다</span>
        </label>
      </fieldset>

      <fieldset>
        <legend className="text-xl font-bold">3. 결제수단</legend>
        <label className="mt-3 flex items-center gap-2 text-sm"><input type="radio" name="method" checked={method === 'toss'} onChange={() => setMethod('toss')} /> 카드·계좌이체·간편결제 (토스페이먼츠)</label>
        {!limited && (
          <label className="mt-2 flex items-center gap-2 text-sm"><input type="radio" name="method" checked={method === 'bank_transfer'} onChange={() => setMethod('bank_transfer')} /> 무통장입금 (12시간 안에 입금)</label>
        )}
        {limited && <p className="mt-2 text-xs text-gray-500">한정 수량 리워드는 온라인 결제만 가능합니다.</p>}
      </fieldset>

      {error && <p role="alert" className="text-red-600">{error}</p>}
      <Button type="submit" size="lg" fullWidth disabled={submitting}>{method === 'toss' ? '결제로 이동' : '무통장 후원 신청'}</Button>
    </form>
  );
}
```
`trackMicroEvent`의 실제 props 타입은 `utils/analytics.ts`의 `LeadEventProps`를 열어 맞춘다(필드명이 다르면 그에 맞춘다). GA4 이벤트 이름 추가는 Task 13에서 한다.

`components/funding/BankDepositGuide.tsx`:
```tsx
import { formatPriceAmount } from '../../data/pricing';
import { formatKstDateTimeFull } from '../../lib/booking/format';
import { BANK_ACCOUNT } from '../../lib/funding/policy';

interface Props { orderNo: string; customerName: string; totalAmount: number; holdExpiresAt: string; status: string }

export default function BankDepositGuide({ orderNo, customerName, totalAmount, holdExpiresAt, status }: Props) {
  if (status === 'paid') return <p className="text-lg font-semibold">입금이 확인되어 후원이 확정되었습니다.</p>;
  if (status !== 'pending') return <p className="text-lg font-semibold">입금 기한이 지나 후원이 취소되었습니다. 다시 후원해 주세요.</p>;
  return (
    <dl className="space-y-3 text-base">
      <div><dt className="text-sm text-gray-500">입금 계좌</dt><dd className="text-xl font-bold">{BANK_ACCOUNT.bank} {BANK_ACCOUNT.number}</dd><dd className="text-sm">{BANK_ACCOUNT.holder}</dd></div>
      <div><dt className="text-sm text-gray-500">입금 금액</dt><dd className="text-xl font-bold">{formatPriceAmount(totalAmount)}원</dd></div>
      <div><dt className="text-sm text-gray-500">입금자명</dt><dd className="font-semibold">{customerName}</dd><dd className="text-sm text-gray-500">후원 신청 이름과 같게 해 주세요.</dd></div>
      <div><dt className="text-sm text-gray-500">입금 기한</dt><dd className="font-semibold">{formatKstDateTimeFull(holdExpiresAt)}</dd><dd className="text-sm text-gray-500">기한이 지나면 자동 취소됩니다.</dd></div>
      <div><dt className="text-sm text-gray-500">주문번호</dt><dd>{orderNo}</dd></div>
    </dl>
  );
}
```

- [ ] **Step 8: 위저드 테스트 통과** — `npx jest components/funding` → PASS.

- [ ] **Step 9: 페이지 구현**

`pages/[locale]/funding/[slug]/pledge.tsx`:
```tsx
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import PledgeWizard from '../../../../components/funding/PledgeWizard';
import FundingTrustNotice from '../../../../components/funding/FundingTrustNotice';
import { computeProjectState, getFundingProject, type FundingProject } from '../../../../lib/funding/projects';
import { aggregateProjectStatus, expireStalePledges } from '../../../../lib/funding/service';

interface Props { project: FundingProject; initialRewardId: string | null; remaining: Record<string, number | null> }

export default function PledgePage({ project, initialRewardId, remaining }: Props) {
  return (
    <>
      <Head><title>{project.title} 후원하기 | 스튜디오 놀</title><meta name="robots" content="noindex, nofollow" /></Head>
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-28">
        <p className="text-sm"><Link href={`/ko/funding/${project.slug}`} className="underline">← {project.title}</Link></p>
        <h1 className="mt-2 text-2xl font-bold">후원하기</h1>
        <div className="mt-8"><PledgeWizard project={project} initialRewardId={initialRewardId} remaining={remaining} /></div>
        <div className="mt-10"><FundingTrustNotice /></div>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async ({ params, query, res }) => {
  res.setHeader('Cache-Control', 'no-store');
  if (params?.locale !== 'ko') return { redirect: { destination: `/ko/funding/${String(params?.slug ?? '')}/pledge`, permanent: false } };
  const project = getFundingProject(String(params.slug ?? ''));
  const now = new Date();
  if (!project) return { notFound: true };
  if (computeProjectState(project, now) !== 'live') return { redirect: { destination: `/ko/funding/${project.slug}`, permanent: false } };
  await expireStalePledges(now);
  const status = await aggregateProjectStatus(project, now);
  const initialRewardId = typeof query.reward === 'string' && project.rewards.some((r) => r.id === query.reward) ? query.reward : null;
  return { props: { project, initialRewardId, remaining: status.remaining } };
};
```

`pages/[locale]/funding/success.tsx` — `pages/[locale]/booking/success.tsx`를 복사해 아래만 바꾼다: import를 `confirmFundingPledge`로, 제목 "후원이 확정되었습니다"/"후원 결제 완료", `manageUrl`을 `/ko/funding/manage/${result.orderNo}?token=${result.manageToken}`, 성공 시 프로젝트 링크 `/ko/funding/${result.projectSlug}` 추가, 실패 문구 "결제를 확정하지 못했습니다". `getServerSideProps`의 비-ko redirect는 `/ko/funding`.

`pages/[locale]/funding/fail.tsx`:
```tsx
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

interface Props { slug: string | null; message: string }
export default function FundingFailPage({ slug, message }: Props) {
  return (
    <>
      <Head><title>결제 실패 | 스튜디오 놀</title><meta name="robots" content="noindex, nofollow" /></Head>
      <main className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">결제가 완료되지 않았습니다</h1>
        <p className="mt-4 text-gray-600 dark:text-gray-300">{message}</p>
        <p className="mt-2 text-sm text-gray-500">결제가 이뤄지지 않았으므로 청구되지 않습니다. 15분 뒤 신청이 자동 해제되며 다시 후원할 수 있습니다.</p>
        <Link href={slug ? `/ko/funding/${slug}` : '/ko/funding'} className="mt-8 inline-block underline">프로젝트로 돌아가기</Link>
      </main>
    </>
  );
}
export const getServerSideProps: GetServerSideProps<Props> = async ({ params, query, res }) => {
  res.setHeader('Cache-Control', 'no-store');
  if (params?.locale !== 'ko') return { redirect: { destination: '/ko/funding', permanent: false } };
  const slug = typeof query.slug === 'string' && /^[a-z0-9-]+$/.test(query.slug) ? query.slug : null;
  const message = typeof query.message === 'string' ? query.message.slice(0, 200) : '결제창이 닫혔거나 결제가 거절되었습니다.';
  return { props: { slug, message } };
};
```

`pages/[locale]/funding/deposit/[orderNo].tsx`:
```tsx
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import BankDepositGuide from '../../../../components/funding/BankDepositGuide';
import { isTokenMatch } from '../../../../lib/booking/token';
import { denyContractPageCaching } from '../../../../lib/contracts/page-cache';
import { expireStalePledges, findFundingOrderByOrderNo } from '../../../../lib/funding/service';

interface Props { orderNo: string; customerName: string; totalAmount: number; holdExpiresAt: string; status: string; manageUrl: string; projectSlug: string }

export default function DepositPage(p: Props) {
  return (
    <>
      <Head><title>무통장입금 안내 | 스튜디오 놀</title><meta name="robots" content="noindex, nofollow" /></Head>
      <main className="mx-auto max-w-lg px-4 pb-24 pt-28">
        <h1 className="text-2xl font-bold">무통장입금 안내</h1>
        <div className="mt-6"><BankDepositGuide {...p} /></div>
        <p className="mt-8 text-sm">입금 확인 후 확정 메일을 보내드립니다. <Link href={p.manageUrl} className="underline">후원 확인 페이지</Link> · <Link href={`/ko/funding/${p.projectSlug}`} className="underline">프로젝트</Link></p>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  denyContractPageCaching(context.res);
  const { locale, orderNo } = context.params as { locale: string; orderNo: string };
  if (locale !== 'ko') return { redirect: { destination: '/ko/funding', permanent: false } };
  const token = context.query.token;
  if (typeof token !== 'string' || !token) return { notFound: true };
  await expireStalePledges(new Date());
  const order = await findFundingOrderByOrderNo(orderNo);
  if (!order?.fundingPledge || !isTokenMatch(order.manageToken, token) || order.fundingPledge.paymentMethod !== 'bank_transfer') return { notFound: true };
  return { props: {
    orderNo: order.orderNo, customerName: order.customerName, totalAmount: order.totalAmount,
    holdExpiresAt: order.fundingPledge.holdExpiresAt.toISOString(), status: order.status,
    manageUrl: `/ko/funding/manage/${order.orderNo}?token=${token}`, projectSlug: order.fundingPledge.projectSlug,
  } };
};
```

`pages/[locale]/funding/manage/[orderNo].tsx`:
```tsx
import { useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { Button } from '../../../../components/ui/Button';
import { formatPriceAmount } from '../../../../data/pricing';
import { isTokenMatch } from '../../../../lib/booking/token';
import { denyContractPageCaching } from '../../../../lib/contracts/page-cache';
import { assessSelfCancel, CANCEL_BLOCK_MESSAGES } from '../../../../lib/funding/policy';
import { computeProjectState, getFundingProject } from '../../../../lib/funding/projects';
import { expireStalePledges, findFundingOrderByOrderNo } from '../../../../lib/funding/service';

interface Props {
  orderNo: string; token: string; projectSlug: string; projectTitle: string; rewardTitle: string; quantity: number; additionalAmount: number;
  totalAmount: number; status: string; paymentMethod: string; fulfillmentStatus: string; shipping: string | null;
  canCancel: boolean; cancelBlockedReason: string | null; refundRequested: boolean; depositUrl: string | null;
}
const STATUS_LABEL: Record<string, string> = { pending: '결제 대기', paid: '후원 확정', refunded: '환불 완료', expired: '만료', failed: '결제 실패' };
const FULFILL_LABEL: Record<string, string> = { none: '준비 전', preparing: '발송 준비 중', shipped: '발송 완료', delivered: '전달 완료' };

export default function FundingManagePage(p: Props) {
  const [status, setStatus] = useState(p.status);
  const [refundRequested, setRefundRequested] = useState(p.refundRequested);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancel = async () => {
    if (!window.confirm(`후원을 취소하고 ${formatPriceAmount(p.totalAmount)}원을 환불받을까요?`)) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/funding/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderNo: p.orderNo, token: p.token }) });
      const json = await res.json();
      if (!res.ok) { setError(json.message ?? '취소에 실패했습니다.'); return; }
      if (json.mode === 'refund_requested') setRefundRequested(true); else setStatus('refunded');
    } catch { setError('네트워크 오류가 발생했습니다.'); } finally { setBusy(false); }
  };
  return (
    <>
      <Head><title>후원 확인 | 스튜디오 놀</title><meta name="robots" content="noindex, nofollow" /></Head>
      <main className="mx-auto max-w-lg px-4 pb-24 pt-28">
        <h1 className="text-2xl font-bold">후원 확인</h1>
        <dl className="mt-6 space-y-2 text-sm">
          <div><dt className="text-gray-500">프로젝트</dt><dd><Link href={`/ko/funding/${p.projectSlug}`} className="underline">{p.projectTitle}</Link></dd></div>
          <div><dt className="text-gray-500">리워드</dt><dd>{p.rewardTitle} × {p.quantity}{p.additionalAmount > 0 ? ` + 추가 후원 ${formatPriceAmount(p.additionalAmount)}원` : ''}</dd></div>
          <div><dt className="text-gray-500">금액</dt><dd>{formatPriceAmount(p.totalAmount)}원 (VAT 포함)</dd></div>
          <div><dt className="text-gray-500">상태</dt><dd>{STATUS_LABEL[status] ?? status}{refundRequested && status === 'paid' ? ' · 환불 요청 접수' : ''}</dd></div>
          {status === 'paid' && <div><dt className="text-gray-500">리워드 발송</dt><dd>{FULFILL_LABEL[p.fulfillmentStatus]}</dd></div>}
          {p.shipping && <div><dt className="text-gray-500">배송지</dt><dd>{p.shipping}</dd></div>}
          <div><dt className="text-gray-500">주문번호</dt><dd>{p.orderNo}</dd></div>
        </dl>
        {status === 'pending' && p.depositUrl && <p className="mt-6"><Link href={p.depositUrl} className="underline">무통장입금 안내 보기</Link></p>}
        {status === 'paid' && !refundRequested && (p.canCancel
          ? <Button className="mt-8" variant="outline" onClick={cancel} disabled={busy}>후원 취소 (전액 환불)</Button>
          : <p className="mt-8 text-sm text-gray-500">{p.cancelBlockedReason} 문의: 010-4255-7893 · hello@studionol.co.kr</p>)}
        {error && <p role="alert" className="mt-3 text-red-600">{error}</p>}
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  denyContractPageCaching(context.res);
  const { locale, orderNo } = context.params as { locale: string; orderNo: string };
  if (locale !== 'ko') return { redirect: { destination: '/ko/funding', permanent: false } };
  const token = context.query.token;
  if (typeof token !== 'string' || !token) return { notFound: true };
  const now = new Date();
  await expireStalePledges(now);
  const order = await findFundingOrderByOrderNo(orderNo);
  if (!order?.fundingPledge || !isTokenMatch(order.manageToken, token)) return { notFound: true };
  const pl = order.fundingPledge;
  const project = getFundingProject(pl.projectSlug);
  const verdict = assessSelfCancel({ orderStatus: order.status, projectState: project ? computeProjectState(project, now) : 'closed', fulfillmentStatus: pl.fulfillmentStatus });
  const shipping = pl.shippingAddress1 ? `${pl.shippingName} · ${pl.shippingPhone} · (${pl.shippingPostcode}) ${pl.shippingAddress1} ${pl.shippingAddress2 ?? ''}` : null;
  return { props: {
    orderNo: order.orderNo, token, projectSlug: pl.projectSlug, projectTitle: project?.title ?? pl.projectSlug, rewardTitle: pl.rewardTitle,
    quantity: pl.quantity, additionalAmount: pl.additionalAmount, totalAmount: order.totalAmount, status: order.status,
    paymentMethod: pl.paymentMethod, fulfillmentStatus: pl.fulfillmentStatus, shipping,
    canCancel: verdict.ok, cancelBlockedReason: verdict.ok ? null : CANCEL_BLOCK_MESSAGES[verdict.code],
    refundRequested: pl.refundRequestedAt !== null,
    depositUrl: pl.paymentMethod === 'bank_transfer' ? `/ko/funding/deposit/${order.orderNo}?token=${token}` : null,
  } };
};
```

- [ ] **Step 10: 확인** — `npm run type-check`, `npx jest components/funding components/booking` → PASS. `npm run dev`로 `/ko/funding/smoke-test/pledge` 진입(임시로 `status: auto`) → 무통장 신청 → deposit 페이지 → manage 페이지까지 눈으로 확인 후 `draft`로 되돌린다.

- [ ] **Step 11: 커밋**

```bash
git add components/booking/TossPaymentWidget.tsx components/booking/TossPaymentWidget.test.tsx components/funding 'pages/[locale]/funding'
git commit -m "feat(funding): 후원 위저드·토스 결제·무통장 안내·success/fail·후원 확인·셀프 취소 페이지"
```

---

### Task 11: 관리자 — 목록·상세·액션·수기 등록·CSV

**Files:**
- Create: `lib/funding/csv.ts`, `lib/funding/csv.test.ts`, `lib/funding/admin-serialize.ts`
- Create: `pages/api/admin/funding/pledges/index.ts`, `pages/api/admin/funding/pledges/[id].ts`, `pages/api/admin/funding/export.ts`
- Create: `pages/admin/funding/index.tsx`, `pages/admin/funding/[id].tsx`, `components/admin/fundingActions.ts`
- Modify: `pages/admin/index.tsx` (카드 추가)

**Interfaces:**
- Consumes: Task 4·6 함수, 기존 `authenticateAdminRequest`·`authenticateAdminApi`, `bookingActions.ts` 패턴.
- Produces:
```ts
// csv.ts
export const toCsv = (rows: Array<Record<string, string | number | null>>, columns: string[]): string; // BOM + CRLF, 따옴표 이스케이프
// admin-serialize.ts
export interface AdminPledgeItem { id: string; orderNo: string; projectSlug: string; status: string; paymentMethod: string; entrySource: string; customerName: string; customerPhone: string; customerEmail: string; rewardTitle: string; quantity: number; additionalAmount: number; totalAmount: number; fulfillmentStatus: string; trackingCompany: string|null; trackingNumber: string|null; shipping: string|null; supporterMessage: string|null; refundRequestedAt: string|null; paidAt: string|null; holdExpiresAt: string; createdAt: string; adminMemo: string|null; notificationError: string|null; hasPayment: boolean; mismatch: boolean; duplicateWarning: boolean }
export const serializePledgeForAdmin = (order: FundingOrder, duplicateKeys: Set<string>): AdminPledgeItem;
// API
// GET  /api/admin/funding/pledges?slug=       → { ok, items: AdminPledgeItem[] }
// POST /api/admin/funding/pledges             → 수기 등록 { projectSlug, rewardId, quantity, additionalAmount, customerName, customerPhone, customerEmail, displayNamePublic, shipping?, adminMemo? } → 201 { ok, orderNo }
// PATCH /api/admin/funding/pledges/[id]       → { action: 'confirm_deposit' | 'refund' | 'set_fulfillment' | 'set_memo' | 'resend_email', fulfillmentStatus?, trackingCompany?, trackingNumber?, adminMemo? }
// GET  /api/admin/funding/export?slug=        → text/csv
```

- [ ] **Step 1: CSV 실패 테스트**

`lib/funding/csv.test.ts`:
```ts
import { toCsv } from './csv';
it('BOM·CRLF·따옴표 이스케이프', () => {
  const out = toCsv([{ a: '김 "후원"', b: 5, c: null }, { a: '줄\n바꿈', b: 0, c: 'x' }], ['a', 'b', 'c']);
  expect(out.startsWith('﻿')).toBe(true);
  expect(out).toBe('﻿a,b,c\r\n"김 ""후원""",5,\r\n"줄\n바꿈",0,x\r\n');
});
```

- [ ] **Step 2: 실패 확인** — `npx jest lib/funding/csv` → 모듈 없음.

- [ ] **Step 3: csv·serialize 구현**

`lib/funding/csv.ts`:
```ts
const cell = (v: string | number | null): string => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (rows: Array<Record<string, string | number | null>>, columns: string[]): string =>
  '﻿' + [columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c] ?? null)).join(','))].join('\r\n') + '\r\n';
```

`lib/funding/admin-serialize.ts`:
```ts
import type { FundingOrder } from './service';

export interface AdminPledgeItem { /* Interfaces 블록 그대로 */ }

/** 동명·동액 경고 키: pending 무통장 건끼리 이름+금액이 같으면 관리자가 입금 매칭을 헷갈린다. */
export const duplicateKey = (o: FundingOrder): string => `${o.customerName}:${o.totalAmount}`;

export const serializePledgeForAdmin = (o: FundingOrder, duplicateKeys: Set<string>): AdminPledgeItem => {
  const p = o.fundingPledge!;
  return {
    id: o.id, orderNo: o.orderNo, projectSlug: p.projectSlug, status: o.status, paymentMethod: p.paymentMethod, entrySource: p.entrySource,
    customerName: o.customerName, customerPhone: o.customerPhone, customerEmail: o.customerEmail,
    rewardTitle: p.rewardTitle, quantity: p.quantity, additionalAmount: p.additionalAmount, totalAmount: o.totalAmount,
    fulfillmentStatus: p.fulfillmentStatus, trackingCompany: p.trackingCompany, trackingNumber: p.trackingNumber,
    shipping: p.shippingAddress1 ? `${p.shippingName} / ${p.shippingPhone} / (${p.shippingPostcode}) ${p.shippingAddress1} ${p.shippingAddress2 ?? ''} / ${p.shippingMemo ?? ''}` : null,
    supporterMessage: p.supporterMessage, refundRequestedAt: p.refundRequestedAt?.toISOString() ?? null,
    paidAt: p.paidAt?.toISOString() ?? null, holdExpiresAt: p.holdExpiresAt.toISOString(), createdAt: o.createdAt.toISOString(),
    adminMemo: p.adminMemo, notificationError: o.notificationError, hasPayment: o.payments.length > 0,
    mismatch: o.status === 'pending' && o.payments.length > 0,
    duplicateWarning: o.status === 'pending' && p.paymentMethod === 'bank_transfer' && duplicateKeys.has(duplicateKey(o)),
  };
};
```

- [ ] **Step 4: API 구현**

`pages/api/admin/funding/pledges/index.ts`:
```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { eq, sql } from 'drizzle-orm';

import { getDb } from '../../../../../db/client';
import { fundingPledges, orders } from '../../../../../db/schema';
import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';
import { generateManageToken } from '../../../../../lib/booking/token';
import { duplicateKey, serializePledgeForAdmin } from '../../../../../lib/funding/admin-serialize';
import { computeFundingAmounts } from '../../../../../lib/funding/amounts';
import { findReward, getFundingProject } from '../../../../../lib/funding/projects';
import { expireStalePledges, generateFundingOrderNo, type FundingOrder } from '../../../../../lib/funding/service';

export const listFundingOrders = async (slug: string | null): Promise<FundingOrder[]> => {
  const rows = await getDb().query.orders.findMany({
    where: (t, { eq: e }) => e(t.type, 'funding'),
    with: { fundingPledge: true, payments: true },
    orderBy: (t, { desc }) => [desc(t.createdAt)],
    limit: 201,
  });
  return (rows as FundingOrder[]).filter((o) => o.fundingPledge && (!slug || o.fundingPledge.projectSlug === slug));
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });

  if (req.method === 'GET') {
    await expireStalePledges(new Date());
    const slug = typeof req.query.slug === 'string' ? req.query.slug : null;
    const items = await listFundingOrders(slug);
    const counts = new Map<string, number>();
    for (const o of items) if (o.status === 'pending' && o.fundingPledge?.paymentMethod === 'bank_transfer') counts.set(duplicateKey(o), (counts.get(duplicateKey(o)) ?? 0) + 1);
    const dups = new Set([...counts].filter(([, n]) => n > 1).map(([k]) => k));
    return res.status(200).json({ ok: true, items: items.slice(0, 200).map((o) => serializePledgeForAdmin(o, dups)), truncated: items.length > 200 });
  }

  if (req.method === 'POST') {
    const b = (typeof req.body === 'object' && req.body) || {};
    const project = getFundingProject(String(b.projectSlug ?? ''));
    const reward = project && typeof b.rewardId === 'string' ? findReward(project, b.rewardId) : undefined;
    const quantity = Number(b.quantity ?? 1);
    const additionalAmount = Number(b.additionalAmount ?? 0);
    if (!project || !reward || !Number.isInteger(quantity) || quantity < 1 || !Number.isInteger(additionalAmount) || additionalAmount < 0
      || typeof b.customerName !== 'string' || !b.customerName)
      return res.status(400).json({ ok: false, message: '프로젝트·리워드·수량·이름을 확인해 주세요.' });
    const now = new Date();
    const amounts = computeFundingAmounts(reward.amount, quantity, additionalAmount);
    const orderNo = generateFundingOrderNo(now, true);
    const db = getDb();
    const [order] = await db.insert(orders).values({
      orderNo, type: 'funding', status: 'paid', customerName: b.customerName, customerPhone: String(b.customerPhone ?? '-'), customerEmail: String(b.customerEmail ?? 'manual@studionol.co.kr'),
      ...amounts, manageToken: generateManageToken(),
    }).returning({ id: orders.id });
    const s = (typeof b.shipping === 'object' && b.shipping) || {};
    await db.insert(fundingPledges).values({
      orderId: order.id, projectSlug: project.slug, rewardId: reward.id, rewardTitle: reward.title, unitAmount: reward.amount, quantity, additionalAmount,
      paymentMethod: 'bank_transfer', holdExpiresAt: now, paidAt: now, displayNamePublic: b.displayNamePublic === true, entrySource: 'manual',
      shippingName: s.name ?? null, shippingPhone: s.phone ?? null, shippingPostcode: s.postcode ?? null, shippingAddress1: s.address1 ?? null, shippingAddress2: s.address2 ?? null, shippingMemo: s.memo ?? null,
      adminMemo: typeof b.adminMemo === 'string' ? b.adminMemo : null,
    });
    return res.status(201).json({ ok: true, orderNo });
  }
  return res.status(405).json({ ok: false });
}
```
(`sql`·`eq` import는 쓰지 않으면 지운다.)

`pages/api/admin/funding/pledges/[id].ts`:
```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { eq } from 'drizzle-orm';

import { getDb } from '../../../../../db/client';
import { fulfillmentStatusEnum, fundingPledges, orders } from '../../../../../db/schema';
import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';
import { confirmBankDeposit } from '../../../../../lib/funding/bank-transfer';
import { cancelFundingPledge } from '../../../../../lib/funding/cancel';
import { sendFundingBankDepositEmails, sendFundingConfirmedEmails } from '../../../../../lib/funding/email';
import { getFundingProject } from '../../../../../lib/funding/projects';
import { findFundingOrderById } from '../../../../../lib/funding/service';

const CANCEL_STATUS: Record<string, number> = { not_found: 404, invalid_state: 409, toss_failed: 502, recording_failed: 500 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  if (req.method !== 'PATCH') return res.status(405).json({ ok: false });
  const id = String(req.query.id ?? '');
  const order = await findFundingOrderById(id);
  if (!order?.fundingPledge) return res.status(404).json({ ok: false, message: '후원을 찾을 수 없습니다.' });
  const b = (typeof req.body === 'object' && req.body) || {};
  const now = new Date();
  const db = getDb();

  switch (b.action) {
    case 'confirm_deposit': {
      const r = await confirmBankDeposit({ orderId: order.id, now });
      return r.ok ? res.status(200).json({ ok: true }) : res.status(409).json({ ok: false, message: r.message });
    }
    case 'refund': {
      const r = await cancelFundingPledge({ orderNo: order.orderNo, requestedBy: 'admin', reason: typeof b.reason === 'string' && b.reason ? b.reason : '관리자 환불', now });
      return r.ok ? res.status(200).json({ ok: true, mode: r.mode }) : res.status(CANCEL_STATUS[r.code] ?? 500).json({ ok: false, message: r.message });
    }
    case 'set_fulfillment': {
      const status = b.fulfillmentStatus;
      if (!(fulfillmentStatusEnum as readonly string[]).includes(status)) return res.status(400).json({ ok: false, message: '발송 상태가 올바르지 않습니다.' });
      if (order.status !== 'paid') return res.status(409).json({ ok: false, message: '확정된 후원만 발송 상태를 바꿀 수 있습니다.' });
      await db.update(fundingPledges).set({
        fulfillmentStatus: status, trackingCompany: typeof b.trackingCompany === 'string' ? b.trackingCompany : order.fundingPledge.trackingCompany,
        trackingNumber: typeof b.trackingNumber === 'string' ? b.trackingNumber : order.fundingPledge.trackingNumber, updatedAt: now,
      }).where(eq(fundingPledges.id, order.fundingPledge.id));
      return res.status(200).json({ ok: true });
    }
    case 'set_memo': {
      await db.update(fundingPledges).set({ adminMemo: typeof b.adminMemo === 'string' ? b.adminMemo : null, updatedAt: now }).where(eq(fundingPledges.id, order.fundingPledge.id));
      return res.status(200).json({ ok: true });
    }
    case 'resend_email': {
      const project = getFundingProject(order.fundingPledge.projectSlug);
      const err = order.status === 'paid' ? await sendFundingConfirmedEmails(order, project)
        : order.fundingPledge.paymentMethod === 'bank_transfer' ? await sendFundingBankDepositEmails(order, project) : '재발송할 메일이 없는 상태';
      await db.update(orders).set({ notificationError: err, updatedAt: now }).where(eq(orders.id, order.id));
      return err ? res.status(502).json({ ok: false, message: err }) : res.status(200).json({ ok: true });
    }
    default:
      return res.status(400).json({ ok: false, message: 'action이 올바르지 않습니다.' });
  }
}
```

`pages/api/admin/funding/export.ts`:
```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateAdminApi } from '../../../../lib/contracts/admin-auth';
import { toCsv } from '../../../../lib/funding/csv';
import { listFundingOrders } from './pledges/index';

const COLUMNS = ['orderNo', 'status', 'paymentMethod', 'customerName', 'customerPhone', 'customerEmail', 'rewardTitle', 'quantity', 'additionalAmount', 'totalAmount', 'shippingName', 'shippingPhone', 'shippingPostcode', 'shippingAddress1', 'shippingAddress2', 'shippingMemo', 'fulfillmentStatus', 'trackingNumber', 'supporterMessage', 'paidAt'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateAdminApi(req, res);
  if (!auth.ok) return res.status(401).json({ ok: false });
  const slug = typeof req.query.slug === 'string' ? req.query.slug : null;
  const items = (await listFundingOrders(slug)).filter((o) => o.status === 'paid');
  const rows = items.map((o) => {
    const p = o.fundingPledge!;
    return { orderNo: o.orderNo, status: o.status, paymentMethod: p.paymentMethod, customerName: o.customerName, customerPhone: o.customerPhone, customerEmail: o.customerEmail,
      rewardTitle: p.rewardTitle, quantity: p.quantity, additionalAmount: p.additionalAmount, totalAmount: o.totalAmount,
      shippingName: p.shippingName, shippingPhone: p.shippingPhone, shippingPostcode: p.shippingPostcode, shippingAddress1: p.shippingAddress1, shippingAddress2: p.shippingAddress2, shippingMemo: p.shippingMemo,
      fulfillmentStatus: p.fulfillmentStatus, trackingNumber: p.trackingNumber, supporterMessage: p.supporterMessage, paidAt: p.paidAt?.toISOString() ?? null };
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="funding-${slug ?? 'all'}.csv"`);
  return res.status(200).send(toCsv(rows, COLUMNS));
}
```
(`listFundingOrders`를 API 라우트 파일에서 export하면 Next가 페이지 export로 오해할 수 있다 — 빌드 경고가 나면 `lib/funding/admin-list.ts`로 옮기고 두 라우트가 거기서 import한다.)

- [ ] **Step 5: 관리자 화면**

`components/admin/fundingActions.ts`(`bookingActions.ts`와 같은 얕은 래퍼):
```ts
export interface FundingActionResult { ok: boolean; message?: string }
const readMessage = async (r: Response, fb: string) => { try { return (await r.json())?.message || fb; } catch { return fb; } };
export const patchPledge = async (id: string, body: Record<string, unknown>): Promise<FundingActionResult> => {
  try {
    const r = await fetch(`/api/admin/funding/pledges/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) });
    return r.ok ? { ok: true } : { ok: false, message: await readMessage(r, '처리에 실패했습니다.') };
  } catch { return { ok: false, message: '네트워크 오류' }; }
};
export const createManualPledge = async (body: Record<string, unknown>): Promise<FundingActionResult> => {
  try {
    const r = await fetch('/api/admin/funding/pledges', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) });
    return r.ok ? { ok: true } : { ok: false, message: await readMessage(r, '등록에 실패했습니다.') };
  } catch { return { ok: false, message: '네트워크 오류' }; }
};
```

`pages/admin/funding/index.tsx`: `pages/admin/bookings/index.tsx`를 본떠 만든다. `getServerSideProps`: `authenticateAdminRequest` → `expireStalePledges` → `listFundingOrders(slug)`(query `slug`) → `serializePledgeForAdmin` → props `{ items, truncated, projects: getAllFundingProjects().map(p => ({ slug, title })), slug }`. 화면: 상단 프로젝트 탭(전체 + 각 프로젝트), 합계 4개(확정 금액 = paid 합, 후원자 수, 입금 대기 금액·건수), 미정합(`mismatch`) 건 경고 박스, 표(주문번호 링크→`/admin/funding/[id]`, 상태, 결제수단, 이름, 리워드×수량, 금액, 발송, `duplicateWarning`이면 ⚠ 표시), 우상단 "CSV 내보내기"(`/api/admin/funding/export?slug=`) 링크와 "수기 등록" 폼(프로젝트·리워드 select, 수량, 추가금, 이름, 연락처, 이메일, 메모 → `createManualPledge` → `router.replace(router.asPath)`).

`pages/admin/funding/[id].tsx`: `authenticateAdminRequest` → `findFundingOrderById` → `serializePledgeForAdmin(order, new Set())`. 화면: 모든 필드 표시(배송지·응원 메시지·메모·notificationError 포함) + 버튼: `status==='pending'||'expired'` && bank → "입금 확인"(`patchPledge(id,{action:'confirm_deposit'})`), `status==='paid'` → "환불"(확인창 후 `{action:'refund', reason}`), 발송 상태 select + 운송장 입력 + "저장"(`{action:'set_fulfillment',...}`), 메모 textarea + "저장"(`{action:'set_memo'}`), "메일 재발송"(`{action:'resend_email'}`). 각 액션 뒤 `router.replace(router.asPath)`.

`pages/admin/index.tsx`에 예약 관리 버튼 아래 추가:
```tsx
<Link href="/admin/funding" passHref>
  <Button fullWidth size="lg" variant="secondary">펀딩 관리</Button>
</Link>
```

- [ ] **Step 6: 확인** — `npx jest lib/funding/csv` PASS, `npm run type-check` 0 errors, `npm run dev`로 `/admin/funding`에서 수기 등록 → 목록 → 상세 → 발송 상태 변경 → CSV 다운로드까지 눈으로 확인(로컬 DB가 Turso를 가리키므로 등록한 수기 건은 확인 뒤 상세에서 환불(`recorded`) 처리해 `refunded`로 남긴다 — 삭제 기능은 없다).

- [ ] **Step 7: 커밋**

```bash
git add lib/funding/csv.ts lib/funding/csv.test.ts lib/funding/admin-serialize.ts pages/api/admin/funding pages/admin/funding pages/admin/index.tsx components/admin/fundingActions.ts
git commit -m "feat(funding): 관리자 — 후원 목록·상세·입금 확인·환불·발송·수기 등록·CSV"
```

---

### Task 12: 펀딩 약관 페이지 + `/ko/terms` 링크

**Files:**
- Create: `pages/[locale]/funding/terms.tsx`
- Modify: `pages/[locale]/terms.tsx` (환불규정 아래에 링크 한 줄)
- Test: `pages/[locale]/funding/terms.test.tsx`

**Interfaces:**
- Consumes: `getSiteConfig('ko')`, `studioOperator`, Task 3 `BANK_ACCOUNT`·`PRIVACY_RETENTION_TEXT`.
- Produces: `export const FUNDING_TERMS_SECTIONS: Array<{ heading: string; body: string[] }>` (테스트와 신뢰 고지가 참조).

- [ ] **Step 1: 실패하는 테스트**

`pages/[locale]/funding/terms.test.tsx`:
```tsx
import { FUNDING_TERMS_SECTIONS } from './terms';
it('스펙 §9의 16개 조항이 모두 있고 핵심 문구를 담는다', () => {
  expect(FUNDING_TERMS_SECTIONS).toHaveLength(16);
  const all = FUNDING_TERMS_SECTIONS.map((s) => `${s.heading}\n${s.body.join('\n')}`).join('\n');
  for (const must of ['통신판매', '기부가 아닙니다', '기부금영수증', 'Keep-it-All', '청약철회', '7일', '3개월', '30일', '3영업일', '리워드 전달 완료 후 1년']) {
    expect(all).toContain(must);
  }
});
```

- [ ] **Step 2: 실패 확인** — `npx jest 'pages/\[locale\]/funding/terms'` → 모듈 없음.

- [ ] **Step 3: 구현**

`pages/[locale]/funding/terms.tsx` — `pages/[locale]/terms.tsx`의 골격(`getServerSideProps` 비-ko redirect, `SEO`에 `robots="noindex, nofollow"`, `Section` 안에 조항 렌더)을 따르되 조항은 아래 상수로 둔다. 사업자 정보 조항은 `siteConfig`에서 렌더한다(하드코딩 금지).
```ts
export const FUNDING_TERMS_SECTIONS = [
  { heading: '제1조 (목적)', body: ['이 약관은 스튜디오 놀(이하 "스튜디오")이 운영하는 펀딩 페이지에서 후원자가 리워드를 선주문하는 거래의 조건과 절차, 당사자의 권리·의무를 정합니다.'] },
  { heading: '제2조 (정의)', body: ['"프로젝트"는 스튜디오가 제작하는 음반·콘텐츠의 제작비를 모으기 위해 개설한 펀딩 페이지를 말합니다.', '"리워드"는 후원 금액에 따라 스튜디오가 제공하기로 정한 재화 또는 용역(CD, 굿즈, 디지털 음원, 감사 메일 등)입니다.', '"후원"은 후원자가 리워드를 선택하고 대금을 결제하여 리워드 선주문 계약을 체결하는 행위입니다.'] },
  { heading: '제3조 (후원의 법적 성격)', body: ['후원은 전자상거래 등에서의 소비자보호에 관한 법률에 따른 통신판매 계약이며, 기부가 아닙니다.', '스튜디오는 기부금영수증을 발급하지 않으며 후원금은 세액공제 대상이 아닙니다. 페이지의 "후원"·"응원" 표현은 리워드 선주문을 뜻합니다.'] },
  { heading: '제4조 (사업자 정보)', body: ['판매자·통신판매업자는 스튜디오 놀입니다. 상호·대표자·사업자등록번호·통신판매업 신고번호·주소·연락처는 이 페이지 하단과 사이트 푸터에 표시합니다.'] },
  { heading: '제5조 (후원 신청과 결제)', body: ['후원은 리워드·수량·후원자 정보·배송지(배송 리워드에 한함)를 입력하고 결제를 완료한 때 성립합니다.', '온라인 결제는 결제 대기 15분, 무통장입금은 12시간 안에 완료되어야 하며 기한이 지나면 신청이 자동 해제됩니다.', '한정 수량 리워드는 온라인 결제로만 후원할 수 있습니다.'] },
  { heading: '제6조 (후원금의 집행)', body: ['프로젝트는 Keep-it-All 방식입니다. 목표 금액에 미달하더라도 모금액으로 제작을 진행하며, 목표 미달을 이유로 후원이 취소되지 않습니다.', '제작이 불가능해진 경우 스튜디오는 후원자에게 고지하고 후원금 전액을 환불합니다.'] },
  { heading: '제7조 (리워드의 제공)', body: ['리워드의 예상 전달 시기는 제작 계획에 따른 예정이며, 지연이 예상되면 스튜디오는 후원자에게 이메일로 고지합니다.', '배송 리워드는 후원자가 입력한 배송지로 발송하며, 배송지 오류로 인한 반송·재발송 비용은 후원자가 부담합니다.'] },
  { heading: '제8조 (청약철회의 권리 및 기간)', body: ['후원자는 프로젝트 마감 전이고 리워드 발송 준비가 시작되기 전이면 후원 확인 페이지에서 언제든 후원을 취소하고 전액 환불받을 수 있습니다.', '리워드를 받은 날부터 7일 이내에 청약철회할 수 있습니다. 리워드가 표시·광고 내용과 다르거나 계약 내용과 다르게 이행된 경우 리워드를 받은 날부터 3개월 이내, 그 사실을 안 날부터 30일 이내에 청약철회할 수 있습니다.'] },
  { heading: '제9조 (청약철회의 제한)', body: ['후원자의 책임 있는 사유로 리워드가 멸실·훼손된 경우, 사용으로 가치가 현저히 감소한 경우, 복제가 가능한 음원·영상의 포장을 훼손한 경우에는 청약철회가 제한됩니다.', '후원자 요청에 따라 개별 제작(각인·이름 인쇄 등)되는 리워드는 청약철회가 제한된다는 사실을 리워드 설명에 표시하고 후원자의 동의를 받은 경우 청약철회가 제한됩니다.'] },
  { heading: '제10조 (환불)', body: ['환불은 청약철회 접수일부터 3영업일 이내에 처리합니다. 온라인 결제는 결제 수단으로 취소하며, 무통장입금은 후원자가 알려준 계좌로 송금합니다.', '리워드를 받은 뒤 청약철회하는 경우 리워드 반환에 드는 비용은 후원자가 부담합니다. 다만 리워드가 표시·광고와 다른 경우에는 스튜디오가 부담합니다.'] },
  { heading: '제11조 (환불 지연에 대한 배상)', body: ['스튜디오가 환불을 지연한 경우 전자상거래법이 정하는 지연배상금을 지급합니다.'] },
  { heading: '제12조 (후원자의 의무)', body: ['후원자는 정확한 이름·연락처·이메일·배송지를 입력해야 하며, 무통장입금 시 입금자명을 후원 신청 이름과 같게 해야 합니다.', '타인의 정보를 도용하거나 결제 수단을 부정하게 사용해서는 안 됩니다.'] },
  { heading: '제13조 (개인정보의 처리)', body: [`스튜디오는 후원 확정·리워드 발송·고객 응대 목적으로 후원자의 이름·연락처·이메일·배송지를 수집하며, ${PRIVACY_RETENTION_TEXT} 보관한 뒤 파기합니다. 전자상거래법 등 법령이 더 긴 보존을 요구하는 거래 기록은 그 기간 동안 보관합니다.`, '후원자 명단 공개에 동의한 후원자의 이름은 프로젝트 페이지에 표시되며, 동의는 후원 확인 페이지 또는 문의로 철회할 수 있습니다.'] },
  { heading: '제14조 (면책)', body: ['천재지변·전쟁·배송사 사정 등 스튜디오의 통제를 벗어난 사유로 리워드 제공이 지연된 경우 그 기간 동안 책임을 지지 않습니다. 다만 그 사실을 후원자에게 고지합니다.'] },
  { heading: '제15조 (분쟁 해결)', body: ['후원과 관련한 분쟁은 스튜디오와 후원자가 성실히 협의하여 해결하며, 협의가 어려우면 한국소비자원 등 분쟁조정기구의 조정을 받을 수 있습니다.'] },
  { heading: '제16조 (준거법 및 문의처)', body: ['이 약관은 대한민국 법을 따르며, 분쟁의 관할은 민사소송법에 따릅니다.', '문의: hello@studionol.co.kr · 010-4255-7893'] },
];
```
`pages/[locale]/terms.tsx`의 환불규정 아래에 `<p className="mt-6 text-sm"><Link href="/ko/funding/terms">펀딩(리워드 선주문) 약관 보기</Link></p>`를 추가한다.

- [ ] **Step 4: 통과 확인** — `npx jest 'pages/\[locale\]/funding/terms'` PASS. `npm run type-check`.

- [ ] **Step 5: 커밋**

```bash
git add 'pages/[locale]/funding/terms.tsx' 'pages/[locale]/funding/terms.test.tsx' 'pages/[locale]/terms.tsx'
git commit -m "feat(funding): 펀딩 약관 페이지(통신판매·Keep-it-All·청약철회) + 이용약관 링크"
```

---

### Task 13: 헤더 · i18n · 사이트맵 · robots · llms · GA4 · content 게이트

**Files:**
- Modify: `components/layout/Header.tsx`, `public/locales/{ko,en,zh,es,vi,th,uz}/common.json`, `lib/sitemap/routes.js`, `next-sitemap.config.js`, `public/robots.txt`(생성물), `lib/sitemap/pageLastmod.json`(생성물), `pages/api/llms.ts`, `utils/analytics.ts`
- Create: `content/funding.test.ts`
- Test: `components/layout/Header.test.tsx`(케이스 추가), `content/funding.test.ts`

**Interfaces:**
- Consumes: Task 2 로더.
- Produces: `nav.funding` i18n 키, `MicroEventName`에 `'funding_pledge_start' | 'funding_pledge_paid'` 추가.

- [ ] **Step 1: 실패하는 테스트**

`components/layout/Header.test.tsx`에 추가(기존 렌더 헬퍼 사용):
```tsx
it('ko에서는 음원 발매 그룹에 펀딩 항목이 있고 en에서는 없다', () => {
  renderHeader({ locale: 'ko' });
  expect(screen.getByRole('link', { name: '펀딩' })).toHaveAttribute('href', '/ko/funding');
  cleanup();
  renderHeader({ locale: 'en' });
  expect(screen.queryByRole('link', { name: /Funding/ })).toBeNull();
});
```
(드롭다운 항목이 닫힌 상태에서 DOM에 있는지 `DropdownMenu`를 확인한다. 항상 렌더되지 않으면 트리거를 클릭한 뒤 조회한다.)

`content/funding.test.ts`:
```ts
/** @jest-environment node */
import fs from 'node:fs';
import path from 'node:path';
import { FUNDING_DIR, getAllFundingProjects, parseFundingProject } from '../lib/funding/projects';

describe('content/funding', () => {
  const files = fs.existsSync(FUNDING_DIR) ? fs.readdirSync(FUNDING_DIR).filter((f) => f.endsWith('.md')) : [];
  it.each(files)('%s — frontmatter가 유효하다', (file) => {
    expect(() => parseFundingProject(fs.readFileSync(path.join(FUNDING_DIR, file), 'utf-8'), file.replace(/\.md$/, ''))).not.toThrow();
  });
  it('cover·리워드 이미지 파일이 존재한다', () => {
    for (const p of getAllFundingProjects()) {
      for (const img of [p.cover, p.ogImage, ...p.rewards.map((r) => r.image)]) {
        if (img) expect(fs.existsSync(path.join(process.cwd(), 'public', img))).toBe(true);
      }
    }
  });
  it('slug는 [a-z0-9-]만 쓴다', () => {
    for (const p of getAllFundingProjects()) expect(p.slug).toMatch(/^[a-z0-9-]+$/);
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx jest components/layout/Header content/funding` → 헤더 케이스 FAIL(content 테스트는 통과할 수 있다 — 정상).

- [ ] **Step 3: 구현**

`components/layout/Header.tsx` `navGroups`의 `release` 항목:
```ts
items: [
  { label: t('nav.releaseProject'), href: `/${locale}/release-project` },
  { label: t('nav.releaseSingle'), href: `/${locale}/release-project/single` },
  { label: t('nav.releaseEp'), href: `/${locale}/release-project/ep` },
  { label: t('nav.releaseAlbum'), href: `/${locale}/release-project/album` },
  // 펀딩 퍼널은 ko 전용(스펙 §8) — 다른 로케일엔 항목 자체를 넣지 않는다.
  ...(locale === 'ko' ? [{ label: t('nav.funding'), href: `/${locale}/funding` }] : []),
],
```

`public/locales/*/common.json`의 `nav`에 `funding` 추가: ko `펀딩`, en `Funding`, zh `众筹`, es `Crowdfunding`, vi `Gây quỹ`, th `ระดมทุน`, uz `Crowdfunding`.

`lib/sitemap/routes.js`:
- `pageRouteMap`에 `'/funding': path.join('funding', 'index.tsx'),`
- `KO_ONLY_PATH_PREFIXES = ['/guides/', '/funding/']`
- `getLastmod`(pageRouteMap 조회 앞)에:
```js
if (pathWithoutLocale.startsWith('/funding/')) {
  const slug = pathWithoutLocale.split('/')[2];
  const file = path.join(process.cwd(), 'content', 'funding', `${slug}.md`);
  if (slug && fs.existsSync(file)) {
    const m = fs.readFileSync(file, 'utf-8').match(/^lastmod:\s*(\d{4}-\d{2}-\d{2})/m);
    if (m) return `${m[1]}T00:00:00+09:00`;
  }
  return buildTimestamp;
}
```
- `module.exports`에 `fundingDir: path.join(process.cwd(), 'content', 'funding')` 추가.

`next-sitemap.config.js`:
- `exclude`에 `'/*/funding/success', '/*/funding/fail', '/*/funding/deposit/*', '/*/funding/manage/*', '/*/funding/*/pledge', '/*/funding/terms'`
- `disallow`에 `'/ko/funding/success', '/ko/funding/fail', '/ko/funding/deposit/', '/ko/funding/manage/', '/ko/funding/terms'` 및 `'/ko/funding/*/pledge'`
- `additionalPaths` 끝에:
```js
const fundingDir = path.join(process.cwd(), 'content', 'funding');
if (fs.existsSync(fundingDir)) {
  for (const file of fs.readdirSync(fundingDir).filter((f) => f.endsWith('.md'))) {
    const raw = fs.readFileSync(path.join(fundingDir, file), 'utf-8');
    if (/^status:\s*draft/m.test(raw) || /^hidden:\s*true/m.test(raw)) continue;
    const routePath = `/ko/funding/${file.replace(/\.md$/, '')}`;
    results.push({ loc: routePath, lastmod: getLastmod(routePath), changefreq: 'daily', priority: 0.7, alternateRefs: getAlternateRefs(routePath) });
  }
}
```
(`getLastmod`가 이 파일에 import돼 있는지 확인. 이름이 다르면 `lib/sitemap/routes.js`의 해당 export를 쓴다.)

`npm run generate:page-lastmod` 실행 후 `git diff lib/sitemap/pageLastmod.json`을 보고 **`/funding` 항목 외의 변경은 되돌린다**(`git checkout -- lib/sitemap/pageLastmod.json` 후 해당 항목만 손으로 옮긴다 — CLAUDE.md lastmod 정책). `npx next-sitemap`을 돌려 `public/robots.txt`·사이트맵을 재생성하고 robots에 `Disallow: /ko/funding/success` 등이 들어갔는지 확인한다.

`pages/api/llms.ts`: 한국어 서비스 목록의 `/ko/pricing` 줄 부근에 한 줄 추가:
```ts
`펀딩: 스튜디오 놀이 제작하는 음반의 제작비를 리워드(CD·굿즈·음원) 후원으로 모읍니다. 진행 중인 프로젝트: ${siteUrl}/ko/funding`,
```

`utils/analytics.ts`:
```ts
export type MicroEventName = 'micro_click_service' | 'micro_click_contact' | 'funding_pledge_start' | 'funding_pledge_paid';
```
그리고 `PledgeWizard`의 제출 성공 시 `trackMicroEvent('funding_pledge_start', ...)`, `pages/[locale]/funding/success.tsx`의 확정 화면 `useEffect`에서 `trackMicroEvent('funding_pledge_paid', ...)`로 바꾼다. 주석에 "GA4 key event로 지정 금지"를 남긴다.

- [ ] **Step 4: 통과 확인** — `npx jest components/layout content lib/sitemap` → PASS(`localeKeyParity`·`routes.test.js` 포함).

- [ ] **Step 5: 커밋**

```bash
git add components/layout/Header.tsx components/layout/Header.test.tsx public/locales lib/sitemap next-sitemap.config.js public/robots.txt public/sitemap*.xml pages/api/llms.ts utils/analytics.ts content/funding.test.ts components/funding/PledgeWizard.tsx 'pages/[locale]/funding/success.tsx'
git commit -m "feat(funding): 헤더 항목(ko)·i18n·사이트맵·robots·llms·GA4 이벤트·content 게이트"
```

---

### Task 14: 전체 검증 · PR

**Files:** 없음(검증만)

- [ ] **Step 1: 전체 게이트**

```bash
npm run type-check && npm run lint && npm test && npm run check:facts && npm run check:dup-sections && npm run check:cta-routing && npm run build
```
전부 녹색이어야 한다. `Header.test.tsx` 스냅샷이 있으면 `-u`로 갱신하고 diff를 확인한다.

- [ ] **Step 2: 마이그레이션 안내**

프로덕션 DB 적용은 운영자가 한다. PR 본문에 아래를 적는다:
```
배포 전: npm run db:migrate (0009 funding_pledges) — 운영자가 직접 실행
배포 후: content/funding/smoke-test.md status를 auto로 바꾼 커밋 → 1,000원 토스 실결제 → manage에서 셀프 취소(전액 환불) → 무통장 신청 → /admin/funding 입금 확인 → 관리자 환불 기록 → smoke-test를 다시 draft로
전제: 통신판매업 신고번호(siteConfig.mailOrderSalesNumber) 기입 전에는 실제 프로젝트를 열지 않는다
```

- [ ] **Step 3: PR**

```bash
git push -u origin feat/funding
gh pr create --title "feat(funding): 리워드형 크라우드펀딩 1차 — 파일 기반 프로젝트 + 토스·무통장 후원 + 관리자" --body-file <(cat <<'EOF'
스펙: docs/superpowers/specs/2026-09-08-funding-design.md
계획: docs/superpowers/plans/2026-09-09-funding-phase1.md

(Step 2의 배포 전·후 안내를 여기에)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)
gh pr merge --auto --squash
```
아티스트 후원 멤버십 브랜치가 먼저 병합돼 있으면 rebase 후 마이그레이션 번호를 재생성하고(스펙 §13) 웹훅 스위치를 합친다.

---

## 자체 검토 결과

- **스펙 커버리지**: §3(Task 1·2), §4.1(Task 9·10), §4.2(Task 3·4·8), §4.3(Task 5·10), §4.4(Task 5), §4.5(Task 6·8·10·11), §4.6(Task 4), §4.7(Task 3·6·8·10), §4.8(Task 4·8·9), §5(Task 9·10), §6(Task 11), §7(Task 7), §8(Task 13), §9(Task 12), §10(각 태스크의 실패 경로), §11(각 태스크 테스트 + Task 14), §12(태스크 순서), §13(Task 14 rebase 규칙).
- **범위 밖으로 남긴 것(스펙 §14와 일치)**: 응원 메시지 공개 벽, 우편번호 API, JSON-LD, 홈 배너.
- **타입 일관성**: `FundingOrder`(Task 4) → confirm/cancel/bank-transfer/email/admin-serialize 전부 같은 이름. `FundingConfirmOutcome.code`와 예약 `ConfirmOutcome.code`가 같은 집합이라 웹훅 `isTransientConfirmFailure`가 둘 다 받는다. `assessSelfCancel` 입력 필드명(`orderStatus`·`projectState`·`fulfillmentStatus`)은 cancel.ts·manage 페이지에서 동일.
- **알려진 확인 지점(구현자가 파일을 열어 맞출 것)**: `siteConfig` 사업자 필드명(Task 9), `buildPageStaticProps`의 `i18nSections: []` 허용 여부(Task 9), `trackMicroEvent` props 타입(Task 10), API 라우트에서의 named export 경고(Task 11), `next-sitemap.config.js`의 `getLastmod` import 이름(Task 13).
