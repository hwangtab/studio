# GSC 색인 품질 개선 계획 — Crawled-not-indexed 대응

**작성일**: 2026-04-22
**소스**: Google Search Console Coverage Drilldown (2026-04-22) 6개 리포트
**대상 이슈**: "크롤링됨 - 현재 색인이 생성되지 않음" 81건 + 연계된 색인 낭비 ~2,824건
**상태**: Phase -1(hreflang·RSS 필터) 완료 · Phase 0 이하 착수 대기

---

## 1. 요약 (TL;DR)

- Google Search Console 6개 리포트를 분석한 결과, `studionol.co.kr`의 색인 손실·낭비는 **크게 두 층위**로 나뉨.
  1. **hreflang·RSS로 인한 크롤 예산 누수** (1,743건) — 선행 커밋에서 원인 차단 완료.
  2. **콘텐츠 품질·중복 시그널로 인한 미색인** (81건) — 본 문서에서 단계별로 해결.
- 81건을 파일 단위로 검증한 결과 **포트폴리오 상세 페이지의 thin content**(20~50단어)와 **비-한국어 locale 허브 미색인**(`/es`, `/zh`, `/vi` 등)이 가장 큰 리스크.
- 가장 높은 ROI는 **포트폴리오 스키마 확장 + thin-content 자동 게이트**. 단일 스키마 변경으로 42개 포트폴리오 × 7개 locale = **최대 294개** 페이지의 색인 잠재력 회복 가능.

---

## 2. 현황 — 6개 GSC 리포트 Drilldown

### 2.1 전체 이슈 분포

| 버킷 | URL 수 | GSC 라벨 |
|---|---|---|
| 리다이렉트 포함 페이지 | 22 | 정상 (HTTPS/슬래시 정규화) |
| 404 Not Found | 2 | 레거시 `/[locale]/about`, `/[locale]/stories` |
| NOINDEX 태그로 제외 | **743** | fallback 번역 페이지 (의도된 noindex) |
| 크롤링됨·현재 색인 안 됨 | **81** | 본 문서의 핵심 타깃 |
| 서버 오류(5xx) | 9 | 2026-02-09 전후 단발성, 현재는 정상 |
| 발견됨·현재 색인 안 됨 | **1,000** | fallback 번역 URL 대기 큐 |

### 2.2 선행 조치 완료 (2026-04-22 커밋)

`/ko/stories/xyz1` 원본 페이지가 네이티브 번역이 없는 locale에도 `<link rel="alternate" hreflang="...">`를 방출 → Google이 hreflang 따라가 fallback 페이지 크롤 → `noindex` 수신 → 크롤 예산 낭비. RSS와 `llms-full.txt`도 같은 식으로 fallback URL을 외부에 유포.

**적용된 수정**

- [lib/stories.ts](../lib/stories.ts) — `getStoryAvailableLocales(slug)` 헬퍼 추가, `StoryDetail.availableLocales` 필드 주입.
- [types/story.ts](../types/story.ts) — `availableLocales: Locale[]` 필드 추가.
- [components/SEO.tsx](../components/SEO.tsx) — `availableLocales` prop으로 hreflang 출력 제한.
- [pages/[locale]/stories/[id].tsx](../pages/[locale]/stories/[id].tsx) — story 상세 페이지에서 prop 전달.
- [pages/api/rss.ts](../pages/api/rss.ts) — 비-KO RSS 피드는 네이티브 번역 있는 스토리만 포함.
- [pages/api/llms-full.ts](../pages/api/llms-full.ts) — AI 크롤러용 인덱스 동일 필터.

**기대 효과**: NOINDEX 제외 743건 + 발견·미크롤링 1,000건 합계 **1,743건**의 크롤 예산 회수.

---

## 3. 81건 "크롤링됨·현재 색인 안 됨" 원인 분석

### 3.1 버킷별 분류 (실제 파일 검증 완료)

