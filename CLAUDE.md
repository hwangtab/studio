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

# Hero font subset (LCP)
# prebuild에서 자동 실행됨. hero h1 텍스트(data/home.ts heroContent,
# public/locales/*/common.json의 *.hero.title*) 변경 후 빌드하면 woff2가 재생성되며
# 변경된 woff2 + pretendard-hero.chars.json 사이드카를 반드시 함께 commit해야 함.
# 빠뜨리면 hero-font-subset.test.js(CI)가 --check 모드로 잡아낸다.
# 수동 재실행:
node scripts/generate-hero-font.mjs
node scripts/generate-hero-font.mjs --check  # 네트워크 없이 subset 커버리지 검증
```

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
  `.glass-clear`(화려한 배경 위 소수 요소 전용, 뷰포트당 1–2개), `.glass-bar`(전폭
  sticky 바 — border·그림자는 컴포넌트가 직접 관리)
- **자동 폴백** (토큰 교체만으로 전체 강등, 컴포넌트 코드 무변경):
  1. `prefers-reduced-transparency` (OS 접근성)
  2. 터치 기기 + `max-width: 768px` — 1차 릴리스는 **모바일 전체 솔리드**
  3. 킬스위치: `NEXT_PUBLIC_DISABLE_GLASS=1` → `_document.tsx`가 `<html data-glass="solid">` 부여
- 솔리드 폴백 값은 기존 `bg-white/95`·`dark:bg-gray-900/95`와 동일 — 강등 시 리뉴얼 이전 모습으로 복귀
- `-webkit-backdrop-filter` 프리픽스는 autoprefixer가 production browserslist(safari≥16) 기준
  자동 생성 — 수동으로 쓰지 말 것 (dev 모드에선 development browserslist라 프리픽스가 안 보이는 게 정상)
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
  프리뷰 배포 PSI 실측은 아직 미수행 — 배포 전 필수.

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