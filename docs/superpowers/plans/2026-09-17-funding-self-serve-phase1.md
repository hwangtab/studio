# 펀딩 셀프 개설 1차 — DB 정본 전환과 개설자 인증

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 펀딩 프로젝트의 정본을 `content/funding/*.md` 파일에서 DB로 옮길 수 있는 토대를 깔고(파일과 DB가 공존하며 파일이 우선), 아티스트가 이메일 매직링크로 로그인해 자기 프로젝트 목록을 보는 데까지 만든다. 이 1차가 끝나도 **후원자에게 보이는 화면은 하나도 바뀌지 않는다.**

**Architecture:** `lib/funding/shape.ts`가 md 파서와 DB 행이 **같은 검증**을 타게 하는 순수 함수를 갖는다. `lib/funding/repository.ts`가 md → DB 순으로 읽는 비동기 로더를 제공하고, 기존 동기 호출처 14곳이 전부 이쪽으로 옮겨 간다. 공개 페이지는 SSG에서 ISR로 바뀐다. 개설자 인증은 계정·비밀번호 없이 이메일 매직링크 + iron-session 쿠키이며, 관리자 세션과 쿠키·비밀을 분리한다.

**Tech Stack:** Next.js 15 Pages Router, React 19, Turso(libSQL) + Drizzle, iron-session, Resend, Jest(단위 + in-memory libSQL 통합).

**Spec:** `docs/superpowers/specs/2026-09-17-funding-self-serve-design.md`

## Global Constraints

- 작업 위치: worktree `/Users/hwang-gyeongha/studio-worktrees/funding-self-serve`, 브랜치 `feat/funding-self-serve-design`. 공용 트리 `~/studio`는 건드리지 않는다. 모든 명령은 이 worktree에서 실행한다.
- 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- **프로덕션 DB를 건드리는 태스크는 없다.** 마이그레이션 SQL은 `npm run db:generate`로 만들어 커밋만 하고, 적용(`npm run db:migrate`)은 운영자가 직접 한다.
- **md가 항상 이긴다.** 같은 slug가 파일과 DB에 모두 있으면 파일을 쓴다. 공존 기간의 규칙이며 스펙 D5다.
- DB 프로젝트는 `reviewStatus === 'approved'`인 것만 공개 경로에 존재한다. 그 외는 404이며, 목록·사이트맵·llms에도 없다.
- **빌드는 DB 없이 성공해야 한다.** DB 조회는 전부 `try/catch`로 감싸 실패 시 빈 배열·null을 돌려주고 `console.error`만 남긴다(`TURSO_DATABASE_URL`이 없는 CI·로컬 빌드가 실패하면 안 된다).
- 개설자 페이지는 전부 `/ko/` 전용이고 `noindex`, `Cache-Control: no-store`다. 7로케일 번역 키를 추가하지 않는다(ko 하드코딩 문구).
- 금액·날짜 표시는 기존 헬퍼만 쓴다(`formatPriceAmount`). 리터럴 `toLocaleString` 금지.
- 각 태스크 끝에 해당 `npx jest <경로>`가 녹색. 마지막 태스크에서 `npm run type-check && npm run lint && npm test && npm run build`.
- 통합 테스트는 `/** @jest-environment node */` + in-memory libSQL + `drizzle/migrations` 순차 적용. `lib/funding/service.integration.test.ts`의 부트스트랩을 그대로 베낀다.
- 새 env는 `.env.example`에 주석과 함께 추가한다. 값 설정은 운영자 몫.

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `lib/funding/shape.ts` (생성) | frontmatter/DB 공통 검증. `validateFundingProjectShape` 순수 함수 |
| `lib/funding/projects.ts` (수정) | md 파일 로더만 남긴다. 검증은 shape에 위임, 타입은 재export |
| `db/schema.ts` (수정) | `fundingCreators`·`fundingCreatorTokens`·`fundingProjects`·`fundingRewards`·`fundingProjectPayouts` |
| `drizzle/migrations/0017_funding_self_serve.sql` (생성) | 위 5개 테이블 SQL |
| `lib/funding/dbProjects.ts` (생성) | DB 행 → `FundingProject` 변환과 조회(읽기 전용) |
| `lib/funding/repository.ts` (생성) | md + DB 통합 비동기 로더. **앞으로 모든 호출처가 쓰는 유일한 입구** |
| `lib/funding/creatorToken.ts` (생성) | 매직링크 토큰 발급·소진(해시 저장, 15분, 1회용) |
| `lib/funding/creatorSession.ts` (생성) | iron-session 옵션과 세션 획득 |
| `lib/funding/creatorAuth.ts` (생성) | `authenticateCreatorRequest`/`authenticateCreatorApi`/`loginCreatorSession`/`logoutCreatorSession` |
| `lib/funding/creatorEmail.ts` (생성) | 로그인 링크 메일 |
| `lib/funding/creatorProjectList.ts` (생성) | 개설자 본인 프로젝트 목록 조회(소유 조건 강제) |
| `pages/api/funding/creator/login.ts` (생성) | 로그인 메일 요청 |
| `pages/api/funding/creator/logout.ts` (생성) | 세션 파기 |
| `pages/[locale]/funding/apply.tsx` (생성) | 개설 안내 + 이메일 입력 |
| `pages/[locale]/funding/creator/auth.tsx` (생성) | 토큰 소진 → 세션 발급 → 리다이렉트 |
| `pages/[locale]/funding/creator/index.tsx` (생성) | 내 프로젝트 목록 |
| `pages/sitemap-funding.xml.ts` (생성) | DB 프로젝트 전용 동적 사이트맵 |
| `next-sitemap.config.js` (수정) | robots에 위 사이트맵 추가, 개설자 경로 exclude |
| 호출처 14곳 (수정) | 동기 로더 → `repository.ts` 비동기 로더 |

---

## Task 1: 검증 로직을 `shape.ts`로 분리

md 파서 안에 있는 검증을 DB 행도 탈 수 있게 순수 함수로 꺼낸다. 이 태스크는 **동작을 바꾸지 않는다** — 기존 `projects.test.ts`가 그대로 녹색이어야 한다.

**Files:**
- Create: `lib/funding/shape.ts`
- Create: `lib/funding/shape.test.ts`
- Modify: `lib/funding/projects.ts`

**Interfaces:**
- Consumes: 없음(첫 태스크)
- Produces:
  - `validateFundingProjectShape(data: Record<string, unknown>, slug: string, content: string): FundingProject`
  - 타입 `FundingProject`, `FundingReward`, `FundingDownload`, `FundingStatus`, 상수 `FUNDING_STATUSES` — 이제 `shape.ts`가 원본이고 `projects.ts`는 재export만 한다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/funding/shape.test.ts`:

```ts
import { validateFundingProjectShape } from './shape';

const base = () => ({
  title: '제목',
  summary: '요약',
  cover: '/c.webp',
  goalAmount: 1000000,
  startAt: '2026-10-01T10:00:00+09:00',
  endAt: '2026-10-31T23:59:59+09:00',
  rewards: [
    { id: 'cd', title: 'CD', description: '설명', amount: 30000, estimatedDelivery: '2026-12' },
  ],
});

