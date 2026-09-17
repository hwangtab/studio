# 펀딩 셀프 개설 2차 — 개설자 편집 화면과 심사 신청

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 개설자가 로그인해 프로젝트를 만들고 기본정보·스토리·리워드·개설자 정보를 채워 심사를 신청하는 데까지. 심사·승인·공개는 3차이고, 이 계획이 끝나도 **공개 화면에는 아무것도 나타나지 않는다**(만들어지는 프로젝트는 전부 `reviewStatus: 'draft'`이거나 `'submitted'`이고, 공개 경로는 `'approved'`만 본다).

**Architecture:** 쓰기는 `lib/funding/creatorProjectWrite.ts` 하나로 모으고 모든 함수가 `creatorId`를 인자로 요구한다. 리워드 잠금(`lockedAt`)·예약 slug·개설자 콘텐츠 정책(신뢰 숏코드 제거)은 **쓰기 경로가 생기는 이 계획에서 함께** 들어간다 — 나중에 붙이면 그 사이에 만들어진 데이터가 규칙 밖에 남는다. 화면은 한 페이지 안의 4구획 탭이고, 저장은 구획별 부분 저장이다.

**Tech Stack:** Next.js 15 Pages Router, React 19, Turso(libSQL) + Drizzle, `@vercel/blob`, sharp, iron-session, Jest(단위 + in-memory libSQL 통합).

**Spec:** `docs/superpowers/specs/2026-09-17-funding-self-serve-design.md` (§6.2 편집 화면, §6.3 업로드, §6.4 편집 권한, §10 보안)

## Global Constraints

- 작업 위치: worktree `/Users/hwang-gyeongha/studio-worktrees/funding-editor`, 브랜치 `feat/funding-creator-editor`. 공용 트리 `~/studio`는 건드리지 않는다.
- 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`. 한국어. `git commit -a` 금지.
- **프로덕션 DB를 건드리는 태스크는 없다.** 이 계획은 새 테이블을 만들지 않는다(1차의 0017이 이미 전부 만들었다).
- **공개 경로는 이 계획에서 바뀌지 않는다.** `reviewStatus`를 `'approved'`로 만드는 코드를 쓰지 않는다 — 그건 3차 관리자 심사의 일이다.
- **모든 쓰기 함수는 `creatorId`를 인자로 요구한다.** 소유 조건 없는 조회·수정 함수를 만들지 않는다. 한 번이라도 있으면 언젠가 조건 없이 호출된다.
- 개설자 화면은 전부 `/ko/` 전용, `noindex`, `Cache-Control: no-store`. 7로케일 번역 키를 추가하지 않는다(ko 하드코딩).
- 버튼은 `bg-primary`. 옐로(`kakao` 토큰)는 목적지가 카카오톡인 링크 전용이다.
- 상태 변경은 POST로만. 두 개설자 API가 이미 쓰는 `isAllowedContactRequestOrigin`(`lib/contact/origin.ts`)을 새 API에도 건다 — 개설자 세션 쿠키는 SameSite가 `lax`라 이 검사가 CSRF 방어의 나머지 절반이다.
- **검증 순서(매 태스크)**: `npm run generate:manifests` → `npm run type-check` → `npm run lint` → **`npm test` 전체** → 마지막 태스크에서 `env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN npm run build`.
  - `npm test`를 **전체로** 돌린다. 1차에서 좁은 경로만 돌렸다가 `tests/` 아래 파손을 놓친 적이 있다.
- 통합 테스트는 `/** @jest-environment node */` + in-memory libSQL + `drizzle/migrations` 순차 적용. `lib/funding/creatorProjectList.integration.test.ts`의 부트스트랩을 그대로 베낀다.
- jest.mock 팩토리가 참조하는 변수는 이름이 `mock`으로 시작해야 한다(babel-plugin-jest-hoist).

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `lib/funding/reservedSlugs.ts` (생성) | 예약 slug 집합과 slug 정규화·검사(순수) |
| `lib/funding/creatorContent.ts` (생성) | 개설자 본문에서 신뢰 숏코드·디렉티브 제거(순수) |
| `lib/funding/creatorValidation.ts` (생성) | 구획별 입력 검증(순수) |
| `lib/funding/creatorProjectWrite.ts` (생성) | 프로젝트·리워드 쓰기. 소유 조건과 `lockedAt` 가드가 여기 산다 |
| `lib/funding/reviewTransition.ts` (생성) | 심사 상태 전이(순수). 3차 관리자 판정도 같은 표를 쓴다 |
| `pages/api/funding/creator/projects.ts` (생성) | POST 새 프로젝트 |
| `pages/api/funding/creator/projects/[id].ts` (생성) | POST 구획별 저장 |
| `pages/api/funding/creator/projects/[id]/rewards.ts` (생성) | POST 리워드 추가·수정·삭제·정렬 |
| `pages/api/funding/creator/projects/[id]/submit.ts` (생성) | POST 심사 신청 |
| `lib/funding/mediaPath.ts` (생성) | 프록시 라우트가 받아도 되는 경로 판정(순수) |
| `pages/api/funding/creator/upload.ts` (생성) | POST 이미지 업로드(private Blob + sharp 재인코딩) |
| `pages/api/funding/media/[...path].ts` (생성) | 업로드 이미지 공개 서빙(접두사 안만) |
| `components/funding/creator/*` (생성) | 4구획 폼 컴포넌트 |
| `components/funding/ProjectDetailView.tsx` (생성) | 상세 본문·리워드 합성. 공개 페이지와 미리보기가 공유 |
| `pages/[locale]/funding/creator/[id].tsx` (생성) | 편집 화면 |
| `pages/[locale]/funding/creator/[id]/preview.tsx` (생성) | 미리보기 |
| `pages/[locale]/funding/creator/index.tsx` (수정) | "새 프로젝트" 버튼, 편집 링크, 로그아웃 |
| `components/markdown/MarkdownImage.tsx` (수정) | `?w=&h=` 치수 힌트 지원 |
| `next.config.mjs` (수정) | 새 라우트 `outputFileTracingIncludes` |

---

## Task 1: 예약 slug와 slug 규칙

승인 때 slug를 확정하는 것은 3차지만, 개설자가 2차에서 **희망 slug**를 입력하므로 규칙이 먼저 있어야 한다.

**Files:**
- Create: `lib/funding/reservedSlugs.ts`
- Create: `lib/funding/reservedSlugs.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `RESERVED_FUNDING_SLUGS: ReadonlySet<string>`
  - `normalizeFundingSlug(input: string): string | null`
  - `slugRejectionReason(slug: string): string | null` — 통과면 null, 아니면 사용자에게 보여 줄 한국어 사유

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/funding/reservedSlugs.test.ts`:

```ts
import { normalizeFundingSlug, RESERVED_FUNDING_SLUGS, slugRejectionReason } from './reservedSlugs';

describe('normalizeFundingSlug', () => {
  it('앞뒤 공백을 떼고 소문자로 만든다', () => {
    expect(normalizeFundingSlug('  My-Album  ')).toBe('my-album');
  });
  it('허용 문자가 아니면 null', () => {
    expect(normalizeFundingSlug('내 앨범')).toBeNull();
    expect(normalizeFundingSlug('my_album')).toBeNull();
    expect(normalizeFundingSlug('my album')).toBeNull();
  });
  it('하이픈으로 시작하거나 끝나면 null', () => {
    expect(normalizeFundingSlug('-a')).toBeNull();
    expect(normalizeFundingSlug('a-')).toBeNull();
  });
  it('길이 범위를 벗어나면 null', () => {
    expect(normalizeFundingSlug('ab')).toBeNull();
    expect(normalizeFundingSlug('a'.repeat(81))).toBeNull();
    expect(normalizeFundingSlug('abc')).toBe('abc');
  });
});

describe('slugRejectionReason', () => {
  it('리터럴 라우트와 겹치면 사유를 돌려준다', () => {
    for (const reserved of ['apply', 'creator', 'terms', 'success', 'fail', 'manage', 'pledge']) {
      expect(RESERVED_FUNDING_SLUGS.has(reserved)).toBe(true);
      expect(slugRejectionReason(reserved)).toMatch(/사용할 수 없/);
    }
  });
  it('형식이 틀리면 사유를 돌려준다', () => {
    expect(slugRejectionReason('내 앨범')).toMatch(/영문 소문자/);
  });
  it('통과하면 null', () => {
    expect(slugRejectionReason('my-second-album')).toBeNull();
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx jest lib/funding/reservedSlugs.test.ts
```

Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현한다**

`lib/funding/reservedSlugs.ts`:

```ts
/**
 * 프로젝트 slug로 쓸 수 없는 이름.
 *
 * `pages/[locale]/funding/` 아래의 **리터럴 라우트**들이다. Next.js는 리터럴이 `[slug]`를
 * 이기므로, 개설자가 프로젝트를 `apply`로 지으면 `/ko/funding/apply`가 영영 신청 페이지를
 * 보여 주고 그 프로젝트의 상세는 어떤 주소로도 열리지 않는다. 오류도 나지 않는다 —
 * 그냥 다른 페이지가 뜬다.
 *
 * 새 리터럴 라우트를 그 디렉터리에 추가하면 **여기에도 넣어야 한다.**
 * `reservedSlugs.routes.test.ts`가 디렉터리를 직접 읽어 대조한다.
 */
export const RESERVED_FUNDING_SLUGS: ReadonlySet<string> = new Set([
  'apply',
  'creator',
  'terms',
  'success',
  'fail',
  'manage',
  // `[slug]/pledge`는 하위 경로라 slug 자리를 뺏지 않지만, 프로젝트 이름이 'pledge'면
  // `/ko/funding/pledge/pledge` 같은 주소가 생겨 사람이 읽기 어렵다.
  'pledge',
]);

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MIN_LENGTH = 3;
const MAX_LENGTH = 80;

export const normalizeFundingSlug = (input: string): string | null => {
  const trimmed = input.trim().toLowerCase();
  if (trimmed.length < MIN_LENGTH || trimmed.length > MAX_LENGTH) return null;
  if (!SLUG_PATTERN.test(trimmed)) return null;
  return trimmed;
};

export const slugRejectionReason = (slug: string): string | null => {
  const normalized = normalizeFundingSlug(slug);
  if (!normalized) {
    return `주소는 영문 소문자·숫자·하이픈만 쓸 수 있고 ${MIN_LENGTH}~${MAX_LENGTH}자여야 합니다.`;
  }
  if (RESERVED_FUNDING_SLUGS.has(normalized)) {
    return '이미 사이트가 쓰고 있는 주소라 사용할 수 없습니다. 다른 주소를 적어 주세요.';
  }
  return null;
};
```

- [ ] **Step 4: 목록이 실제 라우트와 어긋나지 않게 고정한다**

`lib/funding/reservedSlugs.routes.test.ts`:

```ts
/** @jest-environment node */
import fs from 'node:fs';
import path from 'node:path';

