import type { Config, PluginAPI } from 'tailwindcss/types/config';
import { BRAND_COLOR } from './lib/brandColor';

const config: Config = {
  content: [
    "./pages/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}",
    "./utils/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    screens: {
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
      '3xl': '1800px',
    },
    extend: {
      colors: {
        primary: {
          // 라이너 노트(2026-10-06, docs/design-liner-notes-plan-2026-10.md §3-1): 보라(violet-700)를
          // 로고의 짙은 녹색 계열로. 값의 정본은 lib/brandColor.ts — 메일·정적 카드가 같은 값을 쓴다.
          light: BRAND_COLOR.primaryLight, // 흰 5.02:1 · 종이 4.69:1 — 작은 텍스트에는 쓰지 않는다
          DEFAULT: BRAND_COLOR.primary, // 흰 7.13:1 · 종이 6.67:1 (옛 보라 7.10:1과 같은 수준)
          dark: BRAND_COLOR.primaryDark, // 로고 실측값. 흰 글씨 12.4:1 — 히어로 잉크 면·solid hover
          // 다크 배경(gray-900 #030712) 위 텍스트·테두리용. DEFAULT는 2.82:1, light는 4.01:1로
          // 다크 텍스트에 못 쓴다 — lighter만 13.2:1로 통과한다. 규칙은 보라 때와 같다.
          lighter: BRAND_COLOR.primaryOnDark,
        },
        secondary: {
          // 라이너 노트: 핑크를 버리고 primary와 같은 값으로 재매핑했다(브랜드색은 하나). 24파일 66곳의
          // secondary 클래스가 아직 남아 있어 이름을 유지한다 — 4주차(feat/liner-rulelist)에 primary로
          // 치환하고 토큰을 지운다. 새 코드에서 secondary-*를 쓰지 말 것.
          light: BRAND_COLOR.primaryOnDark,
          DEFAULT: BRAND_COLOR.primary,
          dark: BRAND_COLOR.primaryDark,
        },
        accent: {
          // 라이너 노트: 성공·긍정 = 브랜드색. secondary와 같은 이유로 이름만 남기고 값은 primary다.
          // accent-light는 다크 텍스트 짝(13곳)이라 primaryOnDark(13.2:1)로 간다.
          light: BRAND_COLOR.primaryOnDark,
          DEFAULT: BRAND_COLOR.primary,
          dark: BRAND_COLOR.primaryDark,
        },
        // 라이트 바탕. 순백 대신 종이(라이너 노트 §3-1). Section default/alternate와 body·Layout이 쓴다.
        // 글래스 카드 틴트(흰 0.72)는 그대로라 카드가 종이보다 살짝 밝게 뜬다.
        paper: {
          DEFAULT: BRAND_COLOR.paper,
          2: BRAND_COLOR.paper2,
        },
        // 카카오톡 진입점 전용 컬러. 사이트에서 "노란 버튼 = 카카오톡"이 성립하도록
        // 카카오로 가는 링크에만 쓰고, 그 외 어떤 CTA에도 쓰지 않는다(반대 방향도 금지).
        // 옐로/딤드는 카카오 공식 값, ink는 옐로 위 대비 16:1 — 흰 글씨는 대비 1.3:1로
        // 올릴 수 없으니 이 버튼의 글자·아이콘은 항상 ink를 쓴다.
        kakao: {
          DEFAULT: '#FEE500',
          dark: '#FADA0A', // hover
          ink: '#191600',  // 옐로 위 텍스트·아이콘
        },
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#4b5563', // Darkened for accessibility (WCAG AA)
          600: '#374151',
          700: '#1f2937',
          800: '#111827',
          900: '#030712',
          950: '#020617',
        },
      },
      fontSize: {
        'display-1': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.04em', fontWeight: '700' }],
        'display-2': ['3rem', { lineHeight: '1.2', letterSpacing: '-0.03em', fontWeight: '700' }],
        'heading-1': ['2.5rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '700' }],
        'heading-2': ['2.5rem', { lineHeight: '1.25', letterSpacing: '-0.02em', fontWeight: '700' }],
        'heading-3': ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '500' }],
        'heading-4': ['1.25rem', { lineHeight: '1.4', letterSpacing: '-0.01em', fontWeight: '700' }],
        'subtitle-1': ['1.25rem', { lineHeight: '1.4', fontWeight: '500' }],
        'subtitle-2': ['1.125rem', { lineHeight: '1.4', fontWeight: '500' }],
        // 본문 굵기는 --body-weight로 뺀다. v1은 변수를 정의하지 않아 300 그대로이고
        // (docs/design-system.md §9), 디자인 v2 스코프([data-edition='v2'])만 400으로 올린다.
        // 300 획은 zh·th 폴백 폰트와 Windows 렌더링에서 더 가늘어져 읽히는 대비가 떨어진다.
        'body-1': ['1rem', { lineHeight: '1.6', fontWeight: 'var(--body-weight, 300)' }],
        'body-1-light': ['1rem', { lineHeight: '1.6', fontWeight: 'var(--body-weight, 300)' }],
        'body-1-extra-light': ['1rem', { lineHeight: '1.6', fontWeight: 'var(--body-weight, 300)' }],
        'body-1-medium': ['1rem', { lineHeight: '1.6', fontWeight: '500' }],
        'body-2': ['0.875rem', { lineHeight: '1.6', fontWeight: 'var(--body-weight, 300)' }],
        'caption': ['0.75rem', { lineHeight: '1.6', fontWeight: 'var(--body-weight, 300)' }],
        'text-thin': ['1rem', { lineHeight: '1.5', fontWeight: '100' }],
        'text-extra-light': ['0.875rem', { lineHeight: '1.5', fontWeight: '200' }],
      },
      fontFamily: {
        // 사이트 전반 단일 폰트(Pretendard Variable). var(--font-pretendard)는
        // pages/_app.tsx의 next/font/local self-hosted 폰트 (variable woff2, weight
        // 45-920 axis range). 단일 woff2(~2MB)에 모든 weight 들어있어 chunk 분할
        // 없음. preload=false로 font-display:swap에 의한 fallback paint 우선,
        // Pretendard는 lazy 도착 후 swap. fallback은 시스템 한글 폰트(Pretendard가
        // Apple SD Gothic Neo + Inter 베이스라 swap gap 시각적으로 작음).
        // var(--font-locale): Pretendard에 없는 글자(zh 한자·th 태국문자)가 넘어갈 자리.
        // 기본값은 -apple-system이라 ko 등은 예전 스택과 같고, zh/th만 styles/globals.css의
        // :root:lang()에서 PingFang SC·Leelawadee 등으로 바뀐다. 이 자리가 비어 있던 동안은
        // zh 한자가 Apple SD Gothic Neo·Malgun Gothic(한국식 자형)과 섞여 그려졌다.
        sans: ['var(--font-pretendard)', 'var(--font-locale)', 'BlinkMacSystemFont', 'system-ui', 'Apple SD Gothic Neo', 'Malgun Gothic', 'sans-serif'],
        title: ['var(--font-pretendard)', 'var(--font-locale)', 'BlinkMacSystemFont', 'system-ui', 'Apple SD Gothic Neo', 'Malgun Gothic', 'sans-serif'],
        display: ['var(--font-pretendard)', 'var(--font-locale)', 'BlinkMacSystemFont', 'system-ui', 'Apple SD Gothic Neo', 'Malgun Gothic', 'sans-serif'],
        logo: ['var(--font-pretendard)', 'var(--font-locale)', 'BlinkMacSystemFont', 'system-ui', 'Apple SD Gothic Neo', 'Malgun Gothic', 'sans-serif'],
        // hero h1 전용 micro-subset. var(--font-pretendard-hero)는 lib/fonts.ts의
        // pretendardHero (Pretendard Bold 700 weight, hero 텍스트 글자만 self-host,
        // ~30KB). preload=true라 critical path에서 swap 거의 즉시. 글리프 미포함
        // 글자는 fallback 변수(전체 Pretendard Variable)로 자동 swap.
        hero: ['var(--font-pretendard-hero)', 'var(--font-pretendard)', 'var(--font-locale)', 'BlinkMacSystemFont', 'system-ui', 'Apple SD Gothic Neo', 'Malgun Gothic', 'sans-serif'],
        // 인라인 <code>/마크다운 인라인 코드용 monospace 스택.
        // Tailwind default와 유사하되 source-code-pro 선호 추가.
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
      },
      animation: {
        'spin-slow': 'spin 8s linear infinite',
        'ping-slow': 'ping 3s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
      // 리듬 토큰(CSS) — utils/animationUtils.ts의 DUR/EASE_STANDARD와 값·이름 동기화.
      // extend라 Tailwind 기본 duration-200/300/700·ease-* 클래스는 그대로 유효(하위호환).
      // framer(초)  DUR.fast 0.2 / DUR.base 0.3 / DUR.slow 0.7
      //          ↔  duration-fast 200ms / duration-base 300ms / duration-slow 700ms
      transitionDuration: {
        fast: '200ms',
        base: '300ms',
        slow: '700ms',
      },
      // EASE_STANDARD = cubic-bezier(0.4,0,0.2,1) = Tailwind ease-in-out DEFAULT.
      // `ease-standard` 유틸이 framer EASE_STANDARD와 같은 곡선을 가리킴.
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  // class 전략: 사용자 토글이 시스템 prefers-color-scheme를 override할 수 있도록
  // .dark 클래스가 <html>에 토글된다 (components/Layout.tsx). 이 모드에선
  // addComponents 안의 `.dark &` nesting이 표준이고 정상 동작한다 — Tailwind v4
  // 마이그레이션 시에는 selector strategy 재검토 필요.
  darkMode: 'class',
  plugins: [
    function ({ addUtilities, addComponents, theme }: PluginAPI) {
      addUtilities({
        '.scrollbar-hide': {
          /* IE and Edge */
          '-ms-overflow-style': 'none',
          /* Firefox */
          'scrollbar-width': 'none',
          /* Safari and Chrome */
          '&::-webkit-scrollbar': {
            display: 'none'
          }
        }
      })

      // Typography component classes
      addComponents({
        '.typo-section-title': {
          fontFamily: theme('fontFamily.title'),
          fontSize: theme('fontSize.heading-2[0]'),
          lineHeight: theme('fontSize.heading-2[1].lineHeight'),
          fontWeight: theme('fontSize.heading-2[1].fontWeight'),
          color: theme('colors.gray.800'),
          '.dark &': {
            color: theme('colors.white'),
          },
        },
        '.typo-section-lead': {
          fontSize: theme('fontSize.subtitle-1[0]'),
          lineHeight: theme('fontSize.subtitle-1[1].lineHeight'),
          fontWeight: '500',
          color: theme('colors.gray.600'),
          '.dark &': {
            color: theme('colors.gray.400'),
          },
        },
        '.typo-card-title': {
          fontFamily: theme('fontFamily.title'),
          fontSize: theme('fontSize.heading-3[0]'),
          lineHeight: theme('fontSize.heading-3[1].lineHeight'),
          fontWeight: '700',
          color: theme('colors.gray.800'),
          '.dark &': {
            color: theme('colors.gray.200'),
          },
        },
        '.typo-card-subtitle': {
          fontFamily: theme('fontFamily.title'),
          fontSize: theme('fontSize.subtitle-2[0]'),
          lineHeight: theme('fontSize.subtitle-2[1].lineHeight'),
          fontWeight: '700',
          color: theme('colors.gray.600'),
          '.dark &': {
            color: theme('colors.gray.300'),
          },
        },
        '.typo-card-body': {
          fontSize: theme('fontSize.body-1[0]'),
          lineHeight: theme('fontSize.body-1[1].lineHeight'),
          fontWeight: theme('fontSize.body-1[1].fontWeight'),
          color: theme('colors.gray.600'),
          '.dark &': {
            color: theme('colors.gray.300'),
          },
        },
        '.typo-card-meta': {
          fontSize: theme('fontSize.body-2[0]'),
          lineHeight: theme('fontSize.body-2[1].lineHeight'),
          fontWeight: theme('fontSize.body-2[1].fontWeight'),
          color: theme('colors.gray.500'),
          '.dark &': {
            color: theme('colors.gray.400'),
          },
        },
        '.typo-card-cta': {
          fontSize: theme('fontSize.body-1-medium[0]'),
          lineHeight: theme('fontSize.body-1-medium[1].lineHeight'),
          fontWeight: theme('fontSize.body-1-medium[1].fontWeight'),
          color: theme('colors.gray.600'),
          '.dark &': {
            color: theme('colors.gray.200'),
          },
        },
        '.typo-nav-link': {
          fontFamily: theme('fontFamily.title'),
          fontSize: theme('fontSize.body-1-medium[0]'),
          lineHeight: theme('fontSize.body-1-medium[1].lineHeight'),
          fontWeight: theme('fontSize.body-1-medium[1].fontWeight'),
        },
        '.typo-footer-heading': {
          fontFamily: theme('fontFamily.title'),
          fontSize: theme('fontSize.subtitle-2[0]'),
          lineHeight: theme('fontSize.subtitle-2[1].lineHeight'),
          fontWeight: '700',
        },
        '.typo-footer-body': {
          fontSize: theme('fontSize.body-2[0]'),
          lineHeight: theme('fontSize.body-2[1].lineHeight'),
          fontWeight: theme('fontSize.body-2[1].fontWeight'),
        },
        '.typo-footer-meta': {
          fontSize: theme('fontSize.caption[0]'),
          lineHeight: theme('fontSize.caption[1].lineHeight'),
          fontWeight: theme('fontSize.caption[1].fontWeight'),
        },
        // 트랜잭션·결과 페이지 h1(예약 완료, 서명, 구독 관리). 마케팅 페이지 h1은
        // ImageHero의 font-hero 스케일을 쓰므로 여기 해당하지 않는다.
        '.typo-page-title': {
          fontFamily: theme('fontFamily.title'),
          fontSize: theme('fontSize.heading-3[0]'),
          lineHeight: theme('fontSize.heading-3[1].lineHeight'),
          letterSpacing: theme('fontSize.heading-3[1].letterSpacing'),
          fontWeight: '700',
          color: theme('colors.gray.900'),
          '.dark &': {
            color: theme('colors.white'),
          },
        },
        // 카드 밖 일반 본문. .typo-card-body와 값은 같고 의미만 다르다 —
        // 호출부가 text-gray-* 를 덧붙이면 utilities 레이어가 이겨서 그 색이 적용된다.
        '.typo-body': {
          fontSize: theme('fontSize.body-1[0]'),
          lineHeight: theme('fontSize.body-1[1].lineHeight'),
          fontWeight: theme('fontSize.body-1[1].fontWeight'),
          color: theme('colors.gray.700'),
          '.dark &': {
            color: theme('colors.gray.300'),
          },
        },
        '.typo-caption': {
          fontSize: theme('fontSize.caption[0]'),
          lineHeight: theme('fontSize.caption[1].lineHeight'),
          fontWeight: theme('fontSize.caption[1].fontWeight'),
          color: theme('colors.gray.500'),
          '.dark &': {
            color: theme('colors.gray.400'),
          },
        },
        // 버튼 라벨. 색은 버튼 variant가 정하므로 여기서 지정하지 않는다.
        '.typo-button': {
          fontFamily: theme('fontFamily.title'),
          fontSize: theme('fontSize.body-1-medium[0]'),
          lineHeight: theme('fontSize.body-1-medium[1].lineHeight'),
          fontWeight: theme('fontSize.body-1-medium[1].fontWeight'),
        },
        // ── 디자인 v2 역할 클래스 ─────────────────────────────────────────
        // v1 클래스를 고치지 않고 **추가**한다. 전역 h2와 스토리 마크다운 제목은
        // v1 토큰을 그대로 쓰므로 여기서 무엇을 바꿔도 스토리 1,700여 편에 닿지 않는다.
        //
        // 섹션 제목 위의 작은 라벨. heading이 아니라 <p>로 쓴다(제목 구조를 흐리지 않게).
        // uppercase는 라틴 문자에만 효과가 있고, 자간은 로케일 블록이 --eyebrow-ls로 0까지 내린다.
        '.typo-eyebrow': {
          fontFamily: theme('fontFamily.title'),
          fontSize: '0.8125rem',
          lineHeight: '1.4',
          fontWeight: '600',
          letterSpacing: 'var(--eyebrow-ls, 0.08em)',
          textTransform: 'uppercase',
          fontVariantNumeric: 'tabular-nums',
          color: theme('colors.primary.DEFAULT'),
          '.dark &': {
            color: theme('colors.primary.lighter'),
          },
        },
        // v2 섹션 제목. 그라디언트 대신 잉크(gray-950) 단색 — 강조는 크기와 굵기가 맡는다.
        // 행간·자간은 변수로 두고 th·vi·zh에서 styles/globals.css가 재정의한다
        // (1.1 행간은 태국어·베트남어의 위아래 부호를 자르고, 음수 자간은 한자를 뭉친다).
        '.typo-display-section': {
          fontFamily: theme('fontFamily.title'),
          fontSize: 'clamp(2rem, 1.25rem + 3vw, 3.5rem)',
          lineHeight: 'var(--display-lh, 1.12)',
          letterSpacing: 'var(--display-ls, -0.03em)',
          fontWeight: '700',
          color: theme('colors.gray.950'),
          overflowWrap: 'break-word',
          hyphens: 'auto',
          '.dark &': {
            color: theme('colors.white'),
          },
        },
      })

      // Liquid Glass 재질 클래스 — 값은 styles/globals.css의 --glass-* 토큰.
      // 라이트/다크 분기와 솔리드 폴백(투명도 감소·모바일·킬스위치)이 전부
      // 토큰 레이어에서 처리되므로 여기에는 .dark & nesting이 없다.
      // 자체 border를 포함하므로 적용 시 컴포넌트의 border-* 클래스는 제거할 것.
      // -webkit-backdrop-filter는 명시적으로 둔다 — autoprefixer가 이 컴포넌트
      // 클래스들에 프리픽스를 일관되게 안 붙이는 것이 빌드 CSS 감사로 확인됨
      // (glass-regular만 붙고 glass-clear·glass-bar 누락). Safari 16–17 필수.
      addComponents({
        // 기본 재질: 헤더, 카드, 모달 등 텍스트를 얹는 표면
        '.glass-regular': {
          backgroundColor: 'var(--glass-tint)',
          '-webkit-backdrop-filter': 'var(--glass-filter)',
          backdropFilter: 'var(--glass-filter)',
          border: '1px solid var(--glass-border)',
          boxShadow: 'inset 0 1px 0 var(--glass-spec), var(--glass-shadow)',
        },
        // 텍스트 밀도 높은 플로팅 메뉴 전용(드롭다운·언어 메뉴): 큰 컬러
        // 타이포그래피 위에 열려도 비침이 레이블과 경쟁하지 않도록 틴트만
        // 0.88로 올린 regular 변형. iOS 26도 메뉴/팝오버엔 최불투명 재질을 쓴다.
        '.glass-menu': {
          backgroundColor: 'var(--glass-tint-menu)',
          '-webkit-backdrop-filter': 'var(--glass-filter)',
          backdropFilter: 'var(--glass-filter)',
          border: '1px solid var(--glass-border)',
          boxShadow: 'inset 0 1px 0 var(--glass-spec), var(--glass-shadow)',
        },
        // 화려한 배경 위 소수 요소 전용(뷰포트당 1–2개): 히어로 위 CTA, 배지
        '.glass-clear': {
          backgroundColor: 'var(--glass-tint-clear)',
          '-webkit-backdrop-filter': 'var(--glass-filter-clear)',
          backdropFilter: 'var(--glass-filter-clear)',
          border: '1px solid var(--glass-border)',
          boxShadow: 'inset 0 1px 0 var(--glass-spec), var(--glass-shadow)',
        },
        // 전폭 sticky 바(앵커 네비, 모달 헤더): border·그림자는 컴포넌트가
        // border-b 등으로 직접 관리하고 재질(배경+블러+스펙큘러 엣지)만 입힌다
        '.glass-bar': {
          backgroundColor: 'var(--glass-tint)',
          '-webkit-backdrop-filter': 'var(--glass-filter)',
          backdropFilter: 'var(--glass-filter)',
          boxShadow: 'inset 0 1px 0 var(--glass-spec)',
        },
        // 인플로우 카드용: backdrop-filter 없는 글래스(틴트+보더+스펙큘러).
        // 정적 섹션 배경 위 카드는 뒤로 지나가는 콘텐츠가 없어 블러 결과가
        // 배경색과 동일 — 시각 이득 0에 GPU만 소모하므로 filter를 뺀다.
        // blur 예산은 fixed/sticky 레이어(헤더·ScrollToTop·glass-bar)에만 쓴다.
        '.glass-card': {
          backgroundColor: 'var(--glass-tint)',
          border: '1px solid var(--glass-border)',
          boxShadow: 'inset 0 1px 0 var(--glass-spec), var(--glass-shadow)',
        },
      })
    }
  ],
}

export default config;
