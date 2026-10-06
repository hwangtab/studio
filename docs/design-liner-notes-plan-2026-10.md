# 라이너 노트 디자인 설계 — 사진·활자·색·소리 (2026-10-06)

2026-10-05 프로덕션 12페이지(1440·390, 라이트·다크)를 전부 찍어 본 뒤 운영자가 "제안대로 하고
싶다"고 해서 적는 **구현 설계**다. 정본은 여전히 `docs/design-system.md`이고, 이 문서는 그 정본의
토큰·컴포넌트 값을 **무엇으로, 어떤 순서로, 어떤 게이트를 지나며** 바꾸는지 적는다. 끝나면
design-system.md의 §1·§2·§3·§7을 이 문서 값으로 개정한다.

## 0. 한 줄

사이트의 뼈대(토큰·가드·프리미티브·홈 v2 문법)는 두고 **재료 넷**을 바꾼다. 사진(히어로 12장 교체),
활자(제목만 세리프 한 종), 색(보라 → 로고의 짙은 녹색, 순백 → 종이), 소리(끊기지 않는 미니 플레이어와
LP마다 30초). 방향 이름은 **라이너 노트** — 음반 속지처럼 종이 위 잉크, 진짜 사진 한 장, 큰 세리프
제목, 트랙리스트.

## 1. 진단 (2026-10-05 실사)

심각한 순서다. 근거는 전부 프로덕션 캡처와 코드에서 직접 확인한 것.

1. **히어로 사진.** 1280×720·품질 60으로 나간다(`ImageHero` `quality={60}`, `sizes` 상한 1280). 폰으로 찍은
   텅스텐 혼합광 사진 위에 검정 40~45% 스크림. 같은 사진을 쓰는 페이지 쌍이 넷 — `recording1`(녹음·포트폴리오),
   `recording15`(소개·아티스트), `studio1`(스토리 목록·작가·스토리 상세 폴백 1,000여 편), `hardware1`(장비·작곡편곡).
2. **히어로 합성이 전 페이지 동일.** 가운데 정렬 흰 h1 + `drop-shadow-lg` + 노란 알약 + 스크림 아웃라인 + 5초
   `hero-zoom`. 서비스가 아홉 개여도 사이트는 한 장으로 기억된다.
3. **보라는 로고와 무관.** `public/logo/logo.png` 픽셀 평균은 녹색 `#0e3c26`·노랑 `#fcd000`. primary는 violet-700
   `#6d28d9`. 보라와 카카오 노랑은 보색이라 한 화면에서 늘 경쟁하고 그 조합이 "SaaS 랜딩"으로 읽힌다.
4. **활자에 목소리가 없다.** Pretendard 700 하나가 h1·h2·카드 제목·버튼을 다 맡는다.
5. **노랑과 카드 과잉.** `PricingCard`가 카카오 목적지면 솔리드 옐로를 그리므로 한 행에 노랑 셋, 가격 페이지는
   카드 7장에 노랑 7개. LP 구조는 전부 FAQ 카드 3 → 가격 카드 3~4 → 단계 카드 4 → 파일 카드 2. 배지는 영문
   `RECOMMENDED`(`PricingCard.tsx:113`, i18n 키 없음).
6. **들을 것이 없다.** 음원은 믹싱 전·후(4곳)와 포트폴리오 샘플 3곡(`data/portfolio/tracks.ts`)뿐. 녹음·축가·성우·레슨
   LP는 음원 0, 영상 0. 포트폴리오 플레이어는 LP판을 돌리는 스큐어모픽.

그밖에: `/artists`는 메인 메뉴에 걸린 빈 페이지. 연습실 첫 화면에 "월 36만원"이 세 번. 가격 페이지 모바일은
세로 59,238px인데 구역 이동 칩이 본문 아래 묻혀 있다. 스토리 인라인 콜아웃은 아직 핑크 틴트. 성능은
PSI simulate 중앙값 70·LCP 5.9s(CrUX는 통과) — 히어로 사진이 LCP 후보다.

**건드리지 않는 것**: 카카오 옐로 양방향 규칙, 홈 v2 문법, 토큰·접근성·속도 가드, h1 문장(검색 타이틀),
로고, 다크 기본값(D안 기각), 페이지 전환 애니메이션(AnimatePresence 제거), 글래스 모바일 솔리드 폴백.