import { RESERVED_FUNDING_SLUGS } from './reservedSlugs';

/**
 * 예약 목록은 손으로 적은 것이라 라우트가 늘면 조용히 낡는다. 디렉터리를 직접 읽어
 * 대조한다 — 새 리터럴 라우트를 만들고 목록에 넣지 않으면 여기서 멈춘다.
 */
it('funding 아래 리터럴 라우트가 전부 예약 목록에 있다', () => {
  const dir = path.join(process.cwd(), 'pages/[locale]/funding');
  const literals = fs.readdirSync(dir, { withFileTypes: true })
    .map((e) => (e.isDirectory() ? e.name : e.name.replace(/\.tsx?$/, '')))
    .filter((name) => !name.startsWith('[') && name !== 'index');

  for (const name of literals) {
    expect([name, [...RESERVED_FUNDING_SLUGS]]).toEqual([name, expect.arrayContaining([name])]);
  }
});
```

- [ ] **Step 5: 확인한다**

```bash
npx jest lib/funding/reservedSlugs
```

Expected: 두 파일 PASS. 두 번째 테스트가 빨가면 목록에 빠진 라우트 이름이 메시지에 보인다.

- [ ] **Step 6: 커밋**

```bash
git add lib/funding/reservedSlugs.ts lib/funding/reservedSlugs.test.ts lib/funding/reservedSlugs.routes.test.ts
git commit -m "$(cat <<'EOF'
feat(funding): 예약 slug — 리터럴 라우트가 [slug]를 이긴다

프로젝트를 'apply'로 지으면 그 상세는 어떤 주소로도 열리지 않는다. 오류도 나지 않고
신청 페이지가 대신 뜬다. 목록은 손으로 적은 것이라 낡으므로 디렉터리를 읽어 대조한다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 개설자 본문 정책 — 신뢰 숏코드를 벗긴다

**Files:**
- Create: `lib/funding/creatorContent.ts`
- Create: `lib/funding/creatorContent.test.ts`

**Interfaces:**
- Consumes: `components/markdown/contentSegments.ts`의 파서 규칙(같은 정규식을 쓴다), `lib/inlineDirectives.ts`의 `INLINE_DIRECTIVE_NAMES`
- Produces: `stripTrustedDirectives(content: string): string`, `TRUSTED_SHORTCODE_NAMES: readonly string[]`

- [ ] **Step 1: 왜 필요한지 먼저 읽는다**

`components/MarkdownRenderer.tsx`를 열어 숏코드 처리 부분을 확인한다. 사실은 이렇다.

- `%%name%%` / `%%name:arg%%`가 독립 라인이면 컴포넌트로 렌더된다.
- 블록 숏코드 7종(`online-fallback`·`session-checklist`·`studio-more`·`studio-services`·`online-request`·`vocal-mix-bridge`·`practice-room-terms`)과 인라인 디렉티브 4종(`price`·`review`·`booking`·`service`)이 화이트리스트다.
- 화이트리스트 밖 이름은 **조용히 사라진다**(원문도 안 보인다).

즉 위험은 "개설자가 이상한 걸 넣는 것"이 아니라 **개설자가 스튜디오의 신뢰 카드를 자기 페이지에 박는 것**이다. `%%price:mixing-level1%%` 한 줄이면 남의 프로젝트 페이지에 우리 가격표가 뜨고, `%%studio-services%%`면 우리 서비스 목록이 뜬다. 읽는 사람은 그것을 그 프로젝트의 보증으로 읽는다.

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`lib/funding/creatorContent.test.ts`:

```ts
import { INLINE_DIRECTIVE_NAMES } from '../inlineDirectives';
import { stripTrustedDirectives, TRUSTED_SHORTCODE_NAMES } from './creatorContent';

describe('stripTrustedDirectives', () => {
  it('블록 숏코드를 지운다', () => {
    const out = stripTrustedDirectives('앞\n\n%%studio-services%%\n\n뒤');
    expect(out).not.toContain('studio-services');
    expect(out).toContain('앞');
    expect(out).toContain('뒤');
  });

  it('인자가 붙은 인라인 디렉티브를 지운다', () => {
    expect(stripTrustedDirectives('%%price:mixing-level1%%')).not.toContain('price');
    expect(stripTrustedDirectives('%%booking:지금 예약%%')).not.toContain('booking');
  });

  it('본문 첫 줄에 있어도 지운다', () => {
    expect(stripTrustedDirectives('%%studio-more%%\n본문')).toBe('\n본문');
  });

  it('화이트리스트 밖 이름은 건드리지 않는다', () => {
    // 렌더러가 어차피 지우지만, 우리가 지우면 개설자가 쓴 글자가 말없이 사라진 것이 된다.
    // 남겨 두면 렌더러 단계에서 사라지므로 화면 결과는 같다.
    const src = '%%내맘대로%%';
    expect(stripTrustedDirectives(src)).toBe(src);
  });

  it('문장 가운데의 %%는 건드리지 않는다', () => {
    const src = '이 곡은 %%price%% 같은 농담을 담았습니다';
    expect(stripTrustedDirectives(src)).toBe(src);
  });

  it('코드 펜스 안도 지운다 — 렌더러가 펜스를 보지 않으므로 그것이 곧 우회다', () => {
    const out = stripTrustedDirectives('```\n%%studio-services%%\n```');
    expect(out).not.toContain('studio-services');
  });

  it('줄 앞뒤에 공백이 있으면 건드리지 않는다 — 렌더러도 그것은 안 그린다', () => {
    const src = ' %%price:mixing-level1%%';
    expect(stripTrustedDirectives(src)).toBe(src);
  });

  it('빈 줄을 정리하지 않는다 — 코드 블록 안의 의도한 빈 줄이 뭉개진다', () => {
    const src = '앞\n\n\n\n뒤';
    expect(stripTrustedDirectives(src)).toBe(src);
  });

  it('목록이 렌더러의 화이트리스트와 같다', () => {
    for (const name of INLINE_DIRECTIVE_NAMES) {
      expect(TRUSTED_SHORTCODE_NAMES).toContain(name);
    }
    expect(TRUSTED_SHORTCODE_NAMES).toContain('studio-services');
  });
});
```

- [ ] **Step 3: 실패를 확인한다**

```bash
npx jest lib/funding/creatorContent.test.ts
```

Expected: FAIL — 모듈 없음.

- [ ] **Step 4: 구현한다**

`lib/funding/creatorContent.ts`:

```ts
import { INLINE_DIRECTIVE_NAMES } from '../inlineDirectives';

/**
 * 개설자 본문에서 지워야 하는 이름들.
 *
 * 이것들은 **스튜디오가 자기 글에 쓰라고 만든 신뢰 장치**다 — 가격표, 예약 버튼, 서비스
 * 목록, 후기. 개설자 글에 그대로 뜨면 읽는 쪽은 그 프로젝트에 대한 스튜디오의 보증으로
 * 읽는다. `%%price:mixing-level1%%` 한 줄이면 남의 펀딩 페이지에 우리 가격표가 뜬다.
 *
 * 화이트리스트 밖 이름은 지우지 않는다 — 렌더러가 어차피 렌더하지 않으므로 화면 결과는
 * 같고, 우리가 지우면 개설자가 쓴 글자가 말없이 사라진 것이 된다.
 *
 * MarkdownRenderer의 목록이 늘면 여기도 늘려야 한다. `creatorContent.test.ts`가
 * `INLINE_DIRECTIVE_NAMES`와의 일치를 고정한다.
 */
export const TRUSTED_SHORTCODE_NAMES: readonly string[] = [
  'online-fallback',
  'session-checklist',
  'studio-more',
  'studio-services',
  'online-request',
  'vocal-mix-bridge',
  'practice-room-terms',
  ...INLINE_DIRECTIVE_NAMES,
];

/**
 * 신뢰 숏코드가 든 줄을 지운다.
 *
 * **코드 펜스를 존중하지 않는다.** 렌더러도 존중하지 않기 때문이다 —
 * `components/markdown/contentSegments.ts`의 분리 정규식은 펜스를 모르고, 펜스 안의
 * `%%price:mixing-level1%%`도 그대로 컴포넌트로 그린다(실측:
 * `"```\n%%price:x%%\n```".split(정규식)` → `["```","price","x","\n```"]`).
 * 그러니 이쪽만 펜스를 존중하면 백틱 세 개로 감싸는 것이 곧 우회가 된다.
 *
 * 잃는 것은 "마크다운 사용법을 설명하는 글이 자기 예시를 잃는 것"인데, 여기 목록은
 * 스튜디오 내부 숏코드 이름이라 펀딩 소개 글이 예시로 들 이유가 없다.
 *
 * 줄 판정은 렌더러와 **정확히 같은 모양**이다. `trim()`을 쓰지 않는다 — 렌더러는 줄 앞뒤
 * 공백을 허용하지 않아 ` %%price:x%%`를 평범한 글자로 그리는데, 이쪽만 지우면 개설자가
 * 쓴 글자가 말없이 사라진다.
 *
 * 빈 줄도 정리하지 않는다. 마크다운은 빈 줄이 둘이든 넷이든 같게 그리므로 고칠 것이 없고,
 * 한꺼번에 줄이면 코드 블록 안의 의도한 빈 줄까지 뭉갠다.
 */
export const stripTrustedDirectives = (content: string): string => {
  const LINE = /^%%([\w-]+)(?::([^%\n]+))?%%$/;
  return content
    .split('\n')
    .filter((line) => {
      const match = LINE.exec(line);
      return !(match && TRUSTED_SHORTCODE_NAMES.includes(match[1]));
    })
    .join('\n');
};
```

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

```bash
npx jest lib/funding/creatorContent.test.ts
```

Expected: 전 케이스 PASS.

- [ ] **Step 6: 커밋**

