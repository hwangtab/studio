# 보도자료 메일 수신거부 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 보도자료 메일에 서명된 원클릭 수신거부 링크를 넣고, 거부 의사가 운영자 맥의 registry까지 실제로 되돌아오게 하며, 되돌아오지 않았으면 발송을 막는다.

**Architecture:** 토큰은 HMAC 서명(발송 전 DB 기록 없음), 저장은 주소가 아니라 해시. `studio`의 API 라우트 하나가 GET(확인 화면)과 POST(원클릭)를 모두 받고, Turso에 한 줄을 남긴다. `music-promo`가 그 줄을 당겨와 registry에 반영하며, 당긴 지 24시간이 지나면 `send`가 멈춘다.

**Tech Stack:** Next.js 15 Pages Router · Turso + Drizzle · Node `node:crypto` · music-promo는 무런타임의존 TypeScript CLI + `node:test`

**Spec:** `docs/superpowers/specs/2026-09-14-press-unsubscribe-design.md`

## Global Constraints

- 두 저장소의 경로(이 작업은 **worktree**에서 한다 — 본 체크아웃에서는 다른 세션이 동시에 작업 중이다):
  `studio` = `/Users/hwang-gyeongha/studio-press-unsub` (브랜치 `feat/press-unsubscribe`),
  `music-promo` = `/Users/hwang-gyeongha/music-promo-press-unsub` (브랜치 `feat/press-unsubscribe`).
  **본 체크아웃(`~/studio`, `~/music-promo`)은 건드리지 않는다.**
- **토큰 형식은 두 저장소가 각자 구현하고 같은 벡터 파일로 고정한다.** 공유 패키지를 만들지 않는다 — 저장소 둘의 빌드·배포가 완전히 다르다. 대신 Task 1이 만드는 `press-token-vectors.json`을 **글자 그대로 같은 내용으로** 양쪽에 두고, 양쪽 테스트가 그 벡터를 검증한다. 드리프트는 그 테스트가 잡는다.
- 토큰 payload: `{"v":1,"h":<주소해시 32자>,"c":<캠페인 슬러그>,"l":<로케일>,"t":<발급 epoch 초>}`. 키 순서는 `v,h,c,l,t` 고정 — `JSON.stringify`의 출력이 서명 대상이라 순서가 바뀌면 서명이 깨진다.
- 주소 해시: `sha256(주소를 trim·소문자화한 것 + salt)`의 hex **앞 32자**.
- env 이름: `PRESS_UNSUB_SECRET`(양쪽) · `PRESS_UNSUB_SALT`(music-promo 전용) · `PRESS_PULL_TOKEN`(양쪽).
- 수신거부 링크 베이스: `https://press.studionol.co.kr/u/`
- 마이그레이션 SQL은 커밋하고 **프로덕션 적용(`npm run db:migrate`)은 운영자가 직접 한다.** 에이전트가 실행하지 않는다.
- studio는 `npm run type-check` → `npm run lint` → `npx jest <해당 테스트>`로 검증한다. music-promo는 `npm run typecheck` → `npm test`.
- 커밋 메시지 말미: `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

---

### Task 1: 토큰 형식과 music-promo 쪽 서명

**Files:**
- Create: `music-promo/src/core/unsubscribe.ts`
- Create: `music-promo/tests/press-token-vectors.json`
- Create: `music-promo/tests/unsubscribe.test.ts`

**Interfaces:**
- Consumes: 없음 (첫 과제)
- Produces:
  - `type UnsubPayload = { v: 1; h: string; c: string; l: string; t: number }`
  - `emailHash(email: string, salt: string): string`
  - `signToken(payload: UnsubPayload, secret: string): string`
  - `verifyToken(token: string, secret: string): UnsubPayload | null`
  - `unsubscribeUrl(payload: UnsubPayload, secret: string, base?: string): string`

- [ ] **Step 1: 벡터 파일을 만든다**

`music-promo/tests/press-token-vectors.json` — 이 내용은 Task 2에서 studio에 **글자 그대로** 복사된다.

```json
{
  "note": "두 저장소가 같은 토큰 형식을 쓰는지 고정하는 벡터. studio/tests/press/press-token-vectors.json과 내용이 같아야 한다.",
  "secret": "vector-secret-not-for-production",
  "salt": "vector-salt-not-for-production",
  "cases": [
    {
      "email": "Critic@Example.com",
      "hash": "bfb9572515b1f09d46fa0c352d7a5fef",
      "payload": { "v": 1, "h": "bfb9572515b1f09d46fa0c352d7a5fef", "c": "namsan-tower", "l": "ko", "t": 1789000000 },
      "token": "eyJ2IjoxLCJoIjoiYmZiOTU3MjUxNWIxZjA5ZDQ2ZmEwYzM1MmQ3YTVmZWYiLCJjIjoibmFtc2FuLXRvd2VyIiwibCI6ImtvIiwidCI6MTc4OTAwMDAwMH0.tWoB3NPqUmOlpy8qxP_meGfk-86nPTdQ2hI9u22W6K4"
    },
    {
      "email": " editor@press.example.jp ",
      "hash": "d59b5966b777ea2e442b91f8b846ffb8",
      "payload": { "v": 1, "h": "d59b5966b777ea2e442b91f8b846ffb8", "c": "ksfp-press", "l": "ja", "t": 1789000001 },
      "token": "eyJ2IjoxLCJoIjoiZDU5YjU5NjZiNzc3ZWEyZTQ0MmI5MWY4Yjg0NmZmYjgiLCJjIjoia3NmcC1wcmVzcyIsImwiOiJqYSIsInQiOjE3ODkwMDAwMDF9.bfv6WCfpUlb9SiSIxY68wRk5q4SyKRC3d7Rqv07Vteo"
    }
  ]
}
```

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`music-promo/tests/unsubscribe.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { emailHash, signToken, unsubscribeUrl, verifyToken } from "../src/core/unsubscribe";

/**
 * 토큰 형식은 두 저장소가 각자 구현한다 — 공유 패키지를 만들 만큼의 코드가 아니고,
 * studio와 music-promo는 빌드·배포가 완전히 다르다.
 *
 * 대신 같은 벡터 파일을 양쪽에 두고 양쪽이 검증한다. 한쪽이 형식을 바꾸면 자기
 * 테스트가 먼저 깨지므로, "발송은 되는데 서버가 토큰을 못 읽는" 상태로 배포될 수 없다.
 */
const vectors = JSON.parse(
  readFileSync(join(__dirname, "press-token-vectors.json"), "utf8"),
) as {
  secret: string;
  salt: string;
  cases: { email: string; hash: string; payload: Record<string, unknown>; token: string }[];
};

test("주소 해시가 벡터와 같다", () => {
  for (const c of vectors.cases) {
    assert.equal(emailHash(c.email, vectors.salt), c.hash, c.email);
  }
});

/** 주소는 대소문자를 가리지 않고, 앞뒤 공백은 주소의 일부가 아니다. */
test("대소문자·공백이 달라도 같은 해시다", () => {
  const a = emailHash("Critic@Example.com", vectors.salt);
  assert.equal(emailHash("  critic@example.COM  ", vectors.salt), a);
});

/** 솔트가 곧 이 해시의 비밀이다. 같으면 주소를 사전 대입으로 복원할 수 있다. */
test("솔트가 다르면 다른 해시다", () => {
  assert.notEqual(emailHash("a@b.com", "salt-one"), emailHash("a@b.com", "salt-two"));
});

test("서명 결과가 벡터와 같다", () => {
  for (const c of vectors.cases) {
    assert.equal(signToken(c.payload as never, vectors.secret), c.token);
  }
});

test("정상 토큰은 payload로 되돌아온다", () => {
  for (const c of vectors.cases) {
    assert.deepEqual(verifyToken(c.token, vectors.secret), c.payload);
  }
});

test("키가 다르면 거부한다", () => {
  assert.equal(verifyToken(vectors.cases[0].token, "wrong-secret"), null);
});

/**
 * payload를 고치고 서명을 그대로 두는 것이 가장 흔한 위조다 — 남의 주소 해시를
 * 끼워 넣어 임의의 수신자를 거부시킬 수 있으면 안 된다.
 */
test("payload를 고치면 거부한다", () => {
  const [body, mac] = vectors.cases[0].token.split(".");
  const tampered = Buffer.from(
    JSON.stringify({ ...vectors.cases[0].payload, h: "0".repeat(32) }),
    "utf8",
  ).toString("base64url");
  assert.notEqual(tampered, body);
  assert.equal(verifyToken(`${tampered}.${mac}`, vectors.secret), null);
});

test("모양이 아닌 문자열은 던지지 않고 null을 준다", () => {
  for (const bad of ["", ".", "abc", "a.b.c", "....", "x".repeat(500)]) {
    assert.equal(verifyToken(bad, vectors.secret), null, JSON.stringify(bad));
  }
});

test("URL은 베이스 뒤에 토큰만 붙인다", () => {
  const url = unsubscribeUrl(vectors.cases[0].payload as never, vectors.secret);
  assert.equal(url, `https://press.studionol.co.kr/u/${vectors.cases[0].token}`);
});
```

- [ ] **Step 3: 실패를 확인한다**

Run: `cd /Users/hwang-gyeongha/music-promo-press-unsub && npx tsx --test tests/unsubscribe.test.ts`
Expected: FAIL — `Cannot find module '../src/core/unsubscribe'`

- [ ] **Step 4: 구현한다**

`music-promo/src/core/unsubscribe.ts`:

```ts
/**
 * 수신거부 링크의 토큰.
 *
 * 이 저장소의 다른 토큰(펀딩·예약)과 달리 DB에 미리 심어 두지 않는다. 그러려면
 * 발송 전에 수신자 1,742명분 행을 클라우드에 만들어야 하고, 그건 기자·평론가 명단을
 * 통째로 올리는 것이다. 서명이면 링크는 여기서 만들어지고 서버는 클릭이 일어난
 * 뒤에야 한 줄을 갖는다.
 *
 * 주소도 토큰에 넣지 않는다. `h`는 주소가 아니라 솔트를 섞은 해시이고, 솔트는 이
 * 기계에만 있다. 서버는 그 값을 되돌릴 필요가 없다 — 저장했다가 그대로 돌려주면
 * 우리가 우리 명단에서 맞춘다. 주소가 이 기계를 떠나지 않는다.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type UnsubPayload = {
  v: 1;
  /** sha256(주소 + 솔트)의 앞 32자. 주소 자체가 아니다. */
  h: string;
  /** 캠페인 슬러그. 언제부터 거부했는지의 맥락으로만 쓴다. */
  c: string;
  /** 확인 화면의 언어. */
  l: string;
  /** 발급 시각(epoch 초). 만료에는 쓰지 않고 감사·키 교체 때 경계를 긋는 용도다. */
  t: number;
};

export const UNSUB_BASE = "https://press.studionol.co.kr/u/";