## 2. 원칙

1. 사진이 주인공, 글자는 사진을 가리지 않는다. 글자는 잉크 면에, 사진은 사진 면에.
2. 한 화면에 고채도는 하나 — 카카오 노랑. 나머지는 잉크·종이·놀 그린.
3. 제목은 세리프, 본문·버튼·숫자는 Pretendard. 세리프 숫자는 가격표에서 약하다.
4. 카드 대신 괘선. 떠 있는 상자는 "고르는 것"(티어·리워드·시간 슬롯)에만.
5. 소리는 항상 한 번의 탭 거리에.

## 3. 설계

### 3-1. 색 — 잉크·종이·놀 그린

로고 녹색을 primary로, 순백을 종이로. 값은 전부 WCAG 2.x 산식으로 계산했다(흰 `#fff`, 종이 `#faf7f2`,
다크 바탕 gray-900 `#030712`).

| 토큰 | 지금 | 제안 | 대비 |
|---|---|---|---|
| `primary.DEFAULT` | `#6d28d9` (흰 7.10) | **`#166534`** | 흰 7.13 · 종이 6.67 → 텍스트·링크·선택·링 |
| `primary.light` | `#7c3aed` | `#15803d` | 흰 5.02 · 종이 4.69 → 작은 텍스트 금지(지금 primary-light와 같은 규칙) |
| `primary.dark` | `#5b21b6` | **`#0e3c26`** (로고 실측) | 흰 글씨 12.4 → 히어로 잉크 면·solid hover·큰 면 |
| `primary.lighter` (다크 텍스트 짝) | `#a78bfa` (7.40) | **`#6ee7b7`** | gray-900 위 13.2 |
| `secondary.*` | 핑크 | primary와 같은 값으로 **재매핑** | 24파일 66곳이 쓴다. 이름은 두고 값만 합친 뒤 4주차에 클래스를 primary로 치환하고 토큰 삭제 |
| `accent.*` (성공) | 에메랄드 | primary와 같은 값 | 성공 = 브랜드색. `accent-light`(다크 텍스트 13곳) = `#6ee7b7` |
| 라이트 바탕 | `bg-white` / `gray-50` | **`paper` `#faf7f2`** / `paper-2` `#f2ede4` | 새 토큰 `colors.paper` |
| 다크 바탕 | gray-900 | **그대로** | 녹색 기운 잉크(`#0c110e`)는 열린 결정 §7 |
| `--primary-rgb` | 109,40,217 | 22,101,52 | tap-highlight·blockquote 테두리 |
| `--hero-title-accent` / glow | `#a8c0ff` / 흰 0.3 | `#6ee7b7` / 흰 0.25 | sleeve 히어로에서만 |
| theme-color(meta·manifest) | 보라 | `#0e3c26` (다크 gray-900) | |

포커스 링은 합성색으로 다시 쟀다(§5 규칙 3:1): `ring-primary/70` on 흰 = `#5c9371` → **3.59**, on 종이 **3.35**;
`ring-primary-lighter/70` on gray-900 = `#4ea485` → **6.6**. 전부 통과. `Button` solid(흰 on `#166534` 7.13, hover
`#0e3c26` 12.4), outline(`text-primary` 7.13 / `dark:text-primary-lighter` 13.2)도 통과.

**바꾸는 파일**

- `tailwind.config.ts` — `colors.primary/secondary/accent` 값, `colors.paper` 추가.
- `styles/globals.css` — `--primary-rgb`, 히어로 변수, body `bg-white` → `bg-paper`, v2 스코프의 하드코딩
  `#6d28d9`(446·485행)·`#a78bfa`(484행) → `theme('colors.primary.DEFAULT')` 대신 변수 `--brand`·`--brand-on-dark`로 뽑아 쓴다.
- `components/ui/Section.tsx` — `bg-white` → `bg-paper`, alternate `bg-gray-50` → `bg-paper-2`. 다크는 그대로.
- 하드코딩 hex 청소 13파일: `Button.tsx`(주석), `Layout.tsx`·`pages/_app.tsx`·`public/scripts/theme-init.js`·
  `pages/api/manifest.ts`(theme-color), `lib/contact/emailContent.ts`·`lib/contracts/email-template.ts`·
  `lib/shows/emailHtml.ts`(메일 버튼색 — 메일은 토큰이 없으니 상수 하나 `lib/brandColor.ts`로), `utils/portfolioDataUtils.ts`,
  `data/portfolio/categories.ts`, `scripts/naver-price-card.ts`, `components/ui/Button.test.tsx`.

