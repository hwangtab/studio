# 펀딩 셀프 개설 4차 — 3차가 남긴 빚 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 3차가 남긴 네 가지 빚을 갚는다 — 개설자 이름 기본값이 공개되고 잠기는 결함, 매직링크 전역 캡 부재, 승인 뒤 수정 경로 부재, 내부 메모 칸 부재.

**Architecture:** 새 기능을 만들지 않는다. 판정을 한 군데로 모으고(`isDefaultCreatorName`, 구획별 편집 표), 이미 있는 장치를 재사용한다(`consumeRateLimit`, `reviewTransition`의 표, `reviewEmail` 모듈). 마이그레이션은 컬럼 두 개를 담은 파일 하나뿐이고 **생성·커밋만 하고 적용하지 않는다.**

**Tech Stack:** Next.js 15 Pages Router, React 19, TypeScript, Turso(libSQL) + Drizzle ORM, Jest + React Testing Library, Resend

**Spec:** `docs/superpowers/specs/2026-09-18-funding-creator-debt-design.md`

## Global Constraints

- **워크트리**: `/Users/hwang-gyeongha/studio-worktrees/funding-review`, 브랜치 `feat/funding-creator-debt`. **다른 디렉터리를 건드리지 않는다** — `/Users/hwang-gyeongha/studio`와 다른 worktree는 다른 세션이 쓴다.
- **마이그레이션은 생성·커밋만.** `npm run db:migrate`를 절대 실행하지 않는다. 적용은 운영자가 직접 한다. 프로덕션 DB에 접속하지 않는다.
- **`git commit -a` 금지.** 변경한 파일만 경로로 지정해 커밋한다. 커밋은 논리 단위마다 즉시, **푸시는 하지 않는다**(사이클 끝에 컨트롤러가 한 번에 한다).
- 커밋 메시지는 한국어. 끝에 `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- **정산·개인정보 필드(`taxType`·`payoutBankName`·`payoutAccount`·`payoutHolder`)는 어떤 화면 props에도 담지 않는다** — `__NEXT_DATA__`로 페이지 소스에 실린다. 관리자 페이지도 마찬가지다.
- **`pages/`·`components/` 아래를 건드린 작업은 `npm run build`까지 돌린다.** 타입 검사와 테스트를 통과하고 빌드만 잡는 클라이언트 번들 파손이 이 저장소에서 실제로 났다.
- `lib/funding/projects.ts`에서는 **타입만** import한다(모듈 최상위에서 `process.cwd()`를 실행한다). 클라이언트와 공유하는 순수 함수는 `lib/funding/shape.ts`에 둔다.
- `utils/imageMetadata.json`이 워킹트리에 수정된 채 있을 수 있다(빌드 부산물). **스테이징하지 않는다.**
- 없는 사실을 코드 주석·화면 문구·약관에 적지 않는다. 기간·수치·절차는 코드에 구현된 것만 쓴다.
- 이번 계획은 **약관 본문을 건드리지 않는다.** `FUNDING_TERMS_VERSION`·`FUNDING_CREATOR_TERMS_VERSION`을 올릴 일이 없다. 올려야 할 것 같으면 멈추고 보고한다.

---

### Task 1: 개설자 이름 기본값을 "미설정"으로 판정한다

**Files:**
- Modify: `lib/funding/creatorValidation.ts` (`isDefaultCreatorName` 추가, `findMissingRequiredSections` 확장)
- Modify: `lib/funding/creatorValidation.test.ts`
- Modify: `lib/funding/creatorProjectWrite.ts` (`saveCreatorSection`의 이름 잠금 예외)
- Modify: `lib/funding/reviewDecision.ts:164` 부근 (`findMissingRequiredSections` 호출에 이름·이메일 추가)
- Modify: `pages/api/funding/creator/projects/[id]/submit.ts:34` 부근 (`findMissingSections` 래퍼)
- Test: `lib/funding/creatorProjectWrite.integration.test.ts`, `lib/funding/reviewDecision.integration.test.ts`, `tests/api/funding/creator/submit.test.ts`

**Interfaces:**
- Consumes: 없음(첫 태스크)
- Produces:
  - `isDefaultCreatorName(name: string, email: string): boolean` — `lib/funding/creatorValidation.ts`에서 export
  - `RequiredSectionsInput`에 `creatorEmail?: string` 필드 추가

**배경**: `lib/funding/creatorToken.ts:45`가 가입 시 `name: normalized.split('@')[0]`을 넣는다. 이름이 **채워져 있으므로** `findMissingRequiredSections`의 `creatorName` 검사(빈 문자열만 본다)가 영영 발동하지 않는다. 3차가 그 이름을 공개 상세에 그리고 동시에 잠그기 시작해서, 프로필을 안 건드린 개설자가 승인되면 공개 페이지에 "개설자 hwangtab"이 뜨고 아무도 못 고친다.

**`creatorToken.ts`는 건드리지 않는다.** 가입 시 이름을 비우면 "빈 이름"과 "로컬파트 이름" 두 가지 미설정 상태가 생기고 모든 검사가 두 경우를 봐야 한다. 판정을 한 군데에 모은다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/funding/creatorValidation.test.ts`에 추가:

```ts
import { findMissingRequiredSections, isDefaultCreatorName } from './creatorValidation';

describe('isDefaultCreatorName', () => {
  it('가입 시 채워 넣는 이메일 로컬파트는 개설자가 고른 이름이 아니다', () => {
    expect(isDefaultCreatorName('hwangtab', 'hwangtab@gmail.com')).toBe(true);
  });

  it('앞뒤 공백은 이름으로 치지 않는다', () => {
    expect(isDefaultCreatorName('  hwangtab  ', 'hwangtab@gmail.com')).toBe(true);
  });

  it('개설자가 실제로 고른 이름은 기본값이 아니다', () => {
    expect(isDefaultCreatorName('황경하', 'hwangtab@gmail.com')).toBe(false);
  });

  it('로컬파트와 같은 글자를 일부러 이름으로 골라도 기본값으로 본다 — 구분할 방법이 없다', () => {
    // 이 경우 개설자는 이름을 다시 저장해야 하고, 잠금도 걸리지 않는다. 안전한 방향이다.
    expect(isDefaultCreatorName('studio', 'studio@example.com')).toBe(true);
  });
});

describe('findMissingRequiredSections — 개설자 이름', () => {
  const filled = {
    title: '제목',
    summary: '요약',
    coverUrl: 'https://example.com/a.webp',
    content: 'x'.repeat(400),
    rewardsCount: 1,
  };

  it('이름이 이메일 로컬파트뿐이면 미비로 잡는다', () => {
    expect(
      findMissingRequiredSections({ ...filled, creatorName: 'hwangtab', creatorEmail: 'hwangtab@gmail.com' }),
    ).toContain('개설자 정보(이름)');
  });

  it('이름을 실제로 골랐으면 미비가 아니다', () => {
    expect(
      findMissingRequiredSections({ ...filled, creatorName: '황경하', creatorEmail: 'hwangtab@gmail.com' }),
    ).not.toContain('개설자 정보(이름)');
  });

  it('creatorEmail을 안 넘기면 기본값 판정을 건너뛴다 — 빈 이름만 본다', () => {
    expect(findMissingRequiredSections({ ...filled, creatorName: 'hwangtab' })).not.toContain('개설자 정보(이름)');
    expect(findMissingRequiredSections({ ...filled, creatorName: '' })).toContain('개설자 정보(이름)');
  });
});
```

`content`가 400자인 이유: `STORY_MIN_LENGTH`를 넘겨야 "스토리" 미비가 섞이지 않는다. 실제 값은 `lib/funding/creatorValidation.ts`에서 확인하고, 400보다 크면 그 값 이상으로 맞춘다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npx jest lib/funding/creatorValidation.test.ts`
Expected: FAIL — `isDefaultCreatorName is not a function`

- [ ] **Step 3: 판정 함수를 더한다**

`lib/funding/creatorValidation.ts`:

```ts
/**
 * 가입 시 채워 넣는 이메일 로컬파트(`creatorToken.ts`의 `name: normalized.split('@')[0]`)는
 * "개설자가 고른 이름"이 아니다. 이름 칸이 비어 있지 않아 미설정을 감지할 수 없었고,
 * 3차가 그 값을 공개 상세의 판매자 표시 옆에 그리면서(그리고 승인 뒤 잠그면서) 문제가 됐다.
 *
 * 로컬파트와 같은 글자를 일부러 고른 개설자는 기본값으로 오판되지만, 결과는 "이름을 한 번
 * 더 저장해야 하고 잠기지 않는다"라 안전한 방향이다. 반대 방향(설정 안 한 이름이 공개되고
 * 잠기는 것)이 실제로 난 사고다.
 */
export const isDefaultCreatorName = (name: string, email: string): boolean =>
  name.trim() === email.split('@')[0];
