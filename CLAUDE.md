# CLAUDE.md

This file provides guidance for development in the **Studio NOL** repository.

## Project Overview

Studio NOL is a multi-language music studio website built with:
- **Framework**: Next.js 15.5.23 (Pages Router)
- **Runtime**: React 19.2.4
- **Styling**: Tailwind CSS with custom design system
- **Animation**: Framer Motion
- **i18n**: react-i18next (7 languages: ko, en, zh, es, vi, th, uz)
- **Content**: Markdown-based story system
- **Deployment**: Vercel

## Key Technologies

- **Frontend**: Next.js 15.5.23, React 19.2.4, Tailwind CSS, Framer Motion, Lucide React
- **i18n**: i18next with language detection and locale-based routing
- **Form**: Serverless contact form via Next.js API Routes and Resend
- **Imaging**: Sharp-based image optimization (WebP/AVIF)
- **Audio**: Custom AudioPlayer with `useAudioPlayer` hook

## Development Commands

```bash
# Development
npm run dev                  # Start Next.js development server

# Build & Verification
npm run type-check           # Run TypeScript compiler check
npm run lint                 # Run ESLint
npm run build                # Production build (includes image optimization)

# Image Optimization
node scripts/optimizeImages.js # Manually run image optimization

# SEO 분석 (자세한 규칙은 "SEO·GA4·GSC 분석 규칙" 절)
node scripts/seo-preflight.mjs                              # 데이터 열기 전 필수 — 최근 커밋·열린 실험·관측창
node --env-file=.env.local scripts/gsc-fetch-detail.mjs     # GSC 90일 원시 데이터
node --env-file=.env.local scripts/ga4-fetch.mjs            # GA4 90일 원시 데이터
node --env-file=.env.local scripts/ctr-verdict.mjs --surgery YYYY-MM-DD --slugs a,b --control c,d

# Hero font subset (LCP)
# prebuild에서 자동 실행됨. hero h1 텍스트(data/home.ts heroContent,
# public/locales/*/common.json의 *.hero.title*) 변경 후 빌드하면 woff2가 재생성되며
# 변경된 woff2 + pretendard-hero.chars.json 사이드카를 반드시 함께 commit해야 함.
# 빠뜨리면 hero-font-subset.test.js(CI)가 --check 모드로 잡아낸다.
# 수동 재실행:
node scripts/generate-hero-font.mjs
node scripts/generate-hero-font.mjs --check  # 네트워크 없이 subset 커버리지 검증

# 사이트맵 lastmod
# prebuild에 넣지 않는다 — Vercel·GitHub Actions는 얕은 클론이라 빌드 중 git 이력이 없다.
# pages/[locale]/ 에 라우트를 추가하면 pageRouteMap(lib/sitemap/routes.js) 등록 후
# 아래를 로컬에서 실행하고 lib/sitemap/pageLastmod.json을 함께 commit할 것.
# 빠뜨리면 routes.test.js의 'lastmod 커버리지'가 CI에서 잡아낸다.
npm run generate:page-lastmod
node scripts/generate-page-lastmod.mjs --check  # git 없이 커버리지만 검증

# 섹션 단위 중복 검사 (CI)
npm run check:dup-sections
node scripts/check-duplicate-sections.mjs --update  # 기준선 갱신

# 서비스 수치 정합 검사 (CI)
npm run check:facts

# 스토리 라우팅 기준선 (CI) — 하단 CTA·가격 카드 판정이 바뀐 글을 잡는다
npm run check:cta-routing
npx tsx scripts/cta-routing-baseline.ts --update   # 의도한 변경이면 기준선 갱신

# 펀딩 콘텐츠 불변식 기준선 (CI) — slug 개명·리워드 id 변경·프로젝트 삭제를 잡는다
npm run check:funding-baseline
npm run check:funding-baseline -- --update         # 의도한 변경이면 기준선 갱신

# IndexNow 변경분 제출 — 전량 반복 제출 금지, CI(main push)가 diff로 바뀐 URL만 자동 제출한다.
npm run indexnow:changed -- --dry-run
```

### 연습실 공실 상태 = 상수 하나

연습실 만실/공실은 `data/practiceRoomAvailability.ts`의 `PRACTICE_ROOM_HAS_VACANCY` 하나로
바꾼다. 카피 3곳(연습실·pricing 페이지 note/subtitle)과 `pages/api/llms.ts`가 이 상수를
따라간다. 바꿀 때 `PRACTICE_ROOM_AVAILABILITY_UPDATED_ON`도 함께 갱신할 것 — 오래되면
`practiceRoomAvailability.test.ts`가 CI에서 실패한다.

### 오픈 뒤 펀딩 프로젝트의 리워드 id·slug·금액은 바꾸지 않는다

프로젝트·리워드의 정본은 `content/funding/<slug>.md`인데, 후원 기록은 DB에 문자열
`project_slug`·`reward_id`로 남는다. 파일만 고치면 에러 없이 조용히 깨진다.

- **리워드 id 변경 → 한정 재고가 0으로 리셋된다.** `lib/funding/service.ts`의 재고 조건은
  `fp.reward_id = <파일의 id>`로 기존 후원을 세므로, id가 바뀐 순간 그 후원들이 안 세어져
  100개짜리 리워드가 200개 팔린다.
