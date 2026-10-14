# 공연 주최자 자가등록 1단계 — 등록·심사·공개 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 인디 아티스트(주최자)가 폼으로 공연을 등록·제출하고, 운영자가 심사해 승인하면 코드 배포 없이 `/ko/shows/<slug>`가 열린다.

**Architecture:** 계정·로그인·업로드는 펀딩 개설자 시스템(`funding_creators`, `creator_session`, `lib/funding/creatorUpload.ts`)을 그대로 쓴다. 주최자가 쓰는 초안은 새 표 `show_submissions.draft_json` 한 칸에 담고, 승인하면 초안을 `ShowDefinition`으로 바꿔 **기존 `seedShow()`** 로 `shows`·구역·회차·티켓타입을 만든 뒤 공개한다. 승인 뒤에 주최자가 소개 같은 내용을 고치면 같은 `seedShow()`를 다시 돌린다. 이 함수는 멱등이고, 팔린 티켓의 가격 변경과 정원 축소를 이미 막는다.

**Tech Stack:** Next.js 15.5 Pages Router, drizzle-orm + Turso(libSQL), iron-session, @vercel/blob(private), sharp, Jest.

**Spec:** 이 파일의 "결정 사항" 절(2026-10-14 운영자 결정). 근거 조사: `lib/shows/CLAUDE.md`, `lib/funding/CLAUDE.md`.

## 결정 사항 (운영자 2026-10-14)

| 항목 | 결정 |
|---|---|
| 수수료 | 펀딩과 같다 — 플랫폼 `FUNDING_PLATFORM_FEE_PERCENT`(5.5%) + 결제 `FUNDING_PAYMENT_FEE_PERCENT`(3.3%), 둘 다 부가세 포함 |
| 취소 비용 | 공연(회차)이 취소되면 그 비용(결제 수수료)은 **주최자**가 부담 |
| 정산 | 마지막 회차가 끝난 뒤 **14영업일** 이내(`FUNDING_PAYOUT_BUSINESS_DAYS`) |
| 환불 규정 | 모든 공연이 같은 표(`lib/shows/refundPolicy.ts`). 공연별 설정 없음 |

1단계 범위: 등록 폼 · 이미지 업로드 · 제출 · 주최자 약관 · 운영자 심사 · 승인 → 공개 · 승인 뒤 내용 수정 · 알림 메일 · 공개 안내 페이지.
**범위 밖**(2·3단계): 주최자 대시보드의 판매 현황·스캔 링크 직접 발급·초대권, 정산 기록·지급. 정산 조건은 2·3단계 구현이 아니라 **이번 약관에 적는다**(동의 시점에 약속이 있어야 한다).

## Global Constraints

- 새 표는 `show_submissions` 하나다. `shows`에 컬럼을 더하지 않는다(0037과 같은 이유 — 관계 조회가 전체 컬럼을 SELECT하므로 배포가 마이그레이션보다 먼저 나가면 공연 결제가 깨진다). 표가 없을 때 공개 화면(`/ko/shows/*`)은 지금처럼 동작해야 한다. 주최자 화면만 500이어도 된다.
- 마이그레이션은 `npm run db:generate`로 만든다. 새 엔트리의 `when`이 저널 최댓값 `1791791182302`(0052_shop)보다 커야 한다. 운영 적용은 루트 CLAUDE.md "운영 DB 마이그레이션 적용 방법"대로, 배포 **전에** 한다.
- 주최자 계정 = `funding_creators` 행이고, 로그인 = `/api/funding/creator/login`이다. 새 인증·새 쿠키를 만들지 않는다.
- 업로드 이미지는 `funding/<creatorId>-<uuid>.webp`(private Blob)이고 주소는 `/api/funding/media/…`다. 새 접두사·새 미디어 라우트를 만들지 않는다.
- 공연 하나 = 구역 하나(`code: 'GA'`, `label: '전석'`). 티켓 종류는 1~3개, 가격은 **1,000원 이상 정수**(무료 공연은 받지 않는다), `quota: null`, `compQuota: 0`.
- 첫 회차는 제출할 때와 승인할 때 모두 **지금으로부터 7일 이후**여야 한다(심사·판매 기간 확보).
- 승인 뒤 잠기는 칸: 회차 일시 · 정원 · 티켓 종류(이름·가격) · 장소 이름·주소 · 공연 시간 · 관람 등급 · slug. 승인 뒤에 고칠 수 있는 칸: 제목·부제·소개·포스터·출연진·일정 안내 한 줄·안내 목록. 잠긴 칸을 바꿔야 하면 운영자가 손으로 처리한다(기존 `change_showtime` 등).
- 주최자 화면 문구는 한국어만 쓴다. 공연은 `en` 칸 없이 공개되고, 영어 화면은 한국어 내용을 그대로 보인다(`lib/shows/CLAUDE.md` 영어 절의 기존 동작).
- 주최자에게 관객 개인정보를 주지 않는다(처리방침 4항 제3자 제공 없음).
- 메일은 `lib/email/layout.ts`의 `buildEmailLayout`으로 보낸다. 운영자 알림은 `audience: 'operator'` + 관리자 딥링크.
- 새 페이지는 `docs/design-system.md` §8을 따른다(`designEdition = 'v2'`, `PageShell`, `components/ui/` 프리미티브). `tests/pages/pageScaffold.test.ts`, `components/ui/uiPatterns.baseline.test.ts`를 통과해야 한다.
- 검증 순서: `npm run type-check` → `npm run lint` → `npx jest`(전체 — 디렉터리로 좁히지 않는다) → `npm run build`.

## Review Focus

1. **남의 이미지 끼워 넣기** — 주최자가 다른 개설자의 공개 표지 주소(`/api/funding/media/<남의id>-….webp`)를 포스터·출연진 사진으로 저장하면 저장 API가 거부해야 한다(Task 3의 `isOwnFundingMedia` 검사 테스트).
2. **승인된 공연의 잠긴 칸 변경 시도** — 승인 뒤 저장 요청에 바뀐 가격·회차를 실어 보내면, 응답은 성공이어도 DB의 가격·회차는 그대로여야 한다(Task 2의 `mergeApprovedEdit` 테스트, Task 6 통합 테스트).
3. **slug 충돌** — 운영자가 승인할 때 이미 `shows`에 있는 slug나 예약어(`host`, `organizer-terms` 포함)를 고르면 공연을 만들지 않고 거부해야 한다(Task 5 테스트).
4. **심사 화면을 연 뒤 주최자가 철회·재제출** — 운영자가 본 판본이 아닌 판본을 승인하지 않아야 한다(`expectedSubmittedAt` 대조, Task 5 테스트).
5. **비공개 이미지 노출** — 심사 중이거나 반려된 제출물의 포스터는 무인증 요청에 404여야 하고, 공개된 공연의 포스터는 200이어야 한다(Task 4 테스트).

---

### Task 1: 스키마 — `show_submissions` + 마이그레이션

**Files:**
- Modify: `db/schema.ts` (shows 블록 뒤, `showReportLinks` 근처)
- Create: `drizzle/migrations/0053_show_submissions.sql` (generate 산출물), `drizzle/migrations/meta/0053_snapshot.json`, `_journal.json` 갱신
- Test: `lib/shows/organizer/schema.integration.test.ts`

**Interfaces:**
- Produces: `showSubmissions` 테이블 객체, `type ShowSubmission = typeof showSubmissions.$inferSelect`

- [ ] **Step 1: 스키마 추가**