```

`RequiredSectionsInput`에 필드를 더하고 검사를 고친다:

```ts
export interface RequiredSectionsInput {
  title: string;
  summary: string;
  slug?: string;
  coverUrl: string;
  content: string;
  rewardsCount: number;
  creatorName?: string;
  /** 넘기면 이름이 가입 기본값(이메일 로컬파트)인지까지 본다. 안 넘기면 빈 이름만 본다. */
  creatorEmail?: string;
}
```

`findMissingRequiredSections` 안의 이름 검사를 교체한다:

```ts
  if (input.creatorName !== undefined) {
    const unset = !input.creatorName
      || (input.creatorEmail !== undefined && isDefaultCreatorName(input.creatorName, input.creatorEmail));
    if (unset) missing.push('개설자 정보(이름)');
  }
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx jest lib/funding/creatorValidation.test.ts`
Expected: PASS

- [ ] **Step 5: 심사 신청이 이름을 묻게 한다**

`pages/api/funding/creator/projects/[id]/submit.ts`의 `findMissingSections` 래퍼에 이메일을 더한다. `CreatorProjectDetail.creator`에는 지금 `email`이 **없으므로** `loadProjectForCreator`(`lib/funding/creatorProjectWrite.ts`)의 반환에 더해야 한다.

⚠️ **이메일을 화면 props로 흘리지 않는다.** `pages/[locale]/funding/creator/[id].tsx`의 `toEditorProject`가 필드를 골라 담으므로 자동으로 새지는 않지만, 그 사실을 테스트로 고정한다(Step 7).

`loadProjectForCreator`의 `creator` 객체에 한 줄:

```ts
    creator: {
      name: creator?.name ?? '',
      email: creator?.email ?? '',
      contactName: creator?.contactName ?? null,
      // …나머지 그대로
    },
```

`CreatorProjectDetail` 타입에도 `email: string`을 더한다(같은 파일 또는 그 타입이 선언된 파일).

`submit.ts`의 래퍼:

```ts
const findMissingSections = (project: CreatorProjectDetail): string[] =>
  findMissingRequiredSections({
    title: project.title,
    summary: project.summary,
    slug: project.slug,
    coverUrl: project.coverUrl,
    content: project.content,
    rewardsCount: project.rewards.length,
    creatorName: project.creator.name,
    creatorEmail: project.creator.email,
  });
```

- [ ] **Step 6: 승인도 이름을 묻게 한다**

`lib/funding/reviewDecision.ts`의 `findMissingRequiredSections` 호출(현재 164행 부근)은 **이름을 아예 안 넘기고 있다.** `AdminProjectSummary`에 `creatorName`·`creatorEmail`이 이미 있으므로 둘을 넘긴다:

```ts
  const missing = findMissingRequiredSections({
    title: project.title,
    summary: project.summary,
    coverUrl: project.coverUrl,
    content: project.content,
    rewardsCount: project.rewards.length,
    creatorName: project.creatorName,
    creatorEmail: project.creatorEmail,
  });
```

- [ ] **Step 7: 잠금 예외와 통합 테스트를 쓴다**

`lib/funding/creatorProjectWrite.integration.test.ts`에 추가:

```ts
it('이름이 가입 기본값이면 승인된 프로젝트가 있어도 바꿀 수 있다', async () => {
  // 설정한 적 없는 값을 잠그는 것은 잠금이 아니라 사고다. 기존 행(로컬파트 이름)도
  // 이 예외로 스스로 풀린다 — DB를 손댈 필요가 없다.
  const creatorId = await seedCreator({ email: 'hwangtab@gmail.com', name: 'hwangtab' });
  await seedProject({ creatorId, reviewStatus: 'approved' });

  const result = await saveCreatorSection(creatorId, { name: '황경하', contactName: null, phone: null, bio: null, links: null });

  expect(result.ok).toBe(true);
});

it('이름을 이미 골랐으면 승인된 프로젝트가 있을 때 잠긴다', async () => {
  const creatorId = await seedCreator({ email: 'hwangtab@gmail.com', name: '황경하' });
  await seedProject({ creatorId, reviewStatus: 'approved' });

  const result = await saveCreatorSection(creatorId, { name: '다른 이름', contactName: null, phone: null, bio: null, links: null });

  expect(result).toMatchObject({ ok: false, code: 'locked' });
});
```

`seedCreator`·`seedProject`의 실제 시그니처는 그 파일에 이미 있는 것을 **그대로** 쓴다. 없으면 기존 테스트가 쓰는 방식을 따라 만든다.

`saveCreatorSection`의 잠금 판정을 고친다:

```ts
  // 기본값(가입 시 채운 이메일 로컬파트)은 개설자가 고른 이름이 아니므로 잠그지 않는다.
  if (value.name !== existing.name && !isDefaultCreatorName(existing.name, existing.email)) {
    const [approvedProject] = await getDb().select({ id: fundingProjects.id }).from(fundingProjects)
      .where(and(eq(fundingProjects.creatorId, creatorId), eq(fundingProjects.reviewStatus, 'approved'))).limit(1);
    if (approvedProject) {
      return deny('locked', '승인된 프로젝트가 있어 이름은 더 이상 바꿀 수 없습니다. 소개·연락처·링크는 계속 고칠 수 있습니다.');
    }
  }
```

`existing` 조회가 지금 `{ id, name }`만 고르므로 `email`도 고르도록 select를 넓힌다.

`tests/pages/funding/creator/` 아래(기존 편집 화면 테스트가 있는 자리)에 누수 테스트를 더한다:

```ts
it('개설자 화면 props에 이메일이 실리지 않는다', () => {
  // 이메일은 findMissingRequiredSections가 쓰려고 loadProjectForCreator에 추가된 값이라
  // 서버 안에서만 돌아야 한다. props에 실리면 __NEXT_DATA__로 페이지 소스에 나간다.
  const editor = toEditorProject(DETAIL_FIXTURE);
  expect(JSON.stringify(editor)).not.toContain('hwangtab@gmail.com');
  expect(Object.keys(editor.creator).sort()).toEqual(['bio', 'contactName', 'links', 'name', 'phone']);
});
```

`toEditorProject`가 export되어 있지 않으면 export한다. `creator` 키 목록은 실제 구현을 읽고 **그 파일의 현재 키**로 맞춘다(이 목록이 틀리면 테스트가 무의미해진다).

- [ ] **Step 8: 심사 신청·승인 테스트를 더한다**

`tests/api/funding/creator/submit.test.ts`:

```ts
it('이름이 가입 기본값이면 심사 신청이 400으로 막힌다', async () => {
  // 채워져 있어 보이지만 개설자가 고른 적 없는 이름이다. 승인되면 공개 페이지에
  // "개설자 hwangtab"이 뜨고, 그때는 잠겨서 못 고친다.
  const { req, res } = mockSubmit({ creatorName: 'hwangtab', creatorEmail: 'hwangtab@gmail.com' });
  await handler(req, res);
  expect(res._getStatusCode()).toBe(400);
  expect(JSON.parse(res._getData()).message).toContain('개설자 정보(이름)');
});
```

`lib/funding/reviewDecision.integration.test.ts`:

```ts
it('이름이 가입 기본값이면 승인이 incomplete로 거부된다', async () => {
  const { projectId } = await seedApprovableProject({ creatorEmail: 'hwangtab@gmail.com', creatorName: 'hwangtab' });
  const result = await decideProject(projectId, 'approve', {});
  expect(result).toMatchObject({ ok: false, code: 'incomplete' });
  expect((result as { message: string }).message).toContain('개설자 정보(이름)');
});
```

기존 시드 헬퍼가 이름을 로컬파트로 넣고 있으면 **기존 승인 테스트들이 깨진다.** 그 경우 헬퍼의 기본값을 로컬파트가 아닌 이름("테스트 개설자" 등)으로 바꾸고, 이 테스트만 override로 로컬파트를 넣는다.

- [ ] **Step 9: 전체 검증**

```
npm run type-check
npm run lint
npm test
env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN npm run build
```

- [ ] **Step 10: 커밋**

```bash
git add lib/funding/creatorValidation.ts lib/funding/creatorValidation.test.ts \
        lib/funding/creatorProjectWrite.ts lib/funding/creatorProjectWrite.integration.test.ts \
        lib/funding/reviewDecision.ts lib/funding/reviewDecision.integration.test.ts \
        'pages/api/funding/creator/projects/[id]/submit.ts' tests/api/funding/creator/submit.test.ts
git commit -m "$(cat <<'MSG'
fix(funding): 개설자 이름 기본값을 미설정으로 판정한다

가입이 name에 이메일 로컬파트를 채워 넣어(creatorToken.ts) 미설정을 감지할 수
없었다. 3차가 그 값을 공개 상세의 판매자 표시 옆에 그리고 동시에 승인 뒤 잠그면서,
프로필을 안 건드린 개설자가 승인되면 "개설자 hwangtab"이 공개되고 아무도 못 고치는
상태가 됐다.

