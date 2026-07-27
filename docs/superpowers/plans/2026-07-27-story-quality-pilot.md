# 스토리 전문화·윤문 파일럿 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `practice-room-startup1.md`·`plugins1.md` 2편을 인터뷰 기반 사실로 심화하고 산문만 골라 윤문해, F15 확대 여부를 판단할 근거(품질·소요시간·안전성)를 만든다.

**Architecture:** 마크다운을 "산문 블록"과 "구조 블록"으로 나누는 순수 함수 유틸을 먼저 TDD로 만든다. 구조 블록(프론트매터·표·목록·제목·디렉티브)은 윤문 파이프라인에 아예 들어가지 않으므로 훼손될 수 없다. 산문만 마커를 달아 humanize-korean에 넘기고, 마커 정합성을 검사한 뒤 제자리에 되돌린다. 사실 추가는 윤문과 완전히 분리된 선행 단계이며, 그 원천은 오직 사용자 인터뷰 답변이다.

**Tech Stack:** Node.js (CommonJS `scripts/`), Jest 29, gray-matter 4, humanize-korean 스킬 v1.5 (fast 모드)

## Global Constraints

- **날조 금지 (최상위 제약)**: 인터뷰 답변에 없는 사실은 한 줄도 쓰지 않는다. 추론·보간·"그럴듯한 살 붙이기" 전부 금지. 답변 없는 항목은 1인칭 주장을 삭제하거나 일반 서술로 격하한다.
- **기준 문체**: "~습니다". 구어체 전환 금지.
- **제목 불변**: H1~H6 제목은 수정하지 않는다 (본문 앵커 링크 파손 방지).
- **제목·메타 동결**: `title`·`summary`·`tags` 프론트매터를 변경하지 않는다 (CTR 측정 동결 — `docs/ctr-surgery-log.md`).
- **정본 사실**: 전화번호는 `%%phone%%` 토큰만(하드코딩 금지), 연신내역 4번 출구, 불광역 7번 출구, 성우 10만원/시간, 보컬·악기 레슨 미운영(프로듀싱 레슨만). 근거: `lib/factGuards.ts`.
- **번역본 미동기화**: `*.en.md` 등 로케일 파일은 이번에 건드리지 않는다.
- **윤문 실행 위치**: humanize-korean은 `_workspace/`를 cwd에 만들므로 스크래치패드(`/private/tmp/claude-501/-Users-hwang-gyeongha-studio/547acec8-aa9d-4e1c-942b-2bc0c4e827cb/scratchpad`)를 cwd로 실행한다. 리포에 `_workspace/`가 생기면 안 된다.
- **검증된 전제**: 두 파일의 순수 산문은 각각 3,650자·3,774자이고 혼합 블록은 0개다. 따라서 fast 모드로 처리되며 블록 단위 제외가 산문을 잃지 않는다.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `scripts/proseSegments.js` (신규) | 마크다운 ↔ 마커 텍스트 왕복. 추출·병합·정합성 검사 |
| `scripts/__tests__/proseSegments.test.js` (신규) | 위 유틸의 단위 테스트 |
| `scripts/structureIntegrity.js` (신규) | 구조 지문(fingerprint) 생성·비교. 검증 게이트 3용 |
| `scripts/__tests__/structureIntegrity.test.js` (신규) | 위 유틸의 단위 테스트 |
| `docs/story-quality-pilot/diagnosis.md` (신규) | Stage 0 진단 — 일반론 1인칭 주장 목록 |
| `docs/story-quality-pilot/interview.md` (신규) | Stage 1 질문지 + 답변 기록 (사실 출처 추적용) |
| `docs/story-quality-pilot/fact-trace.md` (신규) | 게이트 4 사실 출처 대조표 |
| `docs/story-quality-pilot/retrospective.md` (신규) | Stage 5 회고 |
| `content/stories/practice-room-startup1.md` (수정) | 심화 + 윤문 대상 |
| `content/stories/plugins1.md` (수정) | 심화 + 윤문 대상 |
| `docs/content-guidelines.md` (수정) | 톤 규정 현실화 |
| `docs/story-tier-flagship-2026-07.md` (수정) | 글자수 열 실측 반영 |

---

## Task 1: 산문 세그먼트 추출·병합 유틸

**Files:**
- Create: `scripts/proseSegments.js`
- Test: `scripts/__tests__/proseSegments.test.js`

**Interfaces:**
- Consumes: 없음 (기반 태스크)
- Produces:
  - `extractProse(markdown: string): { segments: Segment[], marked: string }`
    - `Segment = { id: string, startLine: number, endLine: number, text: string }`
    - `id`는 `'001'`부터 3자리 0패딩. `startLine`/`endLine`은 **본문 전체 줄 배열 기준 0-index, endLine 포함**.
    - `marked`는 `<<<SEG:001>>>\n본문\n\n<<<SEG:002>>>\n본문` 형태.
  - `mergeProse(markdown: string, rewrittenMarked: string): string`
    - 마커 id 집합이 원본과 다르면 `Error`를 던진다.
  - `isStructureLine(line: string, inFence: boolean): boolean`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `scripts/__tests__/proseSegments.test.js`:

```js
const { extractProse, mergeProse } = require('../proseSegments');

const SAMPLE = [
  '---',
  'title: "테스트 글"',
  'tags: ["a", "b"]',
  '---',
  '![대표 이미지](/images/x.webp)',
  '',
  '## 첫 번째 제목',
  '',
  '첫 산문 단락입니다.',
  '두 번째 줄이 이어집니다.',
  '',
  '| 항목 | 값 |',
  '|---|---|',
  '| 가격 | 10만원 |',
  '',
  '%%service:lesson%%',
  '',
  '- 불릿 하나',
  '- 불릿 둘',
  '',
  '두 번째 산문 단락입니다.',
  '',
  '---',
  '',
  '[문의하기](/contact)',
  '',
  '> 인용문입니다.',
  '',
  '```js',
  'const a = 1;',
  '```',
  '',
  '마지막 산문 단락입니다.',
  '',
].join('\n');

describe('extractProse', () => {
  test('산문 블록만 뽑는다', () => {
    const { segments } = extractProse(SAMPLE);
    expect(segments.map((s) => s.text)).toEqual([
      '첫 산문 단락입니다.\n두 번째 줄이 이어집니다.',
      '두 번째 산문 단락입니다.',
      '마지막 산문 단락입니다.',
    ]);
  });

  test('id는 001부터 3자리 0패딩', () => {
    const { segments } = extractProse(SAMPLE);
    expect(segments.map((s) => s.id)).toEqual(['001', '002', '003']);
  });

  test('marked에 마커가 각 세그먼트 앞에 붙는다', () => {
    const { marked } = extractProse(SAMPLE);
    expect(marked).toBe(
      [
        '<<<SEG:001>>>',
        '첫 산문 단락입니다.',
        '두 번째 줄이 이어집니다.',
        '',
        '<<<SEG:002>>>',
        '두 번째 산문 단락입니다.',
        '',
        '<<<SEG:003>>>',
        '마지막 산문 단락입니다.',
      ].join('\n'),
    );
  });

  test('프론트매터는 절대 포함되지 않는다', () => {
    const { marked } = extractProse(SAMPLE);
    expect(marked).not.toContain('title:');
    expect(marked).not.toContain('tags:');
  });

  test('구조 줄이 한 줄이라도 섞인 블록은 통째로 제외한다', () => {
    const md = ['산문 줄입니다.', '- 그런데 불릿이 붙었습니다', ''].join('\n');
    const { segments } = extractProse(md);
    expect(segments).toEqual([]);
  });

  test('프론트매터가 없는 문서도 처리한다', () => {
    const { segments } = extractProse('그냥 산문입니다.\n');
    expect(segments.map((s) => s.text)).toEqual(['그냥 산문입니다.']);
  });
});