```bash
git add lib/funding/creatorContent.ts lib/funding/creatorContent.test.ts
git commit -m "$(cat <<'EOF'
feat(funding): 개설자 본문에서 스튜디오 신뢰 장치를 벗긴다

가격표·예약 버튼·서비스 목록·후기는 스튜디오가 자기 글에 쓰라고 만든 것이다. 남의 펀딩
페이지에 뜨면 읽는 쪽은 그 프로젝트에 대한 우리 보증으로 읽는다. 화이트리스트 밖 이름은
지우지 않는다 — 렌더러가 어차피 안 그리므로 결과는 같고, 우리가 지우면 개설자가 쓴 글자가
말없이 사라진 것이 된다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 구획별 입력 검증

**Files:**
- Create: `lib/funding/creatorValidation.ts`
- Create: `lib/funding/creatorValidation.test.ts`

**Interfaces:**
- Consumes: Task 1의 `slugRejectionReason`
- Produces:
  - 상수 `CREATOR_LIMITS`
  - `validateBasicSection(input: unknown, now: Date): { ok: true; value: BasicSection } | { ok: false; message: string }`
  - `validateStorySection(input: unknown)` / `validateCreatorSection(input: unknown)` / `validateRewardInput(input: unknown)` — 같은 결과 모양
  - 타입 `BasicSection`·`StorySection`·`CreatorSection`·`RewardInput`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/funding/creatorValidation.test.ts`:

```ts
import { CREATOR_LIMITS, validateBasicSection, validateRewardInput, validateStorySection } from './creatorValidation';

const NOW = new Date('2026-10-01T00:00:00+09:00');
const basic = () => ({
  title: '2집 제작 펀딩',
  summary: '두 번째 앨범을 만듭니다',
  slug: 'my-second-album',
  goalAmount: 3000000,
  startAt: '2026-10-10T00:00:00+09:00',
  endAt: '2026-11-10T23:59:59+09:00',
  coverUrl: 'https://x.public.blob.vercel-storage.com/a.webp',
});

describe('validateBasicSection', () => {
  it('정상 입력을 통과시킨다', () => {
    const r = validateBasicSection(basic(), NOW);
    expect(r.ok).toBe(true);
  });

  it('시작일이 오늘부터 3일 안이면 거부한다 — 심사 시간이 필요하다', () => {
    const r = validateBasicSection({ ...basic(), startAt: '2026-10-02T00:00:00+09:00' }, NOW);
    expect(r).toMatchObject({ ok: false });
    expect((r as { message: string }).message).toMatch(/3일/);
  });

  it('기간이 60일을 넘으면 거부한다', () => {
    const r = validateBasicSection({ ...basic(), endAt: '2026-12-20T00:00:00+09:00' }, NOW);
    expect(r).toMatchObject({ ok: false });
    expect((r as { message: string }).message).toMatch(/60일/);
  });

  it('종료가 시작보다 앞이면 거부한다', () => {
    const r = validateBasicSection({ ...basic(), endAt: '2026-10-09T00:00:00+09:00' }, NOW);
    expect(r).toMatchObject({ ok: false });
  });

  it('목표 금액의 범위와 단위를 본다', () => {
    expect(validateBasicSection({ ...basic(), goalAmount: 5000 }, NOW).ok).toBe(false);
    expect(validateBasicSection({ ...basic(), goalAmount: 1234567 }, NOW).ok).toBe(false);
    expect(validateBasicSection({ ...basic(), goalAmount: 1230000 }, NOW).ok).toBe(true);
  });

  it('예약 slug를 거부한다', () => {
    const r = validateBasicSection({ ...basic(), slug: 'apply' }, NOW);
    expect(r).toMatchObject({ ok: false });
    expect((r as { message: string }).message).toMatch(/사용할 수 없/);
  });

  it('제목·요약 길이 상한을 본다', () => {
    expect(validateBasicSection({ ...basic(), title: 'a'.repeat(CREATOR_LIMITS.titleMax + 1) }, NOW).ok).toBe(false);
    expect(validateBasicSection({ ...basic(), summary: 'a'.repeat(CREATOR_LIMITS.summaryMax + 1) }, NOW).ok).toBe(false);
  });
});

describe('validateStorySection', () => {
  it('본문 길이 상한을 본다', () => {
    expect(validateStorySection({ content: 'a'.repeat(CREATOR_LIMITS.contentMax + 1) }).ok).toBe(false);
    expect(validateStorySection({ content: '짧은 본문' }).ok).toBe(true);
  });
  it('빈 본문도 저장은 허용한다 — 심사 신청에서 막는다', () => {
    expect(validateStorySection({ content: '' }).ok).toBe(true);
  });
});

describe('validateRewardInput', () => {
  const reward = () => ({
    rewardId: 'cd',
    title: 'CD',
    description: '앨범 CD 한 장',
    amount: 30000,
    totalQuantity: 100,
    requiresShipping: true,
    estimatedDelivery: '2026-12',
    imageUrl: null,
  });

  it('정상 입력을 통과시킨다', () => {
    expect(validateRewardInput(reward()).ok).toBe(true);
  });
  it('금액 단위와 범위를 본다', () => {
    expect(validateRewardInput({ ...reward(), amount: 1234 }).ok).toBe(false);
    expect(validateRewardInput({ ...reward(), amount: 0 }).ok).toBe(false);
    expect(validateRewardInput({ ...reward(), amount: 20000001 }).ok).toBe(false);
  });
  it('rewardId 형식을 본다', () => {
    expect(validateRewardInput({ ...reward(), rewardId: 'CD 한장' }).ok).toBe(false);
    expect(validateRewardInput({ ...reward(), rewardId: 'cd-1' }).ok).toBe(true);
  });
  it('수량이 있으면 양의 정수여야 한다', () => {
    expect(validateRewardInput({ ...reward(), totalQuantity: 0 }).ok).toBe(false);
    expect(validateRewardInput({ ...reward(), totalQuantity: null }).ok).toBe(true);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx jest lib/funding/creatorValidation.test.ts
```

Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현한다**

`lib/funding/creatorValidation.ts`. 핵심만 적는다 — 나머지 필드도 같은 모양으로 채운다.

```ts
import { slugRejectionReason } from './reservedSlugs';

export const CREATOR_LIMITS = {
  titleMax: 60,
  summaryMax: 120,
  contentMax: 100_000,
  rewardTitleMax: 60,
  rewardDescriptionMax: 1_000,
  rewardsMax: 20,
  goalMin: 100_000,
  goalMax: 100_000_000,
  amountMin: 1_000,
  amountMax: 20_000_000,
  amountStep: 1_000,
  /** 심사에 쓸 시간. 시작일은 오늘 + 이 일수 뒤부터 고를 수 있다. */
  leadDays: 3,
  /** 모금 기간 상한. 길수록 이행 약속과 현실이 멀어진다. */
  maxDurationDays: 60,
  bioMax: 600,
  linksMax: 5,
} as const;

type Fail = { ok: false; message: string };
const fail = (message: string): Fail => ({ ok: false, message });

const str = (v: unknown): string | null => (typeof v === 'string' ? v.trim() : null);

/** http(s)만. 개설자가 넣는 링크라 스킴을 좁게 잡는다. */
export const isSafeCreatorLink = (value: string): boolean => /^https?:\/\/[^\s]+$/i.test(value);

export interface BasicSection {
  title: string; summary: string; slug: string; goalAmount: number;
  startAt: Date; endAt: Date; coverUrl: string;
}

export const validateBasicSection = (
  input: unknown,
  now: Date,
): { ok: true; value: BasicSection } | Fail => {
  const d = (input ?? {}) as Record<string, unknown>;
  const title = str(d.title);
  if (!title || title.length > CREATOR_LIMITS.titleMax) return fail(`제목은 1~${CREATOR_LIMITS.titleMax}자로 적어 주세요.`);
  const summary = str(d.summary);
  if (!summary || summary.length > CREATOR_LIMITS.summaryMax) return fail(`한 줄 요약은 1~${CREATOR_LIMITS.summaryMax}자로 적어 주세요.`);

  const slugRaw = str(d.slug) ?? '';
  const slugReason = slugRejectionReason(slugRaw);
  if (slugReason) return fail(slugReason);

  const goalAmount = typeof d.goalAmount === 'number' ? d.goalAmount : NaN;
  if (!Number.isInteger(goalAmount) || goalAmount < CREATOR_LIMITS.goalMin || goalAmount > CREATOR_LIMITS.goalMax) {
    return fail('목표 금액을 확인해 주세요.');
  }
  if (goalAmount % 10_000 !== 0) return fail('목표 금액은 만원 단위로 적어 주세요.');

  const coverUrl = str(d.coverUrl);
  if (!coverUrl) return fail('대표 이미지를 올려 주세요.');

  const startAt = new Date(str(d.startAt) ?? '');
  const endAt = new Date(str(d.endAt) ?? '');
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) return fail('날짜를 확인해 주세요.');

  const earliest = new Date(now.getTime() + CREATOR_LIMITS.leadDays * 86_400_000);
  if (startAt.getTime() < earliest.getTime()) {
    return fail(`심사에 시간이 걸립니다. 시작일은 오늘부터 ${CREATOR_LIMITS.leadDays}일 뒤부터 고를 수 있습니다.`);
  }
  if (endAt.getTime() <= startAt.getTime()) return fail('종료일이 시작일보다 뒤여야 합니다.');
  if (endAt.getTime() - startAt.getTime() > CREATOR_LIMITS.maxDurationDays * 86_400_000) {
    return fail(`모금 기간은 최대 ${CREATOR_LIMITS.maxDurationDays}일입니다.`);
  }

  return { ok: true, value: { title, summary, slug: slugRaw.trim().toLowerCase(), goalAmount, startAt, endAt, coverUrl } };
};
```

나머지 세 함수도 같은 규약(`{ ok: true; value } | { ok: false; message }`)으로 쓴다.

- **`validateStorySection`**: `content`가 문자열이고 `contentMax` 이하. 빈 문자열도 통과(저장은 되고 심사 신청에서 막는다).
- **`validateCreatorSection`**: `name`(1~40자, 필수), `contactName`·`phone`(선택, 각 40자), `bio`(선택, `bioMax`), `links`(선택, 최대 `linksMax`개, 각 `isSafeCreatorLink`).
- **`validateRewardInput`**: `rewardId`가 `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`이고 1~40자, `title`·`description` 길이, `amount`가 `amountStep` 배수이며 범위 안, `totalQuantity`가 null이거나 양의 정수, `estimatedDelivery` 1~40자, `imageUrl`은 null이거나 문자열.

- [ ] **Step 4: 확인한다**

```bash
npx jest lib/funding/creatorValidation.test.ts && npm run type-check
```

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add lib/funding/creatorValidation.ts lib/funding/creatorValidation.test.ts
git commit -m "$(cat <<'EOF'
feat(funding): 개설자 입력 검증 — 구획별 순수 함수

시작일에 3일 여유를 두는 것은 심사 시간이다. 기간 상한 60일은 이행 약속과 현실이 멀어지는
것을 막는다. 금액은 클라이언트를 믿지 않고 여기서 단위·범위를 본다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 심사 상태 전이 (순수)

**Files:**
- Create: `lib/funding/reviewTransition.ts`
- Create: `lib/funding/reviewTransition.test.ts`

