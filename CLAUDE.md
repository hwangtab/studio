# CLAUDE.md

This file provides guidance for development in the **Studio NOL** repository.

## Project Overview

Studio NOL is a multi-language music studio website built with:
- **Framework**: Next.js 15.5.12 (Pages Router)
- **Runtime**: React 19.2.4
- **Styling**: Tailwind CSS with custom design system
- **Animation**: Framer Motion
- **i18n**: react-i18next (7 languages: ko, en, zh, es, vi, th, uz)
- **Content**: Markdown-based story system
- **Deployment**: Vercel

## Key Technologies

- **Frontend**: Next.js 15.5.12, React 19.2.4, Tailwind CSS, Framer Motion, Lucide React
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
```

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

알려진 한계: 페이지 카피만 `public/locales/*/common.json`에서 고치면 날짜가 오르지 않는다.
common.json은 전 페이지 공유 파일이라 반영하면 카피 한 줄에 모든 페이지가 갱신 처리되어
원래 문제로 돌아간다. 과소보고는 안전한 방향이라 의도적으로 감수한다 — 크게 개편했다면
`pageLastmod.json`의 해당 날짜를 손으로 올려도 된다.

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

## Deployment Notes

- **Hosting**: Vercel (Standard Next.js deployment)
- **Environment Variables**: Configure `RESEND_API_KEY` (and optional `RESEND_FROM`) in Vercel dashboard
- **Build**: Prebuild hook runs image optimization automatically