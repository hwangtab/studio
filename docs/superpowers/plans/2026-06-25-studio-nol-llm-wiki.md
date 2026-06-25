# Studio NOL 운영 지식 LLM Wiki Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Karpathy의 LLM Wiki 패턴을 Studio NOL 운영 지식에 적용해, `docs/wiki/`에 LLM이 유지하는 위키 계층과 이를 구동하는 ingest/query/lint 스킬 3개를 구축한다.

**Architecture:** 3계층 — `docs/`의 기존 자료(raw, 불변) → `docs/wiki/`(LLM 소유 위키) → `docs/wiki/WIKI.md`(schema). 동작은 프로젝트 스킬 3개(`.claude/skills/wiki-ingest|wiki-query|wiki-lint`)로 구동하며, 세 스킬 모두 `WIKI.md`를 단일 진실 원천으로 읽는다.

**Tech Stack:** Markdown only. Claude Code 프로젝트 스킬(`.claude/skills/<name>/SKILL.md`, frontmatter `name`/`description`). 실행 코드·빌드 단계 없음.

## Global Constraints

- **raw 불변**: `docs/` 하위의 기존 파일(`diagnosis-*.md`, `ga4-raw/`, `gsc-raw/`, `*.md`, `*.csv` 등)은 절대 수정하지 않는다. wiki는 읽기 전용으로 참조한다.
- **위키 위치**: 모든 위키 산출물은 `docs/wiki/` 아래에만 생성한다.
- **스킬 위치**: 프로젝트 스킬은 `.claude/skills/<name>/SKILL.md`. frontmatter는 `name`(kebab-case)과 `description`만 필수.
- **인용 규칙**: wiki→raw는 상대경로 마크다운 링크(예: `../diagnosis-2026-05-21.md`), wiki→wiki는 `[[경로]]` wiki-link(확장자 없이, 예: `[[concepts/seo-strategy]]`).
- **frontmatter 키**: `title`, `type`(entity|concept|decision), `sources`(raw 경로 목록), `updated`(YYYY-MM-DD), `related`(wiki-link 목록).
- **민감 사실 가드**: 서비스 범위·전화번호·엔티티 관계 등은 `~/.claude` 메모리 및 `CLAUDE.md`와 충돌하면 덮어쓰지 말고 사람에게 표시한다.
- **날짜**: 모든 날짜는 절대 표기(YYYY-MM-DD). 부트스트랩 작업일은 2026-06-25.
- **언어**: 모든 위키·스킬 산출물은 한국어로 작성한다.
- **커밋 메시지 꼬리말**: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## File Structure

생성할 파일과 책임:

- `docs/wiki/WIKI.md` — schema. 3계층 원칙·organization·frontmatter/링크 관례·index/log 규칙·3동작 절차·민감 사실 가드.
- `docs/wiki/index.md` — 콘텐츠 카탈로그. 카테고리별 페이지 목록 + 1줄 요약.
- `docs/wiki/log.md` — append-only 활동 기록.
- `docs/wiki/entities/`, `docs/wiki/concepts/`, `docs/wiki/decisions/` — 위키 페이지 디렉토리(부트스트랩으로 채움).
- `.claude/skills/wiki-ingest/SKILL.md` — 새 raw 1건 흡수 동작.
- `.claude/skills/wiki-query/SKILL.md` — 질의+환류 동작.
- `.claude/skills/wiki-lint/SKILL.md` — 일관성 점검 동작.

검증은 실행 코드 테스트가 아니라 "스킬을 실제 자료에 돌려 산출물이 규칙대로 나오는지" 육안 확인으로 한다. 따라서 각 Task는 `산출물 작성 → 규칙 대조 검증 → 커밋` 사이클을 따른다.

---

### Task 1: 위키 골격 + schema(WIKI.md)