**Interfaces:**
- Consumes: `db/schema.ts`의 `fundingReviewStatusEnum`
- Produces:
  - `type ReviewAction = 'submit' | 'request_changes' | 'approve' | 'reject' | 'withdraw'`
  - `nextReviewStatus(from: FundingReviewStatus, action: ReviewAction): FundingReviewStatus | null` — 허용되지 않는 전이는 null
  - `canCreatorEdit(status: FundingReviewStatus): boolean`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/funding/reviewTransition.test.ts`:

```ts
import { canCreatorEdit, nextReviewStatus, type ReviewAction } from './reviewTransition';
import { fundingReviewStatusEnum } from '../../db/schema';

const ALL = fundingReviewStatusEnum;
const ACTIONS: ReviewAction[] = ['submit', 'request_changes', 'approve', 'reject', 'withdraw'];

describe('nextReviewStatus', () => {
  it('개설자는 draft와 changes_requested에서만 제출할 수 있다', () => {
    expect(nextReviewStatus('draft', 'submit')).toBe('submitted');
    expect(nextReviewStatus('changes_requested', 'submit')).toBe('submitted');
    expect(nextReviewStatus('submitted', 'submit')).toBeNull();
    expect(nextReviewStatus('approved', 'submit')).toBeNull();
    expect(nextReviewStatus('rejected', 'submit')).toBeNull();
  });

  it('운영자 판정은 submitted에서만 나온다', () => {
    expect(nextReviewStatus('submitted', 'approve')).toBe('approved');
    expect(nextReviewStatus('submitted', 'request_changes')).toBe('changes_requested');
    expect(nextReviewStatus('submitted', 'reject')).toBe('rejected');
    expect(nextReviewStatus('draft', 'approve')).toBeNull();
    expect(nextReviewStatus('approved', 'reject')).toBeNull();
  });

  it('제출 철회는 submitted에서만', () => {
    expect(nextReviewStatus('submitted', 'withdraw')).toBe('draft');
    expect(nextReviewStatus('draft', 'withdraw')).toBeNull();
  });

  it('승인된 프로젝트는 어떤 행동으로도 상태가 되돌아가지 않는다', () => {
    for (const action of ACTIONS) expect(nextReviewStatus('approved', action)).toBeNull();
  });

  it('전이표가 모든 조합을 명시한다', () => {
    for (const from of ALL) {
      for (const action of ACTIONS) {
        const result = nextReviewStatus(from, action);
        expect(result === null || ALL.includes(result)).toBe(true);
      }
    }
  });
});