- **slug 변경 → 진행 중 모금액이 공개적으로 0원이 되고**, 기존 후원자는 manage 페이지에서
  프로젝트를 못 찾아 셀프 취소·후원 확인을 잃는다.
- **금액 변경 →** 후원 기록이 단가를 스스로 저장하므로 데이터는 안 깨지지만 상세 페이지와
  관리자 화면의 표시가 어긋난다(스펙 §3.1: "오픈 뒤에는 리워드 id 삭제와 금액 변경을 하지
  않는다 … 이 규칙은 코드로 막을 수 없어 이 절이 정본이다" —
  `docs/superpowers/specs/2026-09-08-funding-design.md`).

스펙이 "코드로 막을 수 없다"고 적어 둔 자리를 `content/funding.baseline.json` +
`content/funding.baseline.test.ts`가 대신 지킨다(slug × 리워드 id × 한정 여부). 의도한
변경이면 `npm run check:funding-baseline -- --update` 후 **같은 커밋에 왜 바뀌는지를 적을 것**
— 이유 없는 갱신은 게이트를 무력화한다.

`status`·`hidden`은 다른 frontmatter 필드와 같이 **엄격 검증**한다(`lib/funding/projects.ts`).
`status: Draft` 오타나 따옴표가 붙은 `hidden: "true"`는 예전엔 조용히 공개로 떨어졌다.
사이트맵 쪽(`lib/sitemap/fundingMeta.js`)도 정규식이 아니라 같은 파서(gray-matter)로 같은
규칙을 적용한다 — 두 판정이 갈리면 앱은 404인데 사이트맵·IndexNow가 그 URL을 제출한다.

### 서비스 수치는 정본에서만 온다

스토리가 말하는 납기·수정 횟수·대표 가격이 정본과 어긋나면 `check:facts`가 CI를 세운다.
factGuards는 전화번호·서비스 범위를 **1인칭 맥락**에서만 보기 때문에 표 안의 수치나 링크
라벨은 그대로 통과한다 — 2026-08-29 감사에서 네 건이 그렇게 빠져나가 있었다:
납기를 "영업일 2~5일"로 약속한 122편(정본 3~7영업일 — 짧게 약속), 마스터링까지
"2라운드 수정"으로 읽히는 20편(정본 1회 — 많게 약속), "1:1 보컬·믹싱 레슨" 링크 라벨
22편(보컬 레슨 미운영), "전주역은 KTX가 정차하지 않습니다"(사실 오류).

정본은 검사 스크립트에 베끼지 않고 **소스에서 읽는다** — 가격은 `data/pricing.ts` 상수,
납기·수정 횟수는 `public/locales/ko/common.json`의 믹싱·마스터링 페이지 문구. 정본이
바뀌면 스토리보다 먼저 여기서 드러난다(문구 형태가 바뀌면 검사가 에러로 멈춘다).

상품별로 기준이 다른 것에 주의: **축가는 납기 정본이 따로 있다**(믹싱·마스터링 3~7영업일 vs
축가 3~5일). 마스터링 단독 의뢰 납기는 정본이 없어 검사 대상이 아니다. 후기(`category: 후기`)
글은 고객이 겪은 일을 적은 것이라 검사에서 제외한다 — 약속이 아니므로 정본에 맞출 대상도 아니다.

### 가격 드리프트 가드 (`data/pricing.test.ts`)

`check:facts`는 **스토리**만 본다. 카피·데이터에 박힌 가격은 아래 세 겹이 지킨다.
전부 "상수가 움직였는데 카피가 안 따라온 것"을 잡는 장치다 — 이 저장소에서 실제로
난 사고 형태다(2026-09-02에 `data/buyerIntentHubs.ts`의 발매 허브 카드가
"EP 약 150만원~ · 정규 약 400만원~"을 문자열로 물고 있는 걸 손으로 발견했다).

| 가드 | 보는 곳 | 잡는 것 |
|---|---|---|
| 오퍼 id ↔ 상수 매핑 | `data/pricing.ts` 오퍼 | 한쪽만 고치면 실패 |
| 가격 리터럴 스캔 | `data/**/*.ts` (SSOT 본체 제외) | `250,000원`·`25만원`이 상수 밖이면 실패 |
| 릴리즈 티어 카피 | `public/locales/*/common.json` 7개 로케일 | 티어 하한이 상수와 다르면 실패 |

- **리터럴 스캔**은 두 표기를 다 본다. 처음엔 `N만원`만 봐서 `faq.ts`의 원 단위
  단가를 통째로 놓쳤다. `data/portfolio/` 같은 하위 디렉터리까지 재귀로 훑는다.
  우리 상품이 아닌 금액(외부 시세·환산값·기사 제목 인용)은 `NON_SSOT_AMOUNTS`에
  **이유와 함께** 등재한다. 이유 없이 넣으면 가드가 무의미해진다.
- **로케일 티어 가드**는 표기 형식이 로케일마다 달라(`180만원~` · `₩1.8M` ·
  `₩180万起`) 문자열이 아니라 **숫자로 파싱해** 비교한다.
- `common.json`에 "모든 금액이 상수여야 한다"는 넓은 규칙은 쓰지 않는다. 로케일당
  금액 90~140개 중 13~21종이 상수 밖인데 전부 정상이다 — 증분(정규 "12곡 +400만원"),
  환산(레슨 "회당 87,500원"), 외부 시세. 상수를 그대로 말해야 하는 키만 지정해 본다.