isDefaultCreatorName을 두고 세 곳이 본다 — 심사 신청·승인의 미비 검사, 그리고 이름
잠금의 예외(설정한 적 없는 값은 잠그지 않는다). 기존 로컬파트 이름 행도 이 예외로
스스로 풀려 DB를 손댈 필요가 없다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
MSG
)"
```

---

### Task 2: 매직링크 전역 일일 캡

**Files:**
- Modify: `pages/api/funding/creator/login.ts`
- Modify: `lib/funding/email.ts` (운영자 알림 메일 추가)
- Test: `tests/api/funding/creator/login.test.ts`(있으면), `lib/funding/email.test.ts`(있으면). 없으면 그 자리에 새로 만든다.

**Interfaces:**
- Consumes: 없음
- Produces: `sendCreatorLoginCapAlert(cap: number): Promise<string | null>` — `lib/funding/email.ts`에서 export. 성공이면 `null`, 실패면 이유 문자열. `cap`을 인자로 받는 이유는 상수의 주인이 라우트이기 때문이다.

**배경**: `login.ts`는 IP별·주소별 제한만 건다. 둘 다 키가 요청자마다 달라, 주소와 IP를 흩뿌리면 발송량에 천장이 없다. 메일 청구서와 발신 도메인 평판이 걸려 있다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
import { consumeRateLimit } from '../../../../lib/booking/rate-limit';

jest.mock('../../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn() }));

it('전역 캡은 주소별 제한을 통과한 뒤에만 소비된다', async () => {
  // 한 주소를 두드리는 것만으로 전체를 잠글 수 있으면 안 된다 — 주소별 제한에 걸린
  // 요청은 메일을 보내지 않으므로 전역 예산도 쓰면 안 된다.
  (consumeRateLimit as jest.Mock).mockImplementation(async (key: string) =>
    !key.startsWith('creator_login:email'));

  await handler(...);

  const keys = (consumeRateLimit as jest.Mock).mock.calls.map((c) => c[0] as string);
  expect(keys).not.toContain('creator_login:global');
});

it('전역 캡에 걸리면 메일을 보내지 않고 운영자에게 알린다', async () => {
  (consumeRateLimit as jest.Mock).mockImplementation(async (key: string) =>
    key !== 'creator_login:global');

  await handler(...);

  expect(sendCreatorLoginEmail).not.toHaveBeenCalled();
  expect(sendCreatorLoginCapAlert).toHaveBeenCalledTimes(1);
  // 화면은 성공이라고 답한다 — 주소 존재 여부를 숨기려면 그래야 한다.
  expect(res._getStatusCode()).toBe(200);
});

it('캡에 걸린 상태가 이어져도 알림은 창당 한 번만 나간다', async () => {
  (consumeRateLimit as jest.Mock).mockImplementation(async (key: string) =>
    key !== 'creator_login:global' && key !== 'creator_login:global_alert');

  await handler(...);

  expect(sendCreatorLoginCapAlert).not.toHaveBeenCalled();
});
```

기존 `login.ts` 테스트가 있으면 그 파일의 mock 구성과 요청 헬퍼를 **그대로 재사용한다**(Origin 검사·`getClientIp`를 이미 다루고 있을 것이다).

- [ ] **Step 2: 실패를 확인한다**

Run: `npx jest tests/api/funding/creator/login.test.ts`
Expected: FAIL

- [ ] **Step 3: 운영자 알림 메일을 만든다**

`lib/funding/email.ts`에 추가(그 파일의 기존 메일 함수와 같은 꼴로):

```ts
/**
 * 개설자 로그인 메일 전역 일일 캡에 걸렸을 때의 운영자 알림.
 *
 * 캡에 걸린 정상 사용자는 메일을 못 받는데 화면은 성공이라고 답한다(주소 존재 여부를
 * 숨기려면 그래야 한다). 운영자가 모르면 아무도 모른다 — "로그인이 안 된다"는 문의가
 * 들어와야 비로소 알게 되는 상태를 막는다.
 */
export const sendCreatorLoginCapAlert = async (cap: number): Promise<string | null> => {
  const result = await sendEmail({
    to: OPERATOR_EMAIL,
    subject: '[펀딩] 개설자 로그인 메일 일일 한도에 걸렸습니다',
    text: [
      `오늘 개설자 로그인 메일이 일일 한도(${cap}통)에 도달했습니다.`,
      '지금부터 24시간 창이 지날 때까지 로그인 링크가 발송되지 않습니다.',
      '',
      '정상 사용자도 함께 막히므로, 남용이 아니라면 한도를 올려야 합니다',
      '(pages/api/funding/creator/login.ts의 GLOBAL_DAILY_CAP).',
      '',
      `개설자 목록: ${SITE_URL}/admin/funding/projects`,
    ].join('\n'),
  });
  return result.ok ? null : `operator:${result.errorCode}`;
};
```

한도 상수(`GLOBAL_DAILY_CAP`)는 **라우트에 두고 인자로 넘긴다** — 그 값을 읽고 쓰는 주인이 라우트이고, `lib/funding/email.ts`가 라우트의 상수를 역참조하면 의존 방향이 뒤집힌다.

- [ ] **Step 4: 라우트에 캡을 건다**

`pages/api/funding/creator/login.ts`:

```ts
/**
 * 하루에 나갈 수 있는 개설자 로그인 메일의 총량.
 *
 * IP별·주소별 제한은 키가 요청자마다 달라 천장이 없다 — 주소와 IP를 흩뿌리면 얼마든지
 * 보낼 수 있다. 개설자 수가 두 자리인 동안 하루 수십 통이 정상 상한이라 넉넉히 잡았다.
 * 이 값에 닿으면 운영자에게 메일이 가고, 그때 올릴지 남용인지 판단한다.
 */
const GLOBAL_DAILY_CAP = 100;
const DAY_SECONDS = 86_400;
```

호출 순서는 **IP → 주소 → 전역 → 발송**이다:

```ts
  if (!(await consumeRateLimit(emailRateLimitKey(email), EMAIL_LIMIT, WINDOW_SECONDS))) {
    return res.status(200).json(OK);
  }

  // 전역 캡은 메일을 실제로 보내기 직전에만 소비한다 — 위 주소별 제한에 걸려 이미
  // 돌아가는 요청이 전역 예산을 태우면, 한 주소를 두드리는 것만으로 전체를 잠글 수 있다.
  if (!(await consumeRateLimit('creator_login:global', GLOBAL_DAILY_CAP, DAY_SECONDS))) {
    // 알림도 레이트리밋을 탄다 — 캡에 걸린 상태에서 알림이 쏟아지면 그것이 두 번째 사고다.
    if (await consumeRateLimit('creator_login:global_alert', 1, DAY_SECONDS)) {
      const alertError = await sendCreatorLoginCapAlert(GLOBAL_DAILY_CAP);
      if (alertError) console.error('[funding] 개설자 로그인 캡 알림 실패:', alertError);
    }
    console.error('[funding] 개설자 로그인 메일 일일 한도 도달 — 발송을 건너뜁니다.');
    return res.status(200).json(OK);
  }

  const issued = await issueCreatorLoginToken(email);
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npx jest tests/api/funding/creator/login.test.ts`
Expected: PASS

- [ ] **Step 6: 전체 검증과 커밋**

```
npm run type-check
npm run lint
npm test
```

`pages/`만 건드렸고 클라이언트 컴포넌트가 아니므로 빌드는 Task 7의 전체 검증에서 함께 돈다. 다만 `lib/funding/email.ts`가 클라이언트에서 import되는 곳이 있는지 `grep`으로 확인하고, 있으면 **이 태스크에서 빌드를 돌린다.**

```bash
git add pages/api/funding/creator/login.ts lib/funding/email.ts tests/api/funding/creator/login.test.ts
git commit -m "$(cat <<'MSG'
fix(funding): 개설자 로그인 메일에 전역 일일 캡을 건다

IP별·주소별 제한은 키가 요청자마다 달라 천장이 없다 — 주소와 IP를 흩뿌리면 발송량에
한도가 없었다. 고정 키 하나(creator_login:global)로 24시간 총량을 막는다.

캡은 메일을 보내기 직전에만 소비한다. 주소별 제한에 걸려 이미 돌아가는 요청이 전역
예산을 태우면 한 주소를 두드리는 것만으로 전체를 잠글 수 있다.

캡에 걸리면 운영자에게 알린다 — 걸린 사용자는 메일을 못 받는데 화면은 성공이라고
답하므로(주소 존재 여부를 숨기려면 그래야 한다) 운영자가 모르면 아무도 모른다.
알림도 별도 키로 창당 한 번만 나간다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
MSG
)"
```

---

### Task 3: 마이그레이션 — `internal_note`와 `creator_edited_at`

**Files:**
- Modify: `db/schema.ts` (`fundingProjects`에 컬럼 두 개)
- Create: `drizzle/00XX_*.sql` (생성물 — `npm run db:generate`가 만든다)
- Modify: `drizzle/meta/_journal.json` (생성물)
- Test: `lib/funding/schema.integration.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `fundingProjects.internalNote` (`internal_note`, `text`, nullable)
  - `fundingProjects.creatorEditedAt` (`creator_edited_at`, `integer` timestamp, nullable)

⚠️ **`npm run db:migrate`를 실행하지 않는다.** SQL을 생성·커밋만 하고 적용은 운영자가 직접 한다. 이 태스크의 테스트는 로컬 인메모리 DB에서 도는 기존 integration 테스트 인프라를 쓴다(그 인프라가 스키마를 직접 만들므로 마이그레이션 적용과 무관하다 — 기존 테스트가 어떻게 하는지 먼저 읽는다).

- [ ] **Step 1: 스키마에 컬럼을 더한다**

`db/schema.ts`의 `fundingProjects`에:

```ts
  /**
   * 운영자 전용 메모. `review_note`와 달리 개설자에게 **어떤 경로로도 보이지 않는다**.
   *
   * 3차까지는 `review_note` 한 칸을 네 가지가 공유했고(보완 요청 사유·반려 사유·보관 사유·
   * set_review_note) 그 전부가 개설자 화면 두 곳에 렌더됐다 — 운영자가 내부 기록이라 믿고
   * 적은 문장이 개설자에게 즉시 보였다.
   */
  internalNote: text('internal_note'),
  /**
   * 개설자가 **승인된 뒤에** 내용을 고친 마지막 시각.
   *
   * `updated_at`으로는 알 수 없다 — 관리자 쓰기(`set_review_note` 등)도 그 값을 갱신하므로
   * 운영자가 메모만 달아도 "개설자가 고쳤다"로 보인다. 개설자의 승인 후 저장에서만 찍는다.
   */
  creatorEditedAt: integer('creator_edited_at', { mode: 'timestamp' }),