describe('canCreatorEdit', () => {
  it('심사 중과 반려·승인 뒤에는 개설자가 고칠 수 없다', () => {
    expect(canCreatorEdit('draft')).toBe(true);
    expect(canCreatorEdit('changes_requested')).toBe(true);
    expect(canCreatorEdit('submitted')).toBe(false);
    expect(canCreatorEdit('rejected')).toBe(false);
    // 승인 뒤 스토리 편집은 3차에서 따로 연다(스펙 §6.4). 지금은 전부 잠근다.
    expect(canCreatorEdit('approved')).toBe(false);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx jest lib/funding/reviewTransition.test.ts
```

Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현한다**

```ts
import { fundingReviewStatusEnum } from '../../db/schema';

export type FundingReviewStatus = (typeof fundingReviewStatusEnum)[number];
export type ReviewAction = 'submit' | 'request_changes' | 'approve' | 'reject' | 'withdraw';

/**
 * 심사 상태 전이표.
 *
 * **표 하나가 정본이다.** 개설자 API와 (3차의) 관리자 API가 각자 조건문을 쓰면 두 쪽이
 * 갈라지고, 그 틈으로 승인된 프로젝트가 초안으로 돌아가는 경로가 생긴다. 표에 없는
 * 조합은 전부 null이고 호출부는 409로 답한다.
 */
const TABLE: Record<FundingReviewStatus, Partial<Record<ReviewAction, FundingReviewStatus>>> = {
  draft: { submit: 'submitted' },
  changes_requested: { submit: 'submitted' },
  submitted: { approve: 'approved', request_changes: 'changes_requested', reject: 'rejected', withdraw: 'draft' },
  // 승인은 끝이다. 되돌리려면 공개 상태(status)를 closed로 바꾸지 상태를 되감지 않는다 —
  // 이미 후원이 들어와 있을 수 있고, 그 행들은 slug로 이 프로젝트를 참조한다.
  approved: {},
  rejected: {},
};

export const nextReviewStatus = (from: FundingReviewStatus, action: ReviewAction): FundingReviewStatus | null =>
  TABLE[from]?.[action] ?? null;

/** 개설자가 내용을 고칠 수 있는 상태. 심사 중에 바뀌면 운영자가 본 것과 다른 것이 승인된다. */
export const canCreatorEdit = (status: FundingReviewStatus): boolean =>
  status === 'draft' || status === 'changes_requested';
```

- [ ] **Step 4: 확인하고 커밋한다**

```bash
npx jest lib/funding/reviewTransition.test.ts
git add lib/funding/reviewTransition.ts lib/funding/reviewTransition.test.ts
git commit -m "$(cat <<'EOF'
feat(funding): 심사 상태 전이표 — 표 하나가 정본

개설자 API와 관리자 API가 각자 조건문을 쓰면 두 쪽이 갈라지고, 그 틈으로 승인된 프로젝트가
초안으로 돌아가는 경로가 생긴다. 심사 중 편집을 막는 것은 운영자가 본 것과 다른 것이
승인되는 일을 막기 위해서다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 쓰기 서비스와 리워드 잠금 가드

이 계획에서 가장 중요한 태스크다. **리워드 잠금이 여기 없으면 3차에서 승인된 프로젝트의 리워드를 아무나 고칠 수 있다.**

**Files:**
- Create: `lib/funding/creatorProjectWrite.ts`
- Create: `lib/funding/creatorProjectWrite.integration.test.ts`

**Interfaces:**
- Consumes: Task 3의 검증 타입, Task 4의 `canCreatorEdit`, `db/schema.ts`의 `fundingProjects`·`fundingRewards`
- Produces:
  - `createDraftProject(creatorId: string): Promise<{ id: string }>`
  - `loadProjectForCreator(creatorId: string, projectId: string): Promise<CreatorProjectDetail | null>`
  - `saveBasicSection(creatorId, projectId, value: BasicSection): Promise<WriteResult>`
  - `saveStorySection(creatorId, projectId, value: StorySection): Promise<WriteResult>`
  - `saveCreatorSection(creatorId, value: CreatorSection): Promise<WriteResult>` — **projectId를 받지 않는다.** 개설자 프로필은 계정 소속이라, 어떤 프로젝트의 편집 가능 여부로 막으면 초안 하나로 승인된 프로젝트의 공개 소개를 바꾸는 경로가 생긴다
  - `upsertReward(creatorId, projectId, value: RewardInput, previousRewardId?: string): Promise<WriteResult>` — `previousRewardId`가 있고 다르면 **개명**이다. 없으면 rewardId로 찾아 없으면 추가, 있으면 수정
  - `deleteReward(creatorId, projectId, rewardId: string): Promise<WriteResult>`
  - `type WriteResult = { ok: true } | { ok: false; code: 'not_found' | 'locked' | 'not_editable' | 'duplicate_slug' | 'too_many'; message: string }`

- [ ] **Step 1: 실패하는 통합 테스트를 쓴다**

`lib/funding/creatorProjectWrite.integration.test.ts`. 부트스트랩은 `lib/funding/creatorProjectList.integration.test.ts`에서 그대로 베낀다(마이그레이션 순차 적용 + `jest.mock('../../db/client', () => ({ getDb: () => mockDb }))`).

핵심 케이스:

```ts
describe('소유권', () => {
  it('남의 프로젝트는 없는 것으로 보인다', async () => {
    const mine = await seedCreator('mine@example.com');
    const other = await seedCreator('other@example.com');
    const { id } = await createDraftProject(other);
    expect(await loadProjectForCreator(mine, id)).toBeNull();
    const r = await saveStorySection(mine, id, { content: '남의 글' });
    expect(r).toMatchObject({ ok: false, code: 'not_found' });
    // 실제로 안 바뀌었는지 확인한다 — 거부 응답만 보고 넘어가면 조용한 쓰기를 놓친다.
    const row = await mockDb.select().from(schema.fundingProjects).where(eq(schema.fundingProjects.id, id));
    expect(row[0].content).not.toContain('남의 글');
  });
});

describe('리워드 잠금', () => {
  const lockIt = async (projectId: string, rewardId: string) =>
    mockDb.update(schema.fundingRewards).set({ lockedAt: new Date() })
      .where(and(eq(schema.fundingRewards.projectId, projectId), eq(schema.fundingRewards.rewardId, rewardId)));

  it('잠긴 리워드의 금액을 바꿀 수 없다', async () => {
    const creator = await seedCreator('a@example.com');
    const { id } = await createDraftProject(creator);
    await upsertReward(creator, id, rewardInput({ rewardId: 'cd', amount: 30000 }));
    await lockIt(id, 'cd');
    const r = await upsertReward(creator, id, rewardInput({ rewardId: 'cd', amount: 35000 }));
    expect(r).toMatchObject({ ok: false, code: 'locked' });
    const [row] = await mockDb.select().from(schema.fundingRewards).where(eq(schema.fundingRewards.rewardId, 'cd'));
    expect(row.amount).toBe(30000);
  });

  it('잠긴 리워드의 한정 수량 유무를 바꿀 수 없다', async () => {
    // null → 100, 100 → null 둘 다 거부. 수량 자체를 늘리는 것은 허용한다(재고 추가).
  });

  it('잠긴 리워드를 지울 수 없다', async () => {
    // deleteReward가 { ok: false, code: 'locked' }이고 행이 남아 있다.
  });

  it('잠긴 리워드의 제목·설명·이미지·예상 전달 시기는 고칠 수 있다', async () => {
    // 오타 수정까지 막으면 운영이 안 된다. 바뀌면 안 되는 것은 id·단가·한정 여부다.
  });

  it('잠긴 리워드가 있어도 새 리워드는 추가할 수 있다', async () => {
    // 가격을 바꿔야 하면 기존 티어를 두고 새 id로 추가한다 — 그 경로가 열려 있어야 한다.
  });
});

describe('편집 가능 상태', () => {
  it('심사 중에는 저장이 거부된다', async () => {
    // reviewStatus를 'submitted'로 만든 뒤 saveBasicSection → { ok: false, code: 'not_editable' }
  });
});

describe('slug 중복', () => {
  it('다른 프로젝트가 쓰는 slug는 거부한다', async () => {
    // 같은 개설자의 다른 프로젝트, 그리고 남의 프로젝트 둘 다 막는다.
  });
  it('content/funding/*.md의 slug와 겹쳐도 거부한다', async () => {
    // 파일이 이기므로 그 slug로 승인되면 DB 프로젝트는 영영 안 보인다.
  });
});

describe('리워드 개수', () => {
  it('상한을 넘으면 거부한다', async () => {
    // CREATOR_LIMITS.rewardsMax + 1번째에서 { ok: false, code: 'too_many' }
  });
});
```

각 `it` 블록의 주석은 무엇을 단언해야 하는지 말해 준다. **전부 실제 단언으로 채운다** — 주석만 남기지 않는다.

- [ ] **Step 2: 실패를 확인한다**

```bash
npx jest lib/funding/creatorProjectWrite.integration.test.ts
```

Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현한다**

`lib/funding/creatorProjectWrite.ts`의 뼈대다.

```ts
import { and, eq, ne, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingProjects, fundingRewards, type FundingRewardRow } from '../../db/schema';
import { getFundingProject } from './projects';
import { canCreatorEdit } from './reviewTransition';
import { CREATOR_LIMITS, type BasicSection, type CreatorSection, type RewardInput, type StorySection } from './creatorValidation';
import { stripTrustedDirectives } from './creatorContent';

export type WriteResult =
  | { ok: true }
  | { ok: false; code: 'not_found' | 'locked' | 'not_editable' | 'duplicate_slug' | 'too_many'; message: string };

const deny = (code: Exclude<WriteResult, { ok: true }>['code'], message: string): WriteResult => ({ ok: false, code, message });

/**
 * 소유·편집 가능 여부를 한 번에 본다.
 *
 * **모든 쓰기 함수가 이것을 먼저 부른다.** 함수마다 조건을 다시 쓰면 언젠가 한 곳이
 * 빠지고, 그 하나가 남의 프로젝트를 여는 문이 된다. 남의 것이면 'not_found'다 —
 * '권한 없음'이라고 답하면 그 id가 존재한다는 사실을 알려 주는 셈이다.
 */
const guard = async (creatorId: string, projectId: string) => {
  const [row] = await getDb().select().from(fundingProjects)
    .where(and(eq(fundingProjects.id, projectId), eq(fundingProjects.creatorId, creatorId))).limit(1);
  if (!row) return { row: null, denial: deny('not_found', '프로젝트를 찾을 수 없습니다.') };
  if (!canCreatorEdit(row.reviewStatus)) {
    return { row, denial: deny('not_editable', '심사 중이거나 이미 판정이 난 프로젝트는 고칠 수 없습니다.') };
  }
  return { row, denial: null };
};
```

`saveBasicSection`은 위 `guard` 뒤에 slug 중복을 본다.

```ts
export const saveBasicSection = async (creatorId: string, projectId: string, value: BasicSection): Promise<WriteResult> => {
  const { row, denial } = await guard(creatorId, projectId);
  if (denial) return denial;

  // 파일 프로젝트가 이긴다(lib/funding/repository.ts). 파일과 같은 slug로 승인되면
  // 그 DB 프로젝트는 어떤 주소로도 열리지 않는다 — 여기서 막는 편이 훨씬 싸다.
  if (getFundingProject(value.slug)) return deny('duplicate_slug', '이미 쓰이고 있는 주소입니다. 다른 주소를 적어 주세요.');

  const [taken] = await getDb().select({ id: fundingProjects.id }).from(fundingProjects)
    .where(and(eq(fundingProjects.slug, value.slug), ne(fundingProjects.id, projectId))).limit(1);
  if (taken) return deny('duplicate_slug', '이미 쓰이고 있는 주소입니다. 다른 주소를 적어 주세요.');

  await getDb().update(fundingProjects).set({
    title: value.title, summary: value.summary, slug: value.slug,
    goalAmount: value.goalAmount, startAt: value.startAt, endAt: value.endAt,
    coverUrl: value.coverUrl, updatedAt: new Date(),
  }).where(eq(fundingProjects.id, row!.id));
  return { ok: true };
};
```

`saveStorySection`은 **저장 시점에** 본문을 벗긴다.

```ts
export const saveStorySection = async (creatorId: string, projectId: string, value: StorySection): Promise<WriteResult> => {
  const { row, denial } = await guard(creatorId, projectId);
  if (denial) return denial;
  // 렌더 시점이 아니라 저장 시점에 벗긴다 — 렌더 경로가 여럿(상세·미리보기·OG·llms)이라
  // 한 곳을 빠뜨리면 그 경로로만 새어 나간다. 저장된 값 자체를 깨끗하게 둔다.
  await getDb().update(fundingProjects)
    .set({ content: stripTrustedDirectives(value.content), updatedAt: new Date() })
    .where(eq(fundingProjects.id, row!.id));
  return { ok: true };
};
```

`upsertReward`의 잠금 가드가 이 태스크의 핵심이다.

```ts
/**
 * 잠긴 리워드에서 바뀌면 안 되는 것.
 *
 * `rewardId`가 바뀌면 재고 집계 조건(`fp.reward_id = ?`)이 기존 후원을 세지 못해 한정
 * 100개짜리가 200개 팔린다. `amount`가 바뀌면 DB의 단가와 화면·CSV·환불 금액이 어긋난다.
 * 한정 여부가 바뀌면 재고 계산 자체가 다른 길로 간다.
 *
 * `requiresShipping`도 바꿀 수 없다. 결제를 마친 후원자가 배송지를 낸 적 없는 티어를 사후에
 * 배송 필요로 바꾸는 것은 이행 조건 변경이다.
 *
 * 제목·설명·이미지·예상 전달 시기는 고칠 수 있다 — 오타 수정까지 막으면 운영이 안 된다.
 * 수량은 **늘리는 것만** 허용한다(재고 추가). 줄이면 이미 팔린 것보다 적어질 수 있다.
 */
const lockedViolation = (existing: FundingRewardRow, next: RewardInput): string | null => {
  if (!existing.lockedAt) return null;
  if (existing.amount !== next.amount) return '공개된 리워드의 금액은 바꿀 수 없습니다. 새 리워드를 추가해 주세요.';
  if ((existing.totalQuantity === null) !== (next.totalQuantity === null)) {
    return '공개된 리워드의 수량 제한 여부는 바꿀 수 없습니다.';
  }
  if (existing.totalQuantity !== null && next.totalQuantity !== null && next.totalQuantity < existing.totalQuantity) {
    return '수량은 늘릴 수만 있습니다.';
  }
  return null;
};
```

`deleteReward`는 `lockedAt`이 있으면 `deny('locked', ...)`이고, `createDraftProject`는 `reviewStatus`·`status`를 기본값(`draft`) 그대로 두고 `creatorId`만 넣어 행을 만든 뒤 `{ id }`를 돌려준다.

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

```bash
npx jest lib/funding/creatorProjectWrite.integration.test.ts && npm test
```

Expected: 전부 PASS.

- [ ] **Step 5: 커밋**

```bash
git add lib/funding/creatorProjectWrite.ts lib/funding/creatorProjectWrite.integration.test.ts
git commit -m "$(cat <<'EOF'
feat(funding): 프로젝트 쓰기 — 소유 조건과 리워드 잠금을 같은 커밋에

md 시절 리워드 id·단가를 지키던 것은 content/funding.baseline.json이었다. 정본이 DB로
옮겨 온 만큼 자물쇠도 함께 옮긴다. 잠긴 리워드는 id·금액·한정 여부를 바꿀 수 없고 지울
수도 없다 — 제목·설명·전달 시기는 고칠 수 있다(오타 수정까지 막으면 운영이 안 된다).

남의 프로젝트는 '권한 없음'이 아니라 'not_found'다. 권한 없음이라고 답하면 그 id가
존재한다는 사실을 알려 주는 셈이다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 이미지 업로드

**Files:**
- Create: `lib/funding/mediaPath.ts`
- Create: `lib/funding/mediaPath.test.ts`
- Create: `lib/funding/creatorUpload.ts`
- Create: `lib/funding/creatorUpload.test.ts`
- Create: `pages/api/funding/creator/upload.ts`
- Create: `pages/api/funding/media/[...path].ts`
- Create: `tests/api/funding/creator/upload.test.ts`
- Modify: `components/markdown/MarkdownImage.tsx`
- Create: `components/markdown/MarkdownImage.test.tsx`
- Modify: `next.config.mjs`

**Interfaces:**
- Consumes: Task 5의 `loadProjectForCreator`(소유 확인), `@vercel/blob`의 `put`·`get`
- Produces:
  - `FUNDING_MEDIA_PREFIX: 'funding/'`, `resolveFundingBlobPath(input: string | string[] | undefined): string | null`
  - `UPLOAD_LIMITS: { maxBytes: number; maxWidth: number; maxPerProject: number }`
  - `processCreatorImage(input: Buffer, kind: 'cover' | 'body'): Promise<{ buffer: Buffer; width: number; height: number }>`
  - `buildFundingMediaUrl(filename: string, width: number, height: number): string`

- [ ] **Step 1: 사실을 먼저 확인한다 — 여기서 설계가 갈린다**

`pages/api/social/media/[...path].ts`와 `lib/social/mediaPath.ts`를 **먼저 정독한다.** 그 주석이 이 태스크의 제약을 말한다.

> 이 프로젝트의 Blob 저장소는 계약서 PDF를 담고 있어 private이고, 같은 저장소에 public 업로드를 섞을 수 없다.

즉 **`access: 'public'`으로 올릴 수 없다.** 저장소 전체에서 `put(..., { access: 'public' })`은 단 한 건도 없다. 공개가 필요한 이미지는 전부 private으로 올리고 우리 도메인의 프록시 라우트가 대신 내보낸다. 펀딩 개설자 이미지도 같은 길을 간다.

따라오는 결과가 둘이다.

- 이미지 주소가 **같은 출처**(`/api/funding/media/<파일명>`)라 `next.config.mjs`의 `images.remotePatterns`를 건드릴 필요가 없다.
- 경로 판정을 라우트 안에서 문자열로 조립하면 안 된다. `lib/social/mediaPath.ts`의 주석이 그 이유를 적어 뒀다: **접두사를 벗어나는 순간 계약서가 공개된다.** 같은 모양으로 `lib/funding/mediaPath.ts`를 만들고 테스트를 붙인다.

나머지 확인 사항:

- `put(filename, buffer, { access: 'private', contentType })`은 `lib/contracts/pdf-storage.ts:13`에서 이미 쓴다.
- sharp는 직접 의존(`^0.35.3`)이지만 **런타임(API 라우트) 사용 전례가 없다.** 빌드 스크립트에서만 썼다. 이 태스크가 첫 사례이니 Step 6의 빌드 확인을 반드시 한다.
- multipart 파서는 저장소에 없다. `pages/api/inbound/resend.ts:26`의 `export const config = { api: { bodyParser: false } }`가 원문 바디를 받는 유일한 전례다. **multipart를 새로 들이지 않는다** — 클라이언트가 `fetch(url, { method: 'POST', body: file })`로 파일 본문만 보내고 종류는 쿼리로 넘긴다. 한 번에 파일 하나뿐이라 그것으로 충분하다.
- `components/markdown/MarkdownImage.tsx`는 `utils/imageMetadata.json`에 치수가 없으면 16:9 `fill` + `object-contain`으로 떨어뜨린다. 세로 포스터가 16:9 안에 작게 박힌다.

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`lib/funding/mediaPath.test.ts`:

```ts
import { FUNDING_MEDIA_PREFIX, resolveFundingBlobPath } from './mediaPath';

describe('resolveFundingBlobPath', () => {
  it('정상 파일명을 접두사와 함께 돌려준다', () => {
    expect(resolveFundingBlobPath(['abc123.webp'])).toBe(`${FUNDING_MEDIA_PREFIX}abc123.webp`);
  });
  it('세그먼트가 하나가 아니면 거부한다', () => {
    expect(resolveFundingBlobPath(['a', 'b.webp'])).toBeNull();
    expect(resolveFundingBlobPath([])).toBeNull();
    expect(resolveFundingBlobPath(undefined)).toBeNull();
  });
  it('상위 경로 탈출을 거부한다', () => {
    expect(resolveFundingBlobPath(['../contracts/secret.pdf'])).toBeNull();
    expect(resolveFundingBlobPath(['..'])).toBeNull();
    expect(resolveFundingBlobPath(['.hidden.webp'])).toBeNull();
  });
  it('webp가 아니면 거부한다', () => {
    expect(resolveFundingBlobPath(['a.pdf'])).toBeNull();
    expect(resolveFundingBlobPath(['a.jpg'])).toBeNull();
    expect(resolveFundingBlobPath(['a'])).toBeNull();
  });
  it('이름이 길면 거부한다', () => {
    expect(resolveFundingBlobPath([`${'a'.repeat(200)}.webp`])).toBeNull();
  });
});
```

`lib/funding/creatorUpload.test.ts`:

```ts
import sharp from 'sharp';

import { buildFundingMediaUrl, processCreatorImage, UPLOAD_LIMITS } from './creatorUpload';

const makePng = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 10, g: 20, b: 30 } } }).png().toBuffer();

