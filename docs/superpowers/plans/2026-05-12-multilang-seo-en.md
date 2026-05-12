# 다국어 SEO 확장 Phase 1 (English) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 한국 거주 외국인 음악인(영어 사용)이 Studio NOL을 검색에서 발견·예약할 수 있도록 en landing SEO 정합성을 보강하고 외국인 특화 영어 native 가이드 5개를 hub-spoke 구조로 추가한다.

**Architecture:** 기존 stories 시스템(`content/stories/{slug}.en.md` 파일명 규약) 재사용. en native 파일은 `resolveStoryFile`이 자동 인식해 `sourceLocale: 'en'` → `isFallbackTranslation: false` → `robots: index, follow`로 처리. Landing 메타는 `public/locales/en/common.json` 자원 보강만으로 영어 검색 인텐트 매칭.

**Tech Stack:** Next.js 15.5 Pages Router · React 19 · i18next · gray-matter(frontmatter) · Pretendard Variable(폰트) · TypeScript

**Spec:** [docs/superpowers/specs/2026-05-12-multilang-seo-en-design.md](../specs/2026-05-12-multilang-seo-en-design.md)

---

## File Structure

| 파일 | 역할 | 작업 |
|---|---|---|
| `content/stories/recording-in-seoul-for-foreign-musicians.en.md` | overview hub 가이드 | Create |
| `content/stories/korean-practice-room-booking-english.en.md` | practice-room intent | Create |
| `content/stories/english-speaking-music-lessons-seoul.en.md` | lesson intent | Create |
| `content/stories/korean-recording-studio-pricing-guide.en.md` | pricing intent | Create |
| `content/stories/visiting-studio-nol-from-seoul-gyeonggi.en.md` | location intent | Create |
| `lib/stories.ts` | en 전용 글(ko 원본 없음) 처리 검증 | Inspect, fix if needed |
| `pages/[locale]/stories/[id].tsx` | en 가이드의 robots/canonical SSG 검증 | Inspect |
| `components/SEO.tsx` | hreflang 매핑 검증 | Inspect, fix if needed |
| `public/locales/en/common.json` | landing meta 영어 인텐트 키워드 보강 | Modify (필요 시) |
| `next-sitemap.config.js` | (선택) noindex 페이지 sitemap 제외 | Modify (선택, Part D) |

---

## Task 0: Pre-flight — en native 파일이 시스템에서 정상 처리되는지 검증

**Files:**
- Inspect: `lib/stories.ts`, `pages/[locale]/stories/[id].tsx`
- Create: `content/stories/__seo-test-en-only.en.md` (임시 stub, 검증 후 삭제)

기존 코드가 ko 원본(`{slug}.md`) 없이 en 파일만 있는 경우를 어떻게 처리하는지 확정.

- [ ] **Step 1: 임시 en-only stub 작성**

`content/stories/__seo-test-en-only.en.md`:
```markdown
---
title: "SEO Test (English Only, No Korean Original)"
date: 2026-05-12
category: foreign-musicians
description: "Temporary stub to verify en-only story SSG path. Will be deleted."
tags: ["test", "english", "foreign-musicians"]
thumbnail: /images/studio2.webp
---

This is a temporary English-only story used to verify that `lib/stories.ts` correctly handles stories that exist only as `{slug}.en.md` without a Korean original `{slug}.md`. After verification, this file will be deleted.

The content here is at least 1,500 characters to pass `THIN_CONTENT_THRESHOLD`. We are checking three things:
1. The `/en/stories/__seo-test-en-only` route builds successfully via `getStaticPaths`.
2. The rendered HTML returns `robots: index, follow` (not `noindex, follow`).
3. `canonical` points to `/en/stories/__seo-test-en-only` (not back to `/ko/...`).

Studio NOL is a recording studio in Yeonsinnae, Seoul, serving local and international musicians. We offer recording sessions, mixing, mastering, practice rooms, and 1:1 music lessons. Our team works in both Korean and English. Booking is available via the contact page.

If this test passes we proceed with the five real foreign-musician guides outlined in the implementation plan. If `lib/stories.ts` requires changes to support en-only stories, we adjust it in this same task before continuing.

(Padding to meet the THIN_CONTENT_THRESHOLD: Studio NOL operates daily and welcomes both walk-ins and reservations. Equipment ranges from high-end vocal microphones and outboard preamps to a full Pro Tools rig with calibrated monitoring. Located near Yeonsinnae Station on Seoul Subway Line 3, the studio is reachable from most parts of Seoul, Goyang, Bucheon, and Incheon within an hour. Korean-speaking and English-speaking engineers are available depending on the session.)
```