- 카피에 새 가격을 넣을 땐 리터럴 대신 `formatPriceLabel`로 상수에서 끌어온다.

### 발매 티어 하한 = 통합 번들 가격 (한쪽만 고치지 말 것)

`RELEASE_{SINGLE,EP,ALBUM}_FROM_PRICE`와 `{SINGLE,EP,ALBUM}_BUNDLE_PRICE`가 같은
값인 것은 우연이 아니라 **의도**다. 통합 번들이 발매 프로젝트의 **고정 구성 엔트리**이고,
발매 티어는 거기서 세션 편성·편곡 확장·PR 라운드를 올려 견적하는 같은 상품군이다.
한쪽을 바꾸면 다른 쪽도 함께 움직여야 하며, 위 가드가 그걸 강제한다.

세 번들 모두 **기획 · 녹음 · 믹싱 · 마스터링 · 디지털 유통 등록 · 발매 홍보**를 포함한다.
홍보는 보도자료 작성과 국내 음악 기자·평론가 + 해외 매체·라디오·플레이리스트 피칭까지다.
EP 하한이 4곡 번들가인데 상품은 3-5곡인 이유: 기획·유통·보도자료는 곡수와 무관한
고정비라 3곡이어도 같은 하한에서 시작한다.

### 믹싱 상품명은 트랙 수다 (`Level 1~3` 아님)

고객이 보는 이름은 "10트랙 이하 / 11~30트랙 / 31트랙 이상"이다. `Level 1~3`은 내부
축약이었는데, 같은 페이지의 FAQ·섹션 부제·SEO description이 이미 전부 트랙 수로
말하고 있어 카드만 혼자 다른 이름을 쓰던 상태였다(2026-09-02 교체). 검색 쪽에서도
`Level`은 값이 0이다 — 믹싱 거래형 쿼리는 "믹싱 마스터링 비용"이지 "Level"이 아니다.

**오퍼 id(`mixing-level1~3`)는 그대로 둔다** — `buyerIntentHubs`와 가이드 페이지가
이 id로 오퍼를 찾으므로 바꾸면 링크가 끊긴다. `docs/wiki`도 트랙 수 표기로 맞춰 뒀다.
위키는 `wiki-query`가 읽는 운영 지식 베이스라, 옛 표기가 남으면 사이트에 없는 이름으로
고객에게 답하게 된다.

### 보컬·악기 레슨은 없다 — 코드 가드가 든다

스튜디오의 레슨은 **프로듀싱 레슨(미디·작곡·믹싱·마스터링)** 하나다. 보컬 발성·악기 레슨은
하지 않는다. 그런데 보컬 글(category 보컬 가이드)에 레슨 오퍼가 붙으면 독자는 보컬 레슨으로
읽는다 — 없는 서비스를 광고하는 셈이라, 이 조합은 **어떤 경로로도 만들어지면 안 된다.**

2026-09-03 전수 확인: 보컬 글 76편이 frontmatter `inlineFallback.price: lesson-monthly`로
본문에 프로듀싱 레슨 가격 카드를 띄우고 있었고, `storyCtaPolicy`의 슬러그 패턴(head-voice·
belting·breath…)이 하단 CTA도 레슨으로 보내고 있었다. 카테고리 기본값(`vocal: recording-pro`)은
처음부터 맞았는데 frontmatter와 슬러그 패턴이 그걸 덮어썼다.

지금은 세 겹으로 막는다: `lib/storyCtaPolicy.ts`의 vocal 가드(어떤 경로든 lesson 반환 불가),
`lib/stories.ts`의 폴백 가격 가드(vocal + lesson-monthly → recording-pro), 그리고
`content/vocalCategoryNoLesson.test.ts`(frontmatter 자체를 CI에서 검사). 보컬 글에 레슨 오퍼를
넣고 싶어지면 그건 규칙이 아니라 사실 확인이 먼저다 — 서비스 범위의 정본은 이 절과 memory
`feedback_studionol_services`이지 코드 주석이 아니다.

**라우팅 기준선 게이트.** `content/cta-routing.baseline.json`에 전 ko 스토리의 하단 CTA와
가격 카드 id 판정을 커밋해 두고, `content/ctaRouting.baseline.test.ts`가 현재 판정과 대조한다.
`storyCtaPolicy`·`storyAutoFallback`·frontmatter(`cta`·`inlineFallback`) 중 무엇을 바꾸든
판정이 달라진 글이 있으면 CI가 서고, 그 목록을 카테고리 × from→to로 보여준다. 위 76편
사고는 이 대조 한 번이면 즉시 보였을 일이다. 의도한 변경이면 `--update`로 기준선을 갱신하되
**같은 커밋에 "왜 이 글들의 목적지가 바뀌는지"를 적을 것** — 기준선 갱신을 이유 없이 끼워
넣으면 게이트가 무력화된다.

