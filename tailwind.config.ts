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
        primary: {
          light: '#7c3aed', // 밝은 보라색
          DEFAULT: '#6d28d9', // 보라색
          dark: '#5b21b6', // 진한 보라색
        },
        secondary: {
          light: '#ec4899', // 밝은 핑크
          DEFAULT: '#db2777', // 핑크
          dark: '#be185d', // 진한 핑크
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
        sans: ['Pretendard', 'Noto Sans KR', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Roboto', 'Helvetica Neue', 'Segoe UI', 'Apple SD Gothic Neo', 'Malgun Gothic', 'sans-serif'],
        title: ['Pretendard', 'sans-serif'],
        display: ['var(--font-montserrat)', 'Pretendard', 'sans-serif'],
        logo: ['PartialSansKR-Logo', 'PartialSansKR-Regular', 'Pretendard', 'sans-serif'],
        pretendard: ['Pretendard', 'Noto Sans KR', 'sans-serif'],
      },
      animation: {
        'spin-slow': 'spin 8s linear infinite',
        'ping-slow': 'ping 3s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
    },
  },
  darkMode: 'class',
  plugins: [
    function ({ addUtilities, addComponents, theme }: { addUtilities: any, addComponents: any, theme: any }) {
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
