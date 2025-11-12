module.exports = {
  content: [
    "./pages/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./utils/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
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
          DEFAULT: '#059669', // 에메랄드
          dark: '#047857', // 진한 에메랄드
        },
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
          950: '#030712',
        },
      },
      fontSize: {
        'display-1': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-2': ['3rem', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '700' }],
        'heading-1': ['2.5rem', { lineHeight: '1.2', fontWeight: '700' }],
        'heading-2': ['2.5rem', { lineHeight: '1.25', fontWeight: '700' }],
        'heading-3': ['1.5rem', { lineHeight: '1.3', fontWeight: '500' }],
        'subtitle-1': ['1.25rem', { lineHeight: '1.4', fontWeight: '500' }],
        'subtitle-2': ['1.125rem', { lineHeight: '1.4', fontWeight: '500' }],
        'body-1': ['1rem', { lineHeight: '1.5', fontWeight: '300' }],
        'body-1-light': ['1rem', { lineHeight: '1.5', fontWeight: '300' }],
        'body-1-extra-light': ['1rem', { lineHeight: '1.5', fontWeight: '200' }],
        'body-1-medium': ['1rem', { lineHeight: '1.5', fontWeight: '500' }],
        'body-2': ['0.875rem', { lineHeight: '1.5', fontWeight: '200' }],
        'caption': ['0.75rem', { lineHeight: '1.5', fontWeight: '100' }],
        'text-thin': ['1rem', { lineHeight: '1.5', fontWeight: '100' }],
        'text-extra-light': ['0.875rem', { lineHeight: '1.5', fontWeight: '200' }],
      },
      fontFamily: {
        sans: ['GmarketSans', 'Pretendard', 'Noto Sans KR', 'sans-serif'],
        title: ['GmarketSans', 'sans-serif'],
        display: ['Montserrat', 'GmarketSans', 'sans-serif'],
        logo: ['PartialSansKR-Regular', 'GmarketSans', 'sans-serif'],
        pretendard: ['Pretendard', 'Noto Sans KR', 'sans-serif'],
      },
    },
  },
  darkMode: 'class',
  plugins: [
    function({ addUtilities, addComponents, theme }) {
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
        },
        '.line-clamp-2': {
          'overflow': 'hidden',
          'display': '-webkit-box',
          '-webkit-box-orient': 'vertical',
          '-webkit-line-clamp': '2',
        },
        '.line-clamp-3': {
          'overflow': 'hidden',
          'display': '-webkit-box',
          '-webkit-box-orient': 'vertical',
          '-webkit-line-clamp': '3',
        },
        '.line-clamp-4': {
          'overflow': 'hidden',
          'display': '-webkit-box',
          '-webkit-box-orient': 'vertical',
          '-webkit-line-clamp': '4',
        }
      })

      // Typography component classes
      addComponents({
        '.typo-section-title': {
          fontSize: theme('fontSize.heading-2[0]'),
          lineHeight: theme('fontSize.heading-2[1].lineHeight'),
          fontWeight: theme('fontSize.heading-2[1].fontWeight'),
        },
        '.typo-section-lead': {
          fontSize: theme('fontSize.subtitle-1[0]'),
          lineHeight: theme('fontSize.subtitle-1[1].lineHeight'),
          fontWeight: '300',
        },
        '.typo-card-title': {
          fontSize: theme('fontSize.heading-3[0]'),
          lineHeight: theme('fontSize.heading-3[1].lineHeight'),
          fontWeight: '400',
        },
        '.typo-card-subtitle': {
          fontSize: theme('fontSize.subtitle-2[0]'),
          lineHeight: theme('fontSize.subtitle-2[1].lineHeight'),
          fontWeight: '300',
        },
        '.typo-card-body': {
          fontSize: theme('fontSize.body-1[0]'),
          lineHeight: theme('fontSize.body-1[1].lineHeight'),
          fontWeight: theme('fontSize.body-1[1].fontWeight'),
        },
        '.typo-card-meta': {
          fontSize: theme('fontSize.body-2[0]'),
          lineHeight: theme('fontSize.body-2[1].lineHeight'),
          fontWeight: theme('fontSize.body-2[1].fontWeight'),
        },
        '.typo-card-cta': {
          fontSize: theme('fontSize.body-1-medium[0]'),
          lineHeight: theme('fontSize.body-1-medium[1].lineHeight'),
          fontWeight: theme('fontSize.body-1-medium[1].fontWeight'),
        },
        '.typo-nav-link': {
          fontSize: theme('fontSize.body-1-medium[0]'),
          lineHeight: theme('fontSize.body-1-medium[1].lineHeight'),
          fontWeight: theme('fontSize.body-1-medium[1].fontWeight'),
        },
        '.typo-footer-heading': {
          fontSize: theme('fontSize.subtitle-2[0]'),
          lineHeight: theme('fontSize.subtitle-2[1].lineHeight'),
          fontWeight: theme('fontSize.subtitle-2[1].fontWeight'),
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