describe('mergeProse', () => {
  test('왕복하면 원본과 같다 (항등성)', () => {
    const { marked } = extractProse(SAMPLE);
    expect(mergeProse(SAMPLE, marked)).toBe(SAMPLE);
  });

  test('윤문된 텍스트가 제자리에 들어간다', () => {
    const { marked } = extractProse(SAMPLE);
    const rewritten = marked.replace('두 번째 산문 단락입니다.', '두 번째 단락을 고쳤습니다.');
    const merged = mergeProse(SAMPLE, rewritten);
    expect(merged).toContain('두 번째 단락을 고쳤습니다.');
    expect(merged).toContain('| 가격 | 10만원 |');
    expect(merged).toContain('%%service:lesson%%');
    expect(merged).toContain('## 첫 번째 제목');
  });

  test('줄 수가 늘어난 윤문도 병합한다', () => {
    const { marked } = extractProse(SAMPLE);
    const rewritten = marked.replace(
      '마지막 산문 단락입니다.',
      '마지막 단락입니다.\n한 줄이 더 늘었습니다.',
    );
    const merged = mergeProse(SAMPLE, rewritten);
    expect(merged).toContain('마지막 단락입니다.\n한 줄이 더 늘었습니다.');
    expect(merged).toContain('```js');
  });

  test('마커가 누락되면 throw', () => {
    const { marked } = extractProse(SAMPLE);
    const broken = marked.replace('<<<SEG:002>>>\n', '');
    expect(() => mergeProse(SAMPLE, broken)).toThrow(/002/);
  });

  test('없던 마커가 추가되면 throw', () => {
    const { marked } = extractProse(SAMPLE);
    const broken = `${marked}\n\n<<<SEG:009>>>\n난입한 단락`;
    expect(() => mergeProse(SAMPLE, broken)).toThrow(/009/);
  });

  test('세그먼트 내용이 비면 throw', () => {
    const { marked } = extractProse(SAMPLE);
    const broken = marked.replace('두 번째 산문 단락입니다.', '');
    expect(() => mergeProse(SAMPLE, broken)).toThrow(/비어/);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx jest scripts/__tests__/proseSegments.test.js`
Expected: FAIL — `Cannot find module '../proseSegments'`

- [ ] **Step 3: 구현 작성**

Create `scripts/proseSegments.js`:

```js
'use strict';

/**
 * 마크다운을 "산문 블록"과 "구조 블록"으로 나눠, 산문만 윤문 파이프라인에
 * 태우기 위한 유틸.
 *
 * 설계 원칙: 구조(프론트매터·표·목록·제목·디렉티브·코드·인용·이미지·링크줄)는
 * 애초에 추출되지 않으므로 윤문이 훼손할 수 없다. 구조 줄이 한 줄이라도 섞인
 * 블록은 통째로 제외한다 — 부분 추출은 병합 시 어긋날 위험이 크다.
 *
 * 근거 스펙: docs/superpowers/specs/2026-07-27-story-quality-pilot-design.md
 */

const MARKER_PREFIX = '<<<SEG:';
const MARKER_LINE_RE = /^<<<SEG:(\d{3})>>>$/;

/** 구조 줄 판정. inFence면 코드블록 내부이므로 무조건 구조. */
function isStructureLine(line, inFence) {
  if (inFence) return true;
  const s = line.trim();
  if (s.startsWith('```') || s.startsWith('~~~')) return true;
  if (s.startsWith('|')) return true;
  if (/^[-*+]\s/.test(s)) return true;
  if (/^\d+[.)]\s/.test(s)) return true;
  if (/^#{1,6}\s/.test(s)) return true;
  if (/^(-{3,}|\*{3,}|_{3,})$/.test(s)) return true;
  if (s.startsWith('![')) return true;
  if (/^%%[A-Za-z0-9:_-]+%%$/.test(s)) return true;
  if (/^\[[^\]]+\]\([^)]+\)$/.test(s)) return true;
  if (s.startsWith('>')) return true;
  return false;
}

/** 프론트매터가 끝나는 줄 index를 반환. 없으면 -1. */
function frontmatterEndLine(lines) {
  if (lines.length === 0 || lines[0].trim() !== '---') return -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') return i;
  }
  return -1;
}

/** 본문을 빈 줄 기준 블록으로 나눈다. 각 블록은 {start, end, lines, hasStructure}. */
function toBlocks(lines, bodyStart) {
  const blocks = [];
  let cur = null;
  let inFence = false;

  for (let i = bodyStart; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    const isFenceDelim = trimmed.startsWith('```') || trimmed.startsWith('~~~');

    if (trimmed === '' && !inFence) {
      if (cur) {
        blocks.push(cur);
        cur = null;
      }
      continue;
    }

    const structure = isStructureLine(line, inFence);
    if (!cur) cur = { start: i, end: i, lines: [], hasStructure: false };
    cur.lines.push(line);
    cur.end = i;
    if (structure) cur.hasStructure = true;

    if (isFenceDelim) inFence = !inFence;
  }
  if (cur) blocks.push(cur);
  return blocks;
}

/**
 * 산문 블록을 추출한다.
 * @returns {{segments: Array<{id:string,startLine:number,endLine:number,text:string}>, marked:string}}
 */
function extractProse(markdown) {
  const lines = markdown.split('\n');
  const fmEnd = frontmatterEndLine(lines);
  const bodyStart = fmEnd === -1 ? 0 : fmEnd + 1;

  const segments = [];
  toBlocks(lines, bodyStart).forEach((block) => {
    if (block.hasStructure) return;
    const id = String(segments.length + 1).padStart(3, '0');
    segments.push({
      id,
      startLine: block.start,
      endLine: block.end,
      text: block.lines.join('\n'),
    });
  });

  const marked = segments.map((s) => `${MARKER_PREFIX}${s.id}>>>\n${s.text}`).join('\n\n');
  return { segments, marked };
}

/** 마커 텍스트를 {id: text} 맵으로 파싱한다. */
function parseMarked(marked) {
  const map = new Map();
  const order = [];
  let curId = null;
  let buf = [];

  const flush = () => {
    if (curId === null) return;
    map.set(curId, buf.join('\n').replace(/^\n+|\n+$/g, ''));
    buf = [];
  };

  marked.split('\n').forEach((line) => {
    const m = MARKER_LINE_RE.exec(line.trim());
    if (m) {
      flush();
      curId = m[1];
      order.push(curId);
      return;
    }
    if (curId !== null) buf.push(line);
  });
  flush();
  return { map, order };
}

/**
 * 윤문된 마커 텍스트를 원본 마크다운 제자리에 되돌린다.
 * 마커 집합이 원본과 다르거나 내용이 비면 throw — 조용한 어긋남을 허용하지 않는다.
 */
function mergeProse(markdown, rewrittenMarked) {
  const { segments } = extractProse(markdown);
  const { map, order } = parseMarked(rewrittenMarked);

  const expected = segments.map((s) => s.id);
  const missing = expected.filter((id) => !map.has(id));
  if (missing.length > 0) {
    throw new Error(`윤문 결과에 마커가 누락됐습니다: ${missing.join(', ')}`);
  }
  const extra = order.filter((id) => !expected.includes(id));
  if (extra.length > 0) {
    throw new Error(`윤문 결과에 없던 마커가 있습니다: ${extra.join(', ')}`);
  }
  if (order.length !== expected.length) {
    throw new Error(`마커 개수 불일치: 기대 ${expected.length}, 실제 ${order.length}`);
  }
  const empty = expected.filter((id) => map.get(id).trim() === '');
  if (empty.length > 0) {
    throw new Error(`윤문 결과 세그먼트가 비어 있습니다: ${empty.join(', ')}`);
  }

  const lines = markdown.split('\n');
  // 뒤에서부터 치환해야 앞쪽 인덱스가 밀리지 않는다
  [...segments].reverse().forEach((s) => {
    lines.splice(s.startLine, s.endLine - s.startLine + 1, ...map.get(s.id).split('\n'));
  });
  return lines.join('\n');
}

module.exports = { extractProse, mergeProse, isStructureLine };
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx jest scripts/__tests__/proseSegments.test.js`
Expected: PASS — 12 tests

- [ ] **Step 5: 실제 파일럿 파일로 스모크 확인**

Run:
```bash
node -e "
const fs=require('fs');
const {extractProse,mergeProse}=require('./scripts/proseSegments');
for (const f of ['practice-room-startup1','plugins1']) {
  const p='content/stories/'+f+'.md';
  const md=fs.readFileSync(p,'utf8');
  const {segments,marked}=extractProse(md);
  const chars=segments.reduce((n,s)=>n+s.text.length,0);
  console.log(f, '세그먼트', segments.length, '/ 산문', chars, '자 / 왕복항등', mergeProse(md,marked)===md);
}"
```
Expected: 두 줄 모두 `왕복항등 true`, 산문 글자수는 각각 3,650 / 3,774 근방 (fast 모드 상한 8,000자 미만)

- [ ] **Step 6: 커밋**

```bash
git add scripts/proseSegments.js scripts/__tests__/proseSegments.test.js
git commit -m "feat(scripts): 산문 세그먼트 추출·병합 유틸

윤문 파이프라인에 산문만 태우기 위한 마커 왕복 유틸. 구조 줄이 섞인
블록은 통째 제외하고, 마커 집합이 어긋나면 병합을 중단한다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: 구조 무결성 지문 유틸

**Files:**
- Create: `scripts/structureIntegrity.js`
- Test: `scripts/__tests__/structureIntegrity.test.js`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `fingerprint(markdown: string): Fingerprint`
    - `Fingerprint = { frontmatterKeys: string[], tableRows: number, headings: string[], links: string[], directives: string[], images: number, codeFences: number }`
    - `headings`는 제목 텍스트 배열(앵커 파손 감지용), `links`는 URL 배열, `directives`는 `%%...%%` 원문 배열.
  - `diffFingerprint(before: Fingerprint, after: Fingerprint): string[]` — 차이 설명 배열. 같으면 빈 배열.

- [ ] **Step 1: 실패하는 테스트 작성**

Create `scripts/__tests__/structureIntegrity.test.js`:

```js
const { fingerprint, diffFingerprint } = require('../structureIntegrity');

const BASE = [
  '---',
  'title: "글 제목"',
  'date: 2026-04-07',
  'tags:',
  '  - 태그1',
  '---',
  '![대표](/images/a.webp)',
  '',
  '## 섹션 하나',
  '',
  '산문입니다. [내부 링크](/stories/x1)를 포함합니다.',
  '',
  '| 항목 | 값 |',
  '|---|---|',
  '| 가격 | 36만원 |',
  '',
  '%%service:lesson%%',
  '',
  '### 하위 제목',
  '',
  '전화는 %%phone%% 입니다.',
  '',
].join('\n');

describe('fingerprint', () => {
  test('프론트매터 최상위 키를 뽑는다', () => {
    expect(fingerprint(BASE).frontmatterKeys).toEqual(['title', 'date', 'tags']);
  });

  test('제목 텍스트를 순서대로 뽑는다', () => {
    expect(fingerprint(BASE).headings).toEqual(['섹션 하나', '하위 제목']);
  });

  test('표 행·이미지 수를 센다', () => {
    const fp = fingerprint(BASE);
    expect(fp.tableRows).toBe(3);
    expect(fp.images).toBe(1);
  });

  test('링크 URL과 디렉티브를 뽑는다', () => {
    const fp = fingerprint(BASE);
    expect(fp.links).toEqual(['/stories/x1']);
    expect(fp.directives).toEqual(['%%service:lesson%%', '%%phone%%']);
  });
});

describe('diffFingerprint', () => {
  test('동일하면 빈 배열', () => {
    expect(diffFingerprint(fingerprint(BASE), fingerprint(BASE))).toEqual([]);
  });

  test('제목이 바뀌면 잡는다', () => {
    const after = BASE.replace('## 섹션 하나', '## 섹션 하나로 바꿈');
    const diffs = diffFingerprint(fingerprint(BASE), fingerprint(after));
    expect(diffs.join(' ')).toMatch(/headings/);
  });

  test('디렉티브가 사라지면 잡는다', () => {
    const after = BASE.replace('%%phone%%', '010-4255-7893');
    const diffs = diffFingerprint(fingerprint(BASE), fingerprint(after));
    expect(diffs.join(' ')).toMatch(/directives/);
  });

  test('표 행이 줄면 잡는다', () => {
    const after = BASE.replace('| 가격 | 36만원 |\n', '');
    const diffs = diffFingerprint(fingerprint(BASE), fingerprint(after));
    expect(diffs.join(' ')).toMatch(/tableRows/);
  });

  test('산문만 바뀌면 차이 없음', () => {
    const after = BASE.replace('산문입니다.', '산문을 고쳤습니다. 리듬도 바꿨고요.');
    expect(diffFingerprint(fingerprint(BASE), fingerprint(after))).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx jest scripts/__tests__/structureIntegrity.test.js`
Expected: FAIL — `Cannot find module '../structureIntegrity'`

- [ ] **Step 3: 구현 작성**

Create `scripts/structureIntegrity.js`:

```js
'use strict';

/**
 * 마크다운의 "구조 지문"을 떠서 편집 전후를 비교한다.
 *
 * 윤문·심화가 프론트매터·제목·표·링크·디렉티브를 건드리지 않았음을 기계적으로
 * 증명하는 게 목적. 산문 텍스트 변화는 지문에 잡히지 않는다(그게 정상이다).
 *
 * 근거 스펙: docs/superpowers/specs/2026-07-27-story-quality-pilot-design.md 게이트 3
 */

const matter = require('gray-matter');

const LINK_RE = /(?<!!)\[[^\]]*\]\(([^)]+)\)/g;
const DIRECTIVE_RE = /%%[A-Za-z0-9:_-]+%%/g;

function fingerprint(markdown) {
  const parsed = matter(markdown);
  const body = parsed.content;
  const lines = body.split('\n');

  const headings = [];
  let tableRows = 0;
  let images = 0;
  let codeFences = 0;
  let inFence = false;

  lines.forEach((line) => {
    const s = line.trim();
    if (s.startsWith('```') || s.startsWith('~~~')) {
      codeFences += 1;
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    const h = /^(#{1,6})\s+(.*)$/.exec(s);
    if (h) {
      headings.push(h[2].trim());
      return;
    }
    if (s.startsWith('|')) tableRows += 1;
    if (/!\[[^\]]*\]\([^)]+\)/.test(s)) images += 1;
  });

  return {
    frontmatterKeys: Object.keys(parsed.data),
    tableRows,
    headings,
    links: [...body.matchAll(LINK_RE)].map((m) => m[1]),
    directives: body.match(DIRECTIVE_RE) || [],
    images,
    codeFences,
  };
}