```ts
// db/schema.ts — showReportLinks 정의 뒤
/**
 * 주최자 자가등록 공연의 초안·심사 기록(2026-10-14). 주최자 계정은 펀딩 개설자(`funding_creators`)와 같다.
 * 초안은 `draft_json` 한 칸(lib/shows/organizer/draft.ts가 유일한 주인)이고, 승인하면 seedShow가
 * shows·구역·회차·티켓타입을 만들고 `show_id`를 잇는다. `shows`에 컬럼을 더하지 않은 이유는 0037과 같다.
 */
export const showSubmissions = sqliteTable('show_submissions', {
  id: text('id').primaryKey().$defaultFn(() => sql`lower(hex(randomblob(16)))`),
  creatorId: text('creator_id').notNull().references(() => fundingCreators.id),
  showId: text('show_id').references(() => shows.id),
  draftJson: text('draft_json').notNull(),
  /** 승인 때 굳힌 초안 — 승인 뒤 저장은 잠긴 칸을 여기서 가져온다(mergeApprovedEdit). */
  approvedDraftJson: text('approved_draft_json'),
  reviewStatus: text('review_status', { enum: fundingReviewStatusEnum }).notNull().default('draft'),
  reviewNote: text('review_note'),
  internalNote: text('internal_note'),
  organizerTermsVersion: text('organizer_terms_version'),
  organizerTermsAgreedAt: integer('organizer_terms_agreed_at', { mode: 'timestamp' }),
  submittedAt: integer('submitted_at', { mode: 'timestamp' }),
  approvedAt: integer('approved_at', { mode: 'timestamp' }),
  rejectedAt: integer('rejected_at', { mode: 'timestamp' }),
  organizerEditedAt: integer('organizer_edited_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => ({
  creatorIdx: index('show_submissions_creator_idx').on(t.creatorId),
  showIdx: uniqueIndex('show_submissions_show_idx').on(t.showId),
}));

export type ShowSubmission = typeof showSubmissions.$inferSelect;
```

- [ ] **Step 2: 마이그레이션 생성**

Run: `npm run db:generate -- --name show_submissions`
그다음 `node -e "const e=require('./drizzle/migrations/meta/_journal.json').entries;console.log(e.at(-1).tag,e.at(-1).when, e.at(-1).when>1791791182302)"`
Expected: `0053_show_submissions <when> true`. SQL에 `CREATE TABLE show_submissions` 외의 DDL이 없어야 한다(있으면 스냅샷 사슬 문제 — 루트 CLAUDE.md "병합 뒤의 두 번째 함정").

- [ ] **Step 3: 통합 테스트 작성**

기존 통합 테스트(`lib/shows/seed.integration.test.ts`)가 쓰는 테스트 DB 헬퍼를 그대로 가져와, 개설자 한 명을 넣고 `show_submissions`에 초안 행을 넣은 뒤 다시 읽어 `reviewStatus === 'draft'`, `showId === null`인지 본다. 같은 `showId`를 두 행에 넣으면 unique 위반으로 던지는지도 본다.

- [ ] **Step 4: 실행**

Run: `npx jest lib/shows/organizer/schema.integration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add db/schema.ts drizzle/migrations lib/shows/organizer/schema.integration.test.ts
git commit -m "feat(shows): 주최자 등록 초안·심사 표 show_submissions (0053)"
```

---

### Task 2: 초안 형식·검증·ShowDefinition 변환 (순수 함수)

**Files:**
- Create: `lib/shows/organizer/draft.ts`
- Test: `lib/shows/organizer/draft.test.ts`

**Interfaces:**
- Consumes: `ShowDefinition`, `validateShowDefinition` (`lib/shows/seed.ts`), `isFundingMediaUrl`, `isOwnFundingMedia`
- Produces:
  - `interface ShowSubmissionDraft`
  - `emptyDraft(): ShowSubmissionDraft`
  - `parseDraft(json: string | null): ShowSubmissionDraft` (깨진 JSON → `emptyDraft()`)
  - `normalizeDraftInput(input: unknown, creatorId: string): { ok: true; draft: ShowSubmissionDraft } | { ok: false; message: string }` (저장용 — 형식·길이·이미지 소유만 본다, 빈 칸 허용)
  - `findSubmitProblems(draft: ShowSubmissionDraft, now: Date): string[]` (제출·승인용 — 필수값·7일 리드타임·가격 하한)
  - `buildShowDefinition(draft: ShowSubmissionDraft, slug: string): ShowDefinition`
  - `mergeApprovedEdit(approved: ShowSubmissionDraft, incoming: ShowSubmissionDraft): ShowSubmissionDraft`
  - 상수 `SHOW_DRAFT_LIMITS`, `MIN_LEAD_DAYS = 7`, `MIN_TICKET_PRICE = 1000`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// lib/shows/organizer/draft.test.ts
import { buildShowDefinition, emptyDraft, findSubmitProblems, mergeApprovedEdit, normalizeDraftInput, parseDraft, type ShowSubmissionDraft } from './draft';
import { validateShowDefinition } from '../seed';

const CREATOR = 'a'.repeat(32);
const NOW = new Date('2026-10-14T03:00:00Z');
const ownPhoto = `/api/funding/media/${CREATOR}-11111111-1111-1111-1111-111111111111.webp?w=800&h=1100`;

const complete = (): ShowSubmissionDraft => ({
  ...emptyDraft(),
  title: '가을 밤 단독 공연',
  presenterName: '밴드 놀',
  description: '첫 문단 소개입니다.\n\n둘째 문단.',
  posterUrl: ownPhoto,
  ageRating: '전체 관람가',
  runningMinutes: 90,
  venueName: '스튜디오 놀',
  venueAddress: '서울 마포구 어딘가 1',
  showtimes: ['2026-11-01T19:00'],
  capacity: 60,
  ticketTypes: [{ name: '일반', price: 20000 }],
  performers: [{ name: '밴드 놀', bio: '', photoUrl: null }],
});

test('완성된 초안은 문제 없음', () => {
  expect(findSubmitProblems(complete(), NOW)).toEqual([]);
});

test('첫 회차가 7일 안이면 거부', () => {
  const d = { ...complete(), showtimes: ['2026-10-18T19:00'] };
  expect(findSubmitProblems(d, NOW).join()).toContain('7일');
});

test('1,000원 미만 가격 거부', () => {
  const d = { ...complete(), ticketTypes: [{ name: '일반', price: 500 }] };
  expect(findSubmitProblems(d, NOW).join()).toContain('1,000원');
});

test('남의 업로드 이미지는 저장 단계에서 거부', () => {
  const other = `/api/funding/media/${'b'.repeat(32)}-x.webp?w=1&h=1`;
  const r = normalizeDraftInput({ ...complete(), posterUrl: other }, CREATOR);
  expect(r.ok).toBe(false);
});

test('외부 이미지 주소도 거부', () => {
  const r = normalizeDraftInput({ ...complete(), posterUrl: 'https://evil.example/a.png' }, CREATOR);
  expect(r.ok).toBe(false);
});

test('ShowDefinition으로 바꾸면 기존 검증을 통과(이미지 존재 검사는 업로드 주소를 건너뜀)', () => {
  const def = buildShowDefinition(complete(), 'autumn-night');
  expect(def.zones).toEqual([{ code: 'GA', label: '전석', capacity: 60 }]);
  expect(def.ticketTypes).toEqual([{ zoneCode: 'GA', name: '일반', price: 20000, quota: null, compQuota: 0 }]);
  expect(def.showtimes[0].startsAt.toISOString()).toBe('2026-11-01T10:00:00.000Z'); // KST 19:00
  expect(def.coverImage).toBe(ownPhoto);
  expect(validateShowDefinition(def)).toEqual([]);
});

test('승인 뒤 저장은 잠긴 칸을 승인본에서 가져온다', () => {
  const approved = complete();
  const incoming = { ...complete(), description: '바뀐 소개.', ticketTypes: [{ name: '일반', price: 1000 }], showtimes: ['2026-12-01T19:00'], capacity: 999 };
  const merged = mergeApprovedEdit(approved, incoming);
  expect(merged.description).toBe('바뀐 소개.');
  expect(merged.ticketTypes).toEqual(approved.ticketTypes);
  expect(merged.showtimes).toEqual(approved.showtimes);
  expect(merged.capacity).toBe(60);
});