**Files:**
- Create: `docs/wiki/WIKI.md`
- Create: `docs/wiki/index.md`
- Create: `docs/wiki/log.md`
- Create: `docs/wiki/entities/.gitkeep`, `docs/wiki/concepts/.gitkeep`, `docs/wiki/decisions/.gitkeep`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: `WIKI.md`가 정의하는 규약 — 세 스킬(Task 2~4)이 이 문서를 읽고 따른다. organization(entities/concepts/decisions), frontmatter 키(`title`/`type`/`sources`/`updated`/`related`), 링크 규칙(wiki→raw 상대경로, wiki→wiki `[[...]]`), index.md·log.md 갱신 규칙.

- [ ] **Step 1: `docs/wiki/WIKI.md` 작성**

아래 내용을 그대로 작성한다:

```markdown
# WIKI.md — Studio NOL 운영 지식 위키 schema

이 문서는 `docs/wiki/` 위키의 **단일 진실 원천**이다. wiki-ingest / wiki-query / wiki-lint
스킬은 동작 시작 시 이 문서를 읽고 아래 규칙을 따른다.

## 1. 3계층 구조

- **계층 1 — raw sources**: `docs/` 하위 기존 자료(`diagnosis-*.md`, `ga4-raw/`, `gsc-raw/`,
  `studio-nol-complete-guide.md`, `*.csv` 등). **불변(read-only).** 절대 수정하지 않는다.
- **계층 2 — wiki**: `docs/wiki/` 하위 LLM이 유지하는 합성 markdown. 이 계층만 쓰기 대상.
- **계층 3 — schema**: 이 문서(`WIKI.md`).

## 2. 디렉토리 organization

- `entities/` — 고정 대상별 누적 페이지
  - 서비스(녹음/믹싱/마스터링/연습실/성우녹음/프로듀싱레슨), 채널(GSC/GA4/Naver Place/Naver Blog/LLM referrers), 진행 프로젝트
- `concepts/` — 주제별 살아있는 지식
  - SEO 전략, GEO/AI 검색, 키워드 클러스터, 가격/오퍼, 콘텐츠 가이드라인, 기술부채
- `decisions/` — "무엇을 / 왜 바꿨고 / 결과는" 형식의 의사결정 기록 (diagnosis 시계열 합성)
- 파일명은 kebab-case 영문(예: `entities/service-mixing.md`, `concepts/seo-strategy.md`).

## 3. 페이지 포맷

각 페이지 상단 frontmatter:

​```yaml
---
title: 페이지 제목
type: entity | concept | decision
sources:
  - ../diagnosis-2026-05-21.md
  - ../gsc-raw/page-query.csv
updated: 2026-06-25
related:
  - "[[concepts/seo-strategy]]"
---
​```

- wiki→raw 인용: 상대경로 마크다운 링크(`../diagnosis-2026-05-21.md`).
- wiki→wiki 인용: `[[경로]]` (확장자 없이, `docs/wiki/` 기준 상대경로. 예: `[[entities/service-mixing]]`).
- 주장에는 가능한 한 출처를 단다.

## 4. index.md / log.md

- `index.md` — 콘텐츠 카탈로그. 카테고리별로 `- [[경로]] — 1줄 요약`. 모든 페이지가 여기 등록되어야 한다.
- `log.md` — append-only. 항목 형식: `## YYYY-MM-DD · <ingest|query|lint> · <대상>` + 영향받은 페이지 불릿.

## 5. 동작 절차 (규범)

### ingest
1. 대상 raw 1건을 읽고 핵심 takeaway를 사람과 짧게 확인.
2. 관련 기존 페이지를 찾아 갱신, 없으면 organization 규칙대로 신설.
3. 기존 내용과 모순 시 **덮어쓰지 말고 표시**하여 사람 판단 요청.
4. 영향 페이지의 frontmatter(`updated`/`sources`/`related`) 갱신.
5. `index.md` 갱신, `log.md`에 ingest 항목 추가.

### query
1. `index.md`에서 관련 페이지 검색 → 필요 시 raw까지 추적.
2. 출처(wiki 페이지 + raw) 인용하여 답변 합성.
3. 답변 중 나온 가치 있는 새 발견은 적절한 페이지로 환류(신설/갱신).
4. 환류가 있었으면 `index.md`·`log.md` 갱신.

