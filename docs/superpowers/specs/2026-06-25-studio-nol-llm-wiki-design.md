# Studio NOL 운영 지식 LLM Wiki — 설계

- **작성일**: 2026-06-25
- **작성자**: 황경하 (with Claude)
- **상태**: 승인됨 (구현 대기)
- **원전**: Andrej Karpathy, "LLM Wiki" (https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)

## 1. 배경과 목표

`docs/`에는 Studio NOL 운영 과정에서 쌓인 자료가 흩어져 있다 — SEO 진단 시리즈(`diagnosis-*.md`),
GA4/GSC raw CSV, `studio-nol-complete-guide.md`, 발매 프로젝트 기획, 콘텐츠 가이드라인, 믹싱 매뉴얼 등.
이 자료들은 매번 다시 찾아 읽어야 하고, 시간이 지나면 어떤 결정을 왜 내렸는지가 흐려진다.

Karpathy의 LLM Wiki 패턴을 적용해 "매번 검색(RAG)"이 아니라 **"한 번 컴파일하고 계속 최신 유지"**하는
운영 지식 베이스를 만든다. LLM이 raw 자료에서 핵심을 추출해 구조화된 위키로 합성·유지하고,
모순을 표시하며, 상호참조를 관리한다. 사람은 큐레이션·방향 설정·분석에 집중한다.

**비목표 (YAGNI)**: 자동 cron ingest, 벡터 임베딩/RAG 인프라, 웹 UI, 레포 외부 동기화. 모두 도입하지 않는다.

## 2. 아키텍처 — 3계층

```
docs/                          ← [계층 1] raw sources (불변, 진실의 원천)
  ├─ ga4-raw/, gsc-raw/        ← 그대로 둠
  ├─ diagnosis-*.md            ← 그대로 둠
  ├─ studio-nol-complete-guide.md, content-guidelines.md, ... ← 그대로 둠
  └─ wiki/                     ← [계층 2] wiki (LLM 소유) + [계층 3] schema
       ├─ WIKI.md              ← 계층 3: schema (구조·관례·ingest/query/lint 규칙)
       ├─ index.md             ← 콘텐츠 카탈로그 (카테고리별 페이지 목록 + 1줄 요약)
       ├─ log.md               ← append-only 활동 기록 (ingest/query/lint)
       ├─ entities/            ← 서비스·채널·프로젝트 페이지
       ├─ concepts/            ← SEO/GEO·키워드·가격·콘텐츠가이드·기술부채
       └─ decisions/           ← diagnosis 시계열을 합성한 의사결정 기록
```

**핵심 규칙**
- **raw는 절대 수정하지 않는다.** wiki는 읽기 전용으로 raw를 참조한다.
- wiki 페이지는 raw를 상대경로로 인용한다 (예: `../diagnosis-2026-05-21.md`, `../gsc-raw/page-query.csv`).
- 계층 2(wiki)는 전적으로 LLM이 소유한다. 사람이 직접 편집할 수 있으나, 그 변경도 schema 관례를 따른다.

## 3. wiki 페이지 구조

### 3.1 디렉토리 organization