export function emailHash(email: string, salt: string): string {
  return createHash("sha256")
    .update(`${email.trim().toLowerCase()}${salt}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * 키 순서가 서명의 일부다.
 *
 * 서명 대상이 JSON.stringify의 출력이라 필드를 다른 순서로 조립하면 같은 내용인데
 * 다른 토큰이 나온다. 객체를 여기서 다시 만들어 순서를 못 박는다 — 호출부가 넘긴
 * 객체의 키 순서에 의존하지 않게 한다.
 */
function canonical(payload: UnsubPayload): string {
  const { v, h, c, l, t } = payload;
  return Buffer.from(JSON.stringify({ v, h, c, l, t }), "utf8").toString("base64url");
}

function mac(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

export function signToken(payload: UnsubPayload, secret: string): string {
  const body = canonical(payload);
  return `${body}.${mac(body, secret)}`;
}

export function verifyToken(token: string, secret: string): UnsubPayload | null {
  const dot = token.indexOf(".");
  if (dot < 1 || dot === token.length - 1) return null;
  const body = token.slice(0, dot);
  const given = token.slice(dot + 1);
  if (given.includes(".")) return null;

  /**
   * 길이가 다르면 timingSafeEqual이 던진다. 양쪽을 sha256으로 고정 길이화해서
   * 넘긴다 — studio의 isTokenMatch(lib/booking/token.ts)와 같은 판단이다.
   */
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(mac(body, secret)).digest();
  if (!timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as UnsubPayload;
    if (parsed?.v !== 1) return null;
    if (typeof parsed.h !== "string" || !/^[0-9a-f]{32}$/.test(parsed.h)) return null;
    if (typeof parsed.c !== "string" || !parsed.c) return null;
    if (typeof parsed.l !== "string" || !parsed.l) return null;
    if (typeof parsed.t !== "number" || !Number.isFinite(parsed.t)) return null;
    return { v: 1, h: parsed.h, c: parsed.c, l: parsed.l, t: parsed.t };
  } catch {
    return null;
  }
}

export function unsubscribeUrl(
  payload: UnsubPayload,
  secret: string,
  base: string = UNSUB_BASE,
): string {
  return `${base}${signToken(payload, secret)}`;
}
```

- [ ] **Step 5: 통과를 확인한다**

Run: `cd /Users/hwang-gyeongha/music-promo-press-unsub && npm run typecheck && npx tsx --test tests/unsubscribe.test.ts`
Expected: 모두 PASS

- [ ] **Step 6: 커밋**

```bash
cd /Users/hwang-gyeongha/music-promo-press-unsub
git add src/core/unsubscribe.ts tests/unsubscribe.test.ts tests/press-token-vectors.json
git commit -m "feat(unsubscribe): 수신거부 토큰 — 서명은 하되 명단은 올리지 않는다

$(printf '%s' 'DB에 미리 심는 토큰(펀딩·예약 방식)을 쓰면 발송 전에 1,742명분 행을
클라우드에 만들어야 하고 그게 곧 기자 명단 업로드다. HMAC이면 링크는 로컬에서
만들어지고 서버는 클릭 뒤에야 한 줄을 갖는다.

주소도 토큰에 넣지 않는다 — h는 솔트를 섞은 해시이고 솔트는 이 기계에만 있다.

토큰 형식은 studio와 각자 구현하되 tests/press-token-vectors.json으로 고정한다.
한쪽이 형식을 바꾸면 자기 테스트가 먼저 깨진다.')

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: studio 쪽 토큰 검증

**Files:**
- Create: `studio/lib/press/token.ts`
- Create: `studio/tests/press/press-token-vectors.json` (Task 1의 파일과 내용 동일)
- Create: `studio/lib/press/token.test.ts`

**Interfaces:**
- Consumes: Task 1의 토큰 형식과 벡터 파일
- Produces: `verifyPressToken(token: string, secret: string): PressUnsubPayload | null`, `type PressUnsubPayload = { v: 1; h: string; c: string; l: string; t: number }`

**서명 함수는 두지 않는다.** studio는 토큰을 만들 이유가 없고, 만들 수 있는 코드가 있으면 언젠가 쓰인다.

- [ ] **Step 1: 벡터 파일을 복사한다**

```bash
mkdir -p /Users/hwang-gyeongha/studio-press-unsub/tests/press
cp /Users/hwang-gyeongha/music-promo-press-unsub/tests/press-token-vectors.json \
   /Users/hwang-gyeongha/studio-press-unsub/tests/press/press-token-vectors.json
```

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`studio/lib/press/token.test.ts`:

```ts
import fs from 'fs';
import path from 'path';
import { verifyPressToken } from './token';

/**
 * music-promo가 만든 토큰을 이쪽이 읽을 수 있어야 한다.
 *
 * 두 저장소가 각자 구현하므로, 벡터가 어긋나면 "발송은 되는데 수신거부 링크가
 * 전부 죽은" 상태가 된다. 그 상태는 배포 후 기자가 눌러 봐야 드러나므로 여기서 막는다.
 * 벡터 파일은 music-promo/tests/press-token-vectors.json과 내용이 같아야 한다.
 */
const vectors = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'tests', 'press', 'press-token-vectors.json'), 'utf8'),
) as {
  secret: string;
  cases: { payload: Record<string, unknown>; token: string }[];
};

describe('verifyPressToken', () => {
  it('music-promo가 서명한 토큰을 payload로 되돌린다', () => {
    for (const c of vectors.cases) {
      expect(verifyPressToken(c.token, vectors.secret)).toEqual(c.payload);
    }
  });

  it('키가 다르면 거부한다', () => {
    expect(verifyPressToken(vectors.cases[0].token, 'wrong-secret')).toBeNull();
  });

  it('payload를 고치면 거부한다', () => {
    const mac = vectors.cases[0].token.split('.')[1];
    const tampered = Buffer.from(
      JSON.stringify({ ...vectors.cases[0].payload, h: '0'.repeat(32) }),
      'utf8',
    ).toString('base64url');
    expect(verifyPressToken(`${tampered}.${mac}`, 'wrong-secret')).toBeNull();
    expect(verifyPressToken(`${tampered}.${mac}`, vectors.secret)).toBeNull();
  });

  it('모양이 아닌 입력에 던지지 않는다', () => {
    for (const bad of ['', '.', 'abc', 'a.b.c', '....', 'x'.repeat(500)]) {
      expect(verifyPressToken(bad, vectors.secret)).toBeNull();
    }
  });
});
```

- [ ] **Step 3: 실패를 확인한다**

Run: `cd /Users/hwang-gyeongha/studio-press-unsub && npx jest lib/press/token.test.ts`
Expected: FAIL — `Cannot find module './token'`

- [ ] **Step 4: 구현한다**

`studio/lib/press/token.ts`:

```ts
/**
 * 보도자료 수신거부 토큰의 검증.
 *
 * 발급은 music-promo(운영자 맥)가 하고 여기서는 읽기만 한다. 서명 함수를 두지
 * 않는 것은 의도다 — 이쪽이 토큰을 만들 이유가 없고, 만들 수 있는 코드가 있으면
 * 언젠가 쓰인다.
 *
 * 형식이 어긋나면 "발송은 되는데 수신거부 링크가 전부 죽은" 상태가 되고 그건
 * 기자가 눌러 봐야 드러난다. tests/press/press-token-vectors.json이 그걸 막는다.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export type PressUnsubPayload = {
  v: 1;
  /** sha256(주소 + 솔트)의 앞 32자. 솔트는 운영자 맥에만 있어 이쪽은 주소를 모른다. */
  h: string;
  c: string;
  l: string;
  t: number;
};

export const verifyPressToken = (token: string, secret: string): PressUnsubPayload | null => {
  const dot = token.indexOf('.');
  if (dot < 1 || dot === token.length - 1) return null;
  const body = token.slice(0, dot);
  const given = token.slice(dot + 1);
  if (given.includes('.')) return null;

  // 길이 차이가 실행 시간에 드러나지 않게 고정 길이화 후 비교 (lib/booking/token.ts와 동일).
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  if (!timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as PressUnsubPayload;
    if (parsed?.v !== 1) return null;
    if (typeof parsed.h !== 'string' || !/^[0-9a-f]{32}$/.test(parsed.h)) return null;
    if (typeof parsed.c !== 'string' || !parsed.c) return null;
    if (typeof parsed.l !== 'string' || !parsed.l) return null;
    if (typeof parsed.t !== 'number' || !Number.isFinite(parsed.t)) return null;
    return { v: 1, h: parsed.h, c: parsed.c, l: parsed.l, t: parsed.t };
  } catch {
    return null;
  }
};
```

- [ ] **Step 5: 통과를 확인한다**

Run: `cd /Users/hwang-gyeongha/studio-press-unsub && npm run type-check && npx jest lib/press/token.test.ts`
Expected: 모두 PASS

- [ ] **Step 6: 커밋**

```bash
cd /Users/hwang-gyeongha/studio-press-unsub
git add lib/press/token.ts lib/press/token.test.ts tests/press/press-token-vectors.json
git commit -m "feat(press): 수신거부 토큰 검증 — 발급은 하지 않는다

토큰은 운영자 맥에서 만들어지고 이쪽은 읽기만 한다. 서명 함수를 두지 않는 것은
의도다 — 만들 수 있는 코드가 있으면 언젠가 쓰인다.

형식이 어긋나면 발송은 되는데 링크가 전부 죽고, 그건 기자가 눌러 봐야 드러난다.
music-promo와 같은 벡터 파일을 양쪽에서 검증해 그 상태로 배포되지 않게 한다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: 스키마와 저장소 계층

**Files:**
- Modify: `studio/db/schema.ts` (파일 끝에 추가)
- Create: `studio/drizzle/migrations/<다음 번호>_press_optouts.sql`
- Create: `studio/lib/press/optouts.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `recordPressOptout(input: { emailHash: string; campaignSlug: string; source: 'one-click' | 'page' }): Promise<void>`
  - `listPressOptouts(sinceEpoch: number, limit?: number): Promise<{ emailHash: string; campaignSlug: string; createdAt: number }[]>`

- [ ] **Step 1: 스키마를 추가한다**

`studio/db/schema.ts` 끝에:

```ts
/**
 * 보도자료 메일의 수신거부.
 *
 * 주소가 아니라 sha256(주소 + 솔트)의 앞 32자를 담는다. 솔트는 운영자 맥에만 있어
 * 이 테이블만으로는 누구인지 알 수 없고, 우리는 우리 명단에서 맞추므로 잃는 기능이
 * 없다. 기자·평론가 명단을 클라우드에 두지 않기 위한 선택이다.
 *
 * email_hash가 UNIQUE인 것과 삽입이 ON CONFLICT DO NOTHING인 것은 한 쌍이다 —
 * campaign_slug·created_at은 **처음 거부한 시점**이라 나중 값으로 덮으면
 * "언제부터 거부했는가"를 잃는다.
 */
export const pressOptoutSourceEnum = ['one-click', 'page'] as const;

