# 펀딩 셀프 개설 3차 — 관리자 심사와 첫 공개

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 운영자가 제출된 프로젝트를 심사해 승인·보완 요청·반려하고, 승인된 프로젝트가 공개 화면에 나타나는 데까지. **이 계획이 끝나면 처음으로 DB 프로젝트가 공개된다** — 지금까지 두 계획은 공개 화면을 한 글자도 바꾸지 않았지만 이번은 다르다.

**Architecture:** 판정은 `lib/funding/reviewTransition.ts`의 전이표 하나를 개설자 API와 공유한다. 승인은 한 번의 트랜잭션에서 slug를 확정하고 리워드에 `lockedAt`을 찍고 `status`를 연다 — **셋 중 하나라도 빠지면 잠금이 없는 것과 같다.** 상태 변경은 전부 `WHERE reviewStatus = <읽은 값>` 조건부 UPDATE로 경합을 막는다(이 저장소의 기존 낙관적 잠금 패턴).

**Tech Stack:** Next.js 15 Pages Router, React 19, Turso(libSQL) + Drizzle, iron-session 관리자 세션, Resend, Jest(단위 + in-memory libSQL 통합).

**Spec:** `docs/superpowers/specs/2026-09-17-funding-self-serve-design.md` (§6.4 편집 권한, §7 운영자 흐름, §9 약관·법무)

## Global Constraints

- 작업 위치: worktree `/Users/hwang-gyeongha/studio-worktrees/funding-review`, 브랜치 `feat/funding-admin-review`. 공용 트리 `~/studio`와 다른 worktree는 건드리지 않는다.
- 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`. 한국어. `git commit -a` 금지.
- **프로덕션 DB를 건드리는 태스크는 없다.** 이 계획은 새 테이블을 만들지 않는다.
- **판정 로직을 새로 적지 않는다.** `nextReviewStatus`가 정본이고, 표에 없는 조합은 null이며 호출부가 409로 답한다. 조건문을 새로 쓰면 "승인은 끝"이라는 규칙이 두 쪽으로 갈린다.
- 상태를 바꾸는 모든 UPDATE는 `WHERE`에 읽은 시점의 `reviewStatus`를 함께 건다. 영향 행이 0이면 409. `pages/api/admin/funding/pledges/[id].ts`의 `rowsAffected` 패턴을 그대로 따른다.
- 관리자 API는 `authenticateAdminApi`, 관리자 페이지는 `authenticateAdminRequest`(실패 시 `/admin/login`). 메서드는 기존 관리자 API 관례대로 `PATCH`(단일 엔드포인트 + `action` 분기).
- **검증 순서(매 태스크)**: `npm run generate:manifests` → `npm run type-check` → `npm run lint` → **`npm test` 전체** → **`components/`나 `pages/`를 건드렸으면 `env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN npm run build`까지.**
  - 2차에서 타입 검사·테스트를 다 통과하고 **빌드만 잡아낸 파손**이 있었다. 클라이언트 번들 경계는 빌드로만 보인다.
- 통합 테스트는 `/** @jest-environment node */` + in-memory libSQL + `drizzle/migrations` 순차 적용. `lib/funding/creatorProjectWrite.integration.test.ts`의 부트스트랩을 베낀다.
- jest.mock 팩토리가 참조하는 변수는 이름이 `mock`으로 시작해야 한다.
- 관리자 화면은 `light` 강제다. `components/ui/Field.tsx`의 컨트롤에 `light`와 `lightOnlyField`(`components/ui/adminFieldClass.ts`)를 함께 쓴다.

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `lib/funding/adminProjects.ts` (생성) | 관리자 시점 조회 — 상태 무관, 소유 조건 없음. 지금 저장소에 이런 함수가 **없다** |
| `lib/funding/reviewDecision.ts` (생성) | 판정 실행. 승인 트랜잭션(slug 확정 · `lockedAt` · `status`)이 여기 산다 |
| `lib/funding/reviewEmail.ts` (생성) | 판정 알림 메일(승인·보완 요청·반려) |
| `lib/funding/revalidate.ts` (생성) | 온디맨드 재검증 — 목록과 상세 **둘 다** |
| `pages/api/admin/funding/projects/[id].ts` (생성) | PATCH 판정·메모 |
| `pages/admin/funding/projects/index.tsx` (생성) | 심사 목록 |
| `pages/admin/funding/projects/[id].tsx` (생성) | 심사 상세·판정 |
| `components/admin/fundingProjectActions.ts` (생성) | fetch 래퍼 |
| `pages/[locale]/funding/creator-terms.tsx` (생성) | 개설자 약관 본문 |
| `content/creatorTermsHash.ts` · `content/creatorTerms.baseline.test.ts` (생성) | 개설자 약관 판본 게이트 |
| `lib/funding/policy.ts` (수정) | `FUNDING_CREATOR_TERMS_VERSION` 실제 값, `FUNDING_TERMS_VERSION` 인상 |
| `pages/[locale]/funding/terms.tsx` (수정) | 후원자 약관 개정 — 제3자 개설자 구조 |
| `lib/funding/shape.ts` · `dbProjects.ts` · `ProjectDetailView.tsx` (수정) | 공개 상세의 개설자 표시 |
| `lib/ops/adminDashboard.ts` · `pages/admin/index.tsx` (수정) | 심사 대기 대기열 |
| `lib/funding/email.ts` (수정) | 제출 알림 링크를 새 심사 화면으로 |

---

## Task 1: 관리자 시점 조회

지금 저장소에 **상태 무관·소유 조건 없는 프로젝트 조회가 없다.** `loadProjectForCreator`는 `creatorId`로 스코프가 고정돼 있고, `getDbFundingProject`는 `approved`만 본다.

**Files:**
- Create: `lib/funding/adminProjects.ts`
- Create: `lib/funding/adminProjects.integration.test.ts`

**Interfaces:**
- Consumes: `db/schema.ts`의 `fundingProjects`·`fundingRewards`·`fundingCreators`
- Produces:
  - `listProjectsForAdmin(filter?: { reviewStatus?: FundingReviewStatus }): Promise<AdminProjectSummary[]>`
  - `loadProjectForAdmin(projectId: string): Promise<AdminProjectDetail | null>`
  - 타입 `AdminProjectSummary`·`AdminProjectDetail`

- [ ] **Step 1: 실패하는 통합 테스트를 쓴다**

`lib/funding/adminProjects.integration.test.ts`. 부트스트랩은 `lib/funding/creatorProjectWrite.integration.test.ts`에서 베낀다.

```ts
describe('listProjectsForAdmin', () => {
  it('상태와 무관하게 전부 돌려주고 제출 시각 내림차순으로 정렬한다', async () => {
    // draft·submitted·approved·rejected를 하나씩 심고, 넷 다 나오는지.
    // 정렬은 submittedAt 내림차순, null(미제출)은 뒤로.
  });

  it('reviewStatus로 거를 수 있다', async () => {
    // filter { reviewStatus: 'submitted' }면 그것만.
  });

  it('개설자 이름과 연락처를 함께 싣는다', async () => {
    // 목록에서 운영자가 누가 냈는지 알아야 한다.
  });

  it('비공개 정산 필드는 싣지 않는다', async () => {
    // taxType·payoutBankName·payoutAccount·payoutHolder가 요약에 없어야 한다.
    // 목록 화면 props로 나가는 값이라 화이트리스트로 단언한다.
  });
});