- [ ] **Step 2: 로컬 빌드로 SSG 경로가 생성되는지 확인**

```bash
cd /Users/hwang-gyeongha/studio
npx next build 2>&1 | grep -E "stories/__seo-test|Error" | head -10
```

Expected: `/en/stories/__seo-test-en-only` 경로가 빌드 산출물에 나타남. Error 없음. 만약 build error("Cannot read frontmatter" 또는 "Story not found")가 발생하면 `lib/stories.ts`의 `resolveStoryFile`/`getAllStorySlugs`/`getStoryPaths`를 점검해 en-only 처리를 명시적으로 지원하도록 수정 필요.

- [ ] **Step 3: 로컬 dev로 robots/canonical 확인**

```bash
cd /Users/hwang-gyeongha/studio
PORT=3001 npm run dev > /tmp/dev.log 2>&1 &
DEVPID=$!
sleep 8
curl -s 'http://localhost:3001/en/stories/__seo-test-en-only' | grep -oE 'name="robots"[^>]*content="[^"]+'
curl -s 'http://localhost:3001/en/stories/__seo-test-en-only' | grep -oE 'rel="canonical"[^>]*href="[^"]+'
kill -TERM $DEVPID
```

Expected output:
- `name="robots" ... content="index, follow, ..."` (NOT `noindex`)
- `rel="canonical" ... href="...studionol.co.kr/en/stories/__seo-test-en-only"` (NOT ko로 redirect)

만약 noindex로 떨어지면 `pages/[locale]/stories/[id].tsx:220`의 `story.isFallbackTranslation` 판정 로직 점검 — `sourceLocale === requestedLocale === 'en'`인데도 fallback으로 잡히면 버그. 수정 후 재검증.

- [ ] **Step 4: ko 라우트는 fallback 처리되는지 확인**

```bash
curl -s 'http://localhost:3001/ko/stories/__seo-test-en-only' | grep -oE 'name="robots"[^>]*content="[^"]+'
```

en-only 글이라 ko 요청에서는 어떻게 처리되는지 확인. 두 가지 정상 시나리오:
- ko에서 404 (en만 존재하므로 ko 페이지 없음)
- ko에서 en 콘텐츠를 fallback으로 보여주되 `robots: noindex` + canonical → en

둘 중 하나면 OK. ko에서 200 + index가 뜨면 duplicate content 위험이라 fix 필요.

- [ ] **Step 5: stub 삭제 + 점검 결과 기록**

```bash
rm content/stories/__seo-test-en-only.en.md
```

점검 결과를 plan의 Notes 섹션(아래)에 기록:
- en native 처리 작동 여부 (PASS/FAIL)
- 수정 필요한 파일이 있다면 그 내역
- ko 라우트 처리 방식 (404/fallback noindex)

- [ ] **Step 6: Commit (점검 결과 + 코드 수정 있을 경우)**

수정 없는 경우 commit 불필요. 수정이 있었다면:

```bash
git add lib/stories.ts pages/[locale]/stories/[id].tsx
git commit -m "fix(stories): en-only story(ko 원본 없음) 처리 정합화 + noindex 폴백 보정"
```

### Notes (Task 0 점검 결과 기록 영역)

- en native 처리: (PASS / FAIL — 결과 기재)
- ko 라우트 처리: (404 / fallback noindex / 기타)
- 수정한 파일: (없음 / 파일 목록)

---

## Task A1: hreflang 매핑 완전성 검증

**Files:**
- Inspect: `components/SEO.tsx` (hreflang 출력 로직)

- [ ] **Step 1: 현 상태 확인 — production landing 7개 페이지 hreflang 노출**