describe('processCreatorImage', () => {
  it('webp로 다시 인코딩하고 치수를 돌려준다', async () => {
    const out = await processCreatorImage(await makePng(800, 600), 'body');
    expect(out.width).toBe(800);
    expect(out.height).toBe(600);
    expect((await sharp(out.buffer).metadata()).format).toBe('webp');
  });

  it('가로 상한을 넘으면 줄인다', async () => {
    const out = await processCreatorImage(await makePng(4000, 2000), 'body');
    expect(out.width).toBe(UPLOAD_LIMITS.maxWidth);
    expect(out.height).toBe(UPLOAD_LIMITS.maxWidth / 2);
  });

  it('작은 그림을 억지로 키우지 않는다', async () => {
    const out = await processCreatorImage(await makePng(400, 300), 'body');
    expect(out.width).toBe(400);
  });

  it('대표 이미지는 16:9로 맞춘다', async () => {
    const out = await processCreatorImage(await makePng(1000, 1000), 'cover');
    expect(out.width / out.height).toBeCloseTo(16 / 9, 2);
  });

  it('그림이 아니면 던진다', async () => {
    await expect(processCreatorImage(Buffer.from('이건 그림이 아니다'), 'body')).rejects.toThrow();
  });
});

describe('buildFundingMediaUrl', () => {
  it('같은 출처 주소에 치수를 붙인다', () => {
    expect(buildFundingMediaUrl('abc.webp', 800, 600)).toBe('/api/funding/media/abc.webp?w=800&h=600');
  });
});
```

`components/markdown/MarkdownImage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';

import { MarkdownImage } from './MarkdownImage';

describe('MarkdownImage 치수 힌트', () => {
  it('src의 w·h 쿼리를 치수로 쓴다', () => {
    render(<MarkdownImage src="/api/funding/media/a.webp?w=800&h=1200" alt="포스터" />);
    const img = screen.getByAltText('포스터');
    expect(img).toHaveAttribute('width', '800');
    expect(img).toHaveAttribute('height', '1200');
  });

  it('치수가 양의 정수가 아니면 무시한다', () => {
    render(<MarkdownImage src="/api/funding/media/b.webp?w=0&h=-5" alt="이상한값" />);
    expect(screen.getByAltText('이상한값')).toBeInTheDocument();
  });

  it('치수 쿼리가 없으면 기존 폴백 그대로다', () => {
    render(<MarkdownImage src="/api/funding/media/c.webp" alt="무치수" />);
    expect(screen.getByAltText('무치수')).toBeInTheDocument();
  });

  it('로컬 메타데이터가 있으면 그쪽이 이긴다', () => {
    // utils/imageMetadata.json에 실제로 있는 경로 하나를 골라 쓴다. 쿼리 힌트가 기존
    // 동작을 덮어쓰면 안 된다 — 스토리 1,000편이 그 경로로 렌더된다.
  });
});
```

- [ ] **Step 3: 실패를 확인한다**

```bash
npx jest lib/funding/mediaPath lib/funding/creatorUpload components/markdown/MarkdownImage
```

Expected: FAIL — 모듈 없음.

- [ ] **Step 4: 경로 판정과 이미지 처리를 만든다**

`lib/funding/mediaPath.ts`는 `lib/social/mediaPath.ts`를 그대로 본떠 쓰되 접두사와 확장자만 다르다. **그 파일의 "안전한 것만 통과" 원칙과 주석의 취지를 그대로 옮긴다** — 무엇을 막는지(같은 저장소의 계약서 PDF) 적어야 다음 사람이 규칙을 느슨하게 만들지 않는다.

`lib/funding/creatorUpload.ts`:

```ts
import sharp from 'sharp';

export const UPLOAD_LIMITS = {
  /** 장당 8MB. 휴대폰 사진 한 장이 넉넉히 들어온다. */
  maxBytes: 8 * 1024 * 1024,
  /** 재인코딩 후 가로 상한. 본문 폭이 768px이라 2배수면 충분하다. */
  maxWidth: 1600,
  /** 프로젝트당 누적 장수. */
  maxPerProject: 30,
} as const;

/** 대표 이미지는 목록 카드·OG가 함께 쓰는 16:9다(lib/funding/imageAspect.ts와 같은 전제). */
const COVER_SIZE = { width: 1200, height: 675 } as const;

/**
 * 받은 바이트를 **다시 인코딩해서** 저장한다.
 *
 * 원본을 그대로 두지 않는 이유가 둘이다. 하나, sharp가 디코드하지 못하면 그림이 아니므로
 * 여기서 던진다 — 확장자나 Content-Type을 믿지 않는다. 둘, 재인코딩이 EXIF와 그 안에
 * 딸려 오는 것들(촬영 위치 포함)을 떨군다. 개설자가 자기 작업실에서 찍은 사진의 좌표가
 * 공개 페이지에 실려 나가면 안 된다.
 */
export const processCreatorImage = async (
  input: Buffer,
  kind: 'cover' | 'body',
): Promise<{ buffer: Buffer; width: number; height: number }> => {
  const pipeline = sharp(input, { failOn: 'error' }).rotate();
  const resized = kind === 'cover'
    ? pipeline.resize(COVER_SIZE.width, COVER_SIZE.height, { fit: 'cover' })
    : pipeline.resize({ width: UPLOAD_LIMITS.maxWidth, withoutEnlargement: true });
  const { data, info } = await resized.webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  return { buffer: data, width: info.width, height: info.height };
};

/**
 * 이미지 주소. Blob 주소가 아니라 **우리 도메인의 프록시 경로**다.
 *
 * Blob 저장소는 계약서 PDF와 같은 곳이라 private이고 공개 업로드를 섞을 수 없다
 * (pages/api/social/media/[...path].ts의 주석). 그래서 private으로 올리고 접두사가 맞는
 * 것만 이 경로가 내보낸다.
 *
 * 치수를 쿼리로 붙이는 이유: `MarkdownImage`는 `utils/imageMetadata.json`에서 치수를 찾는데
 * 그 파일은 저장소의 정적 이미지만 안다. 업로드 이미지는 거기 없어 16:9 상자에 갇히고,
 * 세로 포스터가 작게 박힌다.
 */
export const buildFundingMediaUrl = (filename: string, width: number, height: number): string =>
  `/api/funding/media/${filename}?w=${width}&h=${height}`;