### lint
변경 없이 리포트만(수정은 사람 승인 후):
- 모순 주장, 낡은(stale) 주장, 고아 페이지(index 미등록·피링크 없음),
  끊긴 wiki-link/raw 경로, 누락된 상호참조를 점검.
- 우선순위와 함께 보고, `log.md`에 lint 항목 추가.

## 6. 민감 사실 가드

서비스 범위·전화번호·엔티티 관계(Studio NOL ↔ kosmart) 등은 `~/.claude` 메모리 및
프로젝트 `CLAUDE.md`가 우선한다. 위키 작성 중 이들과 충돌하는 raw 내용을 만나면
덮어쓰지 말고 페이지에 `<!-- 확인 필요: ... -->`로 표시하고 사람에게 알린다.
```

주의: 위 블록 안의 `​```yaml` 펜스는 실제 파일에서는 백틱 3개로 쓴다(여기서는 중첩 표시를 위해 zero-width 문자가 섞여 있을 수 있으니, 작성 시 정상 백틱으로 교정한다).

- [ ] **Step 2: `docs/wiki/index.md` 작성 (빈 골격)**

```markdown
# Studio NOL 운영 지식 위키 — Index

> 콘텐츠 카탈로그. 모든 위키 페이지를 카테고리별로 등록한다. 규칙은 [WIKI.md](WIKI.md) 참조.

## Entities
(아직 없음)

## Concepts
(아직 없음)

## Decisions
(아직 없음)
```

- [ ] **Step 3: `docs/wiki/log.md` 작성 (빈 골격)**

```markdown
# 위키 활동 로그

> append-only. 형식: `## YYYY-MM-DD · <ingest|query|lint> · <대상>` + 영향받은 페이지 불릿.

## 2026-06-25 · setup · 위키 골격 생성
- WIKI.md / index.md / log.md / entities,concepts,decisions 디렉토리 생성
```

- [ ] **Step 4: 디렉토리 placeholder 생성**

Run:
```bash
mkdir -p docs/wiki/entities docs/wiki/concepts docs/wiki/decisions
touch docs/wiki/entities/.gitkeep docs/wiki/concepts/.gitkeep docs/wiki/decisions/.gitkeep
```

- [ ] **Step 5: 검증 — 구조와 규칙 대조**

Run:
```bash
ls -R docs/wiki
grep -c "## " docs/wiki/WIKI.md
```
Expected: `WIKI.md`, `index.md`, `log.md`와 세 디렉토리(.gitkeep 포함)가 보이고, `WIKI.md`에 6개 이상의 `## ` 섹션이 존재.
또한 `WIKI.md` 안의 yaml 예시 펜스가 정상 백틱 3개인지 육안 확인(Step 1 주의 사항).

- [ ] **Step 6: 커밋**

```bash
git add docs/wiki/
git commit -m "feat(wiki): 위키 골격 + schema(WIKI.md) 생성

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: wiki-ingest 스킬

**Files:**
- Create: `.claude/skills/wiki-ingest/SKILL.md`

**Interfaces:**
- Consumes: `docs/wiki/WIKI.md`의 규약(Task 1).
- Produces: `wiki-ingest` 스킬. 사용자가 "이 자료 위키에 흡수해줘" / `/wiki-ingest <경로>`로 호출.

- [ ] **Step 1: `.claude/skills/wiki-ingest/SKILL.md` 작성**

```markdown
---
name: wiki-ingest
description: "Studio NOL 운영 지식 위키(docs/wiki/)에 새 raw 자료를 한 건씩 흡수(ingest)할 때 사용. 사용자가 'wiki에 흡수', '위키에 정리해줘', 'ingest', '이 자료 위키에 넣어줘', 'docs/wiki 갱신'을 언급하거나 docs/ 자료를 주며 위키화를 요청하면 사용."
metadata:
  version: 1.0.0
---

# wiki-ingest — 운영 지식 위키 흡수

Karpathy LLM Wiki 패턴의 ingest 동작. raw 자료에서 핵심을 추출해 `docs/wiki/` 위키로 합성한다.