function diffFingerprint(before, after) {
  const diffs = [];
  const cmp = (key) => {
    const a = JSON.stringify(before[key]);
    const b = JSON.stringify(after[key]);
    if (a !== b) diffs.push(`${key}: ${a} → ${b}`);
  };
  ['frontmatterKeys', 'headings', 'links', 'directives'].forEach(cmp);
  ['tableRows', 'images', 'codeFences'].forEach((key) => {
    if (before[key] !== after[key]) diffs.push(`${key}: ${before[key]} → ${after[key]}`);
  });
  return diffs;
}

module.exports = { fingerprint, diffFingerprint };
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx jest scripts/__tests__/structureIntegrity.test.js`
Expected: PASS — 9 tests

- [ ] **Step 5: 파일럿 파일 지문 베이스라인 저장**

Run:
```bash
mkdir -p /private/tmp/claude-501/-Users-hwang-gyeongha-studio/547acec8-aa9d-4e1c-942b-2bc0c4e827cb/scratchpad/pilot
node -e "
const fs=require('fs');
const {fingerprint}=require('./scripts/structureIntegrity');
const out={};
for (const f of ['practice-room-startup1','plugins1']) {
  out[f]=fingerprint(fs.readFileSync('content/stories/'+f+'.md','utf8'));
}
fs.writeFileSync('/private/tmp/claude-501/-Users-hwang-gyeongha-studio/547acec8-aa9d-4e1c-942b-2bc0c4e827cb/scratchpad/pilot/fingerprint-before.json', JSON.stringify(out,null,2));
console.log('베이스라인 저장 완료');
console.log('practice-room-startup1 제목', out['practice-room-startup1'].headings.length, '개 / 링크', out['practice-room-startup1'].links.length, '개');
console.log('plugins1 제목', out['plugins1'].headings.length, '개 / 링크', out['plugins1'].links.length, '개');
"
```
Expected: `베이스라인 저장 완료` + 각 파일의 제목·링크 개수 출력

- [ ] **Step 6: 커밋**

```bash
git add scripts/structureIntegrity.js scripts/__tests__/structureIntegrity.test.js
git commit -m "feat(scripts): 구조 무결성 지문 유틸