test('깨진 JSON은 빈 초안', () => {
  expect(parseDraft('{oops')).toEqual(emptyDraft());
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest lib/shows/organizer/draft.test.ts`
Expected: FAIL — `Cannot find module './draft'`

- [ ] **Step 3: 구현**

```ts
// lib/shows/organizer/draft.ts
import { isFundingMediaUrl, FUNDING_MEDIA_URL_PREFIX } from '../../funding/mediaPath';
import { isOwnFundingMedia } from '../../funding/mediaAccess';
import { descriptionBlocks } from '../structured';
import type { ShowDefinition } from '../seed';

/**
 * 주최자 공연 초안 — `show_submissions.draft_json`의 형식. 이 파일이 저장 형식의 유일한 주인이다.
 * 소규모 공연 전제라 구역은 하나(전석)뿐이고 정원만 받는다.
 */
export interface ShowSubmissionDraft {
  title: string;
  subtitle: string;
  presenterName: string;
  description: string;
  posterUrl: string | null;
  ageRating: string;
  runningMinutes: number | null;
  venueName: string;
  venueAddress: string;
  scheduleNote: string;
  notices: string[];
  /** KST 벽시계 'YYYY-MM-DDTHH:mm' */
  showtimes: string[];
  capacity: number | null;
  ticketTypes: Array<{ name: string; price: number | null }>;
  performers: Array<{ name: string; bio: string; photoUrl: string | null }>;
}

export const MIN_LEAD_DAYS = 7;
export const MIN_TICKET_PRICE = 1000;
export const SHOW_DRAFT_LIMITS = {
  title: 60, subtitle: 80, presenterName: 40, description: 5000, ageRating: 20, venueName: 60, venueAddress: 120,
  scheduleNote: 80, notice: 120, notices: 8, showtimes: 10, ticketTypes: 3, ticketName: 20, performers: 12,
  performerName: 40, performerBio: 400, capacity: 2000, runningMinutes: 600, price: 1_000_000,
} as const;

export const emptyDraft = (): ShowSubmissionDraft => ({
  title: '', subtitle: '', presenterName: '', description: '', posterUrl: null, ageRating: '', runningMinutes: null,
  venueName: '', venueAddress: '', scheduleNote: '', notices: [], showtimes: [], capacity: null,
  ticketTypes: [{ name: '일반', price: null }], performers: [],
});

export const parseDraft = (json: string | null): ShowSubmissionDraft => {
  if (!json) return emptyDraft();
  try {
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') return emptyDraft();
    return { ...emptyDraft(), ...(parsed as Partial<ShowSubmissionDraft>) };
  } catch {
    return emptyDraft();
  }
};

const KST_WALL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
export const kstWallToDate = (wall: string): Date | null => {
  const m = KST_WALL.exec(wall);
  if (!m) return null;
  const d = new Date(`${wall}:00+09:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.length <= max ? v.trim() : null);
const intOrNull = (v: unknown, max: number): number | null | undefined =>
  v === null || v === '' || v === undefined ? null : (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max ? (v as number) : undefined);

/** 업로드 이미지는 이 주최자 자신의 것만 받는다(남의 공개 표지 끼워 넣기 방지 — creatorValidation.ts와 같은 규칙). */
const ownImage = (v: unknown, creatorId: string): string | null | undefined => {
  if (v === null || v === '' || v === undefined) return null;
  if (typeof v !== 'string' || !isFundingMediaUrl(v)) return undefined;
  const filename = v.slice(FUNDING_MEDIA_URL_PREFIX.length).split('?')[0];
  return isOwnFundingMedia(filename, creatorId) ? v : undefined;
};

export const normalizeDraftInput = (
  input: unknown,
  creatorId: string,
): { ok: true; draft: ShowSubmissionDraft } | { ok: false; message: string } => {
  const fail = (message: string) => ({ ok: false as const, message });
  if (!input || typeof input !== 'object') return fail('요청 형식이 올바르지 않아요.');
  const i = input as Record<string, unknown>;
  const L = SHOW_DRAFT_LIMITS;
  const title = str(i.title, L.title);
  const subtitle = str(i.subtitle ?? '', L.subtitle);
  const presenterName = str(i.presenterName, L.presenterName);
  const description = str(i.description, L.description);
  const ageRating = str(i.ageRating, L.ageRating);
  const venueName = str(i.venueName, L.venueName);
  const venueAddress = str(i.venueAddress, L.venueAddress);
  const scheduleNote = str(i.scheduleNote ?? '', L.scheduleNote);
  if ([title, subtitle, presenterName, description, ageRating, venueName, venueAddress, scheduleNote].some((v) => v === null)) {
    return fail('글자 수가 너무 많은 칸이 있어요.');
  }
  const posterUrl = ownImage(i.posterUrl, creatorId);
  if (posterUrl === undefined) return fail('포스터는 이 화면에서 올린 이미지만 쓸 수 있어요.');
  const runningMinutes = intOrNull(i.runningMinutes, L.runningMinutes);
  const capacity = intOrNull(i.capacity, L.capacity);
  if (runningMinutes === undefined || capacity === undefined) return fail('숫자 칸을 확인해 주세요.');

  const notices = Array.isArray(i.notices) ? i.notices.map((n) => str(n, L.notice)) : [];
  if (notices.length > L.notices || notices.some((n) => n === null)) return fail('안내 목록을 확인해 주세요.');
  const showtimes = Array.isArray(i.showtimes) ? i.showtimes : [];
  if (showtimes.length > L.showtimes || showtimes.some((s) => typeof s !== 'string' || !kstWallToDate(s))) return fail('회차 일시를 확인해 주세요.');

  const ticketTypesIn = Array.isArray(i.ticketTypes) ? i.ticketTypes : [];
  if (ticketTypesIn.length > L.ticketTypes) return fail(`티켓 종류는 ${L.ticketTypes}개까지예요.`);
  const ticketTypes: ShowSubmissionDraft['ticketTypes'] = [];
  for (const t of ticketTypesIn) {
    const name = str((t as Record<string, unknown>)?.name, L.ticketName);
    const price = intOrNull((t as Record<string, unknown>)?.price, L.price);
    if (name === null || price === undefined) return fail('티켓 종류를 확인해 주세요.');
    ticketTypes.push({ name, price });
  }

  const performersIn = Array.isArray(i.performers) ? i.performers : [];
  if (performersIn.length > L.performers) return fail(`출연진은 ${L.performers}명까지예요.`);
  const performers: ShowSubmissionDraft['performers'] = [];
  for (const p of performersIn) {
    const rec = (p ?? {}) as Record<string, unknown>;
    const name = str(rec.name, L.performerName);
    const bio = str(rec.bio ?? '', L.performerBio);
    const photoUrl = ownImage(rec.photoUrl, creatorId);
    if (name === null || bio === null) return fail('출연진 칸을 확인해 주세요.');
    if (photoUrl === undefined) return fail('출연진 사진은 이 화면에서 올린 이미지만 쓸 수 있어요.');
    performers.push({ name, bio, photoUrl });
  }

  return {
    ok: true,
    draft: {
      title: title!, subtitle: subtitle!, presenterName: presenterName!, description: description!, posterUrl,
      ageRating: ageRating!, runningMinutes, venueName: venueName!, venueAddress: venueAddress!, scheduleNote: scheduleNote!,
      notices: (notices as string[]).filter(Boolean), showtimes: showtimes as string[], capacity, ticketTypes, performers,
    },
  };
};

const DAY_MS = 86_400_000;

/** 제출·승인 때 보는 필수값. 문구는 주최자 화면에 그대로 나간다. */
export const findSubmitProblems = (d: ShowSubmissionDraft, now: Date): string[] => {
  const p: string[] = [];
  if (!d.title) p.push('공연 제목을 적어 주세요.');
  if (d.title.includes(' — ')) p.push('제목에 " — "를 넣지 말고 부제 칸을 써 주세요.');
  if (!d.presenterName) p.push('주최 이름을 적어 주세요.');
  if (!d.description) p.push('공연 소개를 적어 주세요.');
  else if (descriptionBlocks(d.description)[0]?.type !== 'p') p.push('소개는 일반 문단으로 시작해 주세요(첫 줄이 ## 이나 > 이면 안 돼요).');
  if (!d.posterUrl) p.push('포스터를 올려 주세요.');
  if (!d.ageRating) p.push('관람 등급을 적어 주세요.');
  if (!d.runningMinutes) p.push('공연 시간(분)을 적어 주세요.');
  if (!d.venueName || !d.venueAddress) p.push('공연장 이름과 주소를 적어 주세요.');
  if (d.showtimes.length === 0) p.push('회차를 하나 이상 넣어 주세요.');
  const times = d.showtimes.map(kstWallToDate);
  const first = Math.min(...times.map((t) => t?.getTime() ?? 0));
  if (d.showtimes.length > 0 && first < now.getTime() + MIN_LEAD_DAYS * DAY_MS) p.push(`첫 회차는 오늘로부터 ${MIN_LEAD_DAYS}일 뒤부터 잡을 수 있어요(심사와 판매 기간).`);
  if (new Set(d.showtimes).size !== d.showtimes.length) p.push('같은 일시의 회차가 두 번 들어 있어요.');
  if (!d.capacity) p.push('정원을 적어 주세요.');
  if (d.ticketTypes.length === 0) p.push('티켓 종류를 하나 이상 넣어 주세요.');
  if (d.ticketTypes.some((t) => !t.name)) p.push('티켓 종류 이름을 적어 주세요.');
  if (new Set(d.ticketTypes.map((t) => t.name)).size !== d.ticketTypes.length) p.push('티켓 종류 이름이 겹쳐요.');
  if (d.ticketTypes.some((t) => t.price === null || t.price < MIN_TICKET_PRICE)) p.push(`티켓 가격은 ${MIN_TICKET_PRICE.toLocaleString('ko-KR')}원 이상이어야 해요.`);
  if (d.performers.length === 0) p.push('출연진을 한 명(팀) 이상 넣어 주세요.');
  if (d.performers.some((x) => !x.name)) p.push('출연진 이름을 적어 주세요.');
  if (new Set(d.performers.map((x) => x.name)).size !== d.performers.length) p.push('출연진 이름이 겹쳐요.');
  return p;
};

/** 승인 때만 부른다 — findSubmitProblems가 비어 있다는 전제(널 칸이 없다). */
export const buildShowDefinition = (d: ShowSubmissionDraft, slug: string): ShowDefinition => ({
  slug,
  title: d.title,
  subtitle: d.subtitle || null,
  presenterName: d.presenterName,
  performers: d.performers.map((x) => ({ name: x.name, bio: x.bio || undefined, photo: x.photoUrl ?? undefined })),
  ageRating: d.ageRating,
  runningMinutes: d.runningMinutes!,
  venueName: d.venueName,
  venueAddress: d.venueAddress,
  description: d.description,
  coverImage: d.posterUrl,
  ogImage: null,
  scheduleNote: d.scheduleNote || null,
  notices: d.notices,
  zones: [{ code: 'GA', label: '전석', capacity: d.capacity! }],
  showtimes: d.showtimes.map((s) => ({ startsAt: kstWallToDate(s)! })),
  ticketTypes: d.ticketTypes.map((t) => ({ zoneCode: 'GA', name: t.name, price: t.price!, quota: null, compQuota: 0 })),
});

/** 승인 뒤 저장 — 판매 조건(일시·정원·가격·장소·시간·등급)은 승인본 값을 유지한다. */
export const mergeApprovedEdit = (approved: ShowSubmissionDraft, incoming: ShowSubmissionDraft): ShowSubmissionDraft => ({
  ...incoming,
  ageRating: approved.ageRating,
  runningMinutes: approved.runningMinutes,
  venueName: approved.venueName,
  venueAddress: approved.venueAddress,
  showtimes: approved.showtimes,
  capacity: approved.capacity,
  ticketTypes: approved.ticketTypes,
});
```

`ShowPerformer`의 사진 칸 이름이 `photo`인지 `lib/shows/structured.ts:9`에서 확인하고 맞춘다.

- [ ] **Step 4: seed 검증이 업로드 주소를 받게 고친다**

`lib/shows/seed.ts`의 `publicFileExists` 호출 두 곳(출연진 사진, coverImage/ogImage)을 아래 함수로 바꾼다. 업로드 주소의 소유 검사는 저장 단계(`normalizeDraftInput`)가 이미 했다.

```ts
import { isFundingMediaUrl } from '../funding/mediaPath';
/** 저장소 정적 파일이거나, 주최자 업로드(private Blob, 저장 단계에서 소유를 확인했다) 주소. */
const imageExists = (webPath: string): boolean => isFundingMediaUrl(webPath) || publicFileExists(webPath);
```

- [ ] **Step 5: 실행**

Run: `npx jest lib/shows/organizer/draft.test.ts lib/shows/seed`
Expected: PASS (기존 seed 테스트 포함)

- [ ] **Step 6: Commit**

```bash
git add lib/shows/organizer/draft.ts lib/shows/organizer/draft.test.ts lib/shows/seed.ts
git commit -m "feat(shows): 주최자 초안 형식·검증·ShowDefinition 변환"
```

---

### Task 3: 주최자 저장소 — 만들기·불러오기·저장·제출·철회

**Files:**
- Create: `lib/shows/organizer/submissions.ts`
- Create: `lib/shows/organizer/policy.ts` (약관 판본 상수 — Task 7이 내용을 채운다)
- Test: `lib/shows/organizer/submissions.integration.test.ts`

**Interfaces:**
- Consumes: `nextReviewStatus`, `canCreatorEdit`, `type FundingReviewStatus` (`lib/funding/reviewTransition.ts`), Task 2 함수 전부, `seedShow` (`lib/shows/seed.ts`), `getDb` (`db/client.ts`)
- Produces:
  - `SHOW_ORGANIZER_TERMS_VERSION: string` (`policy.ts`)
  - `createSubmission(creatorId: string): Promise<string>` → 새 id
  - `listSubmissionsForCreator(creatorId: string): Promise<Array<{ id: string; title: string; reviewStatus: FundingReviewStatus; showSlug: string | null; showStatus: string | null; firstShowtime: string | null }>>`
  - `loadSubmissionForCreator(creatorId: string, id: string): Promise<SubmissionView | null>` (`SubmissionView = { id; reviewStatus; reviewNote; draft: ShowSubmissionDraft; showSlug: string | null; submittedAt: Date | null }`)
  - `saveSubmission(creatorId: string, id: string, input: unknown, now: Date): Promise<WriteResult>`
  - `submitSubmission(creatorId: string, id: string, input: { agreedTerms: boolean }, now: Date): Promise<WriteResult>`
  - `withdrawSubmission(creatorId: string, id: string, now: Date): Promise<WriteResult>`
  - `type WriteResult = { ok: true; warnings?: string[] } | { ok: false; status: 400 | 404 | 409; message: string; problems?: string[] }`

동작 규칙(테스트로 고정한다):

| 상태 | save | submit | withdraw |
|---|---|---|---|
| draft · changes_requested | 초안 통째 저장 | `findSubmitProblems`가 비고 `agreedTerms`면 → submitted, 판본·시각 기록, 운영자 메일 | 409 |
| submitted | 409 "심사 중에는 고칠 수 없어요. 철회하면 고칠 수 있어요." | 409 | → draft |
| approved | `mergeApprovedEdit` → `approved_draft_json`은 그대로, `draft_json` 갱신 → `seedShow(apply)`로 공연 갱신 → `organizer_edited_at` 기록 → 운영자 메일 | 409 | 409 |
| rejected | 409 | 409 | 409 |

전이 판정은 `nextReviewStatus`(펀딩과 같은 표)를 쓴다. 조건문을 새로 쓰지 않는다. 남의 제출물은 404다(존재 여부를 알리지 않는다). 승인 뒤 저장에서 `seedShow`가 `ShowSeedError`를 던지면 `draft_json`을 되돌리지 않은 채 남기지 않는다. 먼저 seed를 돌리고 성공했을 때만 행을 갱신한다. 메일 발송 실패는 `warnings`로 돌려주고 저장을 실패시키지 않는다.

- [ ] **Step 1: 통합 테스트 작성** — 위 표의 칸마다 한 케이스 + 다음 케이스:
  - 남의 제출물 `loadSubmissionForCreator` → `null`
  - `submit`에 `agreedTerms: false` → 400
  - 미완성 초안 submit → 400 + `problems` 비어 있지 않음
  - 승인된 제출물(테스트에서 직접 `review_status='approved'`, `approved_draft_json`, `show_id` 세팅 + `seedShow` 선행)에 가격·회차를 바꾼 저장 → `show_ticket_types.price`·`showtimes.starts_at` 불변, `shows.description` 변경, `organizer_edited_at` 채워짐 (Review Focus 2)

메일은 `jest.mock('../../email/send')`(펀딩 통합 테스트들이 쓰는 방식을 `lib/funding/reviewDecision.integration.test.ts`에서 그대로 따른다)로 막는다.

- [ ] **Step 2: 실패 확인** — `npx jest lib/shows/organizer/submissions.integration.test.ts` → FAIL(모듈 없음)

- [ ] **Step 3: 구현** — `lib/funding/creatorProjectWrite.ts`의 guard 구조(소유 확인 → 상태 확인 → 쓰기)를 따른다. 운영자 메일은 Task 8의 `notifyOperatorShowSubmitted(submissionId)`·`notifyOperatorShowEdited(submissionId)`를 부른다. Task 8보다 먼저 구현한다면 같은 이름으로 빈 함수를 만들어 두고 Task 8에서 채운다.

`policy.ts`:

```ts
/** 주최자 약관 판본. 내용을 바꾸면 먼저 올리고 기준선을 다시 쓴다(content/showOrganizerTerms.baseline.test.ts). */
export const SHOW_ORGANIZER_TERMS_VERSION: string = 'show-organizer-terms-2026-10-14';
```

- [ ] **Step 4: 실행** — 같은 명령 → PASS

- [ ] **Step 5: Commit**

```bash
git add lib/shows/organizer/
git commit -m "feat(shows): 주최자 공연 초안 저장·제출·철회, 승인 뒤 수정은 seedShow로 반영"
```

---

### Task 4: 주최자 API + 업로드 + 미디어 공개 판정

**Files:**
- Create: `pages/api/funding/creator/shows.ts` (GET 목록 · POST 새로 만들기)
- Create: `pages/api/funding/creator/shows/[id].ts` (GET · PUT 저장)
- Create: `pages/api/funding/creator/shows/[id]/submit.ts`, `pages/api/funding/creator/shows/[id]/withdraw.ts`
- Create: `pages/api/funding/creator/shows/[id]/upload.ts`
- Create: `lib/funding/uploadBody.ts` (`readBodyWithLimit`을 `pages/api/funding/creator/upload.ts`에서 옮긴다)
- Modify: `pages/api/funding/creator/upload.ts` (옮긴 함수를 import)
- Modify: `lib/funding/mediaAccess.ts` (`isApprovedFundingMedia`에 공연 갈래 추가)
- Test: `lib/funding/mediaAccess.shows.integration.test.ts`, `pages/api/funding/creator/shows.routes.test.ts`

**Interfaces:**
- Consumes: `authenticateCreatorApi`, `isAllowedContactRequestOrigin`, `consumeRateLimit`, Task 3 함수, `processCreatorImage(buf, 'cover' | 'body')`, `buildFundingMediaUrl`
- Produces: HTTP — `GET/POST /api/funding/creator/shows`, `GET/PUT /api/funding/creator/shows/:id`, `POST …/:id/submit` body `{ agreedTerms: boolean }`, `POST …/:id/withdraw`, `POST …/:id/upload?kind=poster|photo` (raw body) → `{ ok: true, url }`

- [ ] **Step 1: 미디어 판정 테스트 작성** (Review Focus 5)

```ts
// 시나리오: 개설자 C가 올린 파일명 `${C}-p.webp`
// 1) 제출물 submitted + show 없음 → isApprovedFundingMedia === false
// 2) 승인 + shows.status='published' + shows.cover_image에 주소 → true
// 3) 승인 + shows.status='draft' → false
// 4) 다른 개설자 D의 승인된 공연 cover_image에 `${C}-p.webp`를 적어 둠 → false (소유 접두사 불일치)
// 5) performers_json의 photo로만 참조 → true
```

- [ ] **Step 2: 실패 확인** — `npx jest lib/funding/mediaAccess.shows.integration.test.ts` → 2·5가 FAIL

- [ ] **Step 3: 공연 갈래 추가** — `isApprovedFundingMedia`의 `or (...)` 목록 끝에 덧붙인다(펀딩 쿼리와 같은 `select 1 … limit 1` 안이 아니라 `union all`로 붙이는 편이 읽기 쉽다):

```sql
select 1 as one from show_submissions ss
join shows s on s.id = ss.show_id
where ss.review_status = 'approved'
  and s.status in ('published', 'cancelled')
  and (instr(coalesce(s.cover_image, ''), ${needle}) > 0 or instr(coalesce(s.performers_json, ''), ${needle}) > 0)
  and substr(${filename}, 1, length(ss.creator_id) + 1) = ss.creator_id || '-'
```

파일 머리 주석에 "공연 갈래: 주최자 공연이 공개된 뒤 포스터·출연진 사진"을 한 줄 더한다. `show_submissions` 표가 없으면 쿼리가 던지고 기존 catch가 `false`를 돌려준다. 이때 펀딩 이미지까지 비공개가 되므로 펀딩 쿼리와 공연 쿼리를 **각각 try로 감싼다**. 하나가 실패해도 다른 하나의 판정은 살아 있어야 한다. 테스트로 고정한다: 표가 없는 DB에서 승인된 펀딩 표지는 true.

- [ ] **Step 4: 라우트 구현** — 펀딩 라우트를 그대로 따른다:
  - 모든 쓰기 라우트: `Cache-Control: no-store` → origin 검사(`isAllowedContactRequestOrigin`) → `authenticateCreatorApi` → 본체.
  - `POST /shows`: rate limit `creator_show_create:${creatorId}` 10/일. 한 개설자의 열린(draft·submitted·changes_requested) 제출물은 5개까지 둔다.
  - `upload.ts`: `pages/api/funding/creator/upload.ts`와 같은 순서(편집 가능 상태 확인 → IP·개설자 rate limit → 장수 상한 → 크기 상한 → `processCreatorImage(body, 'body')` → `put(FUNDING_MEDIA_PREFIX + `${creatorId}-${randomUUID()}.webp`)`). 포스터·사진 모두 `'body'`(비율 유지, 가로 1600 이하)로 처리한다. 장수 상한은 제출물 하나당 `1 + SHOW_DRAFT_LIMITS.performers`. 지금 초안에 실린 업로드 주소 수로 센다.
  - 업로드 파일은 Blob에 남아도 월 1회 청소 크론(`lib/funding/mediaRetention.ts`)이 참조 여부로 지운다. **이 크론이 `show_submissions.draft_json`·`shows.cover_image`·`shows.performers_json`도 참조로 보게 고친다.** 안 고치면 공개된 공연 포스터가 7일 뒤 지워진다. 해당 파일의 참조 수집 함수에 두 출처를 더하고 테스트를 하나 붙인다.

- [ ] **Step 5: 라우트 테스트** — `pages/api/funding/creator/` 아래 기존 라우트 테스트가 있으면 그 하네스를 따른다. 최소: 비로그인 401, 남의 id 404, 잘못된 origin 403.

- [ ] **Step 6: 실행** — `npx jest lib/funding pages/api/funding` → PASS

- [ ] **Step 7: Commit**

```bash
git add pages/api/funding/creator lib/funding/uploadBody.ts lib/funding/mediaAccess.ts lib/funding/mediaAccess.shows.integration.test.ts lib/funding/mediaRetention.ts lib/funding/mediaRetention.test.ts
git commit -m "feat(shows): 주최자 공연 API·업로드, 공개된 공연 이미지 공개 판정·청소 제외"
```

---

### Task 5: 운영자 심사 — 판정 로직 + API

**Files:**
- Create: `lib/shows/organizer/review.ts`
- Create: `pages/api/admin/shows/submissions/[id].ts`
- Modify: `lib/shows/reservedSlugs.ts` (`host`, `organizer-terms` 추가)
- Test: `lib/shows/organizer/review.integration.test.ts`

**Interfaces:**
- Consumes: Task 2·3, `seedShow`, `validateShowSlug`, `nextReviewStatus`, `authenticateAdminApi`, 공연 재검증(`pages/api/admin/shows/[id].ts`의 `revalidateShow`를 `lib/shows/revalidate.ts`로 옮겨 export — 지금 그 파일 안에만 있으면 옮긴다)
- Produces: `decideShowSubmission(id: string, action: 'approve' | 'request_changes' | 'reject', input: { note?: string; slug?: string; expectedSubmittedAt?: string }, now?: Date): Promise<{ ok: true; slug?: string; warnings?: string[] } | { ok: false; code: 'not_found' | 'conflict' | 'invalid_slug' | 'duplicate_slug' | 'incomplete' | 'terms_not_agreed' | 'seed_failed'; message: string }>`

승인 순서(한 묶음, 실패하면 아무것도 바뀌지 않는다):
1. `nextReviewStatus(현재, 'approve')`가 null이면 `conflict`.
2. `expectedSubmittedAt`이 행의 `submitted_at`과 다르면 `conflict`(Review Focus 4 — 문구는 `lib/funding/reviewDecision.ts`의 `STALE_VERSION_MESSAGE`와 같은 뜻).
3. `organizer_terms_version`이 없으면 `terms_not_agreed`.
4. `findSubmitProblems(draft, now)`가 비어 있지 않으면 `incomplete`(그 사이 7일 리드타임이 지났을 수 있다).
5. `validateShowSlug(slug)` 실패 → `invalid_slug`. `shows.slug`에 이미 있으면 `duplicate_slug`.
6. `seedShow(getDb(), buildShowDefinition(draft, slug), { apply: true, now })` — 실패하면 `seed_failed`(메시지에 seed 오류 포함).
7. 만든 `shows.status`를 `published`로 바꾼다(관리자 `set_status`와 같은 조건 — 예정 회차·구역·티켓타입 존재).
8. 제출물: `review_status='approved'`, `show_id`, `approved_draft_json = draft_json`, `approved_at`, `review_note` 비움.
9. 재검증(`/ko/shows`, `/ko/shows/<slug>`, `/en/shows/<slug>`), 주최자 메일. 실패는 `warnings`로 돌려준다.

6~8은 원자적이지 않다(seedShow가 자체 batch를 쓴다). 6이 성공하고 8이 실패하면 고아 draft 공연이 남는다. 그래서 8 실패 시 7을 되돌려(`status='draft'`) 공개되지 않게 하고 `seed_failed`를 돌려준다. 같은 slug로 다시 승인하면 seedShow가 멱등이라 그 공연을 이어받는다. 이 재시도를 테스트로 고정한다.

`request_changes`·`reject`: `note` 필수, `review_note` 기록, 주최자 메일.

- [ ] **Step 1: 테스트 작성** — 위 1~8 각 실패 코드 하나씩 + 정상 승인(공연 생성·published·구역 GA·티켓타입 가격 일치) + 예약어 `host` slug 거부 + 8단계 실패 후 재승인 성공.
- [ ] **Step 2: 실패 확인** — `npx jest lib/shows/organizer/review.integration.test.ts` → FAIL
- [ ] **Step 3: 구현** — 위 순서대로. API 라우트는 `pages/api/admin/funding/projects/[id].ts`의 형태(관리자 인증 → action 분기 → 결과 코드별 HTTP 상태)를 따른다. `set_internal_note` action도 같이 둔다.
- [ ] **Step 4: 실행** → PASS
- [ ] **Step 5: Commit**

```bash
git add lib/shows/organizer/review.ts lib/shows/organizer/review.integration.test.ts pages/api/admin/shows/submissions lib/shows/reservedSlugs.ts lib/shows/revalidate.ts pages/api/admin/shows/[id].ts
git commit -m "feat(shows): 주최자 공연 심사 — 승인하면 seedShow로 만들고 바로 공개"
```

---

### Task 6: 운영자 심사 화면

**Files:**
- Create: `pages/admin/shows/submissions/index.tsx` (목록: 제출 시각·상태·제목·주최자 이메일·첫 회차)
- Create: `pages/admin/shows/submissions/[id].tsx` (상세: 초안 전체 읽기 전용 + 포스터·사진 미리보기 + slug 입력 + 승인/보완 요청/반려 + 내부 메모)
- Modify: `pages/admin/shows/index.tsx` (상단에 "심사 대기 N건" 링크)

**Interfaces:**
- Consumes: `POST /api/admin/shows/submissions/:id` `{ action, note?, slug?, expectedSubmittedAt? }`

- [ ] **Step 1:** `pages/admin/funding/projects/[id].tsx`를 열어 레이아웃·버튼·확인 대화상자 패턴을 그대로 따른다. slug 입력의 기본값은 제목을 로마자로 바꾼 값이 아니라 **빈 칸**이다(운영자가 정한다).
- [ ] **Step 2:** 승인 성공 시 `/ko/shows/<slug>` 링크와 `/admin/shows/<showId>` 링크를 보여 준다. `warnings`가 있으면 `Notice tone="warning"`으로 띄운다.
- [ ] **Step 3:** `npm run type-check && npm run lint`
- [ ] **Step 4:** 로컬 확인 — `VERCEL_ENV=preview npx next start -p 3100`(루트 CLAUDE.md), 관리자로 로그인해 테스트 제출물 하나를 승인 → 공개 상세가 뜨는지 본다.
- [ ] **Step 5: Commit** — `git commit -m "feat(admin): 주최자 공연 심사 화면"`

---

### Task 7: 주최자 약관 페이지 + 판본 게이트 + 처리방침 개정

**Files:**
- Create: `pages/[locale]/shows/organizer-terms.tsx` (`SHOW_ORGANIZER_TERMS_SECTIONS` export, ko 전용 — 다른 로케일은 `/ko/…`로 redirect, `pages/[locale]/funding/creator-terms.tsx`와 같은 형태)
- Create: `content/showOrganizerTermsHash.ts`, `content/showOrganizerTerms.baseline.test.ts`, `content/show-organizer-terms.baseline.json`
- Modify: `data/privacyPolicy.ts` (개설자 13~15항에 공연 주최자 목적 추가), `lib/funding/policy.ts` (`FUNDING_CREATOR_DATA_PROCESSORS` purpose에 "공연 심사 결과" 추가, `FUNDING_TERMS_VERSION`을 `funding-terms-2026-10-14`로)
- Modify: `content/funding-terms.baseline.json` (갱신 명령으로)

- [ ] **Step 1: 약관 조항** — 아래 8개 조항을 `SHOW_ORGANIZER_TERMS_SECTIONS`에 넣는다. 수치는 상수로 보간한다(`FUNDING_PLATFORM_FEE_PERCENT`, `FUNDING_PAYMENT_FEE_PERCENT`, `FUNDING_WITHHOLDING_PERCENT`, `FUNDING_PAYOUT_BUSINESS_DAYS`, `MIN_LEAD_DAYS`).

  1. **판매자와 주최자** — 티켓은 스튜디오 놀이 판매하고 결제를 받는다. 주최자는 공연의 기획·진행과 그 내용에 책임진다.
  2. **심사** — 제출한 공연은 운영자가 심사해 승인·보완 요청·반려한다. 반려 사유를 다 알리지 않을 수 있다. 첫 회차는 제출일로부터 `MIN_LEAD_DAYS`일 뒤여야 한다.
  3. **승인 뒤 잠금** — 승인되면 회차 일시·정원·티켓 종류와 가격·장소·공연 시간·관람 등급은 주최자가 바꿀 수 없다. 바꿔야 하면 운영자에게 요청하고, 그 변경으로 생기는 환불은 제7조를 따른다. 소개·포스터·출연진은 승인 뒤에도 고칠 수 있다.
  4. **권리 보증** — 주최자는 소개·포스터·사진·출연진 정보를 쓸 권리가 있음을 보증하고, 제3자 권리 침해 주장이 생기면 그 책임을 진다.
  5. **금지 내용** — 펀딩 개설자 약관 제5조와 같은 범위(그 조문을 옮겨 온다).
  6. **수수료와 정산** — 티켓 판매액(환불 제외)에서 플랫폼 수수료 `FUNDING_PLATFORM_FEE_PERCENT`%와 결제 수수료 `FUNDING_PAYMENT_FEE_PERCENT`%(모두 부가세 포함)를 뗀다. 개인 자격 정산은 `FUNDING_INDIVIDUAL_PAYOUT_NOTE`와 같은 공제가 붙는다. 정산금은 **마지막 회차가 끝난 날부터 `FUNDING_PAYOUT_BUSINESS_DAYS`영업일 안에** 등록한 계좌로 보낸다.
  7. **취소와 환불** — 관객 환불은 사이트의 공연 환불 규정(`/ko/shows` FAQ의 표)을 따르며 공연마다 다르게 정하지 않는다. **회차가 취소되면 관객에게 전액 환불하고, 그 회차 결제분의 결제 수수료(`FUNDING_PAYMENT_FEE_PERCENT`%)는 취소 사유와 관계없이 주최자가 부담한다.** 이 금액은 정산금에서 빼고, 정산금이 모자라면 주최자에게 청구한다.
  8. **관객 개인정보** — 스튜디오 놀은 관객의 이름·연락처를 주최자에게 제공하지 않는다. 입장 확인은 운영자가 발급하는 입장 확인 링크로 한다.

  문안은 `pages/[locale]/funding/creator-terms.tsx`의 문체(존댓말 조항 + 짧은 문장)를 따른다. 대외 문안이므로 haiku에 맡기지 않는다.

- [ ] **Step 2: 게이트** — `content/creatorTermsHash.ts`와 `content/creatorTerms.baseline.test.ts`를 복제해 이름만 바꾼다(`serializeShowOrganizerTerms`, `SHOW_ORGANIZER_TERMS_VERSION_PATTERN = /^show-organizer-terms-\d{4}-\d{2}-\d{2}(-r([2-9]|[1-9]\d+))?$/`, 환경변수 `UPDATE_SHOW_ORGANIZER_TERMS_BASELINE`). 해시 대상: 조항 전부 + 보간 상수 다섯 개.
  Run: `UPDATE_SHOW_ORGANIZER_TERMS_BASELINE=1 npx jest content/showOrganizerTerms.baseline.test.ts` → 기준선 생성 → 다시 그냥 실행 → PASS

- [ ] **Step 3: 처리방침** — `data/privacyPolicy.ts` ko 13~15항(개설자 계정)의 이용 목적에 "공연 등록 심사·공연 정보 게시·공연 정산"을 더한다. 다른 로케일도 같은 항을 같은 뜻으로 고친다. 그다음 루트 CLAUDE.md "약관·처리방침을 고치면" 절차대로 한다: `FUNDING_TERMS_VERSION`을 `funding-terms-2026-10-14`로 올리고, `UPDATE_FUNDING_TERMS_BASELINE=1 npx jest content/fundingTerms.baseline.test.ts`를 돌린다.

- [ ] **Step 4:** `npx jest content` → PASS

- [ ] **Step 5: Commit** — 메시지에 바뀐 조항을 적는다:

```bash
git commit -m "feat(shows): 공연 주최자 약관(show-organizer-terms-2026-10-14), 처리방침 개설자 항에 공연 목적 추가

처리방침 13~15항 이용 목적에 공연 등록 심사·게시·정산 추가 → FUNDING_TERMS_VERSION funding-terms-2026-10-14"
```

---

### Task 8: 메일 — 주최자 심사 결과, 운영자 새 제출·승인 뒤 수정

**Files:**
- Create: `lib/shows/organizer/email.ts`
- Test: `lib/shows/organizer/email.test.ts`
- Modify: `scripts/preview-emails.ts` (네 종 추가)

**Interfaces:**
- Produces: `sendShowReviewResultEmail(submissionId: string, result: 'approved' | 'changes_requested' | 'rejected'): Promise<void>`, `notifyOperatorShowSubmitted(submissionId: string): Promise<void>`, `notifyOperatorShowEdited(submissionId: string): Promise<void>`

- [ ] **Step 1:** `lib/funding/reviewEmail.ts`의 구조를 따른다. 주최자 메일:
  - 승인: 공개 주소 버튼
  - 보완 요청: `review_note` + 편집 화면 버튼
  - 반려: `review_note`

  운영자 메일은 `audience: 'operator'`이고, rows에 제목·주최·첫 회차·정원·티켓 가격을, 버튼에 `adminUrl('/admin/shows/submissions/<id>')`를 둔다. 사용자 입력은 `escapeHtml`로 감싼다.
- [ ] **Step 2: 테스트** — 렌더된 HTML에 제목이 escape돼 들어가는지(`<script>` 제목), 운영자 메일에 딥링크가 있는지.
- [ ] **Step 3:** `npx tsx scripts/preview-emails.ts`로 렌더해 브라우저로 눈으로 본다.
- [ ] **Step 4: Commit** — `git commit -m "feat(shows): 주최자 공연 심사·제출 알림 메일"`

---

### Task 9: 주최자 화면 — 대시보드 목록 + 편집기

**Files:**
- Modify: `pages/[locale]/funding/creator/index.tsx` ("내 공연" 절 + "공연 등록하기" 버튼)
- Create: `pages/[locale]/funding/creator/shows/[id].tsx` (편집기)
- Create: `components/shows/organizer/ShowDraftForm.tsx`, `components/shows/organizer/api.ts`
- Modify: `components/ui/SectionHeading.test.tsx`의 `V2_FILES` (새 공연 컴포넌트 추가 — `lib/shows/CLAUDE.md`)

**Interfaces:**
- Consumes: Task 4 HTTP API, `ImageUploadField` (`components/funding/creator/ImageUploadField.tsx` — 업로드 URL을 prop으로 받게 되어 있지 않으면 `uploadUrl` prop을 더한다)

- [ ] **Step 1: 대시보드** — 펀딩 목록 아래 같은 모양으로 "내 공연" 목록을 둔다. 각 줄에는 제목, 상태 배지(`REVIEW_STATUS_LABEL` 재사용), 첫 회차를 보이고, 승인된 것은 공개 주소 링크를 단다. 이 페이지 머리의 설명 문구는 "펀딩"만 말하고 있으면 "펀딩·공연"으로 고친다.
- [ ] **Step 2: 편집기** — 한 페이지 네 절이다. 각 절은 `SectionHeading` v2 문법을 따른다.
  1. 공연 정보: 제목, 부제, 주최 이름, 포스터, 소개(textarea, "빈 줄로 문단을 나눠요" 안내), 관람 등급, 공연 시간
  2. 장소: 이름, 주소
  3. 회차·티켓
     - 회차: `datetime-local` 여러 개, 추가/삭제
     - 정원: 숫자
     - 티켓 종류 1~3개: 이름·가격
     - 안내 한 줄: "환불 규정은 모든 공연이 같아요" + 표 링크
  4. 출연진: 이름, 소개, 사진. 추가/삭제/순서 변경

  저장 버튼은 하나("임시 저장")다. 제출은 맨 아래 하나다. 문구: "제출하면 [주최자 약관](/ko/shows/organizer-terms)에 동의하는 것으로 봐요" + 체크박스(펀딩 개설자 제출과 같은 방식인지 `pages/[locale]/funding/creator/[id].tsx`의 제출부를 열어 확인하고 같게 한다).
  - 제출 응답에 `problems`가 오면 `Notice tone="warning"`으로 목록을 보여 준다.
  - 승인된 공연은 잠긴 칸을 `disabled`로 바꾸고 "판매 조건은 운영자에게 요청해 주세요" 한 줄을 단다.
  - `review_note`가 있으면 맨 위 `Notice`로 보인다.
- [ ] **Step 3:** `npm run type-check && npm run lint && npx jest tests/pages components` → PASS(pageScaffold·uiPatterns 기준선 포함)
- [ ] **Step 4: 화면 확인** — 로컬 프로덕션 빌드로 띄워 실제로 개설자 로그인 → 등록 → 포스터 업로드 → 제출까지 눌러 본다. 모바일 폭(390px) 스크린샷을 한 장 찍는다.
- [ ] **Step 5: Commit** — `git commit -m "feat(shows): 주최자 공연 등록·편집 화면"`

---

### Task 10: 공개 안내 페이지 `/ko/shows/host` + 진입 링크 + 사이트맵

**Files:**
- Create: `pages/[locale]/shows/host.tsx` (ko 전용, 다른 로케일은 `/ko/shows/host`로 redirect)
- Modify: `pages/[locale]/shows/index.tsx` (목록 아래 "공연을 올리고 싶다면" 한 줄 링크)
- Modify: `lib/sitemap/routes.js` (`pageRouteMap`에 등록), `lib/sitemap/pageLastmod.json` (`npm run generate:page-lastmod` 후 **이 라우트만** 남기고 나머지 변경은 되돌린다 — 루트 CLAUDE.md lastmod 절)

- [ ] **Step 1: 페이지 내용** — 히어로 없이 `PageHeader` 다음에 네 블록을 둔다.
  - ① 어떤 공연을 받는지: 소규모 공연, 자유석, 티켓 1~3종
  - ② 진행 순서: 이메일로 시작 → 등록·제출 → 심사 → 공개 → 공연 → 정산
  - ③ 수수료와 정산: 상수 보간, `FUNDING_INDIVIDUAL_PAYOUT_NOTE`
  - ④ 이메일 입력 폼: `/ko/funding/apply`의 폼 컴포넌트를 그대로 쓰고, 로그인 메일은 같은 API로 보낸다

  약관 링크를 단다. 문구에 없는 서비스(홍보 대행 등)를 약속하지 않는다.
- [ ] **Step 2:** `npm run generate:page-lastmod` → `git diff lib/sitemap/pageLastmod.json` → host 줄만 남긴다. `npx jest lib/sitemap` → PASS
- [ ] **Step 3:** `npm run build && npm run check:display-font` → PASS (새 제목 글자가 제목 서체 서브셋에 있는지)
- [ ] **Step 4: Commit** — `git commit -m "feat(shows): 공연 등록 안내 페이지 /ko/shows/host"`

---

### Task 11: 업로드 이미지로 공개된 공연의 화면 검증

공연 화면은 지금까지 저장소 정적 이미지(`/images/shows/…`)만 써 왔다. 업로드 주소(`/api/funding/media/…?w=&h=`)로 바꿨을 때 깨지는 자리를 찾는다.

- [ ] **Step 1:** 로컬 DB(또는 `page.route` 주입)에 승인된 주최자 공연 하나를 만들어 `/ko/shows`(목록 카드), `/ko/shows/<slug>`(히어로 배경, `ShowPoster`, 출연진 사진, 모바일 하단 CTA)를 연다.
- [ ] **Step 2:** 각 자리에서 다음을 확인한다.
  - 이미지가 200으로 오는지
  - `next/image` 최적화 경로(`/_next/image?url=/api/funding/media/…`)를 탈 때 쿼리 붙은 로컬 경로가 거부되지 않는지
  - `ResponsiveImage`를 안 쓰는 자리(`ImageHero`·`ShowPoster`)가 `isFundingMediaUrl`로 `unoptimized`를 거는지

  깨지면 그 컴포넌트에서 `isFundingMediaUrl` 분기를 `ResponsiveImage`와 같게 넣는다.
- [ ] **Step 3:** OG: `<meta property="og:image">`가 절대 주소(`https://studionol.co.kr/api/funding/media/…`)로 나가는지 본다. 세로 포스터가 그대로 OG가 되는 것은 기존 폴백 동작이라 그대로 둔다.
- [ ] **Step 4:** 제목 서체: 목록 카드·히어로 제목에 서브셋에 없는 글자를 넣은 공연으로 `fitsDisplayFont` 폴백이 걸리는지 본다. 카드가 폴백을 안 쓰면 `ShowDetailView.tsx:61`과 같은 방식으로 넣는다.
- [ ] **Step 5:** 고친 것이 있으면 테스트 하나씩 붙여 커밋한다 — `git commit -m "fix(shows): 업로드 이미지 공연의 …"`

---

### Task 12: 문서 · 배포 순서

**Files:**
- Modify: `lib/shows/CLAUDE.md` (새 절 "주최자 자가등록")
- Modify: 루트 `CLAUDE.md` (마이그레이션 0053 배포 전 적용 한 줄 — 공연 결제와 무관하므로 "주최자 화면만 실패"라고 적는다)

- [ ] **Step 1:** `lib/shows/CLAUDE.md`에 다음을 적는다.
  - 초안은 `draft.ts`가 주인이다.
  - 승인은 seedShow + publish이고, 승인 뒤 수정도 seedShow다.
  - 잠긴 칸 목록
  - 미디어 공개 판정·청소 크론의 공연 갈래
  - 주최자 공연은 `data/shows/`에 파일이 **없다** — 시드 스크립트를 그 slug로 돌리지 말 것
  - 약관 게이트 갱신 명령
- [ ] **Step 2:** 전체 검증 — `npm run type-check && npm run lint && npx jest && npm run build`
- [ ] **Step 3: Commit + PR** — 브랜치 `feat/show-organizer`, `gh pr create`, 본문에 배포 순서를 적는다:
  1. 운영 DB에 0053 적용(루트 CLAUDE.md 절차, main 병합본에서)
  2. 머지
  3. 배포 뒤 확인:
     - 테스트 개설자 계정으로 제출 → 승인 → `/ko/shows/<slug>` 200 → 포스터 무인증 200
     - 심사 중 포스터 무인증 404
     - 확인 뒤 테스트 공연을 `draft`로 내리고 제출물을 반려 처리

---

## 2·3단계 메모 (이번 계획 밖, 결정 기록용)

- **2단계 — 주최자 대시보드**
  - 판매 현황: 기존 `lib/shows/report.ts` 집계를 주최자 세션으로 노출
  - 공연 당일 스캔 링크 직접 발급: `issueScanLink`를 주최자 소유 확인 뒤 호출
  - 초대권: `compQuota` 설정 + `issueCompTickets`
- **3단계 — 정산**
  - `show_payouts` 표, `computeFundingPayout`과 같은 축(부가세 상당액 차감 포함)
  - 기준일은 마지막 회차 종료일, 14영업일
  - 회차 취소분 결제 수수료는 주최자 부담 공제 항목으로 넣는다(약관 제7조)