describe('loadProjectForAdmin', () => {
  it('어떤 상태의 프로젝트든 id로 읽는다', async () => {
    // submitted·draft 둘 다.
  });

  it('리워드를 sortOrder 순으로 싣는다', async () => {});

  it('리워드의 lockedAt을 그대로 싣는다', async () => {
    // 심사 화면이 "이미 잠긴 리워드"를 구분해 보여줘야 한다.
  });

  it('없는 id는 null', async () => {});
});
```

빈 `it` 블록을 **전부 실제 단언으로 채운다.** 주석은 무엇을 단언할지 말할 뿐이다.

- [ ] **Step 2: 실패를 확인한다**

```bash
npx jest lib/funding/adminProjects.integration.test.ts
```

Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현한다**

```ts
import { desc, eq, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingCreators, fundingProjects, fundingRewards, type FundingRewardRow } from '../../db/schema';
import type { FundingReviewStatus } from './reviewTransition';

/**
 * 관리자 시점 조회.
 *
 * 개설자 쪽(`creatorProjectWrite.ts`)은 모든 함수가 `creatorId`를 요구하고 남의 것은
 * `not_found`로 답한다 — 그 파일에 소유 조건 없는 함수를 두면 언젠가 조건 없이 호출되기
 * 때문이다. 관리자는 정반대로 전부 볼 수 있어야 하므로 **파일을 나눈다.** 여기 있는 함수는
 * 반드시 `authenticateAdminApi`/`authenticateAdminRequest` 뒤에서만 부른다.
 */
export interface AdminProjectSummary {
  id: string; slug: string; title: string; reviewStatus: FundingReviewStatus;
  status: string; hidden: boolean;
  submittedAt: string | null; approvedAt: string | null;
  creatorName: string; creatorEmail: string;
  goalAmount: number; startAt: string; endAt: string;
}
```

`AdminProjectDetail`은 `AdminProjectSummary`에 `summary`·`content`·`coverUrl`·`reviewNote`·개설자 연락처(`contactName`·`phone`·`bio`·`links`)·`rewards: FundingRewardRow[]`를 더한다.

**정산 필드(`taxType`·`payoutBankName`·`payoutAccount`·`payoutHolder`)는 어느 쪽에도 담지 않는다.** 심사 화면이 쓰지 않고, 담으면 `__NEXT_DATA__`로 페이지 소스에 실린다. 정산 화면은 4차다.

- [ ] **Step 4: 확인하고 커밋한다**

```bash
npx jest lib/funding/adminProjects.integration.test.ts && npm test
git add lib/funding/adminProjects.ts lib/funding/adminProjects.integration.test.ts
git commit -m "$(cat <<'EOF'
feat(funding): 관리자 시점 프로젝트 조회 — 상태 무관, 소유 조건 없음

개설자 쪽은 모든 함수가 creatorId를 요구하고 남의 것은 not_found로 답한다. 그 파일에 소유
조건 없는 함수를 두면 언젠가 조건 없이 호출되므로 파일을 나눈다.

정산 필드는 담지 않는다 — 심사 화면이 쓰지 않고, 담으면 페이지 소스에 실린다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 온디맨드 재검증

**Files:**
- Create: `lib/funding/revalidate.ts`
- Create: `lib/funding/revalidate.test.ts`