**가드 영향** — `tailwind.config.test.ts`의 세 라운드(다크 짝 존재·충분성·variant 덮어쓰기)와 포커스 링 알파 가드는
토큰 **이름**을 보고, 대비 계산은 값을 읽는다. 위 값은 전부 그 기준으로 통과한다. `SectionHeading.test.tsx`의
v2 색 규칙(secondary·accent 클래스 금지)은 값 재매핑과 무관하게 초록이다. 비주얼 샷 기준선은 전부 갱신.

### 3-2. 활자 — Hahmlet, 제목에만

**서체**: Hahmlet (OFL 1.1, `google/fonts/ofl/hahmlet/Hahmlet[wght].ttf`, 가변 100~900). 실측(2026-10-06):

| 항목 | 값 |
|---|---|
| 한글 완성형 수록 | 2,788자 (KS X 1001 2,350 포함) |
| 7개 로케일 `*title*|*heading*` 키 글자 1,434자 중 빠지는 한글 | **0자** |
| 현재 hero 글자 484자 중 빠지는 글자 | 157자 — 전부 th·zh 문자. 지금도 `--font-locale`로 간다 |
| 서브셋 woff2: hero 글자만, 정적 800 | 42KB |
| 서브셋 woff2: ko 제목 글자 568자, 정적 700 | **65KB** |
| 서브셋 woff2: 같은 글자, 가변 600~800 | 119KB |

대안은 마루 부리(네이버, 더 부드럽다)와 Paperlogy(기하 산세리프). 결정은 §7.

**적용 범위**: `ImageHero` h1(`font-hero`)과 v2 섹션 제목 `.typo-display-section` **둘만**. `.typo-card-title`·
`typo-page-title`·버튼·숫자·스토리 마크다운 제목은 Pretendard 그대로(design-system §9 "다른 타이포 영역").

**파일 하나, 정적 700, preload** — 지금 hero 서브셋(36KB, preload)을 **65KB 하나로 대체**한다. 두 파일로 가르면
섹션 제목이 본문 폰트로 먼저 그려졌다가 바뀐다. 65KB가 simulate LCP를 흔들면(§5 게이트) hero 글자만 담은
42KB preload + 제목 65KB 지연의 두 파일로 가른다.

**파이프라인**: `scripts/generate-hero-font.mjs`를 `scripts/generate-display-font.mjs`로 일반화한다.
- 소스: jsdelivr의 Pretendard-Bold.otf 대신 `lib/fonts/hahmlet-variable-full.ttf`(3.5MB, commit — body 폰트의
  `pretendard-variable-full.woff2`와 같은 처리). 네트워크 의존 없음.
- 글자 수집: 지금의 hero 키 정규식 + `*.title`·`*.heading`·`*.eyebrow` 키 전부(7 로케일) + `data/home.ts`
  heroContent + `data/*.ts`의 `sectionTitle|title` + `stories.categories.*`. th·zh 문자는 제외(로케일 폰트).
- `subsetFont(src, text, { targetFormat: 'woff2', variationAxes: { wght: 700 } })` → `lib/fonts/display.woff2`
  + `display.chars.json` 사이드카. `--check`와 `hero-font-subset.test.js`는 파일명만 바꿔 그대로 쓴다.
- `lib/fonts.ts`: `pretendardHero` → `displayFont`(`--font-display`, weight 700, preload true).
- `tailwind.config.ts`: `fontFamily.hero` → `['var(--font-display)', 'var(--font-pretendard)', …]`,
  `.typo-display-section`의 `fontFamily: theme('fontFamily.hero')`, `fontWeight 700`, `letterSpacing -0.01em`(세리프는
  −0.03em이 뭉친다), `--display-lh` 기본 1.18. `ImageHero` h1의 `tracking-normal`·`style={{letterSpacing:0}}`은
  둔다.
- CI: `hero-font-subset.test.js`가 새 사이드카로 `--check`. 글자가 빠지면 Pretendard로 떨어져 보이는 결함은
  지금과 같은 방식으로 잡힌다.

