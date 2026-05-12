# Multilingual SEO Expansion — Phase 1: English

작성일: 2026-05-12
대상 사이트: studionol.co.kr (Studio NOL)
타겟: 한국 거주 외국인 음악인 (영어 사용자 우선)

## 1. 배경과 목표

### 현 상태
- 7 locale 지원(ko/en/zh/es/vi/th/uz). ko만 native 콘텐츠 풀세트.
- Stories 1,730개: ko native, 다른 locale은 fallback translation으로 `robots: noindex, follow` + canonical → ko. duplicate content 회피.
- Landing pages (home/lesson/pricing/practice-room/contact/about/studio-info/voice-acting/wedding-song/portfolio): i18n으로 7 locale 모두 번역 적용. en 페이지도 production에서 `index, follow` + canonical 정상.
- Sitemap에 en URL 1,689개 등록 (대부분 stories의 noindex 페이지 포함 — crawl budget 비효율).
- 폰트: Pretendard Variable 마이그레이션 완료(2026-05-11). LCP/FCP 우수(mobile lab LCP 2.0s, CrUX 1.65s FAST).

### 목표
한국 거주 외국인 음악인(영어 사용)이 Google/Naver에서 Studio NOL을 발견하고 예약·방문 가능하도록 검색 인텐트 매칭. 비-영어 외국인도 영어로 우회 도달 가능.

### Phase 1 범위
영어(en) 단일 locale 우선. 다른 locale은 Phase 2 이후 검토.

### Out of scope (Phase 1에서 안 함)
- zh/vi/th/uz/es locale 콘텐츠 작성
- Stories 1,730개 ko → en 자동 번역(machine translation 파이프라인)
- Portfolio 영어 보강(개별 작업 사례 영어 설명)

> Phase 1의 5개 가이드는 Claude가 사이트 정보·도메인 지식 기반으로 **영어 native로 직접 작성**(번역 아님). 기존 ko 콘텐츠를 영어로 옮기는 작업이 아니라 영어 사용자 인텐트에 맞춰 새로 구성한다.

## 2. 작업 구성 (두 파트)

### Part A — Landing pages SEO 정합성 보강
시각·콘텐츠 변경 없이 메타·시그널 정합성만.

**현 상태 진단**:
- robots: `index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1` ✅
- canonical: `https://studionol.co.kr/en/*` 자기 자신 ✅
- sitemap 포함 ✅

**보강 항목**:
1. **hreflang 매핑 완전성** — 각 en landing이 7 locale 모두에 대한 `<link rel="alternate" hreflang="...">`을 정확히 출력하는지. SEO.tsx의 hreflang 로직 점검.
2. **meta title/description 영어 키워드 매칭** — i18n 자원(`public/locales/en/common.json`)의 `seo.title`/`seo.description` 키들이 영어 사용자 검색 인텐트("Seoul recording studio", "English-speaking", "Korea music studio English" 등)와 매칭되는지 확인 + 필요 시 보강.
3. **structured data 영어 자연어** — LocalBusiness, FAQPage 등의 schema가 영어로 정확히 출력되는지 확인.
4. **(선택) sitemap에서 noindex 페이지 제외** — 1,689개 중 stories noindex 페이지가 crawl budget 낭비 가능. lastmod 우선순위 또는 sitemap 분리 검토. 단 Phase 1 필수 아님.

작업량: 1-2 commit. 코드 + i18n 자원만 수정.

### Part C — 외국인 특화 영어 native 가이드 5개 (hub-spoke)

기존 stories 시스템(`content/stories/*.md`) 재사용. 별도 디렉토리 신설 안 함.

**프런트매터 규약**:
- `locale: en` (사용 가능한지 확인 필요 — 현 stories는 locale 분기를 frontmatter가 아닌 파일 시스템/i18n으로 처리할 가능성. lib/stories.ts 점검 후 결정)
- `robots: index, follow` (override)
- `thumbnail`: 기존 `public/images/*.webp` 재사용
- `category`: 새 카테고리 또는 기존 카테고리 중 적합한 것 사용

**5개 가이드 주제**:

| Slug | 주제 | 검색 인텐트 키워드 |
|---|---|---|
| `recording-in-seoul-for-foreign-musicians` | overview hub — Seoul 녹음 환경, 영어 가능 스튜디오로서 NOL 소개 | "recording studio Seoul", "Korea recording for foreigners", "English studio Seoul" |
| `korean-practice-room-booking-english` | 연습실 예약 방법, 영어 안내, 시간당 요금 | "music practice room Seoul", "rehearsal room Korea English" |
| `english-speaking-music-lessons-seoul` | 1:1 보컬·악기 레슨 영어 안내 | "English vocal lessons Seoul", "music lessons Korea English-speaking coach" |
| `korean-recording-studio-pricing-guide` | 한국 녹음 스튜디오 가격 가이드, NOL 요금 비교 | "Korean recording studio price", "Seoul studio cost" |
| `visiting-studio-nol-from-seoul-gyeonggi` | 연신내 위치, 서울·경기·인천에서 오는 방법 | "Yeonsinnae studio access", "Studio NOL location Seoul" |

