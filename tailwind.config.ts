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
    }
  ],
}

export default config;