**정책 주석은 사업 사실을 뒤집을 수 없다.** 이 사고의 직접 원인은 "보컬 테크닉은 lesson이
의도에 더 맞는다"는 AI 작성 주석이었다. 그럴듯한 주석 한 줄이 `storyAutoFallback.ts`에
이미 적혀 있던 올바른 규칙("보컬 발성 코칭은 미제공")과 같은 저장소 안에서 공존했다. 라우팅·
오퍼 정책을 바꿀 때는 먼저 이 파일과 memory에서 사실을 확인하고, 규칙은 주석이 아니라
테스트로 고정할 것.

### 중복 콘텐츠 게이트가 두 겹인 이유

`scan-near-duplicates.mjs`는 **문서 전체** Jaccard 0.45로 본다. 2,400자 글에서 380자
섹션이 겹치는 정도는 이 임계에 닿지 않아, 워드카운트 패딩 스크립트(`scripts/archive/`의
`fix-topic-wordcount.js` 계열)가 심은 동일 섹션이 수백 편에 쌓이는 동안 한 번도 안 걸렸다.
2026-08-28에 290편에서 12.1만자를 걷어냈고, 재발 방지로 `check-duplicate-sections.mjs`를
CI에 넣었다 — 섹션 해시가 파일 간 같으면 잡는다.

`scan-near-duplicates.mjs`는 실행한 달 이름으로 리포트를 쓴다(`docs/near-duplicate-scan-YYYY-MM.*`,
`--month`로 지정 가능). 예전엔 2026-07 파일에 하드코딩돼 있어 돌릴 때마다 비교 기준인 과거
스냅샷을 덮어썼다 — 개선 효과는 회차 비교로만 보이므로(2026-07 81건 → 2026-08 31건) 이전
파일이 남아야 한다. 생성물이라 손으로 고치지 말 것: 다음 실행에 지워진다.

기준선(`content/duplicate-sections.baseline.json`) **대비**로 판정한다. 절대 임계면 아직
정리 안 된 기존 중복 때문에 CI가 계속 빨갛다. 새 그룹이 생기거나 기존 그룹이 커지면 실패,
줄어드는 건 항상 통과. 의도한 증가라면 `--update` 후 이유를 커밋에 남길 것.

**같은 안내를 여러 글에 넣어야 하면 복붙 대신 숏코드 컴포넌트를 쓴다**
(`%%session-checklist%%`·`%%studio-more%%`). 새 숏코드를 만들면 세 곳을 함께 고쳐야 한다 —
`MarkdownRenderer` 배선, `lib/storyContentPolicy.ts`의 글자수 추정, `content/factGuards.test.ts`
화이트리스트. 추정치는 **컴포넌트가 실제 렌더하는 분량 실측값**으로 넣을 것: 이 값이 thin
판정에 직접 들어가서, 과대 계상하면 thin 페이지가 색인 대상으로 잘못 분류된다(실제로
session-checklist가 실측 160자인데 420으로 잡혀 있었다).

### lastmod 정책 (사이트맵 freshness)

`<lastmod>`는 **절대 파일 mtime에서 오면 안 된다.** git은 mtime을 보존하지 않고 Vercel은
얕은 클론이라, mtime을 쓰면 배포할 때마다 전체 URL이 같은 순간을 "방금 수정됨"으로 주장한다.
Google은 lastmod을 "consistently and verifiably accurate"할 때만 사용하므로 신호가 통째로 폐기된다.

| 대상 | 소스 | 생성 |
|---|---|---|
| 스토리 1,000+편 | frontmatter `lastmod` → `date` | `scripts/backfill-story-lastmod.mjs` |
| 정적 페이지 22 라우트 | `lib/sitemap/pageLastmod.json` | `scripts/generate-page-lastmod.mjs` |
| 카테고리 허브 | 소속 스토리 lastmod의 최댓값 | 자동 |

두 경로 모두 mtime은 **항목이 없을 때의 폴백**으로만 남아 있다. 로컬에서는 파일마다 mtime이
달라 이 버그가 드러나지 않으므로, 검증은 반드시 프로덕션 사이트맵으로 할 것.

**생성기 실행 후에는 diff를 반드시 눈으로 거를 것.** `scripts/generate-page-lastmod.mjs`는
"파일을 건드린 마지막 커밋"만 보므로, 콘텐츠와 무관한 일괄 수정도 날짜를 끌어올린다.
실제 사례: `85178f14ad`(OG 이미지 WebP→JPEG revert)가 14개 페이지의 `ogImage` 한 줄씩을
바꿔서, 그 뒤 생성기를 돌릴 때마다 무관한 13개 라우트가 `2026-08-20T08:00:10`으로 함께
올라온다. 그대로 커밋하면 사이트맵 14개 URL이 같은 순간을 "방금 수정됨"으로 주장하게 되고,
이 절이 막으려는 상태로 정확히 되돌아간다. **이번 커밋이 실제로 바꾼 라우트만 남기고
나머지는 `git checkout -- lib/sitemap/pageLastmod.json` 후 해당 항목만 손으로 옮길 것.**

알려진 한계: 페이지 카피만 `public/locales/*/common.json`에서 고치면 날짜가 오르지 않는다.
common.json은 전 페이지 공유 파일이라 반영하면 카피 한 줄에 모든 페이지가 갱신 처리되어
원래 문제로 돌아간다. 과소보고는 안전한 방향이라 의도적으로 감수한다 — 크게 개편했다면
`pageLastmod.json`의 해당 날짜를 손으로 올려도 된다.