프론트매터 키·제목·링크·디렉티브·표 행 수를 지문으로 떠 편집 전후를
비교한다. 산문 변화는 잡지 않고 구조 훼손만 잡는다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Stage 0 — 일반론 1인칭 주장 진단

**Files:**
- Create: `docs/story-quality-pilot/diagnosis.md`
- Read: `content/stories/practice-room-startup1.md`, `content/stories/plugins1.md`

**Interfaces:**
- Consumes: Task 1의 `extractProse` (세그먼트 번호 참조용)
- Produces: `diagnosis.md` — Task 4 질문지의 입력이 되는 항목 목록. 각 항목은 `{파일, 줄번호, 현재문장, 결함유형}`.

- [ ] **Step 1: 두 파일 전문 정독**

Read: `content/stories/practice-room-startup1.md` (216줄 전체), `content/stories/plugins1.md` (186줄 전체)

- [ ] **Step 2: 진단 문서 작성**

Create `docs/story-quality-pilot/diagnosis.md`. 아래 표를 채운다 — **이미 확인된 4건은 그대로 옮기고, 정독하며 추가로 발견한 것을 덧붙인다.**

```markdown
# Stage 0 진단 — 일반론 1인칭 주장 (2026-07-27)

결함 유형:
- `A` 1인칭 화자가 등장하는데 구체 사실(숫자·연도·고유명사)이 없음
- `B` "우리는 ~한다"고 하는데 무엇을 하는지 안 나옴
- `C` 검증 필요 — 구체적이나 실제 사실인지 확인 안 됨
- `D` AI 티 구조 (볼드 라벨+콜론 병렬, 불릿 기계 나열)

| # | 파일 | 줄 | 현재 문장 (발췌) | 유형 |
|---|---|---|---|---|
| 1 | practice-room-startup1 | 199 | "최소 3사 견적을 받고 STC 등급·차음 자재·시공 방식을 명세서로 비교해야 합니다." | A |
| 2 | practice-room-startup1 | 191 | "저는 연신내에서 연습실과 녹음실을 직접 운영하는 황경하입니다. (…) 상담 때 꼭 말씀드리는 세 가지" | A |
| 3 | practice-room-startup1 | 167~181 | "**운영 구조 체득**: …" 볼드 라벨+콜론 5연속 | D |
| 4 | plugins1 | 178 | "저도 실제 세션에서 쓰는 EQ·컴프는 손에 꼽아요" — 무엇인지 안 나옴 | B |
| 5 | plugins1 | 150~166 | "Studio NOL 보컬 믹싱에서 자주 쓰는 플러그인 조합 3가지" — 실제 사용 체인인지 미검증 | C |
```

- [ ] **Step 3: 진단 건수 확인**

Run: `grep -c '^| [0-9]' docs/story-quality-pilot/diagnosis.md`
Expected: 5 이상 (정독으로 추가 발견 시 증가)

- [ ] **Step 4: 커밋**

```bash
git add docs/story-quality-pilot/diagnosis.md
git commit -m "docs(pilot): Stage 0 진단 — 일반론 1인칭 주장 목록

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Stage 1 — 인터뷰 질문지 작성 및 답변 수령

**Files:**
- Create: `docs/story-quality-pilot/interview.md`
- Read: `docs/story-quality-pilot/diagnosis.md`

**Interfaces:**
- Consumes: Task 3의 `diagnosis.md` 항목 목록
- Produces: `interview.md` — 질문 + **황경하의 실제 답변**. Task 5·6의 유일한 사실 원천이며 Task 9 대조표의 기준.

> **이 태스크는 사용자 응답 없이는 완료될 수 없다.** 답변을 받기 전에 Task 5로 넘어가지 말 것.

- [ ] **Step 1: 질문지 작성**

Create `docs/story-quality-pilot/interview.md`. 아래는 **Task 3에서 이미 확정된 진단 5건에 대응하는 필수 문항**이다. 그대로 쓰고, 정독 중 추가로 발견한 항목의 문항을 같은 형식으로 덧붙인다 (편당 6~10문항 목표).

```markdown
# Stage 1 인터뷰 — 파일럿 2편 (2026-07-27)

> 답변은 각 문항의 `**답변:**` 줄 아래에 적어주세요.
> 모르거나 공개하기 곤란하면 `패스`라고만 적으면 됩니다 — 지어내지 않고 해당 주장을 덜어냅니다.
> 업체명·고객명은 안 밝히셔도 됩니다. 숫자·연도·상황만 있으면 충분합니다.
> 기억이 흐릿하면 "대략 ~쯤"도 괜찮습니다. 정확한 척하는 것보다 그게 낫습니다.

## practice-room-startup1.md