export const pressOptouts = sqliteTable('press_optouts', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => sql`lower(hex(randomblob(16)))`),
  emailHash: text('email_hash').notNull().unique(),
  campaignSlug: text('campaign_slug').notNull(),
  source: text('source', { enum: pressOptoutSourceEnum }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});
```

- [ ] **Step 2: 마이그레이션을 생성한다**

```bash
cd /Users/hwang-gyeongha/studio-press-unsub
ls drizzle/migrations/          # 다음 번호 확인
npm run db:generate
git status --short drizzle/     # 새 .sql과 meta/_journal.json이 생겼는지 확인
```

생성된 SQL을 눈으로 확인한다. `CREATE TABLE press_optouts`와 `email_hash` UNIQUE 인덱스만 있어야 한다. **기존 테이블을 건드리는 문장이 하나라도 있으면 멈추고 보고한다** — 이 DB는 운영 중이고 추가 변경만 허용된다.

- [ ] **Step 3: 실패하는 테스트를 쓴다**

`studio/lib/press/optouts.test.ts`:

```ts
import { pressOptoutSourceEnum, pressOptouts } from '../../db/schema';

/**
 * DB에 붙는 부분은 단위 테스트로 검증하지 않는다 — 이 저장소에는 Turso를 띄우는
 * 테스트 하네스가 없고, 그걸 이 기능 하나를 위해 들이는 것은 과하다.
 *
 * 대신 스키마의 약속만 고정한다. 아래 두 가지가 깨지면 수신거부가 조용히
 * 덮어써지거나(UNIQUE 상실) 값이 안 맞는다.
 */
describe('press_optouts 스키마', () => {
  it('주소가 아니라 해시 컬럼을 갖는다', () => {
    const columns = Object.keys(pressOptouts);
    expect(columns).toContain('emailHash');
    expect(columns).not.toContain('email');
  });

  it('source는 두 값만 받는다', () => {
    expect([...pressOptoutSourceEnum]).toEqual(['one-click', 'page']);
  });
});
```

- [ ] **Step 4: 스키마 테스트를 확인한다**

Run: `cd /Users/hwang-gyeongha/studio-press-unsub && npx jest lib/press/optouts.test.ts`
Expected: PASS (Step 1에서 스키마를 이미 넣었다). FAIL이면 Step 1이 빠진 것이다.

- [ ] **Step 5: 저장소 계층을 구현한다**

`studio/lib/press/optouts.ts`:

```ts
/**
 * press_optouts 읽기·쓰기.
 *
 * 라우트가 Drizzle을 직접 부르지 않게 한 겹 둔다 — 쓰기 쪽의 "충돌이면 그대로 둔다"와
 * 읽기 쪽의 "since 이후"가 이 기능의 규칙이고, 라우트 두 개에 흩어지면 한쪽만 고쳐진다.
 */
import { asc, gt } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { pressOptouts } from '../../db/schema';

export type PressOptoutRow = {
  emailHash: string;
  campaignSlug: string;
  createdAt: number;
};

/**
 * 같은 해시가 다시 와도 성공으로 끝낸다.
 *
 * 두 번 눌렀다고 실패를 돌려주면 수신자는 거부가 안 된 줄 안다. 그리고 덮어쓰지도
 * 않는다 — campaign_slug·created_at은 처음 거부한 시점이라 기록으로서 의미가 있다.
 */
export const recordPressOptout = async (input: {
  emailHash: string;
  campaignSlug: string;
  source: 'one-click' | 'page';
}): Promise<void> => {
  await getDb()
    .insert(pressOptouts)
    .values({
      emailHash: input.emailHash,
      campaignSlug: input.campaignSlug,
      source: input.source,
    })
    .onConflictDoNothing({ target: pressOptouts.emailHash });
};

/**
 * since **초과**(이상이 아니라)로 읽는다.
 *
 * 호출부는 직전 응답의 now를 다음 since로 쓴다. 이상으로 읽으면 경계에 걸친 행을
 * 매번 다시 받아 오고, 그 자체로는 무해하지만 "새로 들어온 건수"가 늘 부풀어 보인다.
 */
export const listPressOptouts = async (
  sinceEpoch: number,
  limit = 1000,
): Promise<PressOptoutRow[]> => {
  const rows = await getDb()
    .select({
      emailHash: pressOptouts.emailHash,
      campaignSlug: pressOptouts.campaignSlug,
      createdAt: pressOptouts.createdAt,
    })
    .from(pressOptouts)
    .where(gt(pressOptouts.createdAt, new Date(sinceEpoch * 1000)))
    .orderBy(asc(pressOptouts.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    emailHash: row.emailHash,
    campaignSlug: row.campaignSlug,
    createdAt: Math.floor((row.createdAt?.getTime() ?? 0) / 1000),
  }));
};
```

- [ ] **Step 6: 통과를 확인한다**

Run: `cd /Users/hwang-gyeongha/studio-press-unsub && npm run type-check && npm run lint && npx jest lib/press/optouts.test.ts`
Expected: 모두 PASS

- [ ] **Step 7: 커밋**

```bash
cd /Users/hwang-gyeongha/studio-press-unsub
git add db/schema.ts drizzle/ lib/press/optouts.ts lib/press/optouts.test.ts
git commit -m "feat(press): press_optouts 테이블 — 주소가 아니라 해시를 담는다

솔트가 운영자 맥에만 있어 이 테이블만으로는 누구인지 알 수 없다. 우리는 우리
명단에서 맞추므로 잃는 기능이 없다.

email_hash UNIQUE와 ON CONFLICT DO NOTHING은 한 쌍이다 — campaign_slug·created_at은
처음 거부한 시점이라 나중 값으로 덮으면 '언제부터 거부했는가'를 잃는다.

마이그레이션 SQL만 커밋한다. 프로덕션 적용은 운영자가 직접 한다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: 수신거부 라우트 (GET 확인 화면 · POST 반영)

**Files:**
- Create: `studio/lib/press/page.ts` (확인 화면 HTML)
- Create: `studio/pages/api/press/unsubscribe/[token].ts`
- Create: `studio/pages/api/press/unsubscribe/handler.test.ts`

**Interfaces:**
- Consumes: `verifyPressToken` (Task 2), `recordPressOptout` (Task 3)
- Produces: `renderUnsubPage(state: 'confirm' | 'done' | 'invalid', locale: string, token: string): string`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`studio/pages/api/press/unsubscribe/handler.test.ts`:

```ts
import { renderUnsubPage } from '../../../../lib/press/page';

/**
 * 확인 화면은 기자가 보는 유일한 우리 화면이다.
 *
 * 여기서 고정하는 것은 모양이 아니라 **약속** 세 가지다.
 *   1. GET 화면은 아직 거부를 반영하지 않았다고 말한다(버튼을 눌러야 한다).
 *   2. 되돌리기 버튼을 두지 않는다 — registry에 해제 경로가 의도적으로 없는데
 *      화면에만 만들면 그 원칙이 무너진다. 회신으로 안내한다.
 *   3. 토큰이 화면 밖으로 새지 않는다(폼 안에만 있고 링크에는 없다).
 */
describe('renderUnsubPage', () => {
  it('확인 화면은 버튼을 누르라고 말하고 토큰을 폼에 담는다', () => {
    const html = renderUnsubPage('confirm', 'ko', 'TOKEN123');
    expect(html).toContain('<form');
    expect(html).toContain('method="post"');
    expect(html).toContain('TOKEN123');
    expect(html).toContain('수신거부');
  });

  it('완료 화면은 되돌리기 버튼 대신 회신을 안내한다', () => {
    const html = renderUnsubPage('done', 'ko', 'TOKEN123');
    expect(html).not.toContain('<form');
    expect(html).toContain('회신');
  });

  it('잘못된 토큰에도 상세한 오류를 말하지 않는다', () => {
    const html = renderUnsubPage('invalid', 'ko', '');
    expect(html).not.toMatch(/서명|signature|HMAC|만료/);
  });

  it('알 수 없는 로케일은 영어로 떨어진다', () => {
    const html = renderUnsubPage('confirm', 'xx', 'T');
    expect(html).toContain('lang="en"');
  });

  it('토큰을 HTML에 그대로 끼워 넣지 않는다 (따옴표 이스케이프)', () => {
    const html = renderUnsubPage('confirm', 'ko', '"><script>alert(1)</script>');
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `cd /Users/hwang-gyeongha/studio-press-unsub && npx jest pages/api/press/unsubscribe/handler.test.ts`
Expected: FAIL — `Cannot find module '../../../../lib/press/page'`

- [ ] **Step 3: 화면을 구현한다**

`studio/lib/press/page.ts`:

```ts
/**
 * 수신거부 확인 화면.
 *
 * React 페이지가 아니라 문자열이다. 원클릭 POST가 List-Unsubscribe의 그 URL로 오고
 * Pages Router의 페이지 컴포넌트는 POST를 못 받으므로 이 경로는 API 라우트여야
 * 한다. 그러면 화면도 여기서 만드는 편이 낫다 — 로케일 페이지를 만들면 사이트맵
 * 등록·lastmod 생성·robots disallow·privatePaths 등록이 따라오는데 전부 불필요하다.
 */
type State = 'confirm' | 'done' | 'invalid';

const COPY: Record<string, Record<State, { title: string; body: string; button?: string }>> = {
  ko: {
    confirm: {
      title: '수신거부',
      body: '아래 버튼을 누르시면 이 주소로 더 이상 보도자료를 보내지 않습니다.',
      button: '수신거부',
    },
    done: {
      title: '수신거부되었습니다',
      body: '더 이상 보내지 않습니다. 실수로 누르셨다면 받으신 메일에 회신해 주세요.',
    },
    invalid: {
      title: '수신거부',
      body: '이 링크로는 처리할 수 없습니다. 받으신 메일에 회신해 주시면 직접 처리해 드립니다.',
    },
  },
  ja: {
    confirm: {
      title: '配信停止',
      body: '下のボタンを押していただくと、このアドレスへのプレスリリース送付を停止します。',
      button: '配信停止',
    },
    done: {
      title: '配信を停止しました',
      body: '今後お送りしません。誤って押された場合は、受信されたメールにご返信ください。',
    },
    invalid: {
      title: '配信停止',
      body: 'このリンクでは処理できません。受信されたメールにご返信いただければ、こちらで対応いたします。',
    },
  },
  en: {
    confirm: {
      title: 'Unsubscribe',
      body: 'Press the button below and we will stop sending press releases to this address.',
      button: 'Unsubscribe',
    },
    done: {
      title: 'You have been unsubscribed',
      body: 'We will not write again. If you pressed this by mistake, just reply to the email you received.',
    },
    invalid: {
      title: 'Unsubscribe',
      body: 'This link cannot be processed. Reply to the email you received and we will take care of it.',
    },
  },
};

