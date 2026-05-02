import type { Config } from 'tailwindcss';

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
        // Editorial Cinematic 시스템 (DESIGN.md §2).
        canvas: {
          DEFAULT: '#faf9f7',
          soft: '#ffffff',
          warm: '#f3f1ec',
          deep: '#0c0a09',
        },
        ink: {
          DEFAULT: '#1d1b1a',
          'muted-80': '#3a3633',
          'muted-60': '#615d59',
          'muted-40': '#a39e98',
        },
        'on-dark': {
          DEFAULT: '#ffffff',
          soft: '#a8a29e',
        },
        'surface-dark-elevated': '#1c1917',
        // border-hairline / border-hairline-strong 전용 — bg-hairline 사용 금지 (의미상 fill 색이 아님)
        hairline: 'rgba(0,0,0,0.08)',
        'hairline-strong': 'rgba(0,0,0,0.14)',
        orb: {
          mint: '#a7e5d3',
          peach: '#f4c5a8',
          lavender: '#c8b8e0',
          sky: '#a8c8e8',
          rose: '#e8b8c4',
        },
        link: {
          DEFAULT: '#0a66c2',
          'on-dark': '#62aef0',
          focus: '#097fe8',
        },
        badge: {
          bg: '#f2f9ff',
          text: '#097fe8',
        },
      },
      fontSize: {
        'display-1': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.04em', fontWeight: '700' }],
        'display-2': ['3rem', { lineHeight: '1.2', letterSpacing: '-0.03em', fontWeight: '700' }],
        'heading-1': ['2.5rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '700' }],
        'heading-2': ['2.5rem', { lineHeight: '1.25', letterSpacing: '-0.02em', fontWeight: '700' }],
        'heading-3': ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '500' }],
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
        // Editorial Cinematic display scale (DESIGN.md §3). 옛 display-1/heading-1과 공존.
        'display-mega': ['clamp(2.5rem, 6vw, 4rem)', { lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '300' }],
        'display-xl':   ['clamp(2rem, 4.5vw, 3rem)',  { lineHeight: '1.08', letterSpacing: '-0.015em', fontWeight: '300' }],
        'display-lg':   ['clamp(1.75rem, 3.5vw, 2.25rem)', { lineHeight: '1.17', letterSpacing: '-0.01em', fontWeight: '300' }],
        'display-md':   ['1.75rem', { lineHeight: '1.2', letterSpacing: '0', fontWeight: '400' }],
        'display-sm':   ['1.5rem',  { lineHeight: '1.25', letterSpacing: '0', fontWeight: '300' }],
        'lead':         ['clamp(1.125rem, 1.6vw, 1.375rem)', { lineHeight: '1.45', letterSpacing: '0', fontWeight: '400' }],
        'title-md':     ['1.25rem', { lineHeight: '1.4', letterSpacing: '0', fontWeight: '500' }],
        'title-sm':     ['1.125rem', { lineHeight: '1.45', letterSpacing: '0', fontWeight: '500' }],
        'caption-upper': ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.08em', fontWeight: '600' }],
      },
      fontFamily: {
        // 사이트 전반 단일 폰트(Noto Sans KR). var(--font-noto-sans-kr)는
        // pages/_app.tsx의 next/font/google self-hosted 폰트 (3 weight: 400/700/900).
        // 빌드 시 Google Fonts에서 다운로드 → _next/static/media에 저장. 런타임은 자체 도메인 서빙.
        // fallback은 시스템 한글 폰트 → 시스템 폰트.
        sans: ['var(--font-noto-sans-kr)', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Apple SD Gothic Neo', 'Malgun Gothic', 'sans-serif'],
        display: ['var(--font-montserrat)', 'var(--font-noto-sans-kr)', 'sans-serif'],
        logo: ['var(--font-noto-sans-kr)', 'sans-serif'],
        // 인라인 <code>/마크다운 인라인 코드용 monospace 스택.
        // Tailwind default와 유사하되 source-code-pro 선호 추가.
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
      },
      borderRadius: {
        pill: '9999px',
        whisper: '4px',
        card: '12px',
        hero: '16px',
        orb: '24px',
      },
      boxShadow: {
        card: '0 4px 18px rgba(0,0,0,0.04), 0 2px 7.85px rgba(0,0,0,0.027), 0 0.8px 2.93px rgba(0,0,0,0.02), 0 0.175px 1.04px rgba(0,0,0,0.01)',
        deep: '0 1px 3px rgba(0,0,0,0.01), 0 3px 7px rgba(0,0,0,0.02), 0 7px 15px rgba(0,0,0,0.02), 0 14px 28px rgba(0,0,0,0.04), 0 23px 52px rgba(0,0,0,0.05)',
        'card-hover': '0 8px 28px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04), 0 1.5px 5px rgba(0,0,0,0.03)',
      },
      animation: {
        'spin-slow': 'spin 8s linear infinite',
        'ping-slow': 'ping 3s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
    },
  },
  // class 전략: 사용자 토글이 시스템 prefers-color-scheme를 override할 수 있도록
  // .dark 클래스가 <html>에 토글된다 (components/Layout.tsx).
  darkMode: 'class',
  plugins: [
    function ({ addUtilities }: { addUtilities: any }) {
      addUtilities({
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            display: 'none'
          }
        }
      })
    }
  ],
}

export default config;