```

- [ ] **Step 5: 두 라우트를 만든다**

`pages/api/funding/creator/upload.ts`:

- `export const config = { api: { bodyParser: false } }`.
- POST만, `Cache-Control: no-store`, Origin 검사, `authenticateCreatorApi`.
- 쿼리에서 `projectId`와 `kind`(`cover` | `body`)를 읽고 `loadProjectForCreator`로 소유·편집 가능 여부를 확인한다. 아니면 404.
- `consumeRateLimit(`creator_upload:${creatorId}`, 60, 3600)`.
- 바디를 모으되 누적이 `UPLOAD_LIMITS.maxBytes`를 넘는 순간 끊고 413. **끝까지 받은 뒤 크기를 재지 않는다** — 그러면 상한이 상한이 아니다.
- 프로젝트당 누적 장수는 `content`와 `coverUrl`에 등장하는 `/api/funding/media/` 개수로 센다(별도 테이블을 만들지 않는다). 상한을 넘으면 400.
- `processCreatorImage` → `put(`funding/${randomUUID()}.webp`, buffer, { access: 'private', contentType: 'image/webp' })`.
- 응답 `{ ok: true, url: buildFundingMediaUrl(filename, width, height) }`.

`pages/api/funding/media/[...path].ts`는 `pages/api/social/media/[...path].ts`를 본뜬다. GET·HEAD만, `resolveFundingBlobPath`로 판정, `get(pathname, { access: 'private' })`, `Content-Type: image/webp`, `Cache-Control: public, max-age=31536000, immutable`.

⚠️ **이 라우트에는 인증이 없다.** 그래야 검색엔진·카카오 미리보기가 이미지를 가져간다. 그래서 경로 판정이 유일한 방어선이고, 파일명이 무작위 UUID인 것이 그 자체로 접근 제어다. 승인 전 프로젝트의 이미지 주소를 아는 사람은 그 이미지를 볼 수 있다 — 그건 의도다(개설자가 미리보기 링크를 동료에게 보낼 수 있어야 한다).

`next.config.mjs`는 `remotePatterns`를 건드리지 않는다. 대신 `outputFileTracingIncludes`에 개설자 라우트를 더한다 — 이 경로들도 `repository.ts`를 지나 `content/funding/*.md`를 읽는다.

```js
    '/api/funding/creator/**': ['./content/funding/*.md'],
    '/[locale]/funding/creator/**': ['./content/funding/*.md'],
```

- [ ] **Step 6: 확인한다 — sharp 런타임 사용은 이 저장소에서 처음이다**

```bash
npx jest lib/funding/mediaPath lib/funding/creatorUpload components/markdown/MarkdownImage tests/api/funding/creator/upload.test.ts
npm test
env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN npm run build
```

빌드 로그에서 `/api/funding/creator/upload`가 생성됐는지 확인하고 **sharp 관련 경고가 있으면 보고서에 그대로 적는다.** 서버리스 번들에 네이티브 바이너리가 들어가는 첫 사례라, 배포 뒤 실측이 필요하다는 사실을 남겨야 한다.

- [ ] **Step 7: 커밋**

```bash
git add lib/funding/mediaPath.ts lib/funding/mediaPath.test.ts lib/funding/creatorUpload.ts lib/funding/creatorUpload.test.ts pages/api/funding/creator/upload.ts 'pages/api/funding/media' tests/api/funding/creator/upload.test.ts components/markdown/MarkdownImage.tsx components/markdown/MarkdownImage.test.tsx next.config.mjs
git commit -m "$(cat <<'EOF'
feat(funding): 개설자 이미지 업로드 — private Blob + 우리 도메인 프록시

Blob 저장소는 계약서 PDF와 같은 곳이라 public 업로드를 섞을 수 없다(소셜 이미지가 이미
같은 길을 간다). 경로 판정은 별도 모듈에 두고 테스트를 붙인다 — 접두사를 벗어나는 순간
계약서가 공개된다.

받은 바이트는 다시 인코딩해서 저장한다. 확장자도 Content-Type도 믿지 않고, 재인코딩이
EXIF와 촬영 위치를 떨군다. 치수는 주소 쿼리로 실어 보낸다 — imageMetadata.json은 저장소의
정적 이미지만 알아서, 업로드 이미지는 16:9 상자에 갇히고 세로 포스터가 작게 박힌다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 저장 API 네 개

**Files:**
- Create: `pages/api/funding/creator/projects.ts`
- Create: `pages/api/funding/creator/projects/[id].ts`
- Create: `pages/api/funding/creator/projects/[id]/rewards.ts`
- Create: `pages/api/funding/creator/projects/[id]/submit.ts`
- Create: `tests/api/funding/creator/projects.test.ts`
- Create: `tests/api/funding/creator/submit.test.ts`

**Interfaces:**
- Consumes: Task 3~5 전부, `authenticateCreatorApi`(`lib/funding/creatorAuth.ts`), `isAllowedContactRequestOrigin`
- Produces: 없음(HTTP 경계)

- [ ] **Step 1: 네 라우트의 공통 규약을 정한다**

전부 같은 모양이다. `pages/api/funding/creator/login.ts`를 열어 순서를 확인하고 그대로 따른다.

1. `res.setHeader('Cache-Control', 'no-store')`
2. `req.method !== 'POST'` → 405
3. `isAllowedContactRequestOrigin(req)` 실패 → 403
4. `authenticateCreatorApi(req, res)` 실패 → 401
5. 입력 검증 → 실패면 400 + 사용자에게 보여 줄 한국어 메시지
6. 쓰기 서비스 호출 → `WriteResult`의 `code`를 상태 코드로 옮긴다: `not_found`→404, `locked`·`not_editable`→409, `duplicate_slug`·`duplicate_reward`·`too_many`→400

⚠️ **리워드 편집 요청은 `previousRewardId`를 필수로 받는다.** 서비스는 그 인자가 없으면 "새 리워드 추가"로 해석하므로, 화면이 빠뜨리면 개설자가 id를 고칠 때마다 티어가 하나씩 늘어난다. 서비스 함수만으로는 막을 수 없는 계약이니 **라우트 스키마가 강제한다**: 바디에 `mode: 'create' | 'update' | 'delete' | 'reorder'`를 두고 `update`면 `previousRewardId`를 요구한다. 없으면 400.
7. 성공 → 200 `{ ok: true }` (새 프로젝트는 `{ ok: true, id }`)

**요청 제한을 건다.** 저장은 `creator_save:<creatorId>` 키로 분당 30회, 업로드는 `creator_upload:<creatorId>` 키로 시간당 60회. `consumeRateLimit`(`lib/booking/rate-limit.ts`)을 쓴다.

- [ ] **Step 2: 심사 신청 API의 추가 규칙**

`submit.ts`는 저장 API와 다르다.

- `nextReviewStatus(row.reviewStatus, 'submit')`이 null이면 409.
- **제출 전 필수값을 전부 다시 본다.** 구획별 저장은 빈 값을 허용하므로, 여기서 처음으로 "다 채워졌는가"를 묻는다: 기본정보 4필드, 본문 200자 이상, 리워드 1개 이상, 개설자 이름. 하나라도 비면 400과 **어느 구획이 비었는지**를 알려 준다.
- 개설자 약관 동의를 받는다. 바디의 `agreedTermsVersion`이 현재 판본과 같아야 하고, 다르면 400. 동의 시각과 판본을 행에 기록한다(`creatorTermsAgreedAt`·`creatorTermsVersion`).
  - 판본 상수는 `lib/funding/policy.ts`에 `FUNDING_CREATOR_TERMS_VERSION`으로 둔다. **약관 본문은 3차에서 쓴다** — 2차에서는 상수와 기록만 만들고, 화면에는 "개설자 약관에 동의합니다" 체크박스와 3차에서 채울 링크 자리를 둔다.
  - ⚠️ 약관 본문이 없는 상태로 동의를 받으면 그 동의는 증거가 아니다. 그래서 **이 체크박스는 3차 약관 본문이 붙기 전까지 화면에 뜨지 않는다** — `FUNDING_CREATOR_TERMS_VERSION`이 빈 문자열이면 체크박스를 렌더하지 않고 API도 요구하지 않는다. 3차에서 본문과 판본을 함께 채운다.
- 성공하면 운영자에게 메일을 보낸다(`lib/funding/email.ts`의 `send` 패턴). 제목 `[펀딩] 심사 요청 — {제목}`, 본문에 개설자 연락처와 관리자 링크. **메일 실패는 삼키고 기록만 남긴다** — 제출 자체가 실패하면 안 된다.

- [ ] **Step 3: 테스트를 쓴다**

`tests/api/funding/creator/projects.test.ts`가 단언할 것:

- POST 아닌 메서드 → 405
- Origin 불허 → 403
- 세션 없음 → 401
- 남의 프로젝트 id → 404이고 **DB가 안 바뀐다**
- 검증 실패 → 400이고 메시지가 한국어
- 잠긴 리워드 수정 → 409
- 성공 → 200, DB에 반영
- `Cache-Control: no-store`

`tests/api/funding/creator/submit.test.ts`:

- 필수값이 빈 프로젝트 → 400이고 **어느 구획이 비었는지** 메시지에 있다
- 정상 → 200이고 `reviewStatus`가 `submitted`
- 이미 `submitted` → 409
- 메일 발송이 실패해도 200이고 상태는 바뀐다

- [ ] **Step 4: 확인하고 커밋한다**

```bash
npm run type-check && npm run lint && npm test
git add pages/api/funding/creator tests/api/funding/creator lib/funding/policy.ts
git commit -m "$(cat <<'EOF'
feat(funding): 개설자 저장·심사 신청 API

구획별 저장은 빈 값을 허용하고, "다 채워졌는가"는 심사 신청이 처음으로 묻는다 — 쓰다 만
상태를 저장할 수 없으면 긴 폼을 채울 수가 없다. 제출 메일이 실패해도 제출 자체는 성공한다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 편집 화면

**Files:**
- Create: `components/funding/creator/BasicSectionForm.tsx`
- Create: `components/funding/creator/StorySectionForm.tsx`
- Create: `components/funding/creator/RewardSectionForm.tsx`
- Create: `components/funding/creator/CreatorSectionForm.tsx`
- Create: `components/funding/creator/ImageUploadField.tsx`
- Create: `pages/[locale]/funding/creator/[id].tsx`
- Modify: `pages/[locale]/funding/creator/index.tsx`
- Create: `tests/pages/funding/creator/edit.test.ts`

**Interfaces:**
- Consumes: Task 7의 API들, `components/ui/Field.tsx`의 `TextInput`·`TextArea`·`Select`, `components/ui/Button.tsx`
- Produces: 없음(화면)

- [ ] **Step 1: 화면 구조**

한 페이지에 탭 4개. 각 구획은 자기 "저장" 버튼을 갖는다(구획별 부분 저장).

| 탭 | 내용 |
|---|---|
| 기본정보 | 제목, 한 줄 요약, 주소(slug), 대표 이미지 업로드, 목표 금액, 시작·종료일 |
| 스토리 | 마크다운 textarea + 이미지 삽입 버튼 + "미리보기" 링크 |
| 리워드 | 카드 목록. 추가·수정·삭제·정렬. 잠긴 카드는 금액·수량 입력이 비활성이고 그 이유를 한 줄로 적는다 |
| 개설자 정보 | 공개 이름, 담당자·연락처, 소개, 링크 |

상단에 상태 배지와 운영자 메모(`reviewNote`)를 띄운다. 보완 요청을 받은 개설자가 **무엇을 고쳐야 하는지 가장 먼저 봐야 한다.**

하단에 "심사 신청" 버튼. 심사 중이면 전 구획을 읽기 전용으로 만들고 "심사 중입니다"를 띄운다.

- [ ] **Step 2: 지켜야 할 것**

- `getServerSideProps`는 로케일 가드 → `authenticateCreatorRequest` → `loadProjectForCreator` 순서다. 인증 실패는 `/ko/funding/apply`로, 프로젝트를 못 찾으면 `notFound`.
- **props에 개설자의 비공개 필드를 싣지 않는다.** `taxType`·`payoutAccount`는 이 화면이 쓰지 않으므로 `__NEXT_DATA__`에 들어가면 안 된다. `data/artists/index.ts`의 `toArtistCardData`가 같은 이유로 필드를 골라 담는다 — 그 방식을 따른다.
- 저장은 `fetch('/api/...', { method: 'POST' })`. 같은 출처라 Origin 검사를 통과한다.
- 저장 중·성공·실패 상태를 각 구획이 따로 보여 준다. 실패 메시지는 서버가 준 한국어를 그대로 쓴다.
- 이미지 업로드 필드는 진행 표시와 실패 메시지를 갖는다. 성공하면 받은 주소를 폼 값에 넣는다.
- 버튼은 `bg-primary`. 삭제는 `outline` variant에 빨간 텍스트.

- [ ] **Step 3: 목록 화면을 잇는다**

`pages/[locale]/funding/creator/index.tsx`에 "새 프로젝트 만들기" 버튼(POST `/api/funding/creator/projects` → 받은 id로 이동)과 각 항목의 편집 링크를 더한다. 로그아웃 링크도 여기 둔다(POST `/api/funding/creator/logout`).

⚠️ 이 페이지는 `PRIVATE_PAGE_ROUTES`에 없지만 착지 페이지(`creator/auth`)는 있다. 목록·편집 화면의 이탈 링크 규칙은 그 목록에 올라 있는 페이지에만 적용된다 — **편집 화면을 그 목록에 올리지 않는다**(토큰이 URL에 실리지 않으므로 대상이 아니다).

- [ ] **Step 4: 테스트**

화면 자체보다 `getServerSideProps`를 단언한다.

- 비-ko 로케일 → `/ko/...`로 리다이렉트
- 세션 없음 → `/ko/funding/apply`로 리다이렉트
- 남의 프로젝트 → `notFound`
- props에 `taxType`·`payoutAccount`가 **없다**

- [ ] **Step 5: 확인하고 커밋한다**

```bash
npm run type-check && npm run lint && npm test
git add components/funding/creator 'pages/[locale]/funding/creator' tests/pages/funding/creator
git commit -m "$(cat <<'EOF'
feat(funding): 개설자 편집 화면 4구획

구획마다 따로 저장한다 — 긴 폼을 한 번에 다 채워야 저장되면 아무도 못 쓴다. 운영자 메모는
맨 위에 둔다. 보완 요청을 받은 개설자가 가장 먼저 봐야 하는 것이다.

props에는 화면이 쓰는 필드만 담는다. 세금 처리·정산 계좌가 __NEXT_DATA__에 실릴 이유가 없다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: 미리보기

승인 전에는 이것이 개설자가 자기 페이지를 보는 **유일한 수단**이다.

**Files:**
- Create: `components/funding/ProjectDetailView.tsx`
- Modify: `pages/[locale]/funding/[slug]/index.tsx`
- Create: `pages/[locale]/funding/creator/[id]/preview.tsx`
- Create: `components/funding/ProjectDetailView.test.tsx`

**Interfaces:**
- Consumes: 기존 `ImageHero`·`FundingProgress`·`RewardCard`·`MarkdownRenderer`
- Produces: `ProjectDetailView` — 공개 페이지와 미리보기가 공유하는 합성 컴포넌트

- [ ] **Step 1: 공개 페이지에서 본문 합성을 뽑아낸다**

`pages/[locale]/funding/[slug]/index.tsx`의 히어로·본문·리워드 배치를 `ProjectDetailView`로 옮긴다. **SEO·스키마·진행률 폴링·후원 CTA는 페이지에 남긴다** — 미리보기에는 없어야 하는 것들이다.

`ProjectDetailView`의 props:

```ts
interface ProjectDetailViewProps {
  project: FundingProject;
  state: ProjectState;
  /** 미리보기는 실제 모금액이 없다. 없으면 진행률 대신 "미리보기" 표시를 낸다. */
  status?: { pledgedAmount: number; backerCount: number } | null;
  /** 후원 버튼을 그릴지. 미리보기는 false. */
  interactive: boolean;
}
```

**이 태스크는 공개 페이지의 겉모습을 바꾸지 않는다.** 옮기기 전후로 기존 테스트가 전부 그대로 녹색이어야 한다.

- [ ] **Step 2: 미리보기 페이지**

`pages/[locale]/funding/creator/[id]/preview.tsx`:

- `getServerSideProps`에서 로케일 가드 → 인증 → `loadProjectForCreator` → DB 행을 `rowsToFundingProject`(`lib/funding/dbProjects.ts`)로 도메인 객체로 만든다.
- **검증에 걸리면 미리보기를 못 그린다.** 그때는 `notFound`가 아니라 "아직 미리 볼 수 없습니다. 기본정보와 리워드를 먼저 채워 주세요."를 띄운다. 초안은 필수값이 비어 있는 것이 정상이다.
- 상단에 고정 띠: "미리보기입니다. 아직 공개되지 않았습니다." 와 편집으로 돌아가는 링크.
- `noindex`, `no-store`.

- [ ] **Step 3: 테스트**

- `ProjectDetailView`가 `interactive: false`이면 후원 버튼을 그리지 않는다.
- `status`가 null이면 진행률 숫자 대신 미리보기 표시를 낸다.
- 미리보기 `getServerSideProps`: 남의 프로젝트 → `notFound`, 필수값이 빈 프로젝트 → props에 `incomplete: true`.

- [ ] **Step 4: 확인하고 커밋한다**

```bash
npm run type-check && npm run lint && npm test
git add components/funding/ProjectDetailView.tsx components/funding/ProjectDetailView.test.tsx 'pages/[locale]/funding'
git commit -m "$(cat <<'EOF'
feat(funding): 미리보기 — 공개 페이지와 같은 컴포넌트로 그린다