```bash
for path in en en/lesson en/pricing en/practice-room en/contact en/about en/portfolio; do
  echo "=== /$path ==="
  curl -s "https://studionol.co.kr/$path" | grep -oE 'rel="alternate" hreflang="[a-z-]+"[^>]*href="[^"]+' | head -15
done
```

Expected: 각 페이지에 7 locale(ko/en/zh/es/vi/th/uz) × `alternate` + 1 `x-default` = 총 8개 link 등장.

- [ ] **Step 2: 누락된 hreflang이 있으면 SEO.tsx 매핑 점검**

만약 8개 미만이거나 잘못된 href가 있다면 [components/SEO.tsx](components/SEO.tsx)의 hreflang 출력 부분(약 line 50, 360-380 부근) 점검 + 수정.

- [ ] **Step 3: 수정한 경우 build + 로컬 dev로 재검증**

```bash
cd /Users/hwang-gyeongha/studio
PORT=3001 npm run dev > /tmp/dev.log 2>&1 &
sleep 8
curl -s 'http://localhost:3001/en/lesson' | grep -oE 'hreflang="[a-z-]+"' | sort -u
kill %1
```

Expected: `ko, en, zh, es, vi, th, uz, x-default` 8개 등장.

- [ ] **Step 4: Commit (수정이 있었을 때만)**

```bash
git add components/SEO.tsx
git commit -m "fix(seo): en landing hreflang 7 locale + x-default 완전성 보강"
```

---

## Task A2: en landing meta title/description 영어 인텐트 키워드 매칭

**Files:**
- Modify: `public/locales/en/common.json` (각 페이지 `seo.title`/`seo.description` 키)

- [ ] **Step 1: 현 상태 확인 — production /en landing meta**

```bash
for path in en en/lesson en/pricing en/practice-room en/contact en/about en/studio-info en/portfolio; do
  echo "=== /$path ==="
  body=$(curl -s "https://studionol.co.kr/$path")
  echo "$body" | grep -oE '<title[^>]*>[^<]+' | head -1
  echo "$body" | grep -oE 'name="description"[^>]*content="[^"]+' | head -1 | sed 's/.*content="//'
done
```

각 페이지의 영어 title/description이 다음 검색 인텐트 키워드를 포함하는지 점검:
- "Seoul recording studio" / "Korea recording studio"
- "English-speaking" / "for foreigners" / "international musicians"
- "Yeonsinnae" (위치 키워드)
- "1:1 music lessons" / "vocal coaching"
- "practice room rental" / "rehearsal room"

- [ ] **Step 2: 누락 키워드 → en common.json 보강안 작성**

작업 전: `public/locales/en/common.json`을 읽어 현 `seo.*` 키들 확인. 필요한 보강 후보:

예시(home `seo.title`):
- Before: "Studio NOL · Recording Studio · Music · Mixing"
- After: "Studio NOL — Seoul Recording Studio for International Musicians · Mixing & Mastering · Yeonsinnae"

description은 150-160자 영문, 검색 인텐트 키워드 자연스럽게 포함.

각 페이지별 추천 키워드 매핑:

| Page | title 키워드 | description 키워드 |
|---|---|---|
| `/en` (home) | Seoul recording studio, International musicians, Yeonsinnae | English-speaking engineers, mixing/mastering, K-pop |
| `/en/lesson` | 1:1 music lessons Seoul, English-speaking coach | vocal/instrument, beginner-friendly, Yeonsinnae |
| `/en/pricing` | Studio Pricing Korea, Seoul recording rates | hourly rates, transparent pricing |
| `/en/practice-room` | Music practice room Seoul, Rehearsal room rental | hourly, English booking, Yeonsinnae |
| `/en/contact` | Book recording session Seoul, Contact Studio NOL | English booking, location |
| `/en/about` | Studio NOL Korea, Music studio Yeonsinnae | About, story, equipment |
| `/en/studio-info` | Recording equipment Korea, Studio gear Seoul | mic list, outboard, monitors |
| `/en/portfolio` | Korean music portfolio, Studio NOL work | recordings, mixing examples |

- [ ] **Step 3: en common.json 수정**