### 3-3. 히어로 — `layout` 분기

`components/common/ImageHero.tsx`에 `layout?: 'overlay' | 'split' | 'sleeve' | 'board'`를 더한다. 기본값은
`'overlay'`(지금 모양)로 두고 호출부가 고른다 — 30곳 중 테스트 둘을 빼면 28곳. **h1·subtitle·ctaButtons·breadcrumbItems
prop은 그대로**라 문장은 바뀌지 않는다.

| layout | 구조 | 쓰는 페이지 |
|---|---|---|
| `split` | 데스크톱 `grid lg:grid-cols-[1.05fr_1fr] min-h-[80svh]`. 왼쪽 `bg-primary-dark`(`#0e3c26`) 잉크 면에 eyebrow·h1·subtitle·CTA를 아래 정렬. 오른쪽 사진 `fill`, `sizes="(max-width:1024px) 100vw, 50vw"`, 사진 왼쪽 가장자리에 `from-primary-dark/55 to-transparent 35%` 한 방향 워시. 모바일은 잉크 면 → 사진 `aspect-[4/5] max-h-[60svh]` 순으로 스택 | 홈, 녹음, 믹싱, 연습실, 레슨, 축가, 성우(§4 🔒), 커버 영상, 작곡편곡, 펀딩 설계, 음원 홍보, 장비 |
| `sleeve` | 전면 사진, 텍스트 블록 `max-w-3xl` 왼쪽 아래. 스크림은 두 겹 — 세로 `from-gray-950/15 via-transparent 35% to-gray-950/78 85%` + 가로 `from-primary-dark/55 to-transparent 55%`. `drop-shadow` 없음. 사진이 좋은 페이지만 | 발매 프로젝트·티어, 소개, 작가, 펀딩 목록(포스터), 공연, 스토리 상세(thumbnail 있을 때), 포트폴리오 |
| `board` | 사진 없음. 잉크 면 전폭, h1은 작게(1.25rem 세리프 600) 위에, **큰 숫자·목록이 본문** — 가격판 | 가격, 스토리 목록·카테고리, 아티스트, 연락처, 404·500 |
| `overlay` | 지금 그대로 | 이행 전 페이지. 끝나면 삭제 |

공통 변경: `hero-zoom` 클래스·keyframes 삭제. 브레드크럼은 하단 블러 바 대신 잉크 면 안(텍스트 `text-white/70`).
`HERO_SCRIM`·`HERO_SCRIM_STRONG`은 sleeve 전용으로 남기고 **사진마다 다시 잰다**(ImageHero 머리 주석의 방법,
목표 평균 6:1, 부제 AA 4.5, h1은 대형 완화 3:1). 헤더는 split에서 왼쪽은 잉크 면·오른쪽은 사진 위에 뜨므로 사진
상단에 `from-gray-950/35 to-transparent 30%` 세로 워시를 둔다(투명 헤더 흰 글씨 대비).

**가격판(board)**: h1 "녹음 시간당 10만원 · 연습실 월 36만원 · 축가 35만원"은 그대로 `<h1>`이되 1.25rem 세리프,
그 아래 `dl` 세 칸 — 라벨(세리프 0.95rem `text-primary-lighter`) + 숫자(Pretendard 800 `clamp(2rem,…,3.1rem)` tabular).
값은 `data/pricing.ts` 상수에서 `formatPriceLabel`로(가격 리터럴 가드).

**LCP**: split·board에서는 LCP 후보가 사진이 아니라 h1 글자가 된다(폰트는 preload 서브셋). 사진 면은 절반이라
바이트도 준다. 측정은 §5.

### 3-4. CTA 위계 — 노랑은 한 화면에 하나

- `PricingCard`에 `kakaoEmphasis?: 'solid' | 'band'`(기본 `'solid'`, 지금과 동일). LP·가격 페이지는 `'band'`:
  카드 안에는 카카오 CTA를 **그리지 않고** 행 아래 띠 하나로 모은다. 온라인 주문·예약 `secondaryCta`가 카드의
  **1차 solid 블록**(브랜드색)으로 올라온다. 카드 단위 카카오 추적(`<page>_price_<id>_kakao`)은 띠의 `cta_id`로 합쳐진다.
  (구현 중 바뀐 점, 2026-10-06: 처음 설계는 카드 안에 "잉크 텍스트 + 노란 칩"의 조용한 카카오 링크였으나
  `ctaButtonContract`가 카카오 목적지 = `bg-kakao` 앵커를 요구한다 — 양방향 규칙의 역방향이다. 규칙을 깨지 않고 노랑을
  줄이는 길은 개수뿐이라 띠 하나로 갔다.)