**Interfaces:**
- Produces: `revalidateFundingPaths(res: Pick<NextApiResponse, 'revalidate'>, slug: string): Promise<string | null>`

- [ ] **Step 1: 왜 필요한지**

지금 공개 화면은 60초 ISR로만 갱신된다. 승인 직후 운영자가 확인하러 들어가면 옛 화면이 보이고, 개설자에게 "공개됐습니다" 메일을 보내 놓고 60초간 404가 나올 수 있다(상세의 `notFound`도 `revalidate: 60`으로 캐시된다).

이 저장소에 `res.revalidate()`를 쓰는 곳이 **하나도 없다.** 이번이 처음이다.

- [ ] **Step 2: 실패하는 테스트를 쓴다**

```ts
import { revalidateFundingPaths } from './revalidate';

describe('revalidateFundingPaths', () => {
  it('목록과 상세 둘 다 재검증한다', async () => {
    const revalidate = jest.fn().mockResolvedValue(undefined);
    await revalidateFundingPaths({ revalidate }, 'my-album');
    expect(revalidate).toHaveBeenCalledWith('/ko/funding');
    expect(revalidate).toHaveBeenCalledWith('/ko/funding/my-album');
    expect(revalidate).toHaveBeenCalledTimes(2);
  });

  it('하나가 실패해도 나머지를 시도하고 사유를 돌려준다', async () => {
    const revalidate = jest.fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined);
    const reason = await revalidateFundingPaths({ revalidate }, 'my-album');
    expect(revalidate).toHaveBeenCalledTimes(2);
    expect(reason).toMatch(/\/ko\/funding/);
  });

  it('전부 성공하면 null', async () => {
    const revalidate = jest.fn().mockResolvedValue(undefined);
    expect(await revalidateFundingPaths({ revalidate }, 'my-album')).toBeNull();
  });
});
```

- [ ] **Step 3: 구현한다**

```ts
import type { NextApiResponse } from 'next';

/**
 * 승인·공개 상태 변경 뒤 공개 경로를 즉시 다시 만든다.
 *
 * **목록과 상세 둘 다 해야 한다.** 상세만 하면 `/ko/funding` 카드가 최대 60초 동안 옛 목록을
 * 보여 주고, 목록만 하면 상세가 404로 남는다(상세의 `notFound`도 `revalidate: 60`으로
 * 캐시되기 때문이다).
 *
 * **실패를 삼킨다.** 재검증이 안 되면 60초 뒤 ISR이 따라잡는다 — 그 때문에 판정 자체를
 * 실패시키면 운영자가 같은 버튼을 다시 눌러야 하고, 그 사이 상태는 이미 바뀌어 있어
 * 두 번째 클릭은 409가 난다. 사유는 돌려주고 호출부가 화면에 알린다.
 */
export const revalidateFundingPaths = async (
  res: Pick<NextApiResponse, 'revalidate'>,
  slug: string,
): Promise<string | null> => {
  const paths = ['/ko/funding', `/ko/funding/${slug}`];
  const failed: string[] = [];
  for (const path of paths) {
    try {
      await res.revalidate(path);
    } catch (error: unknown) {
      console.error(`[funding] 재검증 실패 — ${path}:`, error);
      failed.push(path);
    }
  }
  return failed.length === 0 ? null : `재검증 실패: ${failed.join(', ')}`;
};
```

- [ ] **Step 4: 확인하고 커밋한다**

---

## Task 3: 판정 실행과 승인 트랜잭션

**이 계획에서 가장 중요한 태스크다.** 승인이 `lockedAt`을 안 찍으면 2차에서 만든 리워드 잠금 가드가 **전부** 무효다.

**Files:**
- Create: `lib/funding/reviewDecision.ts`
- Create: `lib/funding/reviewDecision.integration.test.ts`

**Interfaces:**
- Consumes: Task 1의 `loadProjectForAdmin`, `lib/funding/reviewTransition.ts`의 `nextReviewStatus`, `lib/funding/reservedSlugs.ts`의 `slugRejectionReason`, `lib/funding/projects.ts`의 `getFundingProject`
- Produces:
  - `type DecisionResult = { ok: true; slug: string } | { ok: false; code: 'not_found' | 'conflict' | 'invalid_slug' | 'duplicate_slug' | 'incomplete'; message: string }`
  - `decideProject(projectId: string, action: AdminReviewAction, input: { note?: string; slug?: string }, now?: Date): Promise<DecisionResult>`
  - `type AdminReviewAction = 'approve' | 'request_changes' | 'reject'` — **Task 11이 여기에 `'archive'`를 더한다.** 그때 `reviewTransition.ts`의 표도 함께 늘어나므로 이 태스크의 전수 조합 테스트가 그 시점에 바뀐다

- [ ] **Step 1: 실패하는 통합 테스트를 쓴다**

핵심 케이스. 빈 블록을 전부 채운다.