[public/locales/en/common.json](public/locales/en/common.json)에서 위 키워드 매핑대로 `seo.title` / `seo.description` 보강. 자연스러운 영어 표현 유지, 키워드 stuffing 금지.

- [ ] **Step 4: 빌드 + 로컬 dev로 결과 확인**

```bash
PORT=3001 npm run dev > /tmp/dev.log 2>&1 &
sleep 8
for path in en en/lesson en/pricing en/practice-room en/contact en/about en/studio-info en/portfolio; do
  echo "=== /$path ==="
  curl -s "http://localhost:3001/$path" | grep -oE '<title[^>]*>[^<]+|name="description"[^>]*content="[^"]+' | head -2
done
kill %1
```

각 페이지 title/description이 의도대로 출력되는지 확인.

- [ ] **Step 5: Commit**

```bash
git add public/locales/en/common.json
git commit -m "feat(seo): en landing meta에 외국인 음악인 검색 인텐트 키워드 보강

home/lesson/pricing/practice-room/contact/about/studio-info/portfolio 8개 페이지
seo.title·seo.description에 'Seoul recording studio', 'English-speaking', 
'Yeonsinnae' 등 한국 거주 외국인 음악인 검색 매칭 키워드 자연스러운 영어로 포함."
```

---

## Task A3: structured data 영어 자연어 검증

**Files:**
- Inspect: `components/SEO.tsx` (JSON-LD 출력 부분)
- Inspect: production HTML

- [ ] **Step 1: production /en landing structured data 추출**

```bash
curl -s 'https://studionol.co.kr/en' | grep -oE '<script type="application/ld\+json"[^>]*>[^<]+' | head -3
```

각 JSON-LD 블록의 `name`/`description`/`address` 등이 영어로 출력되는지 검사. `WebSite`, `LocalBusiness`, `Organization`, `BreadcrumbList`, `FAQPage` 등이 대상.

- [ ] **Step 2: 누락/한글 잔재 발견 시 SEO.tsx 점검**

[components/SEO.tsx](components/SEO.tsx)의 JSON-LD 생성 부분에서 locale 분기 점검. ko 텍스트가 en 페이지에 새는 부분이 있으면 i18n 또는 locale별 매핑 추가.

- [ ] **Step 3: 수정한 경우 dev로 재검증 + Commit**

```bash
git add components/SEO.tsx public/locales/en/common.json
git commit -m "fix(seo): en landing structured data 영어 자연어 출력 정합화"
```

(수정 없으면 commit 불필요)

---

## Task C1: Guide 1 — Recording in Seoul for Foreign Musicians (overview hub)

**Files:**
- Create: `content/stories/recording-in-seoul-for-foreign-musicians.en.md`

5개 가이드의 hub. 사이트 전체 영어 자산을 받쳐주는 overview 글.

- [ ] **Step 1: 가이드 초안 작성 (Claude 영어 native)**

다음 frontmatter + 본문(2,500-3,000자 영어 native)으로 작성:

```markdown
---
title: "Recording in Seoul: A Complete Guide for Foreign Musicians"
date: 2026-05-12
category: foreign-musicians
description: "Everything international musicians need to know about recording, practicing, and learning music in Seoul — from booking to studio access, all in English."
keywords: ["Seoul recording studio", "Korea recording for foreigners", "English speaking studio Seoul", "Yeonsinnae studio", "international musicians Korea"]
tags: ["recording", "seoul", "foreign-musicians", "english", "guide"]
thumbnail: /images/studio2.webp
---

(본문 — 2,500-3,000자 영어 native. 다음 섹션 포함:)
1. Why Seoul for international musicians (K-pop hub, accessible infrastructure, English-friendly studios)
2. What to expect at a Korean recording studio (booking, communication, session flow)
3. Studio NOL specifically — location, services, English-speaking team
4. Cross-links to 4 spoke guides:
   - "Music Practice Rooms in Korea (English booking guide)"
   - "1:1 English-Speaking Music Lessons in Seoul"
   - "Korean Recording Studio Pricing Guide"
   - "Visiting Studio NOL from Seoul/Gyeonggi/Incheon"
5. Booking CTA (link to /en/contact)

자연스러운 영어, K-pop 관련 키워드 자연스럽게 등장, hub-spoke 구조 명확.
```