const esc = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const renderUnsubPage = (state: State, locale: string, token: string): string => {
  // ko·ja·en만 둔다. 그 밖의 언어 수신자에게도 메일 본문은 그 언어로 가지만, 이
  // 화면까지 아홉 언어를 유지하면 문구가 갈린 채 아무도 안 보게 된다.
  const lang = COPY[locale] ? locale : 'en';
  const copy = COPY[lang][state];

  const form =
    state === 'confirm'
      ? `<form method="post" action="/u/${esc(token)}">
      <button type="submit">${esc(copy.button ?? '')}</button>
    </form>`
      : '';

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(copy.title)}</title>
<style>
  body { margin: 0; padding: 48px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; color: #141414; background: #faf8f4; }
  main { max-width: 420px; margin: 0 auto; }
  h1 { font-size: 20px; margin: 0 0 14px; }
  p { font-size: 15px; line-height: 1.75; color: #4a4a4a; margin: 0 0 24px; }
  button { font: inherit; font-size: 15px; padding: 13px 26px; border: 0; border-radius: 7px; background: #c2410c; color: #fff; cursor: pointer; }
</style>
</head>
<body>
<main>
  <h1>${esc(copy.title)}</h1>
  <p>${esc(copy.body)}</p>
  ${form}
</main>
</body>
</html>`;
};
```

- [ ] **Step 4: 통과를 확인한다**

Run: `cd /Users/hwang-gyeongha/studio-press-unsub && npx jest pages/api/press/unsubscribe/handler.test.ts`
Expected: 모두 PASS

- [ ] **Step 5: 라우트를 구현한다**

`studio/pages/api/press/unsubscribe/[token].ts`:

```ts
import type { NextApiRequest, NextApiResponse } from 'next';

import { getClientIp } from '../../../../lib/contracts/client-ip';
import { consumeRateLimit } from '../../../../lib/booking/rate-limit';
import { recordPressOptout } from '../../../../lib/press/optouts';
import { renderUnsubPage } from '../../../../lib/press/page';
import { verifyPressToken } from '../../../../lib/press/token';

/**
 * 보도자료 수신거부.
 *
 * 한 경로가 GET과 POST를 모두 받는다. RFC 8058 원클릭은 List-Unsubscribe에 적힌
 * **그 URL로 POST**를 보내는데, Pages Router의 페이지 컴포넌트는 POST를 받지 못한다.
 *
 * GET은 거부를 반영하지 않는다. 메일 본문의 링크는 스팸 필터와 보안 게이트웨이가
 * 미리 열어 보는 일이 흔해서, GET에서 반영하면 기자가 누른 적도 없는데 거부 처리된다.
 */
const sendPage = (res: NextApiResponse, status: number, html: string): void => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(status).send(html);
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false });
  }

  const token = Array.isArray(req.query.token) ? req.query.token[0] : req.query.token;
  const secret = process.env.PRESS_UNSUB_SECRET;

  /**
   * 비밀키가 없으면 어떤 토큰도 검증할 수 없다. 이때 "수신거부되었습니다"를 보여
   * 주면 안 된다 — 실제로는 아무것도 기록되지 않았는데 기자는 끝난 줄 안다.
   */
  if (!secret) {
    console.error('[press-unsubscribe] PRESS_UNSUB_SECRET이 없습니다');
    return sendPage(res, 500, renderUnsubPage('invalid', 'en', ''));
  }

  const payload = token ? verifyPressToken(token, secret) : null;

  /**
   * 검증을 rate limit보다 먼저 한다.
   *
   * 반대로 하면 잘못된 링크를 반복해서 여는 것만으로 한도가 소진되어, 정작 제대로
   * 된 수신거부가 막힌다(pages/api/funding/pledges.ts:31-38에 기록된 함정).
   */
  if (!payload) {
    return req.method === 'POST'
      ? res.status(400).json({ ok: false })
      : sendPage(res, 400, renderUnsubPage('invalid', 'en', ''));
  }

  const ip = getClientIp(req);
  const allowed = await consumeRateLimit(`press-unsub:${ip ?? 'unknown'}`, 30, 300);
  if (!allowed) {
    return req.method === 'POST'
      ? res.status(429).json({ ok: false })
      : sendPage(res, 429, renderUnsubPage('invalid', payload.l, ''));
  }

  if (req.method === 'GET') {
    return sendPage(res, 200, renderUnsubPage('confirm', payload.l, token as string));
  }

  try {
    await recordPressOptout({
      emailHash: payload.h,
      campaignSlug: payload.c,
      // 사람이 확인 화면을 거쳐 눌렀는지, 메일 클라이언트가 원클릭으로 보냈는지.
      // 후자는 Referer가 없다 — 이 구분은 나중에 "어느 경로가 실제로 쓰이는가"를
      // 볼 때만 의미가 있고, 처리 자체는 같다.
      source: req.headers.referer ? 'page' : 'one-click',
    });
  } catch (error) {
    console.error('[press-unsubscribe] 기록 실패:', error);
    return res.status(500).json({ ok: false });
  }

  /**
   * 원클릭 POST는 메일 클라이언트가 보내고 사람은 응답 본문을 보지 않는다.
   * 확인 화면에서 온 POST는 사람이 결과를 봐야 한다 — Referer로 갈린다.
   */
  if (req.headers.referer) {
    return sendPage(res, 200, renderUnsubPage('done', payload.l, ''));
  }
  return res.status(204).end();
}
```

- [ ] **Step 6: 타입·lint를 확인한다**

Run: `cd /Users/hwang-gyeongha/studio-press-unsub && npm run type-check && npm run lint`
Expected: 에러 없음

- [ ] **Step 7: 커밋**

```bash
cd /Users/hwang-gyeongha/studio-press-unsub
git add lib/press/page.ts pages/api/press/unsubscribe/
git commit -m "feat(press): 수신거부 라우트 — 한 경로가 GET 화면과 POST 반영을 함께 받는다

RFC 8058 원클릭은 List-Unsubscribe에 적힌 그 URL로 POST를 보내는데 Pages Router의
페이지는 POST를 못 받는다. 그래서 API 라우트 하나가 둘 다 받고, 확인 화면도 여기서
문자열로 만든다 — 로케일 페이지를 만들면 사이트맵·lastmod·robots·privatePaths
다섯 겹이 따라오는데 전부 불필요하다.

GET은 반영하지 않는다. 메일 링크는 스팸 필터와 보안 게이트웨이가 미리 열어 보므로,
GET에서 반영하면 기자가 누른 적도 없이 거부 처리된다.

되돌리기 버튼은 두지 않는다. registry에 해제 경로가 의도적으로 없는데 화면에만
만들면 그 원칙이 무너진다 — 회신으로 안내한다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: 호스트 격리 (미들웨어)

**Files:**
- Modify: `studio/middleware.ts` (132행 `middleware()` 초입, `/llms-full-*` 조기 반환 **뒤**)
- Create: `studio/middleware.press.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `press.studionol.co.kr/u/:token` → `/api/press/unsubscribe/:token` rewrite

**여기가 이 과제에서 가장 조용히 깨지는 자리다.** `middleware.ts`의 `shouldEnforceCanonicalHost`는 프로덕션에서 **`studionol.co.kr`이 아닌 모든 호스트를 308로 돌려보낸다**. 아무것도 하지 않으면 수신거부 URL이 열리기 전에 `studionol.co.kr/u/<token>`으로 튕겨 404가 된다. 조기 반환이 그 앞에 있어야 한다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`studio/middleware.press.test.ts`:

**두 가지를 반드시 지킬 것.** 하나라도 빠지면 이 테스트는 통과하면서 아무것도 지키지 못한다.

1. 파일 첫 줄의 `/** @jest-environment node */`. jsdom에서는 `NextRequest`가 기대하는 Web API가 온전하지 않다. 기존 `middleware.test.ts`가 같은 이유로 이 docblock을 달고 있다.
2. **`NODE_ENV=production`으로 모듈을 다시 불러올 것.** `middleware.ts`는 모듈 평가 시점에 env를 읽어 `shouldEnforceCanonicalHost`를 const로 고정한다. 기본 테스트 환경에서는 그 값이 false라 canonical 강제가 아예 꺼져 있고, 그러면 **조기 반환을 지워도 이 테스트가 통과한다** — 이 과제가 막으려는 바로 그 버그를 못 잡는다. `jest.mock`으로는 격리되지 않으므로 `jest.resetModules()` 후 동적 import를 쓴다(기존 `middleware.test.ts:1-40`의 `loadMiddleware` 패턴).

```ts
/** @jest-environment node */

type MiddlewareModule = typeof import('./middleware');
type NextServerModule = typeof import('next/server');

/**
 * press.studionol.co.kr은 수신거부 링크 하나만 응답한다.
 *
 * 두 가지를 동시에 지켜야 한다.
 *
 *   1. /u/<token>이 canonical host 강제(studionol.co.kr로의 308)에 걸리지 않을 것.
 *      걸리면 기자가 누른 링크가 404로 끝나고, 그건 배포 후에야 드러난다.
 *   2. 그 밖의 경로는 전부 404일 것. 안 막으면 사이트 전체가 두 주소로 살면서
 *      색인이 갈리고 canonical·hreflang 정리가 무너진다.
 *
 * 반드시 **프로덕션 env로** 불러온다. middleware.ts는 모듈 평가 시점에 env를 읽어
 * shouldEnforceCanonicalHost를 const로 고정하므로, 기본 테스트 환경에서는 canonical
 * 강제가 꺼진 채 돈다 — 그 상태로는 조기 반환을 지워도 이 테스트가 통과한다.
 */
const loadProdMiddleware = async (): Promise<{
  middleware: MiddlewareModule['middleware'];
  NextRequest: NextServerModule['NextRequest'];
}> => {
  jest.resetModules();
  process.env.NEXT_PUBLIC_SITE_URL = 'https://studionol.co.kr';
  process.env.VERCEL_ENV = 'production';
  // NODE_ENV는 읽기 전용 취급이라 defineProperty로 덮는다.
  Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true });
  const [{ middleware }, { NextRequest }] = await Promise.all([
    import('./middleware'),
    import('next/server'),
  ]);
  return { middleware, NextRequest };
};

describe('press.studionol.co.kr (프로덕션 env)', () => {
  const originalEnv = process.env;
  let middleware: MiddlewareModule['middleware'];
  let NextRequest: NextServerModule['NextRequest'];

  beforeAll(async () => {
    ({ middleware, NextRequest } = await loadProdMiddleware());
  });

  afterAll(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  const req = (url: string) =>
    new NextRequest(new URL(url), { headers: { host: new URL(url).host } });

  /**
   * 이 테스트가 이 과제의 이유다. 조기 반환이 canonical 강제보다 뒤에 있으면
   * 308이 나온다.
   */
  it('/u/<token>을 수신거부 API로 rewrite한다 (308이 아니다)', () => {
    const res = middleware(req('https://press.studionol.co.kr/u/abc.def'));
    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-rewrite')).toContain('/api/press/unsubscribe/abc.def');
  });

  it('루트는 404다', () => {
    expect(middleware(req('https://press.studionol.co.kr/')).status).toBe(404);
  });

  it('본진 경로를 이 호스트로 요청해도 404다', () => {
    for (const path of ['/ko', '/ko/pricing', '/sitemap.xml']) {
      expect(middleware(req(`https://press.studionol.co.kr${path}`)).status).toBe(404);
    }
  });

  it('토큰이 없는 /u는 404다', () => {
    expect(middleware(req('https://press.studionol.co.kr/u')).status).toBe(404);
    expect(middleware(req('https://press.studionol.co.kr/u/')).status).toBe(404);
  });

  /** 본진 호스트는 이 규칙과 무관하다 — /u는 본진에 없는 경로일 뿐이다. */
  it('본진 호스트의 /u는 rewrite되지 않는다', () => {
    const res = middleware(req('https://studionol.co.kr/u/abc.def'));
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `cd /Users/hwang-gyeongha/studio-press-unsub && npx jest middleware.press.test.ts`
Expected: FAIL — rewrite 헤더가 없고 루트가 404가 아니다

- [ ] **Step 3: 구현한다**

`studio/middleware.ts`의 `/llms-full-*` 조기 반환(139-141행) **바로 뒤**에 넣는다:

```ts
    /**
     * press.studionol.co.kr — 보도자료 수신거부 링크 전용 호스트.
     *
     * 이 블록이 canonical host 강제보다 **앞에** 있어야 한다. 아래쪽
     * shouldEnforceCanonicalHost는 studionol.co.kr이 아닌 호스트를 전부 308로
     * 돌려보내므로, 여기서 먼저 끊지 않으면 기자가 누른 수신거부 링크가
     * studionol.co.kr/u/<token>으로 튕겨 404로 끝난다.
     *
     * 그리고 /u 말고는 전부 404다. 한 프로젝트에 도메인을 하나 더 붙이는 것이라,
     * 막지 않으면 사이트 전체가 두 주소로 살면서 색인이 갈린다.
     */
    if (request.headers.get('host') === PRESS_HOST) {
        const unsub = /^\/u\/(.+)$/.exec(pathname);
        if (!unsub) {
            return setSecurityHeaders(new NextResponse(null, { status: 404 }));
        }
        const target = request.nextUrl.clone();
        target.pathname = `/api/press/unsubscribe/${unsub[1]}`;
        return setSecurityHeaders(NextResponse.rewrite(target));
    }
```

파일 상단 상수 근처(`const STORIES_PATH_RE = ...` 아래)에:

```ts
// 수신거부 링크 전용 호스트. 이 호스트는 /u/<token> 하나만 응답한다.
const PRESS_HOST = 'press.studionol.co.kr';
```

**matcher는 고치지 않는다.** 현재 matcher가 `/api`를 제외하지만, 이 호스트로 들어오는 요청의 경로는 `/u/...`라 미들웨어가 돈다. rewrite한 뒤의 `/api/...`는 미들웨어를 다시 타지 않는다.

- [ ] **Step 4: 통과를 확인한다**

Run: `cd /Users/hwang-gyeongha/studio-press-unsub && npx jest middleware.press.test.ts middleware.test.ts`
Expected: 모두 PASS — **기존 `middleware.test.ts`도 함께 돌려 회귀가 없는지 본다**

- [ ] **Step 5: 가드가 실제로 잡는지 확인한다**

조기 반환 블록을 canonical host 강제 **뒤로**(즉 `shouldEnforceCanonicalHost` 블록 다음으로) 임시로 옮기고 테스트를 돌린다.

**`/u/<token>` 테스트가 308로 실패해야 한다.** 통과한다면 프로덕션 env로 모듈을 불러오지 못한 것이므로, `loadProdMiddleware`를 고치기 전에는 이 과제를 끝내지 않는다 — 통과하면서 아무것도 지키지 않는 테스트는 없느니만 못하다.

확인했으면 블록을 되돌린다.

- [ ] **Step 6: 커밋**

```bash
cd /Users/hwang-gyeongha/studio-press-unsub
git add middleware.ts middleware.press.test.ts
git commit -m "feat(press): 수신거부 전용 호스트를 /u 하나로 가둔다

이 블록은 canonical host 강제보다 앞에 있어야 한다. shouldEnforceCanonicalHost가
studionol.co.kr이 아닌 호스트를 전부 308로 돌려보내므로, 먼저 끊지 않으면 기자가
누른 수신거부 링크가 본진으로 튕겨 404로 끝난다 — 배포 후에야 드러나는 종류다.

/u 말고는 전부 404다. 한 프로젝트에 도메인을 더 붙이는 것이라, 막지 않으면 사이트
전체가 두 주소로 살면서 색인이 갈린다.

블록을 canonical 강제 뒤로 옮겨 회귀를 확인했다 — /u 테스트가 308로 실패한다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: 당겨오기용 읽기 엔드포인트

**Files:**
- Create: `studio/pages/api/press/optouts.ts`

**Interfaces:**
- Consumes: `listPressOptouts` (Task 3)
- Produces: `GET /api/press/optouts?since=<epoch>` → `{ ok: true, rows: PressOptoutRow[], now: number }`

- [ ] **Step 1: 구현한다**

`studio/pages/api/press/optouts.ts`:

```ts
import type { NextApiRequest, NextApiResponse } from 'next';

import { isTokenMatch } from '../../../lib/booking/token';
import { listPressOptouts } from '../../../lib/press/optouts';

/**
 * music-promo가 수신거부를 당겨 가는 곳.
 *
 * 이 경로는 press.studionol.co.kr에 없다 — 그 호스트는 /u만 응답한다(middleware.ts).
 * 운영자 기계에서 본진으로 부른다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false });
  }

  const expected = process.env.PRESS_PULL_TOKEN;
  const given = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');

  /**
   * 키가 없거나 틀리면 404다. 401을 주면 "이 경로는 존재한다"를 알려 주는 셈이고,
   * 이 저장소는 같은 판단을 이미 하고 있다(pages/api/funding/display-name.ts:19-20).
   */
  if (!expected || !given || !isTokenMatch(expected, given)) {
    return res.status(404).json({ ok: false });
  }

  const raw = Array.isArray(req.query.since) ? req.query.since[0] : req.query.since;
  const since = Number.parseInt(raw ?? '0', 10);
  if (!Number.isFinite(since) || since < 0) {
    return res.status(400).json({ ok: false, message: 'since는 0 이상의 epoch 초입니다.' });
  }

  try {
    const rows = await listPressOptouts(since);
    /**
     * now는 **서버 시각**이다. 호출부가 이 값을 다음 since로 쓴다.
     *
     * 호출부의 시계를 쓰면 기계 간 오차만큼의 구간이 통째로 건너뛰어지고, 그
     * 구간에 들어온 수신거부는 영영 반영되지 않는다.
     */
    return res.status(200).json({ ok: true, rows, now: Math.floor(Date.now() / 1000) });
  } catch (error) {
    console.error('[press-optouts] 조회 실패:', error);
    return res.status(500).json({ ok: false });
  }
}
```

- [ ] **Step 2: 타입·lint를 확인한다**

Run: `cd /Users/hwang-gyeongha/studio-press-unsub && npm run type-check && npm run lint`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
cd /Users/hwang-gyeongha/studio-press-unsub
git add pages/api/press/optouts.ts
git commit -m "feat(press): 수신거부를 당겨 가는 읽기 엔드포인트

키가 틀리면 404다 — 401은 '이 경로가 존재한다'를 알려 주는 셈이라, 이 저장소가
이미 같은 판단을 한 자리를 따른다.

now는 서버 시각을 돌려준다. 호출부가 이 값을 다음 since로 쓰므로, 호출부 시계를
쓰면 기계 간 오차만큼의 구간이 건너뛰어지고 그 사이의 수신거부가 영영 반영되지 않는다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: 메일 헤더와 본문

**Files:**
- Modify: `music-promo/src/core/transport.ts:45-57` (헤더)
- Modify: `music-promo/src/core/render.ts` (`CLOSING`·`SOURCE_NOTE` 근처, `shell()`의 푸터, 두 분기의 text 조립)
- Modify: `music-promo/src/campaign.ts` (`labels.optout` 타입 제거)
- Modify: `music-promo/campaigns/*/campaign.ts` (5개 파일에서 `optout:` 줄 제거)
- Modify: `music-promo/tests/transport.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `sendOne`이 `unsubscribeUrl?: string`을 받는다. `renderEmail`이 `unsubscribeUrl: string`을 받는다.

- [ ] **Step 1: 헤더 테스트를 고친다**

`music-promo/tests/transport.test.ts`의 기존 "수신거부 헤더를 붙이고 추적은 끈 채로 보낸다"와 "처리할 수 없는 원클릭 헤더는 광고하지 않는다" 두 테스트를 **아래로 교체한다.** 후자는 이제 사실이 아니다 — 처리할 주소가 생겼다.

```ts
test("수신거부 헤더에 링크와 회신을 모두 싣고 원클릭을 켠다", async () => {
  let body: Record<string, unknown> | null = null;
  const fakeFetch = (async (_url: string | URL, init?: RequestInit) => {
    body = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ id: "x" }), { status: 200 });
  }) as unknown as typeof fetch;

  await sendOne({
    apiKey: "k", from: "A <a@alf.seoul.kr>", replyTo: "reply@studionol.co.kr",
    to: "a@b.com", subject: "s", html: "h", text: "t",
    unsubscribeUrl: "https://press.studionol.co.kr/u/TOKEN",
    fetchImpl: fakeFetch,
  });

  const headers = body!.headers as Record<string, string>;
  assert.equal(
    headers["List-Unsubscribe"],
    "<https://press.studionol.co.kr/u/TOKEN>, <mailto:reply@studionol.co.kr?subject=Unsubscribe>",
  );
  assert.equal(headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  assert.equal(body!.track_opens, false);
  assert.equal(body!.track_clicks, false);
});

/**
 * 원클릭은 **누를 곳이 있을 때만** 광고한다.
 *
 * 링크 없이 List-Unsubscribe-Post를 붙이면 메일 클라이언트가 수신거부 버튼을
 * 띄우는데 누르면 아무 일도 일어나지 않는다. 그냥 빠뜨린 것보다 나쁘다.
 */
test("링크가 없으면 회신 수신거부만 싣고 원클릭은 켜지 않는다", async () => {
  let body: Record<string, unknown> | null = null;
  const fakeFetch = (async (_url: string | URL, init?: RequestInit) => {
    body = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ id: "x" }), { status: 200 });
  }) as unknown as typeof fetch;

  await sendOne({
    apiKey: "k", from: "f", replyTo: "r@b.com", to: "a@b.com",
    subject: "s", html: "h", text: "t", fetchImpl: fakeFetch,
  });

  const headers = body!.headers as Record<string, string>;
  assert.equal(headers["List-Unsubscribe"], "<mailto:r@b.com?subject=Unsubscribe>");
  assert.equal(headers["List-Unsubscribe-Post"], undefined);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `cd /Users/hwang-gyeongha/music-promo-press-unsub && npx tsx --test tests/transport.test.ts`