describe('validateFundingProjectShape', () => {
  it('일반 객체(파일이 아닌 입력)를 FundingProject로 만든다', () => {
    const p = validateFundingProjectShape({ ...base(), slug: 'demo' }, 'demo', '본문');
    expect(p.slug).toBe('demo');
    expect(p.content).toBe('본문');
    expect(p.status).toBe('auto');
    expect(p.hidden).toBe(false);
    expect(p.rewards[0]).toMatchObject({ id: 'cd', amount: 30000, requiresShipping: false, downloads: [] });
    // lastmod 기본값은 startAt의 앞 10자다.
    expect(p.lastmod).toBe('2026-10-01');
  });

  it('slug가 인자와 다르면 던진다', () => {
    expect(() => validateFundingProjectShape({ ...base(), slug: 'other' }, 'demo', '')).toThrow(/slug/);
  });

  it('endAt이 startAt보다 앞이면 던진다', () => {
    const d = { ...base(), slug: 'demo', endAt: '2026-09-01T00:00:00+09:00' };
    expect(() => validateFundingProjectShape(d, 'demo', '')).toThrow(/endAt/);
  });

  it('리워드 id가 중복이면 던진다', () => {
    const r = base().rewards[0];
    const d = { ...base(), slug: 'demo', rewards: [r, { ...r }] };
    expect(() => validateFundingProjectShape(d, 'demo', '')).toThrow(/중복/);
  });

  it('리워드가 0개면 던진다', () => {
    expect(() => validateFundingProjectShape({ ...base(), slug: 'demo', rewards: [] }, 'demo', '')).toThrow(/1개 이상/);
  });

  it('status 오타를 조용히 통과시키지 않는다', () => {
    expect(() => validateFundingProjectShape({ ...base(), slug: 'demo', status: 'Draft' }, 'demo', '')).toThrow(/status/);
  });

  it('따옴표 붙은 hidden을 거부한다', () => {
    expect(() => validateFundingProjectShape({ ...base(), slug: 'demo', hidden: 'true' }, 'demo', '')).toThrow(/boolean/);
  });

  it('downloads의 key가 객체 키 형식이 아니면 던진다', () => {
    const d = {
      ...base(),
      slug: 'demo',
      rewards: [{ ...base().rewards[0], downloads: [{ label: 'MP3', key: 'https://example.com/a.zip' }] }],
    };
    expect(() => validateFundingProjectShape(d, 'demo', '')).toThrow(/객체 키/);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx jest lib/funding/shape.test.ts
```

Expected: FAIL — `Cannot find module './shape'`

- [ ] **Step 3: `lib/funding/shape.ts`를 만든다**

`lib/funding/projects.ts`에서 아래를 **잘라내 옮긴다**: 타입 `FundingReward`·`FundingDownload`·`FundingProject`(주석 포함 그대로), `str`·`posInt`·`isoDate`·`enumValue`·`bool`, `FUNDING_STATUSES`·`FundingStatus`, `parseReward`·`parseDownloads`, 그리고 `parseFundingProject` 안의 검증 본문. 주석은 한 줄도 버리지 않는다 — 전부 사고 기록이다.

`shape.ts`의 새 진입점은 이것 하나다:

```ts
/**
 * 프로젝트 한 건의 형태 검증. **md frontmatter와 DB 행이 같은 함수를 탄다.**
 *
 * 예전에는 이 검증이 md 파서 안에만 있었다. 정본이 DB로 옮겨 가면 파서를 안 타는 입력이
 * 생기는데, 그때 검증이 파서에 묶여 있으면 DB 경로는 아무 검사 없이 공개된다 —
 * `status: 'Draft'` 오타가 초안을 공개하고 `hidden: "true"`가 숨김을 푸는, 이 파일이
 * 주석으로 적어 둔 그 사고가 새 경로에서 그대로 재현된다.
 *
 * `data`는 frontmatter이거나 DB 행을 frontmatter 모양으로 편 객체다. `content`는 본문
 * 마크다운이며 `data`에 들어 있지 않다(md는 matter가 떼어 주고, DB는 컬럼이 따로다).
 */
export const validateFundingProjectShape = (
  data: Record<string, unknown>,
  slug: string,
  content: string,
): FundingProject => {
  const d = data;
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
  const status = enumValue(d.status, 'status', FUNDING_STATUSES, 'auto') as FundingStatus;
  return {
    slug,
    title: str(d.title, 'title'),
    summary: str(d.summary, 'summary'),
    cover: str(d.cover, 'cover'),
    ogImage: typeof d.ogImage === 'string' && d.ogImage !== '' ? d.ogImage : null,
    heroImage: typeof d.heroImage === 'string' && d.heroImage !== '' ? d.heroImage : null,
    goalAmount: posInt(d.goalAmount, 'goalAmount'),
    startAt, endAt, status,
    hidden: bool(d.hidden, 'hidden', false),
    lastmod: d.lastmod instanceof Date ? d.lastmod.toISOString().slice(0, 10) : typeof d.lastmod === 'string' ? d.lastmod : startAt.slice(0, 10),
    rewards, content,
  };
};
```

- [ ] **Step 4: `projects.ts`를 shape 위에 다시 세운다**

`projects.ts`에 남는 것은 md 파일 접근과 목록 정렬뿐이다. 파일 상단:

```ts
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

import { computeProjectState, type ProjectState } from './projectState';
import { validateFundingProjectShape } from './shape';

export { computeProjectState, validateFundingProjectShape };
export type { ProjectState };
export {
  FUNDING_STATUSES,
  stripRewardDownloads,
} from './shape';
export type { FundingDownload, FundingProject, FundingReward, FundingStatus } from './shape';
```

`parseFundingProject`는 두 줄이 된다:

```ts
export const parseFundingProject = (raw: string, slug: string): FundingProject => {
  const { data, content } = matter(raw);
  return validateFundingProjectShape(data as Record<string, unknown>, slug, content);
};
```

`stripRewardDownloads`는 타입 곁에 있어야 하므로 주석 그대로 `shape.ts`로 옮기고 위처럼 재export한다. 정렬 헬퍼는 DB 로더도 써야 하므로 **export로 바꾼다**:

```ts
const STATE_ORDER: Record<ProjectState, number> = { live: 0, upcoming: 1, closed: 2, draft: 3 };

/**
 * 공개 목록의 정렬 — live → upcoming → closed, 같은 상태면 시작일 내림차순.
 * md 목록과 DB 목록을 합친 뒤에도 같은 순서를 써야 하므로 밖으로 꺼냈다(repository.ts).
 */
export const sortListableProjects = (projects: FundingProject[], now: Date): FundingProject[] =>
  [...projects].sort((a, b) => STATE_ORDER[computeProjectState(a, now)] - STATE_ORDER[computeProjectState(b, now)]
    || new Date(b.startAt).getTime() - new Date(a.startAt).getTime());

export const getListableFundingProjects = (now: Date = new Date()): FundingProject[] =>
  sortListableProjects(getAllFundingProjects().filter((p) => !p.hidden && computeProjectState(p, now) !== 'draft'), now);
```

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

```bash
npx jest lib/funding/shape.test.ts lib/funding/projects.test.ts content/funding.baseline.test.ts content/fundingImages.baseline.test.ts
```

Expected: 전부 PASS. 기존 테스트가 하나라도 빨가면 옮기는 과정에서 무언가를 빠뜨린 것이다 — 고치지 말고 되돌려 다시 옮긴다.

- [ ] **Step 6: 타입 검사**

```bash
npm run type-check
```

Expected: 오류 없음.

- [ ] **Step 7: 커밋**

```bash
git add lib/funding/shape.ts lib/funding/shape.test.ts lib/funding/projects.ts
git commit -m "$(cat <<'EOF'
refactor(funding): 프로젝트 형태 검증을 shape.ts로 꺼낸다 — md와 DB가 같은 문을 지나게

정본이 DB로 옮겨 가면 파서를 타지 않는 입력이 생긴다. 검증이 md 파서 안에 있으면 그 경로는
검사 없이 공개된다 — status 오타가 초안을 공개하고 따옴표 붙은 hidden이 숨김을 푸는, 이 파일이
주석으로 적어 둔 사고가 새 경로에서 그대로 재현된다. 동작 변화는 없다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 스키마 5개 테이블과 마이그레이션

**Files:**
- Modify: `db/schema.ts`
- Create: `drizzle/migrations/0017_funding_self_serve.sql` (생성기가 만든다)
- Create: `lib/funding/schema.integration.test.ts`

**Interfaces:**
- Consumes: Task 1의 타입
- Produces: 테이블 `fundingCreators`, `fundingCreatorTokens`, `fundingProjects`, `fundingRewards`, `fundingProjectPayouts`와 타입 `FundingCreator`/`NewFundingCreator`/`FundingProjectRow`/`NewFundingProjectRow`/`FundingRewardRow`/`NewFundingRewardRow`. 열거형 `fundingReviewStatusEnum`.
  - **행 타입 이름에 `Row`를 붙이는 이유**: `FundingProject`는 이미 화면이 쓰는 도메인 타입이다. 같은 이름을 두면 어느 쪽이 DB 행인지 호출부에서 구분되지 않는다.

- [ ] **Step 1: 실패하는 통합 테스트를 쓴다**

`lib/funding/schema.integration.test.ts`:

```ts
/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let db: ReturnType<typeof drizzle<typeof schema>>;
let client: Client;

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');

beforeEach(async () => {
  client = createClient({ url: ':memory:' });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    const sqlText = readFileSync(path.join(MIGRATIONS, file), 'utf-8');
    for (const stmt of sqlText.split('--> statement-breakpoint')) {
      const trimmed = stmt.trim();
      if (trimmed) await client.execute(trimmed);
    }
  }
  db = drizzle(client, { schema });
});

afterEach(() => client.close());

describe('펀딩 셀프 개설 스키마', () => {
  it('개설자 이메일은 유일하다', async () => {
    await db.insert(schema.fundingCreators).values({ email: 'a@example.com', name: '가나' });
    await expect(
      db.insert(schema.fundingCreators).values({ email: 'a@example.com', name: '다라' }),
    ).rejects.toThrow();
  });

  it('프로젝트 slug는 유일하고 심사 상태 기본값은 draft다', async () => {
    const [creator] = await db.insert(schema.fundingCreators)
      .values({ email: 'b@example.com', name: '가나' }).returning();
    const [row] = await db.insert(schema.fundingProjects).values({
      slug: 'demo', creatorId: creator.id, title: '제목', summary: '요약',
      content: '본문', coverUrl: '/c.webp', goalAmount: 1000000,
      startAt: new Date('2026-10-01T01:00:00Z'), endAt: new Date('2026-10-31T14:59:59Z'),
    }).returning();
    expect(row.reviewStatus).toBe('draft');
    expect(row.status).toBe('draft');
    expect(row.hidden).toBe(false);

    await expect(
      db.insert(schema.fundingProjects).values({
        slug: 'demo', creatorId: creator.id, title: '다른 제목', summary: '요약',
        content: '본문', coverUrl: '/c.webp', goalAmount: 1000,
        startAt: new Date(), endAt: new Date(Date.now() + 1000),
      }),
    ).rejects.toThrow();
  });

  it('리워드는 (프로젝트, rewardId)로 유일하다', async () => {
    const [creator] = await db.insert(schema.fundingCreators)
      .values({ email: 'c@example.com', name: '가나' }).returning();
    const [project] = await db.insert(schema.fundingProjects).values({
      slug: 'demo2', creatorId: creator.id, title: '제목', summary: '요약',
      content: '본문', coverUrl: '/c.webp', goalAmount: 1000000,
      startAt: new Date('2026-10-01T01:00:00Z'), endAt: new Date('2026-10-31T14:59:59Z'),
    }).returning();
    const reward = {
      projectId: project.id, rewardId: 'cd', title: 'CD', description: '설명',
      amount: 30000, estimatedDelivery: '2026-12', sortOrder: 0,
    };
    await db.insert(schema.fundingRewards).values(reward);
    await expect(db.insert(schema.fundingRewards).values(reward)).rejects.toThrow();
  });

  it('프로젝트를 지우면 리워드도 함께 지워진다', async () => {
    const [creator] = await db.insert(schema.fundingCreators)
      .values({ email: 'd@example.com', name: '가나' }).returning();
    const [project] = await db.insert(schema.fundingProjects).values({
      slug: 'demo3', creatorId: creator.id, title: '제목', summary: '요약',
      content: '본문', coverUrl: '/c.webp', goalAmount: 1000000,
      startAt: new Date('2026-10-01T01:00:00Z'), endAt: new Date('2026-10-31T14:59:59Z'),
    }).returning();
    await db.insert(schema.fundingRewards).values({
      projectId: project.id, rewardId: 'cd', title: 'CD', description: '설명',
      amount: 30000, estimatedDelivery: '2026-12', sortOrder: 0,
    });
    await db.delete(schema.fundingProjects).where(eq(schema.fundingProjects.id, project.id));
    const left = await db.select().from(schema.fundingRewards);
    expect(left).toHaveLength(0);
  });

  it('정산은 프로젝트당 한 번만 기록된다', async () => {
    const [creator] = await db.insert(schema.fundingCreators)
      .values({ email: 'e@example.com', name: '가나' }).returning();
    const [project] = await db.insert(schema.fundingProjects).values({
      slug: 'demo4', creatorId: creator.id, title: '제목', summary: '요약',
      content: '본문', coverUrl: '/c.webp', goalAmount: 1000000,
      startAt: new Date('2026-10-01T01:00:00Z'), endAt: new Date('2026-10-31T14:59:59Z'),
    }).returning();
    const payout = {
      projectId: project.id, grossAmount: 1000000, refundAmount: 0, supplyAmount: 909091,
      feeAmount: 90909, shareAmount: 818182, withholdingAmount: 27000, netAmount: 791182,
      backerCount: 30,
    };
    await db.insert(schema.fundingProjectPayouts).values(payout);
    await expect(db.insert(schema.fundingProjectPayouts).values(payout)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx jest lib/funding/schema.integration.test.ts
```

Expected: FAIL — `schema.fundingCreators`가 undefined.

- [ ] **Step 3: `db/schema.ts` 끝의 펀딩 절 아래에 테이블을 추가한다**

`fundingPledges` 블록 바로 뒤, `rateLimits` 앞에 넣는다.

```ts
// ─── 펀딩 셀프 개설 (아티스트가 직접 신청·등록) ────────────────────────────────
// 1차 스펙은 "프로젝트 정본 = content/funding/<slug>.md"였다. 그 설계는 편집자가 운영자
// 한 명이라는 전제 위에 서 있었고, 개설 주체가 아티스트로 바뀌면서 그 전제가 깨졌다.
// 아래 테이블이 새 정본이며, md는 진행 중 프로젝트가 끝날 때까지만 공존한다(스펙 D5).
// 읽을 때는 항상 md가 먼저다 — lib/funding/repository.ts.

export const fundingCreatorTaxTypeEnum = ['withholding', 'invoice'] as const;

export const fundingCreators = sqliteTable('funding_creators', {
  id: text('id').primaryKey().$defaultFn(() => sql`lower(hex(randomblob(16)))`),
  /** 로그인 식별자. 저장 전에 소문자로 정규화한다(lib/funding/creatorToken.ts). */
  email: text('email').notNull().unique(),
  /** 공개되는 이름 — 팀·아티스트 이름. */
  name: text('name').notNull(),
  /** 운영자 연락용. 공개하지 않는다. */
  contactName: text('contact_name'),
  phone: text('phone'),
  /**
   * 정산 시 세금 처리. 승인 전에는 비어 있다 — 반려될 신청서에 계좌·주민번호 성격의
   * 정보를 미리 받지 않는다(스펙 §6.2).
   */
  taxType: text('tax_type', { enum: fundingCreatorTaxTypeEnum }),
  payoutBankName: text('payout_bank_name'),
  payoutAccount: text('payout_account'),
  payoutHolder: text('payout_holder'),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

/**
 * 매직링크 토큰.
 *
 * **원문은 저장하지 않는다.** 이 테이블을 읽을 수 있는 쪽이 곧바로 남의 계정으로 들어갈 수
 * 있으면 저장의 의미가 없다. 원문은 메일에만 실리고 우리는 sha256만 갖는다.
 */
export const fundingCreatorTokens = sqliteTable('funding_creator_tokens', {
  tokenHash: text('token_hash').primaryKey(),
  creatorId: text('creator_id').notNull().references(() => fundingCreators.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  /** 소진 시각. 값이 있으면 다시 쓸 수 없다 — 메일이 전달·보관되는 경로를 감안한 1회용. */
  usedAt: integer('used_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

/** 심사 상태. 공개 여부(status)와는 다른 축이다 — 승인된 뒤에야 status가 의미를 갖는다. */
export const fundingReviewStatusEnum = ['draft', 'submitted', 'changes_requested', 'approved', 'rejected'] as const;
/** 공개 상태. md frontmatter의 status와 같은 값 집합이다(lib/funding/shape.ts). */
export const fundingProjectStatusEnum = ['auto', 'draft', 'closed'] as const;

export const fundingProjects = sqliteTable('funding_projects', {
  id: text('id').primaryKey().$defaultFn(() => sql`lower(hex(randomblob(16)))`),
  /**
   * 공개 주소이자 후원 행(funding_pledges.project_slug)이 문자열로 참조하는 키.
   * 승인 시 확정하고 그 뒤에는 바꾸지 않는다 — 바꾸면 진행 중 모금액이 공개적으로 0원이
   * 되고 기존 후원자가 관리 페이지에서 프로젝트를 찾지 못한다(CLAUDE.md).
   */
  slug: text('slug').notNull().unique(),
  creatorId: text('creator_id').notNull().references(() => fundingCreators.id),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  /** 마크다운 본문. 렌더는 MarkdownRenderer가 하되 개설자 모드로 숏코드를 벗긴다(2차). */
  content: text('content').notNull(),
  coverUrl: text('cover_url').notNull(),
  ogImageUrl: text('og_image_url'),
  heroImageUrl: text('hero_image_url'),
  goalAmount: integer('goal_amount').notNull(),
  startAt: integer('start_at', { mode: 'timestamp' }).notNull(),
  endAt: integer('end_at', { mode: 'timestamp' }).notNull(),
  reviewStatus: text('review_status', { enum: fundingReviewStatusEnum }).notNull().default('draft'),
  /**
   * 승인 전에는 항상 'draft'다 — 심사를 통과하지 않은 프로젝트가 공개 경로에 나타나는 일이
   * 없도록 두 축이 모두 잠겨 있어야 한다.
   */
  status: text('status', { enum: fundingProjectStatusEnum }).notNull().default('draft'),
  hidden: integer('hidden', { mode: 'boolean' }).notNull().default(false),
  /** 운영자 → 개설자 메시지. 보완 요청·반려 사유. */
  reviewNote: text('review_note'),
  submittedAt: integer('submitted_at', { mode: 'timestamp' }),
  approvedAt: integer('approved_at', { mode: 'timestamp' }),
  rejectedAt: integer('rejected_at', { mode: 'timestamp' }),
  /** 개설자가 동의한 개설자 약관 판본과 시각. 후원자 쪽 terms_version과 같은 취지의 증거다. */
  creatorTermsVersion: text('creator_terms_version'),
  creatorTermsAgreedAt: integer('creator_terms_agreed_at', { mode: 'timestamp' }),
  /** 사이트맵 lastmod (YYYY-MM-DD). 공개 필드가 바뀔 때만 갱신한다 — 파일 mtime을 쓰지 않는 것과 같은 이유. */
  lastmod: text('lastmod'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const fundingRewards = sqliteTable(
  'funding_rewards',
  {
    id: text('id').primaryKey().$defaultFn(() => sql`lower(hex(randomblob(16)))`),
    projectId: text('project_id').notNull().references(() => fundingProjects.id, { onDelete: 'cascade' }),
    /**
     * md의 rewards[].id와 같은 것. 후원 행(funding_pledges.reward_id)이 이 문자열을 참조하고,
     * 재고 집계 조건이 `fp.reward_id = <이 값>`이다. 승인 뒤 바꾸면 그 순간 기존 후원이
     * 안 세어져 한정 100개짜리가 200개 팔린다(CLAUDE.md).
     */
    rewardId: text('reward_id').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    /** VAT 포함가. */
    amount: integer('amount').notNull(),
    /** null = 무제한. */
    totalQuantity: integer('total_quantity'),
    requiresShipping: integer('requires_shipping', { mode: 'boolean' }).notNull().default(false),
    estimatedDelivery: text('estimated_delivery').notNull(),
    imageUrl: text('image_url'),
    /** [{label, key}] JSON. key는 R2 객체 키이지 주소가 아니다. 1차에서는 운영자만 채운다. */
    downloads: text('downloads'),
    sortOrder: integer('sort_order').notNull().default(0),
    /**
     * 승인 시각. **null이 아니면 rewardId·amount·totalQuantity 유무를 바꿀 수 없고 행을
     * 지울 수도 없다** — 운영자에게도 예외가 없다. md 시절 이 규칙을 지키던 것은
     * content/funding.baseline.json이었고, 정본이 옮겨 온 만큼 자물쇠도 함께 옮긴다.
     * 가격을 바꿔야 하면 기존 행을 두고 새 rewardId로 티어를 추가한다.
     */
    lockedAt: integer('locked_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  },
  (t) => ({
    projectRewardUnique: uniqueIndex('funding_rewards_project_reward_unique').on(t.projectId, t.rewardId),
  }),
);

export const fundingProjectPayoutStatusEnum = ['pending', 'paid'] as const;

/**
 * 프로젝트 정산. artist_payouts와 같은 꼴이다 — 기록 시점의 숫자를 고정해, 나중에 환불이
 * 더 들어와도 이미 지급한 금액이 뒤늦게 달라지지 않게 한다.
 */
export const fundingProjectPayouts = sqliteTable('funding_project_payouts', {
  id: text('id').primaryKey().$defaultFn(() => sql`lower(hex(randomblob(16)))`),
  projectId: text('project_id').notNull().unique().references(() => fundingProjects.id),
  grossAmount: integer('gross_amount').notNull(),
  refundAmount: integer('refund_amount').notNull(),
  supplyAmount: integer('supply_amount').notNull(),
  /** 플랫폼 수수료 = supply − share. 기록해 두지 않으면 세금계산서·장부에서 역산해야 한다. */
  feeAmount: integer('fee_amount').notNull(),
  shareAmount: integer('share_amount').notNull(),
  withholdingAmount: integer('withholding_amount').notNull(),
  netAmount: integer('net_amount').notNull(),
  backerCount: integer('backer_count').notNull(),
  status: text('status', { enum: fundingProjectPayoutStatusEnum }).notNull().default('pending'),
  paidAt: integer('paid_at', { mode: 'timestamp' }),
  memo: text('memo'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const fundingProjectsRelations = relations(fundingProjects, ({ one, many }) => ({
  creator: one(fundingCreators, { fields: [fundingProjects.creatorId], references: [fundingCreators.id] }),
  rewards: many(fundingRewards),
}));

export const fundingRewardsRelations = relations(fundingRewards, ({ one }) => ({
  project: one(fundingProjects, { fields: [fundingRewards.projectId], references: [fundingProjects.id] }),
}));

export type FundingCreator = typeof fundingCreators.$inferSelect;
export type NewFundingCreator = typeof fundingCreators.$inferInsert;
export type FundingCreatorToken = typeof fundingCreatorTokens.$inferSelect;
export type FundingProjectRow = typeof fundingProjects.$inferSelect;
export type NewFundingProjectRow = typeof fundingProjects.$inferInsert;
export type FundingRewardRow = typeof fundingRewards.$inferSelect;
export type NewFundingRewardRow = typeof fundingRewards.$inferInsert;
export type FundingProjectPayout = typeof fundingProjectPayouts.$inferSelect;
```

- [ ] **Step 4: 마이그레이션을 만든다**

```bash
npm run db:generate -- --name funding_self_serve
ls drizzle/migrations | tail -3
```

Expected: `0017_funding_self_serve.sql`이 생겼다. 파일을 열어 `CREATE TABLE`이 5개, `UNIQUE`가 `funding_creators.email`·`funding_projects.slug`·`funding_rewards(project_id, reward_id)`·`funding_project_payouts.project_id`에 있는지 눈으로 확인한다. **기존 테이블을 DROP·ALTER하는 문장이 하나라도 있으면 멈추고 사람을 부른다** — 전부 추가형이어야 한다.

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

```bash
npx jest lib/funding/schema.integration.test.ts
```

Expected: 5개 케이스 PASS.

- [ ] **Step 6: 커밋**

```bash
git add db/schema.ts drizzle/migrations lib/funding/schema.integration.test.ts
git commit -m "$(cat <<'EOF'
feat(funding): 셀프 개설 5개 테이블 — 개설자·매직링크·프로젝트·리워드·정산

전부 추가형이라 기존 행에 영향이 없다. 마이그레이션 적용은 운영자가 직접 한다.

리워드의 locked_at이 이 묶음의 핵심이다. md 시절 리워드 id·단가를 지키던 것은
content/funding.baseline.json이었는데, 정본이 DB로 옮겨 오면 그 자물쇠가 남지 않는다.
승인 시각을 행에 찍고, 값이 있으면 id·금액·한정 여부 변경과 삭제를 서비스 계층이 거부한다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: DB 행 → `FundingProject` 변환과 조회

**Files:**
- Create: `lib/funding/dbProjects.ts`
- Create: `lib/funding/dbProjects.integration.test.ts`

**Interfaces:**
- Consumes: Task 1의 `validateFundingProjectShape`, Task 2의 테이블·행 타입
- Produces:
  - `rowToShapeInput(row: FundingProjectRow, rewards: FundingRewardRow[]): Record<string, unknown>`
  - `rowsToFundingProject(row: FundingProjectRow, rewards: FundingRewardRow[]): FundingProject`
  - `getDbFundingProject(slug: string): Promise<FundingProject | null>` — 승인된 것만
  - `listDbFundingProjects(): Promise<FundingProject[]>` — 승인된 것 전부(hidden 포함, 필터는 상위에서)

- [ ] **Step 1: 실패하는 통합 테스트를 쓴다**

`lib/funding/dbProjects.integration.test.ts`:

```ts
/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { getDbFundingProject, listDbFundingProjects } from './dbProjects';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;

const seed = async (over: Partial<schema.NewFundingProjectRow> = {}) => {
  const [creator] = await mockDb.insert(schema.fundingCreators)
    .values({ email: `${Math.random()}@example.com`, name: '가나다' }).returning();
  const [project] = await mockDb.insert(schema.fundingProjects).values({
    slug: 'demo', creatorId: creator.id, title: '제목', summary: '요약', content: '본문',
    coverUrl: '/images/funding/demo/cover.webp',
    goalAmount: 1000000,
    startAt: new Date('2026-10-01T01:00:00Z'),
    endAt: new Date('2026-10-31T14:59:59Z'),
    reviewStatus: 'approved', status: 'auto',
    ...over,
  }).returning();
  await mockDb.insert(schema.fundingRewards).values([
    { projectId: project.id, rewardId: 'mp3', title: 'MP3', description: '설명', amount: 10000, estimatedDelivery: '2026-11', sortOrder: 1 },
    { projectId: project.id, rewardId: 'cd', title: 'CD', description: '설명', amount: 30000, totalQuantity: 100, requiresShipping: true, estimatedDelivery: '2026-12', sortOrder: 0 },
  ]);
  return project;
};

beforeEach(async () => {
  client = createClient({ url: ':memory:' });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (stmt.trim()) await client.execute(stmt.trim());
    }
  }
  mockDb = drizzle(client, { schema });
});

afterEach(() => client.close());

describe('dbProjects', () => {
  it('승인된 프로젝트를 FundingProject로 돌려준다', async () => {
    await seed();
    const p = await getDbFundingProject('demo');
    expect(p).not.toBeNull();
    expect(p!.title).toBe('제목');
    expect(p!.cover).toBe('/images/funding/demo/cover.webp');
    expect(p!.content).toBe('본문');
    // ISO 문자열이어야 한다 — 화면·상태 판정이 문자열을 파싱한다.
    expect(p!.startAt).toBe('2026-10-01T01:00:00.000Z');
    expect(p!.ogImage).toBeNull();
  });

  it('리워드를 sortOrder 순으로 싣는다', async () => {
    await seed();
    const p = await getDbFundingProject('demo');
    expect(p!.rewards.map((r) => r.id)).toEqual(['cd', 'mp3']);
    expect(p!.rewards[0]).toMatchObject({ amount: 30000, totalQuantity: 100, requiresShipping: true });
    expect(p!.rewards[1]).toMatchObject({ totalQuantity: null, requiresShipping: false, downloads: [] });
  });

  it('승인되지 않은 프로젝트는 없는 것으로 취급한다', async () => {
    await seed({ reviewStatus: 'submitted', status: 'auto' });
    expect(await getDbFundingProject('demo')).toBeNull();
    expect(await listDbFundingProjects()).toHaveLength(0);
  });

  it('리워드가 없는 행은 목록에서 조용히 빠진다', async () => {
    const [creator] = await mockDb.insert(schema.fundingCreators)
      .values({ email: 'x@example.com', name: '가나' }).returning();
    await mockDb.insert(schema.fundingProjects).values({
      slug: 'broken', creatorId: creator.id, title: '제목', summary: '요약', content: '본문',
      coverUrl: '/c.webp', goalAmount: 1000, startAt: new Date('2026-10-01T01:00:00Z'),
      endAt: new Date('2026-10-31T14:59:59Z'), reviewStatus: 'approved', status: 'auto',
    });
    // 검증에 걸리는 행 하나가 목록 전체를 터뜨리면 안 된다.
    await expect(listDbFundingProjects()).resolves.toEqual([]);
  });

  it('downloads JSON을 그대로 싣는다', async () => {
    const project = await seed({ slug: 'dl' });
    await mockDb.update(schema.fundingRewards)
      .set({ downloads: JSON.stringify([{ label: 'MP3 320kbps', key: 'demo/abc/album.zip' }]) })
      .where(and(
        eq(schema.fundingRewards.projectId, project.id),
        eq(schema.fundingRewards.rewardId, 'mp3'),
      ));
    const p = await getDbFundingProject('dl');
    expect(p!.rewards.find((r) => r.id === 'mp3')!.downloads).toEqual([
      { label: 'MP3 320kbps', key: 'demo/abc/album.zip' },
    ]);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx jest lib/funding/dbProjects.integration.test.ts
```

Expected: FAIL — `Cannot find module './dbProjects'`

- [ ] **Step 3: `lib/funding/dbProjects.ts`를 만든다**

```ts
import { and, asc, eq } from 'drizzle-orm';

import { getDb } from '../../db/client';
import {
  fundingProjects, fundingRewards,
  type FundingProjectRow, type FundingRewardRow,
} from '../../db/schema';

import { validateFundingProjectShape, type FundingProject } from './shape';

/**
 * DB 행을 frontmatter 모양으로 편다.
 *
 * 곧바로 FundingProject를 조립하지 않는 이유: 그러면 DB 경로만 검증을 건너뛴다.
 * 같은 입구(validateFundingProjectShape)를 지나야 status 오타·잘못된 downloads 키 같은
 * 것이 md와 똑같이 걸린다.
 */
export const rowToShapeInput = (row: FundingProjectRow, rewards: FundingRewardRow[]): Record<string, unknown> => ({
  slug: row.slug,
  title: row.title,
  summary: row.summary,
  cover: row.coverUrl,
  ogImage: row.ogImageUrl ?? undefined,
  heroImage: row.heroImageUrl ?? undefined,
  goalAmount: row.goalAmount,
  startAt: row.startAt.toISOString(),
  endAt: row.endAt.toISOString(),
  status: row.status,
  hidden: row.hidden,
  lastmod: row.lastmod ?? undefined,
  rewards: [...rewards]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.rewardId.localeCompare(b.rewardId))
    .map((r) => ({
      id: r.rewardId,
      title: r.title,
      description: r.description,
      amount: r.amount,
      totalQuantity: r.totalQuantity,
      requiresShipping: r.requiresShipping,
      estimatedDelivery: r.estimatedDelivery,
      image: r.imageUrl ?? undefined,
      downloads: r.downloads ? JSON.parse(r.downloads) : undefined,
    })),
});

export const rowsToFundingProject = (row: FundingProjectRow, rewards: FundingRewardRow[]): FundingProject =>
  validateFundingProjectShape(rowToShapeInput(row, rewards), row.slug, row.content);

/** 공개 경로가 보는 조건 — 심사를 통과한 것만. */
const APPROVED = eq(fundingProjects.reviewStatus, 'approved');

export const getDbFundingProject = async (slug: string): Promise<FundingProject | null> => {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  const [row] = await getDb().select().from(fundingProjects)
    .where(and(eq(fundingProjects.slug, slug), APPROVED)).limit(1);
  if (!row) return null;
  const rewards = await getDb().select().from(fundingRewards)
    .where(eq(fundingRewards.projectId, row.id)).orderBy(asc(fundingRewards.sortOrder));
  try {
    return rowsToFundingProject(row, rewards);
  } catch (error: unknown) {
    // 검증에 걸린 행을 공개하지 않는다. 500으로 터뜨리는 대신 없는 것으로 보고 기록만 남긴다.
    console.error(`[funding] DB 프로젝트 검증 실패 — slug=${slug}:`, error);
    return null;
  }
};

export const listDbFundingProjects = async (): Promise<FundingProject[]> => {
  const rows = await getDb().select().from(fundingProjects).where(APPROVED);
  if (rows.length === 0) return [];
  const allRewards = await getDb().select().from(fundingRewards).orderBy(asc(fundingRewards.sortOrder));
  const byProject = new Map<string, FundingRewardRow[]>();
  for (const r of allRewards) {
    const list = byProject.get(r.projectId) ?? [];
    list.push(r);
    byProject.set(r.projectId, list);
  }
  const out: FundingProject[] = [];
  for (const row of rows) {
    try {
      out.push(rowsToFundingProject(row, byProject.get(row.id) ?? []));
    } catch (error: unknown) {
      // 행 하나가 목록 전체를 터뜨리면 진행 중인 다른 프로젝트까지 사라진다.
      console.error(`[funding] DB 프로젝트 검증 실패 — slug=${row.slug}:`, error);
    }
  }
  return out;
};
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

```bash
npx jest lib/funding/dbProjects.integration.test.ts
```

Expected: 5개 케이스 PASS.

- [ ] **Step 5: 커밋**

```bash
git add lib/funding/dbProjects.ts lib/funding/dbProjects.integration.test.ts
git commit -m "$(cat <<'EOF'
feat(funding): DB 행을 프로젝트로 읽는다 — md와 같은 검증을 지나서

행 하나가 검증에 걸려도 목록 전체가 사라지지 않는다. 그 행만 빠지고 기록이 남는다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 통합 로더 `repository.ts`

md와 DB를 합쳐 읽는 **유일한 입구**를 만든다. 다음 태스크부터 모든 호출처가 여기만 쓴다.

**Files:**
- Create: `lib/funding/repository.ts`
- Create: `lib/funding/repository.integration.test.ts`

**Interfaces:**
- Consumes: Task 1의 `getFundingProject`·`getAllFundingProjects`·`sortListableProjects`, Task 3의 `getDbFundingProject`·`listDbFundingProjects`
- Produces:
  - `getFundingProjectAsync(slug: string): Promise<FundingProject | null>`
  - `getAllFundingProjectsAsync(): Promise<FundingProject[]>`
  - `getListableFundingProjectsAsync(now?: Date): Promise<FundingProject[]>`

- [ ] **Step 1: 실패하는 통합 테스트를 쓴다**

`lib/funding/repository.integration.test.ts`:

```ts
/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';
import type { FundingProject } from './shape';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

const mdProjects: FundingProject[] = [];
jest.mock('./projects', () => {
  const actual = jest.requireActual('./projects');
  return {
    ...actual,
    getFundingProject: (slug: string) => mdProjects.find((p) => p.slug === slug) ?? null,
    getAllFundingProjects: () => mdProjects,
  };
});

// eslint-disable-next-line import/first
import { getAllFundingProjectsAsync, getFundingProjectAsync, getListableFundingProjectsAsync } from './repository';
// eslint-disable-next-line import/first
import { parseFundingProject } from './projects';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const NOW = new Date('2026-10-15T03:00:00Z');
let client: Client;

const md = (slug: string, title: string) => parseFundingProject(`---
slug: ${slug}
title: ${title}
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
    estimatedDelivery: 2026-12
---
`, slug);

const seedDb = async (slug: string, title: string, over: Partial<schema.NewFundingProjectRow> = {}) => {
  const [creator] = await mockDb.insert(schema.fundingCreators)
    .values({ email: `${slug}@example.com`, name: '가나' }).returning();
  const [project] = await mockDb.insert(schema.fundingProjects).values({
    slug, creatorId: creator.id, title, summary: '요약', content: '본문', coverUrl: '/c.webp',
    goalAmount: 100000, startAt: new Date('2026-10-01T01:00:00Z'), endAt: new Date('2026-10-31T14:59:59Z'),
    reviewStatus: 'approved', status: 'auto', ...over,
  }).returning();
  await mockDb.insert(schema.fundingRewards).values({
    projectId: project.id, rewardId: 'cd', title: 'CD', description: 'd',
    amount: 30000, estimatedDelivery: '2026-12', sortOrder: 0,
  });
};

beforeEach(async () => {
  mdProjects.length = 0;
  client = createClient({ url: ':memory:' });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (stmt.trim()) await client.execute(stmt.trim());
    }
  }
  mockDb = drizzle(client, { schema });
});

afterEach(() => client.close());

describe('repository', () => {
  it('md에 있으면 md를 쓴다', async () => {
    mdProjects.push(md('both', '파일 제목'));
    await seedDb('both', 'DB 제목');
    const p = await getFundingProjectAsync('both');
    expect(p!.title).toBe('파일 제목');
  });

  it('md에 없으면 DB를 본다', async () => {
    await seedDb('only-db', 'DB 제목');
    const p = await getFundingProjectAsync('only-db');
    expect(p!.title).toBe('DB 제목');
  });

  it('목록은 둘을 합치고 slug가 겹치면 md만 남긴다', async () => {
    mdProjects.push(md('both', '파일 제목'));
    await seedDb('both', 'DB 제목');
    await seedDb('only-db', 'DB 제목2');
    const all = await getAllFundingProjectsAsync();
    expect(all.map((p) => p.slug).sort()).toEqual(['both', 'only-db']);
    expect(all.find((p) => p.slug === 'both')!.title).toBe('파일 제목');
  });

  it('공개 목록은 hidden과 draft를 뺀다', async () => {
    await seedDb('live-one', '공개');
    await seedDb('hidden-one', '숨김', { hidden: true });
    await seedDb('draft-one', '초안', { status: 'draft' });
    const list = await getListableFundingProjectsAsync(NOW);
    expect(list.map((p) => p.slug)).toEqual(['live-one']);
  });

  it('DB가 죽어도 md는 계속 읽힌다', async () => {
    mdProjects.push(md('file-only', '파일 제목'));
    client.close(); // 이후 모든 DB 호출이 던진다
    await expect(getFundingProjectAsync('file-only')).resolves.not.toBeNull();
    await expect(getFundingProjectAsync('missing')).resolves.toBeNull();
    await expect(getAllFundingProjectsAsync()).resolves.toHaveLength(1);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx jest lib/funding/repository.integration.test.ts
```

Expected: FAIL — `Cannot find module './repository'`

- [ ] **Step 3: `lib/funding/repository.ts`를 만든다**

```ts
import { computeProjectState } from './projectState';
import { getAllFundingProjects, getFundingProject, sortListableProjects } from './projects';
import { getDbFundingProject, listDbFundingProjects } from './dbProjects';

import type { FundingProject } from './shape';

/**
 * 프로젝트를 읽는 **유일한 입구**.
 *
 * 순서는 md 먼저, 그다음 DB다. 진행 중인 프로젝트가 파일로 남아 있는 동안(스펙 D5) 두 곳에
 * 같은 slug가 있으면 파일이 이긴다 — 파일은 배포에 실려 있어 어느 인스턴스에서 읽어도 같지만,
 * DB는 그 사이 누군가 고쳤을 수 있다. 공존 기간에는 "이미 열려 있는 캠페인은 절대 안 바뀐다"가
 * 더 중요하다.
 *
 * **DB 오류를 삼킨다.** 빌드는 TURSO_* 없이도 성공해야 하고(CI·로컬), 런타임에 DB가 잠깐
 * 흔들려도 파일로 열린 캠페인의 후원까지 멈출 이유는 없다. 대신 기록은 남긴다.
 */
const safeDb = async <T>(run: () => Promise<T>, fallback: T, where: string): Promise<T> => {
  try {
    return await run();
  } catch (error: unknown) {
    console.error(`[funding] DB 조회 실패(${where}) — 파일 기준으로만 응답합니다:`, error);
    return fallback;
  }
};

export const getFundingProjectAsync = async (slug: string): Promise<FundingProject | null> => {
  const fromFile = getFundingProject(slug);
  if (fromFile) return fromFile;
  return safeDb(() => getDbFundingProject(slug), null, `slug=${slug}`);
};

export const getAllFundingProjectsAsync = async (): Promise<FundingProject[]> => {
  const fromFile = getAllFundingProjects();
  const seen = new Set(fromFile.map((p) => p.slug));
  const fromDb = await safeDb(() => listDbFundingProjects(), [], 'list');
  return [...fromFile, ...fromDb.filter((p) => !seen.has(p.slug))];
};

export const getListableFundingProjectsAsync = async (now: Date = new Date()): Promise<FundingProject[]> => {
  const all = await getAllFundingProjectsAsync();
  return sortListableProjects(all.filter((p) => !p.hidden && computeProjectState(p, now) !== 'draft'), now);
};
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

```bash
npx jest lib/funding/repository.integration.test.ts
```

Expected: 5개 케이스 PASS.

- [ ] **Step 5: 커밋**

```bash
git add lib/funding/repository.ts lib/funding/repository.integration.test.ts
git commit -m "$(cat <<'EOF'
feat(funding): md와 DB를 합쳐 읽는 입구 하나 — 파일이 먼저다

DB 오류는 삼키고 기록만 남긴다. 빌드는 TURSO_* 없이 성공해야 하고, DB가 흔들린다고
파일로 열려 있는 캠페인의 후원까지 멈출 이유가 없다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 서버 코드 호출처 전환 (페이지 제외)

**Files:**
- Modify: `lib/funding/confirm.ts:7,82,421`
- Modify: `lib/funding/cancel.ts:8,54`
- Modify: `pages/api/funding/pledges.ts:8,36`
- Modify: `pages/api/funding/download.ts:10,68`
- Modify: `pages/api/funding/[slug]/status.ts:3,9`
- Modify: `pages/api/admin/funding/pledges/index.ts:14,38`
- Modify: `pages/api/admin/funding/pledges/[id].ts:11,146,253`
- Modify: `pages/api/llms.ts:41,287`
- Modify: `pages/admin/funding/index.tsx:17,69`

**Interfaces:**
- Consumes: Task 4의 세 비동기 함수
- Produces: 없음(호출처 전환)

- [ ] **Step 1: 전환 규칙을 확인하고 한 파일씩 고친다**

규칙은 셋뿐이다.

1. `import { getFundingProject } from './projects'` → `import { getFundingProjectAsync } from './repository'`. `computeProjectState`·`findReward`·`stripRewardDownloads`·타입은 계속 `./projects`에서 가져온다.
2. 호출 앞에 `await`를 붙인다. 호출부가 동기 함수 안이면 그 함수를 `async`로 바꾸고, 그 함수의 호출처까지 `await`를 전파한다.
3. `getAllFundingProjects` → `getAllFundingProjectsAsync`, `getListableFundingProjects` → `getListableFundingProjectsAsync`.

주의할 자리:

- `lib/funding/confirm.ts:82`와 `:421` — 둘 다 이미 `async` 함수 안이다. `getFundingProject(...)` → `await getFundingProjectAsync(...)`. `:421`은 `Promise.all`·인자 목록 안일 수 있으니 괄호 위치를 확인한다.
- `pages/admin/funding/index.tsx:69` — `getServerSideProps` 안이므로 `await`만 붙이면 된다.
- `pages/api/llms.ts:287` — `live = getListableFundingProjects(now).filter(...)`를 `live = (await getListableFundingProjectsAsync(now)).filter(...)`로. 이 대입이 들어 있는 함수가 동기면 `async`로 바꾸고 호출처에 `await`를 붙인다.
- `pages/api/funding/[slug]/status.ts:9` — 핸들러가 이미 async다.

- [ ] **Step 2: 타입 검사로 빠뜨린 곳을 찾는다**

```bash
npm run type-check
```

Expected: 오류 없음. `Property 'rewards' does not exist on type 'Promise<...>'` 같은 오류가 남았다면 `await`를 빠뜨린 것이다.

- [ ] **Step 3: 남은 동기 호출이 없는지 확인한다**

```bash
grep -rn "getFundingProject(\|getAllFundingProjects(\|getListableFundingProjects(" lib pages | grep -v "\.test\." | grep -v "lib/funding/projects.ts" | grep -v "lib/funding/repository.ts"
```

Expected: `pages/[locale]/funding/` 아래 5개 페이지만 남는다(Task 6에서 처리). 그 밖의 줄이 남아 있으면 옮기지 않은 것이다.

- [ ] **Step 4: 관련 테스트를 돌린다**

```bash
npx jest lib/funding content/funding
```

Expected: 전부 PASS.

- [ ] **Step 5: 커밋**

```bash
git add lib pages
git commit -m "$(cat <<'EOF'
refactor(funding): 서버 코드가 프로젝트를 비동기로 읽는다

확정·취소 메일, 후원 생성, 내려받기 게이트, 진행률 API, 관리자 API, llms.txt가 이제
repository를 지난다. 파일만 있는 지금은 동작이 같다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 공개 페이지를 ISR로 전환

**Files:**
- Modify: `pages/[locale]/funding/index.tsx:10,96-115`
- Modify: `pages/[locale]/funding/[slug]/index.tsx:21,220-236`
- Modify: `pages/[locale]/funding/[slug]/pledge.tsx:7,39`
- Modify: `pages/[locale]/funding/manage/[orderNo].tsx:10,215`
- Modify: `pages/[locale]/funding/success.tsx:15,297`

**Interfaces:**
- Consumes: Task 4의 비동기 로더
- Produces: 없음

- [ ] **Step 1: 목록 페이지를 ISR로 바꾼다**

`pages/[locale]/funding/index.tsx`의 `getStaticProps`:

```ts
export const getStaticProps: GetStaticProps<Props> = async () => {
  const now = new Date();
  const items = (await getListableFundingProjectsAsync(now)).map((p) => ({
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    cover: p.cover,
    goalAmount: p.goalAmount,
    state: computeProjectState(p, now),
    status: p.status,
    startAt: p.startAt,
    endAt: p.endAt,
  }));
  // 승인은 관리자 화면에서 나므로 배포 없이 목록에 나타나야 한다. 60초는 승인 직후
  // 개설자가 새로고침해 확인할 수 있을 만큼 짧고, 목록 조회가 DB를 때리지 않을 만큼 길다.
  return buildPageStaticProps(defaultLocale, { items }, { i18nSections: [], revalidate: 60 });
};
```

- [ ] **Step 2: 상세 페이지를 ISR + `fallback: 'blocking'`으로 바꾼다**

```ts
export const getStaticPaths: GetStaticPaths = async () => ({
  // 빌드 때는 파일 프로젝트만 만든다 — 빌드가 DB에 닿지 않게 하려는 것이다.
  // DB 프로젝트는 첫 요청에 생성돼 ISR로 캐시된다(blocking).
  paths: getAllFundingProjects()
    .filter((p) => p.status !== 'draft')
    .map((p) => ({ params: { locale: defaultLocale, slug: p.slug } })),
  fallback: 'blocking',
});

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const project = await getFundingProjectAsync(String(params?.slug ?? ''));
  if (!project || project.status === 'draft') return { notFound: true };
  return buildPageStaticProps(
    defaultLocale,
    // 공개 화면이라 내려받기 주소를 벗겨 내려보낸다(lib/funding/shape.ts 주석).
    { project: stripRewardDownloads(project), initialState: computeProjectState(project, new Date()) },
    { i18nSections: ['stories'], revalidate: 60 },
  );
};
```

`getAllFundingProjects`(동기, 파일 전용)는 계속 `./projects`에서 가져온다. `getFundingProjectAsync`만 `./repository`에서 가져온다.

⚠️ `fallback: 'blocking'`은 **목록에 없는 경로만** 지연 생성한다. 목록에 넣은 경로는 빌드 때 전부 만들어진다(CLAUDE.md의 스토리 프리렌더 절과 같은 이야기). 그리고 존재하지 않는 slug 요청은 `notFound: true`로 404가 되며, 이 404도 `revalidate` 주기로 다시 확인된다.

- [ ] **Step 3: SSR 페이지 세 곳에 `await`를 붙인다**

`pledge.tsx:39`, `manage/[orderNo].tsx:215`, `success.tsx:297` — 전부 이미 async 컨텍스트이므로 import를 `./repository`(상대 경로 주의)로 바꾸고 `await`만 붙인다.

- [ ] **Step 4: 타입 검사와 빌드로 확인한다**

```bash
npm run type-check && npm run build
```

Expected: 빌드 성공. 빌드 로그에서 `/ko/funding`과 `/ko/funding/[slug]`가 ISR(●)로 표시되는지 본다. **`TURSO_DATABASE_URL` 없이도 성공해야 한다** — 실패하면 `safeDb`가 감싸지 못한 호출이 있다는 뜻이니 그 경로를 찾아 감싼다.

- [ ] **Step 5: 커밋**

```bash
git add pages/\[locale\]/funding
git commit -m "$(cat <<'EOF'
feat(funding): 공개 페이지를 ISR로 — 승인이 배포를 기다리지 않게

목록·상세 revalidate 60초, 상세는 fallback blocking이라 DB 프로젝트가 첫 요청에 만들어진다.
빌드는 여전히 파일만 읽는다 — 빌드가 DB에 닿으면 TURSO_* 없는 CI에서 사이트 전체가 못 나간다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: DB 프로젝트 사이트맵

`next-sitemap`은 빌드 때 파일만 읽으므로 DB 프로젝트가 사이트맵에서 빠진다. 동적 라우트 하나로 채운다.

**Files:**
- Create: `lib/funding/sitemapXml.ts`
- Create: `lib/funding/sitemapXml.test.ts`
- Create: `pages/sitemap-funding.xml.ts`
- Modify: `next-sitemap.config.js:103-108,164`

**Interfaces:**
- Consumes: Task 3의 `listDbFundingProjects`
- Produces: `buildFundingSitemapXml(entries: { slug: string; lastmod: string }[], siteUrl: string): string`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/funding/sitemapXml.test.ts`:

```ts
import { buildFundingSitemapXml } from './sitemapXml';

describe('buildFundingSitemapXml', () => {
  it('항목을 urlset으로 감싸고 ko 주소를 만든다', () => {
    const xml = buildFundingSitemapXml(
      [{ slug: 'demo', lastmod: '2026-10-01' }],
      'https://studionol.co.kr',
    );
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<loc>https://studionol.co.kr/ko/funding/demo</loc>');
    expect(xml).toContain('<lastmod>2026-10-01</lastmod>');
  });

  it('항목이 없어도 빈 urlset을 돌려준다', () => {
    expect(buildFundingSitemapXml([], 'https://studionol.co.kr')).toContain('<urlset');
  });

  it('slug에 든 특수문자를 이스케이프한다', () => {
    const xml = buildFundingSitemapXml([{ slug: 'a&b', lastmod: '2026-10-01' }], 'https://x.kr');
    expect(xml).toContain('a&amp;b');
    expect(xml).not.toContain('<loc>https://x.kr/ko/funding/a&b</loc>');
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx jest lib/funding/sitemapXml.test.ts
```

Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현한다**

`lib/funding/sitemapXml.ts`:

```ts
const escapeXml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * DB 프로젝트 전용 사이트맵.
 *
 * next-sitemap은 postbuild에 돌고 파일만 읽으므로 DB 프로젝트를 모른다. 빌드가 DB를 보게
 * 만드는 대신(빌드는 TURSO_* 없이도 성공해야 한다) 런타임 라우트로 내보내고 robots.txt에
 * 주소를 적어 색인 경로를 연다.
 */
export const buildFundingSitemapXml = (
  entries: { slug: string; lastmod: string }[],
  siteUrl: string,
): string => {
  const base = siteUrl.replace(/\/+$/, '');
  const urls = entries
    .map((e) => `  <url>\n    <loc>${escapeXml(`${base}/ko/funding/${e.slug}`)}</loc>\n    <lastmod>${escapeXml(e.lastmod)}</lastmod>\n  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
};
```

`pages/sitemap-funding.xml.ts`:

```ts
import type { GetServerSideProps } from 'next';

import { listDbFundingProjects } from '../lib/funding/dbProjects';
import { buildFundingSitemapXml } from '../lib/funding/sitemapXml';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://studionol.co.kr').replace(/\/+$/, '');

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  let entries: { slug: string; lastmod: string }[] = [];
  try {
    const projects = await listDbFundingProjects();
    entries = projects
      .filter((p) => !p.hidden && p.status !== 'draft')
      .map((p) => ({ slug: p.slug, lastmod: p.lastmod }));
  } catch (error: unknown) {
    // 사이트맵이 500을 내면 검색엔진은 "가져올 수 없음"으로 기록한다. 빈 사이트맵이 낫다.
    console.error('[funding] 사이트맵 DB 조회 실패:', error);
  }
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400');
  res.write(buildFundingSitemapXml(entries, SITE_URL));
  res.end();
  return { props: {} };
};

export default function FundingSitemap() {
  return null;
}
```

- [ ] **Step 4: robots.txt에 주소를 싣고 개설자 경로를 뺀다**

`next-sitemap.config.js`:

```js
  exclude: [
    '/api/*', '/404', '/500', '/', '/admin', '/admin/*', '/*/contracts/*', '/*/booking/*',
    ...NOINDEX_STATIC_ROUTES.map((route) => `/*/${route}`),
    // 펀딩 트랜잭셔널 경로 — noindex + Cache-Control: no-store 페이지라 사이트맵 등재 대상이 아니다.
    '/*/funding/success', '/*/funding/fail', '/*/funding/manage/*', '/*/funding/*/pledge', '/*/funding/terms',
    // 개설자 전용 화면 — 로그인해야 의미가 있고 색인 대상이 아니다.
    '/*/funding/creator', '/*/funding/creator/*',
  ],
```

그리고 `additionalSitemaps`:

```js
    additionalSitemaps: [`${SITE_URL}/sitemap-funding.xml`],
```

- [ ] **Step 5: 확인한다**

```bash
npx jest lib/funding/sitemapXml.test.ts && npm run type-check
```

Expected: PASS. 미들웨어는 `sitemap.*\.xml`을 이미 matcher에서 제외하므로 `/sitemap-funding.xml`에 로케일 프리픽스가 붙지 않는다(`middleware.ts:347`).

- [ ] **Step 6: 커밋**

```bash
git add lib/funding/sitemapXml.ts lib/funding/sitemapXml.test.ts pages/sitemap-funding.xml.ts next-sitemap.config.js
git commit -m "$(cat <<'EOF'
feat(funding): DB 프로젝트 사이트맵을 런타임 라우트로 내보낸다

next-sitemap은 postbuild에 파일만 읽으므로 DB 프로젝트를 모른다. 빌드가 DB를 보게 만드는
대신 라우트로 내보내고 robots.txt에 주소를 적었다. 조회가 실패하면 빈 urlset을 준다 —
500을 내면 검색엔진이 "가져올 수 없음"으로 기록한다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 매직링크 토큰

**Files:**
- Create: `lib/funding/creatorToken.ts`
- Create: `lib/funding/creatorToken.integration.test.ts`

**Interfaces:**
- Consumes: Task 2의 `fundingCreators`·`fundingCreatorTokens`
- Produces:
  - `normalizeCreatorEmail(email: string): string | null`
  - `CREATOR_TOKEN_TTL_SECONDS: number` (= 900)
  - `issueCreatorLoginToken(email: string, now?: Date): Promise<{ creatorId: string; rawToken: string } | null>`
  - `consumeCreatorLoginToken(rawToken: string, now?: Date): Promise<{ creatorId: string } | null>`

- [ ] **Step 1: 실패하는 통합 테스트를 쓴다**

`lib/funding/creatorToken.integration.test.ts`:

```ts
/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { consumeCreatorLoginToken, issueCreatorLoginToken, normalizeCreatorEmail } from './creatorToken';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const NOW = new Date('2026-09-20T03:00:00Z');
let client: Client;

beforeEach(async () => {
  client = createClient({ url: ':memory:' });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (stmt.trim()) await client.execute(stmt.trim());
    }
  }
  mockDb = drizzle(client, { schema });
});

afterEach(() => client.close());

describe('normalizeCreatorEmail', () => {
  it('공백을 떼고 소문자로 만든다', () => {
    expect(normalizeCreatorEmail('  A@Example.COM ')).toBe('a@example.com');
  });
  it('형식이 아니면 null', () => {
    expect(normalizeCreatorEmail('not-an-email')).toBeNull();
    expect(normalizeCreatorEmail('')).toBeNull();
    expect(normalizeCreatorEmail(`${'a'.repeat(250)}@example.com`)).toBeNull();
  });
});

describe('매직링크 토큰', () => {
  it('처음 보는 이메일이면 개설자 행을 만든다', async () => {
    const issued = await issueCreatorLoginToken('new@example.com', NOW);
    expect(issued).not.toBeNull();
    const creators = await mockDb.select().from(schema.fundingCreators);
    expect(creators).toHaveLength(1);
    expect(creators[0].email).toBe('new@example.com');
  });

  it('원문이 아니라 해시만 저장한다', async () => {
    const issued = await issueCreatorLoginToken('a@example.com', NOW);
    const [row] = await mockDb.select().from(schema.fundingCreatorTokens);
    expect(row.tokenHash).not.toBe(issued!.rawToken);
    expect(row.tokenHash).toBe(createHash('sha256').update(issued!.rawToken).digest('hex'));
  });

  it('소진하면 creatorId를 주고 두 번째는 거부한다', async () => {
    const issued = await issueCreatorLoginToken('a@example.com', NOW);
    const first = await consumeCreatorLoginToken(issued!.rawToken, NOW);
    expect(first!.creatorId).toBe(issued!.creatorId);
    expect(await consumeCreatorLoginToken(issued!.rawToken, NOW)).toBeNull();
  });

  it('15분이 지나면 거부한다', async () => {
    const issued = await issueCreatorLoginToken('a@example.com', NOW);
    const late = new Date(NOW.getTime() + 901 * 1000);
    expect(await consumeCreatorLoginToken(issued!.rawToken, late)).toBeNull();
  });

  it('없는 토큰은 거부한다', async () => {
    expect(await consumeCreatorLoginToken('nope', NOW)).toBeNull();
  });

  it('소진하면 마지막 로그인 시각을 남긴다', async () => {
    const issued = await issueCreatorLoginToken('a@example.com', NOW);
    await consumeCreatorLoginToken(issued!.rawToken, NOW);
    const [creator] = await mockDb.select().from(schema.fundingCreators);
    expect(creator.lastLoginAt?.getTime()).toBe(NOW.getTime());
  });

  it('새 토큰을 내면 그 사람의 옛 토큰은 못 쓴다', async () => {
    const first = await issueCreatorLoginToken('a@example.com', NOW);
    const second = await issueCreatorLoginToken('a@example.com', NOW);
    expect(await consumeCreatorLoginToken(first!.rawToken, NOW)).toBeNull();
    expect(await consumeCreatorLoginToken(second!.rawToken, NOW)).not.toBeNull();
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx jest lib/funding/creatorToken.integration.test.ts
```

Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현한다**

`lib/funding/creatorToken.ts`:

```ts
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, isNull, lt } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingCreators, fundingCreatorTokens } from '../../db/schema';

/**
 * 링크의 수명. 메일함에 남는 값이므로 짧게 잡는다. 너무 짧으면(1~2분) 메일 전달이 늦은
 * 날 로그인 자체가 안 되므로 15분으로 둔다.
 */
export const CREATOR_TOKEN_TTL_SECONDS = 900;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeCreatorEmail = (email: string): string | null => {
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length === 0 || trimmed.length > 254 || !EMAIL_RE.test(trimmed)) return null;
  return trimmed;
};

const hash = (raw: string): string => createHash('sha256').update(raw).digest('hex');

/**
 * 로그인 토큰 발급. 처음 보는 이메일이면 개설자 행을 만든다 — 가입과 로그인을 나누지 않는다.
 * (아무나 행을 만들 수 있지만 행 하나가 전부이고, 만드는 경로에는 요청 제한이 걸린다.)
 *
 * **발급하면 그 사람의 기존 미사용 토큰을 죽인다.** 링크를 다시 받는 흔한 이유가 "먼저 온
 * 메일이 남의 손에 있을지도 모른다"이기 때문이다.
 */
export const issueCreatorLoginToken = async (
  email: string,
  now: Date = new Date(),
): Promise<{ creatorId: string; rawToken: string } | null> => {
  const normalized = normalizeCreatorEmail(email);
  if (!normalized) return null;

  const db = getDb();
  const [existing] = await db.select().from(fundingCreators)
    .where(eq(fundingCreators.email, normalized)).limit(1);
  const creator = existing
    ?? (await db.insert(fundingCreators).values({ email: normalized, name: normalized.split('@')[0] }).returning())[0];

  // 만료된 토큰은 쌓일 이유가 없다. 발급 경로에 얹어 따로 배치를 두지 않는다.
  await db.delete(fundingCreatorTokens).where(lt(fundingCreatorTokens.expiresAt, now));
  await db.delete(fundingCreatorTokens).where(eq(fundingCreatorTokens.creatorId, creator.id));

  const rawToken = randomBytes(32).toString('base64url');
  await db.insert(fundingCreatorTokens).values({
    tokenHash: hash(rawToken),
    creatorId: creator.id,
    expiresAt: new Date(now.getTime() + CREATOR_TOKEN_TTL_SECONDS * 1000),
  });
  return { creatorId: creator.id, rawToken };
};

/**
 * 토큰을 소진한다. 성공하면 그 뒤로 같은 토큰은 쓸 수 없다.
 *
 * 소진을 UPDATE의 조건으로 넣어(`used_at IS NULL`) 확인과 소진 사이에 다른 요청이 끼어드는
 * 일을 막는다. 읽고 나서 쓰면 같은 링크를 두 번 클릭한 두 요청이 모두 통과할 수 있다.
 */
export const consumeCreatorLoginToken = async (
  rawToken: string,
  now: Date = new Date(),
): Promise<{ creatorId: string } | null> => {
  if (typeof rawToken !== 'string' || rawToken.length < 16) return null;
  const db = getDb();
  const updated = await db.update(fundingCreatorTokens)
    .set({ usedAt: now })
    .where(and(
      eq(fundingCreatorTokens.tokenHash, hash(rawToken)),
      isNull(fundingCreatorTokens.usedAt),
    ))
    .returning();
  const [row] = updated;
  if (!row) return null;
  if (row.expiresAt.getTime() <= now.getTime()) return null;

  await db.update(fundingCreators).set({ lastLoginAt: now, updatedAt: now })
    .where(eq(fundingCreators.id, row.creatorId));
  return { creatorId: row.creatorId };
};
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

```bash
npx jest lib/funding/creatorToken.integration.test.ts
```

Expected: 모든 케이스 PASS.

- [ ] **Step 5: 커밋**

```bash
git add lib/funding/creatorToken.ts lib/funding/creatorToken.integration.test.ts
git commit -m "$(cat <<'EOF'
feat(funding): 개설자 매직링크 토큰 — 해시만 저장, 15분, 1회용

소진을 UPDATE 조건(used_at IS NULL)으로 넣었다. 읽고 나서 쓰면 같은 링크를 두 번 누른
두 요청이 모두 통과한다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: 개설자 세션과 인증 헬퍼

**Files:**
- Create: `lib/funding/creatorSession.ts`
- Create: `lib/funding/creatorAuth.ts`
- Create: `lib/funding/creatorAuth.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `getCreatorSession(req, res)` / `getCreatorSessionFromContext(context)`
  - `readCreatorId(session): string | null`
  - `authenticateCreatorApi(req, res): Promise<{ ok: true; creatorId: string } | { ok: false }>`
  - `authenticateCreatorRequest(context): Promise<{ ok: true; creatorId: string } | { ok: false }>`
  - `loginCreatorSession(req, res, creatorId): Promise<void>`
  - `loginCreatorSessionFromContext(context, creatorId): Promise<void>` — 매직링크 착지가 `getServerSideProps`라 API용과 별개로 필요하다
  - `logoutCreatorSession(req, res): Promise<void>`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/funding/creatorAuth.test.ts`:

```ts
import { readCreatorId } from './creatorAuth';

describe('readCreatorId', () => {
  it('세션에 creatorId가 있으면 돌려준다', () => {
    expect(readCreatorId({ creatorId: 'abc' } as never)).toBe('abc');
  });
  it('없으면 null', () => {
    expect(readCreatorId({} as never)).toBeNull();
    expect(readCreatorId({ creatorId: '' } as never)).toBeNull();
  });
});

describe('세션 비밀 검증', () => {
  const OLD = process.env.CREATOR_SESSION_SECRET;
  afterEach(() => { process.env.CREATOR_SESSION_SECRET = OLD; jest.resetModules(); });

  it('32자 미만이면 세션을 만들지 않고 던진다', async () => {
    process.env.CREATOR_SESSION_SECRET = 'short';
    jest.resetModules();
    const { getCreatorSession } = await import('./creatorSession');
    await expect(getCreatorSession({} as never, {} as never)).rejects.toThrow(/CREATOR_SESSION_SECRET/);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx jest lib/funding/creatorAuth.test.ts
```

Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현한다**

`lib/funding/creatorSession.ts` — `lib/contracts/admin-session.ts`와 같은 모양이되 **쿠키 이름·비밀·SameSite가 다르다**:

```ts
import { getIronSession, type IronSession, type SessionOptions } from 'iron-session';
import type { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from 'next';

export interface CreatorSessionData {
  creatorId?: string;
}

const SESSION_DAYS = 7;
const SESSION_SECONDS = 60 * 60 * 24 * SESSION_DAYS;

const sessionOptions: SessionOptions = {
  // 관리자와 다른 쿠키·다른 비밀을 쓴다. 하나가 새도 다른 하나가 열리지 않아야 한다.
  cookieName: 'creator_session',
  password: process.env.CREATOR_SESSION_SECRET || '',
  ttl: SESSION_SECONDS,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    /**
     * 관리자는 strict인데 여기는 lax다. 로그인이 **메일의 링크를 눌러** 들어오는 경로라,
     * strict면 그 첫 이동에 쿠키가 실리지 않아 로그인 직후 다시 로그아웃 상태가 된다.
     * lax는 GET 이동에만 쿠키를 허용하므로 폼 제출(POST)을 노린 교차 사이트 요청은 여전히 막힌다.
     */
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_SECONDS,
  },
};

const validateSecret = (): void => {
  const password = sessionOptions.password;
  if (!password || typeof password !== 'string' || password.length < 32) {
    throw new Error('CREATOR_SESSION_SECRET must be set to a random string of at least 32 characters.');
  }
};

export const getCreatorSession = async (
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<IronSession<CreatorSessionData>> => {
  validateSecret();
  return getIronSession<CreatorSessionData>(req, res, sessionOptions);
};

export const getCreatorSessionFromContext = async (
  context: GetServerSidePropsContext,
): Promise<IronSession<CreatorSessionData>> => {
  validateSecret();
  return getIronSession<CreatorSessionData>(context.req, context.res, sessionOptions);
};
```

`lib/funding/creatorAuth.ts`:

```ts
import type { IronSession } from 'iron-session';
import type { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from 'next';

import {
  getCreatorSession, getCreatorSessionFromContext, type CreatorSessionData,
} from './creatorSession';

export const readCreatorId = (session: IronSession<CreatorSessionData>): string | null =>
  typeof session.creatorId === 'string' && session.creatorId !== '' ? session.creatorId : null;

export type CreatorAuth = { ok: true; creatorId: string } | { ok: false };

export const authenticateCreatorApi = async (
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<CreatorAuth> => {
  const creatorId = readCreatorId(await getCreatorSession(req, res));
  return creatorId ? { ok: true, creatorId } : { ok: false };
};

export const authenticateCreatorRequest = async (
  context: GetServerSidePropsContext,
): Promise<CreatorAuth> => {
  const creatorId = readCreatorId(await getCreatorSessionFromContext(context));
  return creatorId ? { ok: true, creatorId } : { ok: false };
};

export const loginCreatorSession = async (
  req: NextApiRequest,
  res: NextApiResponse,
  creatorId: string,
): Promise<void> => {
  const session = await getCreatorSession(req, res);
  session.creatorId = creatorId;
  await session.save();
};

/**
 * 매직링크 착지(getServerSideProps)용 로그인.
 *
 * API용과 따로 두는 이유: GSSP의 req/res는 NextApiRequest/Response가 아니다. 타입 단언으로
 * 때우면 다음 사람이 같은 자리에서 또 고민한다.
 */
export const loginCreatorSessionFromContext = async (
  context: GetServerSidePropsContext,
  creatorId: string,
): Promise<void> => {
  const session = await getCreatorSessionFromContext(context);
  session.creatorId = creatorId;
  await session.save();
};

export const logoutCreatorSession = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
  const session = await getCreatorSession(req, res);
  session.destroy();
};
```

- [ ] **Step 4: `.env.example`에 새 변수를 적는다**

`ADMIN_SESSION_SECRET` 줄 아래에:

```
# 펀딩 개설자 세션 쿠키 서명 키. 32자 이상 무작위 문자열.
# ADMIN_SESSION_SECRET와 **다른 값**이어야 한다 — 하나가 새도 다른 하나가 열리지 않게.
# 생성: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# CREATOR_SESSION_SECRET=
```

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

```bash
npx jest lib/funding/creatorAuth.test.ts && npm run type-check
```

Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add lib/funding/creatorSession.ts lib/funding/creatorAuth.ts lib/funding/creatorAuth.test.ts .env.example
git commit -m "$(cat <<'EOF'
feat(funding): 개설자 세션 — 관리자와 다른 쿠키·다른 비밀

SameSite는 lax다. 로그인이 메일 링크를 눌러 들어오는 경로라 strict면 그 첫 이동에 쿠키가
실리지 않아 로그인 직후 다시 로그아웃 상태가 된다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: 로그인 API와 메일

**Files:**
- Create: `lib/funding/creatorEmail.ts`
- Create: `lib/funding/creatorEmail.test.ts`
- Create: `pages/api/funding/creator/login.ts`
- Create: `pages/api/funding/creator/logout.ts`

**Interfaces:**
- Consumes: Task 8의 `issueCreatorLoginToken`·`normalizeCreatorEmail`, Task 9의 `logoutCreatorSession`, 기존 `sendEmail`·`consumeRateLimit`·`getClientIp`
- Produces: `sendCreatorLoginEmail(email: string, loginUrl: string): Promise<string | null>`, `buildCreatorLoginText(loginUrl: string): string`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/funding/creatorEmail.test.ts`:

```ts
import { buildCreatorLoginText } from './creatorEmail';

describe('buildCreatorLoginText', () => {
  const text = buildCreatorLoginText('https://studionol.co.kr/ko/funding/creator/auth?token=abc');

  it('링크를 그대로 싣는다', () => {
    expect(text).toContain('https://studionol.co.kr/ko/funding/creator/auth?token=abc');
  });

  it('수명과 1회용이라는 사실을 알린다', () => {
    expect(text).toContain('15분');
  });

  it('요청하지 않았을 때 무엇을 하면 되는지 적는다', () => {
    expect(text).toContain('요청하지 않으셨다면');
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx jest lib/funding/creatorEmail.test.ts
```

Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 메일 모듈을 만든다**

`lib/funding/creatorEmail.ts`:

```ts
import { sendEmail } from '../email/resend';
import { CUSTOMER_REPLY_TO } from '../operatorContact';

export const buildCreatorLoginText = (loginUrl: string): string => [
  '펀딩 개설 페이지로 들어가는 링크입니다.',
  '',
  loginUrl,
  '',
  '· 이 링크는 15분 동안, 한 번만 쓸 수 있습니다.',
  '· 요청하지 않으셨다면 이 메일을 지우셔도 됩니다. 링크를 누르지 않으면 아무 일도 일어나지 않습니다.',
  '',
  `문의: ${CUSTOMER_REPLY_TO}`,
].join('\n');

export const sendCreatorLoginEmail = async (email: string, loginUrl: string): Promise<string | null> => {
  const result = await sendEmail({
    to: email,
    replyTo: CUSTOMER_REPLY_TO,
    subject: '[스튜디오 놀] 펀딩 개설 로그인 링크',
    text: buildCreatorLoginText(loginUrl),
  });
  return result.success ? null : (result.error ?? '메일 발송 실패');
};
```

`lib/email/resend.ts`의 `SendEmailResult` 필드 이름이 `success`/`error`가 아니면 그 파일을 열어 실제 필드에 맞춘다.

- [ ] **Step 4: 로그인 API를 만든다**

`pages/api/funding/creator/login.ts`:

```ts
import type { NextApiRequest, NextApiResponse } from 'next';

import { consumeRateLimit } from '../../../../lib/booking/rate-limit';
import { getClientIp } from '../../../../lib/contracts/client-ip';
import { sendCreatorLoginEmail } from '../../../../lib/funding/creatorEmail';
import { issueCreatorLoginToken, normalizeCreatorEmail } from '../../../../lib/funding/creatorToken';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://studionol.co.kr').replace(/\/+$/, '');

/** IP당 10분에 5회. 같은 이메일로는 10분에 3회. */
const IP_LIMIT = 5;
const EMAIL_LIMIT = 3;
const WINDOW_SECONDS = 600;

/**
 * 응답은 언제나 같다.
 *
 * "등록되지 않은 이메일입니다"라고 답하면 이 화면이 **누가 개설자인지 알려 주는 조회기**가
 * 된다. 보낸 척과 실제로 보낸 것을 밖에서 구분할 수 없어야 한다.
 */
const OK = { ok: true, message: '로그인 링크를 보냈습니다. 메일함을 확인해 주세요.' };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const email = normalizeCreatorEmail(typeof req.body?.email === 'string' ? req.body.email : '');
  if (!email) return res.status(400).json({ ok: false, message: '이메일 주소를 확인해 주세요.' });

  const ip = getClientIp(req) ?? 'unknown';
  if (!(await consumeRateLimit(`creator_login:ip:${ip}`, IP_LIMIT, WINDOW_SECONDS))) {
    return res.status(429).json({ ok: false, message: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });
  }
  if (!(await consumeRateLimit(`creator_login:email:${email}`, EMAIL_LIMIT, WINDOW_SECONDS))) {
    // 한 주소로 링크를 퍼붓는 것을 막는다. 여기서도 같은 200을 돌려준다 — 429를 주면
    // "그 주소는 존재한다"를 알려 주는 셈이다.
    return res.status(200).json(OK);
  }

  const issued = await issueCreatorLoginToken(email);
  if (issued) {
    const url = `${SITE_URL}/ko/funding/creator/auth?token=${encodeURIComponent(issued.rawToken)}`;
    const error = await sendCreatorLoginEmail(email, url);
    // 메일 실패는 사용자에게 드러내지 않는다(위와 같은 이유). 기록만 남긴다.
    if (error) console.error('[funding] 개설자 로그인 메일 실패:', error);
  }
  return res.status(200).json(OK);
}
```

`pages/api/funding/creator/logout.ts`:

```ts
import type { NextApiRequest, NextApiResponse } from 'next';

import { logoutCreatorSession } from '../../../../lib/funding/creatorAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  await logoutCreatorSession(req, res);
  return res.status(200).json({ ok: true });
}
```

- [ ] **Step 5: 확인한다**

```bash
npx jest lib/funding/creatorEmail.test.ts && npm run type-check && npm run lint
```

Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add lib/funding/creatorEmail.ts lib/funding/creatorEmail.test.ts pages/api/funding/creator
git commit -m "$(cat <<'EOF'
feat(funding): 개설자 로그인 메일 요청 API

응답은 언제나 같다. "등록되지 않은 이메일입니다"라고 답하면 이 화면이 누가 개설자인지
알려 주는 조회기가 된다. 한도 초과도 같은 200으로 답한다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: 개설자 화면 3개

**Files:**
- Create: `lib/funding/creatorProjectList.ts`
- Create: `lib/funding/creatorProjectList.integration.test.ts`
- Create: `pages/[locale]/funding/apply.tsx`
- Create: `pages/[locale]/funding/creator/auth.tsx`
- Create: `pages/[locale]/funding/creator/index.tsx`

**Interfaces:**
- Consumes: Task 8·9·10의 전부
- Produces: `listProjectsForCreator(creatorId: string): Promise<CreatorProjectSummary[]>`, 타입 `CreatorProjectSummary = { id, slug, title, reviewStatus, status, reviewNote, updatedAt }`

- [ ] **Step 1: 실패하는 통합 테스트를 쓴다**

`lib/funding/creatorProjectList.integration.test.ts`:

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
import { listProjectsForCreator } from './creatorProjectList';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;

const creatorWithProject = async (email: string, slug: string) => {
  const [creator] = await mockDb.insert(schema.fundingCreators).values({ email, name: '가나' }).returning();
  await mockDb.insert(schema.fundingProjects).values({
    slug, creatorId: creator.id, title: `${slug} 제목`, summary: '요약', content: '본문',
    coverUrl: '/c.webp', goalAmount: 1000, startAt: new Date('2026-10-01T01:00:00Z'),
    endAt: new Date('2026-10-31T14:59:59Z'),
  });
  return creator.id;
};

beforeEach(async () => {
  client = createClient({ url: ':memory:' });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (stmt.trim()) await client.execute(stmt.trim());
    }
  }
  mockDb = drizzle(client, { schema });
});

afterEach(() => client.close());

describe('listProjectsForCreator', () => {
  it('자기 프로젝트만 돌려준다', async () => {
    const mine = await creatorWithProject('mine@example.com', 'mine');
    await creatorWithProject('other@example.com', 'other');
    const list = await listProjectsForCreator(mine);
    expect(list.map((p) => p.slug)).toEqual(['mine']);
    expect(list[0].reviewStatus).toBe('draft');
  });

  it('프로젝트가 없으면 빈 배열', async () => {
    const [creator] = await mockDb.insert(schema.fundingCreators)
      .values({ email: 'empty@example.com', name: '가나' }).returning();
    expect(await listProjectsForCreator(creator.id)).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx jest lib/funding/creatorProjectList.integration.test.ts
```

Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 목록 조회를 구현한다**

`lib/funding/creatorProjectList.ts`:

```ts
import { desc, eq } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingProjects } from '../../db/schema';

export interface CreatorProjectSummary {
  id: string;
  slug: string;
  title: string;
  reviewStatus: string;
  status: string;
  reviewNote: string | null;
  updatedAt: string;
}

/**
 * 개설자 본인의 프로젝트 목록.
 *
 * **creatorId를 인자로 요구하는 것이 이 함수의 전부다.** "전체를 가져와 화면에서 거른다"는
 * 모양의 함수를 이 파일에 두지 않는다 — 한 번이라도 그런 함수가 있으면 언젠가 소유 조건
 * 없이 호출된다.
 */
export const listProjectsForCreator = async (creatorId: string): Promise<CreatorProjectSummary[]> => {
  const rows = await getDb().select().from(fundingProjects)
    .where(eq(fundingProjects.creatorId, creatorId))
    .orderBy(desc(fundingProjects.updatedAt));
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    reviewStatus: r.reviewStatus,
    status: r.status,
    reviewNote: r.reviewNote,
    updatedAt: r.updatedAt.toISOString(),
  }));
};
```

- [ ] **Step 4: 인증 페이지를 만든다**

`pages/[locale]/funding/creator/auth.tsx` — 화면은 없다. 토큰을 소진하고 세션을 심은 뒤 목록으로 보낸다.

```tsx
import type { GetServerSideProps } from 'next';

import { loginCreatorSessionFromContext } from '../../../../lib/funding/creatorAuth';
import { consumeCreatorLoginToken } from '../../../../lib/funding/creatorToken';

export const getServerSideProps: GetServerSideProps = async (context) => {
  context.res.setHeader('Cache-Control', 'no-store');
  const token = typeof context.query.token === 'string' ? context.query.token : '';
  const consumed = token ? await consumeCreatorLoginToken(token) : null;
  if (!consumed) {
    // 링크가 만료됐거나 이미 쓰였다. 왜인지는 구분해 알리지 않는다 — 어느 쪽이든 할 일은
    // "다시 받기" 하나뿐이고, 구분해 주면 토큰의 상태를 밖에서 캐물을 수 있게 된다.
    return { redirect: { destination: '/ko/funding/apply?e=link', permanent: false } };
  }
  await loginCreatorSessionFromContext(context, consumed.creatorId);
  return { redirect: { destination: '/ko/funding/creator', permanent: false } };
};

export default function CreatorAuth() {
  return null;
}
```

- [ ] **Step 5: 신청 안내 페이지를 만든다**

`pages/[locale]/funding/apply.tsx` — ko 전용 정적 페이지. 이메일 한 칸과 안내문.

```tsx
import Head from 'next/head';
import { useState } from 'react';
import type { GetStaticPaths, GetStaticProps } from 'next';

import { buildPageStaticProps } from '../../../lib/getStatic';
import { defaultLocale } from '../../../lib/i18n';

export default function FundingApply() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/funding/creator/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) setError(data?.message ?? '잠시 후 다시 시도해 주세요.');
      else setSent(true);
    } catch {
      setError('연결에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Head>
        <title>펀딩 개설 신청 | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-3xl font-bold">펀딩 개설 신청</h1>
        <div className="mt-6 space-y-3 text-gray-700 dark:text-gray-300">
          <p>앨범·공연·굿즈를 만들 비용을 후원으로 모읍니다. 페이지는 직접 쓰고, 결제·환불·정산은 스튜디오 놀이 맡습니다.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>판매자는 스튜디오 놀입니다. 후원금은 스튜디오 놀이 받아 정산으로 보내 드립니다.</li>
            <li>리워드를 준비해 보내는 일은 개설자가 맡습니다.</li>
            <li>제출하시면 운영자가 확인하고 승인 또는 보완 요청을 메일로 알려 드립니다.</li>
          </ul>
        </div>

        <form onSubmit={submit} className="mt-10 space-y-3">
          <label htmlFor="email" className="block font-medium">이메일 주소</label>
          <input
            id="email" type="email" required value={email} autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 dark:border-gray-700 dark:bg-gray-900"
            placeholder="you@example.com"
          />
          <button
            type="submit" disabled={busy}
            className="w-full rounded-lg bg-primary px-4 py-3 font-semibold text-white disabled:opacity-60"
          >
            {busy ? '보내는 중…' : '로그인 링크 받기'}
          </button>
          {sent && <p className="text-sm text-green-700 dark:text-green-400">로그인 링크를 보냈습니다. 메일함을 확인해 주세요.</p>}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <p className="text-sm text-gray-500">비밀번호는 없습니다. 메일로 받은 링크로 들어옵니다.</p>
        </form>
      </main>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: [{ params: { locale: defaultLocale } }],
  fallback: false,
});

export const getStaticProps: GetStaticProps = async () =>
  buildPageStaticProps(defaultLocale, {}, { i18nSections: [] });
```

버튼은 `bg-primary`다 — 목적지가 카카오톡이 아니므로 옐로를 쓰지 않는다(CLAUDE.md 카카오 CTA 배색 규칙).

- [ ] **Step 6: 목록 페이지를 만든다**

`pages/[locale]/funding/creator/index.tsx`:

```tsx
import Head from 'next/head';
import Link from 'next/link';
import type { GetServerSideProps } from 'next';

import { withI18nServerProps } from '../../../../lib/getStatic';
import { authenticateCreatorRequest } from '../../../../lib/funding/creatorAuth';
import { listProjectsForCreator, type CreatorProjectSummary } from '../../../../lib/funding/creatorProjectList';

const REVIEW_LABEL: Record<string, string> = {
  draft: '작성 중',
  submitted: '심사 중',
  changes_requested: '보완 요청',
  approved: '공개',
  rejected: '반려',
};

interface Props { projects: CreatorProjectSummary[] }

export default function CreatorHome({ projects }: Props) {
  return (
    <>
      <Head>
        <title>내 펀딩 프로젝트 | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-3xl font-bold">내 펀딩 프로젝트</h1>
        {projects.length === 0 ? (
          <p className="mt-8 text-gray-600 dark:text-gray-400">아직 만든 프로젝트가 없습니다.</p>
        ) : (
          <ul className="mt-8 space-y-3">
            {projects.map((p) => (
              <li key={p.id} className="glass-card rounded-2xl p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{p.title}</span>
                  <span className="text-sm text-gray-500">{REVIEW_LABEL[p.reviewStatus] ?? p.reviewStatus}</span>
                </div>
                {p.reviewNote && (
                  <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">운영자 메모: {p.reviewNote}</p>
                )}
                {p.reviewStatus === 'approved' && (
                  <Link href={`/ko/funding/${p.slug}`} className="mt-3 inline-block text-sm underline">
                    공개된 페이지 보기
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-10 text-sm text-gray-500">
          프로젝트 만들기·편집은 다음 배포에서 열립니다. 문의는 메일로 주세요.
        </p>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = withI18nServerProps<Props>(async (context) => {
  context.res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateCreatorRequest(context);
  if (!auth.ok) return { redirect: { destination: '/ko/funding/apply', permanent: false } };
  const projects = await listProjectsForCreator(auth.creatorId);
  return { props: { projects } };
});
```

- [ ] **Step 7: 확인한다**

```bash
npx jest lib/funding/creatorProjectList.integration.test.ts && npm run type-check && npm run lint
```

Expected: PASS.

- [ ] **Step 8: 커밋**

```bash
git add lib/funding/creatorProjectList.ts lib/funding/creatorProjectList.integration.test.ts pages/\[locale\]/funding/apply.tsx pages/\[locale\]/funding/creator lib/funding/creatorSession.ts
git commit -m "$(cat <<'EOF'
feat(funding): 개설자가 메일 링크로 들어와 자기 프로젝트를 본다

목록 조회 함수는 creatorId를 인자로 요구한다. "전체를 가져와 화면에서 거른다"는 모양의
함수를 두지 않는다 — 한 번이라도 있으면 언젠가 소유 조건 없이 호출된다.

프로젝트 만들기·편집은 다음 단계다. 지금은 빈 목록과 상태 배지까지.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: 전체 검증과 문서

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-09-08-funding-design.md`

**Interfaces:**
- Consumes: 전부
- Produces: 없음

- [ ] **Step 1: 전체 검사를 돌린다**

```bash
npm run type-check && npm run lint && npm test
```

Expected: 전부 PASS. 특히 아래가 녹색이어야 한다.

- `content/funding.baseline.test.ts` — md 기준선은 그대로 산다
- `content/fundingImages.baseline.test.ts`
- `lib/funding/*.integration.test.ts`
- `lib/sitemap/routes.test.js`

- [ ] **Step 2: DB 없이 빌드되는지 확인한다**

```bash
env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN npm run build
```

Expected: 빌드 성공. 로그에 `[funding] DB 조회 실패` 경고가 보이는 것은 **정상**이다 — 그 경고가 나면서도 빌드가 끝나는 것이 이 태스크가 확인하려는 것이다.

- [ ] **Step 3: `CLAUDE.md`에 규칙을 적는다**

"### 오픈 뒤 펀딩 프로젝트의 리워드 id·slug·금액은 바꾸지 않는다" 절 **바로 아래**에 넣는다:

```markdown
### 펀딩 프로젝트의 정본은 둘이다 — 파일이 먼저, 그다음 DB

`content/funding/<slug>.md`와 `funding_projects` 테이블이 공존한다. 읽는 입구는
`lib/funding/repository.ts` 하나뿐이고 **같은 slug가 양쪽에 있으면 파일이 이긴다.**
새 코드에서 `lib/funding/projects.ts`의 동기 함수(`getFundingProject` 등)를 직접 부르지 말 것 —
그 함수들은 파일만 보므로 DB 프로젝트가 조용히 404가 된다.

검증은 `lib/funding/shape.ts`의 `validateFundingProjectShape` 하나다. md 파서와 DB 변환이
같은 함수를 지난다 — 한쪽에만 검증을 두면 다른 쪽은 `status: Draft` 오타로 초안을 공개한다.

DB 조회는 전부 실패를 삼키고 파일 기준으로 응답한다. **빌드는 `TURSO_*` 없이 성공해야 한다**
(CI·로컬). 공개 페이지는 ISR(60초)이고 상세는 `fallback: 'blocking'`이라 DB 프로젝트가 첫
요청에 생성된다. 사이트맵은 `next-sitemap`이 파일만 싣고, DB 프로젝트는 런타임 라우트
`/sitemap-funding.xml`이 맡는다.
```

- [ ] **Step 4: 1차 스펙의 "하지 않는 것"을 갱신한다**

`docs/superpowers/specs/2026-09-08-funding-design.md` §14의 첫 줄

```
- 크리에이터 셀프 개설 · 심사 · 사이트 내 정산 · 세금계산서 자동화
```

을 아래로 바꾼다.

```
- ~~크리에이터 셀프 개설 · 심사 · 사이트 내 정산~~ — 2026-09-17 설계로 범위에 들어왔다
  ([2026-09-17-funding-self-serve-design.md](2026-09-17-funding-self-serve-design.md)). 세금계산서 자동화는 여전히 범위 밖.
```

- [ ] **Step 5: 커밋하고 푸시한다**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-09-08-funding-design.md
git commit -m "$(cat <<'EOF'
docs(funding): 정본이 둘이라는 사실과 읽는 입구를 CLAUDE.md에 적는다

새 코드가 projects.ts의 동기 함수를 직접 부르면 DB 프로젝트가 조용히 404가 된다.
읽는 입구는 repository.ts 하나다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline origin/main..HEAD
git push -u origin feat/funding-self-serve-design
```

푸시는 이 사이클의 **마지막에 한 번**이다(CLAUDE.md 커밋·푸시 규칙). 여러 커밋이 한 빌드로 나가는 것이 의도다.

- [ ] **Step 6: PR을 연다**

```bash
gh pr create --fill --base main
```

본문 끝에 `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

---

## 다음 단계 (이 계획의 범위 밖)

스펙 §12의 3~6단계다. 각각 별도 계획 문서로 쓴다.

3. 편집 화면 4구획 + 이미지 업로드 + 미리보기 + 심사 신청
4. 관리자 프로젝트 탭·판정·알림·온디맨드 revalidate — **여기서 첫 DB 프로젝트가 공개된다**
5. 공개 뒤 편집 규칙과 `lockedAt` 가드, 개설자 통계
6. 정산 계산·관리자 정산 탭·개설자 약관·후원자 약관 개정

3단계를 시작하기 전에 스펙 §2의 결정 6가지(D1~D6) 중 최소한 **D1(수수료)·D3(배송 주체)·D4(개설 자격)**는 확정돼야 한다. 셋 다 화면의 문구와 약관 조항을 결정한다.