- [ ] **Step 2: 황경하님 검수 요청**

검수 포인트:
- 사실 오류 (스튜디오 정보, 서비스 항목, 위치)
- 영어 자연도
- Studio NOL 브랜드 톤
- 키워드 stuffing 없는지

- [ ] **Step 3: 수정사항 반영**

검수 피드백을 본문에 반영. 필요 시 사실 정보·CTA 표현 조정.

- [ ] **Step 4: 로컬 dev로 robots/canonical 확인**

```bash
PORT=3001 npm run dev > /tmp/dev.log 2>&1 &
sleep 8
curl -s 'http://localhost:3001/en/stories/recording-in-seoul-for-foreign-musicians' | grep -oE 'name="robots"[^>]*content="[^"]+|rel="canonical"[^>]*href="[^"]+'
kill %1
```

Expected: `robots: index, follow`, canonical → `/en/stories/recording-in-seoul-for-foreign-musicians`.

- [ ] **Step 5: Commit (5개 묶음에 포함 — 마지막 가이드 작성 후 한 번에 commit 권장)**

이 가이드 단독 commit하지 않고 Task C5까지 완료 후 묶어서 commit (cross-link 정합성).

---

## Task C2: Guide 2 — Music Practice Rooms in Korea (English booking)

**Files:**
- Create: `content/stories/korean-practice-room-booking-english.en.md`

- [ ] **Step 1: 초안 작성**

```markdown
---
title: "Music Practice Rooms in Korea: How to Book Without Speaking Korean"
date: 2026-05-12
category: foreign-musicians
description: "Step-by-step English guide to booking a music practice room in Seoul, with hourly rates, equipment, and what to expect at Studio NOL."
keywords: ["music practice room Seoul", "rehearsal room Korea English", "practice space Yeonsinnae", "Korean studio English booking"]
tags: ["practice-room", "seoul", "foreign-musicians", "english", "guide"]
thumbnail: /images/room5.webp
---

(본문 1,500-2,500자 영어 native. 섹션:)
1. What is a Korean "music practice room" (eumak-yeonseup-sil) — culture, format, hourly rate norms
2. Equipment you can expect (mics, monitors, mixing console, piano/keyboard, etc.)
3. How to book without Korean (Studio NOL contact in English, KakaoTalk/email options)
4. Hourly pricing — typical range + Studio NOL pricing link
5. Studio NOL practice rooms — specs, location, language support
6. Cross-link: "Recording in Seoul for Foreign Musicians" (hub) + "Visiting Studio NOL from Seoul/Gyeonggi"
```

- [ ] **Step 2-4: 검수 → 수정 → robots 검증** (Task C1 동일 패턴)

---

## Task C3: Guide 3 — English-Speaking Music Lessons Seoul

**Files:**
- Create: `content/stories/english-speaking-music-lessons-seoul.en.md`

- [ ] **Step 1: 초안 작성**

```markdown
---
title: "1:1 Vocal & Music Lessons in Seoul (English-Speaking Coaches)"
date: 2026-05-12
category: foreign-musicians
description: "Private music lessons in Seoul for international musicians — vocal coaching, instrument lessons, taught in English at Studio NOL Yeonsinnae."
keywords: ["English vocal lessons Seoul", "music lessons Korea English speaking", "Yeonsinnae vocal coach", "Seoul singing lessons foreigners"]
tags: ["lessons", "vocal-coaching", "seoul", "foreign-musicians", "english"]
thumbnail: /images/lesson1.webp
---

(본문 1,500-2,500자. 섹션:)
1. What 1:1 music lessons look like in Korea
2. Who they're for (K-pop trainees prep, hobbyist singers, foreign musicians in Seoul)
3. Studio NOL lesson options — vocal/instrument, language of instruction
4. Booking and scheduling in English
5. Pricing reference (link to pricing guide spoke)
6. Cross-link: hub + pricing spoke
```

- [ ] **Step 2-4: 검수 → 수정 → robots 검증**

---

## Task C4: Guide 4 — Korean Recording Studio Pricing Guide

**Files:**
- Create: `content/stories/korean-recording-studio-pricing-guide.en.md`