Expected: FAIL — `unsubscribeUrl`이 `sendOne`의 인자에 없다(타입 에러) 또는 헤더가 다르다

- [ ] **Step 3: `sendOne`을 고친다**

`music-promo/src/core/transport.ts` — 인자에 `unsubscribeUrl?: string`을 더하고, 헤더 블록을 교체한다:

```ts
        /**
         * 수신거부 헤더.
         *
         * 이게 있으면 Gmail·Outlook이 발신자 이름 옆에 수신거부 버튼을 띄우고
         * 스팸 판정에서 유리하게 본다. 본문에만 적어 두면 그 신호가 안 잡힌다.
         *
         * 원클릭(List-Unsubscribe-Post)은 **누를 곳이 있을 때만** 붙인다. 링크 없이
         * 붙이면 버튼은 뜨는데 눌러도 아무 일이 없다 — 그냥 빠뜨린 것보다 나쁘다.
         * https를 앞에 둔다: 클라이언트는 대체로 첫 번째를 쓴다.
         */
        headers: {
          "List-Unsubscribe": unsubscribeUrl
            ? `<${unsubscribeUrl}>, <mailto:${replyTo}?subject=Unsubscribe>`
            : `<mailto:${replyTo}?subject=Unsubscribe>`,
          ...(unsubscribeUrl ? { "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : {}),
        },
```