```

- [ ] **Step 2: 마이그레이션 SQL을 생성한다**

Run: `npm run db:generate`
Expected: `drizzle/` 아래에 새 `.sql` 파일 하나와 `meta/_journal.json` 변경

생성된 SQL을 **열어서 읽는다.** `ALTER TABLE funding_projects ADD ...` 두 줄 외에 다른 것이 섞여 있으면(다른 세션이 스키마를 건드렸을 수 있다) **멈추고 보고한다.**

- [ ] **Step 3: 컬럼이 존재하는지 테스트한다**

`lib/funding/schema.integration.test.ts`에 추가:

```ts
it('운영자 전용 메모와 개설자 수정 시각은 기본이 null이다', async () => {
  const [row] = await db.select().from(schema.fundingProjects)
    .where(eq(schema.fundingProjects.id, projectId)).limit(1);
  expect(row.internalNote).toBeNull();
  expect(row.creatorEditedAt).toBeNull();
});
```

`projectId`·`db`는 그 파일의 기존 설정을 그대로 쓴다.

- [ ] **Step 4: 통과를 확인한다**

Run: `npx jest lib/funding/schema.integration.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add db/schema.ts drizzle/ lib/funding/schema.integration.test.ts
git commit -m "$(cat <<'MSG'
feat(funding): internal_note·creator_edited_at 컬럼 추가

internal_note는 운영자 전용 메모다. 3차까지는 review_note 한 칸을 네 가지가 공유했고
그 전부가 개설자 화면에 렌더돼, 운영자가 내부 기록이라 믿고 적은 문장이 개설자에게
즉시 보였다.

creator_edited_at은 개설자가 승인 뒤에 고친 마지막 시각이다. updated_at으로는 알 수
없다 — 관리자 쓰기도 그 값을 갱신하므로 운영자가 메모만 달아도 "개설자가 고쳤다"로
보인다.