### Q1. 방음 시공 견적 (199줄)
**현재 문장:** "최소 3사 견적을 받고 STC 등급·차음 자재·시공 방식을 명세서로 비교해야 합니다."
**묻는 것:** 연신내 스튜디오를 만드실 때 실제로 몇 개 업체에서 견적을 받으셨나요? 최저-최고 금액 차이가 얼마였나요? 최종적으로 실당 얼마에 하셨나요?
**왜 묻나:** 지금은 누구나 쓸 수 있는 조언입니다. 실제 숫자가 들어가면 복제 불가능한 문장이 됩니다.
**답변:**

### Q2. 실제 창업 비용 (37~55줄 비용 섹션)
**현재 문장:** "소규모(3~5실) 연습실 초기 창업 비용은 3,000~8,000만원"
**묻는 것:** 스튜디오 놀을 처음 열 때 실제로 들어간 총액은 얼마였나요? 그중 예상보다 많이 나간 항목과, 반대로 안 써도 됐던 항목은 무엇이었나요?
**왜 묻나:** 범위 제시는 어디에나 있습니다. "나는 얼마 썼고 어디서 틀렸다"가 이 글에만 있는 정보입니다.
**답변:**

### Q3. 예비 창업자 상담 (191줄)
**현재 문장:** "예비 창업자분들께 상담 때 꼭 말씀드리는 세 가지를 정리합니다."
**묻는 것:** 실제로 창업 상담을 받아보신 적이 있나요? 있다면 대략 몇 건이고, 가장 자주 나온 질문은 무엇이었나요? 상담 중 "이건 정말 말리고 싶다"고 느낀 계획이 있었나요?
**왜 묻나:** 상담 경험이 없다면 이 섹션의 1인칭 표지를 떼야 합니다. 있다면 실제 질문이 곧 콘텐츠입니다.
**답변:**

### Q4. 운영하며 실제로 겪은 것 (167~181줄)
**현재 문장:** "심야 2시에 연습하러 오는 사람이 정말 있는지 / 어떤 장비가 가장 자주 망가지는지" (질문만 던지고 답이 없음)
**묻는 것:** 운영해 보니 실제로 어땠나요? ① 심야 이용이 실제로 있나요 ② 가장 자주 고장 난 장비는 무엇이었나요 ③ 민원이 실제로 들어온 적이 있나요, 원인은 무엇이었나요 ④ 겨울 냉난방비가 실제로 얼마나 나오나요
**왜 묻나:** 지금은 질문 목록만 있고 답이 없습니다. 답을 가진 사람이 쓴 글로 바꿉니다.
**답변:**

## plugins1.md

### Q5. 실제 쓰는 EQ·컴프 (178줄)
**현재 문장:** "저도 실제 세션에서 쓰는 EQ·컴프는 손에 꼽아요." (무엇인지 안 나옴)
**묻는 것:** 실제로 손이 가는 EQ와 컴프레서는 무엇인가요? 몇 개나 되나요? 한때 샀지만 지금은 안 쓰는 플러그인이 있다면 그것도 알려주세요.
**왜 묻나:** "손에 꼽는다"고만 하고 안 밝히면 독자가 얻는 게 없습니다. 안 쓰게 된 것까지 있으면 더 좋습니다.
**답변:**

### Q6. 플러그인 조합 3가지 검증 (150~166줄)
**현재 문장:** "Studio NOL 보컬 믹싱에서 자주 쓰는 플러그인 조합 3가지" — Pro-Q 3 → CLA-2A → Pro-DS → Valhalla Room 등 3개 체인
**묻는 것:** 이 세 체인이 실제로 쓰시는 것이 맞나요? 틀린 부분이 있으면 실제 체인으로 고쳐 주세요. 맞다면, 각 체인을 어떤 곡·어떤 상황에서 썼는지 한 가지씩만 알려주세요.
**왜 묻나:** 체인 자체는 구체적인데 실제 사용 여부가 미검증입니다. 틀렸다면 고쳐야 하고, 맞다면 세션 맥락을 붙여야 진짜 경험이 됩니다.
**답변:**
```

**질문 설계 규칙:**
- 한 문항은 한 가지 사실만 묻는다
- "어떻게 생각하시나요" 같은 의견이 아니라 **일어난 일**을 묻는다 (숫자·연도·횟수·상황)
- 답변 부담을 낮춘다 — 업체명·고객명 불필요를 명시
- 문항마다 **왜 묻는지**를 한 줄로 붙인다

- [ ] **Step 2: 질문지를 사용자에게 전달**

`SendUserFile`로 `docs/story-quality-pilot/interview.md`를 보내고, 대화로도 문항 요약을 제시한다.

- [ ] **Step 3: 답변 수령 및 기록**

사용자 답변을 `interview.md`의 각 `**답변:**` 아래에 그대로 기록한다. **답변을 요약하거나 매끄럽게 다듬지 않는다** — 원문 그대로가 Task 9 대조표의 근거다.

- [ ] **Step 4: 답변 커버리지 확인**

Run: `grep -c '^\*\*답변:\*\*$' docs/story-quality-pilot/interview.md`
Expected: `0` — 빈 답변이 하나도 없어야 한다. `패스`도 답변으로 친다.

- [ ] **Step 5: 커밋**

```bash
git add docs/story-quality-pilot/interview.md
git commit -m "docs(pilot): Stage 1 인터뷰 질문지 및 답변

심화 서술의 유일한 사실 원천. 답변에 없는 내용은 본문에 쓰지 않는다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Stage 2 — practice-room-startup1 심화

**Files:**
- Modify: `content/stories/practice-room-startup1.md`
- Read: `docs/story-quality-pilot/interview.md`

**Interfaces:**
- Consumes: Task 4의 답변, Task 2의 `fingerprint`/`diffFingerprint`
- Produces: 심화된 본문. Task 7 윤문의 입력.

- [ ] **Step 1: 답변 기반 서술로 교체**

`interview.md`의 practice-room-startup1 문항 답변을 읽고, 진단 항목의 문장을 교체한다.

**교체 규칙:**
- 답변에 있는 사실만 쓴다. 답변이 "3사에서 받았고 900만원~1,600만원, 최종 1,100만원"이면 그 숫자만 쓴다. "보통 이 정도 편차가 납니다" 같은 일반화 덧붙이기 금지
- `패스` 답변 항목은 셋 중 하나로 처리: (a) 1인칭 주장 삭제 후 일반 서술로 격하 (b) 섹션 제거 (c) 외부 출처로 대체하고 1인칭 표지 제거
- 새 섹션을 덧붙이기보다 **기존 섹션 교체**를 우선한다
- 제목(`##`, `###`)은 건드리지 않는다
- 순증 목표 800~1,500자

- [ ] **Step 2: 목록 AI 티 정리**

167~181줄의 볼드 라벨+콜론 5연속(`**운영 구조 체득**: …`)을 푼다. 파일 전체의 불릿 나열도 함께 본다.

**정리 방법:** 5개 병렬을 전부 유지하지 말고 — 중요한 2~3개는 산문 단락으로 풀어 쓰고, 나머지는 짧은 불릿으로 남기거나 덜어낸다. 표·FAQ·howTo는 건드리지 않는다.

- [ ] **Step 3: 구조 무결성 확인**