### 스토리 프리렌더는 번역이 있는 로케일만 (빌드 곱집합 금지)

`getStoryPaths`(`lib/stories.ts`)는 **원문 파일이 있는 (슬러그, 로케일) 조합만** 반환한다.
번역이 없는 로케일은 ko 본문을 대신 보여주는 폴백이고, 그 렌더는 robots를
`noindex, follow`로 내리고 canonical을 원본 로케일로 돌린다. 사이트맵도
`getIndexableStoryLocales`로 같은 조합만 싣는다 — 즉 폴백 페이지는 어떤 색인 경로에도
없다. 예전엔 슬러그 × 7 로케일을 전부 반환해서, 매 빌드마다 색인 대상이 아닌 페이지를
6,000장 넘게 만들고 있었다(12,355장 → 1,276장, 2026-09-04).

**`fallback: 'blocking'`은 목록에 **없는** 경로만 지연시킨다.** 목록에 넣은 경로는
`fallback` 설정과 무관하게 빌드 때 전부 만들어진다 — 흔한 오해라 여기 적어 둔다.
목록에서 뺀 조합은 첫 요청에 생성돼 ISR로 캐시된다(실측 첫 요청 90ms, 이후 4ms).

`lib/stories.test.ts`가 두 가지를 막는다: 원문 없는 조합이 목록에 들어오는 것, 그리고
곱집합으로 되돌아가는 것. 번역을 새로 추가하면 자동으로 프리렌더 대상이 되므로
손댈 것이 없다.

관련 규칙: **로케일 전환 링크에는 `prefetch={false}`를 유지할 것**
(`components/LanguageSwitcher.tsx`). 메뉴를 열면 현재 페이지의 나머지 6개 로케일이
동시에 viewport에 들어와, 폴백 페이지의 온디맨드 생성을 무더기로 유발한다.
`StoryCard`·`StoryCTA`와 같은 판단이며 hover/focus prefetch는 유지된다.

## Architecture & Data Flow

### Image Optimization System
The project uses a custom optimization script `scripts/optimizeImages.js`:
1. **Source**: Original images in `public/images/`
2. **Process**: Converts JPG/PNG to WebP and AVIF (using Sharp)
3. **Artifacts**: Generates `utils/imageMetadata.json` for dimension hints
4. **Usage**: Use optimized formats (.webp/.avif) in content for better performance

### Contact Form Logic
- **Client**: `pages/[locale]/contact.tsx` captures user input
- **Server**: `pages/api/contact/send-email.ts` (API route)
- **Validation**: Honeypot and Rate Limiting implemented on server-side
- **Delivery**: Server-side request to Resend REST API (`lib/email/resend.ts`)

### Routing & i18n
- **Path structure**: `/[locale]/[path]`
- **Locale management**: `lib/i18n.ts` and `utils/localeUtils.ts`
- **Dynamic Routes**: Stories are loaded from `content/stories/` based on slug and locale

## Important Files & Directories

- `pages/[locale]/` - Localized page components
- `pages/api/` - Backend API routes (Serverless functions)
- `components/` - Reusable UI components
- `content/stories/` - Markdown files for studio news and stories
- `lib/i18n.ts` - Internationalization configuration
- `tailwind.config.ts` - Design system (colors, typography)
- `next.config.mjs` - Next.js configuration

## Liquid Glass 재질 시스템 (디자인 리뉴얼)

iOS 26 리퀴드 글래스 스타일 리뉴얼의 재질 레이어. **성능 예산제**로 운영한다 —
이 프로젝트는 iOS Safari GPU/PSI 때문에 blur를 걷어낸 이력이 있으므로(아래 표 참조)
글래스 확대 적용 전 반드시 PSI 모바일 실측을 거칠 것.

- **토큰**: `styles/globals.css`의 `--glass-*` CSS 변수 (라이트/`.dark` 분기 포함)
- **클래스**: `tailwind.config.ts` 플러그인의 `.glass-regular`(기본 표면),
  `.glass-menu`(텍스트 밀도 높은 플로팅 메뉴 전용 — 틴트 0.88, DropdownMenu·
  LanguageSwitcher. 큰 컬러 타이포그래피 위에서 0.72는 비침이 레이블과 경쟁),
  `.glass-clear`(화려한 배경 위 소수 요소 전용, 뷰포트당 1–2개), `.glass-bar`(전폭
  sticky 바 — border·그림자는 컴포넌트가 직접 관리)
- **자동 폴백** (토큰 교체만으로 전체 강등, 컴포넌트 코드 무변경):
  1. `prefers-reduced-transparency` (OS 접근성)
  2. 터치 기기 + `max-width: 768px` — 1차 릴리스는 **모바일 전체 솔리드**
  3. 킬스위치: `NEXT_PUBLIC_DISABLE_GLASS=1` → `_document.tsx`가 `<html data-glass="solid">` 부여
- 솔리드 폴백 값은 기존 `bg-white/95`·`dark:bg-gray-900/95`와 동일 — 강등 시 리뉴얼 이전 모습으로 복귀
- `-webkit-backdrop-filter` 프리픽스는 tailwind.config의 .glass-* 컴포넌트 클래스에 **명시적으로** 둔다.
  autoprefixer는 이 컴포넌트 클래스들에 프리픽스를 일관되게 안 붙인다(빌드 CSS 감사에서
  glass-regular만 붙고 glass-clear·glass-bar 누락 확인). Safari 16–17 데스크톱 blur에 필수라 수동 유지.