## 시작 전 필수
1. `docs/wiki/WIKI.md`를 읽는다. 아래 절차는 그 schema를 따른다.
2. raw 자료(`docs/` 하위)는 **읽기 전용**. 절대 수정하지 않는다.

## 절차 (한 번에 raw 1건)
1. **대상 확정**: 사용자가 준 경로(또는 "다음 미흡수 자료")의 raw 1건을 읽는다.
2. **takeaway 확인**: 핵심 3~6줄을 사용자에게 제시하고 위키화 방향을 짧게 합의한다.
3. **배치 결정**: WIKI.md organization에 따라 entities/concepts/decisions 중 어디에,
   기존 페이지 갱신인지 신설인지 정한다. (diagnosis 류는 decisions/)
4. **작성**:
   - 신설 시 frontmatter(`title`/`type`/`sources`/`updated`/`related`) 포함.
   - raw는 상대경로 링크(`../파일`), wiki는 `[[경로]]`로 인용. 주장에 출처를 단다.
   - 기존 내용과 **모순**되면 덮어쓰지 말고 `<!-- 확인 필요: ... -->`로 표시하고 사용자에게 알린다.
   - 민감 사실(서비스 범위·전화번호·엔티티 관계)은 `~/.claude` 메모리·`CLAUDE.md` 우선. 충돌 시 표시.
5. **frontmatter 갱신**: 영향 페이지의 `updated`(오늘 날짜)·`sources`·`related` 갱신.
6. **index/log 갱신**: `docs/wiki/index.md`에 신설 페이지 등록, `docs/wiki/log.md`에
   `## YYYY-MM-DD · ingest · <대상>` 항목과 영향 페이지 불릿 추가.
7. **요약 보고**: 무엇을 어디에 어떻게 반영했는지, 모순/확인필요 항목이 있으면 함께 보고.

## 하지 말 것
- raw 수정, 여러 자료 동시 흡수(혼선), 출처 없는 단정, 모순 자동 덮어쓰기.
```

- [ ] **Step 2: 검증 — 스킬 인식 및 규칙 정합성**

Run:
```bash
test -f .claude/skills/wiki-ingest/SKILL.md && head -5 .claude/skills/wiki-ingest/SKILL.md
```
Expected: 파일 존재, frontmatter에 `name: wiki-ingest`와 `description` 존재.
육안 확인: 절차가 WIKI.md 5장(ingest)과 일치하고, raw 불변·모순 표시·index/log 갱신이 모두 포함됐는지.

- [ ] **Step 3: 커밋**

```bash
git add .claude/skills/wiki-ingest/
git commit -m "feat(wiki): wiki-ingest 스킬 추가

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: wiki-query 스킬

**Files:**
- Create: `.claude/skills/wiki-query/SKILL.md`

**Interfaces:**
- Consumes: `docs/wiki/WIKI.md` 규약, `index.md`(Task 1), ingest로 채워진 페이지(Task 5).
- Produces: `wiki-query` 스킬. "위키에 물어봐" / `/wiki-query <질문>`로 호출.

- [ ] **Step 1: `.claude/skills/wiki-query/SKILL.md` 작성**

```markdown
---
name: wiki-query
description: "Studio NOL 운영 지식 위키(docs/wiki/)에 질문해 출처 인용 답변을 받고, 가치 있는 발견을 위키로 환류할 때 사용. 사용자가 '위키에 물어봐', 'wiki query', '위키에서 찾아줘', '운영 지식 위키 기준으로 답해줘'를 언급하면 사용."
metadata:
  version: 1.0.0
---

# wiki-query — 운영 지식 위키 질의 + 환류

Karpathy LLM Wiki 패턴의 query 동작. 위키에서 답을 합성하고, 새 발견을 위키로 되돌린다.

## 시작 전 필수
1. `docs/wiki/WIKI.md`를 읽는다.
2. `docs/wiki/index.md`를 읽어 어떤 페이지가 있는지 파악한다.

## 절차
1. **검색**: index.md → 관련 페이지를 읽는다. 위키로 부족하면 페이지의 `sources` raw까지 추적한다.
2. **답변 합성**: 결론을 먼저, 그 뒤 근거. 사용한 **wiki 페이지와 raw를 모두 인용**한다.
   위키에 근거가 없으면 "위키 미수록"이라고 명시하고 추정과 사실을 구분한다.
3. **환류 판단**: 답변 과정에서 나온, 재사용 가치가 있는 새 사실/결론이 있으면
   적절한 페이지에 반영(WIKI.md organization·포맷 준수)하거나 신설한다.
   - 민감 사실은 `~/.claude` 메모리·`CLAUDE.md` 우선, 충돌 시 표시.
4. **index/log 갱신**: 환류가 있었으면 `index.md` 갱신, `log.md`에
   `## YYYY-MM-DD · query · <질문 요지>` + 환류한 페이지 불릿 추가. 환류 없으면 log만 선택적.