Run:
```bash
node -e "
const fs=require('fs');
const {fingerprint,diffFingerprint}=require('./scripts/structureIntegrity');
const base=JSON.parse(fs.readFileSync('/private/tmp/claude-501/-Users-hwang-gyeongha-studio/547acec8-aa9d-4e1c-942b-2bc0c4e827cb/scratchpad/pilot/fingerprint-before.json','utf8'));
const now=fingerprint(fs.readFileSync('content/stories/practice-room-startup1.md','utf8'));
const d=diffFingerprint(base['practice-room-startup1'], now);
console.log(d.length===0 ? '구조 무결 ✓' : '구조 변경 감지:\n'+d.join('\n'));
"
```
Expected: `구조 무결 ✓`
※ 심화에서 링크를 의도적으로 추가했다면 `links` 차이만 허용된다. **headings·directives·frontmatterKeys 차이는 무조건 롤백** — 제목·디렉티브·메타는 이번 범위 밖이다. 차이가 나면 지문 베이스라인을 갱신하지 말고 본문을 되돌린다.

- [ ] **Step 4: 정본 사실 게이트**

Run: `npx jest content/factGuards.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add content/stories/practice-room-startup1.md
git commit -m "feat(content): practice-room-startup1 인터뷰 기반 심화

일반론 1인칭 주장을 실제 운영 사실로 교체하고 볼드 라벨 병렬을 푼다.
사실 출처는 docs/story-quality-pilot/interview.md.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Stage 2 — plugins1 심화

**Files:**
- Modify: `content/stories/plugins1.md`
- Read: `docs/story-quality-pilot/interview.md`

**Interfaces:**
- Consumes: Task 4의 답변, Task 2의 `fingerprint`/`diffFingerprint`
- Produces: 심화된 본문. Task 8 윤문의 입력.

- [ ] **Step 1: 답변 기반 서술로 교체**

Task 5 Step 1과 **동일한 교체 규칙**을 적용한다:
- 답변에 있는 사실만 쓴다. 일반화 덧붙이기 금지
- `패스` 항목은 (a) 1인칭 주장 삭제 후 일반 서술 격하 (b) 섹션 제거 (c) 외부 출처 대체 + 1인칭 표지 제거 중 하나
- 기존 섹션 교체 우선, 제목 불변, 순증 800~1,500자

**이 파일 고유 처리:**
- 178줄 "저도 실제 세션에서 쓰는 EQ·컴프는 손에 꼽아요" → 답변의 실제 플러그인명으로 채운다
- 150~166줄 "자주 쓰는 플러그인 조합 3가지"는 **검증 대상**이다. 답변이 "실제로 그 체인을 쓴다"면 그대로 두고 세션 맥락(장르·상황)을 덧붙인다. 답변이 다르면 실제 체인으로 교체한다. 답변이 `패스`면 "Studio NOL 보컬 믹싱에서 자주 쓰는"이라는 1인칭 표지를 떼고 일반 추천 섹션으로 격하한다

- [ ] **Step 2: 목록 AI 티 정리**

Task 5 Step 2와 같은 방법. 이 파일은 표가 28행으로 많고 불릿은 7줄뿐이므로, 볼드 라벨+콜론 병렬 위주로 본다. **표는 건드리지 않는다.**

- [ ] **Step 3: 구조 무결성 확인**

Run:
```bash
node -e "
const fs=require('fs');
const {fingerprint,diffFingerprint}=require('./scripts/structureIntegrity');
const base=JSON.parse(fs.readFileSync('/private/tmp/claude-501/-Users-hwang-gyeongha-studio/547acec8-aa9d-4e1c-942b-2bc0c4e827cb/scratchpad/pilot/fingerprint-before.json','utf8'));
const now=fingerprint(fs.readFileSync('content/stories/plugins1.md','utf8'));
const d=diffFingerprint(base['plugins1'], now);
console.log(d.length===0 ? '구조 무결 ✓' : '구조 변경 감지:\n'+d.join('\n'));
"
```
Expected: `구조 무결 ✓` (링크 추가만 허용, headings·directives·frontmatterKeys 차이는 롤백)

- [ ] **Step 4: 정본 사실 게이트**

Run: `npx jest content/factGuards.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add content/stories/plugins1.md
git commit -m "feat(content): plugins1 인터뷰 기반 심화

실제 사용 플러그인 체인으로 1인칭 주장을 채우고 미검증 섹션을 정리한다.
사실 출처는 docs/story-quality-pilot/interview.md.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Stage 3 — practice-room-startup1 윤문·병합

**Files:**
- Modify: `content/stories/practice-room-startup1.md`
- Temp: 스크래치패드 `pilot/` 하위

**Interfaces:**
- Consumes: Task 1의 `extractProse`/`mergeProse`, Task 5의 심화 본문
- Produces: 윤문된 본문

- [ ] **Step 1: 산문 추출 및 크기 확인**

Run:
```bash
SP=/private/tmp/claude-501/-Users-hwang-gyeongha-studio/547acec8-aa9d-4e1c-942b-2bc0c4e827cb/scratchpad/pilot
node -e "
const fs=require('fs');
const {extractProse}=require('./scripts/proseSegments');
const md=fs.readFileSync('content/stories/practice-room-startup1.md','utf8');
const {segments,marked}=extractProse(md);
fs.writeFileSync('$SP/prs1-marked.txt', marked);
console.log('세그먼트', segments.length, '개 / 마커포함', marked.length, '자');
console.log(marked.length < 8000 ? 'fast 모드 가능 ✓' : 'strict 승급 — 분할 필요');
"
```
Expected: `fast 모드 가능 ✓`
※ 8,000자를 넘으면 마커 텍스트를 절반으로 나눠 두 번 호출하고, 각각 병합 검증한다.

- [ ] **Step 2: humanize-korean 실행**

스크래치패드를 cwd로 하여 `humanize-korean` 스킬을 fast 모드로 호출한다. 입력은 `$SP/prs1-marked.txt`.

**스킬에 반드시 전달할 지시:**
```
- <<<SEG:NNN>>> 형식의 마커 줄은 절대 수정·삭제·이동하지 마세요. 개수와 순서를 그대로 유지해야 합니다.
- 기준 문체는 "~습니다"입니다. "~해요" 구어체로 바꾸지 마세요.
- 숫자·금액·연도·고유명사·플러그인명·URL은 한 글자도 바꾸지 마세요.
- 장르: 전문 정보 칼럼 (음악 스튜디오 운영자가 쓴 실무 가이드)
```

Expected 산출: `_workspace/{run_id}/final.md` (스크래치패드 안), 등급 A~B, 변경률 5~30%

**게이트 5 판정 — 스킬이 출력한 등급·변경률을 보고 분기한다:**
- 등급 A~B & 변경률 5~30% → Step 3 진행
- 변경률 5% 미만 → 윤문이 사실상 일어나지 않았다. 탐지된 카테고리를 확인하고 재실행하거나, AI 티가 이미 없다고 판단되면 회고에 기록하고 진행
- 변경률 30% 초과 → 과윤문. 스킬의 자동 롤백 여부를 확인하고, 롤백되지 않았다면 **병합하지 않고** 재실행
- 등급 C 이하 → `--strict` 5인 파이프라인으로 재실행

- [ ] **Step 3: 병합 및 정합성 검사**