| 버킷 | 건수 | 검증 근거 | 판정 |
|---|---|---|---|
| **A. 포트폴리오 상세(초박형)** | ~17 | [data/portfolio.ts:603](../data/portfolio.ts#L603) `description: "Recording, Mixing, Mastering"` — 9단어. [pages/[locale]/portfolio/[id].tsx](../pages/[locale]/portfolio/[id].tsx)는 그 줄만 렌더 | **thin content 확정** |
| **B. 믹싱 시리즈 포화** | ~25 | `mixing1.md` ~ `mixing23.md` 각 6~9KB(~1,000단어). 품질은 OK지만 동일 카테고리 23편 병렬 존재 | keyword cannibalization |
| **C. 이벤트·인터뷰 중복성** | ~10 | `bulgwang-mixing-club` 1st(5KB) / 2nd(24KB) / 3rd(24KB) 3편 유사 구조. `interview1.md` 47KB — 단일 글로는 과도하게 길어 search intent 불명 | template 유사성 |
| **D. 비-KO locale 허브 미색인** ⚠️ | ~7 | `/es`, `/zh`, `/vi`, `/zh/about`, `/zh/lesson`, `/th/pricing`, `/th/studio-info`. [public/locales/en/common.json](../public/locales/en/common.json) 40KB vs KO 94KB (≈43%) | **최고 위험** |
| **E. 즉시 해소/무관** | 나머지 | `done1.md`는 이미 `robots: "noindex"` 설정됨. `/api/rss?locale=en`은 API 엔드포인트 | 조치 불필요 |

### 3.2 파일 레벨 근거 (발췌)

**A. 포트폴리오 thin 증거**
```ts
// data/portfolio.ts:601-614
{
  "id": "balkwaehan-cm-song",
  "title": "<발쾌한> CM송",
  "description": t(locale, { ko: "레코딩, 믹싱, 마스터링", en: "Recording, Mixing, Mastering", ... }),
  "image": "/images/portfolio6.jpg",
  "category": "commercial",
  "services": [ getService(services.recording), getService(services.mixing), getService(services.mastering) ],
  "artist": "발쾌한"
}
```
- 본문 전체 단어 수 ≈ 15~30단어 × 42개 포트폴리오 항목 × 7개 locale = **최대 294개 near-duplicate 페이지**.

**B. 믹싱 시리즈 포화**
```
mixing1  6,607B  "믹싱이란? 초보자를 위한 과정·준비물·워크플로 | 믹싱 강좌 1부"
mixing5  6,803B  "디지털 클리핑·지터·그라운드 노이즈 방지 완벽 가이드 | 믹싱 강좌 5부"
mixing14 9,578B  "믹싱 볼륨 밸런스 맞추는 법·페이더 설정 순서 | 믹싱 강좌 14부"
...
mixing22 6,959B  "오토메이션 사용법·볼륨/팬 라이딩·믹스 다이나믹 | 믹싱 강좌 22부"
```
- 각 편 단독 품질은 양호하나 허브(pillar) 없이 23편이 평행 배치 → Google은 대표 페이지를 고르지 못하고 보류.

**C. 이벤트 중복**
```
bulgwang-mixing-club       5,016B  "불광·연신내 뮤지션 "불광믹싱클럽" 첫 모임 안내"
bulgwang-mixing-club-2nd  24,398B  두 번째 모임 안내
bulgwang-mixing-club-3rd  24,112B  세 번째 모임 안내
```
- 1st는 thin, 2nd/3rd는 동일 템플릿·동일 해시태그 반복.

**D. locale 허브 리소스 격차**
```
ko 94,536B  (기준)
en 40,988B  (43%)
zh 38,238B  (40%)
es 42,543B  (45%)
vi 45,461B  (48%)
th 70,167B  (74%)
uz 42,395B  (45%)
```
- 비-KO 허브는 i18n 키 번역만 있을 뿐 locale 고유 가치 제안(증언·지역 사례·결제 안내 등) 부재.

---

## 4. 개선 계획 — 4단계 로드맵

### Phase 0 — 즉시 (1~2일, 코드 중심)

목표: **A 버킷 42개 포트폴리오 × 7 locale = 최대 294페이지 색인 회복 가능성 확보**

#### 0.1 포트폴리오 데이터 스키마 확장
- 파일: [data/portfolio.ts](../data/portfolio.ts)
- 추가 필드(모두 선택적으로, 점진적 채움):
  ```ts
  productionNotes?: LocaleMap;  // 3~5문단, 아티스트·녹음·믹싱·마스터링 의사결정 서술
  credits?: {                   // 크레딧 블록
    engineer?: string;
    musicians?: string[];
    gear?: string[];
  };
  releaseDate?: string;         // ISO 8601
  label?: string;
  trackList?: { no: number; title: string; duration?: string }[];
  ```
- 기존 `description`은 그대로 두고, `productionNotes`가 렌더 본문의 주체가 되도록 전환.

#### 0.2 포트폴리오 상세 페이지 개편
- 파일: [pages/[locale]/portfolio/[id].tsx](../pages/[locale]/portfolio/[id].tsx)
- 렌더 구조:
  1. Hero(기존)
  2. 프로덕션 노트(`productionNotes`) — 본문 3~5문단
  3. 크레딧 테이블(`credits`)
  4. 관련 포트폴리오(카테고리·아티스트 기준)
  5. CTA(녹음 문의)
- [utils/schemaGenerator.ts](../utils/schemaGenerator.ts)에 `MusicRecording` 또는 `CreativeWork` JSON-LD 추가.
- thin content 자동 게이트: 렌더 본문이 1,500자 미만이면 `robots="noindex, follow"`로 자동 전환.

#### 0.3 Thin-content 게이트 상향
- 파일: [lib/stories.ts:324](../lib/stories.ts#L324)
- 변경: `const isThinContent = rawNonWhitespace + shortcodeBonus < 1000;` → `< 1500`
- 이유: 현재 1,000자 기준은 느슨. 실제로 "크롤링·미색인" 바구니에 들어간 `bulgwang-mixing-club`(5,016B ≈ 1,700자)는 간신히 통과했지만 Google은 거르는 중 — 기준 상향으로 사전 차단.

#### 0.4 RSS 응답에 X-Robots-Tag 명시
- 파일: [pages/api/rss.ts](../pages/api/rss.ts)
- `res.setHeader('X-Robots-Tag', 'noindex');` 추가
- 이유: GSC 리포트에 `/api/rss?locale=en`이 계속 노출되는 것 방지(현재는 내용상 indexable로 오해됨).

### Phase 1 — 허브 회복 (1~2주)

목표: **D 버킷 7개 locale 허브 색인 복구 — 비-KO 트래픽 엔진 복원**

#### 1.1 비-KO 홈 locale USP 블록
- 파일: [pages/[locale]/index.tsx](../pages/[locale]/index.tsx) 또는 [data/home.ts](../data/home.ts)
- 추가 블록:
  - **중국어권(zh)**: 결제·위챗 커뮤니케이션·한국 체류 아티스트 가이드
  - **스페인어권(es)**: 한국에서 녹음하려는 중남미 아티스트용 FAQ
  - **베트남어(vi)**: K-pop trainee 대상 보컬 트레이닝 차별점
- locale별 고유 증언(서면 후기 2~3개 이상)

#### 1.2 허브 페이지 4종 현지화 강화
- 대상: `/{locale}/about`, `/lesson`, `/pricing`, `/studio-info`
- 각 허브 하단에 해당 locale 전용 FAQ 5개, 증언 2~3개 추가
- 파일: [data/faq.ts](../data/faq.ts), [data/reviews.ts](../data/reviews.ts) 확장

#### 1.3 내부링크 재배선
- 홈 → 허브 → 카테고리 hub → 스토리 detail 4계층 강화
- 홈 하단에 "이번 달 추천 포트폴리오" + "이번 주 베스트 가이드" 수동 큐레이션 슬롯 추가

### Phase 2 — 시리즈 재구성 (2~4주)

목표: **B·C 버킷 해소 — 시리즈 카니발라이제이션 정리**

#### 2.1 믹싱 pillar 허브 신규 작성
- 신규: `content/stories/mixing-complete-guide.md` (≥5,000자)
- 구조: "믹싱 입문부터 마스터링까지" 전체 로드맵, 각 sub-topic에서 23편 시리즈로 내부링크.
- 기존 23편 중 주제 중복 편은 pillar로 301 redirect.
- 핵심 5~7편만 개별 유지 권장(예: mixing1=입문, mixing5=게인스테이지, mixing14=볼륨밸런스, mixing17=컴프레서, mixing22=오토메이션).

#### 2.2 불광믹싱클럽 통합
- 신규: `content/stories/bulgwang-mixing-club.md`(허브) — 시리즈 소개·참여 방법
- 기존 1st/2nd/3rd는 각 회차 고유 세부(참여자 인용, 구체 사운드 케이스) 추가해 최소 2,500자 증량
- 1st는 허브로 흡수하거나 본문 확장 중 택1

#### 2.3 interview1 포맷 수술
- 47KB는 검색 의도 혼재. 아래 중 하나 선택:
  - (a) 3~5개 sub-topic(장비·프로덕션 철학·아티스트 조언)으로 쪼개 독립 글로 분리
  - (b) 강한 TOC·앵커·요약 카드 추가해 "long-form 가이드" 의도 명확화
  - (c) 일부를 별도 "인터뷰 시리즈"로 승격하고 interview1은 대표 요약으로 축소

### Phase 3 — 프로그래매틱 SEO 거버넌스 (상시)

목표: **재발 방지 — 앞으로 추가되는 콘텐츠가 같은 문제를 만들지 않도록**

#### 3.1 자동 품질 감사 스크립트
- 신규: `scripts/audit-thin-content.js`
- 검사 항목:
  1. 본문 1,500자 미만 슬러그 목록
  2. 10개 이상 슬러그 간 3-gram 유사도 70%↑ 쌍 (near-duplicate 감지)
  3. `robots` 필드 없는데 `isFallbackTranslation=true`인 경우 경고
  4. canonical 셀프-참조 일치 확인
- CI `npm run lint` 뒤 경고 출력 (에러 차단은 아직 X)

#### 3.2 sitemap 품질 게이트 강화
- 파일: [next-sitemap.config.js](../next-sitemap.config.js)
- 현재는 locale-fallback만 제외. 추가 조건:
  - thin content(`isThinContent=true`)는 sitemap에서 제외
  - 포트폴리오도 동일 임계값 적용

#### 3.3 GSC 재색인 요청
- Phase 0/1 완료분 중 핵심 10~20개(locale 허브 전부 + 리뉴얼된 포트폴리오 상위 5~10개)를 GSC "URL 검사 → 색인 요청" 수동 제출
- Submit 후 2~3주 모니터링

---

## 5. 측정 지표 (2주 주기 GSC 확인)

| KPI | 현재 | Phase 0 완료 시 | Phase 1+2 완료 시 |
|---|---|---|---|
| "크롤링·미색인" 건수 | 81 | ≤ 60 | ≤ 30 |
| 비-KO locale 홈 색인율(6개 중) | 1/6 | 3/6 | 6/6 |
| 포트폴리오 상세 색인율(42 × 7 = 294) | 미측정 | 30%+ | 60%+ |
| NOINDEX 제외 건수 | 743 | ≤ 400 | ≤ 200 |
| 발견·미크롤링 건수 | 1,000 | ≤ 500 | ≤ 200 |

---

## 6. 조치 대상 URL (Phase 0 직접 영향 범위)

### 6.1 최우선 수정 대상 파일 (Phase 0)

| 파일 | 변경 내용 |
|---|---|
| [data/portfolio.ts](../data/portfolio.ts) | `productionNotes`, `credits`, `releaseDate`, `label`, `trackList` 필드 추가 |
| [pages/[locale]/portfolio/[id].tsx](../pages/[locale]/portfolio/[id].tsx) | 프로덕션 노트·크레딧 렌더, thin 게이트, `MusicRecording` JSON-LD |
| [utils/schemaGenerator.ts](../utils/schemaGenerator.ts) | `generateMusicRecordingSchema()` 추가 |
| [lib/stories.ts:324](../lib/stories.ts#L324) | thin 임계값 1000 → 1500 |
| [pages/api/rss.ts](../pages/api/rss.ts) | `X-Robots-Tag: noindex` 헤더 |

### 6.2 허브 페이지 대상 (Phase 1)

| locale | URL | 현재 상태 |
|---|---|---|
| es | `/es` | 크롤링·미색인 |
| zh | `/zh`, `/zh/about`, `/zh/lesson` | 크롤링·미색인 |
| vi | `/vi` | 크롤링·미색인 |
| th | `/th/pricing`, `/th/studio-info` | 크롤링·미색인 |

### 6.3 콘텐츠 재구성 대상 (Phase 2)

- 믹싱 시리즈: `content/stories/mixing{1..23}.md` 중 병합·유지·redirect 분류
- 이벤트: `content/stories/bulgwang-mixing-club{.,-2nd,-3rd}.md`
- 인터뷰: `content/stories/interview1.md` + 7개 locale 번역

---

## 7. 리스크와 가드레일

- **301 redirect 남발 금지**: Phase 2에서 믹싱 시리즈를 허브로 합치되, 기존 외부 백링크가 있는 편은 유지. 삭제 전에 GSC "상위 링크" 리포트 확인.
- **번역 품질 타협 금지**: locale 허브 강화는 기계번역이 아닌 로컬 크리에이터 레뷰 선행.
- **noindex 되돌리기 주의**: Phase 0.2 thin-content 자동 게이트는 포트폴리오 데이터 보강이 **끝난 뒤** 켜야 함. 먼저 켜면 일시적으로 모든 포트폴리오가 noindex가 됨.

---

## 8. 진행 상황 스냅샷 (2026-04-24)

| 단계 | 상태 | 핵심 결과 |
|---|---|---|
| Phase -1 (hreflang·RSS 필터) | ✅ 완료 | 1,743 URL 크롤 낭비 차단 |
| Phase 0.1-A (fallback·noindex·sitemap gate) | ✅ 완료 | 205개 포트폴리오 URL 자동 `noindex, follow` |
| Phase 0.1-B (영문 productionNotes) | ✅ 완료 | 11 → **34/34** (100%), 중복 ID 2건 제거 |
| Phase 0.1-C (credits·releaseDate·label) | ✅ 완료 | credits 100%, releaseDate 74% (25/34), label 26% (9/34) |
| Phase 0.1-D (zh/es/vi/th/uz productionNotes) | ⏳ 보류 | 기계 번역 품질 리스크 |
| Phase 1 (locale 언어 일관성 복구) | ✅ 완료 | zh localeUsps 3개 블록 한국어 혼재 제거 · th localeUsps 베트남어 오타 수정 · zh fallbackKeywords 한글 지명 음차 |
| Phase 2 (믹싱 시리즈 pillar 링크 보강) | ✅ 완료 | 23편 전부 `mixing-complete-guide` 허브 연결 |
| Phase 3 (품질 감사 스크립트) | ✅ 완료 | `npm run audit:thin`/`audit:thin:ci` 등록, 의도적 noindex 분리 로직 추가. **현재 actionable thin 0건** (14건 전체가 의도적 noindex) |

## 9. 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-22 | 초안 작성. Phase -1 (hreflang·RSS 필터) 선행 커밋 반영 |
| 2026-04-24 | Phase 0.1-A/B/C 완료. 포트폴리오 en 번역 100% · credits 100% · 중복 제거. 믹싱 23편에 pillar 허브 역링크 주입. audit:thin npm script 등록 |
| 2026-04-24 (2) | Phase 1 완료. zh 홈 localeUsps에 섞여있던 한국어 100% 중국어화. th localeUsps의 베트남어 단어 오타 수정. 비-KO locale 허브 언어 일관성 시그널 회복 |
| 2026-04-24 (3) | Phase 3 감사 스크립트 고도화. `robots: noindex` 페이지를 actionable thin에서 분리. 최종 상태: actionable thin 0건 · 의도적 noindex 14건 (`done1`·`bulgwang-mixing-club` 공지 locale 번역본) |