## 하지 말 것
- 출처 없는 단정, raw 수정, 위키에 없는 내용을 위키 근거인 것처럼 제시.
```

- [ ] **Step 2: 검증**

Run:
```bash
test -f .claude/skills/wiki-query/SKILL.md && head -5 .claude/skills/wiki-query/SKILL.md
```
Expected: 파일 존재, `name: wiki-query` frontmatter. 육안: WIKI.md 5장(query)과 절차 일치, 인용·환류·index/log 포함.

- [ ] **Step 3: 커밋**

```bash
git add .claude/skills/wiki-query/
git commit -m "feat(wiki): wiki-query 스킬 추가

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: wiki-lint 스킬

**Files:**
- Create: `.claude/skills/wiki-lint/SKILL.md`

**Interfaces:**
- Consumes: `docs/wiki/WIKI.md` 규약, 위키 전체(Task 1·5).
- Produces: `wiki-lint` 스킬. "위키 점검" / `/wiki-lint`로 호출. 리포트만 생성, 수정은 사람 승인 후.

- [ ] **Step 1: `.claude/skills/wiki-lint/SKILL.md` 작성**

```markdown
---
name: wiki-lint
description: "Studio NOL 운영 지식 위키(docs/wiki/)의 일관성을 점검(lint)할 때 사용. 사용자가 '위키 점검', 'wiki lint', '위키 건강검진', '위키 모순/끊긴 링크 확인', '고아 페이지 찾아줘'를 언급하면 사용."
metadata:
  version: 1.0.0
---

# wiki-lint — 운영 지식 위키 건강검진

Karpathy LLM Wiki 패턴의 lint 동작. **변경 없이 리포트만** 생성한다(수정은 사람 승인 후).

## 시작 전 필수
1. `docs/wiki/WIKI.md`를 읽는다.
2. `docs/wiki/` 전체(index.md, log.md, entities/concepts/decisions/*)를 훑는다.

## 점검 항목
1. **모순**: 서로 다른 페이지가 같은 사실을 다르게 주장.
2. **낡음(stale)**: `updated`가 오래됐거나, 더 최신 raw가 있는데 반영 안 됨.
3. **고아 페이지**: index.md에 미등록이거나, 어떤 페이지에서도 `[[...]]`로 링크되지 않음.
4. **끊긴 링크**: `[[wiki-link]]` 대상 페이지 부재, 또는 raw 상대경로가 실제 파일과 불일치.
5. **누락 상호참조**: 명백히 관련된 두 페이지가 서로 `related`/`[[...]]`로 연결 안 됨.
6. **포맷 위반**: frontmatter 필수 키 누락, organization 규칙 위반 배치.
7. **민감 사실 충돌**: 서비스 범위·전화번호·엔티티 관계가 메모리/CLAUDE.md와 불일치.

## 출력
- 항목별로 우선순위(높음/보통/낮음)와 위치(파일·페이지), 권장 조치를 표 또는 불릿으로 보고.
- `docs/wiki/log.md`에 `## YYYY-MM-DD · lint · 전체` + 발견 요약 불릿 추가.
- 사용자가 승인하면 그때 수정한다(승인 전 위키 변경 금지).
```

- [ ] **Step 2: 검증**

Run:
```bash
test -f .claude/skills/wiki-lint/SKILL.md && head -5 .claude/skills/wiki-lint/SKILL.md
```
Expected: 파일 존재, `name: wiki-lint` frontmatter. 육안: 7개 점검 항목 + "변경 없이 리포트만" 원칙 포함.

- [ ] **Step 3: 커밋**

```bash
git add .claude/skills/wiki-lint/
git commit -m "feat(wiki): wiki-lint 스킬 추가

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: 부트스트랩 — 기존 자료 seed