- `components/common/KakaoSectionBar.tsx` 신설: 티어 행 아래 **노란 띠 하나**. 전체가 `<a>` 하나(`Button variant="kakao"
  shape="pill" size="lg" fullWidth` 위에 문구 + 화살표), `trackLeadEvent('lead_click_kakao', { cta_id: 'tier_bar_<page>' })`.
  문구는 카드가 못 하는 말 — 믹싱 "어디에 해당하는지 모르겠다면 세션 화면을 보내 주세요", 녹음 "몇 시간 필요한지
  모르겠다면 곡 길이와 파트 수만 알려 주세요". i18n 키 `pricing.tierBar.<page>`.
- `RECOMMENDED` → i18n 키 `pricing.badge.popular`(ko "가장 많이 고르는", 7 로케일 — `content/i18nKeys.test.ts`가 키
  패리티를 본다). `Badge tone="brand"` 그대로.
- 카드 재질: `BaseCard variant="outline"` + `bg-white`(종이 위 흰 카드가 살짝 뜬다). 추천 카드만 `ring-1 ring-primary`.
  `rounded-3xl` 예외는 유지.
- 기준: **데스크톱 한 뷰포트에 솔리드 옐로 ≤ 2**(헤더 + 띠 또는 히어로). `scripts/visual`에 뷰포트당 `.bg-kakao`
  수를 세는 검사 한 줄을 더해 회귀를 잡는다.

### 3-5. 카드 → 괘선

홈 "이유" 절(`pages/[locale]/index.tsx`의 `<ol class="grid … border-t-2">`)을 `components/ui/RuleList.tsx`로 뽑는다.
props: `items: { heading; body; href? }[]`, `columns: 1 | 2 | 3`, `numbered`(aria-hidden 번호). 적용:

- `components/ui/QuickAnswers.tsx`(LP "FAQ 요약" 카드 3장) → RuleList 3열. 한 곳 고치면 LP 전부 따라온다.
- 단계 카드(믹싱 "원격 의뢰 4단계", 녹음·축가·성우 절차, `ReleaseConsultationSteps`) → RuleList `numbered`.
- "보내주실 파일" 같은 안내 2장은 `Panel`(이미 정본) 유지.
- `uiPatterns.baseline`의 7종 규칙에 걸리는 모양을 만들지 않는다(원시 h1·이모지·모션 복제 금지).

### 3-6. 소리

- **`components/audio/GlobalPlayerProvider.tsx`** — `_app`에서 `Layout` 바깥을 감싼다(라우트 이동에도 살아 있게).
  `<audio preload="none">` 하나를 소유하고 context로 `{ current, status, play(track), pause(), seek(t) }`를 준다. 재생
  전 0바이트 규칙(`MixComparePlayer`와 같다). `MixComparePlayer`·`AudioPlayer`(포트폴리오)가 재생을 시작하면 provider의
  current를 비워 두 소리가 겹치지 않게 한다(반대도 같다).
- **`GlobalPlayerDock.tsx`** — `next/dynamic` ssr:false, 첫 재생 때 로드. 데스크톱 `fixed left-6 bottom-6 z-40 hidden lg:flex`
  (카카오 FAB·ScrollToTop은 `right-6`). 모바일 `fixed inset-x-0 bottom-0 z-[45] lg:hidden` 56px 시트 —
  `MobileStickyCta`(z-50, 펀딩·공연 상세)와 `StickyBottomCTA`(스토리 상세)가 있는 페이지에서는 **숨긴다**(두 바가
  겹치지 않게; 그 페이지들은 자체 플레이어가 없다). 구성: 커버 48px · 재생 · 곡/아티스트 · "여기서 맡은 것" 한 줄 ·
  정적 파형(20개 막대, 진행분 `bg-primary-lighter`) · 시간 tabular.
