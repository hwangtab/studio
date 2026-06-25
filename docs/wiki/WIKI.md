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

```yaml
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
```

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