- [ ] **Step 1: 초안 작성**

```markdown
---
title: "Korean Recording Studio Pricing: What to Expect in 2026"
date: 2026-05-12
category: foreign-musicians
description: "Transparent pricing guide for Korean recording studios — hourly rates, package deals, what's included, and Studio NOL's English-friendly rates."
keywords: ["Korean recording studio price", "Seoul studio cost", "Korea mixing mastering rates", "Yeonsinnae studio pricing"]
tags: ["pricing", "seoul", "foreign-musicians", "english", "guide"]
thumbnail: /images/hardware2.webp
---

(본문 1,500-2,500자. 섹션:)
1. Typical Korean studio pricing structure (hourly vs package vs flat)
2. What's usually included (engineer time, basic mix, masters)
3. What's typically extra (additional revisions, attended mastering, etc.)
4. Studio NOL pricing — transparent rates link to /en/pricing
5. Tips for foreign musicians: bring a clear scope, ask in advance about file delivery formats
6. Cross-link: hub + lessons spoke + practice room spoke
```

- [ ] **Step 2-4: 검수 → 수정 → robots 검증**

---

## Task C5: Guide 5 — Visiting Studio NOL from Seoul/Gyeonggi/Incheon

**Files:**
- Create: `content/stories/visiting-studio-nol-from-seoul-gyeonggi.en.md`

- [ ] **Step 1: 초안 작성**

```markdown
---
title: "Visiting Studio NOL: Yeonsinnae Access from Seoul, Gyeonggi, and Incheon"
date: 2026-05-12
category: foreign-musicians
description: "Directions and transit guide to Studio NOL (Yeonsinnae, Seoul Line 3) — reach in under an hour from most parts of Seoul, Gyeonggi, and Incheon."
keywords: ["Yeonsinnae studio access", "Studio NOL location Seoul", "how to get to Yeonsinnae", "Seoul Line 3 studio"]
tags: ["location", "directions", "seoul", "foreign-musicians", "english"]
thumbnail: /images/studio3.webp
---

(본문 1,500-2,500자. 섹션:)
1. Where is Studio NOL — Yeonsinnae, Eunpyeong-gu, Seoul Subway Line 3
2. From central Seoul (Gangnam, Hongdae, Jamsil, etc.) — transit time tables
3. From Gyeonggi (Goyang, Bucheon, Suwon, Seongnam) — major routes
4. From Incheon (airport, city) — bus + subway combo
5. Nearby landmarks, food/coffee for waiting time
6. Direct address + KakaoMap/Google Maps links
7. Cross-link: hub + practice room spoke + contact link
```

- [ ] **Step 2-4: 검수 → 수정 → robots 검증**

---

## Task C6: 5개 가이드 cross-link 정합 + 한 번에 commit

**Files:**
- Modify: 5개 가이드 모두 — internal link 정합화

- [ ] **Step 1: 5개 가이드의 cross-link 검증**

각 가이드가 다른 4개 가이드 중 최소 2개 이상에 internal markdown link `[anchor text](/en/stories/<slug>)` 형식으로 cross-link하는지 확인. hub(C1)는 4개 spoke 모두 link, spoke끼리는 관련성 있는 것 2-3개씩 link.

- [ ] **Step 2: 로컬 dev로 5개 페이지 모두 robots/canonical/internal links 검증**

```bash
PORT=3001 npm run dev > /tmp/dev.log 2>&1 &
sleep 8
for slug in recording-in-seoul-for-foreign-musicians korean-practice-room-booking-english english-speaking-music-lessons-seoul korean-recording-studio-pricing-guide visiting-studio-nol-from-seoul-gyeonggi; do
  echo "=== $slug ==="
  curl -s "http://localhost:3001/en/stories/$slug" | grep -oE 'name="robots"[^>]*content="[^"]+|rel="canonical"[^>]*href="[^"]+'
  echo "  internal /en/stories/ link count:"
  curl -s "http://localhost:3001/en/stories/$slug" | grep -c '/en/stories/'
done
kill %1
```

Expected: 모두 robots index/follow, canonical 자기 자신, internal link 최소 2개.

- [ ] **Step 3: build로 type check + lint**