- **발췌 데이터** `data/audioExcerpts.ts`: `{ id, service: 'recording'|'wedding'|'voice'|'lesson'|'release', src, title,
  credit, seconds, portfolioId? }`. LP 자리는 `components/audio/ServiceExcerpt.tsx`(접힌 한 줄 → 펼치면 재생, 믹싱
  주문 마법사 1단계와 같은 문법). 음원 파일 규격은 `public/audio/` 256k mp3 30초, 앞 0.25s·뒤 0.8s 페이드(믹싱 비교
  발췌와 같게). **음원과 동의(저작권·실연권)는 운영자 몫** — 자리를 먼저 만들고 비어 있으면 절 자체를 그리지 않는다.
- **커버 그리드 재생** — `HomeReleaseStrip`·포트폴리오 그리드의 커버에 발췌가 있으면 hover/focus 시 44px 재생 버튼
  오버레이(터치는 길게 누르지 않고 버튼 탭). 없는 커버는 지금처럼 상세로.
- **포트폴리오** — LP판 그래픽 `AudioPlayer/TrackInfo` 회전 디스크 제거. 커버 그리드 + 카테고리 필터 + 탭 재생. 목록
  행(배지·크레딧)은 상세로.
- **파형 모티프** `components/ui/WaveRule.tsx` — 정적 인라인 SVG 한 path(≈1KB, `aria-hidden`), LP 절 사이 `<hr>` 자리·
  404·빈 상태. 움직이지 않는다.
- **계측** — `utils/analytics.ts` `MicroEventName`에 `'micro_audio_play'` 추가(props `component`·`track_id`·`locale`).
  `micro_mix_compare`는 그대로. 리드 연쇄는 GA4에서 `micro_audio_play` → `lead_click_kakao` 세션 경로로 본다.
- 예산: provider는 `_app`에 들어가므로 gz +3KB 이내, dock·플레이어 코드는 첫 재생 때. TBT 변화 0 목표.

### 3-7. 사진

**브리프(반나절, 12컷)** — 미러리스 + 35/50mm, 삼각대, 텅스텐 조명 끄고 창광 또는 한 방향 LED 하나. 컷마다 3:2와
4:5(모바일 split) 두 크롭.

| # | 컷 | 쓰는 곳 |
|---|---|---|
| 1 | 부스 안 보컬을 컨트롤룸 유리 너머로 | 녹음 |
| 2 | U87 + 쇼크마운트 접사, 측광 | 녹음·성우 |
| 3 | 페이더 위의 손, 얕은 심도 | 믹싱 |
| 4 | 랙 VU 미터 접사, 바늘이 움직이는 순간 | 마스터링 |
| 5 | 통기타 세션 와이드, 부스 전체 | 발매·홈 |
| 6 | 프로듀서와 아티스트가 모니터 앞에서 듣는 뒷모습 | 발매·레슨 |
| 7 | 연습실, 창광 + 피아노, 사람 없이 | 연습실 |
| 8 | 라운지 소파와 커피, 오후 빛 | 스튜디오·소개 |
| 9 | 여기서 나온 CD·LP를 테이블에 펼친 것 | 발매·펀딩 |
| 10 | 건물 외관, 해 질 녘, 연신내 | 오시는 길 |
| 11 | 헤드폰 걸린 마이크 스탠드, 빈 부스 | 축가 |
| 12 | 패치베이·케이블 접사 | 장비·404 |

이미 좋은 컷(`hardware1` 랙, `studio4` 콘트라베이스, `recording6` 통기타, 마리코&유키에 남산)은 그대로 쓴다. 공통점은
피사체 하나·얕은 심도·방향 있는 빛이고, 새 컷도 이 셋을 지킨다.

- 보정 규칙 하나: 섀도 따뜻하게, 채도 −15, 콘트라스트 +5, 미세 그레인. 전 페이지가 한 롤처럼 보이게.
- 규격: AVIF + WebP 쌍(지금 `public/images` 규격), 1920/1280/640, 품질 65. `ImageHero` `sizes` 상한 1280 → 1920(split은
  50vw라 데스크톱 바이트가 지금보다 작다), 모바일 640 유지. `quality`는 60 유지 — next.config.mjs `images.qualities`가 [60, 75]라 목록 밖 값은 400을 돌려준다(2026-10-06 dev에서 확인). 새 사진에서 선명도가 모자라면 75로 올린다.