- 가드레일: 뷰포트당 상시 고정 blur 레이어 ≤ 2, 본문 텍스트는 글래스 위에 직접 올리지 않기,
  글래스 위 텍스트 대비 AA(4.5:1) 유지

적용 현황:
- Phase 1: DropdownMenu, LanguageSwitcher, SectionAnchorNav, PortfolioDetailModal 헤더
- Phase 2: Header 반응형 — 모바일/태블릿(<lg) 전폭 글래스 바(전폭 MobileNav와 정합),
  데스크톱(lg+) 플로팅 pill. 두 경우 모두 하단선 64px(모바일 h-16 / 데스크톱 pt-2+h-14)로
  MobileNav `top-16`·scroll-mt 오프셋과 정합. backdrop-filter는 안쪽 바 div에만
  (header에 주면 MobileNav fixed containing block이 깨짐). Button `glass` variant,
  ScrollToTop. **투명 헤더 CTA는 glass 토큰이 아니라 고정 반투명 `bg-white/15`+`text-white`**
  — glass-clear는 모바일 폴백 시 불투명 흰색이 되어 흰 글씨가 사라진다(히어로 위 오버레이엔 부적합).
  **KakaoFab은 의도적으로 솔리드 옐로 유지** — 전환 핵심 브랜드 버튼 + blur 예산
  (상시 고정 레이어 ≤2: 헤더+ScrollToTop) 준수.
- Phase 3: BaseCard `glass`/`glass-highlight` variant(FeatureCard·PricingCard 적용,
  PricingCard는 동심원 라운드 24px/12px). **인플로우 카드는 `.glass-card` — blur 없는
  글래스**(정적 배경 위 backdrop-filter는 시각 이득 0에 GPU만 소모). glass 카드는
  hover 시 SHADOW_HOVER를 섞지 않는다(inline boxShadow가 inset 스펙큘러를 지움).
  AudioPlayer 대형 패널 2개의 무의미 backdrop-blur 제거(앨범아트 위 배지는 유지).
- Phase 4: BaseCard `default`/`highlight` 재질을 글래스로 전환(전 소비처 일괄 —
  .glass-card는 blur 무비용이라 안전). 스펙큘러 포인터 하이라이트(.glass-card::after,
  hover 기기 한정, --glass-glow는 솔리드 폴백에서 transparent), 클릭 카드 press
  스케일(0.98/0.1s), Button glass variant press(active:scale-[0.97]).
  카드 hover에 SHADOW_HOVER 금지 원칙은 전 glass variant로 확대.
- 남은 솔리드: outline variant, 모달 본문 패널, StoryCard(BaseCard 미사용), KakaoFab.
- **성능 실측 완료 (2026-08-05, 프로덕션)**: lighthouse devtools 스로틀 기준
  모바일 홈 96 · practice-room 95 · story 94 · pricing 92 (LCP 전부 1.8s),
  데스크톱 홈(글래스 blur 전면 활성) 100 · TBT 0ms · CLS 0. CDN TTFB 58~67ms HIT.
  글래스 리뉴얼 성능 회귀 없음 — 배포 게이트 통과. 익명 PSI API는 쿼터로 실패했으니
  재측정 시 `--throttling-method=devtools` 로컬 측정을 쓸 것(방법론: PSI 메모리 참조).

## 카카오 CTA 배색 규칙

카카오톡은 GA4 기준 검증된 유일 전환 채널인데, 예전엔 같은 오픈채팅으로 가는 링크가
위치마다 색이 달랐다(옐로·보라 그라디언트·반투명 검정·흰색·보라·앰버·yellow-400 — 7종).
`#FEE500`은 KakaoFab 한 곳뿐이라 방문자가 "노란 건 카톡"을 학습할 기회가 없었다.
아래 규칙으로 진입점을 통일했다.

- **토큰**: `tailwind.config.ts`의 `kakao`(`#FEE500`) / `kakao-dark`(`#FADA0A`, hover) /
  `kakao-ink`(`#191600`, 옐로 위 텍스트·아이콘·focus ring)
- **단일 규칙(양방향)**: 목적지가 카카오톡인 링크는 **전부** 옐로, 카카오가 아닌 링크에는
  **절대** 옐로를 쓰지 않는다. 이 규칙이 깨지는 순간 노란색의 신호 가치가 사라진다.
  - 비-ko 로케일은 같은 자리라도 목적지가 `/contact` 폼이므로 옐로 금지 —
    `ContactCTA`·`ReleaseHeroCtas`가 `isKorean`/locale로 분기한다.
  - `PricingCard`는 `isKakaoCta`(ctaHref에 'kakao' 포함)로 분기. 카드 5장이 나란히
    노란 CTA인 건 의도 — 상품은 달라도 행동은 하나다.
- **옐로 위 글씨는 항상 `text-kakao-ink`.** 흰 글씨는 대비 1.3:1로 WCAG 미달이라
  올릴 수 없다. `#191600` on `#FEE500`은 약 16:1.