```ts
describe('승인', () => {
  it('리워드 전부에 lockedAt을 찍는다', async () => {
    // 승인 후 모든 리워드 행의 lockedAt이 non-null인지 재조회로 확인.
    // 이 단언이 이 계획 전체에서 가장 중요하다 — 2차의 잠금 가드가 전부 이 값에 달려 있다.
  });

  it('status를 auto로 연다', async () => {
    // 승인 전에는 draft다(공개 경로가 status !== 'draft'를 요구한다).
  });

  it('approvedAt과 reviewStatus를 함께 기록한다', async () => {});

  it('이미 잠긴 리워드의 lockedAt을 덮어쓰지 않는다', async () => {
    // 재승인 같은 경로가 생겨도 최초 잠금 시각이 남아야 한다.
  });

  it('slug를 바꿔 승인할 수 있다', async () => {
    // 운영자가 개설자가 고른 주소를 다듬는 경로. 바꾼 값이 저장되고 DecisionResult가 그것을 돌려준다.
  });

  it('예약 slug로는 승인되지 않는다', async () => {
    // code: 'invalid_slug', 그리고 DB가 안 바뀐다.
  });

  it('마크다운 파일과 겹치는 slug로는 승인되지 않는다', async () => {
    // 파일이 이기므로 그 slug로 승인되면 이 프로젝트는 어떤 주소로도 안 열린다.
  });

  it('다른 DB 프로젝트와 겹치는 slug로는 승인되지 않는다', async () => {});

  it('필수값이 빈 프로젝트는 승인되지 않는다', async () => {
    // code: 'incomplete'. 제출 API가 이미 보지만, 제출과 승인 사이에 무엇이 바뀌었을 수 있다.
  });
});

describe('보완 요청·반려', () => {
  it('메모 없이는 보완 요청을 할 수 없다', async () => {
    // 개설자가 무엇을 고쳐야 하는지 모른다.
  });
  it('보완 요청은 changes_requested로 보내고 메모를 남긴다', async () => {});
  it('반려는 rejected로 보내고 rejectedAt을 남긴다', async () => {});
  it('반려된 프로젝트는 status가 draft로 남는다', async () => {});
});

describe('경합과 전이', () => {
  it('submitted가 아닌 프로젝트는 판정할 수 없다', async () => {
    // draft·approved·rejected 전부 code: 'conflict'.
  });

  it('읽은 뒤 상태가 바뀌면 409다', async () => {
    // loadProjectForAdmin을 mock으로 낡은 값으로 돌리고 실제 행은 approved로 바꾼 뒤,
    // conflict이면서 행이 그대로인지 재조회로 확인.
  });

  it('승인 실패 시 lockedAt이 하나도 안 찍힌다', async () => {
    // slug 충돌로 실패한 뒤 리워드의 lockedAt이 전부 null인지.
    // 부분 적용이 가장 위험하다 — 잠겼는데 공개는 안 된 상태.
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

- [ ] **Step 3: 구현한다**

승인 경로의 뼈대다.

```ts
/**
 * 판정.
 *
 * 전이 판정은 `nextReviewStatus`가 정본이다 — 여기서 조건문을 새로 쓰면 개설자 API와
 * 표가 갈라지고, 그 틈으로 승인된 프로젝트가 되돌아가는 경로가 생긴다.
 *
 * **승인은 세 가지를 한 묶음으로 한다: slug 확정 · 리워드 `lockedAt` · `status` 열기.**
 * 하나라도 빠지면 조용히 잘못된다 — `lockedAt`이 없으면 2차에서 만든 잠금 가드가 전부
 * 무효이고(승인된 리워드의 금액을 바꿀 수 있다), `status`가 안 열리면 승인했는데 공개가
 * 안 되고, slug가 확정 안 되면 주소가 개설자 입력 그대로 남는다.
 */
export const decideProject = async (...) => {
  const project = await loadProjectForAdmin(projectId);
  if (!project) return deny('not_found', '프로젝트를 찾을 수 없습니다.');

  const next = nextReviewStatus(project.reviewStatus, action);
  if (!next) return deny('conflict', '지금 상태에서는 그 판정을 할 수 없습니다.');
  ...
};
```

**승인의 슬러그 확정**: `input.slug`가 있으면 그것을, 없으면 기존 `project.slug`를 쓴다. 어느 쪽이든 `slugRejectionReason` → 마크다운 파일 충돌(`getFundingProject`) → 다른 DB 행 충돌 순으로 검사한다.

**필수값 검사**: `title`·`summary`·`coverUrl`이 있고 본문이 비어 있지 않고 리워드가 1개 이상. 제출 API의 같은 검사를 재사용할 수 있으면 그렇게 하고, 아니면 그 함수를 공용 모듈로 뽑아 **두 곳이 같은 함수를 쓰게** 한다.

**쓰기는 한 묶음으로**: `db.batch([...])`로 프로젝트 UPDATE와 리워드 UPDATE를 함께 보낸다. 프로젝트 UPDATE의 `WHERE`에 `reviewStatus = project.reviewStatus`를 걸고, 영향 행이 0이면 `conflict`. 리워드 UPDATE는 `lockedAt IS NULL`인 행만 찍는다.

⚠️ `db.batch`는 실패 시 전부 롤백되지만, **프로젝트 UPDATE가 0행이어도 리워드 UPDATE는 성공한다**(둘 다 유효한 SQL이다). 그래서 경합으로 프로젝트가 안 바뀌었는데 리워드만 잠기는 일이 생길 수 있다. 막는 방법은 리워드 UPDATE의 `WHERE`에도 프로젝트 상태를 거는 것이다:

```sql
UPDATE funding_rewards SET locked_at = ?
WHERE project_id = ? AND locked_at IS NULL
  AND EXISTS (SELECT 1 FROM funding_projects p WHERE p.id = funding_rewards.project_id AND p.review_status = 'approved')