- **파일명에 날짜**(`hero-recording-20261020.avif`). `/images/**`는 `immutable`이라 같은 경로에 갈아 끼우면 옛 그림이
  남는다(CLAUDE.md, 두 번 겪음). OG 이미지는 별건 — 바꾸면 그쪽도 새 이름.
- 스크림 단계는 사진마다 다시 잰다(3-3).

### 3-8. 페이지별

| 페이지 | 변경 |
|---|---|
| 홈 | split. 커버 열두 장 재생. 서비스 트랙리스트 줄 끝에 시작 가격(`formatPriceLabel`). "이유"·프로듀서 절 그대로 |
| 가격 | board(가격판). 카드 7장 → 표 + 통합 패키지 셋만 카드. 모바일 상단 고정 앵커 바(`SectionAnchorNav`를 `sticky top-16`으로) |
| 녹음·믹싱·축가·성우·레슨·커버·작곡편곡 LP | split. QuickAnswers → RuleList. 단계 → RuleList numbered. PricingCard quiet + KakaoSectionBar. 발췌 자리. **성우는 §4** |
| 연습실 | split, 창광 방 사진. 첫 화면 "월 36만원" 한 번(h1만), 부제 4줄 → 2줄. eyebrow에 공실 상수(`PRACTICE_ROOM_HAS_VACANCY`) 노출 — §7 |
| 발매 프로젝트·티어 | sleeve. 나머지 그대로(이미 v2 완성도 높음) |
| 포트폴리오 | board 히어로("70+ 발매작" 숫자). 커버 그리드 + 필터 + 재생. LP판 플레이어 제거 |
| 아티스트 | 구독 아티스트 0인 동안 메인 메뉴·푸터에서 내림 — §7 |
| 스토리 | 목록·카테고리 board. 상세는 thumbnail 있으면 sleeve, 없으면 board. 인라인 콜아웃 핑크 → primary 틴트(3-1 재매핑으로 자동). StoryCTA amber는 유지 |
| 펀딩 | 목록 히어로 포스터 블러 → board + 포스터 원본 작게. 상세는 손대지 않음 |
| 예약·주문·결제·관리 | 토큰만 따라옴. 손대지 않음 |
| 헤더·푸터 | 데스크톱 글래스 필 유지. 푸터 색은 §7. 푸터 4열 링크 더미 → 2열 |

## 4. 순서·공수·게이트

PR은 작게, 하나씩 게이트를 지나 머지한다. 순수 디자인 커밋은 `[skip-indexnow]`(CLAUDE.md).

| 주 | PR | 내용 | 공수 | 게이트 |
|---|---|---|---|---|
| 1 | `feat/liner-tokens` | 3-1 전부(토큰·종이·hex 청소·theme-color) | 4h | `tailwind.config.test` · `visual:shots` 갱신 · 대비 실측(§5 Tab 방식, 라이트·다크) |
| 1 | `feat/liner-display-font` | 3-2(스크립트 일반화·서브셋·fonts.ts·typo 클래스) | 4h | `hero-font-subset.test` · simulate 5회(폰트 바이트 +29KB의 LCP 영향) |
| 1 | `feat/liner-hero` | 3-3 `layout` 분기 + 홈·가격·연습실·믹싱·녹음 적용, hero-zoom 제거 | 6h | `ImageHero.test`·`heroHeader.test` · simulate LCP ≤ 지금 · 스크림 대비 재측정 |
| 1 | `feat/liner-cta` | 3-4(quiet·KakaoSectionBar·배지 i18n·카드 재질) | 4h | `ctaButtonContract.test` · `i18nKeys.test` · 뷰포트당 `.bg-kakao` ≤ 2 |
| 2 | 촬영 → `feat/liner-photos` | 3-7. 12장 교체, sizes·스크림, 가격판·연습실 첫 화면, 스토리 카테고리별 히어로 | 촬영 반나절 + 8h | LCP 전후 · `check:dup-sections` |
| 3 | `feat/liner-audio` | 3-6 provider·dock·발췌 자리·커버 재생·포트폴리오·WaveRule·계측 | 16~20h | 재생 전 요청 0건 실측 · TBT · `_app` gz +3KB 이내 |
| 4 | `feat/liner-rulelist` | 3-5 RuleList·QuickAnswers·단계, 가격 모바일 앵커 바, 아티스트 메뉴, 푸터 2열, secondary/accent 클래스 치환·토큰 삭제 | 8~12h | `uiPatterns.baseline` · `check:cta-routing` · `SectionHeading.test` |