```bash
npm run type-check && npm run lint
```

- [ ] **Step 4: Commit (5개 한 번에)**

```bash
git add content/stories/recording-in-seoul-for-foreign-musicians.en.md \
        content/stories/korean-practice-room-booking-english.en.md \
        content/stories/english-speaking-music-lessons-seoul.en.md \
        content/stories/korean-recording-studio-pricing-guide.en.md \
        content/stories/visiting-studio-nol-from-seoul-gyeonggi.en.md
git commit -m "feat(content): 외국인 음악인 영어 native 가이드 5개 hub-spoke 추가

한국 거주 외국인 음악인 검색 인텐트 매칭 가이드 묶음. hub(recording overview) +
4개 spoke(practice-room/lessons/pricing/visit-access). 각 1,500-3,000자 영어
native, 5개끼리 internal cross-link로 'Korea recording for foreigners' topical
authority 시그널 형성. Phase 1 spec 참조: docs/superpowers/specs/2026-05-12-multilang-seo-en-design.md"
```

---

## Task Z1: Production 배포 후 검증

**Files:** none (production smoke test)

- [ ] **Step 1: push + Vercel 배포 대기**

```bash
git push origin main
# Vercel 배포 polling (CSS hash 변경 또는 새 story URL 200 응답으로 검증)
for i in $(seq 1 60); do
  s=$(curl -s -o /dev/null -w "%{http_code}" 'https://studionol.co.kr/en/stories/recording-in-seoul-for-foreign-musicians')
  if [ "$s" = "200" ]; then echo "deployed after $((i*5))s"; break; fi
  sleep 5
done
```

- [ ] **Step 2: production 5개 페이지 robots/canonical 직접 검증**

```bash
for slug in recording-in-seoul-for-foreign-musicians korean-practice-room-booking-english english-speaking-music-lessons-seoul korean-recording-studio-pricing-guide visiting-studio-nol-from-seoul-gyeonggi; do
  echo "=== $slug ==="
  body=$(curl -s "https://studionol.co.kr/en/stories/$slug")
  echo "$body" | grep -oE 'name="robots"[^>]*content="[^"]+' | head -1
  echo "$body" | grep -oE 'rel="canonical"[^>]*href="[^"]+' | head -1
done
```

Expected: 모두 `index, follow` + canonical 자기 자신.

- [ ] **Step 3: en landing 보강 확인**

```bash
for path in en en/lesson en/pricing; do
  echo "=== /$path ==="
  curl -s "https://studionol.co.kr/$path" | grep -oE '<title[^>]*>[^<]+|name="description"[^>]*content="[^"]+' | head -2
done
```

Task A2에서 보강한 키워드들이 production HTML에 등장하는지 확인.

- [ ] **Step 4: sitemap에 새 가이드 등록 확인**

```bash
curl -s 'https://studionol.co.kr/sitemap-0.xml' | grep -c "stories/recording-in-seoul-for-foreign-musicians\|stories/korean-practice-room-booking-english\|stories/english-speaking-music-lessons-seoul\|stories/korean-recording-studio-pricing-guide\|stories/visiting-studio-nol-from-seoul-gyeonggi"
```

Expected: 5 (또는 7×5=35 — locale별로 sitemap에 노출되면).

- [ ] **Step 5: 작업 종료 보고**

검증 결과 사용자에게 짧게 보고: 5개 가이드 production 정상, robots/canonical/sitemap OK, Search Console 4-8주 모니터링 시작.

---

## Out of scope (이번 plan에서 안 함)

- 다른 locale (zh/vi/th/uz/es) native 가이드 작성 — Phase 2
- Stories 1,730개 자동 번역 — 안 함
- noindex 페이지 sitemap 제외 (Part D) — spec에서 선택으로 두고 이번 plan에서 생략. 별도 plan으로.

---

## 실행 후 모니터링

- **즉시**: Task Z1 production 검증
- **1주 후**: Google Search Console에서 새 5개 URL의 indexed 상태 확인
- **4-8주 후**: en page impression/click 증가 추적, conversion(/en/contact 이동) 비율 측정. Phase 2 결정(다른 locale 확장 vs guide 추가 vs stories selective native).