```

프로젝트를 먼저 승인으로 옮긴 뒤 이 문장을 보내면, 프로젝트가 안 바뀐 경우 `EXISTS`가 거짓이라 리워드도 안 잠긴다. 그 순서를 주석으로 남긴다.

- [ ] **Step 4: 확인하고 커밋한다**

---

## Task 4: 판정 알림 메일

**Files:**
- Create: `lib/funding/reviewEmail.ts`
- Create: `lib/funding/reviewEmail.test.ts`
- Modify: `lib/funding/email.ts`

**Interfaces:**
- Consumes: `lib/funding/email.ts`의 `send` 헬퍼 패턴, `CUSTOMER_REPLY_TO`
- Produces: `sendReviewDecisionEmail(project, action, note, slug): Promise<string | null>`

- [ ] **Step 1: 무엇을 보내는가**

수신자는 **개설자**다(`fundingCreators.email`). 세 가지 제목:

| 판정 | 제목 | 본문의 핵심 |
|---|---|---|
| 승인 | `[스튜디오 놀] 펀딩 프로젝트가 승인되었습니다 — {제목}` | 공개 주소, 시작일, 그리고 **승인 뒤 바꿀 수 없는 것**(리워드 주소·금액·수량 제한·배송 여부) |
| 보완 요청 | `[스튜디오 놀] 펀딩 프로젝트 보완 요청 — {제목}` | 운영자 메모 전문, 편집 화면 링크 |
| 반려 | `[스튜디오 놀] 펀딩 프로젝트 심사 결과 — {제목}` | 운영자 메모 전문, 문의 경로 |

- **메일 실패는 판정을 실패시키지 않는다.** 사유를 돌려주고 화면이 알린다.
- 승인 메일에 잠금 사실을 적는 이유: 개설자가 그 뒤에 금액을 고치려다 409를 받으면 이유를 모른다. 미리 알려 주면 승인 전에 확인한다.
- 링크는 `/ko/funding/creator/{id}`(편집)와 `/ko/funding/{slug}`(공개). 승인 전 프로젝트의 공개 주소는 아직 안 열리므로 **승인 메일에만** 공개 주소를 넣는다.

- [ ] **Step 2: 제출 알림 링크를 고친다**

`lib/funding/email.ts`의 `sendFundingCreatorSubmissionEmail`이 `/admin/funding`(후원 건 목록)을 가리킨다. 주석에 "심사 화면이 생기면 그때 바꾼다"고 적혀 있다. 이제 생기므로 `/admin/funding/projects/{id}`로 바꾸고 그 주석을 지운다.

- [ ] **Step 3: 테스트·확인·커밋**

메일 본문에 운영자 메모가 **그대로** 들어가는지, 승인 메일에 잠금 안내가 있는지, 세 제목이 형식을 지키는지 단언한다.

---

## Task 5: 판정 API

**Files:**
- Create: `pages/api/admin/funding/projects/[id].ts`
- Create: `tests/api/admin/funding/projects.test.ts`

**Interfaces:**
- Consumes: Task 1·2·3·4 전부, `authenticateAdminApi`
- Produces: 없음(HTTP 경계)

- [ ] **Step 1: 규약**

`pages/api/admin/funding/pledges/[id].ts`를 열어 순서를 확인하고 그대로 따른다.

1. `res.setHeader('Cache-Control', 'no-store')`
2. `authenticateAdminApi` 실패 → 401
3. `req.method !== 'PATCH'` → 405
4. `switch (body.action)`: `approve` · `request_changes` · `reject` · `set_note` · default 400
5. `decideProject` 호출 → `DecisionResult.code`를 상태로: `not_found`→404, `conflict`→409, `invalid_slug`·`duplicate_slug`·`incomplete`→400
6. **승인 성공이면** `revalidateFundingPaths(res, result.slug)` → 실패해도 200이되 응답에 경고를 싣는다
7. 판정 성공이면 알림 메일 → 실패해도 200이되 경고를 싣는다

응답은 `{ ok: true, warnings?: string[] }`. 경고가 있으면 화면이 그대로 보여 준다 — 재검증이나 메일이 실패했는데 조용히 성공으로 보이면 운영자가 개설자에게 연락했다고 착각한다.

`set_note`는 판정 없이 메모만 저장한다(심사 중 메모).

- [ ] **Step 2: 테스트**

- 인증 없음 → 401, 메서드 → 405, 모르는 action → 400
- 남의… 는 없다(관리자는 전부 본다). 대신 **없는 id → 404**
- `submitted`가 아닌 프로젝트 판정 → 409이고 DB 불변(재조회)
- 승인 성공 → 200, `reviewStatus`·`status`·`approvedAt`·리워드 `lockedAt` 전부 확인
- **재검증이 실패해도 200이고 `warnings`에 사유가 있다**
- **메일이 실패해도 200이고 `warnings`에 사유가 있다**
- `Cache-Control: no-store`

- [ ] **Step 3: 확인하고 커밋한다**

---

## Task 6: 심사 화면

**Files:**
- Create: `components/admin/fundingProjectActions.ts`
- Create: `pages/admin/funding/projects/index.tsx`
- Create: `pages/admin/funding/projects/[id].tsx`
- Modify: `pages/admin/funding/index.tsx`
- Create: `tests/pages/admin/fundingProjects.test.ts`

- [ ] **Step 1: 목록**

`/admin/funding/projects`. 심사 대기(`submitted`)가 맨 위, 그다음 `changes_requested`, 나머지. 각 행에 제목·개설자·상태 배지·제출 시각·목표액. `AdminShell`의 `ADMIN_NAV`는 **건드리지 않는다** — `/admin/funding` 접두사라 기존 "펀딩" 탭이 그대로 활성화된다(`activeAdminNavHref`가 가장 긴 접두사를 고른다).

`pages/admin/funding/index.tsx`(후원 목록) 상단에 이 화면으로 가는 링크를 둔다.

- [ ] **Step 2: 상세·판정**

`/admin/funding/projects/[id]`. `pages/admin/funding/[id].tsx`의 `run()` 헬퍼 패턴을 그대로 쓴다.

- 프로젝트 내용 전문(제목·요약·본문·목표·기간·대표 이미지)과 리워드 카드 목록. **잠긴 리워드는 그 사실을 표시한다.**
- 개설자 연락처.
- **판정 버튼 셋**:
  - 승인 — slug 입력칸(기본값은 개설자가 고른 값)과 함께. `window.confirm`으로 "승인하면 리워드 주소·금액·수량 제한·배송 여부를 더는 바꿀 수 없습니다"를 확인한다.
  - 보완 요청 — `window.prompt`로 사유를 받고, 비어 있으면 진행하지 않는다.
  - 반려 — 같은 방식. `window.confirm`으로 한 번 더.
- 메모 textarea와 저장 버튼. `useEffect`로 서버 값 변경을 따라간다(`router.replace`가 리마운트하지 않는다).
- API가 `warnings`를 돌려주면 **그대로 화면에 띄운다.**

- [ ] **Step 3: 테스트**

`getServerSideProps`를 단언한다: 인증 실패 → `/admin/login` 리다이렉트, 없는 id → `notFound`, **props에 정산 필드가 없음**(화이트리스트).

- [ ] **Step 4: 확인하고 커밋한다** (빌드 포함)

---

## Task 7: 대시보드 대기열

**Files:**
- Modify: `lib/ops/adminDashboard.ts`
- Modify: `pages/admin/index.tsx`
- Modify: 해당 테스트

`queues`에 `fundingProjectsAwaitingReview`를 더한다. 집계는 `reviewStatus = 'submitted'` 카운트 하나이고 **DB만 조회한다**(그 파일 주석의 외부 API 금지 원칙). `QueueCard`를 한 줄 추가하고 `href`는 `/admin/funding/projects`.

---

## Task 8: 개설자 약관

**Files:**
- Create: `pages/[locale]/funding/creator-terms.tsx`
- Create: `content/creatorTermsHash.ts`
- Create: `content/creatorTerms.baseline.test.ts`
- Create: `content/creator-terms.baseline.json`
- Modify: `lib/funding/policy.ts`
- Modify: `tests/api/funding/creator/submit.test.ts`

- [ ] **Step 1: 본문**

`pages/[locale]/funding/terms.tsx`와 같은 모양(`{ heading, body: string[] }[]`)으로 쓴다. 담을 것(스펙 §9-1):

1. 판매자·통신판매업자는 스튜디오 놀이고, 개설자는 리워드의 제작·이행 책임을 진다
2. 심사 — 스튜디오가 승인·보완 요청·반려할 수 있고 기준은 스튜디오가 정한다
3. 승인 뒤 바꿀 수 없는 것(리워드 주소·금액·수량 제한·배송 여부·모금 기간·주소)
4. 콘텐츠 권리 보증 — 사진·음원·타인의 초상에 대한 권리를 개설자가 확보했다는 보증과 분쟁 시 책임
5. 금지 콘텐츠
6. 수수료와 정산 — **금액을 적지 않는다.** 4차에서 정산을 만들 때 채운다. 지금은 "별도 정산 계약으로 정한다"로 둔다
7. 리워드 미이행 시 환불 부담이 개설자에게 있다는 것
8. 개인정보 — 후원자 정보를 배송 목적으로만 쓰고 그 밖의 용도로 쓰지 않는다

⚠️ **수수료율·정산 시점을 본문에 적지 마세요.** 그 둘은 아직 운영자가 정하지 않은 값이고(설계 §2의 D1·D2), 약관에 숫자를 박으면 그때 판본을 또 올려야 한다. "별도 계약으로 정한다"가 정직하고 정확하다.

- [ ] **Step 2: 판본과 게이트**

`FUNDING_CREATOR_TERMS_VERSION = 'funding-creator-terms-2026-09-18'`.

`content/fundingTermsHash.ts`와 `content/fundingTerms.baseline.test.ts`를 **본떠** 개설자 약관용 게이트를 만든다. 해시 대상은 개설자 약관 조항 전부. 갱신 경로도 같은 방식으로 "내용이 바뀌었는데 판본이 그대로면 거부"한다.

- [ ] **Step 3: 제출 API가 동의를 요구하기 시작한다**

상수가 빈 문자열이 아니게 되는 순간 `submit.ts`의 `requiresTerms`가 true가 된다. 그러면:

- 개설자 편집 화면의 심사 신청 자리에 **동의 체크박스와 약관 링크**가 나타나야 한다. 지금은 상수가 비어 있어 안 그린다 — 그 조건 분기를 확인하고 화면을 맞춘다.
- `tests/api/funding/creator/submit.test.ts:329` 부근의 "빈 문자열 동안의 동작"을 검증하는 테스트가 **기대가 뒤집힌다.** 그 케이스를 바꾸고, 판본 불일치·누락이 400인 것을 단언한다.

- [ ] **Step 4: 확인하고 커밋한다** (빌드 포함)

---

## Task 9: 후원자 약관 개정

**⚠️ 이 태스크는 법무 검토 대상이다.** 코드는 만들되, 실제 공개는 운영자가 변호사 확인을 마친 뒤에 한다. 그 사실을 커밋 메시지와 PR에 분명히 적는다.

**Files:**
- Modify: `pages/[locale]/funding/terms.tsx`
- Modify: `lib/funding/policy.ts`
- Modify: `content/funding-terms.baseline.json` (갱신 절차로)

- [ ] **Step 1: 무엇이 바뀌는가**

지금 약관은 "프로젝트는 **스튜디오가** 제작하는 음반·콘텐츠의 제작비를 모으기 위해 개설한 펀딩 페이지"라고 정의한다(제2조). 제3자 개설자가 생기면 그 문장이 사실과 다르다.

고칠 조항:

- **제2조(정의)** — "프로젝트"에 "스튜디오가 심사·승인한 개설자가 운영하는 페이지를 포함한다"를 더한다. "개설자" 정의를 추가한다.
- **제4조(사업자 정보)** — 판매자·통신판매업자는 스튜디오 놀임을 유지하고, **개설자가 있는 프로젝트는 그 사실과 개설자를 페이지에 표시한다**를 더한다.
- **리워드 이행 주체** — 개설자가 있는 프로젝트의 리워드 제작·발송은 개설자가 수행할 수 있고, 그 경우에도 **서포터에 대한 계약 책임은 스튜디오가 진다**(판매자가 스튜디오이므로). 환불·청약철회 창구는 바뀌지 않는다.
- **개인정보** — 배송 리워드의 배송지를 개설자에게 제공(처리위탁)한다는 것과 그 범위·목적. 처리방침(`data/privacyPolicy.ts`)의 펀딩 항에도 수탁자를 반영해야 하는지 확인한다 — 해시 대상에 처리방침 ko 전문이 들어 있으므로 함께 바뀌면 해시도 함께 바뀐다.

- [ ] **Step 2: 판본 인상과 기준선 갱신**

`FUNDING_TERMS_VERSION`을 `funding-terms-2026-09-18`로 올린다(같은 날 두 번째 개정이면 `-r2`).

**절차를 지킨다**(CLAUDE.md):
1. 상수를 먼저 올린다
2. `UPDATE_FUNDING_TERMS_BASELINE=1 npx jest content/fundingTerms.baseline.test.ts`
3. **같은 커밋에 어느 조항이 어떻게 바뀌는지 적는다**

①을 빠뜨리고 ②만 하면 갱신 경로가 그 조합을 거부한다.

- [ ] **Step 3: 확인하고 커밋한다**

커밋 메시지에 **"변호사 확인 전에는 첫 DB 프로젝트를 공개하지 않는다"**를 적는다.

---

## Task 10: 공개 상세의 개설자 표시

전자상거래법상 판매자와 개설자를 구분해 보여야 한다(스펙 §5).

**Files:**
- Modify: `lib/funding/shape.ts`
- Modify: `lib/funding/dbProjects.ts`
- Modify: `components/funding/ProjectDetailView.tsx`
- Modify: 해당 테스트들

- [ ] **Step 1: 타입에 개설자를 더한다**

`FundingProject`에 `creator: { name: string } | null`을 더한다. **마크다운 프로젝트는 항상 null**이다(스튜디오가 직접 연 것). `validateFundingProjectShape`가 없으면 null로 떨어뜨린다.

⚠️ **`bio`·`links`는 이번에 싣지 않는다.** 공개 화면에 개설자 소개를 띄우는 것은 별개 결정이고(설계 §6.4의 "승인 뒤 편집 권한"과 얽힌다), 지금 필요한 것은 법이 요구하는 **"누가 개설했는가"** 한 줄이다.

- [ ] **Step 2: DB 조회가 개설자를 조인한다**

`getDbFundingProject`가 `fundingCreators`를 조인해 `name`만 가져온다. 이메일·연락처·정산 필드는 **절대** 싣지 않는다 — 공개 페이지의 `__NEXT_DATA__`에 실린다.

- [ ] **Step 3: 화면에 한 줄**

`ProjectDetailView`가 `project.creator`가 있으면 표시한다. 문구는 스펙대로:

> 개설자 {name} · 판매자 스튜디오 놀 (통신판매업 신고 {번호})

번호는 `data/siteConfig.ts`의 `mailOrderSalesNumber`에서 끌어온다. 하드코딩하지 않는다.

마크다운 프로젝트(`creator === null`)는 **아무것도 표시하지 않는다** — 지금 화면 그대로다. 진행 중인 `keep-singing-for-palestine`이 그 경우이고, 이 태스크가 그 화면을 바꾸면 안 된다.

- [ ] **Step 4: 확인한다** — 기존 공개 화면 테스트가 전부 그대로 녹색이어야 하고, 빌드까지 돌린다.

---

## Task 11: 프로젝트 보관(아카이브)

2차에서 미심사 프로젝트 상한(10개)을 걸었는데 **그것을 푸는 유일한 수단이 운영자 심사**다. 운영자가 바쁘면 개설자가 갇힌다. 그리고 개설자·운영자 어느 쪽에도 프로젝트를 치우는 경로가 없다.

**Files:**
- Modify: `lib/funding/reviewDecision.ts` — `AdminReviewAction`에 `'archive'`를 더한다(새 함수를 만들지 않는다. 판정 경로가 둘이 되면 전이표 재사용이 갈린다)
- Modify: `lib/funding/reviewTransition.ts` + 그 테스트 — 표에 `archive`를 더하고 전수 조합 테스트를 확장한다
- Modify: `pages/api/admin/funding/projects/[id].ts`
- Modify: 심사 화면

- [ ] **Step 1: 지우지 않고 보관한다**

**행을 삭제하지 않는다.** 후원이 들어온 프로젝트를 지우면 그 후원 기록이 참조를 잃는다. 대신 `reviewStatus`를 `rejected`로 보내는 관리자 액션(`archive`)을 둔다 — 반려는 이미 종결 상태이고 미심사 카운트에서 빠진다.

- `submitted`뿐 아니라 `draft`·`changes_requested`에서도 보관할 수 있어야 한다(방치된 초안을 치우는 것이 목적이다).
- `approved`는 보관하지 않는다. 공개된 프로젝트를 닫는 것은 `status: closed`이지 심사 상태를 되감는 것이 아니다.
- **전이표에 `archive`를 더한다.** 조건문을 새로 쓰지 않는다 — `reviewTransition.ts`의 표에 `draft`·`submitted`·`changes_requested` → `archive` → `rejected`를 넣고 테스트를 확장한다.
- 사유를 필수로 받아 `reviewNote`에 남긴다. 개설자에게 알림 메일을 보낸다.

- [ ] **Step 2: 확인하고 커밋한다**

---

## Task 12: 전체 검증과 문서

- [ ] **Step 1: 전체 검사**

```bash
npm run generate:manifests
npm run type-check
npm run lint
npm test
env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN npm run build
```

개별로 확인할 것: `content/fundingTerms.baseline.test.ts`, `content/creatorTerms.baseline.test.ts`, `lib/funding/reviewDecision.integration.test.ts`, `lib/koOnlyRoutes.test.ts`, `tests/config/noStoreHeaders.test.ts`, `tests/pages/privateLinkNavigation.test.ts`.

- [ ] **Step 2: 공개 화면 변화를 확인한다**

**이번 계획은 공개 화면을 바꾼다**(개설자 표시 한 줄). 그 외에는 바뀌면 안 된다. 빌드 산출물의 라우트 목록과 기존 공개 화면 테스트 결과를 보고서에 적는다.

- [ ] **Step 3: `CLAUDE.md`에 규칙을 더한다**

2차에서 넣은 "개설자가 쓴 것은 우리가 쓴 것과 다르게 다룬다" 절 아래에:

```markdown
### 승인은 세 가지를 한 묶음으로 한다