승인 전에는 이것이 개설자가 자기 페이지를 보는 유일한 수단이다. 미리보기가 공개 화면과
다르면 보여 준 의미가 없으므로 합성 자체를 공유한다. SEO·스키마·후원 CTA는 페이지에 남는다.

초안은 필수값이 비어 있는 것이 정상이라, 검증에 걸리면 404가 아니라 무엇을 채워야 하는지
알려 준다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: 전체 검증과 문서

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-09-17-funding-self-serve-design.md`

- [ ] **Step 1: 전체 검사**

```bash
npm run generate:manifests
npm run type-check
npm run lint
npm test
env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN npm run build
```

전부 통과해야 한다. 특히 이것들의 결과를 개별로 보고서에 적는다: `content/funding.baseline.test.ts`, `lib/funding/creatorProjectWrite.integration.test.ts`, `lib/koOnlyRoutes.test.ts`, `tests/pages/privateLinkNavigation.test.ts`, `tests/config/noStoreHeaders.test.ts`.

- [ ] **Step 2: 공개 화면이 안 바뀐 것을 확인한다**

빌드 산출물에서 `/ko/funding`과 `/ko/funding/[slug]`가 여전히 ISR(revalidate 1m)인지 보고, 새로 생긴 라우트 목록을 보고서에 적는다. 공개 경로에 새 항목이 생겼으면 그건 이 계획의 범위를 벗어난 것이다.

- [ ] **Step 3: `CLAUDE.md`에 규칙을 더한다**

1차에서 넣은 "펀딩 프로젝트의 정본은 둘이다" 절 **바로 아래**에:

```markdown
### 개설자가 쓴 것은 우리가 쓴 것과 다르게 다룬다

펀딩 프로젝트를 아티스트가 직접 등록한다. 그래서 세 가지가 코드로 강제된다.

- **본문의 신뢰 숏코드를 저장 시점에 벗긴다**(`lib/funding/creatorContent.ts`).
  `%%price:...%%`·`%%studio-services%%`는 스튜디오가 자기 글에 쓰라고 만든 장치라, 개설자
  글에 뜨면 읽는 쪽이 그 프로젝트에 대한 우리 보증으로 읽는다. 렌더 시점이 아니라 저장
  시점에 벗기는 이유는 렌더 경로가 여럿이라(상세·미리보기·OG·llms) 한 곳을 빠뜨리면 그
  경로로만 새어 나가기 때문이다.
- **승인된 리워드는 id·금액·한정 여부를 바꿀 수 없다**(`lib/funding/creatorProjectWrite.ts`의
  `lockedViolation`). md 시절 `content/funding.baseline.json`이 하던 일이고, 운영자에게도
  예외가 없다. 가격을 바꿔야 하면 새 id로 티어를 추가한다.
- **slug는 예약어를 피한다**(`lib/funding/reservedSlugs.ts`). 리터럴 라우트가 `[slug]`를
  이기므로 프로젝트를 `apply`로 지으면 그 상세는 어떤 주소로도 안 열린다. 오류도 안 난다.
  `pages/[locale]/funding/` 아래 리터럴 라우트를 추가하면 그 목록에도 넣어야 한다.

업로드 이미지는 sharp로 다시 인코딩해 **private** Blob에 올리고 `/api/funding/media/`가
대신 내보낸다 — 그 저장소에는 계약서 PDF가 있어 공개 업로드를 섞을 수 없다(소셜 이미지가
이미 같은 길을 간다). 치수는 주소 쿼리(`?w=&h=`)로 실어 보낸다. `utils/imageMetadata.json`은
저장소의 정적 이미지만 알기 때문이다.
```

- [ ] **Step 4: 스펙의 진행 상태를 갱신한다**

`docs/superpowers/specs/2026-09-17-funding-self-serve-design.md` §12 구현 순서에서 1~3단계에 완료 표시를 하고, 3차(관리자 심사)로 넘어가는 항목을 명시한다.

- [ ] **Step 5: 커밋**

푸시와 PR은 하지 않는다. 컨트롤러가 최종 리뷰 뒤에 처리한다.

---

## 3차로 넘기는 것

이 계획에서 **하지 않는** 것들이다. 3차 계획 문서가 받는다.

- 관리자 프로젝트 목록·상세·판정(승인·보완 요청·반려), 승인 시 slug 확정과 `lockedAt` 기록
- 승인·판정 알림 메일, 관리자 대시보드 대기열
- 온디맨드 `res.revalidate()` — 목록과 상세 **양쪽**
- 개설자 약관 본문과 `FUNDING_CREATOR_TERMS_VERSION` 실제 값. **2차는 상수 자리만 만들고 빈 값이면 동의 절차를 띄우지 않는다**
- 후원자 약관 개정과 `FUNDING_TERMS_VERSION` 인상 — 첫 DB 프로젝트가 공개되기 **전**에. 변호사 확인 항목
- 승인 뒤 스토리 편집 허용(스펙 §6.4) — 2차는 승인 뒤 전부 잠근다
- 개설자 `name` 기본값이 이메일 로컬파트인 문제 — 공개 화면에 개설자 이름을 표시하기 전에 해소
- 로그인 메일 전역 일일 캡 — 개설자 흐름을 사이트에서 링크하기 전에