- [ ] **Step 4: 통과를 확인한다**

Run: `cd /Users/hwang-gyeongha/music-promo-press-unsub && npm run typecheck && npx tsx --test tests/transport.test.ts`
Expected: 모두 PASS

- [ ] **Step 5: 본문 문구를 공유 상수로 옮긴다**

`music-promo/src/core/render.ts`의 `SOURCE_NOTE` 아래에 추가한다:

```ts
/**
 * 수신거부 안내.
 *
 * SOURCE_NOTE와 같은 자리에 두는 이유도 같다 — 수신거부 방법은 사실 진술이라
 * 앨범이 바뀐다고 달라지지 않는다. 캠페인 데이터에 두면 캠페인마다 문구가 갈리고,
 * 링크를 새로 넣을 때 다섯 파일을 고쳐야 한다.
 *
 * 링크와 회신을 **둘 다** 안내한다. 메일 속 링크를 누르지 않는 사람이 있고,
 * 그 사람에게 회신은 여전히 유효한 경로다.
 */
const UNSUB_NOTE: Record<string, string> = {
  ko: "수신을 원치 않으시면 아래 링크를 누르시거나 이 메일에 회신해 주세요.",
  ja: "配信停止をご希望の場合は、下のリンクを押していただくか、本メールにご返信ください。",
  en: "To stop receiving these, use the link below or simply reply to this email.",
  es: "Si no desea recibir más correos, use el enlace de abajo o responda a este mensaje.",
  pt: "Se não quiser mais receber, use o link abaixo ou responda a este e-mail.",
  de: "Wenn Sie keine weiteren E-Mails wünschen, nutzen Sie den Link unten oder antworten Sie einfach auf diese Nachricht.",
  fr: "Pour ne plus recevoir ces messages, utilisez le lien ci-dessous ou répondez simplement à cet e-mail.",
  zh: "若不希望再收到這類郵件，請點選下方連結或直接回覆本郵件。",
  zhHans: "如不希望再收到此类邮件，请点击下方链接或直接回复本邮件。",
};

/** 번역이 없는 로케일은 영어로 간다 — sourceNoteFor와 같은 판단이다. */
function unsubNoteFor(code: string): string {
  return UNSUB_NOTE[code] ?? UNSUB_NOTE.en;
}
```

- [ ] **Step 6: 푸터를 고친다**

`render.ts`의 `shell()` 푸터(413행 근처)를 교체한다. `labels.optout` 대신 `labels.unsubNote`와 `unsubscribeUrl`을 쓴다:

```html
    <div style="margin-top:18px;padding-top:14px;border-top:1px solid #eeebe4;font-size:12px;color:#a5a5a5;line-height:1.7;">
      ${esc(labels.sourceNote)}<br>${esc(labels.unsubNote)}<br><a href="${esc(unsubscribeUrl)}" style="color:#a5a5a5;">${esc(unsubscribeUrl)}</a><br>${esc(pressUrl)}
    </div>
```

`shell()`의 인자 타입에서 `labels.optout: string`을 `labels.unsubNote: string`으로 바꾸고, `unsubscribeUrl: string`을 인자에 더한다.

- [ ] **Step 7: 두 분기를 고친다**

`renderEmail`의 시그니처를 바꾼다:

```ts
export function renderEmail({
  recipient,
  campaign,
  unsubscribeUrl,
}: {
  recipient: Recipient;
  campaign: Campaign;
  /** 수신자별 서명 링크. 호출부가 만들어 넘긴다 — 렌더러가 비밀키를 알 이유가 없다. */
  unsubscribeUrl: string;
}): { subject: string; html: string; text: string } {
```

**비-ko 분기** — text 배열 끝의 두 줄을 바꾼다:

```ts
      loc.labels.reply,
      "",
      loc.labels.sign,
      sourceNoteFor(code),
      unsubNoteFor(code),
      unsubscribeUrl,
    ].join("\n");
```

같은 분기의 `shell({...})` 호출에서 `optout: loc.labels.optout,`을 지우고 두 줄을 넣는다:

```ts
          unsubNote: unsubNoteFor(code),
```

그리고 `shell()` 인자 목록(labels와 같은 층)에 `unsubscribeUrl,`을 더한다.

**ko 분기** — `closing` 객체에서 `optout` 줄을 지운다:

```ts
  const closing = {
    page: locKo?.labels.page ?? CLOSING.page,
    reply: locKo?.labels.reply ?? CLOSING.reply,
  };
```

text 배열 끝:

```ts
    closing.reply,
    "",
    locKo?.labels.sign ?? campaign.artist.ko,
    sourceNoteFor("ko"),
    unsubNoteFor("ko"),
    unsubscribeUrl,
  ].join("\n");
```

`shell({...})`의 labels에서 `optout: closing.optout,`을 `unsubNote: unsubNoteFor("ko"),`로 바꾸고, labels와 같은 층에 `unsubscribeUrl,`을 더한다.

- [ ] **Step 8: 캠페인 데이터에서 죽은 필드를 뺀다**

`src/campaign.ts`의 labels 타입에서 `optout: string;`을 제거한다. `npm run typecheck`가 5개 캠페인 파일의 위치를 전부 알려 준다 — 그 줄들을 지운다. `CLOSING.optout`도 지운다.

남겨 두면 죽은 데이터가 되고, 다음 사람이 그 문구를 고치면서 화면에 안 나오는 이유를 찾게 된다.

- [ ] **Step 9: 전체를 확인한다**

Run: `cd /Users/hwang-gyeongha/music-promo-press-unsub && npm run typecheck && npm test`
Expected: 모두 PASS

- [ ] **Step 10: 눈으로 확인한다**

```bash
cd /Users/hwang-gyeongha/music-promo-press-unsub
npx tsx src/cli.ts send --campaign namsan-tower 2>&1 | head -40
```

드라이런이므로 발송되지 않는다. 푸터에 수집 출처·수신거부 안내·링크·프레스 URL이 순서대로 나오는지 본다.

- [ ] **Step 11: 커밋**

```bash
cd /Users/hwang-gyeongha/music-promo-press-unsub
git add src tests campaigns
git commit -m "feat(unsubscribe): 메일에 수신거부 링크와 원클릭 헤더를 싣는다

List-Unsubscribe에 https를 앞세우고 mailto를 남긴다. 원클릭은 누를 곳이 있을 때만
켠다 — 링크 없이 붙이면 버튼은 뜨는데 눌러도 아무 일이 없어 그냥 빠뜨린 것보다 나쁘다.

본문 문구는 SOURCE_NOTE와 같은 자리에 공유 상수로 뒀다. 수신거부 방법은 사실
진술이라 앨범이 바뀐다고 달라지지 않는다. 캠페인 데이터의 labels.optout은 회신
전용 문구라 쓰이지 않게 되므로 타입과 캠페인 5개에서 지웠다 — 남겨 두면 죽은
데이터가 되고 다음 사람이 그걸 고치면서 화면에 안 나오는 이유를 찾게 된다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: 발송 경로에 토큰을 배선한다

**Files:**
- Modify: `music-promo/src/commands/send.ts` (렌더·발송 호출부, 400행·452행 근처)
- Create: `music-promo/src/core/env-press.ts`

**Interfaces:**
- Consumes: `emailHash`·`unsubscribeUrl` (Task 1), `renderEmail`·`sendOne`의 새 인자 (Task 7)
- Produces: `requirePressEnv(): { secret: string; salt: string; pullToken: string }`

- [ ] **Step 1: env 헬퍼를 만든다**

`music-promo/src/core/env-press.ts`:

```ts
/**
 * 수신거부에 필요한 세 값.
 *
 * 하나라도 없으면 발송 전에 멈춘다. 없는 채로 보내면 링크가 깨진 메일이 1,742통
 * 나가고, 그건 되돌릴 수 없다.
 */
export function requirePressEnv(env: NodeJS.ProcessEnv = process.env): {
  secret: string;
  salt: string;
  pullToken: string;
} {
  const missing: string[] = [];
  const secret = env.PRESS_UNSUB_SECRET ?? "";
  const salt = env.PRESS_UNSUB_SALT ?? "";
  const pullToken = env.PRESS_PULL_TOKEN ?? "";
  if (!secret) missing.push("PRESS_UNSUB_SECRET");
  if (!salt) missing.push("PRESS_UNSUB_SALT");
  if (!pullToken) missing.push("PRESS_PULL_TOKEN");
  if (missing.length) {
    throw new Error(
      `.env.local에 ${missing.join(", ")}이(가) 없습니다.\n` +
        "  수신거부 링크를 만들 수 없으므로 발송을 멈춥니다 — 링크가 깨진 메일은 되돌릴 수 없습니다.",
    );
  }
  return { secret, salt, pullToken };
}
```

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`music-promo/tests/env-press.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { requirePressEnv } from "../src/core/env-press";

test("세 값이 다 있으면 그대로 돌려준다", () => {
  const got = requirePressEnv({
    PRESS_UNSUB_SECRET: "s", PRESS_UNSUB_SALT: "salt", PRESS_PULL_TOKEN: "p",
  } as NodeJS.ProcessEnv);
  assert.deepEqual(got, { secret: "s", salt: "salt", pullToken: "p" });
});

/** 빠진 것을 전부 한 번에 알려 준다 — 하나씩 고치며 다섯 번 실행하게 만들지 않는다. */
test("빠진 이름을 모두 말한다", () => {
  assert.throws(
    () => requirePressEnv({ PRESS_UNSUB_SECRET: "s" } as NodeJS.ProcessEnv),
    /PRESS_UNSUB_SALT, PRESS_PULL_TOKEN/,
  );
});