Run (마지막 인자에 실제 `final.md` 절대경로를 넣는다):
```bash
node -e "
const fs=require('fs');
const {mergeProse}=require('./scripts/proseSegments');
const p='content/stories/practice-room-startup1.md';
const md=fs.readFileSync(p,'utf8');
const rewritten=fs.readFileSync(process.argv[1],'utf8');
const merged=mergeProse(md, rewritten);   // 마커 불일치 시 여기서 throw
fs.writeFileSync(p, merged);
console.log('병합 완료 ✓');
" /private/tmp/claude-501/-Users-hwang-gyeongha-studio/547acec8-aa9d-4e1c-942b-2bc0c4e827cb/scratchpad/_workspace/<run_id>/final.md
```
Expected: `병합 완료 ✓`
※ throw가 나면 **본문을 쓰지 않고 중단**한다(스크립트가 `fs.writeFileSync` 전에 던지므로 파일은 그대로다). 마커 누락 id를 확인해 해당 세그먼트만 수동 반영한다.

- [ ] **Step 4: 구조 무결성 재확인**

Run: Task 5 Step 3과 동일한 명령
Expected: `구조 무결 ✓` (Task 5 이후 링크를 추가했다면 그 차이만)

- [ ] **Step 5: 사실 불변 확인**

Run:
```bash
git diff content/stories/practice-room-startup1.md | grep -E '^[+-]' | grep -oE '[0-9][0-9,]*\s*(만원|원|년|개월|시간|dB|kHz|Hz|%|실|명|회)' | sort | uniq -c | sort -rn
```
Expected: 추가(+)와 삭제(-) 양쪽의 숫자 토큰이 짝을 이룬다. 한쪽에만 있는 숫자는 윤문이 사실을 바꾼 것이므로 되돌린다.

- [ ] **Step 6: 커밋**

```bash
git add content/stories/practice-room-startup1.md
git commit -m "style(content): practice-room-startup1 산문 윤문

humanize-korean fast 모드. 산문 세그먼트만 추출·윤문·병합했고 프론트매터·
표·제목·디렉티브는 파이프라인에 넣지 않았다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Stage 3 — plugins1 윤문·병합

**Files:**
- Modify: `content/stories/plugins1.md`
- Temp: 스크래치패드 `pilot/` 하위

**Interfaces:**
- Consumes: Task 1의 `extractProse`/`mergeProse`, Task 6의 심화 본문
- Produces: 윤문된 본문

- [ ] **Step 1: 산문 추출 및 크기 확인**

Run:
```bash
SP=/private/tmp/claude-501/-Users-hwang-gyeongha-studio/547acec8-aa9d-4e1c-942b-2bc0c4e827cb/scratchpad/pilot
node -e "
const fs=require('fs');
const {extractProse}=require('./scripts/proseSegments');
const md=fs.readFileSync('content/stories/plugins1.md','utf8');
const {segments,marked}=extractProse(md);
fs.writeFileSync('$SP/plugins1-marked.txt', marked);
console.log('세그먼트', segments.length, '개 / 마커포함', marked.length, '자');
console.log(marked.length < 8000 ? 'fast 모드 가능 ✓' : 'strict 승급 — 분할 필요');
"
```
Expected: `fast 모드 가능 ✓`

- [ ] **Step 2: humanize-korean 실행**

Task 7 Step 2와 동일한 절차·**동일한 게이트 5 판정 규칙**(등급 A~B & 변경률 5~30%, 미달 시 재실행/strict 승급). 입력만 `$SP/plugins1-marked.txt`.

**스킬에 반드시 전달할 지시:**
```
- <<<SEG:NNN>>> 형식의 마커 줄은 절대 수정·삭제·이동하지 마세요. 개수와 순서를 그대로 유지해야 합니다.
- 기준 문체는 "~습니다"입니다. "~해요" 구어체로 바꾸지 마세요.
- 숫자·금액·연도·고유명사·플러그인명·URL은 한 글자도 바꾸지 마세요.
  특히 FabFilter Pro-Q 3, CLA-2A, CLA-76, Valhalla Room, Decapitator, EchoBoy, Melodyne 등
  제품명과 -3~5dB 같은 수치는 원문 그대로 유지해야 합니다.
- 장르: 전문 정보 칼럼 (음악 스튜디오 운영자가 쓴 실무 가이드)
```

- [ ] **Step 3: 병합 및 정합성 검사**

Run: Task 7 Step 3과 동일한 명령에서 경로만 `content/stories/plugins1.md`로 교체
Expected: `병합 완료 ✓`

- [ ] **Step 4: 구조 무결성 재확인**

Run: Task 6 Step 3과 동일한 명령
Expected: `구조 무결 ✓`

- [ ] **Step 5: 제품명 보존 확인**

Run:
```bash
git diff content/stories/plugins1.md | grep -E '^[+-]' | grep -oiE '(FabFilter|Pro-Q|Pro-DS|CLA-2A|CLA-76|Valhalla|Decapitator|EchoBoy|Melodyne|LA-2A|Soundtoys|Waves|ReaPlugs|Voxengo|TDR)[A-Za-z0-9 -]*' | sort | uniq -c
```
Expected: 각 제품명의 추가·삭제 횟수가 짝을 이룬다. 짝이 안 맞으면 제품명이 변조된 것이므로 되돌린다.

- [ ] **Step 6: 커밋**

```bash
git add content/stories/plugins1.md
git commit -m "style(content): plugins1 산문 윤문

humanize-korean fast 모드. 산문 세그먼트만 추출·윤문·병합했고 표·제품명·
수치는 파이프라인 밖에서 보존했다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Stage 4 — 전체 검증 게이트

**Files:**
- Create: `docs/story-quality-pilot/fact-trace.md`
- Read: `docs/story-quality-pilot/interview.md`, 수정된 두 스토리 파일

**Interfaces:**
- Consumes: Task 4의 답변, Task 5~8의 결과물
- Produces: `fact-trace.md` — 게이트 4 증빙. Task 10 회고의 입력.

- [ ] **Step 1: 게이트 1 — 콘텐츠 품질**

Run: `npm run content-check 2>&1 | grep -A5 -E 'practice-room-startup1|plugins1'`
Expected: 두 파일에 위반 없음. 위반 시 수정 후 재실행.

- [ ] **Step 2: 게이트 2 — 정본 사실·링크·CTR 타깃**

Run: `npx jest content/`
Expected: PASS (factGuards·ctrTargets·storyLinks·serviceBridge·epMakingConversion 전부)

- [ ] **Step 3: 게이트 3 — 구조 무결성 최종 확인 (두 파일 동시)**

Run:
```bash
node -e "
const fs=require('fs');
const {fingerprint,diffFingerprint}=require('./scripts/structureIntegrity');
const base=JSON.parse(fs.readFileSync('/private/tmp/claude-501/-Users-hwang-gyeongha-studio/547acec8-aa9d-4e1c-942b-2bc0c4e827cb/scratchpad/pilot/fingerprint-before.json','utf8'));
let bad=0;
for (const f of ['practice-room-startup1','plugins1']) {
  const d=diffFingerprint(base[f], fingerprint(fs.readFileSync('content/stories/'+f+'.md','utf8')));
  const fatal=d.filter(x=>/^(headings|directives|frontmatterKeys|tableRows|images)/.test(x));
  console.log(f+': '+(d.length===0?'무결 ✓':d.join(' | ')));
  bad += fatal.length;
}
console.log(bad===0 ? '치명적 구조 변경 없음 ✓' : '치명적 구조 변경 '+bad+'건 — 롤백 필요');
"
```
Expected: `치명적 구조 변경 없음 ✓`
※ `links` 차이만 허용된다(심화 중 의도적 내부링크 추가). 제목·디렉티브·프론트매터 키·표 행·이미지 차이는 롤백 대상이다.