각 가이드 1,500-3,000자 영어 native. 5개끼리 internal cross-link (각 글에서 다른 4개 글 자연스럽게 인용) → "Korea recording for foreigners" topical authority 시그널.

**콘텐츠 작성 절차**:
1. Claude가 1개씩 영어 native 초안 작성 (운영자 황경하님이 ko로 정보 제공할 필요 없음 — 기존 ko 콘텐츠와 사이트 정보를 Claude가 참고해 자체 작성)
2. 황경하님이 검수: 사실 오류, 영어 자연도, Studio NOL 톤 일치
3. 수정사항 반영 → commit
4. 5개 모두 완료 후 한 번에 배포

각 글 frontmatter 최소 필드:
```yaml
---
title: "<영어 제목>"
locale: en
date: 2026-05-12
category: foreign-musicians  # 또는 기존 적합 카테고리
thumbnail: /images/<적절한 webp>
description: "<150자 영어 meta>"
tags: ["recording", "korea", "foreign-musicians", "english", ...]
robots: index, follow
---
```

## 3. 콘텐츠 시스템 적합성 점검 (구현 전 필수)

[lib/stories.ts](lib/stories.ts) + [pages/[locale]/stories/[id].tsx](pages/[locale]/stories/[id].tsx)가 `locale: en` frontmatter를 native로 인식하고 fallback noindex 로직을 우회하는지 확인 필요.

**점검 포인트**:
1. `content/stories/*.md`에 동일 slug × 다른 locale 콘텐츠를 어떻게 구분하는가? (파일명 suffix? frontmatter `locale`?)
2. `story.isFallbackTranslation` 판정 로직이 영어 native 콘텐츠 추가 시 정확히 false로 떨어지는가?
3. category/[key].tsx의 listing이 en native 가이드를 노출하는가?
4. hreflang `alternate` 매핑이 en native에서 ko 없는 경우(영어 전용 콘텐츠)도 정상 처리되는가? (예: `disableCanonicalAndAlternates` 설정 가능 여부)

이 점검 결과에 따라 가이드 frontmatter 구조와 추가 코드 fix가 결정됨.

## 4. 측정

- **Google Search Console**: en page impression/click 4-8주 모니터링. 5개 가이드 indexed 상태 확인.
- **Vercel Speed Insights**: en 페이지 CrUX LCP/INP 추적.
- **사이트 내 trafic**: en landing → contact 이동률 (목표 conversion).

기존 사이트 KPI를 깨뜨리지 않는 범위에서 en 새로운 채널 확보.

## 5. 위험 / 트레이드오프

| 위험 | 완화 |
|---|---|
| 영어 native 콘텐츠 품질이 ko 수준 못 미침 | 황경하님 검수 단계 필수. 5개 묶음으로 한 번에 hub-spoke 형성해 quality signal 강화 |
| stories.ts 시스템이 en native 처리에 적합하지 않을 수 있음 | Section 3에서 사전 점검 후 결정. 필요 시 frontmatter 규약 추가 또는 별도 디렉토리 검토 |
| ko 콘텐츠 1,730개 vs en 5개 비율 불균형 → Google이 "한국어 사이트"로 단정 | hreflang 정확성으로 시그널 명시. 검색 의도 명확한 5개 hub-spoke로 영어 영역 권위 확보 |
| sitemap에 noindex 1,689개 포함 → crawl budget 분산 | Phase 1에서 보강(Part A 4번) 또는 Phase 2로 미룸 |
| 영어 가이드가 한국 거주 외국인 vs 해외 사용자 둘 다 끌어와 한국 거주 의도와 안 맞을 수 있음 | "Yeonsinnae access", "from Seoul/Gyeonggi" 같은 한국 위치 키워드로 의도 명시 |

## 6. 산출물 (Deliverables)

Phase 1 완료 시점에 main에 다음이 존재:

1. `content/stories/recording-in-seoul-for-foreign-musicians.md` (또는 frontmatter `locale: en` 규약 결정 후 적절한 파일명)
2. `content/stories/korean-practice-room-booking-english.md`
3. `content/stories/english-speaking-music-lessons-seoul.md`
4. `content/stories/korean-recording-studio-pricing-guide.md`
5. `content/stories/visiting-studio-nol-from-seoul-gyeonggi.md`
6. (필요 시) `lib/stories.ts` / `components/SEO.tsx` 수정 — en native 처리 지원
7. (필요 시) `public/locales/en/common.json` — landing meta 영어 키워드 보강
8. (선택) `next-sitemap.config.js` — noindex 페이지 sitemap 제외

CrUX 다국어 데이터는 4-8주 후 별도 검토.

## 7. 다음 단계

이 spec 사용자 검토 → writing-plans skill로 implementation plan 작성 → 단계별 작업 진행.