`lib/funding/reviewDecision.ts`의 승인은 slug 확정 · 리워드 `lockedAt` · `status` 열기를
함께 한다. **하나라도 빠지면 조용히 잘못된다** — `lockedAt`이 없으면 승인된 리워드의 금액을
바꿀 수 있고(잠금 가드가 전부 그 값에 달려 있다), `status`가 안 열리면 승인했는데 공개가
안 되고, slug가 확정 안 되면 주소가 개설자 입력 그대로 남는다.

리워드 잠금 UPDATE의 `WHERE`에는 프로젝트가 이미 승인으로 바뀌었다는 조건(`EXISTS`)을
함께 건다. 경합으로 프로젝트가 안 바뀌었는데 리워드만 잠기면 "잠겼는데 공개는 안 된"
상태가 남는다.

판정 뒤에는 `revalidateFundingPaths`로 **목록과 상세 둘 다** 다시 만든다. 상세만 하면
목록 카드가 60초 낡고, 목록만 하면 상세가 404로 남는다(상세의 `notFound`도 캐시된다).
재검증·메일 실패는 판정을 실패시키지 않되 응답의 `warnings`로 화면에 드러낸다 — 조용히
성공으로 보이면 운영자가 개설자에게 연락이 갔다고 착각한다.
```

- [ ] **Step 4: 스펙의 구현 순서를 갱신한다**

4단계에 완료 표시를 하고, 5·6단계(공개 뒤 편집 권한·통계, 정산)가 4차로 넘어감을 적는다.

- [ ] **Step 5: 커밋한다.** 푸시와 PR은 하지 않는다.

---

## 4차로 넘기는 것

- 정산 계산·관리자 정산 탭·개설자 약관의 수수료 조항 채우기(설계 §2의 D1·D2 확정 뒤)
- 승인 뒤 스토리 편집 허용(스펙 §6.4) — 지금은 승인 뒤 전부 잠긴다
- 개설자 통계 화면
- 개설자 프로필(`bio`·`links`) 변경이 공개 화면에 즉시 반영되는 것을 심사로 막을지 결정
- 고아 blob 정리, 리워드 순서 변경 경로
- 개설자 흐름을 사이트에서 링크하기 전에: 로그인 메일 전역 일일 캡, `creator.name` 기본값(지금은 이메일 로컬파트)