test("빈 문자열은 없는 것으로 본다", () => {
  assert.throws(
    () => requirePressEnv({ PRESS_UNSUB_SECRET: "", PRESS_UNSUB_SALT: "a", PRESS_PULL_TOKEN: "b" } as NodeJS.ProcessEnv),
    /PRESS_UNSUB_SECRET/,
  );
});
```

- [ ] **Step 3: 통과를 확인한다**

Run: `cd /Users/hwang-gyeongha/music-promo-press-unsub && npx tsx --test tests/env-press.test.ts`
Expected: 모두 PASS

- [ ] **Step 4: `send.ts`를 배선한다**

발송 루프 안에서 수신자마다:

```ts
  const press = requirePressEnv();
  // ...
  const payload = {
    v: 1 as const,
    h: emailHash(recipient.email, press.salt),
    c: campaign.slug,
    l: localeFor(recipient.email, campaign),
    t: Math.floor(Date.now() / 1000),
  };
  const unsub = unsubscribeUrl(payload, press.secret);
  const { subject, html, text } = renderEmail({ recipient, campaign, unsubscribeUrl: unsub });
  // sendOne({ ..., unsubscribeUrl: unsub })
```

`requirePressEnv()`는 **루프 밖에서 한 번** 부른다. 미리보기(`preview`)와 테스트 발송(`--test`)에서도 링크가 필요하므로 mode 분기 밖에 둔다.

- [ ] **Step 5: 확인한다**

Run: `cd /Users/hwang-gyeongha/music-promo-press-unsub && npm run typecheck && npm test`
Expected: 모두 PASS

- [ ] **Step 6: 커밋**

```bash
cd /Users/hwang-gyeongha/music-promo-press-unsub
git add src tests
git commit -m "feat(send): 수신자마다 서명된 수신거부 링크를 만든다

세 env가 하나라도 없으면 발송 전에 멈춘다. 없는 채로 보내면 링크가 깨진 메일이
1,742통 나가고 그건 되돌릴 수 없다. 빠진 이름은 한 번에 다 알려 준다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: `optouts --pull`

**Files:**
- Create: `music-promo/src/core/optout-state.ts`
- Create: `music-promo/src/commands/optouts.ts`
- Create: `music-promo/tests/optout-pull.test.ts`
- Modify: `music-promo/src/cli.ts` (명령 등록 — 기존 명령 목록에 `optouts` 추가)

**Interfaces:**
- Consumes: `emailHash` (Task 1), `requirePressEnv` (Task 8), `updateRegistry`·`loadRegistry` (기존)
- Produces:
  - `readPullState(path?: string): { since: number; pulledAt: string } | null`
  - `writePullState(since: number, path?: string): void`
  - `applyOptouts(rows: { emailHash: string }[], registry: Record<string, RegistryEntry>, salt: string): { applied: string[]; unmatched: number }`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`music-promo/tests/optout-pull.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyOptouts, readPullState, writePullState } from "../src/core/optout-state";
import { emailHash } from "../src/core/unsubscribe";
import type { RegistryEntry } from "../src/core/registry";

const SALT = "test-salt";
const entry = (optedOut = false): RegistryEntry => ({ optedOut, campaigns: [] });

test("해시가 맞는 주소만 수신거부로 바꾼다", () => {
  const registry: Record<string, RegistryEntry> = {
    "a@x.com": entry(),
    "b@x.com": entry(),
  };
  const result = applyOptouts([{ emailHash: emailHash("a@x.com", SALT) }], registry, SALT);
  assert.deepEqual(result.applied, ["a@x.com"]);
  assert.equal(registry["a@x.com"].optedOut, true);
  assert.equal(registry["b@x.com"].optedOut, false);
});

/**
 * 못 맞춘 행을 조용히 버리면 솔트가 바뀌었거나 명단이 갈렸을 때 아무도 모른다.
 * 거부 의사가 반영되지 않은 채 다음 발송이 나가는 경로다.
 */
test("못 맞춘 행의 건수를 돌려준다", () => {
  const result = applyOptouts(
    [{ emailHash: emailHash("nobody@x.com", SALT) }, { emailHash: "f".repeat(32) }],
    { "a@x.com": entry() },
    SALT,
  );
  assert.deepEqual(result.applied, []);
  assert.equal(result.unmatched, 2);
});

test("이미 거부한 주소는 다시 세지 않는다", () => {
  const registry = { "a@x.com": entry(true) };
  const result = applyOptouts([{ emailHash: emailHash("a@x.com", SALT) }], registry, SALT);
  assert.deepEqual(result.applied, []);
  assert.equal(registry["a@x.com"].optedOut, true);
});

test("registry의 다른 필드를 건드리지 않는다", () => {
  const registry: Record<string, RegistryEntry> = {
    "a@x.com": { optedOut: false, campaigns: [], bounced: "2026-09-01T00:00:00Z", replied: true },
  };
  applyOptouts([{ emailHash: emailHash("a@x.com", SALT) }], registry, SALT);
  assert.equal(registry["a@x.com"].bounced, "2026-09-01T00:00:00Z");
  assert.equal(registry["a@x.com"].replied, true);
});

test("상태 파일이 없으면 null이다", () => {
  const path = join(mkdtempSync(join(tmpdir(), "pull-")), "optout-pull.json");
  assert.equal(readPullState(path), null);
});

test("상태를 쓰고 다시 읽는다", () => {
  const path = join(mkdtempSync(join(tmpdir(), "pull-")), "optout-pull.json");
  writePullState(1789000000, path);
  assert.equal(readPullState(path)?.since, 1789000000);
});

test("깨진 상태 파일은 없는 것으로 본다 — 한 번 더 당기는 쪽이 안전하다", () => {
  const path = join(mkdtempSync(join(tmpdir(), "pull-")), "optout-pull.json");
  writeFileSync(path, "{ not json", "utf8");
  assert.equal(readPullState(path), null);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `cd /Users/hwang-gyeongha/music-promo-press-unsub && npx tsx --test tests/optout-pull.test.ts`
Expected: FAIL — `Cannot find module '../src/core/optout-state'`

- [ ] **Step 3: 구현한다**

`music-promo/src/core/optout-state.ts`:

```ts
/**
 * 수신거부를 당겨 온 기록.
 *
 * 웹 엔드포인트는 이 기계의 registry.json에 쓸 수 없다. 그래서 당겨 오는 단계가
 * 생기고, 사람은 그 단계를 잊는다 — 반송 조회에서 이미 겪은 일이다. 여기 남긴
 * 시각을 send가 읽어 오래되었으면 멈춘다.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { RegistryEntry } from "./registry";
import { emailHash } from "./unsubscribe";

export const PULL_STATE_PATH = join(homedir(), ".music-promo", "optout-pull.json");

export type PullState = { since: number; pulledAt: string };

export function readPullState(path: string = PULL_STATE_PATH): PullState | null {
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as PullState;
    if (typeof parsed?.since !== "number" || typeof parsed?.pulledAt !== "string") return null;
    return parsed;
  } catch {
    // 깨진 기록은 없는 것으로 본다 — 한 번 더 당기는 쪽이 안전하다.
    return null;
  }
}

export function writePullState(since: number, path: string = PULL_STATE_PATH): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const payload: PullState = { since, pulledAt: new Date().toISOString() };
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

/**
 * 받아 온 해시를 우리 명단의 주소와 맞춘다.
 *
 * 서버는 주소를 모르므로 대조는 여기서만 가능하다. 못 맞춘 행은 **세어서 알린다** —
 * 조용히 버리면 솔트가 바뀌었거나 명단이 갈렸을 때 거부 의사가 반영되지 않은 채로
 * 다음 발송이 나간다.
 */
export function applyOptouts(
  rows: { emailHash: string }[],
  registry: Record<string, RegistryEntry>,
  salt: string,
): { applied: string[]; unmatched: number } {
  const byHash = new Map<string, string>();
  for (const email of Object.keys(registry)) byHash.set(emailHash(email, salt), email);

  const applied: string[] = [];
  let unmatched = 0;
  for (const row of rows) {
    const email = byHash.get(row.emailHash);
    if (!email) {
      unmatched += 1;
      continue;
    }
    if (registry[email].optedOut) continue;
    // 나머지 필드를 보존한다 — 조립하면 bounced가 사라진다(2026-09-14에 고친 사고).
    registry[email] = { ...registry[email], optedOut: true };
    applied.push(email);
  }
  return { applied, unmatched };
}
```

`music-promo/src/commands/optouts.ts`:

```ts
/**
 * 사용법:
 *   music-promo optouts --pull        # 웹에서 수신거부를 당겨 registry에 반영한다
 *   music-promo optouts               # 마지막으로 당긴 시각만 보여준다
 *
 * 웹 엔드포인트는 이 기계의 registry.json에 쓸 수 없으므로 당겨 오는 단계가 필요하다.
 * send가 이 기록을 보고 오래되었으면 발송을 멈춘다.
 */
import { loadEnv } from "../core/env";
import { requirePressEnv } from "../core/env-press";
import { applyOptouts, readPullState, writePullState } from "../core/optout-state";
import { updateRegistry } from "../core/registry";

const ENDPOINT =
  process.env.PRESS_OPTOUTS_URL ?? "https://studionol.co.kr/api/press/optouts";

export async function run({ args }: { args: string[] }): Promise<void> {
  loadEnv();
  const state = readPullState();

  if (!args.includes("--pull")) {
    console.log(
      state
        ? `마지막으로 당긴 시각: ${state.pulledAt} (since=${state.since})`
        : "아직 한 번도 당기지 않았습니다. optouts --pull 을 실행하세요.",
    );
    return;
  }

  const press = requirePressEnv();
  const since = state?.since ?? 0;
  const response = await fetch(`${ENDPOINT}?since=${since}`, {
    headers: { Authorization: `Bearer ${press.pullToken}` },
  }).catch((error: unknown) => {
    console.error(`수신거부를 당겨 오지 못했습니다 — ${(error as Error).message}`);
    process.exit(1);
  });

  if (!response.ok) {
    console.error(`수신거부를 당겨 오지 못했습니다 — HTTP ${response.status}`);
    console.error("  404면 PRESS_PULL_TOKEN을 확인하세요.");
    process.exit(1);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    rows: { emailHash: string }[];
    now: number;
  };

  let applied: string[] = [];
  let unmatched = 0;
  updateRegistry((registry) => {
    const result = applyOptouts(payload.rows, registry, press.salt);
    applied = result.applied;
    unmatched = result.unmatched;
  });

  /**
   * 성공했을 때만 since를 옮긴다.
   *
   * 실패한 채로 옮기면 그 구간에 들어온 수신거부가 영영 반영되지 않는다.
   * now는 서버 시각이다 — 이 기계의 시계를 쓰면 오차만큼의 구간이 통째로 빠진다.
   */
  writePullState(payload.now);

  console.log(`수신거부 ${payload.rows.length}건을 받아 ${applied.length}명에게 반영했습니다.`);
  for (const email of applied) console.log(`  ${email}`);
  if (unmatched) {
    console.log(`\n맞는 주소가 없는 행 ${unmatched}건 — 솔트가 바뀌었거나 명단이 다른 기계에 있습니다.`);
    console.log("  PRESS_UNSUB_SALT를 확인하세요. 이 건들은 반영되지 않았습니다.");
  }
}
```

- [ ] **Step 4: CLI에 등록한다**

`src/cli.ts`의 명령 목록에 `optouts`를 더한다. 기존 명령들이 어떻게 나열되어 있는지 보고 같은 형태로 넣는다.

- [ ] **Step 5: 확인한다**

Run: `cd /Users/hwang-gyeongha/music-promo-press-unsub && npm run typecheck && npx tsx --test tests/optout-pull.test.ts && npx tsx src/cli.ts optouts`
Expected: 테스트 PASS, 마지막 명령은 "아직 한 번도 당기지 않았습니다"

- [ ] **Step 6: 커밋**

```bash
cd /Users/hwang-gyeongha/music-promo-press-unsub
git add src tests
git commit -m "feat(optouts): 웹의 수신거부를 registry로 당겨 온다