- **히어로 위계**: 1차(카카오)가 옐로면 2차는 솔리드 `bg-primary`를 쓰지 않는다 —
  어두운 히어로 사진 위에서 채도 높은 보라가 옐로와 경쟁해 위계가 뒤집힌다.
  2차는 `bg-black/30 + border-white/40 + text-shadow` 스크림 아웃라인
  (홈 히어로·ReleaseHeroCtas 공통). 흰 틴트(`bg-white/*`)는 배경을 밝혀
  흰 글씨 대비를 오히려 떨어뜨리므로 쓰지 않는다(HeaderActions와 동일 판단).
- 적용: HeaderActions, KakaoFab, 홈·pricing 히어로, HeroKakaoCta(onImage/onSurface 공통),
  ContactCTA, ReleaseHeroCtas, PricingCard, StickyBottomCTA, Inline{Booking,Price,Service}Callout,
  {Korean,English}FastContactActions, ContactFormCard, ContactFormErrorFallback,
  서비스 페이지(recording·lesson·voice-acting·wedding-song·cover-video) 섹션 CTA
- **헤더 CTA는 투명 상태에서도 옐로**(`kakaoCtaButtonClass`). 솔리드 옐로는 배경 사진
  밝기와 무관하게 `kakao-ink` 대비가 16:1로 고정되므로, 밝은 히어로에서 흰 글씨가
  흐려지던 스크림 방식보다 안정적이고 text-shadow도 필요 없다. 비-ko는 목적지가
  `/contact` 폼이라 기존 그라디언트/스크림을 그대로 쓴다(`formCtaButtonClass`) —
  헤더는 이 규칙의 ko/비-ko 분기가 가장 눈에 띄는 자리다.
- **미적용(의도)**: `ContactInfoCard`·`about` 연락처 카드는 버튼이 아니라 텍스트/카드형
  링크라 제외. `StoryCTA`의 amber는 스토리 테마 색이지 카카오 신호가 아니므로 건드리지 않는다.

### 소셜 발행 (Instagram·Threads API)

`scripts/social/post.mjs --slug <s> [--dry-run]`로 스토리 한 편을 두 플랫폼에 올린다. 상세는
`docs/social/README.md`. 기억할 것: Meta는 **HTTPS redirect만** 받아 OAuth는 `auth.mjs`가
URL 출력 → 사이트로 돌아온 `?code=`를 `--code`로 넘기는 2단계다. Instagram은 **JPEG 공개 URL만**
받으므로 OG 카드(PNG)를 sharp로 바꿔 Blob에 올린다. **영구 토큰은 없다** — 60일 장기 토큰을 무제한 연장할 뿐이고 만료 후엔 재승인만 남는다.
토큰은 env가 아니라 Turso `social_tokens`에 있고(Vercel env는 배포 시점에 박혀 갱신값을 못 본다),
Vercel Cron `/api/cron/social-refresh`가 주간 갱신한다. 앱 ID·시크릿은 Vercel env → `vercel env pull`.
발행 원장 `docs/social/posted.json`이 중복 발행을 막는다. 반응 확인·답글은 `inbox.mjs`(자동 답글 없음,
IG DM은 모바일 앱의 "메시지 액세스 허용" 토글 필요), 지표 적재는 `insights.mjs`.

## SEO·GA4·GSC 분석 규칙 (오진 재발 방지)

**데이터를 열기 전에 반드시 먼저 실행한다:**

```bash
node scripts/seo-preflight.mjs        # 최근 커밋·열린 실험·관측창·판독 함정
```

2026-08-14~18 라운드에서 같은 유형의 오진이 네 번 났다. 전부 데이터 해석 실력이 아니라
**"데이터를 읽기 전에 확인했어야 할 것을 안 읽어서"** 났다. 프리플라이트가 그 확인을 대신한다.

- 의도적 noindex(`8621b269da`, 경쟁자 대상 콘텐츠)를 "고칠 문제"로 보고
- 2026-08-04에 이미 고친 폼 오류(`780a1631cb`)를 "현재 문제"로 보고
- 진행 중인 전환 작업(7/26~8/4, 8/17 `93b788596a`)과 같은 내용을 "남은 갭"으로 제안
- 90일 스냅샷 두 개를 빼서 "증분"이라 부르고 "타이틀 수술 실패" 결론 — 기간지정으로 다시 재니 5편이 +34~+546% 성공

### 절대 규칙

1. **문제를 발견하면 먼저 `git log --oneline -S"<키워드>"`.** 이미 처리됐는지 확인하기 전에는
   보고하지 않는다. 이 저장소는 SEO 작업이 활발해서, 발견한 문제 상당수가 이미 처리 중이다.
2. **`docs/gsc-raw`·`docs/ga4-raw`는 90일 누적 스냅샷이다.** 최근 3주 작업의 효과는 거의 안 보이고
   이미 고친 문제가 미해결로 보인다. 최근 상태를 알려면 기간을 좁혀 직접 질의한다.
3. **두 스냅샷을 빼서 "증분"이라 부르지 않는다.** 창 뒤끝에서 빠져나간 기간이 섞인다.
   실험 판정은 `node --env-file=.env.local scripts/ctr-verdict.mjs`로 — 기간지정 + 대조군 + 노출 정규화.
4. **CSV 집계는 `#` 앵커 행 제외 + `/ko/` 정본 필터.** 앵커는 목차 점프링크지 별개 페이지가 아니고
   (노출 ~13% 부풀림), slug로 키잡으면 uz/en 행이 ko 행을 덮어쓴다(mixing19가 9clk→0clk로 뒤집힌 적 있음).