세 스킬이 갖춰졌으니 `wiki-ingest`로 기존 `docs/` 자료를 자료군별로 흡수해 초기 위키를 채운다.
**한 번에 다 하지 않고 자료군별로 나눠** 진행하며, 각 군마다 커밋한다.

**Files:**
- Create (ingest 산출): `docs/wiki/decisions/*.md`, `docs/wiki/concepts/*.md`, `docs/wiki/entities/*.md`
- Modify: `docs/wiki/index.md`, `docs/wiki/log.md`

**Interfaces:**
- Consumes: Task 2(wiki-ingest), WIKI.md 규약.
- Produces: 채워진 위키. Task 6(검증)이 이를 대상으로 lint/query.

- [ ] **Step 1: 자료군 A — diagnosis 시계열 → decisions/**

`wiki-ingest`를 사용해 `docs/diagnosis-2026-05-18.md`, `-05-21`, `-05-27`, `-05-31`,
`-06-16-contact-form.md`를 시간순으로 흡수. "무엇을 왜 바꿨고 결과는" 형식으로 `decisions/`에 합성.
각 페이지 frontmatter `sources`에 해당 diagnosis 경로를 단다.

- [ ] **Step 2: 자료군 A 커밋**

```bash
git add docs/wiki/
git commit -m "feat(wiki): diagnosis 시계열 → decisions/ 부트스트랩

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 3: 자료군 B — 가이드/전략 문서 → concepts/ · entities/**

`wiki-ingest`로 `docs/studio-nol-complete-guide.md`, `content-guidelines.md`,
`seo-keyword-cluster-map.md`, `seo-backlink-strategy.md`, `seo-content-calendar.md`,
`seo-indexing-remediation.md`, `marketing_strategies.md`, `revenue_growth_strategies.md`,
`naver-place-optimization.md`를 흡수. SEO/GEO·키워드·가격·콘텐츠가이드는 `concepts/`,
서비스/채널 성격은 `entities/`로 분해.

- [ ] **Step 4: 자료군 B 커밋**

```bash
git add docs/wiki/
git commit -m "feat(wiki): 가이드/전략 문서 → concepts·entities 부트스트랩

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5: 자료군 C — 채널 raw 데이터 → entities/ 채널 페이지**

`wiki-ingest`로 `docs/ga4-raw/*.csv`, `docs/gsc-raw/*.csv`, `docs/naver-smartplace/`,
`docs/naver-blog/`를 채널별로 요약. `entities/channel-ga4.md`, `entities/channel-gsc.md`,
`entities/channel-naver-place.md`, `entities/channel-naver-blog.md`,
`entities/channel-llm-referrers.md`(llm_referrers.csv 근거)로 합성.
원수치는 raw 링크로 가리키고, 위키엔 해석·추세·시사점을 적는다.

- [ ] **Step 6: 자료군 C 커밋**

```bash
git add docs/wiki/
git commit -m "feat(wiki): 채널 raw 데이터 → entities 채널 페이지 부트스트랩

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 7: 자료군 D — 진행 프로젝트 → entities/ 프로젝트 페이지**

`wiki-ingest`로 `docs/2026-05-28-발매프로젝트-재포지셔닝-기획.md` 및 관련 발매 자료를
`entities/project-*.md`로 합성. `~/.claude` 메모리의 "발매 프로젝트 재포지셔닝(Path B)",
"고객 vs 프로듀서 이력 구분" 규칙과 충돌 없는지 확인하며 작성.

- [ ] **Step 8: 자료군 D 커밋**

```bash
git add docs/wiki/
git commit -m "feat(wiki): 진행 프로젝트 → entities 프로젝트 페이지 부트스트랩

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

주의: `오디오 믹싱 메뉴얼.md`(~1MB)와 `musician_manual/`은 운영 지식이라기보다 제작 레퍼런스이므로
1순위 부트스트랩에서 제외한다(YAGNI). 필요 시 후속 ingest로 처리.

---

### Task 6: 통합 검증

**Files:**
- Modify: `docs/wiki/log.md` (lint/query 기록)

**Interfaces:**
- Consumes: Task 3(query), Task 4(lint), Task 5 산출 위키.
- Produces: 검증 리포트(대화) + log 기록. 회귀 확인.

- [ ] **Step 1: lint 실행**

`wiki-lint`를 실행한다. 부트스트랩 직후 고아 페이지·끊긴 링크·index 누락·모순이 없는지 점검.
발견된 항목은 사용자 승인 후 수정한다.

Run (보조 확인):
```bash
# 모든 페이지가 index에 등록됐는지 대략 확인
ls docs/wiki/entities docs/wiki/concepts docs/wiki/decisions
grep -o "\[\[[^]]*\]\]" docs/wiki/index.md | sort -u
```
Expected: 각 디렉토리의 페이지 수와 index 등록 wiki-link 수가 대응.

- [ ] **Step 2: query 검증 (알려진 사실)**

`wiki-query`로 검증용 질문 1개를 던진다. 예: "Studio NOL의 서비스 범위는?" →
답이 메모리 규칙(보컬/악기 녹음·믹싱/마스터링·연습실·성우녹음·프로듀싱레슨, 보컬/악기 레슨 없음)과
일치하고, wiki 페이지+raw 출처를 인용하는지 확인.

- [ ] **Step 3: 민감 사실 회귀 확인**

Run:
```bash
grep -rn "0507\|보컬 레슨\|악기 레슨\|영어 엔지니어" docs/wiki/ || echo "OK: 금지 사실 미발견"
grep -rn "010-4255-7893" docs/wiki/ | head
```
Expected: 폐기된 0507 안심번호·없는 서비스(보컬/악기 레슨, 영어 엔지니어)가 위키에 없고,
전화번호가 등장한다면 010-4255-7893만 사용.

- [ ] **Step 4: log에 검증 기록 + 최종 커밋**

`docs/wiki/log.md`에 `## 2026-06-25 · lint · 전체`와 `## 2026-06-25 · query · 검증` 기록 추가 후:

```bash
git add docs/wiki/
git commit -m "test(wiki): 부트스트랩 후 lint·query 검증 및 로그 기록

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- 3계층 아키텍처 → Task 1(WIKI.md), Global Constraints.
- 페이지 organization(entities/concepts/decisions) → Task 1·5.
- frontmatter/링크 관례 → Task 1(WIKI.md), Global Constraints.
- index.md/log.md → Task 1 생성, Task 2~6 갱신.
- 스킬 3개(ingest/query/lint) → Task 2·3·4.
- 부트스트랩(자료군별) → Task 5.
- 검증(스킬 단위·query·lint·민감 사실 회귀) → 각 Task Step + Task 6.
- 민감 사실 가드 → WIKI.md 6장, 각 스킬, Task 6 Step 3.
- YAGNI(믹싱 매뉴얼·musician_manual 제외) → Task 5 주의.
누락 없음.

**Placeholder scan:** 각 스킬 SKILL.md·WIKI.md·index/log 전문을 그대로 수록. "TBD/적절히 처리" 없음.
(부트스트랩 Task 5는 본질적으로 스킬을 자료에 적용하는 실행 단계라 산출 파일명을 규칙으로 명시 — 실제 페이지 내용은 ingest 시점에 raw에서 생성됨.)

**Type consistency:** frontmatter 키(`title`/`type`/`sources`/`updated`/`related`), 동작명(ingest/query/lint),
링크 규칙(wiki→raw 상대경로, wiki→wiki `[[...]]`), 디렉토리명(entities/concepts/decisions)이 spec·WIKI.md·세 스킬·부트스트랩 전체에서 일관.