- **entities/** — 고정 대상별 누적 페이지
  - 서비스: 녹음(보컬/악기), 믹싱, 마스터링, 연습실, 성우녹음, 프로듀싱 레슨
  - 채널: GSC, GA4, Naver Place, Naver Blog, LLM referrers
  - 프로젝트: 진행 중인 발매 건 등 (예: 마리코 & 유키에 《남산타워》)
- **concepts/** — 주제별 살아있는 지식
  - SEO 전략, GEO/AI 검색 전략, 키워드 클러스터, 가격/오퍼, 콘텐츠 가이드라인, 사이트 기술부채
- **decisions/** — "무엇을 / 왜 바꿨고 / 결과는" 형식의 의사결정 기록
  - `diagnosis-*.md` 시계열을 시간순 결정 흐름으로 합성

### 3.2 페이지 포맷

각 wiki 페이지 상단에 frontmatter:

```markdown
---
title: <페이지 제목>
type: entity | concept | decision
sources:                       # 이 페이지가 근거한 raw 파일들
  - ../diagnosis-2026-05-21.md
  - ../gsc-raw/page-query.csv
updated: 2026-06-25            # 마지막 갱신일
related:                       # 상호참조 (wiki 내부 페이지)
  - "[[concepts/seo-strategy]]"
---
```

본문에서 다른 wiki 페이지는 `[[entities/service-mixing]]` 형태의 wiki-link로,
raw 자료는 상대경로 마크다운 링크로 인용한다. 주장에는 가능한 한 출처를 단다.

### 3.3 index.md / log.md

- **index.md** — 콘텐츠 지향 카탈로그. 카테고리(entities/concepts/decisions)별로 모든 페이지를
  `- [[경로]] — 1줄 요약` 형식으로 나열. 위키 진입점.
- **log.md** — append-only 시간순 기록. 각 항목: 날짜 · 동작(ingest/query/lint) · 대상 · 영향받은 페이지 요약.

## 4. schema 문서 (WIKI.md)

`docs/wiki/WIKI.md`는 세 스킬의 단일 진실 원천이다. 다음을 명시한다:

1. 3계층 구조와 raw 불변 원칙
2. 디렉토리 organization 규칙 (3.1)
3. 페이지 frontmatter·wiki-link·인용 관례 (3.2)
4. index.md / log.md 갱신 규칙
5. ingest / query / lint 각 동작의 절차 (5장 요약을 규범 형태로)
6. Studio NOL 도메인 사실의 출처 원칙: 운영 사실은 `~/.claude` 메모리 및 CLAUDE.md와
   충돌하지 않아야 하며, 충돌 시 사람에게 표시(특히 서비스 범위·전화번호·엔티티 관계 등 민감 사실).

## 5. 세 가지 동작 (스킬)

Claude Code 스킬 3개로 구동한다. 셋 다 시작 시 `docs/wiki/WIKI.md`를 읽고 그 규칙을 따른다.

### 5.1 wiki-ingest
새 raw 자료를 **한 번에 1건씩** 처리한다.
1. 대상 raw 파일을 읽고 핵심 takeaway를 사용자와 짧게 논의/확인
2. 관련 기존 wiki 페이지를 찾아 갱신하거나, 없으면 신설 (organization 규칙 적용)
3. 기존 내용과 모순되면 **덮어쓰지 않고 표시**하여 사람 판단을 요청
4. index.md 갱신, log.md에 ingest 항목 추가
5. 영향받은 페이지의 frontmatter `updated`·`sources`·`related` 갱신

### 5.2 wiki-query
위키에 질문하고 답을 환류한다.
1. index.md → 관련 페이지 검색, 필요 시 raw까지 추적
2. 출처(wiki 페이지 + raw)를 인용해 답변 합성
3. 답변 과정에서 나온 **가치 있는 새 발견**은 적절한 페이지로 환류(신설/갱신)
4. 환류가 있었으면 index.md·log.md 갱신

### 5.3 wiki-lint
정기 건강검진. 변경 없이 리포트만 생성(수정은 사람 승인 후).
- 모순되는 주장, 낡은(stale) 주장, 고아 페이지(index 미등록·아무도 링크 안 함),
  끊긴 wiki-link/raw 경로, 누락된 상호참조를 점검
- 결과를 우선순위와 함께 보고, log.md에 lint 항목 추가

## 6. 부트스트랩 (seed)

스킬 작성 후, 기존 `docs/` 자료로 초기 위키를 채운다.
- `diagnosis-*.md` 시계열 → `decisions/`로 시간순 합성
- `studio-nol-complete-guide.md`, `content-guidelines.md` 등 → `concepts/`·`entities/`로 분해
- GA4/GSC raw, Naver 자료 → 해당 채널 `entities/` 페이지로 요약
- 부트스트랩 직후 `wiki-lint`로 일관성 점검

부트스트랩은 한 번에 다 하지 않고 자료군별로 나눠 ingest한다(검증 가능 단위).

## 7. 검증

LLM Wiki는 실행 코드가 아니라 워크플로우이므로 동작 검증 위주로 한다.
- **스킬 단위 검증**: 작성 직후 실제 raw 1건으로 `wiki-ingest` → 페이지/index/log가 규칙대로
  생성·갱신되는지 육안 확인
- **query 검증**: 알려진 사실 1개를 질문 → 올바른 출처 인용 + 정확한 답이 나오는지 확인
- **lint 검증**: 부트스트랩 직후 실행 → 의도적으로 남긴 불일치를 잡아내는지 확인
- **회귀**: 민감 사실(서비스 범위·전화번호·엔티티 관계)이 메모리/CLAUDE.md와 어긋나지 않는지 확인

## 8. 결정 요약

| 결정 | 선택 | 이유 |
|------|------|------|
| 위치 | `docs/wiki/`, raw는 현 위치 참조 | 기존 자산 무수정, 3계층과 정확히 일치 |
| 구동 | 스킬 3개 (ingest/query/lint) | 동작 성격이 달라 프롬프트가 깔끔, 기존 스킬 운영 흐름과 일치 |
| 페이지 축 | entities / concepts / decisions | raw 자료에서 자연 도출 |
| 도메인 | Studio NOL 운영 지식 (1순위) | 첫 위키는 단일 도메인으로 시작 |