마이그레이션 SQL은 생성만 했고 적용은 운영자가 직접 한다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
MSG
)"
```

커밋 메시지에 **"마이그레이션은 생성만 했고 적용은 운영자가 직접 한다"**를 적는다.

---

### Task 4: 내부 메모 — API 액션과 심사 화면 두 칸

**Files:**
- Modify: `lib/funding/adminProjects.ts` (`AdminProjectDetail`에 `internalNote`)
- Modify: `pages/api/admin/funding/projects/[id].ts` (`set_internal_note` 액션)
- Modify: `pages/admin/funding/projects/[id].tsx` (칸 두 개)
- Modify: `components/admin/fundingProjectActions.ts` (클라이언트 호출)
- Test: `lib/funding/adminProjects.integration.test.ts`, `tests/api/admin/funding/projects.test.ts`, `tests/pages/admin/funding/projectsDetailReview.test.tsx`

**Interfaces:**
- Consumes: Task 3의 `fundingProjects.internalNote`
- Produces: `AdminProjectDetail.internalNote: string | null`; PATCH 액션 `{ action: 'set_internal_note', note?: string }`

- [ ] **Step 1: 누수 테스트를 먼저 쓴다**

`lib/funding/adminProjects.integration.test.ts`의 **기존 화이트리스트 테스트**(`Object.keys().sort()` 완전 일치)에 `internalNote`를 더한다. 그 테스트가 완전 일치라서 컬럼을 추가하면 자동으로 빨개진다 — 그것이 의도다.

그리고 개설자 쪽에 안 새는 것을 고정한다. `lib/funding/creatorProjectWrite.integration.test.ts`:

```ts
it('내부 메모는 개설자 조회에 실리지 않는다', async () => {
  // 운영자가 내부 기록이라 믿고 적은 문장이다. 개설자 화면 props로 나가면
  // __NEXT_DATA__에 그대로 실린다.
  await getDb().update(fundingProjects)
    .set({ internalNote: '이 개설자는 지난번에 연락이 끊겼음' })
    .where(eq(fundingProjects.id, projectId));

  const detail = await loadProjectForCreator(creatorId, projectId);

  expect(JSON.stringify(detail)).not.toContain('연락이 끊겼음');
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx jest lib/funding/adminProjects.integration.test.ts lib/funding/creatorProjectWrite.integration.test.ts`
Expected: 화이트리스트 테스트 FAIL(키 불일치). 개설자 누수 테스트는 이미 PASS일 수 있다 — `loadProjectForCreator`가 필드를 골라 담기 때문이다. **그래도 남긴다**(앞으로 스프레드로 바뀌는 것을 잡는다).

- [ ] **Step 3: 관리자 조회에 싣는다**

`lib/funding/adminProjects.ts`의 `AdminProjectDetail`에:

```ts
  /** 운영자 전용. 개설자에게 보이지 않는다 — `reviewNote`와 헷갈리지 말 것. */
  internalNote: string | null;
```

`loadProjectForAdmin`의 반환 객체에 `internalNote: row.project.internalNote,`를 더한다. **스프레드를 쓰지 않는다**(이 파일의 관례).

- [ ] **Step 4: API 액션을 더한다**

`pages/api/admin/funding/projects/[id].ts`의 `set_review_note` 블록 **바로 아래**에:

```ts
  /**
   * 운영자 전용 메모. `set_review_note`와 달리 개설자에게 보이지 않으므로 빈 값을 막지
   * 않는다 — 여기 적힌 것은 증거가 아니라 운영 메모다.
   */
  if (b.action === 'set_internal_note') {
    const project = await loadProjectForAdmin(id);
    if (!project) return res.status(404).json({ ok: false, message: '프로젝트를 찾을 수 없습니다.' });
    const note = typeof b.note === 'string' ? b.note.trim() || null : null;
    await getDb().update(fundingProjects).set({ internalNote: note, updatedAt: now }).where(eq(fundingProjects.id, id));
    return res.status(200).json({ ok: true });
  }
```

- [ ] **Step 5: API 테스트**

`tests/api/admin/funding/projects.test.ts`:

```ts
it('set_internal_note는 개설자에게 보이는 메모를 건드리지 않는다', async () => {
  const { req, res } = mockPatch({ action: 'set_internal_note', note: '내부 기록' });
  await handler(req, res);
  expect(res._getStatusCode()).toBe(200);

  const [row] = await getDb().select().from(fundingProjects).where(eq(fundingProjects.id, projectId));
  expect(row.internalNote).toBe('내부 기록');
  expect(row.reviewNote).toBe(REVIEW_NOTE_BEFORE);
});

it('set_internal_note는 반려 상태에서도 빈 값을 받는다 — 증거가 아니라 메모다', async () => {
  const { req, res } = mockPatch({ action: 'set_internal_note', note: '' });
  await handler(req, res);
  expect(res._getStatusCode()).toBe(200);
});
```

`mockPatch`·`REVIEW_NOTE_BEFORE`는 그 파일의 기존 헬퍼·상수를 따른다.

- [ ] **Step 6: 심사 화면에 칸 두 개**

`components/admin/fundingProjectActions.ts`에 `set_internal_note`를 보낼 수 있게 타입을 넓힌다(기존 `patchFundingProject`의 인자 타입).

`pages/admin/funding/projects/[id].tsx`의 메모 영역을 두 칸으로 나눈다. **라벨은 사실대로 적고, 색을 다르게 한다:**

```tsx
<div className="mb-6">
  <h2 className="text-lg font-bold text-gray-900 mb-1">개설자에게 보이는 메모</h2>
  <p className="mb-2 text-sm text-amber-700">
    개설자 화면과 메일에 그대로 나갑니다. 보완 요청·반려·보관 사유도 이 칸을 씁니다 —
    저장하면 방금 보낸 사유를 덮어쓸 수 있습니다.
  </p>
  {/* 기존 reviewNote textarea와 저장 버튼 그대로 */}
</div>

<div className="mb-6 rounded-lg border border-gray-300 bg-gray-50 p-4">
  <h2 className="text-lg font-bold text-gray-900 mb-1">내부 기록</h2>
  <p className="mb-2 text-sm text-gray-600">개설자에게 보이지 않습니다.</p>
  {/* internalNote textarea + 저장 버튼, action: 'set_internal_note' */}
</div>
```

두 칸의 상태(`useState`)를 각각 둔다. 저장은 기존 `run(task, successMessage)` 헬퍼를 그대로 쓴다.

- [ ] **Step 7: 화면 테스트**

`tests/pages/admin/funding/projectsDetailReview.test.tsx`:

```tsx
it('두 메모 칸은 개설자에게 보이는지를 서로 다르게 말한다', () => {
  render(<AdminFundingProjectDetailPage project={PROJECT} />);
  expect(screen.getByText('개설자에게 보이는 메모')).toBeInTheDocument();
  expect(screen.getByText('개설자에게 보이지 않습니다.')).toBeInTheDocument();
});

it('내부 기록 저장은 set_internal_note로 나간다', async () => {
  (patchFundingProject as jest.Mock).mockResolvedValue({ ok: true });
  render(<AdminFundingProjectDetailPage project={PROJECT} />);
  fireEvent.change(screen.getByLabelText('내부 기록'), { target: { value: '메모' } });
  fireEvent.click(screen.getByRole('button', { name: '내부 기록 저장' }));
  expect(patchFundingProject).toHaveBeenCalledWith('proj-1', { action: 'set_internal_note', note: '메모' });
  expect(await screen.findByText(/저장했습니다/)).toBeInTheDocument();
});
```

`PROJECT` 픽스처에 `internalNote: null`을 더해야 타입이 맞는다. 라벨·버튼 이름은 Step 6에서 실제로 쓴 문자열과 **정확히** 맞춘다.

- [ ] **Step 8: 전체 검증과 커밋**

```
npm run type-check
npm run lint
npm test
env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN npm run build
```

빌드 필수 — `pages/`·`components/`를 건드렸다.

```bash
git add lib/funding/adminProjects.ts lib/funding/adminProjects.integration.test.ts \
        lib/funding/creatorProjectWrite.integration.test.ts \
        'pages/api/admin/funding/projects/[id].ts' tests/api/admin/funding/projects.test.ts \
        'pages/admin/funding/projects/[id].tsx' components/admin/fundingProjectActions.ts \
        tests/pages/admin/funding/projectsDetailReview.test.tsx
git commit -m "$(cat <<'MSG'
feat(funding-admin): 심사 화면에 내부 기록 칸을 따로 둔다

set_internal_note 액션과 심사 화면의 두 번째 메모 칸. 라벨이 사실대로 말한다 —
"개설자에게 보이는 메모"와 "내부 기록(개설자에게 보이지 않습니다)".

내부 메모는 관리자 조회에만 싣고 개설자 조회에는 어떤 경로로도 싣지 않는다. 그
사실을 creatorProjectWrite.integration.test.ts가 고정한다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
MSG
)"
```

---

### Task 5: 승인 뒤 수정 경로 — 서버 규칙

**Files:**
- Modify: `lib/funding/reviewTransition.ts` (구획별 편집 표)
- Modify: `lib/funding/reviewTransition.test.ts` (전수 조합)
- Modify: `lib/funding/creatorProjectWrite.ts` (`guard`를 구획 인자로, 기본정보 필드 가드, `creatorEditedAt` 기록)
- Modify: `pages/api/funding/creator/upload.ts:86` 부근
- Test: `lib/funding/creatorProjectWrite.integration.test.ts`, `tests/api/funding/creator/upload.test.ts`

**Interfaces:**
- Consumes: Task 3의 `fundingProjects.creatorEditedAt`
- Produces:
  - `type CreatorSectionName = 'basic' | 'story' | 'rewards'` — `lib/funding/reviewTransition.ts`
  - `canCreatorEditSection(status: FundingReviewStatus, section: CreatorSectionName): boolean`
  - `canCreatorEdit(status)` — **유지한다.** "어느 구획이든 하나는 열려 있는가"의 뜻으로 바꾸고 주석에 그렇게 적는다. `upload.ts`와 `components/funding/creator/types.ts`의 진리표 테스트가 이 이름을 쓴다.

**배경**: `guard`가 `canCreatorEdit(reviewStatus)` 불리언 하나로 네 구획을 통째로 열고 닫는다. `approved`는 닫힘이라 승인 뒤에는 개설자가 아무것도 못 고치고, 운영자에게도 경로가 없다. 그런데 개설자 화면은 "운영자에게 문의해 주세요"라고 안내한다 — 가리키는 곳이 없는 안내다.

개설자 구획(계정 프로필)은 프로젝트가 아니라 계정 소속이라 이 표를 **타지 않는다**(3차 결정). 이름 잠금은 Task 1의 규칙이 따로 본다.

- [ ] **Step 1: 전수 조합 테스트를 쓴다**

`lib/funding/reviewTransition.test.ts`:

```ts
import { canCreatorEdit, canCreatorEditSection, type CreatorSectionName } from './reviewTransition';

const STATUSES = ['draft', 'submitted', 'changes_requested', 'approved', 'rejected'] as const;
const SECTIONS: CreatorSectionName[] = ['basic', 'story', 'rewards'];

describe('canCreatorEditSection 전수 조합', () => {
  const EXPECTED: Record<string, CreatorSectionName[]> = {
    draft: ['basic', 'story', 'rewards'],
    changes_requested: ['basic', 'story', 'rewards'],
    // 승인 뒤에는 본문과 기본정보만. 기본정보 안에서 무엇이 잠기는지는 필드 가드가 본다
    // (slug·목표금액·모금 기간은 잠기고 제목·요약·표지는 열린다).
    approved: ['basic', 'story'],
    submitted: [],
    rejected: [],
  };

  it.each(STATUSES)('%s의 열린 구획이 표와 같다', (status) => {
    const open = SECTIONS.filter((s) => canCreatorEditSection(status, s));
    expect(open).toEqual(EXPECTED[status]);
  });
});

describe('canCreatorEdit', () => {
  it('구획이 하나라도 열려 있으면 true다', () => {
    expect(canCreatorEdit('approved')).toBe(true);
    expect(canCreatorEdit('submitted')).toBe(false);
    expect(canCreatorEdit('rejected')).toBe(false);
  });
});
```

⚠️ `canCreatorEdit('approved')`가 **false에서 true로 바뀐다.** 기존 진리표 테스트(`reviewTransition.test.ts`와 `components/funding/creator/types.test.ts`)가 깨진다 — 그것이 이 태스크의 의도다. 두 곳의 기대를 함께 고친다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npx jest lib/funding/reviewTransition.test.ts`
Expected: FAIL — `canCreatorEditSection is not a function`

- [ ] **Step 3: 표를 더한다**

`lib/funding/reviewTransition.ts`:

```ts
/** 개설자 편집 화면의 프로젝트 구획. 개설자 계정 프로필은 프로젝트가 아니라 계정 소속이라 빠진다. */
export type CreatorSectionName = 'basic' | 'story' | 'rewards';

/**
 * 상태별로 개설자가 고칠 수 있는 구획.
 *
 * 승인 뒤 본문을 여는 이유: 3차까지는 승인되면 오탈자 하나도 못 고쳤고, 개설자 화면은
 * "운영자에게 문의해 주세요"라고 안내하는데 운영자에게도 경로가 없었다. 재심사 대기열을
 * 만들지 않는다 — 오탈자 하나에 심사를 기다리게 하는 것이 더 나쁘다. 대신 고칠 때마다
 * `creatorEditedAt`을 찍고 운영자에게 알린다.
 *
 * 리워드는 승인 뒤 통째로 잠긴다. **설명글까지** 잠그는 이유는 그것이 후원자가 보고
 * 결제한 약속이기 때문이다 — "CD 1장 + 포스터"가 후원 뒤에 "CD 1장"이 되면 후원자 약관
 * 제8조의 "표시·광고와 다르게 이행"에 걸리고, 판매자인 스튜디오가 3개월짜리 청약철회를
 * 받는다.
 *
 * `basic`이 승인 뒤에도 열려 있는 것은 구획 단위 판정일 뿐이다 — 그 안에서 slug·목표금액·
 * 모금 기간은 `basicLockedViolation`이 따로 잠근다.
 */
const EDITABLE_SECTIONS: Record<FundingReviewStatus, readonly CreatorSectionName[]> = {
  draft: ['basic', 'story', 'rewards'],
  changes_requested: ['basic', 'story', 'rewards'],
  approved: ['basic', 'story'],
  submitted: [],
  rejected: [],
};

export const canCreatorEditSection = (status: FundingReviewStatus, section: CreatorSectionName): boolean =>
  EDITABLE_SECTIONS[status]?.includes(section) ?? false;

/**
 * 구획이 하나라도 열려 있는가. 업로드 라우트처럼 "지금 이 프로젝트를 편집 중인가"만
 * 알면 되는 자리가 쓴다. 구획별 판정이 필요하면 `canCreatorEditSection`을 쓸 것.
 */
export const canCreatorEdit = (status: FundingReviewStatus): boolean =>
  (EDITABLE_SECTIONS[status]?.length ?? 0) > 0;
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx jest lib/funding/reviewTransition.test.ts`
Expected: PASS

- [ ] **Step 5: `guard`를 구획별로 만든다**

`lib/funding/creatorProjectWrite.ts`:

```ts
const guard = async (creatorId: string, projectId: string, section: CreatorSectionName) => {
  const [row] = await getDb().select().from(fundingProjects)
    .where(and(eq(fundingProjects.id, projectId), eq(fundingProjects.creatorId, creatorId))).limit(1);
  if (!row) return { row: null, denial: deny('not_found', '프로젝트를 찾을 수 없습니다.') };
  if (!canCreatorEditSection(row.reviewStatus, section)) {
    return { row, denial: deny('not_editable', '지금 상태에서는 이 항목을 고칠 수 없습니다.') };
  }
  return { row, denial: null };
};
```

호출부 세 곳을 고친다 — `saveBasicSection`은 `'basic'`, `saveStorySection`은 `'story'`, `upsertReward`·리워드 삭제 경로는 `'rewards'`.

- [ ] **Step 6: 기본정보 필드 가드**

`lockedViolation`(리워드)과 **같은 꼴로** 같은 파일에:

```ts
/**
 * 승인된 프로젝트의 기본정보에서 바뀌면 안 되는 것.
 *
 * 구획 자체는 열려 있다(제목·요약·표지를 고칠 수 있어야 한다 — 잘못 올라간 표지가 영영
 * 남는 것을 막는다). 하지만 아래 셋은 후원자와의 약속이거나 이미 공개된 주소다.
 */
const basicLockedViolation = (
  existing: typeof fundingProjects.$inferSelect,
  next: BasicSection,
): string | null => {
  if (existing.reviewStatus !== 'approved') return null;
  if (existing.slug !== next.slug) {
    return '공개된 프로젝트의 주소는 바꿀 수 없습니다. 후원자가 후원 확인 페이지에서 이 주소로 프로젝트를 찾습니다.';
  }
  if (existing.goalAmount !== next.goalAmount) return '공개된 프로젝트의 목표 금액은 바꿀 수 없습니다.';
  if (existing.startAt.getTime() !== next.startAt.getTime()
    || existing.endAt.getTime() !== next.endAt.getTime()) {
    return '공개된 프로젝트의 모금 기간은 바꿀 수 없습니다.';
  }
  return null;
};
```

`saveBasicSection`에서 `guard` 직후, slug 중복 검사 **앞에** 건다:

```ts
  const locked = basicLockedViolation(row!, value);
  if (locked) return deny('locked', locked);
```

- [ ] **Step 7: 승인 뒤 저장은 `creatorEditedAt`을 찍는다**

`saveBasicSection`·`saveStorySection`의 UPDATE에:

```ts
  const now = new Date();
  // 승인된 뒤의 저장만 찍는다. updated_at으로는 알 수 없다 — 관리자 쓰기도 그 값을
  // 갱신하므로 운영자가 메모만 달아도 "개설자가 고쳤다"로 보인다.
  const editedAt = row!.reviewStatus === 'approved' ? { creatorEditedAt: now } : {};

  await getDb().update(fundingProjects).set({
    /* …기존 필드… */ updatedAt: now, ...editedAt,
  }).where(eq(fundingProjects.id, row!.id));
```

- [ ] **Step 8: 업로드 라우트**

`pages/api/funding/creator/upload.ts:86` 부근은 `canCreatorEdit`을 쓴다. 승인 뒤 표지와 본문 이미지를 고칠 수 있어야 하므로 **그대로 두면 맞다**(`canCreatorEdit('approved')`가 이제 true다). 주석에 그 사실을 적는다:

```ts
  // 승인 뒤에도 본문·표지는 고칠 수 있으므로(reviewTransition.ts의 EDITABLE_SECTIONS)
  // 업로드도 열려 있어야 한다. 구획 단위 판정이 필요한 자리가 아니다 — 업로드는
  // "지금 이 프로젝트를 편집 중인가"만 알면 된다.
```

`tests/api/funding/creator/upload.test.ts:96`의 기대가 바뀐다 — `approved`가 이제 통과한다. 그 케이스를 고치고, `submitted`·`rejected`가 여전히 409인 것을 남긴다.

- [ ] **Step 9: 통합 테스트**

`lib/funding/creatorProjectWrite.integration.test.ts`:

```ts
it('승인된 프로젝트의 본문은 고칠 수 있고 creatorEditedAt이 찍힌다', async () => {
  const { creatorId, projectId } = await seedProject({ reviewStatus: 'approved' });

  const result = await saveStorySection(creatorId, projectId, { content: '고친 본문' });

  expect(result.ok).toBe(true);
  const [row] = await getDb().select().from(fundingProjects).where(eq(fundingProjects.id, projectId));
  expect(row.content).toBe('고친 본문');
  expect(row.creatorEditedAt).not.toBeNull();
});

it('초안 저장은 creatorEditedAt을 찍지 않는다', async () => {
  const { creatorId, projectId } = await seedProject({ reviewStatus: 'draft' });
  await saveStorySection(creatorId, projectId, { content: '초안 본문' });
  const [row] = await getDb().select().from(fundingProjects).where(eq(fundingProjects.id, projectId));
  expect(row.creatorEditedAt).toBeNull();
});

it('승인된 프로젝트의 제목·표지는 고칠 수 있다', async () => {
  const { creatorId, projectId, basic } = await seedApprovedWithBasic();
  const result = await saveBasicSection(creatorId, projectId, { ...basic, title: '고친 제목' });
  expect(result.ok).toBe(true);
});

it.each([
  ['slug', { slug: 'other-slug' }, '주소는 바꿀 수 없습니다'],
  ['goalAmount', { goalAmount: 9_999_999 }, '목표 금액은 바꿀 수 없습니다'],
  ['endAt', { endAt: new Date('2027-01-01T00:00:00+09:00') }, '모금 기간은 바꿀 수 없습니다'],
])('승인된 프로젝트의 %s는 잠긴다', async (_label, patch, expected) => {
  const { creatorId, projectId, basic } = await seedApprovedWithBasic();
  const result = await saveBasicSection(creatorId, projectId, { ...basic, ...patch });
  expect(result).toMatchObject({ ok: false, code: 'locked' });
  expect((result as { message: string }).message).toContain(expected);
});

it('승인된 프로젝트의 리워드는 설명글도 잠긴다', async () => {
  const { creatorId, projectId, reward } = await seedApprovedWithReward();
  const result = await upsertReward(creatorId, projectId, { ...reward, description: '바뀐 설명' });
  expect(result).toMatchObject({ ok: false, code: 'not_editable' });
});
```

`seedApprovedWithBasic`·`seedApprovedWithReward`는 그 파일의 기존 시드 헬퍼를 조합해 만든다. 기존 헬퍼 이름이 다르면 **그것을 쓴다**(새 헬퍼를 만들기 전에 파일을 먼저 읽는다).

- [ ] **Step 10: 검증과 커밋**

```
npm run type-check
npm run lint
npm test
```

```bash
git add lib/funding/reviewTransition.ts lib/funding/reviewTransition.test.ts \
        lib/funding/creatorProjectWrite.ts lib/funding/creatorProjectWrite.integration.test.ts \
        pages/api/funding/creator/upload.ts tests/api/funding/creator/upload.test.ts
git commit -m "$(cat <<'MSG'
feat(funding): 승인 뒤 본문·제목·요약·표지를 개설자가 고칠 수 있게

3차까지는 승인되면 오탈자 하나도 못 고쳤고, 개설자 화면은 "운영자에게 문의해 주세요"라고
안내하는데 운영자에게도 경로가 없었다.

canCreatorEdit 불리언 하나를 구획별 표(EDITABLE_SECTIONS)로 바꾼다. 승인 뒤에는
basic·story만 열리고, basic 안에서도 basicLockedViolation이 주소·목표 금액·모금
기간을 잠근다. 리워드는 설명글까지 통째로 잠긴다 — 후원자가 보고 결제한 약속이라
바뀌면 후원자 약관 제8조에 걸린다.

승인 뒤 저장은 creator_edited_at을 찍는다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
MSG
)"
```

---

### Task 6: 승인 뒤 수정 경로 — 화면과 알림

**Files:**
- Modify: `components/funding/creator/types.ts` (구획별 편집 + 안내 문구)
- Modify: `components/funding/creator/types.test.ts` (진리표 대조)
- Modify: `pages/[locale]/funding/creator/[id].tsx` (구획별 `readOnly`)
- Modify: `components/funding/creator/BasicSectionForm.tsx` (필드 단위 잠금)
- Modify: `lib/funding/reviewEmail.ts` (운영자 수정 알림)
- Modify: `pages/api/funding/creator/projects/[id].ts` (저장 뒤 알림 호출)
- Modify: `lib/funding/adminProjects.ts` + `pages/admin/funding/projects/[id].tsx` ("승인 뒤 수정됨" 표시)
- Test: `components/funding/creator/types.test.ts`, `tests/pages/admin/funding/projectsDetailReview.test.tsx`, `lib/funding/reviewEmail.test.ts`

**Interfaces:**
- Consumes: Task 5의 `canCreatorEditSection`·`CreatorSectionName`, Task 3의 `creatorEditedAt`
- Produces:
  - `canEditSectionInBrowser(reviewStatus: string, section: CreatorSectionName): boolean` — `components/funding/creator/types.ts`
  - `sendCreatorEditedNotice(project: AdminProjectDetail): Promise<string | null>` — `lib/funding/reviewEmail.ts`
  - `AdminProjectDetail.creatorEditedAt: string | null` (ISO 문자열)

⚠️ `components/funding/creator/types.ts`는 **클라이언트 번들에 들어간다.** `lib/funding/reviewTransition.ts`를 값으로 import하면 `db/schema`가 딸려 온다 — 그 파일의 기존 주석이 그래서 리터럴로 다시 적어 뒀다고 설명한다. **같은 방식을 유지한다**: 표를 리터럴로 복제하고, `types.test.ts`의 진리표 대조 테스트가 두 자리를 묶는다.

- [ ] **Step 1: 진리표 대조 테스트를 확장한다**

`components/funding/creator/types.test.ts`:

```ts
import { canCreatorEditSection, type CreatorSectionName } from '../../../lib/funding/reviewTransition';
import { canEditSectionInBrowser } from './types';

const STATUSES = ['draft', 'submitted', 'changes_requested', 'approved', 'rejected'] as const;
const SECTIONS: CreatorSectionName[] = ['basic', 'story', 'rewards'];

describe('canEditSectionInBrowser ↔ canCreatorEditSection 진리표 대조', () => {
  it.each(STATUSES.flatMap((s) => SECTIONS.map((sec) => [s, sec] as const)))(
    '%s × %s',
    (status, section) => {
      expect(canEditSectionInBrowser(status, section)).toBe(canCreatorEditSection(status, section));
    },
  );
});
```

- [ ] **Step 2: 실패를 확인하고 구현한다**

Run: `npx jest components/funding/creator/types.test.ts` → FAIL

`components/funding/creator/types.ts`:

```ts
export type CreatorSectionName = 'basic' | 'story' | 'rewards';

/**
 * `lib/funding/reviewTransition.ts`의 `EDITABLE_SECTIONS`를 리터럴로 옮긴 것.
 *
 * 그 파일은 `db/schema`를 값으로 import해 클라이언트 번들에 DB 스키마 코드를 끌어들이므로
 * 여기서 다시 적는다. 두 자리가 갈리지 않도록 `types.test.ts`가 상태 × 구획 전수 조합을
 * 대조한다.
 */
const EDITABLE_SECTIONS: Record<string, readonly CreatorSectionName[]> = {
  draft: ['basic', 'story', 'rewards'],
  changes_requested: ['basic', 'story', 'rewards'],
  approved: ['basic', 'story'],
  submitted: [],
  rejected: [],
};

export const canEditSectionInBrowser = (reviewStatus: string, section: CreatorSectionName): boolean =>
  EDITABLE_SECTIONS[reviewStatus]?.includes(section) ?? false;
```

`EDITABLE_REVIEW_STATUSES`·`canEditInBrowser`는 소비처를 확인하고 정리한다 — 남길 거면 `canEditSectionInBrowser` 위에서 파생시켜 두 벌이 되지 않게 한다.

`REVIEW_STATUS_NOTICE.approved`를 사실에 맞게 고친다. 지금 문구("내용을 고치려면 운영자에게 문의해 주세요")는 **가리키는 곳이 없다**:

```ts
  approved: '공개된 프로젝트입니다. 본문과 제목·요약·표지는 지금도 고칠 수 있고, 고치면 운영자에게 알림이 갑니다. 주소·목표 금액·모금 기간과 리워드는 후원자와의 약속이라 바꿀 수 없습니다.',
```

- [ ] **Step 3: 편집 화면을 구획별로 연다**

`pages/[locale]/funding/creator/[id].tsx`의 `const readOnly = !canEditInBrowser(project.reviewStatus);`를 구획별로 바꾼다:

```tsx
  const ro = (section: CreatorSectionName) => !canEditSectionInBrowser(project.reviewStatus, section);
```

각 폼에 `readOnly={ro('basic')}` / `ro('story')` / `ro('rewards')`를 넘긴다.

`CreatorSectionForm`(계정 프로필)은 이 표를 타지 않는다 — **항상 편집 가능**하다. 다만 이름은 서버가 잠글 수 있으므로(Task 1) 저장 실패 메시지가 그대로 뜨면 된다. 지금 `readOnly={readOnly}`로 묶여 있으면 **풀어 준다**.

심사 신청 버튼의 `disabled`는 `ro('basic')`를 쓴다(신청은 초안·보완요청에서만 가능하고 그 두 상태에서 basic이 열려 있다).

- [ ] **Step 4: 기본정보 폼의 필드 단위 잠금**

`components/funding/creator/BasicSectionForm.tsx`에 prop을 더한다:

```tsx
/** 승인 뒤에는 구획은 열려 있지만 주소·목표 금액·모금 기간은 잠긴다(서버의 basicLockedViolation과 같은 규칙). */
lockedFields?: boolean;
```

`pages/[locale]/funding/creator/[id].tsx`가 `lockedFields={project.reviewStatus === 'approved'}`를 넘긴다.

폼 안에서 `slug`·`goalAmount`·`startAt`·`endAt` 입력에 `disabled={readOnly || lockedFields}`를 걸고, 그 아래에 **이유를 보이는 텍스트로** 적는다(툴팁 금지 — 3차 리뷰에서 같은 지적을 받았다):

```tsx
{lockedFields && (
  <p className="mt-1 text-xs text-gray-600">
    공개된 뒤에는 바꿀 수 없습니다 — 후원자가 이 주소로 프로젝트를 찾고, 모금 기간과 목표
    금액은 후원자와의 약속입니다.
  </p>
)}
```

- [ ] **Step 5: 운영자 수정 알림**

`lib/funding/reviewEmail.ts`:

```ts
/**
 * 승인된 프로젝트를 개설자가 고쳤을 때의 운영자 알림.
 *
 * 승인 뒤 본문 편집은 심사를 거치지 않는다(재심사 대기열을 만들지 않기로 했다) — 그래서
 * 운영자가 "무엇이 바뀌었는지"를 알 유일한 경로가 이 메일과 심사 화면의 표시다.
 */
export const sendCreatorEditedNotice = async (project: AdminProjectDetail): Promise<string | null> => {
  const result = await sendEmail({
    to: OPERATOR_EMAIL,
    subject: `[펀딩] 공개된 프로젝트가 수정되었습니다 — ${project.title}`,
    text: [
      '개설자가 공개된 프로젝트의 내용을 고쳤습니다. 심사를 거치지 않는 경로입니다.',
      '',
      `프로젝트: ${project.title} (id: ${project.id})`,
      `개설자: ${project.creatorName} <${project.creatorEmail}>`,
      `공개 주소: ${publicUrl(project.slug)}`,
      '',
      `관리자 심사 화면: ${adminReviewUrl(project.id)}`,
      '',
      '고친 내용이 문제가 되면 심사 화면의 "개설자에게 보이는 메모"로 연락하거나,',
      '공개를 닫아야 하면 프로젝트 상태를 종료로 바꿔 주세요.',
    ].join('\n'),
  });
  return result.ok ? null : `operator:${result.errorCode}`;
};
```

마지막 두 줄은 **실제로 있는 경로만** 적는다. 관리자 화면에 상태를 종료로 바꾸는 버튼이 없으면 그 문장을 빼고 있는 것만 쓴다 — 확인하고 쓸 것.

- [ ] **Step 6: 저장 라우트가 알림을 부른다**

`pages/api/funding/creator/projects/[id].ts`에서 `saveBasicSection`·`saveStorySection`이 성공하고 **그 프로젝트가 `approved`일 때만**:

```ts
  // 매 저장마다 보내면 메일이 쏟아진다. 창 안의 나머지 저장은 보내지 않는다 — 합쳐서
  // 보내는 것이 아니라 억제한다. 운영자가 놓치면 안 되는 것은 메일이 아니라 심사 화면의
  // "승인 뒤 수정됨" 표시이고, 메일은 그 화면을 보러 가라는 신호일 뿐이다.
  if (wasApproved && await consumeRateLimit(`funding_creator_edit:${projectId}`, 1, 3600)) {
    const detail = await loadProjectForAdmin(projectId);
    if (detail) {
      const error = await sendCreatorEditedNotice(detail);
      if (error) console.error('[funding] 개설자 수정 알림 실패:', error);
    }
  }
```

`wasApproved`는 저장 **전** 상태를 봐야 한다 — `saveBasicSection`이 상태를 바꾸지는 않지만, 읽는 순서를 분명히 해 둔다. 알림 실패는 저장을 실패시키지 않는다.

⚠️ `loadProjectForAdmin`은 **관리자 조회**다. 개설자 라우트에서 부르되 그 결과를 **응답에 싣지 않는다**(정산·내부 메모가 들어 있다). 메일 함수에만 넘긴다. 이 사실을 주석으로 적는다.

- [ ] **Step 7: 심사 화면에 "승인 뒤 수정됨"**

`lib/funding/adminProjects.ts`의 `AdminProjectDetail`(또는 `AdminProjectSummary` — 목록에도 보이면 유용하다)에:

```ts
  /** 개설자가 승인 뒤에 마지막으로 고친 시각. null이면 승인 후 고친 적이 없다. */
  creatorEditedAt: string | null;
```

`toSummary`/`loadProjectForAdmin`에 `creatorEditedAt: row.creatorEditedAt?.toISOString() ?? null,`.

`pages/admin/funding/projects/[id].tsx`에 표시:

```tsx
{project.creatorEditedAt && (
  <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
    승인 뒤 개설자가 수정했습니다 — 마지막 수정 {formatKstDateTimeFull(project.creatorEditedAt)}
  </p>
)}
```

`formatKstDateTimeFull`은 3차에서 쓰던 그 함수다(분 단위를 버리지 않는 쪽).

화이트리스트 테스트가 완전 일치라 키를 더하면 빨개진다 — 목록을 갱신한다.

- [ ] **Step 8: 화면·메일 테스트**

```tsx
it('승인 뒤 수정된 프로젝트는 심사 화면이 그 사실을 말한다', () => {
  render(<AdminFundingProjectDetailPage project={{ ...PROJECT, creatorEditedAt: '2026-09-21T05:00:00.000Z' }} />);
  expect(screen.getByText(/승인 뒤 개설자가 수정했습니다/)).toBeInTheDocument();
});

it('수정된 적 없으면 그 표시가 없다', () => {
  render(<AdminFundingProjectDetailPage project={{ ...PROJECT, creatorEditedAt: null }} />);
  expect(screen.queryByText(/승인 뒤 개설자가 수정했습니다/)).not.toBeInTheDocument();
});
```

`lib/funding/reviewEmail.test.ts`에 수정 알림이 **개설자 인증 페이지가 아니라 관리자 화면**으로 링크하는지 단언한다(3차에서 같은 실수가 났다):

```ts
it('수정 알림은 관리자 심사 화면으로 링크한다', async () => {
  await sendCreatorEditedNotice(PROJECT);
  const text = (sendEmail as jest.Mock).mock.calls[0][0].text as string;
  expect(text).toContain('/admin/funding/projects/proj-1');
  expect(text).not.toContain('/ko/funding/creator/proj-1');
});
```

- [ ] **Step 9: 전체 검증과 커밋**

```
npm run type-check
npm run lint
npm test
env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN npm run build
```

빌드 필수 — `pages/`·`components/`를 크게 건드렸다. 특히 `components/funding/creator/types.ts`가 `lib/funding/reviewTransition.ts`를 **값으로** import하지 않는지 빌드로 확인한다.

```bash
git add components/funding/creator/types.ts components/funding/creator/types.test.ts \
        components/funding/creator/BasicSectionForm.tsx \
        'pages/[locale]/funding/creator/[id].tsx' 'pages/api/funding/creator/projects/[id].ts' \
        lib/funding/reviewEmail.ts lib/funding/reviewEmail.test.ts \
        lib/funding/adminProjects.ts lib/funding/adminProjects.integration.test.ts \
        'pages/admin/funding/projects/[id].tsx' tests/pages/admin/funding/projectsDetailReview.test.tsx
git commit -m "$(cat <<'MSG'
feat(funding): 승인 뒤 편집 화면과 운영자 알림

편집 화면이 구획별로 열린다. 기본정보 폼은 주소·목표 금액·모금 기간을 비활성화하고
그 이유를 보이는 텍스트로 적는다(툴팁이 아니라).

승인된 프로젝트의 안내 문구를 사실에 맞게 고친다 — "운영자에게 문의해 주세요"는
가리키는 곳이 없는 안내였다.

고치면 운영자에게 메일이 가고 심사 화면에 "승인 뒤 개설자가 수정했습니다"가 뜬다.
메일은 프로젝트별 창당 한 통만 보낸다 — 운영자가 놓치면 안 되는 것은 메일이 아니라
그 화면 표시다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
MSG
)"
```

---

### Task 7: 전체 검증과 문서

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-09-18-funding-creator-debt-design.md`

- [ ] **Step 1: 전체 검사**

```
npm run generate:manifests
npm run type-check
npm run lint
npm test
env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN npm run build
```

`generate:manifests`가 파일을 바꾸면 그 변경도 커밋한다(바꾸지 않는 것이 정상이다).

개별로 확인: `lib/funding/reviewTransition.test.ts`, `components/funding/creator/types.test.ts`, `lib/funding/creatorProjectWrite.integration.test.ts`, `content/fundingTerms.baseline.test.ts`, `content/creatorTerms.baseline.test.ts`.

**약관 게이트 두 개가 초록이어야 한다** — 이번 계획은 약관 본문을 건드리지 않았으므로 판본이 그대로여야 정상이다.

- [ ] **Step 2: 공개 화면 불변 확인**

빌드 산출물에서 마크다운 프로젝트가 그대로인지 확인한다:

```bash
grep -c "개설자" .next/server/pages/ko/funding/keep-singing-for-palestine.html
```

Expected: `0`

그리고 `git diff origin/main --stat -- 'pages/[locale]/funding/[slug].tsx' components/funding/ProjectDetailView.tsx`가 비어 있는지 본다 — 공개 상세 컴포넌트를 건드리지 않은 것이 이 계획의 전제다.

- [ ] **Step 3: `CLAUDE.md`에 규칙을 더한다**

"승인은 세 가지를 한 묶음으로 한다" 절 **뒤에** 붙인다:

```markdown
### 승인 뒤에 열리는 것과 잠기는 것

`lib/funding/reviewTransition.ts`의 `EDITABLE_SECTIONS`가 상태별로 개설자가 고칠 수 있는
구획을 정한다. 승인 뒤에는 **본문과 기본정보만** 열리고, 기본정보 안에서도
`basicLockedViolation`이 주소·목표 금액·모금 기간을 잠근다. 리워드는 **설명글까지** 통째로
잠긴다 — 후원자가 보고 결제한 약속이라, 바뀌면 후원자 약관 제8조의 "표시·광고와 다르게
이행"에 걸리고 판매자인 스튜디오가 3개월짜리 청약철회를 받는다.

이 표는 **두 군데에 있다.** `components/funding/creator/types.ts`가 같은 표를 리터럴로
복제한다 — `reviewTransition.ts`는 `db/schema`를 값으로 import해 클라이언트 번들에 DB
스키마를 끌어들이기 때문이다. `types.test.ts`가 상태 × 구획 전수 조합을 대조하므로 한쪽만
고치면 CI가 선다.

승인 뒤 편집은 **심사를 거치지 않는다.** 그래서 `creator_edited_at`을 찍고 운영자에게
메일을 보낸다. `updated_at`으로는 알 수 없다 — 관리자 쓰기(`set_review_note` 등)도 그 값을
갱신하므로 운영자가 메모만 달아도 "개설자가 고쳤다"로 보인다.

### `review_note`와 `internal_note`는 다른 칸이다

`review_note`는 **개설자에게 보인다**(화면 두 곳 + 메일). 보완 요청 사유·반려 사유·보관
사유가 전부 이 칸을 쓰고 서로 덮어쓴다. `internal_note`는 운영자 전용이고 개설자 조회에
어떤 경로로도 실리지 않는다 — `creatorProjectWrite.integration.test.ts`가 그것을 고정한다.

### 개설자 이름 기본값은 "미설정"이다

가입은 `name: email.split('@')[0]`으로 이름을 **채운다**(`lib/funding/creatorToken.ts`).
채워져 있어 미설정을 감지할 수 없었고, 3차가 그 값을 공개 상세의 판매자 표시 옆에 그리고
동시에 잠그면서 "개설자 hwangtab"이 영영 남는 경로가 생겼다. `isDefaultCreatorName`
(`lib/funding/creatorValidation.ts`)이 그 값을 미설정으로 판정하고, 심사 신청·승인이 막고,
이름 잠금도 걸리지 않는다(설정한 적 없는 값을 잠그는 것은 잠금이 아니라 사고다).
```

- [ ] **Step 4: 스펙을 갱신한다**

`docs/superpowers/specs/2026-09-18-funding-creator-debt-design.md`의 §10 구현 순서에 완료 표시를 하고, 5차로 넘어가는 것을 적는다(정산 — 수수료율 5.5% 부가세 포함 확정, 개설자 통계, 배송지 전달 경로와 처리방침 개정, 고아 blob 정리, 리워드 순서 변경).

- [ ] **Step 5: 커밋**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-09-18-funding-creator-debt-design.md
git commit -m "$(cat <<'MSG'
docs(funding): 승인 뒤 편집 규칙·두 메모 칸·이름 기본값을 CLAUDE.md에

스펙 §10의 구현 순서에 완료 표시를 하고 5차로 넘어가는 것을 적는다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
MSG
)"
```

**푸시하지 않는다.** 컨트롤러가 전체 리뷰 뒤에 한 번에 한다.

---

## 배포 전 운영자 확인 항목

PR 본문에 반드시 적을 것:

1. **마이그레이션(`drizzle/migrations/0019_breezy_pride.sql`, `internal_note`·`creator_edited_at` 컬럼 추가)을 배포보다 먼저 적용한다.** 컬럼 추가는 옛 코드에 무해하므로 먼저 적용해도 아무것도 안 깨진다 — 반대 순서(배포 먼저)로 하면 문제가 생긴다.

   drizzle의 인자 없는 `select()`는 스키마의 전 컬럼을 SQL에 나열하므로, 이 두 컬럼이 추가된
   코드가 마이그레이션 없이 배포되면 `funding_projects`를 읽는 모든 경로가 `no such column`으로
   실패한다. 경로별 영향은 이렇다(실제 코드로 대조):

   - **공개 상세**(`lib/funding/repository.ts`의 `getFundingProjectAsync` → `dbProjects.ts`의
     `getDbFundingProject`)와 **공개 목록**(`getAllFundingProjectsAsync`)은 `repository.ts`의
     `safeDb`가 DB 오류를 삼키고 `null`/빈 배열로 떨어진다 — **조용히 "없는 프로젝트"가 된다.**
     로그(`console.error`)에만 남고 화면·응답은 정상처럼 보인다.
   - **`/sitemap-funding.xml`**(`pages/sitemap-funding.xml.ts`)도 `listDbFundingProjects` 호출을
     try/catch로 감싸 실패 시 빈 목록으로 200을 낸다 — **DB 프로젝트가 조용히 사이트맵에서
     빠진다.**
   - **개설자 화면 전부**(`lib/funding/creatorProjectList.ts`의 `listProjectsForCreator`,
     `creatorProjectWrite.ts`의 `guard`·`loadProjectForCreator` 등)는 이 오류를 잡는 try/catch가
     없어 그대로 위로 던져지고, 호출하는 API 라우트(`pages/api/funding/creator/projects/*.ts`)도
     감싸지 않으므로 Next.js 기본 처리로 **500이 난다.**
   - **관리자 화면**(`lib/funding/adminProjects.ts`의 조회, `pages/api/admin/funding/projects/[id].ts`)도
     같은 이유로 **500이 난다** — `[id].ts`의 try/catch는 `decideProject`의 슬러그 경합만 잡고
     스키마 오류는 잡지 않는다.

   즉 공개 페이지 쪽은 로그를 보지 않으면 며칠이 지나도 못 알아채고, 개설자·관리자 쪽은
   즉시 500으로 드러난다.
2. **기존 개설자 중 이름이 이메일 로컬파트인 사람은 심사 신청·승인이 막힌다.** 의도된 동작이다(이름을 한 번 저장하면 풀린다). 배포 전 확인:
   ```sql
   SELECT id, email, name FROM funding_creators
    WHERE name = substr(email, 1, instr(email, '@') - 1);
   ```
3. **`canCreatorEdit('approved')`가 false → true로 바뀐다.** 승인된 프로젝트의 개설자가 본문·제목·요약·표지를 고칠 수 있게 된다. 지금 승인된 DB 프로젝트가 있으면 그 개설자에게 알려야 한다.