- [ ] **Step 4: 게이트 5 — 윤문 지표 기록**

Task 7·8에서 humanize-korean이 출력한 등급·변경률·탐지 카테고리를 `docs/story-quality-pilot/retrospective.md`(Task 10에서 생성) 대신 임시로 메모해 둔다. Task 10 회고 표의 입력이다.

Expected: 두 파일 모두 등급 A~B, 변경률 5~30% 범위 안. 벗어났다면 Task 7/8의 게이트 5 분기를 이미 거쳤어야 하며, 예외 처리 사유를 회고에 적는다.

- [ ] **Step 5: 게이트 4 — 사실 출처 대조표 작성**

Create `docs/story-quality-pilot/fact-trace.md`:

```markdown
# 게이트 4 — 사실 출처 대조표 (2026-07-27)

심화로 **새로 들어간** 사실 주장을 한 건씩 인터뷰 답변에 매핑한다.
`출처` 열이 비면 그 문장은 근거가 없다는 뜻이므로 **본문에서 삭제한다.**

## practice-room-startup1.md

| # | 본문 주장 (발췌) | 줄 | 출처 (interview.md 문항) | 판정 |
|---|---|---|---|---|
| 1 | | | Q1 | ✅ |

## plugins1.md

| # | 본문 주장 (발췌) | 줄 | 출처 (interview.md 문항) | 판정 |
|---|---|---|---|---|
| 1 | | | Q7 | ✅ |

## 판정 요약

- 총 주장: N건 / 출처 있음: N건 / **출처 없어 삭제: N건**
- 목표: 출처 없음 0건
```

**작성 방법:** `git diff` 로 Task 5·6에서 추가된 줄만 뽑고, 그 안의 사실 주장(숫자·고유명사·사건)을 한 건씩 분해해 표에 넣는다. 답변에서 근거를 못 찾으면 판정을 ❌로 적고 **본문에서 그 문장을 지운 뒤** 판정을 "삭제 완료"로 갱신한다.

- [ ] **Step 6: 출처 없는 주장 0건 확인**

Run: `grep -c '❌' docs/story-quality-pilot/fact-trace.md`
Expected: `0`

- [ ] **Step 7: 게이트 6 — 빌드**

Run: `npm run build`
Expected: 성공. 두 스토리 페이지가 정적 생성됨.

- [ ] **Step 8: 게이트 6 — diff 육안 리뷰**

Run: `git diff ccab6f93fe..HEAD -- content/stories/practice-room-startup1.md content/stories/plugins1.md`

체크 항목: 문체가 "~습니다"로 일관한가 / 사실이 바뀐 곳이 없는가 / 볼드 라벨 병렬이 풀렸는가 / 링크가 살아 있는가

- [ ] **Step 9: 커밋**

```bash
git add docs/story-quality-pilot/fact-trace.md
git commit -m "docs(pilot): 게이트 4 사실 출처 대조표

심화로 추가된 사실 주장 전건을 인터뷰 답변에 매핑. 근거 없는 문장은
본문에서 삭제했다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Stage 5 — 회고 및 문서 갱신

**Files:**
- Create: `docs/story-quality-pilot/retrospective.md`
- Modify: `docs/content-guidelines.md`
- Modify: `docs/story-tier-flagship-2026-07.md`

**Interfaces:**
- Consumes: Task 1~9 전체 결과
- Produces: 확대 여부 판단 근거

- [ ] **Step 1: 회고 작성**

Create `docs/story-quality-pilot/retrospective.md`:

```markdown
# 파일럿 회고 (2026-07-27)

## 실측

| 항목 | practice-room-startup1 | plugins1 |
|---|---|---|
| 심화 순증 자수 | | |
| 윤문 세그먼트 수 | | |
| 윤문 변경률 | | |
| humanize 등급 | | |
| 인터뷰 문항 / 패스 | | |
| 게이트 실패 횟수 | | |

## 공정 평가

- 마커 병합이 한 번에 성공했는가:
- 윤문이 사실을 바꾼 적이 있는가:
- 인터뷰 왕복 횟수:
- 편당 실소요시간:

## F15 확대 판단

- 확대 권고: (예 / 아니오 / 조건부)
- 근거:
- 편당 예상 비용:
- 공정 수정 사항:
```

빈칸을 실측치로 채운다.

- [ ] **Step 2: content-guidelines.md 톤 규정 현실화**

Modify `docs/content-guidelines.md` §2 "글쓰기 톤 & 매너":

현재 "**금지**: "~합니다", "~것입니다"" 규정이 실물 1,576편과 정반대다. 아래로 교체한다:

```markdown
*   **어투 (2026-07-27 갱신)**:
    *   **기준**: "~습니다" 체. 스토리 1,576편이 이 문체이며 검색·전문성 맥락에 맞다.
    *   **금지**: 딱딱한 개조식·번역투("~하는 것이 필요하다", "~라고 할 수 있다"),
        볼드 라벨+콜론 병렬 5연속, 불릿 기계 나열.
    *   **권장**: "~습니다" 안에서 리듬을 살린다. 문장 길이를 섞고, 1인칭 경험을
        말할 때는 "~거든요", "~고요" 같은 어미를 섞어도 좋다.
    *   구어체 전면 전환("~해요")은 하지 않는다 — 기존 자산과 이질화된다.
```

- [ ] **Step 3: 티어 문서 글자수 정정**

Modify `docs/story-tier-flagship-2026-07.md`: `practice-room-startup1` 행의 글자수 `5,858`, `plugins1` 행의 `4,882`를 심화 후 실측치로 갱신하고, 두 행 "업그레이드 각도" 열에 `✅ 파일럿 완료(2026-07-27)`를 표기한다.

Run: `wc -c content/stories/practice-room-startup1.md content/stories/plugins1.md`

- [ ] **Step 4: 최종 확인**

Run: `npx jest content/ && npm run content-check --silent 2>&1 | tail -5`
Expected: 전부 통과

- [ ] **Step 5: 커밋**

```bash
git add docs/story-quality-pilot/retrospective.md docs/content-guidelines.md docs/story-tier-flagship-2026-07.md
git commit -m "docs(pilot): 회고 및 톤 가이드 현실화

가이드의 '~해요 권장 / ~습니다 금지' 규정이 실물 1,576편과 정반대였다.
'~습니다' 기준으로 정정하고, 티어 문서 글자수를 실측으로 갱신한다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 6: 확대 여부 사용자 확인**

회고의 "F15 확대 판단"을 사용자에게 제시하고, F15 나머지 13편 진행 여부를 확인받는다. **승인 없이 확대 실행하지 않는다.**

---

## 성공 기준 (스펙 §3 대응)

- [ ] 심화 사실 주장 100%가 인터뷰 답변에 출처를 가진다 — `fact-trace.md`의 ❌ 0건
- [ ] 구조 무결성 100% — `diffFingerprint` headings·directives·frontmatterKeys 차이 0
- [ ] 게이트 1(content-check)·2(jest)·6(build) 전부 통과
- [ ] humanize 등급 A~B, 변경률 5~30%
- [ ] 편당 소요시간·비용이 `retrospective.md`에 기록되어 확대 판단에 쓸 수 있다
