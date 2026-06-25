---
title: SEO 전략
type: concept
sources:
  - ../seo-backlink-strategy.md
  - ../seo-indexing-remediation.md
  - ../seo-content-calendar.md
  - ../seo-keyword-cluster-map.md
updated: 2026-06-25
related:
  - "[[concepts/keyword-clusters]]"
  - "[[concepts/content-guidelines]]"
  - "[[decisions/seo-ctr-optimization]]"
  - "[[entities/channel-llm-referrers]]"
---

# SEO 전략

스튜디오 놀 웹사이트의 검색 노출·색인 품질을 높이기 위한 전략 방향을 정리한다.
최신 데이터 기준일: 2026-04-24 (seo-indexing-remediation 스냅샷).

---

## 1. 콘텐츠 구조 — Pillar-Cluster 아키텍처

서비스 페이지를 **Pillar**로, 스토리 콘텐츠를 **Cluster**로 운영한다.
([../seo-keyword-cluster-map.md](../seo-keyword-cluster-map.md))

- **Pillar Page**: `/ko/pricing`, `/ko/practice-room`, `/ko/wedding-song`, `/ko/voice-acting`, `/ko/lesson`
- **Cluster Content**: `content/stories/` 산하 롱테일 스토리 페이지
- **내부 링크 규칙**: 모든 Cluster는 해당 Pillar Page로 링크 연결. 신규 스토리 발행 시 필수.

클러스터 완성 현황(2026-04-23 기준): A·B·C·D 그룹 **12개 HIGH·MED 키워드 갭 완전 해소**.
→ 세부 키워드별 커버 현황은 [[concepts/keyword-clusters]] 참조.

---

## 2. 색인 품질 개선 (GSC Crawled-not-indexed 대응)

**소스**: [../seo-indexing-remediation.md](../seo-indexing-remediation.md)

### 2.1 현황 스냅샷 (2026-04-22 기준)

| 버킷 | URL 수 | 상태 |
|---|---|---|
| NOINDEX 태그 제외 | 743 | 의도된 noindex (fallback 번역) |
| 크롤링됨·미색인 | 81 | 본 계획 핵심 타깃 |
| 발견됨·미색인 | 1,000 | fallback URL 대기 큐 |

### 2.2 Phase별 완료 현황 (2026-04-24)

| Phase | 내용 | 상태 |
|---|---|---|
| Phase -1 | hreflang·RSS fallback 차단 → 1,743 URL 크롤 낭비 제거 | ✅ 완료 |
| Phase 0 | 포트폴리오 productionNotes/credits 주입 (34개 × 7 locale = 100%), thin 게이트 1,500자 상향 | ✅ 완료 |
| Phase 1 | 비-KO locale 허브 USP 블록 추가, 언어 일관성 수정 | ✅ 완료 |
| Phase 2 | 믹싱 시리즈 pillar 허브 → 23편 역링크 연결 | ✅ 완료 |
| Phase 3 | `npm run audit:thin` 스크립트 — actionable thin 0건 확인 | ✅ 완료 |

### 2.3 잔여 리스크

- 비-KO locale 허브 색인율: Phase 1 완료 후 GSC 재확인 필요 (목표: 6/6)
- 포트폴리오 상세 색인율: 목표 60%+ (294페이지 중)
- 관련 미결 부채: [[decisions/seo-ctr-optimization]] 참조

---

## 3. 백링크 전략

**소스**: [../seo-backlink-strategy.md](../seo-backlink-strategy.md)

원칙: **유료 백링크 구매 금지** (구글 패널티 리스크). 자연스러운 관계 기반 획득.

### 3.1 즉시 실행 가능 채널

| 채널 | 방법 |
|---|---|
| 네이버 플레이스 | 비즈니스 콘솔 등록 (무료), NAP 일치 필수 |
| 구글 비즈니스 프로필 | Google Business 등록 (무료) |
| 카카오맵 | 카카오 플레이스 등록 (무료) |

NAP(Name·Address·Phone) 일치 필수: 네이버와 구글 기재 정보가 동일해야 함.
전화번호: **010-4255-7893** (0507 안심번호는 폐기됨 — 사용 금지).

### 3.2 콘텐츠 기반 링크 획득

- 인디 음악 미디어(인디포스트 등) 게스트 기고 → 기사 내 링크
- 결혼 정보 사이트/웨딩 커뮤니티 → 축가 녹음 가이드 기고
- 뮤지션 커뮤니티(뮬, 큐오넷) → Q&A 활동 + 프로필 링크
- 예식장·웨딩 플래너 파트너 상호 링크

### 3.3 6개월 목표

- 관련성 높은 외부 백링크 10개+
- 구글 비즈니스 리뷰 20개+
- 네이버 플레이스 후기 30개+

---

## 4. 기술 SEO 가드레일

- thin content 임계값: 본문 1,500자 미만 → `robots="noindex, follow"` 자동 적용
- sitemap: thin content, fallback 번역은 자동 제외 (`next-sitemap.config.js`)
- 301 redirect 신중 사용: 기존 외부 백링크 있는 페이지는 삭제 전 GSC 상위 링크 리포트 확인
- hreflang: 번역이 실제로 존재하는 locale에만 출력 (`availableLocales` 필드 기반)

---

## 5. KPI 트래킹

| 지표 | 측정 주기 | 참조 |
|---|---|---|
| GSC 크롤링·미색인 건수 | 2주 | Search Console Coverage |
| 비-KO locale 허브 색인율 | 2주 | GSC URL 검사 |
| 오가닉 주간 클릭수 | 주간 | GSC Performance |
| 타깃 키워드 상위 10위 수 | 월간 | GSC Queries |
| Thin content actionable 건수 | 빌드마다 | `npm run audit:thin` |

---

## 6. GEO / AI 검색

GEO(Generative Engine Optimization)는 ChatGPT, Perplexity, Gemini 등 생성형 AI 검색 엔진이 스튜디오 놀을 올바르게 인용·추천하도록 콘텐츠와 구조화 데이터를 최적화하는 SEO 전략의 확장 영역이다. LLM은 기존 키워드 매칭이 아닌 콘텐츠의 사실성·구조·문맥을 기반으로 정보를 인용하므로, FAQ형 콘텐츠·정의형 문장·명확한 서비스 범위 기술이 인용 품질에 직접 영향을 준다. 실제 LLM 유입 데이터와 플랫폼별 이탈률·시사점은 [[entities/channel-llm-referrers]]에 정리되어 있다.