서버는 주소를 모르므로(해시만 갖는다) 대조는 이 기계에서만 가능하다. 못 맞춘 행은
세어서 알린다 — 조용히 버리면 솔트가 바뀌었거나 명단이 갈렸을 때 거부 의사가
반영되지 않은 채 다음 발송이 나간다.

since는 성공했을 때만 옮기고, 값은 서버 시각을 쓴다. 실패한 채로 옮기면 그 구간의
거부가 영영 반영되지 않고, 이 기계의 시계를 쓰면 오차만큼의 구간이 통째로 빠진다.

반영은 updateRegistry를 거친다 — 잠금과 손상 검사를 우회하지 않는다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: 발송 가드

**Files:**
- Create: `music-promo/src/core/optout-guard.ts`
- Modify: `music-promo/src/commands/send.ts` (반송률 가드 바로 뒤)
- Create: `music-promo/tests/optout-guard.test.ts`

**Interfaces:**
- Consumes: `readPullState` (Task 9)
- Produces: `checkOptoutFreshness(state: PullState | null, now: Date, maxAgeHours?: number): { ok: boolean; reason?: string }`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`music-promo/tests/optout-guard.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkOptoutFreshness } from "../src/core/optout-guard";

const NOW = new Date("2026-09-14T12:00:00Z");
const state = (hoursAgo: number) => ({
  since: 0,
  pulledAt: new Date(NOW.getTime() - hoursAgo * 3600_000).toISOString(),
});

/**
 * 이 가드가 이 기능의 전부다.
 *
 * 엔드포인트를 만들어도 당겨 오지 않으면 registry는 그대로고, 거부한 사람에게
 * 다음 캠페인이 나간다. 반송 조회가 정확히 그렇게 무력했다 — README에 적혀
 * 있었지만 급할 때 지켜지지 않아 9.1%까지 갔다.
 */
test("한 번도 당기지 않았으면 막는다", () => {
  const verdict = checkOptoutFreshness(null, NOW);
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason ?? "", /optouts --pull/);
});

test("방금 당겼으면 통과한다", () => {
  assert.equal(checkOptoutFreshness(state(0.5), NOW).ok, true);
});

test("24시간을 넘으면 막는다", () => {
  assert.equal(checkOptoutFreshness(state(23), NOW).ok, true);
  assert.equal(checkOptoutFreshness(state(25), NOW).ok, false);
});

/** 시각이 깨졌으면 모르는 것이다. 모를 때는 막는다. */
test("읽을 수 없는 시각은 막는다", () => {
  assert.equal(checkOptoutFreshness({ since: 0, pulledAt: "언젠가" }, NOW).ok, false);
});

/**
 * 미래 시각은 시계가 틀어졌다는 뜻이고, 그대로 두면 "항상 신선함"이 되어 가드가
 * 영구히 풀린다.
 */
test("미래 시각도 막는다", () => {
  assert.equal(checkOptoutFreshness(state(-5), NOW).ok, false);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `cd /Users/hwang-gyeongha/music-promo-press-unsub && npx tsx --test tests/optout-guard.test.ts`
Expected: FAIL — `Cannot find module '../src/core/optout-guard'`

- [ ] **Step 3: 구현한다**

`music-promo/src/core/optout-guard.ts`:

```ts
/**
 * 수신거부를 당겨 온 지 얼마나 되었는가.
 *
 * 엔드포인트를 만들어도 당겨 오지 않으면 registry는 그대로고, 거부한 사람에게
 * 다음 캠페인이 나간다. 반송 조회가 정확히 그렇게 무력했다.
 *
 * 우회 플래그를 두지 않는다. 반송률 가드는 --over-cap을 허용하지만 그쪽은 평판
 * 문제고, 이쪽은 "거부 의사에 반한 전송"이라 법이 걸린 자리다. 사이트가 죽어
 * 당길 수 없을 때도 막히는데, 거부 목록을 확인할 수 없는 상태로 보내는 위험이
 * "오늘 못 보냄"보다 크다.
 */
import type { PullState } from "./optout-state";

export const MAX_PULL_AGE_HOURS = 24;

export type OptoutVerdict = { ok: boolean; reason?: string };

const HOW = "  npx tsx src/cli.ts optouts --pull 을 먼저 실행하세요.";

export function checkOptoutFreshness(
  state: PullState | null,
  now: Date,
  maxAgeHours: number = MAX_PULL_AGE_HOURS,
): OptoutVerdict {
  if (!state) {
    return {
      ok: false,
      reason: `수신거부를 한 번도 당겨 오지 않았습니다.\n${HOW}`,
    };
  }

  const pulledAt = Date.parse(state.pulledAt);
  if (Number.isNaN(pulledAt)) {
    return { ok: false, reason: `당겨 온 시각을 읽을 수 없습니다 — ${state.pulledAt}\n${HOW}` };
  }

  const ageHours = (now.getTime() - pulledAt) / 3600_000;
  if (ageHours < 0) {
    // 시계가 틀어졌다. 그대로 두면 "항상 신선함"이 되어 가드가 영구히 풀린다.
    return { ok: false, reason: `당겨 온 시각이 미래입니다 — ${state.pulledAt}\n${HOW}` };
  }
  if (ageHours > maxAgeHours) {
    return {
      ok: false,
      reason:
        `수신거부를 당겨 온 지 ${Math.floor(ageHours)}시간 지났습니다(상한 ${maxAgeHours}시간).\n` +
        `  그 사이 거부한 사람에게 보내게 됩니다.\n${HOW}`,
    };
  }
  return { ok: true };
}
```

- [ ] **Step 4: `send.ts`에 배선한다**

반송률 가드 블록 **바로 뒤**에:

```ts
  if (mode === "send") {
    const verdict = checkOptoutFreshness(readPullState(), new Date());
    if (!verdict.ok) {
      console.error(`\n발송 중단: ${verdict.reason}\n`);
      process.exit(1);
    }
  }
```

- [ ] **Step 5: 통과를 확인한다**

Run: `cd /Users/hwang-gyeongha/music-promo-press-unsub && npm run typecheck && npm test`
Expected: 모두 PASS

- [ ] **Step 6: 가드가 실제로 막는지 확인한다**

```bash
cd /Users/hwang-gyeongha/music-promo-press-unsub
mv ~/.music-promo/optout-pull.json ~/.music-promo/optout-pull.json.bak 2>/dev/null || true
npx tsx src/cli.ts send --campaign namsan-tower --send --limit 1
```

**"발송 중단: 수신거부를 한 번도 당겨 오지 않았습니다"가 나와야 한다.** 다른 이유로 먼저 멈췄다면(반송률 등) 그것도 정상이지만, 그 가드를 통과시킨 뒤 이 가드가 걸리는지 반드시 확인한다. 확인 후 `.bak`을 되돌린다.

- [ ] **Step 7: 커밋**

```bash
cd /Users/hwang-gyeongha/music-promo-press-unsub
git add src tests
git commit -m "feat(send): 수신거부를 당겨 오지 않았으면 발송을 멈춘다

이 가드가 이 기능의 전부다. 엔드포인트를 만들어도 당겨 오지 않으면 registry는
그대로고 거부한 사람에게 다음 캠페인이 나간다 — 반송 조회가 정확히 그렇게
무력했고 9.1%까지 갔다.

우회 플래그를 두지 않는다. 반송률 가드는 --over-cap을 허용하지만 그쪽은 평판
문제고 이쪽은 거부 의사에 반한 전송이다. 사이트가 죽어 당길 수 없을 때도 막히는데,
거부 목록을 모르는 채 보내는 위험이 '오늘 못 보냄'보다 크다.

미래 시각도 막는다 — 시계가 틀어진 채 두면 '항상 신선함'이 되어 가드가 영구히 풀린다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## 사람이 해야 하는 일 (에이전트가 하지 않는다)

이 계획의 모든 과제가 끝나도 **아래 다섯 가지를 사람이 하기 전에는 동작하지 않는다.**

1. **비밀값 생성과 배치** — `openssl rand -base64 32`로 `PRESS_UNSUB_SECRET`·`PRESS_UNSUB_SALT`·`PRESS_PULL_TOKEN`을 만든다.
   - `.env.local`(music-promo): 셋 다
   - Vercel env(studio): `PRESS_UNSUB_SECRET`·`PRESS_PULL_TOKEN` — **SALT는 넣지 않는다.** 그게 이 설계의 핵심이다.
   - ⚠️ `PRESS_UNSUB_SALT`를 잃어버리면 이미 나간 링크의 해시를 다시 맞출 수 없다. 다른 비밀값과 함께 안전한 곳에 백업할 것.
2. **마이그레이션 적용** — `cd studio && npm run db:migrate`
3. **Vercel 도메인 추가** — studio 프로젝트에 `press.studionol.co.kr`
4. **DNS** — hosting.kr에서 `press` A/CNAME을 Vercel로. 같은 존의 `send.press`·`rsend.press`·`resend._domainkey.press`·`_dmarc.press`는 건드리지 않는다.
5. **실물 확인** — 테스트 발송 한 통을 받아 수신거부 링크를 실제로 눌러 본다. Gmail 웹에서 발신자 옆 수신거부 버튼이 뜨는지도 함께 본다.

## 알려진 한계

- **확인 화면은 ko·ja·en 세 언어다.** 메일 본문은 아홉 언어로 가지만 화면까지 아홉을 유지하면 문구가 갈린 채 아무도 안 보게 된다. 그 밖의 언어 수신자는 영어 화면을 본다.
- **회신으로 오는 수신거부는 여전히 사람이 처리한다.** 안내에 회신 경로를 남겼고 그건 의도다 — 받은 편지함을 파싱하는 기계는 이 문제에 비해 과하다.
- **정보통신망법 제50조의 적용 여부는 이 작업이 해결하지 않는다.** 유료 대행 보도자료가 광고성 정보인지, 그래서 `(광고)` 제목과 사업자 정보가 필요한지는 변호사 확인 사항으로 남는다.