합계 코드 50~58h, 촬영 반나절.

**측정 중 페이지(🔒, `scripts/seo-preflight.mjs` 2026-10-05 기준)** — 성우 LP(11/11)·`recording-price1`(10/13)·통합 승자
`loudness1`·`falsetto1`·`vocal-range-extension1`(21일). 규칙은 타이틀·summary·본문 수정 금지다. 1주차 토큰·서체는
전역이라 이 페이지들에도 **동시에** 들어가지만 문장은 바뀌지 않는다. 성우 LP의 `layout` prop과 사진 교체는 페이지
파일 수정이므로 **11/11 뒤**. 시작 전에 `docs/ctr-surgery-log.md`에 "2026-10-xx 디자인 전역 변경(색·서체·히어로)"
단절 행을 적는다 — 운영자 결정(9/26)대로 관측을 기다리지 않는다.

## 5. 검증·롤백

- **무회귀 게이트** — `type-check → lint → test → build`, `npm run visual:shots`(main 대비 compare), 로컬 Lighthouse
  `--throttling-method=simulate` 5회 중앙값(홈·가격·믹싱·연습실) ≥ 70, LCP ≤ 현재, CLS 0, TBT ≤ 150ms, `_app` gz
  ≤ 76KB, CSS gz +3KB 이내(design-v2 게이트와 같다). Vercel preview는 PSI로 못 재므로 로컬 simulate.
- **대비** — design-system §5 방법(Tab으로 이동, `:focus-visible` true만, 전환 끝난 뒤 `boxShadow` 합성색)으로 라이트·다크
  8페이지. 히어로 스크림은 ImageHero 머리 주석 방법으로 사진마다.
- **골든 HTML** — 전 페이지가 v2라 `visual:golden`은 이번엔 쓰지 않는다. 대신 shots.
- **롤백** — PR 단위 revert. 토큰은 한 파일이라 되돌리기도 한 파일. 폰트는 `display.woff2`를 지우고 `fonts.ts`를 되돌리면
  Pretendard 서브셋 경로가 그대로 살아 있다. 전역 킬스위치는 두지 않는다(색 토큰을 런타임 변수로 바꾸는 리팩터는
  이번 범위 밖).
- **PR 자동병합 ≠ 배포 완료** — Vercel `list_deployments`로 READY 확인 뒤 프로덕션 확인(CLAUDE.md).

## 6. 안 하는 것

- 히어로 영상 자동재생 — 모바일 LCP·데이터. 영상은 포스터 + 탭, 그것도 음원 다음.
- 카드 그리드 스크롤 모션·패럴랙스·커서 효과 — iOS 깜빡임 이력. 모션은 제목 등장 하나.
- 세리프를 본문·버튼·숫자까지.
- 글래스 확대 — 모바일 솔리드 폴백 원칙, 종이 바탕에서는 보이지도 않는다.
- 새 페이지·새 라우트.
- 로고·다크 기본값·페이지 전환·카카오 규칙 완화.

## 7. 운영자가 정할 것

1. **서체**: Hahmlet(1순위, 이 문서 기준) / 마루 부리 / Paperlogy. 미리보기는 1주차 `feat/liner-display-font` preview에서
   실제 화면으로 본다.
2. **굵기**: 정적 700 하나(65KB) vs 가변 600~800(119KB). 기본은 700 하나.
3. **다크 바탕**: gray-900 유지(기본) vs 녹색 기운 잉크 `#0c110e`(gray-900 토큰 값 자체를 바꾸는 일이라 대비 가드
   리터럴까지 손댄다 — 2단계로 미룸).
4. **푸터**: 잉크(gray-950) 유지 vs 놀 그린 900.
5. **/artists**: 구독 아티스트 0인 동안 메뉴에서 내릴지.
6. **연습실 eyebrow**에 공실 상태 노출("지금 1실 입주 가능") 여부 — `PRACTICE_ROOM_HAS_VACANCY`가 정본이라 카피 추가는
   `practiceRoomAvailability.test`가 본다.
7. **촬영**: 주체(사진가 30~60만 / 직접)와 날짜. 2주차 시작 조건이다.
