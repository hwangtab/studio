import type { Config, PluginAPI } from 'tailwindcss/types/config';

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
          light: '#7c3aed', // 밝은 보라색
          DEFAULT: '#6d28d9', // 보라색
          dark: '#5b21b6', // 진한 보라색
        },
        secondary: {
          light: '#ec4899', // 밝은 핑크
          // #db2777(pink-600)은 gray-50 배경 대비 4.39:1로 WCAG AA(4.5) 간발의 차로 미달.
          // accent와 동일하게 pink-700로 승격하여 흰/회색 배경 버튼 모두 통과.
          DEFAULT: '#be185d', // 핑크 (AA 통과: 5.88:1)
          dark: '#9d174d', // 진한 핑크
        },
        accent: {
          light: '#10b981', // 밝은 에메랄드
          // #059669(emerald-600)는 흰 배경 대비 3.76:1로 WCAG AA(4.5) 미달.
          // text-accent/border-accent를 흰 배경 버튼에 자주 쓰므로 emerald-700로 승격.
          DEFAULT: '#047857', // 에메랄드 (AA 통과: 5.64:1)
          dark: '#065f46', // 진한 에메랄드
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
        'body-1': ['1rem', { lineHeight: '1.6', fontWeight: '300' }],
        'body-1-light': ['1rem', { lineHeight: '1.6', fontWeight: '300' }],
        'body-1-extra-light': ['1rem', { lineHeight: '1.6', fontWeight: '300' }],
        'body-1-medium': ['1rem', { lineHeight: '1.6', fontWeight: '500' }],
        'body-2': ['0.875rem', { lineHeight: '1.6', fontWeight: '300' }],
        'caption': ['0.75rem', { lineHeight: '1.6', fontWeight: '300' }],
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
        sans: ['var(--font-pretendard)', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Apple SD Gothic Neo', 'Malgun Gothic', 'sans-serif'],
        title: ['var(--font-pretendard)', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Apple SD Gothic Neo', 'Malgun Gothic', 'sans-serif'],
        display: ['var(--font-pretendard)', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Apple SD Gothic Neo', 'Malgun Gothic', 'sans-serif'],
        logo: ['var(--font-pretendard)', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Apple SD Gothic Neo', 'Malgun Gothic', 'sans-serif'],
        // hero h1 전용 micro-subset. var(--font-pretendard-hero)는 lib/fonts.ts의
        // pretendardHero (Pretendard Bold 700 weight, hero 텍스트 글자만 self-host,
        // ~30KB). preload=true라 critical path에서 swap 거의 즉시. 글리프 미포함
        // 글자는 fallback 변수(전체 Pretendard Variable)로 자동 swap.
        hero: ['var(--font-pretendard-hero)', 'var(--font-pretendard)', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Apple SD Gothic Neo', 'Malgun Gothic', 'sans-serif'],
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
      })

      // Liquid Glass 재질 클래스 — 값은 styles/globals.css의 --glass-* 토큰.
      // 라이트/다크 분기와 솔리드 폴백(투명도 감소·모바일·킬스위치)이 전부
      // 토큰 레이어에서 처리되므로 여기에는 .dark & nesting이 없다.
      // 자체 border를 포함하므로 적용 시 컴포넌트의 border-* 클래스는 제거할 것.
      // -webkit-backdrop-filter는 명시적으로 둔다 — autoprefixer가 이 컴포넌트
      // 클래스들에 프리픽스를 일관되게 안 붙이는 것이 빌드 CSS 감사로 확인됨
      // (glass-regular만 붙고 glass-clear·glass-bar 누락). Safari 16–17 필수.
      addComponents({
        // 기본 재질: 헤더, 카드, 모달, 드롭다운 등 텍스트를 얹는 표면
        '.glass-regular': {
          backgroundColor: 'var(--glass-tint)',
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