5. **낮은 CTR·noindex·통합 제외가 전부 결함은 아니다.** 사전형 단일어 쿼리(흉성·더블링·딜레이)는
   동음이의 검색자가 다수라 구조적으로 클릭이 안 난다. 0클릭 상업 쿼리도 상품 불일치일 수 있다
   ("아이돌 연습실"=댄스 연습실, "합주실 대여"=시간제 합주실 — 둘 다 우리 상품이 아니다).
6. **GA4 `landing.csv`(랜딩 기준)와 `events.csv`(클릭 발생 page_path 기준)를 나눠 전환율을 만들지 않는다.**
   그건 트래픽 품질 비교가 아니라 귀속 산출물이고, 그 동선은 `f549323537`·`9546332e18`로 의도적으로
   배선한 것이다. "/stories/ 0.55% vs practice-room 6.79%"를 스토리 결함 근거로 쓰면 오독이다.
7. **GSC 쿼리 차원 합계는 익명화로 과소집계된다**(28일 1,112 vs 실제 5,385클릭). 헤드라인 총계는
   차원 없는 조회나 device/searchType 합계를 쓴다.

측정 중(🔒) 실험과 308 관측창(통상 2~4주) 안에서는 해당 페이지의 타이틀·본문·H2를 수정하지 않는다 —
효과가 교락돼 둘 다 판정 불가가 된다. 무엇이 열려 있는지는 프리플라이트가 알려준다.

## Next.js Experimental Flags

`next.config.mjs` `experimental` 블록 결정 사항 — 이유 없이 건드리지 말 것:

| 플래그 | 상태 | 이유 |
|--------|------|------|
| `optimizePackageImports` | **활성** (7개 라이브러리) | `lucide-react`, `framer-motion` 등 barrel import tree-shaking |
| `optimizeCss` (critters) | **비활성** | PSI 모바일 점수 85→38 급락, TBT 260→7,130ms. Next.js 15 + React 19 + Pages Router 조합에서 불안정 |
| `nextScriptWorkers` (Partytown) | **비활성** | TBT 260→1,990ms 회귀 확인 |

## 의존성 버전 고정 정책

`next`·`react`·`react-dom`은 **캐럿 없이 정확한 버전으로 고정**한다. 특정 버그를 피하려는
것이 아니라, 세 패키지가 함께 움직여야 하기 때문이다(`f2accd09f2` Next 15 + React 19
atomic update에서 이 방식으로 전환). 따라서 **같은 minor 안의 패치 상승은 정책 위반이
아니다** — 실제로 `701233f0ac`에서 15.5.12 → 15.5.18로 올린 전례가 있다.

- 패치 상승(15.5.x → 15.5.y): 보안 권고가 있으면 올린다. 검증은
  `type-check` → `lint` → `test` → `build` → `middleware.test.ts` 순.
  **미들웨어에 `NextURL.pathname` setter 버그 워크어라운드가 있으므로**
  (`middleware.ts:207`, `701233f0ac`) 업그레이드 후 반드시 `middleware.test.ts`를 확인할 것.
- minor·major 상승: PSI 실측 없이 올리지 않는다(`optimizeCss`·Partytown 회귀 이력 참조).

`npm audit`에 남아 있는 항목과 남겨둔 이유:

| 패키지 | 경로 | 왜 안 올렸나 |
|---|---|---|
| `sharp` <0.35.0 | next 내부 + @vercel/og 내부 | 직접 의존은 0.35.3으로 올림(2026-08-24, libvips CVE 4건 해소 — `scripts/optimizeImages.js` 회귀 검증: WebP 표본 8개 파일 크기 델타 0.0%, 해상도·`imageMetadata.json` 불변). next(`^0.34.3` 고정, 15.5.x 라인 유지 중)와 `@vercel/og@0.11.1`이 각자 옛 sharp를 물고 있어 audit엔 여전히 뜬다 — 둘 다 major 업 없인 못 바꾼다(`@vercel/og@1.0.1`은 sharp를 아예 뺐지만 별도 업그레이드 필요, 이번 범위 밖). next 경유는 이미지 최적화 API 라우트에서만, @vercel/og 경유는 OG 이미지 생성에서만 타서 우리 직접 파이프라인과 무관 |
| `postcss` 8.4.31 | next 내부 번들 | 우리 직접 의존은 8.5.26으로 올림. next 번들본은 major 업 없이는 못 바꾼다. 빌드타임 CSS만 처리하고 입력이 우리 소스라 실위험 낮음 |
| `js-yaml` 3.x | gray-matter | frontmatter 파싱. 입력이 우리 저장소의 .md라 외부 입력 없음 |
| `ip-address` | puppeteer-core → socks-proxy-agent | 계약 PDF 렌더용. 프록시 경로를 쓰지 않음 |
| `undici` 6.27 | @vercel/blob | 업스트림이 올려야 함 |

## Deployment Notes

- **Hosting**: Vercel (Standard Next.js deployment)
- **Environment Variables**: Configure `RESEND_API_KEY` (and optional `RESEND_FROM`) in Vercel dashboard
- **Build**: Prebuild hook runs image optimization automatically